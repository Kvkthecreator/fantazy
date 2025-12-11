"""Memory extraction and retrieval service."""

import json
import logging
from typing import Dict, List
from uuid import UUID

from app.models.memory import ExtractedMemory, MemoryType, MemoryEvent
from app.models.hook import ExtractedHook, HookType
from app.services.llm import LLMService

log = logging.getLogger(__name__)

MEMORY_EXTRACTION_PROMPT = """Analyze this conversation exchange and extract any important information to remember about the user.

CONVERSATION:
{conversation}

Extract memories in these categories:
- fact: Personal facts (name, job, location, age, etc.)
- preference: Likes, dislikes, preferences
- event: Upcoming or past events (exams, interviews, trips, etc.)
- goal: Goals, aspirations, things they want to do
- relationship: People in their life (friends, family, pets)
- emotion: Significant emotional states or recurring feelings

For each memory, provide:
- type: One of the categories above
- summary: A concise statement (e.g., "Has a cat named Luna")
- importance_score: 0.0-1.0 (how important is this to remember?)
- emotional_valence: -2 to +2 (negative to positive emotional association)
- category: Optional sub-category for organization

Only extract NEW information. Skip things that are:
- Already known (provided in existing memories)
- Trivial small talk
- Temporary states ("I'm tired right now")

EXISTING MEMORIES:
{existing_memories}

Respond with a JSON array of extracted memories. If nothing new to extract, return an empty array [].
"""

HOOK_EXTRACTION_PROMPT = """Analyze this conversation and identify any follow-up conversation hooks.

CONVERSATION:
{conversation}

Look for:
- Events the user mentioned that will happen (follow_up)
- Things they asked the character to remember (reminder)
- Promises or commitments made (follow_up)
- Topics to check back on (follow_up)

For each hook, provide:
- type: "reminder", "follow_up", "milestone", or "scheduled"
- content: What to follow up about
- suggested_opener: How the character might bring it up naturally
- days_until_trigger: When to bring this up (null if immediate)
- priority: 1-5 (5 being most important)

Respond with a JSON array. If no hooks, return [].
"""

SUMMARY_PROMPT = """Summarize this conversation episode between a user and {character_name}.

CONVERSATION:
{conversation}

Provide:
1. A 1-2 sentence summary of what was discussed
2. Emotional tags (list of emotions present: happy, sad, anxious, hopeful, etc.)
3. Key events mentioned (list of significant events or topics)

Respond with JSON:
{{
    "summary": "...",
    "emotional_tags": ["...", "..."],
    "key_events": ["...", "..."]
}}
"""


class MemoryService:
    """Service for memory extraction and retrieval."""

    def __init__(self, db):
        self.db = db
        self.llm = LLMService.get_instance()

    async def extract_memories(
        self,
        user_id: UUID,
        character_id: UUID,
        episode_id: UUID,
        messages: List[Dict[str, str]],
        existing_memories: List[MemoryEvent],
    ) -> List[ExtractedMemory]:
        """Extract memories from a conversation exchange."""
        if len(messages) < 2:
            return []

        # Format conversation
        conversation = self._format_conversation(messages[-6:])  # Last 3 exchanges

        # Format existing memories
        existing_text = "\n".join(
            f"- [{m.type}] {m.summary}" for m in existing_memories[:20]
        ) or "None yet"

        prompt = MEMORY_EXTRACTION_PROMPT.format(
            conversation=conversation,
            existing_memories=existing_text,
        )

        try:
            result = await self.llm.extract_json(
                prompt=prompt,
                schema_description="""[
    {
        "type": "fact|preference|event|goal|relationship|emotion",
        "summary": "string",
        "importance_score": 0.0-1.0,
        "emotional_valence": -2 to 2,
        "category": "optional string"
    }
]""",
            )

            memories = []
            for item in result:
                try:
                    memory = ExtractedMemory(
                        type=MemoryType(item["type"]),
                        summary=item["summary"],
                        content={"raw": item.get("summary")},
                        importance_score=float(item.get("importance_score", 0.5)),
                        emotional_valence=int(item.get("emotional_valence", 0)),
                        category=item.get("category"),
                    )
                    memories.append(memory)
                except (KeyError, ValueError) as e:
                    log.warning(f"Failed to parse memory: {e}")
                    continue

            return memories

        except Exception as e:
            log.error(f"Memory extraction failed: {e}")
            return []

    async def extract_hooks(
        self,
        messages: List[Dict[str, str]],
    ) -> List[ExtractedHook]:
        """Extract conversation hooks from an exchange."""
        if len(messages) < 2:
            return []

        conversation = self._format_conversation(messages[-6:])

        prompt = HOOK_EXTRACTION_PROMPT.format(conversation=conversation)

        try:
            result = await self.llm.extract_json(
                prompt=prompt,
                schema_description="""[
    {
        "type": "reminder|follow_up|milestone|scheduled",
        "content": "string",
        "suggested_opener": "string or null",
        "days_until_trigger": "number or null",
        "priority": 1-5
    }
]""",
            )

            hooks = []
            for item in result:
                try:
                    hook = ExtractedHook(
                        type=HookType(item["type"]),
                        content=item["content"],
                        suggested_opener=item.get("suggested_opener"),
                        days_until_trigger=item.get("days_until_trigger"),
                        priority=int(item.get("priority", 2)),
                    )
                    hooks.append(hook)
                except (KeyError, ValueError) as e:
                    log.warning(f"Failed to parse hook: {e}")
                    continue

            return hooks

        except Exception as e:
            log.error(f"Hook extraction failed: {e}")
            return []

    async def generate_episode_summary(
        self,
        character_name: str,
        messages: List[Dict[str, str]],
    ) -> dict:
        """Generate a summary for a completed episode."""
        conversation = self._format_conversation(messages)

        prompt = SUMMARY_PROMPT.format(
            character_name=character_name,
            conversation=conversation,
        )

        try:
            result = await self.llm.extract_json(
                prompt=prompt,
                schema_description="""{
    "summary": "string",
    "emotional_tags": ["string"],
    "key_events": ["string"]
}""",
            )
            return result
        except Exception as e:
            log.error(f"Summary generation failed: {e}")
            return {
                "summary": None,
                "emotional_tags": [],
                "key_events": [],
            }

    async def save_memories(
        self,
        user_id: UUID,
        character_id: UUID,
        episode_id: UUID,
        memories: List[ExtractedMemory],
    ) -> List[MemoryEvent]:
        """Save extracted memories to database."""
        saved = []

        for memory in memories:
            query = """
                INSERT INTO memory_events (
                    user_id, character_id, episode_id, type, category,
                    content, summary, emotional_valence, importance_score
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            """
            row = await self.db.fetch_one(
                query,
                [
                    user_id,
                    character_id,
                    episode_id,
                    memory.type.value,
                    memory.category,
                    json.dumps(memory.content),
                    memory.summary,
                    memory.emotional_valence,
                    memory.importance_score,
                ],
            )
            saved.append(MemoryEvent(**dict(row)))

        return saved

    async def save_hooks(
        self,
        user_id: UUID,
        character_id: UUID,
        episode_id: UUID,
        hooks: List[ExtractedHook],
    ):
        """Save extracted hooks to database."""
        from datetime import datetime, timedelta

        for hook in hooks:
            trigger_after = None
            if hook.days_until_trigger:
                trigger_after = datetime.utcnow() + timedelta(days=hook.days_until_trigger)

            query = """
                INSERT INTO hooks (
                    user_id, character_id, episode_id, type, priority,
                    content, suggested_opener, trigger_after
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """
            await self.db.execute(
                query,
                [
                    user_id,
                    character_id,
                    episode_id,
                    hook.type.value,
                    hook.priority,
                    hook.content,
                    hook.suggested_opener,
                    trigger_after,
                ],
            )

    async def get_relevant_memories(
        self,
        user_id: UUID,
        character_id: UUID,
        limit: int = 10,
    ) -> List[MemoryEvent]:
        """Get memories relevant for a conversation."""
        query = """
            WITH ranked_memories AS (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY type
                        ORDER BY
                            CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END DESC,
                            importance_score DESC,
                            created_at DESC
                    ) as rn
                FROM memory_events
                WHERE user_id = $1
                    AND (character_id = $2 OR character_id IS NULL)
                    AND is_active = TRUE
            )
            SELECT * FROM ranked_memories
            WHERE rn <= 3
            ORDER BY importance_score DESC, created_at DESC
            LIMIT $3
        """
        rows = await self.db.fetch_all(query, [user_id, character_id, limit])
        return [MemoryEvent(**dict(row)) for row in rows]

    async def get_active_hooks(
        self,
        user_id: UUID,
        character_id: UUID,
        limit: int = 5,
    ):
        """Get active hooks for a conversation."""
        from app.models.hook import Hook

        query = """
            SELECT * FROM hooks
            WHERE user_id = $1
                AND character_id = $2
                AND is_active = TRUE
                AND triggered_at IS NULL
                AND (trigger_after IS NULL OR trigger_after <= NOW())
                AND (trigger_before IS NULL OR trigger_before >= NOW())
            ORDER BY priority DESC, trigger_after ASC NULLS LAST
            LIMIT $3
        """
        rows = await self.db.fetch_all(query, [user_id, character_id, limit])
        return [Hook(**dict(row)) for row in rows]

    def _format_conversation(self, messages: List[Dict[str, str]]) -> str:
        """Format messages for prompts."""
        lines = []
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if role == "user":
                lines.append(f"User: {content}")
            elif role == "assistant":
                lines.append(f"Character: {content}")
        return "\n".join(lines)
