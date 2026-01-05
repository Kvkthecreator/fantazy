-- Migration: 053_props_domain.sql
-- ADR-005: Props Domain - Canonical Story Objects
--
-- Props are authored story objects with exact, immutable content.
-- They solve the "details don't stick" problem where LLMs improvise
-- inconsistent details for key story elements.
--
-- Layer 2.5 in Context Architecture (between Episode and Engagement)

-- =============================================================================
-- PROPS TABLE
-- =============================================================================
-- Canonical story objects attached to episodes

CREATE TABLE IF NOT EXISTS props (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_template_id UUID NOT NULL REFERENCES episode_templates(id) ON DELETE CASCADE,

    -- Identity
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,

    -- What the prop IS
    prop_type VARCHAR(50) NOT NULL CHECK (prop_type IN (
        'document',   -- Note, letter, contract (has text content)
        'photo',      -- Surveillance photo, yearbook (image + optional caption)
        'object',     -- Key, mixtape, heirloom (description only)
        'recording',  -- Voicemail, video (transcript)
        'digital'     -- Text message, email (exact digital content)
    )),
    description TEXT NOT NULL,

    -- Canonical content (exact text/transcript - immutable once set)
    content TEXT,
    content_format VARCHAR(50) CHECK (content_format IN (
        'handwritten',
        'typed',
        'audio_transcript',
        'video_transcript',
        NULL  -- For objects without text content
    )),

    -- Visual representation
    image_url TEXT,
    image_prompt TEXT,

    -- Revelation mechanics
    reveal_mode VARCHAR(50) NOT NULL DEFAULT 'character_initiated' CHECK (reveal_mode IN (
        'character_initiated',  -- Character shows it naturally
        'player_requested',     -- Player must ask to see it
        'automatic',            -- Revealed at specific turn
        'gated'                 -- Requires prior prop
    )),
    reveal_turn_hint INT,  -- Suggested turn for reveal (soft guidance)
    prerequisite_prop_id UUID REFERENCES props(id),

    -- Narrative weight
    is_key_evidence BOOLEAN NOT NULL DEFAULT FALSE,
    evidence_tags JSONB NOT NULL DEFAULT '[]',

    -- Ordering within episode
    display_order INT NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(episode_template_id, slug)
);

-- Index for episode lookup
CREATE INDEX IF NOT EXISTS idx_props_episode ON props(episode_template_id);

-- Index for prerequisite chains
CREATE INDEX IF NOT EXISTS idx_props_prerequisite ON props(prerequisite_prop_id) WHERE prerequisite_prop_id IS NOT NULL;

-- =============================================================================
-- SESSION PROPS TABLE
-- =============================================================================
-- Tracks which props have been revealed to user in a session

CREATE TABLE IF NOT EXISTS session_props (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    prop_id UUID NOT NULL REFERENCES props(id) ON DELETE CASCADE,

    -- Revelation tracking
    revealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revealed_turn INT NOT NULL,
    reveal_trigger VARCHAR(100),  -- "character_showed", "player_asked", "automatic", "gated_unlock"

    -- Player interaction tracking
    examined_count INT NOT NULL DEFAULT 1,
    last_examined_at TIMESTAMPTZ,

    -- Unique constraint: one reveal per session-prop pair
    UNIQUE(session_id, prop_id)
);

-- Index for session lookup
CREATE INDEX IF NOT EXISTS idx_session_props_session ON session_props(session_id);

-- Index for prop lookup (e.g., "how many users have seen this prop")
CREATE INDEX IF NOT EXISTS idx_session_props_prop ON session_props(prop_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE props ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_props ENABLE ROW LEVEL SECURITY;

-- Props are public read (anyone can see prop definitions)
CREATE POLICY "Props are viewable by everyone"
    ON props FOR SELECT
    USING (true);

-- Props are editable by service role only (authored content)
-- No INSERT/UPDATE/DELETE policies for authenticated users

-- Session props: users can only see their own session props
CREATE POLICY "Users can view their own session props"
    ON session_props FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM sessions WHERE user_id = auth.uid()
        )
    );

-- Users can insert their own session props (revelation tracking)
CREATE POLICY "Users can create their own session props"
    ON session_props FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT id FROM sessions WHERE user_id = auth.uid()
        )
    );

-- Users can update their own session props (examined_count, last_examined_at)
CREATE POLICY "Users can update their own session props"
    ON session_props FOR UPDATE
    USING (
        session_id IN (
            SELECT id FROM sessions WHERE user_id = auth.uid()
        )
    );

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_props_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER props_updated_at
    BEFORE UPDATE ON props
    FOR EACH ROW
    EXECUTE FUNCTION update_props_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE props IS 'ADR-005: Canonical story objects with exact, immutable content. Layer 2.5 in Context Architecture.';
COMMENT ON COLUMN props.content IS 'Exact canonical text/transcript. Once set, should not change to ensure consistency.';
COMMENT ON COLUMN props.reveal_mode IS 'How this prop gets revealed: character_initiated (natural), player_requested (must ask), automatic (at turn), gated (requires prior prop)';
COMMENT ON COLUMN props.is_key_evidence IS 'For mystery/thriller: marks props critical for story resolution';
COMMENT ON COLUMN props.evidence_tags IS 'JSON array of tags for categorization, e.g., ["handwriting", "timeline", "suspect_A"]';

COMMENT ON TABLE session_props IS 'Tracks prop revelation state per session. Enables cross-episode continuity.';
COMMENT ON COLUMN session_props.revealed_turn IS 'Turn number when prop was first revealed to player';
COMMENT ON COLUMN session_props.examined_count IS 'How many times player has asked to see/review this prop';
