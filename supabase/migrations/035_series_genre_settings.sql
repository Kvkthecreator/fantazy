-- Migration: 035_series_genre_settings.sql
-- Purpose: Add genre_settings JSONB column to series for genre doctrine customization
-- Reference: Three-tier Studio controls architecture
-- Date: 2025-12-22
--
-- Genre settings allow per-series customization of genre doctrine values:
-- - tension_style: how tension is expressed (subtle/playful/moderate/direct)
-- - pacing_curve: narrative pacing pattern (slow_burn/steady/fast_escalate)
-- - resolution_mode: how episodes can resolve (open/closed/cliffhanger)
-- - vulnerability_timing: when characters show vulnerability (early/middle/late/earned)
-- - genre_notes: free-text guidance for specific adjustments

-- ============================================================================
-- PHASE 1: Add genre_settings column to series
-- ============================================================================

ALTER TABLE series ADD COLUMN IF NOT EXISTS genre_settings JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN series.genre_settings IS 'Per-series genre doctrine overrides. Keys: tension_style, pacing_curve, resolution_mode, vulnerability_timing, genre_notes';

-- ============================================================================
-- PHASE 2: Add visual_style column if not exists (for world style inheritance)
-- ============================================================================

ALTER TABLE series ADD COLUMN IF NOT EXISTS visual_style JSONB DEFAULT '{}';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    genre_settings_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'series' AND column_name = 'genre_settings'
    ) INTO genre_settings_exists;

    IF NOT genre_settings_exists THEN
        RAISE EXCEPTION 'Migration failed: genre_settings column not added to series';
    END IF;

    RAISE NOTICE 'Migration 035_series_genre_settings completed successfully';
END $$;
