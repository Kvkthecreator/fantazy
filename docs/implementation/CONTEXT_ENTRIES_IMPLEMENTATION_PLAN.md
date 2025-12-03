# Context Entries Implementation Plan

**Version**: 1.1
**Date**: 2025-12-03
**Status**: Approved for Implementation
**ADR Reference**: [ADR_CONTEXT_ENTRIES.md](../architecture/ADR_CONTEXT_ENTRIES.md)
**Canon Reference**: [SUBSTRATE_DATA_TYPES.md](../canon/SUBSTRATE_DATA_TYPES.md)

---

## Overview

This document provides the detailed implementation plan for Context Entries - the structured, multi-modal context management system that replaces flat text blocks for work recipe context.

**Key Changes in v1.1**:
- Added ephemeral/permanent asset model
- Added de-wiring plan for legacy classification
- Consolidated migrations into single file for atomic execution

---

## Phase 1: Schema & Database (Week 1)

### 1.0 Migration Strategy

All schema changes are consolidated into a single migration file for atomic execution:
- **Migration File**: `supabase/migrations/20251203_context_entries.sql`
- **Execution**: Via `dump_schema.sh` which connects directly to Supabase

This includes:
1. `context_entry_schemas` table
2. `context_entries` table
3. Seed data for initial schemas
4. `reference_assets` columns for context entry linking
5. Deprecation of `asset_type_catalog` for user uploads
6. RLS policies and grants

### 1.1 Create Context Entry Schema Table

**Migration**: `supabase/migrations/20251203_context_entries.sql` (Part 1)

```sql
-- Context Entry Schemas: Defines structure for each anchor role
CREATE TABLE context_entry_schemas (
    anchor_role TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT,                           -- Lucide icon name
    category TEXT CHECK (category IN ('foundation', 'market', 'insight')),
    is_singleton BOOLEAN DEFAULT true,   -- true = one per basket, false = array
    field_schema JSONB NOT NULL,         -- Defines available fields
    sort_order INTEGER DEFAULT 0,        -- Display order in UI
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE context_entry_schemas IS
'Defines the structure and available fields for each context anchor role.
Foundation roles (problem, customer, vision, brand) are universal.
Market roles (competitor, market_segment) support multiple entries.
Insight roles (trend_digest) are agent-produced.
See: /docs/architecture/ADR_CONTEXT_ENTRIES.md';

-- Enable RLS
ALTER TABLE context_entry_schemas ENABLE ROW LEVEL SECURITY;

-- Schemas are public read (all authenticated users can see)
CREATE POLICY "Schemas are readable by authenticated users"
ON context_entry_schemas FOR SELECT TO authenticated
USING (true);

-- Only admins can modify schemas (for now, via direct DB access)
```

### 1.2 Seed Initial Schemas

**Migration**: `supabase/migrations/20251203_seed_context_schemas.sql`

```sql
-- Foundation Roles
INSERT INTO context_entry_schemas (anchor_role, display_name, description, icon, category, is_singleton, sort_order, field_schema)
VALUES
(
    'problem',
    'Problem',
    'The core pain point or challenge being addressed',
    'AlertTriangle',
    'foundation',
    true,
    1,
    '{
        "fields": [
            {"key": "statement", "type": "longtext", "label": "Problem Statement", "required": true, "placeholder": "Describe the core problem you are solving..."},
            {"key": "impact", "type": "longtext", "label": "Impact", "placeholder": "What happens if this problem is not solved?"},
            {"key": "evidence", "type": "array", "label": "Evidence", "item_type": "text", "placeholder": "Add supporting evidence..."}
        ]
    }'::jsonb
),
(
    'customer',
    'Customer',
    'Who you are building for - the target persona',
    'Users',
    'foundation',
    true,
    2,
    '{
        "fields": [
            {"key": "description", "type": "longtext", "label": "Customer Description", "required": true, "placeholder": "Describe your ideal customer..."},
            {"key": "demographics", "type": "text", "label": "Demographics", "placeholder": "Age, location, industry, company size..."},
            {"key": "pain_points", "type": "array", "label": "Pain Points", "item_type": "text", "placeholder": "Add a pain point..."},
            {"key": "goals", "type": "array", "label": "Goals", "item_type": "text", "placeholder": "Add a goal..."},
            {"key": "jobs_to_be_done", "type": "array", "label": "Jobs to Be Done", "item_type": "text", "placeholder": "Add a job..."}
        ]
    }'::jsonb
),
(
    'vision',
    'Vision',
    'Where this is going - the future state you are working toward',
    'Eye',
    'foundation',
    true,
    3,
    '{
        "fields": [
            {"key": "statement", "type": "longtext", "label": "Vision Statement", "required": true, "placeholder": "Describe your vision for the future..."},
            {"key": "milestones", "type": "array", "label": "Key Milestones", "item_type": "text", "placeholder": "Add a milestone..."},
            {"key": "success_metrics", "type": "array", "label": "Success Metrics", "item_type": "text", "placeholder": "Add a metric..."}
        ]
    }'::jsonb
),
(
    'brand',
    'Brand Identity',
    'Your brand voice, visual identity, and guidelines',
    'Palette',
    'foundation',
    true,
    4,
    '{
        "fields": [
            {"key": "name", "type": "text", "label": "Brand Name", "required": true, "placeholder": "Your company or product name"},
            {"key": "tagline", "type": "text", "label": "Tagline", "placeholder": "Your memorable catchphrase"},
            {"key": "voice", "type": "longtext", "label": "Brand Voice", "placeholder": "Describe how your brand communicates...", "help": "Include tone, vocabulary preferences, things to avoid"},
            {"key": "logo", "type": "asset", "label": "Logo", "accept": "image/*"},
            {"key": "colors", "type": "array", "label": "Brand Colors", "item_type": "text", "placeholder": "#FF5733"},
            {"key": "guidelines_doc", "type": "asset", "label": "Brand Guidelines", "accept": "application/pdf,.docx"}
        ]
    }'::jsonb
);

-- Market Roles (non-singleton)
INSERT INTO context_entry_schemas (anchor_role, display_name, description, icon, category, is_singleton, sort_order, field_schema)
VALUES
(
    'competitor',
    'Competitor',
    'Competitive intelligence for a specific competitor',
    'Target',
    'market',
    false,  -- Multiple competitors allowed
    10,
    '{
        "fields": [
            {"key": "name", "type": "text", "label": "Competitor Name", "required": true, "placeholder": "Competitor company name"},
            {"key": "website", "type": "text", "label": "Website", "placeholder": "https://..."},
            {"key": "description", "type": "longtext", "label": "Description", "placeholder": "What do they do?"},
            {"key": "strengths", "type": "array", "label": "Strengths", "item_type": "text"},
            {"key": "weaknesses", "type": "array", "label": "Weaknesses", "item_type": "text"},
            {"key": "differentiators", "type": "longtext", "label": "How You Differ", "placeholder": "What makes you different from this competitor?"}
        ]
    }'::jsonb
);

-- Insight Roles (agent-produced)
INSERT INTO context_entry_schemas (anchor_role, display_name, description, icon, category, is_singleton, sort_order, field_schema)
VALUES
(
    'trend_digest',
    'Trend Digest',
    'Synthesized market and industry trends',
    'TrendingUp',
    'insight',
    true,
    20,
    '{
        "fields": [
            {"key": "summary", "type": "longtext", "label": "Summary", "required": true},
            {"key": "key_themes", "type": "array", "label": "Key Themes", "item_type": "text"},
            {"key": "opportunities", "type": "array", "label": "Opportunities", "item_type": "text"},
            {"key": "threats", "type": "array", "label": "Threats", "item_type": "text"},
            {"key": "sources", "type": "array", "label": "Sources", "item_type": "text"}
        ],
        "agent_produced": true,
        "refresh_ttl_hours": 168
    }'::jsonb
),
(
    'competitor_snapshot',
    'Competitor Snapshot',
    'Synthesized competitive landscape analysis',
    'BarChart3',
    'insight',
    true,
    21,
    '{
        "fields": [
            {"key": "summary", "type": "longtext", "label": "Summary", "required": true},
            {"key": "landscape", "type": "longtext", "label": "Competitive Landscape"},
            {"key": "positioning", "type": "longtext", "label": "Your Positioning"},
            {"key": "gaps", "type": "array", "label": "Market Gaps", "item_type": "text"}
        ],
        "agent_produced": true,
        "refresh_ttl_hours": 336
    }'::jsonb
);
```

### 1.3 Create Context Entries Table

**Migration**: `supabase/migrations/20251203_context_entries.sql`

```sql
-- Context Entries: Actual context data per basket
CREATE TABLE context_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basket_id UUID NOT NULL REFERENCES baskets(id) ON DELETE CASCADE,
    anchor_role TEXT NOT NULL REFERENCES context_entry_schemas(anchor_role),
    entry_key TEXT,                      -- For non-singleton (e.g., competitor name)
    display_name TEXT,                   -- Optional display override
    data JSONB NOT NULL DEFAULT '{}',    -- Structured data per field_schema
    completeness_score FLOAT,            -- 0.0-1.0 based on required fields
    state TEXT DEFAULT 'active' CHECK (state IN ('active', 'archived')),
    refresh_policy JSONB,                -- For insight roles: {"ttl_hours": 168, "last_refreshed": "..."}
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    UNIQUE(basket_id, anchor_role, entry_key)
);

COMMENT ON TABLE context_entries IS
'Stores structured context data per basket, organized by anchor role.
Each entry contains typed fields defined by context_entry_schemas.
Asset references use asset://uuid pattern resolved at query time.
See: /docs/architecture/ADR_CONTEXT_ENTRIES.md';

-- Indexes
CREATE INDEX idx_context_entries_basket_role
ON context_entries(basket_id, anchor_role);
```

### 1.4 Link Reference Assets to Context Entries

**Migration**: `supabase/migrations/20251203_context_entries.sql` (Part 4)

```sql
-- =====================================================
-- Add context entry linking to reference_assets
-- =====================================================

-- Add columns for context entry association
ALTER TABLE reference_assets
  ADD COLUMN IF NOT EXISTS context_entry_id UUID,
  ADD COLUMN IF NOT EXISTS context_field_key TEXT;

-- Add FK constraint (deferred to allow migration ordering)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ref_assets_context_entry_fk'
  ) THEN
    ALTER TABLE reference_assets
      ADD CONSTRAINT ref_assets_context_entry_fk
      FOREIGN KEY (context_entry_id)
      REFERENCES context_entries(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Update permanence logic: linked to entry = permanent
-- Note: We keep existing constraint and add logic in application layer
-- to avoid breaking existing assets

-- Index for context entry lookups
CREATE INDEX IF NOT EXISTS idx_ref_assets_context_entry
  ON reference_assets(context_entry_id, context_field_key)
  WHERE context_entry_id IS NOT NULL;

COMMENT ON COLUMN reference_assets.context_entry_id IS
'Links asset to context entry. If set, asset is permanent. If NULL, asset is ephemeral.
See: /docs/architecture/ADR_CONTEXT_ENTRIES.md#ephemeral-vs-permanent-asset-model';

COMMENT ON COLUMN reference_assets.context_field_key IS
'Which field in the context entry this asset fills (e.g., "logo", "guidelines_doc")';
```

### 1.5 Deprecate Asset Type Catalog for User Uploads

**Migration**: `supabase/migrations/20251203_context_entries.sql` (Part 5)

```sql
-- =====================================================
-- Deprecation notices for legacy systems
-- =====================================================

-- Mark asset_type_catalog as deprecated for user uploads
COMMENT ON TABLE asset_type_catalog IS
'Dynamic catalog of asset types.

DEPRECATION NOTICE (2025-12-03):
For USER uploads, asset classification is now determined by attachment to context_entries.
LLM classification remains active ONLY for work output files (agent-produced).
This table is kept for backward compatibility and existing assets.
See: /docs/architecture/ADR_CONTEXT_ENTRIES.md#de-wiring-legacy-classification-system

New user uploads should use context_entry_id instead of asset_type for categorization.';

-- Mark basket_anchors as deprecated (if not already done)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'basket_anchors') THEN
    COMMENT ON TABLE basket_anchors IS
'DEPRECATED (2025-12-03): This table is empty and unused.
Context roles are now stored on context_entries.
Block anchor_role column remains for RAG/knowledge extraction only.
Table will be dropped after 30-day observation period.
See: /docs/architecture/ADR_CONTEXT_ENTRIES.md';
  END IF;
END $$;

-- Add deprecation notice to blocks.anchor_role
COMMENT ON COLUMN blocks.anchor_role IS
'LEGACY (2025-12-03): For work recipe context, use context_entries instead.
This column remains active for:
- RAG/semantic search
- Knowledge extraction pipelines
- Existing block categorization
See: /docs/architecture/ADR_CONTEXT_ENTRIES.md#legacy-systems-reference';
```

### 1.6 Indexes for Context Entries (continued)

```sql

CREATE INDEX idx_context_entries_updated
ON context_entries(basket_id, updated_at DESC);

CREATE INDEX idx_context_entries_state
ON context_entries(basket_id, state)
WHERE state = 'active';

-- Enable RLS
ALTER TABLE context_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read entries for baskets they have access to
CREATE POLICY "Users can read context entries for accessible baskets"
ON context_entries FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM baskets b
        JOIN projects p ON p.basket_id = b.id
        JOIN workspace_memberships wm ON wm.workspace_id = p.workspace_id
        WHERE b.id = context_entries.basket_id
        AND wm.user_id = auth.uid()
    )
);

-- Policy: Users can insert/update entries for baskets they have access to
CREATE POLICY "Users can write context entries for accessible baskets"
ON context_entries FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM baskets b
        JOIN projects p ON p.basket_id = b.id
        JOIN workspace_memberships wm ON wm.workspace_id = p.workspace_id
        WHERE b.id = context_entries.basket_id
        AND wm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update context entries for accessible baskets"
ON context_entries FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM baskets b
        JOIN projects p ON p.basket_id = b.id
        JOIN workspace_memberships wm ON wm.workspace_id = p.workspace_id
        WHERE b.id = context_entries.basket_id
        AND wm.user_id = auth.uid()
    )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_context_entry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER context_entries_updated_at
BEFORE UPDATE ON context_entries
FOR EACH ROW EXECUTE FUNCTION update_context_entry_timestamp();

-- Function to calculate completeness score
CREATE OR REPLACE FUNCTION calculate_context_completeness(
    p_data JSONB,
    p_field_schema JSONB
) RETURNS FLOAT AS $$
DECLARE
    v_required_count INTEGER := 0;
    v_filled_count INTEGER := 0;
    v_field JSONB;
BEGIN
    FOR v_field IN SELECT * FROM jsonb_array_elements(p_field_schema->'fields')
    LOOP
        IF (v_field->>'required')::boolean = true THEN
            v_required_count := v_required_count + 1;
            IF p_data ? (v_field->>'key') AND p_data->(v_field->>'key') IS NOT NULL
               AND p_data->>(v_field->>'key') != '' THEN
                v_filled_count := v_filled_count + 1;
            END IF;
        END IF;
    END LOOP;

    IF v_required_count = 0 THEN
        RETURN 1.0;
    END IF;

    RETURN v_filled_count::FLOAT / v_required_count::FLOAT;
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 1.5: De-wire Legacy Classification (With Phase 1)

### 1.5.1 Update Classification Service

**File**: `substrate-api/api/src/app/reference_assets/services/classification_service.py`

Add source parameter and skip classification for user uploads:

```python
"""
Asset Classification Service - LLM-powered asset type detection

DEPRECATION NOTICE (2025-12-03):
LLM classification is now only used for work output files (agent-produced).
User uploads are classified by attachment to context entries.
See: /docs/architecture/ADR_CONTEXT_ENTRIES.md#de-wiring-legacy-classification-system
"""

class AssetClassificationService:
    @staticmethod
    async def classify_asset(
        file_name: str,
        mime_type: str,
        file_size_bytes: int,
        text_preview: Optional[str] = None,
        available_types: Optional[List[str]] = None,
        source: str = "agent",  # NEW: "agent" | "user"
    ) -> Dict[str, Any]:
        """
        Classify an asset using LLM.

        IMPORTANT: As of 2025-12-03, this is ONLY called for agent uploads.
        User uploads skip classification entirely (context entry defines type).
        """
        # Skip classification for user uploads
        if source == "user":
            logger.info(f"[ASSET CLASSIFY] Skipping LLM for user upload: {file_name}")
            return {
                "success": True,
                "asset_type": "other",
                "confidence": 1.0,
                "description": file_name,
                "reasoning": "User upload - classification skipped (context entry determines type)",
                "skipped": True,
            }

        # ... existing LLM classification logic for agent uploads ...
```

### 1.5.2 Update Asset Upload Endpoint

**File**: `substrate-api/api/src/app/reference_assets/routes/upload.py`

Add parameter to control classification:

```python
@router.post("/upload")
async def upload_asset(
    basket_id: str,
    file: UploadFile,
    # NEW: Context entry linking
    context_entry_id: Optional[str] = None,
    context_field_key: Optional[str] = None,
    # NEW: Skip classification for user uploads
    source: str = "user",  # "user" | "agent"
    # Existing fields
    asset_type: Optional[str] = None,
    description: Optional[str] = None,
    ...
):
    # Determine permanence based on context entry linking
    if context_entry_id:
        permanence = "permanent"
        expires_at = None
    else:
        permanence = "temporary"
        expires_at = datetime.utcnow() + timedelta(days=7)

    # Skip LLM classification for user uploads
    if source == "user":
        classification = {
            "asset_type": asset_type or "other",
            "confidence": 1.0,
            "skipped": True,
        }
    else:
        # Agent uploads still get LLM classification
        classification = await classification_service.classify_asset(
            file_name=file.filename,
            mime_type=file.content_type,
            file_size_bytes=file_size,
            source=source,
        )

    # Create asset record with context entry link
    asset = await create_reference_asset(
        basket_id=basket_id,
        file_name=file.filename,
        mime_type=file.content_type,
        storage_path=storage_path,
        file_size_bytes=file_size,
        asset_type=classification["asset_type"],
        permanence=permanence,
        expires_at=expires_at,
        context_entry_id=context_entry_id,  # NEW
        context_field_key=context_field_key,  # NEW
        ...
    )
```

### 1.5.3 Add Deprecation Comments to BlockFormModal

**File**: `work-platform/web/components/context/BlockFormModal.tsx`

Add clear deprecation notice at top of file:

```typescript
/**
 * LEGACY COMPONENT (2025-12-03)
 *
 * This component is for creating/editing blocks with anchor roles.
 * For work recipe context, use ContextEntryEditor instead.
 *
 * This component remains active for:
 * - Knowledge extraction workflows
 * - RAG/semantic search block management
 * - Legacy block editing
 *
 * See: /docs/architecture/ADR_CONTEXT_ENTRIES.md
 */
```

---

## Phase 2: Substrate API Routes (Week 1-2)

### 2.1 API Route Structure

**Location**: `substrate-api/api/src/app/routes/context_entries.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from ..dependencies import get_supabase_client

router = APIRouter(prefix="/baskets/{basket_id}/context", tags=["context"])

# --- Models ---

class ContextEntryCreate(BaseModel):
    anchor_role: str
    entry_key: Optional[str] = None
    display_name: Optional[str] = None
    data: Dict[str, Any]

class ContextEntryUpdate(BaseModel):
    data: Dict[str, Any]
    display_name: Optional[str] = None

class ContextEntryResponse(BaseModel):
    id: str
    basket_id: str
    anchor_role: str
    entry_key: Optional[str]
    display_name: Optional[str]
    data: Dict[str, Any]
    completeness_score: Optional[float]
    state: str
    created_at: str
    updated_at: str

# --- Routes ---

@router.get("/schemas")
async def list_schemas(supabase = Depends(get_supabase_client)):
    """List all available context entry schemas."""
    result = await supabase.from_("context_entry_schemas") \
        .select("*") \
        .order("sort_order") \
        .execute()
    return {"schemas": result.data}

@router.get("/entries")
async def list_entries(
    basket_id: str,
    role: Optional[str] = None,
    state: str = "active",
    supabase = Depends(get_supabase_client)
):
    """List context entries for a basket, optionally filtered by role."""
    query = supabase.from_("context_entries") \
        .select("*, context_entry_schemas(display_name, icon, category)") \
        .eq("basket_id", basket_id) \
        .eq("state", state)

    if role:
        query = query.eq("anchor_role", role)

    result = await query.order("anchor_role").execute()
    return {"entries": result.data}

@router.get("/entries/{role}")
async def get_entry(
    basket_id: str,
    role: str,
    entry_key: Optional[str] = None,
    supabase = Depends(get_supabase_client)
):
    """Get a specific context entry by role (and optional entry_key)."""
    query = supabase.from_("context_entries") \
        .select("*, context_entry_schemas(field_schema)") \
        .eq("basket_id", basket_id) \
        .eq("anchor_role", role) \
        .eq("state", "active")

    if entry_key:
        query = query.eq("entry_key", entry_key)

    result = await query.maybeSingle().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Context entry not found")

    return {"entry": result.data}

@router.put("/entries/{role}")
async def upsert_entry(
    basket_id: str,
    role: str,
    body: ContextEntryCreate,
    supabase = Depends(get_supabase_client)
):
    """Create or update a context entry."""
    # Validate schema exists
    schema = await supabase.from_("context_entry_schemas") \
        .select("field_schema, is_singleton") \
        .eq("anchor_role", role) \
        .single() \
        .execute()

    if not schema.data:
        raise HTTPException(status_code=400, detail=f"Unknown anchor role: {role}")

    # For singleton, entry_key must be null
    entry_key = body.entry_key if not schema.data["is_singleton"] else None

    # Calculate completeness
    completeness = calculate_completeness(body.data, schema.data["field_schema"])

    # Upsert
    result = await supabase.from_("context_entries") \
        .upsert({
            "basket_id": basket_id,
            "anchor_role": role,
            "entry_key": entry_key,
            "display_name": body.display_name,
            "data": body.data,
            "completeness_score": completeness,
            "state": "active",
        }, on_conflict="basket_id,anchor_role,entry_key") \
        .select() \
        .single() \
        .execute()

    return {"entry": result.data}

@router.delete("/entries/{role}")
async def delete_entry(
    basket_id: str,
    role: str,
    entry_key: Optional[str] = None,
    supabase = Depends(get_supabase_client)
):
    """Archive a context entry (soft delete)."""
    query = supabase.from_("context_entries") \
        .update({"state": "archived"}) \
        .eq("basket_id", basket_id) \
        .eq("anchor_role", role)

    if entry_key:
        query = query.eq("entry_key", entry_key)

    await query.execute()
    return {"success": True}

# --- Asset Resolution ---

@router.get("/entries/{role}/resolved")
async def get_resolved_entry(
    basket_id: str,
    role: str,
    fields: Optional[str] = None,  # Comma-separated field names
    supabase = Depends(get_supabase_client)
):
    """Get context entry with asset references resolved."""
    entry = await get_entry(basket_id, role, supabase=supabase)

    # Filter to requested fields
    if fields:
        field_list = [f.strip() for f in fields.split(",")]
        filtered_data = {k: v for k, v in entry["entry"]["data"].items() if k in field_list}
    else:
        filtered_data = entry["entry"]["data"]

    # Resolve asset:// references
    resolved_data = await resolve_asset_references(filtered_data, supabase)

    return {
        "entry": {
            **entry["entry"],
            "data": resolved_data
        }
    }

async def resolve_asset_references(data: Dict, supabase) -> Dict:
    """Replace asset://uuid references with actual asset info."""
    resolved = {}
    for key, value in data.items():
        if isinstance(value, str) and value.startswith("asset://"):
            asset_id = value.replace("asset://", "")
            asset = await supabase.from_("reference_assets") \
                .select("id, file_name, mime_type, storage_path") \
                .eq("id", asset_id) \
                .maybeSingle() \
                .execute()

            if asset.data:
                # Generate signed URL
                url = await generate_signed_url(asset.data["storage_path"], supabase)
                resolved[key] = {
                    "asset_id": asset_id,
                    "file_name": asset.data["file_name"],
                    "mime_type": asset.data["mime_type"],
                    "url": url
                }
            else:
                resolved[key] = None
        elif isinstance(value, list):
            resolved[key] = [await resolve_asset_references({"v": v}, supabase).get("v", v) if isinstance(v, str) and v.startswith("asset://") else v for v in value]
        else:
            resolved[key] = value

    return resolved
```

### 2.2 Register Routes

**File**: `substrate-api/api/src/app/main.py`

```python
from .routes import context_entries

# Add to router registrations
app.include_router(context_entries.router)
```

---

## Phase 3: Frontend Context Page (Week 2-3)

### 3.1 Context Page Structure

**Location**: `work-platform/web/app/projects/[id]/context/`

```
context/
├── page.tsx              # Server component - fetches data
├── ContextPageClient.tsx # Client component - UI
├── components/
│   ├── ContextCard.tsx           # Role card with completeness
│   ├── ContextEntryEditor.tsx    # Form-based editor
│   ├── FieldRenderer.tsx         # Renders field by type
│   ├── AssetField.tsx            # Asset upload/preview
│   └── ArrayField.tsx            # Array of items
└── hooks/
    └── useContextEntry.ts        # CRUD hooks
```

### 3.2 Context Page Server Component

**File**: `work-platform/web/app/projects/[id]/context/page.tsx`

```typescript
import { cookies } from "next/headers";
import { createServerComponentClient } from "@/lib/supabase/clients";
import { getAuthenticatedUser } from "@/lib/auth/getAuthenticatedUser";
import ContextPageClient from "./ContextPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContextPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const supabase = createServerComponentClient({ cookies });
  const { userId } = await getAuthenticatedUser(supabase);

  // Fetch project and basket
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, basket_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return <div>Project not found</div>;
  }

  // Fetch schemas
  const { data: schemas } = await supabase
    .from("context_entry_schemas")
    .select("*")
    .order("sort_order");

  // Fetch existing entries
  const { data: entries } = await supabase
    .from("context_entries")
    .select("*")
    .eq("basket_id", project.basket_id)
    .eq("state", "active");

  return (
    <ContextPageClient
      projectId={projectId}
      basketId={project.basket_id}
      schemas={schemas || []}
      initialEntries={entries || []}
    />
  );
}
```

### 3.3 Context Page Client Component (Skeleton)

**File**: `work-platform/web/app/projects/[id]/context/ContextPageClient.tsx`

```typescript
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import ContextCard from "./components/ContextCard";
import ContextEntryEditor from "./components/ContextEntryEditor";

interface Schema {
  anchor_role: string;
  display_name: string;
  description: string;
  icon: string;
  category: string;
  is_singleton: boolean;
  field_schema: { fields: any[] };
}

interface Entry {
  id: string;
  anchor_role: string;
  entry_key: string | null;
  data: Record<string, any>;
  completeness_score: number;
}

interface ContextPageClientProps {
  projectId: string;
  basketId: string;
  schemas: Schema[];
  initialEntries: Entry[];
}

export default function ContextPageClient({
  projectId,
  basketId,
  schemas,
  initialEntries,
}: ContextPageClientProps) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingEntryKey, setEditingEntryKey] = useState<string | null>(null);

  // Group schemas by category
  const foundationSchemas = schemas.filter(s => s.category === "foundation");
  const marketSchemas = schemas.filter(s => s.category === "market");
  const insightSchemas = schemas.filter(s => s.category === "insight");

  // Get entry for a role
  const getEntry = (role: string, entryKey?: string) => {
    return entries.find(
      e => e.anchor_role === role && (entryKey ? e.entry_key === entryKey : true)
    );
  };

  // Get entries for non-singleton role
  const getEntriesForRole = (role: string) => {
    return entries.filter(e => e.anchor_role === role);
  };

  const handleEdit = (role: string, entryKey?: string) => {
    setEditingRole(role);
    setEditingEntryKey(entryKey || null);
  };

  const handleSaved = (savedEntry: Entry) => {
    setEntries(prev => {
      const existing = prev.findIndex(
        e => e.anchor_role === savedEntry.anchor_role && e.entry_key === savedEntry.entry_key
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = savedEntry;
        return updated;
      }
      return [...prev, savedEntry];
    });
    setEditingRole(null);
    setEditingEntryKey(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Context</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define the context that powers your work recipes
        </p>
      </div>

      {/* Foundation Context */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-foreground mb-4">Foundation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {foundationSchemas.map(schema => (
            <ContextCard
              key={schema.anchor_role}
              schema={schema}
              entry={getEntry(schema.anchor_role)}
              onClick={() => handleEdit(schema.anchor_role)}
            />
          ))}
        </div>
      </section>

      {/* Market Context */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-foreground mb-4">Market</h2>
        {marketSchemas.map(schema => {
          const roleEntries = getEntriesForRole(schema.anchor_role);
          return (
            <div key={schema.anchor_role} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{schema.display_name}s</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(schema.anchor_role)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {roleEntries.map(entry => (
                  <ContextCard
                    key={entry.id}
                    schema={schema}
                    entry={entry}
                    onClick={() => handleEdit(schema.anchor_role, entry.entry_key || undefined)}
                  />
                ))}
                {roleEntries.length === 0 && (
                  <Card className="p-4 border-dashed text-center text-muted-foreground">
                    No {schema.display_name.toLowerCase()}s added yet
                  </Card>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Insight Context (Agent-produced) */}
      <section className="mb-8">
        <h2 className="text-lg font-medium text-foreground mb-4">
          Insights
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            (Agent-generated)
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insightSchemas.map(schema => (
            <ContextCard
              key={schema.anchor_role}
              schema={schema}
              entry={getEntry(schema.anchor_role)}
              onClick={() => handleEdit(schema.anchor_role)}
              isInsight
            />
          ))}
        </div>
      </section>

      {/* Editor Modal */}
      {editingRole && (
        <ContextEntryEditor
          basketId={basketId}
          schema={schemas.find(s => s.anchor_role === editingRole)!}
          entry={getEntry(editingRole, editingEntryKey || undefined) || null}
          open={true}
          onClose={() => setEditingRole(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
```

---

## Phase 4: Work Orchestration Integration (Week 3-4)

### 4.1 Update Recipe Context Requirements

**File**: `work-platform/web/lib/recipes/types.ts`

```typescript
interface RecipeContextRequirements {
  // New: Context entries (preferred)
  entries?: Array<{
    role: string;        // Anchor role
    fields?: string[];   // Specific fields (empty = all)
    required?: boolean;  // Fail if missing
  }>;

  // Legacy: Block-based requirements (deprecated)
  substrate_blocks?: {
    min_blocks?: number;
    semantic_types?: string[];
    recency_preference?: string;
  };
}
```

### 4.2 Update Context Assembly

**File**: `agent-hub/src/context/assembler.py`

```python
async def assemble_recipe_context(
    basket_id: str,
    recipe: dict,
    supabase: Client
) -> dict:
    """
    Assemble context for agent execution.
    Prioritizes context_entries over blocks.
    """
    context = {}

    requirements = recipe.get("context_requirements", {})

    # New: Context entries (preferred)
    for entry_req in requirements.get("entries", []):
        role = entry_req["role"]
        fields = entry_req.get("fields", [])
        required = entry_req.get("required", False)

        entry = await supabase.from_("context_entries") \
            .select("data") \
            .eq("basket_id", basket_id) \
            .eq("anchor_role", role) \
            .eq("state", "active") \
            .maybeSingle() \
            .execute()

        if not entry.data:
            if required:
                raise MissingContextError(f"Required context '{role}' not found")
            continue

        # Project fields
        data = entry.data["data"]
        if fields:
            data = {k: v for k, v in data.items() if k in fields}

        # Resolve asset references
        data = await resolve_asset_references(data, supabase)

        context[role] = data

    # Legacy: Block-based (fallback)
    if not requirements.get("entries") and requirements.get("substrate_blocks"):
        context["blocks"] = await fetch_blocks_context(basket_id, requirements, supabase)

    return context
```

---

## Phase 5: Testing & Validation (Week 4)

### 5.1 Unit Tests

```python
# tests/test_context_entries.py

async def test_create_context_entry():
    """Test creating a new context entry."""
    pass

async def test_update_context_entry():
    """Test updating existing entry preserves ID."""
    pass

async def test_completeness_calculation():
    """Test completeness score calculation."""
    pass

async def test_asset_reference_resolution():
    """Test asset:// references are resolved."""
    pass

async def test_field_projection():
    """Test only requested fields are returned."""
    pass
```

### 5.2 Integration Tests

```python
# tests/test_context_integration.py

async def test_recipe_execution_with_context_entries():
    """Test full recipe execution using context entries."""
    pass

async def test_token_reduction():
    """Measure token usage with entries vs blocks."""
    pass
```

---

## Rollout Plan

| Phase | Timeline | Deliverables | Risk |
|-------|----------|--------------|------|
| Phase 1: Schema | Week 1 | Migrations, seed data | Low |
| Phase 2: API | Week 1-2 | CRUD routes, asset resolution | Low |
| Phase 3: UI | Week 2-3 | Context page, editors | Medium |
| Phase 4: Integration | Week 3-4 | Recipe updates, agent context | Medium |
| Phase 5: Testing | Week 4 | Tests, validation | Low |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Context entry adoption | 80% of new projects | DB query |
| Token usage reduction | -50% per recipe | Prompt logs |
| Context completeness | 70% average | Completeness scores |
| Page load time | <500ms | Analytics |

---

**Document Status**: Approved for Implementation
**Last Updated**: 2025-12-03
**Owner**: Engineering Team
