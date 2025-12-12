"""Image models for scene cards and assets."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SceneGenerateRequest(BaseModel):
    """Request to generate a scene image."""

    episode_id: UUID
    prompt: Optional[str] = None  # Auto-generated if not provided
    trigger_type: str = "user_request"  # milestone, user_request, stage_change, episode_start


class SceneGenerateResponse(BaseModel):
    """Response from scene generation."""

    image_id: UUID
    episode_id: UUID
    storage_path: str
    image_url: str
    caption: Optional[str] = None
    prompt: str
    model_used: str
    latency_ms: Optional[int] = None
    sequence_index: int


class ImageAsset(BaseModel):
    """Full image asset model."""

    id: UUID
    type: str  # avatar, expression, scene
    user_id: Optional[UUID] = None
    character_id: Optional[UUID] = None

    storage_bucket: str
    storage_path: str

    prompt: Optional[str] = None
    model_used: Optional[str] = None
    generation_params: dict = Field(default_factory=dict)
    latency_ms: Optional[int] = None

    style_tags: List[str] = Field(default_factory=list)

    mime_type: str = "image/png"
    file_size_bytes: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None

    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class EpisodeImage(BaseModel):
    """Episode image (scene card) model."""

    id: UUID
    episode_id: UUID
    image_id: UUID

    sequence_index: int
    caption: Optional[str] = None

    triggered_by_message_id: Optional[UUID] = None
    trigger_type: Optional[str] = None  # milestone, user_request, stage_change, episode_start

    is_memory: bool = False
    saved_at: Optional[datetime] = None

    created_at: datetime

    class Config:
        from_attributes = True


class EpisodeImageWithAsset(EpisodeImage):
    """Episode image with embedded asset data."""

    storage_path: str
    image_url: str
    prompt: Optional[str] = None
    style_tags: List[str] = Field(default_factory=list)


class MemorySaveRequest(BaseModel):
    """Request to save/unsave a scene as memory."""

    is_memory: bool = True


class Memory(BaseModel):
    """Memory (saved scene card) for gallery view."""

    image_id: UUID
    episode_id: UUID
    character_id: UUID
    character_name: str
    caption: Optional[str] = None
    storage_path: str
    image_url: str
    style_tags: List[str] = Field(default_factory=list)
    saved_at: datetime
    episode_started_at: datetime
