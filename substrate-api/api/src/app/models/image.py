"""Image models for scene cards, avatar assets, and image storage."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================================
# Scene Generation (user-initiated)
# ============================================================================

class SceneGenerateRequest(BaseModel):
    """Request to generate a scene image."""

    episode_id: UUID
    prompt: Optional[str] = None  # Auto-generated if not provided
    trigger_type: str = "user_request"  # milestone, user_request, stage_change, episode_start
    generation_mode: Optional[str] = None  # "t2i" or "kontext" - if None, auto-detect based on anchor availability


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
    avatar_kit_id: Optional[UUID] = None  # Which visual identity was used


# ============================================================================
# Avatar Kits - Visual Identity Contracts
# ============================================================================

class AvatarKitCreate(BaseModel):
    """Request to create an avatar kit."""

    character_id: UUID
    name: str
    description: Optional[str] = None
    appearance_prompt: str
    style_prompt: str
    negative_prompt: Optional[str] = None
    is_default: bool = False


class AvatarKitUpdate(BaseModel):
    """Request to update an avatar kit."""

    name: Optional[str] = None
    description: Optional[str] = None
    appearance_prompt: Optional[str] = None
    style_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    status: Optional[str] = None  # draft, active, archived
    is_default: Optional[bool] = None


class AvatarKit(BaseModel):
    """Avatar kit - visual identity contract for a character."""

    id: UUID
    character_id: UUID
    created_by: Optional[UUID] = None

    name: str
    description: Optional[str] = None

    # Visual contract
    appearance_prompt: str
    style_prompt: str
    negative_prompt: Optional[str] = None

    # Anchor references
    primary_anchor_id: Optional[UUID] = None
    secondary_anchor_id: Optional[UUID] = None

    status: str = "draft"
    is_default: bool = False

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AvatarKitWithAnchors(AvatarKit):
    """Avatar kit with anchor asset URLs."""

    primary_anchor_url: Optional[str] = None
    secondary_anchor_url: Optional[str] = None


# ============================================================================
# Avatar Assets - Canonical Character Images
# ============================================================================

class AvatarAssetCreate(BaseModel):
    """Request to create an avatar asset (via upload)."""

    asset_type: str  # anchor_portrait, anchor_fullbody, expression, pose, outfit
    expression: Optional[str] = None  # For expression assets
    emotion_tags: List[str] = Field(default_factory=list)
    source_type: str = "manual_upload"


class AvatarAsset(BaseModel):
    """Avatar asset - canonical character image."""

    id: UUID
    avatar_kit_id: UUID

    asset_type: str
    expression: Optional[str] = None
    emotion_tags: List[str] = Field(default_factory=list)

    storage_bucket: str
    storage_path: str

    source_type: str
    derived_from_id: Optional[UUID] = None
    generation_metadata: Dict[str, Any] = Field(default_factory=dict)

    mime_type: str = "image/png"
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_bytes: Optional[int] = None

    is_canonical: bool = False
    is_active: bool = True

    created_at: datetime

    class Config:
        from_attributes = True


class AvatarAssetWithUrl(AvatarAsset):
    """Avatar asset with signed URL for access."""

    image_url: str


# ============================================================================
# Scene Images (renamed from episode_images)
# User-generated scene outputs
# ============================================================================

class SceneImage(BaseModel):
    """Scene image (scene card) model - renamed from EpisodeImage."""

    id: UUID
    episode_id: UUID
    image_id: UUID

    sequence_index: int
    caption: Optional[str] = None

    triggered_by_message_id: Optional[UUID] = None
    trigger_type: Optional[str] = None

    # Avatar kit tracking
    avatar_kit_id: Optional[UUID] = None
    derived_from_asset_id: Optional[UUID] = None

    is_memory: bool = False
    saved_at: Optional[datetime] = None

    created_at: datetime

    class Config:
        from_attributes = True


class SceneImageWithAsset(SceneImage):
    """Scene image with embedded asset data."""

    storage_path: str
    image_url: str
    prompt: Optional[str] = None
    style_tags: List[str] = Field(default_factory=list)


# ============================================================================
# Legacy Aliases (for backward compatibility during migration)
# ============================================================================

# Keep these aliases for code that still references old names
EpisodeImage = SceneImage
EpisodeImageWithAsset = SceneImageWithAsset


# ============================================================================
# Generic Image Assets (for non-character images)
# ============================================================================

class ImageAsset(BaseModel):
    """Generic image asset (backgrounds, props, world elements).

    NOTE: For character-specific visuals, use AvatarAsset instead.
    """

    id: UUID
    type: str  # background, prop, world (avatar/expression deprecated)
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


# ============================================================================
# Memory / Gallery
# ============================================================================

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


class SceneGalleryItem(BaseModel):
    """Scene card for gallery/story view (all scenes, not just memories)."""

    image_id: UUID
    episode_id: UUID
    character_id: UUID
    character_name: str
    series_title: Optional[str] = None
    episode_title: Optional[str] = None
    prompt: Optional[str] = None
    storage_path: str
    image_url: str
    is_memory: bool = False
    trigger_type: Optional[str] = None
    created_at: datetime
