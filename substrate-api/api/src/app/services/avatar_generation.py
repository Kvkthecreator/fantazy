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
# Global Style Lock - Fantazy Visual Identity
# =============================================================================

FANTAZY_STYLE_LOCK = """high quality digital art, anime-influenced style,
soft lighting, clean lines, expressive eyes,
professional illustration quality,
vibrant but natural colors, subtle gradients,
character portrait focus"""

FANTAZY_NEGATIVE_PROMPT = """blurry, low quality, distorted,
deformed, ugly, amateur,
photorealistic, photo, 3d render,
multiple people, crowd, text, watermark,
nsfw, nude, explicit"""

# Expression definitions for expression pack
EXPRESSION_TYPES = [
    {"name": "smile", "prompt_modifier": "warmly smiling, happy expression, eyes bright"},
    {"name": "shy", "prompt_modifier": "shy expression, slight blush, looking down slightly"},
    {"name": "thoughtful", "prompt_modifier": "thoughtful expression, contemplative, looking to the side"},
    {"name": "surprised", "prompt_modifier": "surprised expression, eyes wide, eyebrows raised"},
    {"name": "annoyed", "prompt_modifier": "slightly annoyed expression, one eyebrow raised, unimpressed"},
    {"name": "flirty", "prompt_modifier": "playful smirk, confident expression, half-lidded eyes"},
    {"name": "sad", "prompt_modifier": "sad expression, downcast eyes, melancholic"},
]


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
# Appearance Prompt Generation
# =============================================================================

def derive_appearance_prompt(
    name: str,
    archetype: str,
    personality: Optional[Dict[str, Any]] = None,
    custom_description: Optional[str] = None,
) -> str:
    """Derive appearance prompt from character core if not provided.

    If custom_description is provided, use that.
    Otherwise, generate a basic prompt from archetype + personality.
    """
    if custom_description:
        return custom_description

    # Map archetypes to default visual traits
    archetype_visuals = {
        "comforting": "gentle features, warm expression, approachable appearance, soft colors",
        "flirty": "attractive features, confident posture, playful expression, fashionable",
        "mysterious": "enigmatic expression, sharp features, darker aesthetic, intense gaze",
        "cheerful": "bright expression, youthful features, energetic pose, colorful style",
        "brooding": "intense features, thoughtful expression, darker tones, dramatic lighting",
        "nurturing": "kind features, maternal/paternal warmth, gentle smile, soft appearance",
        "adventurous": "athletic build, determined expression, casual outdoor style",
        "intellectual": "refined features, glasses optional, thoughtful expression, neat appearance",
    }

    base_visual = archetype_visuals.get(archetype, archetype_visuals["comforting"])

    # Add personality-influenced traits
    traits = []
    if personality:
        extraversion = personality.get("extraversion", 0.5)
        if extraversion > 0.7:
            traits.append("outgoing demeanor")
        elif extraversion < 0.3:
            traits.append("reserved demeanor")

        agreeableness = personality.get("agreeableness", 0.5)
        if agreeableness > 0.7:
            traits.append("friendly face")

    traits_text = ", ".join(traits) if traits else ""

    prompt = f"portrait of {name}, {base_visual}"
    if traits_text:
        prompt += f", {traits_text}"

    return prompt


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
            # 1. Get character data
            character = await db.fetch_one(
                """SELECT id, name, archetype, baseline_personality, content_rating,
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

            # Parse personality if needed
            personality = char_dict.get("baseline_personality", {})
            if isinstance(personality, str):
                import json
                personality = json.loads(personality)

            # 2. Derive appearance prompt
            appearance_prompt = derive_appearance_prompt(
                name=char_dict["name"],
                archetype=char_dict["archetype"],
                personality=personality,
                custom_description=appearance_description,
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
                        "appearance_prompt": appearance_prompt,
                        "style_prompt": FANTAZY_STYLE_LOCK,
                        "negative_prompt": FANTAZY_NEGATIVE_PROMPT,
                    }
                )

                # Link kit to character
                await db.execute(
                    "UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :id",
                    {"kit_id": str(kit_id), "id": str(character_id)}
                )

                log.info(f"Created avatar kit {kit_id} for character {character_id}")
            else:
                # Update existing kit's appearance prompt
                await db.execute(
                    """UPDATE avatar_kits
                       SET appearance_prompt = :appearance_prompt,
                           style_prompt = :style_prompt,
                           negative_prompt = :negative_prompt,
                           updated_at = NOW()
                       WHERE id = :kit_id""",
                    {
                        "kit_id": str(kit_id),
                        "appearance_prompt": appearance_prompt,
                        "style_prompt": FANTAZY_STYLE_LOCK,
                        "negative_prompt": FANTAZY_NEGATIVE_PROMPT,
                    }
                )

            # 4. Generate image via FLUX
            full_prompt = f"{appearance_prompt}, {FANTAZY_STYLE_LOCK}"

            # Add SFW enforcement
            actual_rating = char_dict.get("content_rating", content_rating)
            if actual_rating == "sfw":
                full_prompt += ", safe for work, tasteful, fully clothed"

            # Use FLUX for initial generation (no reference needed)
            image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

            log.info(f"Generating hero avatar for {char_dict['name']}")
            response = await image_service.generate(
                prompt=full_prompt,
                negative_prompt=FANTAZY_NEGATIVE_PROMPT,
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
                    "metadata": f'{{"prompt": "{full_prompt[:500]}", "model": "{response.model}"}}',
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
