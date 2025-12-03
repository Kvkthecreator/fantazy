"""API routes for context entries management.

Context Entries provide structured, multi-modal context for work recipes.
See: /docs/architecture/ADR_CONTEXT_ENTRIES.md
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from ..utils.jwt import verify_jwt
from ..utils.supabase_client import supabase_admin_client
from .schemas import (
    ContextEntryCreate,
    ContextEntryUpdate,
    ContextEntryResponse,
    ContextEntriesListResponse,
    ContextEntrySchemaResponse,
    ContextEntrySchemasListResponse,
    ContextEntryResolvedResponse,
    CompletenessResponse,
    BulkContextResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/substrate/baskets", tags=["context-entries"])


# ============================================================================
# Helper Functions
# ============================================================================


async def get_workspace_id_from_basket(basket_id: UUID) -> str:
    """Get workspace_id for a basket (for authorization)."""
    if not supabase_admin_client:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")

    result = (
        supabase_admin_client.table("baskets")
        .select("workspace_id")
        .eq("id", str(basket_id))
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Basket not found")

    return result.data["workspace_id"]


async def verify_workspace_access(basket_id: UUID, user: dict = Depends(verify_jwt)) -> str:
    """Verify user has access to basket's workspace."""
    workspace_id = await get_workspace_id_from_basket(basket_id)

    user_id = user.get("user_id") or user.get("sub")
    result = (
        supabase_admin_client.table("workspace_memberships")
        .select("workspace_id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=403, detail="Access denied to basket's workspace")

    return workspace_id


def calculate_completeness(data: Dict[str, Any], field_schema: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate completeness score for a context entry."""
    fields = field_schema.get("fields", [])
    required_count = 0
    filled_count = 0
    missing_fields = []

    for field in fields:
        if field.get("required", False):
            required_count += 1
            key = field.get("key")
            value = data.get(key)

            # Check if field has a meaningful value
            if value is not None and value != "" and value != []:
                filled_count += 1
            else:
                missing_fields.append(key)

    score = filled_count / required_count if required_count > 0 else 1.0

    return {
        "score": score,
        "required_fields": required_count,
        "filled_fields": filled_count,
        "missing_fields": missing_fields,
    }


async def resolve_asset_references(
    data: Dict[str, Any],
    field_schema: Dict[str, Any],
) -> Dict[str, Any]:
    """Resolve asset:// references in entry data to actual asset info."""
    resolved = {}
    asset_fields = {
        f.get("key"): f
        for f in field_schema.get("fields", [])
        if f.get("type") == "asset"
    }

    for key, value in data.items():
        if key in asset_fields and isinstance(value, str) and value.startswith("asset://"):
            asset_id = value.replace("asset://", "")

            try:
                asset_result = (
                    supabase_admin_client.table("reference_assets")
                    .select("id, file_name, mime_type, storage_path")
                    .eq("id", asset_id)
                    .single()
                    .execute()
                )

                if asset_result.data:
                    # Generate signed URL (valid for 1 hour)
                    storage_path = asset_result.data["storage_path"]
                    signed_url_result = supabase_admin_client.storage.from_("yarnnn-assets").create_signed_url(
                        storage_path, 3600
                    )

                    resolved[key] = {
                        "asset_id": asset_id,
                        "file_name": asset_result.data.get("file_name"),
                        "mime_type": asset_result.data.get("mime_type"),
                        "url": signed_url_result.get("signedURL") if signed_url_result else None,
                    }
                else:
                    resolved[key] = None
            except Exception as e:
                logger.warning(f"Failed to resolve asset {asset_id}: {e}")
                resolved[key] = None
        else:
            resolved[key] = value

    return resolved


# ============================================================================
# Context Entry Schema Endpoints
# ============================================================================


@router.get("/{basket_id}/context/schemas", response_model=ContextEntrySchemasListResponse)
async def list_context_schemas(
    basket_id: UUID,
    category: Optional[str] = None,
):
    """List all available context entry schemas.

    Args:
        basket_id: Basket ID (for auth context, schemas are global)
        category: Optional filter by category (foundation, market, insight)

    Returns:
        List of context entry schemas
    """
    try:
        query = (
            supabase_admin_client.table("context_entry_schemas")
            .select("*")
            .order("sort_order")
        )

        if category:
            query = query.eq("category", category)

        result = query.execute()

        return {"schemas": result.data or []}

    except Exception as e:
        logger.error(f"Failed to list context schemas: {e}")
        raise HTTPException(status_code=500, detail="Failed to list schemas")


@router.get("/{basket_id}/context/schemas/{anchor_role}", response_model=ContextEntrySchemaResponse)
async def get_context_schema(
    basket_id: UUID,
    anchor_role: str,
):
    """Get a specific context entry schema by anchor role.

    Args:
        basket_id: Basket ID (for auth context)
        anchor_role: The anchor role to get schema for

    Returns:
        Context entry schema
    """
    try:
        result = (
            supabase_admin_client.table("context_entry_schemas")
            .select("*")
            .eq("anchor_role", anchor_role)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail=f"Schema not found: {anchor_role}")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get context schema: {e}")
        raise HTTPException(status_code=500, detail="Failed to get schema")


# ============================================================================
# Context Entry CRUD Endpoints
# ============================================================================


@router.get("/{basket_id}/context/entries", response_model=ContextEntriesListResponse)
async def list_context_entries(
    basket_id: UUID,
    role: Optional[str] = None,
    state: str = "active",
    user: dict = Depends(verify_jwt),
):
    """List context entries for a basket.

    Args:
        basket_id: Basket ID
        role: Optional filter by anchor role
        state: Filter by state (default: active)

    Returns:
        List of context entries with schema info
    """
    try:
        await verify_workspace_access(basket_id, user)

        query = (
            supabase_admin_client.table("context_entries")
            .select("*, context_entry_schemas(display_name, icon, category)")
            .eq("basket_id", str(basket_id))
            .eq("state", state)
        )

        if role:
            query = query.eq("anchor_role", role)

        result = query.order("anchor_role").execute()

        # Transform to include schema info at top level
        entries = []
        for entry in result.data or []:
            schema_info = entry.pop("context_entry_schemas", {}) or {}
            entry["schema_display_name"] = schema_info.get("display_name")
            entry["schema_icon"] = schema_info.get("icon")
            entry["schema_category"] = schema_info.get("category")
            entries.append(entry)

        return {"entries": entries, "basket_id": basket_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list context entries: {e}")
        raise HTTPException(status_code=500, detail="Failed to list entries")


@router.get("/{basket_id}/context/entries/{anchor_role}", response_model=ContextEntryResponse)
async def get_context_entry(
    basket_id: UUID,
    anchor_role: str,
    entry_key: Optional[str] = None,
    user: dict = Depends(verify_jwt),
):
    """Get a specific context entry.

    Args:
        basket_id: Basket ID
        anchor_role: Anchor role
        entry_key: Entry key (for non-singleton roles)

    Returns:
        Context entry with schema info
    """
    try:
        await verify_workspace_access(basket_id, user)

        query = (
            supabase_admin_client.table("context_entries")
            .select("*, context_entry_schemas(display_name, icon, category, field_schema)")
            .eq("basket_id", str(basket_id))
            .eq("anchor_role", anchor_role)
            .eq("state", "active")
        )

        if entry_key:
            query = query.eq("entry_key", entry_key)
        else:
            query = query.is_("entry_key", "null")

        result = query.single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=f"Context entry not found: {anchor_role}")

        # Transform schema info
        schema_info = result.data.pop("context_entry_schemas", {}) or {}
        result.data["schema_display_name"] = schema_info.get("display_name")
        result.data["schema_icon"] = schema_info.get("icon")
        result.data["schema_category"] = schema_info.get("category")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get context entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to get entry")


@router.put("/{basket_id}/context/entries/{anchor_role}", response_model=ContextEntryResponse)
async def upsert_context_entry(
    basket_id: UUID,
    anchor_role: str,
    body: ContextEntryUpdate,
    entry_key: Optional[str] = None,
    user: dict = Depends(verify_jwt),
):
    """Create or update a context entry.

    Args:
        basket_id: Basket ID
        anchor_role: Anchor role
        body: Entry data
        entry_key: Entry key (for non-singleton roles)

    Returns:
        Created/updated context entry
    """
    try:
        await verify_workspace_access(basket_id, user)

        # Validate schema exists and get field_schema
        schema_result = (
            supabase_admin_client.table("context_entry_schemas")
            .select("field_schema, is_singleton")
            .eq("anchor_role", anchor_role)
            .single()
            .execute()
        )

        if not schema_result.data:
            raise HTTPException(status_code=400, detail=f"Unknown anchor role: {anchor_role}")

        field_schema = schema_result.data["field_schema"]
        is_singleton = schema_result.data["is_singleton"]

        # For singleton roles, entry_key must be null
        if is_singleton:
            entry_key = None

        # Calculate completeness
        completeness = calculate_completeness(body.data, field_schema)

        user_id = user.get("user_id") or user.get("sub")

        # Upsert entry
        entry_data = {
            "basket_id": str(basket_id),
            "anchor_role": anchor_role,
            "entry_key": entry_key,
            "display_name": body.display_name,
            "data": body.data,
            "completeness_score": completeness["score"],
            "state": "active",
            "created_by": user_id,
        }

        result = (
            supabase_admin_client.table("context_entries")
            .upsert(entry_data, on_conflict="basket_id,anchor_role,entry_key")
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save context entry")

        logger.info(f"Upserted context entry {anchor_role} for basket {basket_id}")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upsert context entry: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save entry: {str(e)}")


@router.delete("/{basket_id}/context/entries/{anchor_role}")
async def delete_context_entry(
    basket_id: UUID,
    anchor_role: str,
    entry_key: Optional[str] = None,
    user: dict = Depends(verify_jwt),
):
    """Archive (soft delete) a context entry.

    Args:
        basket_id: Basket ID
        anchor_role: Anchor role
        entry_key: Entry key (for non-singleton roles)

    Returns:
        Success message
    """
    try:
        await verify_workspace_access(basket_id, user)

        query = (
            supabase_admin_client.table("context_entries")
            .update({"state": "archived"})
            .eq("basket_id", str(basket_id))
            .eq("anchor_role", anchor_role)
        )

        if entry_key:
            query = query.eq("entry_key", entry_key)
        else:
            query = query.is_("entry_key", "null")

        result = query.execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Context entry not found")

        logger.info(f"Archived context entry {anchor_role} for basket {basket_id}")

        return {"success": True, "message": f"Context entry {anchor_role} archived"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete context entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete entry")


# ============================================================================
# Resolved Entry Endpoint (with asset URLs)
# ============================================================================


@router.get("/{basket_id}/context/entries/{anchor_role}/resolved", response_model=ContextEntryResolvedResponse)
async def get_resolved_context_entry(
    basket_id: UUID,
    anchor_role: str,
    fields: Optional[str] = Query(None, description="Comma-separated field names to include"),
    entry_key: Optional[str] = None,
    user: dict = Depends(verify_jwt),
):
    """Get context entry with resolved asset references.

    Asset fields (type=asset) that contain asset://uuid references are resolved
    to include file metadata and signed download URLs.

    Args:
        basket_id: Basket ID
        anchor_role: Anchor role
        fields: Optional comma-separated list of fields to include
        entry_key: Entry key (for non-singleton roles)

    Returns:
        Context entry with resolved asset references
    """
    try:
        await verify_workspace_access(basket_id, user)

        # Get entry with schema
        query = (
            supabase_admin_client.table("context_entries")
            .select("*, context_entry_schemas(field_schema)")
            .eq("basket_id", str(basket_id))
            .eq("anchor_role", anchor_role)
            .eq("state", "active")
        )

        if entry_key:
            query = query.eq("entry_key", entry_key)
        else:
            query = query.is_("entry_key", "null")

        result = query.single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=f"Context entry not found: {anchor_role}")

        entry = result.data
        field_schema = entry.pop("context_entry_schemas", {}).get("field_schema", {})
        data = entry.get("data", {})

        # Filter to requested fields if specified
        if fields:
            field_list = [f.strip() for f in fields.split(",")]
            data = {k: v for k, v in data.items() if k in field_list}

        # Resolve asset references
        resolved_data = await resolve_asset_references(data, field_schema)

        entry["data"] = resolved_data

        return entry

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get resolved context entry: {e}")
        raise HTTPException(status_code=500, detail="Failed to get resolved entry")


# ============================================================================
# Completeness Endpoint
# ============================================================================


@router.get("/{basket_id}/context/entries/{anchor_role}/completeness", response_model=CompletenessResponse)
async def get_entry_completeness(
    basket_id: UUID,
    anchor_role: str,
    entry_key: Optional[str] = None,
    user: dict = Depends(verify_jwt),
):
    """Get completeness score for a context entry.

    Args:
        basket_id: Basket ID
        anchor_role: Anchor role
        entry_key: Entry key (for non-singleton roles)

    Returns:
        Completeness score and details
    """
    try:
        await verify_workspace_access(basket_id, user)

        # Get entry with schema
        query = (
            supabase_admin_client.table("context_entries")
            .select("data, context_entry_schemas(field_schema)")
            .eq("basket_id", str(basket_id))
            .eq("anchor_role", anchor_role)
            .eq("state", "active")
        )

        if entry_key:
            query = query.eq("entry_key", entry_key)
        else:
            query = query.is_("entry_key", "null")

        result = query.single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=f"Context entry not found: {anchor_role}")

        field_schema = result.data.get("context_entry_schemas", {}).get("field_schema", {})
        data = result.data.get("data", {})

        completeness = calculate_completeness(data, field_schema)

        return completeness

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get entry completeness: {e}")
        raise HTTPException(status_code=500, detail="Failed to get completeness")


# ============================================================================
# Bulk Context Endpoint (for recipe execution)
# ============================================================================


@router.post("/{basket_id}/context/bulk", response_model=BulkContextResponse)
async def get_bulk_context(
    basket_id: UUID,
    roles: List[str],
    user: dict = Depends(verify_jwt),
):
    """Get multiple context entries at once.

    Useful for recipe execution to fetch all required context in one request.

    Args:
        basket_id: Basket ID
        roles: List of anchor roles to fetch

    Returns:
        Dictionary of entries keyed by anchor_role, plus list of missing roles
    """
    try:
        await verify_workspace_access(basket_id, user)

        result = (
            supabase_admin_client.table("context_entries")
            .select("*")
            .eq("basket_id", str(basket_id))
            .in_("anchor_role", roles)
            .eq("state", "active")
            .execute()
        )

        entries = {entry["anchor_role"]: entry for entry in result.data or []}
        missing_roles = [role for role in roles if role not in entries]

        return {
            "entries": entries,
            "basket_id": basket_id,
            "missing_roles": missing_roles,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get bulk context: {e}")
        raise HTTPException(status_code=500, detail="Failed to get bulk context")
