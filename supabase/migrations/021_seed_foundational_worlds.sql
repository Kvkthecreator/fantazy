-- Migration: 021_seed_foundational_worlds.sql
-- Purpose: Seed foundational worlds for Episode-0 content diversity
-- Date: 2025-12-17
--
-- WORLD PHILOSOPHY:
-- - "Transparent" worlds: User knows the rules (Real Life, Celebrity Sphere)
-- - "Opaque" worlds: User needs context (Historical, Near Future, Fantasy)
--
-- Genesis Stage focus: Real Life + Celebrity Sphere
-- Future expansion: Historical, Near Future, Fantasy Realms

-- ============================================================================
-- FOUNDATIONAL WORLDS
-- ============================================================================

-- 1. REAL LIFE (default world for most Genesis Stage content)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Real Life',
    'real-life',
    'Contemporary grounded reality. Coffee shops, apartments, offices, parks - places you could actually be. No special rules needed; users understand this world intuitively.',
    ARRAY['coffee shop', 'apartment', 'office', 'park', 'rooftop', 'diner', 'convenience store', 'bookstore', 'gym', 'bar'],
    'grounded',
    '{
        "setting_type": "transparent",
        "time_period": "present_day",
        "technology_level": "modern",
        "magic_level": "none",
        "notes": "Default world for most content. No world-building needed - users know how reality works."
    }'::jsonb,
    '{
        "genesis_stage": true,
        "priority": 1
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata;

-- 2. CELEBRITY SPHERE (fame-adjacent reality)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'Celebrity Sphere',
    'celebrity-sphere',
    'Fame-adjacent reality. K-pop idols, actors, influencers, athletes. The collision between public persona and private vulnerability. Semi-transparent: users understand celebrity culture but characters have unique pressures.',
    ARRAY['backstage', 'late night convenience store', 'private jet', 'hotel suite', 'recording studio', 'green room', 'award show after-party', 'fan meet', 'practice room'],
    'glamorous-vulnerable',
    '{
        "setting_type": "semi-transparent",
        "time_period": "present_day",
        "technology_level": "modern",
        "magic_level": "none",
        "social_dynamics": ["public vs private self", "parasocial pressure", "industry expectations", "fame isolation"],
        "notes": "Characters juggle public image with authentic self. Users are often the rare person who sees behind the mask."
    }'::jsonb,
    '{
        "genesis_stage": true,
        "priority": 2
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata;

-- 3. HISTORICAL (past eras - sub-era defined at series level)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000003'::uuid,
    'Historical',
    'historical',
    'Past eras with specific rules. Victorian England, 1920s Jazz Age, WW2 era, Ancient Rome. Opaque: users need context about technology limits, social norms, and stakes of the era. Sub-era defined at series level.',
    ARRAY['manor house', 'speakeasy', 'battlefield', 'ballroom', 'harbor', 'tavern', 'castle', 'marketplace'],
    'era-specific',
    '{
        "setting_type": "opaque",
        "time_period": "variable_historical",
        "technology_level": "era_dependent",
        "magic_level": "none",
        "requires_context": ["social_norms", "technology_limits", "gender_roles", "class_structure"],
        "notes": "Series should specify exact era. System prompt must establish what user would plausibly know/not know."
    }'::jsonb,
    '{
        "genesis_stage": false,
        "priority": 3,
        "sub_eras": ["victorian", "1920s", "1940s_ww2", "1950s", "ancient_rome", "medieval", "renaissance"]
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata;

-- 4. NEAR FUTURE (sci-fi lite)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000004'::uuid,
    'Near Future',
    'near-future',
    'Sci-fi lite. 50-200 years ahead, recognizable but advanced. Cyberpunk cities, space stations, AI companions, corporate dystopias. Opaque: users need to understand tech level and social changes.',
    ARRAY['space station', 'cyberpunk alley', 'corporate tower', 'underground club', 'hover transport', 'android maintenance bay', 'virtual reality lounge', 'orbital habitat'],
    'futuristic-grounded',
    '{
        "setting_type": "opaque",
        "time_period": "near_future",
        "technology_level": "advanced",
        "magic_level": "none",
        "tech_elements": ["AI", "space_travel", "cybernetics", "virtual_reality", "megacorps"],
        "notes": "Series should establish specific tech rules. User may need isekai-style introduction or be native to the era."
    }'::jsonb,
    '{
        "genesis_stage": false,
        "priority": 4
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata;

-- 5. FANTASY REALMS (magic and mythology)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000005'::uuid,
    'Fantasy Realms',
    'fantasy-realms',
    'Magic, mythology, alternate physics. Isekai scenarios, sword & sorcery, urban fantasy, mythological beings. Opaque: users need to understand magic rules and world structure.',
    ARRAY['enchanted forest', 'castle throne room', 'magic academy', 'dragon lair', 'fairy court', 'tavern crossroads', 'ancient temple', 'floating island'],
    'fantastical',
    '{
        "setting_type": "opaque",
        "time_period": "variable_fantasy",
        "technology_level": "fantasy_medieval_to_modern",
        "magic_level": "high",
        "fantasy_elements": ["magic_systems", "mythical_creatures", "divine_beings", "alternate_races"],
        "notes": "Series should establish magic rules. User typically isekai (transported) or needs Protagonist Mode for native."
    }'::jsonb,
    '{
        "genesis_stage": false,
        "priority": 5,
        "sub_types": ["isekai", "sword_and_sorcery", "urban_fantasy", "mythology", "fairy_tale"]
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    world_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO world_count FROM worlds;

    IF world_count < 5 THEN
        RAISE EXCEPTION 'Migration failed: Expected 5 worlds, found %', world_count;
    END IF;

    RAISE NOTICE 'Migration 021_seed_foundational_worlds completed successfully';
    RAISE NOTICE 'Worlds seeded: %', world_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Genesis Stage worlds (priority 1-2):';
    RAISE NOTICE '  - Real Life (default)';
    RAISE NOTICE '  - Celebrity Sphere';
    RAISE NOTICE '';
    RAISE NOTICE 'Future expansion worlds (priority 3-5):';
    RAISE NOTICE '  - Historical';
    RAISE NOTICE '  - Near Future';
    RAISE NOTICE '  - Fantasy Realms';
END $$;
