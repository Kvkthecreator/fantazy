"""Engagement models (formerly Relationship)."""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# RelationshipStage is SUNSET - no longer used
# Kept for backwards compatibility during migration only


class EngagementCreate(BaseModel):
    """Data for creating an engagement."""

    character_id: UUID


class EngagementUpdate(BaseModel):
    """Data for updating an engagement."""

    nickname: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    engagement_notes: Optional[str] = None


class Engagement(BaseModel):
    """User-Character engagement model.

    Lightweight link between user and character for stats tracking.
    Stage progression has been sunset (EP-01 Episode-First Pivot).
    """

    id: UUID
    user_id: UUID
    character_id: UUID

    # Stats (stage removed - EP-01 pivot)
    total_sessions: int = 0  # was total_episodes
    total_messages: int = 0

    # Dynamic engagement state (Phase 4: Beat-aware system)
    dynamic: Dict[str, Any] = Field(default_factory=lambda: {
        "tone": "warm",
        "tension_level": 30,
        "recent_beats": []
    })
    milestones: List[str] = Field(default_factory=list)

    # Timestamps
    first_met_at: datetime
    last_interaction_at: Optional[datetime] = None

    # Custom data
    nickname: Optional[str] = None
    # NOTE: inside_jokes removed - never populated, milestones serves similar purpose
    engagement_notes: Optional[str] = None  # was relationship_notes
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Status
    is_favorite: bool = False
    is_archived: bool = False

    created_at: datetime
    updated_at: datetime

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

    @field_validator("milestones", mode="before")
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

    @field_validator("dynamic", mode="before")
    @classmethod
    def ensure_dynamic_is_dict(cls, v: Any) -> Dict[str, Any]:
        """Handle dynamic as JSON string (from DB)."""
        default = {"tone": "warm", "tension_level": 30, "recent_beats": []}
        if v is None:
            return default
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, dict):
                    return parsed
            except (json.JSONDecodeError, TypeError):
                return default
        return default

    class Config:
        from_attributes = True


class EngagementWithCharacter(Engagement):
    """Engagement with embedded character summary."""

    character_name: str
    character_slug: str
    character_archetype: str
    character_avatar_url: Optional[str] = None


# Backwards compatibility aliases (deprecated)
Relationship = Engagement
RelationshipCreate = EngagementCreate
RelationshipUpdate = EngagementUpdate
RelationshipWithCharacter = EngagementWithCharacter
