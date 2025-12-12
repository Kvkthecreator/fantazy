"""Message models."""
import json
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
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

    # Stage-specific behavior guidelines
    STAGE_GUIDELINES = {
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

    STAGE_LABELS = {
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

    def to_messages(self) -> List[Dict[str, str]]:
        """Format context as messages for LLM."""
        # Format memories by type
        memory_text = self._format_memories_by_type()

        # Format hooks with openers
        hooks_text = self._format_hooks()

        # Get stage-specific guidelines
        stage_guidelines = self.STAGE_GUIDELINES.get(
            self.relationship_stage,
            self.STAGE_GUIDELINES["acquaintance"]
        )

        # Get stage label
        stage_label = self.STAGE_LABELS.get(self.relationship_stage, self.relationship_stage)

        # Format life arc
        life_arc_text = self._format_life_arc()

        # Get bonding goals
        bonding_goals = self._get_bonding_goals()

        # Build system prompt with context
        # First do the standard template substitution
        system_prompt = self.character_system_prompt.format(
            memories=memory_text,
            hooks=hooks_text,
            relationship_stage=f"{stage_label} ({self.relationship_stage})",
        )

        # Add enhanced context section
        enhanced_context = f"""

═══════════════════════════════════════════════════════════════
RELATIONSHIP CONTEXT
═══════════════════════════════════════════════════════════════

Stage: {stage_label} ({self.relationship_stage})
Episodes together: {self.total_episodes}
{f"Time since meeting: {self.time_since_first_met}" if self.time_since_first_met else ""}

STAGE-SPECIFIC BEHAVIOR:
{stage_guidelines}

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
