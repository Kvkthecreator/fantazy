"""Characters API routes."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.models.character import Character, CharacterSummary
from app.models.world import World

router = APIRouter(prefix="/characters", tags=["Characters"])


@router.get("", response_model=List[CharacterSummary])
async def list_characters(
    archetype: Optional[str] = Query(None, description="Filter by archetype"),
    include_premium: bool = Query(True, description="Include premium characters"),
    db=Depends(get_db),
):
    """List all available characters."""
    conditions = ["is_active = TRUE"]
    values = []
    param_idx = 1

    if archetype:
        conditions.append(f"archetype = ${param_idx}")
        values.append(archetype)
        param_idx += 1

    if not include_premium:
        conditions.append("is_premium = FALSE")

    query = f"""
        SELECT id, name, slug, archetype, avatar_url, short_backstory, is_premium
        FROM characters
        WHERE {" AND ".join(conditions)}
        ORDER BY sort_order, name
    """

    rows = await db.fetch_all(query, values)
    return [CharacterSummary(**dict(row)) for row in rows]


@router.get("/{character_id}", response_model=Character)
async def get_character(
    character_id: UUID,
    db=Depends(get_db),
):
    """Get a specific character by ID."""
    query = """
        SELECT * FROM characters
        WHERE id = $1 AND is_active = TRUE
    """
    row = await db.fetch_one(query, [character_id])

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
        WHERE slug = $1 AND is_active = TRUE
    """
    row = await db.fetch_one(query, [slug])

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    return Character(**dict(row))


@router.get("/{character_id}/world", response_model=World)
async def get_character_world(
    character_id: UUID,
    db=Depends(get_db),
):
    """Get the world a character belongs to."""
    query = """
        SELECT w.* FROM worlds w
        JOIN characters c ON c.world_id = w.id
        WHERE c.id = $1 AND c.is_active = TRUE
    """
    row = await db.fetch_one(query, [character_id])

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character or world not found",
        )

    return World(**dict(row))


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
