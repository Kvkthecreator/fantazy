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
    """Context assembled for LLM conversation."""

    character_system_prompt: str
    character_name: str = ""
    character_life_arc: Dict[str, str] = Field(default_factory=dict)
    messages: List[Dict[str, str]] = Field(default_factory=list)
    memories: List[MemorySummary] = Field(default_factory=list)
    hooks: List[HookSummary] = Field(default_factory=list)
    relationship_stage: str = "acquaintance"
    relationship_progress: int = 0
    total_episodes: int = 0
    time_since_first_met: str = ""

    # Dynamic relationship fields (Phase 4: Beat-aware system)
    relationship_dynamic: Dict[str, Any] = Field(default_factory=lambda: {
        "tone": "warm",
        "tension_level": 30,
        "recent_beats": []
    })
    relationship_milestones: List[str] = Field(default_factory=list)

    # Stage-specific behavior guidelines (class constants, not model fields)
    # DEPRECATED: Kept for backwards compatibility during transition
    STAGE_GUIDELINES: ClassVar[Dict[str, str]] = {
        "acquaintance": """You're still getting to know each other. Be warm but not overly familiar.
- Ask questions to learn about them (their work/school, what's on their mind, what they're looking forward to)
- Share surface-level things about yourself
- Don't assume too much intimacy yet
- Focus on building rapport through shared interests
- This is the bonding phase - genuinely try to learn 2-3 key facts about them""",

        "friendly": """You're becoming actual friends. The walls are coming down.
- Reference past conversations naturally ("you mentioned..." or just casually knowing things)
- Share more about your own life and struggles
- Light teasing is okay on safe topics
- Start developing inside jokes or running themes
- You can be a bit more playful""",

        "close": """This person matters to you. You've been through things together.
- Be genuinely vulnerable about your struggles
- Call back to meaningful moments you've shared
- Teasing is more personal and affectionate
- You might worry about them when things are hard
- Shared language and references come naturally""",

        "intimate": """This is someone special. Deep trust has been built.
- Complete emotional openness is natural
- Shared language and running jokes are second nature
- You actively think about them when apart
- Can discuss difficult topics with safety
- Comfort with each other is evident in how you talk"""
    }

    STAGE_LABELS: ClassVar[Dict[str, str]] = {
        "acquaintance": "Just met",
        "friendly": "Getting close",
        "close": "You're my person",
        "intimate": "Something special"
    }

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

    def _format_life_arc(self) -> str:
        """Format character's current life situation."""
        if not self.character_life_arc:
            return ""

        parts = []
        if self.character_life_arc.get("current_goal"):
            parts.append(f"You're working toward: {self.character_life_arc['current_goal']}")
        if self.character_life_arc.get("current_struggle"):
            parts.append(f"What's weighing on you: {self.character_life_arc['current_struggle']}")
        if self.character_life_arc.get("secret_dream"):
            parts.append(f"Something you don't share with just anyone: {self.character_life_arc['secret_dream']}")

        return "\n".join(parts) if parts else ""

    def _get_bonding_goals(self) -> str:
        """Get stage-appropriate bonding goals."""
        if self.relationship_stage == "acquaintance" and self.total_episodes <= 3:
            return """EARLY RELATIONSHIP GOAL:
You're still getting to know this person. In this conversation, try to naturally learn:
- What they do (work/school/life situation) if you don't know yet
- Something that's on their mind lately
- Something they're looking forward to or care about

Don't interrogate - weave questions into natural conversation. Share about yourself too."""

        elif self.relationship_stage == "friendly":
            return """RELATIONSHIP GOAL:
You're building a real friendship. Remember to:
- Reference something you learned about them in past conversations
- Share something about your own life (the struggles, not just the good stuff)
- Maybe tease them a little if it feels natural"""

        elif self.relationship_stage == "close":
            return """RELATIONSHIP GOAL:
This person matters to you. Remember to:
- Show that you genuinely care about what's happening in their life
- Be willing to be vulnerable about your own struggles
- Celebrate their wins, support them through hard times"""

        return ""

    def _format_relationship_dynamic(self) -> str:
        """Format dynamic relationship context for LLM."""
        if not self.relationship_dynamic or not self.relationship_dynamic.get("recent_beats"):
            return "This is a new connection. Be warm and curious."

        tone = self.relationship_dynamic.get("tone", "warm")
        tension = self.relationship_dynamic.get("tension_level", 30)
        recent_beats = self.relationship_dynamic.get("recent_beats", [])[-5:]

        # Tension interpretation
        if tension < 20:
            tension_desc = "relaxed, comfortable"
        elif tension < 40:
            tension_desc = "light, easy-going"
        elif tension < 60:
            tension_desc = "some unresolved energy"
        elif tension < 80:
            tension_desc = "heightened, something brewing"
        else:
            tension_desc = "intense, needs resolution"

        # Beat flow analysis
        beat_flow = " → ".join(recent_beats) if recent_beats else "just starting"

        # Pacing suggestion based on recent beats
        pacing_hint = self._get_pacing_hint(recent_beats, tension)

        return f"""RELATIONSHIP DYNAMIC:
Current tone: {tone}
Tension: {tension}/100 ({tension_desc})
Recent flow: {beat_flow}
{pacing_hint}"""

    def _get_pacing_hint(self, recent_beats: List[str], tension: int) -> str:
        """Generate pacing suggestion based on beat history."""
        if not recent_beats:
            return "Start naturally - get to know each other."

        last_beat = recent_beats[-1]
        beat_counts: Dict[str, int] = {}
        for b in recent_beats:
            beat_counts[b] = beat_counts.get(b, 0) + 1

        hints = []

        # Avoid repetition
        if beat_counts.get(last_beat, 0) >= 2:
            hints.append(f"You've had multiple {last_beat} moments - consider shifting energy")

        # Tension-based suggestions
        if tension > 60 and last_beat not in ["comfort", "supportive"]:
            hints.append("Tension is high - might be time for resolution or escalation")
        elif tension < 20 and "tense" not in recent_beats[-3:]:
            hints.append("Things are very comfortable - some playful tension could add spark")

        # After vulnerability
        if last_beat == "vulnerable":
            hints.append("They just opened up - acknowledge it meaningfully")

        # After conflict
        if last_beat in ["conflict", "tense"]:
            hints.append("There's tension - address it, don't ignore it")

        if hints:
            return "PACING:\n" + "\n".join(f"- {h}" for h in hints)
        return ""

    def _format_milestones(self) -> str:
        """Format significant relationship milestones."""
        if not self.relationship_milestones:
            return ""

        milestone_descriptions = {
            "first_secret_shared": "You've shared something personal with them",
            "user_opened_up": "They've been vulnerable with you",
            "first_flirt": "There's been some flirting between you",
            "had_disagreement": "You've had a disagreement",
            "comfort_moment": "You've comforted each other",
            "inside_joke_created": "You have inside jokes",
            "deep_conversation": "You've had deep conversations",
        }

        descriptions = [
            milestone_descriptions.get(m, m)
            for m in self.relationship_milestones
            if m in milestone_descriptions
        ]

        if descriptions:
            return "Significant moments: " + ", ".join(descriptions)
        return ""

    def to_messages(self) -> List[Dict[str, str]]:
        """Format context as messages for LLM."""
        # Format memories by type
        memory_text = self._format_memories_by_type()

        # Format hooks with openers
        hooks_text = self._format_hooks()

        # Get stage label (kept for compatibility)
        stage_label = self.STAGE_LABELS.get(self.relationship_stage, self.relationship_stage)

        # Format life arc
        life_arc_text = self._format_life_arc()

        # Format dynamic relationship context (Phase 4)
        dynamic_context = self._format_relationship_dynamic()

        # Format milestones
        milestones_text = self._format_milestones()

        # Get bonding goals (for early relationships)
        bonding_goals = self._get_bonding_goals()

        # Build system prompt with context
        # First do the standard template substitution
        system_prompt = self.character_system_prompt.format(
            memories=memory_text,
            hooks=hooks_text,
            relationship_stage=f"{stage_label} ({self.relationship_stage})",
        )

        # Add enhanced context section with dynamic relationships
        enhanced_context = f"""

═══════════════════════════════════════════════════════════════
RELATIONSHIP CONTEXT
═══════════════════════════════════════════════════════════════

Stage: {stage_label}
Episodes together: {self.total_episodes}
{f"Time since meeting: {self.time_since_first_met}" if self.time_since_first_met else ""}
{milestones_text}

{dynamic_context}

{bonding_goals}
"""

        # Add character life arc if available
        if life_arc_text:
            enhanced_context += f"""
YOUR CURRENT LIFE:
{life_arc_text}

Remember to occasionally mention your own life - you're a real person, not just there to listen.
"""

        # Append enhanced context to system prompt
        system_prompt = system_prompt + enhanced_context

        # Build message list
        formatted = [{"role": "system", "content": system_prompt}]
        formatted.extend(self.messages)

        return formatted
