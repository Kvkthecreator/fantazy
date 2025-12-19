"""Episode Template models.

An Episode Template is the scenario definition created by studio/content creators.
When a user starts an episode, a Session is created from the template.

Reference: docs/GLOSSARY.md, docs/EPISODE_DYNAMICS_CANON.md
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CompletionMode:
    """Completion mode constants for bounded episodes."""
    OPEN = "open"              # No defined end, fade naturally (default)
    TURN_LIMITED = "turn_limited"  # Ends after N turns (games, tests)
    BEAT_GATED = "beat_gated"      # Ends when specific beat is reached (mystery)
    OBJECTIVE = "objective"        # Ends when objective is achieved (puzzles)


class EpisodeType:
    """Episode type constants (per GLOSSARY.md)."""
    ENTRY = "entry"        # Entry point episode (Episode 0)
    CORE = "core"          # Main narrative episodes
    EXPANSION = "expansion"  # Additional content
    SPECIAL = "special"     # Time-limited or special events


class EpisodeTemplateSummary(BaseModel):
    """Minimal episode template info for lists."""
    id: UUID
    title: str
    slug: str
    episode_number: int
    episode_type: str = EpisodeType.CORE
    situation: str
    series_id: Optional[UUID] = None
    status: str = "draft"


class EpisodeTemplate(BaseModel):
    """Full episode template model.

    An Episode Template is the "scenario" - the blueprint for an episode.
    It contains the situation, opening line, dramatic question, and beats.

    When a user plays an episode, a Session is created from this template.
    """
    id: UUID

    # Relationships
    character_id: Optional[UUID] = None
    series_id: Optional[UUID] = None

    # Episode identity
    episode_number: int = 0
    title: str
    slug: str
    episode_type: str = EpisodeType.CORE

    # Scene setup
    situation: str  # Present-tense scene description
    opening_line: str  # Character's first message
    background_image_url: Optional[str] = None
    episode_frame: Optional[str] = None  # Stage direction for LLM

    # Episode dynamics (per EPISODE_DYNAMICS_CANON.md)
    dramatic_question: Optional[str] = None
    beat_guidance: Dict[str, Any] = Field(default_factory=dict)
    resolution_types: List[str] = Field(
        default_factory=lambda: ["positive", "neutral", "negative"]
    )
    fade_hints: Dict[str, Any] = Field(default_factory=dict)
    arc_hints: List[Any] = Field(default_factory=list)

    # Completion configuration (for bounded episodes)
    completion_mode: str = CompletionMode.OPEN
    turn_budget: Optional[int] = None
    completion_criteria: Dict[str, Any] = Field(default_factory=dict)

    # Status
    is_default: bool = False
    sort_order: int = 0
    status: str = "draft"

    # Timestamps
    created_at: datetime
    updated_at: datetime

    @field_validator("beat_guidance", "fade_hints", "completion_criteria", mode="before")
    @classmethod
    def ensure_dict(cls, v: Any) -> Dict[str, Any]:
        """Handle dict fields as JSON string (from DB)."""
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

    @field_validator("resolution_types", "arc_hints", mode="before")
    @classmethod
    def ensure_list(cls, v: Any) -> List[Any]:
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


class EpisodeTemplateCreate(BaseModel):
    """Input for creating an episode template."""
    title: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=100)
    situation: str = Field(..., min_length=10, max_length=2000)
    opening_line: str = Field(..., min_length=1, max_length=1000)

    # Optional relationships
    character_id: Optional[UUID] = None
    series_id: Optional[UUID] = None

    # Optional configuration
    episode_number: int = 0
    episode_type: str = EpisodeType.CORE
    episode_frame: Optional[str] = None
    dramatic_question: Optional[str] = None
    beat_guidance: Dict[str, Any] = Field(default_factory=dict)
    resolution_types: List[str] = Field(
        default_factory=lambda: ["positive", "neutral", "negative"]
    )

    # Completion configuration
    completion_mode: str = CompletionMode.OPEN
    turn_budget: Optional[int] = None
    completion_criteria: Dict[str, Any] = Field(default_factory=dict)

    # Status
    is_default: bool = False
    status: str = "draft"


class EpisodeTemplateUpdate(BaseModel):
    """Input for updating an episode template."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    situation: Optional[str] = Field(None, min_length=10, max_length=2000)
    opening_line: Optional[str] = Field(None, min_length=1, max_length=1000)

    episode_number: Optional[int] = None
    episode_type: Optional[str] = None
    episode_frame: Optional[str] = None
    dramatic_question: Optional[str] = None
    beat_guidance: Optional[Dict[str, Any]] = None
    resolution_types: Optional[List[str]] = None
    fade_hints: Optional[Dict[str, Any]] = None

    # Completion configuration
    completion_mode: Optional[str] = None
    turn_budget: Optional[int] = None
    completion_criteria: Optional[Dict[str, Any]] = None

    is_default: Optional[bool] = None
    sort_order: Optional[int] = None
    status: Optional[str] = None
    background_image_url: Optional[str] = None
