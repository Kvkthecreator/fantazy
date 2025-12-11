"""Hooks API routes."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.hook import Hook, HookCreate, HookType

router = APIRouter(prefix="/hooks", tags=["Hooks"])


@router.get("", response_model=List[Hook])
async def list_hooks(
    user_id: UUID = Depends(get_current_user_id),
    character_id: Optional[UUID] = Query(None),
    active_only: bool = Query(True),
    pending_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_db),
):
    """List hooks for the current user."""
    conditions = ["user_id = :user_id"]
    values = {"user_id": str(user_id), "limit": limit}

    if character_id:
        conditions.append("character_id = :character_id")
        values["character_id"] = str(character_id)

    if active_only:
        conditions.append("is_active = TRUE")

    if pending_only:
        conditions.append("triggered_at IS NULL")
        conditions.append("(trigger_after IS NULL OR trigger_after <= NOW())")

    query = f"""
        SELECT * FROM hooks
        WHERE {" AND ".join(conditions)}
        ORDER BY priority DESC, trigger_after ASC NULLS LAST, created_at DESC
        LIMIT :limit
    """

    rows = await db.fetch_all(query, values)
    return [Hook(**dict(row)) for row in rows]


@router.get("/pending/{character_id}", response_model=List[Hook])
async def get_pending_hooks(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    limit: int = Query(5, ge=1, le=20),
    db=Depends(get_db),
):
    """Get pending hooks for a character conversation."""
    query = """
        SELECT * FROM hooks
        WHERE user_id = :user_id
            AND character_id = :character_id
            AND is_active = TRUE
            AND triggered_at IS NULL
            AND (trigger_after IS NULL OR trigger_after <= NOW())
            AND (trigger_before IS NULL OR trigger_before >= NOW())
        ORDER BY priority DESC, trigger_after ASC NULLS LAST
        LIMIT :limit
    """

    rows = await db.fetch_all(query, {"user_id": str(user_id), "character_id": str(character_id), "limit": limit})
    return [Hook(**dict(row)) for row in rows]


@router.post("", response_model=Hook, status_code=status.HTTP_201_CREATED)
async def create_hook(
    data: HookCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Create a new conversation hook."""
    query = """
        INSERT INTO hooks (
            user_id, character_id, episode_id, type, priority,
            content, context, suggested_opener, trigger_after, trigger_before
        )
        VALUES (:user_id, :character_id, :episode_id, :type, :priority,
                :content, :context, :suggested_opener, :trigger_after, :trigger_before)
        RETURNING *
    """

    row = await db.fetch_one(
        query,
        {
            "user_id": str(user_id),
            "character_id": str(data.character_id),
            "episode_id": str(data.episode_id) if data.episode_id else None,
            "type": data.type.value,
            "priority": data.priority,
            "content": data.content,
            "context": data.context,
            "suggested_opener": data.suggested_opener,
            "trigger_after": data.trigger_after,
            "trigger_before": data.trigger_before,
        },
    )

    return Hook(**dict(row))


@router.post("/{hook_id}/trigger", response_model=Hook)
async def mark_hook_triggered(
    hook_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Mark a hook as triggered."""
    query = """
        UPDATE hooks
        SET triggered_at = NOW()
        WHERE id = :hook_id AND user_id = :user_id
        RETURNING *
    """
    row = await db.fetch_one(query, {"hook_id": str(hook_id), "user_id": str(user_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hook not found",
        )

    return Hook(**dict(row))


@router.delete("/{hook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hook(
    hook_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Deactivate a hook."""
    query = """
        UPDATE hooks
        SET is_active = FALSE
        WHERE id = :hook_id AND user_id = :user_id
    """
    result = await db.execute(query, {"hook_id": str(hook_id), "user_id": str(user_id)})

    if result == "UPDATE 0":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hook not found",
        )
