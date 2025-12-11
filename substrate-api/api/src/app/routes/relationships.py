"""Relationships API routes."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.relationship import (
    Relationship,
    RelationshipCreate,
    RelationshipUpdate,
    RelationshipWithCharacter,
)

router = APIRouter(prefix="/relationships", tags=["Relationships"])


@router.get("", response_model=List[RelationshipWithCharacter])
async def list_relationships(
    user_id: UUID = Depends(get_current_user_id),
    include_archived: bool = Query(False),
    db=Depends(get_db),
):
    """List all relationships for the current user."""
    conditions = ["r.user_id = $1"]
    values = [user_id]

    if not include_archived:
        conditions.append("r.is_archived = FALSE")

    query = f"""
        SELECT
            r.*,
            c.name as character_name,
            c.slug as character_slug,
            c.archetype as character_archetype,
            c.avatar_url as character_avatar_url
        FROM relationships r
        JOIN characters c ON c.id = r.character_id
        WHERE {" AND ".join(conditions)}
        ORDER BY r.is_favorite DESC, r.last_interaction_at DESC NULLS LAST
    """

    rows = await db.fetch_all(query, values)
    return [RelationshipWithCharacter(**dict(row)) for row in rows]


@router.post("", response_model=Relationship, status_code=status.HTTP_201_CREATED)
async def create_relationship(
    data: RelationshipCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Create a new relationship with a character."""
    # Check if character exists
    char_query = "SELECT id FROM characters WHERE id = $1 AND is_active = TRUE"
    char_row = await db.fetch_one(char_query, [data.character_id])

    if not char_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    # Check if relationship already exists
    existing_query = """
        SELECT id FROM relationships
        WHERE user_id = $1 AND character_id = $2
    """
    existing = await db.fetch_one(existing_query, [user_id, data.character_id])

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Relationship already exists",
        )

    # Create relationship
    query = """
        INSERT INTO relationships (user_id, character_id)
        VALUES ($1, $2)
        RETURNING *
    """
    row = await db.fetch_one(query, [user_id, data.character_id])
    return Relationship(**dict(row))


@router.get("/{relationship_id}", response_model=Relationship)
async def get_relationship(
    relationship_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get a specific relationship."""
    query = """
        SELECT * FROM relationships
        WHERE id = $1 AND user_id = $2
    """
    row = await db.fetch_one(query, [relationship_id, user_id])

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relationship not found",
        )

    return Relationship(**dict(row))


@router.get("/character/{character_id}", response_model=Relationship)
async def get_relationship_by_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get relationship with a specific character."""
    query = """
        SELECT * FROM relationships
        WHERE user_id = $1 AND character_id = $2
    """
    row = await db.fetch_one(query, [user_id, character_id])

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No relationship with this character",
        )

    return Relationship(**dict(row))


@router.patch("/{relationship_id}", response_model=Relationship)
async def update_relationship(
    relationship_id: UUID,
    data: RelationshipUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update a relationship."""
    updates = []
    values = []
    param_idx = 1

    if data.nickname is not None:
        updates.append(f"nickname = ${param_idx}")
        values.append(data.nickname)
        param_idx += 1

    if data.is_favorite is not None:
        updates.append(f"is_favorite = ${param_idx}")
        values.append(data.is_favorite)
        param_idx += 1

    if data.is_archived is not None:
        updates.append(f"is_archived = ${param_idx}")
        values.append(data.is_archived)
        param_idx += 1

    if data.relationship_notes is not None:
        updates.append(f"relationship_notes = ${param_idx}")
        values.append(data.relationship_notes)
        param_idx += 1

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    values.extend([relationship_id, user_id])
    query = f"""
        UPDATE relationships
        SET {", ".join(updates)}, updated_at = NOW()
        WHERE id = ${param_idx} AND user_id = ${param_idx + 1}
        RETURNING *
    """

    row = await db.fetch_one(query, values)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relationship not found",
        )

    return Relationship(**dict(row))
