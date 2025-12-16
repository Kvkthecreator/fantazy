"""Sessions API routes (formerly Episodes)."""
from datetime import datetime
from typing import List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.session import Session, SessionCreate, SessionSummary, SessionUpdate

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("", response_model=List[SessionSummary])
async def list_sessions(
    user_id: UUID = Depends(get_current_user_id),
    character_id: Optional[UUID] = Query(None),
    active_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db=Depends(get_db),
):
    """List sessions for the current user."""
    conditions = ["user_id = :user_id"]
    values = {"user_id": str(user_id), "limit": limit, "offset": offset}

    if character_id:
        conditions.append("character_id = :character_id")
        values["character_id"] = str(character_id)

    if active_only:
        conditions.append("is_active = TRUE")

    query = f"""
        SELECT id, character_id, episode_number, title, started_at, ended_at,
               message_count, is_active
        FROM sessions
        WHERE {" AND ".join(conditions)}
        ORDER BY started_at DESC
        LIMIT :limit OFFSET :offset
    """

    rows = await db.fetch_all(query, values)
    return [SessionSummary(**dict(row)) for row in rows]


@router.post("", response_model=Session, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Start a new session with a character."""
    # Get or create engagement
    eng_query = """
        INSERT INTO engagements (user_id, character_id)
        VALUES (:user_id, :character_id)
        ON CONFLICT (user_id, character_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
    """
    eng_row = await db.fetch_one(eng_query, {"user_id": str(user_id), "character_id": str(data.character_id)})
    engagement_id = eng_row["id"]

    # Close any active sessions with this character
    close_query = """
        UPDATE sessions
        SET is_active = FALSE, ended_at = NOW()
        WHERE user_id = :user_id AND character_id = :character_id AND is_active = TRUE
    """
    await db.execute(close_query, {"user_id": str(user_id), "character_id": str(data.character_id)})

    # Get next episode number
    count_query = """
        SELECT COALESCE(MAX(episode_number), 0) + 1 as next_num
        FROM sessions
        WHERE user_id = :user_id AND character_id = :character_id
    """
    count_row = await db.fetch_one(count_query, {"user_id": str(user_id), "character_id": str(data.character_id)})
    episode_number = count_row["next_num"]

    # Create new session
    query = """
        INSERT INTO sessions (user_id, character_id, engagement_id, episode_number, title, scene)
        VALUES (:user_id, :character_id, :engagement_id, :episode_number, :title, :scene)
        RETURNING *
    """
    row = await db.fetch_one(
        query,
        {
            "user_id": str(user_id),
            "character_id": str(data.character_id),
            "engagement_id": str(engagement_id),
            "episode_number": episode_number,
            "title": data.title,
            "scene": data.scene,
        },
    )

    return Session(**dict(row))


@router.get("/active/{character_id}")
async def get_active_session(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
) -> Optional[Session]:
    """Get the active session with a character, if any."""
    query = """
        SELECT * FROM sessions
        WHERE user_id = :user_id AND character_id = :character_id AND is_active = TRUE
        ORDER BY started_at DESC
        LIMIT 1
    """
    row = await db.fetch_one(query, {"user_id": str(user_id), "character_id": str(character_id)})

    if not row:
        return None

    return Session(**dict(row))


@router.get("/{session_id}", response_model=Session)
async def get_session(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get a specific session."""
    query = """
        SELECT * FROM sessions
        WHERE id = :session_id AND user_id = :user_id
    """
    row = await db.fetch_one(query, {"session_id": str(session_id), "user_id": str(user_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return Session(**dict(row))


@router.patch("/{session_id}", response_model=Session)
async def update_session(
    session_id: UUID,
    data: SessionUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update a session."""
    updates = []
    values = {"session_id": str(session_id), "user_id": str(user_id)}

    if data.title is not None:
        updates.append("title = :title")
        values["title"] = data.title

    if data.scene is not None:
        updates.append("scene = :scene")
        values["scene"] = data.scene

    if data.is_active is not None:
        updates.append("is_active = :is_active")
        values["is_active"] = data.is_active
        if not data.is_active:
            updates.append("ended_at = :ended_at")
            values["ended_at"] = datetime.utcnow()

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    query = f"""
        UPDATE sessions
        SET {", ".join(updates)}
        WHERE id = :session_id AND user_id = :user_id
        RETURNING *
    """

    row = await db.fetch_one(query, values)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return Session(**dict(row))


@router.post("/{session_id}/end", response_model=Session)
async def end_session(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """End an active session."""
    query = """
        UPDATE sessions
        SET is_active = FALSE, ended_at = NOW()
        WHERE id = :session_id AND user_id = :user_id AND is_active = TRUE
        RETURNING *
    """
    row = await db.fetch_one(query, {"session_id": str(session_id), "user_id": str(user_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active session not found",
        )

    return Session(**dict(row))
