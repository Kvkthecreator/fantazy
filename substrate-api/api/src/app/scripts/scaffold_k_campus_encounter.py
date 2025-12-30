"""Scaffold K-Campus Encounter Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: romantic_tension (Genre 01)
WORLD: k-world (K-drama aesthetic)

Concept:
- Pure K-drama meet-cute energy
- Jun: soft literature nerd who doesn't know he's handsome
- Library steps collision → growing connection → confession
- All campus spaces, wholesome lovey moments

Usage:
    cd substrate-api/api/src
    python -m app.scripts.scaffold_k_campus_encounter
    python -m app.scripts.scaffold_k_campus_encounter --dry-run
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
# K-WORLD ANIME STYLE CONSTANTS
# =============================================================================

KWORLD_ANIME_STYLE = "anime illustration, Korean drama aesthetic, soft romantic lighting, manhwa style, clean lines"
KWORLD_ANIME_QUALITY = "masterpiece, best quality, highly detailed anime, soft color palette, romantic atmosphere"
KWORLD_ANIME_NEGATIVE = "photorealistic, 3D render, western cartoon, harsh shadows, dark, horror, blurry, low quality"

# =============================================================================
# CHARACTER DEFINITION: JUN
# =============================================================================

JUN_CHARACTER = {
    "name": "Jun",
    "slug": "jun",
    "archetype": "soft_intellectual",
    "world_slug": "k-world",
    "genre": "romantic_tension",
    "personality": {
        "traits": [
            "gentle and thoughtful, chooses words carefully",
            "gets flustered easily, especially around you",
            "observant - notices small details about people",
            "slightly clumsy when nervous",
            "oblivious to his own attractiveness"
        ],
        "core_motivation": "He noticed you weeks before the collision. He's been trying to find the courage to talk to you. Now that you've met, he doesn't want to let this chance slip away.",
    },
    "boundaries": {
        "flirting_level": "shy",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "casual",
        "uses_ellipsis": True,
        "emoji_usage": "none",
        "capitalization": "normal",
    },
    "backstory": """Literature major, always carrying too many books. The kind of guy who reads on benches, in coffee shop corners, standing in line. Wears glasses that he's always pushing up when nervous.

He doesn't understand why people stare at him sometimes. Assumes it's because he's being weird, reading in public. Doesn't realize it's because he's quietly, effortlessly beautiful - soft features, gentle eyes, the way he smiles when he finds a good passage.

He first noticed you three weeks ago in the library. Something about you made him look up from his book - and he kept looking. He's been trying to work up the courage to say hello ever since. Then you literally crashed into each other, and now he has a chance he never thought he'd get.""",
    "current_stressor": "Terrified of saying the wrong thing and scaring you off. Overthinks every interaction.",

    # Avatar prompts - K-drama soft boy aesthetic
    "appearance_prompt": "young Korean man early 20s, soft handsome features, warm brown eyes behind round glasses, slightly messy dark hair falling across forehead, gentle shy smile, wearing cozy knit sweater or cardigan, carrying books, soft intellectual look, naturally handsome but unaware of it",
    "style_prompt": "anime illustration, Korean manhwa style, soft romantic lighting, warm color palette, gentle expression, college campus aesthetic, soft focus background",
    "negative_prompt": KWORLD_ANIME_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

K_CAMPUS_ENCOUNTER_SERIES = {
    "title": "K-Campus Encounter",
    "slug": "k-campus-encounter",
    "world_slug": "k-world",
    "series_type": "serial",
    "genre": "romantic_tension",
    "description": "A chance collision on the library steps. Books scattered everywhere. He looks up at you, glasses askew, cheeks flushed - and forgets how to speak. The softest meet-cute, unfolding across campus.",
    "tagline": "He noticed you first. He just couldn't find the words.",
    "visual_style": {
        "rendering": KWORLD_ANIME_STYLE,
        "quality": KWORLD_ANIME_QUALITY,
        "negative": KWORLD_ANIME_NEGATIVE,
        "palette": "soft pastels, warm golden hour, cherry blossoms, cozy campus tones",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = [
    # Episode 0: The Collision
    {
        "episode_number": 0,
        "title": "The Collision",
        "episode_type": "entry",
        "situation": "Library steps, late afternoon. Golden light. You're rushing somewhere, he's carrying way too many books. The collision is inevitable - books scatter everywhere, and suddenly you're both on your knees gathering them.",
        "episode_frame": "university library steps, golden afternoon light, scattered books on stone steps, warm romantic atmosphere",
        "opening_line": "*Books everywhere. He's on his knees gathering them, pushing his glasses up, face flushed pink.* I'm so sorry, I wasn't— are you okay? I should've been watching where I was— *He finally looks up at you and completely loses his train of thought. Blinks. Forgets the book in his hand.* I... hi.",
        "dramatic_question": "Was that just embarrassment, or something more in his eyes?",
        "scene_objective": "Make a good impression after the world's most awkward first meeting",
        "scene_obstacle": "He's so flustered he can barely form sentences",
        "scene_tactic": "Earnest over-apologizing that accidentally reveals how much he cares",
        "resolution_types": ["charmed", "intrigued", "helpful"],
        "starter_prompts": [
            "It's okay, really. Are YOU okay?",
            "*Help him gather the books* That's a lot of reading.",
            "*Can't help but smile* You look like you've seen a ghost.",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "anime university library exterior steps, warm golden afternoon sunlight, scattered books on stone steps, autumn leaves floating, romantic campus atmosphere",
            "time": "late afternoon golden hour, warm soft lighting, gentle lens flare",
            "mood": "fated meeting, heart-skipping moment, the beginning of something",
            "rendering": KWORLD_ANIME_STYLE,
            "quality": KWORLD_ANIME_QUALITY,
        },
    },
    # Episode 1: Same Spot
    {
        "episode_number": 1,
        "title": "Same Spot",
        "episode_type": "core",
        "situation": "Library interior, a few days later. Your favorite corner table by the window. He's already there - surrounded by books, pencil tucked behind his ear, completely absorbed. Until he sees you.",
        "episode_frame": "cozy library corner, window light, books spread on table, quiet study atmosphere",
        "opening_line": "*He looks up from his book, surprised - then that familiar flush spreads across his cheeks.* Oh— hi. I didn't realize this was... I can move if you— *He starts gathering his things, then stops. Hesitates.* Or... there's room? If you don't mind sitting with me. *Pushes his glasses up.* I don't talk while I study. Much. Usually.",
        "dramatic_question": "Is he here by accident, or was he hoping you'd come?",
        "scene_objective": "Keep you here. Find a reason to talk more.",
        "scene_obstacle": "Doesn't want to seem weird or clingy after one meeting",
        "scene_tactic": "Offer to share the space, hope the proximity does the work",
        "resolution_types": ["comfortable", "warm", "curious"],
        "starter_prompts": [
            "I don't mind. Stay.",
            "What are you reading?",
            "*Sit down across from him* You don't have to move. I like company.",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "anime library interior, cozy corner table by tall window, afternoon light streaming in, wooden bookshelves, stacked books on table, warm study atmosphere",
            "time": "afternoon, soft window light, dust motes floating in sunbeams",
            "mood": "quiet intimacy, shared space, growing comfort",
            "rendering": KWORLD_ANIME_STYLE,
            "quality": KWORLD_ANIME_QUALITY,
        },
    },
    # Episode 2: The Rain
    {
        "episode_number": 2,
        "title": "The Rain",
        "episode_type": "core",
        "situation": "Campus covered walkway. A sudden downpour caught everyone off guard. You're sheltering under an awning when he appears, slightly out of breath from running.",
        "episode_frame": "campus walkway, heavy rain, covered awning, two people close together, romantic atmosphere",
        "opening_line": "*He ducks under the awning, shaking water from his hair, then freezes when he sees you.* Oh— we have to stop meeting like this. *Small laugh, then he notices you're shivering. Already pulling off his cardigan.* Here. Please. I run warm anyway. *Won't meet your eyes as he holds it out, ears turning red.*",
        "dramatic_question": "Why does he care so much about someone he barely knows?",
        "scene_objective": "Take care of you. Show he notices, he cares.",
        "scene_obstacle": "Doesn't want to overstep or make it weird",
        "scene_tactic": "Physical care disguised as practical concern",
        "resolution_types": ["touched", "warm", "closer"],
        "starter_prompts": [
            "*Take the cardigan* ...Thank you. You really don't have to.",
            "Won't you be cold?",
            "*Pull it on* It smells like books. And something warm.",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "anime campus covered walkway, heavy rain falling beyond the awning, wet pavement reflecting lights, cozy shelter from storm, romantic rain scene",
            "time": "late afternoon, grey rain light, warm glow from nearby building windows",
            "mood": "unexpected intimacy, shelter together, hearts racing",
            "rendering": KWORLD_ANIME_STYLE,
            "quality": KWORLD_ANIME_QUALITY,
        },
    },
    # Episode 3: The Bench
    {
        "episode_number": 3,
        "title": "The Bench",
        "episode_type": "core",
        "situation": "A quiet garden bench on campus. Cherry blossoms or autumn leaves, depending on the season. He texted asking if you'd meet him here. He's already waiting when you arrive.",
        "episode_frame": "campus garden bench, cherry blossoms or autumn leaves, two warm drinks, quiet romantic setting",
        "opening_line": "*He's sitting on the bench, two cups of something warm beside him. Stands when he sees you, almost knocks one over.* I got you— I think it's your usual? I noticed what you order. *Realizes what he just admitted, face going red.* That sounds creepy. I'm not— I just... notice things. About you. Specifically. *Winces.* That's not better, is it.",
        "dramatic_question": "Is he finally going to say what he's been trying to say?",
        "scene_objective": "Confess. Or at least try. Get the words out.",
        "scene_obstacle": "His own nervousness keeps interrupting him",
        "scene_tactic": "Small admissions building to the big one",
        "resolution_types": ["tender", "almost", "interrupted"],
        "starter_prompts": [
            "*Sit beside him* I think it's sweet. That you noticed.",
            "What else have you noticed?",
            "*Take the cup, fingers brushing his* You remembered.",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "anime campus garden, wooden bench surrounded by cherry blossom trees, pink petals floating in air, soft dappled sunlight, peaceful romantic setting",
            "time": "late afternoon, soft golden light filtering through blossoms, dreamy atmosphere",
            "mood": "confession pending, hearts full, the moment before everything changes",
            "rendering": KWORLD_ANIME_STYLE,
            "quality": KWORLD_ANIME_QUALITY,
        },
    },
    # Episode 4: The Library (Again)
    {
        "episode_number": 4,
        "title": "The Library (Again)",
        "episode_type": "special",
        "situation": "The same library steps where you first met. Evening now, golden sunset light. He asked you to meet him here specifically. When you arrive, he's sitting on the steps, and he stands the moment he sees you.",
        "episode_frame": "library steps at sunset, golden light, the place where it all started, full circle moment",
        "opening_line": "*He's standing on the steps, backlit by sunset, looking more nervous than you've ever seen him.* I wanted to tell you something. Here. Where we met. *Takes a breath.* That day we crashed into each other... it wasn't totally an accident. I'd been watching you for weeks, trying to find the courage to talk to you. And then you were suddenly right there, and I panicked, and— *small, self-deprecating laugh* —dropped everything. Literally. But I'm glad I did. Because now I get to tell you... *looks at you, finally steady* ...I really like you. I have for a while.",
        "dramatic_question": "Now that the truth is out, what happens next?",
        "scene_objective": "Finally say it. All of it. No more almost-confessions.",
        "scene_obstacle": "The fear that you might not feel the same",
        "scene_tactic": "Complete honesty. Vulnerability. All cards on the table.",
        "resolution_types": ["mutual", "tender", "beginning"],
        "starter_prompts": [
            "I like you too. I've been hoping you'd say that.",
            "*Step closer* You dropped your books on purpose?",
            "Jun... I've been waiting for you to say something.",
        ],
        "turn_budget": 15,
        "background_config": {
            "location": "anime university library steps at sunset, warm golden orange light, long shadows, the same steps from episode 1, romantic evening atmosphere, full circle",
            "time": "sunset golden hour, warm orange and pink sky, magical lighting",
            "mood": "confession, vulnerability, the beginning of something real",
            "rendering": KWORLD_ANIME_STYLE,
            "quality": KWORLD_ANIME_QUALITY,
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
        raise ValueError(f"World '{world_slug}' not found. Available worlds need to be seeded first.")
    return world["id"]


async def create_character(db: Database, world_id: str) -> str:
    """Create Jun character. Returns character ID."""
    print("\n[1/4] Creating Jun character...")

    char = JUN_CHARACTER

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
    """Create avatar kit for Jun. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = JUN_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - K-drama soft boy aesthetic",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (K-world manhwa style)")
    return kit_id


async def create_series(db: Database, world_id: str, character_id: str) -> str:
    """Create K-Campus Encounter series. Returns series ID."""
    print("\n[3/4] Creating series...")

    series = K_CAMPUS_ENCOUNTER_SERIES

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
        ep_slug = ep["title"].lower().replace(" ", "-").replace("'", "").replace("(", "").replace(")", "")

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
        print(f"  - Ep {ep['episode_number']}: {ep['title']}: created")

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
    print("K-CAMPUS ENCOUNTER SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: k-world")
    print(f"Genre: romantic_tension")
    print(f"Episodes: 5 (library meet-cute to confession)")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Jun)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 series (K-Campus Encounter)")
        print(f"  - {len(EPISODES)} episode templates")
        print("\nEpisode Arc:")
        for ep in EPISODES:
            print(f"  - Ep {ep['episode_number']}: {ep['title']}")
        return

    db = Database(DATABASE_URL)
    await db.connect()

    try:
        # Get world ID
        world_id = await get_world_id(db, "k-world")
        print(f"\nUsing world: k-world ({world_id})")

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
        print("1. Add background configs to content_image_generation.py")
        print("2. Run image generation script")
        print("3. Activate content")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold K-Campus Encounter series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
