"""Usage tracking models."""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class UsageStats(BaseModel):
    """Current usage statistics for a user."""

    flux_used: int
    flux_quota: int
    flux_remaining: int
    flux_resets_at: datetime
    messages_sent: int
    messages_resets_at: datetime
    subscription_status: str


class UsageResponse(BaseModel):
    """API response for usage stats."""

    flux: "FluxUsage"
    messages: "MessageUsage"
    subscription_status: str


class FluxUsage(BaseModel):
    """Flux generation usage details."""

    used: int
    quota: int
    remaining: int
    resets_at: datetime


class MessageUsage(BaseModel):
    """Message usage details (tracking only)."""

    sent: int
    resets_at: datetime


class QuotaCheckResult(BaseModel):
    """Result of checking if user can perform an action."""

    allowed: bool
    current_usage: int
    quota: int
    remaining: int
    message: Optional[str] = None


class UsageEvent(BaseModel):
    """A single usage event record."""

    id: UUID
    user_id: UUID
    event_type: Literal["flux_generation", "message_sent"]
    character_id: Optional[UUID] = None
    episode_id: Optional[UUID] = None
    metadata: dict = {}
    created_at: datetime

    class Config:
        from_attributes = True


class UsageEventCreate(BaseModel):
    """Data for creating a usage event."""

    event_type: Literal["flux_generation", "message_sent"]
    character_id: Optional[UUID] = None
    episode_id: Optional[UUID] = None
    metadata: dict = {}


# Rebuild models to resolve forward references
UsageResponse.model_rebuild()
