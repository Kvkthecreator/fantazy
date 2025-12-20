"""Generate anchor avatars for Play Mode characters (Jack & Emma).

This script creates hero avatars for Hometown Crush characters
using FLUX image generation.

Usage:
    python -m app.scripts.generate_play_avatars

Environment variables required:
    REPLICATE_API_TOKEN - Replicate API key
    SUPABASE_URL - Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
"""

import asyncio
import json
import logging
import os
import sys
import uuid

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Set environment variables if not present (for local dev)
if not os.getenv("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = "https://lfwhdzwbikyzalpbwfnd.supabase.co"
if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmd2hkendiaWt5emFscGJ3Zm5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQzMjQ0NCwiZXhwIjoyMDgxMDA4NDQ0fQ.s2ljzY1YQkz-WTZvRa-_qzLnW1zhoL012Tn2vPOigd0"

# Rate limiting delay between generations (seconds)
GENERATION_DELAY = 5

from databases import Database
from app.services.avatar_generation import (
    FANTAZY_STYLE_LOCK,
    FANTAZY_NEGATIVE_PROMPT,
)
from app.services.image import ImageService
from app.services.storage import StorageService

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.lfwhdzwbikyzalpbwfnd:42PJb25YJhJHJdkl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
)

# Admin user ID for created_by
ADMIN_USER_ID = "82633300-3cfd-4e32-b141-046d0edd616b"

# =============================================================================
# Play Mode Character Appearance Descriptions
# Optimized for romantic tension, relatability, and shareability
# =============================================================================

PLAY_MODE_CHARACTERS = {
    "jack-hometown": {
        "name": "Jack",
        "appearance": "handsome man in his late 20s, warm brown eyes, slightly messy dark hair, strong jaw, gentle smile, casual flannel shirt over t-shirt, approachable attractive",
        "setting": "cozy coffee shop, warm morning light through windows, comfortable neighborhood vibe",
        "pose": "looking up from coffee with surprised recognition, slight hopeful smile forming, eyes holding unspoken history",
        "mood": "nostalgic warmth, second chance energy, familiar yet changed",
    },
    "emma-hometown": {
        "name": "Emma",
        "appearance": "beautiful woman in her late 20s, striking green eyes, wavy auburn hair, soft features, natural makeup, cozy sweater, effortlessly stylish",
        "setting": "cozy coffee shop, warm morning light through windows, comfortable neighborhood vibe",
        "pose": "looking up with recognition and guarded hope, coffee cup in hands, eyes searching yours",
        "mood": "vulnerability beneath composure, the one who got away energy, walls softening",
    },
}


def build_play_mode_prompt(char_data: dict) -> tuple[str, str]:
    """Build optimized prompt for Play Mode character avatar."""

    # Appearance + pose
    appearance_parts = [
        f"portrait of {char_data['name']}",
        char_data["appearance"],
        char_data["pose"],
    ]

    # Setting and mood
    composition_parts = [
        "upper body portrait, medium close-up shot",
        char_data["setting"],
        char_data["mood"],
        "flattering soft key light, gentle fill, warm tones",
        "cinematic romantic lighting",
    ]

    full_prompt = f"{', '.join(appearance_parts)}, {', '.join(composition_parts)}, {FANTAZY_STYLE_LOCK}"

    # Enhanced negative for romantic context
    negative_prompt = f"{FANTAZY_NEGATIVE_PROMPT}, cold lighting, harsh shadows, unfriendly expression"

    return full_prompt, negative_prompt


async def generate_avatars():
    """Generate anchor avatars for Play Mode characters."""
    db = Database(DATABASE_URL)
    await db.connect()
    storage = StorageService.get_instance()

    try:
        # Get Play Mode characters without avatars
        rows = await db.fetch_all("""
            SELECT id, name, slug
            FROM characters
            WHERE slug IN ('jack-hometown', 'emma-hometown')
              AND (avatar_url IS NULL OR avatar_url = '')
            ORDER BY name
        """)

        print(f"\n{'='*60}")
        print("GENERATING PLAY MODE AVATARS")
        print(f"{'='*60}")
        print(f"Found {len(rows)} characters needing avatars\n")

        if not rows:
            print("All Play Mode characters already have avatars!")
            return

        # Initialize image service (FLUX Pro)
        image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

        for i, row in enumerate(rows):
            char_dict = dict(row)
            slug = char_dict["slug"]
            char_id = char_dict["id"]
            name = char_dict["name"]

            if slug not in PLAY_MODE_CHARACTERS:
                print(f"Skipping {name}: no appearance description")
                continue

            char_data = PLAY_MODE_CHARACTERS[slug]
            prompt, negative = build_play_mode_prompt(char_data)

            print(f"\n[{i+1}/{len(rows)}] Generating avatar for {name}...")
            print(f"  Prompt: {prompt[:100]}...")

            try:
                # Generate image
                response = await image_service.generate(
                    prompt=prompt,
                    negative_prompt=negative,
                    width=1024,
                    height=1024,
                )

                if not response.images:
                    print(f"  ERROR: No images returned")
                    continue

                image_bytes = response.images[0]
                print(f"  Generated {len(image_bytes)} bytes in {response.latency_ms}ms")

                # Create avatar kit
                kit_id = uuid.uuid4()
                await db.execute(
                    """INSERT INTO avatar_kits (
                        id, character_id, created_by, name,
                        appearance_prompt, style_prompt, negative_prompt,
                        status, is_default
                    ) VALUES (
                        :id, :character_id, :created_by, :name,
                        :appearance_prompt, :style_prompt, :negative_prompt,
                        'active', TRUE
                    )""",
                    {
                        "id": str(kit_id),
                        "character_id": str(char_id),
                        "created_by": ADMIN_USER_ID,
                        "name": f"{name}'s Avatar Kit",
                        "appearance_prompt": prompt[:1000],
                        "style_prompt": FANTAZY_STYLE_LOCK,
                        "negative_prompt": negative,
                    }
                )

                # Upload to storage
                asset_id = uuid.uuid4()
                storage_path = await storage.upload_avatar_asset(
                    image_bytes=image_bytes,
                    kit_id=kit_id,
                    asset_id=asset_id,
                    asset_type="portrait",
                )
                print(f"  Uploaded to: {storage_path}")

                # Create asset record
                await db.execute(
                    """INSERT INTO avatar_assets (
                        id, avatar_kit_id, asset_type, expression,
                        storage_bucket, storage_path, source_type,
                        generation_metadata, is_canonical, is_active,
                        mime_type, file_size_bytes
                    ) VALUES (
                        :id, :kit_id, 'portrait', 'default',
                        'avatars', :storage_path, 'ai_generated',
                        :metadata, TRUE, TRUE,
                        'image/png', :file_size
                    )""",
                    {
                        "id": str(asset_id),
                        "kit_id": str(kit_id),
                        "storage_path": storage_path,
                        "metadata": json.dumps({"prompt": prompt[:500], "model": response.model}),
                        "file_size": len(image_bytes),
                    }
                )

                # Get public URL and update character
                image_url = await storage.create_signed_url("avatars", storage_path)

                # Update kit with primary anchor
                await db.execute(
                    "UPDATE avatar_kits SET primary_anchor_id = :asset_id WHERE id = :kit_id",
                    {"asset_id": str(asset_id), "kit_id": str(kit_id)}
                )

                # Update character with avatar URL and kit
                await db.execute(
                    """UPDATE characters
                       SET avatar_url = :avatar_url,
                           active_avatar_kit_id = :kit_id,
                           updated_at = NOW()
                       WHERE id = :id""",
                    {"avatar_url": image_url, "kit_id": str(kit_id), "id": str(char_id)}
                )

                print(f"  SUCCESS: Avatar created for {name}")
                print(f"  URL: {image_url[:80]}...")

                # Rate limiting
                if i < len(rows) - 1:
                    print(f"  Waiting {GENERATION_DELAY}s before next generation...")
                    await asyncio.sleep(GENERATION_DELAY)

            except Exception as e:
                print(f"  ERROR generating avatar for {name}: {e}")
                continue

        print(f"\n{'='*60}")
        print("AVATAR GENERATION COMPLETE")
        print(f"{'='*60}\n")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(generate_avatars())
