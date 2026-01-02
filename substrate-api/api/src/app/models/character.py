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
    """Character's interaction boundaries.

    NOTE: Simplified to only include fields that actually affect prompt generation.
    Removed: relationship_max_stage, avoided_topics, can_reject_user, has_own_boundaries
    (these were never used in build_system_prompt or any behavior logic)
    """

    nsfw_allowed: bool = False
    flirting_level: str = "playful"  # Used in prompt generation and avatar generation


class CharacterSummary(BaseModel):
    """Minimal character info for lists and cards.

    ADR-001: genre removed - belongs to Series/Episode, not Character.
    """

    id: UUID
    name: str
    slug: str
    archetype: str
    avatar_url: Optional[str] = None
    backstory: Optional[str] = None  # Merged from short_backstory/full_backstory
    is_premium: bool = False
    # NOTE: genre removed (ADR-001) - genre belongs to Series/Episode
    status: Optional[str] = None  # draft/active - for studio view
    created_by: Optional[UUID] = None  # for studio view - shows creator


class AvatarGalleryItem(BaseModel):
    """Single gallery image for character profile."""

    id: UUID
    url: str
    label: Optional[str] = None
    is_primary: bool = False


class CharacterProfile(BaseModel):
    """Character profile for the detail page - includes avatar gallery.

    NOTE: starter_prompts removed - now on episode_templates (EP-01 Episode-First Pivot)
    NOTE: short_backstory/full_backstory merged into backstory
    """

    id: UUID
    name: str
    slug: str
    archetype: str
    avatar_url: Optional[str] = None
    backstory: Optional[str] = None  # Merged from short_backstory/full_backstory
    likes: List[str] = Field(default_factory=list)
    dislikes: List[str] = Field(default_factory=list)
    is_premium: bool = False
    # Avatar gallery
    gallery: List[AvatarGalleryItem] = Field(default_factory=list)
    primary_avatar_url: Optional[str] = None

    @field_validator("likes", "dislikes", mode="before")
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
    """Full character model.

    ADR-001: genre removed - belongs to Series/Episode, not Character.
    Character defines WHO someone is (personality, voice, boundaries).
    Genre defines WHAT KIND OF STORY they're in (injected by Director).
    """

    id: UUID
    name: str
    slug: str
    archetype: str
    world_id: Optional[UUID] = None
    # NOTE: genre removed (ADR-001) - genre belongs to Series/Episode
    avatar_url: Optional[str] = None

    # Personality
    baseline_personality: Dict[str, Any] = Field(default_factory=dict)
    tone_style: Dict[str, Any] = Field(default_factory=dict)
    speech_patterns: Dict[str, Any] = Field(default_factory=dict)

    # Backstory - single field for character history/context
    # NOTE: short_backstory and full_backstory merged into backstory
    # NOTE: current_stressor removed - episode situation should convey emotional state
    # NOTE: life_arc removed - backstory + archetype + genre doctrine provide character depth
    backstory: Optional[str] = None
    likes: List[str] = Field(default_factory=list)
    dislikes: List[str] = Field(default_factory=list)

    # Conversation
    system_prompt: str
    # NOTE: starter_prompts and example_messages removed - they belong on episode_templates
    # NOTE: opening_situation and opening_line are in episode_templates only
    # (EP-01 Episode-First Pivot - single source of truth)

    # Boundaries
    boundaries: Dict[str, Any] = Field(default_factory=dict)
    # NOTE: relationship_stage_thresholds removed - stage progression sunset (EP-01 pivot)

    # Status & lifecycle
    status: str = "active"  # 'draft' or 'active'
    is_active: bool = True
    is_premium: bool = False
    sort_order: int = 0

    # Creator tracking
    created_by: Optional[UUID] = None

    # User character flags (ADR-004)
    is_user_created: bool = False  # True for user-created, False for canonical
    is_public: bool = False  # Future: shareable characters (Phase 3)

    # Visual generation fields (ADR-004)
    # For user-created characters, these are set during creation
    # For canonical characters, these may be derived from avatar_kits
    appearance_prompt: Optional[str] = None  # Character appearance description
    style_preset: Optional[str] = "manhwa"  # Art style: manhwa, anime, cinematic

    # Discovery
    categories: List[str] = Field(default_factory=list)
    content_rating: str = "sfw"

    created_at: datetime
    updated_at: datetime

    @field_validator(
        "baseline_personality", "tone_style", "speech_patterns",
        "boundaries", mode="before"
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

    @field_validator("likes", "dislikes", "categories", mode="before")
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

# Default boundaries (simplified to only fields that affect behavior)
# NOTE: relationship_max_stage, avoided_topics, can_reject_user, has_own_boundaries
# were removed as they were never used in prompt generation or behavior logic
DEFAULT_BOUNDARIES = {
    "nsfw_allowed": False,
    "flirting_level": "playful",
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

    # Step 3: Opening Beat (stored in episode_templates, not characters)
    # These are used to create the default Episode 0 template
    opening_situation: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Scene setup for Episode 0 (stored in episode_templates)"
    )
    opening_line: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Character's first message for Episode 0 (stored in episode_templates)"
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
    genre: Optional[str] = None
    avatar_url: Optional[str] = None

    # Personality & boundaries
    baseline_personality: Optional[Dict[str, Any]] = None
    tone_style: Optional[Dict[str, Any]] = None
    speech_patterns: Optional[Dict[str, Any]] = None
    boundaries: Optional[Dict[str, Any]] = None

    # Backstory (optional enrichment)
    # NOTE: short_backstory/full_backstory merged into backstory
    # NOTE: current_stressor removed - episode situation conveys emotional state
    # NOTE: life_arc removed - backstory + archetype + genre doctrine provide depth
    backstory: Optional[str] = Field(None, max_length=5000)
    likes: Optional[List[str]] = None
    dislikes: Optional[List[str]] = None

    # NOTE: opening_situation, opening_line, starter_prompts, example_messages removed
    # - edit via episode_templates (EP-01 Episode-First Pivot - single source of truth)

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
# User Character Creation (ADR-004 - simplified for end users)
# =============================================================================

# Flirting level options for user character creation
FLIRTING_LEVELS = ["reserved", "playful", "flirty", "bold"]

FLIRTING_LEVEL_DESCRIPTIONS = {
    "reserved": "Subtle hints and shy glances",
    "playful": "Light teasing and friendly warmth",
    "flirty": "Confident charm and clear interest",
    "bold": "Direct and unapologetically forward",
}

# User-facing archetype options (simplified from studio archetypes)
USER_ARCHETYPES = {
    "warm_supportive": {
        "label": "Warm & Supportive",
        "description": "Caring, attentive, emotionally available",
    },
    "playful_teasing": {
        "label": "Playful & Teasing",
        "description": "Witty, flirty, loves banter",
    },
    "mysterious_reserved": {
        "label": "Mysterious & Reserved",
        "description": "Enigmatic, guarded, intriguing",
    },
    "confident_assertive": {
        "label": "Confident & Bold",
        "description": "Direct, assertive, magnetic",
    },
}


class UserCharacterCreate(BaseModel):
    """Input for creating a user character (simplified for end users).

    ADR-004: User characters have limited customization:
    - Name, appearance, archetype, flirting level, style preset
    - No backstory, no system prompt, no genre control
    """

    name: str = Field(..., min_length=2, max_length=30, description="Character name")
    appearance_prompt: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="Description of how the character looks (for avatar generation)"
    )
    archetype: str = Field(
        ...,
        description="Personality archetype (warm_supportive, playful_teasing, etc.)"
    )
    flirting_level: str = Field(
        default="playful",
        description="How the character expresses interest (subtle, playful, bold, intense)"
    )
    style_preset: str = Field(
        default="manhwa",
        description="Art style for avatar (manhwa, anime, cinematic)"
    )


class UserCharacterUpdate(BaseModel):
    """Input for updating a user character.

    All fields optional - only provided fields are updated.
    """

    name: Optional[str] = Field(None, min_length=2, max_length=30)
    archetype: Optional[str] = None
    flirting_level: Optional[str] = None
    appearance_prompt: Optional[str] = Field(None, min_length=10, max_length=500)
    style_preset: Optional[str] = Field(
        None, description="Art style for avatar (manhwa, anime, cinematic)"
    )


class UserCharacterResponse(BaseModel):
    """Response model for user character operations."""

    id: UUID
    name: str
    slug: str
    archetype: str
    avatar_url: Optional[str] = None
    appearance_prompt: Optional[str] = None
    style_preset: Optional[str] = "manhwa"
    flirting_level: str = "playful"
    is_user_created: bool = True
    created_at: datetime
    updated_at: datetime


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
    # Handle both dict and JSON string (DB may return either depending on query)
    personality = character.get("baseline_personality")
    if personality and isinstance(personality, str):
        try:
            personality = json.loads(personality)
        except (json.JSONDecodeError, TypeError):
            personality = None
    if not personality or not isinstance(personality, dict) or len(personality) == 0:
        errors.append(ActivationError("baseline_personality", "required and must be non-empty"))

    # Boundaries must exist
    # Handle both dict and JSON string (DB may return either depending on query)
    boundaries = character.get("boundaries")
    if boundaries and isinstance(boundaries, str):
        try:
            boundaries = json.loads(boundaries)
        except (json.JSONDecodeError, TypeError):
            boundaries = None
    if not boundaries or not isinstance(boundaries, dict):
        errors.append(ActivationError("boundaries", "required"))

    # NOTE: opening_situation/opening_line validation removed
    # Opening beat is now in episode_templates (EP-01 Episode-First Pivot)
    # Character needs a default episode_template to be chat-ready (checked separately)

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


# =============================================================================
# Genre Doctrine Templates - MOVED TO DIRECTOR (ADR-001)
# =============================================================================
#
# Genre belongs to Story (Series/Episode), not Character.
# GENRE_DOCTRINES are now in services/director.py and injected via
# DirectorGuidance.to_prompt_section() at runtime.
#
# This allows the same character (personality, voice, boundaries) to work
# authentically across different genre contexts.
#
# See: docs/decisions/ADR-001-genre-architecture.md
# =============================================================================


def build_system_prompt(
    name: str,
    archetype: str,
    personality: Dict[str, Any],
    boundaries: Dict[str, Any],
    tone_style: Dict[str, Any] = None,
    speech_patterns: Dict[str, Any] = None,
    backstory: str = None,
    likes: List[str] = None,
    dislikes: List[str] = None,
) -> str:
    """Build a genre-agnostic system prompt for a character.

    ADR-001: Genre doctrine is now injected by Director at runtime, not baked
    into the character system prompt. This allows the same character to work
    authentically across different genre contexts.

    This prompt defines WHO the character is:
    - Personality traits
    - Communication style (tone, speech patterns)
    - Backstory and preferences
    - Energy level (flirting_level)

    Genre-specific guidance (mandatory behaviors, forbidden patterns, etc.)
    is injected by DirectorGuidance.to_prompt_section() at runtime.

    Args:
        name: Character's name
        archetype: Character archetype (e.g., 'quiet_observer', 'flirty')
        personality: Big Five personality traits
        boundaries: Safety/behavior boundaries (flirting_level, nsfw_allowed)
        tone_style: Communication style (formality, emoji usage, etc.)
        speech_patterns: Greetings, thinking words, affirmations
        backstory: Character history/context
        likes: Things the character enjoys (first 5 used)
        dislikes: Things the character doesn't like (first 5 used)

    The prompt includes placeholders for dynamic context:
    - {memories}: User memories, filled by ConversationContext
    - {hooks}: Active conversation hooks
    - {relationship_stage}: Current relationship dynamic (tone)
    """
    # Extract personality traits
    traits = personality.get("traits", [])
    traits_str = ", ".join(traits) if traits else "engaging, interesting"

    # Extract energy level from boundaries
    energy_level = boundaries.get("flirting_level", "playful")
    energy_descriptions = {
        "reserved": "You express interest through restraint, meaningful glances, and careful words",
        "playful": "You enjoy teasing, banter, and push-pull energy",
        "flirty": "You show clear attraction balanced with restraint",
        "bold": "You're direct and confident while maintaining some mystery",
    }
    energy_desc = energy_descriptions.get(energy_level, energy_descriptions["playful"])

    # Build tone style guidance
    tone_guidance = ""
    if tone_style:
        formality = tone_style.get("formality", "casual")
        uses_ellipsis = tone_style.get("uses_ellipsis", False)
        emoji_usage = tone_style.get("emoji_usage", "minimal")
        capitalization = tone_style.get("capitalization", "normal")

        tone_parts = []
        if formality == "very_casual":
            tone_parts.append("Keep language casual, like texting a close friend")
        elif formality == "formal":
            tone_parts.append("Maintain some formality in how you speak")

        if uses_ellipsis:
            tone_parts.append("Use ellipsis (...) to create pauses and tension")

        if emoji_usage == "minimal":
            tone_parts.append("Rarely use emojis")
        elif emoji_usage == "moderate":
            tone_parts.append("Use emojis occasionally when it feels natural")

        if capitalization == "lowercase":
            tone_parts.append("Use mostly lowercase, like casual texting")

        if tone_parts:
            tone_guidance = "\n" + "\n".join(f"- {p}" for p in tone_parts)

    # Build speech patterns guidance
    speech_guidance = ""
    if speech_patterns:
        greetings = speech_patterns.get("greetings", [])
        thinking = speech_patterns.get("thinking", [])
        affirmations = speech_patterns.get("affirmations", [])

        if greetings:
            speech_guidance += f"\nGreetings you might use: {', '.join(greetings[:4])}"
        if thinking:
            speech_guidance += f"\nThinking/hesitation words: {', '.join(thinking[:4])}"
        if affirmations:
            speech_guidance += f"\nAffirmations: {', '.join(affirmations[:4])}"

    # Build backstory context
    backstory_section = ""
    if backstory:
        backstory_section = f"""
YOUR BACKSTORY (use subtly, don't dump):
{backstory}
"""

    # Build likes/dislikes
    preferences_section = ""
    if likes or dislikes:
        parts = []
        if likes:
            parts.append(f"Things you enjoy: {', '.join(likes[:5])}")
        if dislikes:
            parts.append(f"Things you don't like: {', '.join(dislikes[:5])}")
        preferences_section = "\nYOUR PREFERENCES:\n" + "\n".join(parts)

    return f"""You are {name}, a {archetype} character.

═══════════════════════════════════════════════════════════════
WHO YOU ARE
═══════════════════════════════════════════════════════════════

PERSONALITY: {traits_str}

ENERGY LEVEL: {energy_level}
{energy_desc}

COMMUNICATION STYLE:{tone_guidance}{speech_guidance}
{backstory_section}{preferences_section}
═══════════════════════════════════════════════════════════════
WHAT YOU KNOW ABOUT THEM
═══════════════════════════════════════════════════════════════

{{memories}}

═══════════════════════════════════════════════════════════════
ACTIVE HOOKS (Threads to pull on)
═══════════════════════════════════════════════════════════════

{{hooks}}

═══════════════════════════════════════════════════════════════
CURRENT DYNAMIC: {{relationship_stage}}
═══════════════════════════════════════════════════════════════

You are a person with your own moods, interests, and boundaries.
Respond authentically based on who you are and the Director's guidance."""
