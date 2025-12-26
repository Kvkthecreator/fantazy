-- Migration: 047_explicit_turn_budget.sql
-- Purpose: Make turn_budget explicit with NOT NULL DEFAULT 10
-- Reference: Director Protocol v2.6 - Streamlined turn budget logic
-- Date: 2024-12-26
--
-- RATIONALE:
-- Previously turn_budget was nullable with implicit "or 10" fallback in multiple
-- code paths. This created:
-- - Bugs from missed fallback logic
-- - Unclear NULL semantics (infinite? disabled? default?)
-- - Debugging difficulty (can't tell default from explicit in DB)
--
-- SOLUTION:
-- - Set all NULL turn_budget to explicit 10
-- - Add NOT NULL DEFAULT 10 constraint
-- - Code becomes: `if turn == episode.turn_budget` (no interpretation)
--
-- FUTURE:
-- turn_budget remains a column variable so users can customize per-episode
-- via settings (planned feature for per-user pacing preferences).

-- ============================================================================
-- PHASE 1: POPULATE NULL VALUES WITH DEFAULT
-- ============================================================================

UPDATE episode_templates
SET turn_budget = 10
WHERE turn_budget IS NULL;

-- ============================================================================
-- PHASE 2: ADD NOT NULL CONSTRAINT WITH DEFAULT
-- ============================================================================

ALTER TABLE episode_templates
ALTER COLUMN turn_budget SET NOT NULL,
ALTER COLUMN turn_budget SET DEFAULT 10;

COMMENT ON COLUMN episode_templates.turn_budget IS 'Number of turns before suggesting next episode. Default 10. Always explicit (never NULL). Future: user-adjustable via preferences.';

-- ============================================================================
-- PHASE 3: VERIFY MIGRATION
-- ============================================================================

DO $$
DECLARE
    null_count INTEGER;
    has_default BOOLEAN;
    is_not_null BOOLEAN;
BEGIN
    -- Check no NULL values remain
    SELECT COUNT(*) INTO null_count
    FROM episode_templates WHERE turn_budget IS NULL;

    -- Check column has NOT NULL constraint
    SELECT is_nullable = 'NO' INTO is_not_null
    FROM information_schema.columns
    WHERE table_name = 'episode_templates' AND column_name = 'turn_budget';

    -- Check column has default
    SELECT column_default IS NOT NULL INTO has_default
    FROM information_schema.columns
    WHERE table_name = 'episode_templates' AND column_name = 'turn_budget';

    IF null_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % episode_templates still have NULL turn_budget', null_count;
    END IF;

    IF NOT is_not_null THEN
        RAISE EXCEPTION 'Migration failed: turn_budget NOT NULL constraint not applied';
    END IF;

    IF NOT has_default THEN
        RAISE EXCEPTION 'Migration failed: turn_budget DEFAULT not set';
    END IF;

    RAISE NOTICE 'Migration 047_explicit_turn_budget completed successfully';
    RAISE NOTICE '  - All NULL turn_budget set to 10';
    RAISE NOTICE '  - NOT NULL constraint applied';
    RAISE NOTICE '  - DEFAULT 10 set for new episodes';
END $$;
