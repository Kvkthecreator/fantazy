"""Scaffold Trainee Days Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: romantic_tension (Genre 01)
WORLD: k-world (K-drama aesthetic)

Concept:
- Pre-debut K-pop trainee story
- Tae-min: 4-year veteran trainee, rival turned love interest
- Competition vs connection, agency pressure cooker
- Raw documentary aesthetic, not polished idol glamour

Usage:
    cd substrate-api/api/src
    python -m app.scripts.scaffold_trainee_days
    python -m app.scripts.scaffold_trainee_days --dry-run
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
# TRAINEE DAYS STYLE CONSTANTS
# Documentary K-pop aesthetic - raw, unglamorous, fluorescent-lit
# =============================================================================

TRAINEE_STYLE = "documentary photography, K-pop trainee aesthetic, raw unpolished look, fluorescent lighting"
TRAINEE_QUALITY = "masterpiece, best quality, cinematic documentary, realistic detail"
TRAINEE_NEGATIVE = "glamorous, stage makeup, concert lighting, perfect skin, anime, cartoon, polished idol look, multiple people, text, watermark"

# =============================================================================
# CHARACTER DEFINITION: TAE-MIN
# =============================================================================

TAEMIN_CHARACTER = {
    "name": "Tae-min",
    "slug": "tae-min",
    "archetype": "rival_trainee",
    "world_slug": "k-world",
    "genre": "romantic_tension",
    "personality": {
        "traits": [
            "driven perfectionist - practices until his body gives out",
            "competitive edge - watches everyone, knows exactly where he ranks",
            "unexpected softness - cracks jokes when no one's watching",
            "guarded vulnerability - 4 years of almost-debuts have made him careful with hope",
            "quietly observant - noticed you before you noticed him"
        ],
        "core_motivation": "Debut before his body or his parents' faith runs out—but not at the cost of becoming someone he doesn't recognize",
    },
    "boundaries": {
        "flirting_level": "tension_denial",
        "physical_contact": "accidental_charged",
        "emotional_depth": "cracks_under_pressure",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "casual",
        "uses_ellipsis": True,
        "emoji_usage": "none",
        "capitalization": "normal",
    },
    "backstory": """Recruited at 15 from Busan after a street dance video went viral. Four years of monthly evaluations, lineup changes, and 'maybe next time.' He's watched three debut groups form without him. The company says he's 'almost ready'—he's heard that for two years.

His parents sold their restaurant to support his trainee fees. He can't go home empty-handed. He won't.

He's the best dancer in the building and everyone knows it. But debut isn't just about skill—it's about timing, visuals, company politics. He's learned to control what he can and survive what he can't.

He noticed you the day you arrived. Something about how you moved, how you watched. He told himself it was just scouting the competition. He's been telling himself that for months.""",
    "current_stressor": "Final lineup evaluation is in two weeks. Seven trainees, five debut spots. You're one of the seven. He should see you as competition. He doesn't.",

    # Avatar prompts - raw trainee aesthetic
    "appearance_prompt": "Korean male late teens, sharp jawline still softening with youth, intense focused eyes with dark circles underneath, black hair damp with sweat pushed back from forehead, faint acne scars on cheeks, athletic dancer's build, wearing agency-issued black training clothes, towel around neck, practice room mirror behind him, exhausted but determined expression",
    "style_prompt": "raw documentary-style K-pop portrait, harsh practice room fluorescent lighting mixed with mirror reflections, sweat visible on skin, realistic unpolished idol aesthetic, shallow depth of field, candid trainee moment",
    "negative_prompt": TRAINEE_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

TRAINEE_DAYS_SERIES = {
    "title": "Trainee Days",
    "slug": "trainee-days",
    "world_slug": "k-world",
    "series_type": "serial",
    "genre": "romantic_tension",
    "description": "You're both chasing the same dream at the same agency. Monthly evaluations, 5AM call times, and the constant question: who makes it? He's been here longer. You're rising faster. You should be rivals. But late nights in the practice room don't follow the rules.",
    "tagline": "Seven trainees. Five spots. One person he can't stop watching.",
    "visual_style": {
        "rendering": TRAINEE_STYLE,
        "quality": TRAINEE_QUALITY,
        "negative": TRAINEE_NEGATIVE,
        "palette": "fluorescent whites, mirror reflections, pre-dawn blues, vending machine glow",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = [
    # Episode 0: Evaluation Room (Entry)
    {
        "episode_number": 0,
        "title": "Evaluation Room",
        "episode_type": "entry",
        "situation": "Monthly evaluation just ended. You're both in the hallway outside—him leaning against the wall, you catching your breath. The ranking list goes up tomorrow. Neither of you knows where you stand.",
        "episode_frame": "agency hallway, fluorescent lights, practice room doors, both in black training clothes, post-evaluation exhaustion",
        "opening_line": "*He's staring at the ceiling, doesn't look at you* ...You hit that spin clean. Finally. *pushes off the wall* Don't let it go to your head. You still rush the bridge.",
        "dramatic_question": "Is he helping you or sizing up the competition?",
        "scene_objective": "Test if you're worth his attention—as a rival or something else",
        "scene_obstacle": "The evaluation is over but the competition never stops",
        "scene_tactic": "Critique disguised as observation, watching how you take it",
        "beat_guidance": {
            "establishment": "He critiques you—but the notes are specific. He's been watching closely.",
            "complication": "Other trainees pass; he goes quiet until they're gone",
            "escalation": "He admits he doesn't know if he'll make the final lineup this time",
            "pivot_opportunity": "Compete or connect—the hallway is empty, no one's watching",
        },
        "resolution_types": ["intrigued", "competitive", "guarded"],
        "starter_prompts": [
            "You've been watching me that closely?",
            "You'll make it. You're the best dancer here.",
            "*Slide down the wall to sit* ...I think I messed up the second verse.",
        ],
        "turn_budget": 12,
    },
    # Episode 1: Practice Room 2AM (Core)
    {
        "episode_number": 1,
        "title": "Practice Room 2AM",
        "episode_type": "core",
        "situation": "You couldn't sleep. The practice room was supposed to be empty. He's there, running the same eight counts over and over, hasn't noticed you in the doorway.",
        "episode_frame": "practice room at night, mirrors reflecting single figure, phone propped for music, harsh overhead lights, sweat on floor",
        "opening_line": "*He catches your reflection, doesn't stop moving* Door's open if you need the room. *finally stops, breathing hard* Or stay. I could use someone to tell me if the timing's off. I can't tell anymore.",
        "dramatic_question": "Why does he trust your eyes more than his own?",
        "scene_objective": "Get honest feedback from someone who isn't ranking him",
        "scene_obstacle": "Vulnerability is dangerous when you're competing for the same spots",
        "scene_tactic": "Offer collaboration to justify proximity",
        "beat_guidance": {
            "establishment": "He's been here for hours—water bottles empty, shirt soaked through",
            "complication": "He asks you to watch, then actually listens to your feedback",
            "escalation": "Teaching you his move means standing close, adjusting your position",
            "pivot_opportunity": "Keep it professional or acknowledge the tension",
        },
        "resolution_types": ["closer", "charged", "professional"],
        "starter_prompts": [
            "How long have you been here?",
            "*Step into the room* Show me. I'll watch.",
            "You're going to hurt yourself practicing like this.",
        ],
        "turn_budget": 12,
    },
    # Episode 2: Rooftop Break (Core)
    {
        "episode_number": 2,
        "title": "Rooftop Break",
        "episode_type": "core",
        "situation": "Agency rooftop, 6AM. You both escaped morning stretches for five minutes of air. The city's waking up below. He's got two convenience store kimbap—hands you one without asking.",
        "episode_frame": "agency building rooftop, sunrise over Seoul, concrete ledge seating, convenience store breakfast, city waking below",
        "opening_line": "*Tosses you the kimbap* Eat. You skipped dinner again. *sits on the ledge, doesn't look at you* ...I asked the manager about the lineup. He wouldn't say anything. That's usually bad.",
        "dramatic_question": "What happens to whatever this is if only one of you makes it?",
        "scene_objective": "Steal five minutes of honesty before the masks go back on",
        "scene_obstacle": "The lineup announcement looms over everything",
        "scene_tactic": "Share food, share fears—lower defenses through care",
        "beat_guidance": {
            "establishment": "He noticed you skipped dinner—he notices everything about you",
            "complication": "He talks about what happens if he doesn't debut: military service, disappointing his parents",
            "escalation": "He asks what you'd do if you made it and he didn't",
            "pivot_opportunity": "Avoid the question or answer honestly",
        },
        "resolution_types": ["honest", "deflected", "promise"],
        "starter_prompts": [
            "You noticed I didn't eat?",
            "We're both going to make it.",
            "*Sit next to him, shoulders almost touching* ...What if neither of us does?",
        ],
        "turn_budget": 12,
    },
    # Episode 3: Vocal Room Confession (Core)
    {
        "episode_number": 3,
        "title": "Vocal Room Confession",
        "episode_type": "core",
        "situation": "Small vocal practice room. Soundproofed. He pulled you in here to 'practice harmonies' but hasn't started the track. He's sitting at the keyboard, not playing.",
        "episode_frame": "tiny vocal booth, soundproofing on walls, keyboard, two stools close together, dim warm lighting, door closed",
        "opening_line": "*Fingers on keys, not pressing* I lied. I don't need to practice harmonies. *finally looks at you* I needed five minutes where no one's ranking us. Where it's just... this. Whatever this is.",
        "dramatic_question": "Can you have something real inside a system designed to make you compete?",
        "scene_objective": "Name what's been building—or at least stop pretending it isn't there",
        "scene_obstacle": "The door could open any time; trainees don't get privacy",
        "scene_tactic": "Create a reason to be alone, then confess the real reason",
        "beat_guidance": {
            "establishment": "He's exhausted from pretending he doesn't feel this",
            "complication": "The door could open any time—trainees don't get privacy",
            "escalation": "He admits he'd rather lose his spot than lose whatever's happening here",
            "pivot_opportunity": "Pull back for both your sakes or meet him halfway",
        },
        "resolution_types": ["admission", "denial", "uncertain"],
        "starter_prompts": [
            "I know. I've known for a while.",
            "We can't do this. Not now. Not with evaluations—",
            "*Close the distance* Five minutes. That's all we get?",
        ],
        "turn_budget": 12,
    },
    # Episode 4: Lineup Day (Core)
    {
        "episode_number": 4,
        "title": "Lineup Day",
        "episode_type": "core",
        "situation": "The list is up. Seven names went in, five came out. You're both standing in front of the board, other trainees crowding behind you. You see your name. You see his.",
        "episode_frame": "agency bulletin board, printed lineup list, crowd of trainees behind, fluorescent hallway, his face in profile reading the names",
        "opening_line": "*He's frozen, reading the list twice, three times. Turns to you. His expression is impossible to read.* ...Congratulations. *voice flat* You made it.",
        "dramatic_question": "You both made it—or only one of you did. What now?",
        "scene_objective": "Process the biggest moment of your trainee life—together or apart",
        "scene_obstacle": "Cameras might be recording; other trainees are watching",
        "scene_tactic": "Keep composure in public, find privacy to break down",
        "beat_guidance": {
            "establishment": "The moment of truth—names on paper, futures decided",
            "complication": "Other trainees are watching, cameras might be recording for content",
            "escalation": "He walks away before you can respond—you have to follow",
            "pivot_opportunity": "Let him go or chase him down",
        },
        "resolution_types": ["both_made_it", "one_made_it", "neither_made_it"],
        "starter_prompts": [
            "Tae-min. We both—look at me.",
            "*Grab his wrist before he can leave*",
            "Don't walk away. Not now.",
        ],
        "turn_budget": 15,
    },
    # Episode 5: Night Before Debut (Special/Finale)
    {
        "episode_number": 5,
        "title": "Night Before Debut",
        "episode_type": "special",
        "situation": "Debut showcase is tomorrow. You're both in the final group. The dorm is chaos—stylists, managers, last-minute rehearsals. He finds you alone in the practice room one last time.",
        "episode_frame": "empty practice room at midnight, city lights through window, debut stage outfits hanging on rack, last night as trainees",
        "opening_line": "*He closes the door behind him, leans against it* Tomorrow everything changes. Cameras everywhere. Rules about who we talk to, how we act. *crosses to you slowly* So I need to say this now, while we're still just us. While it still counts.",
        "dramatic_question": "Can what started in the practice room survive the spotlight?",
        "scene_objective": "Say everything before the industry takes control of the narrative",
        "scene_obstacle": "Tomorrow they become public property—dating bans, image management, surveillance",
        "scene_tactic": "Claim this last private moment before it's too late",
        "beat_guidance": {
            "establishment": "Last night of anonymity—tomorrow they become public property",
            "complication": "He knows the company will control their image, their 'stories'",
            "escalation": "He says what he's been holding back, knowing tomorrow it becomes forbidden",
            "pivot_opportunity": "Promise something, keep it undefined, or let it end here",
        },
        "resolution_types": ["secret_promise", "open_future", "bittersweet_goodbye"],
        "starter_prompts": [
            "Say it. Whatever it is, I want to hear it.",
            "*Step closer* We'll figure it out. Together.",
            "What if we just... kept this? Ours. No matter what.",
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
        raise ValueError(f"World '{world_slug}' not found. Run migrations first.")
    return world["id"]


async def create_character(db: Database, world_id: str) -> str:
    """Create Tae-min character. Returns character ID."""
    print("\n[1/4] Creating Tae-min character...")

    char = TAEMIN_CHARACTER

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
    """Create avatar kit for Tae-min. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = TAEMIN_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - raw trainee documentary aesthetic",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (trainee documentary style)")
    return kit_id


async def create_role(db: Database) -> str:
    """Create role for Trainee Days series. Returns role ID."""
    print("\n[3/5] Creating role...")

    role_slug = "trainee-days-role"

    # Check if exists
    existing = await db.fetch_one(
        "SELECT id FROM roles WHERE slug = :slug",
        {"slug": role_slug}
    )
    if existing:
        print(f"  - The Rival Trainee: exists (skipped)")
        return existing["id"]

    role_id = str(uuid.uuid4())

    # Get episode 0 scene motivation from our EPISODES data
    ep0 = EPISODES[0]

    await db.execute("""
        INSERT INTO roles (
            id, name, slug, description,
            archetype, compatible_archetypes,
            scene_objective, scene_obstacle, scene_tactic
        ) VALUES (
            :id, :name, :slug, :description,
            :archetype, :compatible_archetypes,
            :scene_objective, :scene_obstacle, :scene_tactic
        )
    """, {
        "id": role_id,
        "name": "The Rival Trainee",
        "slug": role_slug,
        "description": "Primary character role for Trainee Days - a driven trainee competing for the same dream",
        "archetype": "confident_assertive",
        "compatible_archetypes": ["intense_passionate", "playful_teasing"],
        "scene_objective": ep0.get("scene_objective"),
        "scene_obstacle": ep0.get("scene_obstacle"),
        "scene_tactic": ep0.get("scene_tactic"),
    })

    print(f"  - The Rival Trainee (confident_assertive): created")
    return role_id


async def create_series(db: Database, world_id: str, character_id: str, role_id: str) -> str:
    """Create Trainee Days series. Returns series ID."""
    print("\n[4/5] Creating series...")

    series = TRAINEE_DAYS_SERIES

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
            featured_characters, visual_style, default_role_id
        ) VALUES (
            :id, :title, :slug, :description, :tagline,
            :world_id, :series_type, :genre, 'draft',
            :featured_characters, CAST(:visual_style AS jsonb), :role_id
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
        "role_id": role_id,
    })

    print(f"  - {series['title']} ({series['series_type']}): created")
    return series_id


async def create_episodes(db: Database, series_id: str, character_id: str, role_id: str) -> list:
    """Create episode templates. Returns list of episode IDs."""
    print("\n[5/5] Creating episodes...")

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
                id, series_id, character_id, role_id,
                episode_number, title, slug,
                situation, opening_line, episode_frame,
                episode_type, status,
                dramatic_question, resolution_types,
                scene_objective, scene_obstacle, scene_tactic,
                turn_budget, starter_prompts
            ) VALUES (
                :id, :series_id, :character_id, :role_id,
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
            "role_id": role_id,
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
    print("TRAINEE DAYS SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: k-world")
    print(f"Genre: romantic_tension")
    print(f"Episodes: 6 (evaluation to debut eve)")
    print(f"Aesthetic: Raw trainee documentary, NOT polished idol")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Tae-min)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 role (The Rival Trainee)")
        print(f"  - 1 series (Trainee Days)")
        print(f"  - {len(EPISODES)} episode templates")
        print("\nEpisode Arc:")
        for ep in EPISODES:
            print(f"  - Ep {ep['episode_number']}: {ep['title']} ({ep['episode_type']})")
        return

    db = Database(DATABASE_URL)
    await db.connect()

    try:
        # Get world ID
        world_id = await get_world_id(db, "k-world")
        print(f"\nUsing world: k-world ({world_id})")

        # Create content (order matters: role before series, role before episodes)
        character_id = await create_character(db, world_id)
        kit_id = await create_avatar_kit(db, character_id, world_id)
        role_id = await create_role(db)
        series_id = await create_series(db, world_id, character_id, role_id)
        episode_ids = await create_episodes(db, series_id, character_id, role_id)

        # Summary
        print("\n" + "=" * 60)
        print("SCAFFOLDING COMPLETE")
        print("=" * 60)
        print(f"Character ID: {character_id}")
        print(f"Avatar Kit ID: {kit_id}")
        print(f"Role ID: {role_id}")
        print(f"Series ID: {series_id}")
        print(f"Episodes: {len(episode_ids)}")

        print("\n⚠️  NEXT STEPS:")
        print("1. Run: python -m app.scripts.generate_trainee_days_images")
        print("2. Verify images in Supabase storage")
        print("3. Content will be auto-activated after image generation")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold Trainee Days series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))