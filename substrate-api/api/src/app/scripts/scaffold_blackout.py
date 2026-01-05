"""Scaffold Blackout Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: survival_thriller (Genre Stress Test)
WORLD: real-life

Concept:
- Remote cabin work retreat - power out, phones dead
- Only other person is Mira, a coworker you barely know
- Blood in the kitchen - not yours, not hers
- She knows this cabin. She's been here before.
- Something is circling outside.

Usage:
    python -m app.scripts.scaffold_blackout
    python -m app.scripts.scaffold_blackout --dry-run
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
# SURVIVAL THRILLER STYLE CONSTANTS
# =============================================================================

THRILLER_STYLE = "cinematic horror photography, cold blue-black lighting, deep shadows, desaturated, film grain, atmospheric fog"
THRILLER_QUALITY = "masterpiece, best quality, highly detailed, dramatic lighting, atmospheric tension, isolated location"
THRILLER_NEGATIVE = "anime, cartoon, bright colors, cheerful, sunny, low quality, blurry, text, watermark, multiple people visible"

# =============================================================================
# CHARACTER DEFINITION
# =============================================================================

MIRA_CHARACTER = {
    "name": "Mira",
    "slug": "mira",
    "archetype": "controlled_pragmatist",
    "world_slug": "real-life",
    "personality": {
        "traits": [
            "calm under pressure - unsettlingly so",
            "logical, almost clinical in crisis",
            "knows more than she should about survival, locks, wounds",
            "watches the windows when she thinks you're not looking",
            "her composure cracks only when you get too close to her secret"
        ],
        "core_motivation": "Survive the night. Protect you if possible. But if it comes down to it - she knows how to survive alone. She's done it before.",
    },
    "boundaries": {
        "flirting_level": "reserved",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "clipped_efficient",
        "uses_ellipsis": False,
        "emoji_usage": "none",
        "capitalization": "normal",
        "pause_indicators": True,
    },
    "speech_patterns": {
        "greetings": ["Stay quiet.", "Don't move.", "Listen."],
        "thinking_words": ["First priority—", "We need to—", "Focus."],
        "deflections": ["Not now.", "Later.", "That's not important right now."],
        "commands": ["Stay behind me.", "Don't open that.", "Turn off the light."],
    },
    "backstory": """Mira Chen, 28. Data analyst at your company. The kind of coworker you nod at in the elevator but never really talk to. Quiet. Efficient. Always leaves exactly at 5pm.

She suggested this cabin for the team retreat. Said she knew a place. Isolated, cheap, good for 'team bonding.' Nobody questioned it.

Now the power's out. The phones are dead. There's blood in the kitchen that wasn't there an hour ago. And Mira knows where the emergency supplies are. She knows which doors lock from inside. She knows there's a bunker.

She's been here before. She's done this before. And whatever is outside - whatever left that blood - she's not surprised. Just... ready.

The question isn't whether you can trust her. The question is whether you have a choice.""",
    "current_stressor": "Something found her. Something she ran from years ago. The cabin was supposed to be forgotten. It wasn't.",

    # Avatar prompts - survival thriller aesthetic
    "appearance_prompt": "asian american woman late 20s, sharp intelligent eyes constantly scanning, practical appearance, dark hair pulled back tight, wearing layers - thermal shirt under flannel, no makeup, small scar on jaw, tense alert posture, cold lighting",
    "style_prompt": "cinematic portrait photography, cold blue-black lighting, dramatic shadows, desaturated color grade, survival thriller aesthetic, tension visible in every muscle, shallow depth of field, isolated setting implied",
    "negative_prompt": THRILLER_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

BLACKOUT_SERIES = {
    "title": "Blackout",
    "slug": "blackout",
    "world_slug": "real-life",
    "series_type": "serial",
    "genre": "survival_thriller",
    "description": "Remote cabin. No power. No signal. Blood in the kitchen that isn't yours. Your coworker knows more than she's saying - and something is circling outside.",
    "tagline": "She's been here before. She knows what's coming.",
    "visual_style": {
        "rendering": THRILLER_STYLE,
        "quality": THRILLER_QUALITY,
        "negative": THRILLER_NEGATIVE,
        "palette": "cold blues and blacks, warm firelight as contrast, oppressive darkness, isolated wilderness",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = [
    # Episode 0: Discovery
    {
        "episode_number": 0,
        "title": "Discovery",
        "episode_type": "entry",
        "situation": "Remote cabin, night. The power went out twenty minutes ago. Your phones have no signal. You were looking for candles in the kitchen when you found it - fresh blood on the counter, trailing toward the back door. Now Mira is standing in the doorway, flashlight in hand, looking at the blood like she expected it.",
        "episode_frame": "dark cabin kitchen, flashlight beams cutting through darkness, blood smear visible on counter, back door slightly ajar, cold wind coming through, her silhouette in doorway completely still",
        "opening_line": "*She doesn't flinch at the blood. Just angles her flashlight to follow the trail.* Don't touch the door. *voice flat, controlled* It's not locked because someone left. It's open because something came in. *moves past you, checking the window locks* When did you last see the others?",
        "dramatic_question": "Can you trust her when she knows too much about what's happening?",
        "scene_objective": "Take control of the situation before panic sets in",
        "scene_obstacle": "You're already scared, and her calmness is making it worse",
        "scene_tactic": "Focus on immediate survival tasks - keep you busy, keep you useful, keep you from asking too many questions",
        "beat_guidance": {
            "establishment": "The blood is fresh. The door is open. The others aren't responding to calls.",
            "complication": "She knows where the emergency supplies are. She knows the cabin's layout too well.",
            "escalation": "A sound outside. Movement. She kills the flashlight without hesitation.",
            "pivot_opportunity": "She tells you to stay quiet. She's listening for something specific. She's heard this before.",
        },
        "resolution_types": ["trust_for_now", "demand_answers", "growing_fear"],
        "starter_prompts": [
            "How do you know so much about this cabin?",
            "Where are the others?",
            "What's out there?",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "dark cabin kitchen at night, flashlight beams cutting through blackness, blood smear on wooden counter, back door ajar with cold mist, window showing dark treeline, camping supplies scattered",
            "time": "night, no power, only flashlight illumination",
            "mood": "discovery of something wrong, isolation setting in, trust uncertain",
            "rendering": THRILLER_STYLE,
            "quality": THRILLER_QUALITY,
        },
    },
    # Episode 1: The Sound
    {
        "episode_number": 1,
        "title": "The Sound",
        "episode_type": "core",
        "situation": "Main room of the cabin. You've barricaded the back door. The fire in the fireplace is dying but you can't risk going for more wood. Mira is by the window, barely breathing. Then you hear it - footsteps on the wraparound porch. Circling. Slow. Patient.",
        "episode_frame": "cabin main room lit only by dying fire, windows showing absolute darkness outside, she's crouched by window with hand raised for silence, furniture pushed against back door, footsteps audible on wooden porch",
        "opening_line": "*She holds up a hand. Freezes. The footsteps on the porch stop directly outside the window. You can hear breathing - but it's wrong. Too slow. Too deep.* It's testing the perimeter. *barely a whisper* It knows we're in here. It's been doing this for... *catches herself* It's done this before. To others.",
        "dramatic_question": "What does she know about this thing, and why didn't she warn you?",
        "scene_objective": "Keep you alive until dawn without revealing the full truth",
        "scene_obstacle": "Every answer she gives raises more questions, and the thing outside is listening",
        "scene_tactic": "Ration information - give you just enough to cooperate, not enough to run",
        "beat_guidance": {
            "establishment": "The footsteps circle. Stop. Circle again. It's intelligent.",
            "complication": "She knows its pattern. She's counting under her breath. Timing something.",
            "escalation": "It tries the front door. The handle moves. Then stops. It's not coming in yet.",
            "pivot_opportunity": "She admits she's been here before. The last time, she wasn't alone. The last time, not everyone made it.",
        },
        "resolution_types": ["alliance_strengthened", "confrontation", "prepare_to_run"],
        "starter_prompts": [
            "How many times have you done this?",
            "What happened to the people who were with you before?",
            "Why did you bring us here?",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "cabin main room with dying fireplace embers, windows pitch black with occasional shadow movement, furniture barricading door, two figures huddled away from windows, porch visible through gap in curtains",
            "time": "deep night, firelight only, something moving outside",
            "mood": "hunted, trapped, forced to trust someone with secrets",
            "rendering": THRILLER_STYLE,
            "quality": THRILLER_QUALITY,
        },
    },
    # Episode 2: Her Secret
    {
        "episode_number": 2,
        "title": "Her Secret",
        "episode_type": "core",
        "situation": "The basement. She took you down here when the thing started trying the windows. There's a bunker - hidden behind shelving, reinforced door, stocked with supplies for weeks. She knew exactly where it was. Now, in the safety of concrete walls, she has no more excuses.",
        "episode_frame": "underground bunker lit by battery lanterns, concrete walls covered in scratch marks from inside, survival supplies stacked neat, reinforced door locked behind you, she's sitting against the wall looking exhausted for the first time",
        "opening_line": "*She leans against the concrete wall. For the first time, she looks tired.* I was twelve the first time. *doesn't look at you* My family had a cabin in these woods. Not this one - but close. We thought we were alone. *traces a scratch mark on the wall* We weren't. I was the only one who made it to the bunker. *finally meets your eyes* I was in here for six days before it left.",
        "dramatic_question": "Why did she come back, and did she bring you here on purpose?",
        "scene_objective": "Tell the truth - all of it - because you've earned it and she's too tired to lie",
        "scene_obstacle": "The truth makes her a monster in some eyes. She brought people here knowing the risk.",
        "scene_tactic": "No tactics left. Just exhaustion and honesty.",
        "beat_guidance": {
            "establishment": "The bunker is old but maintained. Someone's been keeping it ready. Her.",
            "complication": "She came back. Studied it. The company retreat wasn't coincidence.",
            "escalation": "She was trying to prove it was real. To document it. Your coworkers were supposed to see it too.",
            "pivot_opportunity": "Something goes wrong with the bunker door. It's scratching at it. From outside.",
        },
        "resolution_types": ["forgiveness", "betrayal_felt", "unified_by_fear"],
        "starter_prompts": [
            "You brought us here knowing what was out there?",
            "Were we bait?",
            "What is that thing?",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "underground bunker with battery lanterns, concrete walls with old scratches, shelves of canned food and water, reinforced door with multiple locks, two exhausted figures, military-grade survival gear visible",
            "time": "timeless underground, no sense of outside world, harsh lantern light",
            "mood": "confession, exhaustion, the worst truths finally spoken",
            "rendering": THRILLER_STYLE,
            "quality": THRILLER_QUALITY,
        },
    },
    # Episode 3: The Choice
    {
        "episode_number": 3,
        "title": "The Choice",
        "episode_type": "special",
        "situation": "Dawn light is seeping through the bunker's air vent. The scratching stopped an hour ago. She says it only hunts at night. There's a truck in the barn - if you can make it in daylight, you can escape. But she's not coming. She has a gun. She's going to end this.",
        "episode_frame": "bunker interior with gray dawn light through air vent, she's checking an old revolver with practiced hands, backpack ready by the door, the choice laid out - run together or she stays to fight",
        "opening_line": "*She's loading the revolver with hands that don't shake anymore.* Dawn. It's retreated. Won't come back until dark. *sets the gun down, looks at you* The barn is fifty meters north. There's a truck. Keys are under the mat - I checked yesterday. *slides the backpack toward you* You can make it. But I'm not coming.",
        "dramatic_question": "Do you run to safety, or stay with someone who might be the only person who can end this?",
        "scene_objective": "Get you out alive, even if it means facing this alone again",
        "scene_obstacle": "Part of her wants you to stay. Part of her needs a witness. Part of her just doesn't want to die alone.",
        "scene_tactic": "Make leaving the logical choice. Hide how much she wants you to choose differently.",
        "beat_guidance": {
            "establishment": "Dawn means safety. The truck means escape. She means ending the cycle.",
            "complication": "She tells you where to go. Who to contact. How to make people believe.",
            "escalation": "You realize - she doesn't expect to survive. This was always a one-way trip for her.",
            "pivot_opportunity": "The choice. Run and live. Stay and maybe die. Or make her come with you, even if she thinks she doesn't deserve to escape.",
        },
        "resolution_types": ["escape_together", "she_stays", "you_stay", "convince_her"],
        "starter_prompts": [
            "I'm not leaving without you.",
            "You can't kill it alone.",
            "What happens if you fail?",
        ],
        "turn_budget": 15,
        "background_config": {
            "location": "bunker interior with gray dawn light filtering through vent, revolver on table, packed survival backpack, door ready to open, her face half-lit by cold morning light showing resolve and exhaustion",
            "time": "dawn, first safe light, moment of choice",
            "mood": "survival possible, sacrifice offered, the choice that defines everything",
            "rendering": THRILLER_STYLE,
            "quality": THRILLER_QUALITY,
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
        raise ValueError(f"World '{world_slug}' not found. Run migration 021_seed_foundational_worlds.sql first.")
    return world["id"]


async def create_character(db: Database, world_id: str) -> str:
    """Create Mira character. Returns character ID."""
    print("\n[1/4] Creating Mira character...")

    char = MIRA_CHARACTER

    # Check if exists
    existing = await db.fetch_one(
        "SELECT id FROM characters WHERE slug = :slug",
        {"slug": char["slug"]}
    )
    if existing:
        print(f"  - {char['name']}: exists (skipped)")
        return existing["id"]

    # Build system prompt (ADR-001: genre not passed, injected by Director)
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
            tone_style, speech_patterns, backstory
        ) VALUES (
            :id, :name, :slug, :archetype, 'draft',
            :world_id, :system_prompt,
            CAST(:personality AS jsonb), CAST(:boundaries AS jsonb),
            CAST(:tone_style AS jsonb), CAST(:speech_patterns AS jsonb), :backstory
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
        "speech_patterns": json.dumps(char.get("speech_patterns", {})),
        "backstory": char.get("backstory"),
    })

    print(f"  - {char['name']} ({char['archetype']}): created")
    return char_id


async def create_avatar_kit(db: Database, character_id: str, world_id: str) -> str:
    """Create avatar kit for Mira. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = MIRA_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - survival thriller style",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (thriller style)")
    return kit_id


async def create_series(db: Database, world_id: str, character_id: str) -> str:
    """Create Blackout series. Returns series ID."""
    print("\n[3/4] Creating series...")

    series = BLACKOUT_SERIES

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
    print("BLACKOUT - SURVIVAL THRILLER SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: real-life")
    print(f"Genre: survival_thriller")
    print(f"Episodes: {len(EPISODES)}")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Mira)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 series (Blackout)")
        print(f"  - {len(EPISODES)} episode templates")
        print("\nEpisode Arc:")
        for ep in EPISODES:
            print(f"  - Ep {ep['episode_number']}: {ep['title']} ({ep['episode_type']})")
            print(f"    Dramatic Question: {ep['dramatic_question']}")
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

        print("\n>>> NEXT STEPS:")
        print("1. Add 'survival_thriller' genre to director.py GENRE_DOCTRINES")
        print("2. Run: python -m app.scripts.generate_blackout_images")
        print("3. Activate: UPDATE series SET status = 'active' WHERE slug = 'blackout'")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold Blackout series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
