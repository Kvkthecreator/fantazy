-- Migration: 005_memory_hooks
-- Description: Memory events and conversation hooks

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Memory events table
CREATE TABLE IF NOT EXISTS memory_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,

    -- Memory classification
    type TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'event', 'goal', 'relationship', 'emotion', 'meta')),
    category TEXT,

    -- Content
    content JSONB NOT NULL,
    summary TEXT NOT NULL,

    -- Scoring
    emotional_valence INTEGER DEFAULT 0 CHECK (emotional_valence BETWEEN -2 AND 2),
    importance_score DECIMAL(3,2) DEFAULT 0.5 CHECK (importance_score BETWEEN 0 AND 1),

    -- Vector embedding for semantic search
    embedding vector(1536),

    -- Lifecycle
    last_referenced_at TIMESTAMPTZ,
    reference_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hooks table (future conversation triggers)
CREATE TABLE IF NOT EXISTS hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,

    -- Hook classification
    type TEXT NOT NULL CHECK (type IN ('reminder', 'follow_up', 'milestone', 'scheduled', 'anniversary')),
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),

    -- Content
    content TEXT NOT NULL,
    context TEXT,
    suggested_opener TEXT,

    -- Scheduling
    trigger_after TIMESTAMPTZ,
    trigger_before TIMESTAMPTZ,

    -- Status
    triggered_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE memory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hooks ENABLE ROW LEVEL SECURITY;

-- Memory events policies
CREATE POLICY memory_events_select_own ON memory_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY memory_events_insert_own ON memory_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY memory_events_update_own ON memory_events
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY memory_events_delete_own ON memory_events
    FOR DELETE USING (auth.uid() = user_id);

-- Hooks policies
CREATE POLICY hooks_select_own ON hooks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY hooks_insert_own ON hooks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY hooks_update_own ON hooks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY hooks_delete_own ON hooks
    FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memory_user ON memory_events(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_user_character ON memory_events(user_id, character_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_events(user_id, type);
CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory_events(user_id, importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_memory_active ON memory_events(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_memory_recent ON memory_events(user_id, created_at DESC);

-- Vector similarity index (IVFFlat for faster approximate search)
CREATE INDEX IF NOT EXISTS idx_memory_embedding ON memory_events
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_hooks_user ON hooks(user_id);
CREATE INDEX IF NOT EXISTS idx_hooks_pending ON hooks(user_id, trigger_after)
    WHERE is_active = TRUE AND triggered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hooks_character ON hooks(character_id);

-- Function to get relevant memories for a conversation
CREATE OR REPLACE FUNCTION get_relevant_memories(
    p_user_id UUID,
    p_character_id UUID,
    p_query_embedding vector(1536) DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    summary TEXT,
    content JSONB,
    importance_score DECIMAL,
    created_at TIMESTAMPTZ,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.type,
        m.summary,
        m.content,
        m.importance_score,
        m.created_at,
        CASE
            WHEN p_query_embedding IS NOT NULL AND m.embedding IS NOT NULL
            THEN 1 - (m.embedding <=> p_query_embedding)
            ELSE 0.0
        END as similarity
    FROM memory_events m
    WHERE m.user_id = p_user_id
        AND (m.character_id IS NULL OR m.character_id = p_character_id)
        AND m.is_active = TRUE
    ORDER BY
        CASE
            WHEN p_query_embedding IS NOT NULL AND m.embedding IS NOT NULL
            THEN m.embedding <=> p_query_embedding
            ELSE 0
        END,
        m.importance_score DESC,
        m.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active hooks for a character
CREATE OR REPLACE FUNCTION get_active_hooks(
    p_user_id UUID,
    p_character_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    content TEXT,
    suggested_opener TEXT,
    priority INTEGER,
    trigger_after TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.id,
        h.type,
        h.content,
        h.suggested_opener,
        h.priority,
        h.trigger_after
    FROM hooks h
    WHERE h.user_id = p_user_id
        AND h.character_id = p_character_id
        AND h.is_active = TRUE
        AND h.triggered_at IS NULL
        AND (h.trigger_after IS NULL OR h.trigger_after <= NOW())
        AND (h.trigger_before IS NULL OR h.trigger_before >= NOW())
    ORDER BY h.priority DESC, h.trigger_after ASC NULLS LAST
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
