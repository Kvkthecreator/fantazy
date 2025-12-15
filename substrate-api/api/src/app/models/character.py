"""Character models."""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


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


class AvatarGalleryItem(BaseModel):
    """Single gallery image for character profile."""

    id: UUID
    asset_type: str
    expression: Optional[str] = None
    image_url: str
    is_primary: bool = False


class CharacterProfile(BaseModel):
    """Character profile for the detail page - includes avatar gallery."""

    id: UUID
    name: str
    slug: str
    archetype: str
    avatar_url: Optional[str] = None
    short_backstory: Optional[str] = None
    full_backstory: Optional[str] = None
    likes: List[str] = Field(default_factory=list)
    dislikes: List[str] = Field(default_factory=list)
    starter_prompts: List[str] = Field(default_factory=list)
    is_premium: bool = False
    # Avatar gallery
    gallery: List[AvatarGalleryItem] = Field(default_factory=list)
    primary_avatar_url: Optional[str] = None

    @field_validator("likes", "dislikes", "starter_prompts", mode="before")
    @classmethod
    def ensure_list_profile(cls, v: Any) -> List[str]:
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


# Alias for backwards compatibility
CharacterWithAvatar = CharacterProfile


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

    # Opening beat (first-class fields for chat ignition)
    opening_situation: Optional[str] = None
    opening_line: Optional[str] = None

    # Boundaries
    boundaries: Dict[str, Any] = Field(default_factory=dict)

    # Life arc (character's own story/struggles)
    life_arc: Dict[str, Any] = Field(default_factory=dict)

    # Relationship config
    relationship_stage_thresholds: Dict[str, int] = Field(default_factory=dict)

    # Status & lifecycle
    status: str = "active"  # 'draft' or 'active'
    is_active: bool = True
    is_premium: bool = False
    sort_order: int = 0

    # Creator tracking
    created_by: Optional[UUID] = None

    # Discovery
    categories: List[str] = Field(default_factory=list)
    content_rating: str = "sfw"

    created_at: datetime
    updated_at: datetime

    @field_validator(
        "baseline_personality", "tone_style", "speech_patterns",
        "boundaries", "life_arc", "relationship_stage_thresholds", mode="before"
    )
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

    @field_validator("likes", "dislikes", "starter_prompts", "categories", mode="before")
    @classmethod
    def ensure_list(cls, v: Any) -> List[str]:
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

    @field_validator("example_messages", mode="before")
    @classmethod
    def ensure_example_messages_list(cls, v: Any) -> List[Dict[str, Any]]:
        """Handle example_messages as JSON string (from DB)."""
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
                return []
        return []

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


# ============================================================================
# Character Creation Contract - Input Models
# ============================================================================

# Archetype options (locked set for consistency)
ARCHETYPES = [
    "comforting",   # Warm, supportive, safe
    "flirty",       # Playful romantic energy
    "mysterious",   # Intriguing, slow reveal
    "cheerful",     # Upbeat, energetic
    "brooding",     # Deep, thoughtful, intense
    "nurturing",    # Caring, maternal/paternal
    "adventurous",  # Bold, exciting
    "intellectual", # Smart, curious, analytical
]

# Personality presets (maps to Big Five values)
PERSONALITY_PRESETS = {
    "warm_supportive": {
        "openness": 0.7,
        "conscientiousness": 0.6,
        "extraversion": 0.65,
        "agreeableness": 0.85,
        "neuroticism": 0.3,
        "traits": ["warm", "supportive", "patient", "understanding"],
    },
    "playful_teasing": {
        "openness": 0.75,
        "conscientiousness": 0.5,
        "extraversion": 0.75,
        "agreeableness": 0.7,
        "neuroticism": 0.35,
        "traits": ["playful", "witty", "teasing", "charming"],
    },
    "mysterious_reserved": {
        "openness": 0.6,
        "conscientiousness": 0.65,
        "extraversion": 0.35,
        "agreeableness": 0.55,
        "neuroticism": 0.45,
        "traits": ["mysterious", "thoughtful", "guarded", "intriguing"],
    },
    "cheerful_energetic": {
        "openness": 0.8,
        "conscientiousness": 0.55,
        "extraversion": 0.85,
        "agreeableness": 0.8,
        "neuroticism": 0.25,
        "traits": ["cheerful", "energetic", "optimistic", "enthusiastic"],
    },
    "calm_intellectual": {
        "openness": 0.85,
        "conscientiousness": 0.75,
        "extraversion": 0.45,
        "agreeableness": 0.65,
        "neuroticism": 0.3,
        "traits": ["calm", "analytical", "curious", "thoughtful"],
    },
}

# Default boundaries (sensible safety defaults)
DEFAULT_BOUNDARIES = {
    "nsfw_allowed": False,
    "flirting_level": "playful",
    "relationship_max_stage": "intimate",
    "avoided_topics": [],
    "can_reject_user": True,
    "has_own_boundaries": True,
}


class CharacterCreateInput(BaseModel):
    """Input for creating a new character (wizard steps 1-3).

    Required fields that define a character's identity and chat ignition.
    Everything else is optional and can be added post-creation.
    """

    # Step 1: Character Core
    name: str = Field(..., min_length=1, max_length=50)
    archetype: str = Field(..., description="Character archetype/role")
    avatar_url: Optional[str] = None  # Can be set later, required for activation

    # Step 2: Personality & Boundaries
    personality_preset: Optional[str] = Field(
        None,
        description="Preset name or 'custom' for manual Big Five values"
    )
    baseline_personality: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Custom Big Five values (used if preset is 'custom' or not set)"
    )
    boundaries: Dict[str, Any] = Field(
        default_factory=lambda: DEFAULT_BOUNDARIES.copy(),
        description="Safety configuration"
    )
    content_rating: str = Field(default="sfw", pattern="^(sfw|adult)$")

    # Step 3: Opening Beat (required for good first chat experience)
    opening_situation: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Scene setup for the first chat"
    )
    opening_line: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Character's first message"
    )

    # Step 4: Status
    status: str = Field(default="draft", pattern="^(draft|active)$")

    def get_resolved_personality(self) -> Dict[str, Any]:
        """Resolve personality from preset or custom values."""
        if self.personality_preset and self.personality_preset in PERSONALITY_PRESETS:
            return PERSONALITY_PRESETS[self.personality_preset].copy()
        if self.baseline_personality:
            return self.baseline_personality
        # Default to warm_supportive
        return PERSONALITY_PRESETS["warm_supportive"].copy()


class CharacterUpdateInput(BaseModel):
    """Input for updating a character (post-creation editing).

    All fields optional - only provided fields are updated.
    NOTE: system_prompt is NOT editable - it's generated from the locked template.
    """

    # Core (usually set at creation, but editable)
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    archetype: Optional[str] = None
    avatar_url: Optional[str] = None

    # Personality & boundaries
    baseline_personality: Optional[Dict[str, Any]] = None
    tone_style: Optional[Dict[str, Any]] = None
    speech_patterns: Optional[Dict[str, Any]] = None
    boundaries: Optional[Dict[str, Any]] = None

    # Backstory (optional enrichment)
    short_backstory: Optional[str] = Field(None, max_length=500)
    full_backstory: Optional[str] = Field(None, max_length=5000)
    current_stressor: Optional[str] = Field(None, max_length=500)
    likes: Optional[List[str]] = None
    dislikes: Optional[List[str]] = None

    # Opening beat
    opening_situation: Optional[str] = Field(None, max_length=1000)
    opening_line: Optional[str] = Field(None, max_length=500)

    # Conversation config (system_prompt intentionally excluded - locked template)
    starter_prompts: Optional[List[str]] = None
    example_messages: Optional[List[Dict[str, Any]]] = None

    # Life arc
    life_arc: Optional[Dict[str, Any]] = None

    # World attachment
    world_id: Optional[UUID] = None

    # Status & discovery
    status: Optional[str] = Field(None, pattern="^(draft|active)$")
    categories: Optional[List[str]] = None
    content_rating: Optional[str] = Field(None, pattern="^(sfw|adult)$")


class CharacterCreatedResponse(BaseModel):
    """Response after creating a character."""

    id: UUID
    slug: str
    name: str
    status: str
    message: str


# =============================================================================
# Chat-Ready Validation (canonical, used everywhere)
# =============================================================================

class ActivationError:
    """Represents a validation error for character activation."""

    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message

    def __str__(self) -> str:
        return f"{self.field}: {self.message}"


def validate_chat_ready(character: dict) -> List[ActivationError]:
    """Canonical validation for character activation (draft -> active).

    Use this single function everywhere:
    - POST /activate endpoint
    - Listing "available to chat" characters
    - Bulk generation activation
    - Any future activation flows

    Returns list of errors. Empty list = valid for activation.

    HARD REQUIREMENTS (Phase 4.1):
    - Must have active_avatar_kit_id (avatar kit exists)
    - Must have avatar_url (derived from primary anchor)
    - Typed/arbitrary avatar URLs do not satisfy activation - they must come
      from a generated or uploaded anchor_portrait asset.
    """
    errors: List[ActivationError] = []

    # Required core fields
    if not character.get("name"):
        errors.append(ActivationError("name", "required"))
    if not character.get("slug"):
        errors.append(ActivationError("slug", "required"))
    if not character.get("archetype"):
        errors.append(ActivationError("archetype", "required"))

    # Personality must exist and be non-empty
    personality = character.get("baseline_personality")
    if not personality or not isinstance(personality, dict) or len(personality) == 0:
        errors.append(ActivationError("baseline_personality", "required and must be non-empty"))

    # Boundaries must exist
    boundaries = character.get("boundaries")
    if not boundaries or not isinstance(boundaries, dict):
        errors.append(ActivationError("boundaries", "required"))

    # Opening beat required
    if not character.get("opening_situation"):
        errors.append(ActivationError("opening_situation", "required for chat ignition"))
    if not character.get("opening_line"):
        errors.append(ActivationError("opening_line", "required for chat ignition"))

    # HARD Avatar Requirement (Phase 4.1):
    # Character must have an avatar kit with a primary anchor.
    # The avatar_url is a convenience mirror, but active_avatar_kit_id is the authority.
    if not character.get("active_avatar_kit_id"):
        errors.append(ActivationError(
            "active_avatar_kit_id",
            "required - generate a hero avatar first"
        ))
    # Also require avatar_url as the display cache
    if not character.get("avatar_url"):
        errors.append(ActivationError("avatar_url", "required for activation"))

    # System prompt must exist
    if not character.get("system_prompt"):
        errors.append(ActivationError("system_prompt", "required (should be auto-generated)"))

    # Content rating validation
    content_rating = character.get("content_rating", "sfw")
    if content_rating not in ("sfw", "adult"):
        errors.append(ActivationError("content_rating", "must be 'sfw' or 'adult'"))

    return errors


async def validate_chat_ready_full(character: dict, db) -> List[ActivationError]:
    """Full validation including database checks for avatar kit integrity.

    This is the HARD validation that checks:
    1. active_avatar_kit_id exists
    2. The referenced avatar_kit has primary_anchor_id set
    3. The primary anchor is asset_type='anchor_portrait'

    Use this for the final activation check. The simpler validate_chat_ready()
    can be used for quick UI feedback.
    """
    # Start with basic validation
    errors = validate_chat_ready(character)

    # If basic validation failed, return early
    if errors:
        return errors

    # Full avatar kit integrity check
    kit_id = character.get("active_avatar_kit_id")
    if kit_id:
        kit_data = await db.fetch_one(
            """SELECT ak.id, ak.primary_anchor_id, ak.status,
                      aa.asset_type
               FROM avatar_kits ak
               LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id
               WHERE ak.id = :kit_id""",
            {"kit_id": str(kit_id)}
        )

        if not kit_data:
            errors.append(ActivationError(
                "active_avatar_kit_id",
                "avatar kit not found - regenerate hero avatar"
            ))
        elif not kit_data["primary_anchor_id"]:
            errors.append(ActivationError(
                "primary_anchor_id",
                "no hero avatar set - generate hero avatar first"
            ))
        elif kit_data["asset_type"] != "anchor_portrait":
            errors.append(ActivationError(
                "primary_anchor_id",
                "primary anchor must be an anchor_portrait asset"
            ))
        elif kit_data["status"] != "active":
            # Auto-fix: activate the kit if it's in draft
            pass  # We allow draft kits for now, just need the anchor

    return errors


def is_chat_ready(character: dict) -> bool:
    """Quick check if character can be activated."""
    return len(validate_chat_ready(character)) == 0
