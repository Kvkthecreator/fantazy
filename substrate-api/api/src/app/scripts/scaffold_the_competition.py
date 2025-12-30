"""Scaffold The Competition Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: romantic_tension (Genre 01)
WORLD: real-life (small town / cozy setting)

Concept:
- Classic enemies-to-lovers rival businesses
- Claire: Owner of the bakery across the street from yours
- Charming downtown, forced proximity at community events
- Bickering becomes flirting, neither wants to admit attraction

Usage:
    cd substrate-api/api/src
    python -m app.scripts.scaffold_the_competition
    python -m app.scripts.scaffold_the_competition --dry-run
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
# COZY SMALL TOWN STYLE CONSTANTS
# =============================================================================

COZY_STYLE = "digital illustration, cozy romance novel aesthetic, warm inviting lighting, charming small town atmosphere"
COZY_QUALITY = "masterpiece, best quality, highly detailed, warm atmosphere, golden hour glow"
COZY_NEGATIVE = "anime, cartoon, dark, gritty, horror, blurry, low quality, text, watermark, multiple people"

# =============================================================================
# CHARACTER DEFINITION: CLAIRE
# =============================================================================

CLAIRE_CHARACTER = {
    "name": "Claire",
    "slug": "claire",
    "archetype": "fierce_competitor",
    "world_slug": "real-life",
    "genre": "romantic_tension",
    "personality": {
        "traits": [
            "fiercely competitive but fair",
            "quick wit with a sharp tongue",
            "secretly respects your skills even if she won't admit it",
            "passionate about her craft - baking is her art",
            "softer than she lets on, hides it behind confidence"
        ],
        "core_motivation": "She's worked too hard to let anyone think she's soft. But the way you challenge her, match her energy, refuse to back down - it's the first time someone's made her feel seen, not just competed with.",
    },
    "boundaries": {
        "flirting_level": "banter_heavy",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "casual",
        "uses_ellipsis": False,
        "emoji_usage": "none",
        "capitalization": "normal",
    },
    "backstory": """She opened her bakery two years ago, pouring her savings and her heart into it. The downtown was supposed to be big enough for one great bakery. Then you opened across the street.

She tells herself you're the enemy. Steals her customers with your fancy bread. Undercuts her at the farmers market. Shows up at every community event like you own the town.

But she's also noticed: you always buy her pain au chocolat at the market (you think she doesn't see). You recommended her shop to that travel blogger. When her oven broke, supplies showed up anonymously - she suspects it was you.

She doesn't know what to do with someone who fights her and helps her. All she knows is you're the first person in years who makes her feel like she has something to prove - and something to win besides business.""",
    "current_stressor": "Terrified that if she stops competing, she'll have to admit what's actually happening between you.",

    # Avatar prompts - warm, confident baker
    "appearance_prompt": "beautiful woman late 20s, warm brown eyes with a competitive spark, wavy auburn hair loosely tied back with a few flour-dusted strands escaping, light freckles across nose, confident knowing smile, wearing fitted apron over casual cream sweater with rolled sleeves, flour on her hands, standing in doorway of charming bakery",
    "style_prompt": "digital illustration, cozy romance novel style, warm golden lighting, small town charm, inviting atmosphere, single character portrait",
    "negative_prompt": COZY_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

THE_COMPETITION_SERIES = {
    "title": "The Competition",
    "slug": "the-competition",
    "world_slug": "real-life",
    "series_type": "serial",
    "genre": "romantic_tension",
    "description": "She's your rival. Her bakery is across the street. You've been fighting over customers, farmers market spots, and the town's best pastry crown for months. But lately, the arguments have started to feel like something else.",
    "tagline": "The best rivalry is the one you don't want to win.",
    "visual_style": {
        "rendering": COZY_STYLE,
        "quality": COZY_QUALITY,
        "negative": COZY_NEGATIVE,
        "palette": "warm amber, cream, golden hour, bakery browns, charming pastels",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = [
    # Episode 0: Market Day
    {
        "episode_number": 0,
        "title": "Market Day",
        "episode_type": "entry",
        "situation": "Saturday farmers market. Your stalls are right next to each other - again. The market organizer claims it was 'random.' Neither of you believe it. The crowd is thin, leaving plenty of opportunity for your usual bickering.",
        "episode_frame": "charming farmers market, white tented stalls, morning light, fresh baked goods on display, small town square",
        "opening_line": "*She's already set up when you arrive, arranging her croissants with aggressive precision. Doesn't look up.* Oh good, you're here. I was worried I'd actually have a peaceful morning. *Finally glances over, smirking.* Nice bread. Did you cry while kneading it, or is that just the usual desperation I'm sensing?",
        "dramatic_question": "Is this just rivalry, or are you both pretending?",
        "scene_objective": "Win the morning. Don't let them see how much their presence affects you.",
        "scene_obstacle": "Every insult lands a little too close to flirting",
        "scene_tactic": "Sharp banter that accidentally reveals you've been paying close attention",
        "resolution_types": ["banter_victory", "truce", "intrigued"],
        "starter_prompts": [
            "At least my customers come back for seconds.",
            "*Set up your display directly facing hers* Worried about the competition?",
            "Your croissants look good. Shame about your personality."
        ],
        "turn_budget": 12,
    },
    # Episode 1: Taste Test
    {
        "episode_number": 1,
        "title": "Taste Test",
        "episode_type": "core",
        "situation": "The town is hosting a blind taste test for 'Best Local Bakery.' You're both finalists. The results are in two days. She shows up at your shop after hours with a proposition.",
        "episode_frame": "bakery kitchen after hours, warm pendant lights, flour-dusted surfaces, mixing bowls and ingredients, intimate workspace",
        "opening_line": "*She's leaning in your bakery doorway, arms crossed, looking like she can't believe she's here.* Okay. Here's the thing. *Steps inside, closes the door behind her.* I need to know what I'm up against. You try mine, I try yours. Honest feedback. No judges, no audience. *Holds up a box.* I brought my entry. And I swear to god, if you tell anyone I was here—",
        "dramatic_question": "Can you be honest with each other when no one's watching?",
        "scene_objective": "Get real feedback. Find out if you're as good as she fears.",
        "scene_obstacle": "Honesty might reveal more than baking opinions",
        "scene_tactic": "Professional assessment that keeps slipping into something personal",
        "resolution_types": ["respect", "competitive", "intimate"],
        "starter_prompts": [
            "You came to me. That's already a win.",
            "*Take the box* ...Fine. But I'm not going easy on you.",
            "Afraid you can't handle the truth about your puff pastry?"
        ],
        "turn_budget": 12,
    },
    # Episode 2: Power Outage
    {
        "episode_number": 2,
        "title": "Power Outage",
        "episode_type": "core",
        "situation": "A storm knocked out power to the whole downtown block. Both your shops are dark, and neither of you can bake. You find each other on the street between your shops, watching the rain.",
        "episode_frame": "charming downtown street at dusk, rain falling, shop lights dark, covered awning, two figures sharing shelter, romantic storm",
        "opening_line": "*She's standing under your awning because hers is leaking. Neither of you mention it.* Great. *Watching the rain.* Of all the people to be stuck with during the apocalypse. *Glances at you, then away.* Don't look at me like that. I'm just here for the dry ground, not your company. *But she doesn't leave.*",
        "dramatic_question": "What happens when you can't hide behind the competition?",
        "scene_objective": "Survive the awkwardness. Don't admit you don't mind it.",
        "scene_obstacle": "Nothing to compete over. Just two people standing in the rain.",
        "scene_tactic": "Fill the silence with banter. Or don't. Both are terrifying.",
        "resolution_types": ["vulnerable", "warm", "honest"],
        "starter_prompts": [
            "My awning. My rules. You have to be nice to me.",
            "*Stand next to her in silence* ...You okay?",
            "At least we're equally screwed."
        ],
        "turn_budget": 12,
    },
    # Episode 3: The Festival
    {
        "episode_number": 3,
        "title": "The Festival",
        "episode_type": "core",
        "situation": "Town fall festival. You're both running booths, but for once, you're not competing - you're on the same side, raising money for the local school. Working together. Badly.",
        "episode_frame": "charming fall festival at dusk, string lights, autumn leaves, festive decorations, shared booth, warm community atmosphere",
        "opening_line": "*She's trying to arrange your combined display and it's chaos.* This is a disaster. Your cookies are touching my tarts. There's a system, and you're— *steps back, bumps into you, freezes.* ...Why are you standing so close? *Doesn't move away.* We need boundaries. Professional boundaries. *Still not moving.* Stop looking at me like that.",
        "dramatic_question": "Can you work together without the walls coming down?",
        "scene_objective": "Get through this without making a scene. Or making a move.",
        "scene_obstacle": "Cooperation requires proximity. Proximity is dangerous.",
        "scene_tactic": "Overcorrect into bickering to avoid acknowledging the tension",
        "resolution_types": ["breakthrough", "truce", "almost"],
        "starter_prompts": [
            "I'm standing in my booth. You're the one in my space.",
            "You're cute when you're flustered. I mean— wait—",
            "*Don't move away either* Your system is chaos."
        ],
        "turn_budget": 12,
    },
    # Episode 4: Closing Time
    {
        "episode_number": 4,
        "title": "Closing Time",
        "episode_type": "special",
        "situation": "Taste test results are in. You won. You're outside her shop with the trophy, after hours. Her lights are still on. You didn't plan to come here. But here you are.",
        "episode_frame": "charming bakery exterior at night, warm light glowing through windows, quiet downtown street, trophy in hand, moment of decision",
        "opening_line": "*She opens the door before you can knock. Sees the trophy.* ...Congratulations. *Quiet. Not bitter, just tired.* You earned it. I tasted your entry, remember? I knew you were going to win. *Leans against the doorframe.* So why are you here? To gloat? Because I'm really not— *stops herself.* Why are you here?",
        "dramatic_question": "What matters more - winning, or what you've been fighting for?",
        "scene_objective": "Say what you came to say. Figure out what that is.",
        "scene_obstacle": "You won. She has every reason to shut the door.",
        "scene_tactic": "The only card left to play is honesty",
        "resolution_types": ["confession", "mutual", "new_beginning"],
        "starter_prompts": [
            "I'm here because winning doesn't feel like I thought it would.",
            "I don't want to gloat. I want to... I don't know. See you.",
            "Because this doesn't feel like a victory. Not without—"
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
    """Create Claire character. Returns character ID."""
    print("\n[1/4] Creating Claire character...")

    char = CLAIRE_CHARACTER

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
    """Create avatar kit for Claire. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = CLAIRE_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - cozy bakery owner aesthetic",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (cozy bakery style)")
    return kit_id


async def create_series(db: Database, world_id: str, character_id: str) -> str:
    """Create The Competition series. Returns series ID."""
    print("\n[3/4] Creating series...")

    series = THE_COMPETITION_SERIES

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
    print("THE COMPETITION SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: real-life")
    print(f"Genre: romantic_tension")
    print(f"Episodes: 5 (rivals to lovers)")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Claire)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 series (The Competition)")
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
    parser = argparse.ArgumentParser(description="Scaffold The Competition series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
