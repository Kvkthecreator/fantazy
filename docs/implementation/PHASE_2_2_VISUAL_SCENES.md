# Phase 2.2: Visual Scenes MVP

> **Status**: Ready for Implementation
> **Depends on**: Phase 2.1 (Prompting & Memory) - COMPLETED
> **Related**: [AVATAR_IMAGE_GEN_CONSIDERATION.md](../character-philosophy/AVATAR_IMAGE_GEN_CONSIDERATION.md)

---

## Overview

This phase adds basic scene card generation to episodes. We take a **pragmatic MVP approach**: static character avatars with generated scene backgrounds, focusing on UX polish before tackling the full avatar kit system.

### What We're Building
- Scene card generation during key conversation moments
- "Our Story" gallery showing saved memories
- Basic image generation via Gemini
- Caption generation for scene cards

### What We're NOT Building (Yet)
- Dynamic expression switching
- Avatar kit management
- Image editing/inpainting
- Camera mode rendering pipeline

---

## Architecture

### Current State

```
characters.avatar_url  ──►  Static avatar displayed in chat
                           (single image per character)

image_assets table     ──►  Schema exists but unused
episode_images table   ──►  Schema exists but unused
```

### Target State (This Phase)

```
characters.avatar_url  ──►  Static avatar (unchanged)

ImageService.generate() ──►  Scene background generation
                           │
                           ▼
                      image_assets  ──►  Store generated scene
                           │
                           ▼
                      episode_images ──►  Link to episode + caption
                           │
                           ▼
                      "Our Story" UI ──►  Display memories gallery
```

---

## Implementation Plan

### Step 1: Scene Generation Service

Create a service that generates scene cards for conversation moments.

**New file**: `substrate-api/api/src/app/services/scene.py`

```python
"""Scene card generation service.

Generates scene images for key conversation moments (milestones, stage changes).
Uses existing ImageService for generation, stores in image_assets + episode_images.
"""

from uuid import UUID
from typing import Optional
from app.services.image import ImageService, ImageResponse
from app.deps import get_db

class SceneService:
    """Generates and manages scene cards for episodes."""

    # Scene style prompts by character archetype
    STYLE_PROMPTS = {
        "default": "Soft anime style illustration, warm color palette, gentle lighting",
        "tsundere": "Vibrant anime style, dramatic lighting, emotional atmosphere",
        "kuudere": "Clean minimalist anime style, cool color palette, serene atmosphere",
        "childhood_friend": "Cozy slice-of-life anime style, warm golden hour lighting",
    }

    async def generate_scene_card(
        self,
        episode_id: UUID,
        character_name: str,
        character_archetype: str,
        scene_description: str,
        trigger_type: str,  # 'milestone' | 'stage_change' | 'episode_start'
        message_id: Optional[UUID] = None,
    ) -> dict:
        """Generate a scene card for a conversation moment."""

        # Build prompt with character context
        style = self.STYLE_PROMPTS.get(character_archetype, self.STYLE_PROMPTS["default"])
        prompt = f"{style}. {scene_description}. Character: {character_name}."
        negative = "photorealistic, 3D render, harsh shadows, multiple characters"

        # Generate image
        image_service = ImageService.get_instance()
        response = await image_service.generate(
            prompt=prompt,
            negative_prompt=negative,
            width=1024,
            height=768,  # 4:3 aspect for scene cards
        )

        # Store and link to episode
        # ... (database operations)

        return {
            "image_id": ...,
            "storage_path": ...,
            "caption": scene_description,
        }
```

### Step 2: Scene Trigger Logic

Add scene generation triggers to the conversation flow.

**Update**: `substrate-api/api/src/app/services/conversation.py`

Scene triggers:
1. **Episode start** - Generate when new episode begins
2. **Stage change** - Generate when relationship stage advances
3. **Milestone** - Generate at episode progress milestones (25%, 50%, 75%)

```python
# In process_response() or similar
async def maybe_generate_scene(
    episode_id: UUID,
    character: Character,
    trigger_type: str,
    context: str,
):
    """Check if we should generate a scene card."""
    scene_service = SceneService()

    # Generate caption from LLM based on conversation context
    caption = await generate_scene_caption(context)

    await scene_service.generate_scene_card(
        episode_id=episode_id,
        character_name=character.name,
        character_archetype=character.archetype,
        scene_description=caption,
        trigger_type=trigger_type,
    )
```

### Step 3: Storage Integration

Store generated scenes using existing schema.

**Storage flow**:
1. Generate image via `ImageService.generate()`
2. Upload to Supabase Storage (bucket: `scenes`)
3. Create `image_assets` row with generation metadata
4. Create `episode_images` row linking to episode

```python
async def store_scene_image(
    db,
    episode_id: UUID,
    image_bytes: bytes,
    prompt: str,
    caption: str,
    trigger_type: str,
    message_id: Optional[UUID] = None,
) -> dict:
    """Store a generated scene image."""

    # 1. Upload to storage
    storage_path = f"episodes/{episode_id}/{uuid4()}.png"
    # ... upload logic

    # 2. Create image_assets row
    image_asset = await db.fetch_one("""
        INSERT INTO image_assets (
            type, storage_bucket, storage_path, prompt, model_used,
            generation_params, latency_ms, mime_type
        ) VALUES (
            'scene', 'scenes', :storage_path, :prompt, :model,
            :params, :latency, 'image/png'
        ) RETURNING id, storage_path
    """, {...})

    # 3. Get next sequence index
    next_index = await db.fetch_val(
        "SELECT get_next_episode_image_index(:episode_id)",
        {"episode_id": str(episode_id)}
    )

    # 4. Create episode_images row
    await db.execute("""
        INSERT INTO episode_images (
            episode_id, image_id, sequence_index, caption,
            triggered_by_message_id, trigger_type
        ) VALUES (
            :episode_id, :image_id, :sequence_index, :caption,
            :message_id, :trigger_type
        )
    """, {...})

    return {"image_id": image_asset["id"], "storage_path": storage_path}
```

### Step 4: API Endpoints

Add endpoints for retrieving episode scenes.

**New routes**: `substrate-api/api/src/app/routes/scenes.py`

```python
router = APIRouter(prefix="/scenes", tags=["Scenes"])

@router.get("/episodes/{episode_id}")
async def get_episode_scenes(episode_id: UUID, db=Depends(get_db)):
    """Get all scene cards for an episode."""
    query = """
        SELECT
            ei.id, ei.sequence_index, ei.caption, ei.trigger_type,
            ei.is_memory, ei.saved_at, ei.created_at,
            ia.storage_path, ia.style_tags
        FROM episode_images ei
        JOIN image_assets ia ON ia.id = ei.image_id
        WHERE ei.episode_id = :episode_id
        ORDER BY ei.sequence_index
    """
    return await db.fetch_all(query, {"episode_id": str(episode_id)})

@router.post("/episodes/{episode_id}/scenes/{scene_id}/save")
async def save_as_memory(episode_id: UUID, scene_id: UUID, db=Depends(get_db)):
    """Save a scene card as a memory (star it)."""
    await db.execute("""
        UPDATE episode_images
        SET is_memory = TRUE, saved_at = NOW()
        WHERE id = :scene_id AND episode_id = :episode_id
    """, {"scene_id": str(scene_id), "episode_id": str(episode_id)})
    return {"saved": True}

@router.get("/memories/{character_id}")
async def get_character_memories(character_id: UUID, limit: int = 50, db=Depends(get_db)):
    """Get saved memories for a character (uses existing function)."""
    # Uses get_user_memories() from migration 008
    ...
```

### Step 5: Frontend - Scene Cards in Chat

Display scene cards inline in the conversation.

**Update**: `web/src/app/(dashboard)/chat/[characterId]/`

```tsx
// SceneCard component
interface SceneCard {
  id: string;
  storagePath: string;
  caption: string;
  triggerType: 'milestone' | 'stage_change' | 'episode_start';
  isMemory: boolean;
}

function SceneCard({ scene, onSave }: { scene: SceneCard; onSave: () => void }) {
  const imageUrl = getSupabaseStorageUrl('scenes', scene.storagePath);

  return (
    <div className="scene-card rounded-xl overflow-hidden my-4">
      <img src={imageUrl} alt={scene.caption} className="w-full" />
      <div className="p-3 flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{scene.caption}</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
          className={scene.isMemory ? "text-yellow-500" : ""}
        >
          <Star className={scene.isMemory ? "fill-current" : ""} />
        </Button>
      </div>
    </div>
  );
}
```

### Step 6: Frontend - "Our Story" Gallery

Create a memories gallery view.

**New page**: `web/src/app/(dashboard)/story/[characterId]/page.tsx`

```tsx
export default function OurStoryPage({ params }: { params: { characterId: string }}) {
  const { data: memories } = useQuery({
    queryKey: ['memories', params.characterId],
    queryFn: () => api.get(`/scenes/memories/${params.characterId}`),
  });

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Our Story</h1>

      <div className="grid grid-cols-2 gap-4">
        {memories?.map((memory) => (
          <div key={memory.id} className="rounded-xl overflow-hidden bg-card">
            <img
              src={getSupabaseStorageUrl('scenes', memory.storagePath)}
              alt={memory.caption}
              className="w-full aspect-[4/3] object-cover"
            />
            <div className="p-3">
              <p className="text-sm">{memory.caption}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(memory.savedAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {(!memories || memories.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No memories saved yet.</p>
          <p className="text-sm mt-2">
            Star scenes during your conversations to save them here.
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## Database Changes

No schema changes needed - we use existing tables from migration 008.

**Tables used:**
- `image_assets` - Stores generated scene images
- `episode_images` - Links images to episodes with captions
- `get_next_episode_image_index()` - Helper function exists
- `get_user_memories()` - Helper function exists

**Storage bucket needed:**
- `scenes` - May need to create in Supabase dashboard if not exists

---

## Scene Trigger Configuration

When to generate scene cards:

| Trigger | Condition | Example Caption |
|---------|-----------|-----------------|
| `episode_start` | New episode begins | "A new chapter begins..." |
| `stage_change` | Relationship advances | "Something shifted between us today" |
| `milestone_25` | 25% through stage progress | Dynamic based on conversation |
| `milestone_50` | 50% through stage progress | Dynamic based on conversation |
| `milestone_75` | 75% through stage progress | Dynamic based on conversation |

Caption generation uses LLM to summarize the conversation moment.

---

## Testing Plan

1. **Manual scene generation** - Test `/debug/generate-scene` endpoint
2. **Episode start trigger** - Start new episode, verify scene card appears
3. **Save as memory** - Star a scene, verify it appears in "Our Story"
4. **Storage upload** - Verify images upload to Supabase Storage
5. **Load times** - Ensure scene generation doesn't block chat response

---

## Future Enhancements (Not This Phase)

These are documented for future reference but NOT implemented now:

1. **Avatar kit integration** - Use character-specific prompts from prompt contract
2. **Expression overlay** - Composite character expression onto scene background
3. **Image editing** - Use Gemini edit to modify existing scenes
4. **Camera modes** - Portrait, mid-shot, full-body compositions
5. **User-requested scenes** - "Draw this moment" button in chat

---

## Files to Create/Modify

### New Files
- [ ] `substrate-api/api/src/app/services/scene.py` - Scene generation service
- [ ] `substrate-api/api/src/app/routes/scenes.py` - Scene API endpoints
- [ ] `web/src/app/(dashboard)/story/[characterId]/page.tsx` - Our Story page
- [ ] `web/src/components/chat/SceneCard.tsx` - Scene card component

### Modified Files
- [ ] `substrate-api/api/src/app/services/conversation.py` - Add scene triggers
- [ ] `substrate-api/api/src/app/main.py` - Register scenes router
- [ ] `web/src/app/(dashboard)/chat/[characterId]/page.tsx` - Render scene cards

---

## Success Criteria

- [ ] Scene cards generate at episode start
- [ ] Scene cards generate on relationship stage change
- [ ] Users can star scenes to save as memories
- [ ] "Our Story" page displays saved memories
- [ ] Images persist in Supabase Storage
- [ ] Scene generation doesn't noticeably delay chat responses
