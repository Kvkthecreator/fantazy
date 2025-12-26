"""Studio API routes for character creation and management."""
import json
import re
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.character import (
    ARCHETYPES,
    PERSONALITY_PRESETS,
    DEFAULT_BOUNDARIES,
    Character,
    CharacterCreateInput,
    CharacterCreatedResponse,
    CharacterSummary,
    CharacterUpdateInput,
    build_system_prompt,
    validate_chat_ready,
)
from app.services.conversation_ignition import (
    generate_opening_beat,
    regenerate_opening_beat,
    validate_ignition_output,
    get_archetype_rules,
)
from app.services.avatar_generation import get_avatar_generation_service
from app.services.storage import StorageService

router = APIRouter(prefix="/studio", tags=["Studio"])


def generate_slug(name: str) -> str:
    """Generate URL-safe slug from character name."""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def generate_system_prompt(
    name: str,
    archetype: str,
    personality: dict,
    boundaries: dict,
    opening_situation: str,
    tone_style: Optional[dict] = None,
    speech_patterns: Optional[dict] = None,
    backstory: Optional[str] = None,
    likes: Optional[List[str]] = None,
    dislikes: Optional[List[str]] = None,
) -> str:
    """Generate a system prompt from character configuration.

    ADR-001: Genre is no longer passed here - it belongs to Series/Episode.
    Genre doctrine is injected by Director at runtime.
    """
    base_prompt = build_system_prompt(
        name=name,
        archetype=archetype,
        personality=personality,
        boundaries=boundaries,
        tone_style=tone_style,
        speech_patterns=speech_patterns,
        backstory=backstory,
        likes=likes,
        dislikes=dislikes,
    )

    return f"""{base_prompt}

OPENING CONTEXT (Episode 0):
{opening_situation}"""


@router.get("/archetypes")
async def list_archetypes():
    """Get available character archetypes."""
    return {"archetypes": ARCHETYPES}


@router.get("/personality-presets")
async def list_personality_presets():
    """Get available personality presets."""
    return {"presets": PERSONALITY_PRESETS}


@router.get("/default-boundaries")
async def get_default_boundaries():
    """Get default boundary configuration."""
    return {"boundaries": DEFAULT_BOUNDARIES}


@router.get("/characters", response_model=List[CharacterSummary])
async def list_all_characters(
    status_filter: Optional[str] = Query(None, pattern="^(draft|active)$"),
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """List all characters (not filtered by creator).

    Shows all characters with their creator info. Edit/delete operations
    still require ownership validation.
    """
    from app.services.storage import StorageService

    conditions = ["1=1"]  # No ownership filter - show all
    values = {}

    if status_filter:
        conditions.append("c.status = :status")
        values["status"] = status_filter

    # Join with avatar_kits to get primary anchor path for fresh signed URLs
    # NOTE: genre removed from Character (ADR-001) - genre belongs to Series/Episode
    query = f"""
        SELECT c.id, c.name, c.slug, c.archetype, c.avatar_url,
               c.backstory, c.is_premium,
               c.status, c.created_by,
               aa.storage_path as anchor_path
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id AND aa.is_active = TRUE
        WHERE {" AND ".join(conditions)}
        ORDER BY c.created_at DESC
    """

    rows = await db.fetch_all(query, values if values else None)

    # Process rows - generate signed URLs for anchor images
    results = []
    storage = None

    for row in rows:
        data = dict(row)
        anchor_path = data.pop("anchor_path", None)

        # Always prefer fresh signed URL from anchor_path (avoids expired URLs)
        if anchor_path:
            if storage is None:
                storage = StorageService.get_instance()
            data["avatar_url"] = await storage.create_signed_url("avatars", anchor_path)

        results.append(CharacterSummary(**data))

    return results


@router.post("/characters", response_model=CharacterCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_character(
    data: CharacterCreateInput,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Create a new character.

    Implements the character creation contract:
    - Required: name, archetype, opening_situation, opening_line
    - Auto-generated: slug, system_prompt
    - Defaults: personality (from preset), boundaries (sensible defaults)
    """
    # Generate slug
    base_slug = generate_slug(data.name)
    slug = base_slug

    # Ensure unique slug
    counter = 1
    while True:
        existing = await db.fetch_one(
            "SELECT id FROM characters WHERE slug = :slug",
            {"slug": slug}
        )
        if not existing:
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Resolve personality
    personality = data.get_resolved_personality()

    # Generate system prompt from locked template
    # NOTE: genre is no longer passed (ADR-001) - genre doctrine injected by Director
    system_prompt = generate_system_prompt(
        name=data.name,
        archetype=data.archetype,
        personality=personality,
        boundaries=data.boundaries,
        opening_situation=data.opening_situation,
    )

    # Determine if character can be active
    # Draft characters don't need avatar; active characters do
    final_status = data.status
    if final_status == "active" and not data.avatar_url:
        final_status = "draft"  # Can't activate without avatar

    # Insert character (opening beat and starter_prompts now go to episode_templates)
    query = """
        INSERT INTO characters (
            name, slug, archetype, avatar_url,
            baseline_personality, boundaries, content_rating,
            system_prompt,
            status, is_active, created_by
        ) VALUES (
            :name, :slug, :archetype, :avatar_url,
            :baseline_personality, :boundaries, :content_rating,
            :system_prompt,
            :status, :is_active, :created_by
        )
        RETURNING id, slug, name, status
    """

    values = {
        "name": data.name,
        "slug": slug,
        "archetype": data.archetype,
        "avatar_url": data.avatar_url,
        "baseline_personality": json.dumps(personality),
        "boundaries": json.dumps(data.boundaries),
        "content_rating": data.content_rating,
        "system_prompt": system_prompt,
        "status": final_status,
        "is_active": final_status == "active",
        "created_by": str(user_id),
    }

    row = await db.fetch_one(query, values)
    character_id = row["id"]

    # Create default Episode 0 template with opening beat (EP-01 Episode-First Pivot)
    # starter_prompts now live here, not on character
    episode_template_query = """
        INSERT INTO episode_templates (
            character_id, episode_number, title, slug,
            situation, opening_line, starter_prompts,
            episode_type, is_default, sort_order, status
        ) VALUES (
            :character_id, 0, :title, :ep_slug,
            :situation, :opening_line, :starter_prompts,
            'entry', TRUE, 0, :status
        )
    """
    episode_title = f"Episode 0: {data.name}"
    episode_slug = f"episode-0-{slug}"

    await db.execute(episode_template_query, {
        "character_id": str(character_id),
        "title": episode_title,
        "ep_slug": episode_slug,
        "situation": data.opening_situation,
        "opening_line": data.opening_line,
        "starter_prompts": [data.opening_line],  # Opening line is the first starter prompt
        "status": final_status,  # Episode template status matches character
    })

    message = "Character created as draft" if final_status == "draft" else "Character created and activated"
    if data.status == "active" and final_status == "draft":
        message = "Character created as draft (avatar required for activation)"

    return CharacterCreatedResponse(
        id=row["id"],
        slug=row["slug"],
        name=row["name"],
        status=row["status"],
        message=message,
    )


@router.get("/characters/{character_id}", response_model=Character)
async def get_my_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get a character by ID.

    Note: Ownership check removed for admin/creator workflow.
    All authenticated users can view any character in studio.
    """
    # Join with avatar_kits to get primary anchor path for fresh signed URL
    query = """
        SELECT c.*, aa.storage_path as anchor_path
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id AND aa.is_active = TRUE
        WHERE c.id = :character_id
    """
    row = await db.fetch_one(query, {
        "character_id": str(character_id),
    })

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    data = dict(row)
    anchor_path = data.pop("anchor_path", None)

    # Generate fresh signed URL if avatar exists
    if anchor_path:
        storage = StorageService.get_instance()
        data["avatar_url"] = await storage.create_signed_url("avatars", anchor_path)

    return Character(**data)


@router.patch("/characters/{character_id}", response_model=Character)
async def update_character(
    character_id: UUID,
    data: CharacterUpdateInput,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update a character.

    Only provided fields are updated. This supports post-creation editing
    of optional fields like backstory, tone_style, etc.
    """
    # Studio editing is unrestricted; route access is enforced elsewhere.
    existing = await db.fetch_one(
        "SELECT * FROM characters WHERE id = :id",
        {"id": str(character_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    # Build update query from provided fields
    updates = []
    values = {"id": str(character_id)}

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if value is not None:
            # Handle JSONB fields - use CAST() instead of :: to avoid parameter parsing issues
            # NOTE: life_arc removed - backstory + archetype + genre doctrine provide depth
            if field in ["baseline_personality", "tone_style", "speech_patterns",
                         "boundaries"]:
                updates.append(f"{field} = CAST(:{field} AS jsonb)")
                values[field] = json.dumps(value)
            # Handle array fields (starter_prompts removed - now on episode_templates)
            elif field in ["likes", "dislikes", "categories"]:
                updates.append(f"{field} = :{field}")
                values[field] = value
            # Handle UUID fields
            elif field == "world_id":
                updates.append(f"{field} = :{field}")
                values[field] = str(value) if value else None
            else:
                updates.append(f"{field} = :{field}")
                values[field] = value

    if not updates:
        # No changes, return existing
        return Character(**dict(existing))

    # Handle status change
    if "status" in update_data:
        new_status = update_data["status"]
        current_avatar = existing["avatar_url"] or update_data.get("avatar_url")

        # Can't activate without avatar
        if new_status == "active" and not current_avatar:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot activate character without avatar. Set avatar_url first.",
            )

        # Sync is_active with status
        updates.append("is_active = :is_active")
        values["is_active"] = new_status == "active"

    updates.append("updated_at = NOW()")

    query = f"""
        UPDATE characters
        SET {", ".join(updates)}
        WHERE id = :id
        RETURNING *
    """

    row = await db.fetch_one(query, values)

    # Check if we need to regenerate system_prompt (core fields changed)
    # NOTE: short_backstory/full_backstory merged into backstory
    # NOTE: current_stressor removed - episode situation conveys emotional state
    # NOTE: genre removed (ADR-001) - genre belongs to Series/Episode, not Character
    prompt_affecting_fields = {"name", "archetype", "baseline_personality", "boundaries",
                               "tone_style", "speech_patterns", "backstory",
                               "likes", "dislikes"}
    if prompt_affecting_fields & set(update_data.keys()):
        # Regenerate system prompt with updated character data
        char_dict = dict(row)
        personality = char_dict.get("baseline_personality") or {}
        if isinstance(personality, str):
            personality = json.loads(personality)
        boundaries = char_dict.get("boundaries") or {}
        if isinstance(boundaries, str):
            boundaries = json.loads(boundaries)
        tone_style = char_dict.get("tone_style")
        if isinstance(tone_style, str):
            tone_style = json.loads(tone_style)
        speech_patterns = char_dict.get("speech_patterns")
        if isinstance(speech_patterns, str):
            speech_patterns = json.loads(speech_patterns)

        # Get opening situation from default episode template
        ep_row = await db.fetch_one(
            """SELECT situation FROM episode_templates
               WHERE character_id = :character_id AND is_default = TRUE""",
            {"character_id": str(character_id)}
        )
        opening_situation = ep_row["situation"] if ep_row else ""

        new_system_prompt = generate_system_prompt(
            name=char_dict["name"],
            archetype=char_dict["archetype"],
            personality=personality,
            boundaries=boundaries,
            opening_situation=opening_situation,
            tone_style=tone_style,
            speech_patterns=speech_patterns,
            backstory=char_dict.get("backstory"),
            likes=char_dict.get("likes"),
            dislikes=char_dict.get("dislikes"),
        )

        # Update the system prompt
        row = await db.fetch_one(
            """UPDATE characters SET system_prompt = :system_prompt, updated_at = NOW()
               WHERE id = :id RETURNING *""",
            {"id": str(character_id), "system_prompt": new_system_prompt}
        )

    return Character(**dict(row))


@router.post("/characters/{character_id}/regenerate-system-prompt", response_model=Character)
async def regenerate_system_prompt_endpoint(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Manually regenerate the system prompt from current character data.

    This rebuilds the system prompt using the latest character fields:
    - name, archetype, personality, boundaries
    - tone_style, speech_patterns
    - backstory
    - likes, dislikes
    - opening_situation from default episode template

    NOTE: genre is no longer included (ADR-001) - genre doctrine is injected
    by Director at runtime based on Series/Episode genre.
    """
    # Get character
    existing = await db.fetch_one(
        "SELECT * FROM characters WHERE id = :id",
        {"id": str(character_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    char_dict = dict(existing)

    # Parse JSONB fields
    personality = char_dict.get("baseline_personality") or {}
    if isinstance(personality, str):
        personality = json.loads(personality)
    boundaries = char_dict.get("boundaries") or {}
    if isinstance(boundaries, str):
        boundaries = json.loads(boundaries)
    tone_style = char_dict.get("tone_style")
    if isinstance(tone_style, str):
        tone_style = json.loads(tone_style)
    speech_patterns = char_dict.get("speech_patterns")
    if isinstance(speech_patterns, str):
        speech_patterns = json.loads(speech_patterns)

    # Get opening situation from default episode template
    ep_row = await db.fetch_one(
        """SELECT situation FROM episode_templates
           WHERE character_id = :character_id AND is_default = TRUE""",
        {"character_id": str(character_id)}
    )
    opening_situation = ep_row["situation"] if ep_row else ""

    new_system_prompt = generate_system_prompt(
        name=char_dict["name"],
        archetype=char_dict["archetype"],
        personality=personality,
        boundaries=boundaries,
        opening_situation=opening_situation,
        tone_style=tone_style,
        speech_patterns=speech_patterns,
        backstory=char_dict.get("backstory"),
        likes=char_dict.get("likes"),
        dislikes=char_dict.get("dislikes"),
    )

    # Update the system prompt
    row = await db.fetch_one(
        """UPDATE characters SET system_prompt = :system_prompt, updated_at = NOW()
           WHERE id = :id RETURNING *""",
        {"id": str(character_id), "system_prompt": new_system_prompt}
    )

    return Character(**dict(row))


@router.post("/characters/{character_id}/activate", response_model=Character)
async def activate_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Activate a draft character (make it chat-ready).

    Requirements (Phase 4.1 hardened):
    - Character must have active_avatar_kit_id (generated via generate-avatar endpoint)
    - Character must have avatar_url (set by avatar generation)
    - Character must have a default episode_template with opening beat (chat ignition)
    - Character must have system_prompt (auto-generated)
    """
    # Get character
    existing = await db.fetch_one(
        "SELECT * FROM characters WHERE id = :id",
        {"id": str(character_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    if existing["status"] == "active":
        return Character(**dict(existing))

    # Use canonical validation function
    errors = validate_chat_ready(dict(existing))
    if errors:
        error_messages = [str(e) for e in errors]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate character: {', '.join(error_messages)}",
        )

    # Activate
    query = """
        UPDATE characters
        SET status = 'active', is_active = TRUE, updated_at = NOW()
        WHERE id = :id
        RETURNING *
    """
    row = await db.fetch_one(query, {"id": str(character_id)})
    return Character(**dict(row))


@router.post("/characters/{character_id}/deactivate", response_model=Character)
async def deactivate_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Deactivate a character (move back to draft)."""
    existing = await db.fetch_one(
        "SELECT * FROM characters WHERE id = :id",
        {"id": str(character_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    query = """
        UPDATE characters
        SET status = 'draft', is_active = FALSE, updated_at = NOW()
        WHERE id = :id
        RETURNING *
    """
    row = await db.fetch_one(query, {"id": str(character_id)})
    return Character(**dict(row))


@router.delete("/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Delete a character."""
    result = await db.execute(
        "DELETE FROM characters WHERE id = :id",
        {"id": str(character_id)}
    )

    # Note: result handling varies by DB driver
    # If no rows deleted, the character wasn't found/owned


# =============================================================================
# Conversation Ignition Endpoints
# =============================================================================

class GenerateOpeningBeatRequest(BaseModel):
    """Request for generating opening beat."""
    name: str = Field(..., min_length=1, max_length=50)
    archetype: str
    personality: Optional[Dict[str, Any]] = None
    personality_preset: Optional[str] = None
    boundaries: Dict[str, Any] = Field(default_factory=lambda: DEFAULT_BOUNDARIES.copy())
    content_rating: str = Field(default="sfw", pattern="^(sfw|adult)$")
    world_context: Optional[str] = None


class RegenerateOpeningBeatRequest(BaseModel):
    """Request for regenerating opening beat with feedback."""
    previous_situation: str
    previous_line: str
    feedback: Optional[str] = None


class OpeningBeatResponse(BaseModel):
    """Response containing generated opening beat."""
    opening_situation: str
    opening_line: str
    starter_prompts: List[str]
    is_valid: bool
    validation_errors: List[Dict[str, str]]
    model_used: Optional[str] = None
    latency_ms: Optional[int] = None


class ArchetypeRulesResponse(BaseModel):
    """Response containing archetype ignition rules."""
    archetype: str
    tone_range: List[str]
    intimacy_ceiling: str
    typical_scenes: List[str]
    pacing: str
    emotional_register: str


@router.post("/generate-opening-beat", response_model=OpeningBeatResponse)
async def generate_opening_beat_endpoint(
    data: GenerateOpeningBeatRequest,
    user_id: UUID = Depends(get_current_user_id),
):
    """Generate conversation ignition (opening beat) for a character.

    This is a one-time, pre-runtime step that primes a character for chat.
    Call this during character creation or when explicitly regenerating.

    Outputs:
    - opening_situation: Present-tense scene container
    - opening_line: Character's first message
    - starter_prompts: 3-5 fallback lines for stalled conversations
    """
    # Resolve personality
    if data.personality:
        personality = data.personality
    elif data.personality_preset and data.personality_preset in PERSONALITY_PRESETS:
        personality = PERSONALITY_PRESETS[data.personality_preset].copy()
    else:
        personality = PERSONALITY_PRESETS["warm_supportive"].copy()

    result = await generate_opening_beat(
        name=data.name,
        archetype=data.archetype,
        personality=personality,
        boundaries=data.boundaries,
        content_rating=data.content_rating,
        world_context=data.world_context,
    )

    return OpeningBeatResponse(
        opening_situation=result.opening_situation,
        opening_line=result.opening_line,
        starter_prompts=result.starter_prompts,
        is_valid=result.is_valid,
        validation_errors=[
            {"field": e.field, "code": e.code, "message": e.message}
            for e in result.validation_errors
        ],
        model_used=result.model_used,
        latency_ms=result.latency_ms,
    )


@router.post("/characters/{character_id}/regenerate-opening-beat", response_model=OpeningBeatResponse)
async def regenerate_character_opening_beat(
    character_id: UUID,
    data: RegenerateOpeningBeatRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Regenerate opening beat for an existing character.

    Use this when:
    - User wants a different opening
    - User provides specific feedback for improvement
    """
    # Get character
    existing = await db.fetch_one(
        "SELECT * FROM characters WHERE id = :id",
        {"id": str(character_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    char_dict = dict(existing)

    # Parse personality from JSON if needed
    personality = char_dict.get("baseline_personality", {})
    if isinstance(personality, str):
        personality = json.loads(personality)

    # Parse boundaries from JSON if needed
    boundaries = char_dict.get("boundaries", DEFAULT_BOUNDARIES.copy())
    if isinstance(boundaries, str):
        boundaries = json.loads(boundaries)

    result = await regenerate_opening_beat(
        name=char_dict["name"],
        archetype=char_dict["archetype"],
        personality=personality,
        boundaries=boundaries,
        previous_situation=data.previous_situation,
        previous_line=data.previous_line,
        feedback=data.feedback,
        content_rating=char_dict.get("content_rating", "sfw"),
    )

    return OpeningBeatResponse(
        opening_situation=result.opening_situation,
        opening_line=result.opening_line,
        starter_prompts=result.starter_prompts,
        is_valid=result.is_valid,
        validation_errors=[
            {"field": e.field, "code": e.code, "message": e.message}
            for e in result.validation_errors
        ],
        model_used=result.model_used,
        latency_ms=result.latency_ms,
    )


@router.post("/characters/{character_id}/apply-opening-beat", response_model=Character)
async def apply_opening_beat(
    character_id: UUID,
    opening_situation: str = Body(..., embed=True),
    opening_line: str = Body(..., embed=True),
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Apply generated opening beat to a character.

    This saves the opening beat to episode_template and regenerates the system prompt.
    starter_prompts now live on episode_template, not character.
    """
    # Get character
    existing = await db.fetch_one(
        "SELECT * FROM characters WHERE id = :id",
        {"id": str(character_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    char_dict = dict(existing)

    # Parse personality
    personality = char_dict.get("baseline_personality", {})
    if isinstance(personality, str):
        personality = json.loads(personality)

    # Parse boundaries
    boundaries = char_dict.get("boundaries", DEFAULT_BOUNDARIES.copy())
    if isinstance(boundaries, str):
        boundaries = json.loads(boundaries)

    # Validate the opening beat
    errors = validate_ignition_output(
        opening_situation=opening_situation,
        opening_line=opening_line,
        archetype=char_dict["archetype"],
        boundaries=boundaries,
        content_rating=char_dict.get("content_rating", "sfw"),
    )

    if errors:
        error_messages = [f"{e.field}: {e.message}" for e in errors]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid opening beat: {'; '.join(error_messages)}",
        )

    # Regenerate system prompt with new opening
    system_prompt = generate_system_prompt(
        name=char_dict["name"],
        archetype=char_dict["archetype"],
        personality=personality,
        boundaries=boundaries,
        opening_situation=opening_situation,
        tone_style=char_dict.get("tone_style"),
        speech_patterns=char_dict.get("speech_patterns"),
        backstory=char_dict.get("backstory"),
        likes=char_dict.get("likes"),
        dislikes=char_dict.get("dislikes"),
    )

    # Update character system_prompt only (starter_prompts now on episode_template)
    char_query = """
        UPDATE characters
        SET system_prompt = :system_prompt,
            updated_at = NOW()
        WHERE id = :id
        RETURNING *
    """

    row = await db.fetch_one(char_query, {
        "id": str(character_id),
        "system_prompt": system_prompt,
    })

    # Update episode_template with opening beat and starter_prompts (EP-01 Episode-First Pivot)
    await db.execute("""
        UPDATE episode_templates
        SET situation = :situation,
            opening_line = :opening_line,
            starter_prompts = :starter_prompts,
            updated_at = NOW()
        WHERE character_id = :character_id AND is_default = TRUE
    """, {
        "character_id": str(character_id),
        "situation": opening_situation,
        "opening_line": opening_line,
        "starter_prompts": [opening_line],  # Opening line is the primary starter prompt
    })

    return Character(**dict(row))


@router.get("/archetype-rules/{archetype}", response_model=ArchetypeRulesResponse)
async def get_archetype_ignition_rules(
    archetype: str,
    user_id: UUID = Depends(get_current_user_id),
):
    """Get ignition rules for a specific archetype.

    Useful for displaying guidance in the UI during character creation.
    """
    if archetype not in ARCHETYPES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown archetype: {archetype}. Available: {ARCHETYPES}",
        )

    rules = get_archetype_rules(archetype)

    return ArchetypeRulesResponse(
        archetype=rules.archetype,
        tone_range=rules.tone_range,
        intimacy_ceiling=rules.intimacy_ceiling,
        typical_scenes=rules.typical_scenes,
        pacing=rules.pacing,
        emotional_register=rules.emotional_register,
    )


# =============================================================================
# Avatar Gallery Endpoints
# =============================================================================

class GeneratePortraitRequest(BaseModel):
    """Request for generating a portrait."""
    appearance_description: Optional[str] = Field(
        None,
        max_length=500,
        description="Custom appearance description. If not provided, derived from archetype."
    )
    label: Optional[str] = Field(
        None,
        max_length=50,
        description="Optional label for this portrait (e.g., 'Casual', 'Office')"
    )
    # Style controls (compact presets)
    style_preset: Optional[str] = Field(
        None,
        description="Visual style: 'anime', 'semi_realistic', 'painterly', 'webtoon'"
    )
    expression_preset: Optional[str] = Field(
        None,
        description="Expression: 'warm', 'intense', 'playful', 'mysterious', 'confident'"
    )
    pose_preset: Optional[str] = Field(
        None,
        description="Pose: 'portrait', 'casual', 'dramatic', 'candid'"
    )
    style_notes: Optional[str] = Field(
        None,
        max_length=200,
        description="Free-text style notes (e.g., 'sunset lighting', 'wearing glasses', 'rainy atmosphere')"
    )


class PortraitGenerationResponse(BaseModel):
    """Response from portrait generation."""
    success: bool
    asset_id: Optional[str] = None
    kit_id: Optional[str] = None
    image_url: Optional[str] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    latency_ms: Optional[int] = None


class GalleryItemResponse(BaseModel):
    """Single item in avatar gallery."""
    id: str
    url: str
    label: Optional[str] = None
    is_primary: bool = False


class GalleryStatusResponse(BaseModel):
    """Response with avatar gallery status."""
    has_gallery: bool
    kit_id: Optional[str] = None
    primary_url: Optional[str] = None
    gallery: List[GalleryItemResponse] = Field(default_factory=list)
    can_activate: bool = False
    missing_requirements: List[str] = Field(default_factory=list)


@router.post("/characters/{character_id}/generate-avatar", response_model=PortraitGenerationResponse)
async def generate_portrait(
    character_id: UUID,
    data: GeneratePortraitRequest = Body(default=GeneratePortraitRequest()),
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Generate a portrait for a character's avatar gallery.

    Creates a new portrait image and adds it to the gallery.
    First portrait automatically becomes the primary avatar.
    """
    service = get_avatar_generation_service()

    result = await service.generate_portrait(
        character_id=character_id,
        user_id=user_id,
        db=db,
        appearance_description=data.appearance_description,
        label=data.label,
        style_preset=data.style_preset,
        expression_preset=data.expression_preset,
        pose_preset=data.pose_preset,
        style_notes=data.style_notes,
    )

    return PortraitGenerationResponse(
        success=result.success,
        asset_id=str(result.asset_id) if result.asset_id else None,
        kit_id=str(result.kit_id) if result.kit_id else None,
        image_url=result.image_url,
        error=result.error,
        model_used=result.model_used,
        latency_ms=result.latency_ms,
    )


@router.get("/characters/{character_id}/gallery", response_model=GalleryStatusResponse)
async def get_gallery_status(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get avatar gallery for a character.

    Returns all portraits in the gallery with their URLs and which is primary.
    """
    service = get_avatar_generation_service()

    status_result = await service.get_gallery_status(
        character_id=character_id,
        user_id=user_id,
        db=db,
    )

    return GalleryStatusResponse(
        has_gallery=status_result.has_gallery,
        kit_id=str(status_result.kit_id) if status_result.kit_id else None,
        primary_url=status_result.primary_url,
        gallery=[
            GalleryItemResponse(
                id=item.id,
                url=item.url,
                label=item.label,
                is_primary=item.is_primary,
            )
            for item in status_result.gallery
        ],
        can_activate=status_result.can_activate,
        missing_requirements=status_result.missing_requirements,
    )


@router.post("/characters/{character_id}/gallery/{asset_id}/set-primary")
async def set_primary_avatar(
    character_id: UUID,
    asset_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Set a gallery item as the primary avatar."""
    service = get_avatar_generation_service()

    success = await service.set_primary(
        character_id=character_id,
        asset_id=asset_id,
        user_id=user_id,
        db=db,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    return {"success": True}


@router.delete("/characters/{character_id}/gallery/{asset_id}")
async def delete_gallery_item(
    character_id: UUID,
    asset_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Delete a gallery item.

    Cannot delete if it's the only portrait in the gallery.
    If deleting the primary, another portrait becomes primary.
    """
    service = get_avatar_generation_service()

    success = await service.delete_asset(
        character_id=character_id,
        asset_id=asset_id,
        user_id=user_id,
        db=db,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete. Asset not found or it's the only portrait.",
        )

    return {"success": True}


# =============================================================================
# Admin / Calibration Endpoints
# =============================================================================

@router.get("/admin/diagnose-images")
async def diagnose_images(
    db=Depends(get_db),
):
    """Diagnose image storage issues for characters and series.

    Returns information about:
    - Characters with/without avatar kits
    - Characters with expired signed URLs vs storage paths
    - Series with/without cover images
    - Episode templates with/without backgrounds
    """
    from app.services.storage import StorageService

    storage = StorageService.get_instance()

    # Check characters
    char_rows = await db.fetch_all("""
        SELECT
            c.id,
            c.name,
            c.avatar_url,
            c.active_avatar_kit_id,
            ak.id as kit_id,
            ak.status as kit_status,
            ak.primary_anchor_id,
            aa.storage_path as anchor_storage_path,
            aa.is_active as anchor_is_active
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id
        WHERE c.status = 'active'
        ORDER BY c.name
    """)

    characters = []
    for row in char_rows:
        r = dict(row)
        has_kit = r["kit_id"] is not None
        has_anchor = r["anchor_storage_path"] is not None
        avatar_url_expired = (
            r["avatar_url"] is not None and
            "token=" in str(r["avatar_url"])  # Signed URLs have token param
        )

        # Try to generate fresh URL if we have storage path
        fresh_url = None
        if has_anchor:
            try:
                fresh_url = await storage.create_signed_url("avatars", r["anchor_storage_path"])
            except:
                fresh_url = "ERROR generating URL"

        characters.append({
            "name": r["name"],
            "has_avatar_kit": has_kit,
            "kit_status": r["kit_status"],
            "has_anchor_asset": has_anchor,
            "anchor_storage_path": r["anchor_storage_path"],
            "current_avatar_url_type": "signed_url" if avatar_url_expired else ("static" if r["avatar_url"] else "none"),
            "can_generate_fresh_url": fresh_url is not None and "ERROR" not in str(fresh_url),
        })

    # Check series
    series_rows = await db.fetch_all("""
        SELECT id, title, cover_image_url
        FROM series
        WHERE status = 'active'
        ORDER BY title
    """)

    series = []
    for row in series_rows:
        r = dict(row)
        cover_url = r["cover_image_url"]
        is_storage_path = cover_url and not cover_url.startswith("http")
        is_signed_url = cover_url and "token=" in str(cover_url)

        series.append({
            "title": r["title"],
            "cover_image_type": "storage_path" if is_storage_path else ("signed_url" if is_signed_url else ("static_url" if cover_url else "none")),
            "cover_image_value": cover_url[:80] + "..." if cover_url and len(cover_url) > 80 else cover_url,
        })

    # Check episode backgrounds
    ep_rows = await db.fetch_all("""
        SELECT et.id, et.title, et.background_image_url, c.name as character_name
        FROM episode_templates et
        JOIN characters c ON c.id = et.character_id
        WHERE et.status = 'active'
        ORDER BY c.name, et.episode_number
        LIMIT 50
    """)

    episodes = []
    for row in ep_rows:
        r = dict(row)
        bg_url = r["background_image_url"]
        is_storage_path = bg_url and not bg_url.startswith("http")
        is_signed_url = bg_url and "token=" in str(bg_url)

        episodes.append({
            "character": r["character_name"],
            "title": r["title"],
            "background_type": "storage_path" if is_storage_path else ("signed_url" if is_signed_url else ("static_url" if bg_url else "none")),
        })

    return {
        "summary": {
            "characters_with_kits": sum(1 for c in characters if c["has_avatar_kit"]),
            "characters_with_anchors": sum(1 for c in characters if c["has_anchor_asset"]),
            "characters_total": len(characters),
            "series_with_covers": sum(1 for s in series if s["cover_image_type"] != "none"),
            "series_total": len(series),
            "episodes_with_backgrounds": sum(1 for e in episodes if e["background_type"] != "none"),
            "episodes_total": len(episodes),
        },
        "characters": characters,
        "series": series,
        "episodes": episodes[:20],  # Limit output
    }


@router.post("/admin/activate-all-kits")
async def activate_all_kits(
    db=Depends(get_db),
):
    """Activate all draft avatar kits.

    This simplifies kit management - all kits are now active by default.
    This endpoint fixes any existing draft kits.
    """
    result = await db.execute(
        "UPDATE avatar_kits SET status = 'active', updated_at = NOW() WHERE status = 'draft'"
    )

    # Get count of affected rows
    count_row = await db.fetch_one(
        "SELECT COUNT(*) as count FROM avatar_kits WHERE status = 'active'"
    )

    return {
        "message": "All draft kits activated",
        "total_active_kits": count_row["count"] if count_row else 0,
    }


@router.post("/admin/create-kit-from-storage")
async def create_kit_from_storage(
    character_id: str,
    storage_path: str,
    bucket: str = "scenes",
    db=Depends(get_db),
):
    """Create an avatar kit for a character using an existing storage path.

    This copies the image from the source bucket to the avatars bucket and
    creates a kit with it as the primary anchor.

    Args:
        character_id: UUID of the character
        storage_path: Path in the source bucket (e.g., 'series/weekend-regular/cover.png')
        bucket: Source bucket name (default: 'scenes')
    """
    import uuid
    from app.services.storage import StorageService

    storage = StorageService.get_instance()

    # Verify character exists
    char_row = await db.fetch_one(
        "SELECT id, name FROM characters WHERE id = :id",
        {"id": character_id},
    )
    if not char_row:
        return {"error": f"Character {character_id} not found"}

    char_name = char_row["name"]

    # Generate IDs
    kit_id = uuid.uuid4()
    asset_id = uuid.uuid4()

    # Download image from source bucket
    try:
        image_bytes = await storage.download(bucket, storage_path)
    except Exception as e:
        return {"error": f"Failed to download from {bucket}/{storage_path}: {str(e)}"}

    # Upload to avatars bucket
    new_path = f"{kit_id}/anchors/{asset_id}.png"
    try:
        await storage._upload("avatars", new_path, image_bytes, "image/png")
    except Exception as e:
        return {"error": f"Failed to upload to avatars/{new_path}: {str(e)}"}

    # Create avatar kit
    await db.execute(
        """
        INSERT INTO avatar_kits (id, character_id, name, status, is_default)
        VALUES (:id, :character_id, :name, 'active', true)
        """,
        {
            "id": str(kit_id),
            "character_id": character_id,
            "name": f"{char_name} Default Kit",
        },
    )

    # Create avatar asset
    await db.execute(
        """
        INSERT INTO avatar_assets (id, avatar_kit_id, storage_path, asset_type, is_active)
        VALUES (:id, :kit_id, :storage_path, 'portrait', true)
        """,
        {
            "id": str(asset_id),
            "kit_id": str(kit_id),
            "storage_path": new_path,
        },
    )

    # Set as primary anchor
    await db.execute(
        """
        UPDATE avatar_kits SET primary_anchor_id = :asset_id, updated_at = NOW()
        WHERE id = :kit_id
        """,
        {"asset_id": str(asset_id), "kit_id": str(kit_id)},
    )

    # Link kit to character
    await db.execute(
        """
        UPDATE characters SET active_avatar_kit_id = :kit_id, updated_at = NOW()
        WHERE id = :character_id
        """,
        {"kit_id": str(kit_id), "character_id": character_id},
    )

    # Generate signed URL for verification
    signed_url = await storage.create_signed_url("avatars", new_path)

    return {
        "message": f"Created avatar kit for {char_name}",
        "kit_id": str(kit_id),
        "asset_id": str(asset_id),
        "storage_path": new_path,
        "signed_url": signed_url,
    }


@router.post("/admin/fix-avatar-urls")
async def fix_avatar_urls(
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Fix avatar_url for characters with hero avatars but missing URL.

    This is a calibration/admin endpoint to fix data inconsistencies.
    """
    from app.services.storage import StorageService

    storage = StorageService.get_instance()

    # Get characters needing URL fix
    rows = await db.fetch_all("""
        SELECT
            c.id,
            c.name,
            aa.storage_path
        FROM characters c
        JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id
        WHERE c.avatar_url IS NULL
        AND aa.storage_path IS NOT NULL
    """)

    if not rows:
        return {"message": "No characters need fixing", "fixed": 0}

    fixed = []
    for row in rows:
        row_dict = dict(row)
        storage_path = row_dict["storage_path"]

        try:
            signed_url = await storage.create_signed_url("avatars", storage_path)

            await db.execute(
                "UPDATE characters SET avatar_url = :url, updated_at = NOW() WHERE id = :id",
                {"url": signed_url, "id": str(row_dict["id"])}
            )

            fixed.append({"name": row_dict["name"], "status": "fixed"})

        except Exception as e:
            fixed.append({"name": row_dict["name"], "status": f"error: {str(e)}"})

    return {"message": f"Processed {len(fixed)} characters", "results": fixed}


class BatchCreateRequest(BaseModel):
    """Request for batch character creation (calibration sprint)."""
    characters: List[dict] = Field(
        ...,
        description="List of character configs with name, archetype, personality_preset, appearance_hint"
    )


@router.post("/admin/batch-create")
async def batch_create_characters(
    data: BatchCreateRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Batch create characters for calibration sprint.

    Each character config should have:
    - name: str
    - archetype: str
    - personality_preset: str (optional)
    - content_rating: str (optional, default sfw)
    - appearance_hint: str (optional, for avatar generation)
    """
    from app.services.conversation_ignition import generate_opening_beat
    from app.models.character import PERSONALITY_PRESETS, DEFAULT_BOUNDARIES

    results = []

    for config in data.characters:
        name = config.get("name")
        archetype = config.get("archetype")

        if not name or not archetype:
            results.append({"name": name or "unknown", "status": "error: missing name or archetype"})
            continue

        # Check if exists
        slug = name.lower().replace(" ", "-")
        existing = await db.fetch_one(
            "SELECT id FROM characters WHERE slug = :slug",
            {"slug": slug}
        )

        if existing:
            results.append({"name": name, "status": "exists", "id": str(existing["id"])})
            continue

        # Get personality
        preset_name = config.get("personality_preset", "warm_supportive")
        personality = PERSONALITY_PRESETS.get(preset_name, PERSONALITY_PRESETS.get("warm_supportive", {}))

        # Generate opening beat
        try:
            ignition_result = await generate_opening_beat(
                name=name,
                archetype=archetype,
                personality=personality,
                boundaries=DEFAULT_BOUNDARIES,
                content_rating=config.get("content_rating", "sfw"),
            )

            opening_situation = ignition_result.opening_situation
            opening_line = ignition_result.opening_line
            # starter_prompts now live on episode_template, not character

        except Exception as e:
            # Fallback
            opening_situation = f"You encounter {name}."
            opening_line = "Hey there."

        # Build system prompt
        import json
        system_prompt = f"""You are {name}, a {archetype} character.

Personality traits: {json.dumps(personality.get('traits', []))}

Stay in character. Be {archetype} in your responses.
"""

        # Insert character (opening beat and starter_prompts go to episode_templates)
        try:
            row = await db.fetch_one("""
                INSERT INTO characters (
                    name, slug, archetype,
                    baseline_personality, boundaries, content_rating,
                    system_prompt,
                    status, is_active, created_by
                ) VALUES (
                    :name, :slug, :archetype,
                    :personality, :boundaries, :content_rating,
                    :system_prompt,
                    'draft', FALSE, :user_id
                )
                RETURNING id
            """, {
                "name": name,
                "slug": slug,
                "archetype": archetype,
                "personality": json.dumps(personality),
                "boundaries": json.dumps(DEFAULT_BOUNDARIES),
                "content_rating": config.get("content_rating", "sfw"),
                "system_prompt": system_prompt,
                "user_id": str(user_id),
            })

            character_id = row["id"]

            # Create Episode 0 template with opening beat and starter_prompts
            await db.execute("""
                INSERT INTO episode_templates (
                    character_id, episode_number, title, slug,
                    situation, opening_line, starter_prompts,
                    episode_type, is_default, sort_order, status
                ) VALUES (
                    :character_id, 0, :title, :ep_slug,
                    :situation, :opening_line, :starter_prompts,
                    'entry', TRUE, 0, 'draft'
                )
            """, {
                "character_id": str(character_id),
                "title": f"Episode 0: {name}",
                "ep_slug": f"episode-0-{slug}",
                "situation": opening_situation,
                "opening_line": opening_line,
                "starter_prompts": [opening_line],
            })

            results.append({
                "name": name,
                "status": "created",
                "id": str(character_id),
                "appearance_hint": config.get("appearance_hint"),
            })

        except Exception as e:
            results.append({"name": name, "status": f"error: {str(e)}"})

    return {
        "message": f"Processed {len(results)} characters",
        "results": results,
    }


# =============================================================================
# Episode Template CRUD (EP-01 Episode-First Pivot)
# =============================================================================

class EpisodeTemplateCreateInput(BaseModel):
    """Input for creating an episode template."""
    character_id: UUID
    title: str = Field(..., min_length=1, max_length=100)
    situation: str = Field(..., min_length=10, max_length=1000)
    episode_frame: Optional[str] = Field(None, max_length=500, description="Platform stage direction")
    opening_line: str = Field(..., min_length=5, max_length=500)
    episode_type: str = Field(default="core", pattern="^(entry|core|expansion|special)$")
    is_default: bool = Field(default=False)
    starter_prompts: Optional[List[str]] = None
    background_image_url: Optional[str] = None
    arc_hints: Optional[Dict[str, Any]] = None
    # Episode Dynamics
    dramatic_question: Optional[str] = Field(None, max_length=500, description="Narrative tension to explore")
    # Scene motivation (ADR-002: Theatrical Model)
    scene_objective: Optional[str] = Field(None, max_length=500, description="What character wants from user this scene")
    scene_obstacle: Optional[str] = Field(None, max_length=500, description="What's stopping them from just asking")
    scene_tactic: Optional[str] = Field(None, max_length=500, description="How they're trying to get what they want")


class EpisodeTemplateUpdateInput(BaseModel):
    """Input for updating an episode template."""
    title: Optional[str] = Field(None, max_length=100)
    situation: Optional[str] = Field(None, max_length=1000)
    episode_frame: Optional[str] = Field(None, max_length=500)
    opening_line: Optional[str] = Field(None, max_length=500)
    episode_type: Optional[str] = Field(None, pattern="^(entry|core|expansion|special)$")
    is_default: Optional[bool] = None
    starter_prompts: Optional[List[str]] = None
    background_image_url: Optional[str] = None
    arc_hints: Optional[Dict[str, Any]] = None
    status: Optional[str] = Field(None, pattern="^(draft|active)$")
    # Episode Dynamics
    dramatic_question: Optional[str] = Field(None, max_length=500)
    # Scene motivation (ADR-002: Theatrical Model)
    scene_objective: Optional[str] = Field(None, max_length=500)
    scene_obstacle: Optional[str] = Field(None, max_length=500)
    scene_tactic: Optional[str] = Field(None, max_length=500)


class EpisodeTemplateResponse(BaseModel):
    """Response model for episode template."""
    id: str
    character_id: str
    episode_number: int
    title: str
    slug: str
    situation: str
    episode_frame: Optional[str] = None
    opening_line: str
    episode_type: str
    is_default: bool
    background_image_url: Optional[str] = None
    starter_prompts: List[str] = Field(default_factory=list)
    status: str
    created_at: str
    updated_at: Optional[str] = None
    # Episode Dynamics
    dramatic_question: Optional[str] = None
    # Scene motivation (ADR-002: Theatrical Model)
    scene_objective: Optional[str] = None
    scene_obstacle: Optional[str] = None
    scene_tactic: Optional[str] = None


@router.post("/episode-templates", response_model=EpisodeTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_episode_template(
    data: EpisodeTemplateCreateInput,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Create a new episode template.

    EP-01 Episode-First: This is the primary creative workflow.
    Episode templates define the situation, frame, and opening line.
    """
    # Verify character ownership
    character = await db.fetch_one(
        "SELECT id, slug, name FROM characters WHERE id = :id",
        {"id": str(data.character_id)}
    )

    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    # Get next episode number for this character
    max_ep = await db.fetch_one(
        "SELECT COALESCE(MAX(episode_number), -1) as max_num FROM episode_templates WHERE character_id = :char_id",
        {"char_id": str(data.character_id)}
    )
    episode_number = (max_ep["max_num"] or -1) + 1

    # Generate slug
    title_slug = data.title.lower().replace(" ", "-").replace("'", "")
    slug = f"{character['slug']}-{title_slug}"

    # If setting as default, unset other defaults
    if data.is_default:
        await db.execute(
            "UPDATE episode_templates SET is_default = FALSE WHERE character_id = :char_id",
            {"char_id": str(data.character_id)}
        )

    # Insert episode template
    query = """
        INSERT INTO episode_templates (
            character_id, episode_number, title, slug,
            situation, episode_frame, opening_line,
            episode_type, is_default, starter_prompts,
            background_image_url, arc_hints, sort_order, status,
            dramatic_question, scene_objective, scene_obstacle, scene_tactic
        ) VALUES (
            :character_id, :episode_number, :title, :slug,
            :situation, :episode_frame, :opening_line,
            :episode_type, :is_default, :starter_prompts,
            :background_image_url, CAST(:arc_hints AS jsonb), :sort_order, 'draft',
            :dramatic_question, :scene_objective, :scene_obstacle, :scene_tactic
        )
        RETURNING *
    """

    row = await db.fetch_one(query, {
        "character_id": str(data.character_id),
        "episode_number": episode_number,
        "title": data.title,
        "slug": slug,
        "situation": data.situation,
        "episode_frame": data.episode_frame or "",
        "opening_line": data.opening_line,
        "episode_type": data.episode_type,
        "is_default": data.is_default,
        "starter_prompts": data.starter_prompts or [],
        "background_image_url": data.background_image_url,
        "arc_hints": json.dumps(data.arc_hints or {}),
        "sort_order": episode_number,
        "dramatic_question": data.dramatic_question,
        "scene_objective": data.scene_objective,
        "scene_obstacle": data.scene_obstacle,
        "scene_tactic": data.scene_tactic,
    })

    row_dict = dict(row)
    return EpisodeTemplateResponse(
        id=str(row_dict["id"]),
        character_id=str(row_dict["character_id"]),
        episode_number=row_dict["episode_number"],
        title=row_dict["title"],
        slug=row_dict["slug"],
        situation=row_dict["situation"],
        episode_frame=row_dict.get("episode_frame"),
        opening_line=row_dict["opening_line"],
        episode_type=row_dict["episode_type"],
        is_default=row_dict["is_default"],
        background_image_url=row_dict.get("background_image_url"),
        starter_prompts=row_dict.get("starter_prompts") or [],
        status=row_dict["status"],
        created_at=str(row_dict["created_at"]),
        updated_at=str(row_dict["updated_at"]) if row_dict.get("updated_at") else None,
        dramatic_question=row_dict.get("dramatic_question"),
        scene_objective=row_dict.get("scene_objective"),
        scene_obstacle=row_dict.get("scene_obstacle"),
        scene_tactic=row_dict.get("scene_tactic"),
    )


@router.get("/characters/{character_id}/episode-templates", response_model=List[EpisodeTemplateResponse])
async def list_character_episode_templates(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """List all episode templates for a character.

    Returns templates ordered by episode_number.
    Note: Ownership check removed for admin/creator workflow.
    """
    # Verify character exists
    character = await db.fetch_one(
        "SELECT id FROM characters WHERE id = :id",
        {"id": str(character_id)}
    )

    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    rows = await db.fetch_all(
        """SELECT * FROM episode_templates
           WHERE character_id = :char_id
           ORDER BY episode_number""",
        {"char_id": str(character_id)}
    )

    return [
        EpisodeTemplateResponse(
            id=str(r["id"]),
            character_id=str(r["character_id"]),
            episode_number=r["episode_number"],
            title=r["title"],
            slug=r["slug"],
            situation=r["situation"],
            episode_frame=r.get("episode_frame"),
            opening_line=r["opening_line"],
            episode_type=r["episode_type"],
            is_default=r["is_default"],
            background_image_url=r.get("background_image_url"),
            starter_prompts=r.get("starter_prompts") or [],
            status=r["status"],
            created_at=str(r["created_at"]),
            updated_at=str(r["updated_at"]) if r.get("updated_at") else None,
            dramatic_question=r.get("dramatic_question"),
            scene_objective=r.get("scene_objective"),
            scene_obstacle=r.get("scene_obstacle"),
            scene_tactic=r.get("scene_tactic"),
        )
        for row in rows
        for r in [dict(row)]  # Convert Record to dict for .get() access
    ]


@router.get("/episode-templates/{template_id}", response_model=EpisodeTemplateResponse)
async def get_episode_template(
    template_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get a single episode template."""
    row = await db.fetch_one(
        """SELECT et.* FROM episode_templates et
           WHERE et.id = :id""",
        {"id": str(template_id)}
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found",
        )

    r = dict(row)  # Convert Record to dict for .get() access
    return EpisodeTemplateResponse(
        id=str(r["id"]),
        character_id=str(r["character_id"]),
        episode_number=r["episode_number"],
        title=r["title"],
        slug=r["slug"],
        situation=r["situation"],
        episode_frame=r.get("episode_frame"),
        opening_line=r["opening_line"],
        episode_type=r["episode_type"],
        is_default=r["is_default"],
        background_image_url=r.get("background_image_url"),
        starter_prompts=r.get("starter_prompts") or [],
        status=r["status"],
        created_at=str(r["created_at"]),
        updated_at=str(r["updated_at"]) if r.get("updated_at") else None,
        dramatic_question=r.get("dramatic_question"),
        scene_objective=r.get("scene_objective"),
        scene_obstacle=r.get("scene_obstacle"),
        scene_tactic=r.get("scene_tactic"),
    )


@router.patch("/episode-templates/{template_id}", response_model=EpisodeTemplateResponse)
async def update_episode_template(
    template_id: UUID,
    data: EpisodeTemplateUpdateInput,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update an episode template."""
    # Verify ownership
    existing = await db.fetch_one(
        """SELECT et.* FROM episode_templates et
           WHERE et.id = :id""",
        {"id": str(template_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found",
        )

    # Build update query
    updates = []
    values = {"id": str(template_id)}
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if value is not None:
            if field == "arc_hints":
                updates.append(f"{field} = CAST(:{field} AS jsonb)")
                values[field] = json.dumps(value)
            elif field == "starter_prompts":
                updates.append(f"{field} = :{field}")
                values[field] = value
            else:
                updates.append(f"{field} = :{field}")
                values[field] = value

    # Handle is_default special case
    if update_data.get("is_default"):
        await db.execute(
            "UPDATE episode_templates SET is_default = FALSE WHERE character_id = :char_id AND id != :id",
            {"char_id": str(existing["character_id"]), "id": str(template_id)}
        )

    if not updates:
        # No changes
        return EpisodeTemplateResponse(
            id=str(existing["id"]),
            character_id=str(existing["character_id"]),
            episode_number=existing["episode_number"],
            title=existing["title"],
            slug=existing["slug"],
            situation=existing["situation"],
            episode_frame=existing.get("episode_frame"),
            opening_line=existing["opening_line"],
            episode_type=existing["episode_type"],
            is_default=existing["is_default"],
            background_image_url=existing.get("background_image_url"),
            starter_prompts=existing.get("starter_prompts") or [],
            status=existing["status"],
            created_at=str(existing["created_at"]),
            updated_at=str(existing["updated_at"]) if existing.get("updated_at") else None,
            dramatic_question=existing.get("dramatic_question"),
            scene_objective=existing.get("scene_objective"),
            scene_obstacle=existing.get("scene_obstacle"),
            scene_tactic=existing.get("scene_tactic"),
        )

    updates.append("updated_at = NOW()")

    query = f"""
        UPDATE episode_templates
        SET {", ".join(updates)}
        WHERE id = :id
        RETURNING *
    """

    row = await db.fetch_one(query, values)

    r = dict(row)  # Convert Record to dict for .get() access
    return EpisodeTemplateResponse(
        id=str(r["id"]),
        character_id=str(r["character_id"]),
        episode_number=r["episode_number"],
        title=r["title"],
        slug=r["slug"],
        situation=r["situation"],
        episode_frame=r.get("episode_frame"),
        opening_line=r["opening_line"],
        episode_type=r["episode_type"],
        is_default=r["is_default"],
        background_image_url=r.get("background_image_url"),
        starter_prompts=r.get("starter_prompts") or [],
        status=r["status"],
        created_at=str(r["created_at"]),
        updated_at=str(r["updated_at"]) if r.get("updated_at") else None,
        dramatic_question=r.get("dramatic_question"),
        scene_objective=r.get("scene_objective"),
        scene_obstacle=r.get("scene_obstacle"),
        scene_tactic=r.get("scene_tactic"),
    )


@router.delete("/episode-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_episode_template(
    template_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Delete an episode template.

    Cannot delete if it's the only template for a character.
    """
    # Verify ownership and get character_id
    existing = await db.fetch_one(
        """SELECT et.id, et.character_id FROM episode_templates et
           WHERE et.id = :id""",
        {"id": str(template_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found",
        )

    # Check if it's the only template
    count = await db.fetch_one(
        "SELECT COUNT(*) as cnt FROM episode_templates WHERE character_id = :char_id",
        {"char_id": str(existing["character_id"])}
    )

    if count["cnt"] <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the only episode template for a character",
        )

    await db.execute(
        "DELETE FROM episode_templates WHERE id = :id",
        {"id": str(template_id)}
    )


# =============================================================================
# Episode Background Generation
# =============================================================================

# Import prompt builders for high-quality backgrounds
from app.services.content_image_generation import (
    build_episode_background_prompt,
    build_dynamic_episode_background_prompt,
    ALL_EPISODE_BACKGROUNDS,
)


class BackgroundGenerationResponse(BaseModel):
    """Response from background generation."""
    success: bool
    episode_id: Optional[str] = None
    character_name: Optional[str] = None
    episode_title: Optional[str] = None
    image_url: Optional[str] = None
    error: Optional[str] = None
    latency_ms: Optional[int] = None


@router.post("/admin/generate-episode-backgrounds")
async def generate_episode_backgrounds(
    character: Optional[str] = Query(None, description="Generate for specific character only"),
    episode_number: Optional[int] = Query(None, description="Generate for specific episode number only"),
    force: bool = Query(False, description="Force regenerate even if background exists"),
    db=Depends(get_db),
):
    """Generate background images for episode templates.

    Uses FLUX 1.1 Pro to generate atmospheric scene backgrounds based on
    each episode's episode_frame prompt. Backgrounds are 16:9 landscape
    images with no characters.

    Pass ?character=Luna to generate for a specific character.
    Pass ?episode_number=0 to generate only Episode 0s.
    Pass ?force=true to regenerate even if background already exists.
    """
    import asyncio
    from app.services.image import ImageService
    from app.services.storage import StorageService

    storage = StorageService.get_instance()
    image_service = ImageService.get_client("replicate", "black-forest-labs/flux-1.1-pro")

    # Build query
    conditions = ["et.episode_frame IS NOT NULL", "et.episode_frame != ''"]
    params = {}

    if not force:
        conditions.append("(et.background_image_url IS NULL OR et.background_image_url = '')")

    if character:
        conditions.append("c.name = :character")
        params["character"] = character

    if episode_number is not None:
        conditions.append("et.episode_number = :episode_number")
        params["episode_number"] = episode_number

    # Fetch episode data with series/world context for dynamic prompt building
    query = f"""
        SELECT et.id, et.character_id, et.episode_number, et.title,
               et.episode_frame, et.situation, et.dramatic_question, et.genre as episode_genre,
               c.name as character_name,
               s.genre as series_genre, s.visual_style,
               w.name as world_name
        FROM episode_templates et
        JOIN characters c ON c.id = et.character_id
        LEFT JOIN series s ON s.id = et.series_id
        LEFT JOIN worlds w ON w.id = COALESCE(s.world_id, c.world_id)
        WHERE {' AND '.join(conditions)}
        ORDER BY c.name, et.episode_number
    """

    rows = await db.fetch_all(query, params)

    if not rows:
        return {
            "message": "No episode templates need background generation",
            "generated": 0,
            "results": []
        }

    results = []

    for i, row in enumerate(rows):
        ep = dict(row)

        # Use config-based prompt if available, else dynamic prompt from metadata
        episode_title = ep["title"]
        if episode_title in ALL_EPISODE_BACKGROUNDS:
            # Use curated config for known episodes
            full_prompt, negative_prompt = build_episode_background_prompt(
                episode_title=episode_title,
                episode_config=ALL_EPISODE_BACKGROUNDS[episode_title],
            )
        else:
            # Dynamic prompt from database metadata (genre, world, situation, etc.)
            full_prompt, negative_prompt = build_dynamic_episode_background_prompt(
                episode_frame=ep.get("episode_frame"),
                situation=ep.get("situation"),
                dramatic_question=ep.get("dramatic_question"),
                genre=ep.get("episode_genre") or ep.get("series_genre"),
                world_name=ep.get("world_name"),
                visual_style=ep.get("visual_style"),
            )

        try:
            # Generate 16:9 landscape background
            response = await image_service.generate(
                prompt=full_prompt,
                negative_prompt=negative_prompt,
                width=1344,  # FLUX supports this for 16:9
                height=768,
            )

            if not response.images:
                results.append({
                    "character": ep["character_name"],
                    "episode": ep["episode_number"],
                    "title": ep["title"],
                    "status": "error: no image returned"
                })
                continue

            image_bytes = response.images[0]

            # Upload to storage
            storage_path = await storage.upload_episode_background(
                image_bytes=image_bytes,
                character_id=ep["character_id"],  # Already UUID-like from DB
                episode_number=ep["episode_number"],
            )

            # Store the STORAGE PATH (not signed URL) in database
            # Signed URLs expire after 1 hour - paths are converted to signed URLs on fetch
            await db.execute(
                """UPDATE episode_templates
                   SET background_image_url = :path, updated_at = NOW()
                   WHERE id = :id""",
                {"path": storage_path, "id": str(ep["id"])}
            )

            # Generate signed URL for the response only
            image_url = await storage.create_signed_url("scenes", storage_path)

            results.append({
                "character": ep["character_name"],
                "episode": ep["episode_number"],
                "title": ep["title"],
                "status": "generated",
                "image_url": image_url,
                "storage_path": storage_path,
                "latency_ms": response.latency_ms,
            })

        except Exception as e:
            results.append({
                "character": ep["character_name"],
                "episode": ep["episode_number"],
                "title": ep["title"],
                "status": f"error: {str(e)}"
            })

        # Add delay between requests to avoid rate limiting
        if i < len(rows) - 1:
            await asyncio.sleep(2)

    generated_count = sum(1 for r in results if r.get("status") == "generated")

    return {
        "message": f"Processed {len(results)} episode templates",
        "generated": generated_count,
        "results": results,
    }


# Physical appearance hints for all characters (wardrobe comes from role_frame)
CALIBRATION_APPEARANCE_HINTS = {
    # Original 3
    "Mira": "long wavy brown hair with subtle highlights, warm amber eyes, cute beauty mark, soft youthful features",
    "Kai": "long flowing brown hair, golden-brown eyes, delicate features, natural beauty, slight blush",
    "Sora": "sleek black hair in professional style, sharp intelligent dark eyes, elegant features, confident aura",
    # New 7
    "Luna": "silver-white hair, gentle violet eyes, soft delicate features, ethereal beauty",
    "Raven": "dark hair with purple streaks, sharp amber eyes, striking sharp features, mysterious aura",
    "Felix": "messy auburn hair, bright green eyes, youthful cute features, energetic vibe",
    "Morgan": "short grey-streaked hair, warm brown eyes behind stylish glasses, mature refined features",
    "Ash": "black tousled hair falling over forehead, intense dark eyes, handsome brooding features",
    "Jade": "long wavy chestnut hair, sparkling hazel eyes, stunning attractive features, radiant skin",
    "River": "wild colorful rainbow hair, mismatched eyes (one blue one green), unique quirky features",
}


@router.post("/admin/generate-calibration-avatars")
async def generate_calibration_avatars(
    name: Optional[str] = Query(None, description="Generate for specific character only"),
    force: bool = Query(False, description="Force regenerate even if avatar exists"),
    db=Depends(get_db),
):
    """Generate hero avatars for calibration characters.

    This endpoint is auth-exempt for calibration sprint use only.
    Uses FLUX for image generation with new prompt assembly contract.

    Pass ?name=Luna to generate for a specific character (avoids rate limits).
    Pass ?force=true to regenerate even if avatar already exists.
    """
    import asyncio

    service = get_avatar_generation_service()

    # Build query - all calibration characters
    all_chars = list(CALIBRATION_APPEARANCE_HINTS.keys())

    if force:
        # Force mode: get all specified characters
        query = """
            SELECT c.id, c.name, c.archetype, c.created_by
            FROM characters c
            WHERE c.name = ANY(:names)
        """
    else:
        # Default: only characters without hero avatars
        query = """
            SELECT c.id, c.name, c.archetype, c.created_by
            FROM characters c
            LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
            WHERE (ak.primary_anchor_id IS NULL OR c.active_avatar_kit_id IS NULL)
            AND c.name = ANY(:names)
        """

    params = {"names": all_chars}

    if name:
        query = query.replace("c.name = ANY(:names)", "c.name = :name")
        params = {"name": name}

    rows = await db.fetch_all(query + " ORDER BY c.name", params)

    if not rows:
        return {"message": "All calibration characters have hero avatars (or name not found)", "generated": 0}

    results = []
    for i, row in enumerate(rows):
        row_dict = dict(row)
        char_name = row_dict["name"]
        character_id = row_dict["id"]
        user_id = row_dict["created_by"]

        appearance_hint = CALIBRATION_APPEARANCE_HINTS.get(char_name, "")

        try:
            result = await service.generate_hero_avatar(
                character_id=character_id,
                user_id=user_id,
                db=db,
                appearance_description=appearance_hint,
            )

            if result.success:
                results.append({
                    "name": char_name,
                    "status": "generated",
                    "asset_id": str(result.asset_id),
                    "image_url": result.image_url,
                })
            else:
                results.append({
                    "name": char_name,
                    "status": f"failed: {result.error}",
                })

        except Exception as e:
            results.append({
                "name": char_name,
                "status": f"error: {str(e)}",
            })

        # Add delay between requests to avoid rate limiting
        if i < len(rows) - 1:
            await asyncio.sleep(3)

    return {
        "message": f"Processed {len(results)} characters",
        "results": results,
    }
