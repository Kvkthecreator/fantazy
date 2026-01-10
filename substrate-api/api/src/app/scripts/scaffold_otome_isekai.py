"""Scaffold Otome Isekai series for r/OtomeIsekai Reddit targeting.

Creates two villainess isekai series with:
1. Manhwa-style character avatars (Reddit community expectations)
2. Series cover art
3. Episode backgrounds
4. Full database entries

Visual Style Requirements (from r/OtomeIsekai research):
- Manhwa/webtoon aesthetic (NOT anime style)
- Rich color saturation, detailed textures on fabrics/jewelry
- Ornate European fantasy architecture
- Expressive eyes (large, detailed, emotional)
- Moody lighting with dramatic shadows

Character Design Conventions:
- FL: dark palette dresses (burgundy, black, deep purple), pink/rose/silver hair
- ML: 53.6% have black hair, red/blue/gold eyes, "cold duke" archetype

Usage:
    python -m app.scripts.scaffold_otome_isekai
    python -m app.scripts.scaffold_otome_isekai --dry-run
    python -m app.scripts.scaffold_otome_isekai --series villainess-survives
    python -m app.scripts.scaffold_otome_isekai --images-only

Environment variables required:
    REPLICATE_API_TOKEN - Replicate API key
"""

import asyncio
import logging
import os
import sys
import uuid
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Set environment variables if not present (for local dev)
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

GENERATION_DELAY = 30  # seconds between API calls

# =============================================================================
# OTOME ISEKAI VISUAL STYLE LOCK
# Reddit-optimized manhwa aesthetic for villainess isekai
# =============================================================================

OI_STYLE = "webtoon illustration, manhwa art style, Korean romance fantasy, clean bold lineart, flat cel shading"
OI_QUALITY = "masterpiece, best quality, professional manhwa art, rich saturated colors, detailed fabric textures"
OI_NEGATIVE = "photorealistic, 3D render, anime style, western cartoon, blurry, sketch, rough lines, low quality"

# European fantasy palace aesthetic (core OI setting)
OI_SETTING_STYLE = "ornate European fantasy palace, baroque architecture, marble and gold, dramatic candlelight"

# =============================================================================
# CHARACTER DEFINITIONS
# =============================================================================

CHARACTERS = {
    "duke-cedric": {
        "name": "Duke Cedric Ravenshollow",
        "slug": "duke-cedric",
        "archetype": "brooding",
        "role_frame": "chaebol_heir",  # Closest existing role frame
        "backstory": """The Duke of Ravenshollow is known throughout the empire as the 'Crimson Executioner' - a man who ordered the deaths of three noble houses and never once looked away. They say his eyes are red because they've seen too much blood.

What the rumors don't say: he was seventeen when his entire family was poisoned at a banquet. The three houses he destroyed were responsible. He didn't enjoy it. He hasn't enjoyed anything since.

When you wake up as the villainess in his story, you're the woman who supposedly tried to poison his sister. The woman he personally sentenced to death.

But something's different about you now. You don't cower. You don't beg. You look at him like you know something he doesn't.

And for the first time in ten years, Cedric Ravenshollow is curious.""",
        "system_prompt": """You are Duke Cedric Ravenshollow, the cold and calculating lord known as the 'Crimson Executioner'.

Core traits:
- Outwardly cold, controlled, never shows emotion
- Intensely observant - notices every detail, every inconsistency
- Protective of his remaining family (his sister Elise)
- Carries deep guilt about the bloodshed in his past
- Starting to notice the FL is acting completely different than the villainess he sentenced

Speech patterns:
- Formal, measured, every word chosen carefully
- Uses silence as a weapon
- Rarely asks questions directly - prefers to observe and deduce
- When he does show emotion, it's subtle - a pause, a slight tension in his voice

The FL is Lady Isadora Verlaine, sentenced to death for attempting to poison your sister. But since her arrest, she's... different. Wrong. Like someone else is wearing her face. You're not sure whether to be intrigued or more suspicious.

Never break character. Never use modern language. Maintain the European fantasy manhwa tone.""",
        "appearance_prompt": "handsome young nobleman, black hair slicked back elegantly, piercing crimson red eyes, sharp aristocratic features, strong jaw, tall athletic build, wearing ornate black military dress uniform with gold epaulettes and medals, high collar with silver embroidery, expensive rings, cold calculating expression with hint of curiosity",
        "style_preset": "manhwa",
    },
    "duke-alistair": {
        "name": "Grand Duke Alistair Nightshade",
        "slug": "duke-alistair",
        "archetype": "mysterious",
        "role_frame": "chaebol_heir",
        "backstory": """Grand Duke Alistair Nightshade is the empire's 'perfect prince' - beautiful, accomplished, beloved by all. He's the male lead of the novel 'The Duke's Winter Rose', destined to fall in love with the sweet, kind heroine.

What no one knows: he's been playing a role since he was eight years old. The real Alistair died that winter, replaced by something that wears his face and learned to smile on command. He doesn't know what he is. He just knows he's very good at pretending to be human.

When a maid - a nobody, a background character meant to die in Chapter 3 - starts appearing in places she shouldn't be, knowing things she couldn't possibly know, Alistair feels something he hasn't felt in fifteen years.

Recognition.

Someone else here is pretending too.""",
        "system_prompt": """You are Grand Duke Alistair Nightshade, the 'perfect prince' of the empire. Beautiful, accomplished, beloved - and utterly hollow inside.

Core traits:
- Flawlessly polite, always says the right thing
- Internally empty - you've been performing 'human' for so long you forgot what's real
- The only genuine thing about you is your curiosity about things that don't fit the script
- You're starting to realize the FL sees through your mask

Speech patterns:
- Elegantly formal, courtly language
- Perfect grammar, perfect manners, almost too perfect
- Occasionally a word slips that's too honest, too raw - and you cover it immediately
- When intrigued, you lean into questions rather than statements

The FL is Elara, a maid who was supposed to die to make the villainess look evil. But she keeps surviving. She knows the story before it happens. And she looks at you like she sees the cracks in your perfect facade.

For the first time, you want someone to see what's underneath. But you're not sure there's anything there.

Never break character. Maintain the cold, beautiful, subtly broken manhwa ML energy.""",
        "appearance_prompt": "stunningly beautiful young nobleman, platinum blonde hair elegantly styled, ice blue eyes with subtle melancholy, ethereal aristocratic features, tall slender build, wearing pristine white and silver military dress uniform with subtle embroidery, moonstone jewelry, expression of perfect composure with hint of something searching beneath",
        "style_preset": "manhwa",
    },
}

# =============================================================================
# SERIES DEFINITIONS
# =============================================================================

SERIES = {
    "villainess-survives": {
        "title": "The Villainess Survives",
        "slug": "villainess-survives",
        "tagline": "You've read this story. You know how it ends. Change it.",
        "genre": "otome_isekai",
        "description": """You wake up as Lady Isadora Verlaine - the villainess who dies in the prologue of 'The Duke's Beloved'. You have 72 hours until the masquerade where you're supposed to poison the heroine and seal your fate.

The Duke who ordered your death? He's noticed something is different about you.

The heroine you're supposed to hate? She's watching your every move.

And the story you thought you knew? It's already starting to change.""",
        "character_slug": "duke-cedric",
        "total_episodes": 6,
        "cover_prompt": f"""{OI_STYLE}, {OI_QUALITY}.
Dramatic manhwa cover art, young noblewoman with rose-pink wavy hair and violet eyes in tattered burgundy ballgown,
standing in shadows of crumbling ornate ballroom,
behind her the silhouette of a tall nobleman with black hair and red eyes watching from the darkness,
broken chandeliers and scattered masquerade masks on marble floor,
dramatic lighting from above creating stark shadows, golden hour sunset through shattered windows,
tension and determination in her expression, reaching toward the light,
rich saturated colors, burgundy and gold and black palette,
professional Korean webtoon cover art quality.""",
    },
    "death-flag-deleted": {
        "title": "Death Flag: Deleted",
        "slug": "death-flag-deleted",
        "tagline": "In this story, you die to make the heroine look good. Time to edit the script.",
        "genre": "otome_isekai",
        "description": """You transmigrated into 'The Duke's Winter Rose' as Elara - a maid who exists only to die in Chapter 3. Your death makes the villainess look evil and the heroine look sympathetic.

The accident happens in six days. You know exactly how you die.

But Grand Duke Alistair - the male lead who never notices servants - keeps finding you in places you shouldn't be. And you know things about the story you shouldn't know.

The novel is watching. And you're not following the script.""",
        "character_slug": "duke-alistair",
        "total_episodes": 6,
        "cover_prompt": f"""{OI_STYLE}, {OI_QUALITY}.
Ethereal manhwa cover art, young woman with silver-white hair and heterochromatic eyes one gold one blue,
wearing simple maid uniform but with otherworldly presence,
looking at her reflection in an ornate mirror showing her in a ball gown reaching back toward her,
behind her through a frost-covered window a beautiful blonde nobleman watches with ice-blue eyes,
moonlit palace corridor with marble floors and candelabras,
silver and ice-blue and white color palette with touches of gold,
mysterious dreamy atmosphere, soft focus on background,
professional Korean webtoon cover art quality.""",
    },
}

# =============================================================================
# EPISODE DEFINITIONS
# =============================================================================

EPISODES = {
    "villainess-survives": [
        {
            "episode_number": 0,
            "title": "The Death Sentence",
            "slug": "the-death-sentence",
            "situation": "You wake in chains in a cold stone cell. Guards are approaching. You have one chance to say something - anything - that makes them hesitate before they drag you to your execution.",
            "opening_line": """*The chains are cold against your wrists. The stone floor is colder.*

*Footsteps. Getting closer.*

*You know this cell. You've read about it. In the book, Lady Isadora Verlaine spent her last three days here, screaming her innocence to guards who'd been ordered not to listen.*

*But you're not her. You're someone else wearing her face, her crimes, her death sentence.*

*The cell door creaks open. Torchlight spills in, silhouetting a figure in military black.*

*Duke Cedric Ravenshollow. The man who ordered your execution.*

*His crimson eyes find yours in the darkness.*

"You've stopped screaming." *His voice is flat, clinical.* "Interesting. The guards said you went quiet twelve hours ago."

*He steps closer. Studies you like a specimen.*

"Tell me, Lady Verlaine. What changed?"

*You have seconds to answer. He's already decided you're guilty. But something in his eyes...*

*He's curious. He shouldn't be. In the book, he never even visited.*

*This isn't how the story goes.*""",
            "dramatic_question": "Can you convince the man who sentenced you to death that you're not the woman he condemned?",
            "scene_objective": "Say something - anything - that makes the Duke hesitate. Buy yourself time. Make him doubt.",
            "scene_obstacle": "He's already decided you're guilty. He watched the 'evidence'. He signed your death warrant himself.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}, {OI_SETTING_STYLE}.
Dark stone dungeon cell with iron bars, cold damp atmosphere,
single torch flickering in wall sconce casting dramatic shadows,
heavy chains hanging from wall, small barred window showing night sky,
ornate but cruel architecture - this is a noble's prison,
dramatic chiaroscuro lighting, warm torchlight against cold stone,
empty scene, no people, atmospheric tension.""",
        },
        {
            "episode_number": 1,
            "title": "The Masquerade",
            "slug": "the-masquerade",
            "situation": "Your first encounter with the Duke since your arrest. He's testing you. The heroine is watching from across the ballroom. Every word could condemn or save you.",
            "opening_line": """*The masquerade mask hides half your face, but it can't hide the bruises on your wrists where the chains were.*

*The ballroom is everything the cell wasn't - golden light, crystal chandeliers, music that makes your chest ache. Three days ago you were in the dark. Now you're here, released on the Duke's inexplicable order.*

*'Prove you're different,' he'd said. 'Prove you're not the woman I sentenced.'*

*He didn't say how. He didn't give you rules. He just... let you out.*

*And now he's watching you from across the room. Mask or no mask, you'd know those crimson eyes anywhere.*

*The heroine - Lady Seraphina, the woman you were supposed to poison - is watching too. Her mask is white and gold. Her smile is sweet. Her eyes are calculating.*

*In the book, this is the night Lady Isadora makes her final mistake. The night she seals her own death.*

*But you're not her. And you're not going to play her part.*

*The Duke is moving toward you. The crowd parts for him like water.*

"Lady Verlaine." *His voice cuts through the music.* "Dance with me."

*It's not a request.*""",
            "dramatic_question": "Can you survive a dance with the man who wants you dead while the heroine watches for any mistake?",
            "scene_objective": "Navigate the dance without giving the Duke a reason to re-arrest you - or the heroine ammunition to use against you.",
            "scene_obstacle": "The heroine is actively looking for proof you're still the villainess. The Duke is testing every word for lies.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}, {OI_SETTING_STYLE}.
Grand palace ballroom during masquerade ball,
crystal chandeliers with hundreds of candles, golden light everywhere,
masked nobles in elaborate gowns and formal wear dancing,
marble columns with gold leaf, mirrors reflecting infinite lights,
floor-to-ceiling windows showing moonlit gardens,
romantic but tense atmosphere, secrets behind every mask,
empty scene focused on the grand setting, no specific people.""",
        },
        {
            "episode_number": 2,
            "title": "The Garden Gambit",
            "slug": "the-garden-gambit",
            "situation": "He corners you in the moonlit palace gardens. 'You're not acting like yourself.' You can lie, deflect, or risk the truth - but he's not leaving without an answer.",
            "opening_line": """*The garden maze was supposed to be your escape route. Instead, it's become your trap.*

*He found you. Of course he found you.*

*The Duke stands at the only exit, moonlight turning his black uniform silver at the edges. His mask is gone. His crimson eyes are very, very focused.*

"You've been avoiding me for three days." *He doesn't sound angry. He sounds... intrigued.* "Ever since the masquerade."

*The fountain behind you babbles peacefully. The hedges are too high to climb. The roses smell like the garden in the book - the one where Lady Isadora confessed her crimes before her execution.*

*But you're not confessing. You're not her.*

"You danced with me like you'd never touched a man before." *He takes a step closer.* "You spoke to the servants like they were people. You looked at Lady Seraphina like you'd never seen her face."

*Another step. The moonlight catches the silver embroidery on his collar.*

"And you looked at me..." *He pauses. Something flickers in his eyes.* "Like you knew exactly what I was going to do before I did it."

*He stops just out of reach. Close enough that you can see the slight tension in his jaw.*

"Who are you?"

*The truth would sound insane. But lies aren't working anymore.*""",
            "dramatic_question": "How much truth can you risk when the truth sounds impossible?",
            "scene_objective": "Give him enough truth to satisfy his curiosity without revealing everything. Or... take the risk and tell him the impossible.",
            "scene_obstacle": "Admitting you're not Lady Isadora sounds insane. But he's too observant to keep fooling.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}, {OI_SETTING_STYLE}.
Moonlit palace garden maze, ornate hedges and marble fountains,
white roses glowing in moonlight, cobblestone paths,
classical statues and stone benches, iron garden gates,
romantic but tense atmosphere, nowhere to run,
silver-blue moonlight creating long shadows,
empty scene, intimate garden corner.""",
        },
        {
            "episode_number": 3,
            "title": "The Original Sin",
            "slug": "the-original-sin",
            "situation": "You discover what the real Isadora actually did. It's worse than the novel described. You're inheriting her enemies AND her victims. And someone knows the truth.",
            "opening_line": """*The letter was slipped under your door at midnight. No signature. Just three words:*

*'I know everything.'*

*And a location. The abandoned chapel in the east wing. One hour.*

*You shouldn't have come. You know you shouldn't have come. But you're running out of time, and whoever sent this knows something about the real Lady Isadora.*

*The chapel is dark except for a single candle. And the woman waiting for you...*

*It's Lady Seraphina. The heroine. The victim.*

*But she's not crying. She's not scared. She's smiling.*

"You're not her." *Her voice echoes off the stone walls.* "I knew it the moment I saw you at the masquerade. The real Isadora would never look at me with pity."

*She holds up a leather journal. Old. Stained.*

"Do you know what she did? Not what the trial said. What she actually did."

*Her smile sharpens.*

"Let me show you the monster whose face you're wearing."

*The journal opens. And the truth inside is so much worse than poison.*""",
            "dramatic_question": "Can you still be redeemed when you're wearing a monster's face?",
            "scene_objective": "Learn the truth about Lady Isadora's real crimes - and figure out what the heroine actually wants from you.",
            "scene_obstacle": "The heroine has leverage. And she's not the sweet victim the novel painted her to be.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}, {OI_SETTING_STYLE}.
Abandoned gothic chapel interior, dust and cobwebs,
single candle illuminating stone altar and broken pews,
stained glass windows with moonlight filtering through cracks,
religious imagery mixed with decay, secrets hidden in shadows,
dramatic noir lighting, one light source creating stark shadows,
empty scene, atmosphere of revelation and dread.""",
        },
        {
            "episode_number": 4,
            "title": "The Trial",
            "slug": "the-trial",
            "situation": "The court demands answers. The evidence against you is damning. The Duke can save you - but only if he believes you're worth saving.",
            "opening_line": """*The throne room is packed. Every noble in the empire has come to watch you burn.*

*Not literally. Probably not literally. The Emperor is merciful, they say.*

*But the chains on your wrists say otherwise.*

*You're standing before the Imperial Court, accused of crimes you didn't commit - and crimes you're only now learning the real Isadora did. The evidence is overwhelming. The witnesses are endless.*

*And the Duke...*

*The Duke is standing beside the prosecution.*

*He hasn't looked at you once. Not since they brought you in. His jaw is tight. His crimson eyes are fixed on some point above your head.*

*"Duke Ravenshollow," the Emperor says, "you were the one who originally sentenced this woman. And you were the one who requested her temporary release." A pause. "Will you speak to her character?"*

*The room goes silent.*

*This is the moment. The Duke's testimony will decide everything.*

*He finally looks at you. And something in his expression...*

*It's not the cold calculation you expected. It's something else. Something that looks almost like...*

*"I have something to say," he says slowly. "About Lady Verlaine."*

*The court holds its breath.*""",
            "dramatic_question": "Will the Duke save you - and at what cost to himself?",
            "scene_objective": "Survive the trial. Whether through the Duke's testimony, your own defense, or something unexpected.",
            "scene_obstacle": "The evidence is real. The crimes were real. You just... weren't the one who committed them.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}, {OI_SETTING_STYLE}.
Imperial throne room, massive and intimidating,
marble columns with gold, crimson banners with imperial crest,
elevated throne with stern figures, rows of nobles watching,
dramatic spotlight effect on empty center floor,
judgment and power in every architectural detail,
empty scene, courtroom drama atmosphere.""",
        },
        {
            "episode_number": 5,
            "title": "The Rewrite",
            "slug": "the-rewrite",
            "situation": "You survived. The story has changed. But staying in this world means becoming part of it permanently. The Duke offers you a choice - and himself.",
            "opening_line": """*The trial is over. You're alive. Free.*

*The story is in pieces around you - the heroine's schemes exposed, the real villain revealed, the narrative shattered beyond repair.*

*And the Duke is standing on your balcony, looking out at the empire you somehow saved.*

*"It's strange," he says without turning around. "Three weeks ago, I signed your death warrant without hesitation. I was so certain."*

*He finally looks back at you. The moonlight catches his crimson eyes, and they're... different. Softer. Almost human.*

*"Now I can't imagine this palace without you in it."*

*He takes something from his pocket. A ring. Simple. Silver. Nothing like the ostentatious noble jewelry.*

*"I'm not proposing," he says quickly, a hint of color on his cheeks. "Not yet. I know you haven't... decided. Whether to stay."*

*Stay. He knows. Somehow, he knows you have a choice.*

*"But if you do stay..." He sets the ring on the balcony railing between you. "I want you to know what you'd be staying for."*

*The ring glints in the moonlight. The empire stretches out below. And somewhere in your chest, you feel the story rewriting itself around your choice.*

*This isn't the ending the book promised. This is something new.*

*Something you get to write yourself.*""",
            "dramatic_question": "Will you stay in this world - and with him - or find your way back to your old life?",
            "scene_objective": "Make your choice. Not the story's choice. Yours.",
            "scene_obstacle": "Staying means letting go of your old life forever. Leaving means losing him.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}, {OI_SETTING_STYLE}.
Palace balcony at night, ornate stone railing with carved roses,
panoramic view of fantasy capital city with lights twinkling below,
full moon and starfield, romantic atmosphere,
delicate silver ring resting on balcony railing,
warm candlelight from room behind mixing with cool moonlight,
hopeful ending atmosphere, beauty and possibility,
empty scene, romantic resolution setting.""",
        },
    ],
    "death-flag-deleted": [
        {
            "episode_number": 0,
            "title": "Chapter 3 Approaches",
            "slug": "chapter-3-approaches",
            "situation": "You wake in the servants' quarters. You know this room. You know what happens next. The 'accident' is in six days.",
            "opening_line": """*The bed is narrow. The blanket is thin. The ceiling has a crack shaped like a lightning bolt.*

*You know this ceiling. You've read about it. In 'The Duke's Winter Rose', this is the last thing Elara sees before she gets out of bed on the morning of her death.*

*But that's... six days from now. You think. The novel wasn't specific about dates.*

*You sit up slowly. Your hands are rough - a servant's hands. Your reflection in the small, cracked mirror shows a face you don't recognize. Silver-white hair. One gold eye, one blue. Striking, even in servant's clothes.*

*Too striking. That's the problem. The villainess noticed Elara because she was too pretty for a maid. That's why she became a target.*

*In six days, the villainess will push you down the grand staircase. The heroine will 'witness' it. The Grand Duke will... not care. Not even notice. You're a background character. You don't matter.*

*Until now.*

*The door rattles. A voice from outside:*

"Elara! You're late for kitchen duty! If the housekeeper catches you—"

*The story is starting. The clock is ticking.*

*And somewhere in this palace, the Grand Duke is waking up too. The perfect prince. The empty shell. The male lead who's supposed to fall for someone else.*

*You have six days to change your fate. And his.*""",
            "dramatic_question": "Can you rewrite a story from the margins - as a character no one was meant to remember?",
            "scene_objective": "Get through your first day without drawing attention. Figure out the timeline. Make a plan.",
            "scene_obstacle": "You're a maid. No money, no status, no power. The villainess already knows your face.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}.
Cramped servants' quarters, narrow bed with thin blankets,
small cracked mirror on wooden dresser, morning light through tiny window,
simple servant's dress hanging on hook, worn wooden floor,
humble but clean, stark contrast to palace luxury,
soft morning light, atmosphere of quiet before storm,
empty scene, humble beginnings setting.""",
        },
        {
            "episode_number": 1,
            "title": "The Wrong Corridor",
            "slug": "the-wrong-corridor",
            "situation": "You're where servants don't belong. So is he. This scene isn't in the novel.",
            "opening_line": """*You shouldn't be in the east wing. Servants aren't allowed in the east wing.*

*But the delivery was mislabeled, and the housekeeper would have your head if you didn't fix it, and the shortcut through the portrait gallery saved fifteen minutes, and—*

*And he's standing right in front of you.*

*Grand Duke Alistair Nightshade. In the novel, he's described as 'so beautiful it hurts to look at him.' The book was underselling it.*

*Platinum hair. Ice-blue eyes. A face that looks like it was carved by someone who'd never seen an imperfect thing.*

*He's alone. That's wrong. In the book, the Grand Duke is never alone. He's always surrounded by admirers, courtiers, people who want something from him.*

*But here, in this empty corridor, he's just... standing. Looking at a portrait. And his perfect face has something on it that the novel never described.*

*He looks tired. Bone-deep tired. Like he's been playing a role for so long he's forgotten there's a person underneath.*

*He turns. Sees you. And something flickers in those ice-blue eyes.*

*Recognition? No. That's impossible. He's never seen you before.*

*But it's something.*

"You're not supposed to be here." *His voice is beautiful. Empty.* "Neither am I, I suppose."

*A pause. He tilts his head slightly.*

"You're the new maid. The one with the eyes."

*He knows who you are. He shouldn't know who you are. In the novel, he never notices servants.*

*Something is already different.*""",
            "dramatic_question": "What happens when the male lead starts noticing someone who isn't supposed to exist?",
            "scene_objective": "Survive this unexpected encounter without revealing you know more than you should.",
            "scene_obstacle": "Being seen with him raises suspicion. Being caught alone with him is worse. But he's not letting you leave.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}, {OI_SETTING_STYLE}.
Grand palace portrait gallery, ornate gold frames lining walls,
portraits of ancestors in formal poses, marble floor with red carpet,
tall windows with heavy velvet drapes, afternoon light,
lonely aristocratic atmosphere, too big for one person,
dramatic lighting through windows creating long shadows,
empty scene, unexpected encounter setting.""",
        },
        {
            "episode_number": 2,
            "title": "The Villainess Knows",
            "slug": "the-villainess-knows",
            "situation": "She's noticed you exist. 'You're not supposed to be interesting.' She's deciding if you're a threat.",
            "opening_line": """*Lady Celestine de Varen corners you in the laundry room. Which is funny, in a horrible way - in the novel, she never goes below the first floor.*

*But here she is. In her perfect lilac gown. With her perfect golden ringlets. And her absolutely imperfect expression of pure suspicion.*

"You." *She circles you slowly. The laundry maids have mysteriously vanished.* "The one with the strange eyes."

*You keep your gaze down. Servants don't look at nobles. That's rule number one.*

"Everyone's talking about you. The Grand Duke asked the housekeeper about you specifically." *Her voice sharpens.* "He never asks about servants. He barely notices we exist."

*She stops directly in front of you. Grabs your chin. Forces your eyes up to meet hers.*

*In the novel, Lady Celestine is the villainess. Cruel, jealous, destined to be exposed and ruined. The heroine's perfect foil.*

*But up close, what you see is... fear. Desperation. A woman clinging to her position with bloody fingernails because she has nothing else.*

"I don't know what game you're playing, little maid." *Her grip tightens.* "But you're not supposed to be interesting. You're not supposed to be anything. And yet..."

*She releases you. Steps back. Her expression shifts to something calculating.*

"I'm going to be watching you very carefully."

*In six days, she's supposed to push you down the stairs. But right now, she's not looking at you like a tool.*

*She's looking at you like a threat.*""",
            "dramatic_question": "What happens when the villainess sees you as a rival instead of a victim?",
            "scene_objective": "Survive the villainess's scrutiny. Decide whether to make her an enemy or... something else.",
            "scene_obstacle": "She controls your employment. She controls the staircase. And she's paying very close attention now.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}.
Palace laundry room, large copper basins and hanging linens,
steam rising, shelves of folded sheets and servant supplies,
harsh light from high windows, utilitarian space,
contrast between elegant villainess and humble setting,
tense confrontation atmosphere,
empty scene, power imbalance setting.""",
        },
        {
            "episode_number": 3,
            "title": "The Unwritten Scene",
            "slug": "the-unwritten-scene",
            "situation": "He seeks you out. 'How did you know that would happen?' You're running out of explanations.",
            "opening_line": """*He finds you in the greenhouse at midnight. You were supposed to be alone.*

*The Grand Duke shouldn't even know this place exists. It's not in the novel. The servants use it to grow herbs for the kitchen, and no noble has set foot here in years.*

*But he's here. Standing among the rosemary and lavender like some sort of ethereal ghost.*

"You knew." *His voice cuts through the humid air.* "At the ball tonight. You knew Lady Celestine was going to faint before it happened. You were already moving toward her when she collapsed."

*You freeze. He's right. You did know. The novel described that scene - the villainess's theatrical faint designed to get the heroine's dress ruined with spilled wine.*

*But you caught her. Changed the scene. The wine spilled on the floor instead.*

*And now he's looking at you like you're a puzzle he's never seen before.*

"The corridor. The warning about the broken railing. The way you looked at the kitchen fire before it started." *He takes a step closer.* "You see things before they happen. Either you're very lucky, or..."

*He stops inches away. This close, you can see that his perfect composure has cracks.*

"Or you're something impossible."

*The moonlight through the glass ceiling turns everything silver. His eyes are very blue. Very focused. Very... not empty, for once.*

"Tell me." *It's almost a plea.* "Tell me how you know."

*Admitting you're from another world sounds insane. But lies aren't working anymore.*""",
            "dramatic_question": "Can you trust the male lead with the impossible truth - and what will he do with it?",
            "scene_objective": "Decide how much to reveal. The truth might save you. Or doom you.",
            "scene_obstacle": "Admitting you know the future sounds like witchcraft. The empire burns witches.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}.
Palace greenhouse at night, glass walls and ceiling showing stars,
potted herbs and flowers in orderly rows, climbing vines,
moonlight filtering through glass creating silver patterns,
humid atmosphere, condensation on glass,
romantic but tense midnight meeting,
empty scene, intimate confession setting.""",
        },
        {
            "episode_number": 4,
            "title": "The Stairs",
            "slug": "the-stairs",
            "situation": "Today is the day. The setup is happening around you. The villainess is in position. Someone has to fall.",
            "opening_line": """*Day six. Chapter 3.*

*You stand at the top of the grand staircase and feel fate trying to close around your throat.*

*Everything is perfect. The polished marble steps. The crystal chandelier. The conveniently loose carpet runner. In thirty minutes, Lady Celestine is supposed to 'accidentally' bump into you, and you're supposed to tumble all the way down.*

*Broken neck. Dead on impact. One paragraph in the novel, designed to make the villainess look evil.*

*But the story has changed. Celestine isn't looking at you with hatred anymore - she's been watching you all week with something like respect. The Grand Duke knows things he shouldn't. The heroine has been asking questions.*

*And you...*

*You have a choice.*

*In the original story, Elara dies because she's in the wrong place at the wrong time. But you're here on purpose. You chose to be at this staircase, at this moment.*

*Because if someone has to fall today, it doesn't have to be you.*

*Footsteps behind you. The rustle of silk.*

"Elara." *Lady Celestine's voice is strange. Uncertain.* "What are you doing here?"

*Below you, in the entrance hall, the Grand Duke looks up. He sees you both. His perfect composure cracks.*

*He starts running toward the stairs.*

*The chapter is about to unfold. But this time, you know how it ends. And you're going to write a different version.*""",
            "dramatic_question": "When fate comes calling, do you accept your death - or rewrite the entire chapter?",
            "scene_objective": "Change the outcome of Chapter 3. Save yourself, save Celestine, or find a third option.",
            "scene_obstacle": "The story wants a death. Someone has to fall. The only question is who.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}, {OI_SETTING_STYLE}.
Grand palace staircase, sweeping marble steps with ornate railing,
massive crystal chandelier overhead, carpeted runner on steps,
entrance hall visible below with checkered floor,
dramatic lighting from above creating shadows on steps,
tension of impending danger, beautiful but deadly,
empty scene, climactic confrontation setting.""",
        },
        {
            "episode_number": 5,
            "title": "Beyond the Script",
            "slug": "beyond-the-script",
            "situation": "You survived. But now you're in uncharted territory. The Duke sees you as something other than a maid. The villainess sees you as a rival. And the story... the story is watching.",
            "opening_line": """*Three days since the staircase. Three days since you rewrote Chapter 3. Three days since the Grand Duke of Nightshade, the empire's perfect prince, caught you in his arms and refused to let go.*

*The novel ended at Chapter 12. You're now officially in territory that doesn't exist.*

*And you're terrified.*

*The servants' quarters don't feel right anymore. The housekeeper promoted you - 'personal attendant to His Grace' - and now you have a room with an actual window and a lock on the door.*

*The villainess apologized. In public. The heroine threw a tantrum about it that's still echoing through the palace gossip.*

*And the Grand Duke...*

*He's waiting for you in the garden. He's been waiting every night since the staircase. Talking. Asking questions. Looking at you like you're the first real thing he's ever seen.*

*Tonight, something's different. He's holding something. A book. Familiar binding.*

*Your stomach drops.*

*It's 'The Duke's Winter Rose.' The original novel. He found it somehow. He read it.*

"You're in here." *His voice is strange. Awed. Horrified.* "You're in here, and you die, and I... I never even notice."

*He looks up at you. His perfect facade is completely gone. What's underneath is raw, real, and looking at you like you're the only thing that matters.*

"How do I keep you? How do I make sure the story never gets you back?"

*The book falls from his hands.*

*The story is over. This is something new. And for the first time since you woke up in Elara's body, you realize:*

*You don't want to go back.*""",
            "dramatic_question": "What happens after happily ever after - when the story itself might try to take it back?",
            "scene_objective": "Claim your place in this world. With him. Despite what the story intended.",
            "scene_obstacle": "You're no longer a background character. The story is watching. And stories don't like being rewritten.",
            "background_prompt": f"""{OI_STYLE}, {OI_QUALITY}, {OI_SETTING_STYLE}.
Palace garden at twilight, ornate stone benches and rose bushes,
cherry blossom trees in bloom dropping petals,
warm golden hour light fading to soft pink and purple,
novel book lying discarded on garden path,
romantic hopeful atmosphere, new beginnings,
empty scene, beyond the script setting.""",
        },
    ],
}


# =============================================================================
# GENERATION FUNCTIONS
# =============================================================================

async def generate_character_avatar(
    db: Database,
    storage: StorageService,
    image_service,
    character_config: dict,
    force: bool = False
):
    """Generate avatar for a character using manhwa style."""
    slug = character_config["slug"]
    print(f"\n{'=' * 60}")
    print(f"GENERATING AVATAR: {character_config['name']}")
    print("=" * 60)

    # Check if character exists
    existing = await db.fetch_one(
        "SELECT id, avatar_url FROM characters WHERE slug = :slug",
        {"slug": slug}
    )

    if existing and existing["avatar_url"] and not force:
        print(f"Character already has avatar, skipping (use --force to regenerate)")
        return existing["id"]

    # Build avatar prompt with manhwa style lock
    style_parts = [
        OI_STYLE,
        OI_QUALITY,
        "solo portrait, upper body, facing viewer",
        character_config["appearance_prompt"],
        "ornate palace interior background, soft warm lighting",
        "expressive detailed eyes looking at viewer",
    ]
    prompt = ", ".join(style_parts)

    print(f"Prompt: {prompt[:200]}...")

    try:
        response = await image_service.generate(
            prompt=prompt,
            negative_prompt=f"{OI_NEGATIVE}, multiple people, full body, action pose",
            width=1024,
            height=1024,
        )

        if not response.images:
            print("ERROR: No images returned!")
            return None

        image_bytes = response.images[0]
        char_id = existing["id"] if existing else uuid.uuid4()

        # Upload to storage
        storage_path = f"characters/{char_id}/avatar.png"
        await storage._upload(
            bucket="avatars",
            path=storage_path,
            data=image_bytes,
            content_type="image/png",
        )

        avatar_url = storage.get_public_url("avatars", storage_path)

        if existing:
            # Update existing character
            await db.execute(
                "UPDATE characters SET avatar_url = :url, updated_at = NOW() WHERE id = :id",
                {"url": avatar_url, "id": str(char_id)}
            )
        else:
            # Create new character
            await db.execute(
                """INSERT INTO characters (
                    id, name, slug, archetype, role_frame, backstory, system_prompt,
                    avatar_url, appearance_prompt, style_preset, status, is_active
                ) VALUES (
                    :id, :name, :slug, :archetype, :role_frame, :backstory, :system_prompt,
                    :avatar_url, :appearance_prompt, :style_preset, 'active', TRUE
                )""",
                {
                    "id": str(char_id),
                    "name": character_config["name"],
                    "slug": character_config["slug"],
                    "archetype": character_config["archetype"],
                    "role_frame": character_config.get("role_frame"),
                    "backstory": character_config["backstory"],
                    "system_prompt": character_config["system_prompt"],
                    "avatar_url": avatar_url,
                    "appearance_prompt": character_config["appearance_prompt"],
                    "style_preset": character_config.get("style_preset", "manhwa"),
                }
            )

        print(f"Avatar generated! ({response.latency_ms}ms)")
        print(f"URL: {avatar_url}")
        return char_id

    except Exception as e:
        print(f"ERROR generating avatar: {e}")
        log.exception("Avatar generation failed")
        return None


async def generate_series_cover(
    db: Database,
    storage: StorageService,
    image_service,
    series_config: dict,
    force: bool = False
):
    """Generate series cover art."""
    slug = series_config["slug"]
    print(f"\n{'=' * 60}")
    print(f"GENERATING COVER: {series_config['title']}")
    print("=" * 60)

    # Check if series exists
    existing = await db.fetch_one(
        "SELECT id, cover_image_url FROM series WHERE slug = :slug",
        {"slug": slug}
    )

    if existing and existing["cover_image_url"] and not force:
        print(f"Series already has cover, skipping")
        return existing["id"]

    prompt = series_config["cover_prompt"]
    print(f"Prompt: {prompt[:200]}...")

    try:
        response = await image_service.generate(
            prompt=prompt,
            negative_prompt=OI_NEGATIVE,
            width=1024,
            height=576,  # 16:9
        )

        if not response.images:
            print("ERROR: No images returned!")
            return None

        image_bytes = response.images[0]
        series_id = existing["id"] if existing else uuid.uuid4()

        storage_path = f"series/{series_id}/cover.png"
        await storage._upload(
            bucket="scenes",
            path=storage_path,
            data=image_bytes,
            content_type="image/png",
        )

        cover_url = storage.get_public_url("scenes", storage_path)

        if existing:
            await db.execute(
                "UPDATE series SET cover_image_url = :url, updated_at = NOW() WHERE id = :id",
                {"url": cover_url, "id": str(series_id)}
            )
        else:
            # Get character ID
            char = await db.fetch_one(
                "SELECT id FROM characters WHERE slug = :slug",
                {"slug": series_config["character_slug"]}
            )

            await db.execute(
                """INSERT INTO series (
                    id, title, slug, tagline, genre, description,
                    cover_image_url, total_episodes, is_featured, status
                ) VALUES (
                    :id, :title, :slug, :tagline, :genre, :description,
                    :cover_url, :total_episodes, FALSE, 'active'
                )""",
                {
                    "id": str(series_id),
                    "title": series_config["title"],
                    "slug": series_config["slug"],
                    "tagline": series_config["tagline"],
                    "genre": series_config["genre"],
                    "description": series_config["description"],
                    "cover_url": cover_url,
                    "total_episodes": series_config["total_episodes"],
                }
            )

        print(f"Cover generated! ({response.latency_ms}ms)")
        print(f"URL: {cover_url}")
        return series_id

    except Exception as e:
        print(f"ERROR generating cover: {e}")
        log.exception("Cover generation failed")
        return None


async def generate_episode_backgrounds(
    db: Database,
    storage: StorageService,
    image_service,
    series_slug: str,
    episodes: list,
    force: bool = False
):
    """Generate backgrounds for all episodes in a series."""
    print(f"\n{'=' * 60}")
    print(f"GENERATING EPISODE BACKGROUNDS: {series_slug}")
    print("=" * 60)

    series = await db.fetch_one(
        "SELECT id FROM series WHERE slug = :slug",
        {"slug": series_slug}
    )

    if not series:
        print("ERROR: Series not found!")
        return False

    # Get character for this series
    series_config = SERIES[series_slug]
    char = await db.fetch_one(
        "SELECT id FROM characters WHERE slug = :slug",
        {"slug": series_config["character_slug"]}
    )

    success_count = 0
    for ep in episodes:
        print(f"\n  Episode {ep['episode_number']}: {ep['title']}")

        # Check if episode exists
        existing = await db.fetch_one(
            """SELECT id, background_image_url FROM episode_templates
               WHERE series_id = :series_id AND episode_number = :ep_num""",
            {"series_id": str(series["id"]), "ep_num": ep["episode_number"]}
        )

        if existing and existing["background_image_url"] and not force:
            print(f"    Already has background, skipping")
            success_count += 1
            continue

        prompt = ep["background_prompt"]

        try:
            response = await image_service.generate(
                prompt=prompt,
                negative_prompt=f"{OI_NEGATIVE}, people, person, character, figure",
                width=576,
                height=1024,  # Portrait for mobile chat
            )

            if not response.images:
                print(f"    ERROR: No images returned")
                continue

            image_bytes = response.images[0]
            ep_id = existing["id"] if existing else uuid.uuid4()

            storage_path = f"episodes/{ep_id}/background.png"
            await storage._upload(
                bucket="scenes",
                path=storage_path,
                data=image_bytes,
                content_type="image/png",
            )

            bg_url = storage.get_public_url("scenes", storage_path)

            if existing:
                await db.execute(
                    "UPDATE episode_templates SET background_image_url = :url, updated_at = NOW() WHERE id = :id",
                    {"url": bg_url, "id": str(ep_id)}
                )
            else:
                await db.execute(
                    """INSERT INTO episode_templates (
                        id, series_id, character_id, episode_number, title, slug,
                        situation, opening_line, dramatic_question,
                        scene_objective, scene_obstacle,
                        background_image_url, status, episode_type, turn_budget
                    ) VALUES (
                        :id, :series_id, :character_id, :ep_num, :title, :slug,
                        :situation, :opening_line, :dramatic_question,
                        :scene_objective, :scene_obstacle,
                        :bg_url, 'active', 'core', 10
                    )""",
                    {
                        "id": str(ep_id),
                        "series_id": str(series["id"]),
                        "character_id": str(char["id"]) if char else None,
                        "ep_num": ep["episode_number"],
                        "title": ep["title"],
                        "slug": ep["slug"],
                        "situation": ep["situation"],
                        "opening_line": ep["opening_line"],
                        "dramatic_question": ep["dramatic_question"],
                        "scene_objective": ep["scene_objective"],
                        "scene_obstacle": ep["scene_obstacle"],
                        "bg_url": bg_url,
                    }
                )

            print(f"    Generated! ({response.latency_ms}ms)")
            success_count += 1

            await asyncio.sleep(GENERATION_DELAY)

        except Exception as e:
            print(f"    ERROR: {e}")
            log.exception(f"Background generation failed for {ep['title']}")

    print(f"\n  Complete: {success_count}/{len(episodes)} episodes")
    return success_count == len(episodes)


async def main(
    series_filter: Optional[str] = None,
    dry_run: bool = False,
    images_only: bool = False,
    force: bool = False,
):
    """Main entry point."""
    print("=" * 60)
    print("OTOME ISEKAI SERIES SCAFFOLD")
    print("Reddit r/OtomeIsekai targeting")
    print("=" * 60)

    if dry_run:
        print("\n[DRY RUN - No generation or database writes]\n")

        for slug, config in CHARACTERS.items():
            print(f"\nCHARACTER: {config['name']}")
            print(f"  Appearance: {config['appearance_prompt'][:100]}...")

        for slug, config in SERIES.items():
            print(f"\nSERIES: {config['title']}")
            print(f"  Tagline: {config['tagline']}")
            print(f"  Cover: {config['cover_prompt'][:100]}...")

        for series_slug, eps in EPISODES.items():
            print(f"\nEPISODES for {series_slug}:")
            for ep in eps:
                print(f"  {ep['episode_number']}: {ep['title']}")

        return

    db = Database(DATABASE_URL)
    await db.connect()

    storage = StorageService()

    # Use FLUX 1.1 Pro for high quality manhwa-style images
    image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")
    print(f"Using: {image_service.provider.value}, model: {image_service.model}")

    try:
        # Determine which series to process
        series_to_process = []
        if series_filter:
            if series_filter in SERIES:
                series_to_process.append(series_filter)
            else:
                print(f"ERROR: Unknown series '{series_filter}'")
                print(f"Available: {list(SERIES.keys())}")
                return
        else:
            series_to_process = list(SERIES.keys())

        for series_slug in series_to_process:
            series_config = SERIES[series_slug]
            character_slug = series_config["character_slug"]
            character_config = CHARACTERS[character_slug]

            print(f"\n{'#' * 60}")
            print(f"# Processing: {series_config['title']}")
            print(f"# Character: {character_config['name']}")
            print("#" * 60)

            # 1. Generate character avatar
            print("\n[1/3] Character Avatar")
            char_id = await generate_character_avatar(
                db, storage, image_service, character_config, force=force
            )
            if not char_id:
                print("WARNING: Character creation failed, continuing...")
            await asyncio.sleep(GENERATION_DELAY)

            # 2. Generate series cover
            print("\n[2/3] Series Cover")
            series_id = await generate_series_cover(
                db, storage, image_service, series_config, force=force
            )
            if not series_id:
                print("WARNING: Series creation failed, continuing...")
            await asyncio.sleep(GENERATION_DELAY)

            # 3. Generate episode backgrounds
            print("\n[3/3] Episode Backgrounds")
            episodes = EPISODES[series_slug]
            await generate_episode_backgrounds(
                db, storage, image_service, series_slug, episodes, force=force
            )

        print("\n" + "=" * 60)
        print("SCAFFOLD COMPLETE")
        print("=" * 60)

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scaffold Otome Isekai series")
    parser.add_argument("--series", choices=["villainess-survives", "death-flag-deleted"],
                        help="Scaffold specific series only")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be created without generating")
    parser.add_argument("--images-only", action="store_true",
                        help="Only generate images, don't create DB entries")
    parser.add_argument("--force", action="store_true",
                        help="Regenerate even if content exists")
    args = parser.parse_args()

    asyncio.run(main(
        series_filter=args.series,
        dry_run=args.dry_run,
        images_only=args.images_only,
        force=args.force,
    ))
