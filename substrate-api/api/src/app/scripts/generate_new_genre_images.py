"""Generate Images for New Genre Series.

Generates cover images and episode backgrounds for the 6 new genre series:
- Corner Office (workplace)
- Session Notes (psychological)
- The Duke's Third Son (historical)
- Debate Partners (gl)
- Ink & Canvas (bl)
- The Corner Cafe (cozy)

Uses dynamic prompt building from series/episode metadata.

Usage:
    cd substrate-api/api/src
    FANTAZY_DB_PASSWORD='...' REPLICATE_API_TOKEN='...' python -m app.scripts.generate_new_genre_images

Options:
    --series-slug: Generate for specific series only
    --covers-only: Only generate series covers
    --backgrounds-only: Only generate episode backgrounds
    --dry-run: Show prompts without generating
"""

import asyncio
import argparse
import logging
import os
import sys
from datetime import datetime
from typing import Dict, Any, Optional, List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from databases import Database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
log = logging.getLogger(__name__)

# Series slugs for new genres
NEW_GENRE_SERIES = [
    "corner-office-romance",
    "session-notes",
    "dukes-third-son",
    "debate-partners",
    "ink-and-canvas",
    "corner-cafe",
]


async def get_database() -> Database:
    """Get database connection."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
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


async def fetch_series_with_context(db: Database, series_slug: str) -> Optional[Dict[str, Any]]:
    """Fetch series with character and episode context."""
    query = """
        SELECT
            s.id, s.title, s.slug, s.genre, s.tagline, s.description,
            s.cover_image_url, s.thumbnail_url,
            w.name as world_name,
            c.name as character_name, c.backstory as character_backstory,
            et.episode_frame
        FROM series s
        LEFT JOIN worlds w ON w.id = s.world_id
        LEFT JOIN episode_templates et ON et.series_id = s.id AND et.episode_number = 0
        LEFT JOIN characters c ON c.id = et.character_id
        WHERE s.slug = :slug
    """
    row = await db.fetch_one(query, {"slug": series_slug})
    if not row:
        return None
    return dict(row)


async def fetch_episodes(db: Database, series_id: str) -> List[Dict[str, Any]]:
    """Fetch all episodes for a series."""
    query = """
        SELECT id, episode_number, title, situation, episode_frame, background_image_url
        FROM episode_templates
        WHERE series_id = :series_id
        ORDER BY episode_number
    """
    rows = await db.fetch_all(query, {"series_id": series_id})
    return [dict(row) for row in rows]


async def upload_to_supabase(image_bytes: bytes, storage_path: str) -> str:
    """Upload image bytes to Supabase Storage."""
    import httpx
    from app.services.storage import StorageService

    storage = StorageService.get_instance()

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

    # Return full public URL
    public_url = f"{storage.supabase_url}/storage/v1/object/public/scenes/{storage_path}"
    log.info(f"Uploaded to {storage_path}")
    return public_url


async def generate_series_cover(
    db: Database,
    series_data: Dict[str, Any],
    dry_run: bool = False,
) -> Optional[Dict[str, Any]]:
    """Generate series cover using dynamic prompt builder."""
    from app.services.content_image_generation import (
        build_dynamic_series_cover_prompt,
        ASPECT_RATIOS,
        ImageType,
    )
    from app.services.image import ImageService

    series_id = str(series_data["id"])
    series_slug = series_data["slug"]

    # Skip if already has cover
    if series_data.get("cover_image_url"):
        log.info(f"  Series '{series_slug}' already has cover, skipping")
        return None

    # Build dynamic prompt from metadata
    prompt, negative = build_dynamic_series_cover_prompt(
        title=series_data["title"],
        genre=series_data.get("genre"),
        tagline=series_data.get("tagline"),
        description=series_data.get("description"),
        world_name=series_data.get("world_name"),
        character_name=series_data.get("character_name"),
        character_backstory=series_data.get("character_backstory"),
        episode_frame=series_data.get("episode_frame"),
    )

    log.info(f"\n{'='*60}")
    log.info(f"COVER: {series_data['title']}")
    log.info(f"{'='*60}")
    log.info(f"Prompt: {prompt[:200]}...")

    if dry_run:
        log.info("[DRY RUN] Would generate cover")
        return {"dry_run": True, "prompt": prompt}

    # Generate image
    service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")
    width, height = ASPECT_RATIOS[ImageType.SERIES_COVER]

    result = await service.generate(
        prompt=prompt,
        negative_prompt=negative,
        width=width,
        height=height,
    )

    if not result.images:
        log.error("No image returned")
        return {"success": False, "error": "No image returned"}

    # Upload to storage - use series ID in path like newer series
    storage_path = f"series/{series_id}/cover.png"
    public_url = await upload_to_supabase(result.images[0], storage_path)

    # Update database with full URL
    await db.execute(
        """UPDATE series
           SET cover_image_url = :url, thumbnail_url = :url, updated_at = NOW()
           WHERE id = :id""",
        {"url": public_url, "id": series_id}
    )

    log.info(f"Cover saved: {public_url}")
    return {
        "success": True,
        "storage_path": storage_path,
        "url": public_url,
        "latency_ms": result.latency_ms,
    }


async def generate_episode_background(
    db: Database,
    series_data: Dict[str, Any],
    episode: Dict[str, Any],
    dry_run: bool = False,
) -> Optional[Dict[str, Any]]:
    """Generate episode background using dynamic prompt builder."""
    from app.services.content_image_generation import (
        build_dynamic_episode_background_prompt,
        ASPECT_RATIOS,
        ImageType,
    )
    from app.services.image import ImageService

    series_id = str(series_data["id"])
    series_slug = series_data["slug"]
    ep_id = str(episode["id"])
    ep_num = episode["episode_number"]
    ep_title = episode["title"]

    # Skip if already has background
    if episode.get("background_image_url"):
        log.info(f"  Episode {ep_num} already has background, skipping")
        return None

    # Build dynamic prompt from episode metadata
    prompt, negative = build_dynamic_episode_background_prompt(
        episode_frame=episode.get("episode_frame"),
        situation=episode.get("situation"),
        genre=series_data.get("genre"),
        world_name=series_data.get("world_name"),
    )

    log.info(f"\n  --- Episode {ep_num}: {ep_title} ---")
    log.info(f"  Prompt: {prompt[:150]}...")

    if dry_run:
        log.info("  [DRY RUN] Would generate background")
        return {"dry_run": True, "prompt": prompt}

    # Generate image
    service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")
    width, height = ASPECT_RATIOS[ImageType.EPISODE_BACKGROUND]

    result = await service.generate(
        prompt=prompt,
        negative_prompt=negative,
        width=width,
        height=height,
    )

    if not result.images:
        log.error(f"  No image returned for episode {ep_num}")
        return {"success": False, "error": "No image returned"}

    # Upload to storage
    safe_title = ep_title.lower().replace(" ", "_").replace("'", "")
    storage_path = f"series/{series_id}/episodes/ep{ep_num:02d}_{safe_title}.png"
    public_url = await upload_to_supabase(result.images[0], storage_path)

    # Update database
    await db.execute(
        "UPDATE episode_templates SET background_image_url = :url WHERE id = :id",
        {"url": public_url, "id": ep_id}
    )

    log.info(f"  Background saved: {storage_path}")
    return {
        "success": True,
        "storage_path": storage_path,
        "url": public_url,
        "latency_ms": result.latency_ms,
    }


async def process_series(
    db: Database,
    series_slug: str,
    covers_only: bool = False,
    backgrounds_only: bool = False,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Process a single series - generate cover and/or backgrounds."""

    series_data = await fetch_series_with_context(db, series_slug)
    if not series_data:
        log.error(f"Series '{series_slug}' not found")
        return {"error": f"Series '{series_slug}' not found"}

    result = {
        "series": series_slug,
        "title": series_data["title"],
        "cover": None,
        "backgrounds": [],
    }

    # Generate cover
    if not backgrounds_only:
        cover_result = await generate_series_cover(db, series_data, dry_run)
        result["cover"] = cover_result

        # Add delay to avoid rate limiting
        if not dry_run and cover_result and cover_result.get("success"):
            await asyncio.sleep(2)

    # Generate backgrounds
    if not covers_only:
        episodes = await fetch_episodes(db, str(series_data["id"]))
        log.info(f"\nGenerating {len(episodes)} episode backgrounds...")

        for episode in episodes:
            bg_result = await generate_episode_background(db, series_data, episode, dry_run)
            if bg_result:
                result["backgrounds"].append({
                    "episode": episode["title"],
                    "episode_number": episode["episode_number"],
                    **bg_result,
                })

            # Add delay between generations
            if not dry_run and bg_result and bg_result.get("success"):
                await asyncio.sleep(2)

    return result


async def main():
    parser = argparse.ArgumentParser(description="Generate images for new genre series")
    parser.add_argument("--series-slug", help="Generate for specific series only")
    parser.add_argument("--covers-only", action="store_true", help="Only generate covers")
    parser.add_argument("--backgrounds-only", action="store_true", help="Only generate backgrounds")
    parser.add_argument("--dry-run", action="store_true", help="Show prompts without generating")
    args = parser.parse_args()

    log.info("="*60)
    log.info("NEW GENRE SERIES IMAGE GENERATION")
    log.info("="*60)

    if args.dry_run:
        log.info("MODE: DRY RUN - No images will be generated")

    series_to_process = [args.series_slug] if args.series_slug else NEW_GENRE_SERIES
    log.info(f"Series to process: {', '.join(series_to_process)}")

    db = await get_database()

    try:
        all_results = []

        for series_slug in series_to_process:
            log.info(f"\n{'#'*60}")
            log.info(f"# Processing: {series_slug}")
            log.info(f"{'#'*60}")

            result = await process_series(
                db=db,
                series_slug=series_slug,
                covers_only=args.covers_only,
                backgrounds_only=args.backgrounds_only,
                dry_run=args.dry_run,
            )
            all_results.append(result)

        # Summary
        log.info("\n" + "="*60)
        log.info("GENERATION COMPLETE")
        log.info("="*60)

        for result in all_results:
            title = result.get("title", result.get("series", "Unknown"))
            cover_result = result.get("cover")
            cover_status = "generated" if cover_result and cover_result.get("success") else "skipped/failed"
            bg_count = len([b for b in result.get("backgrounds", []) if b.get("success")])
            log.info(f"  {title}: cover={cover_status}, backgrounds={bg_count}")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
