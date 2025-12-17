"""Generate anchor avatar for Soo-ah (K-World wounded_star).

Usage:
    cd substrate-api/api/src
    python -m app.scripts.generate_sooah_avatar
"""

import asyncio
import json
import logging
import os
import sys
import uuid

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Load .env file if exists
from dotenv import load_dotenv
load_dotenv()

from databases import Database
from app.services.avatar_generation import assemble_avatar_prompt
from app.services.image import ImageService
from app.services.storage import StorageService

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
ADMIN_USER_ID = "82633300-3cfd-4e32-b141-046d0edd616b"

# Soo-ah appearance based on K-World wounded_star archetype
SOOAH_APPEARANCE = """
Korean woman in her mid-20s, stunningly beautiful but understated,
warm brown eyes that reveal hidden vulnerability, natural makeup,
soft wavy black hair slightly disheveled, delicate features,
tired but radiant, wearing casual oversized sweater, quiet elegance
""".strip().replace('\n', ' ')


async def generate_sooah_avatar():
    """Generate anchor avatar for Soo-ah."""
    db = Database(DATABASE_URL)
    await db.connect()
    storage = StorageService.get_instance()

    try:
        # Get Soo-ah
        row = await db.fetch_one("""
            SELECT id, name, slug, archetype, boundaries, active_avatar_kit_id
            FROM characters
            WHERE name = 'Soo-ah'
        """)

        if not row:
            print("Soo-ah not found!")
            return

        char = dict(row)
        char_id = char["id"]
        name = char["name"]
        archetype = char["archetype"]

        if char.get("active_avatar_kit_id"):
            print(f"Soo-ah already has an avatar kit: {char['active_avatar_kit_id']}")
            print("Continuing to generate new portrait anyway...")

        print(f"\n{'='*60}")
        print(f"GENERATING AVATAR FOR SOO-AH")
        print(f"{'='*60}")
        print(f"Archetype: {archetype}")
        print(f"Character ID: {char_id}\n")

        # Parse boundaries
        boundaries = char.get("boundaries", {})
        if isinstance(boundaries, str):
            boundaries = json.loads(boundaries)

        # Assemble prompt with K-World visual doctrine
        prompt_assembly = assemble_avatar_prompt(
            name=name,
            archetype=archetype,
            role_frame=archetype,  # wounded_star
            boundaries=boundaries,
            content_rating="sfw",
            custom_appearance=SOOAH_APPEARANCE,
        )

        print("Generated prompt:")
        print("-" * 40)
        print(prompt_assembly.full_prompt)
        print("-" * 40)
        print(f"\nNegative: {prompt_assembly.negative_prompt[:100]}...")

        # Initialize FLUX Pro
        image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

        print("\nGenerating image via FLUX Pro...")
        response = await image_service.generate(
            prompt=prompt_assembly.full_prompt,
            negative_prompt=prompt_assembly.negative_prompt,
            width=1024,
            height=1024,
        )

        if not response.images:
            print("ERROR: No images returned!")
            return

        image_bytes = response.images[0]
        print(f"Image generated! ({response.latency_ms}ms, {len(image_bytes)} bytes)")

        # Create or update avatar kit
        kit_id = char.get("active_avatar_kit_id") or uuid.uuid4()

        if not char.get("active_avatar_kit_id"):
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
                    "appearance_prompt": prompt_assembly.appearance_prompt,
                    "style_prompt": prompt_assembly.style_prompt,
                    "negative_prompt": prompt_assembly.negative_prompt,
                }
            )
            print(f"Created avatar kit: {kit_id}")

        # Upload to storage
        asset_id = uuid.uuid4()
        storage_path = await storage.upload_avatar_asset(
            image_bytes=image_bytes,
            kit_id=kit_id,
            asset_id=asset_id,
            asset_type="portrait",  # Valid: portrait, fullbody, scene
        )
        print(f"Uploaded to storage: {storage_path}")

        # Create asset record
        await db.execute(
            """INSERT INTO avatar_assets (
                id, avatar_kit_id, asset_type,
                storage_bucket, storage_path, source_type,
                generation_metadata, is_canonical, is_active,
                mime_type, file_size_bytes
            ) VALUES (
                :id, :kit_id, 'portrait',
                'avatars', :storage_path, 'ai_generated',
                :metadata, TRUE, TRUE,
                'image/png', :file_size
            )""",
            {
                "id": str(asset_id),
                "kit_id": str(kit_id),
                "storage_path": storage_path,
                "metadata": json.dumps({
                    "prompt": prompt_assembly.full_prompt[:500],
                    "model": response.model,
                }),
                "file_size": len(image_bytes),
            }
        )

        # Set as primary anchor
        await db.execute(
            """UPDATE avatar_kits
               SET primary_anchor_id = :asset_id, updated_at = NOW()
               WHERE id = :kit_id""",
            {"asset_id": str(asset_id), "kit_id": str(kit_id)}
        )

        # Update character with public URL (avatars bucket is public)
        image_url = f"https://lfwhdzwbikyzalpbwfnd.supabase.co/storage/v1/object/public/avatars/{storage_path}"
        await db.execute(
            """UPDATE characters
               SET avatar_url = :avatar_url,
                   active_avatar_kit_id = :kit_id,
                   updated_at = NOW()
               WHERE id = :id""",
            {
                "avatar_url": image_url,
                "kit_id": str(kit_id),
                "id": str(char_id),
            }
        )

        print(f"\n{'='*60}")
        print("SUCCESS!")
        print(f"{'='*60}")
        print(f"Avatar URL: {image_url[:80]}...")
        print(f"Kit ID: {kit_id}")
        print(f"Asset ID: {asset_id}")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(generate_sooah_avatar())
