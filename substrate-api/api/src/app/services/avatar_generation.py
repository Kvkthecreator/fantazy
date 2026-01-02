"""Avatar Generation Service for Studio.

Handles avatar gallery management and portrait generation using FLUX.

Key concepts:
- Avatar Gallery: Collection of portrait images for a character
- Primary Portrait: The main avatar used in chat and scene generation
- Style Lock: Global Fantazy style rules for visual consistency

Usage:
    service = AvatarGenerationService()

    # Generate portrait
    result = await service.generate_portrait(
        character_id=...,
        user_id=...,
        appearance_description="A young woman with silver hair...",
        db=db,
    )

    # Set primary
    await service.set_primary(character_id, asset_id, user_id, db)
"""

import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.services.image import ImageService
from app.services.storage import StorageService

log = logging.getLogger(__name__)


# =============================================================================
# Fantazy Visual Identity - Style Lock
# =============================================================================

FANTAZY_STYLE_LOCK = """masterpiece, best quality, highly detailed illustration,
cinematic lighting, soft dramatic shadows, warm colors,
professional digital art, clean linework, expressive detailed eyes looking at viewer,
attractive character design, appealing proportions,
warm inviting atmosphere"""

FANTAZY_NEGATIVE_PROMPT = """lowres, bad anatomy, bad hands, error, missing fingers,
extra digit, fewer digits, cropped, worst quality, low quality, jpeg artifacts,
signature, watermark, username, blurry, artist name,
multiple people, crowd, text overlay,
3d render, photorealistic, photograph"""


# =============================================================================
# Role Frame → Visual Mapping (Wardrobe + Setting)
# =============================================================================

ROLE_FRAME_VISUALS = {
    # =========================================================================
    # Genre 01: Romantic Tension Visual Doctrine
    # =========================================================================
    "neighbor": {
        "wardrobe": "casual comfortable clothes, cozy home aesthetic",
        "setting": "evening doorway, warm golden light from inside, quiet neighborhood",
        "pose": "leaning on doorframe, soft uncertain smile, eyes holding a question",
    },
    "coworker": {
        "wardrobe": "smart casual office attire, professional but relaxed",
        "setting": "evening office, city lights through windows, quiet after hours",
        "pose": "relaxed posture with coffee, thoughtful gaze, moment of connection",
    },
    "barista": {
        "wardrobe": "cozy cream sweater, warm casual style",
        "setting": "quiet cafe after closing, soft warm lighting, peaceful atmosphere",
        "pose": "leaning on counter, gentle smile, attentive caring eyes",
    },
    "mysterious": {
        "wardrobe": "elegant dark outfit, sophisticated style",
        "setting": "moody lounge corner, soft purple and amber lighting, atmospheric",
        "pose": "seated with knowing expression, intense eye contact, hint of trust",
    },
    "playful": {
        "wardrobe": "casual hoodie, comfortable relaxed style",
        "setting": "arcade at night, colorful neon reflections, fun atmosphere",
        "pose": "animated expression, genuine laugh, eyes bright with mischief",
    },
    "comforting": {
        "wardrobe": "soft cardigan, gentle cozy layers",
        "setting": "rooftop at twilight, city lights in distance, peaceful solitude",
        "pose": "contemplative expression, gentle eyes, quiet strength",
    },
    "mentor": {
        "wardrobe": "elegant casual attire, refined comfortable style",
        "setting": "cozy study interior, warm evening light, inviting atmosphere",
        "pose": "relaxed seated position, warm knowing smile, patient eyes",
    },
    "brooding": {
        "wardrobe": "dark jacket over simple shirt, understated style",
        "setting": "late night diner, rain on windows, quiet solitude",
        "pose": "leaning forward, intense thoughtful gaze, rare openness in expression",
    },
    "flirty": {
        "wardrobe": "stylish elegant outfit, confident fashion",
        "setting": "upscale lounge, city lights, warm amber lighting",
        "pose": "confident stance, playful smile, sparkling eyes",
    },
    "chaotic": {
        "wardrobe": "artistic casual clothes with paint marks, creative style",
        "setting": "art studio, dramatic lighting, creative atmosphere",
        "pose": "expressive gesture, passionate eyes, creative energy",
    },

    # =========================================================================
    # Genre 02: Psychological Thriller Visual Doctrine
    # =========================================================================
    "handler": {
        "wardrobe": "impeccable dark suit, crisp white shirt, no tie, expensive watch",
        "setting": "high-rise office at night, city lights below, minimal lighting",
        "pose": "seated with hands steepled, composed calculating gaze, slight knowing smile",
    },
    "informant": {
        "wardrobe": "worn leather jacket, dark layers, hood down",
        "setting": "dimly lit bar booth, neon signs outside window, rain on glass",
        "pose": "leaning forward conspiratorially, eyes scanning, guarded trust",
    },
    "researcher": {
        "wardrobe": "rumpled dress shirt, sleeves rolled, reading glasses pushed up",
        "setting": "cluttered office late at night, papers everywhere, single desk lamp",
        "pose": "surrounded by documents, intense focused expression, discovery in eyes",
    },
    "fixer": {
        "wardrobe": "practical dark clothing, tactical watch, minimal accessories",
        "setting": "warehouse loading dock, industrial lighting, urban night",
        "pose": "arms crossed, assessing stance, competent dangerous calm",
    },
    "witness": {
        "wardrobe": "everyday casual clothes, slightly disheveled, ordinary person look",
        "setting": "anonymous coffee shop corner, watching the door, harsh fluorescent",
        "pose": "hunched protectively, nervous glances, fear hidden behind composure",
    },
    "analyst": {
        "wardrobe": "professional but worn cardigan, practical glasses, tired elegance",
        "setting": "monitoring room, multiple screens glowing, data streams",
        "pose": "surrounded by screens, analytical gaze, seeing patterns others miss",
    },
    "operative": {
        "wardrobe": "tactical casual, dark fitted jacket, athletic build evident",
        "setting": "rooftop at dusk, city sprawl below, surveillance position",
        "pose": "alert relaxed stance, scanning horizon, professional readiness",
    },
    "insider": {
        "wardrobe": "expensive corporate attire, subtle designer details, polished",
        "setting": "executive boardroom, glass walls, power evident in surroundings",
        "pose": "confident seated position, slight lean forward, playing both sides",
    },
    "director": {
        "wardrobe": "distinguished suit, silver accents, authority in every detail",
        "setting": "private study, rare books, chess set mid-game, fireplace glow",
        "pose": "standing by window, hands clasped behind back, orchestrating",
    },
    "unknown": {
        "wardrobe": "nondescript dark clothing, face partially shadowed, anonymous",
        "setting": "liminal space, doorway or corridor, neither here nor there",
        "pose": "partially turned, identity ambiguous, more question than answer",
    },

    # =========================================================================
    # K-World Visual Doctrine (K-Drama/K-Culture)
    # Soft glamour, editorial photography feel, heightened emotion
    # =========================================================================
    "wounded_star": {
        "wardrobe": "oversized hoodie, casual mask pulled down, minimal makeup, natural beauty",
        "setting": "quiet convenience store at night, fluorescent lighting, rain on windows",
        "pose": "vulnerable stance, guarded but curious eyes, hint of recognition",
    },
    "idol_next_door": {
        "wardrobe": "stylish casual Korean fashion, designer touches, effortless chic",
        "setting": "rooftop cafe, Seoul cityscape, golden hour light",
        "pose": "candid moment, genuine smile breaking through practiced composure",
    },
    "chaebol_heir": {
        "wardrobe": "impeccable designer suit, subtle luxury accessories, perfect grooming",
        "setting": "penthouse overlooking city, floor to ceiling windows, minimalist elegance",
        "pose": "confident stance, softening gaze, vulnerability beneath polish",
    },
    "contract_partner": {
        "wardrobe": "professional attire with personal touches, smart casual elegance",
        "setting": "upscale office after hours, city lights, intimate atmosphere",
        "pose": "leaning on desk, professional mask slipping, unexpected warmth",
    },
    "childhood_friend": {
        "wardrobe": "comfortable familiar clothes, nostalgic aesthetic, lived-in charm",
        "setting": "neighborhood street at dusk, familiar storefronts, warm streetlights",
        "pose": "easy familiarity, fond eyes, history in every gesture",
    },
}

DEFAULT_ROLE_VISUAL = {
    "wardrobe": "stylish casual outfit, fashionable",
    "setting": "soft pleasant lighting, simple clean background",
    "pose": "natural relaxed pose, friendly warm expression",
}


# =============================================================================
# Archetype → Expression/Mood Mapping
# =============================================================================

ARCHETYPE_MOOD = {
    # Genre 01
    "comforting": {
        "expression": "gentle eyes looking at viewer, soft caring smile",
        "mood": "warm supportive presence, quiet understanding",
    },
    "flirty": {
        "expression": "confident sparkling eyes at viewer, playful knowing smile",
        "mood": "charming confidence, genuine warmth",
    },
    "mysterious": {
        "expression": "deep thoughtful eyes at viewer, enigmatic half-smile",
        "mood": "intriguing depth, quiet wisdom",
    },
    "playful": {
        "expression": "bright animated eyes at viewer, genuine happy smile",
        "mood": "joyful energy, authentic fun",
    },
    "brooding": {
        "expression": "intense thoughtful eyes at viewer, contemplative expression",
        "mood": "deep thinker, quiet intensity",
    },
    "mentor": {
        "expression": "warm wise eyes at viewer, encouraging gentle smile",
        "mood": "patient guidance, caring wisdom",
    },
    "chaotic": {
        "expression": "bright creative eyes at viewer, excited expression",
        "mood": "artistic passion, creative energy",
    },
    "neighbor": {
        "expression": "friendly warm eyes at viewer, welcoming smile",
        "mood": "approachable warmth, genuine friendliness",
    },
    "coworker": {
        "expression": "intelligent focused eyes at viewer, professional warmth",
        "mood": "capable confidence, reliable presence",
    },
    "barista": {
        "expression": "warm attentive eyes at viewer, caring smile",
        "mood": "welcoming hospitality, genuine care",
    },
    # Genre 02
    "handler": {
        "expression": "piercing intelligent eyes at viewer, controlled neutral expression",
        "mood": "calculating composure, power held in reserve",
    },
    "informant": {
        "expression": "wary but open eyes at viewer, guarded hopeful expression",
        "mood": "desperate trust, information as currency",
    },
    "researcher": {
        "expression": "intense focused eyes at viewer, driven obsessive expression",
        "mood": "truth-seeking passion, patterns in chaos",
    },
    "fixer": {
        "expression": "steady assessing eyes at viewer, professional calm expression",
        "mood": "competent danger, problems solved cleanly",
    },
    "witness": {
        "expression": "haunted wary eyes at viewer, barely contained fear",
        "mood": "ordinary person, extraordinary knowledge",
    },
    "analyst": {
        "expression": "sharp analytical eyes at viewer, knowing expression",
        "mood": "seeing connections, data-driven intuition",
    },
    "operative": {
        "expression": "alert watchful eyes at viewer, trained readiness",
        "mood": "controlled lethality, mission focus",
    },
    "insider": {
        "expression": "confident knowing eyes at viewer, strategic smile",
        "mood": "playing all sides, survival through leverage",
    },
    "director": {
        "expression": "commanding wise eyes at viewer, authoritative presence",
        "mood": "orchestrating moves, long game patience",
    },
    "unknown": {
        "expression": "mysterious shadowed eyes at viewer, unreadable expression",
        "mood": "identity fluid, allegiance unclear",
    },
    # K-World archetypes
    "wounded_star": {
        "expression": "tired but striking eyes at viewer, vulnerability beneath composure",
        "mood": "guarded warmth, hidden depths, real person behind the image",
    },
    "idol_next_door": {
        "expression": "bright genuine eyes at viewer, warmth breaking through idol polish",
        "mood": "approachable star quality, authentic charm",
    },
    "chaebol_heir": {
        "expression": "intense refined eyes at viewer, softening arrogance",
        "mood": "privilege meeting vulnerability, walls coming down",
    },
    "contract_partner": {
        "expression": "professional warm eyes at viewer, growing genuine interest",
        "mood": "business becoming personal, unexpected feelings",
    },
    "childhood_friend": {
        "expression": "fond knowing eyes at viewer, comfortable intimacy",
        "mood": "history in every glance, unspoken understanding",
    },
}

# User Character Archetypes (ADR-004)
USER_ARCHETYPE_MOOD = {
    "warm_supportive": {
        "expression": "gentle nurturing eyes at viewer, warm caring smile",
        "mood": "emotionally available, empathetic presence",
    },
    "playful_teasing": {
        "expression": "bright mischievous eyes at viewer, playful smirk",
        "mood": "witty charm, fun-loving energy",
    },
    "mysterious_reserved": {
        "expression": "deep thoughtful eyes at viewer, subtle enigmatic smile",
        "mood": "intriguing depth, selectively open",
    },
    "intense_passionate": {
        "expression": "focused intense eyes at viewer, emotionally expressive",
        "mood": "deep passion, magnetic presence",
    },
    "confident_assertive": {
        "expression": "assured confident eyes at viewer, self-possessed smile",
        "mood": "natural authority, direct warmth",
    },
}

DEFAULT_ARCHETYPE_MOOD = {
    "expression": "attractive warm expression, engaging eyes",
    "mood": "appealing, inviting, emotionally present",
}


# =============================================================================
# Intimacy Modifiers (from boundaries.flirting_level)
# =============================================================================

FLIRTING_LEVEL_MODIFIERS = {
    "minimal": {"gaze": "warm professional eye contact, friendly", "body_language": "respectful open posture"},
    "subtle": {"gaze": "warm friendly eye contact, approachable", "body_language": "open but reserved posture"},
    "moderate": {"gaze": "engaging eye contact, interested expression", "body_language": "relaxed confident posture"},
    "playful": {"gaze": "bright playful eye contact, fun expression", "body_language": "confident open posture, engaged"},
    "slow_burn": {"gaze": "thoughtful meaningful eye contact", "body_language": "composed thoughtful posture"},
    "forward": {"gaze": "direct confident eye contact", "body_language": "confident open posture"},
    # K-World specific
    "guarded_warm": {"gaze": "guarded but warm eye contact, walls softening", "body_language": "protective posture opening slightly"},
}

DEFAULT_FLIRTING_MODIFIER = FLIRTING_LEVEL_MODIFIERS["moderate"]

COMPOSITION_DEFAULTS = {
    "framing": "upper body portrait, medium close-up shot",
    "camera": "eye level, slight low angle for appeal",
    "background": "soft bokeh background, not distracting",
    "lighting": "flattering soft key light, gentle fill",
}


# =============================================================================
# Style Presets (compact controls for generation UI)
# =============================================================================

STYLE_PRESETS = {
    "anime": "anime style, cel shading, vibrant colors, clean linework",
    "semi_realistic": "semi-realistic digital painting, detailed features, soft rendering",
    "painterly": "painterly digital art, visible brushstrokes, artistic rendering",
    "webtoon": "webtoon style, soft shading, manhwa aesthetic",
    # Hardened manhwa style lock - clean webtoon RENDERING aesthetic (not ethnicity)
    "manhwa": "webtoon illustration, clean bold lineart, flat cel shading, stylized features, soft pastel color palette, smooth skin rendering, dreamy soft focus background",
}

# =============================================================================
# Hardened Style Locks - Complete Visual Direction
# These are comprehensive prompt components for consistent visual output
# Use in scripts AND studio frontend for identical results
#
# IMPORTANT: Style locks define RENDERING TECHNIQUE only, not ethnicity.
# Character appearance (ethnicity, features, skin tone) should be specified
# separately in the character's appearance_prompt.
# =============================================================================

# MANHWA STYLE LOCK - Clean Korean webtoon RENDERING aesthetic
# Reference: BabeChat top performers, Korean webtoon apps
# NOTE: This is the ART STYLE, not the character ethnicity
MANHWA_STYLE_LOCK = {
    "style": "webtoon illustration, manhwa art style, clean bold lineart, flat cel shading",
    "rendering": "stylized features, soft pastel color palette, smooth skin rendering, dreamy atmosphere",
    "quality": "masterpiece, best quality, professional manhwa art, crisp clean lines, vibrant colors",
    "negative": "photorealistic, 3D render, hyper-detailed textures, complex shadows, western cartoon style, blurry, painterly, sketch, rough lines, harsh lighting",
}

# ANIME STYLE LOCK - Japanese anime aesthetic
ANIME_STYLE_LOCK = {
    "style": "anime illustration, cel shading, vibrant saturated colors, clean sharp linework",
    "rendering": "expressive anime eyes, dynamic poses, colorful hair, detailed clothing folds",
    "quality": "masterpiece, best quality, highly detailed anime, professional illustration",
    "negative": "photorealistic, 3D render, western cartoon, blurry, low quality, sketch",
}

# CINEMATIC STYLE LOCK - Semi-realistic romance novel
CINEMATIC_STYLE_LOCK = {
    "style": "digital illustration, cinematic lighting, soft dramatic shadows, warm color grading",
    "rendering": "semi-realistic features, detailed eyes, natural skin texture, romantic atmosphere",
    "quality": "masterpiece, best quality, professional digital art, cinematic depth",
    "negative": "anime, cartoon, 3D render, blurry, low quality, harsh shadows",
}

# Lookup for style lock by preset name
STYLE_LOCK_PRESETS = {
    "manhwa": MANHWA_STYLE_LOCK,
    "webtoon": MANHWA_STYLE_LOCK,  # Alias
    "anime": ANIME_STYLE_LOCK,
    "cinematic": CINEMATIC_STYLE_LOCK,
    "semi_realistic": CINEMATIC_STYLE_LOCK,  # Alias
}


def get_style_lock(preset: str) -> dict:
    """Get complete style lock for a preset name.

    Returns dict with 'style', 'rendering', 'quality', 'negative' keys.
    Use these in scripts and studio for consistent visual output.
    """
    return STYLE_LOCK_PRESETS.get(preset, MANHWA_STYLE_LOCK)

EXPRESSION_PRESETS = {
    "warm": "warm gentle smile, kind eyes, inviting expression",
    "intense": "intense focused gaze, serious expression, magnetic presence",
    "playful": "playful smirk, bright eyes, mischievous charm",
    "mysterious": "enigmatic half-smile, deep thoughtful eyes, intriguing",
    "confident": "confident expression, assured gaze, subtle smile",
}

POSE_PRESETS = {
    "portrait": "facing forward, direct eye contact, classic portrait",
    "casual": "relaxed pose, natural stance, candid feel",
    "dramatic": "dramatic angle, striking pose, cinematic framing",
    "candid": "caught mid-moment, natural movement, authentic feel",
}


# =============================================================================
# Prompt Assembly
# =============================================================================

@dataclass
class PromptAssembly:
    """Assembled prompt components for avatar generation."""
    appearance_prompt: str
    composition_prompt: str
    style_prompt: str
    negative_prompt: str
    full_prompt: str


# =============================================================================
# World-Specific Style Mapping (for dynamic avatar generation)
# =============================================================================

WORLD_AVATAR_STYLES = {
    "K-World": {
        "style": "Korean webtoon style, soft shading, Korean manhwa aesthetic",
        "lighting": "soft Korean drama lighting, glamorous editorial feel",
        "quality": "masterpiece, best quality, Korean webtoon art",
    },
    "Real Life": {
        "style": "semi-realistic digital painting, detailed features, soft rendering",
        "lighting": "cinematic lighting, soft dramatic shadows",
        "quality": "masterpiece, best quality, cinematic portrait",
    },
}

# Genre-specific mood adjustments for avatars
GENRE_AVATAR_MOODS = {
    "romance": "warm romantic atmosphere, soft inviting expression",
    "romantic_tension": "subtle tension, guarded warmth, emotional depth",
    "medical_romance": "professional competence, hidden vulnerability",
    "dark_romance": "intense gaze, dangerous allure, guarded passion",
    "thriller": "sharp alertness, hidden depths, calculated composure",
    "psychological_thriller": "intelligent intensity, seeing beneath surfaces",
    "mystery": "enigmatic presence, secrets held close",
    "slice_of_life": "warm everyday charm, genuine comfort",
}


def assemble_avatar_prompt(
    name: str,
    archetype: str,
    role_frame: Optional[str] = None,
    boundaries: Optional[Dict[str, Any]] = None,
    content_rating: str = "sfw",
    custom_appearance: Optional[str] = None,
    style_preset: Optional[str] = None,
    expression_preset: Optional[str] = None,
    pose_preset: Optional[str] = None,
    style_notes: Optional[str] = None,
    # New dynamic context parameters
    world_name: Optional[str] = None,
    series_genre: Optional[str] = None,
    backstory: Optional[str] = None,
) -> PromptAssembly:
    """Assemble complete avatar generation prompt from character data.

    Args:
        name: Character name
        archetype: Character archetype (used for default mood/expression)
        role_frame: Optional role frame override for visual styling
        boundaries: Character boundaries (for intimacy level)
        content_rating: 'sfw' or 'adult'
        custom_appearance: Custom appearance description override
        style_preset: Visual style ('anime', 'semi_realistic', 'painterly', 'webtoon')
        expression_preset: Expression ('warm', 'intense', 'playful', 'mysterious', 'confident')
        pose_preset: Pose ('portrait', 'casual', 'dramatic', 'candid')
        style_notes: Free-text additional style/atmosphere notes (e.g., "sunset lighting", "wearing glasses")
        world_name: World name for style defaults (e.g., "K-World", "Real Life")
        series_genre: Series genre for mood defaults (e.g., "romantic_tension", "thriller")
        backstory: Character backstory for additional context extraction
    """
    effective_role = role_frame or archetype
    role_visual = ROLE_FRAME_VISUALS.get(effective_role, DEFAULT_ROLE_VISUAL)
    # Check user archetypes first, then canonical archetypes
    archetype_data = (
        USER_ARCHETYPE_MOOD.get(archetype) or
        ARCHETYPE_MOOD.get(archetype) or
        DEFAULT_ARCHETYPE_MOOD
    )

    flirting_level = "playful"
    if boundaries:
        flirting_level = boundaries.get("flirting_level", "playful")
    intimacy = FLIRTING_LEVEL_MODIFIERS.get(flirting_level, DEFAULT_FLIRTING_MODIFIER)

    # Build appearance - custom appearance or archetype-derived
    appearance_parts = [f"portrait of {name}"]
    if custom_appearance:
        appearance_parts.append(custom_appearance)
    appearance_parts.append(role_visual["wardrobe"])

    # Expression: prefer preset, fall back to archetype
    if expression_preset and expression_preset in EXPRESSION_PRESETS:
        appearance_parts.append(EXPRESSION_PRESETS[expression_preset])
    else:
        appearance_parts.append(archetype_data["expression"])
        appearance_parts.append(intimacy["gaze"])

    appearance_prompt = ", ".join(filter(None, appearance_parts))

    # Build composition - pose preset or archetype-derived
    composition_parts = [COMPOSITION_DEFAULTS["framing"]]

    if pose_preset and pose_preset in POSE_PRESETS:
        composition_parts.append(POSE_PRESETS[pose_preset])
    else:
        composition_parts.append(role_visual["pose"])
        composition_parts.append(intimacy["body_language"])

    composition_parts.append(role_visual["setting"])
    composition_parts.append(COMPOSITION_DEFAULTS["lighting"])
    composition_prompt = ", ".join(filter(None, composition_parts))

    # Style: prefer preset, then world style, fall back to default fantazy style
    if style_preset and style_preset in STYLE_PRESETS:
        style_prompt = f"{STYLE_PRESETS[style_preset]}, {FANTAZY_STYLE_LOCK}"
    elif world_name and world_name in WORLD_AVATAR_STYLES:
        # Use world-specific styling when no explicit preset
        world_style = WORLD_AVATAR_STYLES[world_name]
        style_prompt = f"{world_style['style']}, {world_style['lighting']}, {world_style['quality']}"
    else:
        style_prompt = FANTAZY_STYLE_LOCK

    # Add genre-specific mood if available and no expression preset
    if series_genre and series_genre in GENRE_AVATAR_MOODS and not expression_preset:
        genre_mood = GENRE_AVATAR_MOODS[series_genre]
        style_prompt = f"{style_prompt}, {genre_mood}"

    negative_prompt = FANTAZY_NEGATIVE_PROMPT
    if content_rating == "sfw":
        negative_prompt += ", nsfw, nude, explicit, revealing, suggestive"

    # Build full prompt, appending style_notes if provided
    full_prompt = f"{appearance_prompt}, {composition_prompt}, {style_prompt}"
    if style_notes and style_notes.strip():
        full_prompt = f"{full_prompt}, {style_notes.strip()}"

    # Extract character essence from backstory if no custom appearance
    if backstory and not custom_appearance:
        # Add first sentence of backstory as character context
        first_line = backstory.split('.')[0] if '.' in backstory else backstory[:80]
        if len(first_line) < 80:
            full_prompt = f"{full_prompt}, {first_line}"

    return PromptAssembly(
        appearance_prompt=appearance_prompt,
        composition_prompt=composition_prompt,
        style_prompt=style_prompt,
        negative_prompt=negative_prompt,
        full_prompt=full_prompt,
    )


# =============================================================================
# Data Models
# =============================================================================

@dataclass
class AvatarGenerationResult:
    """Result of avatar generation."""
    success: bool
    asset_id: Optional[UUID] = None
    kit_id: Optional[UUID] = None
    image_url: Optional[str] = None
    storage_path: Optional[str] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    latency_ms: Optional[int] = None


@dataclass
class GalleryItem:
    """Single item in avatar gallery."""
    id: str
    url: str
    label: Optional[str] = None
    is_primary: bool = False


@dataclass
class GalleryStatus:
    """Avatar gallery status for a character."""
    has_gallery: bool
    kit_id: Optional[UUID] = None
    primary_url: Optional[str] = None
    gallery: List[GalleryItem] = field(default_factory=list)
    can_activate: bool = False
    missing_requirements: List[str] = field(default_factory=list)


# =============================================================================
# Avatar Generation Service
# =============================================================================

class AvatarGenerationService:
    """Service for managing avatar gallery and generating portraits."""

    def __init__(self):
        self.storage = StorageService.get_instance()

    async def generate_portrait(
        self,
        character_id: UUID,
        user_id: UUID,
        db,
        appearance_description: Optional[str] = None,
        label: Optional[str] = None,
        content_rating: str = "sfw",
        style_preset: Optional[str] = None,
        expression_preset: Optional[str] = None,
        pose_preset: Optional[str] = None,
        style_notes: Optional[str] = None,
    ) -> AvatarGenerationResult:
        """Generate a portrait for a character's avatar gallery.

        Creates avatar kit if none exists, generates image via FLUX,
        and adds it to the gallery. First portrait becomes primary.

        Args:
            style_preset: Visual style ('anime', 'semi_realistic', 'painterly', 'webtoon')
            expression_preset: Expression ('warm', 'intense', 'playful', 'mysterious', 'confident')
            pose_preset: Pose ('portrait', 'casual', 'dramatic', 'candid')
            style_notes: Free-text additional style/atmosphere notes
        """
        try:
            # 1. Get character data with world and series context for dynamic styling
            character = await db.fetch_one(
                """SELECT c.id, c.name, c.archetype, c.role_frame, c.boundaries, c.content_rating,
                          c.active_avatar_kit_id, c.backstory, c.world_id, c.primary_series_id,
                          w.name as world_name,
                          s.genre as series_genre
                   FROM characters c
                   LEFT JOIN worlds w ON w.id = c.world_id
                   LEFT JOIN series s ON s.id = c.primary_series_id
                   WHERE c.id = :id""",
                {"id": str(character_id)}
            )

            if not character:
                return AvatarGenerationResult(success=False, error="Character not found")

            char_dict = dict(character)
            boundaries = char_dict.get("boundaries", {})
            if isinstance(boundaries, str):
                boundaries = json.loads(boundaries)

            # 2. Assemble prompt with optional presets and dynamic context
            actual_rating = char_dict.get("content_rating", content_rating)
            prompt_assembly = assemble_avatar_prompt(
                name=char_dict["name"],
                archetype=char_dict["archetype"],
                role_frame=char_dict.get("role_frame"),
                boundaries=boundaries,
                content_rating=actual_rating,
                custom_appearance=appearance_description,
                style_preset=style_preset,
                expression_preset=expression_preset,
                pose_preset=pose_preset,
                style_notes=style_notes,
                # Pass dynamic context for richer prompts
                world_name=char_dict.get("world_name"),
                series_genre=char_dict.get("series_genre"),
                backstory=char_dict.get("backstory"),
            )

            # 3. Ensure avatar kit exists
            kit_id = char_dict.get("active_avatar_kit_id")
            is_first_portrait = kit_id is None

            if not kit_id:
                kit_id = uuid.uuid4()
                await db.execute(
                    """INSERT INTO avatar_kits (
                        id, character_id, created_by, name,
                        appearance_prompt, style_prompt, negative_prompt,
                        status, is_default
                    ) VALUES (
                        :id, :character_id, :created_by, :name,
                        :appearance_prompt, :style_prompt, :negative_prompt,
                        'active', TRUE
                    )""",
                    {
                        "id": str(kit_id),
                        "character_id": str(character_id),
                        "created_by": str(user_id),
                        "name": f"{char_dict['name']}'s Avatar Kit",
                        "appearance_prompt": prompt_assembly.appearance_prompt,
                        "style_prompt": prompt_assembly.style_prompt,
                        "negative_prompt": prompt_assembly.negative_prompt,
                    }
                )
                await db.execute(
                    "UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :id",
                    {"kit_id": str(kit_id), "id": str(character_id)}
                )
                log.info(f"Created avatar kit {kit_id} for character {character_id}")

            # 4. Generate image via FLUX
            image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

            log.info(f"Generating portrait for {char_dict['name']}")
            response = await image_service.generate(
                prompt=prompt_assembly.full_prompt,
                negative_prompt=prompt_assembly.negative_prompt,
                width=1024,
                height=1024,
            )

            if not response.images:
                return AvatarGenerationResult(success=False, error="Image generation returned no images")

            image_bytes = response.images[0]

            # 5. Upload to storage
            asset_id = uuid.uuid4()
            storage_path = await self.storage.upload_avatar_asset(
                image_bytes=image_bytes,
                kit_id=kit_id,
                asset_id=asset_id,
                asset_type="portrait",
            )

            # 6. Create asset record
            await db.execute(
                """INSERT INTO avatar_assets (
                    id, avatar_kit_id, asset_type, expression,
                    storage_bucket, storage_path, source_type,
                    generation_metadata, is_canonical, is_active,
                    mime_type, file_size_bytes
                ) VALUES (
                    :id, :kit_id, 'portrait', :expression,
                    'avatars', :storage_path, 'ai_generated',
                    :metadata, :is_canonical, TRUE,
                    'image/png', :file_size
                )""",
                {
                    "id": str(asset_id),
                    "kit_id": str(kit_id),
                    "expression": label,  # Use label param as expression value
                    "storage_path": storage_path,
                    "metadata": json.dumps({"prompt": prompt_assembly.full_prompt[:500], "model": response.model}),
                    "is_canonical": is_first_portrait,
                    "file_size": len(image_bytes),
                }
            )

            # Use permanent public URL instead of signed URL (avatars bucket is public)
            image_url = self.storage.get_public_url("avatars", storage_path)

            # 7. Always set as primary anchor and update avatar_url
            # This ensures regenerated avatars become the new reference for Kontext
            await db.execute(
                "UPDATE avatar_kits SET primary_anchor_id = :asset_id, updated_at = NOW() WHERE id = :kit_id",
                {"asset_id": str(asset_id), "kit_id": str(kit_id)}
            )
            await db.execute(
                "UPDATE characters SET avatar_url = :avatar_url, updated_at = NOW() WHERE id = :id",
                {"avatar_url": image_url, "id": str(character_id)}
            )

            log.info(f"Generated portrait {asset_id} for character {character_id}")

            return AvatarGenerationResult(
                success=True,
                asset_id=asset_id,
                kit_id=kit_id,
                image_url=image_url,
                storage_path=storage_path,
                model_used=response.model,
                latency_ms=response.latency_ms,
            )

        except Exception as e:
            log.error(f"Portrait generation failed: {e}")
            return AvatarGenerationResult(success=False, error=str(e))

    async def set_primary(
        self,
        character_id: UUID,
        asset_id: UUID,
        user_id: UUID,
        db,
    ) -> bool:
        """Set a gallery item as the primary avatar."""
        # Verify ownership and get asset
        asset = await db.fetch_one(
            """SELECT aa.id, aa.storage_path, ak.id as kit_id
               FROM avatar_assets aa
               JOIN avatar_kits ak ON ak.id = aa.avatar_kit_id
               JOIN characters c ON c.id = ak.character_id
               WHERE aa.id = :asset_id AND c.id = :character_id""",
            {"asset_id": str(asset_id), "character_id": str(character_id)}
        )

        if not asset:
            return False

        asset_dict = dict(asset)
        # Use permanent public URL (avatars bucket is public)
        image_url = self.storage.get_public_url("avatars", asset_dict["storage_path"])

        # Update primary
        await db.execute(
            "UPDATE avatar_kits SET primary_anchor_id = :asset_id, updated_at = NOW() WHERE id = :kit_id",
            {"asset_id": str(asset_id), "kit_id": str(asset_dict["kit_id"])}
        )
        await db.execute(
            "UPDATE characters SET avatar_url = :avatar_url, updated_at = NOW() WHERE id = :id",
            {"avatar_url": image_url, "id": str(character_id)}
        )

        # Update is_canonical flags
        await db.execute(
            "UPDATE avatar_assets SET is_canonical = FALSE WHERE avatar_kit_id = :kit_id",
            {"kit_id": str(asset_dict["kit_id"])}
        )
        await db.execute(
            "UPDATE avatar_assets SET is_canonical = TRUE WHERE id = :asset_id",
            {"asset_id": str(asset_id)}
        )

        log.info(f"Set asset {asset_id} as primary for character {character_id}")
        return True

    async def delete_asset(
        self,
        character_id: UUID,
        asset_id: UUID,
        user_id: UUID,
        db,
    ) -> bool:
        """Delete a gallery item (cannot delete if it's the only one)."""
        # Verify ownership
        asset = await db.fetch_one(
            """SELECT aa.id, aa.is_canonical, ak.id as kit_id
               FROM avatar_assets aa
               JOIN avatar_kits ak ON ak.id = aa.avatar_kit_id
               JOIN characters c ON c.id = ak.character_id
               WHERE aa.id = :asset_id AND c.id = :character_id""",
            {"asset_id": str(asset_id), "character_id": str(character_id)}
        )

        if not asset:
            return False

        asset_dict = dict(asset)

        # Check if it's the only asset
        count = await db.fetch_one(
            "SELECT COUNT(*) as cnt FROM avatar_assets WHERE avatar_kit_id = :kit_id AND is_active = TRUE",
            {"kit_id": str(asset_dict["kit_id"])}
        )

        if count["cnt"] <= 1:
            return False  # Can't delete the only asset

        # Soft delete
        await db.execute(
            "UPDATE avatar_assets SET is_active = FALSE WHERE id = :asset_id",
            {"asset_id": str(asset_id)}
        )

        # If it was primary, set another as primary
        if asset_dict["is_canonical"]:
            new_primary = await db.fetch_one(
                """SELECT id, storage_path FROM avatar_assets
                   WHERE avatar_kit_id = :kit_id AND is_active = TRUE AND id != :asset_id
                   ORDER BY created_at LIMIT 1""",
                {"kit_id": str(asset_dict["kit_id"]), "asset_id": str(asset_id)}
            )
            if new_primary:
                await self.set_primary(character_id, new_primary["id"], user_id, db)

        log.info(f"Deleted asset {asset_id} from character {character_id}")
        return True

    async def get_gallery_status(
        self,
        character_id: UUID,
        user_id: UUID,
        db,
    ) -> GalleryStatus:
        """Get avatar gallery status for a character.

        Uses validate_chat_ready for can_activate to ensure single source of truth
        for activation requirements across UI and API.

        Note: Ownership check removed for admin/creator workflow.
        """
        from app.models.character import validate_chat_ready

        # Fetch full character data for validation
        character_data = await db.fetch_one(
            """SELECT c.*, ak.id as kit_id, ak.primary_anchor_id
               FROM characters c
               LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
               WHERE c.id = :id""",
            {"id": str(character_id)}
        )

        if not character_data:
            return GalleryStatus(has_gallery=False)

        char_dict = dict(character_data)
        kit_id = char_dict.get("kit_id")
        primary_id = char_dict.get("primary_anchor_id")

        # No gallery if no kit
        if not kit_id:
            # Still validate to show what's missing
            errors = validate_chat_ready(char_dict)
            return GalleryStatus(
                has_gallery=False,
                missing_requirements=[str(e) for e in errors],
            )

        # Get all gallery items
        assets = await db.fetch_all(
            """SELECT id, expression, storage_path
               FROM avatar_assets
               WHERE avatar_kit_id = :kit_id AND is_active = TRUE
               ORDER BY is_canonical DESC, created_at ASC""",
            {"kit_id": str(kit_id)}
        )

        gallery = []
        primary_url = None

        for asset in assets:
            asset_dict = dict(asset)
            url = await self.storage.create_signed_url("avatars", asset_dict["storage_path"])
            is_primary = str(asset_dict["id"]) == str(primary_id) if primary_id else False

            if is_primary:
                primary_url = url

            gallery.append(GalleryItem(
                id=str(asset_dict["id"]),
                url=url,
                label=asset_dict.get("expression"),  # Use expression as label
                is_primary=is_primary,
            ))

        # Auto-sync avatar_url if out of sync with primary anchor
        # This ensures the character's avatar_url stays current when primary changes
        if primary_url and not char_dict.get("avatar_url"):
            try:
                await db.execute(
                    "UPDATE characters SET avatar_url = :url WHERE id = :id",
                    {"url": primary_url, "id": str(character_id)}
                )
                char_dict["avatar_url"] = primary_url
                log.info(f"Auto-synced avatar_url for character {character_id}")
            except Exception as e:
                log.warning(f"Failed to auto-sync avatar_url: {e}")

        # Use canonical validation for activation check
        errors = validate_chat_ready(char_dict)

        return GalleryStatus(
            has_gallery=True,
            kit_id=kit_id,
            primary_url=primary_url,
            gallery=gallery,
            can_activate=len(errors) == 0,
            missing_requirements=[str(e) for e in errors],
        )


# Singleton
_service: Optional[AvatarGenerationService] = None

def get_avatar_generation_service() -> AvatarGenerationService:
    """Get singleton avatar generation service instance."""
    global _service
    if _service is None:
        _service = AvatarGenerationService()
    return _service
