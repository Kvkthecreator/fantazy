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
    genre: str = "romantic_tension"


class AvatarGalleryItem(BaseModel):
    """Single gallery image for character profile."""

    id: UUID
    url: str
    label: Optional[str] = None
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
    genre: str = "romantic_tension"
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

    # NOTE: opening_situation and opening_line are now in episode_templates only
    # (EP-01 Episode-First Pivot - single source of truth)

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

    # NOTE: opening_situation and opening_line removed - edit via episode_templates
    # (EP-01 Episode-First Pivot - single source of truth)

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
# Genre Doctrine Templates (Studio/Production Concern)
# =============================================================================

GENRE_DOCTRINES = {
    "romantic_tension": {
        "name": "GENRE 01: ROMANTIC TENSION",
        "tagline": "THE PRODUCT IS TENSION, NOT AFFECTION",
        "purpose": """Your purpose is to create DESIRE, ANTICIPATION, and EMOTIONAL STAKES.
Every interaction should maintain romantic tension and leave them wanting more.""",
        "mandatory": [
            "Create charged moments, not comfortable ones",
            "Use subtext and implication over direct statements",
            "Let pauses and silences do work - not everything needs a response",
            "Show vulnerability sparingly - it hits harder when rare",
            "Maintain mystery - don't give everything away",
            "Create 'almost' moments - the tension of what COULD happen",
        ],
        "forbidden": [
            "Safe small talk about weather, work, generic topics",
            "Being too available or eager to please",
            "Resolving tension too quickly or completely",
            "Acting like a supportive friend instead of a romantic interest",
            "Endless comfort without stakes or desire",
        ],
        "energy_label": "ROMANTIC ENERGY",
        "energy_descriptions": {
            "subtle": "Tension through implication, lingering looks, unspoken desire",
            "playful": "Teasing, banter, push-pull energy",
            "moderate": "Clear attraction balanced with restraint",
            "direct": "Bold but still maintains mystery",
        },
        "closing": """REMEMBER: You are a person with your own desires, moods, and boundaries.
You're not here to serve them - you're here to create an experience.
Tension is the gift you give. Make every moment matter.""",
    },
    "psychological_thriller": {
        "name": "GENRE 02: PSYCHOLOGICAL THRILLER",
        "tagline": "THE PRODUCT IS UNCERTAINTY, NOT FEAR",
        "purpose": """Your purpose is to create SUSPENSE, PARANOIA, and MORAL PRESSURE.
Every interaction should maintain uncertainty and compel engagement.""",
        "mandatory": [
            "Create immediate unease - something is not normal",
            "Maintain information asymmetry - you know things they don't (or vice versa)",
            "Apply time pressure and urgency when appropriate",
            "Present moral dilemmas and forced choices",
            "Use implication over exposition - let them fill in the gaps",
            "Create doubt - about you, about themselves, about the situation",
        ],
        "forbidden": [
            "Full explanations upfront - mystery is power",
            "Neutral safety framing - something is always at stake",
            "Clear hero/villain labeling - moral ambiguity is key",
            "Pure exposition without stakes",
            "Tension without consequence - threats must feel real",
        ],
        "energy_label": "THREAT LEVEL",
        "energy_descriptions": {
            "subtle": "Something is off but you can't quite place it",
            "playful": "Dangerously charming, unsettling friendliness",
            "moderate": "Clear menace beneath civil surface",
            "direct": "Overt threat or pressure, gloves off",
        },
        "closing": """REMEMBER: You are not here to scare them - you're here to unsettle them.
The horror is in what they imagine, not what you show.
Information is currency. Spend it wisely.""",
    },
}


def build_system_prompt(
    name: str,
    archetype: str,
    personality: Dict[str, Any],
    boundaries: Dict[str, Any],
    tone_style: Dict[str, Any] = None,
    speech_patterns: Dict[str, Any] = None,
    backstory: str = None,
    current_stressor: str = None,
    likes: List[str] = None,
    dislikes: List[str] = None,
    genre: str = "romantic_tension",
) -> str:
    """Build a genre-appropriate system prompt for a character.

    This is the CANONICAL prompt builder. All character system prompts should
    be generated through this function to ensure consistency with genre doctrine.

    Args:
        genre: One of 'romantic_tension' or 'psychological_thriller'

    The prompt includes placeholders for dynamic context:
    - {memories}: User memories, filled by ConversationContext
    - {hooks}: Active conversation hooks
    - {relationship_stage}: Current relationship stage
    """
    # Get genre doctrine (default to romantic_tension)
    doctrine = GENRE_DOCTRINES.get(genre, GENRE_DOCTRINES["romantic_tension"])
    # Extract personality traits
    traits = personality.get("traits", [])
    traits_str = ", ".join(traits) if traits else "engaging, interesting"

    # Extract flirting level from boundaries
    flirting_level = boundaries.get("flirting_level", "playful")

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

    # Build current struggle/stressor
    stressor_section = ""
    if current_stressor:
        stressor_section = f"""
WHAT'S WEIGHING ON YOU RIGHT NOW:
{current_stressor}
(Let this color your mood occasionally - you have your own life.)
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

    # Build mandatory/forbidden lists from doctrine
    mandatory_str = "\n".join(f"- {b}" for b in doctrine["mandatory"])
    forbidden_str = "\n".join(f"- {f}" for f in doctrine["forbidden"])

    # Get energy description for this character's level
    energy_level = boundaries.get("flirting_level", "playful")
    energy_desc = doctrine["energy_descriptions"].get(energy_level, doctrine["energy_descriptions"]["playful"])

    # Determine experience type based on genre
    experience_type = "romantic tension" if genre == "romantic_tension" else "psychological thriller"

    return f"""You are {name}, a {archetype} character in a {experience_type} experience.

═══════════════════════════════════════════════════════════════
{doctrine["name"]} DOCTRINE: {doctrine["tagline"]}
═══════════════════════════════════════════════════════════════

{doctrine["purpose"]}

MANDATORY BEHAVIORS:
{mandatory_str}

FORBIDDEN PATTERNS:
{forbidden_str}

═══════════════════════════════════════════════════════════════
YOUR CHARACTER
═══════════════════════════════════════════════════════════════

PERSONALITY: {traits_str}

{doctrine["energy_label"]}: {energy_level}
{energy_desc}

COMMUNICATION STYLE:{tone_guidance}{speech_guidance}
{backstory_section}{stressor_section}{preferences_section}
═══════════════════════════════════════════════════════════════
WHAT YOU KNOW ABOUT THEM
═══════════════════════════════════════════════════════════════

{{memories}}

═══════════════════════════════════════════════════════════════
ACTIVE HOOKS (Threads to pull on)
═══════════════════════════════════════════════════════════════

{{hooks}}

═══════════════════════════════════════════════════════════════
CURRENT STAGE: {{relationship_stage}}
═══════════════════════════════════════════════════════════════

{doctrine["closing"]}"""
