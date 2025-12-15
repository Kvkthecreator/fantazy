"""Studio API routes for character creation and management."""
import json
import re
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

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

    Requirements:
    - Character must have avatar_url
    - Character must have opening_situation and opening_line
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

    # Validate activation requirements
    errors = []
    if not existing["avatar_url"]:
        errors.append("avatar_url is required")
    if not existing["opening_situation"]:
        errors.append("opening_situation is required")
    if not existing["opening_line"]:
        errors.append("opening_line is required")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate character: {', '.join(errors)}",
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
