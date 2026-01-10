"""Generate anchor avatars for new genre characters (Cozy, BL, GL, Historical, Psychological, Workplace).

This script creates hero avatars (anchor_portrait) for the 6 new genre characters
using FLUX image generation.

Usage:
    python -m app.scripts.generate_new_genres_avatars

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
from typing import Optional

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Set environment variables if not present (for local dev)
if not os.getenv("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = "https://lfwhdzwbikyzalpbwfnd.supabase.co"
if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmd2hkendiaWt5emFscGJ3Zm5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQzMjQ0NCwiZXhwIjoyMDgxMDA4NDQ0fQ.s2ljzY1YQkz-WTZvRa-_qzLnW1zhoL012Tn2vPOigd0"
# Replicate API token must be set in environment
# export REPLICATE_API_TOKEN="your_token_here"

# Rate limiting delay between generations (seconds)
GENERATION_DELAY = 5

from databases import Database
from app.services.avatar_generation import (
    assemble_avatar_prompt,
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

# Character slugs for the 6 new genres
NEW_GENRE_CHARACTERS = [
    "hana-cafe",      # Cozy
    "jae-artist",     # BL
    "yuna-rival",     # GL
    "lord-ashworth",  # Historical
    "dr-seong",       # Psychological
    "daniel-park",    # Workplace
]


async def generate_avatars():
    """Generate anchor avatars for new genre characters."""
    db = Database(DATABASE_URL)
    await db.connect()
    storage = StorageService.get_instance()

    try:
        # Get all new genre characters
        slug_list = "','".join(NEW_GENRE_CHARACTERS)
        rows = await db.fetch_all(f"""
            SELECT
                c.id, c.name, c.slug, c.archetype, c.boundaries,
                ak.id as kit_id, ak.appearance_prompt, ak.style_prompt, ak.negative_prompt
            FROM characters c
            LEFT JOIN avatar_kits ak ON ak.character_id = c.id AND ak.is_default = true
            WHERE c.slug IN ('{slug_list}')
            ORDER BY c.name
        """)

        print(f"\n{'='*60}")
        print("GENERATING NEW GENRE ANCHOR AVATARS")
        print(f"{'='*60}")
        print(f"Found {len(rows)} characters\n")

        if not rows:
            print("No characters found!")
            return

        # Initialize image service (FLUX Pro for initial generation)
        image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

        success_count = 0
        fail_count = 0

        for row in rows:
            char = dict(row)
            char_id = char["id"]
            name = char["name"]
            slug = char["slug"]
            archetype = char["archetype"]
            kit_id = char.get("kit_id")

            print(f"Generating avatar for {name} ({archetype})...")

            # Parse boundaries
            boundaries = char.get("boundaries", {})
            if isinstance(boundaries, str):
                boundaries = json.loads(boundaries)

            # Use custom prompts from avatar kit if they exist
            appearance_prompt = char.get("appearance_prompt", "")
            style_prompt = char.get("style_prompt", "")
            negative_prompt = char.get("negative_prompt", FANTAZY_NEGATIVE_PROMPT)

            try:
                # Build full prompt using kit prompts
                if appearance_prompt and style_prompt:
                    # Use the pre-defined prompts from scaffold script
                    full_prompt = f"{appearance_prompt}, {style_prompt}, {FANTAZY_STYLE_LOCK}"
                else:
                    # Fallback to automatic assembly
                    prompt_assembly = assemble_avatar_prompt(
                        name=name,
                        archetype=archetype,
                        role_frame=archetype,
                        boundaries=boundaries,
                        content_rating="sfw",
                    )
                    full_prompt = prompt_assembly.full_prompt
                    negative_prompt = prompt_assembly.negative_prompt

                log.info(f"Prompt for {name}: {full_prompt[:200]}...")

                # Generate image
                response = await image_service.generate(
                    prompt=full_prompt,
                    negative_prompt=negative_prompt,
                    width=1024,
                    height=1024,
                )

                if not response.images:
                    print(f"  ✗ No images returned for {name}")
                    fail_count += 1
                    continue

                image_bytes = response.images[0]

                # Create asset ID first
                asset_id = str(uuid.uuid4())

                # Upload to storage using upload_avatar_asset method
                log.info(f"Uploading avatar asset for {name}...")

                storage_path = await storage.upload_avatar_asset(
                    image_bytes=image_bytes,
                    kit_id=kit_id,
                    asset_id=asset_id,
                    asset_type="anchor_portrait",  # This maps to 'anchors' folder
                    content_type="image/webp",
                )

                log.info(f"Uploaded to {storage_path}")

                # Create avatar_asset record in database
                await db.execute("""
                    INSERT INTO avatar_assets (
                        id, avatar_kit_id, asset_type, storage_bucket, storage_path,
                        source_type, generation_metadata, is_canonical, is_active
                    ) VALUES (
                        :id, :kit_id, 'portrait', 'avatars', :storage_path,
                        'ai_generated', :metadata, true, true
                    )
                """, {
                    "id": asset_id,
                    "kit_id": kit_id,
                    "storage_path": storage_path,
                    "metadata": json.dumps({"prompt": full_prompt, "model": "flux-1.1-pro"}),
                })

                # Update avatar_kit with primary anchor
                await db.execute("""
                    UPDATE avatar_kits
                    SET primary_anchor_id = :asset_id,
                        status = 'active',
                        updated_at = NOW()
                    WHERE id = :kit_id
                """, {"asset_id": asset_id, "kit_id": kit_id})

                print(f"  ✓ Generated anchor avatar for {name}")
                success_count += 1

                # Rate limiting
                if success_count < len(rows):
                    await asyncio.sleep(GENERATION_DELAY)

            except Exception as e:
                log.error(f"Failed to generate avatar for {name}: {e}")
                print(f"  ✗ Error: {e}")
                fail_count += 1
                continue

        print(f"\n{'='*60}")
        print("GENERATION COMPLETE")
        print(f"{'='*60}")
        print(f"Success: {success_count}")
        print(f"Failed: {fail_count}")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(generate_avatars())
