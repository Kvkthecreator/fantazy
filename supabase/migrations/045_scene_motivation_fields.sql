-- Migration: 045_scene_motivation_fields.sql
-- Purpose: Add scene motivation fields to episode_templates (ADR-002 Theatrical Model)
-- Reference: docs/decisions/ADR-002-theatrical-architecture.md
-- Date: 2024-12-23

-- ============================================================================
-- ADR-002: Scene Motivation in EpisodeTemplate
-- ============================================================================
--
-- Director Protocol v2.2 moves motivation from runtime generation to authored
-- content. Scene motivation (objective/obstacle/tactic) is now a content
-- authoring concern, not a Director concern.
--
-- Theatrical Analogy:
-- - These fields are the "director's notes" given during rehearsal
-- - The actor (character LLM) internalizes them for the scene
-- - During performance (chat), the stage manager only calls pacing
-- ============================================================================

-- Scene motivation: What the character wants from the user in this scene
ALTER TABLE episode_templates
    ADD COLUMN IF NOT EXISTS scene_objective TEXT;

COMMENT ON COLUMN episode_templates.scene_objective IS
    'ADR-002: What the character wants from the user in this scene. E.g., "You want them to notice you''ve been waiting"';

-- Scene obstacle: What's stopping the character from just asking/doing it
ALTER TABLE episode_templates
    ADD COLUMN IF NOT EXISTS scene_obstacle TEXT;

COMMENT ON COLUMN episode_templates.scene_obstacle IS
    'ADR-002: What''s stopping the character from just asking directly. E.g., "You can''t seem too eager, you have pride"';

-- Scene tactic: How the character is trying to get what they want
ALTER TABLE episode_templates
    ADD COLUMN IF NOT EXISTS scene_tactic TEXT;

COMMENT ON COLUMN episode_templates.scene_tactic IS
    'ADR-002: How the character is trying to get what they want. E.g., "Pretend to be busy, but leave openings"';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    obj_col BOOLEAN;
    obs_col BOOLEAN;
    tac_col BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'episode_templates' AND column_name = 'scene_objective'
    ) INTO obj_col;

    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'episode_templates' AND column_name = 'scene_obstacle'
    ) INTO obs_col;

    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'episode_templates' AND column_name = 'scene_tactic'
    ) INTO tac_col;

    IF NOT obj_col OR NOT obs_col OR NOT tac_col THEN
        RAISE EXCEPTION 'Migration failed: scene motivation columns not created';
    END IF;

    RAISE NOTICE 'Migration 045_scene_motivation_fields completed successfully';
END $$;
