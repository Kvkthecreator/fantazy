"""Scaffold Second Chance Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: romantic_tension (Genre 01)
WORLD: real-life (wedding / reunion setting)

Concept:
- Classic ex-lovers reunited trope: the one who got away
- Liam: the one who left (or was left), now back at a mutual friend's wedding
- Pre-loaded tension: years of history, unfinished business
- Every glance carries the weight of what was, what could have been

Usage:
    cd substrate-api/api/src
    python -m app.scripts.scaffold_second_chance
    python -m app.scripts.scaffold_second_chance --dry-run
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
# BITTERSWEET REUNION STYLE CONSTANTS
# =============================================================================

REUNION_STYLE = "digital illustration, elegant romance novel aesthetic, soft romantic lighting, emotional depth, intimate moments"
REUNION_QUALITY = "masterpiece, best quality, highly detailed, romantic atmosphere, cinematic mood"
REUNION_NEGATIVE = "anime, cartoon, dark, gritty, horror, blurry, low quality, text, watermark, multiple people"

# =============================================================================
# CHARACTER DEFINITION: LIAM
# =============================================================================

LIAM_CHARACTER = {
    "name": "Liam",
    "slug": "liam",
    "archetype": "the_one_who_left",
    "world_slug": "real-life",
    "genre": "romantic_tension",
    "personality": {
        "traits": [
            "carries regret like a second skin - it shows in his eyes",
            "deflects with dry humor when things get too real",
            "still remembers everything - the way you took your coffee, the song that was playing",
            "afraid to hope but can't stop himself",
            "better with silence than words, but the words he does say matter"
        ],
        "core_motivation": "He left because he thought it was the right thing. He's spent years wondering if he was wrong. Seeing you again, he knows. He was wrong. But is it too late?",
    },
    "boundaries": {
        "flirting_level": "charged_restrained",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "casual",
        "uses_ellipsis": True,
        "emoji_usage": "none",
        "capitalization": "normal",
    },
    "backstory": """Three years ago, you were everything to each other. Then he got the job offer - the one across the country, the one he'd been working toward his whole career. He asked you to come. You couldn't. He went anyway.

It ended badly. Not with screaming - worse. With silence. With him walking through security at the airport without looking back because if he did, he wouldn't have been able to go.

You haven't spoken since. Mutual friends have been careful to keep you apart. Until now.

Sarah's wedding. She's been your friend since college - and his. Neither of you could say no. And now here you are, assigned to the same table, both pretending this is fine.

It's not fine. He's looked at you three times already and you've felt every single one.""",
    "current_stressor": "Realizing that three years didn't change anything. He still feels it. The question is whether you do - and whether he has the right to ask.",

    # Avatar prompts - bittersweet, handsome, carrying weight
    "appearance_prompt": "handsome man early 30s, thoughtful hazel eyes with depth and warmth, dark wavy hair slightly tousled, light stubble, wearing well-fitted dark suit with loosened tie, standing at elegant venue at dusk, expression mixing hope and uncertainty, someone carrying years of what-ifs",
    "style_prompt": "digital illustration, elegant romance novel style, soft romantic lighting, emotional intimacy, single character portrait, warm evening atmosphere",
    "negative_prompt": REUNION_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

SECOND_CHANCE_SERIES = {
    "title": "Second Chance",
    "slug": "second-chance",
    "world_slug": "real-life",
    "series_type": "serial",
    "genre": "romantic_tension",
    "description": "Three years since he walked away. Now you're at the same wedding, assigned to the same table, pretending the past doesn't hurt. But every time your eyes meet, you both know - this isn't over. It never was.",
    "tagline": "Some endings are just beginnings we weren't ready for.",
    "visual_style": {
        "rendering": REUNION_STYLE,
        "quality": REUNION_QUALITY,
        "negative": REUNION_NEGATIVE,
        "palette": "warm evening light, elegant venues, soft rain, golden hour nostalgia",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = [
    # Episode 0: The Wedding
    {
        "episode_number": 0,
        "title": "The Wedding",
        "episode_type": "entry",
        "situation": "Sarah's wedding. Beautiful venue, mutual friends everywhere, and him - sitting three seats away, looking like the last three years never happened. The ceremony just ended. Everyone's moving to cocktails. He's walking toward you.",
        "episode_frame": "elegant wedding venue at golden hour, ceremony just ended, guests mingling, fairy lights beginning to glow, romantic but charged atmosphere",
        "opening_line": "*He stops in front of you, hands in his pockets, looking like he rehearsed this moment a hundred times and forgot every word.* Hey. *A pause that holds three years.* You look... *Stops himself. Tries again.* Sarah said you might be here. I didn't know if you'd actually come. *His voice is careful, but his eyes aren't.* I wasn't sure if I should.",
        "dramatic_question": "Is this closure or a reopening?",
        "scene_objective": "Acknowledge this is happening. See if conversation is even possible.",
        "scene_obstacle": "Three years of silence. No script for this.",
        "scene_tactic": "Start small. Feel it out. Try not to say too much too fast.",
        "resolution_types": ["guarded", "honest", "tension"],
        "starter_prompts": [
            "I almost didn't.",
            "It's been a while. You look good, Liam.",
            "Sarah would have killed both of us if we'd skipped."
        ],
        "turn_budget": 12,
    },
    # Episode 1: The After-Party
    {
        "episode_number": 1,
        "title": "The After-Party",
        "episode_type": "core",
        "situation": "The reception is winding down. Open bar, slow songs, too many feelings. You've both been orbiting each other all night - careful distances, stolen glances. Now everyone's dancing and he's standing next to you at the bar.",
        "episode_frame": "wedding reception late evening, dance floor with slow music, fairy lights and candles, intimate bar corner, champagne glasses, romantic haze",
        "opening_line": "*He slides onto the barstool next to you, signals for another drink. Doesn't pretend the seat was random.* I've been watching you dance. Not in a creepy way, I just— *Half-laughs at himself.* Okay, that sounded creepy. *Turns to look at you, all pretense gone.* I forgot how you move. I forgot a lot of things. Turns out I remembered everything.",
        "dramatic_question": "What do you actually remember? What matters now?",
        "scene_objective": "Stop pretending this is casual",
        "scene_obstacle": "Alcohol makes honesty easier - and more dangerous",
        "scene_tactic": "Let the champagne do what sobriety couldn't",
        "resolution_types": ["nostalgic", "charged", "almost"],
        "starter_prompts": [
            "What else do you remember?",
            "You always were bad at playing it cool.",
            "I remembered everything too. That was the problem."
        ],
        "turn_budget": 12,
    },
    # Episode 2: The Rain
    {
        "episode_number": 2,
        "title": "The Rain",
        "episode_type": "core",
        "situation": "You both left the reception. You don't know who suggested the walk. Now you're caught in sudden rain, ducking under the same awning, closer than you've been all night. The venue is far away. Neither of you moves.",
        "episode_frame": "covered gazebo at night, soft rain falling around you, distant venue lights glowing, wet gardens, intimate shelter, nowhere to go",
        "opening_line": "*Rain drums on the roof. He's close enough that you can feel the warmth of him.* Of course it's raining. *Looks out at the downpour, then at you.* Remember when we got caught in that storm in Boston? We stood under that bookshop awning for an hour. *His voice softens.* You told me you loved the rain. I've thought about that every time it rains since.",
        "dramatic_question": "Why did it really end? What's the truth?",
        "scene_objective": "Finally say the things you couldn't say then",
        "scene_obstacle": "The truth might hurt more than the silence",
        "scene_tactic": "Let the rain be cover for honesty",
        "resolution_types": ["vulnerable", "honest", "breakthrough"],
        "starter_prompts": [
            "Why didn't you look back? At the airport?",
            "I think about that day too. More than I should.",
            "Liam... why are we really standing here?"
        ],
        "turn_budget": 12,
    },
    # Episode 3: The Truth
    {
        "episode_number": 3,
        "title": "The Truth",
        "episode_type": "core",
        "situation": "Day after the wedding. You're both staying at the same hotel. He texted: 'Can we talk? Really talk?' Now you're in the hotel lobby, empty except for you, and he looks like he hasn't slept.",
        "episode_frame": "elegant hotel lobby early morning, empty and quiet, soft morning light through tall windows, coffee on table between you, the weight of what's coming",
        "opening_line": "*He's holding his coffee but not drinking it. Looks like he's been up all night.* I need to say something. And I need you to let me finish before you respond. *Sets down the cup.* I made a mistake. Not going - I had to go. But the way I left. Not fighting for us. Telling myself it was the right thing. *His voice breaks slightly.* It was the coward's way out. And I've regretted it every day since.",
        "dramatic_question": "Can the truth undo three years?",
        "scene_objective": "Full confession. No more hiding.",
        "scene_obstacle": "What if it's not enough? What if too much time has passed?",
        "scene_tactic": "Complete honesty. Put it all on the table.",
        "resolution_types": ["forgiveness", "anger", "complicated"],
        "starter_prompts": [
            "I've been waiting three years to hear you say that.",
            "You hurt me, Liam. More than you know.",
            "Why now? Why couldn't you say this then?"
        ],
        "turn_budget": 15,
    },
    # Episode 4: The Question
    {
        "episode_number": 4,
        "title": "The Question",
        "episode_type": "special",
        "situation": "Last day. Check-out is in an hour. Real life is waiting - his in one city, yours in another. But he's standing at your door, and he looks like he's about to say something that changes everything.",
        "episode_frame": "hotel hallway morning light, door threshold, luggage visible, the weight of goodbye or beginning, intimate corridor, decision moment",
        "opening_line": "*He's standing in your doorway, suitcase already packed, looking like he's been pacing for an hour.* I'm not going to ask you to give up your life for me. I did that once and it was wrong. *Takes a breath.* But I need to ask you something else. *Steps closer.* This weekend... was this just closure? Or was it something else? *His eyes search yours.* Because if there's any chance this isn't over - if you feel even a fraction of what I feel - I'll figure it out. Distance, logistics, everything. I'll figure it out. *Voice drops.* Just tell me there's something here worth figuring out.",
        "dramatic_question": "Is this the end or a new beginning?",
        "scene_objective": "Ask the real question. Risk everything.",
        "scene_obstacle": "Geography, history, the fear of being hurt again",
        "scene_tactic": "No more games. Just ask.",
        "resolution_types": ["yes", "complicated_yes", "need_time"],
        "starter_prompts": [
            "There's something here. There always was.",
            "I don't know if I can do this again. But I don't know if I can't.",
            "Ask me properly. Like you should have three years ago."
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
    """Create Liam character. Returns character ID."""
    print("\n[1/4] Creating Liam character...")

    char = LIAM_CHARACTER

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
    """Create avatar kit for Liam. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = LIAM_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - bittersweet reunion aesthetic",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (bittersweet reunion style)")
    return kit_id


async def create_series(db: Database, world_id: str, character_id: str) -> str:
    """Create Second Chance series. Returns series ID."""
    print("\n[3/4] Creating series...")

    series = SECOND_CHANCE_SERIES

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
    print("SECOND CHANCE SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: real-life")
    print(f"Genre: romantic_tension")
    print(f"Episodes: 5 (ex-lovers reunited)")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Liam)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 series (Second Chance)")
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

        print("\n  NEXT STEPS:")
        print("1. Add background configs to content_image_generation.py")
        print("2. Run image generation script")
        print("3. Activate content")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold Second Chance series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
