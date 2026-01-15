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
    """Generate a signed URL for a storage path, or return external URLs directly."""
    if not path:
        return None
    # If it's already an external URL (e.g., from Replicate), return as-is
    if path.startswith("http://") or path.startswith("https://"):
        return path
    # Otherwise, treat as Supabase storage path and generate signed URL
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
    # Episode Dynamics (per EPISODE_DYNAMICS_CANON.md)
    dramatic_question: Optional[str] = None
    resolution_types: Optional[List[str]] = ["positive", "neutral", "negative"]
    # Scene motivation (ADR-002: Theatrical Model)
    scene_objective: Optional[str] = None  # What character wants from user this scene
    scene_obstacle: Optional[str] = None   # What's stopping them from just asking
    scene_tactic: Optional[str] = None     # How they're trying to get what they want


class EpisodeTemplateCreate(EpisodeTemplateBase):
    """Create episode template request."""
    character_id: UUID
    series_id: Optional[UUID] = None
    role_id: Optional[UUID] = None
    episode_number: int = 0
    is_default: bool = False


class EpisodeTemplateUpdate(BaseModel):
    """Update episode template request."""
    title: Optional[str] = None
    situation: Optional[str] = None
    opening_line: Optional[str] = None
    episode_frame: Optional[str] = None
    background_image_url: Optional[str] = None
    status: Optional[str] = None
    series_id: Optional[UUID] = None
    role_id: Optional[UUID] = None
    # Episode Dynamics
    dramatic_question: Optional[str] = None
    resolution_types: Optional[List[str]] = None
    # Scene motivation (ADR-002: Theatrical Model)
    scene_objective: Optional[str] = None
    scene_obstacle: Optional[str] = None
    scene_tactic: Optional[str] = None


class EpisodeTemplate(EpisodeTemplateBase):
    """Episode template response."""
    id: UUID
    character_id: UUID
    series_id: Optional[UUID] = None
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
    episode_cost: int = 0  # Sparks required to start (0 for free episodes)


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
    episode_cost: int = 0  # Sparks required to start (0 for free episodes)
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
            COALESCE(et.episode_cost, 0) as episode_cost,
            c.id as character_id,
            c.name as character_name,
            c.slug as character_slug,
            c.archetype as character_archetype,
            c.avatar_url as character_avatar_url
        FROM episode_templates et
        JOIN characters c ON et.character_id = c.id
        WHERE et.status = 'active'
        AND c.status = 'active'
        AND (et.is_free_chat IS NULL OR et.is_free_chat = FALSE)
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
        SELECT id, episode_number, episode_type, title, slug, background_image_url, is_default,
               COALESCE(episode_cost, 0) as episode_cost
        FROM episode_templates
        WHERE character_id = :character_id
        AND status = :status
        AND (is_free_chat IS NULL OR is_free_chat = FALSE)
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
        SELECT id, character_id, series_id, episode_number, title, slug,
               situation, opening_line, background_image_url,
               episode_frame, is_default, sort_order, status,
               episode_type, dramatic_question,
               scene_objective, scene_obstacle, scene_tactic
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
        SELECT id, character_id, series_id, episode_number, title, slug,
               situation, opening_line, background_image_url,
               episode_frame, is_default, sort_order, status,
               episode_type, dramatic_question,
               scene_objective, scene_obstacle, scene_tactic
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

    # Validate: Episode 0 requires role_id
    if data.episode_number == 0 and not data.role_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Episode 0 requires role_id to be set"
        )

    query = """
        INSERT INTO episode_templates (
            character_id, series_id, role_id, episode_number, title, slug,
            situation, opening_line, episode_frame,
            dramatic_question, scene_objective, scene_obstacle, scene_tactic,
            is_default, sort_order, status
        ) VALUES (
            :character_id, :series_id, :role_id, :episode_number, :title, :slug,
            :situation, :opening_line, :episode_frame,
            :dramatic_question, :scene_objective, :scene_obstacle, :scene_tactic,
            :is_default, :sort_order, 'draft'
        )
        RETURNING id, character_id, series_id, role_id, episode_number, title, slug,
                  situation, opening_line, background_image_url,
                  episode_frame, is_default, sort_order, status,
                  episode_type, dramatic_question,
                  scene_objective, scene_obstacle, scene_tactic
    """

    row = await db.fetch_one(query, {
        "character_id": str(data.character_id),
        "series_id": str(data.series_id) if data.series_id else None,
        "role_id": str(data.role_id) if data.role_id else None,
        "episode_number": data.episode_number,
        "title": data.title,
        "slug": data.slug,
        "situation": data.situation,
        "opening_line": data.opening_line,
        "episode_frame": data.episode_frame,
        "dramatic_question": data.dramatic_question,
        "scene_objective": data.scene_objective,
        "scene_obstacle": data.scene_obstacle,
        "scene_tactic": data.scene_tactic,
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
    if data.background_image_url is not None:
        updates.append("background_image_url = :background_image_url")
        values["background_image_url"] = data.background_image_url
    if data.status is not None:
        updates.append("status = :status")
        values["status"] = data.status
    # Episode Dynamics
    if data.dramatic_question is not None:
        updates.append("dramatic_question = :dramatic_question")
        values["dramatic_question"] = data.dramatic_question
    if data.resolution_types is not None:
        updates.append("resolution_types = :resolution_types")
        values["resolution_types"] = data.resolution_types
    # Scene motivation (ADR-002: Theatrical Model)
    if data.scene_objective is not None:
        updates.append("scene_objective = :scene_objective")
        values["scene_objective"] = data.scene_objective
    if data.scene_obstacle is not None:
        updates.append("scene_obstacle = :scene_obstacle")
        values["scene_obstacle"] = data.scene_obstacle
    if data.scene_tactic is not None:
        updates.append("scene_tactic = :scene_tactic")
        values["scene_tactic"] = data.scene_tactic
    if data.series_id is not None:
        updates.append("series_id = :series_id")
        values["series_id"] = str(data.series_id)
    if data.role_id is not None:
        updates.append("role_id = :role_id")
        values["role_id"] = str(data.role_id)

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
        RETURNING id, character_id, series_id, role_id, episode_number, title, slug,
                  situation, opening_line, background_image_url,
                  episode_frame, is_default, sort_order, status,
                  episode_type, dramatic_question,
                  scene_objective, scene_obstacle, scene_tactic
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
        RETURNING id, character_id, series_id, episode_number, title, slug,
                  situation, opening_line, background_image_url,
                  episode_frame, is_default, sort_order, status,
                  episode_type, dramatic_question,
                  scene_objective, scene_obstacle, scene_tactic
    """

    row = await db.fetch_one(query, {"id": str(template_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found"
        )

    return EpisodeTemplate(**dict(row))


# =============================================================================
# Character Selection for Episodes (ADR-004)
# =============================================================================

class AvailableCharactersResponse(BaseModel):
    """Response for available characters for an episode."""
    canonical: Optional[dict] = None  # The episode's canonical character
    user_characters: List[dict] = []  # User's compatible characters


@router.get("/{template_id}/available-characters", response_model=AvailableCharactersResponse)
async def get_available_characters_for_episode(
    template_id: UUID,
    db=Depends(get_db),
    user_id: Optional[UUID] = None,  # TODO: Get from auth when available
):
    """Get characters available to play in this episode.

    ADR-004: Returns the canonical character plus any user-created characters
    that have a compatible archetype.

    Returns:
        - canonical: The episode's original/default character
        - user_characters: User's characters that can play this role
    """
    from app.models.role import get_compatible_archetypes

    # Get the episode template with its character
    template_query = """
        SELECT et.id, et.character_id, et.role_id,
               c.id as char_id, c.name as char_name, c.slug as char_slug,
               c.archetype as char_archetype, c.avatar_url as char_avatar_url
        FROM episode_templates et
        LEFT JOIN characters c ON c.id = et.character_id
        WHERE et.id = :template_id AND et.status = 'active'
    """
    template_row = await db.fetch_one(template_query, {"template_id": str(template_id)})

    if not template_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found"
        )

    template_data = dict(template_row)

    # Build canonical character response
    canonical = None
    if template_data.get("char_id"):
        canonical = {
            "id": template_data["char_id"],
            "name": template_data["char_name"],
            "slug": template_data["char_slug"],
            "archetype": template_data["char_archetype"],
            "avatar_url": template_data["char_avatar_url"],
            "is_canonical": True,
        }

    # Get the archetype required for this episode
    required_archetype = template_data.get("char_archetype")
    if not required_archetype:
        # No character assigned, any archetype works
        compatible_archetypes = None
    else:
        compatible_archetypes = get_compatible_archetypes(required_archetype)

    # Get user's compatible characters
    user_characters = []
    if user_id:
        if compatible_archetypes:
            # Filter by compatible archetypes
            user_chars_query = """
                SELECT id, name, slug, archetype, avatar_url
                FROM characters
                WHERE created_by = :user_id
                  AND is_user_created = TRUE
                  AND status = 'active'
                  AND archetype = ANY(:archetypes)
                ORDER BY created_at DESC
            """
            user_rows = await db.fetch_all(user_chars_query, {
                "user_id": str(user_id),
                "archetypes": compatible_archetypes,
            })
        else:
            # No archetype restriction, return all user characters
            user_chars_query = """
                SELECT id, name, slug, archetype, avatar_url
                FROM characters
                WHERE created_by = :user_id
                  AND is_user_created = TRUE
                  AND status = 'active'
                ORDER BY created_at DESC
            """
            user_rows = await db.fetch_all(user_chars_query, {"user_id": str(user_id)})

        for row in user_rows:
            user_characters.append({
                **dict(row),
                "is_canonical": False,
            })

    return AvailableCharactersResponse(
        canonical=canonical,
        user_characters=user_characters,
    )


# =============================================================================
# Props API (ADR-005)
# =============================================================================

class PropResponse(BaseModel):
    """Prop response model (ADR-005)."""
    id: UUID
    name: str
    slug: str
    prop_type: str
    description: str
    content: Optional[str] = None
    content_format: Optional[str] = None
    image_url: Optional[str] = None
    reveal_mode: str
    reveal_turn_hint: Optional[int] = None
    is_key_evidence: bool
    evidence_tags: List[str] = []
    display_order: int


class PropsListResponse(BaseModel):
    """Response for listing props."""
    props: List[PropResponse]
    episode_id: UUID
    episode_title: str


@router.get("/{template_id}/props", response_model=PropsListResponse)
async def get_episode_props(
    template_id: UUID,
    db=Depends(get_db),
):
    """Get all props for an episode template.

    ADR-005: Props are canonical story objects with exact, immutable content.
    They solve the "details don't stick" problem.

    Returns all props associated with this episode, ordered by display_order.
    """
    # First verify episode exists and get its title
    episode = await db.fetch_one(
        "SELECT id, title FROM episode_templates WHERE id = :id",
        {"id": str(template_id)}
    )

    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found"
        )

    # Get all props for this episode
    query = """
        SELECT id, name, slug, prop_type, description,
               content, content_format, image_url,
               reveal_mode, reveal_turn_hint,
               is_key_evidence, evidence_tags, display_order
        FROM props
        WHERE episode_template_id = :episode_id
        ORDER BY display_order, created_at
    """

    rows = await db.fetch_all(query, {"episode_id": str(template_id)})

    props = []
    for row in rows:
        data = dict(row)
        # Sign image URL if it's a storage path
        data["image_url"] = await _get_signed_url(data.get("image_url"))
        # Parse evidence_tags if it's a string
        if isinstance(data.get("evidence_tags"), str):
            import json
            data["evidence_tags"] = json.loads(data["evidence_tags"])
        props.append(PropResponse(**data))

    return PropsListResponse(
        props=props,
        episode_id=episode["id"],
        episode_title=episode["title"],
    )


class PropCreate(BaseModel):
    """Create prop request (ADR-005)."""
    name: str
    slug: str
    prop_type: str  # document, photo, object, recording, digital
    description: str
    content: Optional[str] = None
    content_format: Optional[str] = None
    image_url: Optional[str] = None
    reveal_mode: str = "character_initiated"
    reveal_turn_hint: Optional[int] = None
    is_key_evidence: bool = False
    badge_label: Optional[str] = None
    evidence_tags: List[str] = []
    display_order: Optional[int] = None


class PropUpdate(BaseModel):
    """Update prop request (ADR-005)."""
    name: Optional[str] = None
    slug: Optional[str] = None
    prop_type: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    content_format: Optional[str] = None
    image_url: Optional[str] = None
    reveal_mode: Optional[str] = None
    reveal_turn_hint: Optional[int] = None
    is_key_evidence: Optional[bool] = None
    badge_label: Optional[str] = None
    evidence_tags: Optional[List[str]] = None
    display_order: Optional[int] = None


@router.post("/{template_id}/props", response_model=PropResponse, status_code=status.HTTP_201_CREATED)
async def create_episode_prop(
    template_id: UUID,
    data: PropCreate,
    db=Depends(get_db),
):
    """Create a new prop for an episode template.

    ADR-005: Props are canonical story objects with exact, immutable content.
    """
    # Verify episode exists
    episode = await db.fetch_one(
        "SELECT id FROM episode_templates WHERE id = :id",
        {"id": str(template_id)}
    )
    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found"
        )

    # Get next display_order if not provided
    if data.display_order is None:
        max_order = await db.fetch_one(
            "SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM props WHERE episode_template_id = :id",
            {"id": str(template_id)}
        )
        display_order = max_order["next_order"]
    else:
        display_order = data.display_order

    import json
    query = """
        INSERT INTO props (
            episode_template_id, name, slug, prop_type, description,
            content, content_format, image_url,
            reveal_mode, reveal_turn_hint,
            is_key_evidence, badge_label, evidence_tags, display_order
        ) VALUES (
            :episode_id, :name, :slug, :prop_type, :description,
            :content, :content_format, :image_url,
            :reveal_mode, :reveal_turn_hint,
            :is_key_evidence, :badge_label, :evidence_tags, :display_order
        )
        RETURNING id, name, slug, prop_type, description,
                  content, content_format, image_url,
                  reveal_mode, reveal_turn_hint,
                  is_key_evidence, evidence_tags, display_order
    """

    row = await db.fetch_one(query, {
        "episode_id": str(template_id),
        "name": data.name,
        "slug": data.slug,
        "prop_type": data.prop_type,
        "description": data.description,
        "content": data.content,
        "content_format": data.content_format,
        "image_url": data.image_url,
        "reveal_mode": data.reveal_mode,
        "reveal_turn_hint": data.reveal_turn_hint,
        "is_key_evidence": data.is_key_evidence,
        "badge_label": data.badge_label,
        "evidence_tags": json.dumps(data.evidence_tags),
        "display_order": display_order,
    })

    result = dict(row)
    if isinstance(result.get("evidence_tags"), str):
        result["evidence_tags"] = json.loads(result["evidence_tags"])
    result["image_url"] = await _get_signed_url(result.get("image_url"))

    return PropResponse(**result)


@router.patch("/{template_id}/props/{prop_id}", response_model=PropResponse)
async def update_episode_prop(
    template_id: UUID,
    prop_id: UUID,
    data: PropUpdate,
    db=Depends(get_db),
):
    """Update a prop for an episode template.

    ADR-005: Props are authored artifacts that enable consistent story elements.
    """
    import json

    # Verify prop exists and belongs to this episode
    existing = await db.fetch_one(
        "SELECT id FROM props WHERE id = :id AND episode_template_id = :episode_id",
        {"id": str(prop_id), "episode_id": str(template_id)}
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prop not found for this episode"
        )

    # Build dynamic update
    updates = []
    values = {"id": str(prop_id)}

    if data.name is not None:
        updates.append("name = :name")
        values["name"] = data.name
    if data.slug is not None:
        updates.append("slug = :slug")
        values["slug"] = data.slug
    if data.prop_type is not None:
        updates.append("prop_type = :prop_type")
        values["prop_type"] = data.prop_type
    if data.description is not None:
        updates.append("description = :description")
        values["description"] = data.description
    if data.content is not None:
        updates.append("content = :content")
        values["content"] = data.content
    if data.content_format is not None:
        updates.append("content_format = :content_format")
        values["content_format"] = data.content_format
    if data.image_url is not None:
        updates.append("image_url = :image_url")
        values["image_url"] = data.image_url
    if data.reveal_mode is not None:
        updates.append("reveal_mode = :reveal_mode")
        values["reveal_mode"] = data.reveal_mode
    if data.reveal_turn_hint is not None:
        updates.append("reveal_turn_hint = :reveal_turn_hint")
        values["reveal_turn_hint"] = data.reveal_turn_hint
    if data.is_key_evidence is not None:
        updates.append("is_key_evidence = :is_key_evidence")
        values["is_key_evidence"] = data.is_key_evidence
    if data.badge_label is not None:
        updates.append("badge_label = :badge_label")
        values["badge_label"] = data.badge_label
    if data.evidence_tags is not None:
        updates.append("evidence_tags = :evidence_tags")
        values["evidence_tags"] = json.dumps(data.evidence_tags)
    if data.display_order is not None:
        updates.append("display_order = :display_order")
        values["display_order"] = data.display_order

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    updates.append("updated_at = NOW()")

    query = f"""
        UPDATE props
        SET {", ".join(updates)}
        WHERE id = :id
        RETURNING id, name, slug, prop_type, description,
                  content, content_format, image_url,
                  reveal_mode, reveal_turn_hint,
                  is_key_evidence, evidence_tags, display_order
    """

    row = await db.fetch_one(query, values)

    result = dict(row)
    if isinstance(result.get("evidence_tags"), str):
        result["evidence_tags"] = json.loads(result["evidence_tags"])
    result["image_url"] = await _get_signed_url(result.get("image_url"))

    return PropResponse(**result)


@router.delete("/{template_id}/props/{prop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_episode_prop(
    template_id: UUID,
    prop_id: UUID,
    db=Depends(get_db),
):
    """Delete a prop from an episode template.

    ADR-005: Prop content is immutable once authored, but props can be removed.
    """
    # Verify prop exists and belongs to this episode
    existing = await db.fetch_one(
        "SELECT id FROM props WHERE id = :id AND episode_template_id = :episode_id",
        {"id": str(prop_id), "episode_id": str(template_id)}
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prop not found for this episode"
        )

    await db.execute(
        "DELETE FROM props WHERE id = :id",
        {"id": str(prop_id)}
    )

    return None
