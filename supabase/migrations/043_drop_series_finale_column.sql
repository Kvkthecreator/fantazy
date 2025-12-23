-- Migration: Drop series_finale column from episode_templates
-- Date: 2024-12-23
-- Purpose: Remove unused field identified in context layer audit
--
-- Removed field:
-- - series_finale: Never used in prompt generation or Director logic
--
-- Reference: docs/quality/core/CONTEXT_LAYERS.md v1.4.0

-- Drop unused series_finale column
ALTER TABLE episode_templates DROP COLUMN IF EXISTS series_finale;

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 043: Dropped series_finale column from episode_templates (was never used)';
END
$$;
