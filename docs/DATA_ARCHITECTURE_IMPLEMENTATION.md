# Clearinghouse Data Architecture Implementation Plan

**Version**: 1.0
**Date**: 2025-12-09
**Status**: Approved for Implementation
**Purpose**: Define data model, embedding pipeline, and API extensions for IP licensing infrastructure

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Schema Extensions](#2-database-schema-extensions)
3. [Embedding Pipeline](#3-embedding-pipeline)
4. [Semantic Metadata Schema](#4-semantic-metadata-schema)
5. [AI Permissions Model](#5-ai-permissions-model)
6. [API Routes - New & Modified](#6-api-routes---new--modified)
7. [Implementation Phases](#7-implementation-phases)
8. [Migration SQL](#8-migration-sql)

---

## 1. Overview

### Objective

Enable AI platforms (music studios, video production, etc.) to:
- **Discover** IP through semantic and similarity search
- **Query** rights and permissions programmatically
- **License** IP for specific use cases
- **Report** usage for billing/compliance

### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embeddings | Pre-computed, async | Better query performance, predictable costs |
| Async Jobs | Supabase Webhooks → Render Worker | Simple, leverages existing infra |
| Semantic Metadata | Hybrid (core + flexible) | Balance queryability with extensibility |
| Permissions | Structured but loose | Architecture ready, details added as needed |
| Schema Validation | Hybrid (required core, optional extras) | Flexibility for MVP, tighten later |

---

## 2. Database Schema Extensions

### 2.1 Enhanced Rights Entity

Modify existing `rights_entities` table:

```sql
-- Add new columns to rights_entities
ALTER TABLE rights_entities ADD COLUMN IF NOT EXISTS
    embedding_status TEXT DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'processing', 'ready', 'failed', 'skipped'));

ALTER TABLE rights_entities ADD COLUMN IF NOT EXISTS
    processing_error TEXT;

ALTER TABLE rights_entities ADD COLUMN IF NOT EXISTS
    semantic_metadata JSONB DEFAULT '{}';

ALTER TABLE rights_entities ADD COLUMN IF NOT EXISTS
    extensions JSONB DEFAULT '{}';
```

### 2.2 Reference Assets Table

```sql
CREATE TABLE reference_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rights_entity_id UUID NOT NULL REFERENCES rights_entities(id) ON DELETE CASCADE,

    -- Asset identification
    asset_type TEXT NOT NULL,  -- 'audio_master', 'audio_preview', 'stems', 'lyrics', 'artwork', 'contract', 'other'
    filename TEXT NOT NULL,
    mime_type TEXT,
    file_size_bytes BIGINT,

    -- Storage
    storage_bucket TEXT NOT NULL DEFAULT 'reference-assets',
    storage_path TEXT NOT NULL,  -- Path within bucket
    is_public BOOLEAN DEFAULT false,

    -- Audio-specific metadata (nullable for non-audio)
    duration_seconds NUMERIC,
    sample_rate INTEGER,
    channels INTEGER,

    -- Processing status
    processing_status TEXT DEFAULT 'uploaded'
        CHECK (processing_status IN ('uploaded', 'processing', 'ready', 'failed')),
    processing_error TEXT,

    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_assets_entity ON reference_assets(rights_entity_id);
CREATE INDEX idx_assets_type ON reference_assets(asset_type);
```

### 2.3 Embeddings Table (pgvector)

```sql
-- Enable pgvector extension (run once)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE entity_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rights_entity_id UUID NOT NULL REFERENCES rights_entities(id) ON DELETE CASCADE,

    -- Embedding identification
    embedding_type TEXT NOT NULL,  -- 'audio', 'text', 'visual', 'combined'
    source_asset_id UUID REFERENCES reference_assets(id) ON DELETE SET NULL,
    model_id TEXT NOT NULL,  -- 'openai-text-embedding-3-small', 'clap-audio', etc.
    model_version TEXT,

    -- The actual embedding vector
    -- Using 1536 dimensions (OpenAI text-embedding-3-small)
    -- Adjust dimension based on model choice
    embedding vector(1536),

    -- Metadata about this embedding
    metadata JSONB DEFAULT '{}',  -- e.g., { "segment": "0-30s", "confidence": 0.95 }

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for similarity search
CREATE INDEX idx_embeddings_entity ON entity_embeddings(rights_entity_id);
CREATE INDEX idx_embeddings_type ON entity_embeddings(embedding_type);

-- Vector similarity index (IVFFlat for approximate nearest neighbor)
CREATE INDEX idx_embeddings_vector ON entity_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);  -- Adjust lists based on data size
```

### 2.4 Processing Jobs Table

```sql
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job identification
    job_type TEXT NOT NULL,  -- 'embedding_generation', 'asset_analysis', 'fingerprint'
    rights_entity_id UUID REFERENCES rights_entities(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES reference_assets(id) ON DELETE CASCADE,

    -- Status tracking
    status TEXT DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0,  -- Higher = more priority

    -- Execution details
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Job configuration
    config JSONB DEFAULT '{}',  -- Job-specific parameters
    result JSONB,  -- Job output/results

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jobs_status ON processing_jobs(status, priority DESC, created_at);
CREATE INDEX idx_jobs_entity ON processing_jobs(rights_entity_id);
```

---

## 3. Embedding Pipeline

### 3.1 Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     EMBEDDING PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TRIGGER                                                      │
│     ├── Rights entity created/updated                           │
│     ├── Asset uploaded                                          │
│     └── Manual re-process request                               │
│                                                                  │
│  2. DATABASE WEBHOOK (Supabase)                                 │
│     └── POST to /api/v1/internal/process-entity                 │
│                                                                  │
│  3. JOB CREATION                                                │
│     ├── Create processing_job record                            │
│     ├── Update entity.embedding_status = 'processing'           │
│     └── Return job_id to caller                                 │
│                                                                  │
│  4. ASYNC PROCESSING (Background)                               │
│     ├── Fetch entity + assets                                   │
│     ├── For each asset type:                                    │
│     │   ├── Audio → Extract features → Audio embedding          │
│     │   ├── Text (lyrics/description) → Text embedding          │
│     │   └── Visual (artwork) → Image embedding                  │
│     ├── Generate combined embedding (optional)                  │
│     └── Store in entity_embeddings table                        │
│                                                                  │
│  5. COMPLETION                                                   │
│     ├── Update entity.embedding_status = 'ready'                │
│     ├── Update processing_job.status = 'completed'              │
│     └── Emit Supabase Realtime event (optional)                 │
│                                                                  │
│  6. ERROR HANDLING                                               │
│     ├── Retry up to max_retries                                 │
│     ├── On final failure:                                       │
│     │   ├── entity.embedding_status = 'failed'                  │
│     │   └── entity.processing_error = error_message             │
│     └── Alert/notify (future)                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Embedding Strategy by Asset Type

| Asset Type | Model | Dimensions | Notes |
|------------|-------|------------|-------|
| Text (lyrics, description) | OpenAI text-embedding-3-small | 1536 | Primary for semantic search |
| Audio | CLAP or Whisper→text→embed | 1536 | Start with Whisper transcription approach |
| Visual | CLIP | 512 | For artwork similarity |
| Combined | Weighted average | 1536 | Optional, for multi-modal search |

### 3.3 Processing Endpoint

```python
# POST /api/v1/internal/process-entity
# Called by Supabase webhook or manually

@router.post("/internal/process-entity")
async def trigger_entity_processing(
    entity_id: UUID,
    force: bool = False,  # Re-process even if already done
    embedding_types: List[str] = ["text", "audio"]  # Which embeddings to generate
):
    """
    Triggers async embedding generation for a rights entity.
    Returns immediately with job_id for status polling.
    """
    # 1. Validate entity exists
    # 2. Check if already processing (unless force=True)
    # 3. Create processing_job
    # 4. Update entity.embedding_status = 'processing'
    # 5. Queue background task
    # 6. Return { job_id, status: "queued" }
```

---

## 4. Semantic Metadata Schema

### 4.1 Structure

```typescript
type SemanticMetadata = {
  // ═══════════════════════════════════════════════════════════════
  // STANDARDIZED CORE (indexed, queryable across all entities)
  // ═══════════════════════════════════════════════════════════════

  primary_tags: string[];        // Main categorization tags
  mood: string[];                // From controlled vocabulary (see 4.2)
  energy: number | null;         // 0.0 - 1.0 normalized intensity
  language: string | null;       // ISO 639-1 code ("en", "es", etc.)
  explicit_content: boolean;     // Contains adult/explicit material

  // ═══════════════════════════════════════════════════════════════
  // TYPE-SPECIFIC FIELDS (validated per rights_type)
  // ═══════════════════════════════════════════════════════════════

  type_fields: {
    // ─── For musical_work / sound_recording ───
    tempo_bpm?: number;
    key?: string;                // "C major", "A minor", etc.
    time_signature?: string;     // "4/4", "3/4", etc.
    instrumentation?: string[];
    vocal_type?: string;         // "male", "female", "mixed", "instrumental"
    genre?: string[];

    // ─── For voice_likeness ───
    voice_gender?: string;
    voice_age_range?: string;    // "young_adult", "adult", "senior"
    voice_characteristics?: string[];  // "deep", "raspy", "smooth"
    accent?: string;

    // ─── For visual_work ───
    color_palette?: string[];
    visual_style?: string[];     // "photorealistic", "cartoon", "abstract"
    subject_matter?: string[];

    // ─── For character_ip ───
    character_type?: string;     // "human", "animal", "fantasy", "robot"
    associated_franchise?: string;
  };

  // ═══════════════════════════════════════════════════════════════
  // FLEXIBLE EXTENSIONS (user-defined, not indexed by default)
  // ═══════════════════════════════════════════════════════════════

  custom_tags: {
    key: string;
    value: string;
    source?: string;  // "user" | "import" | "ai_suggested"
  }[];

  // ═══════════════════════════════════════════════════════════════
  // AI-DERIVED (auto-populated by embedding pipeline)
  // ═══════════════════════════════════════════════════════════════

  ai_analysis?: {
    auto_tags?: string[];
    detected_mood?: string[];
    detected_genre?: string[];
    confidence_scores?: Record<string, number>;
    similar_to?: string[];  // IDs of similar entities
  };
}
```

### 4.2 Controlled Vocabularies

```typescript
// Mood vocabulary (expandable)
const MOOD_VOCABULARY = [
  "happy", "sad", "energetic", "calm", "aggressive",
  "romantic", "mysterious", "epic", "playful", "melancholic",
  "uplifting", "dark", "nostalgic", "intense", "peaceful",
  "anxious", "hopeful", "dreamy", "powerful", "gentle"
];

// Energy levels (normalized 0-1, with semantic labels)
const ENERGY_LABELS = {
  0.0 - 0.2: "very_low",    // Ambient, sleep music
  0.2 - 0.4: "low",         // Chill, relaxed
  0.4 - 0.6: "medium",      // Moderate, balanced
  0.6 - 0.8: "high",        // Upbeat, driving
  0.8 - 1.0: "very_high"    // Intense, aggressive
};

// Genre taxonomy (music - top-level, expandable)
const MUSIC_GENRES = [
  "pop", "rock", "hip_hop", "electronic", "classical",
  "jazz", "r_and_b", "country", "folk", "latin",
  "world", "ambient", "soundtrack", "indie", "metal"
];
```

---

## 5. AI Permissions Model

### 5.1 Structure (Phase 1 - Simplified)

```typescript
type AIPermissions = {
  // ═══════════════════════════════════════════════════════════════
  // TRAINING PERMISSIONS
  // ═══════════════════════════════════════════════════════════════

  training: {
    allowed: boolean;           // Master switch for any training use

    // Permitted use cases (empty = all allowed if training.allowed)
    permitted_uses?: string[];  // ["music_generation", "voice_synthesis", ...]

    // Restrictions
    commercial_ok: boolean;     // For-profit model training allowed
    requires_attribution: boolean;
    attribution_text?: string;
  };

  // ═══════════════════════════════════════════════════════════════
  // GENERATION / OUTPUT PERMISSIONS
  // ═══════════════════════════════════════════════════════════════

  generation: {
    allowed: boolean;           // Can AI outputs be based on this

    derivative_works: boolean;  // New works influenced by this
    style_imitation: boolean;   // "In the style of" outputs
    direct_sampling: boolean;   // Loops, samples from source

    watermark_required: boolean;  // Must embed provenance in outputs
  };

  // ═══════════════════════════════════════════════════════════════
  // VOICE-SPECIFIC (only for voice_likeness type)
  // ═══════════════════════════════════════════════════════════════

  voice?: {
    cloning_allowed: boolean;
    synthesis_allowed: boolean;
    requires_disclosure: boolean;  // Must disclose AI use
  };

  // ═══════════════════════════════════════════════════════════════
  // COMMERCIAL TERMS
  // ═══════════════════════════════════════════════════════════════

  commercial: {
    commercial_use_allowed: boolean;
    territories: string[];      // ["WORLDWIDE"] or specific codes
    revenue_share_required: boolean;
  };

  // ═══════════════════════════════════════════════════════════════
  // EXTENSIONS (for future detailed permissions)
  // ═══════════════════════════════════════════════════════════════

  extensions?: Record<string, any>;
}
```

### 5.2 Default Permission Templates

```typescript
// Preset templates for common scenarios
const PERMISSION_TEMPLATES = {

  // Open for AI use with attribution
  "open_with_attribution": {
    training: { allowed: true, commercial_ok: true, requires_attribution: true },
    generation: { allowed: true, derivative_works: true, style_imitation: true, direct_sampling: true, watermark_required: false },
    commercial: { commercial_use_allowed: true, territories: ["WORLDWIDE"], revenue_share_required: false }
  },

  // Research/non-commercial only
  "research_only": {
    training: { allowed: true, commercial_ok: false, requires_attribution: true },
    generation: { allowed: true, derivative_works: true, style_imitation: true, direct_sampling: false, watermark_required: true },
    commercial: { commercial_use_allowed: false, territories: ["WORLDWIDE"], revenue_share_required: false }
  },

  // No AI training, generation requires license
  "restricted": {
    training: { allowed: false, commercial_ok: false, requires_attribution: true },
    generation: { allowed: false, derivative_works: false, style_imitation: false, direct_sampling: false, watermark_required: true },
    commercial: { commercial_use_allowed: false, territories: [], revenue_share_required: true }
  },

  // Full commercial license
  "full_commercial": {
    training: { allowed: true, commercial_ok: true, requires_attribution: false },
    generation: { allowed: true, derivative_works: true, style_imitation: true, direct_sampling: true, watermark_required: false },
    commercial: { commercial_use_allowed: true, territories: ["WORLDWIDE"], revenue_share_required: false }
  }
};
```

---

## 6. API Routes - New & Modified

### 6.1 New Routes

```
# Asset Management
POST   /api/v1/entities/{id}/assets              # Upload asset
GET    /api/v1/entities/{id}/assets              # List entity assets
DELETE /api/v1/assets/{asset_id}                 # Delete asset

# Processing
POST   /api/v1/entities/{id}/process             # Trigger embedding generation
GET    /api/v1/jobs/{job_id}                     # Get job status
GET    /api/v1/entities/{id}/processing-status   # Get entity processing status

# Search (Demand-side)
POST   /api/v1/search/semantic                   # Semantic text search
POST   /api/v1/search/similar                    # Find similar to entity
POST   /api/v1/search/filter                     # Filter by metadata/permissions

# Rights Query (Demand-side)
POST   /api/v1/query/permissions                 # Check if use case is permitted
GET    /api/v1/entities/{id}/permissions         # Get entity permissions summary
```

### 6.2 Modified Routes

```
# Enhanced entity creation with asset upload
POST   /api/v1/catalogs/{id}/entities
       - Now accepts multipart/form-data for file upload
       - Auto-triggers embedding pipeline

# Enhanced entity response
GET    /api/v1/entities/{id}
       - Includes embedding_status
       - Includes semantic_metadata
       - Includes asset summary
```

### 6.3 Search API Design

```python
# POST /api/v1/search/semantic
class SemanticSearchRequest(BaseModel):
    query: str                          # Natural language query
    catalog_ids: List[UUID] = []        # Limit to specific catalogs (empty = all accessible)
    rights_types: List[str] = []        # Filter by IP type

    # Permission filters
    training_allowed: Optional[bool] = None
    commercial_allowed: Optional[bool] = None

    # Metadata filters
    mood: List[str] = []
    min_energy: Optional[float] = None
    max_energy: Optional[float] = None
    language: Optional[str] = None

    # Pagination
    limit: int = 20
    offset: int = 0

class SemanticSearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    query_embedding_id: Optional[str]  # For debugging/caching

class SearchResult(BaseModel):
    entity_id: UUID
    title: str
    rights_type: str
    catalog_id: UUID
    similarity_score: float  # 0.0 - 1.0
    snippet: Optional[str]   # Relevant excerpt
    permissions_summary: PermissionsSummary
```

---

## 7. Implementation Phases

### Phase 1: Database & Core Infrastructure (Current Sprint)

**Tasks:**
1. [ ] Run migration SQL (Section 8)
2. [ ] Update `rights_entities` model with new fields
3. [ ] Create `reference_assets` CRUD routes
4. [ ] Create `processing_jobs` table and basic job management
5. [ ] Set up Supabase Storage bucket for assets

**Deliverables:**
- Database schema extended
- Asset upload/download working
- Job tracking infrastructure ready

### Phase 2: Embedding Pipeline

**Tasks:**
1. [ ] Implement embedding generation service
2. [ ] Set up Supabase webhook for entity changes
3. [ ] Create background processing endpoint
4. [ ] Implement text embedding (OpenAI)
5. [ ] Store embeddings in pgvector
6. [ ] Add embedding_status tracking

**Deliverables:**
- Entities auto-process on creation
- Embeddings stored and queryable
- Status visible in API responses

### Phase 3: Search & Discovery

**Tasks:**
1. [ ] Implement semantic search endpoint
2. [ ] Implement similarity search endpoint
3. [ ] Add permission-based filtering
4. [ ] Add metadata filtering
5. [ ] Optimize vector indexes

**Deliverables:**
- Full search API functional
- Demand-side can discover IP

### Phase 4: Frontend Integration

**Tasks:**
1. [ ] Dashboard pages for entity management
2. [ ] Asset upload UI
3. [ ] Processing status indicators
4. [ ] Search interface (admin view)

**Deliverables:**
- Supply-side can manage catalog via UI
- Processing status visible

---

## 8. Migration SQL

### 8.1 Full Migration Script

```sql
-- ============================================================================
-- CLEARINGHOUSE DATA ARCHITECTURE MIGRATION
-- Version: 1.0
-- Date: 2025-12-09
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For text search optimization

-- ============================================================================
-- 1. ENHANCE RIGHTS_ENTITIES TABLE
-- ============================================================================

-- Add embedding and processing status
ALTER TABLE rights_entities
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'processing', 'ready', 'failed', 'skipped'));

ALTER TABLE rights_entities
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Add semantic metadata (hybrid schema)
ALTER TABLE rights_entities
ADD COLUMN IF NOT EXISTS semantic_metadata JSONB DEFAULT '{
    "primary_tags": [],
    "mood": [],
    "energy": null,
    "language": null,
    "explicit_content": false,
    "type_fields": {},
    "custom_tags": [],
    "ai_analysis": null
}'::jsonb;

-- Add extensions field for future flexibility
ALTER TABLE rights_entities
ADD COLUMN IF NOT EXISTS extensions JSONB DEFAULT '{}';

-- Index for semantic queries
CREATE INDEX IF NOT EXISTS idx_entities_semantic_tags
ON rights_entities USING gin ((semantic_metadata->'primary_tags'));

CREATE INDEX IF NOT EXISTS idx_entities_mood
ON rights_entities USING gin ((semantic_metadata->'mood'));

CREATE INDEX IF NOT EXISTS idx_entities_embedding_status
ON rights_entities (embedding_status);

-- ============================================================================
-- 2. REFERENCE ASSETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS reference_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rights_entity_id UUID NOT NULL REFERENCES rights_entities(id) ON DELETE CASCADE,

    -- Asset identification
    asset_type TEXT NOT NULL CHECK (asset_type IN (
        'audio_master', 'audio_preview', 'audio_stem',
        'lyrics', 'sheet_music', 'artwork', 'photo',
        'contract', 'certificate', 'other'
    )),
    filename TEXT NOT NULL,
    mime_type TEXT,
    file_size_bytes BIGINT,

    -- Storage location
    storage_bucket TEXT NOT NULL DEFAULT 'reference-assets',
    storage_path TEXT NOT NULL,
    is_public BOOLEAN DEFAULT false,

    -- Audio-specific metadata
    duration_seconds NUMERIC,
    sample_rate INTEGER,
    channels INTEGER,
    bit_depth INTEGER,

    -- Processing
    processing_status TEXT DEFAULT 'uploaded'
        CHECK (processing_status IN ('uploaded', 'processing', 'ready', 'failed')),
    processing_error TEXT,
    extracted_metadata JSONB DEFAULT '{}',

    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_entity ON reference_assets(rights_entity_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON reference_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON reference_assets(processing_status);

-- ============================================================================
-- 3. ENTITY EMBEDDINGS TABLE (pgvector)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rights_entity_id UUID NOT NULL REFERENCES rights_entities(id) ON DELETE CASCADE,

    -- Embedding identification
    embedding_type TEXT NOT NULL CHECK (embedding_type IN (
        'text_description', 'text_lyrics', 'audio_full', 'audio_segment',
        'visual', 'combined'
    )),
    source_asset_id UUID REFERENCES reference_assets(id) ON DELETE SET NULL,

    -- Model information
    model_id TEXT NOT NULL,
    model_version TEXT,

    -- The embedding vector (1536 dims for OpenAI text-embedding-3-small)
    embedding vector(1536),

    -- Segment info (for chunked embeddings)
    segment_index INTEGER DEFAULT 0,
    segment_start_ms INTEGER,
    segment_end_ms INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON entity_embeddings(rights_entity_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_type ON entity_embeddings(embedding_type);

-- Vector similarity index (IVFFlat)
-- Note: Run this AFTER inserting initial data for better index quality
-- CREATE INDEX idx_embeddings_vector ON entity_embeddings
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- For small datasets, use exact search (HNSW or no index)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw ON entity_embeddings
    USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- 4. PROCESSING JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job scope
    job_type TEXT NOT NULL CHECK (job_type IN (
        'embedding_generation', 'asset_analysis', 'metadata_extraction',
        'fingerprint_generation', 'batch_import'
    )),
    rights_entity_id UUID REFERENCES rights_entities(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES reference_assets(id) ON DELETE CASCADE,

    -- Status
    status TEXT DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0,

    -- Execution tracking
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Job data
    config JSONB DEFAULT '{}',
    result JSONB,

    -- Audit
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_entity ON processing_jobs(rights_entity_id);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON processing_jobs(job_type);

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to find similar entities by embedding
CREATE OR REPLACE FUNCTION find_similar_entities(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_catalog_ids UUID[] DEFAULT NULL,
    filter_rights_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    entity_id UUID,
    title TEXT,
    rights_type TEXT,
    catalog_id UUID,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        re.id as entity_id,
        re.title,
        re.rights_type,
        re.catalog_id,
        1 - (ee.embedding <=> query_embedding) as similarity
    FROM entity_embeddings ee
    JOIN rights_entities re ON re.id = ee.rights_entity_id
    WHERE
        re.status = 'active'
        AND re.embedding_status = 'ready'
        AND (filter_catalog_ids IS NULL OR re.catalog_id = ANY(filter_catalog_ids))
        AND (filter_rights_types IS NULL OR re.rights_type = ANY(filter_rights_types))
        AND 1 - (ee.embedding <=> query_embedding) > match_threshold
    ORDER BY ee.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to update entity embedding status
CREATE OR REPLACE FUNCTION update_entity_embedding_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When all processing jobs for an entity are complete, update status
    IF NEW.status = 'completed' AND NEW.rights_entity_id IS NOT NULL THEN
        -- Check if any jobs are still pending/processing
        IF NOT EXISTS (
            SELECT 1 FROM processing_jobs
            WHERE rights_entity_id = NEW.rights_entity_id
            AND status IN ('queued', 'processing')
            AND id != NEW.id
        ) THEN
            -- Check if any embeddings exist
            IF EXISTS (
                SELECT 1 FROM entity_embeddings
                WHERE rights_entity_id = NEW.rights_entity_id
            ) THEN
                UPDATE rights_entities
                SET embedding_status = 'ready', updated_at = now()
                WHERE id = NEW.rights_entity_id;
            END IF;
        END IF;
    ELSIF NEW.status = 'failed' AND NEW.rights_entity_id IS NOT NULL THEN
        -- If job failed and no retries left
        IF NEW.retry_count >= NEW.max_retries THEN
            UPDATE rights_entities
            SET embedding_status = 'failed',
                processing_error = NEW.error_message,
                updated_at = now()
            WHERE id = NEW.rights_entity_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_embedding_status
    AFTER UPDATE OF status ON processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_entity_embedding_status();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

-- Assets: same access as parent entity
ALTER TABLE reference_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_select" ON reference_assets FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM rights_entities re
        JOIN catalogs c ON c.id = re.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE re.id = reference_assets.rights_entity_id
        AND wm.user_id = auth.uid()
    )
);

CREATE POLICY "assets_insert" ON reference_assets FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM rights_entities re
        JOIN catalogs c ON c.id = re.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE re.id = reference_assets.rights_entity_id
        AND wm.user_id = auth.uid()
    )
);

CREATE POLICY "assets_delete" ON reference_assets FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM rights_entities re
        JOIN catalogs c ON c.id = re.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE re.id = reference_assets.rights_entity_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
);

-- Embeddings: read access same as entity
ALTER TABLE entity_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "embeddings_select" ON entity_embeddings FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM rights_entities re
        JOIN catalogs c ON c.id = re.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE re.id = entity_embeddings.rights_entity_id
        AND wm.user_id = auth.uid()
    )
);

-- Service role can insert embeddings (from background jobs)
CREATE POLICY "embeddings_service_insert" ON entity_embeddings FOR INSERT TO service_role
WITH CHECK (true);

-- Jobs: users can see their own entity jobs
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select" ON processing_jobs FOR SELECT TO authenticated
USING (
    rights_entity_id IS NULL
    OR EXISTS (
        SELECT 1 FROM rights_entities re
        JOIN catalogs c ON c.id = re.catalog_id
        JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
        WHERE re.id = processing_jobs.rights_entity_id
        AND wm.user_id = auth.uid()
    )
);

-- ============================================================================
-- 7. SEED: UPDATE RIGHTS SCHEMAS WITH AI PERMISSION TEMPLATES
-- ============================================================================

-- Update existing schemas with permission template hints
UPDATE rights_schemas SET ai_permission_fields = '{
    "training": {
        "type": "object",
        "properties": {
            "allowed": {"type": "boolean", "default": false},
            "permitted_uses": {"type": "array", "items": {"type": "string"}},
            "commercial_ok": {"type": "boolean", "default": false},
            "requires_attribution": {"type": "boolean", "default": true},
            "attribution_text": {"type": "string"}
        }
    },
    "generation": {
        "type": "object",
        "properties": {
            "allowed": {"type": "boolean", "default": false},
            "derivative_works": {"type": "boolean", "default": false},
            "style_imitation": {"type": "boolean", "default": false},
            "direct_sampling": {"type": "boolean", "default": false},
            "watermark_required": {"type": "boolean", "default": true}
        }
    },
    "commercial": {
        "type": "object",
        "properties": {
            "commercial_use_allowed": {"type": "boolean", "default": false},
            "territories": {"type": "array", "items": {"type": "string"}, "default": ["WORLDWIDE"]},
            "revenue_share_required": {"type": "boolean", "default": false}
        }
    }
}'::jsonb
WHERE ai_permission_fields IS NULL OR ai_permission_fields = '{}'::jsonb;

-- Add voice-specific permissions to voice_likeness schema
UPDATE rights_schemas SET ai_permission_fields = ai_permission_fields || '{
    "voice": {
        "type": "object",
        "properties": {
            "cloning_allowed": {"type": "boolean", "default": false},
            "synthesis_allowed": {"type": "boolean", "default": false},
            "requires_disclosure": {"type": "boolean", "default": true}
        }
    }
}'::jsonb
WHERE id = 'voice_likeness';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
```

### 8.2 Rollback Script (if needed)

```sql
-- ROLLBACK: Remove data architecture additions
-- WARNING: This will delete all embeddings and assets

DROP TABLE IF EXISTS processing_jobs CASCADE;
DROP TABLE IF EXISTS entity_embeddings CASCADE;
DROP TABLE IF EXISTS reference_assets CASCADE;

ALTER TABLE rights_entities DROP COLUMN IF EXISTS embedding_status;
ALTER TABLE rights_entities DROP COLUMN IF EXISTS processing_error;
ALTER TABLE rights_entities DROP COLUMN IF EXISTS semantic_metadata;
ALTER TABLE rights_entities DROP COLUMN IF EXISTS extensions;

DROP FUNCTION IF EXISTS find_similar_entities;
DROP FUNCTION IF EXISTS update_entity_embedding_status;
```

---

## Appendix A: Controlled Vocabulary Reference

### Mood Tags
```
happy, sad, energetic, calm, aggressive, romantic, mysterious, epic,
playful, melancholic, uplifting, dark, nostalgic, intense, peaceful,
anxious, hopeful, dreamy, powerful, gentle, ethereal, gritty, whimsical
```

### Music Genres (Top-level)
```
pop, rock, hip_hop, electronic, classical, jazz, r_and_b, country,
folk, latin, world, ambient, soundtrack, indie, metal, punk, soul,
reggae, blues, disco, house, techno, trap, lo_fi
```

### Training Use Types
```
music_generation, voice_synthesis, style_transfer, accompaniment,
remix_tools, transcription, analysis_only, image_generation,
video_generation, text_to_speech, speech_to_text
```

---

## Appendix B: API Example Requests

### Upload Entity with Asset
```bash
curl -X POST "https://api.clearinghouse.app/api/v1/catalogs/{catalog_id}/entities" \
  -H "Authorization: Bearer {token}" \
  -F "title=My Song" \
  -F "rights_type=sound_recording" \
  -F "content={\"artist\":\"Artist Name\",\"isrc\":\"USRC12345678\"}" \
  -F "ai_permissions={\"training\":{\"allowed\":true,\"commercial_ok\":false}}" \
  -F "audio_file=@/path/to/song.mp3"
```

### Semantic Search
```bash
curl -X POST "https://api.clearinghouse.app/api/v1/search/semantic" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "upbeat electronic music with female vocals for workout video",
    "training_allowed": true,
    "commercial_allowed": true,
    "mood": ["energetic", "uplifting"],
    "min_energy": 0.7,
    "limit": 20
  }'
```

### Check Permissions
```bash
curl -X POST "https://api.clearinghouse.app/api/v1/query/permissions" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "uuid-here",
    "use_case": "music_generation",
    "commercial": true,
    "territory": "US"
  }'
```

---

**Document Status**: Ready for Implementation
**Next Step**: Run migration SQL in Supabase, then implement Phase 1 tasks
