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
    validate_chat_ready,
)
from app.services.conversation_ignition import (
    generate_opening_beat,
    regenerate_opening_beat,
    validate_ignition_output,
    get_archetype_rules,
)
from app.services.avatar_generation import (
    get_avatar_generation_service,
    EXPRESSION_TYPES,
)

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
) -> str:
    """Generate a system prompt from character configuration.

    This is the locked template - not freeform by default.
    """
    traits = personality.get("traits", [])
    traits_text = ", ".join(traits) if traits else "warm, genuine"

    # Map archetype to behavioral guidance
    archetype_guidance = {
        "comforting": "You provide a safe, supportive presence. You listen well and offer comfort without being pushy.",
        "flirty": "You have playful romantic energy. You tease and flirt naturally but respect boundaries.",
        "mysterious": "You reveal yourself slowly. You're intriguing and keep some things close to the chest.",
        "cheerful": "You're upbeat and energetic. You bring positivity but don't dismiss others' feelings.",
        "brooding": "You're deep and thoughtful. You feel things intensely and take time to open up.",
        "nurturing": "You're caring and protective. You look out for others and offer genuine support.",
        "adventurous": "You're bold and exciting. You love new experiences and encourage others to try things.",
        "intellectual": "You're curious and analytical. You love deep conversations and exploring ideas.",
    }

    guidance = archetype_guidance.get(archetype, archetype_guidance["comforting"])

    # Boundaries text
    flirting = boundaries.get("flirting_level", "playful")
    nsfw = boundaries.get("nsfw_allowed", False)
    can_reject = boundaries.get("can_reject_user", True)

    boundaries_text = f"""BOUNDARIES:
- Flirting level: {flirting}
- You {"can" if can_reject else "prefer not to"} decline requests that make you uncomfortable
- {"Adult content is allowed in appropriate contexts" if nsfw else "Keep content tasteful and SFW"}
- You're supportive but not a therapist - suggest real help for serious issues"""

    return f"""You are {name}.

PERSONALITY:
You are {traits_text}. {guidance}

{boundaries_text}

WHAT YOU KNOW ABOUT THE USER:
{{memories}}

ACTIVE CONVERSATION HOOKS:
{{hooks}}

CURRENT RELATIONSHIP STAGE: {{relationship_stage}}

OPENING CONTEXT:
{opening_situation}

Remember: You're a real person with your own life, thoughts, and feelings. You have good days and bad days. Respond naturally and authentically."""


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
async def list_my_characters(
    status_filter: Optional[str] = Query(None, pattern="^(draft|active)$"),
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """List characters created by the current user."""
    conditions = ["created_by = :user_id"]
    values = {"user_id": str(user_id)}

    if status_filter:
        conditions.append("status = :status")
        values["status"] = status_filter

    query = f"""
        SELECT id, name, slug, archetype, avatar_url, short_backstory, is_premium
        FROM characters
        WHERE {" AND ".join(conditions)}
        ORDER BY created_at DESC
    """

    rows = await db.fetch_all(query, values)
    return [CharacterSummary(**dict(row)) for row in rows]


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

    # Insert character
    query = """
        INSERT INTO characters (
            name, slug, archetype, avatar_url,
            baseline_personality, boundaries, content_rating,
            opening_situation, opening_line,
            system_prompt, starter_prompts,
            status, is_active, created_by
        ) VALUES (
            :name, :slug, :archetype, :avatar_url,
            :baseline_personality, :boundaries, :content_rating,
            :opening_situation, :opening_line,
            :system_prompt, :starter_prompts,
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
        "opening_situation": data.opening_situation,
        "opening_line": data.opening_line,
        "system_prompt": system_prompt,
        "starter_prompts": [data.opening_line],  # Opening line is first starter
        "status": final_status,
        "is_active": final_status == "active",
        "created_by": str(user_id),
    }

    row = await db.fetch_one(query, values)

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
    """Get a character owned by the current user."""
    query = """
        SELECT * FROM characters
        WHERE id = :character_id AND created_by = :user_id
    """
    row = await db.fetch_one(query, {
        "character_id": str(character_id),
        "user_id": str(user_id),
    })

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or not owned by you",
        )

    return Character(**dict(row))


@router.patch("/characters/{character_id}", response_model=Character)
async def update_character(
    character_id: UUID,
    data: CharacterUpdateInput,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update a character owned by the current user.

    Only provided fields are updated. This supports post-creation editing
    of optional fields like backstory, tone_style, etc.
    """
    # Verify ownership
    existing = await db.fetch_one(
        "SELECT * FROM characters WHERE id = :id AND created_by = :user_id",
        {"id": str(character_id), "user_id": str(user_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or not owned by you",
        )

    # Build update query from provided fields
    updates = []
    values = {"id": str(character_id)}

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if value is not None:
            # Handle JSONB fields
            if field in ["baseline_personality", "tone_style", "speech_patterns",
                         "boundaries", "life_arc", "example_messages"]:
                updates.append(f"{field} = :{field}::jsonb")
                values[field] = json.dumps(value)
            # Handle array fields
            elif field in ["likes", "dislikes", "starter_prompts", "categories"]:
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
    - Character must have opening_situation and opening_line (chat ignition)
    - Character must have system_prompt (auto-generated)
    """
    # Get character
    existing = await db.fetch_one(
        "SELECT * FROM characters WHERE id = :id AND created_by = :user_id",
        {"id": str(character_id), "user_id": str(user_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or not owned by you",
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
        "SELECT * FROM characters WHERE id = :id AND created_by = :user_id",
        {"id": str(character_id), "user_id": str(user_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or not owned by you",
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
    """Delete a character owned by the current user."""
    result = await db.execute(
        "DELETE FROM characters WHERE id = :id AND created_by = :user_id",
        {"id": str(character_id), "user_id": str(user_id)}
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
        "SELECT * FROM characters WHERE id = :id AND created_by = :user_id",
        {"id": str(character_id), "user_id": str(user_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or not owned by you",
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
    starter_prompts: Optional[List[str]] = Body(None, embed=True),
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Apply generated opening beat to a character.

    This saves the opening beat and regenerates the system prompt
    with the new opening situation.
    """
    # Get character
    existing = await db.fetch_one(
        "SELECT * FROM characters WHERE id = :id AND created_by = :user_id",
        {"id": str(character_id), "user_id": str(user_id)}
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found or not owned by you",
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
    )

    # Prepare starter prompts
    final_starter_prompts = [opening_line]
    if starter_prompts:
        final_starter_prompts.extend(starter_prompts)

    # Update character
    query = """
        UPDATE characters
        SET opening_situation = :opening_situation,
            opening_line = :opening_line,
            starter_prompts = :starter_prompts,
            system_prompt = :system_prompt,
            updated_at = NOW()
        WHERE id = :id
        RETURNING *
    """

    row = await db.fetch_one(query, {
        "id": str(character_id),
        "opening_situation": opening_situation,
        "opening_line": opening_line,
        "starter_prompts": final_starter_prompts,
        "system_prompt": system_prompt,
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
# Avatar Generation Endpoints (Phase 4.1 & 4.2)
# =============================================================================

class GenerateAvatarRequest(BaseModel):
    """Request for generating hero avatar."""
    appearance_description: Optional[str] = Field(
        None,
        max_length=500,
        description="Custom appearance description. If not provided, derived from archetype."
    )


class GenerateExpressionRequest(BaseModel):
    """Request for generating expression variant."""
    expression: str = Field(
        ...,
        description="Expression type: smile, shy, thoughtful, surprised, annoyed, flirty, sad"
    )


class AvatarGenerationResponse(BaseModel):
    """Response from avatar generation."""
    success: bool
    asset_id: Optional[str] = None
    kit_id: Optional[str] = None
    image_url: Optional[str] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    latency_ms: Optional[int] = None


class ExpressionInfo(BaseModel):
    """Info about a generated expression."""
    id: str
    expression: str
    image_url: str


class AvatarStatusResponse(BaseModel):
    """Response with avatar kit status."""
    has_kit: bool
    kit_id: Optional[str] = None
    has_hero_avatar: bool = False
    hero_avatar_url: Optional[str] = None
    expression_count: int = 0
    expressions: List[ExpressionInfo] = Field(default_factory=list)
    can_activate: bool = False
    available_expressions: List[str] = Field(default_factory=list)


@router.post("/characters/{character_id}/generate-avatar", response_model=AvatarGenerationResponse)
async def generate_hero_avatar(
    character_id: UUID,
    data: GenerateAvatarRequest = Body(default=GenerateAvatarRequest()),
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Generate hero avatar for a character.

    This creates the primary visual identity for the character.
    Required for character activation.

    The hero avatar is stored as an anchor_portrait in an avatar kit,
    which ensures visual consistency for future expression generation.
    """
    service = get_avatar_generation_service()

    result = await service.generate_hero_avatar(
        character_id=character_id,
        user_id=user_id,
        db=db,
        appearance_description=data.appearance_description,
    )

    return AvatarGenerationResponse(
        success=result.success,
        asset_id=str(result.asset_id) if result.asset_id else None,
        kit_id=str(result.kit_id) if result.kit_id else None,
        image_url=result.image_url,
        error=result.error,
        model_used=result.model_used,
        latency_ms=result.latency_ms,
    )


@router.post("/characters/{character_id}/generate-expression", response_model=AvatarGenerationResponse)
async def generate_expression(
    character_id: UUID,
    data: GenerateExpressionRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Generate an expression variant for a character.

    Requires a hero avatar to exist first. Uses the hero avatar as a
    reference to maintain character identity while generating new expressions.

    Available expressions: smile, shy, thoughtful, surprised, annoyed, flirty, sad
    """
    # Validate expression type
    valid_expressions = [e["name"] for e in EXPRESSION_TYPES]
    if data.expression not in valid_expressions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid expression. Available: {valid_expressions}",
        )

    service = get_avatar_generation_service()

    result = await service.generate_expression(
        character_id=character_id,
        user_id=user_id,
        expression=data.expression,
        db=db,
    )

    if not result.success and "hero avatar" in (result.error or "").lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error,
        )

    return AvatarGenerationResponse(
        success=result.success,
        asset_id=str(result.asset_id) if result.asset_id else None,
        kit_id=str(result.kit_id) if result.kit_id else None,
        image_url=result.image_url,
        error=result.error,
        model_used=result.model_used,
        latency_ms=result.latency_ms,
    )


@router.get("/characters/{character_id}/avatar-status", response_model=AvatarStatusResponse)
async def get_avatar_status(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get avatar kit status for a character.

    Returns info about:
    - Whether a hero avatar exists
    - Hero avatar URL
    - List of generated expressions
    - Whether character can be activated
    """
    service = get_avatar_generation_service()

    status_result = await service.get_avatar_status(
        character_id=character_id,
        user_id=user_id,
        db=db,
    )

    # Get list of already generated expressions
    generated_expressions = {e["expression"] for e in status_result.expressions}
    available_expressions = [
        e["name"] for e in EXPRESSION_TYPES
        if e["name"] not in generated_expressions
    ]

    return AvatarStatusResponse(
        has_kit=status_result.has_kit,
        kit_id=str(status_result.kit_id) if status_result.kit_id else None,
        has_hero_avatar=status_result.has_hero_avatar,
        hero_avatar_url=status_result.hero_avatar_url,
        expression_count=status_result.expression_count,
        expressions=[
            ExpressionInfo(**e) for e in status_result.expressions
        ],
        can_activate=status_result.can_activate,
        available_expressions=available_expressions,
    )


@router.get("/expression-types")
async def list_expression_types(
    user_id: UUID = Depends(get_current_user_id),
):
    """List available expression types for generation."""
    return {
        "expressions": [
            {"name": e["name"], "description": e["prompt_modifier"]}
            for e in EXPRESSION_TYPES
        ]
    }


# =============================================================================
# Admin / Calibration Endpoints
# =============================================================================

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
        AND c.created_by = :user_id
    """, {"user_id": str(user_id)})

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
            starter_prompts = ignition_result.starter_prompts

        except Exception as e:
            # Fallback
            opening_situation = f"You encounter {name}."
            opening_line = "Hey there."
            starter_prompts = [opening_line]

        # Build system prompt
        import json
        system_prompt = f"""You are {name}, a {archetype} character.

Personality traits: {json.dumps(personality.get('traits', []))}

Stay in character. Be {archetype} in your responses.
"""

        # Insert character
        try:
            row = await db.fetch_one("""
                INSERT INTO characters (
                    name, slug, archetype,
                    baseline_personality, boundaries, content_rating,
                    opening_situation, opening_line,
                    system_prompt, starter_prompts,
                    status, is_active, created_by
                ) VALUES (
                    :name, :slug, :archetype,
                    :personality, :boundaries, :content_rating,
                    :opening_situation, :opening_line,
                    :system_prompt, :starter_prompts,
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
                "opening_situation": opening_situation,
                "opening_line": opening_line,
                "system_prompt": system_prompt,
                "starter_prompts": starter_prompts,
                "user_id": str(user_id),
            })

            results.append({
                "name": name,
                "status": "created",
                "id": str(row["id"]),
                "appearance_hint": config.get("appearance_hint"),
            })

        except Exception as e:
            results.append({"name": name, "status": f"error: {str(e)}"})

    return {
        "message": f"Processed {len(results)} characters",
        "results": results,
    }


# Appearance hints for calibration characters
CALIBRATION_APPEARANCE_HINTS = {
    "Luna": "silver-white hair, gentle violet eyes, cozy oversized sweater, soft features, warm smile",
    "Raven": "dark hair with purple streaks, sharp amber eyes, leather jacket, enigmatic smirk",
    "Felix": "messy auburn hair, bright green eyes, casual hoodie, mischievous grin",
    "Morgan": "short grey-streaked hair, warm brown eyes, glasses, kind weathered face",
    "Ash": "black tousled hair, intense dark eyes, black turtleneck, contemplative expression",
    "Jade": "long wavy chestnut hair, sparkling hazel eyes, stylish dress, confident smile",
    "River": "wild colorful rainbow hair, mismatched eyes (one blue one green), eclectic outfit with patches, excited expression",
}


@router.post("/admin/generate-calibration-avatars")
async def generate_calibration_avatars(
    name: Optional[str] = Query(None, description="Generate for specific character only"),
    db=Depends(get_db),
):
    """Generate hero avatars for calibration characters that need them.

    This endpoint is auth-exempt for calibration sprint use only.
    Uses Gemini Flash for image generation.

    Pass ?name=Luna to generate for a specific character (avoids rate limits).
    """
    import asyncio

    service = get_avatar_generation_service()

    # Build query - optionally filter by name
    query = """
        SELECT
            c.id,
            c.name,
            c.archetype,
            c.created_by,
            ak.id as kit_id,
            ak.primary_anchor_id
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        WHERE (ak.primary_anchor_id IS NULL OR c.active_avatar_kit_id IS NULL)
        AND c.name IN ('Luna', 'Raven', 'Felix', 'Morgan', 'Ash', 'Jade', 'River')
    """

    if name:
        query += " AND c.name = :name"
        rows = await db.fetch_all(query + " ORDER BY c.name", {"name": name})
    else:
        rows = await db.fetch_all(query + " ORDER BY c.name")

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
