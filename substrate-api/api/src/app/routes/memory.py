"""Memory API routes."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.memory import MemoryEvent, MemoryEventCreate, MemoryType, MemoryQuery

router = APIRouter(prefix="/memory", tags=["Memory"])


@router.get("", response_model=List[MemoryEvent])
async def list_memories(
    user_id: UUID = Depends(get_current_user_id),
    character_id: Optional[UUID] = Query(None),
    types: Optional[List[MemoryType]] = Query(None),
    min_importance: float = Query(0.0, ge=0, le=1),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_db),
):
    """List memory events for the current user."""
    conditions = ["user_id = :user_id", "is_active = TRUE"]
    values = {"user_id": str(user_id), "limit": limit}

    if character_id:
        conditions.append("(character_id = :character_id OR character_id IS NULL)")
        values["character_id"] = str(character_id)

    if types:
        # Build IN clause with indexed parameters
        type_params = []
        for i, t in enumerate(types):
            param_name = f"type_{i}"
            type_params.append(f":{param_name}")
            values[param_name] = t.value
        conditions.append(f"type IN ({', '.join(type_params)})")

    if min_importance > 0:
        conditions.append("importance_score >= :min_importance")
        values["min_importance"] = min_importance

    query = f"""
        SELECT * FROM memory_events
        WHERE {" AND ".join(conditions)}
        ORDER BY importance_score DESC, created_at DESC
        LIMIT :limit
    """

    rows = await db.fetch_all(query, values)
    return [MemoryEvent(**dict(row)) for row in rows]


@router.get("/relevant", response_model=List[MemoryEvent])
async def get_relevant_memories(
    user_id: UUID = Depends(get_current_user_id),
    character_id: UUID = Query(...),
    limit: int = Query(10, ge=1, le=30),
    db=Depends(get_db),
):
    """Get memories relevant for a conversation.

    This uses a combination of:
    - Recent memories (last 7 days)
    - High importance memories
    - Character-specific and global memories
    """
    # For now, use a simple heuristic. Later can add vector similarity.
    query = """
        WITH ranked_memories AS (
            SELECT *,
                ROW_NUMBER() OVER (
                    PARTITION BY type
                    ORDER BY
                        CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END DESC,
                        importance_score DESC,
                        created_at DESC
                ) as rn
            FROM memory_events
            WHERE user_id = :user_id
                AND (character_id = :character_id OR character_id IS NULL)
                AND is_active = TRUE
        )
        SELECT * FROM ranked_memories
        WHERE rn <= 3
        ORDER BY importance_score DESC, created_at DESC
        LIMIT :limit
    """

    rows = await db.fetch_all(query, {"user_id": str(user_id), "character_id": str(character_id), "limit": limit})
    return [MemoryEvent(**dict(row)) for row in rows]


@router.post("", response_model=MemoryEvent, status_code=status.HTTP_201_CREATED)
async def create_memory(
    data: MemoryEventCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Create a new memory event."""
    import json

    query = """
        INSERT INTO memory_events (
            user_id, character_id, episode_id, type, category,
            content, summary, emotional_valence, importance_score
        )
        VALUES (:user_id, :character_id, :episode_id, :type, :category,
                :content, :summary, :emotional_valence, :importance_score)
        RETURNING *
    """

    row = await db.fetch_one(
        query,
        {
            "user_id": str(user_id),
            "character_id": str(data.character_id) if data.character_id else None,
            "episode_id": str(data.episode_id) if data.episode_id else None,
            "type": data.type.value,
            "category": data.category,
            "content": json.dumps(data.content),
            "summary": data.summary,
            "emotional_valence": data.emotional_valence,
            "importance_score": data.importance_score,
        },
    )

    return MemoryEvent(**dict(row))


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Soft delete a memory event."""
    query = """
        UPDATE memory_events
        SET is_active = FALSE
        WHERE id = :memory_id AND user_id = :user_id
    """
    result = await db.execute(query, {"memory_id": str(memory_id), "user_id": str(user_id)})

    if result == "UPDATE 0":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found",
        )


@router.post("/{memory_id}/reference", response_model=MemoryEvent)
async def mark_memory_referenced(
    memory_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Mark a memory as referenced in conversation."""
    query = """
        UPDATE memory_events
        SET
            last_referenced_at = NOW(),
            reference_count = reference_count + 1
        WHERE id = :memory_id AND user_id = :user_id
        RETURNING *
    """
    row = await db.fetch_one(query, {"memory_id": str(memory_id), "user_id": str(user_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found",
        )

    return MemoryEvent(**dict(row))
