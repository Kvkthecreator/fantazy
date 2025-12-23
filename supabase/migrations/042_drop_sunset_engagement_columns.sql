-- Migration: Drop sunset engagement/relationship columns
-- Date: 2024-12-23
-- Purpose: Complete EP-01 Episode-First Pivot - stage progression sunset
--
-- Removed fields (replaced by dynamic relationship with tone/tension/beats):
-- - stage: Always "acquaintance", never updated
-- - stage_progress: Always 0, never updated
-- - inside_jokes: Never populated (milestones serves similar purpose)
--
-- Also removes from characters:
-- - relationship_stage_thresholds: Never read, only defined
--
-- Reference: docs/quality/core/CONTEXT_LAYERS.md

-- Drop sunset engagement columns
ALTER TABLE engagements DROP COLUMN IF EXISTS stage;
ALTER TABLE engagements DROP COLUMN IF EXISTS stage_progress;
ALTER TABLE engagements DROP COLUMN IF EXISTS inside_jokes;

-- Drop sunset character columns
ALTER TABLE characters DROP COLUMN IF EXISTS relationship_stage_thresholds;

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 042: Dropped sunset columns from engagements (stage, stage_progress, inside_jokes) and characters (relationship_stage_thresholds)';
    RAISE NOTICE 'Relationship context now uses: dynamic (tone, tension_level, recent_beats), milestones';
END
$$;
