"""Conversation service - orchestrates chat interactions."""

import json
import logging
from typing import AsyncIterator, Dict, List, Optional
from uuid import UUID

from app.models.character import Character
from app.models.episode import Episode
from app.models.message import Message, MessageRole, ConversationContext, MemorySummary, HookSummary
from app.models.relationship import Relationship
from app.services.llm import LLMService
from app.services.memory import MemoryService

log = logging.getLogger(__name__)


class ConversationService:
    """Service for managing character conversations."""

    def __init__(self, db):
        self.db = db
        self.llm = LLMService.get_instance()
        self.memory_service = MemoryService(db)

    async def send_message(
        self,
        user_id: UUID,
        character_id: UUID,
        content: str,
    ) -> Message:
        """Send a message and get a response.

        This orchestrates the full conversation flow:
        1. Get or create active episode
        2. Build conversation context
        3. Save user message
        4. Generate LLM response
        5. Save assistant message
        6. Extract memories and hooks (async)
        """
        # Get or create episode
        episode = await self.get_or_create_episode(user_id, character_id)

        # Build context
        context = await self.get_context(user_id, character_id, episode.id)

        # Save user message
        user_message = await self._save_message(
            episode_id=episode.id,
            role=MessageRole.USER,
            content=content,
        )

        # Add user message to context
        context.messages.append({"role": "user", "content": content})

        # Generate response
        formatted_messages = context.to_messages()
        llm_response = await self.llm.generate(formatted_messages)

        # Save assistant message
        assistant_message = await self._save_message(
            episode_id=episode.id,
            role=MessageRole.ASSISTANT,
            content=llm_response.content,
            model_used=llm_response.model,
            tokens_input=llm_response.tokens_input,
            tokens_output=llm_response.tokens_output,
            latency_ms=llm_response.latency_ms,
        )

        # Mark hooks as triggered
        for hook in context.hooks:
            await self._mark_hook_triggered(hook.id)

        # Extract memories and hooks in background (non-blocking)
        # In production, this would be a background task
        try:
            await self._process_exchange(
                user_id=user_id,
                character_id=character_id,
                episode_id=episode.id,
                messages=context.messages + [{"role": "assistant", "content": llm_response.content}],
            )
        except Exception as e:
            log.error(f"Memory extraction failed: {e}")

        return assistant_message

    async def send_message_stream(
        self,
        user_id: UUID,
        character_id: UUID,
        content: str,
    ) -> AsyncIterator[str]:
        """Send a message and stream the response."""
        # Get or create episode
        episode = await self.get_or_create_episode(user_id, character_id)

        # Build context
        context = await self.get_context(user_id, character_id, episode.id)

        # Save user message
        await self._save_message(
            episode_id=episode.id,
            role=MessageRole.USER,
            content=content,
        )

        # Add user message to context
        context.messages.append({"role": "user", "content": content})

        # Generate streaming response
        formatted_messages = context.to_messages()
        full_response = []

        async for chunk in self.llm.generate_stream(formatted_messages):
            full_response.append(chunk)
            yield json.dumps({"type": "chunk", "content": chunk})

        response_content = "".join(full_response)

        # Save assistant message
        await self._save_message(
            episode_id=episode.id,
            role=MessageRole.ASSISTANT,
            content=response_content,
            model_used=self.llm.model,
        )

        # Mark hooks as triggered
        for hook in context.hooks:
            await self._mark_hook_triggered(hook.id)

        # Process exchange
        try:
            await self._process_exchange(
                user_id=user_id,
                character_id=character_id,
                episode_id=episode.id,
                messages=context.messages + [{"role": "assistant", "content": response_content}],
            )
        except Exception as e:
            log.error(f"Memory extraction failed: {e}")

        yield json.dumps({"type": "done", "content": response_content})

    async def get_context(
        self,
        user_id: UUID,
        character_id: UUID,
        episode_id: Optional[UUID] = None,
    ) -> ConversationContext:
        """Build conversation context for LLM."""
        # Get character
        char_query = "SELECT * FROM characters WHERE id = :character_id"
        char_row = await self.db.fetch_one(char_query, {"character_id": str(character_id)})
        if not char_row:
            raise ValueError(f"Character {character_id} not found")
        character = Character(**dict(char_row))

        # Get relationship
        rel_query = """
            SELECT * FROM relationships
            WHERE user_id = :user_id AND character_id = :character_id
        """
        rel_row = await self.db.fetch_one(rel_query, {"user_id": str(user_id), "character_id": str(character_id)})
        relationship = Relationship(**dict(rel_row)) if rel_row else None

        # Get recent messages from episode
        messages = []
        if episode_id:
            msg_query = """
                SELECT role, content FROM messages
                WHERE episode_id = :episode_id
                ORDER BY created_at DESC
                LIMIT 20
            """
            msg_rows = await self.db.fetch_all(msg_query, {"episode_id": str(episode_id)})
            messages = [
                {"role": row["role"], "content": row["content"]}
                for row in reversed(msg_rows)
            ]

        # Get relevant memories
        memories = await self.memory_service.get_relevant_memories(
            user_id, character_id, limit=10
        )
        memory_summaries = [
            MemorySummary(
                id=m.id,
                type=m.type.value,
                summary=m.summary,
                importance_score=float(m.importance_score),
            )
            for m in memories
        ]

        # Get active hooks
        hooks = await self.memory_service.get_active_hooks(
            user_id, character_id, limit=5
        )
        hook_summaries = [
            HookSummary(
                id=h.id,
                type=h.type.value,
                content=h.content,
                suggested_opener=h.suggested_opener,
            )
            for h in hooks
        ]

        # Calculate time since first met
        time_since_first_met = ""
        if relationship and relationship.first_met_at:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            first_met = relationship.first_met_at
            if first_met.tzinfo is None:
                first_met = first_met.replace(tzinfo=timezone.utc)
            delta = now - first_met
            if delta.days == 0:
                time_since_first_met = "Just met today"
            elif delta.days == 1:
                time_since_first_met = "1 day"
            elif delta.days < 7:
                time_since_first_met = f"{delta.days} days"
            elif delta.days < 30:
                weeks = delta.days // 7
                time_since_first_met = f"{weeks} week{'s' if weeks > 1 else ''}"
            else:
                months = delta.days // 30
                time_since_first_met = f"{months} month{'s' if months > 1 else ''}"

        # Get character life arc from character data (if available)
        character_life_arc = {}
        if hasattr(character, 'life_arc') and character.life_arc:
            character_life_arc = character.life_arc
        elif character.current_stressor:
            # Fallback: use current_stressor as the struggle
            character_life_arc = {"current_struggle": character.current_stressor}

        return ConversationContext(
            character_system_prompt=character.system_prompt,
            character_name=character.name,
            character_life_arc=character_life_arc,
            messages=messages,
            memories=memory_summaries,
            hooks=hook_summaries,
            relationship_stage=relationship.stage.value if relationship else "acquaintance",
            relationship_progress=relationship.stage_progress if relationship else 0,
            total_episodes=relationship.total_episodes if relationship else 0,
            time_since_first_met=time_since_first_met,
        )

    async def get_or_create_episode(
        self,
        user_id: UUID,
        character_id: UUID,
        scene: Optional[str] = None,
    ) -> Episode:
        """Get active episode or create a new one."""
        # Check for existing active episode
        query = """
            SELECT * FROM episodes
            WHERE user_id = :user_id AND character_id = :character_id AND is_active = TRUE
            ORDER BY started_at DESC
            LIMIT 1
        """
        row = await self.db.fetch_one(query, {"user_id": str(user_id), "character_id": str(character_id)})

        if row:
            return Episode(**dict(row))

        # Ensure user exists in public.users (auto-create if missing)
        # This handles cases where the auth trigger didn't fire
        await self._ensure_user_exists(user_id)

        # Ensure relationship exists
        rel_query = """
            INSERT INTO relationships (user_id, character_id)
            VALUES (:user_id, :character_id)
            ON CONFLICT (user_id, character_id) DO UPDATE SET updated_at = NOW()
            RETURNING id
        """
        rel_row = await self.db.fetch_one(rel_query, {"user_id": str(user_id), "character_id": str(character_id)})
        relationship_id = rel_row["id"]

        # Get next episode number
        count_query = """
            SELECT COALESCE(MAX(episode_number), 0) + 1 as next_num
            FROM episodes
            WHERE user_id = :user_id AND character_id = :character_id
        """
        count_row = await self.db.fetch_one(count_query, {"user_id": str(user_id), "character_id": str(character_id)})
        episode_number = count_row["next_num"]

        # Create episode
        create_query = """
            INSERT INTO episodes (user_id, character_id, relationship_id, episode_number, scene)
            VALUES (:user_id, :character_id, :relationship_id, :episode_number, :scene)
            RETURNING *
        """
        new_row = await self.db.fetch_one(
            create_query,
            {
                "user_id": str(user_id),
                "character_id": str(character_id),
                "relationship_id": str(relationship_id),
                "episode_number": episode_number,
                "scene": scene,
            },
        )

        return Episode(**dict(new_row))

    async def end_episode(
        self,
        user_id: UUID,
        character_id: UUID,
    ) -> Optional[Episode]:
        """End the active episode and generate summary."""
        # Get active episode
        query = """
            SELECT * FROM episodes
            WHERE user_id = :user_id AND character_id = :character_id AND is_active = TRUE
        """
        row = await self.db.fetch_one(query, {"user_id": str(user_id), "character_id": str(character_id)})

        if not row:
            return None

        episode = Episode(**dict(row))

        # Get messages for summary
        msg_query = """
            SELECT role, content FROM messages
            WHERE episode_id = :episode_id
            ORDER BY created_at
        """
        msg_rows = await self.db.fetch_all(msg_query, {"episode_id": str(episode.id)})
        messages = [{"role": r["role"], "content": r["content"]} for r in msg_rows]

        # Get character name for summary
        char_query = "SELECT name FROM characters WHERE id = :character_id"
        char_row = await self.db.fetch_one(char_query, {"character_id": str(character_id)})
        character_name = char_row["name"] if char_row else "Character"

        # Generate summary
        summary_data = await self.memory_service.generate_episode_summary(
            character_name=character_name,
            messages=messages,
        )

        # Update episode
        update_query = """
            UPDATE episodes
            SET
                is_active = FALSE,
                ended_at = NOW(),
                summary = :summary,
                emotional_tags = :emotional_tags,
                key_events = :key_events
            WHERE id = :episode_id
            RETURNING *
        """
        updated_row = await self.db.fetch_one(
            update_query,
            {
                "summary": summary_data.get("summary"),
                "emotional_tags": summary_data.get("emotional_tags", []),
                "key_events": summary_data.get("key_events", []),
                "episode_id": str(episode.id),
            },
        )

        return Episode(**dict(updated_row))

    async def _ensure_user_exists(self, user_id: UUID) -> None:
        """Ensure user exists in public.users table.

        This is a fallback for cases where the auth.users trigger didn't fire
        (e.g., user signed up before trigger was created, or trigger failed).
        """
        query = """
            INSERT INTO users (id, display_name)
            VALUES (:user_id, 'User')
            ON CONFLICT (id) DO NOTHING
        """
        await self.db.execute(query, {"user_id": str(user_id)})

    async def _save_message(
        self,
        episode_id: UUID,
        role: MessageRole,
        content: str,
        model_used: Optional[str] = None,
        tokens_input: Optional[int] = None,
        tokens_output: Optional[int] = None,
        latency_ms: Optional[int] = None,
    ) -> Message:
        """Save a message to the database."""
        query = """
            INSERT INTO messages (episode_id, role, content, model_used, tokens_input, tokens_output, latency_ms)
            VALUES (:episode_id, :role, :content, :model_used, :tokens_input, :tokens_output, :latency_ms)
            RETURNING *
        """
        row = await self.db.fetch_one(
            query,
            {
                "episode_id": str(episode_id),
                "role": role.value,
                "content": content,
                "model_used": model_used,
                "tokens_input": tokens_input,
                "tokens_output": tokens_output,
                "latency_ms": latency_ms,
            },
        )
        return Message(**dict(row))

    async def _mark_hook_triggered(self, hook_id: UUID):
        """Mark a hook as triggered."""
        query = "UPDATE hooks SET triggered_at = NOW() WHERE id = :hook_id"
        await self.db.execute(query, {"hook_id": str(hook_id)})

    async def _process_exchange(
        self,
        user_id: UUID,
        character_id: UUID,
        episode_id: UUID,
        messages: List[Dict[str, str]],
    ):
        """Process a conversation exchange for memories and hooks."""
        # Get existing memories for deduplication
        existing_memories = await self.memory_service.get_relevant_memories(
            user_id, character_id, limit=20
        )

        # Extract memories
        extracted_memories = await self.memory_service.extract_memories(
            user_id=user_id,
            character_id=character_id,
            episode_id=episode_id,
            messages=messages,
            existing_memories=existing_memories,
        )

        if extracted_memories:
            await self.memory_service.save_memories(
                user_id=user_id,
                character_id=character_id,
                episode_id=episode_id,
                memories=extracted_memories,
            )
            log.info(f"Saved {len(extracted_memories)} memories")

        # Extract hooks
        extracted_hooks = await self.memory_service.extract_hooks(messages)

        if extracted_hooks:
            await self.memory_service.save_hooks(
                user_id=user_id,
                character_id=character_id,
                episode_id=episode_id,
                hooks=extracted_hooks,
            )
            log.info(f"Saved {len(extracted_hooks)} hooks")
