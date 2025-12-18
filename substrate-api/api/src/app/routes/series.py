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
from app.models.series import (
    Series,
    SeriesSummary,
    SeriesCreate,
    SeriesUpdate,
    SeriesType,
)
from app.services.storage import StorageService


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
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db),
):
    """List all series with optional filters."""
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
        query += " AND series_type = :series_type"
        params["series_type"] = series_type

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
        # If cover_image_url is a storage path (not a full URL), generate signed URL
        if data.get("cover_image_url") and not data["cover_image_url"].startswith("http"):
            data["cover_image_url"] = await storage.create_signed_url(
                "scenes", data["cover_image_url"], expires_in=3600
            )
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
    if data.get("cover_image_url") and not data["cover_image_url"].startswith("http"):
        storage = StorageService.get_instance()
        data["cover_image_url"] = await storage.create_signed_url(
            "scenes", data["cover_image_url"], expires_in=3600
        )

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
    if series_data.get("cover_image_url") and not series_data["cover_image_url"].startswith("http"):
        series_data["cover_image_url"] = await storage.create_signed_url(
            "scenes", series_data["cover_image_url"], expires_in=3600
        )

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
    if series_data.get("cover_image_url") and not series_data["cover_image_url"].startswith("http"):
        storage = StorageService.get_instance()
        series_data["cover_image_url"] = await storage.create_signed_url(
            "scenes", series_data["cover_image_url"], expires_in=3600
        )

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
    sessions_query = """
        SELECT
            episode_template_id,
            session_state,
            MAX(started_at) as last_played_at
        FROM sessions
        WHERE user_id = :user_id
        AND episode_template_id = ANY(:episode_ids)
        GROUP BY episode_template_id, session_state
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
        ORDER BY rs.started_at DESC
        LIMIT :limit
    """

    rows = await db.fetch_all(query, {"user_id": user_id, "limit": limit})

    storage = StorageService.get_instance()
    items = []
    for row in rows:
        # Convert storage path to signed URL if needed
        cover_url = row["series_cover_image_url"]
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
