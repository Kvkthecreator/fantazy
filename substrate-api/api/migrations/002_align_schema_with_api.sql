-- =============================================================================
-- CLEARINGHOUSE: Schema Alignment Migration
-- =============================================================================
-- Purpose: Align database schema with API route expectations
-- Date: 2025-12-10
--
-- This migration adds missing tables and columns required by the API routes.
-- Run via Supabase Dashboard SQL Editor or psql.
-- =============================================================================

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- 1. ADD MISSING COLUMNS TO rights_entities
-- =============================================================================

-- Add embedding pipeline columns
ALTER TABLE rights_entities
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'processing', 'ready', 'failed', 'skipped'));

ALTER TABLE rights_entities
ADD COLUMN IF NOT EXISTS processing_error TEXT;

ALTER TABLE rights_entities
ADD COLUMN IF NOT EXISTS semantic_metadata JSONB DEFAULT '{}';

-- =============================================================================
-- 2. ADD MISSING COLUMNS TO reference_assets
-- =============================================================================

-- Rename file_name to filename (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'reference_assets' AND column_name = 'file_name') THEN
        ALTER TABLE reference_assets RENAME COLUMN file_name TO filename;
    END IF;
END $$;

-- Rename content_type to mime_type (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'reference_assets' AND column_name = 'content_type') THEN
        ALTER TABLE reference_assets RENAME COLUMN content_type TO mime_type;
    END IF;
END $$;

-- Add storage columns (for Supabase Storage integration)
ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'reference-assets';

ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Migrate file_url to storage_path if needed
UPDATE reference_assets
SET storage_path = file_url
WHERE storage_path IS NULL AND file_url IS NOT NULL;

ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Add processing columns
ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'uploaded', 'processing', 'ready', 'failed'));

ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS processing_error TEXT;

ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS extracted_metadata JSONB DEFAULT '{}';

-- Add audio-specific metadata columns
ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC;

ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS sample_rate INTEGER;

ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS channels INTEGER;

ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS bit_depth INTEGER;

-- Add audit columns
ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE reference_assets
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Migrate uploaded_by to created_by if needed
UPDATE reference_assets
SET created_by = uploaded_by::text
WHERE created_by IS NULL AND uploaded_by IS NOT NULL;

-- =============================================================================
-- 3. CREATE processing_jobs TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL
        CHECK (job_type IN ('embedding_generation', 'asset_analysis', 'metadata_extraction', 'fingerprint_generation', 'batch_import')),
    rights_entity_id UUID REFERENCES rights_entities(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES reference_assets(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for job queue processing
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_entity ON processing_jobs(rights_entity_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_asset ON processing_jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_queue ON processing_jobs(status, priority DESC, created_at ASC)
    WHERE status IN ('queued', 'processing');

-- =============================================================================
-- 4. CREATE entity_embeddings TABLE (for vector search)
-- =============================================================================

CREATE TABLE IF NOT EXISTS entity_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rights_entity_id UUID NOT NULL REFERENCES rights_entities(id) ON DELETE CASCADE,
    embedding_type TEXT NOT NULL DEFAULT 'content'
        CHECK (embedding_type IN ('content', 'metadata', 'asset', 'combined')),
    model_id TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
    source_text TEXT,
    source_hash TEXT,  -- For deduplication
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(rights_entity_id, embedding_type, source_hash)
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_entity_embeddings_vector
    ON entity_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_entity_embeddings_entity ON entity_embeddings(rights_entity_id);

-- =============================================================================
-- 5. ADD TRIGGERS FOR updated_at
-- =============================================================================

-- Generic trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to processing_jobs
DROP TRIGGER IF EXISTS update_processing_jobs_updated_at ON processing_jobs;
CREATE TRIGGER update_processing_jobs_updated_at
    BEFORE UPDATE ON processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to entity_embeddings
DROP TRIGGER IF EXISTS update_entity_embeddings_updated_at ON entity_embeddings;
CREATE TRIGGER update_entity_embeddings_updated_at
    BEFORE UPDATE ON entity_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to reference_assets
DROP TRIGGER IF EXISTS update_reference_assets_updated_at ON reference_assets;
CREATE TRIGGER update_reference_assets_updated_at
    BEFORE UPDATE ON reference_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_embeddings ENABLE ROW LEVEL SECURITY;

-- Processing jobs: users can select their processing jobs (through entity access)
CREATE POLICY processing_jobs_select_members ON processing_jobs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rights_entities re
            JOIN catalogs c ON c.id = re.catalog_id
            JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
            WHERE re.id = processing_jobs.rights_entity_id
            AND wm.user_id = auth.uid()
        )
    );

-- Processing jobs: users can insert jobs for entities they have access to
CREATE POLICY processing_jobs_insert_members ON processing_jobs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rights_entities re
            JOIN catalogs c ON c.id = re.catalog_id
            JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
            WHERE re.id = processing_jobs.rights_entity_id
            AND wm.user_id = auth.uid()
        )
    );

-- Processing jobs: service role has full access (for background workers)
CREATE POLICY processing_jobs_service_role ON processing_jobs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Entity embeddings: users can view embeddings for entities they have access to
CREATE POLICY entity_embeddings_select_members ON entity_embeddings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rights_entities re
            JOIN catalogs c ON c.id = re.catalog_id
            JOIN workspace_memberships wm ON wm.workspace_id = c.workspace_id
            WHERE re.id = entity_embeddings.rights_entity_id
            AND wm.user_id = auth.uid()
        )
    );

-- Entity embeddings: service role has full access (for background workers)
CREATE POLICY entity_embeddings_service_role ON entity_embeddings
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show updated schema
SELECT
    'rights_entities' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'rights_entities'
AND column_name IN ('embedding_status', 'processing_error', 'semantic_metadata')
ORDER BY column_name;

SELECT
    'reference_assets' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'reference_assets'
ORDER BY ordinal_position;

SELECT
    'processing_jobs' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'processing_jobs'
ORDER BY ordinal_position;

SELECT
    'entity_embeddings' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'entity_embeddings'
ORDER BY ordinal_position;
