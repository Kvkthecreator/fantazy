-- Migration: 024_seed_genesis_worlds.sql
-- Purpose: Seed Genesis Stage worlds (Tier 1 + Tier 2) per WORLD_TAXONOMY_CANON.md
-- Date: 2025-12-17
--
-- WORLD PHILOSOPHY (from CONTENT_ARCHITECTURE_CANON.md):
-- - World = Setting (WHERE), not Genre (WHAT)
-- - World provides: visual_style, default_scenes, ambient_details, tone
-- - Genre lives on Series as studio metadata
-- - Multiple genres can exist within one world
--
-- TIER 1: Genesis Stage Active (priority 1-3)
-- TIER 2: High Priority Expansion (priority 4-8)

-- ============================================================================
-- TIER 1: GENESIS STAGE ACTIVE WORLDS
-- ============================================================================

-- 1. REAL LIFE (default world, transparent setting)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    visual_style,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Real Life',
    'real-life',
    'Contemporary grounded reality. Coffee shops, apartments, offices, parks - places you could actually be. No special rules needed; users understand this world intuitively.',
    ARRAY['coffee shop', 'apartment', 'office', 'park', 'rooftop bar', 'late-night diner', 'convenience store', 'bookstore', 'gym', 'quiet bar'],
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
        "tier": 1,
        "priority": 1
    }'::jsonb,
    '{
        "base_style": "warm realistic photography, natural lighting",
        "color_palette": "warm neutrals, soft amber lighting, cozy earth tones",
        "rendering": "soft natural light, shallow depth of field, intimate framing",
        "character_framing": "natural beauty, approachable, candid moments",
        "negative_prompt": "anime, cartoon, harsh lighting, oversaturated, fantasy elements"
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata,
    visual_style = EXCLUDED.visual_style;

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
    visual_style,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'Celebrity Sphere',
    'celebrity-sphere',
    'Fame-adjacent reality. Idols, actors, influencers, athletes. The collision between public persona and private vulnerability. Semi-transparent: users understand celebrity culture but characters have unique pressures.',
    ARRAY['backstage', 'late night convenience store', 'private jet', 'hotel suite', 'recording studio', 'green room', 'award show after-party', 'fan meet', 'practice room', 'penthouse'],
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
        "tier": 1,
        "priority": 2
    }'::jsonb,
    '{
        "base_style": "high fashion editorial photography, glamour lighting",
        "color_palette": "rich blacks, golden highlights, dramatic contrast",
        "rendering": "beauty lighting, lens flare, cinematic depth",
        "character_framing": "magazine-quality beauty, styled perfection with vulnerable moments",
        "negative_prompt": "casual, unflattering, harsh flash, amateur"
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata,
    visual_style = EXCLUDED.visual_style;

-- 3. K-WORLD (K-Drama/K-Culture storytelling grammar)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    visual_style,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000003'::uuid,
    'K-World',
    'k-world',
    'The aesthetic and emotional language of Korean drama and culture. Idols, actors, chaebols, contract relationships, fate-driven encounters. Heightened emotion, visual beauty, and the tension between duty and desire.',
    ARRAY[
        'rooftop of entertainment company building',
        'convenience store at 3am',
        'practice room after hours',
        'han river at night',
        'pojangmacha (tent bar)',
        'airport departure gate',
        'recording studio',
        'quiet cafe in Bukchon',
        'hospital corridor',
        'penthouse apartment'
    ],
    'heightened-romantic',
    '{
        "setting_type": "transparent",
        "time_period": "present_day",
        "technology_level": "modern",
        "magic_level": "none",
        "tropes": [
            "wrist_grab",
            "piggyback_ride",
            "umbrella_sharing",
            "contract_relationship",
            "rich_heir_ordinary_person",
            "childhood_connection",
            "near_kiss_interrupted",
            "back_hug",
            "protective_declaration",
            "watching_sleep"
        ],
        "social_dynamics": [
            "sunbae_hoobae_hierarchy",
            "agency_control",
            "chaebol_family_expectations",
            "public_vs_private_self",
            "scandal_culture",
            "netizen_surveillance"
        ],
        "notes": "K-drama storytelling grammar. Heightened melodrama, fate-driven romance, visual beauty. Characters often navigate duty vs desire, public image vs authentic self."
    }'::jsonb,
    '{
        "genesis_stage": true,
        "tier": 1,
        "priority": 3,
        "sub_types": ["idol_romance", "chaebol_drama", "slice_of_life_korean", "historical_sageuk"]
    }'::jsonb,
    '{
        "base_style": "cinematic K-drama photography, soft glamour",
        "color_palette": "soft pastels with romantic lighting, cherry blossom pinks, night city neons, warm indoor amber",
        "rendering": "beauty lighting, soft focus backgrounds, rain on windows, autumn leaves",
        "character_framing": "idol-grade beauty, expressive close-ups, longing gazes, fashion-forward styling",
        "negative_prompt": "harsh unflattering lighting, western casual style, gritty realism, anime, cartoon"
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata,
    visual_style = EXCLUDED.visual_style;

-- ============================================================================
-- TIER 2: HIGH PRIORITY EXPANSION WORLDS
-- ============================================================================

-- 4. CAMPUS LIFE (Coming-of-age romance)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    visual_style,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000004'::uuid,
    'Campus Life',
    'campus-life',
    'University romance and coming-of-age stories. Dorm rooms, libraries, coffee shops near campus, house parties. The intensity of first adult relationships, academic pressure, and figuring out who you are.',
    ARRAY[
        'library study room late at night',
        'dorm room',
        'campus coffee shop',
        'house party kitchen',
        'lecture hall after class',
        'quad at sunset',
        'campus bar',
        'student apartment',
        'rooftop of dorm building',
        'late-night convenience store run'
    ],
    'youthful-intense',
    '{
        "setting_type": "transparent",
        "time_period": "present_day",
        "technology_level": "modern",
        "magic_level": "none",
        "social_dynamics": [
            "roommate_dynamics",
            "study_group_tension",
            "party_hookup_culture",
            "academic_rivals_to_lovers",
            "ta_student_forbidden"
        ],
        "notes": "Coming-of-age romance extremely popular. First adult relationships, figuring out who you are."
    }'::jsonb,
    '{
        "genesis_stage": true,
        "tier": 2,
        "priority": 4
    }'::jsonb,
    '{
        "base_style": "warm indie film photography, natural youthful beauty",
        "color_palette": "warm golden hour, autumn campus colors, cozy indoor lighting",
        "rendering": "soft natural light, film grain, candid moments",
        "character_framing": "natural college-age beauty, casual but attractive, expressive",
        "negative_prompt": "overly polished, magazine glamour, harsh lighting, too mature"
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata,
    visual_style = EXCLUDED.visual_style;

-- 5. J-WORLD (Japanese Drama storytelling)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    visual_style,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000005'::uuid,
    'J-World',
    'j-world',
    'Japanese drama storytelling. Restraint, unspoken feelings, meaningful silences. The weight of what is NOT said. Slice-of-life intimacy, seasonal awareness, beautiful mundane moments.',
    ARRAY[
        'small izakaya',
        'train platform at dusk',
        'rooftop during cherry blossom season',
        'convenience store at midnight',
        'small apartment kitchen',
        'shrine steps',
        'seaside town',
        'traditional ryokan',
        'tokyo skyline view',
        'quiet park bench'
    ],
    'restrained-intimate',
    '{
        "setting_type": "transparent",
        "time_period": "present_day",
        "technology_level": "modern",
        "magic_level": "none",
        "tropes": [
            "indirect_confession",
            "seasonal_metaphors",
            "meaningful_silence",
            "accidental_touch_charged",
            "train_platform_goodbye",
            "umbrella_sharing",
            "bento_as_love_language",
            "ganbatte_support"
        ],
        "social_dynamics": [
            "senpai_kouhai",
            "workplace_hierarchy",
            "family_expectations",
            "wa_group_harmony",
            "honne_tatemae"
        ],
        "notes": "Japanese drama grammar. Restraint, unspoken feelings, seasonal awareness. What is NOT said carries weight."
    }'::jsonb,
    '{
        "genesis_stage": true,
        "tier": 2,
        "priority": 5
    }'::jsonb,
    '{
        "base_style": "naturalistic Japanese cinematography, soft natural light",
        "color_palette": "soft natural light, seasonal colors, muted pastels, cherry blossom pinks",
        "rendering": "quiet framing, negative space, environmental storytelling, still moments",
        "character_framing": "reserved expression, eyes conveying emotion, natural beauty, understated fashion",
        "negative_prompt": "loud, oversaturated, melodramatic, western casual, harsh contrast"
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata,
    visual_style = EXCLUDED.visual_style;

-- 6. ANIME: SLICE OF LIFE (Anime aesthetic, real-world rules)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    visual_style,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000006'::uuid,
    'Anime: Slice of Life',
    'anime-slice-of-life',
    'Real-world rules with anime aesthetic. Iyashikei comfort, everyday moments made beautiful. High school romance, neighborhood encounters, the magic of ordinary life seen through anime visual language.',
    ARRAY[
        'school rooftop at lunch',
        'train ride home',
        'convenience store after school',
        'summer festival',
        'beach episode',
        'classroom after hours',
        'small town street at sunset',
        'cafe with cats',
        'apartment balcony',
        'shrine during new years'
    ],
    'warm-nostalgic',
    '{
        "setting_type": "transparent",
        "time_period": "present_day",
        "technology_level": "modern",
        "magic_level": "none",
        "tropes": [
            "rooftop_confession",
            "summer_festival_date",
            "indirect_kiss",
            "school_trip_romance",
            "childhood_friend",
            "transfer_student",
            "cultural_festival"
        ],
        "visual_language": "anime",
        "notes": "Anime aesthetic applied to real-world scenarios. Iyashikei comfort, everyday magic, nostalgic warmth."
    }'::jsonb,
    '{
        "genesis_stage": true,
        "tier": 2,
        "priority": 6,
        "sub_types": ["iyashikei", "school_romance", "neighborhood"]
    }'::jsonb,
    '{
        "base_style": "anime illustration, soft cel shading, warm color grading",
        "color_palette": "warm sunset oranges, cherry blossom pinks, soft sky blues, golden hour glow",
        "rendering": "anime style, soft shading, expressive eyes, clean lines",
        "character_framing": "anime proportions, expressive features, stylized beauty, school uniforms or casual fashion",
        "negative_prompt": "photorealistic, harsh, dark, gritty, western cartoon"
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata,
    visual_style = EXCLUDED.visual_style;

-- 7. SUPERNATURAL: VAMPIRES (Paranormal romance)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    visual_style,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000007'::uuid,
    'Supernatural: Vampires',
    'supernatural-vampires',
    'Paranormal romance with vampire mythology. Immortal seduction, blood intimacy, the danger of loving something that could destroy you. Gothic beauty meets modern settings.',
    ARRAY[
        'gothic mansion library',
        'moonlit garden',
        'underground club',
        'penthouse overlooking city at night',
        'ancient castle',
        'blood bar',
        'dark alley encounter',
        'abandoned church',
        'private jet at night',
        'rain-soaked cemetery'
    ],
    'dark-seductive',
    '{
        "setting_type": "opaque",
        "time_period": "present_day_with_ancient_elements",
        "technology_level": "modern",
        "magic_level": "supernatural",
        "supernatural_rules": [
            "immortality",
            "blood_feeding",
            "enhanced_senses",
            "night_only",
            "vampire_society"
        ],
        "tropes": [
            "mortal_immortal_love",
            "forbidden_attraction",
            "protector_predator",
            "blood_bond",
            "turning_choice"
        ],
        "notes": "Paranormal romance huge market. Immortal seduction, danger of loving something deadly."
    }'::jsonb,
    '{
        "genesis_stage": true,
        "tier": 2,
        "priority": 7,
        "sub_types": ["gothic_vampire", "modern_vampire", "vampire_society"]
    }'::jsonb,
    '{
        "base_style": "gothic romance photography, dramatic lighting, dark beauty",
        "color_palette": "deep reds, midnight blues, pale moonlight, candlelit amber",
        "rendering": "dramatic shadows, chiaroscuro lighting, rain and mist, gothic architecture",
        "character_framing": "ethereal beauty, pale skin, intense eyes, elegant dark fashion",
        "negative_prompt": "bright cheerful, sunny, casual, horror monster, ugly"
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata,
    visual_style = EXCLUDED.visual_style;

-- 8. FANTASY REALMS (High fantasy, magic, mythology)
INSERT INTO worlds (
    id,
    name,
    slug,
    description,
    default_scenes,
    tone,
    ambient_details,
    metadata,
    visual_style,
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000008'::uuid,
    'Fantasy Realms',
    'fantasy-realms',
    'Magic, mythology, alternate physics. Sword and sorcery, fairy courts, divine beings. User typically arrives via isekai (transported) or needs context about magic rules.',
    ARRAY[
        'enchanted forest clearing',
        'castle throne room',
        'magic academy dormitory',
        'dragon lair',
        'fairy court',
        'tavern at crossroads',
        'ancient temple ruins',
        'floating island',
        'crystal cave',
        'elven city'
    ],
    'fantastical',
    '{
        "setting_type": "opaque",
        "time_period": "variable_fantasy",
        "technology_level": "fantasy_medieval_to_modern",
        "magic_level": "high",
        "fantasy_elements": [
            "magic_systems",
            "mythical_creatures",
            "divine_beings",
            "alternate_races"
        ],
        "notes": "Series should establish magic rules. User typically isekai (transported) or needs Protagonist Mode for native."
    }'::jsonb,
    '{
        "genesis_stage": true,
        "tier": 2,
        "priority": 8,
        "sub_types": ["high_fantasy", "dark_fantasy", "fairy_tale", "urban_fantasy", "mythology"]
    }'::jsonb,
    '{
        "base_style": "fantasy illustration, magical realism, epic scope",
        "color_palette": "rich jewel tones, magical glows, forest greens, ethereal blues",
        "rendering": "painterly style, magical lighting effects, detailed environments",
        "character_framing": "fantasy beauty, pointed ears optional, elaborate costumes, magical accessories",
        "negative_prompt": "modern clothing, technology, realistic photography, mundane settings"
    }'::jsonb,
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_scenes = EXCLUDED.default_scenes,
    tone = EXCLUDED.tone,
    ambient_details = EXCLUDED.ambient_details,
    metadata = EXCLUDED.metadata,
    visual_style = EXCLUDED.visual_style;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    world_count INTEGER;
    tier1_count INTEGER;
    tier2_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO world_count FROM worlds WHERE is_active = TRUE;
    SELECT COUNT(*) INTO tier1_count FROM worlds WHERE metadata->>'tier' = '1';
    SELECT COUNT(*) INTO tier2_count FROM worlds WHERE metadata->>'tier' = '2';

    IF world_count < 8 THEN
        RAISE EXCEPTION 'Migration failed: Expected 8 worlds, found %', world_count;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    RAISE NOTICE 'Migration 024_seed_genesis_worlds completed successfully';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Total worlds seeded: %', world_count;
    RAISE NOTICE '';
    RAISE NOTICE 'TIER 1 - Genesis Stage Active (%):',tier1_count;
    RAISE NOTICE '  1. Real Life (default, transparent)';
    RAISE NOTICE '  2. Celebrity Sphere (fame-adjacent)';
    RAISE NOTICE '  3. K-World (K-drama storytelling grammar)';
    RAISE NOTICE '';
    RAISE NOTICE 'TIER 2 - High Priority Expansion (%):',tier2_count;
    RAISE NOTICE '  4. Campus Life (coming-of-age romance)';
    RAISE NOTICE '  5. J-World (Japanese drama)';
    RAISE NOTICE '  6. Anime: Slice of Life (anime aesthetic)';
    RAISE NOTICE '  7. Supernatural: Vampires (paranormal romance)';
    RAISE NOTICE '  8. Fantasy Realms (magic, mythology)';
    RAISE NOTICE '';
    RAISE NOTICE 'Each world includes:';
    RAISE NOTICE '  - visual_style for avatar/scene generation';
    RAISE NOTICE '  - default_scenes for episode settings';
    RAISE NOTICE '  - ambient_details with tropes and social dynamics';
    RAISE NOTICE '  - tone for emotional register';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Scaffold series per world (one series, 2-3 episodes each)';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
