"""Message models."""
import json
from datetime import datetime
from enum import Enum
from typing import Any, ClassVar, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MessageRole(str, Enum):
    """Message sender role."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class MessageCreate(BaseModel):
    """Data for creating a message."""

    content: str = Field(..., min_length=1, max_length=10000)
    episode_template_id: Optional[UUID] = None  # For Director session routing

    @field_validator("episode_template_id", mode="before")
    @classmethod
    def coerce_none_string(cls, v):
        """Handle edge case where 'None' string is sent instead of null."""
        if v is None or v == "None" or v == "null" or v == "":
            return None
        return v


class Message(BaseModel):
    """Message model."""

    id: UUID
    episode_id: UUID
    role: MessageRole
    content: str

    # LLM metadata
    model_used: Optional[str] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    latency_ms: Optional[int] = None

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)

    created_at: datetime

    @field_validator("metadata", mode="before")
    @classmethod
    def ensure_metadata_is_dict(cls, v: Any) -> Dict[str, Any]:
        """Handle metadata as JSON string (from DB)."""
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, dict):
                    return parsed
            except (json.JSONDecodeError, TypeError):
                return {"raw": v}
        return {}

    class Config:
        from_attributes = True


class MemorySummary(BaseModel):
    """Minimal memory info for context."""

    id: UUID
    type: str
    summary: str
    importance_score: float = 0.5


class HookSummary(BaseModel):
    """Minimal hook info for context."""

    id: UUID
    type: str
    content: str
    suggested_opener: Optional[str] = None


class ConversationContext(BaseModel):
    """Context assembled for LLM conversation.

    Reference: docs/EPISODE_DYNAMICS_CANON.md Section 6.5: Context Management Architecture
    Reference: docs/quality/core/CONTEXT_LAYERS.md - 6-layer prompt architecture
    """

    character_system_prompt: str
    character_name: str = ""
    # NOTE: character_life_arc removed - backstory + archetype + genre doctrine provide depth
    messages: List[Dict[str, str]] = Field(default_factory=list)
    memories: List[MemorySummary] = Field(default_factory=list)
    hooks: List[HookSummary] = Field(default_factory=list)
    # NOTE: relationship_stage/relationship_progress removed - stage progression sunset (EP-01 pivot)
    # Dynamic relationship (tone, tension, beats) provides better engagement context
    total_episodes: int = 0
    time_since_first_met: str = ""

    # Dynamic relationship fields (Phase 4: Beat-aware system)
    relationship_dynamic: Dict[str, Any] = Field(default_factory=lambda: {
        "tone": "warm",
        "tension_level": 30,
        "recent_beats": []
    })
    relationship_milestones: List[str] = Field(default_factory=list)

    # Episode Dynamics (per EPISODE_DYNAMICS_CANON.md)
    episode_situation: Optional[str] = None  # Physical setting/scenario (e.g., "3AM convenience store")
    episode_frame: Optional[str] = None  # Platform stage direction
    dramatic_question: Optional[str] = None  # Narrative tension to explore
    resolution_types: List[str] = Field(default_factory=lambda: ["positive", "neutral", "negative"])
    series_context: Optional[str] = None  # Context from previous episodes in serial

    # Scene Motivation (ADR-002: Theatrical Model)
    # These are the "director's notes" internalized during rehearsal, not generated per-turn
    scene_objective: Optional[str] = None  # What character wants from user this scene
    scene_obstacle: Optional[str] = None   # What's stopping them from just asking
    scene_tactic: Optional[str] = None     # How they're trying to get what they want

    # Character boundaries (ADR-001: needed by Director for energy_level)
    character_boundaries: Dict[str, Any] = Field(default_factory=dict)

    # Director Guidance (per DIRECTOR_PROTOCOL.md v2.0)
    # ADR-001: Now includes genre doctrine, injected at runtime
    director_guidance: Optional[str] = None  # Pre-formatted guidance section from Director

    # Series Genre Settings (per GENRE_SETTINGS_ARCHITECTURE)
    series_genre_prompt: Optional[str] = None  # Pre-formatted genre settings section from Series

    # NOTE: STAGE_LABELS and stage progression removed - EP-01 pivot
    # Relationship context now uses dynamic (tone, tension, milestones) instead

    def _format_memories_by_type(self) -> str:
        """Format memories grouped by type for better context."""
        if not self.memories:
            return "You're still getting to know them - this is a new connection."

        # Group memories by type
        facts = [m for m in self.memories if m.type in ['fact', 'identity']]
        events = [m for m in self.memories if m.type == 'event']
        preferences = [m for m in self.memories if m.type == 'preference']
        relationships = [m for m in self.memories if m.type == 'relationship']
        goals = [m for m in self.memories if m.type == 'goal']
        emotions = [m for m in self.memories if m.type == 'emotion']

        sections = []

        if facts:
            sections.append("About them:\n" + "\n".join(f"  - {m.summary}" for m in facts))

        if events:
            sections.append("Recent in their life:\n" + "\n".join(f"  - {m.summary}" for m in events))

        if preferences:
            sections.append("Their tastes:\n" + "\n".join(f"  - {m.summary}" for m in preferences))

        if relationships:
            sections.append("People in their life:\n" + "\n".join(f"  - {m.summary}" for m in relationships))

        if goals:
            sections.append("Their goals/aspirations:\n" + "\n".join(f"  - {m.summary}" for m in goals))

        if emotions:
            sections.append("How they've been feeling:\n" + "\n".join(f"  - {m.summary}" for m in emotions))

        return "\n\n".join(sections) if sections else "You're still getting to know them."

    def _format_hooks(self) -> str:
        """Format hooks with suggested openers."""
        if not self.hooks:
            return "No specific topics to follow up on right now."

        lines = []
        for h in self.hooks:
            if h.suggested_opener:
                lines.append(f"- {h.content}\n  (You might say: \"{h.suggested_opener}\")")
            else:
                lines.append(f"- {h.content}")
        return "\n".join(lines)

    # NOTE: _format_life_arc() removed - backstory + archetype + genre doctrine provide depth
    # Character's emotional state comes from episode situation, not a separate life_arc field

    def _format_relationship_dynamic(self) -> str:
        """Format dynamic relationship context for LLM.

        NOTE: This provides DATA only. Behavioral guidance comes from
        the character's system_prompt (Genre 01 doctrine, etc.).
        """
        if not self.relationship_dynamic or not self.relationship_dynamic.get("recent_beats"):
            return "New connection - no history yet."

        tone = self.relationship_dynamic.get("tone", "neutral")
        tension = self.relationship_dynamic.get("tension_level", 50)
        recent_beats = self.relationship_dynamic.get("recent_beats", [])[-5:]

        # Beat flow - just data, no interpretation
        beat_flow = " → ".join(recent_beats) if recent_beats else "starting"

        return f"""RELATIONSHIP DYNAMIC:
Current tone: {tone}
Tension level: {tension}/100
Recent beats: {beat_flow}"""

    def _format_milestones(self) -> str:
        """Format significant relationship milestones.

        NOTE: This provides DATA only (milestone names). Interpretation
        of what these milestones mean comes from character system_prompt.
        """
        if not self.relationship_milestones:
            return ""

        # Just list the milestones - character's system_prompt handles interpretation
        return "Milestones reached: " + ", ".join(self.relationship_milestones)

    def _format_episode_dynamics(self) -> str:
        """Format episode dynamics for LLM context.

        Reference: docs/EPISODE_DYNAMICS_CANON.md Section 6.5
        This is the "Actor/Director Model" - episode_template is director's notes,
        LLM is the actor who interprets them authentically.

        CRITICAL: Physical grounding (situation) comes FIRST - this is the most
        important context for immersive responses. Generic romantic tension
        without physical awareness breaks immersion.

        ADR-002: Scene motivation (objective/obstacle/tactic) is now authored
        into episodes and internalized during "rehearsal" - not generated per-turn.
        """
        parts = []

        # PHYSICAL GROUNDING FIRST - Most important for immersion
        if self.episode_situation:
            parts.append(f"""PHYSICAL SETTING (ground ALL responses in this reality):
{self.episode_situation}

You are HERE, right now. Reference your physical surroundings naturally:
- What can you see, hear, smell in this space?
- What are you doing with your body/hands?
- How does this specific place affect the mood?""")

        if self.episode_frame:
            parts.append(f"EPISODE FRAME (director's stage direction):\n{self.episode_frame}")

        if self.dramatic_question:
            parts.append(f"DRAMATIC QUESTION (explore, don't resolve too quickly):\n{self.dramatic_question}")

        # Scene Motivation (ADR-002: Theatrical Model)
        # These are the director's notes internalized during rehearsal
        if self.scene_objective or self.scene_obstacle or self.scene_tactic:
            motivation_parts = ["SCENE MOTIVATION (internalized direction - play this subtly):"]
            if self.scene_objective:
                motivation_parts.append(f"What you want: {self.scene_objective}")
            if self.scene_obstacle:
                motivation_parts.append(f"What's stopping you: {self.scene_obstacle}")
            if self.scene_tactic:
                motivation_parts.append(f"How you're playing it: {self.scene_tactic}")
            parts.append("\n".join(motivation_parts))

        if self.resolution_types:
            # Let LLM know valid resolution directions
            parts.append(f"VALID RESOLUTIONS: {', '.join(self.resolution_types)}")

        if self.series_context:
            parts.append(f"SERIES CONTEXT (what happened before):\n{self.series_context}")

        return "\n\n".join(parts) if parts else ""

    def _truncate_text(self, text: str, max_len: int = 260) -> str:
        """Keep long text snippets scannable for the LLM."""
        if not text:
            return ""
        text = text.strip()
        if len(text) <= max_len:
            return text
        return text[: max_len - 3].rstrip() + "..."

    def _format_moment_layer(self) -> str:
        """Highlight the immediate exchange to keep responses in-the-moment."""
        last_user = None
        last_assistant = None

        for msg in reversed(self.messages):
            role = msg.get("role")
            if role == "user" and last_user is None:
                last_user = msg.get("content", "")
            elif role == "assistant" and last_user is not None:
                last_assistant = msg.get("content", "")
                break

        if not last_user and not last_assistant:
            return ""

        lines = []
        if last_user:
            lines.append(f'Their last line: "{self._truncate_text(last_user)}"')
        if last_assistant:
            lines.append(f'Your last line: "{self._truncate_text(last_assistant)}"')
        if self.dramatic_question:
            lines.append(f"Unresolved tension: {self._truncate_text(self.dramatic_question)}")
        if self.episode_situation:
            lines.append(f"Setting anchor: {self._truncate_text(self.episode_situation, max_len=200)}")

        return "\n".join(lines)

    def to_messages(self) -> List[Dict[str, str]]:
        """Format context as messages for LLM."""
        # Format memories by type
        memory_text = self._format_memories_by_type()

        # Format hooks with openers
        hooks_text = self._format_hooks()

        # NOTE: life_arc_text removed - backstory + archetype + genre doctrine provide depth
        # NOTE: stage_label removed - stage progression sunset (EP-01 pivot)

        # Format dynamic relationship context (Phase 4: Beat-aware system)
        dynamic_context = self._format_relationship_dynamic()

        # Format milestones
        milestones_text = self._format_milestones()

        # NOTE: Bonding goals removed - Genre 01 doctrine is in character system_prompt
        # The character's system_prompt already has all behavioral guidance.
        # ConversationContext only adds dynamic data (memories, tension, milestones).

        # Build system prompt with context
        # First do the standard template substitution
        # NOTE: relationship_stage placeholder kept for backwards compatibility
        # but now uses dynamic tone instead of static stage
        relationship_label = self.relationship_dynamic.get("tone", "intrigued")
        system_prompt = self.character_system_prompt.format(
            memories=memory_text,
            hooks=hooks_text,
            relationship_stage=relationship_label,
        )

        # Add enhanced context section with dynamic relationships (data only, no behavioral guidance)
        enhanced_context = f"""

═══════════════════════════════════════════════════════════════
RELATIONSHIP CONTEXT
═══════════════════════════════════════════════════════════════

Episodes together: {self.total_episodes}
{f"Time since meeting: {self.time_since_first_met}" if self.time_since_first_met else ""}
{milestones_text}

{dynamic_context}
"""

        # NOTE: life_arc section removed - backstory + archetype + genre doctrine provide depth
        # Character's emotional state comes from episode situation, not a separate life_arc field

        # Add episode dynamics (per EPISODE_DYNAMICS_CANON.md)
        episode_dynamics_text = self._format_episode_dynamics()
        if episode_dynamics_text:
            enhanced_context += f"""

═══════════════════════════════════════════════════════════════
EPISODE DYNAMICS (Director's Notes - interpret authentically)
═══════════════════════════════════════════════════════════════

{episode_dynamics_text}

Remember: These are soft guidance, not a script. Stay in character.
"""

        moment_layer_text = self._format_moment_layer()
        if moment_layer_text:
            enhanced_context += f"""

═══════════════════════════════════════════════════════════════
MOMENT LAYER (In-the-moment priority)
═══════════════════════════════════════════════════════════════

{moment_layer_text}

Respond in this exact moment. Lead with a micro-action or sensory beat, then speak.
Advance tension by one step, not a leap.

LENGTH: 2-4 sentences total. One action line, one or two dialogue lines. Leave space for their reply.
"""

        # Series Genre Settings (per GENRE_SETTINGS_ARCHITECTURE)
        # This provides series-level tone and pacing guidance
        if self.series_genre_prompt:
            enhanced_context += f"""

═══════════════════════════════════════════════════════════════
SERIES GENRE SETTINGS
═══════════════════════════════════════════════════════════════

{self.series_genre_prompt}
"""

        # Director Guidance (per DIRECTOR_PROTOCOL.md v2.0)
        # This is the highest priority layer - it shapes pacing and tension
        if self.director_guidance:
            enhanced_context += f"""

{self.director_guidance}
"""

        # Append enhanced context to system prompt
        system_prompt = system_prompt + enhanced_context

        # Build message list
        formatted = [{"role": "system", "content": system_prompt}]
        formatted.extend(self.messages)

        return formatted
