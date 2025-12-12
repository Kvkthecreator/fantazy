# Fantazy Visual Rendering Modes & Cost Strategy (v0.1)

**Scope:** How we visually present characters in scenes using cheap, reusable assets (avatars + backgrounds), including layered overlays and parallax.

**Goal:** Create a low-cost but high-feel visual system that can later differentiate Free vs Premium tiers.

---

## 1. Core Idea

We don't need AI image generation at runtime to feel "visual."

Fantazy can deliver a strong anime-like experience using:
- Stock background images (environment-only)
- Avatar main images (transparent PNGs)
- Front-end composition (positioning, overlays, parallax, subtle animation)

This gives us:
- A zero-runtime-cost base mode (no Flux / Gemini calls)
- A flexible foundation where "cinematic" experiences can later be:
  - Precomputed with AI, or
  - Generated dynamically for premium users (Flux pipeline)

---

## 2. Visual Modes Overview

We define three conceptual modes. Only the first two are needed for v0.

### 2.1 Mode A – Overlay Mode (Base / Free)

**What it is:**
- Static background images (no characters baked in)
- Avatar PNGs placed on top via frontend layout
- Optional text overlays

**Feels like:**
- Visual novel / panel-style storytelling
- Clearly "drawn" scenes, but assembled from reusable parts

**Cost:**
- $0 per scene at runtime
- Only storage + one-time asset creation effort

### 2.2 Mode B – Parallax / Animated Panels (Enhanced, Still Cheap)

**What it is:**

Same ingredients as Overlay Mode:
- Background
- Avatar PNG(s)
- Optional foreground/FX layer

Plus motion and layering:
- Parallax scroll / tilt (background vs avatar vs UI)
- Slight avatar "breathing" / bobbing animation
- Gradient overlays, glows, particles, etc.

**Feels like:**
- "Live panel" or "animated card"
- Much more premium than static images—even though all assets are the same

**Cost:**
- Still $0 per scene at runtime
- Only front-end animation logic (CSS/JS)

**Potential use:**
- Premium users see episodes rendered in Parallax Mode
- Free users see simple Overlay Mode

### 2.3 Mode C – Cinematic AI Scenes (Future / Premium+ Only)

**What it is (future):**

Fully rendered scenes via AI (Flux/diffusion) with:
- Avatar integrated into the environment
- Lighting, composition, and emotion tailored per key moment

**Cost strategy (future):**

Either:
- Precompute a small cinematic library (one-time cost, static assets), or
- Generate per-user/per-scene with strict quotas & caching for paid tiers

Not required for initial implementation, but the architecture should not block it.

---

## 3. Asset Requirements (for Modes A & B)

Given we're prioritizing lowest cost and reuse, we standardize assets:

### 3.1 Backgrounds (Stage)

Pure environment, no characters.

**Examples:**
- Rooftop at sunset
- Cozy bedroom
- Classroom
- Café
- Street at night, park, festival, etc.

**Format:**
- JPG or PNG
- Unified aspect ratio (e.g. 16:9 or 9:16)
- Example: 1920×1080 or 1080×1920

**Stored as:**
- `image_assets` with `type = 'background'`, or
- `avatars/` bucket if tied to a specific character later.

### 3.2 Avatars (Characters)

Transparent PNGs (no background).

**At minimum for v0:**
- 1 full-body anchor per avatar (for scenes)
- 1 portrait (for chat header / bubbles)

**Technical requirements:**
- Transparent PNG (background removed using Photopea/GIMP/etc.)
- Reasonable base size (e.g. 1300–1600px tall)
- Consistent style (same global style_prompt for all art)

**Stored as:**
- `avatar_assets` with:
  - `asset_type = 'anchor_fullbody'` or `anchor_portrait`
  - Linked to `avatar_kits`

### 3.3 Optional Foreground / FX Layers

To juice parallax without new art:

**Simple overlays:**
- Bokeh lights
- Window reflections
- Soft fog / bloom
- UI frames (panels, borders, gradients)

These can be generic assets in `image_assets` or just CSS/gradients, no DB needed.

---

## 4. Frontend Composition Patterns

Everything below is frontend-only, no server compositing required.

### 4.1 Basic Scene Card (Overlay Mode)

One `<div>` as a scene canvas:
- Background as CSS `background-image`
- Avatar as `<img>` positioned absolutely
- Text overlay with gradient background for readability

**Example structure (conceptual):**

```tsx
<div className="relative w-full aspect-[16/9] overflow-hidden rounded-xl">
  {/* Background */}
  <div
    className="absolute inset-0 bg-cover bg-center"
    style={{ backgroundImage: `url(${backgroundUrl})` }}
  />

  {/* Avatar */}
  <img
    src={avatarUrl}
    alt="Character"
    className="absolute bottom-0 left-[10%] h-[70%] object-contain"
  />

  {/* Text Overlay */}
  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent text-white">
    <p className="text-xs opacity-80">{episodeTitle}</p>
    <p className="text-base font-semibold">{lineOfDialogue}</p>
  </div>
</div>
```

No runtime cost; everything is pre-uploaded.

### 4.2 Parallax / Animated Panels (Enhanced Mode)

Same structure as Overlay Mode, plus:

**Apply parallax transforms on:**
- Background (`translateY`, `scale`, or `rotate` subtly)
- Avatar (`translateY` / bobbing)

**On:**
- Scroll
- Pointer move / device tilt
- Entering the viewport

**Example enhancements:**
- Background: move slower (`transform: translateY(amount * 0.2)`)
- Avatar: slight breathing animation (`@keyframes` with small vertical shift)
- Text: fade-in / slide-up transitions

**Effect:**
Feels like a live, breathing illustration, using the exact same assets.

---

## 5. Data / Config Hooks (Optional but Helpful)

To support smarter layouts later, we can store simple layout preferences per background or scene template.

**Example config, stored as JSON (or columns):**

```typescript
type SceneLayoutConfig = {
  avatarPosition: {
    xPercent: number;       // 0–100 from left
    yPercent: number;       // 0–100 from top (100 = bottom)
    heightPercent: number;  // avatar height relative to canvas
    side: 'left' | 'right';
  };
  textOverlay: {
    position: 'bottom' | 'top';
  };
};
```

**This can live in:**
- `image_assets.layout_config` for backgrounds, or
- A `scene_templates` table if you add one.

For v0, hard-coding is fine; config becomes useful once you have more complexity.

---

## 6. Subscription Tier Differentiation

This visual stack directly supports Free vs Premium differentiation.

### 6.1 Free / Base Tier

**Access to:**
- Overlay Mode scenes
- Static backgrounds
- Avatar overlays in scenes

**Experience:**
- Solid visual novel feel
- No AI-generation quotas
- Entirely based on pre-uploaded assets

**Cost:**
- $0 runtime cost per user
- Good for early validation and broad user access

### 6.2 Premium Tier (v1)

Without using runtime Flux at all, Premium can unlock:

**Parallax / Animated Panels:**
Same scenes, but with:
- Motion
- Extra UI polish
- Optional FX layers

**Expanded stock asset set:**
- Additional backgrounds / "special" scenes
- More avatars or outfits available

**Positioning:**
> "Pro users get animated, cinematic-feeling panels and extra visual scenes. Same stories, more immersive presentation."

Still no per-request AI cost; only engineering / design cost.

### 6.3 Premium+ / Future Tier – AI Cinematic (Flux)

When you're ready to leverage your Flux stack:

**Add a higher tier that unlocks AI-generated cinematic scenes:**
- Either precomputed libraries, or
- Personalized scenes generated at key story beats

**Use:**
- Quotas per user / month
- Caching per `(user, episode, scene_key)`

**Positioning:**
> "Your stories become fully illustrated episodic anime, unique to your choices."

This tier is explicitly tied to paid subscriptions to control cost.

---

## 7. Implementation Phases for This Scope

### Phase 1 – Static Overlay Foundation

**Create small asset library:**
- 4–8 avatar PNGs (transparent)
- 5–10 backgrounds

**Implement Overlay Mode:**
- Scene card component (background + avatar + text)
- Integrate with:
  - `avatar_assets` / `image_assets`
  - Episode / scene data

**Result:** Free users get a fully visual, low-cost experience.

### Phase 2 – Parallax & Animation (Premium Visual UX)

**Add:**
- Parallax motion
- Breathing / bobbing avatars
- Gradient & FX overlays

**Gate via:**
- Subscription flag (`user.visual_mode = 'overlay' | 'parallax'`)

**Result:** Premium users see "live" panels without added infra cost.

### Phase 3 – Optional AI Cinematics (Later)

**Use Flux stack:**
- Offline batch to create cinematic libraries, or
- Online per-scene generation with quotas

**Store results in `scene_images` with:**
- `pipeline = 'flux'`

**Offer as:**
- Higher subscription tier
- Or paid add-on

---

## 8. Summary

Fantazy's visual experience can be highly expressive without requiring runtime AI image generation.

**By investing in:**
- Stock backgrounds
- Transparent avatar assets
- Smart frontend composition (overlay + parallax)

**We unlock:**
- A zero-cost base visual mode for free users
- A visually richer, animated mode for premium users
- A clear path to AI cinematics for future high-tier upgrades

This visual architecture aligns with both:
- Our Avatar Management Domain (`avatar_kits`, `avatar_assets`, `scene_images`), and
- Our subscription strategy, where visual richness—not just model calls—becomes a core differentiator between free and paid tiers.

---

## 9. Open Questions & Considerations

> *Added based on implementation review*

### 9.1 Asset Production Pipeline

The doc assumes "transparent PNGs" but doesn't address how to produce them at scale.

**Options:**
| Approach | Speed | Quality | Cost |
|----------|-------|---------|------|
| Manual (Photopea/GIMP) | Slow (~5-10 min/image) | High | Free |
| Automated (rembg/SAM) | Fast | Medium (may need touch-ups) | Free |
| AI-native (Flux w/ transparent bg) | Fast | Variable | API costs |

**Recommendation:** For v0, manual is fine for 3-5 characters. Invest in automation tooling if scaling beyond 10.

### 9.2 Background Library Sourcing

**Options:**
- **AI-generated (Flux/SDXL)** - Consistent style, requires curation pass
- **Stock sites** - Faster acquisition, harder to maintain style consistency
- **Commission artists** - Highest quality, highest cost, slowest

**Recommendation:** AI-generate a batch of 10-15, curate down to 5-8 that work well together.

### 9.3 Avatar-Background Compatibility

Not all avatars look good on all backgrounds (lighting direction, style mismatch, scale).

**Options:**
- Curate specific avatar-background pairs (more work, guaranteed quality)
- Let system/user combine freely (less work, variable quality)

**Recommendation:** Start with free combination, but tag backgrounds with `lighting_direction` and `mood` metadata for smarter defaults later.

### 9.4 Expression Variations

The doc mentions "1 full-body anchor per avatar" as minimum. For emotional storytelling, multiple expressions (happy, sad, surprised) add significant value.

**Schema support:** Already exists via `avatar_assets.expression` field.

**Recommendation:** v0 = 1 anchor per character. v1 = add 2-3 expressions for premium characters.

### 9.5 Scene vs Episode Relationship

How does a "scene" relate to episodes/messages?

**Options:**
- **Per-episode:** One scene card per episode (simpler, less dynamic)
- **Per-beat:** Multiple scenes per episode at key moments (richer, more complex)

**Recommendation:** Start per-episode. The `scene_images` table already supports `episode_id` linking.

---

## 10. v0 Implementation Checklist

A minimal scope to validate the visual system:

- [ ] **3 characters × 1 anchor each** (Mira, Kai, Sora already exist)
- [ ] **5 backgrounds** covering core archetypes:
  - Café (barista)
  - Apartment hallway / door (neighbor)
  - Office / coworking space (coworker)
  - Park bench (generic)
  - Night street / cityscape (generic)
- [ ] **SceneCard component** implementing Mode A (overlay)
- [ ] **Integration point** - where scenes appear (episode summary? chat header?)
- [ ] **Hard-coded layouts** - skip `SceneLayoutConfig` until patterns emerge

Mode B (parallax) can be a polish pass after Mode A works end-to-end.