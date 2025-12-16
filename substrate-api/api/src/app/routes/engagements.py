"""Engagements API routes (formerly Relationships)."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.engagement import (
    Engagement,
    EngagementCreate,
    EngagementUpdate,
    EngagementWithCharacter,
)

router = APIRouter(prefix="/engagements", tags=["Engagements"])


@router.get("", response_model=List[EngagementWithCharacter])
async def list_engagements(
    user_id: UUID = Depends(get_current_user_id),
    include_archived: bool = Query(False),
    db=Depends(get_db),
):
    """List all engagements for the current user."""
    conditions = ["e.user_id = :user_id"]
    values = {"user_id": str(user_id)}

    if not include_archived:
        conditions.append("e.is_archived = FALSE")

    query = f"""
        SELECT
            e.*,
            c.name as character_name,
            c.slug as character_slug,
            c.archetype as character_archetype,
            c.avatar_url as character_avatar_url
        FROM engagements e
        JOIN characters c ON c.id = e.character_id
        WHERE {" AND ".join(conditions)}
        ORDER BY e.is_favorite DESC, e.last_interaction_at DESC NULLS LAST
    """

    rows = await db.fetch_all(query, values)
    return [EngagementWithCharacter(**dict(row)) for row in rows]


@router.post("", response_model=Engagement, status_code=status.HTTP_201_CREATED)
async def create_engagement(
    data: EngagementCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Create a new engagement with a character."""
    # Check if character exists
    char_query = "SELECT id FROM characters WHERE id = :character_id AND is_active = TRUE"
    char_row = await db.fetch_one(char_query, {"character_id": str(data.character_id)})

    if not char_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    # Check if engagement already exists
    existing_query = """
        SELECT id FROM engagements
        WHERE user_id = :user_id AND character_id = :character_id
    """
    existing = await db.fetch_one(existing_query, {"user_id": str(user_id), "character_id": str(data.character_id)})

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Engagement already exists",
        )

    # Create engagement
    query = """
        INSERT INTO engagements (user_id, character_id)
        VALUES (:user_id, :character_id)
        RETURNING *
    """
    row = await db.fetch_one(query, {"user_id": str(user_id), "character_id": str(data.character_id)})
    return Engagement(**dict(row))


@router.get("/{engagement_id}", response_model=Engagement)
async def get_engagement(
    engagement_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get a specific engagement."""
    query = """
        SELECT * FROM engagements
        WHERE id = :engagement_id AND user_id = :user_id
    """
    row = await db.fetch_one(query, {"engagement_id": str(engagement_id), "user_id": str(user_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Engagement not found",
        )

    return Engagement(**dict(row))


@router.get("/character/{character_id}", response_model=Engagement)
async def get_engagement_by_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get engagement with a specific character."""
    query = """
        SELECT * FROM engagements
        WHERE user_id = :user_id AND character_id = :character_id
    """
    row = await db.fetch_one(query, {"user_id": str(user_id), "character_id": str(character_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No engagement with this character",
        )

    return Engagement(**dict(row))


@router.patch("/{engagement_id}", response_model=Engagement)
async def update_engagement(
    engagement_id: UUID,
    data: EngagementUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update an engagement."""
    updates = []
    values = {"engagement_id": str(engagement_id), "user_id": str(user_id)}

    if data.nickname is not None:
        updates.append("nickname = :nickname")
        values["nickname"] = data.nickname

    if data.is_favorite is not None:
        updates.append("is_favorite = :is_favorite")
        values["is_favorite"] = data.is_favorite

    if data.is_archived is not None:
        updates.append("is_archived = :is_archived")
        values["is_archived"] = data.is_archived

    if data.engagement_notes is not None:
        updates.append("engagement_notes = :engagement_notes")
        values["engagement_notes"] = data.engagement_notes

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    query = f"""
        UPDATE engagements
        SET {", ".join(updates)}, updated_at = NOW()
        WHERE id = :engagement_id AND user_id = :user_id
        RETURNING *
    """

    row = await db.fetch_one(query, values)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Engagement not found",
        )

    return Engagement(**dict(row))
