# Image Strategy - Fantazy Visual System

> Defining what each image type conveys, where it appears, and how it should be generated.

**Status:** CANONICAL - Updated 2024-12-17
**Related:** CONTENT_ARCHITECTURE_CANON.md, World taxonomy docs

---

## Overview

The Fantazy visual system has **4 distinct image layers**, each serving a specific narrative purpose:

```
DISCOVERY LAYER (Browse/Marketing)
├─ Series Cover    → "What world and who awaits me?"
└─ Episode Card    → "What situation awaits?" (future)

IDENTITY LAYER (Character Recognition)
└─ Character Avatar → "Who am I talking to?"

ATMOSPHERE LAYER (Immersion)
└─ Episode Background → "Where am I right now?"

MOMENT LAYER (User-Generated)
└─ Scene Cards → "What just happened between us?"
```

---

## Critical Design Principle: Separation of Concerns

**LEARNING (2024-12-17):** Previous implementation conflated character styling with environment rendering, and narrative mood with visual instructions. This created confused outputs.

### The Problem We Solved

```
BAD: Merged prompt with everything
─────────────────────────────────
"Korean convenience store at 3am" +
"cinematic K-drama photography, soft glamour" +      ← CHARACTER styling
"cherry blossom pinks" +                              ← WRONG season/mood
"idol-grade beauty, expressive close-ups" +          ← CHARACTER framing
"mysterious, fleeting, bittersweet longing" +        ← NARRATIVE concept
"featuring rain, late night, empty spaces"           ← GENERIC motifs

Result: Confused model, inconsistent outputs
```

### The Fix: Purpose-Specific Prompts

Each image type gets ONLY the prompt elements relevant to its purpose:

| Image Type | Gets | Does NOT Get |
|------------|------|--------------|
| Episode Background | Location, time, environmental rendering | Character styling, narrative mood, generic motifs |
| Series Cover | Scene + character + cinematic composition | Portrait framing, abstract mood words |
| Character Avatar | Appearance, expression, character framing | Environmental context, scene elements |
| Scene Cards | Character anchor + scene context + action | Abstract mood, generic style |

---

## 1. Episode Background

### Purpose
Atmospheric backdrop that establishes **where the conversation takes place**.

### Where It Appears
- Chat page (full-height background behind messages)
- Applied with gradient overlay for readability (`from-black/40 via-black/20 to-black/60`)

### Visual Requirements
| Attribute | Requirement |
|-----------|-------------|
| Aspect Ratio | 9:16 (576x1024) - portrait for mobile |
| Content | Location/setting ONLY - NO characters |
| Style | Atmospheric, suitable as text backdrop |
| Focus | Soft atmospheric blur acceptable |

### Prompt Structure (CANONICAL)

```
{location_description},
{time_of_day} lighting,
{environmental_rendering},
atmospheric depth, cinematic composition,
empty scene, no people, no characters, no faces,
masterpiece, best quality
```

**location_description:** Concrete, specific scene description
- GOOD: "Korean convenience store interior, fluorescent lights, snack aisles, glass doors"
- BAD: "intimate isolation in urban environment"

**time_of_day:** Lighting context only
- GOOD: "3am fluorescent lighting", "soft morning light through curtains"
- BAD: "mysterious late night mood"

**environmental_rendering:** How environments are rendered (NOT characters)
- GOOD: "cinematic photography, atmospheric depth, soft ambient lighting"
- BAD: "idol-grade beauty, expressive close-ups, fashion-forward styling"

### Negative Prompt (CANONICAL)

```
people, person, character, figure, silhouette, face, portrait,
anime, cartoon, illustration style,
text, watermark, signature,
blurry, low quality, distorted
```

### Episode-Specific Configuration

Each episode MUST have explicit location/time configuration. Do NOT rely on inheritance.

```python
EPISODE_BACKGROUNDS = {
    "3AM": {
        "location": "Korean convenience store interior, fluorescent ceiling lights, snack aisles, refrigerated drinks section, glass entrance doors, tiled floor",
        "time": "3am, harsh fluorescent lighting, nighttime visible through windows",
        "rendering": "urban night photography, cold artificial light, quiet isolation"
    },
    "Morning After": {
        "location": "Korean apartment bedroom, rumpled white bedding, curtained window, minimal furniture",
        "time": "early morning, soft diffused daylight through sheer curtains",
        "rendering": "intimate interior photography, warm natural light, quiet stillness"
    }
}
```

**Note:** "Morning After" gets MORNING rendering, not "late night" from series motifs.

---

## 2. Series Cover

### Purpose
Marketing/discovery image that conveys **"What world and who awaits me?"**

### Where It Appears
- Discover page (featured hero card)
- Series listing cards
- Series detail page header

### Visual Requirements
| Attribute | Requirement |
|-----------|-------------|
| Aspect Ratio | 16:9 (1024x576) - landscape for cards |
| Content | Character IN environment, cinematic composition |
| Style | Evocative, story-promising, genre-appropriate |
| Character | Featured character, atmospheric pose (not portrait crop) |

### Why Character IN Scene (Not Empty Environment)

Empty atmospheric scenes are:
- Generic (could be any story)
- Less compelling for discovery
- Missing the core promise (the character relationship)

Character in scene delivers:
- WHO you'll meet (recognition)
- WHERE/WHAT MOOD (context)
- Story promise in a single image

### Generation Approach

Series covers require **two-stage generation** or **composite approach**:

**Option A: FLUX Kontext with Character Reference**
```python
# Use character's avatar anchor as reference
prompt = """
{character_name} in {scene_description},
{character_pose_and_expression},
{environmental_context},
cinematic wide shot, atmospheric lighting,
{genre_visual_cues}
"""
reference_images = [character_avatar_anchor_bytes]
```

**Option B: Full Description (No Reference)**
```python
prompt = """
{character_full_appearance},
standing/sitting in {scene_description},
{pose_and_expression},
cinematic composition, establishing shot,
{environmental_context and lighting}
"""
```

### Prompt Structure (CANONICAL)

```
{character_description OR "character from reference"},
{pose_and_framing} in {scene_description},
{time_of_day and lighting},
cinematic composition, atmospheric depth,
{genre_visual_style},
masterpiece, best quality, highly detailed
```

### Series Cover Examples

**Stolen Moments (Romantic Tension)**
```
Young Korean woman in casual clothes (hoodie, mask pulled down),
standing alone in neon-lit Seoul street at night,
rain-wet pavement reflecting city lights,
looking back over shoulder with guarded expression,
cinematic wide shot, moody urban atmosphere,
K-drama romantic tension aesthetic,
masterpiece, best quality
```

**Nexus Tower (Psychological Thriller)**
```
Sharp-suited man in modern corporate lobby,
standing at floor-to-ceiling windows overlooking city,
cold blue lighting, reflective surfaces,
composed posture but tension in stance,
cinematic establishing shot, thriller atmosphere,
corporate noir aesthetic,
masterpiece, best quality
```

---

## 3. Character Avatar

### Purpose
Visual identity that answers **"Who am I talking to?"**

### Where It Appears
- Chat header (small)
- Message bubbles (tiny thumbnail)
- Character cards in discovery
- Profile page (large)
- Scene card generation (as reference anchor)

### Visual Requirements
| Attribute | Requirement |
|-----------|-------------|
| Aspect Ratio | 1:1 (square) |
| Content | Character portrait, face clearly visible |
| Expression | Neutral-warm (versatile for any conversation) |
| Style | Fantazy house style via Avatar Kit |

### Generation Approach
- **Source:** Avatar Kit system with primary anchor
- **Prompt:** Full appearance description + style directives
- **Consistency:** Same anchor used for all scene card generations

### Prompt Structure (via Avatar Kit)

```
{appearance_prompt from avatar kit},
{style_prompt from world visual_style - CHARACTER fields only},
portrait, face clearly visible, looking at viewer,
{expression_guidance},
masterpiece, best quality
```

### World Visual Style - Character Fields

Only these fields apply to character generation:

```python
CHARACTER_STYLE_FIELDS = [
    "base_style",        # Art direction for characters
    "character_framing", # How characters are presented
    "color_palette",     # Can apply to character lighting
    "negative_prompt",   # What to avoid
]
```

Fields like `rendering` may contain environmental terms ("rain on windows") - filter these out for avatar generation.

---

## 4. Scene Cards (Director-Triggered or User-Generated Moments)

### Purpose
Capture **specific moments** during conversation as visual memories.

### Where It Appears
- Inline in chat message flow
- User's "Memories" gallery (if saved)
- Triggered by Director (auto-scene) or user request ("Visualize it")

### Director V2 Integration (2024-12-19)

The Director now semantically evaluates each exchange and classifies visual opportunities:

| Visual Type | Description | Rendering | Cost |
|-------------|-------------|-----------|------|
| `character` | Character in a moment (portrait + setting) | Image gen with Kontext/T2I | Sparks |
| `object` | Close-up of item (letter, phone, key) | Image gen, no character | Sparks |
| `atmosphere` | Setting/mood without character | Background image gen | Sparks |
| `instruction` | Game-like info (codes, hints, choices) | Styled text card | Free |
| `none` | No visual needed | Nothing | Free |

See [DIRECTOR_ARCHITECTURE.md](DIRECTOR_ARCHITECTURE.md) for full visual type taxonomy and auto-scene modes.

### Visual Requirements
| Attribute | Requirement |
|-----------|-------------|
| Aspect Ratio | 16:9 (cinematic) or 1:1 (moment) |
| Content | Character + action + setting |
| Style | Consistent with character's established look |

### Generation Approach

**Primary: FLUX Kontext with Avatar Anchor**
```python
kontext_service = ImageService.get_client("replicate", "flux-kontext-pro")
response = await kontext_service.edit(
    prompt="Same woman from reference, now {action} in {setting}",
    reference_images=[avatar_anchor_bytes],
    aspect_ratio="16:9"
)
```

**Fallback: Text-to-Image (if no anchor)**
Full character appearance in prompt.

### Prompt Structure

```
{character reference instruction OR full appearance},
{specific action/pose from conversation moment},
{current scene setting},
{lighting and atmosphere matching episode},
cinematic composition,
masterpiece, best quality
```

---

## Visual Style Schema (Revised)

### World-Level Visual Style

Worlds define the **base aesthetic** for all content. The schema separates character and environment concerns:

```python
class WorldVisualStyle:
    # CHARACTER RENDERING (for avatars, scene cards, series covers with character)
    character_base_style: str    # "cinematic K-drama photography, soft glamour"
    character_framing: str       # "idol-grade beauty, expressive close-ups"
    character_lighting: str      # "beauty lighting, soft diffused light"

    # ENVIRONMENT RENDERING (for episode backgrounds, establishing shots)
    environment_base_style: str  # "cinematic urban photography"
    environment_palette: str     # "neon nights, warm interiors, cold fluorescent"
    environment_rendering: str   # "atmospheric depth, rain reflections"

    # SHARED
    negative_prompt: str         # What to avoid across all generations
```

### Series-Level Visual Style

Series can override world defaults with **genre-specific** adjustments:

```python
class SeriesVisualStyle:
    # GENRE MARKERS (visual, not narrative)
    genre_visual_cues: str       # "noir lighting, high contrast" NOT "mysterious longing"

    # ENVIRONMENTAL MOOD (concrete, not abstract)
    environment_mood: str        # "rain-slicked surfaces, neon reflections" NOT "intimate isolation"

    # RECURRING VISUAL ELEMENTS (optional, use sparingly)
    visual_motifs: List[str]     # ["rain", "neon signs", "empty spaces"]

    # Do NOT include:
    # - Abstract narrative concepts ("bittersweet longing", "thrill of secrecy")
    # - These belong in episode_frame and character system_prompt, not image generation
```

### What NOT to Put in Visual Style

| Bad (Narrative Concept) | Good (Visual Instruction) |
|------------------------|---------------------------|
| "mysterious, fleeting" | "moody lighting, shadows" |
| "bittersweet longing" | "warm color grade, soft focus" |
| "intimate isolation" | "empty spaces, single figure" |
| "the thrill of secrecy" | "hidden corners, low light" |

**Rule:** If it describes an emotion or narrative concept, it doesn't belong in visual style. Translate to concrete visual terms.

---

## Prompt Priority Order

For all image types, structure prompts with most important elements FIRST:

```
1. SUBJECT (what/who is in the image)
2. CONTEXT (where, when, doing what)
3. COMPOSITION (framing, camera angle)
4. STYLE (rendering approach)
5. QUALITY (masterpiece, best quality)
```

Models weight early tokens more heavily. Don't bury the subject under style directives.

---

## Implementation Files

| File | Purpose |
|------|---------|
| `app/services/content_image_generation.py` | Prompt builders, style merging |
| `app/scripts/generate_series_images.py` | Batch generation script |
| `app/services/image.py` | Provider-agnostic generation service |

---

## Generation Checklist

### Before Generating Episode Backgrounds
- [ ] Each episode has explicit location description (not inherited)
- [ ] Time of day matches episode context (morning ≠ "late night")
- [ ] Prompt contains NO character styling terms
- [ ] Prompt contains NO abstract mood words
- [ ] Location description is FIRST in prompt

### Before Generating Series Covers
- [ ] Character appearance is defined (anchor or description)
- [ ] Scene context matches series setting
- [ ] Character pose/expression serves the genre
- [ ] Composition is cinematic (not portrait crop)

### Before Generating Character Avatars
- [ ] Using Avatar Kit system
- [ ] Style fields are character-appropriate (not environmental)
- [ ] Expression is versatile (neutral-warm)

---

## Appendix: K-World Visual Style (Reference)

**Style Direction:** Soft romantic anime, Korean webtoon influenced

### Character Rendering
```
base_style: "anime illustration, soft romantic style, Korean webtoon influenced"
character_framing: "expressive anime faces, soft features, emotional eyes, romantic poses"
character_lighting: "soft cel-shading, gentle lighting, atmospheric glow"
```

### Environment Rendering
```
environment_style: "detailed anime backgrounds, soft focus depth, warm ambient lighting"
environment_palette: "warm pastels, soft pinks and ambers, gentle neon accents, dreamy color grading"
environment_rendering: "soft cel-shading, gentle lighting, atmospheric glow, slight bloom effect"
```

### Negative (Shared)
```
"photorealistic, western cartoon, 3D render, harsh shadows, gritty, dark, horror"
```

---

## Appendix: Stolen Moments Episode Configs (Reference)

**Style:** Soft romantic anime with mood-driven atmosphere

```python
STOLEN_MOMENTS_BACKGROUNDS = {
    "3AM": {
        "location": "anime convenience store interior, fluorescent lights casting soft glow, colorful snack packages, glass doors showing rainy night",
        "time": "late night 3am atmosphere, warm fluorescent glow, gentle light reflections",
        "mood": "quiet lonely beauty, romantic solitude, chance encounter feeling",
    },
    "Rooftop Rain": {
        "location": "anime rooftop scene, Seoul city skyline with glowing lights below, puddles reflecting city colors",
        "time": "dusk turning to evening, soft rain falling, dreamy city lights emerging",
        "mood": "romantic melancholy, anticipation, beautiful sadness",
    },
    "Old Songs": {
        "location": "cozy anime apartment living room, warm lamp light, acoustic guitar against wall, vinyl records scattered",
        "time": "late night, warm golden lamp glow, intimate darkness outside windows",
        "mood": "intimate warmth, vulnerability, creative space",
    },
    "Seen": {
        "location": "anime back alley scene, wet pavement with neon reflections, soft bokeh lights in distance",
        "time": "night, colorful neon glow mixing with shadows, rain-slicked surfaces",
        "mood": "hidden moment, exciting tension, stolen privacy",
    },
    "Morning After": {
        "location": "soft anime bedroom, white rumpled bedding, sheer curtains with light filtering through, plants by window",
        "time": "early morning, soft golden sunlight through curtains, gentle warm glow",
        "mood": "tender intimacy, quiet vulnerability, new beginnings",
    },
    "One More Night": {
        "location": "anime luxury hotel room, large window showing sparkling city night view, elegant furnishings",
        "time": "evening, city lights twinkling through window, warm interior glow",
        "mood": "romantic anticipation, elegant desire, bittersweet longing",
    }
}
```

---

---

## Appendix: Director V2 Auto-Scene System (2024-12-19)

The Director can automatically trigger scene generation based on episode configuration:

### auto_scene_mode Options

| Mode | Behavior | Use Case |
|------|----------|----------|
| `off` | No auto-generation; user clicks button | Default, manual control |
| `peaks` | Generate when Director detects visual moment | Emotional highs, key reveals |
| `rhythmic` | Generate every N turns (+ peaks) | Comic-book feel, consistent visuals |

### Episode Template Configuration

```python
# Episode with auto-scene on emotional peaks
episode = {
    "auto_scene_mode": "peaks",        # Trigger on visual moments
    "spark_cost_per_scene": 5,         # 5 sparks per auto-generated scene
}

# Episode with rhythmic visuals (every 3 turns)
premium_episode = {
    "auto_scene_mode": "rhythmic",
    "scene_interval": 3,               # Scene every 3 turns
    "spark_cost_per_scene": 5,
}
```

### Visual Type Routing

The Director's visual type classification determines which rendering pipeline to use:

| Visual Type | Prompt Focus | Character Reference |
|-------------|--------------|---------------------|
| `character` | Character action/expression + setting | Use avatar anchor |
| `object` | Item close-up, atmospheric lighting | No character |
| `atmosphere` | Setting/mood, no people | No character |
| `instruction` | Text content (codes, hints) | N/A (no image gen) |

---

*Last Updated: 2024-12-19*
*Status: CANONICAL - Updated with Director V2 visual type taxonomy*
