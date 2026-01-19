"""Generate images for The Interview series.

This script generates:
1. Morgan Chen's character avatar (professional corporate style)
2. Series cover image
3. Episode background images (3 episodes)

Usage:
    cd substrate-api/api/src
    REPLICATE_API_TOKEN='...' python -m app.scripts.generate_the_interview_images
    REPLICATE_API_TOKEN='...' python -m app.scripts.generate_the_interview_images --avatar-only
    REPLICATE_API_TOKEN='...' python -m app.scripts.generate_the_interview_images --backgrounds-only
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
# The Interview Style Constants
# Modern corporate professional aesthetic
# =============================================================================

INTERVIEW_STYLE = "professional corporate photography, modern office aesthetic, soft natural lighting, shallow depth of field"
INTERVIEW_QUALITY = "masterpiece, best quality, cinematic, high resolution, realistic detail"
INTERVIEW_NEGATIVE = "anime, cartoon, 3D render, unrealistic, distorted, multiple people, text, watermark, cluttered, messy"

# Morgan Chen's appearance for avatar generation
MORGAN_APPEARANCE = """Asian American woman mid-30s, sharp intelligent eyes, professional approachable expression,
dark hair in neat low bun, minimal elegant makeup, wearing slate gray blazer over cream blouse,
small pearl earrings, modern minimalist office background with soft natural window light,
confident accomplished professional, warm but discerning expression"""

MORGAN_STYLE = """professional corporate portrait photography, modern tech office setting,
soft diffused window light, shallow depth of field with blurred glass office walls,
LinkedIn professional headshot quality, warm neutral color palette, clean composed framing"""

# Series cover prompt - modern interview/office setting
SERIES_COVER_PROMPT = """modern corporate conference room, glass walls, city skyline visible through windows,
empty chair across elegant table, notepad and pen ready, soft morning light streaming in,
professional interview setting atmosphere, minimalist design, tension and opportunity feeling,
masterpiece, best quality, cinematic photography, shallow depth of field"""

SERIES_COVER_NEGATIVE = """anime, cartoon, 3D render, cluttered, messy, people visible,
text, watermark, blurry, low quality, harsh lighting, dark"""

# Episode background prompts
EPISODE_BACKGROUNDS = {
    "The Phone Screen": {
        "prompt": """cozy modern apartment home office corner, laptop open on desk with notepad beside it,
soft morning light through window, coffee cup nearby, comfortable professional setting,
preparing for important call atmosphere, clean minimalist decor, warm inviting colors,
masterpiece, best quality, cinematic photography, shallow depth of field""",
        "negative": INTERVIEW_NEGATIVE,
    },
    "The Panel": {
        "prompt": """modern corporate conference room, glass walls with frosted panels, polished table,
professional notepad and water glass, city view through windows, natural lighting,
high-stakes interview atmosphere, sleek minimalist tech office design,
masterpiece, best quality, cinematic photography, shallow depth of field""",
        "negative": INTERVIEW_NEGATIVE,
    },
    "The Offer": {
        "prompt": """modern home office or apartment, laptop screen glowing softly, sunset light through window,
moment of decision atmosphere, offer letter visible on screen glow, contemplative mood,
career crossroads feeling, warm golden hour lighting, hopeful tension,
masterpiece, best quality, cinematic photography, shallow depth of field""",
        "negative": INTERVIEW_NEGATIVE,
    },
}


async def generate_avatar(db: Database, storage: StorageService, image_service: ImageService):
    """Generate Morgan Chen's avatar."""
    print("\n" + "=" * 60)
    print("GENERATING MORGAN CHEN AVATAR")
    print("=" * 60)

    # Get Morgan's character and kit
    char = await db.fetch_one(
        "SELECT id, name, active_avatar_kit_id, avatar_url FROM characters WHERE slug = 'morgan-chen'"
    )
    if not char:
        print("ERROR: Morgan Chen character not found! Run scaffold_the_interview.py first.")
        return False

    kit_id = char["active_avatar_kit_id"]
    if not kit_id:
        print("ERROR: No avatar kit found for Morgan Chen!")
        return False

    # Check if already has an avatar
    if char["avatar_url"]:
        print(f"Morgan Chen already has an avatar: {char['avatar_url'][:80]}...")
        print("Skipping avatar generation.")
        return True

    try:
        # Build the prompt
        full_prompt = f"{MORGAN_APPEARANCE}, {MORGAN_STYLE}, {INTERVIEW_QUALITY}"
        negative_prompt = INTERVIEW_NEGATIVE

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
                    "series": "the-interview",
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
    """Generate The Interview series cover."""
    print("\n" + "=" * 60)
    print("GENERATING SERIES COVER")
    print("=" * 60)

    # Get series
    series = await db.fetch_one(
        "SELECT id, title, cover_image_url FROM series WHERE slug = 'the-interview'"
    )
    if not series:
        print("ERROR: Series not found! Run scaffold_the_interview.py first.")
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

        # Update series with public URL
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
        "SELECT id FROM series WHERE slug = 'the-interview'"
    )
    if not series:
        print("ERROR: Series not found! Run scaffold_the_interview.py first.")
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
            negative = config["negative"]
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

            # Update episode with public URL
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
        "UPDATE characters SET status = 'active' WHERE slug = 'morgan-chen'"
    )
    print("  ✓ Morgan Chen character activated")

    # Activate series
    await db.execute(
        "UPDATE series SET status = 'active' WHERE slug = 'the-interview'"
    )
    print("  ✓ The Interview series activated")

    # Activate episodes
    await db.execute(
        """UPDATE episode_templates SET status = 'active'
           WHERE series_id = (SELECT id FROM series WHERE slug = 'the-interview')"""
    )
    print("  ✓ Episodes activated")


async def main(avatar_only: bool = False, backgrounds_only: bool = False, cover_only: bool = False, skip_activation: bool = False):
    """Main generation function."""
    print("=" * 60)
    print("THE INTERVIEW IMAGE GENERATION")
    print("=" * 60)
    print("Style: Modern corporate professional aesthetic")
    print("ADR-008: User Objectives System showcase series")

    db = Database(DATABASE_URL)
    await db.connect()
    storage = StorageService.get_instance()
    image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

    try:
        if avatar_only:
            await generate_avatar(db, storage, image_service)
        elif backgrounds_only:
            await generate_episode_backgrounds(db, storage, image_service)
        elif cover_only:
            await generate_series_cover(db, storage, image_service)
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
    parser = argparse.ArgumentParser(description="Generate The Interview images")
    parser.add_argument("--avatar-only", action="store_true", help="Only generate avatar")
    parser.add_argument("--backgrounds-only", action="store_true", help="Only generate backgrounds")
    parser.add_argument("--cover-only", action="store_true", help="Only generate series cover")
    parser.add_argument("--skip-activation", action="store_true", help="Don't activate content after generation")
    args = parser.parse_args()

    asyncio.run(main(
        avatar_only=args.avatar_only,
        backgrounds_only=args.backgrounds_only,
        cover_only=args.cover_only,
        skip_activation=args.skip_activation,
    ))
