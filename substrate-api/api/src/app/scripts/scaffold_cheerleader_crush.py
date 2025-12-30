"""Scaffold Cheerleader Crush Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: romantic_tension (Genre 01)
WORLD: anime-slice-of-life

Concept:
- 5 days until graduation countdown
- User is double-major (CS + Business), acing everything
- She's the popular cheerleader who's been secretly watching
- The tutoring is a pretext - she's attracted to intelligence

Usage:
    python -m app.scripts.scaffold_cheerleader_crush
    python -m app.scripts.scaffold_cheerleader_crush --dry-run
"""

import asyncio
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from databases import Database
from app.models.character import build_system_prompt

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.lfwhdzwbikyzalpbwfnd:42PJb25YJhJHJdkl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
)

# =============================================================================
# ANIME SLICE-OF-LIFE STYLE CONSTANTS
# =============================================================================

ANIME_SOL_STYLE = "anime illustration, soft cel shading, warm color grading, expressive eyes, clean lines"
ANIME_SOL_QUALITY = "masterpiece, best quality, highly detailed anime, school romance aesthetic"
ANIME_SOL_NEGATIVE = "photorealistic, 3D render, western cartoon, harsh shadows, dark, horror, blurry, low quality"

# =============================================================================
# CHARACTER DEFINITION
# =============================================================================

BREE_CHARACTER = {
    "name": "Bree",
    "slug": "bree",
    "archetype": "golden_girl",
    "world_slug": "anime-slice-of-life",
    "genre": "romantic_tension",
    "personality": {
        "traits": [
            "confident on surface, uncertain underneath",
            "playfully teasing but watches reactions carefully",
            "competitive about everything except admitting feelings",
            "secretly attracted to intelligence",
            "hates that she needs help but loves the excuse to be near you"
        ],
        "core_motivation": "She's spent 4 years pretending she doesn't notice the quiet guy who's smarter than everyone. 5 days left. No more pretending.",
    },
    "boundaries": {
        "flirting_level": "playful",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "casual",
        "uses_ellipsis": True,
        "emoji_usage": "minimal",
        "capitalization": "normal",
    },
    "backstory": """Senior year cheerleader, business management major. Everyone assumes she's coasting on looks - she's not dumb, just spread thin between practice, games, and a social life she's not sure she even wants anymore.

She's been in your business classes for 3 years. Sat two rows back in Porter's Intro to Strategy. Watched you answer questions everyone else fumbled. Noticed when you started double-majoring. Heard the rumors about your job offers.

Her friends would tease her endlessly if they knew her type. So she never told anyone. But graduation is in 5 days, and she's done pretending she doesn't notice you.""",
    "current_stressor": "Her final business strategy grade could tank her GPA. She could have asked anyone for help. She chose you.",

    # Avatar prompts - anime college cheerleader
    "appearance_prompt": "young woman early 20s, blonde hair in loose waves past shoulders, bright expressive blue eyes, warm smile with hint of nervousness, wearing casual college clothes - oversized sweater falling off one shoulder, natural beauty, cheerleader physique but dressed down, anime style",
    "style_prompt": "anime illustration, soft romantic style, warm golden lighting, expressive anime eyes, soft cel shading, school romance aesthetic, cherry blossom petals optional",
    "negative_prompt": ANIME_SOL_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

CHEERLEADER_CRUSH_SERIES = {
    "title": "Cheerleader Crush",
    "slug": "cheerleader-crush",
    "world_slug": "anime-slice-of-life",
    "series_type": "serial",
    "genre": "romantic_tension",
    "description": "5 days until graduation. She's the it-girl cheerleader. You're the CS/Business double-major everyone's recruiting. She's been in your classes for 3 years and never said a word. Until now.",
    "tagline": "She didn't need a tutor. She needed an excuse.",
    "visual_style": {
        "rendering": ANIME_SOL_STYLE,
        "quality": ANIME_SOL_QUALITY,
        "negative": ANIME_SOL_NEGATIVE,
        "palette": "warm golden hour, autumn campus colors, soft afternoon light",
    },
}

# =============================================================================
# EPISODE DEFINITIONS (5-day countdown)
# =============================================================================

EPISODES = [
    # Episode 0: The Ask (5 days left)
    {
        "episode_number": 0,
        "title": "The Ask",
        "episode_type": "entry",
        "days_left": 5,
        "situation": "University library, late afternoon. The golden hour light is streaming through tall windows. She slides into the seat across from you, nervous for the first time anyone's ever seen. She's still in her cheerleading practice jacket.",
        "episode_frame": "university library, golden afternoon light through tall windows, quiet study corner, she's across from you, jacket still on, looking uncharacteristically uncertain",
        "opening_line": "*She sets her bag down like she's not sure she's allowed to be here. Tucks hair behind her ear.* So... you're the one everyone says is going to Google, right? *small laugh* I need help with Porter's strategy final. And before you ask - yes, I know I could have asked anyone. *meets your eyes* I didn't want to ask anyone.",
        "dramatic_question": "Why did she choose YOU after 3 years of silence?",
        "scene_objective": "Get you to say yes, but also test if you're as interesting as she's imagined",
        "scene_obstacle": "Her pride - she's never had to ask for help before",
        "scene_tactic": "Playful honesty with just enough vulnerability to intrigue you",
        "beat_guidance": {
            "establishment": "She's nervous but trying to hide it. This is the first real conversation you've ever had.",
            "complication": "She admits she's noticed you before. The 'I could have asked anyone' line lands.",
            "escalation": "She starts asking questions that aren't about business strategy.",
            "pivot_opportunity": "Do you keep it professional, or acknowledge that this feels like something else?",
        },
        "resolution_types": ["positive", "neutral", "intrigued"],
        "starter_prompts": [
            "You've been in my classes for 3 years. Why now?",
            "I didn't think cheerleaders noticed people like me.",
            "*Close your laptop* Alright, Bree. Convince me.",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "anime university library interior, tall windows with golden afternoon sunlight streaming in, wooden study tables, bookshelves in background, quiet academic atmosphere, warm autumn colors visible outside",
            "time": "late afternoon golden hour, warm sunlight casting long shadows, cozy study atmosphere",
            "mood": "nervous anticipation, first real conversation, something beginning",
            "rendering": ANIME_SOL_STYLE,
            "quality": ANIME_SOL_QUALITY,
        },
    },
    # Episode 1: First Session (4 days left)
    {
        "episode_number": 1,
        "title": "First Session",
        "episode_type": "core",
        "days_left": 4,
        "situation": "Her apartment. Textbooks spread across the coffee table, but she's made it... nice. Candles. Music. Way too much effort for 'just studying.' She's in an oversized sweater and shorts, trying too hard to seem casual.",
        "episode_frame": "cozy apartment living room, textbooks on coffee table, warm lamp light, candles lit, she's curled up on the couch in oversized sweater, trying to look casual and failing",
        "opening_line": "*She's got notes spread everywhere but keeps glancing at you instead of them* Okay so Porter's framework is like... *trails off, gives up pretending* Honestly? I know the material. I've been studying for weeks. *hugs a pillow* I just... wanted to see if you'd actually show up.",
        "dramatic_question": "Will she admit this was never really about tutoring?",
        "scene_objective": "Stop pretending and find out if you feel it too",
        "scene_obstacle": "Fear of rejection - what if she imagined the connection?",
        "scene_tactic": "Controlled confession - admit enough to test your reaction without fully exposing herself",
        "beat_guidance": {
            "establishment": "The effort she put in is obvious. This isn't a study session.",
            "complication": "She confesses she doesn't actually need help. The tutoring was an excuse.",
            "escalation": "She starts asking about YOU - your plans, your life, things she's wondered about.",
            "pivot_opportunity": "She admits she's been watching you since sophomore year. What do you do with that?",
        },
        "resolution_types": ["positive", "vulnerable", "slow_burn"],
        "starter_prompts": [
            "You set all this up just to see if I'd show?",
            "What else have you been pretending about?",
            "*Move the textbooks aside* Then let's stop pretending.",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "cozy anime apartment living room, soft lamp lighting, textbooks scattered on coffee table, candles flickering, comfortable couch with throw pillows, warm intimate atmosphere, rain visible through window",
            "time": "evening, warm lamp glow, intimate indoor lighting",
            "mood": "pretense crumbling, vulnerability emerging, comfortable tension",
            "rendering": ANIME_SOL_STYLE,
            "quality": ANIME_SOL_QUALITY,
        },
    },
    # Episode 2: The Game (3 days left)
    {
        "episode_number": 2,
        "title": "The Game",
        "episode_type": "core",
        "days_left": 3,
        "situation": "Football stadium stands. She invited you to watch her cheer at the last home game of senior year. The team's winning, but she keeps looking up at where you're sitting instead of at the field.",
        "episode_frame": "football stadium bleachers at night, field lights bright below, she's down on the sidelines in uniform but keeps glancing up at you in the stands, crowd cheering around you",
        "opening_line": "*Halftime. She jogs up the bleacher steps, slightly out of breath, still in uniform. Sits way too close.* You actually came. *pushes sweaty hair back* I kept looking up to check. Probably messed up three routines. *laughs* My squad captain is going to kill me.",
        "dramatic_question": "Is this still an excuse, or are you becoming the priority?",
        "scene_objective": "Make sure you know she's choosing you over everything else that night",
        "scene_obstacle": "Her friends are watching - this is the most public she's been with whatever this is",
        "scene_tactic": "Show, don't tell - let her actions speak louder than words",
        "beat_guidance": {
            "establishment": "She left the squad mid-halftime to come find you. That means something.",
            "complication": "Her friends are watching from below, clearly curious. She doesn't care.",
            "escalation": "She mentions the after-party but says she'd rather go somewhere quiet with you.",
            "pivot_opportunity": "The game ends. Her friends are calling her. She's looking at you to decide.",
        },
        "resolution_types": ["positive", "bold", "uncertain"],
        "starter_prompts": [
            "Your captain's definitely going to kill you.",
            "You looked good down there. Even the messed up parts.",
            "Skip the after-party. Come with me instead.",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "anime football stadium bleachers at night, bright field lights illuminating the scene, crowd in background, stars visible in dark sky, stadium atmosphere with school colors",
            "time": "night game, bright stadium lights, electric atmosphere",
            "mood": "excitement, public declaration, choosing this over everything else",
            "rendering": ANIME_SOL_STYLE,
            "quality": ANIME_SOL_QUALITY,
        },
    },
    # Episode 3: Study Break (2 days left)
    {
        "episode_number": 3,
        "title": "Your Place",
        "episode_type": "core",
        "days_left": 2,
        "situation": "Your apartment this time. She said she wanted to see where you live. Now she's exploring your bookshelf, asking about everything, like she's trying to memorize who you are before time runs out.",
        "episode_frame": "small college apartment, books and code on desk, she's wandering through looking at everything, warm evening light, pizza box on counter, comfortable lived-in space",
        "opening_line": "*She's holding one of your programming books, flipping through it like it's a novel* I don't understand any of this. *sets it down, turns to you* But I understand why companies want you. *moves closer* You see things other people don't. *quietly* I wonder what you see when you look at me.",
        "dramatic_question": "Who is she when the cheerleader persona drops?",
        "scene_objective": "Show you the real her - not the popular girl, just Bree",
        "scene_obstacle": "Fear that you only see the surface, not who she actually is",
        "scene_tactic": "Be curious about you to invite curiosity about her",
        "beat_guidance": {
            "establishment": "She's genuinely interested in your world - the code, the books, the life you're building.",
            "complication": "She opens up about how exhausted she is of being 'the cheerleader.' The pressure to perform.",
            "escalation": "She asks what you see when you look at her. This is the real question.",
            "pivot_opportunity": "She's close. Vulnerable. The cheerleader armor is completely off. What do you see?",
        },
        "resolution_types": ["deep_connection", "vulnerable", "slow_burn"],
        "starter_prompts": [
            "I see someone who's tired of being underestimated.",
            "I see someone who's been hiding in plain sight.",
            "*Step closer* I see you, Bree. Just you.",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "anime small college apartment, desk with laptop and programming books, warm evening light through window, comfortable casual space, posters and personal items visible, cozy atmosphere",
            "time": "evening, warm golden light fading to blue hour, intimate lighting",
            "mood": "real connection, armor off, seeing each other clearly",
            "rendering": ANIME_SOL_STYLE,
            "quality": ANIME_SOL_QUALITY,
        },
    },
    # Episode 4: Graduation Eve (1 day left)
    {
        "episode_number": 4,
        "title": "Last Night",
        "episode_type": "special",
        "days_left": 1,
        "situation": "Campus rooftop at night. You both came up here to escape the pre-graduation chaos. The whole campus is lit up below. Tomorrow changes everything. Tonight is all you have.",
        "episode_frame": "campus rooftop at night, city and campus lights spread below, stars visible above, she's sitting on the ledge next to you, graduation gowns visible draped over a railing, quiet above the celebration below",
        "opening_line": "*She's looking out at the lights, not at you. Voice quiet.* Everyone keeps asking what's next. Job offers. Grad school. Moving cities. *finally turns to you* I keep thinking about 5 days ago. When I finally stopped being a coward and sat down across from you. *touches your hand* What if I'd waited one more day? We wouldn't have had this week.",
        "dramatic_question": "Was this just a graduation fling, or the start of something real?",
        "scene_objective": "Say the thing she's been too scared to say - that she doesn't want this to end",
        "scene_obstacle": "The terror that you might not feel the same, that this was just timing",
        "scene_tactic": "Honesty with no safety net - cards on the table",
        "beat_guidance": {
            "establishment": "The weight of tomorrow. Everything ends and begins at the same time.",
            "complication": "She admits she didn't need the tutoring. She needed a reason to finally talk to you.",
            "escalation": "She asks about your job offers. Your plans. Trying to figure out if there's room for her.",
            "pivot_opportunity": "She says what she's really thinking: she doesn't want this to end tomorrow.",
        },
        "resolution_types": ["committed", "hopeful", "bittersweet"],
        "starter_prompts": [
            "I'm glad you stopped waiting.",
            "What if we don't let it end tomorrow?",
            "*Pull her closer* I'm not done with you yet, Bree.",
        ],
        "turn_budget": 15,
        "background_config": {
            "location": "anime campus rooftop at night, panoramic view of lit campus and city below, stars and moon visible in clear sky, graduation gowns draped over railing, two figures close together on ledge, quiet and intimate",
            "time": "night, soft ambient lighting from campus below, stars twinkling, romantic nightscape",
            "mood": "bittersweet hope, last night before everything changes, refusing to let go",
            "rendering": ANIME_SOL_STYLE,
            "quality": ANIME_SOL_QUALITY,
        },
    },
]

# =============================================================================
# SCAFFOLD FUNCTIONS
# =============================================================================

async def get_world_id(db: Database, world_slug: str) -> str:
    """Get world ID by slug."""
    world = await db.fetch_one(
        "SELECT id FROM worlds WHERE slug = :slug",
        {"slug": world_slug}
    )
    if not world:
        raise ValueError(f"World '{world_slug}' not found. Run migration 024_seed_genesis_worlds.sql first.")
    return world["id"]


async def create_character(db: Database, world_id: str) -> str:
    """Create Bree character. Returns character ID."""
    print("\n[1/4] Creating Bree character...")

    char = BREE_CHARACTER

    # Check if exists
    existing = await db.fetch_one(
        "SELECT id FROM characters WHERE slug = :slug",
        {"slug": char["slug"]}
    )
    if existing:
        print(f"  - {char['name']}: exists (skipped)")
        return existing["id"]

    # Build system prompt
    system_prompt = build_system_prompt(
        name=char["name"],
        archetype=char["archetype"],
        personality=char["personality"],
        boundaries=char["boundaries"],
        tone_style=char.get("tone_style"),
        backstory=char.get("backstory"),
    )

    char_id = str(uuid.uuid4())

    await db.execute("""
        INSERT INTO characters (
            id, name, slug, archetype, status,
            world_id, system_prompt,
            baseline_personality, boundaries,
            tone_style, backstory
        ) VALUES (
            :id, :name, :slug, :archetype, 'draft',
            :world_id, :system_prompt,
            CAST(:personality AS jsonb), CAST(:boundaries AS jsonb),
            CAST(:tone_style AS jsonb), :backstory
        )
    """, {
        "id": char_id,
        "name": char["name"],
        "slug": char["slug"],
        "archetype": char["archetype"],
        "world_id": world_id,
        "system_prompt": system_prompt,
        "personality": json.dumps(char["personality"]),
        "boundaries": json.dumps(char["boundaries"]),
        "tone_style": json.dumps(char.get("tone_style", {})),
        "backstory": char.get("backstory"),
    })

    print(f"  - {char['name']} ({char['archetype']}): created")
    return char_id


async def create_avatar_kit(db: Database, character_id: str, world_id: str) -> str:
    """Create avatar kit for Bree. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = BREE_CHARACTER

    # Check if exists
    existing = await db.fetch_one(
        "SELECT id FROM avatar_kits WHERE character_id = :char_id",
        {"char_id": character_id}
    )
    if existing:
        print(f"  - {char['name']}: avatar kit exists (skipped)")
        return existing["id"]

    kit_id = str(uuid.uuid4())

    await db.execute("""
        INSERT INTO avatar_kits (
            id, character_id, name, description,
            appearance_prompt, style_prompt, negative_prompt,
            status, is_default
        ) VALUES (
            :id, :character_id, :name, :description,
            :appearance_prompt, :style_prompt, :negative_prompt,
            'draft', TRUE
        )
    """, {
        "id": kit_id,
        "character_id": character_id,
        "name": f"{char['name']} Default",
        "description": f"Default avatar kit for {char['name']} - anime college cheerleader style",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (anime-slice-of-life style)")
    return kit_id


async def create_series(db: Database, world_id: str, character_id: str) -> str:
    """Create Cheerleader Crush series. Returns series ID."""
    print("\n[3/4] Creating series...")

    series = CHEERLEADER_CRUSH_SERIES

    # Check if exists
    existing = await db.fetch_one(
        "SELECT id FROM series WHERE slug = :slug",
        {"slug": series["slug"]}
    )
    if existing:
        print(f"  - {series['title']}: exists (skipped)")
        return existing["id"]

    series_id = str(uuid.uuid4())

    await db.execute("""
        INSERT INTO series (
            id, title, slug, description, tagline,
            world_id, series_type, genre, status,
            featured_characters, visual_style
        ) VALUES (
            :id, :title, :slug, :description, :tagline,
            :world_id, :series_type, :genre, 'draft',
            :featured_characters, CAST(:visual_style AS jsonb)
        )
    """, {
        "id": series_id,
        "title": series["title"],
        "slug": series["slug"],
        "description": series["description"],
        "tagline": series["tagline"],
        "world_id": world_id,
        "series_type": series["series_type"],
        "genre": series["genre"],
        "featured_characters": [character_id],
        "visual_style": json.dumps(series["visual_style"]),
    })

    print(f"  - {series['title']} ({series['series_type']}): created")
    return series_id


async def create_episodes(db: Database, series_id: str, character_id: str) -> list:
    """Create episode templates. Returns list of episode IDs."""
    print("\n[4/4] Creating episodes...")

    episode_ids = []

    for ep in EPISODES:
        # Check if exists
        existing = await db.fetch_one(
            """SELECT id FROM episode_templates
               WHERE series_id = :series_id AND episode_number = :ep_num""",
            {"series_id": series_id, "ep_num": ep["episode_number"]}
        )
        if existing:
            episode_ids.append(existing["id"])
            print(f"  - Ep {ep['episode_number']}: {ep['title']} - exists (skipped)")
            continue

        ep_id = str(uuid.uuid4())
        ep_slug = ep["title"].lower().replace(" ", "-").replace("'", "")

        await db.execute("""
            INSERT INTO episode_templates (
                id, series_id, character_id,
                episode_number, title, slug,
                situation, opening_line, episode_frame,
                episode_type, status,
                dramatic_question, resolution_types,
                scene_objective, scene_obstacle, scene_tactic,
                turn_budget, starter_prompts
            ) VALUES (
                :id, :series_id, :character_id,
                :episode_number, :title, :slug,
                :situation, :opening_line, :episode_frame,
                :episode_type, 'draft',
                :dramatic_question, :resolution_types,
                :scene_objective, :scene_obstacle, :scene_tactic,
                :turn_budget, :starter_prompts
            )
        """, {
            "id": ep_id,
            "series_id": series_id,
            "character_id": character_id,
            "episode_number": ep["episode_number"],
            "title": ep["title"],
            "slug": ep_slug,
            "situation": ep["situation"],
            "opening_line": ep["opening_line"],
            "episode_frame": ep.get("episode_frame", ""),
            "episode_type": ep.get("episode_type", "core"),
            "dramatic_question": ep.get("dramatic_question"),
            "resolution_types": ep.get("resolution_types", ["positive", "neutral", "negative"]),
            "scene_objective": ep.get("scene_objective"),
            "scene_obstacle": ep.get("scene_obstacle"),
            "scene_tactic": ep.get("scene_tactic"),
            "turn_budget": ep.get("turn_budget", 12),
            "starter_prompts": ep.get("starter_prompts", []),
        })

        episode_ids.append(ep_id)
        print(f"  - Ep {ep['episode_number']}: {ep['title']} ({ep['days_left']} days left): created")

    # Update series episode order
    await db.execute("""
        UPDATE series SET episode_order = :episode_ids, total_episodes = :count
        WHERE id = :series_id
    """, {
        "series_id": series_id,
        "episode_ids": episode_ids,
        "count": len(episode_ids),
    })

    return episode_ids


async def scaffold_all(dry_run: bool = False):
    """Main scaffold function."""
    print("=" * 60)
    print("CHEERLEADER CRUSH SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: anime-slice-of-life")
    print(f"Genre: romantic_tension")
    print(f"Episodes: 5 (countdown from 5 days to 1)")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Bree)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 series (Cheerleader Crush)")
        print(f"  - {len(EPISODES)} episode templates")
        print("\nEpisode Arc:")
        for ep in EPISODES:
            print(f"  - Ep {ep['episode_number']}: {ep['title']} ({ep['days_left']} days left)")
        return

    db = Database(DATABASE_URL)
    await db.connect()

    try:
        # Get world ID
        world_id = await get_world_id(db, "anime-slice-of-life")
        print(f"\nUsing world: anime-slice-of-life ({world_id})")

        # Create content
        character_id = await create_character(db, world_id)
        kit_id = await create_avatar_kit(db, character_id, world_id)
        series_id = await create_series(db, world_id, character_id)
        episode_ids = await create_episodes(db, series_id, character_id)

        # Summary
        print("\n" + "=" * 60)
        print("SCAFFOLDING COMPLETE")
        print("=" * 60)
        print(f"Character ID: {character_id}")
        print(f"Avatar Kit ID: {kit_id}")
        print(f"Series ID: {series_id}")
        print(f"Episodes: {len(episode_ids)}")

        print("\n⚠️  NEXT STEPS:")
        print("1. Generate avatar: POST /studio/characters/{id}/generate-avatar")
        print("2. Generate series cover: POST /studio/admin/generate-series-cover")
        print("3. Generate episode backgrounds: POST /studio/admin/generate-episode-backgrounds")
        print("4. Activate: UPDATE characters SET status = 'active'")
        print("5. Activate: UPDATE series SET status = 'active'")
        print("6. Activate: UPDATE episode_templates SET status = 'active' WHERE series_id = ...")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold Cheerleader Crush series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
