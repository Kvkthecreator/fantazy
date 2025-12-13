-- Migration: 015_relationship_dynamics
-- Description: Add beat-aware relationship tracking (dynamic state, milestones)
-- Replaces blunt stage-based progression with narrative intelligence

-- ============================================================================
-- Add dynamic relationship tracking columns
-- ============================================================================

-- Dynamic state: tone, tension level, recent beats
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS dynamic JSONB DEFAULT '{
    "tone": "warm",
    "tension_level": 30,
    "recent_beats": []
}';

-- Milestone flags for significant relationship moments
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS milestones TEXT[] DEFAULT '{}';

-- ============================================================================
-- Create index for efficient querying
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_relationships_dynamic ON relationships USING GIN (dynamic);

-- ============================================================================
-- Note: Keeping old columns for rollback safety
-- ============================================================================
-- stage and stage_progress columns are preserved but deprecated
-- They can be dropped in a future migration after validation:
-- ALTER TABLE relationships DROP COLUMN stage;
-- ALTER TABLE relationships DROP COLUMN stage_progress;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON COLUMN relationships.dynamic IS 'Beat-aware relationship state: {tone, tension_level, recent_beats[]}';
COMMENT ON COLUMN relationships.milestones IS 'Significant relationship moments: first_secret_shared, user_opened_up, etc.';
