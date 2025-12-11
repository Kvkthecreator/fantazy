"""Episodes API routes."""
from datetime import datetime
from typing import List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.episode import Episode, EpisodeCreate, EpisodeSummary, EpisodeUpdate

router = APIRouter(prefix="/episodes", tags=["Episodes"])


@router.get("", response_model=List[EpisodeSummary])
async def list_episodes(
    user_id: UUID = Depends(get_current_user_id),
    character_id: Optional[UUID] = Query(None),
    active_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db=Depends(get_db),
):
    """List episodes for the current user."""
    conditions = ["user_id = $1"]
    values = [user_id]
    param_idx = 2

    if character_id:
        conditions.append(f"character_id = ${param_idx}")
        values.append(character_id)
        param_idx += 1

    if active_only:
        conditions.append("is_active = TRUE")

    values.extend([limit, offset])
    query = f"""
        SELECT id, character_id, episode_number, title, started_at, ended_at,
               message_count, is_active
        FROM episodes
        WHERE {" AND ".join(conditions)}
        ORDER BY started_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """

    rows = await db.fetch_all(query, values)
    return [EpisodeSummary(**dict(row)) for row in rows]


@router.post("", response_model=Episode, status_code=status.HTTP_201_CREATED)
async def create_episode(
    data: EpisodeCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Start a new episode with a character."""
    # Get or create relationship
    rel_query = """
        INSERT INTO relationships (user_id, character_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, character_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
    """
    rel_row = await db.fetch_one(rel_query, [user_id, data.character_id])
    relationship_id = rel_row["id"]

    # Close any active episodes with this character
    close_query = """
        UPDATE episodes
        SET is_active = FALSE, ended_at = NOW()
        WHERE user_id = $1 AND character_id = $2 AND is_active = TRUE
    """
    await db.execute(close_query, [user_id, data.character_id])

    # Get next episode number
    count_query = """
        SELECT COALESCE(MAX(episode_number), 0) + 1 as next_num
        FROM episodes
        WHERE user_id = $1 AND character_id = $2
    """
    count_row = await db.fetch_one(count_query, [user_id, data.character_id])
    episode_number = count_row["next_num"]

    # Create new episode
    query = """
        INSERT INTO episodes (user_id, character_id, relationship_id, episode_number, title, scene)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    """
    row = await db.fetch_one(
        query,
        [
            user_id,
            data.character_id,
            relationship_id,
            episode_number,
            data.title,
            data.scene,
        ],
    )

    return Episode(**dict(row))


@router.get("/active/{character_id}")
async def get_active_episode(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
) -> Optional[Episode]:
    """Get the active episode with a character, if any."""
    query = """
        SELECT * FROM episodes
        WHERE user_id = $1 AND character_id = $2 AND is_active = TRUE
        ORDER BY started_at DESC
        LIMIT 1
    """
    row = await db.fetch_one(query, [user_id, character_id])

    if not row:
        return None

    return Episode(**dict(row))


@router.get("/{episode_id}", response_model=Episode)
async def get_episode(
    episode_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get a specific episode."""
    query = """
        SELECT * FROM episodes
        WHERE id = $1 AND user_id = $2
    """
    row = await db.fetch_one(query, [episode_id, user_id])

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found",
        )

    return Episode(**dict(row))


@router.patch("/{episode_id}", response_model=Episode)
async def update_episode(
    episode_id: UUID,
    data: EpisodeUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update an episode."""
    updates = []
    values = []
    param_idx = 1

    if data.title is not None:
        updates.append(f"title = ${param_idx}")
        values.append(data.title)
        param_idx += 1

    if data.scene is not None:
        updates.append(f"scene = ${param_idx}")
        values.append(data.scene)
        param_idx += 1

    if data.is_active is not None:
        updates.append(f"is_active = ${param_idx}")
        values.append(data.is_active)
        param_idx += 1
        if not data.is_active:
            updates.append(f"ended_at = ${param_idx}")
            values.append(datetime.utcnow())
            param_idx += 1

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    values.extend([episode_id, user_id])
    query = f"""
        UPDATE episodes
        SET {", ".join(updates)}
        WHERE id = ${param_idx} AND user_id = ${param_idx + 1}
        RETURNING *
    """

    row = await db.fetch_one(query, values)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found",
        )

    return Episode(**dict(row))


@router.post("/{episode_id}/end", response_model=Episode)
async def end_episode(
    episode_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """End an active episode."""
    query = """
        UPDATE episodes
        SET is_active = FALSE, ended_at = NOW()
        WHERE id = $1 AND user_id = $2 AND is_active = TRUE
        RETURNING *
    """
    row = await db.fetch_one(query, [episode_id, user_id])

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active episode not found",
        )

    return Episode(**dict(row))
