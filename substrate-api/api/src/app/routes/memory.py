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
    conditions = ["user_id = $1", "is_active = TRUE"]
    values = [user_id]
    param_idx = 2

    if character_id:
        conditions.append(f"(character_id = ${param_idx} OR character_id IS NULL)")
        values.append(character_id)
        param_idx += 1

    if types:
        type_placeholders = ", ".join(f"${i}" for i in range(param_idx, param_idx + len(types)))
        conditions.append(f"type IN ({type_placeholders})")
        values.extend([t.value for t in types])
        param_idx += len(types)

    if min_importance > 0:
        conditions.append(f"importance_score >= ${param_idx}")
        values.append(min_importance)
        param_idx += 1

    values.append(limit)
    query = f"""
        SELECT * FROM memory_events
        WHERE {" AND ".join(conditions)}
        ORDER BY importance_score DESC, created_at DESC
        LIMIT ${param_idx}
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
            WHERE user_id = $1
                AND (character_id = $2 OR character_id IS NULL)
                AND is_active = TRUE
        )
        SELECT * FROM ranked_memories
        WHERE rn <= 3
        ORDER BY importance_score DESC, created_at DESC
        LIMIT $3
    """

    rows = await db.fetch_all(query, [user_id, character_id, limit])
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    """

    row = await db.fetch_one(
        query,
        [
            user_id,
            data.character_id,
            data.episode_id,
            data.type.value,
            data.category,
            json.dumps(data.content),
            data.summary,
            data.emotional_valence,
            data.importance_score,
        ],
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
        WHERE id = $1 AND user_id = $2
    """
    result = await db.execute(query, [memory_id, user_id])

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
        WHERE id = $1 AND user_id = $2
        RETURNING *
    """
    row = await db.fetch_one(query, [memory_id, user_id])

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found",
        )

    return MemoryEvent(**dict(row))
