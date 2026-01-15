"""Messages API routes."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.deps import get_db
from app.dependencies import get_optional_user_id
from app.models.message import Message, MessageCreate

router = APIRouter(prefix="/episodes/{episode_id}/messages", tags=["Messages"])


@router.get("", response_model=List[Message])
async def list_messages(
    episode_id: UUID,
    request: Request,
    user_id: Optional[UUID] = Depends(get_optional_user_id),
    limit: int = Query(50, ge=1, le=200),
    before_id: Optional[UUID] = Query(None, description="Get messages before this ID"),
    db=Depends(get_db),
):
    """List messages in a session (episode_id is legacy param name for session_id).

    Supports both authenticated users and guest sessions.
    """
    # Extract guest_session_id from headers (if present)
    guest_session_id = request.headers.get("X-Guest-Session-Id")

    # Require either user_id OR guest_session_id
    if not user_id and not guest_session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication or guest session ID required"
        )

    # Verify session ownership based on auth type
    if guest_session_id and not user_id:
        # Guest session - verify by guest_session_id
        session_check = """
            SELECT id FROM sessions
            WHERE id = :episode_id AND guest_session_id = :guest_id
        """
        session_row = await db.fetch_one(session_check, {
            "episode_id": str(episode_id),
            "guest_id": guest_session_id,
        })
    else:
        # Authenticated user - verify by user_id
        session_check = """
            SELECT id FROM sessions
            WHERE id = :episode_id AND user_id = :user_id
        """
        session_row = await db.fetch_one(session_check, {
            "episode_id": str(episode_id),
            "user_id": str(user_id),
        })

    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Build query
    conditions = ["episode_id = :episode_id"]
    values = {"episode_id": str(episode_id), "limit": limit}

    if before_id:
        conditions.append("""
            created_at < (SELECT created_at FROM messages WHERE id = :before_id)
        """)
        values["before_id"] = str(before_id)

    query = f"""
        SELECT * FROM messages
        WHERE {" AND ".join(conditions)}
        ORDER BY created_at DESC
        LIMIT :limit
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
    """Get the most recent messages in a session."""
    # Verify session ownership
    session_check = """
        SELECT id FROM sessions
        WHERE id = :episode_id AND user_id = :user_id
    """
    session_row = await db.fetch_one(session_check, {"episode_id": str(episode_id), "user_id": str(user_id)})

    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    query = """
        SELECT * FROM messages
        WHERE episode_id = :episode_id
        ORDER BY created_at DESC
        LIMIT :limit
    """

    rows = await db.fetch_all(query, {"episode_id": str(episode_id), "limit": limit})
    return [Message(**dict(row)) for row in reversed(rows)]
