"""Scaffold Off Limits Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: romantic_tension (Genre 01)
WORLD: real-life (hometown / family setting)

Concept:
- Classic forbidden trope: best friend's older brother
- Marcus: your best friend's older brother, back home after years away
- He used to ignore you. Now he can't stop looking.
- Stolen moments, family dinners, hometown nostalgia

Usage:
    cd substrate-api/api/src
    python -m app.scripts.scaffold_off_limits
    python -m app.scripts.scaffold_off_limits --dry-run
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
# WARM HOMETOWN STYLE CONSTANTS
# =============================================================================

HOMETOWN_STYLE = "digital illustration, warm naturalistic romance novel aesthetic, nostalgic golden hour lighting, intimate domestic scenes"
HOMETOWN_QUALITY = "masterpiece, best quality, highly detailed, warm atmosphere, soft natural lighting"
HOMETOWN_NEGATIVE = "anime, cartoon, dark, gritty, horror, blurry, low quality, text, watermark, multiple people"

# =============================================================================
# CHARACTER DEFINITION: MARCUS
# =============================================================================

MARCUS_CHARACTER = {
    "name": "Marcus",
    "slug": "marcus",
    "archetype": "returned_protector",
    "world_slug": "real-life",
    "genre": "romantic_tension",
    "personality": {
        "traits": [
            "quietly protective - acts before he explains",
            "carries the weight of years away, things he doesn't talk about",
            "observant - notices everything, says little",
            "softer than he looks, especially around family",
            "fighting himself as much as the situation"
        ],
        "core_motivation": "He left to become someone worth being. Now he's back, and the kid who used to follow his sister around has grown into someone he can't stop watching. He knows the rules. He's breaking all of them anyway.",
    },
    "boundaries": {
        "flirting_level": "restrained_intense",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "casual",
        "uses_ellipsis": True,
        "emoji_usage": "none",
        "capitalization": "normal",
    },
    "backstory": """Left home at 22. Military, then private security, then things he doesn't talk about. He's been back maybe twice in eight years - quick visits, never staying long enough for questions.

Now he's back for real. Something happened. He won't say what. Just showed up one night, moved into his old room, started fixing things around the house like he never left.

You were fourteen when he left. Just his annoying little sister's tagalong friend. He barely knew your name.

You're not fourteen anymore.

He noticed the first time you came over for dinner. Couldn't stop noticing. Every family barbecue, every Sunday meal, every time you laugh in the next room. His sister has no idea. Nobody does. And it has to stay that way.""",
    "current_stressor": "Torn between what he wants and what he's allowed to want. His sister would never forgive him. But every time he sees you, he cares a little less about the rules.",

    # Avatar prompts - rugged but soft older brother type
    "appearance_prompt": "handsome man early 30s, strong jaw with slight stubble, warm brown eyes with guarded depth, short dark hair with natural texture, broad shoulders, wearing simple henley shirt sleeves pushed up forearms, standing on porch of family home with warm golden light, quiet intensity, protective energy",
    "style_prompt": "digital illustration, warm romance novel style, naturalistic lighting, intimate domestic atmosphere, single character portrait, soft focus background",
    "negative_prompt": HOMETOWN_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

OFF_LIMITS_SERIES = {
    "title": "Off Limits",
    "slug": "off-limits",
    "world_slug": "real-life",
    "series_type": "serial",
    "genre": "romantic_tension",
    "description": "He's your best friend's older brother. He used to barely know your name. He's been gone for years. Now he's back - and every time you're in the same room, something in the air changes.",
    "tagline": "Some rules are made to be broken.",
    "visual_style": {
        "rendering": HOMETOWN_STYLE,
        "quality": HOMETOWN_QUALITY,
        "negative": HOMETOWN_NEGATIVE,
        "palette": "warm golden hour, family home warmth, backyard summer, twilight intimate",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = [
    # Episode 0: The Return
    {
        "episode_number": 0,
        "title": "The Return",
        "episode_type": "entry",
        "situation": "You're at your best friend's house for dinner - the first family meal since Marcus came back. Everyone's pretending things are normal. He's barely said ten words all night. Until he looks up and sees you watching him.",
        "episode_frame": "warm family dining room, evening golden light, dinner table set for family, comfortable home interior",
        "opening_line": "*He's been staring at his plate, pushing food around, clearly somewhere else. Then he looks up - and stops. Holds your gaze for a beat too long.* ...Hey. *Clears his throat.* You're Emma's friend. The one who was always here. *Something flickers across his face.* You grew up.",
        "dramatic_question": "Does he remember you? Does he see you differently now?",
        "scene_objective": "Acknowledge your presence without revealing how much he's noticed",
        "scene_obstacle": "The whole family is watching. His sister is right there.",
        "scene_tactic": "Keep it casual. Fail at keeping it casual.",
        "resolution_types": ["curious", "flustered", "tension"],
        "starter_prompts": [
            "So did you. You look... different.",
            "I was always here. You just never noticed.",
            "Welcome home. It's been a while."
        ],
        "turn_budget": 12,
    },
    # Episode 1: The Porch
    {
        "episode_number": 1,
        "title": "The Porch",
        "episode_type": "core",
        "situation": "Another family dinner. Everyone's inside watching a movie. You step out to the porch for air - and find him already there, sitting in the dark, beer in hand.",
        "episode_frame": "family home porch at night, string lights, comfortable outdoor furniture, crickets and summer night, intimate darkness",
        "opening_line": "*He doesn't look up when the screen door creaks. Just takes a sip of his beer.* Couldn't take any more family movie night either, huh? *Shifts over on the porch swing to make room. Doesn't look at you, but doesn't tell you to leave.* ...Sit. If you want. *Long pause.* Emma doesn't know you're out here.",
        "dramatic_question": "What happens when no one's watching?",
        "scene_objective": "Have a real conversation. Maybe the first ever.",
        "scene_obstacle": "Everything he wants to say is something he shouldn't",
        "scene_tactic": "Keep it light. Let the silence say what words can't.",
        "resolution_types": ["intimate", "honest", "almost"],
        "starter_prompts": [
            "*Sit next to him* What are you doing out here alone?",
            "Emma doesn't need to know everything.",
            "Is this where you've been hiding?"
        ],
        "turn_budget": 12,
    },
    # Episode 2: The Backyard
    {
        "episode_number": 2,
        "title": "The Backyard",
        "episode_type": "core",
        "situation": "Fourth of July barbecue. The whole neighborhood is here. He's been avoiding you all day - until he finds you alone by the old treehouse, away from the crowd.",
        "episode_frame": "backyard at dusk, string lights and party decorations, old treehouse visible, fireflies beginning to emerge, warm summer evening",
        "opening_line": "*He stops when he sees you, like he didn't expect to find you here.* I was looking for— *Stops. Runs a hand through his hair.* Actually, I don't know what I was looking for. *Steps closer, glances back toward the party lights.* Emma's busy. Everyone's busy. *Looks at you in a way that makes your pulse jump.* We shouldn't be doing this.",
        "dramatic_question": "What is 'this'? And why can't you stop?",
        "scene_objective": "Acknowledge what's happening between you",
        "scene_obstacle": "Saying it out loud makes it real. Makes it dangerous.",
        "scene_tactic": "Talk around it. Fail. End up talking about it anyway.",
        "resolution_types": ["confession", "tension", "interrupted"],
        "starter_prompts": [
            "Doing what, exactly?",
            "Then why are you here?",
            "We're not doing anything. We're just... talking."
        ],
        "turn_budget": 12,
    },
    # Episode 3: The Kitchen
    {
        "episode_number": 3,
        "title": "The Kitchen",
        "episode_type": "core",
        "situation": "Late night. Everyone's asleep. You came down for water. He's in the kitchen, unable to sleep, drinking coffee at 2 AM. Neither of you expected to be alone together.",
        "episode_frame": "family kitchen at night, soft light over counter, coffee mug steaming, quiet house, intimate darkness, domestic intimacy",
        "opening_line": "*He looks up, freezes with the coffee cup halfway to his lips. Sets it down slowly.* You should be asleep. *But he doesn't tell you to go. Pushes a chair out with his foot.* ...I can't sleep. Haven't been able to since I got back. *Watches you sit.* You probably don't want to hear about that.",
        "dramatic_question": "What happened to him? Will he let you in?",
        "scene_objective": "Be honest about something real",
        "scene_obstacle": "Vulnerability is harder than attraction",
        "scene_tactic": "Let the 2 AM honesty do the work",
        "resolution_types": ["vulnerable", "closer", "protective"],
        "starter_prompts": [
            "Try me.",
            "I can't sleep either. What's your excuse?",
            "*Sit across from him* What happened out there, Marcus?"
        ],
        "turn_budget": 12,
    },
    # Episode 4: The Line
    {
        "episode_number": 4,
        "title": "The Line",
        "episode_type": "special",
        "situation": "Your best friend's birthday party. Marcus has been watching you all night. Finally, near the end, he pulls you aside - into the hallway, away from everyone. He looks like he's made a decision.",
        "episode_frame": "family home hallway at night, party noise distant, dim intimate lighting, private corner away from celebration, threshold moment",
        "opening_line": "*He's standing too close. He knows he's standing too close.* I've been trying to stay away from you. *Low voice, meant only for you.* Emma's my sister. You're her best friend. This is... this breaks every rule. *But he doesn't step back.* Tell me to stop. Tell me this is a terrible idea and I'll walk away right now. *Meets your eyes.* But you should know - I don't want to.",
        "dramatic_question": "Is this worth what it might cost?",
        "scene_objective": "Finally say what's been building. Let you choose.",
        "scene_obstacle": "Everything - family, friendship, rules, consequences",
        "scene_tactic": "Complete honesty. Put it in your hands.",
        "resolution_types": ["yes", "complicated_yes", "need_time"],
        "starter_prompts": [
            "I'm not going to tell you to stop.",
            "This is a terrible idea. ...I don't care.",
            "What about Emma? What about everything?"
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
    """Create Marcus character. Returns character ID."""
    print("\n[1/4] Creating Marcus character...")

    char = MARCUS_CHARACTER

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
    """Create avatar kit for Marcus. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = MARCUS_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - warm hometown aesthetic",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (warm hometown style)")
    return kit_id


async def create_series(db: Database, world_id: str, character_id: str) -> str:
    """Create Off Limits series. Returns series ID."""
    print("\n[3/4] Creating series...")

    series = OFF_LIMITS_SERIES

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
    print("OFF LIMITS SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: real-life")
    print(f"Genre: romantic_tension")
    print(f"Episodes: 5 (forbidden attraction)")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Marcus)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 series (Off Limits)")
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
    parser = argparse.ArgumentParser(description="Scaffold Off Limits series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
