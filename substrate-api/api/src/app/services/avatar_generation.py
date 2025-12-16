"""Avatar Generation Service for Studio.

Handles hero avatar and expression pack generation using FLUX/FLUX Kontext.

Key concepts:
- Hero Avatar: anchor_portrait asset, required for activation
- Expression Pack: 5-7 expression assets derived from hero anchor
- Style Lock: Global Fantazy style rules for visual consistency

Usage:
    service = AvatarGenerationService()

    # Generate hero avatar
    result = await service.generate_hero_avatar(
        character_id=...,
        user_id=...,
        appearance_description="A young woman with silver hair...",
        db=db,
    )

    # Generate expression from existing anchor
    result = await service.generate_expression(
        character_id=...,
        expression="smile",
        db=db,
    )
"""

import logging
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.services.image import ImageService, FLUX_KONTEXT_PRO
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

# Expression definitions for expression pack
EXPRESSION_TYPES = [
    {"name": "smile", "prompt_modifier": "warm genuine smile, happy sparkling eyes, joyful expression"},
    {"name": "shy", "prompt_modifier": "shy blushing expression, averted gaze, cute embarrassed look"},
    {"name": "thoughtful", "prompt_modifier": "contemplative expression, slight head tilt, gazing thoughtfully"},
    {"name": "surprised", "prompt_modifier": "surprised expression, widened eyes, parted lips, cute shock"},
    {"name": "annoyed", "prompt_modifier": "playfully annoyed, raised eyebrow, slight pout"},
    {"name": "flirty", "prompt_modifier": "flirty half-lidded eyes, teasing smirk, confident alluring expression"},
    {"name": "sad", "prompt_modifier": "melancholic expression, glistening eyes, vulnerable beauty"},
]


# =============================================================================
# Role Frame → Visual Mapping (Wardrobe + Setting)
# =============================================================================

ROLE_FRAME_VISUALS = {
    # =========================================================================
    # Genre 01: Romantic Tension Visual Doctrine
    # Tension through: eye contact, lighting, emotional expression, atmosphere
    # Filter-safe: focus on gaze and setting, not clothing
    # =========================================================================

    # Everyday roles
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
    # Fantasy/themed roles
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
}

# Default fallback for unknown roles
DEFAULT_ROLE_VISUAL = {
    "wardrobe": "stylish casual outfit, fashionable",
    "setting": "soft pleasant lighting, simple clean background",
    "pose": "natural relaxed pose, friendly warm expression",
}


# =============================================================================
# Archetype → Expression/Mood Mapping
# =============================================================================

ARCHETYPE_MOOD = {
    # =========================================================================
    # Genre 01: Emotional Expression/Mood
    # Looking directly at viewer, emotionally present and authentic
    # =========================================================================
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
    # Role-as-archetype fallbacks
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
}

DEFAULT_ARCHETYPE_MOOD = {
    "expression": "attractive warm expression, engaging eyes",
    "mood": "appealing, inviting, emotionally present",
}


# =============================================================================
# Intimacy Intent (derived from boundaries.flirting_level)
# =============================================================================

FLIRTING_LEVEL_MODIFIERS = {
    "minimal": {
        "gaze": "warm professional eye contact, friendly",
        "body_language": "respectful open posture",
        "intensity": "friendly warmth, supportive",
    },
    "subtle": {
        "gaze": "warm friendly eye contact, approachable",
        "body_language": "open but reserved posture",
        "intensity": "gentle warmth",
    },
    "moderate": {
        "gaze": "engaging eye contact, interested expression",
        "body_language": "relaxed confident posture",
        "intensity": "genuine interest",
    },
    "playful": {
        "gaze": "bright playful eye contact, fun expression",
        "body_language": "confident open posture, engaged",
        "intensity": "fun energy, genuine warmth",
    },
    "slow_burn": {
        "gaze": "thoughtful meaningful eye contact",
        "body_language": "composed thoughtful posture",
        "intensity": "quiet depth, genuine connection",
    },
    "forward": {
        "gaze": "direct confident eye contact",
        "body_language": "confident open posture",
        "intensity": "confident warmth, genuine presence",
    },
}

DEFAULT_FLIRTING_MODIFIER = FLIRTING_LEVEL_MODIFIERS["moderate"]


# =============================================================================
# Composition Defaults
# =============================================================================

COMPOSITION_DEFAULTS = {
    "framing": "upper body portrait, medium close-up shot",
    "camera": "eye level, slight low angle for appeal",
    "background": "soft bokeh background, not distracting",
    "lighting": "flattering soft key light, gentle fill",
}


# =============================================================================
# Prompt Assembly Contract
# =============================================================================

@dataclass
class PromptAssembly:
    """Assembled prompt components for avatar generation."""
    appearance_prompt: str
    composition_prompt: str
    style_prompt: str
    negative_prompt: str
    full_prompt: str  # Combined ready-to-use prompt


def assemble_avatar_prompt(
    name: str,
    archetype: str,
    role_frame: Optional[str] = None,
    boundaries: Optional[Dict[str, Any]] = None,
    content_rating: str = "sfw",
    custom_appearance: Optional[str] = None,
) -> PromptAssembly:
    """Assemble complete avatar generation prompt from character data.

    This is the single source of truth for prompt construction.
    Combines: role_frame → wardrobe/setting, archetype → mood/expression,
    boundaries → intimacy calibration, content_rating → safety.

    Args:
        name: Character name
        archetype: Personality archetype (comforting, flirty, mysterious, etc.)
        role_frame: Role/occupation frame (neighbor, coworker, barista, etc.)
        boundaries: Character boundaries dict (contains flirting_level)
        content_rating: 'sfw' or 'adult'
        custom_appearance: Optional override for appearance details

    Returns:
        PromptAssembly with all prompt components
    """
    # 1. Get role visuals (wardrobe, setting, pose)
    effective_role = role_frame or archetype  # Fall back to archetype if no role_frame
    role_visual = ROLE_FRAME_VISUALS.get(effective_role, DEFAULT_ROLE_VISUAL)

    # 2. Get archetype mood (expression, mood)
    archetype_data = ARCHETYPE_MOOD.get(archetype, DEFAULT_ARCHETYPE_MOOD)

    # 3. Get intimacy modifiers from boundaries
    flirting_level = "playful"  # default
    if boundaries:
        flirting_level = boundaries.get("flirting_level", "playful")
    intimacy = FLIRTING_LEVEL_MODIFIERS.get(flirting_level, DEFAULT_FLIRTING_MODIFIER)

    # 4. Build appearance prompt
    # custom_appearance adds physical traits (hair, eyes, etc.) to role wardrobe
    appearance_parts = [
        f"portrait of {name}",  # Single character portrait, named
    ]

    # Add custom physical traits if provided
    if custom_appearance:
        appearance_parts.append(custom_appearance)

    # Add role-specific wardrobe
    appearance_parts.append(role_visual["wardrobe"])

    # Add expression and gaze from archetype + intimacy
    appearance_parts.append(archetype_data["expression"])
    appearance_parts.append(intimacy["gaze"])

    appearance_prompt = ", ".join(filter(None, appearance_parts))

    # 5. Build composition prompt
    composition_parts = [
        COMPOSITION_DEFAULTS["framing"],
        role_visual["pose"],
        role_visual["setting"],
        intimacy["body_language"],
        COMPOSITION_DEFAULTS["lighting"],
    ]
    composition_prompt = ", ".join(filter(None, composition_parts))

    # 6. Style prompt (always use style lock)
    style_prompt = FANTAZY_STYLE_LOCK

    # 7. Negative prompt (adjust based on content rating)
    negative_prompt = FANTAZY_NEGATIVE_PROMPT
    if content_rating == "sfw":
        negative_prompt += ", nsfw, nude, explicit, revealing, suggestive"

    # 8. Combine into full prompt
    full_prompt = f"{appearance_prompt}, {composition_prompt}, {style_prompt}"

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
class AvatarKitStatus:
    """Status of a character's avatar kit."""
    has_kit: bool
    kit_id: Optional[UUID] = None
    has_hero_avatar: bool = False
    hero_avatar_url: Optional[str] = None
    expression_count: int = 0
    expressions: List[Dict[str, Any]] = None
    can_activate: bool = False

    def __post_init__(self):
        if self.expressions is None:
            self.expressions = []


# =============================================================================
# Avatar Generation Service
# =============================================================================

class AvatarGenerationService:
    """Service for generating avatar assets."""

    def __init__(self):
        self.storage = StorageService.get_instance()

    async def generate_hero_avatar(
        self,
        character_id: UUID,
        user_id: UUID,
        db,
        appearance_description: Optional[str] = None,
        content_rating: str = "sfw",
    ) -> AvatarGenerationResult:
        """Generate hero avatar (anchor_portrait) for a character.

        Creates avatar kit if none exists, generates image via FLUX,
        stores it, and sets up all the proper references.

        Args:
            character_id: Character to generate for
            user_id: User making the request
            db: Database connection
            appearance_description: Optional custom description
            content_rating: 'sfw' or 'adult' - affects prompt constraints

        Returns:
            AvatarGenerationResult with success status and asset info
        """
        try:
            # 1. Get character data (including role_frame and boundaries)
            character = await db.fetch_one(
                """SELECT id, name, archetype, role_frame, boundaries, content_rating,
                          active_avatar_kit_id
                   FROM characters
                   WHERE id = :id AND created_by = :user_id""",
                {"id": str(character_id), "user_id": str(user_id)}
            )

            if not character:
                return AvatarGenerationResult(
                    success=False,
                    error="Character not found or not owned by you"
                )

            char_dict = dict(character)

            # Parse boundaries if needed
            boundaries = char_dict.get("boundaries", {})
            if isinstance(boundaries, str):
                import json
                boundaries = json.loads(boundaries)

            # 2. Assemble prompt using new contract
            actual_rating = char_dict.get("content_rating", content_rating)
            prompt_assembly = assemble_avatar_prompt(
                name=char_dict["name"],
                archetype=char_dict["archetype"],
                role_frame=char_dict.get("role_frame"),
                boundaries=boundaries,
                content_rating=actual_rating,
                custom_appearance=appearance_description,
            )

            # 3. Ensure avatar kit exists
            kit_id = char_dict.get("active_avatar_kit_id")

            if not kit_id:
                # Create new kit
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

                # Link kit to character
                await db.execute(
                    "UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :id",
                    {"kit_id": str(kit_id), "id": str(character_id)}
                )

                log.info(f"Created avatar kit {kit_id} for character {character_id}")
            else:
                # Update existing kit's prompts
                await db.execute(
                    """UPDATE avatar_kits
                       SET appearance_prompt = :appearance_prompt,
                           style_prompt = :style_prompt,
                           negative_prompt = :negative_prompt,
                           updated_at = NOW()
                       WHERE id = :kit_id""",
                    {
                        "kit_id": str(kit_id),
                        "appearance_prompt": prompt_assembly.appearance_prompt,
                        "style_prompt": prompt_assembly.style_prompt,
                        "negative_prompt": prompt_assembly.negative_prompt,
                    }
                )

            # 4. Generate image via FLUX
            log.info(f"Prompt assembly for {char_dict['name']}: {prompt_assembly.full_prompt[:200]}...")

            # Use FLUX for initial generation (no reference needed)
            image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

            log.info(f"Generating hero avatar for {char_dict['name']}")
            response = await image_service.generate(
                prompt=prompt_assembly.full_prompt,
                negative_prompt=prompt_assembly.negative_prompt,
                width=1024,
                height=1024,
            )

            if not response.images:
                return AvatarGenerationResult(
                    success=False,
                    error="Image generation returned no images"
                )

            image_bytes = response.images[0]

            # 5. Upload to storage
            asset_id = uuid.uuid4()
            storage_path = await self.storage.upload_avatar_asset(
                image_bytes=image_bytes,
                kit_id=kit_id,
                asset_id=asset_id,
                asset_type="anchor_portrait",
            )

            # 6. Create asset record
            await db.execute(
                """INSERT INTO avatar_assets (
                    id, avatar_kit_id, asset_type,
                    storage_bucket, storage_path, source_type,
                    generation_metadata, is_canonical, is_active,
                    mime_type, file_size_bytes
                ) VALUES (
                    :id, :kit_id, 'anchor_portrait',
                    'avatars', :storage_path, 'ai_generated',
                    :metadata, TRUE, TRUE,
                    'image/png', :file_size
                )""",
                {
                    "id": str(asset_id),
                    "kit_id": str(kit_id),
                    "storage_path": storage_path,
                    "metadata": f'{{"prompt": "{prompt_assembly.full_prompt[:500]}", "model": "{response.model}"}}',
                    "file_size": len(image_bytes),
                }
            )

            # 7. Set as primary anchor
            await db.execute(
                """UPDATE avatar_kits
                   SET primary_anchor_id = :asset_id, updated_at = NOW()
                   WHERE id = :kit_id""",
                {"asset_id": str(asset_id), "kit_id": str(kit_id)}
            )

            # 8. Update character's avatar_url
            image_url = await self.storage.create_signed_url("avatars", storage_path)

            await db.execute(
                """UPDATE characters
                   SET avatar_url = :avatar_url, updated_at = NOW()
                   WHERE id = :id""",
                {"avatar_url": image_url, "id": str(character_id)}
            )

            log.info(f"Generated hero avatar {asset_id} for character {character_id}")

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
            log.error(f"Hero avatar generation failed: {e}")
            return AvatarGenerationResult(
                success=False,
                error=str(e)
            )

    async def generate_expression(
        self,
        character_id: UUID,
        user_id: UUID,
        expression: str,
        db,
    ) -> AvatarGenerationResult:
        """Generate an expression variant from the hero avatar anchor.

        Uses FLUX Kontext with the hero avatar as reference to maintain
        character identity while generating a new expression.

        Args:
            character_id: Character to generate for
            user_id: User making the request
            expression: Expression type (smile, shy, thoughtful, etc.)
            db: Database connection

        Returns:
            AvatarGenerationResult with success status and asset info
        """
        try:
            # 1. Get character and kit info
            char_data = await db.fetch_one(
                """SELECT c.id, c.name, c.content_rating, c.active_avatar_kit_id,
                          ak.primary_anchor_id, ak.appearance_prompt, ak.style_prompt, ak.negative_prompt,
                          aa.storage_path as anchor_path
                   FROM characters c
                   LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
                   LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id
                   WHERE c.id = :id AND c.created_by = :user_id""",
                {"id": str(character_id), "user_id": str(user_id)}
            )

            if not char_data:
                return AvatarGenerationResult(
                    success=False,
                    error="Character not found or not owned by you"
                )

            char_dict = dict(char_data)

            if not char_dict.get("active_avatar_kit_id"):
                return AvatarGenerationResult(
                    success=False,
                    error="No avatar kit found. Generate hero avatar first."
                )

            if not char_dict.get("primary_anchor_id"):
                return AvatarGenerationResult(
                    success=False,
                    error="No hero avatar found. Generate hero avatar first."
                )

            anchor_path = char_dict.get("anchor_path")
            if not anchor_path:
                return AvatarGenerationResult(
                    success=False,
                    error="Hero avatar storage path not found"
                )

            # 2. Find expression definition
            expr_def = next(
                (e for e in EXPRESSION_TYPES if e["name"] == expression),
                None
            )
            if not expr_def:
                return AvatarGenerationResult(
                    success=False,
                    error=f"Unknown expression: {expression}. Available: {[e['name'] for e in EXPRESSION_TYPES]}"
                )

            # 3. Download anchor image for reference
            anchor_bytes = await self.storage.download("avatars", anchor_path)

            # 4. Build prompt for expression
            appearance = char_dict.get("appearance_prompt", "")
            style = char_dict.get("style_prompt", FANTAZY_STYLE_LOCK)
            negative = char_dict.get("negative_prompt", FANTAZY_NEGATIVE_PROMPT)

            # Kontext prompt: reference the same person with new expression
            full_prompt = f"same person from reference image, {expr_def['prompt_modifier']}, {appearance}, {style}"

            # Add SFW enforcement
            if char_dict.get("content_rating") == "sfw":
                full_prompt += ", safe for work, tasteful, fully clothed"

            # 5. Generate via FLUX Kontext
            image_service = ImageService.get_client("replicate", FLUX_KONTEXT_PRO)

            log.info(f"Generating {expression} expression for {char_dict['name']}")
            response = await image_service.edit(
                prompt=full_prompt,
                reference_images=[anchor_bytes],
                negative_prompt=negative,
                aspect_ratio="1:1",
            )

            if not response.images:
                return AvatarGenerationResult(
                    success=False,
                    error="Expression generation returned no images"
                )

            image_bytes = response.images[0]

            # 6. Upload to storage
            kit_id = char_dict["active_avatar_kit_id"]
            asset_id = uuid.uuid4()
            storage_path = await self.storage.upload_avatar_asset(
                image_bytes=image_bytes,
                kit_id=kit_id,
                asset_id=asset_id,
                asset_type="expression",
            )

            # 7. Create asset record
            await db.execute(
                """INSERT INTO avatar_assets (
                    id, avatar_kit_id, asset_type, expression, emotion_tags,
                    storage_bucket, storage_path, source_type, derived_from_id,
                    generation_metadata, is_canonical, is_active,
                    mime_type, file_size_bytes
                ) VALUES (
                    :id, :kit_id, 'expression', :expression, :emotion_tags,
                    'avatars', :storage_path, 'ai_generated', :derived_from,
                    :metadata, FALSE, TRUE,
                    'image/png', :file_size
                )""",
                {
                    "id": str(asset_id),
                    "kit_id": str(kit_id),
                    "expression": expression,
                    "emotion_tags": [expression],
                    "storage_path": storage_path,
                    "derived_from": str(char_dict["primary_anchor_id"]),
                    "metadata": f'{{"prompt": "{full_prompt[:500]}", "model": "{response.model}"}}',
                    "file_size": len(image_bytes),
                }
            )

            image_url = await self.storage.create_signed_url("avatars", storage_path)

            log.info(f"Generated {expression} expression {asset_id} for character {character_id}")

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
            log.error(f"Expression generation failed: {e}")
            return AvatarGenerationResult(
                success=False,
                error=str(e)
            )

    async def get_avatar_status(
        self,
        character_id: UUID,
        user_id: UUID,
        db,
    ) -> AvatarKitStatus:
        """Get avatar kit status for a character.

        Returns info about hero avatar and expressions.
        """
        # Get kit and assets
        kit_data = await db.fetch_one(
            """SELECT ak.id as kit_id, ak.primary_anchor_id,
                      aa.storage_path as anchor_path
               FROM characters c
               LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
               LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id
               WHERE c.id = :id AND c.created_by = :user_id""",
            {"id": str(character_id), "user_id": str(user_id)}
        )

        if not kit_data or not kit_data["kit_id"]:
            return AvatarKitStatus(has_kit=False)

        kit_dict = dict(kit_data)
        kit_id = kit_dict["kit_id"]

        # Get hero avatar URL
        hero_url = None
        has_hero = bool(kit_dict.get("primary_anchor_id"))
        if has_hero and kit_dict.get("anchor_path"):
            hero_url = await self.storage.create_signed_url("avatars", kit_dict["anchor_path"])

        # Get expressions
        expressions_data = await db.fetch_all(
            """SELECT id, expression, storage_path
               FROM avatar_assets
               WHERE avatar_kit_id = :kit_id
                 AND asset_type = 'expression'
                 AND is_active = TRUE
               ORDER BY created_at""",
            {"kit_id": str(kit_id)}
        )

        expressions = []
        for row in expressions_data:
            row_dict = dict(row)
            url = await self.storage.create_signed_url("avatars", row_dict["storage_path"])
            expressions.append({
                "id": str(row_dict["id"]),
                "expression": row_dict["expression"],
                "image_url": url,
            })

        return AvatarKitStatus(
            has_kit=True,
            kit_id=kit_id,
            has_hero_avatar=has_hero,
            hero_avatar_url=hero_url,
            expression_count=len(expressions),
            expressions=expressions,
            can_activate=has_hero,  # Can activate if hero avatar exists
        )


# Singleton instance
_service: Optional[AvatarGenerationService] = None

def get_avatar_generation_service() -> AvatarGenerationService:
    """Get singleton avatar generation service instance."""
    global _service
    if _service is None:
        _service = AvatarGenerationService()
    return _service
