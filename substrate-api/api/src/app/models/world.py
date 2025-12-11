"""World models."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class WorldSummary(BaseModel):
    """Minimal world info for lists."""

    id: UUID
    name: str
    slug: str
    tone: Optional[str] = None


class World(BaseModel):
    """Full world model."""

    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    default_scenes: List[str] = Field(default_factory=list)
    tone: Optional[str] = None
    ambient_details: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True
