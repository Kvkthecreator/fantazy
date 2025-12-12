"""Memory event models."""
import json
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MemoryType(str, Enum):
    """Types of memory events."""

    FACT = "fact"  # User's name is Alex
    PREFERENCE = "preference"  # Likes oat milk
    EVENT = "event"  # Has exam Tuesday
    GOAL = "goal"  # Wants to learn guitar
    RELATIONSHIP = "relationship"  # Has sister named Emma
    EMOTION = "emotion"  # Feeling stressed about work
    META = "meta"  # Meta info about the relationship


class MemoryEventCreate(BaseModel):
    """Data for creating a memory event."""

    character_id: Optional[UUID] = None
    episode_id: Optional[UUID] = None
    type: MemoryType
    content: Dict[str, Any]
    summary: str
    emotional_valence: int = Field(0, ge=-2, le=2)
    importance_score: float = Field(0.5, ge=0, le=1)
    category: Optional[str] = None


class MemoryEvent(BaseModel):
    """Memory event model."""

    id: UUID
    user_id: UUID
    character_id: Optional[UUID] = None
    episode_id: Optional[UUID] = None

    # Classification
    type: MemoryType
    category: Optional[str] = None

    # Content
    content: Dict[str, Any] = Field(default_factory=dict)
    summary: str

    # Scoring
    emotional_valence: int = Field(0, ge=-2, le=2)
    importance_score: float = Field(0.5, ge=0, le=1)

    # Lifecycle
    last_referenced_at: Optional[datetime] = None
    reference_count: int = 0
    expires_at: Optional[datetime] = None
    is_active: bool = True

    created_at: datetime

    @field_validator("content", mode="before")
    @classmethod
    def ensure_content_is_dict(cls, v: Any) -> Dict[str, Any]:
        """Handle content as JSON string (from LLM or DB)."""
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
                # Return as wrapped dict if can't parse
                return {"raw": v}
        return {}

    class Config:
        from_attributes = True


class MemoryQuery(BaseModel):
    """Query parameters for memory retrieval."""

    character_id: Optional[UUID] = None
    types: Optional[List[MemoryType]] = None
    min_importance: float = 0.0
    limit: int = Field(10, ge=1, le=50)
    include_global: bool = True


class ExtractedMemory(BaseModel):
    """Memory extracted from conversation by LLM."""

    type: MemoryType
    summary: str
    content: Dict[str, Any] = Field(default_factory=dict)
    emotional_valence: int = Field(0, ge=-2, le=2)
    importance_score: float = Field(0.5, ge=0, le=1)
    category: Optional[str] = None

    @field_validator("content", mode="before")
    @classmethod
    def ensure_content_is_dict(cls, v: Any) -> Dict[str, Any]:
        """Handle content as JSON string (from LLM output)."""
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
