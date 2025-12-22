"""Series models.

A Series is a narrative container grouping episodes into a coherent experience.
Reference: docs/GLOSSARY.md, docs/CONTENT_ARCHITECTURE_CANON.md
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class SeriesType:
    """Series type constants (per GLOSSARY.md)."""
    STANDALONE = "standalone"  # Self-contained, any episode can be entry
    SERIAL = "serial"          # Sequential narrative, Episode 0 recommended first
    ANTHOLOGY = "anthology"    # Themed collection, loosely connected
    CROSSOVER = "crossover"    # Multiple characters from different worlds
    PLAY = "play"              # Viral/game content for /play route (anonymous-first)


# =============================================================================
# Genre Settings Presets (Applied to Series)
# =============================================================================

GENRE_SETTING_PRESETS = {
    "romantic_tension": {
        "tension_style": "playful",
        "pacing_curve": "slow_burn",
        "resolution_mode": "open",
        "vulnerability_timing": "earned",
        "genre_notes": "",
    },
    "psychological_thriller": {
        "tension_style": "moderate",
        "pacing_curve": "steady",
        "resolution_mode": "cliffhanger",
        "vulnerability_timing": "late",
        "genre_notes": "",
    },
    "slice_of_life": {
        "tension_style": "subtle",
        "pacing_curve": "slow_burn",
        "resolution_mode": "open",
        "vulnerability_timing": "early",
        "genre_notes": "",
    },
}

# Valid options for genre settings fields
TENSION_STYLES = ["subtle", "playful", "moderate", "direct"]
PACING_CURVES = ["slow_burn", "steady", "fast_escalate"]
RESOLUTION_MODES = ["open", "closed", "cliffhanger"]
VULNERABILITY_TIMINGS = ["early", "middle", "late", "earned"]


class GenreSettings(BaseModel):
    """Genre doctrine settings applied at series level.

    These override the default genre doctrine values for all episodes
    and characters within this series.
    """
    tension_style: str = Field(
        default="playful",
        description="How tension is expressed: subtle, playful, moderate, direct"
    )
    pacing_curve: str = Field(
        default="slow_burn",
        description="Narrative pacing: slow_burn, steady, fast_escalate"
    )
    resolution_mode: str = Field(
        default="open",
        description="How episodes resolve: open, closed, cliffhanger"
    )
    vulnerability_timing: str = Field(
        default="earned",
        description="When characters show vulnerability: early, middle, late, earned"
    )
    genre_notes: str = Field(
        default="",
        description="Free-text guidance for specific adjustments"
    )

    def to_prompt_section(self) -> str:
        """Format genre settings as a prompt section for LLM injection."""
        parts = []

        if self.tension_style:
            style_guidance = {
                "subtle": "Express tension through implication, pauses, and unspoken desire",
                "playful": "Use teasing, banter, and push-pull energy",
                "moderate": "Balance clear attraction with restraint",
                "direct": "Be bold while maintaining some mystery",
            }
            parts.append(f"TENSION STYLE: {style_guidance.get(self.tension_style, self.tension_style)}")

        if self.vulnerability_timing:
            timing_guidance = {
                "early": "Show vulnerability early to build connection",
                "middle": "Reveal vulnerability as trust develops",
                "late": "Hold vulnerability until critical moments",
                "earned": "Only show vulnerability when user has earned it through engagement",
            }
            parts.append(f"VULNERABILITY: {timing_guidance.get(self.vulnerability_timing, self.vulnerability_timing)}")

        if self.pacing_curve:
            pacing_guidance = {
                "slow_burn": "Build tension gradually - patience creates anticipation",
                "steady": "Maintain consistent escalation with regular beats",
                "fast_escalate": "Move quickly through tension beats - high intensity",
            }
            parts.append(f"PACING: {pacing_guidance.get(self.pacing_curve, self.pacing_curve)}")

        if self.genre_notes:
            parts.append(f"SERIES NOTES: {self.genre_notes}")

        if not parts:
            return ""

        return "SERIES GENRE SETTINGS:\n" + "\n".join(parts)


class SeriesSummary(BaseModel):
    """Minimal series info for lists and cards."""
    id: UUID
    title: str
    slug: str
    tagline: Optional[str] = None
    series_type: str = SeriesType.STANDALONE
    genre: Optional[str] = None
    total_episodes: int = 0
    cover_image_url: Optional[str] = None
    is_featured: bool = False


class Series(BaseModel):
    """Full series model."""
    id: UUID
    title: str
    slug: str
    description: Optional[str] = None
    tagline: Optional[str] = None
    genre: Optional[str] = None

    # Relationships
    world_id: Optional[UUID] = None

    # Series taxonomy
    series_type: str = SeriesType.STANDALONE

    # Content organization
    featured_characters: List[UUID] = Field(default_factory=list)
    episode_order: List[UUID] = Field(default_factory=list)
    total_episodes: int = 0

    # Visual assets
    cover_image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    visual_style: Dict[str, Any] = Field(default_factory=dict)

    # Genre settings (per-series doctrine overrides)
    genre_settings: Dict[str, Any] = Field(default_factory=dict)

    # Publishing state
    status: str = "draft"
    is_featured: bool = False
    featured_at: Optional[datetime] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    @field_validator("genre_settings", "visual_style", mode="before")
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
                return {}
        return {}

    def get_genre_settings(self) -> GenreSettings:
        """Parse genre settings with defaults from genre preset."""
        # Start with genre preset defaults
        genre = self.genre or "romantic_tension"
        defaults = GENRE_SETTING_PRESETS.get(genre, GENRE_SETTING_PRESETS["romantic_tension"])

        # Merge with custom settings
        merged = {**defaults, **self.genre_settings}
        return GenreSettings(**merged)

    class Config:
        from_attributes = True


class SeriesCreate(BaseModel):
    """Input for creating a new series."""
    title: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    tagline: Optional[str] = Field(None, max_length=200)
    world_id: Optional[UUID] = None
    series_type: str = Field(default=SeriesType.STANDALONE)


class SeriesUpdate(BaseModel):
    """Input for updating a series."""
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    tagline: Optional[str] = Field(None, max_length=200)
    world_id: Optional[UUID] = None
    series_type: Optional[str] = None
    genre: Optional[str] = None
    featured_characters: Optional[List[UUID]] = None
    episode_order: Optional[List[UUID]] = None
    cover_image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    status: Optional[str] = None
    is_featured: Optional[bool] = None
    # Genre settings (partial update supported)
    genre_settings: Optional[Dict[str, Any]] = None


class SeriesWithEpisodes(Series):
    """Series with embedded episode templates."""
    episodes: List[Any] = Field(default_factory=list)


class SeriesWithCharacters(Series):
    """Series with embedded character summaries."""
    characters: List[Any] = Field(default_factory=list)
