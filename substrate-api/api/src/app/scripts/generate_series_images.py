"""Generate Series Images Script.

Generates series cover and episode background images using the
Visual Identity Cascade system.

Usage:
    python -m app.scripts.generate_series_images --series-slug stolen-moments

Options:
    --series-slug: Series slug to generate images for
    --cover-only: Only generate series cover
    --backgrounds-only: Only generate episode backgrounds
    --dry-run: Show prompts without generating
"""

import asyncio
import argparse
import json
import logging
import os
import sys
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from databases import Database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
log = logging.getLogger(__name__)


# Episode location/time mappings for Stolen Moments
# These override the auto-detection from situation text
STOLEN_MOMENTS_EPISODE_CONFIG = {
    "3AM": {
        "location_key": "convenience_store",
        "time_of_day": "3am, late night",
        "location_override": "Korean convenience store interior at 3am, fluorescent lights, empty aisles, konbini atmosphere, quiet night"
    },
    "Rooftop Rain": {
        "location_key": "rooftop",
        "time_of_day": "evening, rain starting",
        "location_override": "Seoul apartment rooftop in the rain, city lights below, wet concrete, moody evening sky"
    },
    "Old Songs": {
        "location_key": "apartment",
        "time_of_day": "late night",
        "location_override": "intimate Korean apartment living room at night, soft lamp light, vinyl records, cozy atmosphere"
    },
    "Seen": {
        "location_key": "alley",
        "time_of_day": "night",
        "location_override": "dark back alley behind restaurant, wet pavement, distant neon signs, urban hiding spot"
    },
    "Morning After": {
        "location_key": "apartment",
        "time_of_day": "morning",
        "location_override": "Korean apartment bedroom, soft morning light through curtains, intimate quiet moment"
    },
    "One More Night": {
        "location_key": "hotel",
        "time_of_day": "evening",
        "location_override": "upscale hotel room in Seoul, city view through large windows, ambient evening lighting"
    },
}


async def get_database():
    """Get database connection."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        # Construct from individual vars
        db_host = os.getenv("FANTAZY_DB_HOST", "aws-1-ap-northeast-1.pooler.supabase.com")
        db_port = os.getenv("FANTAZY_DB_PORT", "5432")
        db_name = os.getenv("FANTAZY_DB_NAME", "postgres")
        db_user = os.getenv("FANTAZY_DB_USER", "postgres.lfwhdzwbikyzalpbwfnd")
        db_password = os.getenv("FANTAZY_DB_PASSWORD", "")

        if not db_password:
            raise ValueError("FANTAZY_DB_PASSWORD environment variable required")

        database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    db = Database(database_url)
    await db.connect()
    return db


async def fetch_series_data(db: Database, series_slug: str):
    """Fetch series with world visual style."""
    query = """
        SELECT
            s.id, s.title, s.slug, s.tagline, s.genre, s.visual_style,
            s.cover_image_url,
            w.id as world_id, w.name as world_name, w.visual_style as world_visual_style
        FROM series s
        LEFT JOIN worlds w ON s.world_id = w.id
        WHERE s.slug = :slug
    """
    row = await db.fetch_one(query, {"slug": series_slug})
    if not row:
        raise ValueError(f"Series '{series_slug}' not found")
    return dict(row)


async def fetch_episodes(db: Database, series_id: str):
    """Fetch episodes for a series."""
    query = """
        SELECT id, episode_number, title, situation, background_image_url
        FROM episode_templates
        WHERE series_id = :series_id
        ORDER BY episode_number
    """
    rows = await db.fetch_all(query, {"series_id": series_id})
    return [dict(row) for row in rows]


def merge_visual_styles(world_style, series_style) -> dict:
    """Merge world and series visual styles."""
    import json

    # Handle JSONB coming back as string
    if isinstance(world_style, str):
        try:
            world_style = json.loads(world_style)
        except:
            world_style = {}
    if isinstance(series_style, str):
        try:
            series_style = json.loads(series_style)
        except:
            series_style = {}

    merged = dict(world_style) if world_style else {}
    if series_style:
        for key, value in series_style.items():
            if value is not None and value != "":
                merged[key] = value
    return merged


def build_series_cover_prompt(series_data: dict, merged_style: dict) -> tuple[str, str]:
    """Build prompt for series cover."""
    style_parts = []

    if merged_style.get("base_style"):
        style_parts.append(merged_style["base_style"])
    if merged_style.get("color_palette"):
        style_parts.append(merged_style["color_palette"])
    if merged_style.get("rendering"):
        style_parts.append(merged_style["rendering"])
    if merged_style.get("mood"):
        style_parts.append(f"{merged_style['mood']} mood")
    if merged_style.get("atmosphere"):
        style_parts.append(merged_style["atmosphere"])

    motifs = merged_style.get("recurring_motifs", [])
    if motifs:
        style_parts.append(f"featuring {', '.join(motifs[:3])}")

    prompt = f"""cinematic establishing shot, atmospheric scene for '{series_data['title']}',
{series_data.get('tagline', '')},
{series_data.get('genre', 'romantic')} genre aesthetic,
{', '.join(style_parts)},
masterpiece, best quality, highly detailed illustration,
cinematic lighting, atmospheric depth,
empty scene, no people, no characters, no faces, wide shot"""

    negative = f"""{merged_style.get('negative_prompt', '')},
people, characters, faces, portraits, close-up of person,
lowres, bad anatomy, text, watermark, signature, blurry"""

    return prompt.strip(), negative.strip()


def build_episode_background_prompt(
    episode: dict,
    merged_style: dict,
    episode_config: dict
) -> tuple[str, str]:
    """Build prompt for episode background."""
    style_parts = []

    if merged_style.get("base_style"):
        style_parts.append(merged_style["base_style"])
    if merged_style.get("color_palette"):
        style_parts.append(merged_style["color_palette"])
    if merged_style.get("rendering"):
        style_parts.append(merged_style["rendering"])
    if merged_style.get("mood"):
        style_parts.append(f"{merged_style['mood']} mood")

    # Use location override if available
    location = episode_config.get("location_override", episode.get("situation", ""))
    time_of_day = episode_config.get("time_of_day", "")

    prompt = f"""atmospheric background scene, empty environment,
{location},
{time_of_day} lighting,
{', '.join(style_parts)},
masterpiece, best quality, highly detailed illustration,
soft atmospheric blur, suitable for text overlay,
no people, no characters, no faces, empty scene"""

    negative = f"""{merged_style.get('negative_prompt', '')},
people, characters, faces, portraits, figure, silhouette,
lowres, bad anatomy, text, watermark, signature, blurry"""

    return prompt.strip(), negative.strip()


async def download_image(url: str) -> bytes:
    """Download image from URL and return bytes."""
    import httpx

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def upload_to_supabase(image_bytes: bytes, storage_path: str) -> str:
    """Upload image bytes to Supabase Storage.

    Args:
        image_bytes: Image data
        storage_path: Path within the 'scenes' bucket (e.g., "series/slug/cover.png")

    Returns:
        Storage path (for use with signed URLs)
    """
    import httpx
    from app.services.storage import StorageService

    storage = StorageService.get_instance()

    # Upload to scenes bucket
    url = f"{storage.supabase_url}/storage/v1/object/scenes/{storage_path}"
    headers = {
        "Authorization": f"Bearer {storage.service_role_key}",
        "Content-Type": "image/png",
        "x-upsert": "true",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, content=image_bytes)
        if response.status_code not in (200, 201):
            log.error(f"Storage upload failed: {response.status_code} {response.text}")
            response.raise_for_status()

    log.info(f"Uploaded to scenes/{storage_path}")
    return storage_path


async def generate_image(prompt: str, negative_prompt: str, width: int, height: int, dry_run: bool = False, max_retries: int = 3):
    """Generate an image using the ImageService (Replicate/FLUX).

    Returns the Replicate URL (temporary) - caller should download and upload to Supabase.
    """
    if dry_run:
        return {
            "image_url": "[DRY RUN - no image generated]",
            "prompt": prompt,
            "model_used": "dry_run"
        }

    from app.services.image import ImageService
    import httpx

    # Use Replicate with FLUX 1.1 Pro for high quality backgrounds
    service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

    for attempt in range(max_retries):
        try:
            result = await service.generate(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
            )

            # FLUX returns images as bytes, and raw_response contains the URL from Replicate
            image_url = None
            if result.raw_response and result.raw_response.get("output"):
                output = result.raw_response["output"]
                if isinstance(output, list) and output:
                    image_url = output[0]
                elif isinstance(output, str):
                    image_url = output

            return {
                "image_url": image_url,
                "prompt": prompt,
                "model_used": result.model,
                "latency_ms": result.latency_ms
            }

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429 and attempt < max_retries - 1:
                wait_time = (attempt + 1) * 10  # 10s, 20s, 30s
                log.warning(f"Rate limited, waiting {wait_time}s before retry {attempt + 2}/{max_retries}")
                await asyncio.sleep(wait_time)
            else:
                raise


async def generate_and_upload(
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    storage_path: str,
    dry_run: bool = False,
) -> dict:
    """Generate image, download from Replicate, and upload to Supabase.

    Returns dict with storage_path (Supabase) instead of temporary Replicate URL.
    """
    result = await generate_image(prompt, negative_prompt, width, height, dry_run)

    if dry_run or not result.get("image_url"):
        return result

    # Download from Replicate
    log.info("Downloading from Replicate...")
    image_bytes = await download_image(result["image_url"])

    # Upload to Supabase
    log.info(f"Uploading to Supabase: {storage_path}")
    final_path = await upload_to_supabase(image_bytes, storage_path)

    return {
        "storage_path": final_path,
        "prompt": result["prompt"],
        "model_used": result["model_used"],
        "latency_ms": result.get("latency_ms"),
    }


async def update_series_cover(db: Database, series_id: str, storage_path: str):
    """Update series cover_image_url with Supabase storage path."""
    await db.execute(
        "UPDATE series SET cover_image_url = :path, updated_at = NOW() WHERE id = :id",
        {"path": storage_path, "id": series_id}
    )


async def update_episode_background(db: Database, episode_id: str, storage_path: str):
    """Update episode background_image_url with Supabase storage path."""
    await db.execute(
        "UPDATE episode_templates SET background_image_url = :path WHERE id = :id",
        {"path": storage_path, "id": episode_id}
    )


async def main():
    parser = argparse.ArgumentParser(description="Generate series images")
    parser.add_argument("--series-slug", required=True, help="Series slug")
    parser.add_argument("--cover-only", action="store_true", help="Only generate cover")
    parser.add_argument("--backgrounds-only", action="store_true", help="Only generate backgrounds")
    parser.add_argument("--dry-run", action="store_true", help="Show prompts without generating")
    parser.add_argument("--skip-existing", action="store_true", help="Skip if image already exists")
    args = parser.parse_args()

    log.info(f"=== Series Image Generation: {args.series_slug} ===")
    if args.dry_run:
        log.info("DRY RUN MODE - No images will be generated")

    db = await get_database()

    try:
        # Fetch series data
        series_data = await fetch_series_data(db, args.series_slug)
        log.info(f"Series: {series_data['title']} (World: {series_data.get('world_name', 'None')})")

        # Merge visual styles
        world_style = series_data.get("world_visual_style") or {}
        series_style = series_data.get("visual_style") or {}
        merged_style = merge_visual_styles(world_style, series_style)

        log.info(f"Merged visual style keys: {list(merged_style.keys())}")

        results = {"series": args.series_slug, "timestamp": datetime.now().isoformat()}

        # Generate cover
        if not args.backgrounds_only:
            if args.skip_existing and series_data.get("cover_image_url"):
                log.info("Cover already exists, skipping")
            else:
                log.info("\n--- Generating Series Cover ---")
                prompt, negative = build_series_cover_prompt(series_data, merged_style)

                log.info(f"Prompt:\n{prompt}\n")
                log.info(f"Negative:\n{negative}\n")

                # Storage path: series/{slug}/cover.png
                storage_path = f"series/{args.series_slug}/cover.png"

                result = await generate_and_upload(
                    prompt=prompt,
                    negative_prompt=negative,
                    width=1024,
                    height=576,  # 16:9 landscape
                    storage_path=storage_path,
                    dry_run=args.dry_run
                )

                if result.get("storage_path"):
                    log.info(f"Uploaded to: {result['storage_path']}")
                    await update_series_cover(db, str(series_data["id"]), result["storage_path"])
                    log.info("Updated series cover_image_url with Supabase path")
                elif args.dry_run:
                    log.info("[DRY RUN] Would upload to: " + storage_path)

                results["cover"] = result

        # Generate episode backgrounds
        if not args.cover_only:
            episodes = await fetch_episodes(db, str(series_data["id"]))
            log.info(f"\n--- Generating {len(episodes)} Episode Backgrounds ---")

            results["backgrounds"] = []

            for ep in episodes:
                ep_title = ep["title"]
                log.info(f"\nEpisode {ep['episode_number']}: {ep_title}")

                if args.skip_existing and ep.get("background_image_url"):
                    log.info("Background already exists, skipping")
                    continue

                # Get episode config (for Stolen Moments)
                ep_config = STOLEN_MOMENTS_EPISODE_CONFIG.get(ep_title, {})

                prompt, negative = build_episode_background_prompt(ep, merged_style, ep_config)

                log.info(f"Prompt:\n{prompt}\n")

                # Storage path: series/{slug}/episodes/ep{num}_{safe_title}.png
                safe_title = ep_title.lower().replace(" ", "_").replace("'", "")
                storage_path = f"series/{args.series_slug}/episodes/ep{ep['episode_number']:02d}_{safe_title}.png"

                result = await generate_and_upload(
                    prompt=prompt,
                    negative_prompt=negative,
                    width=576,
                    height=1024,  # 9:16 portrait for mobile
                    storage_path=storage_path,
                    dry_run=args.dry_run
                )

                if result.get("storage_path"):
                    log.info(f"Uploaded to: {result['storage_path']}")
                    await update_episode_background(db, str(ep["id"]), result["storage_path"])
                    log.info("Updated episode background_image_url with Supabase path")
                elif args.dry_run:
                    log.info("[DRY RUN] Would upload to: " + storage_path)

                results["backgrounds"].append({
                    "episode": ep_title,
                    "episode_number": ep["episode_number"],
                    **result
                })

        # Summary
        log.info("\n=== Generation Complete ===")
        log.info(json.dumps(results, indent=2, default=str))

    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
