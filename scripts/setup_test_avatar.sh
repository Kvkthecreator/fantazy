#!/bin/bash
# Setup test avatar kit for Mira
#
# Usage: ./scripts/setup_test_avatar.sh <path_to_image.png>
#
# This script creates an avatar kit and uploads the anchor image
# to Supabase Storage.

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_image.png>"
    exit 1
fi

IMAGE_PATH="$1"

if [ ! -f "$IMAGE_PATH" ]; then
    echo "Error: Image not found at $IMAGE_PATH"
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

# Generate UUIDs
KIT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
ASSET_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Character ID (Mira from seed data)
CHARACTER_ID="d4e5f6a7-b8c9-0123-def0-234567890123"
CHARACTER_NAME="Mira"
KIT_NAME="$CHARACTER_NAME Default"

echo "Creating avatar kit..."
echo "  Kit ID: $KIT_ID"
echo "  Asset ID: $ASSET_ID"
echo "  Character: $CHARACTER_NAME ($CHARACTER_ID)"

# Storage path
STORAGE_PATH="$KIT_ID/anchors/$ASSET_ID.png"

# Upload image to Supabase Storage
echo ""
echo "Uploading to Supabase Storage..."
curl -X POST "$SUPABASE_URL/storage/v1/object/avatars/$STORAGE_PATH" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary "@$IMAGE_PATH" \
  --silent --show-error

echo "Uploaded to: avatars/$STORAGE_PATH"

# Create avatar kit in database
echo ""
echo "Creating database records..."

PGPASSWORD="$DB_PASSWORD" psql "postgresql://$DB_USER@$DB_HOST:5432/postgres" <<EOF
-- Create avatar kit
INSERT INTO avatar_kits (
    id, character_id, name, description,
    appearance_prompt, style_prompt, negative_prompt,
    status, is_default
) VALUES (
    '$KIT_ID'::uuid,
    '$CHARACTER_ID'::uuid,
    '$KIT_NAME',
    'Auto-generated test kit',
    'Young woman with long black hair, side-swept bangs, blue eyes with a hint of red, fair skin, soft features. Wearing a white button-up shirt with a red bow tie ribbon, dark pleated skirt. School uniform style.',
    'High-quality anime illustration style, semi-realistic rendering, soft lighting with natural window light, detailed hair with shine highlights, slight blush on cheeks, warm color palette, professional digital art quality.',
    'Low quality, blurry, deformed, extra limbs, bad anatomy, wrong proportions, multiple people, text, watermark.'
);

-- Create avatar asset
INSERT INTO avatar_assets (
    id, avatar_kit_id, asset_type,
    storage_bucket, storage_path, source_type,
    is_canonical, mime_type
) VALUES (
    '$ASSET_ID'::uuid,
    '$KIT_ID'::uuid,
    'anchor_portrait',
    'avatars',
    '$STORAGE_PATH',
    'manual_upload',
    true,
    'image/png'
);

-- Set as primary anchor
UPDATE avatar_kits
SET primary_anchor_id = '$ASSET_ID'::uuid, updated_at = NOW()
WHERE id = '$KIT_ID'::uuid;

-- Activate kit
UPDATE avatar_kits
SET status = 'active', updated_at = NOW()
WHERE id = '$KIT_ID'::uuid;

-- Link to character
UPDATE characters
SET active_avatar_kit_id = '$KIT_ID'::uuid
WHERE id = '$CHARACTER_ID'::uuid;

-- Verify
SELECT 'Avatar Kit:' as label, ak.id, ak.name, ak.status,
       c.name as character_name, c.active_avatar_kit_id
FROM avatar_kits ak
JOIN characters c ON c.id = ak.character_id
WHERE ak.id = '$KIT_ID'::uuid;
EOF

echo ""
echo "============================================"
echo "SUCCESS!"
echo "============================================"
echo "Kit ID: $KIT_ID"
echo "Asset ID: $ASSET_ID"
echo "Storage: avatars/$STORAGE_PATH"
echo ""
echo "To test signed URL generation:"
echo "  curl -X POST '$SUPABASE_URL/storage/v1/object/sign/avatars/$STORAGE_PATH' \\"
echo "    -H 'Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"expiresIn\": 3600}'"
echo ""
echo "To test scene generation with this anchor:"
echo "  1. Start an episode with Mira"
echo "  2. POST /scenes/generate with that episode_id"
echo "  3. The scene should use FLUX Kontext for character consistency"
echo "============================================"
