-- Migration: 031_remove_flirt_test.sql
-- Purpose: Remove legacy Flirt Test content (replaced by Hometown Crush)
-- Date: 2025-12-20

-- ============================================================================
-- Remove Flirt Test data (series, characters, episode templates)
-- Note: This preserves any existing user sessions/evaluations for historical data
-- ============================================================================

DO $$
DECLARE
    v_series_f_id UUID;
    v_series_m_id UUID;
    v_char_f_id UUID;
    v_char_m_id UUID;
BEGIN
    -- Get IDs for logging
    SELECT id INTO v_series_f_id FROM series WHERE slug = 'flirt-test-f';
    SELECT id INTO v_series_m_id FROM series WHERE slug = 'flirt-test-m';
    SELECT id INTO v_char_f_id FROM characters WHERE slug = 'flirt-test-mina';
    SELECT id INTO v_char_m_id FROM characters WHERE slug = 'flirt-test-alex';

    RAISE NOTICE 'Removing Flirt Test content...';
    RAISE NOTICE 'Series (female): %', v_series_f_id;
    RAISE NOTICE 'Series (male): %', v_series_m_id;
    RAISE NOTICE 'Character Mina: %', v_char_f_id;
    RAISE NOTICE 'Character Alex: %', v_char_m_id;

    -- Delete sessions referencing flirt-test episode templates
    DELETE FROM sessions
    WHERE episode_template_id IN (
        SELECT id FROM episode_templates WHERE series_id IN (
            SELECT id FROM series WHERE slug IN ('flirt-test-f', 'flirt-test-m')
        )
    );
    RAISE NOTICE 'Deleted flirt-test sessions';

    -- Delete episode templates
    DELETE FROM episode_templates
    WHERE series_id IN (
        SELECT id FROM series WHERE slug IN ('flirt-test-f', 'flirt-test-m')
    );
    RAISE NOTICE 'Deleted episode templates';

    -- Delete characters
    DELETE FROM characters
    WHERE slug IN ('flirt-test-mina', 'flirt-test-alex');
    RAISE NOTICE 'Deleted characters';

    -- Delete series
    DELETE FROM series
    WHERE slug IN ('flirt-test-f', 'flirt-test-m');
    RAISE NOTICE 'Deleted series';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Flirt Test content removed successfully!';
    RAISE NOTICE '========================================';
END $$;
