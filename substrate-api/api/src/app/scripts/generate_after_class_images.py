"""Generate images for After Class series.

Yuna - Graduate TA with forbidden office hours tension.
Uses the hardened MANHWA_STYLE_LOCK for consistent BabeChat-competitive visuals.

This script generates:
1. Yuna's character avatar (manhwa style - graduate TA)
2. Series cover image (manhwa style)
3. Episode background images (5 episodes - manhwa style)

Usage:
    cd substrate-api/api/src
    REPLICATE_API_TOKEN='...' python -m app.scripts.generate_after_class_images
    REPLICATE_API_TOKEN='...' python -m app.scripts.generate_after_class_images --avatar-only
    REPLICATE_API_TOKEN='...' python -m app.scripts.generate_after_class_images --backgrounds-only

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
from app.services.content_image_generation import (
    AFTER_CLASS_BACKGROUNDS,
    build_episode_background_prompt,
    SCHOOL_MANHWA_QUALITY,
    MANHWA_NEGATIVE,
)
from app.services.avatar_generation import MANHWA_STYLE_LOCK

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.lfwhdzwbikyzalpbwfnd:42PJb25YJhJHJdkl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
)

GENERATION_DELAY = 5

# =============================================================================
# MANHWA STYLE CONSTANTS - Yuna (Graduate TA)
# =============================================================================

YUNA_APPEARANCE = """manhwa style beautiful young woman early 20s, elegant graduate student, soft intelligent eyes behind stylish glasses,
silky dark hair in professional low ponytail with loose strands framing face, refined delicate features, subtle knowing smile,
wearing fitted blazer over soft blouse showing collarbone, academic yet alluring, poised confident stance,
the perfect TA who makes office hours dangerous"""

YUNA_STYLE = f"""{MANHWA_STYLE_LOCK['style']}, {MANHWA_STYLE_LOCK['rendering']},
school romance manhwa aesthetic, warm golden hour lighting, academic intimacy"""

YUNA_QUALITY = MANHWA_STYLE_LOCK['quality']
YUNA_NEGATIVE = MANHWA_STYLE_LOCK['negative']

# Series cover - Yuna in office setting
SERIES_COVER_PROMPT = f"""korean webtoon illustration, manhwa art style, beautiful young female graduate TA in professional attire,
leaning against desk in cozy office filled with books, late afternoon golden light streaming through window,
glasses catching light as she looks at viewer with subtle inviting smile, papers scattered on desk,
school romance manhwa aesthetic, warm amber and cream color palette, intimate academic atmosphere,
clean bold lineart, flat cel shading, {SCHOOL_MANHWA_QUALITY}"""

SERIES_COVER_NEGATIVE = f"""{MANHWA_NEGATIVE}, multiple people, crowd, text, watermark, bad anatomy, extra limbs"""


async def generate_avatar(db: Database, storage: StorageService, image_service: ImageService):
    """Generate Yuna's manhwa style avatar."""
    print("\n" + "=" * 60)
    print("GENERATING YUNA AVATAR (MANHWA STYLE)")
    print("=" * 60)

    char = await db.fetch_one(
        "SELECT id, name, active_avatar_kit_id, avatar_url FROM characters WHERE slug = 'yuna'"
    )
    if not char:
        print("ERROR: Yuna character not found!")
        return False

    kit_id = char["active_avatar_kit_id"]
    if not kit_id:
        print("ERROR: No avatar kit found for Yuna!")
        return False

    if char["avatar_url"]:
        print(f"Yuna already has an avatar: {char['avatar_url'][:80]}...")
        print("Skipping avatar generation.")
        return True

    try:
        full_prompt = f"{YUNA_APPEARANCE}, {YUNA_STYLE}, {YUNA_QUALITY}"
        negative_prompt = YUNA_NEGATIVE

        print(f"Generating with prompt: {full_prompt[:150]}...")
        print(f"Style: MANHWA (Korean webtoon)")

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

        asset_id = uuid.uuid4()
        storage_path = await storage.upload_avatar_asset(
            image_bytes=image_bytes,
            kit_id=uuid.UUID(str(kit_id)),
            asset_id=asset_id,
            asset_type="anchor_portrait",
        )

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
                    "series": "after-class",
                    "style_lock": "manhwa",
                }),
                "file_size": len(image_bytes),
            }
        )

        await db.execute(
            """UPDATE avatar_kits
               SET primary_anchor_id = :asset_id, status = 'active', updated_at = NOW()
               WHERE id = :kit_id""",
            {"asset_id": str(asset_id), "kit_id": str(kit_id)}
        )

        image_url = storage.get_public_url("avatars", storage_path)
        await db.execute(
            """UPDATE characters
               SET avatar_url = :avatar_url, updated_at = NOW()
               WHERE id = :id""",
            {"avatar_url": image_url, "id": str(char["id"])}
        )

        print(f"✓ Avatar generated successfully! ({response.latency_ms}ms)")
        print(f"  Storage path: {storage_path}")
        print(f"  Style: MANHWA (Korean webtoon)")
        return True

    except Exception as e:
        print(f"✗ Failed to generate avatar: {e}")
        log.exception("Avatar generation failed")
        return False


async def generate_series_cover(db: Database, storage: StorageService, image_service: ImageService):
    """Generate After Class series cover in manhwa style."""
    print("\n" + "=" * 60)
    print("GENERATING SERIES COVER (MANHWA STYLE)")
    print("=" * 60)

    series = await db.fetch_one(
        "SELECT id, title, cover_image_url FROM series WHERE slug = 'after-class'"
    )
    if not series:
        print("ERROR: Series not found!")
        return False

    if series["cover_image_url"]:
        print(f"Series already has cover: {series['cover_image_url'][:80]}...")
        print("Skipping cover generation.")
        return True

    try:
        print(f"Generating cover for: {series['title']}")
        print(f"Prompt: {SERIES_COVER_PROMPT[:150]}...")
        print(f"Style: MANHWA (Korean webtoon)")

        response = await image_service.generate(
            prompt=SERIES_COVER_PROMPT,
            negative_prompt=SERIES_COVER_NEGATIVE,
            width=1024,
            height=576,
        )

        if not response.images:
            print("ERROR: No images returned!")
            return False

        image_bytes = response.images[0]

        series_id = series["id"]
        storage_path = f"series/{series_id}/cover.png"

        await storage._upload(
            bucket="scenes",
            path=storage_path,
            data=image_bytes,
            content_type="image/png",
        )

        cover_url = storage.get_public_url("scenes", storage_path)
        await db.execute(
            """UPDATE series SET cover_image_url = :url, updated_at = NOW() WHERE id = :id""",
            {"url": cover_url, "id": str(series_id)}
        )

        print(f"✓ Series cover generated! ({response.latency_ms}ms)")
        print(f"  Storage path: {storage_path}")
        print(f"  Style: MANHWA (Korean webtoon)")
        return True

    except Exception as e:
        print(f"✗ Failed to generate cover: {e}")
        log.exception("Cover generation failed")
        return False


async def generate_episode_backgrounds(db: Database, storage: StorageService, image_service: ImageService):
    """Generate background images for all episodes in manhwa style."""
    print("\n" + "=" * 60)
    print("GENERATING EPISODE BACKGROUNDS (MANHWA STYLE)")
    print("=" * 60)

    series = await db.fetch_one(
        "SELECT id FROM series WHERE slug = 'after-class'"
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

        config = AFTER_CLASS_BACKGROUNDS.get(title)
        if not config:
            print(f"  Ep {ep_num} ({title}): no config found, skipping")
            fail_count += 1
            continue

        try:
            prompt, negative = build_episode_background_prompt(title, config)
            print(f"  Generating Ep {ep_num}: {title}")
            print(f"    Prompt: {prompt[:100]}...")
            print(f"    Style: MANHWA (Korean webtoon)")

            response = await image_service.generate(
                prompt=prompt,
                negative_prompt=negative,
                width=576,
                height=1024,
            )

            if not response.images:
                print(f"    ✗ No images returned")
                fail_count += 1
                continue

            image_bytes = response.images[0]

            storage_path = f"episodes/{ep_id}/background.png"
            await storage._upload(
                bucket="scenes",
                path=storage_path,
                data=image_bytes,
                content_type="image/png",
            )

            bg_url = storage.get_public_url("scenes", storage_path)
            await db.execute(
                """UPDATE episode_templates SET background_image_url = :url, updated_at = NOW() WHERE id = :id""",
                {"url": bg_url, "id": str(ep_id)}
            )

            print(f"    ✓ Generated ({response.latency_ms}ms)")
            success_count += 1

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

    await db.execute(
        "UPDATE characters SET status = 'active' WHERE slug = 'yuna'"
    )
    print("  ✓ Yuna character activated")

    await db.execute(
        "UPDATE series SET status = 'active' WHERE slug = 'after-class'"
    )
    print("  ✓ After Class series activated")

    await db.execute(
        """UPDATE episode_templates SET status = 'active'
           WHERE series_id = (SELECT id FROM series WHERE slug = 'after-class')"""
    )
    print("  ✓ Episodes activated")


async def main(avatar_only: bool = False, backgrounds_only: bool = False, skip_activation: bool = False):
    """Main generation function."""
    print("=" * 60)
    print("AFTER CLASS IMAGE GENERATION")
    print("Visual Style: MANHWA (Korean Webtoon)")
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
            await generate_avatar(db, storage, image_service)
            await asyncio.sleep(GENERATION_DELAY)

            await generate_series_cover(db, storage, image_service)
            await asyncio.sleep(GENERATION_DELAY)

            await generate_episode_backgrounds(db, storage, image_service)

            if not skip_activation:
                await activate_content(db)

        print("\n" + "=" * 60)
        print("GENERATION COMPLETE")
        print("Visual Style: MANHWA (Hardened Style Lock)")
        print("=" * 60)

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate After Class images (MANHWA style)")
    parser.add_argument("--avatar-only", action="store_true", help="Only generate avatar")
    parser.add_argument("--backgrounds-only", action="store_true", help="Only generate backgrounds")
    parser.add_argument("--skip-activation", action="store_true", help="Don't activate content after generation")
    args = parser.parse_args()

    asyncio.run(main(
        avatar_only=args.avatar_only,
        backgrounds_only=args.backgrounds_only,
        skip_activation=args.skip_activation,
    ))
