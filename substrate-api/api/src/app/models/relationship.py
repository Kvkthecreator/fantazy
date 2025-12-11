"""Relationship models."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


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

    # Progression
    stage: RelationshipStage = RelationshipStage.ACQUAINTANCE
    stage_progress: int = 0
    total_episodes: int = 0
    total_messages: int = 0

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

    class Config:
        from_attributes = True


class RelationshipWithCharacter(Relationship):
    """Relationship with embedded character summary."""

    character_name: str
    character_slug: str
    character_archetype: str
    character_avatar_url: Optional[str] = None
