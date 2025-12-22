"""Series API routes.

Series are narrative containers grouping episodes into coherent experiences.
Reference: docs/GLOSSARY.md, docs/CONTENT_ARCHITECTURE_CANON.md
"""

import json
import re
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.deps import get_db
from app.models.series import (
    Series,
    SeriesSummary,
    SeriesCreate,
    SeriesUpdate,
    SeriesType,
    GenreSettings,
    GENRE_SETTING_PRESETS,
    TENSION_STYLES,
    PACING_CURVES,
    RESOLUTION_MODES,
    VULNERABILITY_TIMINGS,
)
from app.services.storage import StorageService


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    # Lowercase and replace spaces with hyphens
    slug = text.lower().strip()
    # Remove special characters except hyphens
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    # Replace spaces with hyphens
    slug = re.sub(r'[\s_]+', '-', slug)
    # Remove multiple consecutive hyphens
    slug = re.sub(r'-+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    return slug


def normalize_series_cover_path(cover_url: Optional[str], series_slug: Optional[str]) -> Optional[str]:
    """Normalize cover image URLs to storage paths for signing."""
    if not cover_url:
        return None
    if cover_url.startswith("http"):
        return cover_url

    path = cover_url.lstrip("/")

    if path.startswith("studio/series/"):
        tail = path[len("studio/series/"):]
        if tail.endswith("cover.png"):
            parts = [p for p in tail.split("/") if p]
            slug = parts[0] if len(parts) > 1 else series_slug
            if slug:
                return f"series/{slug}/cover.png"
        return None

    if path.startswith("series/"):
        return path

    return None


router = APIRouter(prefix="/series", tags=["Series"])


# =============================================================================
# Response Models
# =============================================================================

class SeriesWithEpisodesResponse(Series):
    """Series with embedded episode list."""
    episodes: List[dict] = Field(default_factory=list)


class SeriesWithCharactersResponse(Series):
    """Series with embedded character list."""
    characters: List[dict] = Field(default_factory=list)


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("", response_model=List[SeriesSummary])
async def list_series(
    world_id: Optional[UUID] = Query(None, description="Filter by world"),
    series_type: Optional[str] = Query(None, description="Filter by series type"),
    status_filter: str = Query("active", description="Filter by status"),
    featured: bool = Query(False, description="Only return featured series"),
    include_play: bool = Query(False, description="Include 'play' type series (excluded by default)"),
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db),
):
    """List all series with optional filters.

    By default, excludes 'play' type series (viral/game content for /play route).
    Use include_play=true or series_type=play to access them.
    """
    query = """
        SELECT id, title, slug, tagline, series_type, total_episodes,
               cover_image_url, is_featured, genre
        FROM series
        WHERE 1=1
    """
    params = {}

    if status_filter:
        query += " AND status = :status"
        params["status"] = status_filter

    if world_id:
        query += " AND world_id = :world_id"
        params["world_id"] = str(world_id)

    if series_type:
        # If explicitly filtering by series_type, use that
        query += " AND series_type = :series_type"
        params["series_type"] = series_type
    elif not include_play:
        # By default, exclude 'play' type from main app queries
        query += " AND series_type != 'play'"

    if featured:
        query += " AND is_featured = TRUE"

    query += " ORDER BY is_featured DESC, created_at DESC LIMIT :limit"
    params["limit"] = limit

    rows = await db.fetch_all(query, params)

    # Convert storage paths to signed URLs for cover images
    storage = StorageService.get_instance()
    results = []
    for row in rows:
        data = dict(row)
        cover_url = normalize_series_cover_path(data.get("cover_image_url"), data.get("slug"))
        if cover_url and not cover_url.startswith("http"):
            cover_url = await storage.create_signed_url("scenes", cover_url, expires_in=3600)
        data["cover_image_url"] = cover_url
        results.append(SeriesSummary(**data))

    return results


@router.get("/{series_id}", response_model=Series)
async def get_series(
    series_id: UUID,
    db=Depends(get_db),
):
    """Get a specific series by ID."""
    query = "SELECT * FROM series WHERE id = :id"
    row = await db.fetch_one(query, {"id": str(series_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Series not found"
        )

    data = dict(row)
    # Convert storage path to signed URL for cover image
    storage = StorageService.get_instance()
    cover_url = normalize_series_cover_path(data.get("cover_image_url"), data.get("slug"))
    if cover_url and not cover_url.startswith("http"):
        cover_url = await storage.create_signed_url("scenes", cover_url, expires_in=3600)
    data["cover_image_url"] = cover_url

    return Series(**data)


@router.get("/{series_id}/with-episodes", response_model=SeriesWithEpisodesResponse)
async def get_series_with_episodes(
    series_id: UUID,
    db=Depends(get_db),
):
    """Get a series with all its episodes."""
    # Get series
    series_query = "SELECT * FROM series WHERE id = :id"
    series_row = await db.fetch_one(series_query, {"id": str(series_id)})

    if not series_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Series not found"
        )

    # Get episodes
    episodes_query = """
        SELECT id, character_id, episode_number, episode_type, title, slug,
               situation, opening_line, episode_frame, background_image_url,
               dramatic_question, is_default, sort_order, status
        FROM episode_templates
        WHERE series_id = :series_id
        ORDER BY sort_order, episode_number
    """
    episode_rows = await db.fetch_all(episodes_query, {"series_id": str(series_id)})

    series_data = dict(series_row)
    storage = StorageService.get_instance()

    # Convert series cover storage path to signed URL
    cover_url = normalize_series_cover_path(series_data.get("cover_image_url"), series_data.get("slug"))
    if cover_url and not cover_url.startswith("http"):
        cover_url = await storage.create_signed_url("scenes", cover_url, expires_in=3600)
    series_data["cover_image_url"] = cover_url

    # Convert episode background storage paths to signed URLs
    episodes = []
    for row in episode_rows:
        ep_data = dict(row)
        if ep_data.get("background_image_url") and not ep_data["background_image_url"].startswith("http"):
            ep_data["background_image_url"] = await storage.create_signed_url(
                "scenes", ep_data["background_image_url"], expires_in=3600
            )
        episodes.append(ep_data)

    series_data["episodes"] = episodes

    return SeriesWithEpisodesResponse(**series_data)


@router.get("/{series_id}/with-characters", response_model=SeriesWithCharactersResponse)
async def get_series_with_characters(
    series_id: UUID,
    db=Depends(get_db),
):
    """Get a series with its featured characters."""
    # Get series
    series_query = "SELECT * FROM series WHERE id = :id"
    series_row = await db.fetch_one(series_query, {"id": str(series_id)})

    if not series_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Series not found"
        )

    series_data = dict(series_row)

    # Convert series cover storage path to signed URL
    storage = StorageService.get_instance()
    cover_url = normalize_series_cover_path(series_data.get("cover_image_url"), series_data.get("slug"))
    if cover_url and not cover_url.startswith("http"):
        cover_url = await storage.create_signed_url("scenes", cover_url, expires_in=3600)
    series_data["cover_image_url"] = cover_url

    # Get featured characters
    featured_chars = series_data.get("featured_characters", [])
    characters = []

    if featured_chars:
        chars_query = """
            SELECT id, name, slug, archetype, avatar_url, short_backstory, genre
            FROM characters
            WHERE id = ANY(:char_ids)
            AND status = 'active'
        """
        char_rows = await db.fetch_all(chars_query, {"char_ids": featured_chars})

        # Convert avatar storage paths to signed URLs
        storage = StorageService.get_instance()
        for row in char_rows:
            char_data = dict(row)
            if char_data.get("avatar_url") and not char_data["avatar_url"].startswith("http"):
                char_data["avatar_url"] = await storage.create_signed_url(
                    "scenes", char_data["avatar_url"], expires_in=3600
                )
            characters.append(char_data)

    series_data["characters"] = characters
    return SeriesWithCharactersResponse(**series_data)


@router.post("", response_model=Series, status_code=status.HTTP_201_CREATED)
async def create_series(
    data: SeriesCreate,
    db=Depends(get_db),
):
    """Create a new series."""
    query = """
        INSERT INTO series (title, slug, description, tagline, world_id, series_type)
        VALUES (:title, :slug, :description, :tagline, :world_id, :series_type)
        RETURNING *
    """
    row = await db.fetch_one(query, {
        "title": data.title,
        "slug": data.slug,
        "description": data.description,
        "tagline": data.tagline,
        "world_id": str(data.world_id) if data.world_id else None,
        "series_type": data.series_type,
    })

    return Series(**dict(row))


@router.patch("/{series_id}", response_model=Series)
async def update_series(
    series_id: UUID,
    data: SeriesUpdate,
    db=Depends(get_db),
):
    """Update a series."""
    updates = []
    values = {"id": str(series_id)}

    if data.title is not None:
        updates.append("title = :title")
        values["title"] = data.title
        # Auto-update slug when title changes
        updates.append("slug = :slug")
        values["slug"] = slugify(data.title)

    if data.description is not None:
        updates.append("description = :description")
        values["description"] = data.description

    if data.tagline is not None:
        updates.append("tagline = :tagline")
        values["tagline"] = data.tagline

    if data.world_id is not None:
        updates.append("world_id = :world_id")
        values["world_id"] = str(data.world_id)

    if data.series_type is not None:
        updates.append("series_type = :series_type")
        values["series_type"] = data.series_type

    if data.genre is not None:
        updates.append("genre = :genre")
        values["genre"] = data.genre

    if data.genre_settings is not None:
        # Merge with existing genre_settings (partial update)
        # First get current settings - handle case where column doesn't exist
        try:
            current_query = "SELECT genre_settings FROM series WHERE id = :id"
            current_row = await db.fetch_one(current_query, {"id": str(series_id)})
            if current_row:
                current_settings = current_row.get("genre_settings") or {}
                if isinstance(current_settings, str):
                    current_settings = json.loads(current_settings)
                # Merge new settings on top of existing
                merged_settings = {**current_settings, **data.genre_settings}
                updates.append("genre_settings = :genre_settings")
                values["genre_settings"] = json.dumps(merged_settings)
            else:
                updates.append("genre_settings = :genre_settings")
                values["genre_settings"] = json.dumps(data.genre_settings)
        except Exception:
            # Column doesn't exist yet - skip this update
            pass

    if data.featured_characters is not None:
        updates.append("featured_characters = :featured_characters")
        values["featured_characters"] = [str(c) for c in data.featured_characters]

    if data.episode_order is not None:
        updates.append("episode_order = :episode_order")
        values["episode_order"] = [str(e) for e in data.episode_order]

    if data.cover_image_url is not None:
        updates.append("cover_image_url = :cover_image_url")
        values["cover_image_url"] = data.cover_image_url

    if data.thumbnail_url is not None:
        updates.append("thumbnail_url = :thumbnail_url")
        values["thumbnail_url"] = data.thumbnail_url

    if data.status is not None:
        updates.append("status = :status")
        values["status"] = data.status

    if data.is_featured is not None:
        updates.append("is_featured = :is_featured")
        values["is_featured"] = data.is_featured
        if data.is_featured:
            updates.append("featured_at = NOW()")

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    updates.append("updated_at = NOW()")

    query = f"""
        UPDATE series
        SET {", ".join(updates)}
        WHERE id = :id
        RETURNING *
    """

    row = await db.fetch_one(query, values)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Series not found"
        )

    return Series(**dict(row))


@router.post("/{series_id}/activate", response_model=Series)
async def activate_series(
    series_id: UUID,
    db=Depends(get_db),
):
    """Activate a series (change status from draft to active)."""
    query = """
        UPDATE series
        SET status = 'active', updated_at = NOW()
        WHERE id = :id
        RETURNING *
    """

    row = await db.fetch_one(query, {"id": str(series_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Series not found"
        )

    return Series(**dict(row))


@router.post("/{series_id}/feature", response_model=Series)
async def feature_series(
    series_id: UUID,
    db=Depends(get_db),
):
    """Feature a series (set is_featured to true)."""
    query = """
        UPDATE series
        SET is_featured = TRUE, featured_at = NOW(), status = 'featured', updated_at = NOW()
        WHERE id = :id
        RETURNING *
    """

    row = await db.fetch_one(query, {"id": str(series_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Series not found"
        )

    return Series(**dict(row))


@router.delete("/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_series(
    series_id: UUID,
    db=Depends(get_db),
):
    """Delete a series (soft delete - sets status to archived)."""
    query = """
        UPDATE series
        SET status = 'archived', updated_at = NOW()
        WHERE id = :id
        RETURNING id
    """

    row = await db.fetch_one(query, {"id": str(series_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Series not found"
        )

    return None


# =============================================================================
# Series Cover Generation
# =============================================================================

class GenerateCoverResponse(BaseModel):
    """Response from cover generation."""
    success: bool
    storage_path: Optional[str] = None
    image_url: Optional[str] = None
    error: Optional[str] = None


@router.post("/{series_id}/generate-cover", response_model=GenerateCoverResponse)
async def generate_series_cover(
    series_id: UUID,
    force: bool = Query(False, description="Force regenerate even if cover exists"),
    db=Depends(get_db),
):
    """Generate or regenerate the series cover image.

    Uses pre-defined cover prompt if available for the series slug.
    Stores the storage path (not signed URL) in the database.
    """
    import logging
    from app.services.image import ImageService

    log = logging.getLogger(__name__)

    # Get series data
    query = "SELECT id, title, slug, cover_image_url FROM series WHERE id = :id"
    row = await db.fetch_one(query, {"id": str(series_id)})

    if not row:
        raise HTTPException(status_code=404, detail="Series not found")

    series_data = dict(row)
    series_slug = series_data["slug"]

    # Check if already has cover and not forcing
    if series_data.get("cover_image_url") and not force:
        return GenerateCoverResponse(
            success=False,
            error="Series already has a cover. Use force=true to regenerate."
        )

    # Import cover prompt builders
    try:
        from app.services.content_image_generation import (
            SERIES_COVER_PROMPTS,
            ASPECT_RATIOS,
            ImageType,
        )
    except ImportError as e:
        return GenerateCoverResponse(success=False, error=f"Import error: {e}")

    # Get series-specific cover prompt builder
    cover_builder = SERIES_COVER_PROMPTS.get(series_slug)
    if not cover_builder:
        return GenerateCoverResponse(
            success=False,
            error=f"No cover prompt configured for series '{series_slug}'. Add one to SERIES_COVER_PROMPTS."
        )

    # Build prompt
    prompt, negative = cover_builder()

    log.info(f"Generating cover for series '{series_slug}'")
    log.info(f"Prompt: {prompt[:200]}...")

    try:
        # Generate image
        image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")
        width, height = ASPECT_RATIOS[ImageType.SERIES_COVER]

        result = await image_service.generate(
            prompt=prompt,
            negative_prompt=negative,
            width=width,
            height=height,
        )

        if not result.images:
            return GenerateCoverResponse(success=False, error="No image returned from generation")

        # Upload to storage
        storage = StorageService.get_instance()
        storage_path = f"series/{series_slug}/cover.png"

        # Upload to Supabase
        await storage._upload("scenes", storage_path, result.images[0], "image/png")

        # Store storage path (not signed URL) in database
        await db.execute(
            "UPDATE series SET cover_image_url = :path, updated_at = NOW() WHERE id = :id",
            {"path": storage_path, "id": str(series_id)}
        )

        # Generate signed URL for immediate response
        image_url = await storage.create_signed_url("scenes", storage_path)

        log.info(f"Series cover generated and saved to: {storage_path}")

        return GenerateCoverResponse(
            success=True,
            storage_path=storage_path,
            image_url=image_url,
        )

    except Exception as e:
        log.error(f"Cover generation failed: {e}")
        return GenerateCoverResponse(success=False, error=str(e))


# =============================================================================
# Episode Progress (User-specific)
# =============================================================================

class EpisodeProgress(BaseModel):
    """Episode progress for a user within a series."""
    episode_id: str
    status: str  # "not_started", "in_progress", "completed"
    last_played_at: Optional[str] = None


class SeriesProgressResponse(BaseModel):
    """Progress for all episodes in a series."""
    series_id: str
    progress: List[EpisodeProgress]


@router.get("/{series_id}/progress", response_model=SeriesProgressResponse)
async def get_series_progress(
    series_id: UUID,
    request: Request,
    db=Depends(get_db),
):
    """Get user's progress through episodes in a series.

    Derives progress from session states:
    - not_started: No session exists for the episode template
    - in_progress: Session exists with state active/paused
    - completed: Session exists with state complete/faded
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get all episode templates for this series
    episodes_query = """
        SELECT id FROM episode_templates
        WHERE series_id = :series_id
        ORDER BY sort_order, episode_number
    """
    episode_rows = await db.fetch_all(episodes_query, {"series_id": str(series_id)})
    episode_ids = [str(row["id"]) for row in episode_rows]

    if not episode_ids:
        return SeriesProgressResponse(series_id=str(series_id), progress=[])

    # Get sessions for these episodes
    # COALESCE handles NULL session_state (legacy data) - treat as 'active' for progress tracking
    sessions_query = """
        SELECT
            episode_template_id,
            COALESCE(session_state, 'active') as session_state,
            MAX(started_at) as last_played_at
        FROM sessions
        WHERE user_id = :user_id
        AND episode_template_id = ANY(:episode_ids)
        GROUP BY episode_template_id, COALESCE(session_state, 'active')
        ORDER BY episode_template_id, last_played_at DESC
    """
    session_rows = await db.fetch_all(sessions_query, {
        "user_id": user_id,
        "episode_ids": episode_ids,
    })

    # Build a map of episode_template_id -> best status
    episode_status: dict = {}
    for row in session_rows:
        ep_id = str(row["episode_template_id"])
        state = row["session_state"]
        last_played = row["last_played_at"]

        # Map session_state to progress status
        if state in ("complete", "faded"):
            status = "completed"
        elif state in ("active", "paused"):
            status = "in_progress"
        else:
            status = "in_progress"  # Default for unknown states

        # Keep the best status (completed > in_progress)
        current = episode_status.get(ep_id, {})
        if not current or status == "completed" or (status == "in_progress" and current.get("status") == "not_started"):
            episode_status[ep_id] = {
                "status": status,
                "last_played_at": last_played.isoformat() if last_played else None,
            }

    # Build response with all episodes
    progress = []
    for ep_id in episode_ids:
        if ep_id in episode_status:
            progress.append(EpisodeProgress(
                episode_id=ep_id,
                status=episode_status[ep_id]["status"],
                last_played_at=episode_status[ep_id]["last_played_at"],
            ))
        else:
            progress.append(EpisodeProgress(
                episode_id=ep_id,
                status="not_started",
            ))

    return SeriesProgressResponse(series_id=str(series_id), progress=progress)


# =============================================================================
# User Engagement with Series (Stats + Current Progress)
# =============================================================================

class SeriesEngagementStats(BaseModel):
    """User's engagement stats with a series."""
    total_sessions: int
    total_messages: int
    episodes_completed: int
    episodes_in_progress: int
    first_played_at: Optional[str] = None
    last_played_at: Optional[str] = None


class CurrentEpisodeInfo(BaseModel):
    """Info about user's current/next episode."""
    episode_id: str
    episode_number: int
    title: str
    situation: Optional[str] = None
    status: str  # "not_started", "in_progress", "completed"


class SeriesUserContextResponse(BaseModel):
    """Full user context for a series - stats, progress, current episode."""
    series_id: str
    has_started: bool
    engagement: SeriesEngagementStats
    current_episode: Optional[CurrentEpisodeInfo] = None
    character_id: Optional[str] = None


@router.get("/{series_id}/user-context", response_model=SeriesUserContextResponse)
async def get_series_user_context(
    series_id: UUID,
    request: Request,
    db=Depends(get_db),
):
    """Get user's full context for a series - engagement stats and current progress.

    Returns:
    - Whether user has started the series
    - Engagement stats (sessions, messages, episodes completed)
    - Current/next episode to continue
    - Character ID for the series
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    series_id_str = str(series_id)

    # Get all episode-based sessions for this series (excludes free chat)
    sessions_query = """
        SELECT
            s.id,
            s.episode_template_id,
            s.character_id,
            s.session_state,
            s.started_at,
            COALESCE(
                (SELECT COUNT(*) FROM messages m WHERE m.episode_id = s.id),
                0
            ) as message_count
        FROM sessions s
        WHERE s.user_id = :user_id
        AND s.series_id = :series_id
        AND s.episode_template_id IS NOT NULL
        ORDER BY s.started_at DESC
    """
    session_rows = await db.fetch_all(sessions_query, {
        "user_id": user_id,
        "series_id": series_id_str,
    })

    # Calculate engagement stats
    total_sessions = len(session_rows)
    total_messages = sum(row["message_count"] for row in session_rows)

    # Track episode statuses and find most recent episode session
    episode_statuses: dict = {}
    character_id = None
    first_played_at = None
    last_played_at = None
    most_recent_episode_id = None  # Track the most recently played episode

    for row in session_rows:
        ep_id = str(row["episode_template_id"]) if row["episode_template_id"] else None
        state = row["session_state"]
        started = row["started_at"]

        if not character_id and row["character_id"]:
            character_id = str(row["character_id"])

        if started:
            if not last_played_at:
                last_played_at = started
            first_played_at = started

        if ep_id:
            # Track most recent episode (first one we see since ordered by started_at DESC)
            if most_recent_episode_id is None:
                most_recent_episode_id = ep_id

            # Map session_state to progress status
            if state in ("complete", "faded"):
                status = "completed"
            else:
                status = "in_progress"

            # Keep best status per episode
            current = episode_statuses.get(ep_id, "not_started")
            if status == "completed" or (status == "in_progress" and current == "not_started"):
                episode_statuses[ep_id] = status

    episodes_completed = sum(1 for s in episode_statuses.values() if s == "completed")
    episodes_in_progress = sum(1 for s in episode_statuses.values() if s == "in_progress")

    # Get episode templates to find current/next episode
    episodes_query = """
        SELECT id, episode_number, title, situation
        FROM episode_templates
        WHERE series_id = :series_id
        AND status = 'active'
        ORDER BY sort_order, episode_number
    """
    episode_rows = await db.fetch_all(episodes_query, {"series_id": series_id_str})

    # Find current episode - use most recently played episode if available
    current_episode = None

    # First try: use the most recently played episode
    if most_recent_episode_id:
        for row in episode_rows:
            if str(row["id"]) == most_recent_episode_id:
                ep_status = episode_statuses.get(most_recent_episode_id, "in_progress")
                current_episode = CurrentEpisodeInfo(
                    episode_id=most_recent_episode_id,
                    episode_number=row["episode_number"],
                    title=row["title"],
                    situation=row["situation"],
                    status=ep_status,
                )
                break

    # Fallback: first episode if user hasn't started any
    if not current_episode and episode_rows:
        first_ep = episode_rows[0]
        current_episode = CurrentEpisodeInfo(
            episode_id=str(first_ep["id"]),
            episode_number=first_ep["episode_number"],
            title=first_ep["title"],
            situation=first_ep["situation"],
            status="not_started",
        )

    return SeriesUserContextResponse(
        series_id=series_id_str,
        has_started=total_sessions > 0,
        engagement=SeriesEngagementStats(
            total_sessions=total_sessions,
            total_messages=total_messages,
            episodes_completed=episodes_completed,
            episodes_in_progress=episodes_in_progress,
            first_played_at=first_played_at.isoformat() if first_played_at else None,
            last_played_at=last_played_at.isoformat() if last_played_at else None,
        ),
        current_episode=current_episode,
        character_id=character_id,
    )


# =============================================================================
# Continue Watching (User's Active Series)
# =============================================================================

class ContinueWatchingItem(BaseModel):
    """A series the user has started with their current progress."""
    series_id: str
    series_title: str
    series_slug: str
    series_cover_image_url: Optional[str] = None
    series_genre: Optional[str] = None
    total_episodes: int

    # Current episode info
    current_episode_id: str
    current_episode_title: str
    current_episode_number: int
    character_id: str
    character_name: str

    # Progress
    last_played_at: str
    session_state: str  # active, paused, faded, complete


class ContinueWatchingResponse(BaseModel):
    """User's continue watching list."""
    items: List[ContinueWatchingItem]


@router.get("/user/continue-watching", response_model=ContinueWatchingResponse)
async def get_continue_watching(
    request: Request,
    limit: int = Query(10, ge=1, le=50),
    db=Depends(get_db),
):
    """Get user's 'Continue Watching' list - series with active/recent sessions.

    Returns series the user has interacted with, sorted by most recent activity.
    Each item includes the current episode they're on.
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get user's most recent session per series, with series and episode info
    # Only include sessions that have an episode template (exclude free chat sessions)
    # Excludes 'play' type series (viral/game content) from main app continue watching
    query = """
        WITH ranked_sessions AS (
            SELECT
                s.id as session_id,
                s.series_id,
                s.episode_template_id,
                s.character_id,
                s.session_state,
                s.started_at,
                ROW_NUMBER() OVER (PARTITION BY s.series_id ORDER BY s.started_at DESC) as rn
            FROM sessions s
            WHERE s.user_id = :user_id
            AND s.series_id IS NOT NULL
            AND s.episode_template_id IS NOT NULL
        )
        SELECT
            rs.session_id,
            rs.series_id,
            rs.episode_template_id,
            rs.character_id,
            rs.session_state,
            rs.started_at,
            ser.title as series_title,
            ser.slug as series_slug,
            ser.cover_image_url as series_cover_image_url,
            ser.genre as series_genre,
            ser.total_episodes,
            et.title as episode_title,
            et.episode_number,
            c.name as character_name
        FROM ranked_sessions rs
        JOIN series ser ON ser.id = rs.series_id
        LEFT JOIN episode_templates et ON et.id = rs.episode_template_id
        LEFT JOIN characters c ON c.id = rs.character_id
        WHERE rs.rn = 1
        AND ser.series_type != 'play'
        ORDER BY rs.started_at DESC
        LIMIT :limit
    """

    rows = await db.fetch_all(query, {"user_id": user_id, "limit": limit})

    storage = StorageService.get_instance()
    items = []
    for row in rows:
        # Convert storage path to signed URL if needed
        cover_url = normalize_series_cover_path(row["series_cover_image_url"], row["series_slug"])
        if cover_url and not cover_url.startswith("http"):
            cover_url = await storage.create_signed_url("scenes", cover_url, expires_in=3600)

        items.append(ContinueWatchingItem(
            series_id=str(row["series_id"]),
            series_title=row["series_title"],
            series_slug=row["series_slug"],
            series_cover_image_url=cover_url,
            series_genre=row["series_genre"],
            total_episodes=row["total_episodes"] or 0,
            current_episode_id=str(row["episode_template_id"]) if row["episode_template_id"] else "",
            current_episode_title=row["episode_title"] or "Episode",
            current_episode_number=row["episode_number"] or 1,
            character_id=str(row["character_id"]),
            character_name=row["character_name"] or "Character",
            last_played_at=row["started_at"].isoformat() if row["started_at"] else "",
            session_state=row["session_state"] or "active",
        ))

    return ContinueWatchingResponse(items=items)


# =============================================================================
# Genre Settings Management
# =============================================================================

class GenreSettingsOptions(BaseModel):
    """Available options for genre settings fields."""
    tension_styles: List[str] = TENSION_STYLES
    pacing_curves: List[str] = PACING_CURVES
    resolution_modes: List[str] = RESOLUTION_MODES
    vulnerability_timings: List[str] = VULNERABILITY_TIMINGS
    presets: dict = Field(default_factory=lambda: GENRE_SETTING_PRESETS)


class ApplyGenrePresetRequest(BaseModel):
    """Request to apply a genre preset."""
    preset: str = Field(..., description="Preset name: romantic_tension, psychological_thriller, slice_of_life")


class GenreSettingsResponse(BaseModel):
    """Genre settings with resolved values."""
    genre: Optional[str] = None
    settings: dict = Field(default_factory=dict)
    prompt_section: str = ""


@router.get("/meta/genre-options", response_model=GenreSettingsOptions)
async def get_genre_options():
    """Get available genre settings options and presets.

    Use this to populate UI dropdowns for genre settings.
    """
    return GenreSettingsOptions()


@router.get("/{series_id}/genre-settings", response_model=GenreSettingsResponse)
async def get_series_genre_settings(
    series_id: UUID,
    db=Depends(get_db),
):
    """Get resolved genre settings for a series.

    Returns the merged settings (preset defaults + custom overrides)
    and the formatted prompt section that would be injected into LLM context.
    """
    # Check if genre_settings column exists (migration may not be applied yet)
    try:
        query = "SELECT genre, genre_settings FROM series WHERE id = :id"
        row = await db.fetch_one(query, {"id": str(series_id)})
    except Exception:
        # Column doesn't exist yet - fall back to just genre
        query = "SELECT genre FROM series WHERE id = :id"
        row = await db.fetch_one(query, {"id": str(series_id)})

    if not row:
        raise HTTPException(status_code=404, detail="Series not found")

    genre = row["genre"] or "romantic_tension"
    genre_settings_raw = row.get("genre_settings") or {}

    if isinstance(genre_settings_raw, str):
        genre_settings_raw = json.loads(genre_settings_raw)

    # Get preset defaults
    preset = GENRE_SETTING_PRESETS.get(genre, GENRE_SETTING_PRESETS["romantic_tension"])

    # Merge with custom settings
    merged = {**preset, **genre_settings_raw}

    # Create GenreSettings object and format prompt
    settings_obj = GenreSettings(**merged)
    prompt_section = settings_obj.to_prompt_section()

    return GenreSettingsResponse(
        genre=genre,
        settings=merged,
        prompt_section=prompt_section,
    )


@router.post("/{series_id}/apply-genre-preset", response_model=Series)
async def apply_genre_preset(
    series_id: UUID,
    data: ApplyGenrePresetRequest,
    db=Depends(get_db),
):
    """Apply a genre preset to a series.

    This sets the genre and applies the preset's default settings.
    Custom overrides can be added via PATCH /series/{id} with genre_settings.
    """
    preset_name = data.preset
    if preset_name not in GENRE_SETTING_PRESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown preset: {preset_name}. Available: {list(GENRE_SETTING_PRESETS.keys())}"
        )

    preset = GENRE_SETTING_PRESETS[preset_name]

    # Try with genre_settings column first, fall back to just genre if column doesn't exist
    try:
        query = """
            UPDATE series
            SET genre = :genre, genre_settings = :genre_settings, updated_at = NOW()
            WHERE id = :id
            RETURNING *
        """
        row = await db.fetch_one(query, {
            "id": str(series_id),
            "genre": preset_name,
            "genre_settings": json.dumps(preset),
        })
    except Exception:
        # Column doesn't exist yet - just update genre
        query = """
            UPDATE series
            SET genre = :genre, updated_at = NOW()
            WHERE id = :id
            RETURNING *
        """
        row = await db.fetch_one(query, {
            "id": str(series_id),
            "genre": preset_name,
        })

    if not row:
        raise HTTPException(status_code=404, detail="Series not found")

    return Series(**dict(row))


@router.delete("/{series_id}/reset", status_code=status.HTTP_200_OK)
async def reset_series_progress(
    series_id: UUID,
    request: Request,
    db=Depends(get_db),
):
    """
    Reset all progress for a series.

    This performs a series-scoped purge:
    - Deletes all sessions for this series (and their messages via CASCADE)
    - Soft-deletes all memories from episodes in this series

    This action is irreversible.
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Verify series exists
    check_query = """
        SELECT id FROM series WHERE id = :series_id
    """
    series = await db.fetch_one(check_query, {"series_id": str(series_id)})

    if not series:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Series not found",
        )

    # 1. Delete all episode-based sessions for this series (messages cascade automatically)
    # Only delete sessions with episode_template_id set (excludes free chat)
    delete_sessions_query = """
        DELETE FROM sessions
        WHERE user_id = :user_id
        AND series_id = :series_id
        AND episode_template_id IS NOT NULL
    """
    result = await db.execute(
        delete_sessions_query, {"user_id": user_id, "series_id": str(series_id)}
    )

    # 2. Soft-delete memories scoped to episodes in this series
    # Memory events are linked to characters, but we can identify them via episode_id
    # which references episode_templates that belong to this series
    delete_memories_query = """
        UPDATE memory_events
        SET is_active = FALSE
        WHERE user_id = :user_id
        AND episode_id IN (
            SELECT id FROM episode_templates WHERE series_id = :series_id
        )
    """
    await db.execute(
        delete_memories_query, {"user_id": user_id, "series_id": str(series_id)}
    )

    return {"status": "reset", "series_id": str(series_id)}
