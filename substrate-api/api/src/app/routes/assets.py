"""Reference assets management endpoints."""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Request, Form

from app.deps import get_db

router = APIRouter()


# =============================================================================
# Pydantic Models
# =============================================================================

VALID_ASSET_TYPES = [
    'contract', 'master_file', 'sample', 'image', 'document'
]


# =============================================================================
# Asset Routes
# =============================================================================

@router.get("/catalogs/{catalog_id}/assets")
async def list_catalog_assets(
    request: Request,
    catalog_id: UUID,
    asset_type: Optional[str] = None
):
    """List all assets for a catalog."""
    user_id = request.state.user_id
    db = await get_db()

    # Verify catalog access
    catalog = await db.fetch_one("""
        SELECT c.id
        FROM catalogs c
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE c.id = :catalog_id AND wm.user_id = :user_id
    """, {"catalog_id": str(catalog_id), "user_id": user_id})

    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")

    # Build query
    where_clause = "catalog_id = :catalog_id"
    params = {"catalog_id": str(catalog_id)}

    if asset_type:
        where_clause += " AND asset_type = :asset_type"
        params["asset_type"] = asset_type

    assets = await db.fetch_all(f"""
        SELECT id, asset_type, file_name, file_url, content_type,
               file_size_bytes, description, rights_entity_id, created_at
        FROM reference_assets
        WHERE {where_clause}
        ORDER BY created_at DESC
    """, params)

    return {"assets": [dict(a) for a in assets]}


@router.get("/entities/{entity_id}/assets")
async def list_entity_assets(
    request: Request,
    entity_id: UUID,
    asset_type: Optional[str] = None
):
    """List all assets for a rights entity."""
    user_id = request.state.user_id
    db = await get_db()

    # Verify entity access
    entity = await db.fetch_one("""
        SELECT re.id, re.catalog_id
        FROM rights_entities re
        JOIN catalogs c ON c.id = re.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE re.id = :entity_id AND wm.user_id = :user_id
    """, {"entity_id": str(entity_id), "user_id": user_id})

    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Build query
    where_clause = "rights_entity_id = :entity_id"
    params = {"entity_id": str(entity_id)}

    if asset_type:
        where_clause += " AND asset_type = :asset_type"
        params["asset_type"] = asset_type

    assets = await db.fetch_all(f"""
        SELECT id, asset_type, file_name, file_url, content_type,
               file_size_bytes, description, created_at
        FROM reference_assets
        WHERE {where_clause}
        ORDER BY created_at DESC
    """, params)

    return {"assets": [dict(a) for a in assets]}


@router.post("/catalogs/{catalog_id}/assets")
async def create_catalog_asset(
    request: Request,
    catalog_id: UUID,
    asset_type: str = Form(...),
    file_name: str = Form(...),
    file_url: str = Form(...),
    content_type: Optional[str] = Form(None),
    file_size_bytes: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    rights_entity_id: Optional[UUID] = Form(None)
):
    """
    Create asset metadata record for a catalog.

    Note: Actual file upload should be done directly to Supabase Storage.
    This endpoint creates the metadata record linking the asset to the catalog/entity.
    """
    user_id = request.state.user_id
    db = await get_db()

    # Verify catalog access
    catalog = await db.fetch_one("""
        SELECT c.id
        FROM catalogs c
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE c.id = :catalog_id AND wm.user_id = :user_id
    """, {"catalog_id": str(catalog_id), "user_id": user_id})

    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")

    # Validate asset type
    if asset_type not in VALID_ASSET_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid asset_type. Must be one of: {VALID_ASSET_TYPES}"
        )

    # If rights_entity_id is provided, verify it belongs to this catalog
    if rights_entity_id:
        entity = await db.fetch_one("""
            SELECT id FROM rights_entities
            WHERE id = :entity_id AND catalog_id = :catalog_id
        """, {"entity_id": str(rights_entity_id), "catalog_id": str(catalog_id)})

        if not entity:
            raise HTTPException(status_code=404, detail="Rights entity not found in this catalog")

    asset = await db.fetch_one("""
        INSERT INTO reference_assets (
            catalog_id, rights_entity_id, asset_type, file_name,
            file_url, content_type, file_size_bytes, description, uploaded_by
        )
        VALUES (
            :catalog_id, :rights_entity_id, :asset_type, :file_name,
            :file_url, :content_type, :file_size_bytes, :description, :uploaded_by
        )
        RETURNING id, asset_type, file_name, file_url, content_type, created_at
    """, {
        "catalog_id": str(catalog_id),
        "rights_entity_id": str(rights_entity_id) if rights_entity_id else None,
        "asset_type": asset_type,
        "file_name": file_name,
        "file_url": file_url,
        "content_type": content_type,
        "file_size_bytes": file_size_bytes,
        "description": description,
        "uploaded_by": user_id
    })

    return {"asset": dict(asset)}


@router.post("/entities/{entity_id}/assets")
async def create_entity_asset(
    request: Request,
    entity_id: UUID,
    asset_type: str = Form(...),
    file_name: str = Form(...),
    file_url: str = Form(...),
    content_type: Optional[str] = Form(None),
    file_size_bytes: Optional[int] = Form(None),
    description: Optional[str] = Form(None)
):
    """
    Create asset metadata record for a rights entity.

    Note: Actual file upload should be done directly to Supabase Storage.
    This endpoint creates the metadata record linking the asset to the entity.
    """
    user_id = request.state.user_id
    db = await get_db()

    # Verify entity access
    entity = await db.fetch_one("""
        SELECT re.id, re.catalog_id
        FROM rights_entities re
        JOIN catalogs c ON c.id = re.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE re.id = :entity_id AND wm.user_id = :user_id
    """, {"entity_id": str(entity_id), "user_id": user_id})

    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Validate asset type
    if asset_type not in VALID_ASSET_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid asset_type. Must be one of: {VALID_ASSET_TYPES}"
        )

    asset = await db.fetch_one("""
        INSERT INTO reference_assets (
            catalog_id, rights_entity_id, asset_type, file_name,
            file_url, content_type, file_size_bytes, description, uploaded_by
        )
        VALUES (
            :catalog_id, :rights_entity_id, :asset_type, :file_name,
            :file_url, :content_type, :file_size_bytes, :description, :uploaded_by
        )
        RETURNING id, asset_type, file_name, file_url, content_type, created_at
    """, {
        "catalog_id": str(entity["catalog_id"]),
        "rights_entity_id": str(entity_id),
        "asset_type": asset_type,
        "file_name": file_name,
        "file_url": file_url,
        "content_type": content_type,
        "file_size_bytes": file_size_bytes,
        "description": description,
        "uploaded_by": user_id
    })

    return {"asset": dict(asset)}


@router.get("/assets/{asset_id}")
async def get_asset(request: Request, asset_id: UUID):
    """Get asset details."""
    user_id = request.state.user_id
    db = await get_db()

    asset = await db.fetch_one("""
        SELECT ra.*
        FROM reference_assets ra
        JOIN catalogs c ON c.id = ra.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE ra.id = :asset_id AND wm.user_id = :user_id
    """, {"asset_id": str(asset_id), "user_id": user_id})

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    return {"asset": dict(asset)}


@router.delete("/assets/{asset_id}")
async def delete_asset(request: Request, asset_id: UUID):
    """Delete an asset (admin/owner only)."""
    user_id = request.state.user_id
    db = await get_db()

    # Verify access
    asset = await db.fetch_one("""
        SELECT ra.id, ra.file_url, wm.role
        FROM reference_assets ra
        JOIN catalogs c ON c.id = ra.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE ra.id = :asset_id AND wm.user_id = :user_id
    """, {"asset_id": str(asset_id), "user_id": user_id})

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    # Delete the record (actual file deletion from storage should be handled separately)
    await db.execute("""
        DELETE FROM reference_assets WHERE id = :asset_id
    """, {"asset_id": str(asset_id)})

    return {"deleted": True, "asset_id": asset_id}
