"""Session models.

A Session is the runtime conversation instance when a user plays through an episode.
Reference: docs/GLOSSARY.md - Session States: active, paused, faded, complete
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

if TYPE_CHECKING:
    from app.models.message import Message


class SessionState:
    """Session state constants (per GLOSSARY.md Session States)."""
    ACTIVE = "active"      # Currently in conversation
    PAUSED = "paused"      # User left mid-conversation
    FADED = "faded"        # Natural conversation pause reached
    COMPLETE = "complete"  # Dramatic question addressed, resolution reached


class ResolutionType:
    """Resolution type constants (per EPISODE_DYNAMICS_CANON.md)."""
    POSITIVE = "positive"    # Favorable outcome
    NEUTRAL = "neutral"      # Neither positive nor negative
    NEGATIVE = "negative"    # Unfavorable outcome
    SURPRISE = "surprise"    # Unexpected turn
    FADED = "faded"          # Natural fade without explicit resolution


class SessionCreate(BaseModel):
    """Data for creating a session."""

    character_id: UUID
    episode_template_id: Optional[UUID] = None
    scene: Optional[str] = None
    title: Optional[str] = None


class SessionUpdate(BaseModel):
    """Data for updating a session."""

    title: Optional[str] = None
    scene: Optional[str] = None
    is_active: Optional[bool] = None
    session_state: Optional[str] = None
    resolution_type: Optional[str] = None


class SessionSummary(BaseModel):
    """Session summary for lists."""

    id: UUID
    character_id: UUID
    episode_number: int
    title: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    message_count: int = 0
    is_active: bool = True
    session_state: str = SessionState.ACTIVE


class Session(BaseModel):
    """Full session model (runtime conversation instance).

    A Session is the runtime instance when a user starts an Episode Template.
    Terminology: Episode Template = scenario, Session = runtime.

    Sessions are scoped by (user_id, series_id, episode_template_id):
    - Series-level isolation: Each series has independent conversation history
    - Episode-level isolation: Each episode template has its own session
    - Memory belongs to the series, not just the character

    Session States (per GLOSSARY.md):
    - active: Currently in conversation
    - paused: User left mid-conversation
    - faded: Natural conversation pause reached
    - complete: Dramatic question addressed, resolution reached
    """

    id: UUID
    user_id: UUID
    character_id: UUID
    engagement_id: Optional[UUID] = None
    episode_template_id: Optional[UUID] = None
    series_id: Optional[UUID] = None  # Series scoping for memory isolation

    # Session info
    episode_number: int
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

    # Status (legacy - prefer session_state)
    is_active: bool = True

    # Session state tracking (new - per EPISODE_DYNAMICS_CANON.md)
    session_state: str = SessionState.ACTIVE
    resolution_type: Optional[str] = None
    fade_metadata: Dict[str, Any] = Field(default_factory=dict)

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Director tracking (for bounded episodes)
    turn_count: int = 0
    director_state: Dict[str, Any] = Field(default_factory=dict)
    completion_trigger: Optional[str] = None

    created_at: datetime

    @field_validator("metadata", "fade_metadata", "director_state", mode="before")
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
