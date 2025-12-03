"""Pydantic schemas for context entries API."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================================
# Context Entry Schema (defines field structure)
# ============================================================================


class FieldDefinition(BaseModel):
    """Definition of a single field in a context entry schema."""

    key: str
    type: str  # text, longtext, array, asset
    label: str
    required: bool = False
    placeholder: Optional[str] = None
    help: Optional[str] = None
    accept: Optional[str] = None  # For asset fields: MIME types
    item_type: Optional[str] = None  # For array fields


class ContextEntrySchemaResponse(BaseModel):
    """Response model for context entry schema."""

    anchor_role: str
    display_name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    is_singleton: bool = True
    field_schema: Dict[str, Any]
    sort_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ContextEntrySchemasListResponse(BaseModel):
    """Response model for listing all schemas."""

    schemas: List[ContextEntrySchemaResponse]


# ============================================================================
# Context Entry (actual data)
# ============================================================================


class ContextEntryCreate(BaseModel):
    """Request model for creating/updating a context entry."""

    anchor_role: str
    entry_key: Optional[str] = None  # For non-singleton roles
    display_name: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)


class ContextEntryUpdate(BaseModel):
    """Request model for updating context entry data."""

    data: Dict[str, Any]
    display_name: Optional[str] = None


class ContextEntryResponse(BaseModel):
    """Response model for a context entry."""

    id: UUID
    basket_id: UUID
    anchor_role: str
    entry_key: Optional[str] = None
    display_name: Optional[str] = None
    data: Dict[str, Any]
    completeness_score: Optional[float] = None
    state: str = "active"
    refresh_policy: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[UUID] = None

    # Joined from schema (optional)
    schema_display_name: Optional[str] = None
    schema_icon: Optional[str] = None
    schema_category: Optional[str] = None


class ContextEntriesListResponse(BaseModel):
    """Response model for listing context entries."""

    entries: List[ContextEntryResponse]
    basket_id: UUID


class ResolvedAsset(BaseModel):
    """Resolved asset reference with URL."""

    asset_id: str
    file_name: Optional[str] = None
    mime_type: Optional[str] = None
    url: Optional[str] = None


class ContextEntryResolvedResponse(BaseModel):
    """Response model for context entry with resolved asset references."""

    id: UUID
    basket_id: UUID
    anchor_role: str
    entry_key: Optional[str] = None
    display_name: Optional[str] = None
    data: Dict[str, Any]  # Asset fields resolved to ResolvedAsset objects
    completeness_score: Optional[float] = None
    state: str = "active"


# ============================================================================
# Completeness Calculation
# ============================================================================


class CompletenessResponse(BaseModel):
    """Response model for completeness calculation."""

    score: float  # 0.0 - 1.0
    required_fields: int
    filled_fields: int
    missing_fields: List[str]


# ============================================================================
# Bulk Operations
# ============================================================================


class BulkContextResponse(BaseModel):
    """Response for fetching multiple context entries at once."""

    entries: Dict[str, ContextEntryResponse]  # Keyed by anchor_role
    basket_id: UUID
    missing_roles: List[str]
