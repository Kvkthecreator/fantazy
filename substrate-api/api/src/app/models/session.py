"""Session models (formerly Episode runtime)."""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

if TYPE_CHECKING:
    from app.models.message import Message


class SessionCreate(BaseModel):
    """Data for creating a session."""

    character_id: UUID
    scene: Optional[str] = None
    title: Optional[str] = None


class SessionUpdate(BaseModel):
    """Data for updating a session."""

    title: Optional[str] = None
    scene: Optional[str] = None
    is_active: Optional[bool] = None


class SessionSummary(BaseModel):
    """Session summary for lists."""

    id: UUID
    character_id: UUID
    episode_number: int  # Keep as episode_number for display
    title: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    message_count: int = 0
    is_active: bool = True


class Session(BaseModel):
    """Full session model (runtime conversation instance).

    A Session is the runtime instance when a user starts an Episode Template.
    Terminology: Episode Template = scenario, Session = runtime.
    """

    id: UUID
    user_id: UUID
    character_id: UUID
    engagement_id: Optional[UUID] = None  # was relationship_id
    episode_template_id: Optional[UUID] = None

    # Session info
    episode_number: int  # Keep for display purposes
    title: Optional[str] = None
    scene: Optional[str] = None

    # Timing
    started_at: datetime
    ended_at: Optional[datetime] = None

    # Summary (generated)
    summary: Optional[str] = None
    emotional_tags: List[str] = Field(default_factory=list)
    key_events: List[str] = Field(default_factory=list)

    # Stats
    message_count: int = 0
    user_message_count: int = 0

    # Status
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

    @field_validator("emotional_tags", "key_events", mode="before")
    @classmethod
    def ensure_list(cls, v: Any) -> List[str]:
        """Handle list fields as JSON string (from DB)."""
        if v is None:
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, TypeError):
                return [v]
        return []

    class Config:
        from_attributes = True


class SessionWithMessages(Session):
    """Session with embedded messages."""

    messages: List[Any] = Field(default_factory=list)


# Backwards compatibility aliases (deprecated)
Episode = Session
EpisodeCreate = SessionCreate
EpisodeUpdate = SessionUpdate
EpisodeSummary = SessionSummary
EpisodeWithMessages = SessionWithMessages
