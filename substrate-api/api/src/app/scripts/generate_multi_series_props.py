"""Generate prop images for multiple series.

ADR-005: Props are pre-generated at scaffold time for consistency.

This script generates images for all props that have image_prompt defined
but no image_url yet across specified series.

Usage:
    python -m app.scripts.generate_multi_series_props
    python -m app.scripts.generate_multi_series_props --dry-run

Environment variables required:
    REPLICATE_API_TOKEN - Replicate API key
"""

import asyncio
import logging
import os
import sys

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

# Rate limiting between generations
GENERATION_DELAY = 5

# Style constants for prop images
QUALITY = "masterpiece, best quality, highly detailed, dramatic lighting, atmospheric, cinematic"
NEGATIVE = "anime, cartoon, low quality, blurry, text, watermark, readable text, words, letters"

# Series to generate props for
TARGET_SERIES = ['blackout', 'the-arrangement']


async def generate_prop_images(db: Database, storage: StorageService, image_service: ImageService, dry_run: bool = False):
    """Generate images for all props without images."""
    print("\n" + "=" * 60)
    print("GENERATING PROP IMAGES (MULTI-SERIES)")
    print("=" * 60)

    # Get all props that need images
    placeholders = ", ".join([f":s{i}" for i in range(len(TARGET_SERIES))])
    params = {f"s{i}": slug for i, slug in enumerate(TARGET_SERIES)}

    props = await db.fetch_all(
        f"""SELECT p.id, p.name, p.slug, p.image_prompt, p.image_url,
                   et.title as episode_title, s.title as series_title
           FROM props p
           JOIN episode_templates et ON p.episode_template_id = et.id
           JOIN series s ON et.series_id = s.id
           WHERE s.slug IN ({placeholders})
           AND p.image_prompt IS NOT NULL
           ORDER BY s.title, et.episode_number, p.display_order""",
        params
    )

    print(f"Found {len(props)} props with image prompts")

    success_count = 0
    skip_count = 0
    fail_count = 0

    for prop in props:
        prop_id = prop["id"]
        name = prop["name"]
        series = prop["series_title"]
        episode = prop["episode_title"]

        if prop["image_url"]:
            print(f"  {series} - {episode} - {name}: already has image, skipping")
            skip_count += 1
            continue

        if dry_run:
            print(f"  {series} - {episode} - {name}: would generate")
            continue

        try:
            # Build full prompt with quality modifiers
            base_prompt = prop["image_prompt"]
            full_prompt = f"{base_prompt}, {QUALITY}"

            print(f"  Generating: {series} - {episode} - {name}")
            print(f"    Prompt: {full_prompt[:80]}...")

            # Generate square image for props
            response = await image_service.generate(
                prompt=full_prompt,
                negative_prompt=NEGATIVE,
                width=768,
                height=768,
            )

            if not response.images:
                print(f"    ✗ No images returned")
                fail_count += 1
                continue

            image_bytes = response.images[0]

            # Upload to storage
            storage_path = f"props/{prop_id}/image.png"
            await storage._upload(
                bucket="scenes",
                path=storage_path,
                data=image_bytes,
                content_type="image/png",
            )

            # Update prop with image URL
            image_url = storage.get_public_url("scenes", storage_path)
            await db.execute(
                """UPDATE props SET image_url = :url, updated_at = NOW() WHERE id = :id""",
                {"url": image_url, "id": str(prop_id)}
            )

            print(f"    ✓ Generated ({response.latency_ms}ms)")
            success_count += 1

            # Rate limiting
            if prop != props[-1]:
                print(f"    (waiting {GENERATION_DELAY}s...)")
                await asyncio.sleep(GENERATION_DELAY)

        except Exception as e:
            print(f"    ✗ Failed: {e}")
            log.exception(f"Prop image generation failed for {name}")
            fail_count += 1

    print(f"\nProp image generation complete:")
    print(f"  Success: {success_count}")
    print(f"  Skipped: {skip_count}")
    print(f"  Failed: {fail_count}")

    return fail_count == 0


async def main(dry_run: bool = False):
    """Main function."""
    print("=" * 60)
    print("MULTI-SERIES PROP IMAGE GENERATION")
    print("=" * 60)
    print(f"Target series: {', '.join(TARGET_SERIES)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    if dry_run:
        db = Database(DATABASE_URL)
        await db.connect()
        try:
            await generate_prop_images(db, None, None, dry_run=True)
        finally:
            await db.disconnect()
        return

    db = Database(DATABASE_URL)
    await db.connect()
    storage = StorageService.get_instance()
    image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

    try:
        await generate_prop_images(db, storage, image_service)

        print("\n" + "=" * 60)
        print("GENERATION COMPLETE")
        print("=" * 60)

    finally:
        await db.disconnect()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate multi-series prop images")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be generated")
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run))
