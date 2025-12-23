"""Episode Template models.

An Episode Template is the scenario definition created by studio/content creators.
When a user starts an episode, a Session is created from the template.

Reference: docs/GLOSSARY.md, docs/EPISODE_DYNAMICS_CANON.md
"""

import json
from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class VisualMode:
    """Visual generation mode constants (Ticket + Moments model).

    Defines how auto-generated visuals are handled for an episode.

    Reference: docs/monetization/MONETIZATION_v2.0.md
    """
    CINEMATIC = "cinematic"  # 3-4 auto-gens at narrative beats (Director decides)
    MINIMAL = "minimal"      # 1 auto-gen at climax only
    NONE = "none"            # No auto-gen (manual "Capture Moment" still available)


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

    ADR-002: Theatrical Model
    Scene motivation (objective/obstacle/tactic) is now authored here,
    not generated per-turn by Director. The actor (character LLM) internalizes
    these during "rehearsal" (context building) and improvises within the frame.
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
    starter_prompts: List[str] = Field(default_factory=list)  # Alternative opening suggestions for UI
    background_image_url: Optional[str] = None
    episode_frame: Optional[str] = None  # Stage direction for LLM

    # Episode dynamics (per EPISODE_DYNAMICS_CANON.md)
    # NOTE: fade_hints, arc_hints removed - never used in prompt generation
    dramatic_question: Optional[str] = None
    resolution_types: List[str] = Field(
        default_factory=lambda: ["positive", "neutral", "negative"]
    )

    # Scene motivation (ADR-002: Theatrical Model)
    # These are the "director's notes" given during rehearsal, not generated per-turn
    scene_objective: Optional[str] = None  # What character wants from user this scene
    scene_obstacle: Optional[str] = None   # What's stopping them from just asking
    scene_tactic: Optional[str] = None     # How they're trying to get what they want

    # Director configuration
    genre: str = "romance"  # Story genre for semantic evaluation context
    # NOTE: series_finale removed - never used in prompt generation or Director logic
    turn_budget: Optional[int] = None  # Director uses for pacing calculation

    # Visual generation (Ticket + Moments model)
    # NOTE: auto_scene_mode, scene_interval, spark_cost_per_scene removed - use visual_mode
    visual_mode: str = VisualMode.NONE  # cinematic, minimal, none
    generation_budget: int = 0  # Max auto-gens included in episode cost
    episode_cost: int = 3  # Sparks to start episode (0 for entry/play)

    # Status
    is_default: bool = False
    sort_order: int = 0
    status: str = "draft"

    # Timestamps
    created_at: datetime
    updated_at: datetime

    @field_validator("resolution_types", "starter_prompts", mode="before")
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
    starter_prompts: List[str] = Field(default_factory=list)

    # Optional relationships
    character_id: Optional[UUID] = None
    series_id: Optional[UUID] = None

    # Optional configuration
    episode_number: int = 0
    episode_type: str = EpisodeType.CORE
    episode_frame: Optional[str] = None
    dramatic_question: Optional[str] = None
    resolution_types: List[str] = Field(
        default_factory=lambda: ["positive", "neutral", "negative"]
    )

    # Scene motivation (ADR-002: Theatrical Model)
    scene_objective: Optional[str] = None
    scene_obstacle: Optional[str] = None
    scene_tactic: Optional[str] = None

    # Director configuration
    genre: str = "romance"
    turn_budget: Optional[int] = None

    # Visual generation
    visual_mode: str = VisualMode.NONE
    generation_budget: int = 0
    episode_cost: int = 3

    # Status
    is_default: bool = False
    status: str = "draft"


class EpisodeTemplateUpdate(BaseModel):
    """Input for updating an episode template."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    situation: Optional[str] = Field(None, min_length=10, max_length=2000)
    opening_line: Optional[str] = Field(None, min_length=1, max_length=1000)
    starter_prompts: Optional[List[str]] = None

    episode_number: Optional[int] = None
    episode_type: Optional[str] = None
    episode_frame: Optional[str] = None
    dramatic_question: Optional[str] = None
    resolution_types: Optional[List[str]] = None

    # Scene motivation (ADR-002: Theatrical Model)
    scene_objective: Optional[str] = None
    scene_obstacle: Optional[str] = None
    scene_tactic: Optional[str] = None

    # Director configuration
    genre: Optional[str] = None
    turn_budget: Optional[int] = None

    # Visual generation
    visual_mode: Optional[str] = None
    generation_budget: Optional[int] = None
    episode_cost: Optional[int] = None

    is_default: Optional[bool] = None
    sort_order: Optional[int] = None
    status: Optional[str] = None
    background_image_url: Optional[str] = None
