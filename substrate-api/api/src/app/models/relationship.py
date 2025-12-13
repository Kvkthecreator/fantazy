"""Relationship models."""
import json
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RelationshipStage(str, Enum):
    """Relationship progression stages."""

    ACQUAINTANCE = "acquaintance"
    FRIENDLY = "friendly"
    CLOSE = "close"
    INTIMATE = "intimate"


class RelationshipCreate(BaseModel):
    """Data for creating a relationship."""

    character_id: UUID


class RelationshipUpdate(BaseModel):
    """Data for updating a relationship."""

    nickname: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    relationship_notes: Optional[str] = None


class Relationship(BaseModel):
    """User-Character relationship model."""

    id: UUID
    user_id: UUID
    character_id: UUID

    # Progression (legacy)
    stage: RelationshipStage = RelationshipStage.ACQUAINTANCE
    stage_progress: int = 0
    total_episodes: int = 0
    total_messages: int = 0

    # Dynamic relationship state (Phase 4: Beat-aware system)
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
    inside_jokes: List[str] = Field(default_factory=list)
    relationship_notes: Optional[str] = None
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

    @field_validator("inside_jokes", "milestones", mode="before")
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


class RelationshipWithCharacter(Relationship):
    """Relationship with embedded character summary."""

    character_name: str
    character_slug: str
    character_archetype: str
    character_avatar_url: Optional[str] = None
