"""Characters API routes.

Includes:
- Public character endpoints (list, get by ID/slug)
- User character CRUD (ADR-004: User Character Customization)
"""
import logging
import re
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.character import (
    AvatarGalleryItem,
    Character,
    CharacterProfile,
    CharacterSummary,
    CharacterWithAvatar,
    UserCharacterCreate,
    UserCharacterUpdate,
    UserCharacterResponse,
    PERSONALITY_PRESETS,
    FLIRTING_LEVELS,
    USER_ARCHETYPES,
    build_system_prompt,
)
from app.models.world import World
from app.services.storage import StorageService
from app.services.avatar_generation import AvatarGenerationService
from app.services.credits import CreditsService, InsufficientSparksError

log = logging.getLogger(__name__)

router = APIRouter(prefix="/characters", tags=["Characters"])

# Maximum user characters per user (free tier)
MAX_USER_CHARACTERS_FREE = 1

# Spark cost for avatar regeneration (first generation is free)
AVATAR_REGENERATION_COST = 5


@router.get("", response_model=List[CharacterSummary])
async def list_characters(
    archetype: Optional[str] = Query(None, description="Filter by archetype"),
    include_premium: bool = Query(True, description="Include premium characters"),
    db=Depends(get_db),
):
    """List all available characters with avatar URLs from kits.

    Only returns active characters (status='active'). Drafts are never exposed.
    """
    # Belt-and-suspenders: check both status and is_active (trigger keeps them in sync)
    conditions = ["c.status = 'active'", "c.is_active = TRUE"]
    values = {}

    if archetype:
        conditions.append("c.archetype = :archetype")
        values["archetype"] = archetype

    if not include_premium:
        conditions.append("c.is_premium = FALSE")

    # Join with avatar_kits and avatar_assets to get primary anchor path
    query = f"""
        SELECT c.id, c.name, c.slug, c.archetype, c.avatar_url,
               c.backstory, c.is_premium,
               aa.storage_path as anchor_path
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id AND aa.is_active = TRUE
        WHERE {" AND ".join(conditions)}
        ORDER BY c.sort_order, c.name
    """

    rows = await db.fetch_all(query, values if values else None)

    # Process rows - generate signed URLs for anchor images
    results = []
    storage = None

    for row in rows:
        data = dict(row)
        anchor_path = data.pop("anchor_path", None)

        # Always prefer fresh signed URL from anchor_path (avoids expired URLs)
        if anchor_path:
            if storage is None:
                storage = StorageService.get_instance()
            data["avatar_url"] = await storage.create_signed_url("avatars", anchor_path)

        results.append(CharacterSummary(**data))

    return results


@router.get("/archetypes/list", response_model=List[str])
async def list_archetypes(
    db=Depends(get_db),
):
    """List all available character archetypes (from active characters only)."""
    query = """
        SELECT DISTINCT archetype FROM characters
        WHERE status = 'active' AND is_active = TRUE
        ORDER BY archetype
    """
    rows = await db.fetch_all(query)
    return [row["archetype"] for row in rows]


# =============================================================================
# User Character CRUD - MUST be before /{character_id} route!
# =============================================================================

def generate_slug(name: str) -> str:
    """Generate a URL-safe slug from a name."""
    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower())
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    # Add timestamp for uniqueness
    timestamp = int(datetime.utcnow().timestamp())
    return f"{slug}-{timestamp}"


@router.get("/mine", response_model=List[UserCharacterResponse])
async def list_my_characters(
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """List the current user's created characters.

    Returns all characters created by the authenticated user.
    Uses permanent public URLs for avatars.
    """
    query = """
        SELECT c.id, c.name, c.slug, c.archetype, c.avatar_url,
               c.appearance_prompt, c.style_preset,
               c.boundaries->>'flirting_level' as flirting_level,
               c.is_user_created, c.created_at, c.updated_at,
               aa.storage_path as anchor_path
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id AND aa.is_active = TRUE
        WHERE c.created_by = :user_id AND c.is_user_created = TRUE
        ORDER BY c.created_at DESC
    """
    rows = await db.fetch_all(query, {"user_id": str(user_id)})

    results = []
    storage = None

    for row in rows:
        data = dict(row)
        anchor_path = data.pop("anchor_path", None)
        current_avatar_url = data.get("avatar_url", "")

        # Ensure flirting_level has a default
        if not data.get("flirting_level"):
            data["flirting_level"] = "playful"

        # For user-uploaded avatars (public URLs), keep the direct URL
        # For kit-based avatars, use permanent public URL from anchor_path
        is_uploaded_avatar = current_avatar_url and "user-uploads/" in current_avatar_url
        if anchor_path and not is_uploaded_avatar:
            if storage is None:
                storage = StorageService.get_instance()
            data["avatar_url"] = storage.get_public_url("avatars", anchor_path)

        results.append(UserCharacterResponse(**data))

    return results


@router.get("/mine/{character_id}", response_model=UserCharacterResponse)
async def get_my_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get a single user-created character by ID.

    Only returns characters owned by the authenticated user.
    Uses permanent public URLs for avatars.
    """
    query = """
        SELECT c.id, c.name, c.slug, c.archetype, c.avatar_url,
               c.appearance_prompt, c.style_preset,
               c.boundaries->>'flirting_level' as flirting_level,
               c.is_user_created, c.created_at, c.updated_at,
               aa.storage_path as anchor_path
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id AND aa.is_active = TRUE
        WHERE c.id = :character_id AND c.created_by = :user_id AND c.is_user_created = TRUE
    """
    row = await db.fetch_one(query, {"character_id": str(character_id), "user_id": str(user_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    data = dict(row)
    anchor_path = data.pop("anchor_path", None)
    current_avatar_url = data.get("avatar_url", "")

    # Ensure flirting_level has a default
    if not data.get("flirting_level"):
        data["flirting_level"] = "playful"

    # For user-uploaded avatars (public URLs), keep the direct URL
    # For kit-based avatars, use permanent public URL from anchor_path
    is_uploaded_avatar = current_avatar_url and "user-uploads/" in current_avatar_url
    if anchor_path and not is_uploaded_avatar:
        storage = StorageService.get_instance()
        data["avatar_url"] = storage.get_public_url("avatars", anchor_path)

    return UserCharacterResponse(**data)


@router.get("/{character_id}", response_model=Character)
async def get_character(
    character_id: UUID,
    db=Depends(get_db),
):
    """Get a specific character by ID with avatar from kit if available.

    Only returns active characters. Drafts are never exposed via public API.
    """
    query = """
        SELECT c.*, aa.storage_path as anchor_path
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id AND aa.is_active = TRUE
        WHERE c.id = :character_id AND c.status = 'active' AND c.is_active = TRUE
    """
    row = await db.fetch_one(query, {"character_id": str(character_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    data = dict(row)
    anchor_path = data.pop("anchor_path", None)
    current_avatar_url = data.get("avatar_url", "")

    # For user-uploaded avatars (public URLs), keep the direct URL
    # For kit-based avatars, generate fresh signed URL from anchor_path
    is_uploaded_avatar = current_avatar_url and "user-uploads/" in current_avatar_url
    if anchor_path and not is_uploaded_avatar:
        storage = StorageService.get_instance()
        data["avatar_url"] = await storage.create_signed_url("avatars", anchor_path)

    return Character(**data)


@router.get("/slug/{slug}", response_model=Character)
async def get_character_by_slug(
    slug: str,
    db=Depends(get_db),
):
    """Get a specific character by slug with avatar from kit if available.

    Only returns active characters. Drafts are never exposed via public API.
    """
    query = """
        SELECT c.*, aa.storage_path as anchor_path
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id AND aa.is_active = TRUE
        WHERE c.slug = :slug AND c.status = 'active' AND c.is_active = TRUE
    """
    row = await db.fetch_one(query, {"slug": slug})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    data = dict(row)
    anchor_path = data.pop("anchor_path", None)
    current_avatar_url = data.get("avatar_url", "")

    # For user-uploaded avatars (public URLs), keep the direct URL
    # For kit-based avatars, generate fresh signed URL from anchor_path
    is_uploaded_avatar = current_avatar_url and "user-uploads/" in current_avatar_url
    if anchor_path and not is_uploaded_avatar:
        storage = StorageService.get_instance()
        data["avatar_url"] = await storage.create_signed_url("avatars", anchor_path)

    return Character(**data)


@router.get("/slug/{slug}/profile", response_model=CharacterProfile)
async def get_character_profile(
    slug: str,
    db=Depends(get_db),
):
    """Get character profile with avatar gallery for the detail page.

    Only returns active characters. Drafts are never exposed via public API.
    """
    import logging
    log = logging.getLogger(__name__)

    # Get character - only active ones
    # NOTE: starter_prompts removed - now on episode_templates (EP-01 Episode-First Pivot)
    # NOTE: short_backstory/full_backstory merged into backstory
    query = """
        SELECT id, name, slug, archetype, avatar_url, backstory,
               likes, dislikes, is_premium,
               active_avatar_kit_id
        FROM characters
        WHERE slug = :slug AND status = 'active' AND is_active = TRUE
    """
    row = await db.fetch_one(query, {"slug": slug})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    data = dict(row)
    gallery = []
    primary_avatar_url = None
    active_kit_id = data.pop("active_avatar_kit_id", None)

    # Get avatar gallery if character has an active kit
    if active_kit_id:
        try:
            # Get kit with primary anchor
            kit_query = """
                SELECT primary_anchor_id FROM avatar_kits
                WHERE id = :kit_id AND status = 'active'
            """
            kit = await db.fetch_one(kit_query, {"kit_id": str(active_kit_id)})

            if kit:
                primary_anchor_id = kit["primary_anchor_id"]

                # Get all active assets for this kit
                assets_query = """
                    SELECT id, label, storage_path
                    FROM avatar_assets
                    WHERE avatar_kit_id = :kit_id AND is_active = TRUE
                    ORDER BY is_canonical DESC, created_at ASC
                """
                assets = await db.fetch_all(assets_query, {"kit_id": str(active_kit_id)})

                if assets:
                    storage = StorageService.get_instance()
                    for asset in assets:
                        # Skip assets without storage_path
                        if not asset["storage_path"]:
                            log.warning(f"Asset {asset['id']} has no storage_path, skipping")
                            continue

                        try:
                            signed_url = await storage.create_signed_url(
                                "avatars", asset["storage_path"]
                            )
                            is_primary = str(asset["id"]) == str(primary_anchor_id) if primary_anchor_id else False

                            gallery.append(AvatarGalleryItem(
                                id=asset["id"],
                                url=signed_url,
                                label=asset["label"],
                                is_primary=is_primary,
                            ))

                            # Track primary avatar URL
                            if is_primary:
                                primary_avatar_url = signed_url
                        except Exception as e:
                            log.error(f"Failed to create signed URL for asset {asset['id']}: {e}")
                            continue
        except Exception as e:
            log.error(f"Failed to load avatar gallery for character {slug}: {e}")
            # Continue without gallery - don't fail the whole request

    data["gallery"] = gallery
    data["primary_avatar_url"] = primary_avatar_url

    # Use primary_avatar_url as avatar_url fallback if avatar_url is null
    if not data["avatar_url"] and primary_avatar_url:
        data["avatar_url"] = primary_avatar_url

    return CharacterProfile(**data)


@router.get("/{character_id}/world", response_model=World)
async def get_character_world(
    character_id: UUID,
    db=Depends(get_db),
):
    """Get the world a character belongs to."""
    query = """
        SELECT w.* FROM worlds w
        JOIN characters c ON c.world_id = w.id
        WHERE c.id = :character_id AND c.is_active = TRUE
    """
    row = await db.fetch_one(query, {"character_id": str(character_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character or world not found",
        )

    return World(**dict(row))


@router.post("", response_model=UserCharacterResponse, status_code=status.HTTP_201_CREATED)
async def create_user_character(
    data: UserCharacterCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Create a new user character with avatar.

    ADR-004: User characters have simplified creation:
    - Name, appearance prompt, archetype, flirting level
    - System prompt is auto-generated from archetype preset
    - Avatar is generated synchronously during creation (enforced upstream)

    Monetization:
    - First character slot is free
    - Initial avatar generation is free
    - Avatar regeneration costs sparks
    """
    # Check character limit
    count_query = """
        SELECT COUNT(*) as count FROM characters
        WHERE created_by = :user_id AND is_user_created = TRUE
    """
    count_row = await db.fetch_one(count_query, {"user_id": str(user_id)})
    current_count = count_row["count"] if count_row else 0

    if current_count >= MAX_USER_CHARACTERS_FREE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Character limit reached ({MAX_USER_CHARACTERS_FREE}). Upgrade for more slots.",
        )

    # Validate archetype
    if data.archetype not in USER_ARCHETYPES and data.archetype not in PERSONALITY_PRESETS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid archetype. Choose from: {list(USER_ARCHETYPES.keys())}",
        )

    # Validate flirting level
    if data.flirting_level not in FLIRTING_LEVELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid flirting level. Choose from: {FLIRTING_LEVELS}",
        )

    # Generate slug
    slug = generate_slug(data.name)

    # Get personality preset
    personality = PERSONALITY_PRESETS.get(
        data.archetype,
        PERSONALITY_PRESETS.get("warm_supportive")
    )

    # Build boundaries (include appearance_prompt for avatar generation)
    boundaries = {
        "nsfw_allowed": False,  # User characters are SFW only for now
        "flirting_level": data.flirting_level,
        "appearance_prompt": data.appearance_prompt,
    }

    # Generate system prompt from archetype
    system_prompt = build_system_prompt(
        name=data.name,
        archetype=data.archetype,
        personality=personality,
        boundaries=boundaries,
        tone_style={},
        speech_patterns={},
        backstory=None,  # User characters don't have backstory
        likes=[],
        dislikes=[],
    )

    # Insert character
    insert_query = """
        INSERT INTO characters (
            name, slug, archetype, baseline_personality, boundaries,
            system_prompt, status, is_active, is_user_created, created_by,
            content_rating, created_at, updated_at
        ) VALUES (
            :name, :slug, :archetype, :personality, :boundaries,
            :system_prompt, 'active', TRUE, TRUE, :user_id,
            'sfw', NOW(), NOW()
        )
        RETURNING id, name, slug, archetype, avatar_url,
                  boundaries->>'flirting_level' as flirting_level,
                  is_user_created, created_at, updated_at
    """

    import json
    row = await db.fetch_one(insert_query, {
        "name": data.name,
        "slug": slug,
        "archetype": data.archetype,
        "personality": json.dumps(personality),
        "boundaries": json.dumps(boundaries),
        "system_prompt": system_prompt,
        "user_id": str(user_id),
    })

    if not row:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create character",
        )

    result = dict(row)
    if not result.get("flirting_level"):
        result["flirting_level"] = data.flirting_level

    character_id = result["id"]
    log.info(f"User {user_id} created character {character_id} ({data.name})")

    # Generate avatar synchronously (Option A: enforce complete character at creation)
    # Use user-selected style preset (default: manhwa)
    style_preset = data.style_preset if data.style_preset in ("manhwa", "anime", "cinematic") else "manhwa"
    try:
        service = AvatarGenerationService()
        avatar_result = await service.generate_portrait(
            character_id=character_id,
            user_id=user_id,
            db=db,
            appearance_description=data.appearance_prompt,
            style_preset=style_preset,
        )

        if avatar_result.success and avatar_result.image_url:
            result["avatar_url"] = avatar_result.image_url
            log.info(f"Generated avatar for user character {character_id}")
        else:
            # Avatar generation failed - log but don't fail character creation
            log.warning(f"Avatar generation failed for {character_id}: {avatar_result.error}")
            # Still return character, user can regenerate from detail page
    except Exception as e:
        log.error(f"Avatar generation error for {character_id}: {e}")
        # Don't fail character creation on avatar error

    # Include appearance_prompt in response
    result["appearance_prompt"] = data.appearance_prompt

    return UserCharacterResponse(**result)


@router.patch("/{character_id}", response_model=UserCharacterResponse)
async def update_user_character(
    character_id: UUID,
    data: UserCharacterUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update a user-created character.

    Only the character's owner can update it.
    System prompt is regenerated if archetype or flirting level changes.
    """
    # Verify ownership
    check_query = """
        SELECT id, name, archetype, boundaries, baseline_personality
        FROM characters
        WHERE id = :character_id AND created_by = :user_id AND is_user_created = TRUE
    """
    existing = await db.fetch_one(check_query, {
        "character_id": str(character_id),
        "user_id": str(user_id),
    })

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or you don't have permission to edit it",
        )

    existing_data = dict(existing)

    # Build update fields
    updates = []
    values = {"character_id": str(character_id)}

    import json

    new_name = data.name or existing_data["name"]
    new_archetype = data.archetype or existing_data["archetype"]

    # Parse existing boundaries
    existing_boundaries = existing_data.get("boundaries") or {}
    if isinstance(existing_boundaries, str):
        existing_boundaries = json.loads(existing_boundaries)

    new_flirting_level = data.flirting_level or existing_boundaries.get("flirting_level", "playful")

    if data.name:
        updates.append("name = :name")
        values["name"] = data.name

    if data.archetype:
        if data.archetype not in USER_ARCHETYPES and data.archetype not in PERSONALITY_PRESETS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid archetype. Choose from: {list(USER_ARCHETYPES.keys())}",
            )
        updates.append("archetype = :archetype")
        values["archetype"] = data.archetype

    if data.flirting_level:
        if data.flirting_level not in FLIRTING_LEVELS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid flirting level. Choose from: {FLIRTING_LEVELS}",
            )
        new_boundaries = {**existing_boundaries, "flirting_level": data.flirting_level}
        updates.append("boundaries = :boundaries")
        values["boundaries"] = json.dumps(new_boundaries)

    # Handle appearance_prompt update
    if data.appearance_prompt is not None:
        updates.append("appearance_prompt = :appearance_prompt")
        values["appearance_prompt"] = data.appearance_prompt

    # Handle style_preset update
    if data.style_preset is not None:
        valid_styles = ("manhwa", "anime", "cinematic")
        if data.style_preset not in valid_styles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid style preset. Choose from: {valid_styles}",
            )
        updates.append("style_preset = :style_preset")
        values["style_preset"] = data.style_preset

    # Regenerate system prompt if personality-affecting fields changed
    if data.archetype or data.flirting_level or data.name:
        personality = PERSONALITY_PRESETS.get(
            new_archetype,
            PERSONALITY_PRESETS.get("warm_supportive")
        )
        boundaries = {
            "nsfw_allowed": False,
            "flirting_level": new_flirting_level,
        }
        system_prompt = build_system_prompt(
            name=new_name,
            archetype=new_archetype,
            personality=personality,
            boundaries=boundaries,
            tone_style={},
            speech_patterns={},
            backstory=None,
            likes=[],
            dislikes=[],
        )
        updates.append("system_prompt = :system_prompt")
        values["system_prompt"] = system_prompt

        # Also update personality if archetype changed
        if data.archetype:
            updates.append("baseline_personality = :personality")
            values["personality"] = json.dumps(personality)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    updates.append("updated_at = NOW()")

    update_query = f"""
        UPDATE characters
        SET {", ".join(updates)}
        WHERE id = :character_id
        RETURNING id, name, slug, archetype, avatar_url, appearance_prompt, style_preset,
                  boundaries->>'flirting_level' as flirting_level,
                  is_user_created, created_at, updated_at
    """

    row = await db.fetch_one(update_query, values)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update character",
        )

    result = dict(row)
    if not result.get("flirting_level"):
        result["flirting_level"] = new_flirting_level

    log.info(f"User {user_id} updated character {character_id}")

    return UserCharacterResponse(**result)


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Delete a user-created character.

    Only the character's owner can delete it.
    This also deletes associated avatar_kits and avatar_assets.
    """
    # Verify ownership
    check_query = """
        SELECT id FROM characters
        WHERE id = :character_id AND created_by = :user_id AND is_user_created = TRUE
    """
    existing = await db.fetch_one(check_query, {
        "character_id": str(character_id),
        "user_id": str(user_id),
    })

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or you don't have permission to delete it",
        )

    # Delete character (cascade will handle avatar_kits if FK is set)
    delete_query = """
        DELETE FROM characters WHERE id = :character_id
    """
    await db.execute(delete_query, {"character_id": str(character_id)})

    log.info(f"User {user_id} deleted character {character_id}")

    return None


@router.post("/mine/{character_id}/generate-avatar")
async def generate_user_character_avatar(
    character_id: UUID,
    appearance_prompt: Optional[str] = None,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Generate avatar for a user-created character.

    Monetization:
    - First avatar generation is FREE (bundled with character creation)
    - Subsequent regenerations cost 5 sparks

    Returns the generated avatar URL and updates character.avatar_url.
    """
    # Verify ownership and get character data
    check_query = """
        SELECT id, name, archetype, boundaries, avatar_url
        FROM characters
        WHERE id = :character_id AND created_by = :user_id AND is_user_created = TRUE
    """
    existing = await db.fetch_one(check_query, {
        "character_id": str(character_id),
        "user_id": str(user_id),
    })

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or you don't have permission to edit it",
        )

    existing_data = dict(existing)
    is_first_generation = existing_data.get("avatar_url") is None

    # If not first generation, check and deduct sparks
    sparks_spent = 0
    if not is_first_generation:
        credits_service = CreditsService.get_instance()
        try:
            # Check balance before generation
            check_result = await credits_service.check_balance(
                user_id, "avatar_regeneration", explicit_cost=AVATAR_REGENERATION_COST
            )
            if not check_result.allowed:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail={
                        "error": "insufficient_sparks",
                        "message": f"Avatar regeneration costs {AVATAR_REGENERATION_COST} sparks. You have {check_result.balance}.",
                        "balance": check_result.balance,
                        "cost": AVATAR_REGENERATION_COST,
                    },
                )
            sparks_spent = AVATAR_REGENERATION_COST
        except InsufficientSparksError as e:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "insufficient_sparks",
                    "message": e.message,
                    "balance": e.balance,
                    "cost": e.cost,
                },
            )

    # Get appearance prompt from character boundaries if not provided
    if not appearance_prompt:
        import json
        boundaries = existing_data.get("boundaries") or {}
        if isinstance(boundaries, str):
            boundaries = json.loads(boundaries)
        appearance_prompt = boundaries.get("appearance_prompt")

    # Generate avatar using the avatar generation service
    service = AvatarGenerationService()
    result = await service.generate_portrait(
        character_id=character_id,
        user_id=user_id,
        db=db,
        appearance_description=appearance_prompt,
        style_preset="manhwa",  # Default style for user characters
    )

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.error or "Failed to generate avatar",
        )

    # Deduct sparks AFTER successful generation (don't charge for failures)
    if sparks_spent > 0:
        credits_service = CreditsService.get_instance()
        await credits_service.spend(
            user_id=user_id,
            feature_key="avatar_regeneration",
            reference_id=str(character_id),
            metadata={"character_name": existing_data.get("name")},
            explicit_cost=sparks_spent,
        )
        log.info(f"Charged {sparks_spent} sparks for avatar regeneration on character {character_id}")

    log.info(f"Generated avatar for user character {character_id}: {result.image_url}")

    return {
        "success": True,
        "avatar_url": result.image_url,
        "asset_id": str(result.asset_id) if result.asset_id else None,
        "kit_id": str(result.kit_id) if result.kit_id else None,
        "is_first_generation": is_first_generation,
        "sparks_spent": sparks_spent,
    }


# Maximum file size for avatar uploads (5MB)
MAX_AVATAR_SIZE = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/mine/{character_id}/upload-avatar")
async def upload_user_character_avatar(
    character_id: UUID,
    file: UploadFile = File(...),
    ip_acknowledgment: bool = Form(..., description="User acknowledges they have rights to upload this image"),
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Upload a custom avatar image for a user-created character.

    IMPORTANT: User must acknowledge IP rights before uploading.
    The ip_acknowledgment field must be true, indicating user confirms:
    - They own the rights to this image, OR
    - They have permission to use it, OR
    - The image is in the public domain

    By uploading, user accepts full responsibility for any IP claims.
    Fantazy will respond to DMCA takedown requests.

    Constraints:
    - Max file size: 5MB
    - Allowed formats: JPEG, PNG, WebP
    - No spark cost (free alternative to generation)

    Returns the public URL of the uploaded avatar.
    """
    # Verify IP acknowledgment
    if not ip_acknowledgment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "ip_acknowledgment_required",
                "message": "You must confirm you have the rights to upload this image.",
            },
        )

    # Verify ownership
    check_query = """
        SELECT id, name, active_avatar_kit_id
        FROM characters
        WHERE id = :character_id AND created_by = :user_id AND is_user_created = TRUE
    """
    existing = await db.fetch_one(check_query, {
        "character_id": str(character_id),
        "user_id": str(user_id),
    })

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or you don't have permission to edit it",
        )

    existing_data = dict(existing)

    # Validate file type
    content_type = file.content_type
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: JPEG, PNG, WebP",
        )

    # Read file and check size
    file_content = await file.read()
    if len(file_content) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: 5MB",
        )

    # Determine file extension
    ext_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }
    ext = ext_map.get(content_type, "png")

    # Generate storage path: user-uploads/{character_id}/{uuid}.{ext}
    asset_id = uuid4()
    storage_path = f"user-uploads/{character_id}/{asset_id}.{ext}"

    # Upload to storage
    storage = StorageService.get_instance()
    await storage._upload("avatars", storage_path, file_content, content_type)

    # Get public URL
    public_url = storage.get_public_url("avatars", storage_path)

    # Update character's avatar_url directly (no kit for uploads)
    update_query = """
        UPDATE characters
        SET avatar_url = :avatar_url,
            updated_at = NOW()
        WHERE id = :character_id
    """
    await db.execute(update_query, {
        "avatar_url": public_url,
        "character_id": str(character_id),
    })

    log.info(f"User {user_id} uploaded avatar for character {character_id}: {storage_path}")

    return {
        "success": True,
        "avatar_url": public_url,
        "source": "uploaded",
        "message": "Avatar uploaded successfully. You acknowledged having rights to this image.",
    }
