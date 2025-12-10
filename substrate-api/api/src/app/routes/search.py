"""Semantic search endpoints.

Note: This module requires entity_embeddings table and embedding_status column
on rights_entities which are not yet implemented in the schema.
All endpoints return 501 Not Implemented until the schema is extended.
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field

from app.deps import get_db

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class SemanticSearchRequest(BaseModel):
    """Request model for semantic search."""
    query: str = Field(..., min_length=1, max_length=2000)
    catalog_ids: List[UUID] = Field(default_factory=list)
    rights_types: List[str] = Field(default_factory=list)
    training_allowed: Optional[bool] = None
    commercial_allowed: Optional[bool] = None
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)


class SimilarSearchRequest(BaseModel):
    """Request model for finding similar entities."""
    entity_id: UUID
    catalog_ids: List[UUID] = Field(default_factory=list)
    rights_types: List[str] = Field(default_factory=list)
    exclude_same_catalog: bool = False
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)


class PermissionsSummary(BaseModel):
    """Summary of AI permissions for an entity."""
    training_allowed: bool = False
    commercial_allowed: bool = False
    generation_allowed: bool = False
    requires_attribution: bool = True


# =============================================================================
# Helper Functions
# =============================================================================

def extract_permissions_summary(ai_permissions: Dict[str, Any]) -> PermissionsSummary:
    """Extract a simplified permissions summary from ai_permissions JSONB."""
    if not ai_permissions:
        return PermissionsSummary()

    training = ai_permissions.get("training", {})
    generation = ai_permissions.get("generation", {})
    commercial = ai_permissions.get("commercial", {})

    return PermissionsSummary(
        training_allowed=training.get("allowed", False),
        commercial_allowed=commercial.get("commercial_use_allowed", False),
        generation_allowed=generation.get("allowed", False),
        requires_attribution=training.get("requires_attribution", True)
    )


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/search/semantic")
async def semantic_search(request: Request, payload: SemanticSearchRequest):
    """
    Perform semantic search across rights entities.

    Note: This endpoint requires the entity_embeddings table which is not yet
    implemented. Semantic search functionality will be available in a future release.
    """
    raise HTTPException(
        status_code=501,
        detail="Semantic search is not yet implemented. Requires entity_embeddings schema."
    )


@router.post("/search/similar")
async def find_similar(request: Request, payload: SimilarSearchRequest):
    """
    Find entities similar to a given entity.

    Note: This endpoint requires the entity_embeddings table which is not yet
    implemented. Similar search functionality will be available in a future release.
    """
    raise HTTPException(
        status_code=501,
        detail="Similar search is not yet implemented. Requires entity_embeddings schema."
    )


@router.post("/search/filter")
async def filter_search(
    request: Request,
    catalog_ids: List[UUID] = Query(default=[]),
    rights_types: List[str] = Query(default=[]),
    training_allowed: Optional[bool] = None,
    commercial_allowed: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = 0
):
    """
    Filter entities by metadata and permissions (no semantic search).

    This endpoint provides basic filtering without vector similarity search.
    """
    user_id = request.state.user_id
    db = await get_db()

    where_clauses = ["re.status = 'active'"]
    params: Dict[str, Any] = {
        "user_id": user_id,
        "limit": limit,
        "offset": offset
    }

    if catalog_ids:
        where_clauses.append("re.catalog_id = ANY(:catalog_ids)")
        params["catalog_ids"] = [str(cid) for cid in catalog_ids]

    if rights_types:
        where_clauses.append("re.rights_type = ANY(:rights_types)")
        params["rights_types"] = rights_types

    # Permission filters
    if training_allowed is not None:
        where_clauses.append(
            "(re.ai_permissions->>'training' IS NULL OR "
            "(re.ai_permissions->'training'->>'allowed')::boolean = :training_allowed)"
        )
        params["training_allowed"] = training_allowed

    if commercial_allowed is not None:
        where_clauses.append(
            "(re.ai_permissions->>'commercial' IS NULL OR "
            "(re.ai_permissions->'commercial'->>'commercial_use_allowed')::boolean = :commercial_allowed)"
        )
        params["commercial_allowed"] = commercial_allowed

    query = f"""
        WITH accessible_catalogs AS (
            SELECT c.id, c.name
            FROM catalogs c
            JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
            WHERE wm.user_id = :user_id
        )
        SELECT
            re.id as entity_id,
            re.title,
            re.rights_type,
            re.catalog_id,
            ac.name as catalog_name,
            re.ai_permissions
        FROM rights_entities re
        JOIN accessible_catalogs ac ON ac.id = re.catalog_id
        WHERE {' AND '.join(where_clauses)}
        ORDER BY re.updated_at DESC
        LIMIT :limit OFFSET :offset
    """

    results = await db.fetch_all(query, params)

    # Get count
    count_query = f"""
        WITH accessible_catalogs AS (
            SELECT c.id
            FROM catalogs c
            JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
            WHERE wm.user_id = :user_id
        )
        SELECT COUNT(*) as total
        FROM rights_entities re
        JOIN accessible_catalogs ac ON ac.id = re.catalog_id
        WHERE {' AND '.join(where_clauses)}
    """

    count_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}
    count_result = await db.fetch_one(count_query, count_params)

    return {
        "results": [
            {
                "entity_id": row["entity_id"],
                "title": row["title"],
                "rights_type": row["rights_type"],
                "catalog_id": row["catalog_id"],
                "catalog_name": row["catalog_name"],
                "permissions_summary": extract_permissions_summary(row["ai_permissions"]).model_dump()
            }
            for row in results
        ],
        "total": count_result["total"] if count_result else 0,
        "limit": limit,
        "offset": offset
    }


@router.get("/entities/{entity_id}/permissions")
async def get_entity_permissions(request: Request, entity_id: UUID):
    """Get detailed permissions summary for an entity."""
    user_id = request.state.user_id
    db = await get_db()

    entity = await db.fetch_one("""
        SELECT re.id, re.title, re.rights_type, re.ai_permissions
        FROM rights_entities re
        JOIN catalogs c ON c.id = re.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE re.id = :entity_id AND wm.user_id = :user_id
    """, {"entity_id": str(entity_id), "user_id": user_id})

    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    ai_perms = entity["ai_permissions"] or {}

    return {
        "entity_id": entity["id"],
        "title": entity["title"],
        "rights_type": entity["rights_type"],
        "permissions": ai_perms,
        "summary": extract_permissions_summary(ai_perms).model_dump()
    }


@router.post("/query/permissions")
async def check_permissions(
    request: Request,
    entity_id: UUID,
    use_case: str = Query(..., description="Use case to check: 'training', 'generation', 'commercial'")
):
    """
    Check if a specific use case is permitted for an entity.

    Returns whether the use is allowed and any conditions.
    """
    user_id = request.state.user_id
    db = await get_db()

    entity = await db.fetch_one("""
        SELECT re.id, re.title, re.ai_permissions
        FROM rights_entities re
        JOIN catalogs c ON c.id = re.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE re.id = :entity_id AND wm.user_id = :user_id
    """, {"entity_id": str(entity_id), "user_id": user_id})

    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    ai_perms = entity["ai_permissions"] or {}
    result = {
        "entity_id": entity["id"],
        "title": entity["title"],
        "use_case": use_case,
        "permitted": False,
        "conditions": [],
        "details": {}
    }

    if use_case == "training":
        training = ai_perms.get("training", {})
        result["permitted"] = training.get("allowed", False)
        result["details"] = training
        if result["permitted"]:
            if training.get("requires_attribution"):
                result["conditions"].append("Attribution required")
            if not training.get("commercial_ok"):
                result["conditions"].append("Non-commercial use only")

    elif use_case == "generation":
        gen = ai_perms.get("generation", {})
        result["permitted"] = gen.get("allowed", False)
        result["details"] = gen
        if result["permitted"]:
            if gen.get("watermark_required"):
                result["conditions"].append("Watermark required on outputs")
            if not gen.get("derivative_works"):
                result["conditions"].append("No derivative works")
            if not gen.get("style_imitation"):
                result["conditions"].append("Style imitation not allowed")

    elif use_case == "commercial":
        commercial = ai_perms.get("commercial", {})
        result["permitted"] = commercial.get("commercial_use_allowed", False)
        result["details"] = commercial
        if result["permitted"]:
            territories = commercial.get("territories", [])
            if territories and territories != ["WORLDWIDE"]:
                result["conditions"].append(f"Limited to territories: {', '.join(territories)}")
            if commercial.get("revenue_share_required"):
                result["conditions"].append("Revenue share required")

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown use case: {use_case}. Valid options: training, generation, commercial"
        )

    return result
