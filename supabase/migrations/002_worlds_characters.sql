-- Migration: 002_worlds_characters
-- Description: Worlds (settings) and Characters

-- Worlds table (settings/environments)
CREATE TABLE IF NOT EXISTS worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    default_scenes TEXT[] DEFAULT '{}',
    tone TEXT,
    ambient_details JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Characters table
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    archetype TEXT NOT NULL,
    world_id UUID REFERENCES worlds(id),
    avatar_url TEXT,

    -- Personality
    baseline_personality JSONB NOT NULL DEFAULT '{}',
    tone_style JSONB DEFAULT '{}',
    speech_patterns JSONB DEFAULT '{}',

    -- Backstory
    short_backstory TEXT,
    full_backstory TEXT,
    current_stressor TEXT,
    likes TEXT[] DEFAULT '{}',
    dislikes TEXT[] DEFAULT '{}',

    -- Conversation config
    system_prompt TEXT NOT NULL,
    starter_prompts TEXT[] DEFAULT '{}',
    example_messages JSONB DEFAULT '[]',

    -- Boundaries
    boundaries JSONB DEFAULT '{}',

    -- Relationship config
    relationship_stage_thresholds JSONB DEFAULT '{
        "acquaintance": 0,
        "friendly": 5,
        "close": 15,
        "intimate": 30
    }',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_premium BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- Worlds are readable by all authenticated users
CREATE POLICY worlds_select_authenticated ON worlds
    FOR SELECT TO authenticated USING (is_active = TRUE);

-- Characters are readable by all authenticated users
CREATE POLICY characters_select_authenticated ON characters
    FOR SELECT TO authenticated USING (is_active = TRUE);

-- Updated_at trigger for characters
CREATE TRIGGER characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_characters_archetype ON characters(archetype);
CREATE INDEX IF NOT EXISTS idx_characters_world ON characters(world_id);
CREATE INDEX IF NOT EXISTS idx_characters_active ON characters(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_characters_sort ON characters(sort_order, name);
