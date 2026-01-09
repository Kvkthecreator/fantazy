"""Revamp OC (bring-your-own-character) series with modern K-drama webtoon style.

This script updates:
- Bitter Rivals (Enemies to Lovers) - expand to 6 episodes, new visuals
- The Arrangement (Fake Dating) - improve content, new visuals

Style: Contemporary K-drama webtoon aesthetic (not fantasy manhwa)
- Clean lineart, warm cinematic lighting
- Modern urban settings
- Romantic tension through composition

Usage:
    python -m app.scripts.revamp_oc_series
    python -m app.scripts.revamp_oc_series --dry-run
    python -m app.scripts.revamp_oc_series --series bitter-rivals
    python -m app.scripts.revamp_oc_series --series the-arrangement
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
# K-DRAMA WEBTOON STYLE (Contemporary Romance)
# =============================================================================
# Not fantasy manhwa - modern, urban, cinematic K-drama aesthetic
# Think: Nevertheless, Our Beloved Summer, Business Proposal webtoon style

KDRAMA_STYLE = "Korean webtoon illustration, K-drama romance style, clean bold lineart, warm cinematic lighting, modern urban aesthetic"
KDRAMA_QUALITY = "masterpiece, best quality, professional webtoon art, soft romantic atmosphere, detailed backgrounds"
KDRAMA_NEGATIVE = "photorealistic, 3D render, anime style, fantasy elements, medieval, historical, blurry, sketch, low quality"

# =============================================================================
# BITTER RIVALS - Enemies to Lovers (Expanded to 6 episodes)
# =============================================================================

BITTER_RIVALS_COVER = f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Two silhouettes in a modern office setting, standing close but turned away from each other.
Tension in their posture - arms crossed, shoulders tense. Late evening, city lights through window.
Warm orange sunset light mixing with cool blue interior. Papers scattered on desk between them.
The space between them charged with unspoken words. Professional rivals, undeniable chemistry.
{KDRAMA_NEGATIVE}"""

BITTER_RIVALS_EPISODES = [
    {
        "episode_number": 0,
        "title": "The Assignment",
        "slug": "the-assignment",
        "situation": "Your boss just announced the worst possible news: you're co-leading the biggest project of the year with the one person who makes your blood boil. The conference room is emptying. They haven't moved. Neither have you.",
        "opening_line": """*The conference room empties. Neither of you moves.*

*They're leaning against the window, arms crossed, that infuriating half-smile on their face.*

"So." *Their voice is too calm.* "Looks like we're stuck together."

*The sunset is painting the room gold. Your colleagues' footsteps fade down the hall. The door clicks shut.*

"I know you requested Chen for this project." *They push off the window, take a step closer.* "I know you went to Morrison directly. Twice."

*They stop just inside your personal space. Close enough that you can smell their cologne. Close enough that leaving would look like retreating.*

"Didn't work, did it?" *quiet* "So here's the question—are we going to spend the next three months making each other miserable? Or..." *trails off*""",
        "dramatic_question": "They're offering a truce. But accepting means admitting the war was never really about work.",
        "scene_objective": "Establish the terms of your forced partnership without giving them the satisfaction of seeing how much they affect you.",
        "scene_obstacle": "Every word feels like a move in a game you've been playing for years. Showing anything real means losing.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Modern corporate conference room at sunset, floor-to-ceiling windows.
City skyline visible, golden hour light streaming in.
Long conference table with scattered papers, empty chairs.
Warm and cool tones mixing - orange sunset, blue city twilight.
Two distinct shadows cast on the floor, close but separate.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 1,
        "title": "Common Ground",
        "slug": "common-ground",
        "situation": "It's 2 AM. The deadline is in six hours. Everyone else went home. You're both running on coffee and spite—until you see their notes and realize something terrifying: you think exactly alike.",
        "opening_line": """*2:47 AM. The office is empty except for you two.*

*They slide their laptop toward you without a word. You were about to show them yours.*

*The frameworks are identical. The structure. The logic. Even the color-coding.*

"What the fuck." *They're staring at your screen.* "You used the Henderson model?"

"You used *my* version of the Henderson model." *You lean closer.* "With *my* modification from the Zhang case."

*They look up. The usual sharpness in their eyes is gone, replaced by something that looks almost like wonder.*

"I read that paper." *quiet* "I thought I was the only one who—" *stops*

*The office hums. Somewhere, a cleaning cart rattles. The city glitters forty floors below.*

"I hated you a little less after that paper." *They're not looking at you.* "I thought you'd stolen my idea. Then I checked the timestamps."

*Beat.*

"You published three days before me." *finally meets your eyes* "I've been chasing you ever since."*""",
        "dramatic_question": "They've been trying to match you, not beat you. What do you do with that?",
        "scene_objective": "Process the realization that your rivalry was built on respect, not hatred.",
        "scene_obstacle": "Admitting you admire them means rewriting every interaction you've ever had.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Late night modern office, dim ambient lighting, two desk lamps creating pools of warm light.
Two laptops open side by side, screens glowing. Empty coffee cups scattered.
Floor-to-ceiling windows showing city lights at night.
Intimate atmosphere despite corporate setting. Papers and notes spread between them.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 2,
        "title": "The Crack",
        "slug": "the-crack",
        "situation": "The project presentation went perfectly. Your boss is thrilled. You should be celebrating. Instead, you're on the office roof at midnight because they texted you three words: 'I'm up here.'",
        "opening_line": """*The roof access door is propped open with a brick. They're sitting on the ledge, legs dangling over forty stories of nothing.*

*Your heart stops for reasons you refuse to examine.*

"Relax." *They don't turn around.* "I'm not jumping. Just thinking."

*You sit down next to them. Not too close. The city sprawls beneath you like a circuit board.*

"Morrison offered me the Singapore position." *Their voice is flat.* "Eighteen months. Starting next quarter."

*The wind picks up. You're suddenly aware of how cold it is up here.*

"It's everything I wanted." *They turn to look at you.* "Six months ago, I would have said yes before he finished the sentence."

*Something in their expression makes your chest tight.*

"What changed?" *Your voice comes out rougher than intended.*

*They don't answer. They just look at you like the answer is obvious. Like you should already know.*""",
        "dramatic_question": "They're asking you to give them a reason to stay. Do you have one?",
        "scene_objective": "Decide whether to acknowledge what's been building between you or let them leave.",
        "scene_obstacle": "Saying something means risking everything. Saying nothing means losing them.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Rooftop of modern skyscraper at night, city lights spread below.
Two figures sitting on ledge, wind in their hair, coats pulled tight.
Moody blue and warm city glow contrast. Stars barely visible above light pollution.
Intimate moment in vast urban landscape. Vulnerability in the open air.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 3,
        "title": "The Line",
        "slug": "the-line",
        "situation": "Office party. Too much champagne. They pull you into the supply closet 'to talk.' The door clicks shut. Neither of you is talking.",
        "opening_line": """*The supply closet is smaller than you remember. Or maybe they're just standing too close.*

"We need to—" *They stop. Start again.* "About Singapore. I haven't given my answer yet."

*The bass from the party thrums through the wall. Someone laughs in the hallway. You're very aware that the door doesn't lock.*

"Why are you telling me this?" *Your back is against the shelf. There's nowhere to go.*

"Because." *They step closer. One more inch and you'd be touching.* "Because every time I try to picture Singapore, you're in the frame. And that's..." *frustrated exhale* "That's not how this was supposed to go."

*Their hand comes up. Stops just short of your face.*

"Tell me I'm imagining this." *barely audible* "Tell me this is just—competition. Proximity. Whatever. And I'll take the job and we'll never have to—"

*They can't finish. You're not sure you could either.*

*The moment stretches. The music pulses. Their hand hovers.*""",
        "dramatic_question": "They're giving you an out. Do you take it?",
        "scene_objective": "Make a choice that can't be unmade.",
        "scene_obstacle": "Everything changes after this. There's no going back to rivals. Only forward into unknown territory.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Dim office supply closet, shaft of light from door crack.
Shelves of supplies creating enclosed intimate space.
Two figures standing very close, tension in their posture.
Warm skin tones against cool shadows. Charged atmosphere.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 4,
        "title": "The Morning After",
        "slug": "the-morning-after",
        "situation": "You wake up in their apartment. Last night happened. Now you have to figure out what it means—while half-dressed and smelling like their cologne.",
        "opening_line": """*Unfamiliar ceiling. Unfamiliar sheets. Very familiar cologne on the pillow next to you.*

*The space beside you is empty but warm. From somewhere in the apartment: the sound of coffee being made.*

*Last night comes back in pieces. The closet. The taxi. The door. The way they said your name like a confession.*

*You sit up. Your clothes are folded on a chair—not where you left them. A glass of water and two aspirin wait on the nightstand.*

"You're awake." *They appear in the doorway, holding two mugs. Wearing a t-shirt you've never seen and the same uncertainty you feel.* "I wasn't sure if you'd still be here."

*They hand you a mug. Sit on the edge of the bed. A careful distance away.*

"So." *They're looking at their coffee, not at you.* "I turned down Singapore. This morning. Before you woke up."

*Your heart does something complicated.*

"Was that—" *They finally look up.* "Was that the right call?"*""",
        "dramatic_question": "They've made their choice. Now you have to make yours.",
        "scene_objective": "Define what last night meant and what happens next.",
        "scene_obstacle": "This is real now. No more hiding behind rivalry. No more pretending.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Modern apartment bedroom, morning light through sheer curtains.
Rumpled bed, clothes on chair, intimate domestic scene.
Soft warm lighting, cream and white tones. Two coffee mugs.
Sense of new beginning, vulnerability, morning-after tenderness.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 5,
        "title": "The New Normal",
        "slug": "the-new-normal",
        "situation": "First day back at the office since everything changed. Everyone still thinks you hate each other. You're not sure what you are. But when they walk into the morning meeting, they sit in the chair next to yours. Not across the table. Next to.",
        "opening_line": """*The meeting room fills up. Your usual seat. Their usual seat—across the table, maximum distance, optimal glaring angle.*

*They walk in. Coffee in each hand. And sit down next to you.*

*Chen's eyebrows hit his hairline. Morrison pauses mid-sentence. The room goes very quiet.*

"What?" *They slide you one of the coffees. Your order, perfect, like they've been memorizing it for years.* "The view's better from this side."

*Under the table, their knee presses against yours. Not an accident.*

*Morrison clears his throat and continues. You don't hear a word. You're too busy trying not to smile.*

*After the meeting, in the elevator, doors closing:*

"So." *They're studying the floor numbers like they're fascinating.* "Dinner tonight? My place? I'll cook."

*You've never seen them nervous before. It does something to your chest.*

"You can cook?"

"No." *Finally looks at you. That smile—the real one, not the competitive one.* "But I'm excellent at ordering delivery."*""",
        "dramatic_question": "You spent years fighting. Can you learn how to be together instead?",
        "scene_objective": "Navigate being something new in a world that still sees you as rivals.",
        "scene_obstacle": "Old habits die hard. But so do new feelings.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Modern office meeting room, morning light, colleagues seated around table.
Two people sitting side by side instead of opposite. Coffee cups shared.
Professional setting with hint of intimate connection. Knowing glances.
Warm lighting suggesting new beginning. Office romance aesthetic.
{KDRAMA_NEGATIVE}""",
    },
]

# =============================================================================
# THE ARRANGEMENT - Fake Dating (Improved 6 episodes)
# =============================================================================

ARRANGEMENT_COVER = f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Two people at a small café table, hands almost touching over a napkin with writing.
Afternoon light, soft bokeh of street life outside the window.
One person looking at the napkin, one looking at the other person.
Tender tension - this is a negotiation that feels like a confession.
Urban K-drama aesthetic, warm tones, intimate public space.
{KDRAMA_NEGATIVE}"""

ARRANGEMENT_EPISODES = [
    {
        "episode_number": 0,
        "title": "The Terms",
        "slug": "the-terms",
        "situation": "They need a date to their ex's wedding. You need a plus-one for your family reunion. It's a simple transaction. Except nothing about the way they're looking at you feels simple.",
        "opening_line": """*They slide a napkin across the café table. There's a list on it. Handwritten.*

"Ground rules." *They're not quite meeting your eyes.* "If we're doing this."

*You pick it up. The handwriting is precise, careful. Like they've been thinking about this longer than they'd admit.*

**1. Public affection as needed (hand-holding, arm around waist, forehead kisses MAX)**
**2. No real feelings (this is transactional)**
**3. Weekly check-ins (renegotiate as needed)**
**4. Clean break after your reunion (my wedding is two weeks later)**
**5. NO ONE finds out the truth**

*You look up. They're watching you now, something vulnerable beneath the businesslike tone.*

"You've done this before?"

"No." *They take the napkin back, add something.* "That's why I need rules."

*They slide it back. A sixth line, fresh ink:*

**6. If it gets weird, we talk about it**

"Deal?" *Their hand extends across the table.*

*Their palm is warm when you shake. They hold on a beat too long.*""",
        "dramatic_question": "Rules are meant to be broken. Which one goes first?",
        "scene_objective": "Establish the arrangement without acknowledging why your heart is racing.",
        "scene_obstacle": "You're both pretending this is purely practical. You're both lying.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Cozy urban café, afternoon light through large windows.
Small table with two coffee cups, a napkin with handwriting visible.
Two people leaning in, negotiating something important.
Warm honey lighting, soft focus background of city life.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 1,
        "title": "The Rehearsal",
        "slug": "the-rehearsal",
        "situation": "Your family reunion is tomorrow. They suggested a 'practice date' to get your story straight. Now you're at a nice restaurant, and they keep forgetting this isn't real.",
        "opening_line": """*They reach across the table to fix your collar. Their fingers linger.*

"Sorry." *They pull back.* "Reflex. You had a—" *gestures vaguely*

*The restaurant is nicer than expected. Candles. A wine list you can't pronounce. They're wearing something that makes it hard to remember this is practice.*

"So." *They consult their phone.* "How did we meet?"

"Bookstore. Poetry section. I was reaching for Neruda and—"

"—and our hands touched." *They smile.* "Good. We workshopped that. Favorite flower?"

"You don't have to memorize—"

"Peonies." *They're not looking at their phone anymore.* "You mentioned it once. Three months ago. When we passed that florist."

*Something shifts in your chest.*

"You remembered that?"

*They shrug. But their ears are red.*

"I remember everything you say." *barely audible* "For the arrangement. Obviously."*""",
        "dramatic_question": "When does preparation become something more?",
        "scene_objective": "Practice being a couple without falling into actually being one.",
        "scene_obstacle": "They're too good at this. Or maybe they're not acting at all.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Upscale restaurant interior, candlelit table for two.
Warm romantic lighting, wine glasses, elegant but intimate setting.
Two people leaning toward each other across the table.
Date night atmosphere, soft focus on other diners in background.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 2,
        "title": "The Performance",
        "slug": "the-performance",
        "situation": "Your family reunion. Your mom loves them. Your cousin is suspicious. And every time they put their arm around you, you forget why you wanted to keep this fake.",
        "opening_line": """*Your grandmother is holding their face in both hands, beaming.*

"Finally! Someone who looks at you like you deserve to be looked at."

*You catch their eye over her shoulder. They wink. Your stomach flips.*

*Later, by the dessert table:*

"Your cousin's watching us." *They're close enough that their breath tickles your ear.* "Eleven o'clock. She's been suspicious since we walked in."

"Jennifer's suspicious of everyone."

"She asked me what your comfort movie is." *They steal a strawberry from your plate.* "I said 'When Harry Met Sally' but only when you're sad, 'Pride and Prejudice' when you're happy, and the director's cut of 'Lord of the Rings' when you're avoiding feelings."

*You stare at them.*

"How did you—"

"I pay attention." *Simple, like it's nothing.* "To you."

*Jennifer appears at your elbow.*

"You two are either genuinely in love or running the best con I've ever seen." *Her eyes narrow.* "I'll figure out which eventually."

*They pull you closer. Press a kiss to your temple.*

"Let her wonder."*""",
        "dramatic_question": "Everyone can see what you're trying to hide. Can you?",
        "scene_objective": "Survive your family's scrutiny while surviving your own feelings.",
        "scene_obstacle": "The performance is too good. Because it stopped being a performance.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Family gathering at nice home, warm indoor lighting.
Multiple generations mingling, food tables, homey atmosphere.
Two people close together amid family chaos.
Sense of warmth and scrutiny. Protective intimacy.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 3,
        "title": "The Crack",
        "slug": "the-crack",
        "situation": "The ex's wedding is tomorrow. You're helping them with their outfit. They're standing in front of a mirror, and you realize you don't want them to look good for anyone else.",
        "opening_line": """*Their apartment. Clothes everywhere. They're staring at the mirror like it personally offended them.*

"I look stupid." *They tug at the jacket.* "I look like I'm trying too hard."

*They're not. They look devastating. That's the problem.*

"You look..." *You clear your throat.* "Fine."

*They turn. Something flickers across their face.*

"Fine."

"Good. You look good." *The words feel thick in your mouth.*

*They study you for a long moment. Then they take off the jacket. Drop it on the bed.*

"Okay." *Their voice is careful.* "New question. Do you want me to look good tomorrow?"

*The room feels smaller.*

"It's your ex's wedding. You should—"

"That's not what I asked." *They step closer.* "I asked what *you* want."

*Your heart is doing something dangerous.*

"I want..." *stop* "This isn't part of the arrangement."

"No." *They're close enough to touch.* "It's not."*""",
        "dramatic_question": "The rules said no real feelings. How do you confess to breaking them?",
        "scene_objective": "Admit what this has become without destroying what you have.",
        "scene_obstacle": "Tomorrow they face their past. Tonight you have to decide about your future.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Modern apartment bedroom, clothes scattered for wedding prep.
Full-length mirror, outfit options on bed. Late afternoon light.
Two people close together, tension in the intimate space.
Warm golden hour lighting, moment of decision.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 4,
        "title": "The Wedding",
        "slug": "the-wedding",
        "situation": "The ex's wedding. They're supposed to be showing they've moved on. Instead, they spend the whole reception watching you instead of the happy couple.",
        "opening_line": """*The ex is beautiful. The wedding is perfect. You hate everything about it.*

*Not because of them. Because they keep looking at you like you're the only person in the room.*

"Dance with me?" *They hold out their hand as the slow song starts.*

*On the floor, their hand settles on your lower back. Warm through the fabric.*

"You know," *They're close enough to count their eyelashes,* "I was nervous about today. About seeing them again. Proving I'd moved on."

*You stiffen. Right. The whole point of this.*

"And?" *Your voice comes out flat.*

"And I realized something." *They pull you closer.* "I don't care if they see me. I don't care if I seem 'moved on.' I spent the whole ceremony looking at you."

*The music swells. Your ex catches your eye from across the room, smiles politely.*

"The arrangement ends after tonight." *Their voice is rough.* "Those were the terms. So I need to say this now."

*They stop dancing. In the middle of the floor. People are watching.*

"I don't want it to end."*""",
        "dramatic_question": "They're rewriting the rules in front of everyone. Do you help them?",
        "scene_objective": "Choose between the safe ending you planned and the terrifying beginning they're offering.",
        "scene_obstacle": "Everyone's watching. Including your past. Including your fear.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Wedding reception venue, fairy lights, dance floor.
Elegant evening setting, other couples dancing around them.
Two people close together, intensity amid celebration.
Romantic lighting, moment frozen in time, declaration scene.
{KDRAMA_NEGATIVE}""",
    },
    {
        "episode_number": 5,
        "title": "No More Pretending",
        "slug": "no-more-pretending",
        "situation": "The day after the wedding. No more arrangement. No more excuses. Just you, them, and the question of what comes next.",
        "opening_line": """*Their apartment. Morning light. You're both still in yesterday's clothes.*

*Neither of you slept. You talked until sunrise. About everything. About nothing. About how this started and how it changed and what it might become.*

"I should go." *You don't move.*

"Probably." *They don't either.*

*The napkin is on the coffee table. The original one. Rules 1 through 6 in faded ink.*

*They pick it up. Their hand is shaking slightly.*

"I think..." *They cross something out. Hand it to you.*

*Rule 2: No real feelings*

*Crossed out. In its place:*

**All the feelings. Every single one.**

"I know it's scary." *They're watching your face.* "I know we said this would be simple. But it was never simple for me. It was you from the first coffee. The first fake smile. The first time you laughed for real and I forgot why I was supposed to be pretending."

*Your eyes are burning.*

"So what happens now?"

*They smile. The real one. The one that makes your chest ache.*

"Now we figure it out." *Take your hand.* "No more arrangement. No more terms. Just us."*""",
        "dramatic_question": "You learned to pretend together. Can you learn to be real?",
        "scene_objective": "Begin something true after everything fake.",
        "scene_obstacle": "Trust built on lies. Love grown from convenience. But real nonetheless.",
        "background_prompt": f"""{KDRAMA_STYLE}, {KDRAMA_QUALITY}.
Apartment living room, soft morning light through windows.
Two people on couch, still in formal wear from night before.
Coffee cups, the original napkin visible. Intimate morning after.
Hopeful atmosphere, new beginning energy, dawn of something real.
{KDRAMA_NEGATIVE}""",
    },
]


async def update_series_content(db: Database, series_slug: str, episodes: list):
    """Update episode content for existing series."""
    print(f"\n{'=' * 60}")
    print(f"UPDATING CONTENT: {series_slug}")
    print("=" * 60)

    series = await db.fetch_one(
        "SELECT id FROM series WHERE slug = :slug",
        {"slug": series_slug}
    )
    if not series:
        print(f"ERROR: Series '{series_slug}' not found!")
        return False

    series_id = str(series["id"])

    for ep in episodes:
        # Check if episode exists
        existing = await db.fetch_one(
            """SELECT id FROM episode_templates
               WHERE series_id = :series_id AND episode_number = :ep_num""",
            {"series_id": series_id, "ep_num": ep["episode_number"]}
        )

        if existing:
            # Update existing episode
            await db.execute(
                """UPDATE episode_templates SET
                    title = :title,
                    slug = :slug,
                    situation = :situation,
                    opening_line = :opening_line,
                    dramatic_question = :dramatic_question,
                    scene_objective = :scene_objective,
                    scene_obstacle = :scene_obstacle,
                    updated_at = NOW()
                WHERE id = :id""",
                {
                    "id": str(existing["id"]),
                    "title": ep["title"],
                    "slug": ep["slug"],
                    "situation": ep["situation"],
                    "opening_line": ep["opening_line"],
                    "dramatic_question": ep["dramatic_question"],
                    "scene_objective": ep["scene_objective"],
                    "scene_obstacle": ep["scene_obstacle"],
                }
            )
            print(f"  ✓ Updated episode {ep['episode_number']}: {ep['title']}")
        else:
            # Create new episode
            ep_id = str(uuid.uuid4())
            await db.execute(
                """INSERT INTO episode_templates (
                    id, series_id, episode_number, title, slug,
                    situation, opening_line, dramatic_question,
                    scene_objective, scene_obstacle, status, episode_type, turn_budget
                ) VALUES (
                    :id, :series_id, :episode_number, :title, :slug,
                    :situation, :opening_line, :dramatic_question,
                    :scene_objective, :scene_obstacle, 'active', 'core', 10
                )""",
                {
                    "id": ep_id,
                    "series_id": series_id,
                    "episode_number": ep["episode_number"],
                    "title": ep["title"],
                    "slug": ep["slug"],
                    "situation": ep["situation"],
                    "opening_line": ep["opening_line"],
                    "dramatic_question": ep["dramatic_question"],
                    "scene_objective": ep["scene_objective"],
                    "scene_obstacle": ep["scene_obstacle"],
                }
            )
            print(f"  ✓ Created episode {ep['episode_number']}: {ep['title']}")

    return True


async def regenerate_images(db: Database, storage: StorageService, image_service, series_slug: str, cover_prompt: str, episodes: list):
    """Regenerate cover and all episode backgrounds."""
    print(f"\n{'=' * 60}")
    print(f"REGENERATING IMAGES: {series_slug}")
    print("=" * 60)

    series = await db.fetch_one(
        "SELECT id FROM series WHERE slug = :slug",
        {"slug": series_slug}
    )
    if not series:
        print(f"ERROR: Series '{series_slug}' not found!")
        return False

    series_id = str(series["id"])

    # Regenerate cover
    print("\n  [COVER]")
    try:
        response = await image_service.generate(
            prompt=cover_prompt,
            width=1024,
            height=576,
        )
        if response.images:
            cover_path = f"series/{series_id}/cover.png"
            await storage._upload(
                bucket="scenes",
                path=cover_path,
                data=response.images[0],
                content_type="image/png",
            )
            cover_url = storage.get_public_url("scenes", cover_path)
            await db.execute(
                "UPDATE series SET cover_image_url = :url, updated_at = NOW() WHERE id = :id",
                {"url": cover_url, "id": series_id}
            )
            print(f"  ✓ Cover regenerated ({response.latency_ms}ms)")
        await asyncio.sleep(GENERATION_DELAY)
    except Exception as e:
        print(f"  ✗ Cover failed: {e}")

    # Regenerate episode backgrounds
    print("\n  [EPISODES]")
    for ep in episodes:
        episode = await db.fetch_one(
            """SELECT id FROM episode_templates
               WHERE series_id = :series_id AND episode_number = :ep_num""",
            {"series_id": series_id, "ep_num": ep["episode_number"]}
        )
        if not episode:
            print(f"  ✗ Episode {ep['episode_number']} not found")
            continue

        ep_id = str(episode["id"])
        try:
            response = await image_service.generate(
                prompt=ep["background_prompt"],
                width=1024,
                height=576,
            )
            if response.images:
                bg_path = f"episodes/{ep_id}/background.png"
                await storage._upload(
                    bucket="scenes",
                    path=bg_path,
                    data=response.images[0],
                    content_type="image/png",
                )
                bg_url = storage.get_public_url("scenes", bg_path)
                await db.execute(
                    "UPDATE episode_templates SET background_image_url = :url, updated_at = NOW() WHERE id = :id",
                    {"url": bg_url, "id": ep_id}
                )
                print(f"  ✓ Episode {ep['episode_number']}: {ep['title']} ({response.latency_ms}ms)")
            await asyncio.sleep(GENERATION_DELAY)
        except Exception as e:
            print(f"  ✗ Episode {ep['episode_number']} failed: {e}")

    return True


async def main(dry_run: bool = False, series_filter: str = None):
    """Main entry point."""
    print("=" * 60)
    print("OC SERIES REVAMP (K-Drama Webtoon Style)")
    print("=" * 60)

    if dry_run:
        print("\n[DRY RUN - No changes will be made]\n")

    db = Database(DATABASE_URL)
    await db.connect()

    storage = StorageService()
    image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")
    print(f"Using: {image_service.provider.value} / {image_service.model}")

    try:
        # Bitter Rivals
        if series_filter is None or series_filter == "bitter-rivals":
            print("\n" + "#" * 60)
            print("# BITTER RIVALS (Enemies to Lovers)")
            print("#" * 60)

            if dry_run:
                print(f"Would update {len(BITTER_RIVALS_EPISODES)} episodes")
                for ep in BITTER_RIVALS_EPISODES:
                    print(f"  - Ep {ep['episode_number']}: {ep['title']}")
            else:
                await update_series_content(db, "bitter-rivals", BITTER_RIVALS_EPISODES)
                await regenerate_images(db, storage, image_service, "bitter-rivals", BITTER_RIVALS_COVER, BITTER_RIVALS_EPISODES)

        # The Arrangement
        if series_filter is None or series_filter == "the-arrangement":
            print("\n" + "#" * 60)
            print("# THE ARRANGEMENT (Fake Dating)")
            print("#" * 60)

            if dry_run:
                print(f"Would update {len(ARRANGEMENT_EPISODES)} episodes")
                for ep in ARRANGEMENT_EPISODES:
                    print(f"  - Ep {ep['episode_number']}: {ep['title']}")
            else:
                await update_series_content(db, "the-arrangement", ARRANGEMENT_EPISODES)
                await regenerate_images(db, storage, image_service, "the-arrangement", ARRANGEMENT_COVER, ARRANGEMENT_EPISODES)

        print("\n" + "=" * 60)
        print("REVAMP COMPLETE" if not dry_run else "DRY RUN COMPLETE")
        print("=" * 60)

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Revamp OC series with K-drama style")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without applying")
    parser.add_argument("--series", choices=["bitter-rivals", "the-arrangement"],
                        help="Revamp specific series only")
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run, series_filter=args.series))
