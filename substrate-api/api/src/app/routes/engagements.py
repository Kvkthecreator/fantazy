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

    # Use upsert pattern - return existing if already exists
    query = """
        INSERT INTO engagements (user_id, character_id)
        VALUES (:user_id, :character_id)
        ON CONFLICT (user_id, character_id) DO UPDATE SET updated_at = NOW()
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


@router.delete("/character/{character_id}/reset", status_code=status.HTTP_200_OK)
async def reset_relationship(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Reset entire relationship with a character.

    This performs a full purge:
    - Deletes all sessions (and their messages via CASCADE)
    - Soft-deletes all memories scoped to this character
    - Resets engagement stats to initial state

    This action is irreversible.
    """
    # Verify engagement exists
    check_query = """
        SELECT id FROM engagements
        WHERE user_id = :user_id AND character_id = :character_id
    """
    engagement = await db.fetch_one(
        check_query, {"user_id": str(user_id), "character_id": str(character_id)}
    )

    if not engagement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No relationship with this character",
        )

    # 1. Delete all sessions with this character (messages cascade automatically)
    delete_sessions_query = """
        DELETE FROM sessions
        WHERE user_id = :user_id AND character_id = :character_id
    """
    await db.execute(
        delete_sessions_query, {"user_id": str(user_id), "character_id": str(character_id)}
    )

    # 2. Soft-delete all memories scoped to this character
    delete_memories_query = """
        UPDATE memory_events
        SET is_active = FALSE
        WHERE user_id = :user_id AND character_id = :character_id
    """
    await db.execute(
        delete_memories_query, {"user_id": str(user_id), "character_id": str(character_id)}
    )

    # 3. Reset engagement stats to initial state
    # Note: DB uses total_episodes/relationship_notes, model aliases as total_sessions/engagement_notes
    reset_engagement_query = """
        UPDATE engagements
        SET
            total_episodes = 0,
            total_messages = 0,
            first_met_at = NOW(),
            last_interaction_at = NULL,
            dynamic = '{"tone": "warm", "tension_level": 30, "recent_beats": []}'::jsonb,
            milestones = '{}',
            nickname = NULL,
            inside_jokes = '{}',
            relationship_notes = NULL,
            stage = 'acquaintance',
            stage_progress = 0,
            updated_at = NOW()
        WHERE user_id = :user_id AND character_id = :character_id
        RETURNING id
    """
    await db.fetch_one(
        reset_engagement_query, {"user_id": str(user_id), "character_id": str(character_id)}
    )

    return {"status": "reset", "character_id": str(character_id)}


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
        # DB column is relationship_notes, model field is engagement_notes
        updates.append("relationship_notes = :relationship_notes")
        values["relationship_notes"] = data.engagement_notes

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
