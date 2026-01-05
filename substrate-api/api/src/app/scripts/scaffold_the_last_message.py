"""Scaffold The Last Message Series.

CANON COMPLIANT: docs/CONTENT_ARCHITECTURE_CANON.md
GENRE: mystery (Genre Stress Test)
WORLD: real-life

Concept:
- User's college roommate disappeared 3 days ago
- Police aren't taking it seriously
- User receives text from her phone: "Don't trust him."
- Character is Daniel, the boyfriend - last person to see her
- Layered mystery: Is he guilty, or protecting someone?

Usage:
    python -m app.scripts.scaffold_the_last_message
    python -m app.scripts.scaffold_the_last_message --dry-run
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
# NOIR MYSTERY STYLE CONSTANTS
# =============================================================================

NOIR_STYLE = "cinematic noir photography, moody lighting, high contrast shadows, desaturated colors, film grain"
NOIR_QUALITY = "masterpiece, best quality, highly detailed, dramatic lighting, atmospheric"
NOIR_NEGATIVE = "anime, cartoon, bright colors, cheerful, sunny, low quality, blurry, text, watermark"

# =============================================================================
# PROPS DEFINITIONS (ADR-005)
# =============================================================================
# Props are canonical story objects with exact, immutable content.
# They solve the "details don't stick" problem.

EPISODE_PROPS = {
    # Episode 0: First Contact
    0: [
        {
            "name": "The Anonymous Text",
            "slug": "anonymous-text",
            "prop_type": "digital",
            "description": "A screenshot of the text message you received this morning from your roommate's phone. The message that started everything.",
            "content": "Don't trust Daniel. Ask him what really happened at 10:47.",
            "content_format": "typed",
            "reveal_mode": "automatic",  # Player has this from the start
            "reveal_turn_hint": 0,
            "is_key_evidence": True,
            "evidence_tags": ["inciting_incident", "accusation", "timestamp"],
            "display_order": 0,
            "image_prompt": "screenshot of text message on smartphone screen, dark mode interface, ominous message visible, cracked screen edge, noir lighting, dramatic shadows, no readable text",
        },
        {
            "name": "The Yellow Note",
            "slug": "yellow-note",
            "prop_type": "document",
            "description": "A torn piece of yellow legal paper with hasty handwriting. Daniel claims she left this for him the night she disappeared.",
            "content": "I have to finish this or he'll never stop watching us. Don't go to the police, Daniel - they're already looking for a reason. I'm sorry. I love you. - S",
            "content_format": "handwritten",
            "reveal_mode": "character_initiated",
            "reveal_turn_hint": 3,
            "is_key_evidence": True,
            "evidence_tags": ["handwriting", "warning", "apology", "suspect_unknown"],
            "display_order": 1,
            "image_prompt": "torn piece of yellow legal paper with handwritten cursive text, creased from folding, slight water stains, dramatic side lighting, on dark wood table, noir mystery aesthetic, no readable text",
        },
    ],
    # Episode 1: The Cracks
    1: [
        {
            "name": "Her Laptop (Missing)",
            "slug": "missing-laptop",
            "prop_type": "object",
            "description": "The charging cable is still plugged in by her desk. The laptop itself is gone. Daniel claims the police didn't take it.",
            "content": None,
            "content_format": None,
            "reveal_mode": "player_requested",
            "reveal_turn_hint": 4,
            "is_key_evidence": True,
            "evidence_tags": ["missing_item", "investigation", "digital_evidence"],
            "display_order": 0,
            "image_prompt": "empty desk with laptop charging cable plugged into wall, dust outline where laptop was, dramatic window light through blinds, noir atmosphere, something missing",
        },
        {
            "name": "The Coffee Mug",
            "slug": "coffee-mug",
            "prop_type": "object",
            "description": "A coffee mug with her lipstick still on the rim. Left on the counter like she just stepped away. Three days ago.",
            "content": None,
            "content_format": None,
            "reveal_mode": "character_initiated",
            "reveal_turn_hint": 2,
            "is_key_evidence": False,
            "evidence_tags": ["personal_item", "timeline", "presence"],
            "display_order": 1,
            "image_prompt": "white coffee mug with lipstick mark on rim, cold coffee inside, on kitchen counter, afternoon light through window, abandoned feeling, noir photography",
        },
    ],
    # Episode 2: The Trade
    2: [
        {
            "name": "The Envelope",
            "slug": "the-envelope",
            "prop_type": "document",
            "description": "A manila envelope, sealed. She gave this to Daniel 'for safekeeping.' He's been carrying it for three days without opening it.",
            "content": "Contents: Partial printouts of financial records. A company name circled in red: 'Meridian Holdings.' Three photos of a man entering a building at night. A handwritten note: 'Follow the money. It always comes back to him.'",
            "content_format": "typed",
            "reveal_mode": "character_initiated",
            "reveal_turn_hint": 5,
            "is_key_evidence": True,
            "evidence_tags": ["investigation", "financial", "suspect_meridian", "photos"],
            "display_order": 0,
            "image_prompt": "sealed manila envelope on car hood in parking garage, harsh fluorescent light from above, concrete pillars in shadow, noir thriller aesthetic, something dangerous inside",
        },
    ],
    # Episode 3: The Truth
    3: [
        {
            "name": "Security Footage",
            "slug": "security-footage",
            "prop_type": "recording",
            "description": "Grainy security camera footage from the train station platform. Timestamp: 10:47 PM. She's there - but she's not alone.",
            "content": "The footage shows her on the platform at 10:47 PM. She's looking around nervously. A figure approaches from off-screen. They speak briefly. She nods. They walk toward the stairs together. The figure turns toward the camera for one frame - a man in his 40s, well-dressed, familiar somehow. She doesn't look scared. She looks relieved.",
            "content_format": "video_transcript",
            "reveal_mode": "character_initiated",
            "reveal_turn_hint": 1,
            "is_key_evidence": True,
            "evidence_tags": ["video", "timestamp_1047", "suspect_revealed", "accomplice_or_victim"],
            "display_order": 0,
            "image_prompt": "grainy security camera footage on monitor screen, train station platform visible, two figures in frame, timestamp visible, multiple monitors in security office, harsh fluorescent light, noir thriller",
        },
    ],
}

# =============================================================================
# CHARACTER DEFINITION
# =============================================================================

DANIEL_CHARACTER = {
    "name": "Daniel",
    "slug": "daniel",
    "archetype": "nervous_deflector",
    "world_slug": "real-life",
    "personality": {
        "traits": [
            "cooperative on the surface, evasive underneath",
            "watches your reactions more than he should",
            "answers questions with questions",
            "genuinely worried - but about what exactly?",
            "knows more than he's saying, maybe to protect you"
        ],
        "core_motivation": "He loved her. He might still love her. But something happened that he can't tell you about - not because he's guilty, but because the truth is worse than you suspect.",
    },
    "boundaries": {
        "flirting_level": "reserved",
        "nsfw_allowed": False,
    },
    "tone_style": {
        "formality": "casual_tense",
        "uses_ellipsis": True,
        "emoji_usage": "none",
        "capitalization": "normal",
        "pause_indicators": True,
    },
    "speech_patterns": {
        "greetings": ["Look—", "I know what you're thinking, but—", "Just let me explain"],
        "thinking_words": ["I mean—", "It's not—", "You have to understand—"],
        "deflections": ["That's not what I—", "She never told you?", "Why would you ask that?"],
    },
    "backstory": """Daniel Kim, 24. Tech startup guy. The kind of boyfriend your roommate's parents loved - stable job, polite, always remembered birthdays. They dated for two years.

But you noticed things. How she'd go quiet after his calls sometimes. How she started 'working late' more often. How she asked you, once, if you ever felt like someone was watching you - then laughed it off.

Three days ago, she didn't come home. Daniel says she left his apartment around 10pm. Her phone pinged at the train station at 10:47pm. Then nothing.

Except the text you got this morning, from her phone: "Don't trust him."

He's sitting across from you now. Cooperating. Helpful. And something in his eyes doesn't match his smile.""",
    "current_stressor": "The police called him a 'person of interest' this morning. He came to you before they could question him. Why?",

    # Avatar prompts - realistic thriller aesthetic
    "appearance_prompt": "young asian american man mid-20s, clean cut professional appearance, slightly disheveled from stress, dark circles under eyes, wearing rumpled button-down shirt with sleeves rolled up, wedding band visible, anxious but trying to appear calm, cinematic lighting, noir aesthetic",
    "style_prompt": "cinematic portrait photography, dramatic shadows, moody lighting, desaturated color grade, film noir aesthetic, tension visible in body language, shallow depth of field, single subject",
    "negative_prompt": NOIR_NEGATIVE,
}

# =============================================================================
# SERIES DEFINITION
# =============================================================================

THE_LAST_MESSAGE_SERIES = {
    "title": "The Last Message",
    "slug": "the-last-message",
    "world_slug": "real-life",
    "series_type": "serial",
    "genre": "mystery",
    "description": "Your roommate vanished 3 days ago. The police won't help. Then you get a text from her phone: 'Don't trust him.' Now her boyfriend wants to talk.",
    "tagline": "Everyone has secrets. His might have gotten her killed.",
    "visual_style": {
        "rendering": NOIR_STYLE,
        "quality": NOIR_QUALITY,
        "negative": NOIR_NEGATIVE,
        "palette": "desaturated blues and grays, pools of warm light in darkness, noir shadows",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = [
    # Episode 0: First Contact
    {
        "episode_number": 0,
        "title": "First Contact",
        "episode_type": "entry",
        "situation": "Coffee shop near campus, late afternoon. Rain streaking the windows. He picked this place - public, but the back corner booth is private enough. He's already here when you arrive, hands wrapped around a cup he hasn't touched. His knee is bouncing under the table.",
        "episode_frame": "dim coffee shop, rain-streaked windows, back corner booth, he's hunched over an untouched drink, public space but intimate conversation, tension in every glance at the door",
        "opening_line": "*He half-stands when he sees you, then sits back down. Voice lower than you expected.* Thanks for coming. I know— *glances at the door* —I know what the text said. But you need to hear my side before the cops twist everything. *pushes a napkin toward you* Her handwriting. She left me a note too. The night she— *swallows* —the night she left.",
        "dramatic_question": "Why is he so eager to talk to you before the police?",
        "scene_objective": "Convince you he's innocent - or at least that the truth is more complicated than the text suggests",
        "scene_obstacle": "You have every reason not to trust him. The text was explicit.",
        "scene_tactic": "Offer information freely, seem cooperative, but steer the conversation away from certain topics",
        "beat_guidance": {
            "establishment": "He's nervous but articulate. Too prepared? Or just scared?",
            "complication": "His alibi is airtight. Maybe too airtight. The timeline feels rehearsed.",
            "escalation": "He mentions something she was 'looking into' - then catches himself.",
            "pivot_opportunity": "He asks what the text said exactly. Why doesn't he already know?",
        },
        "resolution_types": ["suspicious", "uncertain", "somewhat_convinced"],
        "starter_prompts": [
            "What did her note say?",
            "Why come to me instead of waiting for the police?",
            "The text said not to trust you. Give me one reason I should.",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "dim coffee shop interior, rain-streaked windows, moody afternoon light, worn leather booth in shadowy corner, empty cups on nearby tables, noir atmosphere",
            "time": "late afternoon, overcast, rain, dim interior lighting",
            "mood": "suspicion, tension, something unsaid hanging in the air",
            "rendering": NOIR_STYLE,
            "quality": NOIR_QUALITY,
        },
    },
    # Episode 1: The Cracks
    {
        "episode_number": 1,
        "title": "The Cracks",
        "episode_type": "core",
        "situation": "His apartment. He invited you to see where she 'spent her last normal evening.' The place is too clean - like someone scrubbed it. Her things are still here though. A sweater on the couch. A coffee mug with her lipstick on it. He watches you look at everything.",
        "episode_frame": "sterile apartment, too clean, her belongings scattered like she just left, he's standing by the window watching you examine the space, afternoon light through blinds casting stripes",
        "opening_line": "*He's by the window, arms crossed. Watching you look around.* The police already came through. Twice. *picks up her sweater, folds it carefully* She was scared of something. Not me. Something she found. *sets the sweater down* I told her to stop digging. I told her it wasn't worth it. *looks at you directly* She didn't listen. She never listened.",
        "dramatic_question": "What was she investigating, and why didn't he stop her?",
        "scene_objective": "Make you understand she was in danger before that night - danger he tried to protect her from",
        "scene_obstacle": "Admitting what she was investigating might implicate him - or put you in the same danger",
        "scene_tactic": "Show you just enough to earn trust, but hold back the most dangerous information",
        "beat_guidance": {
            "establishment": "The apartment tells a story. She was researching something. Papers hidden, laptop missing.",
            "complication": "He admits she was scared. But of what? He's vague.",
            "escalation": "You find something he missed. Or something he wanted you to find.",
            "pivot_opportunity": "He asks if she ever mentioned a name. A company. A place. The way he asks tells you it matters.",
        },
        "resolution_types": ["new_lead", "deeper_suspicion", "reluctant_alliance"],
        "starter_prompts": [
            "What was she scared of?",
            "Where's her laptop?",
            "You said she was 'digging.' Into what?",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "modern apartment interior, sterile clean atmosphere, afternoon light through venetian blinds casting shadows, her personal items scattered - sweater on couch, coffee mug, photos on shelf",
            "time": "afternoon, stark light through blinds, too-clean surfaces",
            "mood": "something was erased here, sanitized, her presence lingers like a ghost",
            "rendering": NOIR_STYLE,
            "quality": NOIR_QUALITY,
        },
    },
    # Episode 2: The Trade
    {
        "episode_number": 2,
        "title": "The Trade",
        "episode_type": "core",
        "situation": "Parking garage, his request. Underground level, security cameras conveniently broken on this floor. He's jumpy - keeps checking the stairwell. He has an envelope. Inside is something she gave him 'for safekeeping.' He'll give it to you - but he wants something in return.",
        "episode_frame": "underground parking garage, fluorescent lights flickering, concrete pillars casting long shadows, his car with engine off, he's holding an envelope like it might explode, echoes of distant traffic",
        "opening_line": "*He's pacing between concrete pillars when you arrive. Stops when he sees you.* I shouldn't be doing this. *holds up the envelope* She made me promise. If anything happened to her— *checks the stairwell again* —she said give this to someone she trusted. Not the cops. Someone who'd actually do something with it. *extends the envelope, then pulls it back* But I need you to promise me something first.",
        "dramatic_question": "What is he really protecting - her secrets, or his own?",
        "scene_objective": "Transfer the responsibility to you. Get you invested enough to see this through.",
        "scene_obstacle": "If he gives you everything, he loses his leverage - and maybe his insurance policy",
        "scene_tactic": "Make it transactional. You get information, but you owe him something.",
        "beat_guidance": {
            "establishment": "This meeting is off-book. He's scared of being seen with you.",
            "complication": "The envelope contains partial evidence. Names. Places. But pieces are missing.",
            "escalation": "His 'condition' reveals what he's really afraid of. It's not the police.",
            "pivot_opportunity": "He tells you who she was investigating. You recognize the name - or the organization.",
        },
        "resolution_types": ["alliance_formed", "trust_broken", "in_too_deep"],
        "starter_prompts": [
            "What's your condition?",
            "Why here? Why not the coffee shop again?",
            "What are you so afraid of?",
        ],
        "turn_budget": 12,
        "background_config": {
            "location": "underground parking garage, flickering fluorescent lights, concrete pillars with deep shadows, empty parking spaces, security camera with cut wires visible, claustrophobic atmosphere",
            "time": "night, harsh artificial lighting, isolated underground",
            "mood": "paranoia, danger close, secrets exchanged in shadows",
            "rendering": NOIR_STYLE,
            "quality": NOIR_QUALITY,
        },
    },
    # Episode 3: The Truth
    {
        "episode_number": 3,
        "title": "The Truth",
        "episode_type": "special",
        "situation": "The train station. 10:47pm - the last place her phone pinged. He brought you here to show you something the police missed. Security footage he shouldn't have access to. The truth is on that screen - but it's not what either of you expected.",
        "episode_frame": "empty train station platform at night, harsh overhead lights, security office with multiple screens, he's frozen in front of the footage, the platform where she disappeared visible through the window",
        "opening_line": "*The security footage is paused on a grainy image. You can barely make her out - but it's her. He's staring at the screen like he's seeing a ghost.* She wasn't alone. *rewinds, plays again* I thought— I thought she was running from me. From us. That's what I— *his voice breaks* That's what I told myself for three days. *points at the screen* But look. Look who she's with. *the figure on the screen turns toward the camera* She wasn't running from anyone. She was running with someone.",
        "dramatic_question": "Is he guilty of something worse than lying - or was he another victim all along?",
        "scene_objective": "Finally tell the complete truth - even the parts that destroy him",
        "scene_obstacle": "The truth exonerates him but reveals he failed her when she needed him most",
        "scene_tactic": "Total honesty. There's nothing left to protect anymore.",
        "beat_guidance": {
            "establishment": "The footage changes everything. The frame shifts.",
            "complication": "His confession - not of guilt, but of failure. What he knew and didn't act on.",
            "escalation": "What she was investigating. Why she ran. What happens to you now that you know.",
            "pivot_opportunity": "He asks what you're going to do. The police? The person on the footage? Or something else?",
        },
        "resolution_types": ["truth_revealed", "ally_or_enemy", "new_beginning"],
        "starter_prompts": [
            "Who is that with her?",
            "You knew she was leaving. Didn't you?",
            "What was she really investigating?",
        ],
        "turn_budget": 15,
        "background_config": {
            "location": "train station security office at night, multiple monitors showing platform footage, harsh fluorescent light, view of empty platform through window, scattered papers and coffee cups",
            "time": "10:47pm, the exact time, harsh artificial light, empty platform",
            "mood": "revelation, everything recontextualized, the truth finally visible",
            "rendering": NOIR_STYLE,
            "quality": NOIR_QUALITY,
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
    """Create Daniel character. Returns character ID."""
    print("\n[1/4] Creating Daniel character...")

    char = DANIEL_CHARACTER

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
    """Create avatar kit for Daniel. Returns kit ID."""
    print("\n[2/4] Creating avatar kit...")

    char = DANIEL_CHARACTER

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
        "description": f"Default avatar kit for {char['name']} - noir mystery style",
        "appearance_prompt": char["appearance_prompt"],
        "style_prompt": char["style_prompt"],
        "negative_prompt": char["negative_prompt"],
    })

    # Link to character
    await db.execute("""
        UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id
    """, {"kit_id": kit_id, "char_id": character_id})

    print(f"  - {char['name']}: avatar kit created (noir style)")
    return kit_id


async def create_series(db: Database, world_id: str, character_id: str) -> str:
    """Create The Last Message series. Returns series ID."""
    print("\n[3/4] Creating series...")

    series = THE_LAST_MESSAGE_SERIES

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


async def create_props(db: Database, episode_ids: list) -> int:
    """Create props for episodes (ADR-005). Returns count of props created."""
    print("\n[5/5] Creating props (ADR-005)...")

    # Get episode_number -> episode_id mapping
    episode_map = {}
    for ep_id in episode_ids:
        row = await db.fetch_one(
            "SELECT episode_number FROM episode_templates WHERE id = :id",
            {"id": ep_id}
        )
        if row:
            episode_map[row["episode_number"]] = ep_id

    props_created = 0

    for ep_num, props in EPISODE_PROPS.items():
        ep_id = episode_map.get(ep_num)
        if not ep_id:
            print(f"  - Episode {ep_num}: not found, skipping props")
            continue

        for prop in props:
            # Check if exists
            existing = await db.fetch_one(
                """SELECT id FROM props
                   WHERE episode_template_id = :ep_id AND slug = :slug""",
                {"ep_id": ep_id, "slug": prop["slug"]}
            )
            if existing:
                print(f"  - Ep {ep_num}: {prop['name']} - exists (skipped)")
                continue

            prop_id = str(uuid.uuid4())

            await db.execute("""
                INSERT INTO props (
                    id, episode_template_id,
                    name, slug, prop_type, description,
                    content, content_format,
                    reveal_mode, reveal_turn_hint,
                    is_key_evidence, evidence_tags,
                    display_order, image_prompt
                ) VALUES (
                    :id, :episode_template_id,
                    :name, :slug, :prop_type, :description,
                    :content, :content_format,
                    :reveal_mode, :reveal_turn_hint,
                    :is_key_evidence, CAST(:evidence_tags AS jsonb),
                    :display_order, :image_prompt
                )
            """, {
                "id": prop_id,
                "episode_template_id": ep_id,
                "name": prop["name"],
                "slug": prop["slug"],
                "prop_type": prop["prop_type"],
                "description": prop["description"],
                "content": prop.get("content"),
                "content_format": prop.get("content_format"),
                "reveal_mode": prop.get("reveal_mode", "character_initiated"),
                "reveal_turn_hint": prop.get("reveal_turn_hint"),
                "is_key_evidence": prop.get("is_key_evidence", False),
                "evidence_tags": json.dumps(prop.get("evidence_tags", [])),
                "display_order": prop.get("display_order", 0),
                "image_prompt": prop.get("image_prompt"),
            })

            props_created += 1
            evidence_marker = " [KEY]" if prop.get("is_key_evidence") else ""
            print(f"  - Ep {ep_num}: {prop['name']} ({prop['prop_type']}){evidence_marker}: created")

    return props_created


async def scaffold_all(dry_run: bool = False):
    """Main scaffold function."""
    print("=" * 60)
    print("THE LAST MESSAGE - MYSTERY SERIES SCAFFOLDING")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"World: real-life")
    print(f"Genre: mystery")
    print(f"Episodes: {len(EPISODES)}")

    # Count props
    total_props = sum(len(props) for props in EPISODE_PROPS.values())

    if dry_run:
        print("\n[DRY RUN] Would create:")
        print(f"  - 1 character (Daniel)")
        print(f"  - 1 avatar kit")
        print(f"  - 1 series (The Last Message)")
        print(f"  - {len(EPISODES)} episode templates")
        print(f"  - {total_props} props (ADR-005)")
        print("\nEpisode Arc:")
        for ep in EPISODES:
            print(f"  - Ep {ep['episode_number']}: {ep['title']} ({ep['episode_type']})")
            print(f"    Dramatic Question: {ep['dramatic_question']}")
            props = EPISODE_PROPS.get(ep['episode_number'], [])
            if props:
                print(f"    Props: {', '.join(p['name'] for p in props)}")
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
        props_count = await create_props(db, episode_ids)

        # Summary
        print("\n" + "=" * 60)
        print("SCAFFOLDING COMPLETE")
        print("=" * 60)
        print(f"Character ID: {character_id}")
        print(f"Avatar Kit ID: {kit_id}")
        print(f"Series ID: {series_id}")
        print(f"Episodes: {len(episode_ids)}")
        print(f"Props: {props_count} (ADR-005)")

        print("\n>>> NEXT STEPS:")
        print("1. Run: python -m app.scripts.generate_the_last_message_images")
        print("2. Run: python -m app.scripts.generate_the_last_message_props (TODO)")
        print("3. Activate: UPDATE series SET status = 'active' WHERE slug = 'the-last-message'")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold The Last Message series")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created")
    args = parser.parse_args()

    asyncio.run(scaffold_all(dry_run=args.dry_run))
