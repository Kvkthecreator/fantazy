-- Migration: 004_episodes_messages
-- Description: Episodes (conversation sessions) and Messages

-- Episodes table
CREATE TABLE IF NOT EXISTS episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    relationship_id UUID REFERENCES relationships(id) ON DELETE SET NULL,

    -- Episode info
    episode_number INTEGER NOT NULL,
    title TEXT,
    scene TEXT,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    -- Summary (generated after episode ends)
    summary TEXT,
    emotional_tags TEXT[] DEFAULT '{}',
    key_events TEXT[] DEFAULT '{}',

    -- Stats
    message_count INTEGER DEFAULT 0,
    user_message_count INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,

    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- LLM metadata
    model_used TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    latency_ms INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Episodes policies
CREATE POLICY episodes_select_own ON episodes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY episodes_insert_own ON episodes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY episodes_update_own ON episodes
    FOR UPDATE USING (auth.uid() = user_id);

-- Messages policies (via episode ownership)
CREATE POLICY messages_select_own ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM episodes
            WHERE episodes.id = messages.episode_id
            AND episodes.user_id = auth.uid()
        )
    );

CREATE POLICY messages_insert_own ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM episodes
            WHERE episodes.id = messages.episode_id
            AND episodes.user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_episodes_user ON episodes(user_id);
CREATE INDEX IF NOT EXISTS idx_episodes_character ON episodes(character_id);
CREATE INDEX IF NOT EXISTS idx_episodes_user_character ON episodes(user_id, character_id);
CREATE INDEX IF NOT EXISTS idx_episodes_active ON episodes(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_episodes_relationship ON episodes(relationship_id);
CREATE INDEX IF NOT EXISTS idx_episodes_started ON episodes(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_episode ON messages(episode_id);
CREATE INDEX IF NOT EXISTS idx_messages_episode_created ON messages(episode_id, created_at);

-- Function to update episode message count
CREATE OR REPLACE FUNCTION update_episode_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE episodes
    SET
        message_count = message_count + 1,
        user_message_count = user_message_count + CASE WHEN NEW.role = 'user' THEN 1 ELSE 0 END
    WHERE id = NEW.episode_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER messages_count_trigger
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_episode_message_count();

-- Function to update relationship stats on episode end
CREATE OR REPLACE FUNCTION update_relationship_on_episode_end()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        UPDATE relationships
        SET
            total_episodes = total_episodes + 1,
            total_messages = total_messages + NEW.user_message_count,
            last_interaction_at = NEW.ended_at,
            stage_progress = stage_progress + GREATEST(1, NEW.user_message_count / 5)
        WHERE id = NEW.relationship_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER episode_end_trigger
    AFTER UPDATE ON episodes
    FOR EACH ROW EXECUTE FUNCTION update_relationship_on_episode_end();
