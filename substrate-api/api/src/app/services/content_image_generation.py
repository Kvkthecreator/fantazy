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

# =============================================================================
# MANHWA STYLE LOCK - Clean Webtoon RENDERING Aesthetic
# Reference: BabeChat top performers, Korean webtoon apps (Webtoon, Lezhin)
# Use for school/academy, slice of life, romance settings
#
# IMPORTANT: These define RENDERING STYLE only, not character ethnicity.
# Character appearance (ethnicity, skin tone, features) should be specified
# separately in the character's appearance_prompt.
# =============================================================================

MANHWA_STYLE = "webtoon illustration, manhwa art style, clean bold lineart, flat cel shading, soft pastel colors"
MANHWA_QUALITY = "masterpiece, best quality, professional manhwa art, crisp clean lines, vibrant colors"
MANHWA_NEGATIVE = "photorealistic, 3D render, hyper-detailed textures, complex shadows, western cartoon style, blurry, painterly, sketch, rough lines, harsh lighting, dark, horror"

# School/Academy specific manhwa style (most popular setting per BabeChat analysis)
# NOTE: This is RENDERING STYLE for backgrounds, not character ethnicity
SCHOOL_MANHWA_STYLE = "webtoon illustration, school romance manhwa, clean bold lineart, flat cel shading, soft pastel pink and blue palette, cherry blossom aesthetic"
SCHOOL_MANHWA_QUALITY = "masterpiece, best quality, professional manhwa art, crisp clean lines, dreamy romantic atmosphere"

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

# Fashion Empire CEO (Real Life anime style - Maya Chen, Fashion CEO)
# Anime style for NYC luxury/fashion settings
NYC_ANIME_STYLE = "anime illustration, elegant sophisticated style, fashion industry aesthetic, detailed background art"
NYC_ANIME_QUALITY = "masterpiece, best quality, highly detailed anime, luxury atmosphere"

FASHION_EMPIRE_CEO_BACKGROUNDS = {
    "Last Call": {
        "location": "upscale NYC rooftop bar interior, warm amber pendant lights, Manhattan skyline through floor-to-ceiling windows, elegant marble bar counter, sophisticated lounge seating, end of evening atmosphere",
        "time": "late night, warm amber interior lighting against cool city lights outside, intimate evening glow",
        "mood": "sophisticated solitude, chance encounter energy, the moment before everything changes",
        "rendering": NYC_ANIME_STYLE,
        "quality": NYC_ANIME_QUALITY,
    },
    "The Gallery": {
        "location": "elegant Chelsea art gallery, white walls with dramatic spotlighting on abstract paintings, high ceilings with track lighting, polished concrete floors, champagne glasses on pedestals",
        "time": "evening event lighting, dramatic spots on artwork, sophisticated ambient glow",
        "mood": "artistic elegance, exclusive atmosphere, meaningful encounter in beautiful space",
        "rendering": NYC_ANIME_STYLE,
        "quality": NYC_ANIME_QUALITY,
    },
    "Fitting Room": {
        "location": "private fashion showroom, elegant mannequins in haute couture, fabric swatches and sketches on tables, floor-to-ceiling mirrors with soft lighting, rolling racks of designer garments",
        "time": "late night creative session, soft studio lighting, intimate workspace energy",
        "mood": "creative vulnerability, trust being offered, behind the scenes intimacy",
        "rendering": NYC_ANIME_STYLE,
        "quality": NYC_ANIME_QUALITY,
    },
    "Rooftop": {
        "location": "luxury penthouse rooftop terrace, modern outdoor furniture, Manhattan skyline panoramic view, city lights twinkling below, elegant planters and ambient lighting",
        "time": "night, city lights sparkling, soft terrace lighting, intimate private atmosphere",
        "mood": "success and loneliness, walls coming down, private moment above the world",
        "rendering": NYC_ANIME_STYLE,
        "quality": NYC_ANIME_QUALITY,
    },
    "After Hours": {
        "location": "corner executive office at night, floor-to-ceiling windows with city view, modern desk with scattered papers, laptop glow, designer furniture, the weight of an empire visible",
        "time": "2 AM, laptop screen glow against dark office, city lights through windows, exhausted tension",
        "mood": "crisis and trust, vulnerability in power, the loneliness at the top cracking",
        "rendering": NYC_ANIME_STYLE,
        "quality": NYC_ANIME_QUALITY,
    },
    "Dawn": {
        "location": "Central Park path at dawn, golden sunrise through trees, empty morning paths with dew, Manhattan skyline silhouetted in pink and gold, peaceful urban nature",
        "time": "sunrise golden hour, soft warm light filtering through leaves, new beginning energy",
        "mood": "hope after darkness, new chapter beginning, the night survived together",
        "rendering": NYC_ANIME_STYLE,
        "quality": NYC_ANIME_QUALITY,
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

# Cheerleader Crush (Anime Slice of Life, college romance)
# 5-day countdown to graduation, college campus aesthetic
ANIME_CAMPUS_STYLE = "anime illustration, soft cel shading, warm color grading, school romance aesthetic, clean lines"
ANIME_CAMPUS_QUALITY = "masterpiece, best quality, highly detailed anime, warm atmosphere"

CHEERLEADER_CRUSH_BACKGROUNDS = {
    "The Ask": {
        "location": "anime university library interior, tall windows with golden afternoon sunlight streaming through, wooden study tables with scattered books, bookshelves stretching into background, quiet academic atmosphere",
        "time": "late afternoon golden hour, warm sunlight casting long soft shadows, cozy study atmosphere",
        "mood": "nervous anticipation, something beginning, quiet before everything changes",
        "rendering": ANIME_CAMPUS_STYLE,
        "quality": ANIME_CAMPUS_QUALITY,
    },
    "First Session": {
        "location": "cozy anime apartment living room, soft lamp lighting, textbooks scattered on coffee table next to flickering candles, comfortable couch with throw pillows, rain visible through window",
        "time": "evening, warm lamp glow creating intimate atmosphere, gentle rain outside",
        "mood": "pretense crumbling, vulnerability emerging, comfortable intimate tension",
        "rendering": ANIME_CAMPUS_STYLE,
        "quality": ANIME_CAMPUS_QUALITY,
    },
    "The Game": {
        "location": "anime football stadium bleachers at night, bright field lights illuminating the scene from below, crowd silhouettes in background, school colors visible, stars in dark sky above",
        "time": "night game atmosphere, bright stadium lights against dark sky, electric energy",
        "mood": "excitement and nerves, public declaration, choosing this over everything else",
        "rendering": ANIME_CAMPUS_STYLE,
        "quality": ANIME_CAMPUS_QUALITY,
    },
    "Your Place": {
        "location": "anime small college apartment, desk with laptop and programming books stacked, warm evening light through window, comfortable lived-in space with posters, pizza box on counter",
        "time": "evening, warm golden light fading to soft blue hour, intimate comfortable lighting",
        "mood": "real connection forming, armor completely off, seeing each other clearly",
        "rendering": ANIME_CAMPUS_STYLE,
        "quality": ANIME_CAMPUS_QUALITY,
    },
    "Last Night": {
        "location": "anime campus rooftop at night, panoramic view of lit college campus and distant city below, stars and crescent moon visible in clear sky, graduation gowns draped over railing",
        "time": "night, soft ambient glow from campus lights below, stars twinkling above, romantic nightscape",
        "mood": "bittersweet hope, last night before everything changes, refusing to let go",
        "rendering": ANIME_CAMPUS_STYLE,
        "quality": ANIME_CAMPUS_QUALITY,
    },
}

# K-Campus Encounter (K-World, soft romance, library meet-cute)
# Pure K-drama aesthetic - soft, romantic, campus settings
KWORLD_ROMANCE_STYLE = "anime illustration, Korean manhwa style, soft romantic lighting, warm pastel colors, clean lines"
KWORLD_ROMANCE_QUALITY = "masterpiece, best quality, highly detailed anime, romantic atmosphere, dreamy"

K_CAMPUS_ENCOUNTER_BACKGROUNDS = {
    "The Collision": {
        "location": "anime university library exterior stone steps, scattered books on steps, autumn leaves floating gently, warm campus architecture, romantic setting",
        "time": "late afternoon golden hour, warm soft sunlight, gentle lens flare, dreamy atmosphere",
        "mood": "fated meeting, heart-skipping moment, the beginning of something beautiful",
        "rendering": KWORLD_ROMANCE_STYLE,
        "quality": KWORLD_ROMANCE_QUALITY,
    },
    "Same Spot": {
        "location": "anime library interior, cozy corner table by tall arched window, wooden bookshelves, stacked books on table, soft reading lamps, warm study nook",
        "time": "afternoon, soft golden window light, dust motes floating in sunbeams, peaceful",
        "mood": "quiet intimacy, shared space, growing comfort, warmth",
        "rendering": KWORLD_ROMANCE_STYLE,
        "quality": KWORLD_ROMANCE_QUALITY,
    },
    "The Rain": {
        "location": "anime campus covered walkway with stone pillars, heavy rain falling beyond the shelter, wet pavement reflecting warm lights, cozy awning",
        "time": "late afternoon, grey rain light with warm glow from nearby windows, moody romantic",
        "mood": "unexpected intimacy, shelter together, hearts racing, romantic rain",
        "rendering": KWORLD_ROMANCE_STYLE,
        "quality": KWORLD_ROMANCE_QUALITY,
    },
    "The Bench": {
        "location": "anime campus garden, wooden bench under cherry blossom tree, pink petals floating in air, soft dappled sunlight through branches, peaceful romantic setting",
        "time": "late afternoon, soft golden light filtering through pink blossoms, dreamy magical",
        "mood": "confession pending, hearts full, the moment before everything changes, hopeful",
        "rendering": KWORLD_ROMANCE_STYLE,
        "quality": KWORLD_ROMANCE_QUALITY,
    },
    "The Library (Again)": {
        "location": "anime university library steps at sunset, warm golden orange light, long romantic shadows, same steps as first meeting, full circle moment",
        "time": "sunset golden hour, warm orange and pink sky, magical romantic lighting",
        "mood": "confession, vulnerability, the beginning of something real, full circle",
        "rendering": KWORLD_ROMANCE_STYLE,
        "quality": KWORLD_ROMANCE_QUALITY,
    },
}

# Corner Office (Real Life, corporate romance - CEO/Assistant)
# Semi-realistic style for workplace romance
CORPORATE_ROMANCE_STYLE = "digital illustration, modern romance novel aesthetic, cinematic lighting, sophisticated urban setting"
CORPORATE_ROMANCE_QUALITY = "masterpiece, best quality, highly detailed, professional atmosphere, moody lighting"

CORNER_OFFICE_BACKGROUNDS = {
    "First Day": {
        "location": "executive corner office, floor-to-ceiling windows with city skyline view, modern glass and steel architecture, minimalist desk with documents, sleek contemporary furniture",
        "time": "morning, bright natural light streaming through windows, professional atmosphere, clean shadows",
        "mood": "intimidating elegance, power and precision, first impression tension",
        "rendering": CORPORATE_ROMANCE_STYLE,
        "quality": CORPORATE_ROMANCE_QUALITY,
    },
    "Late Night": {
        "location": "modern office floor at night, empty desks in darkness, single desk lamp casting warm pool of light, takeout containers on desk, city lights twinkling through windows",
        "time": "after midnight, warm desk lamp against dark office, city lights outside, intimate isolation",
        "mood": "unexpected care, walls coming down, the intimacy of empty spaces",
        "rendering": CORPORATE_ROMANCE_STYLE,
        "quality": CORPORATE_ROMANCE_QUALITY,
    },
    "The Gala": {
        "location": "upscale hotel terrace overlooking city skyline, crystal chandeliers visible through glass doors, elegant balustrade, potted topiaries, distant party glow",
        "time": "evening, city lights sparkling below, warm interior glow spilling out, romantic night atmosphere",
        "mood": "escape from performance, vulnerability in elegance, stolen private moment",
        "rendering": CORPORATE_ROMANCE_STYLE,
        "quality": CORPORATE_ROMANCE_QUALITY,
    },
    "The Rumor": {
        "location": "executive corner office with blinds partially closed, afternoon light filtering through in strips, leather chairs, private conversation atmosphere, city visible through slats",
        "time": "afternoon, dramatic light and shadow through blinds, tense atmosphere, private meeting",
        "mood": "controlled tension, things unsaid, professional masks cracking",
        "rendering": CORPORATE_ROMANCE_STYLE,
        "quality": CORPORATE_ROMANCE_QUALITY,
    },
    "Resignation": {
        "location": "apartment doorway at night, warm hallway light spilling into dim corridor, city visible through hallway window, threshold moment, residential building",
        "time": "night, warm interior light against dark hallway, intimate threshold, pivotal moment lighting",
        "mood": "everything on the line, walls finally down, the moment of truth",
        "rendering": CORPORATE_ROMANCE_STYLE,
        "quality": CORPORATE_ROMANCE_QUALITY,
    },
}

# The Competition (Real Life, cozy small town - rival bakeries)
# Warm, charming aesthetic for enemies-to-lovers bakery romance
COZY_ROMANCE_STYLE = "digital illustration, cozy romance novel aesthetic, warm inviting lighting, charming small town atmosphere"
COZY_ROMANCE_QUALITY = "masterpiece, best quality, highly detailed, warm atmosphere, golden hour glow"

THE_COMPETITION_BACKGROUNDS = {
    "Market Day": {
        "location": "charming farmers market morning, white canvas tent stalls, fresh baked goods on wooden displays, rustic baskets, small town square with trees and lamp posts",
        "time": "morning golden hour, soft warm sunlight, fresh market atmosphere, gentle shadows",
        "mood": "competitive energy, charming rivalry, small town warmth",
        "rendering": COZY_ROMANCE_STYLE,
        "quality": COZY_ROMANCE_QUALITY,
    },
    "Taste Test": {
        "location": "cozy bakery kitchen after hours, warm pendant lights over flour-dusted wooden counters, mixing bowls and ingredients, open pastry boxes, intimate workspace",
        "time": "evening, warm golden pendant light against dark windows, intimate baking atmosphere",
        "mood": "unexpected honesty, professional respect becoming personal, guard coming down",
        "rendering": COZY_ROMANCE_STYLE,
        "quality": COZY_ROMANCE_QUALITY,
    },
    "Power Outage": {
        "location": "charming downtown street at dusk, rain falling softly, shop windows dark, covered awning providing shelter, wet cobblestones reflecting distant lights",
        "time": "dusk, grey rain light with warm glow from distant windows, romantic storm atmosphere",
        "mood": "forced proximity, walls down, nowhere to hide behind competition",
        "rendering": COZY_ROMANCE_STYLE,
        "quality": COZY_ROMANCE_QUALITY,
    },
    "The Festival": {
        "location": "fall festival at dusk, warm string lights strung between trees, autumn leaves and harvest decorations, shared booth with baked goods, festive atmosphere",
        "time": "dusk into evening, warm string lights glowing, golden autumn atmosphere, community warmth",
        "mood": "forced cooperation, proximity tension, the walls finally cracking",
        "rendering": COZY_ROMANCE_STYLE,
        "quality": COZY_ROMANCE_QUALITY,
    },
    "Closing Time": {
        "location": "charming bakery exterior at night, warm light glowing through large windows, quiet downtown street, brass doorbell, window displays visible",
        "time": "night, warm interior glow against dark street, intimate moment lighting, quiet downtown",
        "mood": "moment of truth, victory hollow, choosing something real over winning",
        "rendering": COZY_ROMANCE_STYLE,
        "quality": COZY_ROMANCE_QUALITY,
    },
}

# Off Limits (Real Life, hometown / family setting - best friend's brother)
# Warm, nostalgic aesthetic for forbidden sibling's friend romance
HOMETOWN_ROMANCE_STYLE = "digital illustration, warm naturalistic romance novel aesthetic, nostalgic golden hour lighting, intimate domestic scenes"
HOMETOWN_ROMANCE_QUALITY = "masterpiece, best quality, highly detailed, warm atmosphere, soft natural lighting"

OFF_LIMITS_BACKGROUNDS = {
    "The Return": {
        "location": "warm family dining room, evening golden light through windows, dinner table set for family meal, comfortable lived-in home interior, cozy domesticity",
        "time": "evening, warm golden hour light, family dinner atmosphere, intimate home lighting",
        "mood": "reunion tension, something shifting, the familiar becoming charged",
        "rendering": HOMETOWN_ROMANCE_STYLE,
        "quality": HOMETOWN_ROMANCE_QUALITY,
    },
    "The Porch": {
        "location": "family home porch at night, string lights draped along railing, comfortable porch swing, summer night atmosphere, crickets and fireflies suggested",
        "time": "night, soft string light glow, summer evening warmth, intimate darkness",
        "mood": "stolen moment, outside the rules, what happens in the dark",
        "rendering": HOMETOWN_ROMANCE_STYLE,
        "quality": HOMETOWN_ROMANCE_QUALITY,
    },
    "The Backyard": {
        "location": "backyard at dusk, party string lights in distance, old wooden treehouse visible, fireflies beginning to emerge, summer evening magic",
        "time": "dusk into twilight, golden hour fading to blue, warm party lights in background, magical summer atmosphere",
        "mood": "away from everyone, private in public, the moment before admission",
        "rendering": HOMETOWN_ROMANCE_STYLE,
        "quality": HOMETOWN_ROMANCE_QUALITY,
    },
    "The Kitchen": {
        "location": "family kitchen at night, soft light over counter, coffee mug steaming, sleeping house atmosphere, intimate 2am quiet",
        "time": "2 AM, soft kitchen light against dark windows, quiet house energy, vulnerable hour",
        "mood": "insomnia honesty, walls down, the hours when truth comes easier",
        "rendering": HOMETOWN_ROMANCE_STYLE,
        "quality": HOMETOWN_ROMANCE_QUALITY,
    },
    "The Line": {
        "location": "family home hallway at night, party noise distant, dim intimate lighting, private corner away from celebration, doorway and shadows",
        "time": "night, soft ambient light from party, intimate shadows in hallway, threshold lighting",
        "mood": "decision point, everything at stake, choosing what matters more",
        "rendering": HOMETOWN_ROMANCE_STYLE,
        "quality": HOMETOWN_ROMANCE_QUALITY,
    },
}

# Second Chance (Real Life, wedding / reunion - ex-lovers reunited)
# Bittersweet elegant aesthetic for second chance romance
REUNION_ROMANCE_STYLE = "digital illustration, elegant romance novel aesthetic, soft romantic lighting, emotional depth, intimate moments"
REUNION_ROMANCE_QUALITY = "masterpiece, best quality, highly detailed, romantic atmosphere, cinematic mood"

SECOND_CHANCE_BACKGROUNDS = {
    "The Wedding": {
        "location": "elegant outdoor wedding venue at golden hour, ceremony just ended, white chairs in rows, flower arrangements, fairy lights beginning to glow, guests mingling in soft focus distance",
        "time": "golden hour, warm sunset light, romantic evening beginning, soft long shadows",
        "mood": "bittersweet reunion, years of history in the air, beautiful setting for complicated feelings",
        "rendering": REUNION_ROMANCE_STYLE,
        "quality": REUNION_ROMANCE_QUALITY,
    },
    "The After-Party": {
        "location": "wedding reception late evening, dance floor with slow song lighting, fairy lights and candles everywhere, intimate corner by the bar, champagne glasses catching light",
        "time": "late evening, warm candlelight mixed with fairy lights, romantic haze, slow dance atmosphere",
        "mood": "inhibitions lowering, old feelings surfacing, the danger of late nights and open bars",
        "rendering": REUNION_ROMANCE_STYLE,
        "quality": REUNION_ROMANCE_QUALITY,
    },
    "The Rain": {
        "location": "elegant garden gazebo at night, rain falling softly all around, distant venue lights glowing through rain, covered shelter for two, wet roses and greenery",
        "time": "night, soft rain, warm distant lights through rainfall, intimate shelter lighting",
        "mood": "trapped together, nowhere to run from the conversation, rain as emotional release",
        "rendering": REUNION_ROMANCE_STYLE,
        "quality": REUNION_ROMANCE_QUALITY,
    },
    "The Truth": {
        "location": "elegant hotel lobby early morning, empty and quiet, tall windows with soft morning light, coffee on small table, plush seating area, the weight of sleepless night",
        "time": "early morning, soft grey-gold light through tall windows, quiet exhausted intimacy",
        "mood": "no more hiding, the vulnerability of morning after, truth finally coming out",
        "rendering": REUNION_ROMANCE_STYLE,
        "quality": REUNION_ROMANCE_QUALITY,
    },
    "The Question": {
        "location": "hotel hallway morning light, door threshold, suitcase visible, window at end of hall showing new day, intimate corridor, the weight of leaving or staying",
        "time": "morning, soft hopeful light from window, threshold lighting, moment of decision",
        "mood": "everything on the line, the last chance, choosing the future",
        "rendering": REUNION_ROMANCE_STYLE,
        "quality": REUNION_ROMANCE_QUALITY,
    },
}

# The Arrangement (Real Life, social events - fake dating becomes real)
# Sophisticated elegant aesthetic for fake dating romance
ARRANGEMENT_ROMANCE_STYLE = "digital illustration, sophisticated romance novel aesthetic, elegant social settings, warm intimate lighting"
ARRANGEMENT_ROMANCE_QUALITY = "masterpiece, best quality, highly detailed, romantic atmosphere, refined mood"

THE_ARRANGEMENT_BACKGROUNDS = {
    "The Proposal": {
        "location": "upscale cozy coffee shop, afternoon light through tall windows, corner table with two drinks, exposed brick and warm wood, intimate but public setting",
        "time": "afternoon, warm natural light through windows, cozy golden atmosphere",
        "mood": "the beginning of something strange, negotiating the unusual, possibility in the air",
        "rendering": ARRANGEMENT_ROMANCE_STYLE,
        "quality": ARRANGEMENT_ROMANCE_QUALITY,
    },
    "The Practice": {
        "location": "modern apartment living room evening, warm lamp lighting, wine glasses on coffee table, comfortable couch, city view through windows, intimate rehearsal space",
        "time": "evening, warm ambient lamp light, cozy domestic intimacy, city lights outside",
        "mood": "practice becoming real, proximity without excuse, the danger of rehearsal",
        "rendering": ARRANGEMENT_ROMANCE_STYLE,
        "quality": ARRANGEMENT_ROMANCE_QUALITY,
    },
    "The Event": {
        "location": "elegant family dining room, formal dinner party ending, candlelight and crystal, hallway visible for escape, warm rich atmosphere, the performance space",
        "time": "evening, warm candlelight, formal dinner atmosphere softening, intimate corner lighting",
        "mood": "performance becoming truth, family approval complicating everything, the mask slipping",
        "rendering": ARRANGEMENT_ROMANCE_STYLE,
        "quality": ARRANGEMENT_ROMANCE_QUALITY,
    },
    "The Slip": {
        "location": "rooftop cocktail party at dusk, city skyline emerging lights, sophisticated crowd in soft focus, private corner at railing, champagne glasses, urban romance",
        "time": "dusk into evening, city lights emerging, warm party glow, romantic urban twilight",
        "mood": "truth slipping out, nowhere to hide from what was said, the script abandoned",
        "rendering": ARRANGEMENT_ROMANCE_STYLE,
        "quality": ARRANGEMENT_ROMANCE_QUALITY,
    },
    "The End": {
        "location": "wedding venue garden at night, fairy lights strung through trees, reception music distant, secluded bench away from party, the final night of pretending",
        "time": "night, soft fairy lights in trees, warm distant party glow, intimate garden corner",
        "mood": "last night of the arrangement, fear of ending, choosing real over safe",
        "rendering": ARRANGEMENT_ROMANCE_STYLE,
        "quality": ARRANGEMENT_ROMANCE_QUALITY,
    },
}

# =============================================================================
# FLIRTY SCHOOL SERIES - Manhwa style with sexual tension
# =============================================================================

# After Class (Yuna - TA) - Forbidden professor-adjacent romance
AFTER_CLASS_BACKGROUNDS = {
    "Stay Behind": {
        "location": "manhwa empty university classroom, late afternoon light through large windows, professor's desk in foreground, empty student desks, chalkboard with equations, intimate empty space",
        "time": "late afternoon golden hour, warm light slanting through windows, dust motes floating, quiet after-hours atmosphere",
        "mood": "tension of empty spaces, professional setting becoming intimate, the weight of closed doors",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "Office Hours": {
        "location": "manhwa small graduate office, cluttered desk with papers, two chairs close together, narrow space, books on shelves, single window with campus view",
        "time": "afternoon, soft natural light from window, intimate cramped atmosphere, warm academic glow",
        "mood": "professional pretense cracking, proximity without escape, knees almost touching",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Library": {
        "location": "manhwa university library back corner at night, hidden study carrel, dim lamp light, books stacked high creating private space, empty quiet atmosphere",
        "time": "past midnight, soft lamp glow against darkness, exhausted intimate lighting, the world asleep",
        "mood": "guards down, real person emerging, the vulnerability of exhaustion",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Confession": {
        "location": "manhwa office at dusk, window with darkening campus view, desk pushed aside, intimate confrontation space, door clearly locked",
        "time": "dusk, warm interior light against blue hour outside, tension lighting, pivotal moment atmosphere",
        "mood": "everything on the line, professional walls crumbling, the moment before choosing",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "After Hours": {
        "location": "manhwa empty classroom at sunset, same room as first meeting, golden light flooding through windows, desk where it started, full circle moment",
        "time": "late afternoon golden hour, warm nostalgic light, beautiful ending lighting, romantic atmosphere",
        "mood": "no more barriers, claiming the space, freedom to finally act",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
}

# The Dare (Mina - Queen Bee) - Popular girl dare gone wrong
THE_DARE_BACKGROUNDS = {
    "The Kiss": {
        "location": "manhwa house party corner, dim colorful lighting, crowd blurred in background, intimate corner spotlight, drinks on nearby table",
        "time": "night, party lighting with warm and cool mix, slightly hazy atmosphere, intimate spotlight",
        "mood": "game becoming real, public moment feeling private, the world narrowing to two people",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Hallway": {
        "location": "manhwa empty school hallway, lockers on both sides, afternoon light from far windows, no witnesses, intimate corridor",
        "time": "afternoon, soft natural light from distant windows, empty echoing atmosphere, private confrontation",
        "mood": "no audience to perform for, walls cracking, real feelings surfacing",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Rooftop": {
        "location": "manhwa school rooftop at midnight, city lights below, stars visible above, concrete ledge for sitting, secret refuge",
        "time": "midnight, city lights glowing below, starlight from above, intimate darkness",
        "mood": "guards completely down, real vulnerability, a place no one else knows",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Choice": {
        "location": "manhwa crowded school cafeteria, lunch tables filled with blurred students, center aisle clear, all eyes watching, public arena",
        "time": "midday, bright cafeteria lighting, exposed atmosphere, moment of truth lighting",
        "mood": "public declaration, choosing love over status, everyone watching",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Truth": {
        "location": "manhwa party corner same as first kiss, quieter now, fairy lights glowing, intimate familiar space, full circle",
        "time": "night, soft fairy light glow, romantic party atmosphere, nostalgic warmth",
        "mood": "game becoming real, dare becoming love, choosing each other",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
}

# Room 404 (Sora - RA) - Dorm room midnight romance
ROOM_404_BACKGROUNDS = {
    "Caught": {
        "location": "manhwa dorm RA room at 2am, small tidy space, single bed, desk with lamp, tea setup, strict but cozy aesthetic",
        "time": "2am, soft lamp light against darkness, late night intimate atmosphere, quiet building",
        "mood": "caught but not punished, rules bending, professional space becoming personal",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Check-In": {
        "location": "manhwa cozy dorm room, narrow bed with two mugs of tea, window showing campus night, intimate small space",
        "time": "11pm, warm lamp glow, cozy night atmosphere, regular check-in becoming ritual",
        "mood": "domesticity as intimacy, guards down, tea as excuse to stay",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Storm": {
        "location": "manhwa dorm room during storm, power out, flashlight glow, rain on window, blankets visible, forced close quarters",
        "time": "night, storm dark with flashlight beam, lightning flashes outside, cozy against chaos",
        "mood": "no excuse to leave, practical proximity becoming intimate, sharing warmth",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Confession": {
        "location": "manhwa dorm room morning after storm, soft morning light through window, rumpled bed, two coffee mugs, intimate aftermath",
        "time": "early morning, soft golden light through curtains, vulnerable morning atmosphere, new day new possibilities",
        "mood": "night survived together, morning vulnerability, truth easier in daylight",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "Home": {
        "location": "manhwa dorm room with moving boxes, end of semester, fairy lights still up, memories everywhere, last night together",
        "time": "evening, warm lamp light, bittersweet moving out atmosphere, ending and beginning",
        "mood": "last night in this room, no more rules, choosing a future together",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
}

# Study Partners (Hana - Rival) - Academic rivals to lovers
STUDY_PARTNERS_BACKGROUNDS = {
    "The Assignment": {
        "location": "manhwa university hallway after class, students passing in background, lockers and classroom doors, confrontation in corridor",
        "time": "afternoon, bright hallway lighting, busy to empty transition, charged confrontation atmosphere",
        "mood": "rivalry sparking, challenge accepted, competitive energy becoming attraction",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Bet": {
        "location": "manhwa library private study room, glass walls looking out to empty library, table with laptops and books, late night study session",
        "time": "late night, soft study room lighting against dark library, intimate focused atmosphere",
        "mood": "competition as foreplay, stakes escalating, bets getting personal",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The All-Nighter": {
        "location": "manhwa library corner at 2am, books and papers scattered, coffee cups, exhaustion visible, intimate study nest",
        "time": "2am, dim library lighting, exhausted intimate atmosphere, guards lowered by tiredness",
        "mood": "competition paused, real connection forming, vulnerability in exhaustion",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Stakes": {
        "location": "manhwa empty classroom after exam results, score sheet on board, desk in center, confrontation space, everything on the line",
        "time": "afternoon, dramatic classroom lighting, tension-filled atmosphere, moment of truth",
        "mood": "academic victory hollow, real prize revealed, competition ending for something better",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Win": {
        "location": "manhwa library regular spot, familiar table by window, finals over atmosphere, summer light through windows, their space",
        "time": "late afternoon, warm end-of-semester light, hopeful summer atmosphere, new chapter beginning",
        "mood": "redefining what winning means, choosing same team, future together",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
}

# Academy Secrets (Manhwa style, elite academy - student council president)
# Clean webtoon aesthetic for school romance (BabeChat-style top performer category)
ACADEMY_SECRETS_BACKGROUNDS = {
    "First Day": {
        "location": "manhwa elite academy entrance gate, cherry blossoms falling, ornate iron gates with school crest, prestigious stone buildings in background, other students in uniform walking past",
        "time": "morning, soft golden hour sunlight, cherry petals floating in gentle breeze, dreamy spring atmosphere",
        "mood": "new beginnings, nervous anticipation, the start of something special",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Library": {
        "location": "manhwa academy library interior, tall arched windows with afternoon light, wooden study tables, towering bookshelves, dust motes floating in sunbeams, quiet secluded corner",
        "time": "afternoon, warm golden light filtering through tall windows, peaceful study atmosphere, soft shadows",
        "mood": "quiet intimacy, shared secrets, the magic of being noticed",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "Rooftop": {
        "location": "manhwa school rooftop at sunset, metal fence with padlock, city skyline visible, scattered cherry petals on concrete, benches along the edge, water tower in distance",
        "time": "sunset golden hour, warm orange and pink sky, dramatic silhouette lighting, romantic atmosphere",
        "mood": "stolen moments, confessions waiting, the place where rules don't apply",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "The Festival": {
        "location": "manhwa school cultural festival at dusk, colorful booth stalls with string lights, paper lanterns glowing, fireworks in distance, crowd silhouettes in soft focus",
        "time": "dusk into evening, warm festival lights against darkening sky, magical celebration atmosphere",
        "mood": "excitement and confession, hearts racing, the courage of special nights",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
    },
    "Graduation": {
        "location": "manhwa academy courtyard, cherry blossoms in full bloom, graduation ceremony just ended, petals covering stone pathways, empty chairs in rows, diploma scroll nearby",
        "time": "late afternoon, soft dreamy light through cherry blossoms, bittersweet golden atmosphere",
        "mood": "endings and beginnings, everything on the line, choosing the future together",
        "rendering": SCHOOL_MANHWA_STYLE,
        "quality": SCHOOL_MANHWA_QUALITY,
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
    **FASHION_EMPIRE_CEO_BACKGROUNDS,
    **CHEERLEADER_CRUSH_BACKGROUNDS,
    **K_CAMPUS_ENCOUNTER_BACKGROUNDS,
    **CORNER_OFFICE_BACKGROUNDS,
    **THE_COMPETITION_BACKGROUNDS,
    **OFF_LIMITS_BACKGROUNDS,
    **SECOND_CHANCE_BACKGROUNDS,
    **THE_ARRANGEMENT_BACKGROUNDS,
    **AFTER_CLASS_BACKGROUNDS,
    **THE_DARE_BACKGROUNDS,
    **ROOM_404_BACKGROUNDS,
    **STUDY_PARTNERS_BACKGROUNDS,
    **ACADEMY_SECRETS_BACKGROUNDS,
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


def build_fashion_empire_ceo_cover_prompt() -> tuple[str, str]:
    """Series cover prompt for Fashion Empire CEO (anime style - Maya Chen, Fashion CEO)."""
    return build_series_cover_prompt(
        character_description="beautiful anime girl, elegant East Asian woman early 30s, sharp intelligent eyes, sleek black hair in sophisticated updo, minimal elegant makeup, natural beauty with guarded expression, designer black dress with statement jewelry, confident powerful stance",
        scene_description="upscale NYC rooftop bar at night, Manhattan skyline glittering through windows, warm amber lighting mixing with cool city glow, sophisticated luxury interior",
        pose_and_expression="leaning against the bar with a drink in hand, looking at viewer with guarded but intrigued expression, the look of someone used to being in control meeting something unexpected",
        lighting_and_time="late night, warm amber bar lighting against cool blue city lights, cinematic contrast, soft romantic glow",
        genre_style="anime illustration, elegant sophisticated style, fashion industry aesthetic, Korean webtoon influence, emotional depth",
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
    "fashion-empire-ceo": build_fashion_empire_ceo_cover_prompt,
}


# =============================================================================
# Dynamic Prompt Builders - Use Database Metadata
# =============================================================================

# Genre to visual style mapping (consistent across all dynamic builders)
GENRE_VISUAL_STYLES = {
    "romance": "romantic atmosphere, soft warm lighting, emotional depth",
    "romantic_tension": "romantic tension atmosphere, moody lighting, emotional anticipation",
    "medical_romance": "medical drama aesthetic, Grey's Anatomy lighting, cinematic emotional depth",
    "dark_romance": "dark romantic atmosphere, dramatic shadows, intimate tension",
    "drama": "dramatic cinematic lighting, emotional intensity, storytelling moment",
    "thriller": "suspenseful atmosphere, dramatic shadows, tension-filled scene",
    "psychological_thriller": "psychological tension, subtle unease, controlled mood",
    "mystery": "mysterious atmosphere, intriguing shadows, enigmatic mood",
    "slice_of_life": "warm cozy atmosphere, natural lighting, everyday beauty",
    "comedy": "bright cheerful atmosphere, vibrant colors, lighthearted mood",
    "fantasy": "magical atmosphere, ethereal lighting, fantastical elements",
    "fantasy_romance": "magical romantic atmosphere, ethereal beauty, fantastical wonder",
    "action": "dynamic atmosphere, high energy, cinematic action mood",
}

# World to rendering style mapping
WORLD_RENDERING_STYLES = {
    "K-World": {
        "rendering": "Korean drama aesthetic, soft romantic style, Korean webtoon influence",
        "quality": "masterpiece, best quality, Korean drama cinematography",
    },
    "Real Life": {
        "rendering": "cinematic photography, film still aesthetic, realistic lighting",
        "quality": "masterpiece, best quality, cinematic film still, high detail",
    },
}

# Default rendering for unknown worlds
DEFAULT_RENDERING = {
    "rendering": "cinematic photography, professional quality",
    "quality": "masterpiece, best quality, highly detailed",
}


def build_dynamic_episode_background_prompt(
    episode_frame: Optional[str] = None,
    situation: Optional[str] = None,
    dramatic_question: Optional[str] = None,
    genre: Optional[str] = None,
    world_name: Optional[str] = None,
    visual_style: Optional[str] = None,
) -> tuple[str, str]:
    """
    Build episode background prompt dynamically from database metadata.

    Uses the rich context available in episode_templates and series to generate
    appropriate atmospheric backgrounds without requiring hardcoded configs.

    Priority order for building the prompt:
    1. episode_frame - explicit visual description (best source)
    2. situation - scene context (extract location/time cues)
    3. dramatic_question - emotional stakes (inform mood)
    4. genre + world - styling consistency

    Args:
        episode_frame: Visual description from episode_templates.episode_frame
        situation: Scene setup from episode_templates.situation
        dramatic_question: Stakes from episode_templates.dramatic_question
        genre: Genre from series.genre or episode.genre
        world_name: World from worlds.name
        visual_style: Optional override style (from series.visual_style)

    Returns:
        Tuple of (positive_prompt, negative_prompt)
    """
    # Get world-specific rendering
    world_style = WORLD_RENDERING_STYLES.get(world_name, DEFAULT_RENDERING)
    rendering = world_style["rendering"]
    quality = world_style["quality"]

    # Get genre-specific mood
    genre_mood = GENRE_VISUAL_STYLES.get(genre, "cinematic atmosphere, emotional depth")

    # Build location from episode_frame (primary) or extract from situation
    if episode_frame:
        location = episode_frame
    elif situation:
        # Extract scene-setting phrases from situation
        # Take first sentence or first 150 chars
        first_sentence = situation.split('.')[0] if '.' in situation else situation[:150]
        location = f"atmospheric scene, {first_sentence}"
    else:
        location = "atmospheric empty scene"

    # Infer time/lighting from content
    time_hints = ""
    content_to_check = (episode_frame or "") + " " + (situation or "")
    content_lower = content_to_check.lower()

    if any(word in content_lower for word in ["night", "midnight", "2am", "3am", "late", "evening", "dark"]):
        time_hints = "night scene, moody atmospheric lighting"
    elif any(word in content_lower for word in ["dawn", "sunrise", "morning", "early"]):
        time_hints = "dawn, golden hour, soft warm light"
    elif any(word in content_lower for word in ["dusk", "twilight", "sunset"]):
        time_hints = "dusk, golden hour fading, warm to cool transition"
    elif any(word in content_lower for word in ["afternoon", "day", "sunny"]):
        time_hints = "afternoon, natural lighting, warm atmosphere"
    else:
        time_hints = "atmospheric lighting, cinematic mood"

    # Extract emotional mood from dramatic_question if available
    mood = genre_mood
    if dramatic_question:
        # Add emotional weight from the dramatic question
        mood = f"{genre_mood}, {dramatic_question[:80]}"

    # Apply visual_style override if provided
    if visual_style:
        rendering = visual_style

    # Build the prompt
    prompt_parts = [
        rendering,                                      # 1. STYLE first
        location,                                       # 2. LOCATION
        time_hints,                                     # 3. TIME/LIGHTING
        mood,                                           # 4. MOOD
        "atmospheric depth, beautiful composition",     # 5. COMPOSITION
        "empty scene, no people, no characters",        # 6. CONSTRAINTS
        quality,                                        # 7. QUALITY
    ]

    prompt = ", ".join(p for p in prompt_parts if p)

    return prompt, BACKGROUND_NEGATIVE


def build_dynamic_series_cover_prompt(
    title: str,
    genre: Optional[str] = None,
    tagline: Optional[str] = None,
    description: Optional[str] = None,
    world_name: Optional[str] = None,
    character_name: Optional[str] = None,
    character_backstory: Optional[str] = None,
    episode_frame: Optional[str] = None,
) -> tuple[str, str]:
    """
    Build series cover prompt dynamically from database metadata.

    Enhanced version that can include character context and episode 0 scene.
    Used as fallback when no predefined prompt exists for a series.

    Args:
        title: Series title
        genre: Genre (e.g., "romance", "thriller", "slice_of_life")
        tagline: Series tagline
        description: Series description
        world_name: World name (e.g., "K-World", "Real Life")
        character_name: Optional featured character name
        character_backstory: Optional character backstory for context
        episode_frame: Optional episode 0 frame for scene context

    Returns:
        Tuple of (positive_prompt, negative_prompt)
    """
    # Get world-specific rendering
    world_style = WORLD_RENDERING_STYLES.get(world_name, DEFAULT_RENDERING)
    rendering = world_style["rendering"]
    quality = world_style["quality"]

    # Get genre-specific style
    style = GENRE_VISUAL_STYLES.get(genre, "cinematic atmosphere, professional lighting, emotional depth")

    # Build scene hints from available sources (priority order)
    scene_hints = ""
    if episode_frame:
        # Best source: episode 0's visual description
        scene_hints = episode_frame[:150]
    elif tagline:
        scene_hints = tagline[:100]
    elif description:
        scene_hints = description[:150]
    else:
        scene_hints = "evocative atmospheric scene"

    # Build character hint if available
    character_hint = ""
    if character_name:
        character_hint = f"featuring {character_name}"
        if character_backstory:
            # Extract first sentence of backstory for character essence
            first_line = character_backstory.split('.')[0] if '.' in character_backstory else character_backstory[:100]
            if len(first_line) < 100:
                character_hint = f"featuring {character_name}, {first_line}"

    # Build the prompt
    prompt_parts = [
        f"cinematic cover art for '{title}'",
        character_hint if character_hint else None,
        scene_hints,
        style,
        rendering,
        "wide shot composition, key art poster style",
        "atmospheric depth, professional color grading",
        quality,
    ]

    prompt = ", ".join(p for p in prompt_parts if p)

    return prompt, SERIES_COVER_NEGATIVE


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
