#!/bin/bash
# Setup avatar kits for Kai and Sora
#
# Usage: ./scripts/setup_avatars_kai_sora.sh <kai_image> <sora_image>

set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <kai_image_path> <sora_image_path>"
    exit 1
fi

KAI_IMAGE="$1"
SORA_IMAGE="$2"

if [ ! -f "$KAI_IMAGE" ]; then
    echo "Error: Kai image not found at $KAI_IMAGE"
    exit 1
fi

if [ ! -f "$SORA_IMAGE" ]; then
    echo "Error: Sora image not found at $SORA_IMAGE"
    exit 1
fi

# Configuration
SUPABASE_URL="https://lfwhdzwbikyzalpbwfnd.supabase.co"
DB_HOST="aws-1-ap-northeast-1.pooler.supabase.com"
DB_PASSWORD="42PJb25YJhJHJdkl"
DB_USER="postgres.lfwhdzwbikyzalpbwfnd"

# Get service role key from env or prompt
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "SUPABASE_SERVICE_ROLE_KEY not set."
    echo "Get it from: https://supabase.com/dashboard/project/lfwhdzwbikyzalpbwfnd/settings/api"
    read -p "Enter service role key: " SUPABASE_SERVICE_ROLE_KEY
fi

# Character IDs from seed data
KAI_CHARACTER_ID="e5f6a7b8-c9d0-1234-ef01-345678901234"
SORA_CHARACTER_ID="f6a7b8c9-d0e1-2345-f012-456789012345"

# Generate UUIDs
KAI_KIT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
KAI_ASSET_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
SORA_KIT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
SORA_ASSET_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

echo "================================================"
echo "Setting up avatar kits for Kai and Sora"
echo "================================================"
echo ""
echo "Kai:"
echo "  Character ID: $KAI_CHARACTER_ID"
echo "  Kit ID: $KAI_KIT_ID"
echo "  Asset ID: $KAI_ASSET_ID"
echo ""
echo "Sora:"
echo "  Character ID: $SORA_CHARACTER_ID"
echo "  Kit ID: $SORA_KIT_ID"
echo "  Asset ID: $SORA_ASSET_ID"
echo ""

# Storage paths
KAI_STORAGE_PATH="$KAI_KIT_ID/anchors/$KAI_ASSET_ID.webp"
SORA_STORAGE_PATH="$SORA_KIT_ID/anchors/$SORA_ASSET_ID.webp"

# Upload Kai's image
echo "Uploading Kai's avatar..."
curl -X POST "$SUPABASE_URL/storage/v1/object/avatars/$KAI_STORAGE_PATH" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: image/webp" \
  -H "x-upsert: true" \
  --data-binary "@$KAI_IMAGE" \
  --silent --show-error
echo "  Uploaded to: avatars/$KAI_STORAGE_PATH"

# Upload Sora's image
echo "Uploading Sora's avatar..."
curl -X POST "$SUPABASE_URL/storage/v1/object/avatars/$SORA_STORAGE_PATH" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: image/webp" \
  -H "x-upsert: true" \
  --data-binary "@$SORA_IMAGE" \
  --silent --show-error
echo "  Uploaded to: avatars/$SORA_STORAGE_PATH"

# Create database records
echo ""
echo "Creating database records..."

PGPASSWORD="$DB_PASSWORD" psql "postgresql://$DB_USER@$DB_HOST:5432/postgres" <<EOF
-- Clear old static avatar_url values
UPDATE characters SET avatar_url = NULL WHERE avatar_url LIKE '/characters/%';

-- ============================================
-- KAI
-- ============================================

-- Create avatar kit for Kai
INSERT INTO avatar_kits (
    id, character_id, name, description,
    appearance_prompt, style_prompt, negative_prompt,
    status, is_default
) VALUES (
    '$KAI_KIT_ID'::uuid,
    '$KAI_CHARACTER_ID'::uuid,
    'Kai Default',
    'Default avatar kit for Kai',
    'Young man, casual style, headphones around neck, relaxed expression, developer aesthetic.',
    'High-quality anime illustration style, soft lighting, warm colors.',
    'Low quality, blurry, deformed.'
)
ON CONFLICT (id) DO NOTHING;

-- Create avatar asset for Kai
INSERT INTO avatar_assets (
    id, avatar_kit_id, asset_type,
    storage_bucket, storage_path, source_type,
    is_canonical, mime_type
) VALUES (
    '$KAI_ASSET_ID'::uuid,
    '$KAI_KIT_ID'::uuid,
    'anchor_portrait',
    'avatars',
    '$KAI_STORAGE_PATH',
    'manual_upload',
    true,
    'image/webp'
)
ON CONFLICT (id) DO NOTHING;

-- Set primary anchor and activate
UPDATE avatar_kits
SET primary_anchor_id = '$KAI_ASSET_ID'::uuid, status = 'active', updated_at = NOW()
WHERE id = '$KAI_KIT_ID'::uuid;

-- Link to character
UPDATE characters
SET active_avatar_kit_id = '$KAI_KIT_ID'::uuid
WHERE id = '$KAI_CHARACTER_ID'::uuid;

-- ============================================
-- SORA
-- ============================================

-- Create avatar kit for Sora
INSERT INTO avatar_kits (
    id, character_id, name, description,
    appearance_prompt, style_prompt, negative_prompt,
    status, is_default
) VALUES (
    '$SORA_KIT_ID'::uuid,
    '$SORA_CHARACTER_ID'::uuid,
    'Sora Default',
    'Default avatar kit for Sora',
    'Young professional, office attire, friendly expression, ambitious demeanor.',
    'High-quality anime illustration style, soft lighting, professional setting.',
    'Low quality, blurry, deformed.'
)
ON CONFLICT (id) DO NOTHING;

-- Create avatar asset for Sora
INSERT INTO avatar_assets (
    id, avatar_kit_id, asset_type,
    storage_bucket, storage_path, source_type,
    is_canonical, mime_type
) VALUES (
    '$SORA_ASSET_ID'::uuid,
    '$SORA_KIT_ID'::uuid,
    'anchor_portrait',
    'avatars',
    '$SORA_STORAGE_PATH',
    'manual_upload',
    true,
    'image/webp'
)
ON CONFLICT (id) DO NOTHING;

-- Set primary anchor and activate
UPDATE avatar_kits
SET primary_anchor_id = '$SORA_ASSET_ID'::uuid, status = 'active', updated_at = NOW()
WHERE id = '$SORA_KIT_ID'::uuid;

-- Link to character
UPDATE characters
SET active_avatar_kit_id = '$SORA_KIT_ID'::uuid
WHERE id = '$SORA_CHARACTER_ID'::uuid;

-- ============================================
-- Verify
-- ============================================
SELECT c.name, c.active_avatar_kit_id, ak.status as kit_status, ak.primary_anchor_id
FROM characters c
LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
WHERE c.is_active = TRUE
ORDER BY c.name;
EOF

echo ""
echo "============================================"
echo "SUCCESS!"
echo "============================================"
echo "Kai and Sora avatar kits created and linked."
echo ""
echo "Refresh the dashboard to see the avatars!"
echo "============================================"
