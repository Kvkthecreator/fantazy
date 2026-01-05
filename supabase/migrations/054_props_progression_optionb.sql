-- Migration: 054_props_progression_optionb.sql
-- ADR-006: Props as Progression System (Option B - Lightweight Experiment)
--
-- This migration adds minimal schema extensions to test props-as-progression
-- hypothesis before committing to the full system.
--
-- Option B adds two columns:
-- 1. is_progression_gate: Marks props that gate content/episodes
-- 2. gates_episode_id: Links to the episode this prop unlocks
--
-- These allow testing the hypothesis that players engage more when props
-- create stakes and progression, without building the full user_props
-- collection system yet.

-- =============================================================================
-- OPTION B: LIGHTWEIGHT PROGRESSION EXPERIMENT
-- =============================================================================

-- Add progression gate marker
ALTER TABLE props ADD COLUMN IF NOT EXISTS
    is_progression_gate BOOLEAN NOT NULL DEFAULT FALSE;

-- Add reference to episode this prop gates (if any)
ALTER TABLE props ADD COLUMN IF NOT EXISTS
    gates_episode_id UUID REFERENCES episode_templates(id);

-- Add badge_label for genre-agnostic prop badging (if not already present)
ALTER TABLE props ADD COLUMN IF NOT EXISTS
    badge_label VARCHAR(50);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index for finding progression gate props
CREATE INDEX IF NOT EXISTS idx_props_progression_gate
    ON props(is_progression_gate)
    WHERE is_progression_gate = TRUE;

-- Index for episode gating lookups
CREATE INDEX IF NOT EXISTS idx_props_gates_episode
    ON props(gates_episode_id)
    WHERE gates_episode_id IS NOT NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN props.is_progression_gate IS 'ADR-006 Option B: Marks this prop as gating progression. When true, collecting this prop may unlock episodes or content.';

COMMENT ON COLUMN props.gates_episode_id IS 'ADR-006 Option B: The episode_template this prop unlocks. NULL if prop doesn''t gate an episode directly.';

COMMENT ON COLUMN props.badge_label IS 'Custom badge text for PropCard display. If null and is_key_evidence=true, defaults to "Key Evidence". Authors can set any label (e.g., "Keepsake", "Critical Intel", "Cherished").';
