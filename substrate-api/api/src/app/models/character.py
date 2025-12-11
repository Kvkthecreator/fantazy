"""Character models."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CharacterPersonality(BaseModel):
    """Big Five personality traits and character traits."""

    openness: float = Field(0.5, ge=0, le=1)
    conscientiousness: float = Field(0.5, ge=0, le=1)
    extraversion: float = Field(0.5, ge=0, le=1)
    agreeableness: float = Field(0.5, ge=0, le=1)
    neuroticism: float = Field(0.5, ge=0, le=1)
    traits: List[str] = Field(default_factory=list)


class CharacterToneStyle(BaseModel):
    """Character's communication style."""

    formality: str = "casual"
    emoji_usage: str = "moderate"
    uses_ellipsis: bool = False
    uses_tildes: bool = False
    punctuation_style: str = "normal"
    capitalization: str = "normal"


class CharacterBoundaries(BaseModel):
    """Character's interaction boundaries."""

    nsfw_allowed: bool = False
    flirting_level: str = "playful"
    relationship_max_stage: str = "intimate"
    avoided_topics: List[str] = Field(default_factory=list)
    can_reject_user: bool = True
    has_own_boundaries: bool = True


class CharacterSummary(BaseModel):
    """Minimal character info for lists and cards."""

    id: UUID
    name: str
    slug: str
    archetype: str
    avatar_url: Optional[str] = None
    short_backstory: Optional[str] = None
    is_premium: bool = False


class Character(BaseModel):
    """Full character model."""

    id: UUID
    name: str
    slug: str
    archetype: str
    world_id: Optional[UUID] = None
    avatar_url: Optional[str] = None

    # Personality
    baseline_personality: Dict[str, Any] = Field(default_factory=dict)
    tone_style: Dict[str, Any] = Field(default_factory=dict)
    speech_patterns: Dict[str, Any] = Field(default_factory=dict)

    # Backstory
    short_backstory: Optional[str] = None
    full_backstory: Optional[str] = None
    current_stressor: Optional[str] = None
    likes: List[str] = Field(default_factory=list)
    dislikes: List[str] = Field(default_factory=list)

    # Conversation
    system_prompt: str
    starter_prompts: List[str] = Field(default_factory=list)
    example_messages: List[Dict[str, Any]] = Field(default_factory=list)

    # Boundaries
    boundaries: Dict[str, Any] = Field(default_factory=dict)

    # Relationship config
    relationship_stage_thresholds: Dict[str, int] = Field(default_factory=dict)

    # Status
    is_active: bool = True
    is_premium: bool = False
    sort_order: int = 0

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    def get_personality(self) -> CharacterPersonality:
        """Parse personality from JSON."""
        return CharacterPersonality(**self.baseline_personality)

    def get_tone_style(self) -> CharacterToneStyle:
        """Parse tone style from JSON."""
        return CharacterToneStyle(**self.tone_style)

    def get_boundaries(self) -> CharacterBoundaries:
        """Parse boundaries from JSON."""
        return CharacterBoundaries(**self.boundaries)
