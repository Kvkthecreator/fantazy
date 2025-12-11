-- Migration: 003_relationships
-- Description: User-Character relationships

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

    -- Progression
    stage TEXT DEFAULT 'acquaintance',
    stage_progress INTEGER DEFAULT 0,
    total_episodes INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,

    -- Timestamps
    first_met_at TIMESTAMPTZ DEFAULT NOW(),
    last_interaction_at TIMESTAMPTZ,

    -- Custom data
    nickname TEXT,
    inside_jokes TEXT[] DEFAULT '{}',
    relationship_notes TEXT,
    metadata JSONB DEFAULT '{}',

    -- Status
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, character_id)
);

-- Enable RLS
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

-- Users can only access their own relationships
CREATE POLICY relationships_select_own ON relationships
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY relationships_insert_own ON relationships
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY relationships_update_own ON relationships
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY relationships_delete_own ON relationships
    FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER relationships_updated_at
    BEFORE UPDATE ON relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_relationships_user ON relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_character ON relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_relationships_user_active ON relationships(user_id, is_archived)
    WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_relationships_last_interaction ON relationships(user_id, last_interaction_at DESC);
