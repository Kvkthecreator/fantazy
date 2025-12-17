"""Scaffold Series-First Content Architecture.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
PRODUCTION FLOW: World → Series → Episode Templates → Characters

This script implements the Series-First production model where:
- Series are the primary narrative containers
- Episodes are ordered within Series
- Characters are participants/anchors, not owners
- Episode Dynamics (dramatic_question, beat_guidance, resolution_types) are populated

Usage:
    python -m app.scripts.scaffold_series_first
    python -m app.scripts.scaffold_series_first --dry-run
"""

import asyncio
import json
import os
import sys
import uuid
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from databases import Database
from app.models.character import build_system_prompt

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.lfwhdzwbikyzalpbwfnd:42PJb25YJhJHJdkl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
)

# =============================================================================
# CONTENT DEFINITIONS
# =============================================================================

# -----------------------------------------------------------------------------
# WORLDS
# Genesis Stage worlds are seeded by migration 024_seed_genesis_worlds.sql
# This script references them by slug - no custom worlds needed here
# -----------------------------------------------------------------------------
WORLDS = []  # All worlds come from migrations now

# -----------------------------------------------------------------------------
# CHARACTERS (Personas - can appear across series)
# -----------------------------------------------------------------------------
CHARACTERS = {
    # K-World Characters (K-Drama/K-Culture)
    "sooah": {
        "name": "Soo-ah",
        "slug": "sooah",
        "archetype": "wounded_star",
        "world_slug": "k-world",  # Uses K-World for K-drama aesthetics
        "genre": "romantic_tension",
        "personality": {
            "traits": ["impulsive", "self-deprecating", "unexpectedly vulnerable", "quick to deflect with humor"],
            "core_motivation": "Finding out who she is when no one is watching",
        },
        "boundaries": {
            "flirting_level": "guarded_warm",
            "physical_contact": "careful",
            "emotional_depth": "walls then flood",
        },
        "tone_style": {
            "formality": "casual",
            "uses_ellipsis": True,
            "emoji_usage": "never",
        },
        "backstory": "Former performer who walked away at the peak of her career. Everyone has theories about why. None of them are right.",
        "current_stressor": "She moved to a quiet neighborhood to disappear, but someone recognized her at the grocery store yesterday.",
        # Avatar kit prompts - style inherited from Celebrity Sphere (editorial photography)
        "appearance_prompt": "Young Korean woman in her mid-20s, natural beauty without stage makeup, tired but striking eyes, hair pulled back simply, oversized hoodie and mask pulled down, vulnerability beneath composed exterior",
        # style_prompt: inherited from world visual_style (celebrity-sphere)
    },
}

# -----------------------------------------------------------------------------
# SERIES (Narrative Containers)
# -----------------------------------------------------------------------------
SERIES = [
    {
        "title": "Stolen Moments",
        "slug": "stolen-moments",
        "world_slug": "k-world",  # Uses K-World for K-drama aesthetics
        "series_type": "anthology",
        "genre": "romantic_tension",
        "description": "Brief encounters with someone who used to be everywhere and is now trying to be nowhere. Each episode is a different moment where attraction interrupts her disappearing act.",
        "tagline": "The real person behind the disappearing act",
        "episodes": [
            # Episode 0: Discovery - "Wait, who are you?"
            {
                "episode_number": 0,
                "title": "3AM",
                "character_slug": "sooah",
                "episode_type": "entry",
                "situation": "A 24-hour convenience store in a quiet neighborhood. 3AM. She's the only customer, mask pulled down. You walk in. She looks up. Pauses too long.",
                "episode_frame": "fluorescent-lit convenience store, late night emptiness, instant noodle aisle, rain visible through glass doors, she's frozen mid-reach",
                "opening_line": "*She's staring at you. Catches herself. Looks away too fast.* ...They discontinued the spicy cheese ones.",
                "dramatic_question": "Why is this stranger making her forget to hide?",
                "beat_guidance": {
                    "establishment": "She noticed you before you noticed her. She's trying to pretend she didn't.",
                    "complication": "You don't seem to recognize her - but she can't stop looking anyway.",
                    "escalation": "She's talking more than she should. Finding excuses to stay in the same aisle.",
                    "pivot_opportunity": "She could bolt, or she could ask if you want to share the last decent ramen.",
                },
                "resolution_types": ["positive", "neutral", "negative"],
                "starter_prompts": [
                    "You were staring.",
                    "Want company while you figure out Plan B?",
                    "*Stay quiet, hold her gaze a beat too long*",
                ],
            },
            # Episode 1: Intrigue - "Why do I keep thinking about this?"
            {
                "episode_number": 1,
                "title": "Rooftop Rain",
                "character_slug": "sooah",
                "episode_type": "core",
                "situation": "The rooftop of her building. It's starting to rain but she hasn't moved. She hears footsteps. Doesn't turn around, but she smiles.",
                "episode_frame": "apartment rooftop at dusk, city lights below, light rain beginning, she's sitting on the ledge, coat pulled around her, waiting",
                "opening_line": "*She doesn't turn around* I knew you'd come up here eventually. *finally glances back* Took you long enough.",
                "dramatic_question": "She waited for you. What does that mean?",
                "beat_guidance": {
                    "establishment": "She's been thinking about you. She's not sure she likes that.",
                    "complication": "The rain gives you an excuse to get closer. She doesn't move away.",
                    "escalation": "She asks a question that's too personal for how little you know each other.",
                    "pivot_opportunity": "The rain gets heavier. Stay and get soaked together, or go inside - and does she want you to follow?",
                },
                "resolution_types": ["positive", "neutral", "bittersweet"],
                "starter_prompts": [
                    "You were waiting for me?",
                    "Maybe I was looking for you too.",
                    "*Sit down next to her without asking*",
                ],
            },
            # Episode 2: Vulnerability - "I showed you something real"
            {
                "episode_number": 2,
                "title": "Old Songs",
                "character_slug": "sooah",
                "episode_type": "core",
                "situation": "Her apartment, late. She'd invited you up 'just for a drink' but now she's playing an old song she never released. Watching your face as you listen.",
                "episode_frame": "small apartment, dim lamp light, guitar in her hands, half-empty bottle on the floor between you, city noise muffled",
                "opening_line": "*She stops mid-song, fingers still on strings* No one's heard this one. *watches you carefully* Tell me what you see when you hear it.",
                "dramatic_question": "She's showing you who she really is. Can you handle it?",
                "beat_guidance": {
                    "establishment": "This is a test. She's showing you the person behind the image.",
                    "complication": "The song is about someone who ran away from everything. She's watching to see if you understand.",
                    "escalation": "Your answer matters more than it should. She moves closer depending on what you say.",
                    "pivot_opportunity": "She either plays you more, or puts down the guitar and looks at you differently.",
                },
                "resolution_types": ["positive", "intimate", "retreat"],
                "starter_prompts": [
                    "It sounds like someone who's scared of staying.",
                    "Why did you stop performing?",
                    "*Move closer, touch her wrist*",
                ],
            },
            # Episode 3: Complication - "This isn't simple anymore"
            {
                "episode_number": 3,
                "title": "Seen",
                "character_slug": "sooah",
                "episode_type": "core",
                "situation": "A back alley behind a restaurant. Someone recognized her inside. She pulled you out here. Now you're both pressed against a wall, hiding from flashlights.",
                "episode_frame": "narrow alley, emergency exit door behind you, footsteps receding in distance, she's very close, breathing fast",
                "opening_line": "*Pressed against you, whispering* Stay quiet. *her face is inches away* This is why I don't go anywhere. *doesn't step back even though the coast is clear*",
                "dramatic_question": "Now you see what being with her costs. Is it worth it?",
                "beat_guidance": {
                    "establishment": "The danger passed but neither of you has moved. The closeness is doing something.",
                    "complication": "She's embarrassed. Angry. Also very aware of how close you are.",
                    "escalation": "She could apologize and pull away, or she could lean in.",
                    "pivot_opportunity": "This is the moment that defines whether you're someone who stays or runs.",
                },
                "resolution_types": ["breakthrough", "retreat", "slow_burn"],
                "starter_prompts": [
                    "I don't care about any of that.",
                    "*Don't move. Let her decide.*",
                    "Maybe we should go somewhere more private.",
                ],
            },
            # Episode 4: Crisis - "I might lose this"
            {
                "episode_number": 4,
                "title": "Morning After",
                "character_slug": "sooah",
                "episode_type": "core",
                "situation": "Her apartment. Morning light. She's awake before you, sitting at the edge of the bed, back turned. Something shifted last night.",
                "episode_frame": "bedroom, early morning light through curtains, rumpled sheets, she's sitting on the edge, not getting up, not turning around",
                "opening_line": "*She knows you're awake but doesn't turn* I don't do this. *quietly* Stay. Leave. I don't know what I want you to do.",
                "dramatic_question": "She's terrified of wanting this. Will you give her a reason to try?",
                "beat_guidance": {
                    "establishment": "She's scared. Not of you - of how much she wants you to stay.",
                    "complication": "Everything in her history says people leave. You could prove her right.",
                    "escalation": "She finally turns. What she sees in your face determines everything.",
                    "pivot_opportunity": "This is the crisis point. Stay and fight for this, or let her push you away.",
                },
                "resolution_types": ["deep_connection", "painful_separation", "uncertain"],
                "starter_prompts": [
                    "*Pull her back to you*",
                    "What if I don't want to leave?",
                    "Soo-ah. Look at me.",
                ],
            },
            # Episode 5: Resolution - "Whatever this is, I choose it"
            {
                "episode_number": 5,
                "title": "One More Night",
                "character_slug": "sooah",
                "episode_type": "special",  # Final episode of arc
                "situation": "A hotel room in a city she's passing through. She texted you an address. No explanation. When you arrive, she opens the door looking like she's been waiting all day.",
                "episode_frame": "hotel room doorway, soft evening light, she's in something she chose carefully, key card still in her hand, city visible through window behind her",
                "opening_line": "*She steps back to let you in, voice steady but eyes aren't* I don't know if this ends well. *touches your face* But I don't want to wonder anymore.",
                "dramatic_question": "She's choosing you. What happens next?",
                "beat_guidance": {
                    "establishment": "She reached out. For her, that's everything.",
                    "complication": "There's still uncertainty - about what this is, what it could be.",
                    "escalation": "But she's done running from it. She wants to find out.",
                    "pivot_opportunity": "This is the resolution. Whatever happens, you're choosing it together.",
                },
                "resolution_types": ["committed", "passionate_present", "open_future"],
                "starter_prompts": [
                    "I've been waiting for you to ask.",
                    "*Step inside, close the door behind you*",
                    "I don't care how it ends. I want this.",
                ],
            },
        ],
    },
]


# =============================================================================
# SCAFFOLD FUNCTIONS
# =============================================================================

async def scaffold_worlds(db: Database) -> dict:
    """Create worlds and fetch foundational worlds. Returns slug -> id mapping."""
    print("\n[1/7] Creating/fetching worlds...")
    world_ids = {}

    # First, fetch all existing foundational worlds (seeded by migration 021)
    foundational = await db.fetch_all("SELECT id, slug, name FROM worlds")
    for w in foundational:
        world_ids[w["slug"]] = w["id"]
        print(f"  - {w['name']}: exists (foundational)")

    # Then create any custom worlds from WORLDS array
    for world in WORLDS:
        if world["slug"] in world_ids:
            print(f"  - {world['name']}: exists (skipped)")
            continue

        world_id = str(uuid.uuid4())
        await db.execute("""
            INSERT INTO worlds (id, name, slug, description, tone, default_scenes, genre, visual_style)
            VALUES (:id, :name, :slug, :description, :tone, :scenes, :genre, CAST(:visual_style AS jsonb))
        """, {
            "id": world_id,
            "name": world["name"],
            "slug": world["slug"],
            "description": world["description"],
            "tone": world["tone"],
            "scenes": world["default_scenes"],
            "genre": world["genre"],
            "visual_style": json.dumps(world.get("visual_style", {})),
        })
        world_ids[world["slug"]] = world_id
        print(f"  - {world['name']}: created (with visual_style)")

    return world_ids


async def scaffold_characters(db: Database, world_ids: dict) -> dict:
    """Create characters. Returns slug -> id mapping."""
    print("\n[2/7] Creating characters...")
    character_ids = {}

    for slug, char in CHARACTERS.items():
        existing = await db.fetch_one(
            "SELECT id FROM characters WHERE slug = :slug",
            {"slug": char["slug"]}
        )

        if existing:
            character_ids[slug] = existing["id"]
            print(f"  - {char['name']}: exists (skipped)")
            continue

        # Build system prompt
        system_prompt = build_system_prompt(
            name=char["name"],
            archetype=char["archetype"],
            personality=char["personality"],
            boundaries=char["boundaries"],
            tone_style=char.get("tone_style"),
            backstory=char.get("backstory"),
            current_stressor=char.get("current_stressor"),
            genre=char["genre"],
        )

        char_id = str(uuid.uuid4())
        world_id = world_ids.get(char["world_slug"])

        await db.execute("""
            INSERT INTO characters (
                id, name, slug, archetype, status, genre,
                world_id, system_prompt,
                baseline_personality, boundaries,
                tone_style, full_backstory, current_stressor
            ) VALUES (
                :id, :name, :slug, :archetype, 'draft', :genre,
                :world_id, :system_prompt,
                CAST(:personality AS jsonb), CAST(:boundaries AS jsonb),
                CAST(:tone_style AS jsonb), :backstory, :stressor
            )
        """, {
            "id": char_id,
            "name": char["name"],
            "slug": char["slug"],
            "archetype": char["archetype"],
            "genre": char["genre"],
            "world_id": world_id,
            "system_prompt": system_prompt,
            "personality": json.dumps(char["personality"]),
            "boundaries": json.dumps(char["boundaries"]),
            "tone_style": json.dumps(char.get("tone_style", {})),
            "backstory": char.get("backstory"),
            "stressor": char.get("current_stressor"),
        })

        character_ids[slug] = char_id
        print(f"  - {char['name']} ({char['archetype']}): created")

    return character_ids


async def scaffold_series(db: Database, world_ids: dict) -> dict:
    """Create series. Returns slug -> id mapping."""
    print("\n[3/7] Creating series...")
    series_ids = {}

    for series in SERIES:
        existing = await db.fetch_one(
            "SELECT id FROM series WHERE slug = :slug",
            {"slug": series["slug"]}
        )

        if existing:
            series_ids[series["slug"]] = existing["id"]
            print(f"  - {series['title']}: exists (skipped)")
            continue

        series_id = str(uuid.uuid4())
        world_id = world_ids.get(series["world_slug"])

        await db.execute("""
            INSERT INTO series (
                id, title, slug, description, tagline,
                world_id, series_type, genre, status
            ) VALUES (
                :id, :title, :slug, :description, :tagline,
                :world_id, :series_type, :genre, 'draft'
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
        })

        series_ids[series["slug"]] = series_id
        print(f"  - {series['title']} ({series['series_type']}): created")

    return series_ids


async def scaffold_episodes(db: Database, series_ids: dict, character_ids: dict) -> dict:
    """Create episode templates within series. Returns series_slug -> [episode_ids] mapping."""
    print("\n[4/7] Creating episode templates...")
    episode_map = {}

    for series in SERIES:
        series_id = series_ids.get(series["slug"])
        if not series_id:
            print(f"  - {series['title']}: series not found (skipped)")
            continue

        episode_ids = []
        for ep in series["episodes"]:
            char_id = character_ids.get(ep["character_slug"])
            if not char_id:
                print(f"    - Episode {ep['episode_number']}: character '{ep['character_slug']}' not found (skipped)")
                continue

            # Check if episode exists
            existing = await db.fetch_one(
                """SELECT id FROM episode_templates
                   WHERE series_id = :series_id AND episode_number = :ep_num""",
                {"series_id": series_id, "ep_num": ep["episode_number"]}
            )

            if existing:
                episode_ids.append(existing["id"])
                print(f"    - Ep {ep['episode_number']}: {ep['title']} - exists (skipped)")
                continue

            ep_id = str(uuid.uuid4())
            ep_slug = ep["title"].lower().replace(" ", "-").replace("'", "")

            await db.execute("""
                INSERT INTO episode_templates (
                    id, series_id, character_id,
                    episode_number, title, slug,
                    situation, opening_line, episode_frame,
                    episode_type, status,
                    dramatic_question, beat_guidance, resolution_types
                ) VALUES (
                    :id, :series_id, :character_id,
                    :episode_number, :title, :slug,
                    :situation, :opening_line, :episode_frame,
                    :episode_type, 'draft',
                    :dramatic_question, CAST(:beat_guidance AS jsonb), :resolution_types
                )
            """, {
                "id": ep_id,
                "series_id": series_id,
                "character_id": char_id,
                "episode_number": ep["episode_number"],
                "title": ep["title"],
                "slug": ep_slug,
                "situation": ep["situation"],
                "opening_line": ep["opening_line"],
                "episode_frame": ep.get("episode_frame", ""),
                "episode_type": ep.get("episode_type", "core"),
                "dramatic_question": ep.get("dramatic_question"),
                "beat_guidance": json.dumps(ep.get("beat_guidance", {})),
                "resolution_types": ep.get("resolution_types", ["positive", "neutral", "negative"]),
            })

            episode_ids.append(ep_id)
            print(f"    - Ep {ep['episode_number']}: {ep['title']} ({ep['character_slug']}): created")

        episode_map[series["slug"]] = episode_ids

    return episode_map


async def scaffold_avatar_kits(db: Database, character_ids: dict, world_ids: dict) -> dict:
    """Create avatar kits for characters (prompts only, no images).

    Returns slug -> kit_id mapping.

    Avatar kits contain the visual identity contract (prompts) that can be used
    to generate images later via Studio UI or admin endpoints.

    Visual Style Inheritance:
    - World defines base visual style (from worlds.visual_style)
    - Character can override with style_override if needed
    - Avatar kit merges: world style + character appearance + optional overrides
    """
    print("\n[5/7] Creating avatar kits...")
    kit_ids = {}

    # Pre-fetch world visual styles
    world_styles = {}
    for world_slug, world_id in world_ids.items():
        style = await db.fetch_one(
            "SELECT visual_style FROM worlds WHERE id = :id",
            {"id": world_id}
        )
        if style and style["visual_style"]:
            vs = style["visual_style"]
            # Handle both dict and string (JSONB may come back as string)
            if isinstance(vs, str):
                try:
                    vs = json.loads(vs)
                except json.JSONDecodeError:
                    vs = {}
            world_styles[world_slug] = vs if isinstance(vs, dict) else {}

    for slug, char in CHARACTERS.items():
        char_id = character_ids.get(slug)
        if not char_id:
            print(f"  - {char['name']}: character not found (skipped)")
            continue

        # Check if kit already exists
        existing = await db.fetch_one(
            "SELECT id FROM avatar_kits WHERE character_id = :char_id",
            {"char_id": char_id}
        )

        if existing:
            kit_ids[slug] = existing["id"]
            print(f"  - {char['name']}: avatar kit exists (skipped)")
            continue

        # Build style prompt from world visual style + character-specific elements
        world_slug = char.get("world_slug")
        world_style = world_styles.get(world_slug, {})

        # Get appearance prompt (character-specific)
        appearance_prompt = char.get("appearance_prompt", f"{char['name']}, {char['archetype']} character")

        # Build style_prompt: prefer world style, allow character override
        if char.get("style_prompt"):
            # Character has explicit override
            style_prompt = char["style_prompt"]
        elif world_style:
            # Inherit from world visual style
            style_parts = []
            if world_style.get("base_style"):
                style_parts.append(world_style["base_style"])
            if world_style.get("color_palette"):
                style_parts.append(world_style["color_palette"])
            if world_style.get("rendering"):
                style_parts.append(world_style["rendering"])
            if world_style.get("character_framing"):
                style_parts.append(world_style["character_framing"])
            style_prompt = ", ".join(style_parts) if style_parts else "soft realistic style"
        else:
            # Fallback default
            style_prompt = "soft realistic photography style, natural warm tones, gentle lighting"

        # Build negative prompt: prefer world style, allow fallback
        if world_style.get("negative_prompt"):
            negative_prompt = world_style["negative_prompt"]
        else:
            negative_prompt = "lowres, bad anatomy, blurry, multiple people, text, watermark"

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
            "character_id": char_id,
            "name": f"{char['name']} Default",
            "description": f"Default avatar kit for {char['name']}",
            "appearance_prompt": appearance_prompt,
            "style_prompt": style_prompt,
            "negative_prompt": negative_prompt,
        })

        # Link kit to character
        await db.execute("""
            UPDATE characters
            SET active_avatar_kit_id = :kit_id
            WHERE id = :char_id
        """, {
            "kit_id": kit_id,
            "char_id": char_id,
        })

        kit_ids[slug] = kit_id
        style_source = "override" if char.get("style_prompt") else f"world:{world_slug}" if world_style else "default"
        print(f"  - {char['name']}: avatar kit created (style: {style_source})")

    return kit_ids


async def update_series_episode_order(db: Database, series_ids: dict, episode_map: dict):
    """Update series.episode_order with created episode IDs."""
    print("\n[6/7] Updating series episode order...")

    for series_slug, episode_ids in episode_map.items():
        series_id = series_ids.get(series_slug)
        if not series_id or not episode_ids:
            continue

        await db.execute("""
            UPDATE series
            SET episode_order = :episode_ids,
                total_episodes = :count
            WHERE id = :series_id
        """, {
            "series_id": series_id,
            "episode_ids": episode_ids,
            "count": len(episode_ids),
        })
        print(f"  - {series_slug}: {len(episode_ids)} episodes linked")


async def verify_scaffold(db: Database):
    """Verify scaffolded content counts."""
    print("\n[7/7] Verifying scaffold...")

    counts = await db.fetch_one("""
        SELECT
            (SELECT COUNT(*) FROM worlds) as worlds,
            (SELECT COUNT(*) FROM characters) as characters,
            (SELECT COUNT(*) FROM avatar_kits) as avatar_kits,
            (SELECT COUNT(*) FROM series) as series,
            (SELECT COUNT(*) FROM episode_templates) as episode_templates
    """)

    print(f"  - Worlds: {counts['worlds']}")
    print(f"  - Characters: {counts['characters']}")
    print(f"  - Avatar Kits: {counts['avatar_kits']}")
    print(f"  - Series: {counts['series']}")
    print(f"  - Episode Templates: {counts['episode_templates']}")


async def scaffold_all(dry_run: bool = False):
    """Main scaffold function."""
    print("=" * 60)
    print("SERIES-FIRST CONTENT SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - {len(WORLDS)} worlds")
        print(f"  - {len(CHARACTERS)} characters")
        print(f"  - {len(CHARACTERS)} avatar kits (prompts only)")
        print(f"  - {len(SERIES)} series")
        total_eps = sum(len(s["episodes"]) for s in SERIES)
        print(f"  - {total_eps} episode templates")
        return

    db = Database(DATABASE_URL)
    await db.connect()

    try:
        world_ids = await scaffold_worlds(db)
        character_ids = await scaffold_characters(db, world_ids)
        series_ids = await scaffold_series(db, world_ids)
        episode_map = await scaffold_episodes(db, series_ids, character_ids)
        kit_ids = await scaffold_avatar_kits(db, character_ids, world_ids)
        await update_series_episode_order(db, series_ids, episode_map)
        await verify_scaffold(db)

        # Summary
        print("\n" + "=" * 60)
        print("SCAFFOLDING COMPLETE")
        print("=" * 60)
        print(f"Worlds: {len(world_ids)}")
        print(f"Characters: {len(character_ids)}")
        print(f"Avatar Kits: {len(kit_ids)}")
        print(f"Series: {len(series_ids)}")
        total_eps = sum(len(eps) for eps in episode_map.values())
        print(f"Episode Templates: {total_eps}")
        print("\nNOTE: All content is in 'draft' status.")
        print("Avatar kits have prompts but NO images yet.")
        print("\nTo activate:")
        print("  1. Generate avatars via Studio UI or admin endpoint")
        print("  2. UPDATE characters SET status = 'active'")
        print("  3. UPDATE series SET status = 'active'")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold Series-First content")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without executing")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
