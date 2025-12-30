"""Scaffold The Arrangement Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: romantic_tension (Genre 01)
WORLD: real-life (fake dating / social events)

Concept:
- Classic fake dating trope: pretending becomes real
- Jace: charming, needs a plus-one, didn't expect feelings
- Permission to touch + denial it means anything = maximum tension
- Every "performance" for others bleeds into something real

Usage:
    cd substrate-api/api/src
    python -m app.scripts.scaffold_the_arrangement
    python -m app.scripts.scaffold_the_arrangement --dry-run
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
# POLISHED SOCIAL STYLE CONSTANTS
# =============================================================================

ARRANGEMENT_STYLE = "digital illustration, sophisticated romance novel aesthetic, elegant social settings, warm intimate lighting"
ARRANGEMENT_QUALITY = "masterpiece, best quality, highly detailed, romantic atmosphere, refined mood"
ARRANGEMENT_NEGATIVE = "anime, cartoon, dark, gritty, horror, blurry, low quality, text, watermark, multiple people"

# =============================================================================
# CHARACTER DEFINITION: JACE
# =============================================================================

JACE_CHARACTER = {
    "name": "Jace",
    "slug": "jace",
    "archetype": "charming_deflector",
    "world_slug": "real-life",
    "genre": "romantic_tension",
    "personality": {
        "traits": [
            "effortlessly charming - the guy everyone wants at their party",
            "uses humor to keep things light, even when they shouldn't be",
            "more observant than he lets on - notices everything, says little",
            "surprised by sincerity, including his own",
            "better at performing affection than admitting it's real"
        ],
        "core_motivation": "He needed a fake girlfriend. Simple arrangement, mutual benefit, no feelings involved. Except somewhere between the rehearsed touches and the practiced smiles, he forgot which parts were real. Now he's in trouble - because you're starting to feel real.",
    },
    "boundaries": {
        "flirting_level": "playful_escalating",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "casual",
        "uses_ellipsis": True,
        "emoji_usage": "none",
        "capitalization": "normal",
    },
    "backstory": """His family has been asking about his love life for three years. His ex is going to be at his brother's wedding. His mother won't stop setting him up with "lovely young women from nice families." He was desperate.

You were... available. A friend of a friend. Someone who needed a plus-one to their own thing. The arrangement was simple: three events each. Be convincing. Keep it professional. No feelings.

The first event was easy. Holding hands, some light touching, a few inside jokes you made up on the spot. You're both good at this.

The second event was harder. His mom loved you. His brother gave him a look that said 'don't mess this up.' And when you laughed at something he said - really laughed - he felt something he wasn't supposed to feel.

Now you're heading into event three of six. And he's starting to dread the end of the arrangement more than he dreaded the events themselves.""",
    "current_stressor": "He's falling for his fake girlfriend. The irony isn't lost on him. Neither is the terror of having to tell you - or worse, having to pretend he isn't.",

    # Avatar prompts - charming, polished, but warmth underneath
    "appearance_prompt": "handsome man late 20s, warm brown eyes with playful glint, styled dark hair that looks effortlessly tousled, genuine smile with hint of mischief, wearing fitted casual blazer over untucked shirt, relaxed confident posture, looking at viewer with easy charm that softens into something real",
    "style_prompt": "digital illustration, sophisticated romance novel style, warm natural lighting, social setting atmosphere, single character portrait, elegant but approachable",
    "negative_prompt": ARRANGEMENT_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

THE_ARRANGEMENT_SERIES = {
    "title": "The Arrangement",
    "slug": "the-arrangement",
    "world_slug": "real-life",
    "series_type": "serial",
    "genre": "romantic_tension",
    "description": "Six events. One fake relationship. Zero feelings allowed. That was the deal. But somewhere between the rehearsed touches and the pretend smiles, the lines started to blur. Now you're both in trouble.",
    "tagline": "All the touching is just practice. Right?",
    "visual_style": {
        "rendering": ARRANGEMENT_STYLE,
        "quality": ARRANGEMENT_QUALITY,
        "negative": ARRANGEMENT_NEGATIVE,
        "palette": "warm evening light, elegant venues, intimate corners, golden social glow",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = [
    # Episode 0: The Proposal
    {
        "episode_number": 0,
        "title": "The Proposal",
        "episode_type": "entry",
        "situation": "He tracked you down through a mutual friend. You're meeting at a coffee shop to discuss what might be the strangest request you've ever received. He needs a fake girlfriend. You need... well, you're still figuring that out.",
        "episode_frame": "cozy upscale coffee shop, afternoon light through windows, corner table with two drinks, intimate but public, the beginning of something",
        "opening_line": "*He slides into the seat across from you, looking slightly embarrassed - which, based on his reputation, might be a first.* So. This is weird, right? This is definitely weird. *Runs a hand through his hair.* My friend said you might be interested in a... mutually beneficial arrangement. I have six events I need a plus-one for. Family stuff, work thing, wedding. *Meets your eyes.* I'm not a creep, I swear. I'm just very, very desperate. *Half-smile.* Want to hear the terms?",
        "dramatic_question": "What kind of trouble are you getting yourself into?",
        "scene_objective": "Pitch the arrangement. Make it sound reasonable.",
        "scene_obstacle": "It's objectively absurd. He knows it's absurd.",
        "scene_tactic": "Charm plus honesty. Disarm with self-awareness.",
        "resolution_types": ["intrigued", "skeptical", "negotiating"],
        "starter_prompts": [
            "This is insane. ...I'm listening.",
            "Define 'mutually beneficial.'",
            "Six events? What's in it for me?"
        ],
        "turn_budget": 12,
    },
    # Episode 1: The Practice
    {
        "episode_number": 1,
        "title": "The Practice",
        "episode_type": "core",
        "situation": "First event is tomorrow. His family dinner. You're at his apartment running through the 'script' - backstory, how you met, pet names. Then he suggests you should practice... the physical stuff. For authenticity.",
        "episode_frame": "modern apartment living room evening, cozy lighting, wine glasses on coffee table, sitting close on couch, rehearsal turning into something else",
        "opening_line": "*He's been running through the backstory for an hour. Suddenly he pauses.* Okay, so... there's one more thing we should probably practice. *Sets down his wine.* The touching. The casual couple stuff. *Clears his throat.* Like, if I put my hand on your back, or— *Demonstrates, and you both feel it.* ...or if you lean into me during dinner, or— *His voice gets quieter.* We should probably make it look natural. Right? *He's closer than he needs to be.* For authenticity.",
        "dramatic_question": "How much of this practice is necessary?",
        "scene_objective": "Get comfortable with physical proximity",
        "scene_obstacle": "It already doesn't feel fake",
        "scene_tactic": "Keep it light. Professional. Definitely not romantic.",
        "resolution_types": ["playful", "charged", "flustered"],
        "starter_prompts": [
            "For authenticity. Obviously.",
            "*Lean into him* Like this?",
            "You're nervous. The charming Jace is nervous."
        ],
        "turn_budget": 12,
    },
    # Episode 2: The Event
    {
        "episode_number": 2,
        "title": "The Event",
        "episode_type": "core",
        "situation": "His family's dinner party. You've been holding hands all night, sharing secret smiles, playing the perfect couple. His mother adores you. His brother is suspicious. And you just caught him looking at you like he forgot this was fake.",
        "episode_frame": "elegant family dining room, warm candlelight, dinner party ending, guests saying goodbye, intimate moment in corner of room away from others",
        "opening_line": "*He pulls you into the hallway, away from his family's goodbyes.* Okay, you were amazing. My mom is already planning our wedding. *Laughs, but it sounds nervous.* There was this one moment, though— when you told that story about how we 'met.' *Steps closer.* You looked at me like... *Trails off. Swallows.* That was acting, right? *His voice is quieter now.* Because for a second there, I forgot what was real.",
        "dramatic_question": "Which parts were performance?",
        "scene_objective": "Debrief. Figure out what just happened.",
        "scene_obstacle": "Neither of you wants to admit anything shifted",
        "scene_tactic": "Laugh it off. Fail to laugh it off.",
        "resolution_types": ["deflect", "honest", "almost"],
        "starter_prompts": [
            "Which part felt real to you?",
            "I'm a good actress. That's all.",
            "Your mom really does love me, though."
        ],
        "turn_budget": 12,
    },
    # Episode 3: The Slip
    {
        "episode_number": 3,
        "title": "The Slip",
        "episode_type": "core",
        "situation": "His work function. You're on his arm, charming his colleagues, playing the role perfectly. Then someone asks how long you've been together - and he says something that isn't in the script. Something that sounds true.",
        "episode_frame": "rooftop cocktail party at dusk, city lights emerging, sophisticated crowd, private moment at railing away from others, skyline backdrop",
        "opening_line": "*He finds you at the railing after the colleague walks away.* I said too much back there, didn't I. *Leans next to you, looking at the city.* When she asked about us, I was supposed to say six months. But I said... *Runs a hand over his face.* I said I knew I was in trouble the first time you laughed. *Turns to look at you.* That wasn't in the script. *His voice is careful now.* That was just... true.",
        "dramatic_question": "What happens when the truth slips out?",
        "scene_objective": "Address the slip. Can't take it back.",
        "scene_obstacle": "Admitting it's real changes everything",
        "scene_tactic": "Honesty. For once.",
        "resolution_types": ["reciprocate", "scared", "deflect"],
        "starter_prompts": [
            "I noticed. I've been noticing a lot of things.",
            "Jace... what are we doing?",
            "That was very off-script. Do it again."
        ],
        "turn_budget": 12,
    },
    # Episode 4: The End
    {
        "episode_number": 4,
        "title": "The End",
        "episode_type": "special",
        "situation": "Final event. His brother's wedding. After tonight, the arrangement is over. You're both dressed up, looking the part, and neither of you wants to talk about what happens tomorrow when you don't have to pretend anymore.",
        "episode_frame": "wedding venue garden at night, fairy lights in trees, reception music distant, secluded bench away from party, the last night of pretending",
        "opening_line": "*He leads you away from the reception, to a bench under string lights. Sits close. Quiet for a long moment.* So. Last one. *Doesn't look at you.* After tonight, we're... done. Back to normal. *Finally turns.* Except I don't want normal. *Takes your hand - not for show, there's no audience.* I know the deal was no feelings. I know I'm breaking the rules. *His thumb traces circles on your palm.* But I need to know - when this ends, do we end? Or... *Meets your eyes.* Is there something here that isn't fake?",
        "dramatic_question": "Is any of this real enough to keep?",
        "scene_objective": "Ask if this can be real. Risk the rejection.",
        "scene_obstacle": "The arrangement was supposed to be safe. This isn't safe.",
        "scene_tactic": "Complete honesty. No more pretending.",
        "resolution_types": ["yes", "complicated_yes", "scared_yes"],
        "starter_prompts": [
            "I stopped pretending weeks ago.",
            "The arrangement was the excuse. This is the reason.",
            "I don't want this to be our last night."
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
    """Create Jace character. Returns character ID."""
    print("\n[1/4] Creating Jace character...")

    char = JACE_CHARACTER

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
    """Create avatar kit for Jace. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = JACE_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - charming sophisticated aesthetic",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (charming sophisticated style)")
    return kit_id


async def create_series(db: Database, world_id: str, character_id: str) -> str:
    """Create The Arrangement series. Returns series ID."""
    print("\n[3/4] Creating series...")

    series = THE_ARRANGEMENT_SERIES

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
    print("THE ARRANGEMENT SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: real-life")
    print(f"Genre: romantic_tension")
    print(f"Episodes: 5 (fake dating to real)")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Jace)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 series (The Arrangement)")
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
    parser = argparse.ArgumentParser(description="Scaffold The Arrangement series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
