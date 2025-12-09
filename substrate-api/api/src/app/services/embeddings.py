"""Embedding generation service using OpenAI."""
import os
import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
import httpx

log = logging.getLogger("uvicorn.error")

# OpenAI API configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536


class EmbeddingService:
    """Service for generating embeddings using OpenAI API."""

    def __init__(self):
        self.api_key = OPENAI_API_KEY
        self.model = EMBEDDING_MODEL
        self.base_url = "https://api.openai.com/v1"

    async def generate_text_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a text string."""
        if not self.api_key:
            log.warning("OPENAI_API_KEY not set, skipping embedding generation")
            return None

        if not text or not text.strip():
            log.warning("Empty text provided for embedding generation")
            return None

        # Truncate text if too long (max ~8191 tokens for text-embedding-3-small)
        # Rough estimate: 4 chars per token
        max_chars = 30000
        if len(text) > max_chars:
            text = text[:max_chars]
            log.info(f"Text truncated to {max_chars} characters for embedding")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/embeddings",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "input": text,
                        "encoding_format": "float"
                    }
                )
                response.raise_for_status()
                data = response.json()
                return data["data"][0]["embedding"]
        except httpx.HTTPStatusError as e:
            log.error(f"OpenAI API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            log.error(f"Error generating embedding: {e}")
            raise

    async def generate_batch_embeddings(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Generate embeddings for multiple texts."""
        if not self.api_key:
            log.warning("OPENAI_API_KEY not set, skipping embedding generation")
            return [None] * len(texts)

        # Filter empty texts
        valid_indices = [i for i, t in enumerate(texts) if t and t.strip()]
        valid_texts = [texts[i] for i in valid_indices]

        if not valid_texts:
            return [None] * len(texts)

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/embeddings",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "input": valid_texts,
                        "encoding_format": "float"
                    }
                )
                response.raise_for_status()
                data = response.json()

                # Map embeddings back to original indices
                result = [None] * len(texts)
                for i, emb_data in enumerate(data["data"]):
                    original_idx = valid_indices[emb_data["index"]]
                    result[original_idx] = emb_data["embedding"]

                return result
        except Exception as e:
            log.error(f"Error generating batch embeddings: {e}")
            raise

    def build_entity_text(self, entity: Dict[str, Any]) -> str:
        """Build searchable text from entity fields for embedding."""
        parts = []

        # Title is most important
        if entity.get("title"):
            parts.append(f"Title: {entity['title']}")

        # Rights type context
        if entity.get("rights_type"):
            parts.append(f"Type: {entity['rights_type'].replace('_', ' ')}")

        # Content fields
        content = entity.get("content") or {}
        if isinstance(content, dict):
            if content.get("description"):
                parts.append(f"Description: {content['description']}")
            if content.get("lyrics"):
                parts.append(f"Lyrics: {content['lyrics']}")
            if content.get("notes"):
                parts.append(f"Notes: {content['notes']}")
            # Add other relevant text fields
            for key in ["bio", "summary", "story", "background"]:
                if content.get(key):
                    parts.append(f"{key.title()}: {content[key]}")

        # Semantic metadata
        semantic = entity.get("semantic_metadata") or {}
        if isinstance(semantic, dict):
            if semantic.get("primary_tags"):
                parts.append(f"Tags: {', '.join(semantic['primary_tags'])}")
            if semantic.get("mood"):
                parts.append(f"Mood: {', '.join(semantic['mood'])}")

            type_fields = semantic.get("type_fields") or {}
            if type_fields.get("genre"):
                genres = type_fields["genre"]
                if isinstance(genres, list):
                    parts.append(f"Genre: {', '.join(genres)}")
            if type_fields.get("instrumentation"):
                parts.append(f"Instrumentation: {', '.join(type_fields['instrumentation'])}")

        return "\n".join(parts)


# Singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get the embedding service singleton."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


async def process_entity_embedding(db, entity_id: UUID, user_id: str) -> Dict[str, Any]:
    """
    Process embedding generation for a rights entity.

    This is the main function called by the processing job.
    """
    service = get_embedding_service()

    # Fetch entity data
    entity = await db.fetch_one("""
        SELECT id, catalog_id, rights_type, title, content, semantic_metadata
        FROM rights_entities
        WHERE id = :entity_id
    """, {"entity_id": str(entity_id)})

    if not entity:
        raise ValueError(f"Entity {entity_id} not found")

    # Build text for embedding
    entity_dict = dict(entity)
    text = service.build_entity_text(entity_dict)

    if not text.strip():
        # Update status to indicate no content to embed
        await db.execute("""
            UPDATE rights_entities
            SET embedding_status = 'ready',
                updated_at = now()
            WHERE id = :entity_id
        """, {"entity_id": str(entity_id)})
        return {"status": "skipped", "reason": "no_content"}

    # Generate embedding
    embedding = await service.generate_text_embedding(text)

    if embedding is None:
        await db.execute("""
            UPDATE rights_entities
            SET embedding_status = 'failed',
                processing_error = 'Failed to generate embedding',
                updated_at = now()
            WHERE id = :entity_id
        """, {"entity_id": str(entity_id)})
        return {"status": "failed", "reason": "embedding_generation_failed"}

    # Store embedding in database
    async with db.transaction():
        # Delete existing text embeddings for this entity
        await db.execute("""
            DELETE FROM entity_embeddings
            WHERE rights_entity_id = :entity_id AND embedding_type = 'text'
        """, {"entity_id": str(entity_id)})

        # Insert new embedding
        await db.execute("""
            INSERT INTO entity_embeddings (
                rights_entity_id, embedding_type, model_id, model_version,
                embedding, metadata
            )
            VALUES (
                :entity_id, 'text', :model_id, :model_version,
                :embedding, :metadata
            )
        """, {
            "entity_id": str(entity_id),
            "model_id": EMBEDDING_MODEL,
            "model_version": "1",
            "embedding": f"[{','.join(map(str, embedding))}]",
            "metadata": {"text_length": len(text), "text_preview": text[:200]}
        })

        # Update entity status
        await db.execute("""
            UPDATE rights_entities
            SET embedding_status = 'ready',
                processing_error = NULL,
                updated_at = now()
            WHERE id = :entity_id
        """, {"entity_id": str(entity_id)})

    return {
        "status": "success",
        "embedding_type": "text",
        "model": EMBEDDING_MODEL,
        "text_length": len(text)
    }
