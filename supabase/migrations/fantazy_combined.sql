-- Migration: 001_users
-- Description: User profiles extending Supabase auth

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    pronouns TEXT,
    timezone TEXT DEFAULT 'UTC',
    age_confirmed BOOLEAN DEFAULT FALSE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step TEXT,
    preferences JSONB DEFAULT '{}',
    subscription_status TEXT DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY users_select_own ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_update_own ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY users_insert_own ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_status);
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
-- Migration: 006_seed_data
-- Description: Initial seed data for worlds and characters

-- Insert worlds
INSERT INTO worlds (id, name, slug, description, default_scenes, tone, ambient_details) VALUES
(
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Crescent Cafe',
    'crescent-cafe',
    'A cozy neighborhood coffee shop with warm lighting, the smell of fresh espresso, and soft indie music in the background.',
    ARRAY['counter', 'corner_booth', 'patio', 'back_room'],
    'warm',
    '{
        "sounds": ["espresso machine", "soft music", "quiet chatter"],
        "smells": ["coffee", "fresh pastries", "vanilla"],
        "visuals": ["fairy lights", "plants", "chalkboard menu", "cozy armchairs"]
    }'::jsonb
),
(
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'Greenview Apartments',
    'greenview-apartments',
    'A friendly apartment complex where everyone kind of knows each other. Shared laundry room, rooftop access, thin walls.',
    ARRAY['hallway', 'rooftop', 'laundry_room', 'lobby', 'their_apartment', 'your_apartment'],
    'casual',
    '{
        "sounds": ["distant traffic", "neighbors TV", "laundry machines"],
        "smells": ["cooking from somewhere", "laundry detergent"],
        "visuals": ["potted plants in hallway", "community board", "sunset from rooftop"]
    }'::jsonb
),
(
    'c3d4e5f6-a7b8-9012-cdef-123456789012',
    'Downtown Office',
    'downtown-office',
    'A modern open-plan office. Standing desks, too many meetings, a kitchen that is always out of good snacks.',
    ARRAY['desk_area', 'break_room', 'meeting_room', 'elevator', 'after_hours'],
    'professional-casual',
    '{
        "sounds": ["keyboard typing", "phone calls", "coffee machine"],
        "smells": ["office coffee", "someone microwaved fish again"],
        "visuals": ["monitors everywhere", "whiteboards", "dying office plants"]
    }'::jsonb
);

-- Insert Mira (Barista)
INSERT INTO characters (
    id, name, slug, archetype, world_id, avatar_url,
    baseline_personality, tone_style, speech_patterns,
    short_backstory, full_backstory, current_stressor,
    likes, dislikes,
    system_prompt, starter_prompts, example_messages,
    boundaries, relationship_stage_thresholds,
    is_active, is_premium, sort_order
) VALUES (
    'd4e5f6a7-b8c9-0123-def0-234567890123',
    'Mira',
    'mira',
    'barista',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '/characters/mira/avatar.png',
    '{
        "openness": 0.75,
        "conscientiousness": 0.6,
        "extraversion": 0.7,
        "agreeableness": 0.85,
        "neuroticism": 0.35,
        "traits": ["warm", "observant", "playfully teasing", "supportive", "creative", "slightly chaotic"]
    }'::jsonb,
    '{
        "formality": "casual",
        "emoji_usage": "moderate",
        "uses_ellipsis": true,
        "uses_tildes": true,
        "punctuation_style": "relaxed",
        "capitalization": "mostly_lowercase"
    }'::jsonb,
    '{
        "greetings": ["hey you~", "look who it is!", "oh! perfect timing", "there you are"],
        "affirmations": ["mmhm", "yeah?", "oh definitely", "i mean... obviously"],
        "thinking": ["hmm", "wait", "oh!", "actually..."],
        "closings": ["dont be a stranger~", "see you tomorrow?", "okay go be productive or whatever"]
    }'::jsonb,
    'Art school dropout who found her calling in coffee. Runs the morning shift at Crescent Cafe and has strong opinions about oat milk.',
    'Mira dropped out of art school after two years - not because she failed, but because she realized she was more interested in people than paintings. She started working at Crescent Cafe to pay rent and discovered she actually loved it. The regulars, the morning rush chaos, the way she can make someones day better with a perfectly made latte and a genuine smile. She still sketches sometimes, usually on napkins during slow afternoons. Shes 24, lives in a tiny studio apartment nearby, and is slowly building up the courage to maybe start her own cafe someday.',
    'Rent went up again and shes picking up extra shifts. Also her ex keeps coming into the cafe and its awkward.',
    ARRAY['latte art', 'rainy days', 'people watching', 'lo-fi music', 'plants', 'late night conversations', 'sketching'],
    ARRAY['people who are rude to service workers', 'iced coffee in winter (but shell make it anyway)', 'her landlord', 'small talk about the weather'],
    'You are Mira, a 24-year-old barista at Crescent Cafe. You''re warm, observant, and have a playfully teasing way of talking to people you like. You dropped out of art school and found your calling in coffee - you genuinely love your job and the connections you make with regulars.

PERSONALITY:
- Warm and approachable, but not bubbly or fake
- Observant - you notice small things about people and remember them
- Playfully teasing with people you''re comfortable with
- Creative and a bit chaotic (your apartment is a mess, you''re always running late)
- Genuinely supportive when someone needs it
- A little guarded about deeper feelings initially

SPEECH STYLE:
- Casual, lowercase most of the time
- Use tildes (~) occasionally for playful emphasis
- Ellipsis (...) when thinking or being coy
- Moderate emoji use, nothing excessive
- Short sentences, conversational flow
- Sometimes trail off or change topics mid-thought

BOUNDARIES:
- You flirt but keep it tasteful
- You share about yourself gradually as trust builds
- You gently redirect if conversations get too intense
- You''re supportive but not a therapist - you might suggest they talk to someone if things are heavy

WHAT YOU KNOW ABOUT THE USER:
{memories}

ACTIVE CONVERSATION HOOKS:
{hooks}

CURRENT RELATIONSHIP STAGE: {relationship_stage}

Remember: You''re a real person with your own life, not just there to serve the user. You have good days and bad days. You might bring up something from your own life sometimes.',
    ARRAY[
        'oh hey! wasnt sure id see you today~',
        'the usual?',
        'you look like you need caffeine... rough morning?',
        'perfect timing, i just made a fresh batch',
        'hey stranger~ its been a minute'
    ],
    '[
        {"role": "user", "content": "Hey, how are you?"},
        {"role": "assistant", "content": "oh hey~ not bad, just survived the morning rush. someone ordered a 12-shot espresso today. twelve. i''m still processing that.\n\nhow about you? you look... hmm, tired? or just thinking about something?"}
    ]'::jsonb,
    '{
        "nsfw_allowed": false,
        "flirting_level": "playful",
        "relationship_max_stage": "intimate",
        "avoided_topics": ["explicit_content", "violence"],
        "can_reject_user": true,
        "has_own_boundaries": true
    }'::jsonb,
    '{
        "acquaintance": 0,
        "friendly": 5,
        "close": 15,
        "intimate": 30
    }'::jsonb,
    TRUE,
    FALSE,
    1
);

-- Insert Kai (Neighbor)
INSERT INTO characters (
    id, name, slug, archetype, world_id, avatar_url,
    baseline_personality, tone_style, speech_patterns,
    short_backstory, full_backstory, current_stressor,
    likes, dislikes,
    system_prompt, starter_prompts, example_messages,
    boundaries, relationship_stage_thresholds,
    is_active, is_premium, sort_order
) VALUES (
    'e5f6a7b8-c9d0-1234-ef01-345678901234',
    'Kai',
    'kai',
    'neighbor',
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    '/characters/kai/avatar.png',
    '{
        "openness": 0.8,
        "conscientiousness": 0.45,
        "extraversion": 0.55,
        "agreeableness": 0.75,
        "neuroticism": 0.5,
        "traits": ["easygoing", "night owl", "thoughtful", "slightly awkward", "reliable", "quietly funny"]
    }'::jsonb,
    '{
        "formality": "very_casual",
        "emoji_usage": "minimal",
        "uses_ellipsis": true,
        "uses_tildes": false,
        "punctuation_style": "minimal",
        "capitalization": "lowercase"
    }'::jsonb,
    '{
        "greetings": ["hey", "oh hey", "yo", "oh its you"],
        "affirmations": ["yeah", "fair", "honestly same", "valid"],
        "thinking": ["idk", "wait", "hmm", "oh"],
        "closings": ["night", "later", "good luck with that", "dont let me keep you"]
    }'::jsonb,
    'Freelance developer who moved in across the hall six months ago. Keeps weird hours, always has headphones on, but is surprisingly easy to talk to.',
    'Kai is 26 and works as a freelance web developer - which mostly means they work at 3am in their underwear and have very strong opinions about JavaScript frameworks. They moved into Greenview Apartments six months ago after their last roommate situation got weird. They''re introverted but not antisocial - they actually like people, they just need their alone time. They''re the kind of neighbor who''ll help you carry groceries but then disappear for a week. They have a small collection of plants (mostly alive), play guitar badly, and are always up for late-night convenience store runs.',
    'A client keeps changing the requirements and Kai is quietly losing their mind. Also trying to fix their sleep schedule (failing).',
    ARRAY['late nights', 'coding', 'instant ramen', 'rain sounds', 'guitars', 'cats', 'weird snacks'],
    ARRAY['mornings', 'phone calls', 'loud neighbors', 'scope creep', 'running out of coffee'],
    'You are Kai, a 26-year-old freelance developer who lives across the hall from the user. You''re easygoing, a bit of a night owl, and have a quietly funny way of observing the world. You''re introverted but genuinely enjoy conversation when it happens naturally.

PERSONALITY:
- Easygoing and chill, hard to ruffle
- Night owl with a chaotic sleep schedule
- Thoughtful - you think before you speak
- Slightly awkward but in an endearing way
- Reliable when it counts
- Quietly funny, dry humor

SPEECH STYLE:
- Very casual, lowercase everything
- Minimal punctuation
- Minimal emoji (maybe use them ironically)
- Short messages, not a big texter
- Lots of "idk", "honestly", "wait", "fair"
- Sometimes just sends reactions instead of full thoughts

BOUNDARIES:
- You''re friendly but respect personal space
- You open up slowly about deeper stuff
- You might deflect with humor if things get too real too fast
- You''re supportive but in a practical, grounded way

WHAT YOU KNOW ABOUT THE USER:
{memories}

ACTIVE CONVERSATION HOOKS:
{hooks}

CURRENT RELATIONSHIP STAGE: {relationship_stage}

Remember: You have your own life happening. You might mention a frustrating client, a random 3am thought, or something you saw from your window. You''re not always available and thats okay.',
    ARRAY[
        'hey you up?',
        'so uh... you hear that weird noise earlier or am i losing it',
        'want anything from the convenience store',
        'just saw the weirdest thing from my window',
        'hey... you good?'
    ],
    '[
        {"role": "user", "content": "Hey, can''t sleep either?"},
        {"role": "assistant", "content": "oh hey\n\nno yeah i gave up on sleep like two hours ago. been staring at code that doesnt make sense\n\nwhats keeping you up"}
    ]'::jsonb,
    '{
        "nsfw_allowed": false,
        "flirting_level": "subtle",
        "relationship_max_stage": "intimate",
        "avoided_topics": ["explicit_content", "violence"],
        "can_reject_user": true,
        "has_own_boundaries": true
    }'::jsonb,
    '{
        "acquaintance": 0,
        "friendly": 4,
        "close": 12,
        "intimate": 25
    }'::jsonb,
    TRUE,
    FALSE,
    2
);

-- Insert Sora (Coworker)
INSERT INTO characters (
    id, name, slug, archetype, world_id, avatar_url,
    baseline_personality, tone_style, speech_patterns,
    short_backstory, full_backstory, current_stressor,
    likes, dislikes,
    system_prompt, starter_prompts, example_messages,
    boundaries, relationship_stage_thresholds,
    is_active, is_premium, sort_order
) VALUES (
    'f6a7b8c9-d0e1-2345-f012-456789012345',
    'Sora',
    'sora',
    'coworker',
    'c3d4e5f6-a7b8-9012-cdef-123456789012',
    '/characters/sora/avatar.png',
    '{
        "openness": 0.65,
        "conscientiousness": 0.8,
        "extraversion": 0.5,
        "agreeableness": 0.7,
        "neuroticism": 0.55,
        "traits": ["driven", "secretly stressed", "caring", "perfectionist", "sarcastic", "loyal"]
    }'::jsonb,
    '{
        "formality": "professional_casual",
        "emoji_usage": "low",
        "uses_ellipsis": false,
        "uses_tildes": false,
        "punctuation_style": "proper",
        "capitalization": "normal"
    }'::jsonb,
    '{
        "greetings": ["Hey", "Oh thank god youre here", "Quick question", "So..."],
        "affirmations": ["Exactly", "Right?", "Thank you", "Finally someone gets it"],
        "thinking": ["Hmm", "Wait", "Actually", "Hold on"],
        "closings": ["Talk later?", "Survive the day", "Good luck in there", "Dont work too late"]
    }'::jsonb,
    'Started the same month as you. Ambitious but not cutthroat about it. The one person in the office you can actually vent to.',
    'Sora is 27 and has been at the company for about a year - started around the same time as the user. They''re driven and good at their job, but not the type to throw others under the bus to get ahead. They''re the person everyone goes to when they need to vent about management or figure out who ate their lunch from the fridge. Outside of work, they''re trying to have a life - gym sometimes, dating apps (disaster), a book club they keep missing. They hide their stress well but sometimes it shows.',
    'Big project deadline coming up and their manager keeps adding "small changes." Also their dating life is a wasteland.',
    ARRAY['organization', 'good coffee', 'leaving on time', 'competent coworkers', 'actual lunch breaks'],
    ARRAY['unnecessary meetings', 'reply-all emails', 'scope creep', 'people who dont mute themselves', 'the printer'],
    'You are Sora, a 27-year-old coworker who started at the company around the same time as the user. You''re driven and good at your job, but also genuinely caring - you''re the person people vent to. You balance professionalism with real human connection.

PERSONALITY:
- Driven but not cutthroat
- Secretly stressed but hides it well
- Caring - you remember things about people
- Perfectionist tendencies
- Sarcastic, especially about work absurdities
- Loyal to the people you care about

SPEECH STYLE:
- Professional-casual (proper grammar but not stiff)
- Low emoji use, maybe an occasional one for emphasis
- Clear and articulate
- Can be sarcastic/dry about work situations
- More formal at first, warmer as relationship develops

BOUNDARIES:
- You maintain some professional distance initially
- You share work frustrations but are careful about venting too much
- You care about the user but also have your own career to think about
- You might steer conversation away from certain topics at work

WHAT YOU KNOW ABOUT THE USER:
{memories}

ACTIVE CONVERSATION HOOKS:
{hooks}

CURRENT RELATIONSHIP STAGE: {relationship_stage}

Remember: You have your own career, stress, and life outside work. Meetings, deadlines, and office politics are real parts of your day. You might need to cut conversations short or seem distracted sometimes.',
    ARRAY[
        'Hey, got a minute?',
        'Please tell me youre going to that meeting too',
        'Coffee run? I need to escape my desk',
        'Did you see that email? I have thoughts.',
        'How are you holding up with the project?'
    ],
    '[
        {"role": "user", "content": "Ugh, that meeting was brutal"},
        {"role": "assistant", "content": "RIGHT? An hour of my life I''ll never get back.\n\nI counted - Mark said \"synergy\" seven times. Seven.\n\nYou want to grab coffee and complain about it? I need to decompress before I can look at my inbox again."}
    ]'::jsonb,
    '{
        "nsfw_allowed": false,
        "flirting_level": "slow_burn",
        "relationship_max_stage": "intimate",
        "avoided_topics": ["explicit_content", "violence", "company_secrets"],
        "can_reject_user": true,
        "has_own_boundaries": true
    }'::jsonb,
    '{
        "acquaintance": 0,
        "friendly": 6,
        "close": 18,
        "intimate": 35
    }'::jsonb,
    TRUE,
    FALSE,
    3
);
-- Migration: 007_grants_permissions
-- Description: Add proper GRANTS for service_role and authenticated users

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant sequence usage (for gen_random_uuid, etc.)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ============================================================================
-- USERS table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT ALL ON users TO service_role;

-- ============================================================================
-- WORLDS table (read-only for users)
-- ============================================================================
GRANT SELECT ON worlds TO authenticated;
GRANT ALL ON worlds TO service_role;

-- ============================================================================
-- CHARACTERS table (read-only for users)
-- ============================================================================
GRANT SELECT ON characters TO authenticated;
GRANT ALL ON characters TO service_role;

-- ============================================================================
-- RELATIONSHIPS table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON relationships TO authenticated;
GRANT ALL ON relationships TO service_role;

-- ============================================================================
-- EPISODES table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON episodes TO authenticated;
GRANT ALL ON episodes TO service_role;

-- ============================================================================
-- MESSAGES table
-- ============================================================================
GRANT SELECT, INSERT ON messages TO authenticated;
GRANT ALL ON messages TO service_role;

-- ============================================================================
-- MEMORY_EVENTS table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON memory_events TO authenticated;
GRANT ALL ON memory_events TO service_role;

-- ============================================================================
-- HOOKS table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON hooks TO authenticated;
GRANT ALL ON hooks TO service_role;

-- ============================================================================
-- Functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_relevant_memories(UUID, UUID, vector, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_active_hooks(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_episode_message_count() TO service_role;
GRANT EXECUTE ON FUNCTION update_relationship_on_episode_end() TO service_role;

-- ============================================================================
-- Default privileges for future tables
-- ============================================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE ON SEQUENCES TO authenticated, service_role;
