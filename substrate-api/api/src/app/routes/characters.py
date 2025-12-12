"""Characters API routes."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.models.character import (
    AvatarGalleryItem,
    Character,
    CharacterProfile,
    CharacterSummary,
    CharacterWithAvatar,
)
from app.models.world import World
from app.services.storage import StorageService

router = APIRouter(prefix="/characters", tags=["Characters"])


@router.get("", response_model=List[CharacterSummary])
async def list_characters(
    archetype: Optional[str] = Query(None, description="Filter by archetype"),
    include_premium: bool = Query(True, description="Include premium characters"),
    db=Depends(get_db),
):
    """List all available characters with avatar URLs from kits."""
    conditions = ["c.is_active = TRUE"]
    values = {}

    if archetype:
        conditions.append("c.archetype = :archetype")
        values["archetype"] = archetype

    if not include_premium:
        conditions.append("c.is_premium = FALSE")

    # Join with avatar_kits and avatar_assets to get primary anchor path
    query = f"""
        SELECT c.id, c.name, c.slug, c.archetype, c.avatar_url,
               c.short_backstory, c.is_premium,
               aa.storage_path as anchor_path
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id AND ak.status = 'active'
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

        # If no avatar_url but has anchor_path, generate signed URL
        if not data["avatar_url"] and anchor_path:
            if storage is None:
                storage = StorageService.get_instance()
            data["avatar_url"] = await storage.create_signed_url("avatars", anchor_path)

        results.append(CharacterSummary(**data))

    return results


@router.get("/archetypes/list", response_model=List[str])
async def list_archetypes(
    db=Depends(get_db),
):
    """List all available character archetypes."""
    query = """
        SELECT DISTINCT archetype FROM characters
        WHERE is_active = TRUE
        ORDER BY archetype
    """
    rows = await db.fetch_all(query)
    return [row["archetype"] for row in rows]


@router.get("/{character_id}", response_model=Character)
async def get_character(
    character_id: UUID,
    db=Depends(get_db),
):
    """Get a specific character by ID."""
    query = """
        SELECT * FROM characters
        WHERE id = :character_id AND is_active = TRUE
    """
    row = await db.fetch_one(query, {"character_id": str(character_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    return Character(**dict(row))


@router.get("/slug/{slug}", response_model=Character)
async def get_character_by_slug(
    slug: str,
    db=Depends(get_db),
):
    """Get a specific character by slug."""
    query = """
        SELECT * FROM characters
        WHERE slug = :slug AND is_active = TRUE
    """
    row = await db.fetch_one(query, {"slug": slug})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    return Character(**dict(row))


@router.get("/slug/{slug}/profile", response_model=CharacterProfile)
async def get_character_profile(
    slug: str,
    db=Depends(get_db),
):
    """Get character profile with avatar gallery for the detail page."""
    # Get character
    query = """
        SELECT id, name, slug, archetype, avatar_url, short_backstory,
               full_backstory, likes, dislikes, starter_prompts, is_premium,
               active_avatar_kit_id
        FROM characters
        WHERE slug = :slug AND is_active = TRUE
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
                SELECT id, asset_type, expression, storage_path
                FROM avatar_assets
                WHERE avatar_kit_id = :kit_id AND is_active = TRUE
                ORDER BY is_canonical DESC, created_at ASC
            """
            assets = await db.fetch_all(assets_query, {"kit_id": str(active_kit_id)})

            if assets:
                storage = StorageService.get_instance()
                for asset in assets:
                    signed_url = await storage.create_signed_url(
                        "avatars", asset["storage_path"]
                    )
                    is_primary = str(asset["id"]) == str(primary_anchor_id) if primary_anchor_id else False

                    gallery.append(AvatarGalleryItem(
                        id=asset["id"],
                        asset_type=asset["asset_type"],
                        expression=asset["expression"],
                        image_url=signed_url,
                        is_primary=is_primary,
                    ))

                    # Track primary avatar URL
                    if is_primary:
                        primary_avatar_url = signed_url

    data["gallery"] = gallery
    data["primary_avatar_url"] = primary_avatar_url

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
