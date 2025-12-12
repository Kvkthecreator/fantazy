# Avatar Management Domain (v1.0)

> **Updated**: December 2024
> **Status**: Architecture specification - ready for implementation
> **Related**: [AVATAR_IMAGE_GEN_CONSIDERATION.md](./AVATAR_IMAGE_GEN_CONSIDERATION.md)

---

## Core Principle

**An avatar is not one image. It's a visual identity contract.**

Like an anime character's model sheet (settei), an avatar defines the canonical visual identity that must remain consistent across all scenes. Without anchored reference images, every generated scene risks visual drift - the character looking different each time.

**Consistency is the core value proposition.** Mickey must look like Mickey whether she's in a cafe, in bed, wearing different clothes, or in different lighting.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AVATAR DOMAIN                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────────┐       │
│  │ characters  │─────▶│  avatar_kits │─────▶│  avatar_assets   │       │
│  │             │      │              │      │                  │       │
│  │ narrative   │      │ visual       │      │ canonical images │       │
│  │ identity    │      │ identity     │      │ (anchors,        │       │
│  │ (who)       │      │ contract     │      │  expressions)    │       │
│  └─────────────┘      └──────────────┘      └──────────────────┘       │
│         │                    │                       │                  │
│         │                    │                       ▼                  │
│         │                    │              ┌──────────────────┐       │
│         │                    │              │ Storage          │       │
│         │                    │              │ avatars/         │       │
│         │                    │              │   {kit_id}/      │       │
│         │                    │              └──────────────────┘       │
│         │                    │                                         │
├─────────┼────────────────────┼─────────────────────────────────────────┤
│         │                    │         SCENE DOMAIN                    │
├─────────┼────────────────────┼─────────────────────────────────────────┤
│         │                    │                                         │
│         │                    ▼                                         │
│         │           ┌──────────────────┐                               │
│         │           │ ImageService     │                               │
│         │           │ .generate()      │──────▶ T2I (no reference)     │
│         │           │ .edit()          │──────▶ Reference-based edit   │
│         │           └──────────────────┘                               │
│         │                    │                                         │
│         │                    ▼                                         │
│         │           ┌──────────────────┐      ┌──────────────────┐    │
│         └──────────▶│ scene_images     │─────▶│ Storage          │    │
│                     │ (user outputs)   │      │ scenes/          │    │
│                     └──────────────────┘      │   {user}/{ep}/   │    │
│                                               └──────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key separation:**
- `avatar_kits` + `avatar_assets` = **canonical, shared, rarely change** (the model sheet)
- `scene_images` = **user-specific, generated frequently** (the animation frames)

---

## Data Model

### 1. Characters (Existing - Minor Extension)

The `characters` table stays focused on **narrative identity**. We add one FK to link to visual identity:

```sql
-- Existing characters table - add FK only
ALTER TABLE characters
ADD COLUMN active_avatar_kit_id UUID REFERENCES avatar_kits(id);

-- REMOVE from previous plan: appearance, style_prompt, negative_prompt
-- Those belong in avatar_kits, not characters
```

**Rationale**: A character can have multiple avatar kits (seasonal outfits, story progression). The `active_avatar_kit_id` points to the currently active visual identity.

### 2. Avatar Kits (NEW)

The **visual identity contract** - defines what the character looks like and the rules for generating consistent images.

```sql
CREATE TABLE avatar_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),  -- Admin who created it

    -- Identity
    name TEXT NOT NULL,                          -- "Yuki Default", "Yuki Summer", "Yuki Formal"
    description TEXT,                            -- Internal notes

    -- Visual Contract (the "model sheet" text)
    appearance_prompt TEXT NOT NULL,             -- Physical description for image prompts
                                                 -- "Young woman, shoulder-length black hair, warm brown eyes,
                                                 --  soft features, slight smile, cream cardigan..."

    style_prompt TEXT NOT NULL,                  -- Art style rules
                                                 -- "Anime style, soft cel shading, warm color palette,
                                                 --  Studio Ghibli-inspired, gentle lighting..."

    negative_prompt TEXT,                        -- What to avoid
                                                 -- "photorealistic, 3D render, multiple people,
                                                 --  different hairstyle, different eye color..."

    -- Anchor References (the canonical images)
    primary_anchor_id UUID REFERENCES avatar_assets(id),    -- Portrait anchor
    secondary_anchor_id UUID REFERENCES avatar_assets(id),  -- Full-body anchor

    -- Kit Status
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived')),
    is_default BOOLEAN DEFAULT FALSE,            -- Default kit for this character

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_avatar_kits_character ON avatar_kits(character_id);
CREATE INDEX idx_avatar_kits_status ON avatar_kits(status) WHERE status = 'active';

-- Only one default per character
CREATE UNIQUE INDEX idx_avatar_kits_default
ON avatar_kits(character_id)
WHERE is_default = TRUE;
```

### 3. Avatar Assets (NEW - Replaces generic image_assets for avatars)

Canonical images that define the character's visual identity.

```sql
CREATE TABLE avatar_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent
    avatar_kit_id UUID NOT NULL REFERENCES avatar_kits(id) ON DELETE CASCADE,

    -- Classification
    asset_type TEXT NOT NULL CHECK (asset_type IN (
        'anchor_portrait',      -- Primary face reference (shoulders up)
        'anchor_fullbody',      -- Full body reference
        'expression',           -- Expression variant (derived from anchor)
        'pose',                 -- Pose variant
        'outfit'                -- Outfit variant (future)
    )),

    expression TEXT,            -- For expression assets: 'neutral', 'happy', 'shy', 'flustered', etc.
    emotion_tags TEXT[],        -- Maps emotions to this asset: ['joy', 'excitement'] -> 'happy'

    -- Storage
    storage_bucket TEXT NOT NULL DEFAULT 'avatars',
    storage_path TEXT NOT NULL,  -- {kit_id}/anchors/{id}.png or {kit_id}/expressions/{id}.png

    -- Generation Provenance
    source_type TEXT NOT NULL CHECK (source_type IN (
        'manual_upload',        -- Admin uploaded
        'ai_generated',         -- Generated by ImageService
        'imported'              -- Imported from external source
    )),
    derived_from_id UUID REFERENCES avatar_assets(id),  -- If this was edited from another asset

    generation_metadata JSONB DEFAULT '{}',  -- {
                                             --   "provider": "replicate",
                                             --   "model": "flux-kontext-pro",
                                             --   "prompt": "...",
                                             --   "reference_asset_ids": [...],
                                             --   "latency_ms": 5200
                                             -- }

    -- Image Properties
    mime_type TEXT DEFAULT 'image/png',
    width INTEGER,
    height INTEGER,
    file_size_bytes INTEGER,

    -- Status
    is_canonical BOOLEAN DEFAULT FALSE,  -- TRUE for anchors, FALSE for variants
    is_active BOOLEAN DEFAULT TRUE,      -- Soft delete

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_avatar_assets_kit ON avatar_assets(avatar_kit_id);
CREATE INDEX idx_avatar_assets_type ON avatar_assets(asset_type);
CREATE INDEX idx_avatar_assets_expression ON avatar_assets(expression) WHERE expression IS NOT NULL;
```

### 4. Scene Images (RENAME from episode_images)

User-generated scene outputs. These reference the avatar kit but are stored separately.

```sql
-- Rename existing table for clarity
ALTER TABLE episode_images RENAME TO scene_images;

-- Add avatar kit reference
ALTER TABLE scene_images
ADD COLUMN avatar_kit_id UUID REFERENCES avatar_kits(id),
ADD COLUMN derived_from_asset_id UUID REFERENCES avatar_assets(id);

-- scene_images now clearly represents:
-- - User-specific generated content
-- - References which avatar kit was used for consistency tracking
-- - Links to episode for timeline/memory features
```

### 5. Keep Existing image_assets for Non-Avatar Images

The existing `image_assets` table remains for:
- Background images
- Props
- World assets
- Any non-character images

```sql
-- Clarify existing table purpose
COMMENT ON TABLE image_assets IS 'Generic image assets (backgrounds, props, world elements). For character visuals, use avatar_assets.';
```

---

## Storage Structure

```
avatars/                                    # NEW bucket - canonical character assets
  {kit_id}/
    anchors/
      portrait_{asset_id}.png               # Primary anchor
      fullbody_{asset_id}.png               # Secondary anchor
    expressions/
      happy_{asset_id}.png
      shy_{asset_id}.png
      neutral_{asset_id}.png
    poses/
      sitting_{asset_id}.png
      standing_{asset_id}.png

scenes/                                     # EXISTING bucket - user-generated content
  {user_id}/
    {episode_id}/
      {scene_id}.png
```

**Access patterns:**
- `avatars/` - Public read, admin write (canonical assets shared across all users)
- `scenes/` - Authenticated read/write (user-specific content)

---

## Image Service Extension

### Current State

```python
class ImageService:
    async def generate(prompt, negative_prompt, width, height, num_images) -> ImageResponse
```

### Required Extension

```python
class ImageService:
    # Existing - T2I generation
    async def generate(
        prompt: str,
        negative_prompt: Optional[str] = None,
        width: int = 1024,
        height: int = 1024,
        num_images: int = 1,
    ) -> ImageResponse

    # NEW - Reference-based editing for character consistency
    async def edit(
        prompt: str,
        reference_images: List[bytes],           # Anchor image(s) to maintain consistency
        negative_prompt: Optional[str] = None,
        edit_strength: float = 0.7,              # How much to change (0=identical, 1=ignore reference)
        width: int = 1024,
        height: int = 1024,
    ) -> ImageResponse
```

### Provider Selection

Based on research, recommended providers for `edit()`:

| Provider | Model | Use Case | Cost |
|----------|-------|----------|------|
| **Replicate** | [FLUX.1 Kontext Pro](https://replicate.com/blog/flux-kontext) | Character consistency | ~$0.03/image |
| **Replicate** | [FLUX 2 Pro](https://replicate.com/black-forest-labs/flux-2-pro) | Multi-reference (up to 8) | ~$0.05/image |
| Google | Imagen 3.0 | Inpainting/removal | Vertex AI pricing |

**Recommendation**: FLUX Kontext Pro on Replicate - purpose-built for character consistency across edits.

---

## Scene Generation Flow (Updated)

### Without Avatar Kit (Current - Fallback)

```
User clicks "Visualize"
    → Fetch episode context
    → LLM generates scene prompt (text only)
    → ImageService.generate(prompt)  # T2I, no reference
    → Store in scene_images
    → Return signed URL
```

**Result**: Inconsistent character appearance across scenes.

### With Avatar Kit (Target)

```
User clicks "Visualize"
    → Fetch episode context + active_avatar_kit
    → Fetch kit's primary_anchor asset
    → LLM generates scene prompt (includes appearance_prompt from kit)
    → ImageService.edit(
          prompt=scene_prompt,
          reference_images=[anchor_bytes],  # Character stays consistent
          negative_prompt=kit.negative_prompt
      )
    → Store in scene_images (with avatar_kit_id reference)
    → Return signed URL
```

**Result**: Mickey looks like Mickey in every scene.

---

## API Surface

### Existing (Keep)

```
POST   /scenes/generate              # Generate scene for episode
GET    /scenes/episode/{id}          # List episode scenes
PATCH  /scenes/{id}/memory           # Toggle memory status
GET    /scenes/memories              # List saved memories
```

### New - Avatar Kit Management (Admin)

```
# Kit CRUD
POST   /avatar-kits                  # Create new kit
GET    /avatar-kits                  # List all kits (admin)
GET    /avatar-kits/{id}             # Get kit details
PATCH  /avatar-kits/{id}             # Update kit (prompts, status)
DELETE /avatar-kits/{id}             # Archive kit

# Kit-Character Association
GET    /characters/{id}/avatar-kits  # List kits for character
PATCH  /characters/{id}/active-kit   # Set active kit

# Asset Management
POST   /avatar-kits/{id}/assets      # Upload asset to kit
GET    /avatar-kits/{id}/assets      # List kit assets
PATCH  /avatar-kits/{id}/assets/{asset_id}  # Update asset metadata
DELETE /avatar-kits/{id}/assets/{asset_id}  # Remove asset

# Anchor Management
PATCH  /avatar-kits/{id}/primary-anchor     # Set primary anchor
PATCH  /avatar-kits/{id}/secondary-anchor   # Set secondary anchor
```

### New - Kit Generation (Future)

```
# AI-assisted kit creation
POST   /avatar-kits/{id}/generate-anchors   # Generate anchor images from prompts
POST   /avatar-kits/{id}/generate-expressions  # Generate expression set from anchor
```

---

## Implementation Phases

### Phase 1: Schema & Storage Foundation

1. Create `avatar_kits` table
2. Create `avatar_assets` table
3. Rename `episode_images` → `scene_images`, add FKs
4. Create `avatars/` storage bucket
5. Add `active_avatar_kit_id` to characters

**Deliverable**: Data model ready, no functional changes yet.

### Phase 2: Manual Kit Creation (MVP)

1. Build admin endpoints for kit CRUD
2. Build admin endpoints for asset upload
3. Admin UI for kit management (or use direct API/SQL for now)
4. Manually create kits for existing characters

**Deliverable**: Can define visual identity contracts, upload anchor images.

### Phase 3: Reference-Based Scene Generation

1. Implement `ImageService.edit()` with FLUX Kontext
2. Update scene generation to use avatar kit
3. Fall back to T2I if no kit exists

**Deliverable**: Scenes maintain character consistency via reference images.

### Phase 4: Expression Library

1. Pre-generate expression variants from anchors
2. Add emotion detection to conversation flow
3. Scene generation selects appropriate expression

**Deliverable**: Dynamic expression matching based on conversation mood.

### Phase 5: AI-Assisted Kit Generation

1. "Generate Core Kit" endpoint
2. Takes appearance_prompt → generates anchors + expressions
3. Admin review/approval flow

**Deliverable**: Faster kit creation for new characters.

---

## Kit Evolution Strategy

Characters can have multiple kits for different contexts:

```
Yuki (character)
├── "Yuki Default" (active_avatar_kit_id → this)
│   ├── appearance: "cream cardigan, casual style..."
│   └── anchors: portrait.png, fullbody.png
│
├── "Yuki Summer"
│   ├── appearance: "light sundress, summer style..."
│   └── anchors: portrait_summer.png, fullbody_summer.png
│
└── "Yuki Formal"
    ├── appearance: "elegant dress, formal style..."
    └── anchors: portrait_formal.png, fullbody_formal.png
```

**Use cases:**
- Seasonal events (summer outfit, winter outfit)
- Story progression (character grows, changes style)
- Special occasions (formal events, casual hangouts)

Switch active kit via `PATCH /characters/{id}/active-kit`.

---

## Migration Path

### From Current State

```
Current:
- characters.avatar_url (single static URL)
- image_assets (generic, mixed use)
- episode_images (scenes + memories)

Target:
- characters.active_avatar_kit_id → avatar_kits
- avatar_kits → avatar_assets (canonical character visuals)
- image_assets (backgrounds, props only)
- scene_images (user-generated, references kit)
```

### Data Migration

1. For each character with `avatar_url`:
   - Create `avatar_kit` with basic prompts
   - Upload existing avatar as `anchor_portrait` asset
   - Set as `primary_anchor_id`
   - Link character to kit

2. Existing `episode_images`:
   - Rename to `scene_images`
   - Add `avatar_kit_id = NULL` (legacy, no kit reference)

---

## Open Questions (Decided)

| Question | Decision |
|----------|----------|
| **Who creates kits?** | Admin-only for MVP. Schema supports user-owned kits later. |
| **Can kits evolve?** | Yes - multiple kits per character, switch via `active_avatar_kit_id`. |
| **What is consistency?** | Same recognizable character across contexts (like game character in different scenes). |
| **API follows architecture?** | Yes - we use FLUX Kontext on Replicate for reference-based editing. |

---

## Sources

- [FLUX.1 Kontext on Replicate](https://replicate.com/blog/flux-kontext) - Character consistency editing
- [Generate consistent characters - Replicate](https://replicate.com/blog/generate-consistent-characters) - Best practices
- [FLUX 2 Pro](https://replicate.com/black-forest-labs/flux-2-pro) - Multi-reference generation
- [Gemini Image Editing](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-editing) - Alternative provider
