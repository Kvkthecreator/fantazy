"""Episode Templates API routes.

Episode templates are pre-defined scenarios/cold opens that users can choose
to start a chat from. Each character has multiple episode templates.

- Episode 0: Default "first meeting" scenario
- Episode 1+: Additional scenarios (relationship shift, tension peak, etc.)
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.deps import get_db
from app.services.storage import StorageService


router = APIRouter(prefix="/episode-templates", tags=["Episode Templates"])


async def _get_signed_url(path: Optional[str]) -> Optional[str]:
    """Generate a signed URL for a storage path."""
    if not path:
        return None
    storage = StorageService.get_instance()
    return await storage.create_signed_url("scenes", path, expires_in=3600)


# =============================================================================
# Pydantic Models
# =============================================================================

class EpisodeTemplateBase(BaseModel):
    """Base episode template fields."""
    title: str
    slug: str
    situation: str
    opening_line: str
    episode_frame: Optional[str] = None
    arc_hints: Optional[List[dict]] = []


class EpisodeTemplateCreate(EpisodeTemplateBase):
    """Create episode template request."""
    character_id: UUID
    episode_number: int = 0
    is_default: bool = False


class EpisodeTemplateUpdate(BaseModel):
    """Update episode template request."""
    title: Optional[str] = None
    situation: Optional[str] = None
    opening_line: Optional[str] = None
    episode_frame: Optional[str] = None
    arc_hints: Optional[List[dict]] = None
    background_image_url: Optional[str] = None
    status: Optional[str] = None


class EpisodeTemplate(EpisodeTemplateBase):
    """Episode template response."""
    id: UUID
    character_id: UUID
    episode_number: int
    episode_type: str = "core"  # entry, core, expansion, special
    background_image_url: Optional[str] = None
    is_default: bool
    sort_order: int
    status: str

    class Config:
        from_attributes = True


class EpisodeTemplateSummary(BaseModel):
    """Summary for episode selection UI."""
    id: UUID
    episode_number: int
    episode_type: str = "core"  # entry, core, expansion, special
    title: str
    slug: str
    background_image_url: Optional[str] = None
    is_default: bool


class EpisodeDiscoveryItem(BaseModel):
    """Episode with character context for discovery UI."""
    id: UUID
    episode_number: int
    episode_type: str = "core"  # entry, core, expansion, special
    title: str
    slug: str
    situation: str
    background_image_url: Optional[str] = None
    is_default: bool
    # Character context
    character_id: UUID
    character_name: str
    character_slug: str
    character_archetype: str
    character_avatar_url: Optional[str] = None


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("", response_model=List[EpisodeDiscoveryItem])
async def list_all_episodes(
    archetype: Optional[str] = Query(None, description="Filter by character archetype"),
    featured: bool = Query(False, description="Only return featured episodes"),
    limit: int = Query(50, ge=1, le=100, description="Max episodes to return"),
    db=Depends(get_db),
):
    """List all active episodes across all characters.

    Primary discovery endpoint for episode-first UX.
    Returns episodes with character context for display.
    """
    query = """
        SELECT
            et.id,
            et.episode_number,
            et.episode_type,
            et.title,
            et.slug,
            et.situation,
            et.background_image_url,
            et.is_default,
            c.id as character_id,
            c.name as character_name,
            c.slug as character_slug,
            c.archetype as character_archetype,
            c.avatar_url as character_avatar_url
        FROM episode_templates et
        JOIN characters c ON et.character_id = c.id
        WHERE et.status = 'active'
        AND c.status = 'active'
    """
    params = {}

    if archetype:
        query += " AND c.archetype = :archetype"
        params["archetype"] = archetype

    if featured:
        # Featured = default episodes (Episode 0s) for now
        query += " AND et.is_default = TRUE"

    query += " ORDER BY et.is_default DESC, c.sort_order, et.sort_order LIMIT :limit"
    params["limit"] = limit

    rows = await db.fetch_all(query, params)

    # Generate signed URLs
    results = []
    for row in rows:
        data = dict(row)
        data["background_image_url"] = await _get_signed_url(data.get("background_image_url"))
        # Character avatar URL is already a full URL from characters table
        results.append(EpisodeDiscoveryItem(**data))

    return results


@router.get("/character/{character_id}", response_model=List[EpisodeTemplateSummary])
async def list_character_episodes(
    character_id: UUID,
    status: Optional[str] = Query("active", description="Filter by status"),
    db=Depends(get_db),
):
    """List all episode templates for a character.

    Returns episodes in sort order for episode selection UI.
    """
    query = """
        SELECT id, episode_number, episode_type, title, slug, background_image_url, is_default
        FROM episode_templates
        WHERE character_id = :character_id
        AND status = :status
        ORDER BY sort_order, episode_number
    """

    rows = await db.fetch_all(query, {
        "character_id": str(character_id),
        "status": status,
    })

    # Generate signed URLs for background images
    results = []
    for row in rows:
        data = dict(row)
        data["background_image_url"] = await _get_signed_url(data.get("background_image_url"))
        results.append(EpisodeTemplateSummary(**data))

    return results


@router.get("/{template_id}", response_model=EpisodeTemplate)
async def get_episode_template(
    template_id: UUID,
    db=Depends(get_db),
):
    """Get a specific episode template by ID."""
    query = """
        SELECT id, character_id, episode_number, title, slug,
               situation, opening_line, background_image_url,
               episode_frame, arc_hints, is_default, sort_order, status
        FROM episode_templates
        WHERE id = :id
    """

    row = await db.fetch_one(query, {"id": str(template_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found"
        )

    data = dict(row)
    data["background_image_url"] = await _get_signed_url(data.get("background_image_url"))
    return EpisodeTemplate(**data)


@router.get("/character/{character_id}/default", response_model=EpisodeTemplate)
async def get_default_episode(
    character_id: UUID,
    db=Depends(get_db),
):
    """Get the default (Episode 0) template for a character."""
    query = """
        SELECT id, character_id, episode_number, title, slug,
               situation, opening_line, background_image_url,
               episode_frame, arc_hints, is_default, sort_order, status
        FROM episode_templates
        WHERE character_id = :character_id
        AND is_default = TRUE
        AND status = 'active'
    """

    row = await db.fetch_one(query, {"character_id": str(character_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No default episode template found for character"
        )

    data = dict(row)
    data["background_image_url"] = await _get_signed_url(data.get("background_image_url"))
    return EpisodeTemplate(**data)


@router.post("", response_model=EpisodeTemplate, status_code=status.HTTP_201_CREATED)
async def create_episode_template(
    data: EpisodeTemplateCreate,
    db=Depends(get_db),
):
    """Create a new episode template for a character.

    Admin/Studio endpoint for content creation.
    """
    # Verify character exists
    char = await db.fetch_one(
        "SELECT id FROM characters WHERE id = :id",
        {"id": str(data.character_id)}
    )
    if not char:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found"
        )

    # Get next sort order
    max_sort = await db.fetch_one(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort FROM episode_templates WHERE character_id = :id",
        {"id": str(data.character_id)}
    )

    query = """
        INSERT INTO episode_templates (
            character_id, episode_number, title, slug,
            situation, opening_line, episode_frame, arc_hints,
            is_default, sort_order, status
        ) VALUES (
            :character_id, :episode_number, :title, :slug,
            :situation, :opening_line, :episode_frame, :arc_hints,
            :is_default, :sort_order, 'draft'
        )
        RETURNING id, character_id, episode_number, title, slug,
                  situation, opening_line, background_image_url,
                  episode_frame, arc_hints, is_default, sort_order, status
    """

    import json
    row = await db.fetch_one(query, {
        "character_id": str(data.character_id),
        "episode_number": data.episode_number,
        "title": data.title,
        "slug": data.slug,
        "situation": data.situation,
        "opening_line": data.opening_line,
        "episode_frame": data.episode_frame,
        "arc_hints": json.dumps(data.arc_hints or []),
        "is_default": data.is_default,
        "sort_order": max_sort["next_sort"],
    })

    return EpisodeTemplate(**dict(row))


@router.patch("/{template_id}", response_model=EpisodeTemplate)
async def update_episode_template(
    template_id: UUID,
    data: EpisodeTemplateUpdate,
    db=Depends(get_db),
):
    """Update an episode template.

    Admin/Studio endpoint for content editing.
    """
    # Build dynamic update
    updates = []
    values = {"id": str(template_id)}

    if data.title is not None:
        updates.append("title = :title")
        values["title"] = data.title
    if data.situation is not None:
        updates.append("situation = :situation")
        values["situation"] = data.situation
    if data.opening_line is not None:
        updates.append("opening_line = :opening_line")
        values["opening_line"] = data.opening_line
    if data.episode_frame is not None:
        updates.append("episode_frame = :episode_frame")
        values["episode_frame"] = data.episode_frame
    if data.arc_hints is not None:
        import json
        updates.append("arc_hints = :arc_hints")
        values["arc_hints"] = json.dumps(data.arc_hints)
    if data.background_image_url is not None:
        updates.append("background_image_url = :background_image_url")
        values["background_image_url"] = data.background_image_url
    if data.status is not None:
        updates.append("status = :status")
        values["status"] = data.status

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    updates.append("updated_at = NOW()")

    query = f"""
        UPDATE episode_templates
        SET {", ".join(updates)}
        WHERE id = :id
        RETURNING id, character_id, episode_number, title, slug,
                  situation, opening_line, background_image_url,
                  episode_frame, arc_hints, is_default, sort_order, status
    """

    row = await db.fetch_one(query, values)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found"
        )

    return EpisodeTemplate(**dict(row))


@router.post("/{template_id}/activate", response_model=EpisodeTemplate)
async def activate_episode_template(
    template_id: UUID,
    db=Depends(get_db),
):
    """Activate an episode template (change status from draft to active)."""
    query = """
        UPDATE episode_templates
        SET status = 'active', updated_at = NOW()
        WHERE id = :id
        RETURNING id, character_id, episode_number, title, slug,
                  situation, opening_line, background_image_url,
                  episode_frame, arc_hints, is_default, sort_order, status
    """

    row = await db.fetch_one(query, {"id": str(template_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found"
        )

    return EpisodeTemplate(**dict(row))
