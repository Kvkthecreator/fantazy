"""Hook models."""
import json
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class HookType(str, Enum):
    """Types of conversation hooks."""

    REMINDER = "reminder"  # Check in about something
    FOLLOW_UP = "follow_up"  # Follow up on mentioned event
    MILESTONE = "milestone"  # Relationship milestone
    SCHEDULED = "scheduled"  # Scheduled check-in
    ANNIVERSARY = "anniversary"  # Remember special dates


class HookCreate(BaseModel):
    """Data for creating a hook."""

    character_id: UUID
    episode_id: Optional[UUID] = None
    type: HookType
    content: str
    context: Optional[str] = None
    suggested_opener: Optional[str] = None
    trigger_after: Optional[datetime] = None
    trigger_before: Optional[datetime] = None
    priority: int = Field(1, ge=1, le=5)


class Hook(BaseModel):
    """Hook model."""

    id: UUID
    user_id: UUID
    character_id: UUID
    episode_id: Optional[UUID] = None

    # Classification
    type: HookType
    priority: int = Field(1, ge=1, le=5)

    # Content
    content: str
    context: Optional[str] = None
    suggested_opener: Optional[str] = None

    # Scheduling
    trigger_after: Optional[datetime] = None
    trigger_before: Optional[datetime] = None

    # Status
    triggered_at: Optional[datetime] = None
    is_active: bool = True

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


class ExtractedHook(BaseModel):
    """Hook extracted from conversation by LLM."""

    type: HookType
    content: str
    suggested_opener: Optional[str] = None
    days_until_trigger: Optional[int] = None
    priority: int = Field(1, ge=1, le=5)
