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


class ChoiceOption(BaseModel):
    """A single choice option within a choice point."""
    id: str
    label: str
    sets_flag: Optional[str] = None


class ChoicePoint(BaseModel):
    """An interactive decision moment within an episode (ADR-008)."""
    id: str
    trigger: str  # "turn:N" or "after_objective:obj_id"
    prompt: str
    choices: List[ChoiceOption]


class FlagContextRule(BaseModel):
    """Context injection rule based on flags (ADR-008)."""
    if_flag: str
    inject: str


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
    character_id: Optional[UUID] = None  # Canonical character for this episode (backward compat)
    series_id: Optional[UUID] = None
    role_id: Optional[UUID] = None  # ADR-004: Role this episode requires (preferred over character_id)

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

    # User objectives (ADR-008: User Objectives System)
    # These give users explicit goals with visible stakes and consequences
    user_objective: Optional[str] = None   # What the user is trying to achieve
    user_hint: Optional[str] = None        # Optional hint to help users
    success_condition: Optional[str] = None  # semantic:<criteria>, keyword:<words>, turn:<N>, flag:<name>
    failure_condition: str = "turn_budget_exceeded"  # Default: fail if turn budget exceeded
    on_success: dict = Field(default_factory=dict)   # { "set_flag": "...", "suggest_episode": "..." }
    on_failure: dict = Field(default_factory=dict)   # { "set_flag": "...", "suggest_episode": "..." }
    choice_points: List[ChoicePoint] = Field(default_factory=list)  # Interactive decision moments
    flag_context_rules: List[FlagContextRule] = Field(default_factory=list)  # Context injection rules

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
    is_free_chat: bool = False  # System-generated template for free chat mode
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

    @field_validator("on_success", "on_failure", mode="before")
    @classmethod
    def ensure_dict(cls, v: Any) -> dict:
        """Handle JSONB dict fields from DB."""
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
                return {}
        return {}

    @field_validator("choice_points", mode="before")
    @classmethod
    def ensure_choice_points(cls, v: Any) -> List[ChoicePoint]:
        """Handle choice_points JSONB from DB."""
        if v is None:
            return []
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        if isinstance(v, list):
            return [ChoicePoint(**cp) if isinstance(cp, dict) else cp for cp in v]
        return []

    @field_validator("flag_context_rules", mode="before")
    @classmethod
    def ensure_flag_context_rules(cls, v: Any) -> List[FlagContextRule]:
        """Handle flag_context_rules JSONB from DB."""
        if v is None:
            return []
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        if isinstance(v, list):
            return [FlagContextRule(**r) if isinstance(r, dict) else r for r in v]
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
    character_id: Optional[UUID] = None  # Canonical character (backward compat)
    series_id: Optional[UUID] = None
    role_id: Optional[UUID] = None  # ADR-004: Role (preferred)

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

    # User objectives (ADR-008: User Objectives System)
    user_objective: Optional[str] = None
    user_hint: Optional[str] = None
    success_condition: Optional[str] = None
    failure_condition: str = "turn_budget_exceeded"
    on_success: dict = Field(default_factory=dict)
    on_failure: dict = Field(default_factory=dict)
    choice_points: List[ChoicePoint] = Field(default_factory=list)
    flag_context_rules: List[FlagContextRule] = Field(default_factory=list)

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

    # User objectives (ADR-008: User Objectives System)
    user_objective: Optional[str] = None
    user_hint: Optional[str] = None
    success_condition: Optional[str] = None
    failure_condition: Optional[str] = None
    on_success: Optional[dict] = None
    on_failure: Optional[dict] = None
    choice_points: Optional[List[ChoicePoint]] = None
    flag_context_rules: Optional[List[FlagContextRule]] = None

    # Director configuration
    genre: Optional[str] = None
    turn_budget: Optional[int] = None

    # Visual generation
    visual_mode: Optional[str] = None
    generation_budget: Optional[int] = None
    episode_cost: Optional[int] = None

    # Relationships
    role_id: Optional[UUID] = None  # ADR-004: Role (preferred)

    is_default: Optional[bool] = None
    sort_order: Optional[int] = None
    status: Optional[str] = None
    background_image_url: Optional[str] = None
