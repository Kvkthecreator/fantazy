"""Generate images for The Last Message series.

This script generates:
1. Daniel's character avatar (noir mystery style)
2. Series cover image
3. Episode background images (4 episodes)

Usage:
    python -m app.scripts.generate_the_last_message_images
    python -m app.scripts.generate_the_last_message_images --avatar-only
    python -m app.scripts.generate_the_last_message_images --backgrounds-only

Environment variables required:
    REPLICATE_API_TOKEN - Replicate API key
"""

import asyncio
import json
import logging
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Set environment variables if not present (for local dev)
if not os.getenv("SUPABASE_URL"):
    os.environ["SUPABASE_URL"] = "https://lfwhdzwbikyzalpbwfnd.supabase.co"
if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmd2hkendiaWt5emFscGJ3Zm5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQzMjQ0NCwiZXhwIjoyMDgxMDA4NDQ0fQ.s2ljzY1YQkz-WTZvRa-_qzLnW1zhoL012Tn2vPOigd0"

from databases import Database
from app.services.image import ImageService
from app.services.storage import StorageService

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.lfwhdzwbikyzalpbwfnd:42PJb25YJhJHJdkl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
)

# Rate limiting
GENERATION_DELAY = 5

# =============================================================================
# NOIR MYSTERY STYLE CONSTANTS
# =============================================================================

NOIR_STYLE = "cinematic noir photography, moody lighting, high contrast shadows, desaturated colors, film grain"
NOIR_QUALITY = "masterpiece, best quality, highly detailed, dramatic lighting, atmospheric"
NOIR_NEGATIVE = "anime, cartoon, bright colors, cheerful, sunny, low quality, blurry, text, watermark, multiple people"

# Daniel's appearance for avatar generation
DANIEL_APPEARANCE = """young asian american man mid-20s, clean cut professional appearance, slightly disheveled from stress,
dark circles under eyes, wearing rumpled button-down shirt with sleeves rolled up, anxious but trying to appear calm,
sharp features, short black hair, looking directly at viewer with guarded expression"""

DANIEL_STYLE = """cinematic portrait photography, dramatic shadows, moody lighting, desaturated color grade,
film noir aesthetic, tension visible in body language, shallow depth of field, single subject portrait,
high contrast, atmospheric"""

# Series cover prompt
SERIES_COVER_PROMPT = """cinematic noir photography, moody coffee shop interior at dusk, rain-streaked windows,
single empty booth with two untouched coffee cups, envelope on table, dramatic shadows,
mysterious atmosphere, high contrast lighting, film grain, desaturated blue-gray tones,
no people visible, sense of something just happened, thriller aesthetic,
masterpiece, best quality, atmospheric tension"""

SERIES_COVER_NEGATIVE = """anime, cartoon, bright colors, cheerful, sunny, low quality, blurry,
text, watermark, people, faces, portraits, bad composition"""

# Episode background configurations
EPISODE_BACKGROUNDS = {
    "First Contact": {
        "prompt": """cinematic noir photography, dim coffee shop interior, rain-streaked windows,
back corner booth with worn leather seats, dramatic afternoon shadows, moody lighting,
empty coffee cups on table, desaturated blue-gray tones, film grain, atmospheric tension,
no people, sense of clandestine meeting, thriller aesthetic""",
        "negative": NOIR_NEGATIVE,
    },
    "The Cracks": {
        "prompt": """cinematic noir photography, modern apartment interior, too-clean surfaces,
afternoon light through venetian blinds casting stripe shadows, woman's sweater on couch,
coffee mug on table, sterile atmosphere with personal items, something was erased here,
desaturated tones, film grain, thriller aesthetic, no people""",
        "negative": NOIR_NEGATIVE,
    },
    "The Trade": {
        "prompt": """cinematic noir photography, underground parking garage at night,
flickering fluorescent lights, concrete pillars casting deep shadows,
empty parking spaces, security camera with cut wires, claustrophobic atmosphere,
cold industrial lighting, film grain, paranoid thriller aesthetic, no people""",
        "negative": NOIR_NEGATIVE,
    },
    "The Truth": {
        "prompt": """cinematic noir photography, train station security office at night,
multiple monitors showing platform footage, harsh fluorescent light,
view of empty platform through window, scattered papers and coffee cups,
10:47pm on digital clock, revelation atmosphere, film grain, thriller aesthetic, no people""",
        "negative": NOIR_NEGATIVE,
    },
}


async def generate_avatar(db: Database, storage: StorageService, image_service: ImageService):
    """Generate Daniel's noir avatar."""
    print("\n" + "=" * 60)
    print("GENERATING DANIEL AVATAR")
    print("=" * 60)

    # Get Daniel's character and kit
    char = await db.fetch_one(
        "SELECT id, name, active_avatar_kit_id, avatar_url FROM characters WHERE slug = 'daniel'"
    )
    if not char:
        print("ERROR: Daniel character not found! Run scaffold_the_last_message.py first.")
        return False

    kit_id = char["active_avatar_kit_id"]
    if not kit_id:
        print("ERROR: No avatar kit found for Daniel!")
        return False

    # Check if already has an avatar
    if char["avatar_url"]:
        print(f"Daniel already has an avatar: {char['avatar_url'][:80]}...")
        print("Skipping avatar generation.")
        return True

    try:
        # Build the prompt
        full_prompt = f"{DANIEL_APPEARANCE}, {DANIEL_STYLE}, {NOIR_QUALITY}"
        negative_prompt = NOIR_NEGATIVE

        print(f"Generating with prompt: {full_prompt[:150]}...")

        # Generate image
        response = await image_service.generate(
            prompt=full_prompt,
            negative_prompt=negative_prompt,
            width=1024,
            height=1024,
        )

        if not response.images:
            print("ERROR: No images returned!")
            return False

        image_bytes = response.images[0]

        # Upload to storage
        asset_id = uuid.uuid4()
        storage_path = await storage.upload_avatar_asset(
            image_bytes=image_bytes,
            kit_id=uuid.UUID(str(kit_id)),
            asset_id=asset_id,
            asset_type="anchor_portrait",
        )

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
                "metadata": json.dumps({
                    "prompt": full_prompt[:500],
                    "model": response.model,
                    "series": "the-last-message",
                }),
                "file_size": len(image_bytes),
            }
        )

        # Set as primary anchor
        await db.execute(
            """UPDATE avatar_kits
               SET primary_anchor_id = :asset_id, status = 'active', updated_at = NOW()
               WHERE id = :kit_id""",
            {"asset_id": str(asset_id), "kit_id": str(kit_id)}
        )

        # Update character avatar URL
        image_url = storage.get_public_url("avatars", storage_path)
        await db.execute(
            """UPDATE characters
               SET avatar_url = :avatar_url, updated_at = NOW()
               WHERE id = :id""",
            {"avatar_url": image_url, "id": str(char["id"])}
        )

        print(f"✓ Avatar generated successfully! ({response.latency_ms}ms)")
        print(f"  Storage path: {storage_path}")
        return True

    except Exception as e:
        print(f"✗ Failed to generate avatar: {e}")
        log.exception("Avatar generation failed")
        return False


async def generate_series_cover(db: Database, storage: StorageService, image_service: ImageService):
    """Generate The Last Message series cover."""
    print("\n" + "=" * 60)
    print("GENERATING SERIES COVER")
    print("=" * 60)

    # Get series
    series = await db.fetch_one(
        "SELECT id, title, cover_image_url FROM series WHERE slug = 'the-last-message'"
    )
    if not series:
        print("ERROR: Series not found! Run scaffold_the_last_message.py first.")
        return False

    if series["cover_image_url"]:
        print(f"Series already has cover: {series['cover_image_url'][:80]}...")
        print("Skipping cover generation.")
        return True

    try:
        print(f"Generating cover for: {series['title']}")
        print(f"Prompt: {SERIES_COVER_PROMPT[:150]}...")

        # Generate 16:9 landscape cover
        response = await image_service.generate(
            prompt=SERIES_COVER_PROMPT,
            negative_prompt=SERIES_COVER_NEGATIVE,
            width=1024,
            height=576,  # 16:9 aspect ratio
        )

        if not response.images:
            print("ERROR: No images returned!")
            return False

        image_bytes = response.images[0]

        # Upload to storage
        series_id = series["id"]
        storage_path = f"series/{series_id}/cover.png"

        await storage._upload(
            bucket="scenes",
            path=storage_path,
            data=image_bytes,
            content_type="image/png",
        )

        # Update series with permanent public URL
        cover_url = storage.get_public_url("scenes", storage_path)
        await db.execute(
            """UPDATE series SET cover_image_url = :url, updated_at = NOW() WHERE id = :id""",
            {"url": cover_url, "id": str(series_id)}
        )

        print(f"✓ Series cover generated! ({response.latency_ms}ms)")
        print(f"  Storage path: {storage_path}")
        return True

    except Exception as e:
        print(f"✗ Failed to generate cover: {e}")
        log.exception("Cover generation failed")
        return False


async def generate_episode_backgrounds(db: Database, storage: StorageService, image_service: ImageService):
    """Generate background images for all episodes."""
    print("\n" + "=" * 60)
    print("GENERATING EPISODE BACKGROUNDS")
    print("=" * 60)

    # Get all episodes for the series
    series = await db.fetch_one(
        "SELECT id FROM series WHERE slug = 'the-last-message'"
    )
    if not series:
        print("ERROR: Series not found!")
        return False

    episodes = await db.fetch_all(
        """SELECT id, title, episode_number, background_image_url
           FROM episode_templates
           WHERE series_id = :series_id
           ORDER BY episode_number""",
        {"series_id": str(series["id"])}
    )

    print(f"Found {len(episodes)} episodes")

    success_count = 0
    skip_count = 0
    fail_count = 0

    for ep in episodes:
        title = ep["title"]
        ep_id = ep["id"]
        ep_num = ep["episode_number"]

        if ep["background_image_url"]:
            print(f"  Ep {ep_num} ({title}): already has background, skipping")
            skip_count += 1
            continue

        # Get config from our background configs
        config = EPISODE_BACKGROUNDS.get(title)
        if not config:
            print(f"  Ep {ep_num} ({title}): no config found, skipping")
            fail_count += 1
            continue

        try:
            prompt = config["prompt"]
            negative = config.get("negative", NOIR_NEGATIVE)

            print(f"  Generating Ep {ep_num}: {title}")
            print(f"    Prompt: {prompt[:100]}...")

            # Generate 9:16 portrait background
            response = await image_service.generate(
                prompt=prompt,
                negative_prompt=negative,
                width=576,
                height=1024,  # 9:16 aspect ratio
            )

            if not response.images:
                print(f"    ✗ No images returned")
                fail_count += 1
                continue

            image_bytes = response.images[0]

            # Upload to storage
            storage_path = f"episodes/{ep_id}/background.png"
            await storage._upload(
                bucket="scenes",
                path=storage_path,
                data=image_bytes,
                content_type="image/png",
            )

            # Update episode with permanent public URL
            bg_url = storage.get_public_url("scenes", storage_path)
            await db.execute(
                """UPDATE episode_templates SET background_image_url = :url, updated_at = NOW() WHERE id = :id""",
                {"url": bg_url, "id": str(ep_id)}
            )

            print(f"    ✓ Generated ({response.latency_ms}ms)")
            success_count += 1

            # Rate limiting
            if ep != episodes[-1]:
                print(f"    (waiting {GENERATION_DELAY}s...)")
                await asyncio.sleep(GENERATION_DELAY)

        except Exception as e:
            print(f"    ✗ Failed: {e}")
            log.exception(f"Background generation failed for {title}")
            fail_count += 1

    print(f"\nBackground generation complete:")
    print(f"  Success: {success_count}")
    print(f"  Skipped: {skip_count}")
    print(f"  Failed: {fail_count}")

    return fail_count == 0


async def activate_content(db: Database):
    """Activate the character, series, and episodes."""
    print("\n" + "=" * 60)
    print("ACTIVATING CONTENT")
    print("=" * 60)

    # Activate character
    await db.execute(
        "UPDATE characters SET status = 'active' WHERE slug = 'daniel'"
    )
    print("  ✓ Daniel character activated")

    # Activate series
    await db.execute(
        "UPDATE series SET status = 'active' WHERE slug = 'the-last-message'"
    )
    print("  ✓ The Last Message series activated")

    # Activate episodes
    await db.execute(
        """UPDATE episode_templates SET status = 'active'
           WHERE series_id = (SELECT id FROM series WHERE slug = 'the-last-message')"""
    )
    print("  ✓ Episodes activated")


async def main(avatar_only: bool = False, backgrounds_only: bool = False, skip_activation: bool = False):
    """Main generation function."""
    print("=" * 60)
    print("THE LAST MESSAGE - IMAGE GENERATION")
    print("=" * 60)

    db = Database(DATABASE_URL)
    await db.connect()
    storage = StorageService.get_instance()
    image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

    try:
        if avatar_only:
            await generate_avatar(db, storage, image_service)
        elif backgrounds_only:
            await generate_episode_backgrounds(db, storage, image_service)
        else:
            # Generate everything
            await generate_avatar(db, storage, image_service)
            await asyncio.sleep(GENERATION_DELAY)

            await generate_series_cover(db, storage, image_service)
            await asyncio.sleep(GENERATION_DELAY)

            await generate_episode_backgrounds(db, storage, image_service)

            if not skip_activation:
                await activate_content(db)

        print("\n" + "=" * 60)
        print("GENERATION COMPLETE")
        print("=" * 60)

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate The Last Message images")
    parser.add_argument("--avatar-only", action="store_true", help="Only generate avatar")
    parser.add_argument("--backgrounds-only", action="store_true", help="Only generate backgrounds")
    parser.add_argument("--skip-activation", action="store_true", help="Don't activate content after generation")
    args = parser.parse_args()

    asyncio.run(main(
        avatar_only=args.avatar_only,
        backgrounds_only=args.backgrounds_only,
        skip_activation=args.skip_activation,
    ))
