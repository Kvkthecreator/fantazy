-- Migration: 017_character_creation_contract
-- Description: Add opening beat fields and explicit status for character creation contract
-- This migration establishes the immutable character creation contract:
--   Required: name, slug, archetype, system_prompt, baseline_personality, boundaries,
--             opening_situation, opening_line, avatar_url
--   Status: draft (editable, not chat-ready) vs active (chat-ready)

-- Add opening beat fields (first-class, not buried in other fields)
ALTER TABLE characters ADD COLUMN IF NOT EXISTS opening_situation TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS opening_line TEXT;

-- Add explicit status enum (clearer than just is_active boolean)
-- 'draft' = work in progress, not chat-accessible
-- 'active' = chat-ready, selectable by users
ALTER TABLE characters ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active'));

-- Add creator tracking (for studio characters)
ALTER TABLE characters ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Add categories/tags for discovery
ALTER TABLE characters ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- Add content rating
ALTER TABLE characters ADD COLUMN IF NOT EXISTS content_rating TEXT DEFAULT 'sfw' CHECK (content_rating IN ('sfw', 'adult'));

-- Sync status with is_active for existing records
UPDATE characters SET status = CASE WHEN is_active THEN 'active' ELSE 'draft' END;

-- Migrate existing starter_prompts[0] to opening_line where applicable
UPDATE characters
SET opening_line = starter_prompts[1]
WHERE opening_line IS NULL AND array_length(starter_prompts, 1) > 0;

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_characters_status ON characters(status);
CREATE INDEX IF NOT EXISTS idx_characters_created_by ON characters(created_by);
CREATE INDEX IF NOT EXISTS idx_characters_categories ON characters USING GIN(categories);

-- Update RLS to allow creators to see their own draft characters
DROP POLICY IF EXISTS characters_select_authenticated ON characters;

CREATE POLICY characters_select_authenticated ON characters
    FOR SELECT TO authenticated
    USING (
        status = 'active'
        OR created_by = auth.uid()
    );

-- Policy for creators to insert their own characters
CREATE POLICY characters_insert_authenticated ON characters
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Policy for creators to update their own characters
CREATE POLICY characters_update_own ON characters
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- =============================================================================
-- HARDENING: Enforce is_active = (status = 'active') at DB layer
-- =============================================================================

-- Trigger function to sync is_active with status
CREATE OR REPLACE FUNCTION sync_character_status()
RETURNS TRIGGER AS $$
BEGIN
    -- is_active is derived from status, always
    NEW.is_active := (NEW.status = 'active');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS characters_sync_status ON characters;
CREATE TRIGGER characters_sync_status
    BEFORE INSERT OR UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION sync_character_status();

-- Fix any existing drift
UPDATE characters SET is_active = (status = 'active') WHERE is_active != (status = 'active');

-- Add comment explaining the character creation contract
COMMENT ON TABLE characters IS 'Character creation contract:
REQUIRED for creation (wizard steps 1-3):
  - name: Character display name
  - slug: URL-safe identifier (auto-generated, editable)
  - archetype: Character type/role enum
  - baseline_personality: Big Five traits (presets allowed)
  - boundaries: Safety configuration (sensible defaults)
  - opening_situation: Scene setup for first chat
  - opening_line: Character first message

REQUIRED for activation (draft -> active):
  - avatar_url: Primary visual anchor
  - All required creation fields populated

OPTIONAL (post-creation editing):
  - short_backstory, full_backstory, current_stressor
  - likes, dislikes
  - tone_style, speech_patterns
  - starter_prompts (additional openers beyond opening_line)
  - example_messages
  - world_id (optional world attachment)
  - categories, content_rating
';
