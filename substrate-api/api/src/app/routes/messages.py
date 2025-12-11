"""Messages API routes."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.message import Message, MessageCreate

router = APIRouter(prefix="/episodes/{episode_id}/messages", tags=["Messages"])


@router.get("", response_model=List[Message])
async def list_messages(
    episode_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    limit: int = Query(50, ge=1, le=200),
    before_id: Optional[UUID] = Query(None, description="Get messages before this ID"),
    db=Depends(get_db),
):
    """List messages in an episode."""
    # Verify episode ownership
    episode_check = """
        SELECT id FROM episodes
        WHERE id = $1 AND user_id = $2
    """
    episode_row = await db.fetch_one(episode_check, [episode_id, user_id])

    if not episode_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found",
        )

    # Build query
    conditions = ["episode_id = $1"]
    values = [episode_id]
    param_idx = 2

    if before_id:
        conditions.append(f"""
            created_at < (SELECT created_at FROM messages WHERE id = ${param_idx})
        """)
        values.append(before_id)
        param_idx += 1

    values.append(limit)
    query = f"""
        SELECT * FROM messages
        WHERE {" AND ".join(conditions)}
        ORDER BY created_at DESC
        LIMIT ${param_idx}
    """

    rows = await db.fetch_all(query, values)
    # Reverse to get chronological order
    return [Message(**dict(row)) for row in reversed(rows)]


@router.get("/recent", response_model=List[Message])
async def get_recent_messages(
    episode_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    limit: int = Query(10, ge=1, le=50),
    db=Depends(get_db),
):
    """Get the most recent messages in an episode."""
    # Verify episode ownership
    episode_check = """
        SELECT id FROM episodes
        WHERE id = $1 AND user_id = $2
    """
    episode_row = await db.fetch_one(episode_check, [episode_id, user_id])

    if not episode_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found",
        )

    query = """
        SELECT * FROM messages
        WHERE episode_id = $1
        ORDER BY created_at DESC
        LIMIT $2
    """

    rows = await db.fetch_all(query, [episode_id, limit])
    return [Message(**dict(row)) for row in reversed(rows)]
