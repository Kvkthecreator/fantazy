"""Scene generation service.

Handles automatic scene card generation for key conversation moments.
Works with existing ImageService for generation, StorageService for upload.
"""

import logging
import uuid
import os
from typing import Optional, Dict, Any
from uuid import UUID

from app.services.image import ImageService
from app.services.llm import LLMService
from app.services.storage import StorageService

log = logging.getLogger(__name__)


# Scene generation prompts
SCENE_PROMPT_TEMPLATE = """Based on the conversation moment, generate a vivid scene description for an anime-style illustration.

Character: {character_name}
Scene setting: {scene}
Moment description: {moment}

Generate a scene description that:
1. Captures the current mood and atmosphere
2. Shows the character in an evocative setting
3. Uses warm, cozy anime aesthetics
4. Includes specific visual details (lighting, colors, atmosphere)

Format your response as a single paragraph scene description suitable for image generation.
Style tags to incorporate: anime style, soft lighting, warm colors, slice-of-life aesthetic."""

CAPTION_PROMPT = """Write a short poetic caption (1-2 sentences) that captures this emotional moment. Keep it evocative but brief.

Scene: {prompt}

Caption:"""


class SceneService:
    """Service for generating and managing scene cards."""

    def __init__(self, db):
        self.db = db
        self.image_service = ImageService.get_instance()
        self.llm_service = LLMService.get_instance()
        self.storage_service = StorageService.get_instance()

    async def should_generate_scene(
        self,
        episode_id: UUID,
        trigger_type: str,
        message_count: int,
    ) -> bool:
        """Determine if we should generate a scene card.

        Trigger types:
        - episode_start: First message of episode
        - stage_change: Relationship stage advanced
        - milestone: Progress milestone (every 10 messages)
        """
        # Check how many scenes already exist for this episode
        count_query = """
            SELECT COUNT(*) as count FROM episode_images
            WHERE episode_id = :episode_id
        """
        result = await self.db.fetch_one(count_query, {"episode_id": str(episode_id)})
        existing_count = result["count"] if result else 0

        # Limits to avoid spam
        max_scenes_per_episode = 5

        if existing_count >= max_scenes_per_episode:
            return False

        if trigger_type == "episode_start":
            # Generate scene at episode start (first message)
            return message_count <= 2 and existing_count == 0

        elif trigger_type == "milestone":
            # Generate at message milestones
            milestones = [10, 25, 50]
            return message_count in milestones

        elif trigger_type == "stage_change":
            # Always generate on stage change
            return True

        return False

    async def generate_scene_for_moment(
        self,
        episode_id: UUID,
        user_id: UUID,
        character_id: UUID,
        character_name: str,
        scene_setting: str,
        moment_description: str,
        trigger_type: str,
        message_id: Optional[UUID] = None,
    ) -> Optional[Dict[str, Any]]:
        """Generate a scene card for a conversation moment.

        Returns the generated scene data or None if generation fails.
        """
        try:
            # Generate scene prompt via LLM
            prompt_request = SCENE_PROMPT_TEMPLATE.format(
                character_name=character_name,
                scene=scene_setting or "A cozy setting",
                moment=moment_description,
            )

            prompt_response = await self.llm_service.generate([
                {"role": "system", "content": "You are a creative scene description writer for anime-style illustrations."},
                {"role": "user", "content": prompt_request},
            ], max_tokens=300)
            scene_prompt = prompt_response.content.strip()

            # Generate image
            image_response = await self.image_service.generate(
                prompt=scene_prompt,
                negative_prompt="photorealistic, 3D render, harsh shadows, multiple characters, text, watermark",
                width=1024,
                height=1024,
            )

            if not image_response.images:
                log.warning("No image generated")
                return None

            image_bytes = image_response.images[0]
            image_id = uuid.uuid4()

            # Upload to storage
            storage_path = await self.storage_service.upload_scene(
                image_bytes=image_bytes,
                user_id=user_id,
                episode_id=episode_id,
                image_id=image_id,
            )

            # Generate caption
            caption = None
            try:
                caption_response = await self.llm_service.generate([
                    {"role": "user", "content": CAPTION_PROMPT.format(prompt=scene_prompt)},
                ], max_tokens=100)
                caption = caption_response.content.strip().strip('"')
            except Exception as e:
                log.warning(f"Caption generation failed: {e}")

            # Get next sequence index
            index_query = "SELECT get_next_episode_image_index(:episode_id) as idx"
            index_row = await self.db.fetch_one(index_query, {"episode_id": str(episode_id)})
            sequence_index = index_row["idx"] if index_row else 0

            # Save to database
            # 1. Create image_asset record
            await self.db.execute("""
                INSERT INTO image_assets (
                    id, type, user_id, character_id, storage_bucket, storage_path,
                    prompt, model_used, latency_ms, file_size_bytes
                )
                VALUES (
                    :id, 'scene', :user_id, :character_id, 'scenes', :storage_path,
                    :prompt, :model_used, :latency_ms, :file_size_bytes
                )
            """, {
                "id": str(image_id),
                "user_id": str(user_id),
                "character_id": str(character_id),
                "storage_path": storage_path,
                "prompt": scene_prompt,
                "model_used": image_response.model,
                "latency_ms": image_response.latency_ms,
                "file_size_bytes": len(image_bytes),
            })

            # 2. Create episode_images record
            await self.db.execute("""
                INSERT INTO episode_images (
                    episode_id, image_id, sequence_index, caption,
                    triggered_by_message_id, trigger_type
                )
                VALUES (
                    :episode_id, :image_id, :sequence_index, :caption,
                    :message_id, :trigger_type
                )
            """, {
                "episode_id": str(episode_id),
                "image_id": str(image_id),
                "sequence_index": sequence_index,
                "caption": caption,
                "message_id": str(message_id) if message_id else None,
                "trigger_type": trigger_type,
            })

            # Construct image URL
            supabase_url = os.getenv("SUPABASE_URL", "")
            image_url = f"{supabase_url}/storage/v1/object/authenticated/scenes/{storage_path}"

            log.info(f"Generated scene for episode {episode_id}: {caption}")

            return {
                "image_id": str(image_id),
                "episode_id": str(episode_id),
                "storage_path": storage_path,
                "image_url": image_url,
                "caption": caption,
                "sequence_index": sequence_index,
            }

        except Exception as e:
            log.error(f"Scene generation failed: {e}")
            return None

    async def get_recent_conversation_summary(
        self,
        episode_id: UUID,
        limit: int = 5,
    ) -> str:
        """Get a summary of recent conversation for scene context."""
        query = """
            SELECT role, content
            FROM messages
            WHERE episode_id = :episode_id
            ORDER BY created_at DESC
            LIMIT :limit
        """
        rows = await self.db.fetch_all(query, {
            "episode_id": str(episode_id),
            "limit": limit,
        })

        if not rows:
            return "Starting a new conversation"

        # Summarize recent exchange
        messages = [f"{row['role']}: {row['content'][:100]}" for row in reversed(rows)]
        return "\n".join(messages)
