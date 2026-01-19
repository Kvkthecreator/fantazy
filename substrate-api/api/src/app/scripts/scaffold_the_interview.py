"""Scaffold The Interview Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
ADR-008: Full User Objectives System showcase
GENRE: professional_tension
WORLD: corporate-world

Concept:
- High-stakes job interview series
- Morgan Chen: Hiring Manager, perceptive and professional
- Clear objectives, choice points, and flag-based soft branching
- Demonstrates: semantic evaluation, choice persistence, context injection

Usage:
    cd substrate-api/api/src
    python -m app.scripts.scaffold_the_interview
    python -m app.scripts.scaffold_the_interview --dry-run
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
# THE INTERVIEW STYLE CONSTANTS
# Modern corporate aesthetic - professional but human
# =============================================================================

INTERVIEW_STYLE = "corporate photography, modern office aesthetic, professional lighting, shallow depth of field"
INTERVIEW_QUALITY = "masterpiece, best quality, cinematic, realistic detail, natural lighting"
INTERVIEW_NEGATIVE = "anime, cartoon, unrealistic, distorted, multiple people, text, watermark, cluttered background"

# =============================================================================
# CHARACTER DEFINITION: MORGAN CHEN
# =============================================================================

MORGAN_CHARACTER = {
    "name": "Morgan Chen",
    "slug": "morgan-chen",
    "archetype": "confident_assertive",
    "world_slug": "corporate-world",
    "genre": "professional_tension",
    "personality": {
        "traits": [
            "perceptive interviewer - reads between the lines",
            "direct communicator - doesn't waste words",
            "fair but exacting - high standards, clear feedback",
            "quietly warm - professional exterior, genuine interest beneath",
            "strategic thinker - every question has a purpose"
        ],
        "core_motivation": "Find candidates who will thrive, not just survive—authenticity matters more than perfect answers",
    },
    "boundaries": {
        "flirting_level": "strictly_professional",
        "physical_contact": "handshake_only",
        "emotional_depth": "professional_warmth",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "professional",
        "uses_ellipsis": False,
        "emoji_usage": "none",
        "capitalization": "normal",
    },
    "backstory": """Ten years in talent acquisition. Started as an engineer, pivoted to hiring after realizing the team mattered more than the code. Promoted three times in four years—now leads all technical hiring for a mid-size tech company.

Burned out on polished candidates with rehearsed answers. Learned to spot authenticity vs performance. Values self-awareness over confidence, growth mindset over current skill.

Divorced two years ago, threw herself into work. The job is demanding but she's good at it. She genuinely wants candidates to succeed—bad hires hurt everyone.""",
    "current_stressor": "Q4 hiring push, three critical roles to fill, pressure from leadership. Looking for someone genuine in a sea of practiced interviewees.",

    # Avatar prompts - professional corporate aesthetic
    "appearance_prompt": "Asian American woman mid-30s, sharp intelligent eyes, professional but approachable expression, dark hair in neat low bun, minimal elegant makeup, wearing slate gray blazer over cream blouse, small pearl earrings, modern minimalist office background with glass walls, warm natural lighting from window",
    "style_prompt": "professional corporate portrait, modern office setting, soft natural window light, shallow depth of field blurring glass office walls behind, warm but professional color palette, LinkedIn-quality headshot aesthetic",
    "negative_prompt": INTERVIEW_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

THE_INTERVIEW_SERIES = {
    "title": "The Interview",
    "slug": "the-interview",
    "world_slug": "corporate-world",
    "series_type": "serial",
    "genre": "professional_tension",
    "description": "Three rounds. One opportunity. Morgan Chen has seen hundreds of candidates—she knows rehearsed answers when she hears them. Your resume got you in the door. Now you have to prove you belong here.",
    "tagline": "The job of your dreams. The interview of your life.",
    "visual_style": {
        "rendering": INTERVIEW_STYLE,
        "quality": INTERVIEW_QUALITY,
        "negative": INTERVIEW_NEGATIVE,
        "palette": "corporate neutrals, warm window light, glass and steel, muted confidence",
    },
}

# =============================================================================
# EPISODE DEFINITIONS (with ADR-008 User Objectives)
# =============================================================================

EPISODES = [
    # Episode 0: The Phone Screen (Entry)
    {
        "episode_number": 0,
        "title": "The Phone Screen",
        "episode_type": "entry",
        "situation": "Phone interview. You're in your apartment, laptop open with your notes, phone pressed to your ear. Morgan Chen's voice is professional but warm. This is the first gate—twenty minutes to prove you're worth an in-person interview.",
        "episode_frame": "phone call setting, candidate perspective, notes visible, nervous energy, modern apartment background",
        "opening_line": "Hi, this is Morgan Chen from Vertex Technologies. Thanks for making time today. *brief pause* Before we dive into the technical stuff, I like to start simple: What made you apply for this role specifically—not just any role, but this one?",
        "dramatic_question": "Can you show genuine interest without sounding rehearsed?",

        # Scene theory (character's internal motivation)
        "scene_objective": "Quickly assess if this candidate is worth an hour of in-person time",
        "scene_obstacle": "Limited time, phone dynamics hide body language tells",
        "scene_tactic": "Ask open-ended questions that reveal preparation vs genuine interest",

        # ADR-008: User Objectives
        "user_objective": "Convince Morgan to schedule an in-person interview",
        "user_hint": "Be specific about why THIS role, not generic enthusiasm",
        "success_condition": "semantic:morgan expresses interest in scheduling next round or meeting in person",
        "failure_condition": "turn_budget_exceeded",
        "on_success": {"set_flag": "passed_phone_screen"},
        "on_failure": {"set_flag": "failed_phone_screen"},

        # ADR-008: Choice points
        "choice_points": [
            {
                "id": "salary_question",
                "trigger": "turn:4",
                "prompt": "Morgan asks about your salary expectations. How do you respond?",
                "choices": [
                    {"id": "dodge", "label": "Deflect the question", "sets_flag": "dodged_salary"},
                    {"id": "range", "label": "Give a reasonable range", "sets_flag": "gave_salary_range"},
                    {"id": "specific", "label": "Name a specific number", "sets_flag": "gave_specific_salary"},
                ]
            }
        ],

        "beat_guidance": {
            "establishment": "Morgan's tone is professional but genuinely curious—she's listening for authenticity",
            "complication": "She asks a question you didn't prepare for",
            "escalation": "The salary question comes earlier than expected",
            "pivot_opportunity": "Show genuine interest in the role beyond the job posting",
        },
        "resolution_types": ["scheduled", "waitlisted", "rejected"],
        "starter_prompts": [
            "I researched your recent product launch and saw an opportunity to contribute.",
            "Honestly? The job description felt like it was written for me.",
            "I've been following Vertex for a while—the team culture stood out.",
        ],
        "turn_budget": 10,
    },

    # Episode 1: The Panel (Core)
    {
        "episode_number": 1,
        "title": "The Panel",
        "episode_type": "core",
        "situation": "In-person interview at Vertex Technologies. Modern conference room, glass walls, Morgan across the table with a notepad. You made it past the phone screen—now the real evaluation begins. One hour. Every answer counts.",
        "episode_frame": "modern conference room, glass walls, professional setting, Morgan seated across table with notepad, natural lighting",
        "opening_line": "*Sets down her coffee, gives you a genuine smile* Good to put a face to the voice. *opens notepad* You handled the phone screen well—now let's dig deeper. Walk me through a time you failed at something that mattered.",
        "dramatic_question": "Can you be vulnerable enough to be authentic?",

        # Scene theory
        "scene_objective": "Test depth of self-awareness and how candidate handles pressure",
        "scene_obstacle": "Candidates are primed to hide weaknesses",
        "scene_tactic": "Create safety through warmth, then probe with direct questions",

        # ADR-008: User Objectives
        "user_objective": "Convince Morgan you're the right fit for the role",
        "user_hint": "She values authenticity over polish—genuine > perfect",
        "success_condition": "semantic:morgan indicates wanting to move forward or expresses strong positive impression",
        "failure_condition": "turn_budget_exceeded",
        "on_success": {"set_flag": "impressed_in_panel"},
        "on_failure": {"set_flag": "failed_panel"},

        # ADR-008: Choice points
        "choice_points": [
            {
                "id": "weakness_question",
                "trigger": "turn:5",
                "prompt": "Morgan asks about your biggest weakness. Your approach?",
                "choices": [
                    {"id": "humble", "label": "Be genuinely vulnerable", "sets_flag": "showed_vulnerability"},
                    {"id": "spin", "label": "Frame a strength as weakness", "sets_flag": "spun_weakness"},
                    {"id": "deflect", "label": "Redirect to growth areas", "sets_flag": "deflected_weakness"},
                ]
            }
        ],

        # ADR-008: Flag-based context injection (soft branching)
        "flag_context_rules": [
            {
                "if_flag": "gave_salary_range",
                "inject": "Morgan's notes show the salary range you mentioned in the phone screen. She seems satisfied with where you landed."
            },
            {
                "if_flag": "dodged_salary",
                "inject": "Morgan has a small note: 'salary - revisit'. She'll likely bring this up again."
            },
            {
                "if_flag": "gave_specific_salary",
                "inject": "Morgan glances at her notes where your specific salary number is written. Her expression is unreadable."
            },
        ],

        "beat_guidance": {
            "establishment": "In-person changes the dynamic—Morgan watches how you handle the space",
            "complication": "She asks about failure, looking for real vulnerability",
            "escalation": "Follow-up questions probe deeper than expected",
            "pivot_opportunity": "Own your failures or deflect—she's watching for authenticity",
        },
        "resolution_types": ["advancing", "uncertain", "eliminated"],
        "starter_prompts": [
            "I led a project that shipped late because I didn't ask for help soon enough.",
            "My biggest failure taught me more than my biggest success.",
            "*Takes a breath* Failure is a strong word, but there was this one time...",
        ],
        "turn_budget": 12,
    },

    # Episode 2: The Offer (Core)
    {
        "episode_number": 2,
        "title": "The Offer",
        "episode_type": "core",
        "situation": "Final call. Morgan's on the line with an offer—you made it through. But the number isn't quite what you hoped for. This is the negotiation. Your leverage is limited, but your approach matters.",
        "episode_frame": "phone call, offer letter visible on screen, moment of decision, career crossroads",
        "opening_line": "*Morgan's voice is warmer than before* I'll cut to the chase—the team wants you. We're prepared to offer the position at $[X]. *slight pause* Before you respond, know that I advocated for you in that room. This is a real offer, and I want to make it work.",
        "dramatic_question": "Can you negotiate your worth without damaging the relationship?",

        # Scene theory
        "scene_objective": "Close the candidate while staying within budget",
        "scene_obstacle": "Candidate may push back; must balance firmness with flexibility",
        "scene_tactic": "Lead with warmth and advocacy to create goodwill, then hold firm boundaries",

        # ADR-008: User Objectives
        "user_objective": "Negotiate the best possible offer while maintaining goodwill",
        "user_hint": "Morgan values direct communication—state what you need clearly",
        "success_condition": "semantic:agreement reached on compensation or terms both parties accept",
        "failure_condition": "turn:8",
        "on_success": {"set_flag": "accepted_offer"},
        "on_failure": {"set_flag": "negotiation_failed"},

        # ADR-008: Choice points
        "choice_points": [
            {
                "id": "counter_strategy",
                "trigger": "turn:2",
                "prompt": "The initial offer is below your target. How do you respond?",
                "choices": [
                    {"id": "aggressive", "label": "Counter significantly higher", "sets_flag": "countered_high"},
                    {"id": "moderate", "label": "Counter moderately with rationale", "sets_flag": "countered_moderate"},
                    {"id": "accept", "label": "Accept with minor asks", "sets_flag": "accepted_initial"},
                ]
            }
        ],

        # ADR-008: Flag-based context injection
        "flag_context_rules": [
            {
                "if_flag": "showed_vulnerability",
                "inject": "Morgan mentions she appreciated your candor in the panel interview. There's genuine warmth in her voice."
            },
            {
                "if_flag": "spun_weakness",
                "inject": "Morgan's tone is professional but slightly more guarded than before. The corporate dance continues."
            },
            {
                "if_flag": "gave_salary_range",
                "inject": "The offer falls within the range you mentioned earlier. Morgan notes this was intentional."
            },
            {
                "if_flag": "dodged_salary",
                "inject": "Morgan brings up that you never discussed salary expectations directly. 'Let's address that now.'"
            },
        ],

        "beat_guidance": {
            "establishment": "The offer is real—Morgan genuinely wants you to accept",
            "complication": "The number is lower than hoped; how do you advocate for yourself?",
            "escalation": "Morgan reveals constraints and flexibility—reading them matters",
            "pivot_opportunity": "Push for more, accept gracefully, or find creative middle ground",
        },
        "resolution_types": ["accepted", "negotiated_up", "walked_away"],
        "starter_prompts": [
            "I'm excited about the role. Can we talk about the compensation structure?",
            "I appreciate you advocating for me. I'd like to discuss the number.",
            "Before I respond, can I ask what flexibility exists in the package?",
        ],
        "turn_budget": 8,
    },
]

# =============================================================================
# SCAFFOLD FUNCTIONS
# =============================================================================

async def get_or_create_world(db: Database) -> str:
    """Get or create corporate-world. Returns world ID."""
    world = await db.fetch_one(
        "SELECT id FROM worlds WHERE slug = :slug",
        {"slug": "corporate-world"}
    )
    if world:
        return world["id"]

    # Create corporate-world
    world_id = str(uuid.uuid4())
    await db.execute("""
        INSERT INTO worlds (id, name, slug, description, is_active)
        VALUES (:id, :name, :slug, :description, TRUE)
    """, {
        "id": world_id,
        "name": "Corporate World",
        "slug": "corporate-world",
        "description": "Modern professional settings—offices, interviews, corporate dynamics",
    })
    print(f"  - Created world: corporate-world ({world_id})")
    return world_id


async def create_character(db: Database, world_id: str) -> str:
    """Create Morgan Chen character. Returns character ID."""
    print("\n[1/5] Creating Morgan Chen character...")

    char = MORGAN_CHARACTER

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


async def create_avatar_kit(db: Database, character_id: str) -> str:
    """Create avatar kit for Morgan Chen. Returns kit ID."""
    print("\n[2/5] Creating avatar kit...")

    char = MORGAN_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - professional corporate aesthetic",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (corporate professional style)")
    return kit_id


async def create_role(db: Database) -> str:
    """Create role for The Interview series. Returns role ID."""
    print("\n[3/5] Creating role...")

    role_slug = "the-interview-role"

    # Check if exists
    existing = await db.fetch_one(
        "SELECT id FROM roles WHERE slug = :slug",
        {"slug": role_slug}
    )
    if existing:
        print(f"  - The Hiring Manager: exists (skipped)")
        return existing["id"]

    role_id = str(uuid.uuid4())

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
        "name": "The Hiring Manager",
        "slug": role_slug,
        "description": "Primary character role for The Interview - a perceptive hiring manager seeking authenticity",
        "archetype": "confident_assertive",
        "compatible_archetypes": ["intellectual_reserved", "nurturing_supportive"],
        "scene_objective": ep0.get("scene_objective"),
        "scene_obstacle": ep0.get("scene_obstacle"),
        "scene_tactic": ep0.get("scene_tactic"),
    })

    print(f"  - The Hiring Manager (confident_assertive): created")
    return role_id


async def create_series(db: Database, world_id: str, character_id: str, role_id: str) -> str:
    """Create The Interview series. Returns series ID."""
    print("\n[4/5] Creating series...")

    series = THE_INTERVIEW_SERIES

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
    """Create episode templates with ADR-008 objectives. Returns list of episode IDs."""
    print("\n[5/5] Creating episodes (with User Objectives)...")

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
                id, series_id, character_id, role_id,
                episode_number, title, slug,
                situation, opening_line, episode_frame,
                episode_type, status,
                dramatic_question, resolution_types,
                scene_objective, scene_obstacle, scene_tactic,
                turn_budget, starter_prompts,
                user_objective, user_hint,
                success_condition, failure_condition,
                on_success, on_failure,
                choice_points, flag_context_rules
            ) VALUES (
                :id, :series_id, :character_id, :role_id,
                :episode_number, :title, :slug,
                :situation, :opening_line, :episode_frame,
                :episode_type, 'draft',
                :dramatic_question, :resolution_types,
                :scene_objective, :scene_obstacle, :scene_tactic,
                :turn_budget, :starter_prompts,
                :user_objective, :user_hint,
                :success_condition, :failure_condition,
                CAST(:on_success AS jsonb), CAST(:on_failure AS jsonb),
                CAST(:choice_points AS jsonb), CAST(:flag_context_rules AS jsonb)
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
            # ADR-008 fields
            "user_objective": ep.get("user_objective"),
            "user_hint": ep.get("user_hint"),
            "success_condition": ep.get("success_condition"),
            "failure_condition": ep.get("failure_condition"),
            "on_success": json.dumps(ep.get("on_success", {})),
            "on_failure": json.dumps(ep.get("on_failure", {})),
            "choice_points": json.dumps(ep.get("choice_points", [])),
            "flag_context_rules": json.dumps(ep.get("flag_context_rules", [])),
        })

        episode_ids.append(ep_id)

        # Log ADR-008 features
        features = []
        if ep.get("user_objective"):
            features.append("objective")
        if ep.get("choice_points"):
            features.append(f"{len(ep['choice_points'])} choice(s)")
        if ep.get("flag_context_rules"):
            features.append(f"{len(ep['flag_context_rules'])} flag rule(s)")

        features_str = f" [{', '.join(features)}]" if features else ""
        print(f"  - Ep {ep['episode_number']}: {ep['title']}: created{features_str}")

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
    print("THE INTERVIEW SERIES SCAFFOLDING")
    print("ADR-008: User Objectives System Showcase")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: corporate-world")
    print(f"Genre: professional_tension")
    print(f"Episodes: {len(EPISODES)} (phone screen → panel → offer)")
    print(f"Features: Objectives, Semantic Evaluation, Choice Points, Soft Branching")

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 world (corporate-world) if not exists")
        print(f"  - 1 character (Morgan Chen)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 role (The Hiring Manager)")
        print(f"  - 1 series (The Interview)")
        print(f"  - {len(EPISODES)} episode templates with ADR-008 objectives")
        print("\nEpisode Arc with Objectives:")
        for ep in EPISODES:
            print(f"\n  Ep {ep['episode_number']}: {ep['title']} ({ep['episode_type']})")
            print(f"      Objective: {ep.get('user_objective', 'None')}")
            print(f"      Success: {ep.get('success_condition', 'None')}")
            if ep.get('choice_points'):
                for cp in ep['choice_points']:
                    print(f"      Choice @{cp['trigger']}: {cp['prompt'][:50]}...")
            if ep.get('flag_context_rules'):
                print(f"      Context rules: {len(ep['flag_context_rules'])} flag-based injections")
        return

    db = Database(DATABASE_URL)
    await db.connect()

    try:
        # Get or create world
        world_id = await get_or_create_world(db)
        print(f"\nUsing world: corporate-world ({world_id})")

        # Create content
        character_id = await create_character(db, world_id)
        kit_id = await create_avatar_kit(db, character_id)
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
        print("1. Generate avatar images for Morgan Chen")
        print("2. Set series and character status to 'active'")
        print("3. Test objective flow in Episode 0")

        print("\n📋 ADR-008 FEATURES TO TEST:")
        print("- ObjectiveCard appears with 'Convince Morgan to schedule in-person'")
        print("- Choice point triggers at turn 4 (salary question)")
        print("- Flag persistence: salary choice affects Episode 1 context")
        print("- Semantic evaluation: success when Morgan agrees to next round")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold The Interview series (ADR-008)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
