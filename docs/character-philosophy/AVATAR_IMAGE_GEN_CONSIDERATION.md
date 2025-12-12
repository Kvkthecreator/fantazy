# Avatar & Image Generation Decisions (v0.2)

> **Updated**: December 2024
> **Status**: Planning document aligned with codebase
> **Related**: [PHASE_2_2_VISUAL_SCENES.md](../implementation/PHASE_2_2_VISUAL_SCENES.md)

---

## Current Codebase State

Before diving into the vision, here's what actually exists:

### Database Schema (Implemented)
- **`characters`** table: Has `avatar_url` (single URL), no prompt contract fields yet
- **`image_assets`** table: Stores generated images with `type`, `storage_path`, `prompt`, `model_used`, `style_tags`
- **`episode_images`** table: Links images to episodes with `sequence_index`, `caption`, `trigger_type`, `is_memory`
- **`character_expressions`** table: Links pre-made expressions to characters with `expression` type and `emotion_tags`

### Image Service (Implemented)
- **`ImageService`** in `substrate-api/api/src/app/services/image.py`
- Supports **Gemini** (default) and **Replicate** providers
- Has `generate()` method for text-to-image
- **Missing**: `edit()` method for image editing (critical for consistency)

### What's Missing vs. This Doc's Vision
| Doc Vision | Codebase Status |
|------------|-----------------|
| `character_prompt`, `style_prompt`, `negative_prompt` on characters | Not implemented |
| `primary_anchor_asset_id`, `secondary_anchor_asset_id` | Not implemented |
| Image editing via Gemini | Not implemented (only T2I) |
| Camera modes & scene rendering | Not implemented |
| Core Avatar Kit generation | Not implemented |

---

## 1. Tech Stack Direction

### 1.1 Now: Gemini-first, Single Pipeline

**Decision:**
For the initial Fantazy MVP, we will:
- Use **Gemini** (text + image) as the only image stack
- Rely heavily on **image editing** (edit/inpaint/iterative modification) rather than text-only generation for existing avatars
- Optimize **prompt contracts + reference images** to get acceptable consistency without extra infra cost

**Implications:**
- No custom GPU infra or diffusion models for now
- No LoRA/DreamBooth in v0.1 implementation
- Architecture must assume we may add a second pipeline later, but we don't implement it yet

**Codebase Reality:**
```python
# substrate-api/api/src/app/services/image.py
class ImageService:
    DEFAULT_PROVIDER = "gemini"
    DEFAULT_MODEL = "gemini-2.0-flash-exp-image-generation"

    # Currently only supports generate(), not edit()
    async def generate(self, prompt, negative_prompt=None, width=1024, height=1024, num_images=1):
        ...
```

### 1.2 Later: Optional 2nd Pipeline (Future)

We keep the door open for a dedicated diffusion stack later:
- Run an **SDXL / Flux-based** image server on a rented GPU (via Replicate, already scaffolded)
- Add **reference-image conditioning** (IP-Adapter / Character Reference style)
- Optional LoRA support for house style and main-cast characters

This would be plugged in as a second pipeline behind the same internal API (`pipeline: "gemini" | "diffusion"`).

---

## 2. Avatar Design & Consistency Rules

### 2.1 Core Avatar Kit

Each avatar is **not just one image**. It is a **Core Avatar Kit**:

**Portrait / Face tier:**
- 1 × Neutral Face Card (shoulders-up, canonical face)
- 3–6 × Expression Variants (happy, shy, angry, sad, flirty, thinking…)

**Body tier:**
- 1 × Full-body neutral pose
- 1–2 × Full-body gesture poses (excited, arms-crossed, etc.)

**(Optional) World / Detail tier:**
- 1–2 × Backgrounds (room, rooftop, etc.)
- 1–3 × Prop / detail shots (necklace, diary, phone, etc.)

These are created once per avatar and become the **identity anchors**.

**Codebase Support:**
```sql
-- supabase/migrations/008_image_storage.sql
CREATE TABLE character_expressions (
    character_id UUID REFERENCES characters(id),
    image_id UUID REFERENCES image_assets(id),
    expression TEXT NOT NULL,  -- 'happy', 'thinking', 'flustered', 'default'
    emotion_tags TEXT[] DEFAULT '{}',  -- maps emotions to expressions
    is_default BOOLEAN DEFAULT FALSE
);
```

### 2.2 Prompt Contract per Avatar

Each avatar stores a **canonical prompt contract** for all generations:

| Field | Purpose | Example |
|-------|---------|---------|
| `character_prompt` | Physical description, age vibe, outfit, distinctive marks | "A young woman with shoulder-length black hair, warm brown eyes, wearing a cozy cream sweater..." |
| `style_prompt` | Art style (anime vs semi-real, color palette, shading) | "Soft anime style, warm color palette, gentle cel shading, Studio Ghibli-inspired backgrounds..." |
| `negative_prompt` | Explicitly forbid drift | "Do not change hairstyle, eye color, or art style. No extra characters. No photorealism." |

**Rule:** These strings are always prepended to any Gemini image request for that avatar.

**Migration Required:**
```sql
-- Future migration: Add prompt contract to characters
ALTER TABLE characters ADD COLUMN character_prompt TEXT;
ALTER TABLE characters ADD COLUMN style_prompt TEXT;
ALTER TABLE characters ADD COLUMN negative_prompt TEXT;
ALTER TABLE characters ADD COLUMN primary_anchor_id UUID REFERENCES image_assets(id);
ALTER TABLE characters ADD COLUMN secondary_anchor_id UUID REFERENCES image_assets(id);
```

### 2.3 Generation Rules (Gemini-only Phase)

**For a brand new avatar:**
1. Use text-to-image (T2I) with `character_prompt + style_prompt + negative_prompt`
2. Generate a small batch
3. Manually select: 1 neutral portrait, N expressions, 1 full-body
4. Those become the **Core Avatar Kit**

**For an existing avatar (most cases):**

❌ **Forbidden:**
Pure text-only generation like "Generate a cute girl with black hair…" without an input image.

✅ **Required:**
Use image editing with an avatar's Core Kit image as input:
```
"Edit this image. Keep the same girl, same hairstyle, same outfit, same art style.
Only change her facial expression to embarrassed, add a light blush, and slightly
tilt her head. Do not change background or body."
```

This is the main lever for consistency in the Gemini-only phase.

### 2.4 Reference Image Strategy

To minimize drift:
- Each avatar has 1–2 designated **identity anchors**: neutral portrait + full-body neutral
- Always use anchors as the image-input/reference for new variations
- **Do not chain references** (don't use a random scene image as the new reference) to avoid slow visual drift
- All scene art with the character should be derived from anchors via editing

---

## 3. Scene & Episode Consistency

### 3.1 Scene Representation

Scenes store **references + layout info**, not raw image blobs:

```json
{
  "scene_id": "ep3-scene5",
  "primary_avatar_id": "char_A",
  "camera_mode": "portrait_close",
  "expression": "happy",
  "pose": "neutral",
  "foreground_asset_id": "asset_portrait_happy",
  "background_asset_id": "asset_bg_room_evening",
  "text": "I'm really glad you came today..."
}
```

**Codebase Support:**
```sql
-- supabase/migrations/008_image_storage.sql
CREATE TABLE episode_images (
    episode_id UUID REFERENCES episodes(id),
    image_id UUID REFERENCES image_assets(id),
    sequence_index INTEGER NOT NULL DEFAULT 0,
    caption TEXT,
    triggered_by_message_id UUID REFERENCES messages(id),
    trigger_type TEXT CHECK (trigger_type IN ('milestone', 'user_request', 'stage_change', 'episode_start')),
    is_memory BOOLEAN DEFAULT FALSE
);
```

### 3.2 Camera Modes

Define a small set of camera modes for consistent composition:

| Mode | Uses | Asset Type |
|------|------|------------|
| `portrait_close` | Face cards | Portrait expressions |
| `mid_shot` | Zoom/crop from full-body | Half-body |
| `full_body` | Full-body poses | Full-body assets |
| `bg_only` | Background plates | No character |

Episode logic chooses `(camera_mode, expression, pose)` based on narrative. The rendering pipeline then:
1. Selects the correct avatar asset(s)
2. Uses Gemini editing if a new variant is needed, anchored to existing assets

### 3.3 Expression & Pose Logic

When the story says "she blushes and looks away":
1. Logic picks `camera_mode = portrait_close`, `expression = shy`
2. System tries to find existing portrait asset tagged `(avatar, expression, camera_mode)`
3. If asset exists → use it
4. If not → Trigger Gemini edit on closest base portrait → Save new asset for future reuse

---

## 4. Architectural Considerations

### 4.1 Core Data Model

**What exists now:**

```
characters
├── id, name, slug, archetype
├── avatar_url (single static URL)  ← Current simple approach
├── baseline_personality, tone_style, speech_patterns
├── system_prompt, starter_prompts
└── life_arc (JSONB)  ← Added in migration 009

image_assets
├── id, type ('avatar' | 'expression' | 'scene')
├── user_id, character_id
├── storage_bucket, storage_path
├── prompt, model_used, generation_params
├── style_tags[], mime_type, dimensions
└── is_active

episode_images
├── episode_id, image_id
├── sequence_index, caption
├── triggered_by_message_id, trigger_type
└── is_memory, saved_at

character_expressions
├── character_id, image_id
├── expression, emotion_tags[]
└── is_default
```

**What's needed for full avatar kit:**

```sql
-- Add to characters table
character_prompt TEXT,          -- Physical description
style_prompt TEXT,              -- Art style definition
negative_prompt TEXT,           -- Drift prevention
primary_anchor_id UUID,         -- Portrait anchor
secondary_anchor_id UUID        -- Full-body anchor
```

### 4.2 Image Service API Shape (Internal)

**Currently implemented:**
```python
# Generate new image from text
await ImageService.get_instance().generate(
    prompt="A cozy evening scene with warm lighting",
    negative_prompt="photorealistic, harsh shadows",
    width=1024, height=1024
)
```

**Needed for avatar consistency:**
```python
# POST /avatars/:id/generate-core-kit
# Uses Gemini T2I to produce the Core Avatar Kit from prompt contract

# POST /avatars/:id/edit
# Body: { source_asset_id, edit_type, instructions }
# Returns: new image_assets row

# POST /episodes/:episode_id/scenes/:scene_id/render-asset
# Body: { camera_mode, expression, pose }
# Logic: Find existing matching asset OR use anchor + Gemini edit
```

### 4.3 Future LoRA / DreamBooth Hooks (Not Now)

Reserve fields for future without implementing:

```sql
-- On characters (future)
style_lora_id UUID,
character_lora_id UUID

-- On image_assets (future)
lora_ids UUID[],
reference_image_ids UUID[]
```

These are no-ops in the Gemini-only phase but make the data model forward-compatible.

---

## 5. MVP Implementation Strategy

Given the gap between this vision and current codebase, here's the pragmatic path:

### Phase 2.2: Visual Scenes MVP (Static Placeholders)

1. **Keep single `avatar_url`** for now (already works)
2. **Add basic scene generation** with T2I + prompt contract (simple text prompt)
3. **Store in `episode_images`** with existing schema
4. **"Our Story" view** showing episode memories with captions
5. **Static expressions** - don't try dynamic expression switching yet

### Phase 2.3: Avatar Kit Foundation (Later)

1. Add prompt contract columns to `characters`
2. Implement `ImageService.edit()` for Gemini image editing
3. Build expression selection logic
4. Create anchor management UI

### Phase 3+: Full Avatar System

1. Core Avatar Kit generation workflow
2. Dynamic expression switching based on emotion
3. Camera mode rendering pipeline
4. Optional Replicate/diffusion integration

---

## 6. Summary of Decisions

| Decision | Status |
|----------|--------|
| **Gemini-only for now** | ✅ Implemented |
| **Provider abstraction** | ✅ Implemented (Gemini + Replicate) |
| **Image storage schema** | ✅ Implemented |
| **Episode images linking** | ✅ Implemented |
| **Character expressions table** | ✅ Implemented |
| **Prompt contract per avatar** | ⏳ Schema needed |
| **Image editing capability** | ⏳ Not implemented |
| **Anchor asset references** | ⏳ Schema needed |
| **Camera modes & rendering** | ⏳ Not implemented |
| **Core Avatar Kit generation** | ⏳ Not implemented |

The architecture is forward-compatible. The immediate focus is getting basic scene cards working with static avatars before tackling the full avatar kit system.
