# Avatar Kit Development Workflow

> **Purpose**: Document the process for creating, testing, and managing avatar kits for character visual consistency.

## Overview

Avatar kits are the "visual identity contracts" for characters. They define:
- **Appearance Prompt**: Physical description (hair, eyes, clothing, etc.)
- **Style Prompt**: Art style rules (anime, lighting, color palette)
- **Negative Prompt**: What to avoid in generation
- **Anchor Images**: Canonical reference images for character consistency

When generating scene images, the system uses FLUX Kontext with the anchor image to maintain character consistency across all outputs.

---

## Workflow Steps

### 1. Prepare Reference Image

Select or create a high-quality reference image that will serve as the character's visual anchor.

**Requirements:**
- Clear face visibility (for portrait anchors)
- Consistent with character description
- High resolution (1024x1024 recommended)
- Supported formats: PNG, JPEG, WebP

**Best Practices:**
- Use anime/illustration style matching your target aesthetic
- Avoid complex backgrounds that distract from the character
- Ensure lighting is clear and even
- Character should be the focal point

### 2. Create Avatar Kit

#### Option A: Using Shell Script (Quick Setup)

```bash
# Set your service role key
export SUPABASE_SERVICE_ROLE_KEY="your-key-here"

# Run the setup script
./scripts/setup_test_avatar.sh /path/to/anchor_image.png
```

#### Option B: Using API Endpoints

```bash
TOKEN="your-jwt-token"
API="https://your-api.onrender.com"

# 1. Create the kit
curl -X POST "$API/avatar-kits" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "character_id": "uuid-here",
    "name": "Character Default",
    "appearance_prompt": "Young woman with long black hair...",
    "style_prompt": "Anime style, soft lighting...",
    "negative_prompt": "Low quality, blurry..."
  }'

# 2. Upload anchor image
curl -X POST "$API/avatar-kits/{kit_id}/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/image.png" \
  -F "asset_type=anchor_portrait"

# 3. Set as primary anchor
curl -X PATCH "$API/avatar-kits/{kit_id}/primary-anchor?asset_id={asset_id}" \
  -H "Authorization: Bearer $TOKEN"

# 4. Activate the kit
curl -X PATCH "$API/avatar-kits/{kit_id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'

# 5. Link to character
curl -X PATCH "$API/avatar-kits/character/{character_id}/active-kit?kit_id={kit_id}" \
  -H "Authorization: Bearer $TOKEN"
```

#### Option C: Direct Database + Storage (Development)

```bash
# Generate UUIDs
KIT_ID=$(python3 -c "import uuid; print(uuid.uuid4())")
ASSET_ID=$(python3 -c "import uuid; print(uuid.uuid4())")

# Upload to Supabase Storage
curl -X POST "$SUPABASE_URL/storage/v1/object/avatars/$KIT_ID/anchors/$ASSET_ID.png" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary "@/path/to/image.png"

# Insert database records (see scripts/setup_test_avatar.sh for full SQL)
```

### 3. Write Effective Prompts

#### Appearance Prompt Template

```
[Age/gender], [hair description], [eye description], [skin tone],
[facial features], [expression]. Wearing [clothing description],
[accessories]. [Additional distinguishing features].
```

**Example:**
```
Young woman with long flowing black hair, side-swept bangs,
striking blue eyes with subtle red undertones, fair porcelain skin,
soft delicate features, slight blush on cheeks. Wearing a crisp
white button-up dress shirt with a bold red bow tie ribbon at
the collar, dark navy pleated skirt. Japanese school uniform aesthetic.
```

#### Style Prompt Template

```
[Art style], [rendering technique], [lighting], [color palette],
[quality descriptors], [specific artistic influences].
```

**Example:**
```
High-quality anime illustration style, semi-realistic digital painting,
soft natural window lighting, detailed glossy hair with reflective
highlights, subtle skin texture, warm inviting color palette,
professional illustration quality, slight depth of field effect.
```

#### Negative Prompt Template

```
[Quality issues], [anatomical problems], [unwanted elements],
[style conflicts], [technical artifacts].
```

**Example:**
```
Low quality, blurry, pixelated, deformed anatomy, extra limbs,
bad proportions, multiple people, text overlay, watermark,
signature, jpeg artifacts, 3D render, photorealistic.
```

### 4. Test Scene Generation

Once the avatar kit is active and linked to a character:

```bash
# Start an episode with the character
curl -X POST "$API/episodes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "character_id": "uuid-here",
    "title": "Test Episode"
  }'

# Generate a scene image (will use FLUX Kontext with anchor)
curl -X POST "$API/scenes/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "episode_id": "episode-uuid-here"
  }'
```

The scene generation will:
1. Fetch the character's active avatar kit
2. Download the primary anchor image
3. Use FLUX Kontext to generate a scene maintaining character consistency
4. Store the result in the `scenes` bucket

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `avatar_kits` | Visual identity contracts |
| `avatar_assets` | Canonical images (anchors, expressions) |
| `scene_images` | Generated scene outputs |
| `characters.active_avatar_kit_id` | Links character to active kit |

### Key Relationships

```
characters
    └── active_avatar_kit_id → avatar_kits.id

avatar_kits
    ├── primary_anchor_id → avatar_assets.id
    └── secondary_anchor_id → avatar_assets.id

avatar_assets
    └── avatar_kit_id → avatar_kits.id

scene_images
    └── avatar_kit_id → avatar_kits.id (tracks which kit was used)
```

### Storage Structure

```
avatars/                          # Private bucket
  └── {kit_id}/
      ├── anchors/
      │   └── {asset_id}.png      # Portrait/fullbody references
      ├── expressions/
      │   └── {asset_id}.png      # Expression variants
      └── poses/
          └── {asset_id}.png      # Pose variants

scenes/                           # Private bucket
  └── {user_id}/
      └── {episode_id}/
          └── {image_id}.png      # Generated scene cards
```

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/setup_test_avatar.sh` | Quick shell script for avatar kit creation |
| `scripts/test_avatar_kit.py` | Python script with full workflow |

---

## Future Considerations

### Frontend Implementation

- [ ] Avatar Kit Management UI (create, edit, delete kits)
- [ ] Anchor Image Upload Component (drag-drop, preview)
- [ ] Kit Status Management (draft → active → archived)
- [ ] Expression Library Browser
- [ ] Bulk Asset Upload

### Bulk Operations

- [ ] Batch kit creation from CSV/JSON
- [ ] Multi-character kit templates
- [ ] Expression pack imports
- [ ] Style preset library

### Quality Improvements

- [ ] Image quality validation before upload
- [ ] Automatic prompt enhancement suggestions
- [ ] A/B testing different anchors
- [ ] User feedback loop for consistency ratings

### Advanced Features

- [ ] Multiple anchor support (portrait + fullbody)
- [ ] Outfit variants per kit
- [ ] Pose library integration
- [ ] Expression detection → asset mapping
- [ ] Dynamic anchor selection based on scene context

---

## Audit Checkpoints

### Initial Setup (Current)
- [x] Schema: avatar_kits, avatar_assets tables
- [x] Storage: avatars bucket with RLS
- [x] API: Full CRUD for kits and assets
- [x] Integration: Scene generation uses anchor references
- [x] Scripts: Shell and Python setup utilities

### Re-audit Before Frontend
- [ ] Verify API response formats match frontend expectations
- [ ] Test signed URL expiration handling
- [ ] Validate error messages are user-friendly
- [ ] Check pagination for asset lists
- [ ] Performance test with multiple assets per kit

### Re-audit Before Production Scale
- [ ] Storage costs monitoring
- [ ] FLUX Kontext API rate limits
- [ ] Anchor image CDN caching strategy
- [ ] Database query optimization (joins)
- [ ] Background job for asset processing

---

## Testing Checklist

### Manual Testing

1. **Create Kit**: POST /avatar-kits with valid data
2. **Upload Anchor**: POST /avatar-kits/{id}/assets with image
3. **Set Anchor**: PATCH /avatar-kits/{id}/primary-anchor
4. **Activate**: PATCH /avatar-kits/{id} with status=active
5. **Link**: PATCH /avatar-kits/character/{id}/active-kit
6. **Generate Scene**: POST /scenes/generate (verify FLUX Kontext used)
7. **View Scene**: GET /scenes/episode/{id} (verify signed URLs work)

### Database Verification

```sql
-- Check kit status
SELECT id, name, status, primary_anchor_id
FROM avatar_kits
WHERE status = 'active';

-- Check character linkage
SELECT c.name, ak.name as kit_name, ak.status
FROM characters c
JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id;

-- Check scene generation used kit
SELECT si.id, si.avatar_kit_id, ia.prompt
FROM scene_images si
JOIN image_assets ia ON ia.id = si.image_id
WHERE si.avatar_kit_id IS NOT NULL;
```

---

## Troubleshooting

### "Kit not found" errors
- Verify kit ID is correct UUID format
- Check kit status is 'active' (RLS only allows SELECT on active)
- Ensure using service role for admin operations

### "Asset upload failed"
- Check SUPABASE_SERVICE_ROLE_KEY is set
- Verify image MIME type is allowed (png, jpeg, webp)
- Confirm avatars bucket exists

### "Scene generation not using anchor"
- Verify character has active_avatar_kit_id set
- Check kit has primary_anchor_id set
- Ensure anchor asset is_active = true
- Check REPLICATE_API_TOKEN is set on Render

### "Signed URL expired"
- Default expiry is 1 hour
- Frontend should refresh URLs before expiry
- Consider longer expiry for development

---

## Related Documentation

- [Database Access Guide](../DATABASE_ACCESS.md)
- [Avatar Management Domain](../character-philosophy/AVATAR_MANAGEMENT_DOMAIN.md)
- [Fantazy Canon](../FANTAZY_CANON.md)
