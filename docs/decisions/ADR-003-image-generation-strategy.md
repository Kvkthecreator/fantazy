# ADR-003: Image Generation Strategy - Cinematic Inserts for Auto-Gen

> **Status**: Accepted
> **Date**: 2024-12-24
> **Supersedes**: Original Kontext Pro auto-gen approach

---

## Context

After reviewing gallery results from Kontext Pro-based auto-generation, we identified a gap between character consistency and narrative impact:

**User feedback**: "because the focus is on avatar reference consistency... it's much less adding to the narrative than expected. i think we should no longer assume that kontext pro and with avatar as reference image a necessary 'superior' user experience."

Gallery images showed:
- Strong character likeness (same face, hair, clothing)
- Weak narrative storytelling ("just character standing in café")
- High cost ($0.15 per Kontext generation)
- Missed opportunity for environmental storytelling

## Decision

**Two-track image generation strategy:**

### Track 1: Director Auto-Gen → T2I Cinematic Inserts

All Director-triggered auto-generation uses **T2I only** with **cinematic insert shot** prompting:

- **Philosophy**: Anime insert shot technique (Makoto Shinkai environmental shots, Cowboy Bebop insert frames)
- **Focus**: Environmental storytelling, not character consistency
- **Content**: Partial framing, symbolic objects, lighting/mood, atmospheric composition
- **Examples**:
  - Rain streaking down window while silhouette sits alone
  - Two coffee cups on table, one steaming, one untouched
  - Hands exchanging a note, faces out of frame
  - Sunset light filtering through curtains onto empty couch

**Technical approach:**
- Dedicated `_generate_cinematic_insert()` method
- LLM-generated prompts emphasizing mood/lighting/composition
- Negative prompts block portrait focus: `"detailed face, close-up portrait, photorealistic, 3D render, selfie angle, centered character"`
- Image dimensions: 1024x768 (4:3 for insert shots)
- Cost: $0.05 per generation

### Track 2: Manual "Capture Moment" → Dual Mode

User-triggered manual generation retains **both T2I and Kontext Pro** options:

**Kontext Pro mode** (3 Sparks):
- Improved prompting focusing on facial expressions and within-scene composition
- Spatial relationship to environment
- Specific gestures and emotional beats
- Camera angles serving narrative
- Character reference from avatar kit

**T2I mode** (1 Spark):
- Improved prompting for narrative composition
- Character appearance + expression + gesture + environment + lighting + angle
- Full cinematic framing without reference image

**Why keep both modes for manual?**
- Monetization flexibility (premium users get 100 Spark top-off monthly)
- User choice (some may prefer character consistency for specific moments)
- Improved prompting addresses narrative flatness in both modes

## Rationale

### Why Cinematic Inserts for Auto-Gen?

1. **Narrative Impact Over Likeness**
   - Insert shots capture emotional beats through environment
   - Tension conveyed through composition, not character face
   - Examples from anime: objects, lighting, partial figures tell story

2. **Cost Efficiency**
   - T2I: $0.05 vs Kontext: $0.15 (67% reduction)
   - Auto-gen 3-4 times per episode → ~$0.60 savings per episode
   - Platform margin razor-thin (~$0.10 on $19/mo premium)

3. **Technical Simplification**
   - No avatar kit lookup required
   - No anchor image loading/storage transfer
   - Faster generation pipeline
   - Cleaner separation: auto-gen = environmental, manual = character

4. **Artistic Coherence**
   - Director role: pacing and grounding, not character portraiture
   - Insert shots ground scenes without dictating character appearance
   - User imagination fills in character details

### Why Keep Dual Mode for Manual?

1. **User Agency**
   - Manual generation = user's choice to "capture this specific moment"
   - Some moments warrant character focus (first kiss, vulnerability reveal)
   - Others warrant environmental focus (tension buildup, atmosphere)

2. **Monetization Balance**
   - Kontext Pro (3 Sparks) justifies higher generation cost
   - T2I (1 Spark) accessible for frequent capture
   - Premium users: 100 Spark monthly top-off supports mixed usage

3. **Improved Quality Addresses Core Issue**
   - Phase 1C prompt improvements apply to BOTH modes
   - Kontext now generates: expression + gesture + environment + lighting + angle
   - Not "standing in café" anymore - "leaning against counter, eyes downcast, fingers tracing table edge, warm overhead lighting, low angle shot"

## Implementation Phases

### Phase 1A: Fix Auto-Gen Trigger ✅
- Removed broken `deduct_sparks` check
- Added subscription gating (premium only)
- Added budget enforcement (`generations_used < generation_budget`)
- Added observability logging

### Phase 1B: Cinematic Insert Prompts ✅
- Created `_generate_cinematic_insert()` method
- Routed "character" visual_type to cinematic inserts
- Simplified `_generate_auto_scene()` (removed avatar kit lookup)
- T2I only, 1024x768, environmental storytelling prompts

### Phase 1C: Improve Manual Prompts ✅
- Rewrote `KONTEXT_PROMPT_TEMPLATE` (50-70 words, 4 focus areas)
- Rewrote `T2I_PROMPT_TEMPLATE` (60-90 words, 6 focus areas)
- Enhanced system prompts emphasizing composition/expression/gesture
- Added detailed good/bad examples

### Phase 1D: Documentation (This ADR)
- Architectural decision record
- Update MONETIZATION_v2.0.md
- Document composition types

## Consequences

### Positive

- **Auto-gen narrative impact**: Environmental shots capture emotional beats
- **Cost reduction**: 67% savings on auto-gen ($0.05 vs $0.15)
- **Simplified pipeline**: No avatar kit dependency for auto-gen
- **Clear separation of concerns**: Auto = environmental, Manual = character choice
- **Improved manual quality**: Better prompting in both modes

### Negative

- **Character consistency loss in auto-gen**: Users won't see character face in auto-gen images
  - Mitigation: Manual generation still supports Kontext Pro for character moments
- **Potential user confusion**: "Why doesn't auto-gen show my character?"
  - Mitigation: UI should clarify auto-gen = "cinematic moments" vs manual = "capture character"

### Neutral

- **Different aesthetic**: Anime insert shot style may not suit all genres
  - Observation: Currently only romantic_tension genre in production
  - Future: Genre-specific insert shot styles could be added

## Alternatives Considered

### A: Ditch Kontext entirely, T2I only everywhere
**Pros**: Simplest, lowest cost, no avatar kit dependency
**Cons**: Loses character consistency option entirely, users want this for key moments
**Decision**: Rejected - keep Kontext for manual where user explicitly wants character focus

### B: Hybrid approach per visual_type
**Description**: "character" type uses Kontext, "atmosphere"/"object" use T2I
**Pros**: Best of both worlds per moment type
**Cons**: High cost, avatar kit still required, doesn't address narrative flatness
**Decision**: Rejected - narrative flatness is prompting issue, not tool issue

### C: Multi-shot composition (character + environment separate)
**Description**: Generate character portrait + environmental background, composite
**Pros**: Full control over both character and environment
**Cons**: Complex pipeline, higher cost, compositing artifacts, slower generation
**Decision**: Rejected - over-engineering, doesn't solve core narrative issue

## Metrics

**Auto-gen cost reduction**:
- Before: 4 gens × $0.15 = $0.60 per episode
- After: 4 gens × $0.05 = $0.20 per episode
- Savings: $0.40 per episode

**Platform margin impact** (premium users):
- Revenue: $19/mo (~63 episodes/mo = $0.30/episode)
- Costs: Character LLM + Director LLM + auto-gen images
- Before auto-gen cost: $0.60
- After auto-gen cost: $0.20
- Margin improvement: +$0.40 per episode

**Manual generation unaffected**:
- T2I: 1 Spark (~$0.10)
- Kontext: 3 Sparks (~$0.30)
- User choice based on moment importance

## References

- User feedback: Gallery screenshot showing character-consistent but narratively flat results
- Monetization discussion: MONETIZATION_v2.0.md (Ticket + Moments model)
- Artistic references:
  - Makoto Shinkai films (environmental storytelling through insert shots)
  - Cowboy Bebop (cinematic insert frames between scenes)
  - Anime production technique: insert shots (物の絵, "mono no e")

## Open Questions

1. **Genre-specific insert styles?**
   - Current: Universal anime cinematic style
   - Future: psychological_thriller might want darker, more oppressive compositions
   - Decision deferred until more genres in production

2. **User feedback on auto-gen images?**
   - Need to test with real premium users
   - Measure: do they manually generate character shots to "fill the gap"?
   - If manual gen spikes after auto-gen, might indicate need for character presence

3. **Director composition hints?**
   - Currently: Director provides `visual_hint` text
   - Future: Could Director suggest specific composition types? (low angle, close-up hands, etc.)
   - Phase 1D exploration deferred (marked as "pending" in todos)

---

**Version**: 1.0.0
**Authors**: Kevin Kim (user), Claude Sonnet 4.5 (implementation)
**Implementation commits**: 061ba034, c8019196, 34ed14b2
