"""Hook models."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field


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

    class Config:
        from_attributes = True


class ExtractedHook(BaseModel):
    """Hook extracted from conversation by LLM."""

    type: HookType
    content: str
    suggested_opener: Optional[str] = None
    days_until_trigger: Optional[int] = None
    priority: int = Field(1, ge=1, le=5)
