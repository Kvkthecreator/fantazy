# Image Generation Quality Specification

> **Version**: 1.3.0
> **Status**: Active
> **Updated**: 2024-12-24

---

## Purpose

This document defines quality standards, prompting strategies, and best practices for image generation across the platform. It covers both Director-triggered auto-generation and user-triggered manual generation.

---

## Strategic Philosophy

### Core Principle: Manual-First Generation (v1.3)

**UPDATED (2024-12-24)**: After quality assessment, switched to **manual-first philosophy**:

**Primary Path: Manual "Capture Moment"** → Proven quality, user control
- T2I mode (1 Spark): Reliable character portraits in narrative composition
- Kontext Pro (3 Sparks): High-fidelity character likeness with facial expressions

**Secondary Path: Experimental Auto-Gen** → Opt-in via Settings
- Default: All episodes use `visual_mode='none'` (text-only, fast, no interruptions)
- Users can enable auto-gen in Settings > Preferences (experimental feature)
- Improved prompts (dropped Shinkai environmental-only) for better quality

**Rationale**:
- Auto-gen quality not yet consistent (abstract/confusing images in testing)
- Generation time (5-10 seconds) interrupts narrative flow
- Manual generation provides reliable results when users want images
- Opt-in approach allows testing improvements without degrading default experience

---

## Track 1: Director Auto-Generation (Experimental, Opt-In)

### Philosophy: Narrative Moment Captures

**UPDATED (2024-12-24)**: Dropped Shinkai environmental-only philosophy in favor of **narrative moment composition** matching manual T2I quality.

Director auto-gen now captures emotional beats through:
- **Composition + atmosphere + action** (not just environment)
- Character presence varies by moment (partial, silhouette, or environmental)
- Emphasizes MOMENT over character detail
- Focuses on what's happening RIGHT NOW (gesture, posture, environmental interaction)

**Status**: Experimental feature, opt-in via Settings > Preferences
**Default**: All episodes use `visual_mode='none'` (manual-first strategy)

### Trigger Strategy (v1.2 - Hybrid Model)

**CHANGE FROM v1.1**: Director now uses **turn-based triggers** instead of LLM evaluation.

**Why**: Production testing showed LLM-driven decisions (`"Would this benefit from a visual?"`) were unreliable - Gemini Flash evaluated every turn as `visual_type: "none"` despite clear visual moments.

**New Strategy**: **Deterministic WHEN + Semantic WHAT**

#### When to Generate (Turn-Based)

Visual generation triggers at **fixed narrative positions**:

| Visual Mode | Trigger Logic | Example (12-turn episode, budget 3) |
|-------------|---------------|-------------------------------------|
| **Cinematic** | 25%, 50%, 75% of episode | Turns 3, 6, 9 |
| **Minimal** | 90%+ of episode (climax only) | Turn 11 |
| **None** | Never | — |

```python
# Deterministic trigger (no LLM)
position = turn_count / turn_budget
if generation_budget == 3:
    triggers = [0.25, 0.5, 0.75]  # 25%, 50%, 75% through episode
    if position >= triggers[generations_used]:
        return True  # Generate now
```

**Benefits**:
- ✅ Predictable (users know when images will appear)
- ✅ Testable (no LLM variability)
- ✅ Reliable (can't fail to trigger due to conservative LLM)

#### What to Show (LLM Description)

LLM generates **description only**, no decision-making:

```
# Prompt (simplified from v1.1)
Describe this {genre} story moment in one evocative sentence for a cinematic insert shot.
Focus on: mood, lighting, composition, symbolic objects.
Style: anime environmental storytelling (Makoto Shinkai, Cowboy Bebop).

Recent exchange:
{messages}

One sentence only:
```

**No SIGNAL format, no regex parsing** - plain text description used directly as `visual_hint`.

### Visual Types (Simplified)

**v1.2 Change**: Auto-gen defaults to `visual_type: "character"` (cinematic inserts). Visual type classification is optional and only used for analytics.

| Visual Type | When Used | Example |
|-------------|-----------|---------|
| `character` | Default for all auto-gen | Cinematic insert with partial/environmental character presence |
| `object` | (Optional) Keyword detected in description | "coffee cup", "letter", "phone" → object-focused |
| `atmosphere` | (Optional) Keyword detected in description | "window", "rain", "light" → pure environment |
| `instruction` | Manual only | Text-based direction cards |

### Cinematic Insert Characteristics

**DO:**
- ✅ Capture emotional beats through composition
- ✅ Use partial framing (hands, silhouettes, backs of heads)
- ✅ Emphasize lighting and atmospheric mood
- ✅ Show environmental interaction (objects, spaces, weather)
- ✅ Apply cinematic angles and selective focus
- ✅ Convey narrative tension through visual metaphor

**DON'T:**
- ❌ Focus on character face/likeness
- ❌ Center character as portrait subject
- ❌ Prioritize character consistency over narrative impact
- ❌ Generate full-body character references
- ❌ Use selfie angles or frontal compositions

### Technical Specifications

**Generation Method:** Text-to-Image (T2I) only
**Dimensions:** 1024x768 (4:3 aspect ratio for insert shots)
**Cost:** ~$0.05 per generation
**Style:** Anime aesthetic, cinematic composition

**Negative Prompt Template:**
```
detailed face, close-up portrait, photorealistic, 3D render,
selfie angle, centered character, full body character reference
```

### Prompting Strategy

**Two-stage LLM prompting:**

1. **Generate scene description** (LLM):
   - Input: `scene_setting` + `visual_hint` from Director
   - Output: Detailed cinematic insert prompt

2. **Generate image** (FLUX):
   - Input: LLM-generated prompt + anime style suffix
   - Output: 1024x768 image

**System Prompt for LLM (Cinematic Inserts):**
```
You are an expert at writing anime-style cinematic insert shot prompts.

These are NOT character portraits. They are environmental storytelling moments.

CRITICAL RULES:
- NO character faces or detailed appearance descriptions
- YES to: silhouettes, partial figures, hands, environmental details
- Focus on: mood, lighting, composition, symbolic objects
- Style: anime aesthetic, cinematic framing, emotional atmosphere

Think: Makoto Shinkai environmental shots, Cowboy Bebop insert frames.
```

**User Prompt Template:**
```
Create a cinematic insert shot prompt for this moment:

Setting: {scene_setting}
Emotional beat: {visual_hint}

The image should capture the FEELING of this moment through environmental storytelling.
Use anime insert shot techniques: focus on details, lighting, composition, symbolic objects.

Visual techniques:
- Partial framing (hands, silhouettes, backs of heads OK - no face focus)
- Environmental storytelling (objects, lighting, weather convey emotion)
- Cinematic composition (dramatic angles, selective focus)
- Atmospheric mood (color temperature, depth of field, lighting)

Write a detailed image generation prompt (2-3 sentences).
```

### Example Prompts

**Good Examples:**

```
"Rain streaking down café window, warm amber light from inside
casting shadows on glass, single silhouette sitting alone at corner
table, steam rising from coffee cup, melancholic blue-hour atmosphere,
anime style, cinematic depth of field"
```

```
"Two coffee cups on wooden table, one steaming and untouched, the
other half-empty with lipstick stain, late afternoon sunlight
creating long shadows, slight overhead angle, anime style, soft focus
background with café interior blur"
```

```
"Close-up of hands exchanging a handwritten note, fingers almost
touching but not quite, rain-blurred city street visible through
window behind, cool evening backlight, anime style, cinematic
close-up with selective focus"
```

**Bad Examples (Too Character-Focused):**

```
❌ "Young woman with brown hair standing in café smiling at camera"
→ Portrait angle, character appearance description, no narrative
```

```
❌ "Beautiful girl wearing red dress, full body, centered composition"
→ Character reference style, not environmental storytelling
```

### Quality Checklist

- [ ] Captures narrative beat through environment/objects?
- [ ] Uses partial framing or no character faces?
- [ ] Specifies lighting that enhances mood?
- [ ] Includes camera angle serving the emotion?
- [ ] Avoids character appearance descriptions?
- [ ] Generates narrative tension through composition?

---

## Track 2: Manual "Capture Moment"

### Philosophy: User Agency + Narrative Composition

Manual generation gives users **choice** between two modes based on moment importance and desired outcome.

### Mode Selection

| Mode | Cost | Use Case | Character Likeness | Narrative Composition |
|------|------|----------|-------------------|----------------------|
| **T2I** | 1 Spark | Frequent captures, environmental emphasis | Low | High |
| **Kontext Pro** | 3 Sparks | Key moments, character-focused scenes | High | High (Phase 1C) |

### Kontext Pro Mode

**When to use:**
- Key character moments (first kiss, vulnerability reveal)
- Scenes where facial expression is critical
- User wants character consistency with avatar reference

**Technical Specifications:**

**Generation Method:** FLUX Kontext (reference-based)
**Dimensions:** 1024x1024 (1:1 aspect ratio)
**Cost:** ~$0.15 per generation (3 Sparks)
**Requires:** Avatar kit with anchor image

**Prompting Strategy (Phase 1C Improved):**

Focus on **5 key elements** (not character appearance):
1. **Facial expression** - Specific emotion in eyes/mouth
2. **Body language** - Gesture, posture conveying emotional beat
3. **Environmental interaction** - Spatial relationship to setting
4. **Lighting & atmosphere** - Mood enhancement
5. **Camera angle** - Framing that serves narrative

**User Prompt Template:**
```
Create a scene transformation prompt for FLUX Kontext.
A reference image provides character appearance.

CRITICAL: DO NOT describe appearance (hair, eyes, face features, clothing).
DO describe: facial expression, body language, specific action,
environmental context, emotional tone.

SETTING & MOMENT:
- Location: {scene}
- What's happening: {moment}

Focus on:
1. FACIAL EXPRESSION - Specific emotion visible in eyes/mouth
   (vulnerable, teasing, conflicted)
2. WITHIN-SCENE COMPOSITION - Spatial relationship to environment
   (leaning against, reaching for, turning away from)
3. BODY LANGUAGE - Gesture or posture that conveys the emotional beat
4. ENVIRONMENTAL INTERACTION - How character engages with the space/objects

Write a detailed prompt (50-70 words).

FORMAT: "[specific expression], [precise action/gesture],
[environmental interaction], [lighting/atmosphere], [camera angle],
anime style, cinematic"
```

**System Prompt:**
```
You are an expert at writing scene transformation prompts for FLUX Kontext.

Phase 1C Goal: Better facial expressions and within-scene composition,
not just generic poses.

CRITICAL: A reference image provides character appearance.
Your prompt must describe ONLY:
- FACIAL EXPRESSION (specific emotion in eyes/mouth)
- BODY LANGUAGE (gesture, posture)
- ENVIRONMENTAL INTERACTION (spatial relationship to setting/objects)
- LIGHTING & CAMERA ANGLE (how the moment is framed)

NEVER mention: hair color, eye color, face shape, clothing, physical appearance

ALWAYS include:
1. Specific facial expression (not just "smiling" - be precise)
2. Detailed gesture or action
3. How they interact with the environment
4. Lighting that enhances the mood
5. Camera angle that serves the emotional beat
```

**Good Example:**
```
"eyes downcast with slight smile, fingers tracing café table edge,
leaning back against counter with one foot crossed over ankle, warm
dim lighting from overhead pendant lamp, slightly low angle shot,
anime style, cinematic"
```

**Bad Example:**
```
❌ "standing in café"
→ Too vague, no expression/gesture detail
```

### T2I Mode (Manual)

**When to use:**
- Frequent moment captures
- Environmental emphasis over character likeness
- Cost-conscious generation (1 Spark vs 3)

**Technical Specifications:**

**Generation Method:** Text-to-Image
**Dimensions:** 1024x1024 (1:1 aspect ratio)
**Cost:** ~$0.05 per generation (1 Spark)
**Requires:** Character appearance prompt (from avatar kit or manual entry)

**Prompting Strategy (Phase 1C Improved):**

Include **6 key elements**:
1. **Character appearance** - Full description from appearance_prompt
2. **Facial expression** - Specific emotion conveyed
3. **Body language** - Gesture, posture, action
4. **Environmental composition** - Spatial relationship
5. **Lighting & atmosphere** - Mood enhancement
6. **Camera framing** - Shot type serving narrative

**User Prompt Template:**
```
Create an image prompt for this narrative moment.
Include full character description AND compositional details.

CHARACTER:
- Name: {character_name}
- Appearance: {appearance_prompt}

SETTING & MOMENT:
- Location: {scene}
- What's happening: {moment}

Write a detailed prompt (60-90 words) that captures the emotional
beat through composition.

Focus on:
1. CHARACTER APPEARANCE - Full description from appearance_prompt
2. FACIAL EXPRESSION - Specific emotion conveyed through eyes/mouth
3. BODY LANGUAGE - Gesture, posture, action that tells the story
4. ENVIRONMENTAL COMPOSITION - Spatial relationship to setting
5. LIGHTING & ATMOSPHERE - Mood-enhancing details
6. CAMERA FRAMING - Shot type that serves the narrative

FORMAT: "solo, 1girl, [full appearance], [specific expression],
[detailed action/gesture], [environmental interaction],
[lighting/atmosphere], [camera angle], anime style, cinematic"
```

**System Prompt:**
```
You are an expert at writing image generation prompts for anime-style
narrative illustrations.

Phase 1C Goal: Character portraits that tell a story through composition,
not just likeness.

CRITICAL RULES:
1. ALWAYS start with "solo, 1girl" (or "solo, 1boy" for male characters)
2. Include FULL character appearance from appearance_prompt
3. Add SPECIFIC facial expression (not just "smiling")
4. Describe DETAILED gesture/action (not just "standing")
5. Show ENVIRONMENTAL INTERACTION (how they engage with the space)
6. Specify LIGHTING that enhances mood
7. Include CAMERA ANGLE that serves the narrative beat
8. NEVER include multiple people - only the character

Think cinematically: This is a single frame that must convey an
emotional story.
```

**Good Example:**
```
"solo, 1girl, young woman with messy black hair and tired eyes,
vulnerable expression with slight smile, wiping down espresso machine
while glancing sideways toward door, leaning against café counter with
one hand on hip, warm dim overhead lighting casting soft shadows, rain
visible through window behind, medium shot from slight low angle, anime
style, cinematic"
```

**Bad Example:**
```
❌ "girl in café smiling"
→ Too vague, no compositional detail
```

---

## Subscription & Budget Gating

### Visual Mode Architecture (v1.3 - Manual-First Strategy)

**UPDATED (2024-12-24)**: Switched to **manual-first philosophy** after quality assessment.

**Episode-Level Defaults** (Manual-First):
- **All paid episodes**: `visual_mode='none'` (text-only by default)
- **Manual generation**: Always available via "Capture Moment" button (1 Spark T2I / 3 Sparks Kontext)

**User-Level Override** (Experimental Auto-Gen Opt-In):
- `"episode_default"` or `null`: Respect episode setting (typically 'none', default for all users)
- `"always_off"`: Explicitly disabled (accessibility, slow connections, data-saving)
- `"always_on"`: **Opt into experimental auto-gen** (upgrades none→minimal, minimal→cinematic)

**Settings UI**:
- Toggle in Settings > Preferences > Visual Experience
- "Auto-generated images" switch (default: OFF)
- Warning banner: "Experimental Feature - 5-10s generation time, quality improving"
- Guidance: "Manual 'Capture Moment' offers higher quality with more control"

**Resolution Logic:**
```python
# Manual-first resolution (episodes default to 'none', users opt-in for auto-gen)
def resolve_visual_mode(episode, user_preferences):
    episode_mode = episode.visual_mode  # Typically 'none' (manual-first)
    user_override = user_preferences.get("visual_mode_override")

    if user_override == "always_off":
        return "none"  # Explicitly disabled
    elif user_override == "always_on":
        # User opted into experimental auto-gen
        if episode_mode == "none":
            return "minimal"  # Upgrade to minimal auto-gen
        elif episode_mode == "minimal":
            return "cinematic"  # Upgrade to full auto-gen
    else:
        return episode_mode  # Default: typically 'none' (manual-first)
```

**Benefits:**
- ✅ Fast, uninterrupted narrative by default (no 5-10s generation pauses)
- ✅ Manual generation (1 Spark) provides proven quality when users want images
- ✅ Experimental auto-gen available for users who opt-in via settings
- ✅ No degraded experience from inconsistent auto-gen quality
- ✅ Cost predictability unchanged (override doesn't change episode price)

### Auto-Generation Access

**Requirement:** Premium subscription ($19/mo)
**Rationale:** Auto-gen included in episode cost, not charged per-image

**Gating Logic:**
```python
if user.subscription_status == "premium":
    # Resolve visual_mode with user preference override
    resolved_mode = resolve_visual_mode(episode, user.preferences)

    if resolved_mode in ("cinematic", "minimal"):
        if session.generations_used < episode.generation_budget:
            # Trigger auto-generation
        else:
            # Budget exhausted (typically 3-4 per episode)
    else:
        # Visual mode resolved to "none" (episode default OR user override)
else:
    # Free users: no auto-gen
```

**Observability:**
- `Auto-gen triggered: {type} (session {id}, {used+1}/{budget})`
- `Auto-gen skipped: budget exhausted ({used}/{budget})`
- `Auto-gen skipped: user {id} not premium`

### Manual Generation Access

**Available to:** All users (free + premium)
**Cost Model:** Pay-per-generation with Sparks

| User Type | Spark Balance | Top-Off |
|-----------|---------------|---------|
| Free | Purchased Sparks only | Manual purchase |
| Premium | Purchased + 100/month | Auto-refill monthly |

**Cost:**
- T2I: 1 Spark (~$0.10)
- Kontext Pro: 3 Sparks (~$0.30)

---

## Quality Anti-Patterns

### Auto-Gen Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|--------------|--------------|-----|
| Character portrait focus | Breaks narrative immersion, costs more | Use environmental storytelling |
| Generic "standing in location" | No emotional impact | Add gesture, lighting, composition |
| Selfie/frontal angles | Not cinematic | Use low angle, over-shoulder, etc. |
| Centered composition | Boring, not narrative | Use rule of thirds, depth |
| No lighting direction | Flat, no mood | Specify lighting (backlit, overhead, etc.) |

### Manual Gen Anti-Patterns (Kontext)

| Anti-Pattern | Why It's Bad | Fix |
|--------------|--------------|-----|
| Describing appearance | Reference image provides this | Focus on expression/action |
| "Just smiling" | Not specific enough | "eyes downcast with slight smile" |
| No environmental interaction | Character floats in space | "leaning against counter" |
| Missing camera angle | Default to boring framing | Specify angle serving emotion |

### Manual Gen Anti-Patterns (T2I)

| Anti-Pattern | Why It's Bad | Fix |
|--------------|--------------|-----|
| Omitting appearance | No character consistency | Include full appearance_prompt |
| Vague expressions | Generic result | "vulnerable with parted lips" vs "happy" |
| Static poses | Not narrative | Add motion: "reaching for", "turning away" |
| No environmental context | Disconnected from scene | Ground in setting details |

---

## Cost Analysis

### Auto-Gen Economics

**Before (Kontext Pro):**
- Cost per generation: $0.15
- Typical episode: 4 auto-gens
- Total: $0.60 per episode

**After (T2I Cinematic Inserts):**
- Cost per generation: $0.05
- Typical episode: 4 auto-gens
- Total: $0.20 per episode
- **Savings: $0.40 per episode (67% reduction)**

**Platform Impact:**
- Premium revenue: $19/mo (~63 episodes/mo = $0.30/episode)
- Margin improvement: +$0.40 per episode
- Annual savings at scale: Significant for sustainability

### Manual Gen Economics

**T2I Mode:**
- User cost: 1 Spark (~$0.10)
- Platform cost: ~$0.05
- Margin: $0.05 per generation

**Kontext Pro Mode:**
- User cost: 3 Sparks (~$0.30)
- Platform cost: ~$0.15
- Margin: $0.15 per generation

**User behavior expected:**
- Frequent captures: T2I (cost-effective)
- Key moments: Kontext Pro (character consistency)
- Mixed usage: 100 Spark monthly top-off supports ~10-30 manual gens

---

## Evolution & Iteration

### Open Questions for Future Versions

1. **Genre-Specific Styles?**
   - Current: Universal anime cinematic
   - Future: psychological_thriller = darker, oppressive compositions
   - Decision: Deferred until more genres in production

2. **Director Composition Hints?**
   - Current: Director provides `visual_hint` text only
   - Future: Suggest specific composition types (low angle, close-up hands)
   - Implementation: Would require expanding Director evaluation LLM

3. **User Feedback Measurement?**
   - Metric: Do users manually generate character shots to "fill gap" after auto-gen?
   - If manual spikes after auto-gen: May indicate need for character presence
   - Tracking: Analytics on manual gen timing relative to auto-gen

4. **Multi-Shot Compositions?**
   - Technique: Generate character + environment separately, composite
   - Pros: Full control over both elements
   - Cons: Complex pipeline, higher cost, compositing artifacts
   - Status: Rejected for v1.0, may revisit

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2024-12-24 | **Hybrid Trigger Model**: Replace LLM-driven visual decisions with deterministic turn-based triggers (25%, 50%, 75% of episode). Simplify LLM to description-only (no SIGNAL parsing). Add observability (raw_response, visual_decisions history). Reference: DIRECTOR_PROTOCOL.md v2.4. |
| 1.1.0 | 2024-12-24 | Added provider configuration section. Fixed manual generation 500 error (Phase 1E). Updated cost analysis with FLUX Schnell. |
| 1.0.0 | 2024-12-24 | Initial specification. Two-track strategy, Phase 1C improved prompting, cost analysis, quality anti-patterns. |

---

## Related Documents

- [ADR-003: Image Generation Strategy](../../decisions/ADR-003-image-generation-strategy.md)
- [DIRECTOR_PROTOCOL.md](../core/DIRECTOR_PROTOCOL.md)
- [TEXT_RESPONSES.md](./TEXT_RESPONSES.md)
- [MONETIZATION_v2.0.md](../../monetization/MONETIZATION_v2.0.md)

---

## Implementation Reference

**Files:**
- `substrate-api/api/src/app/services/scene.py` - SceneService with all generation methods
- `substrate-api/api/src/app/services/conversation.py` - Auto-gen trigger logic
- `substrate-api/api/src/app/services/director.py` - Visual type evaluation
- `substrate-api/api/src/app/services/image.py` - ImageService with provider configuration
- `substrate-api/api/src/app/routes/scenes.py` - Manual generation API endpoints

**Provider Configuration:**
- Default T2I provider: **Replicate** (FLUX Schnell)
- Default T2I model: `black-forest-labs/flux-schnell`
- Kontext provider: **Replicate** (FLUX Kontext Pro)
- Kontext model: `black-forest-labs/flux-kontext-pro`
- Cost per T2I: ~$0.003 (FLUX Schnell)
- Cost per Kontext: ~$0.15 (FLUX Kontext Pro)

**Commits:**
- Phase 1A: `061ba034` - Fixed auto-gen trigger
- Phase 1B: `c8019196` - Cinematic insert implementation
- Phase 1C: `34ed14b2` - Improved manual prompting
- Phase 1D: `ff463857` - Documentation
- Phase 1E: `4182b8c2` - Fixed manual generation 500 error (provider + templates)
