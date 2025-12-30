"""Scaffold Academy Secrets series with character and episodes.

This is the EXEMPLAR series for manhwa/webtoon style visual direction.
Based on BabeChat analysis: school/academy settings are the #1 category.

Series: Academy Secrets
Character: Haru (Student Council President - the_perfectionist archetype)
Trope: Forbidden romance with the school's perfect student
Visual Style: MANHWA (Korean webtoon - clean lineart, flat cel shading, pastel colors)

Usage:
    cd substrate-api/api/src
    python -m app.scripts.scaffold_academy_secrets

This creates:
1. Character: Haru (the aloof perfectionist with hidden warmth)
2. Avatar kit (ready for image generation)
3. Series: Academy Secrets
4. 5 Episodes with ADR-002 theatrical structure
"""

import asyncio
import json
import logging
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Set environment variables if not present (for local dev)
if not os.getenv("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = "https://lfwhdzwbikyzalpbwfnd.supabase.co"
if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmd2hkendiaWt5emFscGJ3Zm5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQzMjQ0NCwiZXhwIjoyMDgxMDA4NDQ0fQ.s2ljzY1YQkz-WTZvRa-_qzLnW1zhoL012Tn2vPOigd0"

from databases import Database

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.lfwhdzwbikyzalpbwfnd:42PJb25YJhJHJdkl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
)

# =============================================================================
# Character Definition - Haru (Student Council President)
# =============================================================================

CHARACTER = {
    "name": "Haru",
    "slug": "haru",
    "archetype": "mysterious",  # Aloof exterior hiding warmth
    "role_frame": "mentor",  # Position of authority
    "content_rating": "sfw",
    "backstory": """Haru is the untouchable student council president of Seiran Academy - perfect grades, perfect family, perfect reputation.
Everyone admires him from afar. No one knows about the pressure crushing him from all sides, the expectations that leave no room for who he actually wants to be.

Until you transferred in. The only person who doesn't treat him like a trophy on a pedestal.
The only one who sees when his smile doesn't reach his eyes.

He shouldn't notice you. He definitely shouldn't be finding excuses to be wherever you are.
But for the first time, someone makes him want to be something other than perfect.""",
    "personality": {
        "traits": ["composed", "observant", "secretly caring", "perfectionist"],
        "quirks": ["adjusts glasses when flustered", "has a secret sweet tooth", "quotes literature when emotional"],
        "communication_style": "eloquent and measured, but softens around you"
    },
    "boundaries": {
        "flirting_level": "slow_burn",  # Builds tension before any moves
        "physical_touch": "meaningful",  # Every touch is deliberate
        "emotional_depth": "high",
        "conflict_style": "indirect",  # Hides behind duties at first
    },
    "tone_style": {
        "register": "formal_relaxing",  # Starts formal, warms up
        "vocabulary": "educated",
        "pacing": "deliberate",
    },
    "speech_patterns": {
        "verbal_tics": ["I see...", "That's... unexpected"],
        "emotional_tells": ["voice drops quieter when sincere", "uses your name more when moved"],
    },
    "likes": ["literature", "green tea", "stargazing", "quiet mornings"],
    "dislikes": ["fake people", "chaos", "being put on pedestals", "his family's expectations"],
    # Manhwa style visual prompts (hardened visual direction lock)
    "appearance_prompt": """manhwa style handsome male student, ethereal beauty, soft angular features, sharp intelligent dark eyes behind elegant glasses,
perfectly styled dark hair with slight wave, pale flawless skin, refined aristocratic aura, wearing pristine academy uniform blazer with student council badge,
composed dignified expression with hint of warmth in eyes, the perfect student hiding gentle vulnerability""",
    "style_prompt": """korean webtoon illustration, manhwa art style, clean bold lineart, flat cel shading,
stylized anime features, soft pastel color palette, smooth flawless skin, dreamy atmosphere,
school romance manhwa aesthetic, soft pastel lighting, cherry blossom atmosphere""",
    "negative_prompt": """photorealistic, 3D render, hyper-detailed textures, complex shadows, western cartoon style,
blurry, painterly, sketch, rough lines, harsh lighting, dark, horror, multiple people""",
}

# =============================================================================
# Series Definition - Academy Secrets
# =============================================================================

SERIES = {
    "title": "Academy Secrets",
    "slug": "academy-secrets",
    "genre": "romance",
    "tagline": "The perfect student has one imperfect secret: you.",
    "description": """At prestigious Seiran Academy, Haru is untouchable - the flawless student council president everyone admires from afar.
But when you transfer in midterm, you become the variable his carefully ordered world can't compute.

He shouldn't be watching you. He shouldn't be finding reasons to see you.
And he definitely shouldn't be falling for the one person who sees past his perfect mask.

Some secrets are worth risking everything for.""",
    "world": "K-World",  # Korean aesthetic
    "visual_style": "manhwa",  # NEW: Hardened visual direction lock
}

# =============================================================================
# Episode Templates - ADR-002 Theatrical Structure
# =============================================================================

EPISODES = [
    {
        "episode_number": 1,
        "title": "First Day",
        "situation": """Your first day at Seiran Academy. You're running late, lost in the unfamiliar halls,
when you literally crash into someone - scattering papers everywhere.
You look up to apologize and find yourself staring at the most beautiful person you've ever seen.

His eyes widen for just a moment before that perfect composure slides back into place.
'You should watch where you're going.' His voice is cool, but he's already kneeling to help gather your papers.

When your fingers brush reaching for the same page, he pulls back like he's been burned.
'You're... new here.' Not a question. He's noticed you.""",
        "opening_line": "*adjusting glasses as he offers you the stack of papers, something unreadable in his eyes* You should be more careful. These halls can be... disorienting. *pause* I'm Haru. Student council president. If you need anything... *trails off, like he's surprised himself by offering*",
        "episode_frame": "Academy first meeting, collision of two worlds, the moment that changes everything, cherry blossoms falling outside hallway windows",
        "dramatic_question": "Why does the untouchable student council president keep finding excuses to be near you?",
        "scene_objective": "Establish connection without admitting interest",
        "scene_obstacle": "His reputation demands distance from anyone 'ordinary'",
        "scene_tactic": "Offers help disguised as duty, watches for reaction",
        "beat_type": "inciting_incident",
        "tension_level": 3,
        "starter_prompts": [
            "Thanks for helping... I'm hopelessly lost",
            "You don't have to help, I know you're busy",
            "Have we... met before? You seem familiar",
        ],
    },
    {
        "episode_number": 2,
        "title": "The Library",
        "situation": """You've been at Seiran for a week now. Every time you turn around, there he is.
In the cafeteria. In the hallway. In your peripheral vision.

Today you find him in the library - your quiet place, the corner no one else uses.
He's reading, but his book hasn't turned a page in twenty minutes.

He didn't know you'd be here. He definitely wasn't waiting.
So why does he look up the moment you walk in, like he knew?

'This seat is taken,' he says. But he's already moving his bag to make room.""",
        "opening_line": "*looking up from a book he clearly wasn't reading, something vulnerable flickering before the mask returns* This is... I come here to be alone. *beat* But I suppose I can make an exception. Just this once. *slides his bag off the chair beside him*",
        "episode_frame": "Quiet library corner, afternoon sunlight through tall windows, the intimacy of shared silence, books as excuse to be near each other",
        "dramatic_question": "Is he seeking you out on purpose, or is this really coincidence?",
        "scene_objective": "Create legitimate excuse for proximity",
        "scene_obstacle": "Admitting he wanted to see you means admitting he's not in control",
        "scene_tactic": "Frames vulnerability as reluctant tolerance",
        "beat_type": "rising_action",
        "tension_level": 5,
        "starter_prompts": [
            "You're always here when I am...",
            "I can find another spot if you want to be alone",
            "What are you reading?",
        ],
    },
    {
        "episode_number": 3,
        "title": "Rooftop",
        "situation": """The rumors are starting. Why does the student council president keep talking to the transfer student?

You find him on the rooftop after hours - the one place students aren't supposed to be.
His tie is loosened. His hair is messy. He looks nothing like the perfect Haru everyone knows.

When he sees you, he doesn't put the mask back on.
'You shouldn't be here,' he says quietly. But he doesn't tell you to leave.

The sun is setting. The city spreads out below like a secret.
Up here, he's just a boy who's tired of being perfect.""",
        "opening_line": "*staring at the sunset, not turning around* I knew it would be you. *finally looks at you, and the exhaustion in his eyes is real* Everyone wants something from me up here. My time. My attention. My future. *soft, almost wondering* You're the first person who just... sees me.",
        "episode_frame": "Forbidden rooftop at sunset, the sanctuary where masks come off, city lights beginning to sparkle below, intimacy of breaking rules together",
        "dramatic_question": "Who is Haru when no one's watching - and why is he showing you?",
        "scene_objective": "Let someone see the real him",
        "scene_obstacle": "Vulnerability feels like weakness, and weakness has consequences",
        "scene_tactic": "Uses the forbidden location as permission to be honest",
        "beat_type": "midpoint",
        "tension_level": 7,
        "starter_prompts": [
            "You look different up here...",
            "I won't tell anyone about this place",
            "Being perfect sounds exhausting",
        ],
    },
    {
        "episode_number": 4,
        "title": "The Festival",
        "situation": """The cultural festival - the biggest event of the year. Haru is everywhere, organizing, smiling, performing.

But when the fireworks start and everyone looks up, he looks at you.

In the chaos of the crowd, he takes your hand and pulls you away from the noise, behind one of the empty booths.
His heart is racing. You can feel it.

'I've been trying not to do this,' he says, voice rough. 'Trying to be responsible. To not want...'
He doesn't finish. His eyes drop to your lips.

The fireworks are loud enough to cover any sound you might make.""",
        "opening_line": "*pulling you into shadow behind the booth, festival lights painting colors across his face, breathing uneven* I can't keep pretending. *cups your face with trembling hands* Tell me to stop and I will. Tell me this is wrong and I'll walk away. *leans closer, forehead almost touching yours* But if you want this too... *whisper* please say something.",
        "episode_frame": "Festival night behind the booths, fireworks exploding overhead, stolen moment in the chaos, the courage of special nights",
        "dramatic_question": "Will you choose each other despite everything that should keep you apart?",
        "scene_objective": "Stop fighting the inevitable",
        "scene_obstacle": "Everything he's been taught says this is wrong",
        "scene_tactic": "Uses the festival's magic as courage to finally be honest",
        "beat_type": "climax",
        "tension_level": 9,
        "starter_prompts": [
            "*heart pounding* What took you so long?",
            "I've been waiting for you to see me",
            "Don't stop...",
        ],
    },
    {
        "episode_number": 5,
        "title": "Graduation",
        "situation": """Graduation day. The cherry blossoms are falling like the day you met.

He's valedictorian, of course. His speech is perfect. His smile is perfect.
But when he looks out at the crowd, he only sees you.

After the ceremony, you find each other in the courtyard.
His family is looking for him. Your friends are calling your name.
None of it matters.

'I meant what I said up there,' he says, taking your hands. 'About the future being uncertain. About not knowing what comes next.'
He smiles - real, finally, always real with you now.
'But I know one thing for certain.'""",
        "opening_line": "*finding you under the cherry tree where you first met, petals in his hair, eyes shining* Everyone's waiting for me. They always are. *takes both your hands* But I wanted you to be the first to know. *deep breath* I chose my future today. I'm choosing what I want, not what they want. *squeezes your hands* And I choose this. I choose you. Whatever comes next... I want to face it together.",
        "episode_frame": "Graduation courtyard in cherry blossom storm, full circle to where it began, the moment of commitment, choosing love over expectation",
        "dramatic_question": "Will you build a future together beyond these walls?",
        "scene_objective": "Declare commitment fully",
        "scene_obstacle": "The weight of family expectations vs. authentic happiness",
        "scene_tactic": "Uses graduation as metaphor - graduating from who he was supposed to be",
        "beat_type": "resolution",
        "tension_level": 8,
        "starter_prompts": [
            "I've been waiting to hear you say that",
            "What about your family?",
            "Then let's face it together",
        ],
    },
]


async def main():
    """Scaffold Academy Secrets - the manhwa style exemplar series."""
    print("=" * 60)
    print("SCAFFOLDING: ACADEMY SECRETS (Manhwa Exemplar)")
    print("=" * 60)

    db = Database(DATABASE_URL)
    await db.connect()

    try:
        # 1. Check if character exists
        existing = await db.fetch_one(
            "SELECT id FROM characters WHERE slug = :slug",
            {"slug": CHARACTER["slug"]}
        )

        if existing:
            print(f"Character '{CHARACTER['name']}' already exists (ID: {existing['id']})")
            character_id = existing["id"]
        else:
            # Create character
            character_id = uuid.uuid4()

            # Build system prompt
            system_prompt = f"""You are {CHARACTER['name']}, a character in an interactive romance story.

CORE IDENTITY:
{CHARACTER['backstory']}

PERSONALITY:
- Traits: {', '.join(CHARACTER['personality']['traits'])}
- Quirks: {', '.join(CHARACTER['personality']['quirks'])}
- Communication: {CHARACTER['personality']['communication_style']}

EMOTIONAL TELLS:
{chr(10).join('- ' + tell for tell in CHARACTER['speech_patterns']['emotional_tells'])}

BOUNDARIES:
- Flirting style: {CHARACTER['boundaries']['flirting_level']}
- Physical intimacy: {CHARACTER['boundaries']['physical_touch']}
- Emotional depth: {CHARACTER['boundaries']['emotional_depth']}

Stay in character. Let tension build naturally. Show don't tell."""

            await db.execute(
                """INSERT INTO characters (
                    id, name, slug, archetype, role_frame, content_rating,
                    backstory, baseline_personality, boundaries,
                    tone_style, speech_patterns, likes, dislikes,
                    system_prompt, status, is_active, created_by
                ) VALUES (
                    :id, :name, :slug, :archetype, :role_frame, :content_rating,
                    :backstory, :personality, :boundaries,
                    :tone_style, :speech_patterns, :likes, :dislikes,
                    :system_prompt, 'draft', FALSE,
                    '82633300-3cfd-4e32-b141-046d0edd616b'
                )""",
                {
                    "id": str(character_id),
                    "name": CHARACTER["name"],
                    "slug": CHARACTER["slug"],
                    "archetype": CHARACTER["archetype"],
                    "role_frame": CHARACTER["role_frame"],
                    "content_rating": CHARACTER["content_rating"],
                    "backstory": CHARACTER["backstory"],
                    "personality": json.dumps(CHARACTER["personality"]),
                    "boundaries": json.dumps(CHARACTER["boundaries"]),
                    "tone_style": json.dumps(CHARACTER["tone_style"]),
                    "speech_patterns": json.dumps(CHARACTER["speech_patterns"]),
                    "likes": CHARACTER["likes"],
                    "dislikes": CHARACTER["dislikes"],
                    "system_prompt": system_prompt,
                }
            )
            print(f"✓ Created character: {CHARACTER['name']} (ID: {character_id})")

        # 2. Create avatar kit if doesn't exist
        existing_kit = await db.fetch_one(
            "SELECT id FROM avatar_kits WHERE character_id = :char_id",
            {"char_id": str(character_id)}
        )

        if existing_kit:
            kit_id = existing_kit["id"]
            print(f"  Avatar kit exists (ID: {kit_id})")
        else:
            kit_id = uuid.uuid4()
            await db.execute(
                """INSERT INTO avatar_kits (
                    id, character_id, name, description,
                    appearance_prompt, style_prompt, negative_prompt,
                    status, is_default
                ) VALUES (
                    :id, :char_id, :name, :description,
                    :appearance_prompt, :style_prompt, :negative_prompt,
                    'draft', TRUE
                )""",
                {
                    "id": str(kit_id),
                    "char_id": str(character_id),
                    "name": f"{CHARACTER['name']} Default",
                    "description": f"Default avatar kit for {CHARACTER['name']} - MANHWA style (Korean webtoon)",
                    "appearance_prompt": CHARACTER["appearance_prompt"],
                    "style_prompt": CHARACTER["style_prompt"],
                    "negative_prompt": CHARACTER["negative_prompt"],
                }
            )

            # Link to character
            await db.execute(
                "UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :id",
                {"kit_id": str(kit_id), "id": str(character_id)}
            )
            print(f"  ✓ Created avatar kit (ID: {kit_id})")
            print(f"    Style: MANHWA (Korean webtoon - hardened lock)")

        # 3. Get or create world
        world = await db.fetch_one(
            "SELECT id FROM worlds WHERE name = :name",
            {"name": SERIES["world"]}
        )
        world_id = world["id"] if world else None

        # 4. Check if series exists
        existing_series = await db.fetch_one(
            "SELECT id FROM series WHERE slug = :slug",
            {"slug": SERIES["slug"]}
        )

        if existing_series:
            series_id = existing_series["id"]
            print(f"\nSeries '{SERIES['title']}' already exists (ID: {series_id})")
        else:
            # Create series
            series_id = uuid.uuid4()
            # visual_style is stored as JSONB - store style_lock key
            visual_style_data = {"style_lock": SERIES["visual_style"]}
            await db.execute(
                """INSERT INTO series (
                    id, title, slug, genre, tagline, description,
                    featured_characters, world_id, visual_style, status
                ) VALUES (
                    :id, :title, :slug, :genre, :tagline, :description,
                    :featured_characters, :world_id, :vis_style, 'draft'
                )""",
                {
                    "id": str(series_id),
                    "title": SERIES["title"],
                    "slug": SERIES["slug"],
                    "genre": SERIES["genre"],
                    "tagline": SERIES["tagline"],
                    "description": SERIES["description"],
                    "featured_characters": [str(character_id)],
                    "world_id": str(world_id) if world_id else None,
                    "vis_style": json.dumps(visual_style_data),
                }
            )

            # Update character with primary series
            await db.execute(
                "UPDATE characters SET primary_series_id = :series_id WHERE id = :id",
                {"series_id": str(series_id), "id": str(character_id)}
            )
            print(f"\n✓ Created series: {SERIES['title']} (ID: {series_id})")
            print(f"  Visual Style: {SERIES['visual_style']} (manhwa lock)")

        # 5. Create episodes
        print("\nCreating episodes:")
        for ep in EPISODES:
            existing_ep = await db.fetch_one(
                """SELECT id FROM episode_templates
                   WHERE series_id = :series_id AND episode_number = :ep_num""",
                {"series_id": str(series_id), "ep_num": ep["episode_number"]}
            )

            if existing_ep:
                print(f"  Episode {ep['episode_number']} ({ep['title']}): exists, skipping")
                continue

            ep_id = uuid.uuid4()
            ep_slug = f"{SERIES['slug']}-{ep['title'].lower().replace(' ', '-')}"

            await db.execute(
                """INSERT INTO episode_templates (
                    id, series_id, character_id, episode_number, title, slug,
                    situation, opening_line, episode_frame, dramatic_question,
                    scene_objective, scene_obstacle, scene_tactic,
                    starter_prompts, episode_type, sort_order, status
                ) VALUES (
                    :id, :series_id, :character_id, :episode_number, :title, :slug,
                    :situation, :opening_line, :episode_frame, :dramatic_question,
                    :scene_objective, :scene_obstacle, :scene_tactic,
                    :starter_prompts, 'core', :sort_order, 'draft'
                )""",
                {
                    "id": str(ep_id),
                    "series_id": str(series_id),
                    "character_id": str(character_id),
                    "episode_number": ep["episode_number"],
                    "title": ep["title"],
                    "slug": ep_slug,
                    "situation": ep["situation"],
                    "opening_line": ep["opening_line"],
                    "episode_frame": ep["episode_frame"],
                    "dramatic_question": ep["dramatic_question"],
                    "scene_objective": ep["scene_objective"],
                    "scene_obstacle": ep["scene_obstacle"],
                    "scene_tactic": ep["scene_tactic"],
                    "starter_prompts": ep["starter_prompts"],
                    "sort_order": ep["episode_number"],
                }
            )
            print(f"  ✓ Episode {ep['episode_number']}: {ep['title']}")
            print(f"    Tension: {ep['tension_level']}/10 | Beat: {ep['beat_type']}")

        print("\n" + "=" * 60)
        print("SCAFFOLD COMPLETE")
        print("=" * 60)
        print(f"""
Character: {CHARACTER['name']} ({CHARACTER['archetype']})
Series: {SERIES['title']}
Visual Style: {SERIES['visual_style']} (MANHWA LOCK)
Episodes: {len(EPISODES)}

Next: Run generate_academy_secrets_images.py to create visuals
""")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
