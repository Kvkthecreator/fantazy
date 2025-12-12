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
    messages: List[Dict[str, str]] = Field(default_factory=list)
    memories: List[MemorySummary] = Field(default_factory=list)
    hooks: List[HookSummary] = Field(default_factory=list)
    relationship_stage: str = "acquaintance"
    relationship_progress: int = 0

    def to_messages(self) -> List[Dict[str, str]]:
        """Format context as messages for LLM."""
        # Format memories
        memory_text = ""
        if self.memories:
            memory_lines = [f"- {m.summary}" for m in self.memories]
            memory_text = "\n".join(memory_lines)
        else:
            memory_text = "No memories yet - this is a new connection."

        # Format hooks
        hooks_text = ""
        if self.hooks:
            hook_lines = [f"- {h.content}" for h in self.hooks]
            hooks_text = "\n".join(hook_lines)
        else:
            hooks_text = "No specific conversation hooks."

        # Build system prompt with context
        system_prompt = self.character_system_prompt.format(
            memories=memory_text,
            hooks=hooks_text,
            relationship_stage=self.relationship_stage,
        )

        # Build message list
        formatted = [{"role": "system", "content": system_prompt}]
        formatted.extend(self.messages)

        return formatted
