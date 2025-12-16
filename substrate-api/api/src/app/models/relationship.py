"""Relationship models - DEPRECATED: Use engagement.py instead.

This file provides backwards compatibility aliases.
All new code should import from app.models.engagement.
"""

# Re-export from engagement for backwards compatibility
from app.models.engagement import (
    Engagement as Relationship,
    EngagementCreate as RelationshipCreate,
    EngagementUpdate as RelationshipUpdate,
    EngagementWithCharacter as RelationshipWithCharacter,
)

# Legacy enum - no longer used but kept for import compatibility
from enum import Enum


class RelationshipStage(str, Enum):
    """DEPRECATED: Relationship stages are sunset (EP-01 pivot)."""

    ACQUAINTANCE = "acquaintance"
    FRIENDLY = "friendly"
    CLOSE = "close"
    INTIMATE = "intimate"


__all__ = [
    "Relationship",
    "RelationshipCreate",
    "RelationshipUpdate",
    "RelationshipWithCharacter",
    "RelationshipStage",
]
