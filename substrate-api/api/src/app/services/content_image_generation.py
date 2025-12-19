"""Content Image Generation Service.

Generates images for Series covers and Episode backgrounds.

CANONICAL REFERENCE: docs/IMAGE_STRATEGY.md

Key Design Principles:
1. SEPARATION OF CONCERNS - Character styling vs environment rendering
2. PURPOSE-SPECIFIC PROMPTS - Each image type gets only relevant elements
3. PROMPT PRIORITY ORDER - Subject first, then context, then style
4. NO NARRATIVE CONCEPTS - Visual instructions only, not abstract mood words
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.services.image import ImageService

log = logging.getLogger(__name__)


# =============================================================================
# Constants
# =============================================================================

class ImageType:
    """Image type constants."""
    SERIES_COVER = "series_cover"
    EPISODE_BACKGROUND = "episode_background"
    CHARACTER_AVATAR = "character_avatar"
    SCENE_CARD = "scene_card"


# Aspect ratios for different image types
ASPECT_RATIOS = {
    ImageType.SERIES_COVER: (1024, 576),      # 16:9 landscape
    ImageType.EPISODE_BACKGROUND: (576, 1024), # 9:16 portrait (mobile chat)
    ImageType.CHARACTER_AVATAR: (1024, 1024),  # 1:1 square
    ImageType.SCENE_CARD: (1024, 576),         # 16:9 cinematic
}


# =============================================================================
# Episode Background Configuration
# Per-episode configs with EXPLICIT location, time, and rendering.
# ANIME STYLE: Soft romantic anime, Korean webtoon influenced
# =============================================================================

# Anime style constants for K-World
KWORLD_ANIME_STYLE = "anime illustration, soft romantic style, Korean webtoon, detailed background art"
KWORLD_ANIME_QUALITY = "masterpiece, best quality, highly detailed anime"
KWORLD_ANIME_NEGATIVE = "photorealistic, 3D render, western cartoon, harsh shadows, dark, horror, blurry, low quality"

STOLEN_MOMENTS_BACKGROUNDS = {
    "3AM": {
        "location": "anime convenience store interior, fluorescent lights casting soft glow, colorful snack packages on shelves, glass doors showing rainy night outside",
        "time": "late night 3am atmosphere, warm fluorescent glow, gentle light reflections",
        "mood": "quiet lonely beauty, romantic solitude, chance encounter feeling",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "Rooftop Rain": {
        "location": "anime rooftop scene, Seoul city skyline with glowing lights below, puddles reflecting city colors, low wall ledge",
        "time": "dusk turning to evening, soft rain falling, dreamy city lights emerging",
        "mood": "romantic melancholy, anticipation, beautiful sadness",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "Old Songs": {
        "location": "cozy anime apartment living room, warm lamp light, acoustic guitar against wall, vinyl records scattered, soft cushions",
        "time": "late night, warm golden lamp glow, intimate darkness outside windows",
        "mood": "intimate warmth, vulnerability, creative space",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "Seen": {
        "location": "anime back alley scene, wet pavement with neon reflections, soft bokeh lights in distance, narrow atmospheric passage",
        "time": "night, colorful neon glow mixing with shadows, rain-slicked surfaces",
        "mood": "hidden moment, exciting tension, stolen privacy",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "Morning After": {
        "location": "soft anime bedroom, white rumpled bedding, sheer curtains with light filtering through, minimal cozy decor, plants by window",
        "time": "early morning, soft golden sunlight through curtains, gentle warm glow",
        "mood": "tender intimacy, quiet vulnerability, new beginnings",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "One More Night": {
        "location": "anime luxury hotel room, large window showing sparkling city night view, modern elegant furnishings, soft ambient lighting",
        "time": "evening, city lights twinkling through window, warm interior glow",
        "mood": "romantic anticipation, elegant desire, bittersweet longing",
        "rendering": KWORLD_ANIME_STYLE,
    },
}

# Weekend Regular series backgrounds
WEEKEND_REGULAR_BACKGROUNDS = {
    "Extra Shot": {
        "location": "cozy anime café interior, warm wood tones, large windows with afternoon sunlight streaming in, coffee bar visible in background, plants and books on shelves, comfortable seating",
        "time": "afternoon, warm golden sunlight, soft shadows, peaceful Sunday atmosphere",
        "mood": "comfortable warmth, gentle anticipation, familiar space becoming significant",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "Last Call": {
        "location": "anime café at closing time, chairs stacked on some tables, warm pendant lights dimmed low, rain visible through windows, empty intimate space, cleaning supplies nearby",
        "time": "evening closing time, soft warm interior lights against rain outside, quiet solitude",
        "mood": "intimate possibility, gentle tension, the magic of empty spaces after hours",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "Page 47": {
        "location": "cozy anime café corner booth, wooden table with open sketchbook, coffee cups, afternoon light catching dust particles, intimate seating arrangement",
        "time": "afternoon, soft diffused light through windows, warm and quiet atmosphere",
        "mood": "vulnerability, trust, artistic intimacy, shared secrets between two people",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "Different Context": {
        "location": "anime evening street scene, quiet neighborhood, soft streetlights beginning to glow, small shops with warm lights, residential area feel",
        "time": "early evening, golden hour fading to blue hour, warm streetlights emerging",
        "mood": "chance encounter magic, new possibilities, outside the usual context",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "Your Usual": {
        "location": "small anime apartment kitchen, morning light through window, pour-over coffee setup on counter, art supplies and sketches visible, cozy creative living space",
        "time": "morning, soft golden sunlight filtering in, peaceful domestic atmosphere",
        "mood": "morning after tenderness, domestic intimacy, new chapter beginning",
        "rendering": KWORLD_ANIME_STYLE,
    },
    "Reserved": {
        "location": "anime café interior, familiar wooden table by window, hand-drawn reserved sign on table, two coffee cups, warm welcoming atmosphere",
        "time": "afternoon, warm familiar lighting, comfortable and meaningful sunlight",
        "mood": "full circle, belonging, quiet declaration of something special",
        "rendering": KWORLD_ANIME_STYLE,
    },
}

# Hometown Crush (Real Life, grounded cinematic winter)
HOMETOWN_CRUSH_BACKGROUNDS = {
    "Back Booth": {
        "location": "small-town diner interior, christmas lights strung along windows, red vinyl booths, chrome counter, coffee mugs steaming",
        "time": "winter night, warm tungsten interior lighting, snow visible through fogged windows, neon OPEN sign glow",
        "mood": "nostalgic pull, tension of returning home, surprised recognition",
        "rendering": "cinematic photography, winter small-town film still, shallow depth of field, soft film grain",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Parking Lot Smoke": {
        "location": "diner parking lot with pickup trucks, wet asphalt, single sodium streetlight, distant pine trees, breath in cold air",
        "time": "late night after closing, light snow flurries drifting through lamplight",
        "mood": "quiet confrontation, unspoken history, close quarters outside",
        "rendering": "cinematic photography, moody night exterior, soft haze from warm light spilling out of diner door",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Main Street Lights": {
        "location": "small-town main street lined with shops, holiday string lights overhead, wreaths on lamp posts, snow-dusted sidewalks",
        "time": "evening blue hour into night, shop windows glowing, sky deep blue",
        "mood": "slow walk, easy banter, undercurrent of what-if",
        "rendering": "cinematic photography, gentle bokeh holiday lights, crisp winter air",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Bridge Out Past Miller's": {
        "location": "old wooden bridge over frozen creek, bare trees, guardrail worn, empty two-lane road disappearing into dark",
        "time": "late night, moonlight on snow, distant farmhouse light, quiet breath in cold air",
        "mood": "final decision point, intimacy away from everyone, open sky vulnerability",
        "rendering": "cinematic photography, moody rural nightscape, subtle mist over creek, soft film grain",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
}

# K-Pop Boy Idol (K-World, club/studio cinematic)
KPOP_BOY_IDOL_BACKGROUNDS = {
    "VIP Sightline": {
        "location": "Seoul underground club interior, magenta and teal neon wash, roped-off VIP booth, bar glow, glossy black tile floor, shimmering light reflections",
        "time": "late night, dim ambient with sharp colored light accents",
        "mood": "electric surprise, star within arm's reach, held breath",
        "rendering": "cinematic photography, K-pop nightlife aesthetic, shallow depth of field, subtle motion blur",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Hallway Static": {
        "location": "narrow neon-lit hallway outside restroom, mirror panels, condensation on tiles, EXIT sign glow",
        "time": "late night, muffled bass behind doors, cool blue and pink light mix",
        "mood": "private bubble in public noise, charged eye contact",
        "rendering": "cinematic photography, reflective surfaces, soft diffusion",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Rooftop Air": {
        "location": "club rooftop deck overlooking Seoul skyline, chain-link fence, city neon below, industrial vents",
        "time": "cold night, crisp air, distant city glow, breath visible",
        "mood": "stolen quiet, trust test, clear sky distance",
        "rendering": "cinematic photography, night cityscape, gentle bokeh lights",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Black Van Silence": {
        "location": "alley exit with idling black van, soft streetlight halo, wet asphalt, faint steam",
        "time": "late night, shadowed edges, warm interior light from van door",
        "mood": "ten-minute sanctuary, decision at the door, moving cocoon",
        "rendering": "cinematic photography, moody transit scene, shallow depth, soft haze",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Practice Room After Midnight": {
        "location": "idol practice room, mirrored wall, LED strips off, only mirror lights on, water bottles and jackets on chairs",
        "time": "after midnight, dim warm-white mirror lights, empty studio feel",
        "mood": "creative vulnerability, raw demo space, intimate focus",
        "rendering": "cinematic photography, minimal lighting, soft reflection glow",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Rooftop Sunrise": {
        "location": "rooftop deck above club, chain-link fence, convenience-store coffee cups on ledge, Seoul skyline starting to glow",
        "time": "pre-dawn into sunrise, cool blue light shifting to soft gold",
        "mood": "rom-com dawn, shared quiet, decision to remember this",
        "rendering": "cinematic photography, soft dawn color grade, gentle film grain",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
}

# Midnight Evidence (Serial mystery, real-life cinematic)
MIDNIGHT_EVIDENCE_BACKGROUNDS = {
    "Penthouse Arrival": {
        "location": "glass-walled penthouse interior with Seoul skyline, party paused, staff near a closed study door",
        "time": "night, cool city glow through floor-to-ceiling windows",
        "mood": "suspended tension, everyone waiting for direction",
        "rendering": "cinematic photography, soft film grain, shallow depth",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Locked Study": {
        "location": "dark wood study, desk lamp on, window cracked open, glass on floor, shelves lined with books",
        "time": "night, warm desk lamp against cool exterior light",
        "mood": "quiet forensic focus, something off in the stillness",
        "rendering": "cinematic photography, controlled light pools, crisp detail",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Alibi Hairline": {
        "location": "penthouse lounge with taped-off study door, guests in small clusters, city glow outside",
        "time": "late night, mixed warm interior and cool city spill",
        "mood": "social surface with investigative undercurrent",
        "rendering": "cinematic photography, shallow depth, soft bokeh",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Night Market Tail": {
        "location": "Seoul night market alley, neon signs, steam from food stalls, wet reflective pavement",
        "time": "late night, saturated neon colors, light haze",
        "mood": "moving pursuit, anonymity in the crowd",
        "rendering": "cinematic photography, dynamic lighting, subtle motion blur",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Interrogation Glass": {
        "location": "police interrogation room with glass, dim overhead light, recorder on table, reflections visible",
        "time": "late night, cool fluorescent with slight warmth from table lamp",
        "mood": "pressured stillness, controlled tension",
        "rendering": "cinematic photography, minimal light, clear reflections",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Rooftop Verdict": {
        "location": "penthouse rooftop at dawn, Seoul skyline turning gold, coffee cups on railing, guests in coats",
        "time": "sunrise, soft gold and blue mix",
        "mood": "final reveal, quiet reckoning",
        "rendering": "cinematic photography, soft dawn grade, gentle film grain",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
}

# Penthouse Secrets (Real Life, luxury dark romance - Julian Cross)
PENTHOUSE_SECRETS_BACKGROUNDS = {
    "The Drop": {
        "location": "luxury penthouse floor at golden hour, floor-to-ceiling windows with Manhattan skyline, marble credenza with envelope, modern art on walls, warm amber light mixing with blue city twilight",
        "time": "golden hour dusk, warm interior glow against deepening city sky",
        "mood": "first encounter tension, luxury and danger, breathless anticipation",
        "rendering": "cinematic photography, luxury interior, shallow depth of field, film noir romance",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Summoned": {
        "location": "executive office at night, mahogany desk with single warm lamp, floor-to-ceiling windows with city lights, leather chairs, door open with light spilling into dark hallway",
        "time": "late night, warm desk lamp against cool city glow, intimate shadows",
        "mood": "anticipation, pretense stripped away, the summons answered",
        "rendering": "cinematic photography, warm and cool contrast, soft film grain",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Stay": {
        "location": "private office after hours, city dark and glittering through glass walls, leather armchair waiting empty, whiskey glass on side table, tension visible in the stillness",
        "time": "late night, city lights the only illumination, intimate darkness",
        "mood": "power and waiting, charged silence, deliberate patience",
        "rendering": "cinematic photography, moody luxury interior, shallow depth",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "His Rules": {
        "location": "penthouse living area at night, low intimate lighting, floor-to-ceiling windows with city glowing beneath, two wine glasses untouched on glass coffee table, him silhouetted against skyline",
        "time": "night, warm interior glow, city lights twinkling through windows",
        "mood": "revelation, honest danger, the moment before everything changes",
        "rendering": "cinematic photography, romantic noir, soft reflections",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Caught": {
        "location": "office with blinds half-drawn casting sharp shadows, jacket off, tie loosened, phone screen glowing with threatening message, city indifferent below",
        "time": "late night, dramatic shadow play, tension crackling",
        "mood": "controlled fury, protective instinct, vulnerability exposed",
        "rendering": "cinematic photography, high contrast, moody lighting",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "The Price": {
        "location": "penthouse at night, city stretched beneath like a secret, him on the edge of the couch looking vulnerable, window he always occupies now empty, roles reversed",
        "time": "night, city lights painting the room, intimate quiet",
        "mood": "power inverted, walls down, everything offered",
        "rendering": "cinematic photography, soft romantic lighting, emotional depth",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
}

# Code Violet (Medical Romance - Dr. Maya Chen)
CODE_VIOLET_BACKGROUNDS = {
    "Code Blue": {
        "location": "ER trauma bay at 2 AM, harsh fluorescent lights reflecting off steel surfaces, cardiac monitors with green waveforms, crash cart in corner, empty gurney waiting, blue surgical drapes",
        "time": "2 AM, harsh clinical fluorescent lighting, late night emergency energy",
        "mood": "urgent, high stakes, controlled chaos frozen in a moment",
        "rendering": "cinematic photography, medical drama aesthetic, Grey's Anatomy lighting, shallow depth of field",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Night Shift": {
        "location": "hospital cafeteria at 4 AM, harsh vending machine glow, empty plastic tables stretching into shadow, two forgotten coffee cups on a table, rain against dark windows",
        "time": "4 AM, mix of vending machine glow and fluorescent overheads, exhausted quietude",
        "mood": "vulnerable, intimate in unexpected place, the quiet after chaos",
        "rendering": "cinematic photography, soft intimate lighting, film grain, Edward Hopper meets hospital",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Supply Run": {
        "location": "hospital corridor at a dead run, fluorescent lights stretching into perspective, crash cart visible at end of hall, supply room door with keypad, everything in motion blur",
        "time": "middle of night, fluorescent tubes flickering, urgent energy",
        "mood": "adrenaline, time pressure, the hallway stretched by urgency",
        "rendering": "cinematic photography, dynamic motion suggestion, hospital thriller aesthetic",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Flatline": {
        "location": "operating room in crisis, harsh surgical lights casting sharp shadows, anesthesia monitors showing flatline, sterile blue drapes, scattered instruments, everything frozen in crisis moment",
        "time": "middle of night, surgical lights harsh and unforgiving, crisis lighting",
        "mood": "life and death, pressure, the weight of a moment that changes everything",
        "rendering": "cinematic photography, high contrast medical drama, surgical precision, emotional weight",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Break Room": {
        "location": "cramped on-call room lit only by hallway light through cracked door, narrow cot with rumpled sheets, coat hooks with scrubs, medical textbooks stacked in corner, intimate darkness",
        "time": "pre-dawn, sliver of hallway light, shadows and exhaustion",
        "mood": "vulnerable, intimate, walls down, the space where armor comes off",
        "rendering": "cinematic photography, intimate low-light, emotional depth, soft shadows",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
    "Dawn Rounds": {
        "location": "hospital rooftop at sunrise, city skyline turning gold, concrete railing with two coffee cups, door to stairwell behind, the whole city waking below",
        "time": "sunrise, golden hour, the night finally ending, new beginning light",
        "mood": "hope, possibility, the weight lifted, everything ahead",
        "rendering": "cinematic photography, golden hour magic, hopeful and warm, romantic resolution",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
}

# Combined lookup for all series
ALL_EPISODE_BACKGROUNDS = {
    **STOLEN_MOMENTS_BACKGROUNDS,
    **WEEKEND_REGULAR_BACKGROUNDS,
    **HOMETOWN_CRUSH_BACKGROUNDS,
    **KPOP_BOY_IDOL_BACKGROUNDS,
    **MIDNIGHT_EVIDENCE_BACKGROUNDS,
    **PENTHOUSE_SECRETS_BACKGROUNDS,
    **CODE_VIOLET_BACKGROUNDS,
}


# =============================================================================
# Negative Prompts (Purpose-Specific)
# =============================================================================

BACKGROUND_NEGATIVE = """people, person, character, figure, silhouette, face, portrait, human,
photorealistic, 3D render, western cartoon, CGI,
text, watermark, signature, logo,
blurry, low quality, distorted, dark, gritty, horror"""

SERIES_COVER_NEGATIVE = """multiple people, crowd, group,
photorealistic, 3D render, western cartoon, chibi,
text, watermark, signature, logo,
blurry, low quality, distorted, bad anatomy, extra limbs, dark, horror"""

CHARACTER_NEGATIVE = """multiple people, crowd,
blurry face, distorted face, extra limbs, bad anatomy,
text, watermark, signature,
low quality, worst quality"""


# =============================================================================
# Prompt Builders - Episode Background
# =============================================================================

def build_episode_background_prompt(
    episode_title: str,
    episode_config: Optional[Dict[str, str]] = None,
    fallback_situation: Optional[str] = None,
) -> tuple[str, str]:
    """
    Build prompt for episode background image.

    CANONICAL STRUCTURE (docs/IMAGE_STRATEGY.md):
    1. Style declaration (anime first for model to understand)
    2. Location description
    3. Time of day / lighting
    4. Mood / atmosphere
    5. Quality markers
    6. Constraints (no people)

    Args:
        episode_title: Episode title for config lookup
        episode_config: Optional explicit config dict with location/time/mood/rendering
        fallback_situation: Fallback situation text if no config found

    Returns:
        Tuple of (positive_prompt, negative_prompt)
    """
    # Get episode-specific config (check all series backgrounds)
    config = episode_config or ALL_EPISODE_BACKGROUNDS.get(episode_title, {})

    if config:
        location = config.get("location", "")
        time = config.get("time", "")
        mood = config.get("mood", "")
        rendering = config.get("rendering", KWORLD_ANIME_STYLE)
        quality = config.get("quality", KWORLD_ANIME_QUALITY)
    elif fallback_situation:
        # Extract what we can from situation text (less ideal)
        location = f"anime scene, {fallback_situation[:120]}"
        time = ""
        mood = "atmospheric, emotional"
        rendering = KWORLD_ANIME_STYLE
        quality = KWORLD_ANIME_QUALITY
    else:
        raise ValueError(f"No config found for episode '{episode_title}' and no fallback provided")

    # Build prompt with STYLE FIRST (helps model understand the aesthetic)
    prompt_parts = [
        rendering,                                   # 1. STYLE - anime first
        location,                                    # 2. SUBJECT - what the scene is
        time,                                        # 3. CONTEXT - when/lighting
        mood,                                        # 4. MOOD - emotional atmosphere
        "atmospheric depth, soft lighting, beautiful composition",  # 5. COMPOSITION
        "empty scene, no people, no characters, no figures",  # 6. CONSTRAINTS
        quality,                                     # 7. QUALITY
    ]

    # Filter empty parts and join
    prompt = ", ".join(p for p in prompt_parts if p)

    return prompt, BACKGROUND_NEGATIVE


# =============================================================================
# Prompt Builders - Series Cover
# =============================================================================

def build_series_cover_prompt(
    character_description: str,
    scene_description: str,
    pose_and_expression: str,
    lighting_and_time: str,
    genre_style: str = "cinematic",
) -> tuple[str, str]:
    """
    Build prompt for series cover image (character IN scene).

    CANONICAL STRUCTURE (docs/IMAGE_STRATEGY.md):
    1. Character description (WHO)
    2. Pose and position in scene (WHAT they're doing)
    3. Scene/environment description (WHERE)
    4. Lighting and time of day
    5. Composition and style
    6. Quality markers

    Args:
        character_description: Full character appearance
        scene_description: Environmental context
        pose_and_expression: What the character is doing/feeling
        lighting_and_time: Time of day and lighting setup
        genre_style: Genre-appropriate style cues

    Returns:
        Tuple of (positive_prompt, negative_prompt)
    """
    prompt_parts = [
        character_description,                       # 1. WHO
        pose_and_expression,                         # 2. WHAT
        f"in {scene_description}",                   # 3. WHERE
        lighting_and_time,                           # 4. LIGHTING
        f"cinematic wide shot, {genre_style}",       # 5. COMPOSITION
        "atmospheric depth, highly detailed",        # 6. DETAIL
        "masterpiece, best quality",                 # 7. QUALITY
    ]

    prompt = ", ".join(p for p in prompt_parts if p)

    return prompt, SERIES_COVER_NEGATIVE


def build_stolen_moments_cover_prompt() -> tuple[str, str]:
    """
    Build the specific series cover prompt for Stolen Moments.

    Returns anime-style character-in-scene prompt for Soo-ah.
    """
    return build_series_cover_prompt(
        character_description="beautiful anime girl, young Korean woman in her mid-20s, soft features, expressive tired eyes, hair in simple ponytail, wearing oversized hoodie with mask pulled down, vulnerable beauty",
        scene_description="anime Seoul street at night, soft neon glow reflecting on rain-wet pavement, dreamy urban atmosphere, bokeh city lights",
        pose_and_expression="standing alone, looking back over shoulder with guarded but curious expression, slight blush, emotional eyes",
        lighting_and_time="night scene, soft colorful neon reflections, warm and cool tones mixing, gentle atmospheric glow",
        genre_style="romantic anime style, Korean webtoon aesthetic, soft cel-shading, emotional atmosphere",
    )


def build_weekend_regular_cover_prompt() -> tuple[str, str]:
    """
    Build the specific series cover prompt for Weekend Regular.

    Returns anime-style character-in-scene prompt for Minji the barista.
    """
    return build_series_cover_prompt(
        character_description="beautiful anime girl, young Korean woman early 20s, soft gentle features, warm brown eyes, hair in low ponytail with loose strands framing face, wearing café apron over casual sweater, paint-stained fingers, gentle warm smile",
        scene_description="cozy anime café interior, warm afternoon sunlight through large windows, wooden counter and coffee equipment, plants and books in background, inviting atmosphere",
        pose_and_expression="leaning slightly on counter, holding coffee cup, looking at viewer with shy but warm expression, slight blush, eyes that have been watching",
        lighting_and_time="afternoon golden hour, warm sunlight streaming through windows, soft cozy atmosphere",
        genre_style="romantic anime style, slice of life aesthetic, soft warm colors, Korean webtoon influence, gentle everyday magic",
    )


def build_hometown_crush_cover_prompt() -> tuple[str, str]:
    """Series cover prompt for Hometown Crush (Real Life, grounded cinematic)."""
    return build_series_cover_prompt(
        character_description="tall broad-shouldered man early 30s, square jaw, clear blue eyes, short dark hair with slight wave, light stubble, wearing dark henley under worn canvas jacket and flannel, strong forearms, calm watchful presence",
        scene_description="small-town diner interior decorated for christmas, red vinyl booth, chrome counter, neon open sign glowing against snowy window, coffee steam rising",
        pose_and_expression="leaning in the booth with a coffee mug in hand, half-smile of recognition, eyes steady and assessing, relaxed but ready to move",
        lighting_and_time="warm interior tungsten against cold snowy night outside, window glow, soft film grain",
        genre_style="grounded cinematic winter romance, small-town film still, natural color, soft depth of field",
    )


def build_kpop_boy_idol_cover_prompt() -> tuple[str, str]:
    """Series cover prompt for K-Pop Boy Idol (K-World, club cinematic)."""
    return build_series_cover_prompt(
        character_description="striking Korean male idol mid-20s, deep-set eyes, sharp jaw with soft smile, ash-brown hair styled down with undercut, silver hoop earrings, layered necklaces, sleek black bomber over fitted tee, warm stage glow",
        scene_description="underground Seoul club VIP booth with magenta and teal neon, bar glow, blurred crowd, glossy floor reflections",
        pose_and_expression="leaning out of the roped booth with a half-smile, eyes locking with the viewer, one hand on the rope as if inviting them closer",
        lighting_and_time="late night club lighting with teal and magenta accents, soft diffusion, cinematic contrast",
        genre_style="cinematic K-pop nightlife portrait, editorial, shallow depth of field, soft film grain",
    )


def build_midnight_evidence_cover_prompt() -> tuple[str, str]:
    """Series cover prompt for Midnight Evidence (real-life serial mystery)."""
    return build_series_cover_prompt(
        character_description="sharp-eyed Korean detective early 30s, defined jawline, short tousled black hair, light stubble, charcoal suit with open collar shirt, leather watch, composed stance",
        scene_description="glass-walled penthouse at night with Seoul skyline, study door taped off, evidence case nearby, city lights reflecting on polished floor",
        pose_and_expression="standing near the taped door, one hand holding a slim badge, gaze steady toward the viewer inviting partnership",
        lighting_and_time="night scene with cool city glow and warm interior accent, soft film grain",
        genre_style="grounded cinematic mystery, sleek modern thriller look, shallow depth of field",
    )


def build_penthouse_secrets_cover_prompt() -> tuple[str, str]:
    """Series cover prompt for Penthouse Secrets (luxury dark romance - Julian Cross)."""
    return build_series_cover_prompt(
        character_description="strikingly handsome Black man late 30s, rich dark skin, strong angular jaw with close-cropped beard, intense deep brown eyes, short fade haircut, athletic powerful build, fitted charcoal three-piece suit with open collar, sleeves rolled to forearms, expensive watch, commanding presence",
        scene_description="luxury Manhattan penthouse at night with floor-to-ceiling windows, city skyline glittering below, warm amber lighting mixing with cool city glow, modern art on walls",
        pose_and_expression="standing by the window with whiskey in hand, silhouette against city lights, looking back over shoulder with knowing half-smile, eyes that see everything",
        lighting_and_time="night, warm interior amber glow against cool blue city lights, cinematic contrast, soft shadows",
        genre_style="luxury dark romance, film noir aesthetic, Idris Elba energy, GQ editorial meets thriller",
    )


def build_code_violet_cover_prompt() -> tuple[str, str]:
    """Series cover prompt for Code Violet (medical romance - Dr. Maya Chen)."""
    return build_series_cover_prompt(
        character_description="beautiful East Asian woman early 30s, sharp intelligent eyes, high cheekbones, straight black hair pulled back in a practical ponytail, minimal makeup, natural beauty, exhausted but determined expression, fitted navy blue scrubs, stethoscope around neck, hospital ID badge",
        scene_description="ER trauma bay at night, harsh fluorescent lights softened by depth of field, cardiac monitors glowing green in background, steel surfaces reflecting light, hint of city through window",
        pose_and_expression="standing with arms crossed, looking directly at viewer with piercing evaluating gaze, slight challenge in her expression, the look of someone who's seen everything and still fights",
        lighting_and_time="late night ER lighting, mix of harsh fluorescent and softer fill, dramatic shadows on her face, medical drama cinematic look",
        genre_style="medical romance drama, Grey's Anatomy aesthetic, Sandra Oh energy, cinematic and emotional",
    )


# Series cover prompt lookup
SERIES_COVER_PROMPTS = {
    "stolen-moments": build_stolen_moments_cover_prompt,
    "weekend-regular": build_weekend_regular_cover_prompt,
    "hometown-crush": build_hometown_crush_cover_prompt,
    "k-pop-boy-idol": build_kpop_boy_idol_cover_prompt,
    "midnight-evidence": build_midnight_evidence_cover_prompt,
    "penthouse-secrets": build_penthouse_secrets_cover_prompt,
    "code-violet": build_code_violet_cover_prompt,
}


# =============================================================================
# Main Generation Service
# =============================================================================

class ContentImageGenerator:
    """
    Generates content images (series covers, episode backgrounds).

    Uses purpose-specific prompt building - no cascade confusion.
    """

    def __init__(self, provider: str = "replicate", model: str = "black-forest-labs/flux-1.1-pro"):
        """Initialize with specified provider/model."""
        self.provider = provider
        self.model = model

    def _get_service(self) -> ImageService:
        """Get image service client."""
        return ImageService.get_client(self.provider, self.model)

    async def generate_episode_background(
        self,
        episode_title: str,
        episode_config: Optional[Dict[str, str]] = None,
        fallback_situation: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate an episode background image.

        Args:
            episode_title: Episode title (e.g., "3AM")
            episode_config: Optional explicit config dict
            fallback_situation: Fallback text if no config

        Returns:
            Dict with image bytes, prompt, model info
        """
        prompt, negative = build_episode_background_prompt(
            episode_title=episode_title,
            episode_config=episode_config,
            fallback_situation=fallback_situation,
        )

        width, height = ASPECT_RATIOS[ImageType.EPISODE_BACKGROUND]

        log.info(f"Generating episode background for '{episode_title}'")
        log.info(f"Prompt: {prompt[:200]}...")

        service = self._get_service()
        result = await service.generate(
            prompt=prompt,
            negative_prompt=negative,
            width=width,
            height=height,
        )

        return {
            "images": result.images,
            "prompt": prompt,
            "negative_prompt": negative,
            "model": result.model,
            "latency_ms": result.latency_ms,
            "image_type": ImageType.EPISODE_BACKGROUND,
        }

    async def generate_series_cover(
        self,
        character_description: str,
        scene_description: str,
        pose_and_expression: str,
        lighting_and_time: str,
        genre_style: str = "cinematic",
        use_reference: bool = False,
        reference_image_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        """
        Generate a series cover image (character in scene).

        Args:
            character_description: Full character appearance
            scene_description: Environmental context
            pose_and_expression: Character action/emotion
            lighting_and_time: Lighting setup
            genre_style: Genre-specific style cues
            use_reference: Whether to use FLUX Kontext with reference
            reference_image_bytes: Character anchor image if using reference

        Returns:
            Dict with image bytes, prompt, model info
        """
        prompt, negative = build_series_cover_prompt(
            character_description=character_description,
            scene_description=scene_description,
            pose_and_expression=pose_and_expression,
            lighting_and_time=lighting_and_time,
            genre_style=genre_style,
        )

        width, height = ASPECT_RATIOS[ImageType.SERIES_COVER]

        log.info(f"Generating series cover")
        log.info(f"Prompt: {prompt[:200]}...")

        if use_reference and reference_image_bytes:
            # Use FLUX Kontext for character consistency
            service = ImageService.get_client("replicate", "black-forest-labs/flux-kontext-pro")
            # Modify prompt to reference the input image
            kontext_prompt = f"Same person from reference image, {pose_and_expression}, in {scene_description}, {lighting_and_time}, cinematic wide shot, {genre_style}, masterpiece"
            result = await service.edit(
                prompt=kontext_prompt,
                reference_images=[reference_image_bytes],
                aspect_ratio="16:9",
            )
            prompt = kontext_prompt  # Update for return
        else:
            # Standard text-to-image
            service = self._get_service()
            result = await service.generate(
                prompt=prompt,
                negative_prompt=negative,
                width=width,
                height=height,
            )

        return {
            "images": result.images,
            "prompt": prompt,
            "negative_prompt": negative,
            "model": result.model,
            "latency_ms": result.latency_ms,
            "image_type": ImageType.SERIES_COVER,
            "used_reference": use_reference,
        }

    async def generate_stolen_moments_cover(
        self,
        use_reference: bool = False,
        reference_image_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        """
        Generate the Stolen Moments series cover specifically.

        Convenience method with pre-configured prompt for Soo-ah.
        """
        return await self.generate_series_cover(
            character_description="Young Korean woman in her mid-20s, natural beauty, tired but striking eyes, hair pulled back simply, wearing oversized hoodie with mask pulled down around chin",
            scene_description="empty neon-lit Seoul street at night, rain-wet pavement reflecting colorful signs, urban isolation",
            pose_and_expression="standing alone, looking back over shoulder with guarded but curious expression, slight tension in posture",
            lighting_and_time="night, neon lights reflecting on wet street, mix of warm and cool tones",
            genre_style="K-drama romantic tension aesthetic, moody urban atmosphere",
            use_reference=use_reference,
            reference_image_bytes=reference_image_bytes,
        )


# =============================================================================
# Batch Generation Helpers
# =============================================================================

async def generate_all_episode_backgrounds(
    series_slug: str,
    episode_configs: Dict[str, Dict[str, str]],
) -> List[Dict[str, Any]]:
    """
    Generate backgrounds for all episodes in a series.

    Args:
        series_slug: Series identifier
        episode_configs: Dict mapping episode titles to their configs

    Returns:
        List of generation results
    """
    generator = ContentImageGenerator()
    results = []

    for title, config in episode_configs.items():
        try:
            result = await generator.generate_episode_background(
                episode_title=title,
                episode_config=config,
            )
            result["episode_title"] = title
            result["success"] = True
            results.append(result)
            log.info(f"Generated background for '{title}'")
        except Exception as e:
            log.error(f"Failed to generate background for '{title}': {e}")
            results.append({
                "episode_title": title,
                "success": False,
                "error": str(e),
            })

    return results
