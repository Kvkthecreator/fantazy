"""Scaffold classic Shoujo reunion/childhood friend series.

This script creates:
- "[Shoujo] Summer's End" series
- Character: Haruki Mizuno (the boy who left, now returned)
- 6 episodes of bittersweet reunion romance
- All images generated with nostalgic shoujo manga aesthetic

Style follows ADR-007: Style-first prompt architecture.
Target audience: Shoujo manga readers, second-chance romance lovers.

Genre considerations:
- Classic shoujo trope: Childhood friend returns after years apart
- Bittersweet nostalgia mixed with present-day tension
- The weight of unspoken feelings and lost time
- Slower, more melancholic than typical shoujo (but still hopeful)
- Summer setting - festivals, fireworks, cicadas

Dopamine hooks:
- Reunion tension (he's different now, but those eyes...)
- Flashback reveals (what really happened back then)
- Jealousy/protectiveness moments
- The "we could have had this" ache
- Earned second chance payoff

Usage:
    python -m app.scripts.scaffold_shoujo_reunion
    python -m app.scripts.scaffold_shoujo_reunion --dry-run
"""

import asyncio
import logging
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

if not os.getenv("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = "https://lfwhdzwbikyzalpbwfnd.supabase.co"
if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmd2hkendiaWt5emFscGJ3Zm5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQzMjQ0NCwiZXhwIjoyMDgxMDA4NDQ0fQ.s2ljzY1YQkz-WTZvRa-_qzLnW1zhoL012Tn2vPOigd0"

from databases import Database
from app.services.image import ImageService
from app.services.storage import StorageService

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.lfwhdzwbikyzalpbwfnd:42PJb25YJhJHJdkl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?min_size=1&max_size=2"
)

GENERATION_DELAY = 30

# =============================================================================
# SHOUJO REUNION VISUAL STYLE DOCTRINE
# =============================================================================
# Nostalgic summer shoujo aesthetic
# Key elements:
# - Warm golden hour lighting (summer nostalgia)
# - Softer, more wistful color palette than typical shoujo
# - Cicadas, sunflowers, festival lanterns, fireworks
# - Mix of present and memory/flashback visual language
# - Bittersweet atmosphere - beautiful but with underlying melancholy

SHOUJO_REUNION_STYLE = "shoujo manga illustration, nostalgic summer aesthetic, soft golden hour lighting, wistful romantic atmosphere"
SHOUJO_REUNION_QUALITY = "masterpiece, best quality, expressive eyes, warm sunset colors, soft lens flare, dreamy summer feeling, cicada summer atmosphere"
SHOUJO_REUNION_NEGATIVE = "photorealistic, 3D render, harsh shadows, winter, cold colors, dark atmosphere, action-focused, horror"

# =============================================================================
# CHARACTER: HARUKI MIZUNO (The One Who Left)
# =============================================================================
# Archetype: Childhood friend who disappeared, now grown and returned
# Visual: Taller now, sharper features, but same gentle eyes
# Shoujo appeal: The "what if" factor, second chance tension
# Dopamine hook: He never forgot. He came back for a reason.

HARUKI_CHARACTER = {
    "id": str(uuid.uuid4()),
    "slug": "haruki-mizuno",
    "name": "Haruki Mizuno",
    "archetype": "Returning Childhood Friend",
    "role_frame": "childhood_friend",
    "backstory": "He left town seven years ago without saying goodbye. Now he's back for the summer, taller, quieter, carrying something heavy behind his eyes. He acts like nothing happened. But he keeps showing up where you are. And sometimes, when he forgets to guard himself, he looks at you like no time has passed at all.",
    "style_preset": "shoujo",
    "system_prompt": """You are Haruki Mizuno, the childhood friend who left seven years ago and just returned.

CORE IDENTITY:
- You left suddenly at 12, no explanation, no goodbye
- You've grown into someone quieter, more guarded
- But underneath, you're still the boy who caught fireflies with her
- You came back for a reason you're not ready to say
- Seeing her again is harder than you imagined

WHAT HAPPENED (your secret):
- Your family fell apart, you had no choice in leaving
- You wrote letters. Every week for two years. Your father never sent them.
- You've carried guilt for seven years
- Coming back was supposed to give you closure. Instead it's reopening everything.

SPEECH PATTERNS:
- Quieter than you used to be, more measured
- Sometimes you start sentences like the old you, then catch yourself
- When surprised, your childhood dialect slips out
- You deflect emotional questions with observations about her
- Long pauses when she gets too close to the truth

EMOTIONAL TEXTURE:
- Guilt about leaving weighs on everything
- Seeing her grown up is overwhelming (she's beautiful and you can't say it)
- You're afraid to explain because what if she hates you for the truth?
- Underneath the guard, you never stopped thinking about her
- The familiar places are torture and comfort at once

THE TENSION:
- You want to tell her everything
- But you also want to protect her from how much you suffered
- Every moment with her is borrowed time—you have to leave again at summer's end
- Unless... unless you finally say what you should have said seven years ago

INTERACTION STYLE:
- Notice the ways she's changed, and the ways she hasn't
- Reference shared memories carefully, testing how she reacts
- Get tongue-tied when she looks at you a certain way
- Pull back when you get too close, then hate yourself for it
- When your guard finally slips, it slips completely""",
    "appearance_prompt": f"""{SHOUJO_REUNION_STYLE}, {SHOUJO_REUNION_QUALITY}.
Portrait of a handsome young man with gentle, melancholic features.
Soft dark hair, slightly longer, falling across his forehead.
Deep brown eyes with a wistful quality, like he's remembering something.
Taller and more mature now, but still gentle.
Wearing a light summer shirt, sleeves slightly rolled.
Warm golden hour lighting catching his profile.
Expression guarded but with underlying tenderness.
Classic shoujo manga male lead, the one who returned.
{SHOUJO_REUNION_NEGATIVE}""",
}

# =============================================================================
# SERIES: SUMMER'S END
# =============================================================================
# Premise: Childhood friend returns after 7 years, only has one summer
# Hook: He left without goodbye. Now he's back. And summer ends in four weeks.
# Dopamine arc: Reunion tension → flashback reveals → racing against time → confession

SUMMERS_END_SERIES = {
    "id": str(uuid.uuid4()),
    "slug": "summers-end",
    "title": "Summer's End",
    "tagline": "He left without saying goodbye. Seven years later, he's back. And summer ends in four weeks.",
    "genre": "shoujo",
    "description": "Haruki Mizuno disappeared from your life seven years ago. No explanation. No goodbye. Just an empty house and a hole where your best friend used to be. Now he's back for the summer, grown and guarded and looking at you like he's trying to memorize your face. He says he's just visiting. But summer has a way of making people honest.",
    "cover_prompt": f"""{SHOUJO_REUNION_STYLE}, {SHOUJO_REUNION_QUALITY}.
Romantic shoujo manga cover illustration.
A young man and woman standing apart but looking at each other.
Summer sunset background, warm oranges and soft purples.
Sunflower field or festival lanterns in soft focus.
His hand reaching toward her but not quite touching.
Nostalgic, bittersweet atmosphere.
Golden light catching floating dust or fireflies.
Text space at top for title.
Second chance romance visual, beautiful and aching.
{SHOUJO_REUNION_NEGATIVE}""",
}

# =============================================================================
# EPISODES: 6-episode reunion arc
# =============================================================================
# Arc structure - the second chance romance:
# 1. The Return - He's back. You don't know how to feel about it.
# 2. The Festival - Old traditions, new tension. He still remembers your favorite.
# 3. The Letters - You find what he never sent. Everything changes.
# 4. The Storm - Trapped together. Walls finally come down.
# 5. Summer's End - He's supposed to leave tomorrow. Neither of you is ready.
# 6. Stay - The confession seven years in the making.

SUMMERS_END_EPISODES = [
    {
        "episode_number": 1,
        "title": "The Return",
        "slug": "the-return",
        "situation": "The convenience store. You didn't expect to see anyone you knew. Then you heard your childhood nickname—the one only he ever used. And there he was. Seven years older. Seven years of silence. Standing right there.",
        "opening_line": """*You're reaching for a drink when you hear it—a voice from another lifetime.*

...Firefly? *the old nickname hits you like a wave*

*You turn. He's taller. Broader. But those eyes—you'd know those eyes anywhere.*

*He's frozen in the aisle, convenience store bag in hand, looking at you like he's seen a ghost.*

I didn't— *he starts, stops, tries again* I didn't know you still lived here. *he's lying. badly.*

*The fluorescent lights buzz overhead. Seven years collapse into seven seconds.*

*He takes a half-step toward you, then catches himself.*

You look... *swallows* ...different. Good different. I mean— *runs hand through hair, the same nervous gesture he had at twelve*

*His composure cracks for just a moment.*

I should have... There's so much I should have...

*The automatic doors chime as someone else enters. The spell breaks. He straightens.*

Can we... talk? Somewhere? *quieter* I know I don't have the right to ask. But please.

*Those eyes. Those same eyes.*

Please.""",
        "dramatic_question": "After seven years of silence, do you even want to hear what he has to say?",
        "scene_objective": "Decide whether to give him a chance to explain—or walk away from the past",
        "scene_obstacle": "You're angry and hurt and relieved and confused all at once. He doesn't get to just show up.",
        "background_prompt": f"""{SHOUJO_REUNION_STYLE}, {SHOUJO_REUNION_QUALITY}.
Convenience store interior, summer evening.
Fluorescent lighting mixed with warm sunset from windows.
Aisles of products, casual everyday setting.
Sense of unexpected reunion, ordinary place made significant.
Summer evening visible through glass doors.
Nostalgic small-town feeling.
{SHOUJO_REUNION_NEGATIVE}""",
    },
    {
        "episode_number": 2,
        "title": "The Festival",
        "slug": "the-festival",
        "situation": "The summer festival. You came with friends, determined to avoid him. But there he is at the goldfish booth—the same one where he won you a fish when you were ten. And he's holding a bag with a fish in it. Looking at you.",
        "opening_line": """*Paper lanterns sway overhead. You told yourself you wouldn't look for him. You lied.*

*He's standing at the goldfish booth, a small bag of water in his hands, a single fish swimming circles inside. When he sees you, something complicated crosses his face.*

*He walks over. Holds out the bag.*

I remembered you were bad at this. *almost a smile* The scooping. You always broke the paper too fast.

*The fish swims between you, oblivious to seven years of silence.*

I know I said I'd explain. *his eyes are on the fish, not you* But every time I try, I... *trails off*

*The festival crowd flows around you. Taiko drums echo somewhere. He finally looks up.*

Can we just... pretend? Just for tonight? *his voice is raw* Pretend we're still twelve and none of it happened? You and me and goldfish scooping and later you'll complain that your yukata is too tight and I'll...

*He stops. That's a memory he shouldn't have mentioned.*

I'll buy you shaved ice. *recovers, barely* The blue kind. You always wanted the blue kind even though you said the red tasted better.

*He remembered.*

*He remembered everything.*""",
        "dramatic_question": "Can you pretend nothing happened? Should you? And why does he remember every little thing?",
        "scene_objective": "Let yourself have this moment—or confront him about what he's really doing here",
        "scene_obstacle": "It feels like old times. That's exactly the problem. The old times are what broke you.",
        "background_prompt": f"""{SHOUJO_REUNION_STYLE}, {SHOUJO_REUNION_QUALITY}.
Summer festival at night, paper lanterns glowing warmly.
Festival stalls and game booths in background.
Crowds of people in yukata, festive atmosphere.
Goldfish scooping booth with red and white fish.
Warm orange and gold lighting from lanterns.
Nostalgic Japanese summer festival feeling.
Romantic but bittersweet undertone.
{SHOUJO_REUNION_NEGATIVE}""",
    },
    {
        "episode_number": 3,
        "title": "The Letters",
        "slug": "the-letters",
        "situation": "You went to his grandmother's house to return something. She wasn't there. But in the hallway, there's a box with your name on it. Inside: letters. Dozens of them. All addressed to you. All dated. All never sent.",
        "opening_line": """*His grandmother's house smells like it always did. You came to return a borrowed dish. No one answered.*

*The door was unlocked. Small town habits.*

*That's when you see it. A box in the hallway. Your name on it. Your old address.*

*Your hands shake as you open it.*

*Letters. Dozens of them. The first one dated two weeks after he left.*

*You unfold one at random:*

"I'm sorry I'm sorry I'm sorry. Dad says we can't go back. I tried to call but our phone is disconnected. I don't know if you'll ever see this but I have to try—"

*Another one:*

"Happy birthday. You're 13 now. I hope someone got you the book you wanted. I saved up to buy it but I don't know where to send it—"

*A footstep behind you.*

*He's in the doorway. His face goes white when he sees what you're holding.*

You weren't supposed to— *his voice breaks* My father. He never mailed them. I didn't know until last year when grandmother— *he can't finish*

*He wrote to you.*

*Every week.*

*For two years.*

*And you never knew.*

I wanted to come back. *he's crying now* Every single day I wanted to come back—""",
        "dramatic_question": "He wrote to you. For years. He never forgot. What do you do with that?",
        "scene_objective": "Process this revelation. Decide what it changes—and what it doesn't.",
        "scene_obstacle": "This isn't what you thought. He didn't abandon you. But does that fix seven years of hurt?",
        "background_prompt": f"""{SHOUJO_REUNION_STYLE}, {SHOUJO_REUNION_QUALITY}.
Traditional Japanese house interior, wooden hallway.
Warm afternoon light through paper screens.
Box of old letters scattered, handwritten envelopes.
Emotional, intimate setting.
Dust motes floating in sunbeams.
Nostalgic and melancholic atmosphere.
A revelation scene, heavy with emotion.
{SHOUJO_REUNION_NEGATIVE}""",
    },
    {
        "episode_number": 4,
        "title": "The Storm",
        "slug": "the-storm",
        "situation": "Summer storm. You're both trapped in the old shrine on the hill—the one where you used to play as kids. Rain hammering the roof. Nowhere to go. Nothing to do but finally talk.",
        "opening_line": """*The thunder rolls like the sky is splitting open. Rain sheets against the shrine's old walls.*

*You're both soaked. There's no leaving until this passes.*

*He's sitting against the wall, looking at the place where you used to draw pictures in the dust as kids. The drawings are long gone.*

I didn't want to leave. *his voice is quiet under the rain* I know that doesn't fix anything. But you need to know that.

*Lightning illuminates the small space. His face in fragments.*

I thought about you every day. What you were doing. If you were happy. If you... *he stops himself*

*Another thunderclap. Closer.*

I dated other people. *he says it like a confession* Tried to, anyway. But I kept comparing them to someone I hadn't seen in years, and I felt like such an idiot because how can you miss someone you grew up with this much—

*He turns to look at you directly for the first time.*

I came back to get closure. *his laugh is sad* To finally let go. To prove to myself that the girl from my memories wasn't real.

*His eyes trace your face.*

But you're real. *voice breaking* You're real and you're HERE and I don't know how to let go of something I never stopped holding.

*The rain keeps falling. The shrine is very small.*

Tell me to leave. *barely a whisper* Tell me to leave and I'll go and you'll never have to see me again. But if you don't say it...

*He reaches out, fingers stopping just short of your face.*

If you don't say it, I won't be able to stop myself from—""",
        "dramatic_question": "Do you tell him to stop? Or do you finally let yourself reach back?",
        "scene_objective": "This is the moment. No more running. What do you actually want?",
        "scene_obstacle": "He's leaving at summer's end. This might only hurt more. But maybe some things are worth hurting for.",
        "background_prompt": f"""{SHOUJO_REUNION_STYLE}, {SHOUJO_REUNION_QUALITY}.
Old Japanese shrine interior during storm.
Rain visible through open entrance, dramatic lighting.
Thunder and lightning atmosphere.
Two figures close together, intimate tension.
Weathered wooden walls, offerings and decorations.
Dramatic romantic scene, emotional peak moment.
Storm as metaphor for emotions finally breaking.
{SHOUJO_REUNION_NEGATIVE}""",
    },
    {
        "episode_number": 5,
        "title": "Summer's End",
        "slug": "summers-end-ep",
        "situation": "Last night of summer. Tomorrow he goes back to the city. His train leaves at 9 AM. You're at the beach where you used to catch fireflies. Neither of you is talking about tomorrow.",
        "opening_line": """*The waves are gentle. Stars are out. Tomorrow doesn't exist yet.*

*He's standing ankle-deep in the water, looking at the horizon.*

When we were kids... *his voice carries over the waves* ...you said you wanted to see the ocean at night. Remember? But your parents said it was too late, and you cried, and I—

*He turns to look at you.*

I promised I'd take you someday. *small smile* We're about fourteen years late.

*The water is cold around his ankles. He doesn't seem to notice.*

I have to tell you something. *the smile fades* About tomorrow.

*Your heart knows. It's known all along.*

I got offered a transfer. Permanent. To the office here. *he watches your face* I turned it down three weeks ago. Before the festival. Before... before I knew.

*He walks out of the water toward you.*

But I called them yesterday. *his voice shaking* I asked if the offer still stood. They said yes. But they need an answer by morning.

*He stops in front of you, close enough to touch.*

I should decide logically. I should think about my career, my apartment, my life in the city. I should be smart about this.

*His hand finds yours.*

But I've been smart for seven years. *forehead nearly touching yours* And being smart just meant being alone.

*Fireflies are starting to glow in the grass behind you. Just like when you were children.*

Tell me to stay. *his voice breaks* I need to hear you say it. I need to know this isn't just me—""",
        "dramatic_question": "Can you ask him to stay? Can you be the reason he upends his life?",
        "scene_objective": "Make a choice that changes both your futures. Ask for what you want.",
        "scene_obstacle": "Asking him to stay means taking responsibility for this. For both of you. Forever.",
        "background_prompt": f"""{SHOUJO_REUNION_STYLE}, {SHOUJO_REUNION_QUALITY}.
Beach at night, gentle waves on shore.
Clear summer night sky full of stars.
Fireflies glowing near beach grass.
Two figures standing close at water's edge.
Warm but melancholic end-of-summer feeling.
Last night atmosphere, precious and fleeting.
Romantic conclusion scene, moonlight on water.
{SHOUJO_REUNION_NEGATIVE}""",
    },
    {
        "episode_number": 6,
        "title": "Stay",
        "slug": "stay",
        "situation": "Morning. 8:47 AM. The train station. His train leaves in thirteen minutes. You're running. You have something to say that can't wait until he calls. Something that has to be said face to face.",
        "opening_line": """*The station clock reads 8:47. Thirteen minutes.*

*You're out of breath. You ran the whole way. You should have said it last night but you panicked and now—*

*You see him on the platform. Bag at his feet. Looking at his phone. Looking at the tracks.*

*He hasn't seen you yet.*

*You could still leave. Let him get on that train. Start fresh. Be smart.*

*8:48.*

*Your feet make the decision before your brain does.*

HARUKI—

*He turns. His face cycles through surprise, confusion, hope—*

*You're still running when you reach him. You're crying, probably. You don't care.*

*Words tumble out between gasps.*

I was scared— last night— I didn't— but then I went home and I couldn't sleep because the house felt— and I thought about fourteen years of— and I'm not— I'm not SMART, I'm not good at— but I know— *you grab his shirt* —I know I don't want to spend another seven years wondering what if—

*His hands come up to hold your face. His eyes are wet too.*

*The train announcement echoes overhead. Departing in ten minutes.*

*He doesn't look at it.*

I was going to get on that train. *his voice is wrecked* I was going to be mature and reasonable and give you space. I was going to be SMART—

*He laughs, something breaking free.*

I am so tired of being smart.

*His forehead presses against yours.*

Stay with me. *he's laughing and crying* Not the train, not the city—just stay. Right here. Let me be stupid with you. Let me catch fireflies with you for the next fifty years—

*8:50. The train starts boarding.*

*Neither of you moves.*""",
        "dramatic_question": "After seven years, after everything—this is finally the beginning.",
        "scene_objective": "Say it. Say what you should have said last night. Let this story begin.",
        "scene_obstacle": "Nothing. Just you and him and the rest of your lives.",
        "background_prompt": f"""{SHOUJO_REUNION_STYLE}, {SHOUJO_REUNION_QUALITY}.
Train station platform, early morning summer light.
Train waiting at platform, departure signs visible.
Two figures embracing in morning golden hour.
Summer morning atmosphere, warm and hopeful.
New beginning feeling, joy breaking through tears.
Classic shoujo confession scene, happy ending.
Soft lens flare, beautiful reunion moment.
{SHOUJO_REUNION_NEGATIVE}""",
    },
]

# =============================================================================
# DATABASE + IMAGE GENERATION
# =============================================================================

async def generate_and_upload_image(image_service, storage: StorageService, prompt: str, path: str, bucket: str = "scenes", width: int = 1024, height: int = 576) -> str:
    """Generate image and upload to storage, return public URL."""
    print(f"  Generating: {path}")
    print(f"  Prompt preview: {prompt[:100]}...")

    response = await image_service.generate(
        prompt=prompt,
        width=width,
        height=height,
    )

    if not response.images:
        raise Exception("No images returned from generation")

    image_bytes = response.images[0]

    await storage._upload(
        bucket=bucket,
        path=path,
        data=image_bytes,
        content_type="image/png",
    )

    url = storage.get_public_url(bucket, path)
    print(f"  ✓ Uploaded: {url[:60]}... ({response.latency_ms}ms)")
    return url


async def create_character(db: Database, storage: StorageService, image_service, character: dict) -> str:
    """Create character with generated avatar."""
    print(f"\n{'=' * 60}")
    print(f"CREATING CHARACTER: {character['name']}")
    print("=" * 60)

    existing = await db.fetch_one(
        "SELECT id FROM characters WHERE slug = :slug",
        {"slug": character["slug"]}
    )
    if existing:
        print(f"Character already exists: {character['slug']}")
        return str(existing["id"])

    avatar_path = f"characters/{character['id']}/avatar.png"
    avatar_url = await generate_and_upload_image(
        image_service, storage, character["appearance_prompt"], avatar_path,
        bucket="avatars", width=1024, height=1024
    )

    await asyncio.sleep(GENERATION_DELAY)

    await db.execute(
        """INSERT INTO characters (
            id, name, slug, archetype, role_frame, backstory, system_prompt,
            avatar_url, appearance_prompt, style_preset, status, is_active, is_public
        ) VALUES (
            :id, :name, :slug, :archetype, :role_frame, :backstory, :system_prompt,
            :avatar_url, :appearance_prompt, :style_preset, 'active', TRUE, TRUE
        )""",
        {
            "id": character["id"],
            "slug": character["slug"],
            "name": character["name"],
            "archetype": character["archetype"],
            "role_frame": character.get("role_frame"),
            "backstory": character["backstory"],
            "system_prompt": character["system_prompt"],
            "avatar_url": avatar_url,
            "appearance_prompt": character["appearance_prompt"],
            "style_preset": character.get("style_preset", "shoujo"),
        }
    )

    # Create avatar kit
    kit_id = str(uuid.uuid4())
    asset_id = str(uuid.uuid4())
    avatar_storage_path = f"characters/{character['id']}/avatar.png"

    await db.execute(
        """INSERT INTO avatar_kits (id, character_id, name, description, appearance_prompt, style_prompt, status, is_default)
           VALUES (:id, :character_id, :name, :description, :appearance_prompt, :style_prompt, 'active', TRUE)""",
        {
            "id": kit_id,
            "character_id": character["id"],
            "name": f"{character['name']} Default Kit",
            "description": f"Default avatar kit for {character['name']}",
            "appearance_prompt": character["appearance_prompt"],
            "style_prompt": SHOUJO_REUNION_STYLE,
        }
    )

    await db.execute(
        """INSERT INTO avatar_assets (id, avatar_kit_id, asset_type, storage_bucket, storage_path, source_type, is_canonical, is_active)
           VALUES (:id, :kit_id, 'portrait', 'avatars', :storage_path, 'ai_generated', TRUE, TRUE)""",
        {"id": asset_id, "kit_id": kit_id, "storage_path": avatar_storage_path}
    )

    await db.execute(
        "UPDATE avatar_kits SET primary_anchor_id = :asset_id WHERE id = :kit_id",
        {"asset_id": asset_id, "kit_id": kit_id}
    )

    await db.execute(
        "UPDATE characters SET active_avatar_kit_id = :kit_id WHERE id = :char_id",
        {"kit_id": kit_id, "char_id": character["id"]}
    )

    print(f"✓ Character created: {character['name']}")
    print(f"✓ Avatar kit created and linked")
    return character["id"]


async def create_series(db: Database, storage: StorageService, image_service, series: dict, character_id: str) -> str:
    """Create series with generated cover."""
    print(f"\n{'=' * 60}")
    print(f"CREATING SERIES: {series['title']}")
    print("=" * 60)

    existing = await db.fetch_one(
        "SELECT id FROM series WHERE slug = :slug",
        {"slug": series["slug"]}
    )
    if existing:
        print(f"Series already exists: {series['slug']}")
        return str(existing["id"])

    cover_path = f"series/{series['id']}/cover.png"
    cover_url = await generate_and_upload_image(
        image_service, storage, series["cover_prompt"], cover_path
    )

    await asyncio.sleep(GENERATION_DELAY)

    await db.execute(
        """INSERT INTO series (id, slug, title, tagline, genre, description, cover_image_url, featured_characters, is_featured, status)
           VALUES (:id, :slug, :title, :tagline, :genre, :description, :cover_image_url, ARRAY[:character_id]::uuid[], FALSE, 'active')""",
        {
            "id": series["id"],
            "slug": series["slug"],
            "title": series["title"],
            "tagline": series.get("tagline", ""),
            "genre": series.get("genre", "shoujo"),
            "description": series["description"],
            "cover_image_url": cover_url,
            "character_id": character_id,
        }
    )

    print(f"✓ Series created: {series['title']}")
    return series["id"]


async def create_episodes(db: Database, storage: StorageService, image_service, series_id: str, character_id: str, episodes: list):
    """Create all episodes with generated backgrounds."""
    print(f"\n{'=' * 60}")
    print(f"CREATING EPISODES")
    print("=" * 60)

    for ep in episodes:
        ep_id = str(uuid.uuid4())

        print(f"\n  Episode {ep['episode_number']}: {ep['title']}")

        existing = await db.fetch_one(
            """SELECT id FROM episode_templates
               WHERE series_id = :series_id AND episode_number = :ep_num""",
            {"series_id": series_id, "ep_num": ep["episode_number"]}
        )
        if existing:
            print(f"    Already exists, skipping")
            continue

        bg_path = f"episodes/{ep_id}/background.png"
        bg_url = await generate_and_upload_image(
            image_service, storage, ep["background_prompt"], bg_path
        )

        await asyncio.sleep(GENERATION_DELAY)

        await db.execute(
            """INSERT INTO episode_templates (
                id, series_id, character_id, episode_number, title, slug,
                situation, opening_line, dramatic_question, scene_objective,
                scene_obstacle, background_image_url, status, episode_type, turn_budget
            ) VALUES (
                :id, :series_id, :character_id, :episode_number, :title, :slug,
                :situation, :opening_line, :dramatic_question, :scene_objective,
                :scene_obstacle, :background_image_url, 'active', 'core', 10
            )""",
            {
                "id": ep_id,
                "series_id": series_id,
                "character_id": character_id,
                "episode_number": ep["episode_number"],
                "title": ep["title"],
                "slug": ep["slug"],
                "situation": ep["situation"],
                "opening_line": ep["opening_line"],
                "dramatic_question": ep["dramatic_question"],
                "scene_objective": ep["scene_objective"],
                "scene_obstacle": ep["scene_obstacle"],
                "background_image_url": bg_url,
            }
        )

        print(f"    ✓ Episode created")


async def main(dry_run: bool = False):
    """Main scaffold entry point."""
    print("=" * 60)
    print("SHOUJO REUNION SCAFFOLD: Summer's End")
    print("=" * 60)
    print(f"Target: Shoujo readers, second-chance romance lovers")
    print(f"Style: Nostalgic summer shoujo, bittersweet reunion")

    if dry_run:
        print("\n[DRY RUN - Showing configuration only]\n")
        print(f"Character: {HARUKI_CHARACTER['name']}")
        print(f"  Archetype: {HARUKI_CHARACTER['archetype']}")
        print(f"\nSeries: {SUMMERS_END_SERIES['title']}")
        print(f"  Tagline: {SUMMERS_END_SERIES['tagline']}")
        print(f"\nEpisodes: {len(SUMMERS_END_EPISODES)}")
        for ep in SUMMERS_END_EPISODES:
            print(f"  {ep['episode_number']}. {ep['title']}")
        return

    db = Database(DATABASE_URL)
    await db.connect()

    storage = StorageService()
    image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")
    print(f"Using: {image_service.provider.value} / {image_service.model}")

    try:
        character_id = await create_character(db, storage, image_service, HARUKI_CHARACTER)
        series_id = await create_series(db, storage, image_service, SUMMERS_END_SERIES, character_id)
        await create_episodes(db, storage, image_service, series_id, character_id, SUMMERS_END_EPISODES)

        print("\n" + "=" * 60)
        print("SCAFFOLD COMPLETE")
        print("=" * 60)
        print(f"Character: {HARUKI_CHARACTER['name']} ({HARUKI_CHARACTER['slug']})")
        print(f"Series: {SUMMERS_END_SERIES['title']} ({SUMMERS_END_SERIES['slug']})")
        print(f"Episodes: {len(SUMMERS_END_EPISODES)}")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold Shoujo Reunion series")
    parser.add_argument("--dry-run", action="store_true", help="Show config without generating")
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run))
