"""Memory extraction and retrieval service."""

import json
import logging
from typing import Dict, List, Optional
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

Additionally, classify this exchange's narrative beat.

IMPORTANT: This is a ROMANTIC TENSION experience. Tension and desire are the goal, not comfort.

beat_classification:
  type: playful | flirty | tense | vulnerable | supportive | conflict | comfort | charged | longing | neutral
  tension_change: integer from -15 to +15
    - POSITIVE tension changes (+5 to +15): flirty exchanges, "almost" moments, jealousy, vulnerability, conflict, charged silences
    - NEGATIVE tension changes (-5 to -15): resolved conflicts, excessive comfort, breaking romantic frame
    - Note: Some tension is GOOD - don't reduce tension just because things are "nice"

  milestone: null OR one of:
    - "first_spark" (first moment of clear romantic/sexual tension)
    - "almost_moment" (interrupted intimacy, held back kiss, lingering touch)
    - "jealousy_triggered" (one party showed jealousy or possessiveness)
    - "boundary_pushed" (someone crossed a line, broke a rule)
    - "vulnerability_shared" (someone revealed something risky)
    - "desire_expressed" (explicit attraction acknowledged)
    - "first_touch" (first meaningful physical contact)
    - "conflict_unresolved" (tension left hanging, not fixed)
    - "inside_joke_created" (shared humor reference established)
    - "deep_confession" (profound personal revelation)

Respond with JSON:
{{
    "memories": [...],
    "beat": {{
        "type": "...",
        "tension_change": 0,
        "milestone": null
    }}
}}
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
    ) -> tuple[List[ExtractedMemory], Optional[Dict]]:
        """Extract memories and beat classification from a conversation exchange.

        Returns:
            tuple: (list of ExtractedMemory, beat classification dict or None)
        """
        if len(messages) < 2:
            return [], None

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
                schema_description="""{
    "memories": [
        {
            "type": "fact|preference|event|goal|relationship|emotion",
            "summary": "string",
            "importance_score": 0.0-1.0,
            "emotional_valence": -2 to 2,
            "category": "optional string"
        }
    ],
    "beat": {
        "type": "playful|flirty|tense|vulnerable|supportive|conflict|comfort|neutral",
        "tension_change": -15 to 15,
        "milestone": "string or null"
    }
}""",
            )

            memories = []
            beat_data = None

            # Handle both old format (array) and new format (object with memories and beat)
            memory_items = result.get("memories", []) if isinstance(result, dict) else result
            beat_data = result.get("beat") if isinstance(result, dict) else None

            for item in memory_items:
                try:
                    # Handle LLM returning uppercase types
                    memory_type = item["type"].lower() if isinstance(item.get("type"), str) else item["type"]
                    memory = ExtractedMemory(
                        type=MemoryType(memory_type),
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

            return memories, beat_data

        except Exception as e:
            log.error(f"Memory extraction failed: {e}")
            return [], None

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
        series_id: Optional[UUID] = None,
    ) -> List[MemoryEvent]:
        """Save extracted memories to database.

        Memories are scoped by series_id (preferred) for series-level memory isolation.
        character_id is retained for backwards compatibility and character-centric queries.

        Args:
            user_id: User UUID
            character_id: Character UUID (retained for legacy queries)
            episode_id: Episode/session UUID
            memories: List of extracted memories to save
            series_id: Series UUID for series-scoped memory (preferred scope)
        """
        saved = []

        # If series_id not provided, try to get it from the session
        if not series_id:
            session_query = "SELECT series_id FROM sessions WHERE id = :episode_id"
            session_row = await self.db.fetch_one(session_query, {"episode_id": str(episode_id)})
            if session_row and session_row.get("series_id"):
                series_id = session_row["series_id"]

        for memory in memories:
            query = """
                INSERT INTO memory_events (
                    user_id, character_id, episode_id, series_id, type, category,
                    content, summary, emotional_valence, importance_score
                )
                VALUES (:user_id, :character_id, :episode_id, :series_id, :type, :category,
                        :content, :summary, :emotional_valence, :importance_score)
                RETURNING *
            """
            row = await self.db.fetch_one(
                query,
                {
                    "user_id": str(user_id),
                    "character_id": str(character_id),
                    "episode_id": str(episode_id),
                    "series_id": str(series_id) if series_id else None,
                    "type": memory.type.value,
                    "category": memory.category,
                    "content": json.dumps(memory.content),
                    "summary": memory.summary,
                    "emotional_valence": memory.emotional_valence,
                    "importance_score": memory.importance_score,
                },
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
                VALUES (:user_id, :character_id, :episode_id, :type, :priority,
                        :content, :suggested_opener, :trigger_after)
            """
            await self.db.execute(
                query,
                {
                    "user_id": str(user_id),
                    "character_id": str(character_id),
                    "episode_id": str(episode_id),
                    "type": hook.type.value,
                    "priority": hook.priority,
                    "content": hook.content,
                    "suggested_opener": hook.suggested_opener,
                    "trigger_after": trigger_after,
                },
            )

    async def get_relevant_memories(
        self,
        user_id: UUID,
        character_id: UUID,
        limit: int = 10,
        series_id: Optional[UUID] = None,
    ) -> List[MemoryEvent]:
        """Get memories relevant for a conversation.

        Memory retrieval priority:
        1. If series_id provided: Get memories scoped to that series
        2. Fallback: Get memories by character_id (legacy behavior)

        This supports the series-scoped memory model where memories belong
        to "your story with this series" not "the character."
        """
        if series_id:
            # Series-scoped memory retrieval (preferred)
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
                    WHERE user_id = :user_id
                        AND series_id = :series_id
                        AND is_active = TRUE
                )
                SELECT * FROM ranked_memories
                WHERE rn <= 3
                ORDER BY importance_score DESC, created_at DESC
                LIMIT :limit
            """
            rows = await self.db.fetch_all(query, {
                "user_id": str(user_id),
                "series_id": str(series_id),
                "limit": limit,
            })
        else:
            # Legacy character-scoped retrieval (fallback)
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
                    WHERE user_id = :user_id
                        AND (character_id = :character_id OR character_id IS NULL)
                        AND is_active = TRUE
                )
                SELECT * FROM ranked_memories
                WHERE rn <= 3
                ORDER BY importance_score DESC, created_at DESC
                LIMIT :limit
            """
            rows = await self.db.fetch_all(query, {"user_id": str(user_id), "character_id": str(character_id), "limit": limit})
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
            WHERE user_id = :user_id
                AND character_id = :character_id
                AND is_active = TRUE
                AND triggered_at IS NULL
                AND (trigger_after IS NULL OR trigger_after <= NOW())
                AND (trigger_before IS NULL OR trigger_before >= NOW())
            ORDER BY priority DESC, trigger_after ASC NULLS LAST
            LIMIT :limit
        """
        rows = await self.db.fetch_all(query, {"user_id": str(user_id), "character_id": str(character_id), "limit": limit})
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

    async def update_relationship_dynamic(
        self,
        user_id: UUID,
        character_id: UUID,
        beat_type: str,
        tension_change: int,
        milestone: Optional[str],
    ) -> None:
        """Update relationship with beat classification results.

        Updates the dynamic JSONB column with:
        - tone: derived from recent beats
        - tension_level: adjusted by tension_change
        - recent_beats: last 10 beat types

        Also adds milestone if provided and not already recorded.
        """
        # Get current engagement dynamic
        row = await self.db.fetch_one(
            """SELECT id, dynamic, milestones FROM engagements
               WHERE user_id = :user_id AND character_id = :character_id""",
            {"user_id": str(user_id), "character_id": str(character_id)},
        )

        if not row:
            log.warning(f"No engagement found for user={user_id}, character={character_id}")
            return

        engagement_id = row["id"]
        # Genre 01: Higher baseline tension (45 instead of 30), "intrigued" instead of "warm"
        dynamic = row["dynamic"] or {"tone": "intrigued", "tension_level": 45, "recent_beats": []}
        milestones = row["milestones"] or []

        # Parse dynamic if it's a string (from DB)
        if isinstance(dynamic, str):
            try:
                dynamic = json.loads(dynamic)
            except json.JSONDecodeError:
                dynamic = {"tone": "intrigued", "tension_level": 45, "recent_beats": []}

        # Update recent beats (keep last 10)
        recent_beats = dynamic.get("recent_beats", [])
        recent_beats.append(beat_type)
        recent_beats = recent_beats[-10:]

        # Update tension (clamp 0-100)
        tension = dynamic.get("tension_level", 30) + tension_change
        tension = max(0, min(100, tension))

        # Derive tone from recent beats
        tone = self._derive_tone(recent_beats, tension)

        # Add milestone if new
        if milestone and milestone not in milestones:
            milestones.append(milestone)
            log.info(f"New milestone recorded: {milestone}")

        # Build new dynamic
        new_dynamic = {
            "tone": tone,
            "tension_level": tension,
            "recent_beats": recent_beats,
        }

        # Save
        await self.db.execute(
            """UPDATE engagements
               SET dynamic = :dynamic, milestones = :milestones, updated_at = NOW()
               WHERE id = :id""",
            {
                "id": str(engagement_id),
                "dynamic": json.dumps(new_dynamic),
                "milestones": milestones,
            },
        )

        log.debug(f"Updated engagement dynamic: tone={tone}, tension={tension}, beats={len(recent_beats)}")

    def _derive_tone(self, recent_beats: List[str], tension: int) -> str:
        """Derive current tone from recent beats and tension level.

        Genre 01 aligned: Romance-focused tones, avoiding "comfortable" default.
        """
        if not recent_beats:
            return "intrigued"  # Genre 01: Start with intrigue, not warmth

        # Count recent beat types
        beat_counts = {}
        for beat in recent_beats[-5:]:  # Focus on last 5
            beat_counts[beat] = beat_counts.get(beat, 0) + 1

        # Find dominant beat
        dominant = max(beat_counts, key=beat_counts.get)

        # Map beats to tones with tension consideration (Genre 01: romance-focused)
        if tension > 75:
            if dominant in ["conflict", "tense"]:
                return "heated"
            elif dominant in ["flirty", "vulnerable"]:
                return "electric"
            else:
                return "intense"
        elif tension > 55:
            if dominant in ["flirty"]:
                return "charged"
            elif dominant in ["vulnerable"]:
                return "intimate"
            elif dominant in ["tense"]:
                return "simmering"
            else:
                return "magnetic"
        elif tension > 40:
            if dominant in ["playful"]:
                return "teasing"
            elif dominant in ["flirty"]:
                return "flirty"
            elif dominant in ["vulnerable"]:
                return "tender"
            else:
                return "intrigued"
        else:
            # Genre 01: Even at low tension, avoid pure comfort
            if dominant in ["comfort", "supportive"]:
                return "softened"  # Not "comfortable" - still implies potential
            elif dominant in ["playful"]:
                return "light"
            else:
                return "curious"

    async def get_relationship_dynamic(
        self,
        user_id: UUID,
        character_id: UUID,
    ) -> Optional[Dict]:
        """Get current engagement dynamic for context building."""
        row = await self.db.fetch_one(
            """SELECT dynamic, milestones FROM engagements
               WHERE user_id = :user_id AND character_id = :character_id""",
            {"user_id": str(user_id), "character_id": str(character_id)},
        )

        if not row:
            return None

        dynamic = row["dynamic"]
        if isinstance(dynamic, str):
            try:
                dynamic = json.loads(dynamic)
            except json.JSONDecodeError:
                dynamic = {"tone": "intrigued", "tension_level": 45, "recent_beats": []}

        return {
            # Genre 01: Higher baseline tension, romance-focused defaults
            "dynamic": dynamic or {"tone": "intrigued", "tension_level": 45, "recent_beats": []},
            "milestones": row["milestones"] or [],
        }
