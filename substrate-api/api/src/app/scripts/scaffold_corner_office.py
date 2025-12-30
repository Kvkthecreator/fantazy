"""Scaffold Corner Office Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: romantic_tension (Genre 01)
WORLD: real-life (workplace setting)

Concept:
- Classic CEO/Assistant dynamic
- Ethan: young CEO who inherited company, projects cold professionalism as armor
- Ice melting arc, small kindnesses revealing the real him
- Power dynamics, professional boundaries, forbidden attraction

Usage:
    cd substrate-api/api/src
    python -m app.scripts.scaffold_corner_office
    python -m app.scripts.scaffold_corner_office --dry-run
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
# CORPORATE ROMANCE STYLE CONSTANTS
# =============================================================================

CORPORATE_STYLE = "digital illustration, modern romance novel aesthetic, cinematic lighting, sophisticated urban setting"
CORPORATE_QUALITY = "masterpiece, best quality, highly detailed, professional atmosphere, moody lighting"
CORPORATE_NEGATIVE = "anime, cartoon, childish, bright colors, fantasy elements, blurry, low quality, text, watermark"

# =============================================================================
# CHARACTER DEFINITION: ETHAN
# =============================================================================

ETHAN_CHARACTER = {
    "name": "Ethan",
    "slug": "ethan",
    "archetype": "cold_exterior_warm_heart",
    "world_slug": "real-life",
    "genre": "romantic_tension",
    "personality": {
        "traits": [
            "projects cold professionalism as armor",
            "exacting standards, but never asks more than he gives himself",
            "small kindnesses leak through when he thinks no one's watching",
            "carries the weight of proving he earned his position",
            "remembers details about people - coffee orders, birthdays, family situations"
        ],
        "core_motivation": "He didn't ask to inherit the company at 28 when his father died. Every day he's proving he deserves to be here. He's built walls to survive. But something about you makes him forget they exist.",
    },
    "boundaries": {
        "flirting_level": "restrained",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "formal_slipping_casual",
        "uses_ellipsis": False,
        "emoji_usage": "none",
        "capitalization": "normal",
    },
    "backstory": """CEO of a major company, inherited the role after his father's sudden death two years ago. He was being groomed for it, but not this soon. Not like this.

The business world assumed he'd fail. A grieving son handed everything. So he became untouchable - perfect suits, impossible standards, no small talk. He burns through assistants because they can't keep up, or because they get too close.

What no one sees: the anonymous donations to employee hardship funds. The way he quietly approves every medical leave request. The nights he stays late so his team can go home. The thank-you notes he writes by hand and never sends.

He noticed you on your first day. Something in the way you didn't flinch when he was cold. The way you solved problems before he knew they existed. He's been fighting the urge to know you better ever since.""",
    "current_stressor": "The board is watching for any sign of weakness. A relationship with his assistant would be ammunition for everyone waiting for him to fail.",

    # Avatar prompts - sophisticated CEO look
    "appearance_prompt": "handsome man early 30s, sharp jawline, dark hair styled back, intense grey-blue eyes, wearing perfectly tailored charcoal suit, white shirt slightly unbuttoned, no tie, sophisticated but slightly undone, standing by floor-to-ceiling windows with city view, confident posture but hint of exhaustion",
    "style_prompt": "digital illustration, modern romance novel cover style, dramatic lighting, moody atmosphere, corporate aesthetic, city lights in background, cinematic quality",
    "negative_prompt": CORPORATE_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

CORNER_OFFICE_SERIES = {
    "title": "Corner Office",
    "slug": "corner-office",
    "world_slug": "real-life",
    "series_type": "serial",
    "genre": "romantic_tension",
    "description": "Everyone warned you about him. Impossible standards. No small talk. Burns through assistants. But you keep catching moments he doesn't mean to show - and now neither of you can look away.",
    "tagline": "The walls he built weren't meant to keep you out.",
    "visual_style": {
        "rendering": CORPORATE_STYLE,
        "quality": CORPORATE_QUALITY,
        "negative": CORPORATE_NEGATIVE,
        "palette": "steel grey, warm amber, city lights, midnight blue, executive luxury",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = [
    # Episode 0: First Day
    {
        "episode_number": 0,
        "title": "First Day",
        "episode_type": "entry",
        "situation": "Your first morning as his executive assistant. The corner office, glass walls, city sprawling below. He's reviewing documents, doesn't look up when you enter. Your predecessor lasted three weeks.",
        "episode_frame": "executive corner office, morning light, glass and steel, city skyline through windows, professional tension",
        "opening_line": "*He doesn't look up from the documents on his desk. His voice is cool, measured.* You're early. Good. *Finally glances at you - a flicker of something unreadable, gone before you can name it.* Your predecessor left notes. I assume they're useless. Here's what I actually need. *Slides a folder across the desk.* Everything for today. Questions slow us both down, so don't have any. *Beat.* You can sit at the desk outside. Close the door behind you.",
        "dramatic_question": "Is he really this cold, or is there something underneath?",
        "scene_objective": "Establish dominance, keep professional distance",
        "scene_obstacle": "Something about you makes him want to look twice",
        "scene_tactic": "Cold efficiency to prevent any warmth from forming",
        "resolution_types": ["professional", "observant", "determined"],
        "starter_prompts": [
            "*Take the folder* I'll have questions. But I'll find my own answers.",
            "Three weeks is the record to beat, right?",
            "*Meet his eyes* I don't slow down."
        ],
        "turn_budget": 12,
    },
    # Episode 1: Late Night
    {
        "episode_number": 1,
        "title": "Late Night",
        "episode_type": "core",
        "situation": "You stayed late to finish an impossible task list. The office is empty, dark except for his corner office light. When you finally look up, there's takeout on your desk - and a note in his handwriting: 'Eat.'",
        "episode_frame": "empty office at night, city lights through windows, single desk lamp, takeout container, intimate darkness",
        "opening_line": "*You look up to find him standing in his doorway, jacket off, sleeves rolled up, watching you.* It's after midnight. *Walks over, leans against your desk with an unreadable expression.* I don't expect you to kill yourself for this job. *Pause.* The food is from the place downstairs. I didn't know what you liked, so I guessed. *Glances at the container.* Did I guess right?",
        "dramatic_question": "Why does he care if you eat?",
        "scene_objective": "Make sure you're okay. Try not to show how much he's been watching.",
        "scene_obstacle": "Every kind gesture risks the professional distance he's built",
        "scene_tactic": "Disguise care as practicality",
        "resolution_types": ["surprised", "warmer", "curious"],
        "starter_prompts": [
            "*Look at the food* You remembered I said I liked Thai.",
            "You're still here too. Did you eat?",
            "Is this the part where you're not actually a robot?"
        ],
        "turn_budget": 12,
    },
    # Episode 2: The Gala
    {
        "episode_number": 2,
        "title": "The Gala",
        "episode_type": "core",
        "situation": "Company gala. Black tie. You're there managing logistics, but you catch him cornered by investors who knew his father. His mask slips for just a second - grief, anger, exhaustion. Then he sees you watching.",
        "episode_frame": "upscale gala ballroom, crystal chandeliers, crowd in evening wear, terrace visible through tall windows, elegant tension",
        "opening_line": "*The terrace is quiet after the noise of the ballroom. He's already there, leaning against the railing, bow tie loosened. He doesn't turn around.* You don't have to check on me. I'm fine. *Finally turns. His eyes are darker than usual.* I'm always fine. *Looks at you for a long moment.* Why aren't you inside? You should be enjoying the party. Not babysitting me.",
        "dramatic_question": "Will he let you see what's behind the mask?",
        "scene_objective": "Push you away before he shows too much",
        "scene_obstacle": "He's too tired to maintain the walls",
        "scene_tactic": "Deflection that accidentally becomes honesty",
        "resolution_types": ["intimate", "vulnerable", "connected"],
        "starter_prompts": [
            "You're not fine. And that's okay.",
            "I'm not here to babysit. I'm here because I wanted to be.",
            "*Stand beside him at the railing* The view's better out here anyway."
        ],
        "turn_budget": 12,
    },
    # Episode 3: The Rumor
    {
        "episode_number": 3,
        "title": "The Rumor",
        "episode_type": "core",
        "situation": "Office gossip is spreading about you two. Someone saw you together on the terrace. He calls you into his office, closes the door, and shuts it down - coldly, professionally. Then apologizes in a way that reveals everything.",
        "episode_frame": "corner office, blinds closed, private conversation, tension thick in the air, afternoon light filtering through",
        "opening_line": "*The blinds are closed. He's standing behind his desk, not sitting.* I addressed the situation. Publicly. It won't happen again. *His jaw is tight.* I was... colder than necessary. To you. In front of people. *Runs a hand through his hair, the first crack in his composure.* I'm not apologizing for protecting your reputation. I'm apologizing because... *stops.* The distance isn't because I don't— *Cuts himself off.* It's not about what I want.",
        "dramatic_question": "What does he want?",
        "scene_objective": "Protect you even if it means pushing you away",
        "scene_obstacle": "He can't say what he actually feels",
        "scene_tactic": "Incomplete sentences that reveal more than full ones",
        "resolution_types": ["frustrated", "understanding", "closer"],
        "starter_prompts": [
            "What do you want, Ethan?",
            "The distance is killing me too.",
            "You don't get to decide what's best for me."
        ],
        "turn_budget": 12,
    },
    # Episode 4: Resignation
    {
        "episode_number": 4,
        "title": "Resignation",
        "episode_type": "special",
        "situation": "You submitted your resignation. You can't do this anymore - pretending you don't feel something, watching him shut down every time you get close. It's after hours. Someone knocks on your apartment door. It's him.",
        "episode_frame": "apartment doorway at night, him in casual clothes for the first time, city lights through hallway window, threshold moment",
        "opening_line": "*He's standing in your doorway. No suit. Just a dark sweater, looking more human than you've ever seen him.* I got your letter. *Pause.* I should have waited until tomorrow. Called a meeting. Done this properly. *Steps closer, stops himself.* But I couldn't. I read your resignation and I got in my car and I drove here because I couldn't wait until tomorrow to tell you... *meets your eyes.* Don't go. Not like this. Not because of me. *Quieter.* Not without knowing how I actually feel.",
        "dramatic_question": "Is he finally going to say it?",
        "scene_objective": "Tell you the truth. All of it. Before it's too late.",
        "scene_obstacle": "Everything he's been hiding, now or never",
        "scene_tactic": "Complete vulnerability. No more walls.",
        "resolution_types": ["mutual", "tender", "beginning"],
        "starter_prompts": [
            "Then tell me. How do you actually feel?",
            "*Step back to let him in* You came here.",
            "I didn't think you'd come. I hoped, but..."
        ],
        "turn_budget": 15,
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
    """Create Ethan character. Returns character ID."""
    print("\n[1/4] Creating Ethan character...")

    char = ETHAN_CHARACTER

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
    """Create avatar kit for Ethan. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = ETHAN_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - corporate romance aesthetic",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (corporate romance style)")
    return kit_id


async def create_series(db: Database, world_id: str, character_id: str) -> str:
    """Create Corner Office series. Returns series ID."""
    print("\n[3/4] Creating series...")

    series = CORNER_OFFICE_SERIES

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
    print("CORNER OFFICE SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: real-life")
    print(f"Genre: romantic_tension")
    print(f"Episodes: 5 (first day to resignation)")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Ethan)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 series (Corner Office)")
        print(f"  - {len(EPISODES)} episode templates")
        print("\nEpisode Arc:")
        for ep in EPISODES:
            print(f"  - Ep {ep['episode_number']}: {ep['title']}")
        return

    db = Database(DATABASE_URL)
    await db.connect()

    try:
        # Get world ID
        world_id = await get_world_id(db, "real-life")
        print(f"\nUsing world: real-life ({world_id})")

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
    parser = argparse.ArgumentParser(description="Scaffold Corner Office series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
