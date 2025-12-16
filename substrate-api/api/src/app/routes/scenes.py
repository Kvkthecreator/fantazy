"""Scene generation API routes."""
import json
import logging
import uuid
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.image import (
    Memory,
    MemorySaveRequest,
    SceneGenerateRequest,
    SceneGenerateResponse,
    SceneImageWithAsset,
)
from app.services.image import ImageService
from app.services.llm import LLMService
from app.services.storage import StorageService
from app.services.usage import UsageService
from app.services.credits import CreditsService, InsufficientSparksError

log = logging.getLogger(__name__)

router = APIRouter(prefix="/scenes", tags=["Scenes"])


# ═══════════════════════════════════════════════════════════════════════════════
# KONTEXT MODE PROMPT TEMPLATE
# Used when we have an anchor/reference image. Character appearance comes from
# the reference image, so prompt describes ONLY action/setting/mood.
# ═══════════════════════════════════════════════════════════════════════════════
KONTEXT_PROMPT_TEMPLATE = """Create an image prompt that transforms a reference photo into a NEW SCENE.

CRITICAL: The reference image already shows the character's appearance.
DO NOT describe the character's face, hair, eyes, or clothing.
ONLY describe the ACTION, SETTING, and MOOD.

SETTING & MOOD:
- Location: {scene}
- Relationship stage: {relationship_stage}
- Emotional tone: {emotional_tone}
- Tension level: {tension_level}/100

CURRENT CONVERSATION (capture THIS specific moment):
{conversation_summary}

TENSION LEVEL VISUAL GUIDE:
- Low (0-30): Casual activity, soft gaze, comfortable posture
- Medium (30-60): Attentive pose, warm eye contact, open body language
- High (60-80): Leaning in, intense gaze, dramatic lighting
- Peak (80-100): Intimate proximity, charged atmosphere, breath-close

WHAT TO DESCRIBE (action/setting only, NOT appearance):
1. What ACTION is the character doing right now?
2. What SETTING DETAILS should be visible?
3. What is the LIGHTING mood?
4. What EXPRESSION/EMOTION should show?

Write a prompt (40-60 words) describing ONLY the scene transformation.

FORMAT: "[action/pose], [setting details], [lighting], [expression], anime style, cinematic"

GOOD EXAMPLE: "leaning on café counter wiping espresso machine, dim after-hours lighting with warm lamp glow, steaming coffee cup nearby, soft knowing glance over shoulder, anime style, cinematic"

BAD EXAMPLE (DO NOT DO THIS): "young woman with brown hair and amber eyes, wearing cream sweater..." ← This describes appearance which comes from the reference!

Your prompt:"""

# ═══════════════════════════════════════════════════════════════════════════════
# T2I MODE PROMPT TEMPLATE
# Used when NO reference image exists. Must include full character appearance.
# ═══════════════════════════════════════════════════════════════════════════════
T2I_PROMPT_TEMPLATE = """Create an image prompt for this romantic moment. Include full character description.

CHARACTER:
- Name: {character_name}
- Appearance: {appearance_prompt}

SETTING & MOOD:
- Location: {scene}
- Relationship stage: {relationship_stage}
- Emotional tone: {emotional_tone}
- Tension level: {tension_level}/100

CURRENT CONVERSATION (capture THIS specific moment):
{conversation_summary}

TENSION LEVEL VISUAL GUIDE:
- Low (0-30): Casual activity, soft gaze, comfortable posture
- Medium (30-60): Attentive pose, warm eye contact, open body language
- High (60-80): Leaning in, intense gaze, dramatic lighting
- Peak (80-100): Intimate proximity, charged atmosphere, breath-close

Write a prompt (50-80 words) for this specific scenario.

FORMAT: "solo, 1girl, [character appearance from above], [action], [setting], [lighting], [expression], anime style, cinematic"

Example: "solo, 1girl, young woman with long wavy brown hair and warm amber eyes wearing cozy cream sweater, leaning on café counter, dim after-hours lighting, soft knowing smile, anime style, cinematic"

Your prompt:"""

CAPTION_PROMPT = """Based on this scene prompt, write a short poetic caption (1-2 sentences) that captures the emotional moment. Keep it evocative but brief.

Scene: {prompt}

Caption:"""


@router.post("/generate", response_model=SceneGenerateResponse)
async def generate_scene(
    data: SceneGenerateRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Generate a scene image for an episode.

    If no prompt is provided, one will be auto-generated from episode context.
    Uses avatar kit for character consistency when available.
    """
    # Check spark balance before generation
    credits_service = CreditsService.get_instance()
    spark_check = await credits_service.check_balance(user_id, "flux_generation")

    if not spark_check.allowed:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_sparks",
                "message": spark_check.message,
                "balance": spark_check.balance,
                "cost": spark_check.cost,
                "upgrade_url": "/settings?tab=sparks",
            },
        )

    # Verify episode ownership and get character + avatar kit info + relationship context
    episode_query = """
        SELECT
            e.id, e.title, e.scene,
            c.name as character_name,
            c.id as character_id,
            c.active_avatar_kit_id,
            ak.appearance_prompt,
            ak.style_prompt,
            ak.negative_prompt,
            ak.primary_anchor_id,
            'acquaintance' as relationship_stage,
            eng.dynamic as relationship_dynamic
        FROM sessions e
        JOIN characters c ON c.id = e.character_id
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id AND ak.status = 'active'
        LEFT JOIN engagements eng ON eng.character_id = c.id AND eng.user_id = e.user_id
        WHERE e.id = :episode_id AND e.user_id = :user_id
    """
    episode = await db.fetch_one(
        episode_query,
        {"episode_id": str(data.episode_id), "user_id": str(user_id)},
    )

    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found",
        )

    # Extract relationship context for emotional grounding
    relationship_stage = episode["relationship_stage"] or "acquaintance"
    relationship_dynamic = episode["relationship_dynamic"]
    if isinstance(relationship_dynamic, str):
        try:
            relationship_dynamic = json.loads(relationship_dynamic)
        except:
            relationship_dynamic = {}
    elif relationship_dynamic is None:
        relationship_dynamic = {}

    emotional_tone = relationship_dynamic.get("tone", "intrigued")
    tension_level = relationship_dynamic.get("tension_level", 45)

    # Get conversation summary for context (last few messages)
    messages_query = """
        SELECT role, content
        FROM messages
        WHERE episode_id = :episode_id
        ORDER BY created_at DESC
        LIMIT 10
    """
    messages = await db.fetch_all(messages_query, {"episode_id": str(data.episode_id)})
    conversation_summary = "\n".join(
        [f"{m['role']}: {m['content'][:100]}..." for m in reversed(messages)]
    ) if messages else "No messages yet"

    # Extract avatar kit data (if available)
    # Note: Database Record uses bracket notation, not .get()
    avatar_kit_id = episode["active_avatar_kit_id"]
    appearance_prompt = episode["appearance_prompt"] or "A character"
    style_prompt = episode["style_prompt"] or ""
    negative_prompt = episode["negative_prompt"] or ""

    # Get storage service instance
    storage = StorageService.get_instance()

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: Determine generation mode (Kontext vs T2I)
    # Check if anchor exists FIRST - this determines which prompt template to use
    # ═══════════════════════════════════════════════════════════════════════════
    primary_anchor_id = episode["primary_anchor_id"]
    use_kontext = False
    anchor_bytes = None

    if primary_anchor_id:
        try:
            anchor_query = """
                SELECT storage_path FROM avatar_assets
                WHERE id = :anchor_id AND is_active = TRUE
            """
            anchor = await db.fetch_one(anchor_query, {"anchor_id": str(primary_anchor_id)})
            if anchor:
                anchor_bytes = await storage.download("avatars", anchor["storage_path"])
                use_kontext = True
                log.info(f"KONTEXT MODE: Using anchor reference {primary_anchor_id}")
        except Exception as e:
            log.warning(f"Failed to fetch anchor, falling back to T2I: {e}")

    if not use_kontext:
        log.info("T2I MODE: No anchor available, using text-to-image")

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: Generate prompt using appropriate template for the mode
    # Kontext: Describe action/setting/mood ONLY (appearance from reference)
    # T2I: Include full character appearance in prompt
    # ═══════════════════════════════════════════════════════════════════════════
    prompt = data.prompt
    if not prompt:
        llm = LLMService.get_instance()

        if use_kontext:
            # KONTEXT MODE: Prompt describes scene transformation only
            prompt_request = KONTEXT_PROMPT_TEMPLATE.format(
                scene=episode["scene"] or "A cozy setting",
                relationship_stage=relationship_stage,
                emotional_tone=emotional_tone,
                tension_level=tension_level,
                conversation_summary=conversation_summary,
            )
            system_prompt = """You are an expert at writing scene transformation prompts for FLUX Kontext.

CRITICAL: A reference image of the character will be provided separately.
Your prompt must describe ONLY the scene/action - NOT the character's appearance.

DO NOT mention: hair color, eye color, face features, clothing details, body type
DO describe: action, pose, setting, lighting, mood, expression

The reference image handles character consistency. Your prompt handles the scene."""

        else:
            # T2I MODE: Prompt includes full character appearance
            prompt_request = T2I_PROMPT_TEMPLATE.format(
                character_name=episode["character_name"],
                appearance_prompt=appearance_prompt,
                scene=episode["scene"] or "A cozy setting",
                relationship_stage=relationship_stage,
                emotional_tone=emotional_tone,
                tension_level=tension_level,
                conversation_summary=conversation_summary,
            )
            system_prompt = """You are an expert at writing image generation prompts for anime-style illustrations.

CRITICAL RULES:
1. ALWAYS start with "solo, 1girl" (or "solo, 1boy" for male characters)
2. Include the character's full appearance as described
3. NEVER include multiple people - only the character
4. Capture the SPECIFIC scenario from the conversation
5. Match lighting to the location"""

        try:
            response = await llm.generate([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_request},
            ])
            prompt = response.content.strip()

            # Append style prompt if available (for both modes)
            if style_prompt:
                prompt = f"{prompt}, {style_prompt}"

            log.info(f"Generated {'KONTEXT' if use_kontext else 'T2I'} prompt: {prompt[:100]}...")

        except Exception as e:
            log.warning(f"Failed to generate scene prompt: {e}")
            if use_kontext:
                # Kontext fallback: generic scene description
                prompt = f"looking at viewer, {episode['scene'] or 'cozy indoor setting'}, warm lighting, anime style"
            else:
                # T2I fallback: include appearance
                prompt = f"{appearance_prompt}, in an anime style, warm lighting, soft colors"

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 3: Generate image using appropriate method
    # ═══════════════════════════════════════════════════════════════════════════
    try:
        if use_kontext and anchor_bytes:
            # Use FLUX Kontext for character-consistent generation
            kontext_service = ImageService.get_client("replicate", "black-forest-labs/flux-kontext-pro")
            image_response = await kontext_service.edit(
                prompt=prompt,
                reference_images=[anchor_bytes],
                aspect_ratio="1:1",
            )
        else:
            # Fall back to standard T2I (no reference available)
            # Build comprehensive negative prompt
            base_negative = "multiple people, two people, twins, couple, pair, duo, 2girls, 2boys, group, crowd"
            if negative_prompt:
                full_negative = f"{base_negative}, {negative_prompt}"
            else:
                full_negative = base_negative

            image_service = ImageService.get_instance()
            image_response = await image_service.generate(
                prompt=prompt,
                negative_prompt=full_negative,
                width=1024,
                height=1024,
                num_images=1,
            )
    except Exception as e:
        log.error(f"Image generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image generation failed: {str(e)}",
        )

    if not image_response.images:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No image generated",
        )

    image_bytes = image_response.images[0]
    image_id = uuid.uuid4()

    # Upload to storage
    try:
        storage_path = await storage.upload_scene(
            image_bytes=image_bytes,
            user_id=user_id,
            episode_id=data.episode_id,
            image_id=image_id,
        )
    except Exception as e:
        log.error(f"Storage upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store image: {str(e)}",
        )

    # Generate caption
    caption = None
    try:
        llm = LLMService.get_instance()
        caption_response = await llm.generate([
            {"role": "user", "content": CAPTION_PROMPT.format(prompt=prompt)},
        ], max_tokens=100)
        caption = caption_response.content.strip().strip('"')
    except Exception as e:
        log.warning(f"Caption generation failed: {e}")

    # Get next sequence index (function works with renamed table)
    index_query = "SELECT get_next_episode_image_index(:episode_id) as idx"
    index_row = await db.fetch_one(index_query, {"episode_id": str(data.episode_id)})
    sequence_index = index_row["idx"] if index_row else 0

    # Save to database
    # 1. Create image_asset record (still using image_assets for scene storage)
    asset_query = """
        INSERT INTO image_assets (
            id, type, user_id, character_id, storage_bucket, storage_path,
            prompt, model_used, latency_ms, file_size_bytes
        )
        VALUES (
            :id, 'scene', :user_id, :character_id, 'scenes', :storage_path,
            :prompt, :model_used, :latency_ms, :file_size_bytes
        )
        RETURNING id
    """
    await db.execute(
        asset_query,
        {
            "id": str(image_id),
            "user_id": str(user_id),
            "character_id": str(episode["character_id"]),
            "storage_path": storage_path,
            "prompt": prompt,
            "model_used": image_response.model,
            "latency_ms": image_response.latency_ms,
            "file_size_bytes": len(image_bytes),
        },
    )

    # 2. Create scene_images record (renamed from episode_images)
    scene_image_query = """
        INSERT INTO scene_images (
            episode_id, image_id, sequence_index, caption, trigger_type, avatar_kit_id
        )
        VALUES (
            :episode_id, :image_id, :sequence_index, :caption, :trigger_type, :avatar_kit_id
        )
        RETURNING id
    """
    await db.execute(
        scene_image_query,
        {
            "episode_id": str(data.episode_id),
            "image_id": str(image_id),
            "sequence_index": sequence_index,
            "caption": caption,
            "trigger_type": data.trigger_type,
            "avatar_kit_id": str(avatar_kit_id) if avatar_kit_id else None,
        },
    )

    # Create signed URL for the new image
    image_url = await storage.create_signed_url("scenes", storage_path)

    # Spend sparks after successful generation
    await credits_service.spend(
        user_id=user_id,
        feature_key="flux_generation",
        reference_id=str(image_id),
        metadata={
            "character_id": str(episode["character_id"]),
            "episode_id": str(data.episode_id),
            "model_used": image_response.model,
        },
    )

    # Also track in usage_events for analytics (keep existing tracking)
    usage_service = UsageService.get_instance()
    await usage_service.increment_flux_usage(
        user_id=str(user_id),
        character_id=str(episode["character_id"]),
        episode_id=str(data.episode_id),
        model_used=image_response.model,
    )

    return SceneGenerateResponse(
        image_id=image_id,
        episode_id=data.episode_id,
        storage_path=storage_path,
        image_url=image_url,
        caption=caption,
        prompt=prompt,
        model_used=image_response.model,
        latency_ms=image_response.latency_ms,
        sequence_index=sequence_index,
        avatar_kit_id=avatar_kit_id,
    )


@router.get("/episode/{episode_id}", response_model=List[SceneImageWithAsset])
async def list_episode_images(
    episode_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """List all scene images for a session."""
    # Verify session ownership
    session_check = await db.fetch_one(
        "SELECT id FROM sessions WHERE id = :episode_id AND user_id = :user_id",
        {"episode_id": str(episode_id), "user_id": str(user_id)},
    )

    if not session_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Query uses renamed table: scene_images
    query = """
        SELECT
            si.id, si.episode_id, si.image_id, si.sequence_index, si.caption,
            si.triggered_by_message_id, si.trigger_type, si.is_memory, si.saved_at,
            si.avatar_kit_id, si.derived_from_asset_id, si.created_at,
            ia.storage_path, ia.prompt, ia.style_tags
        FROM scene_images si
        JOIN image_assets ia ON ia.id = si.image_id
        WHERE si.episode_id = :episode_id
        ORDER BY si.sequence_index ASC
    """
    rows = await db.fetch_all(query, {"episode_id": str(episode_id)})

    # Generate signed URLs for each image
    storage = StorageService.get_instance()
    results = []
    for row in rows:
        data = dict(row)
        data["image_url"] = await storage.create_signed_url("scenes", data["storage_path"])
        results.append(SceneImageWithAsset(**data))

    return results


@router.patch("/{scene_image_id}/memory", response_model=SceneImageWithAsset)
async def toggle_memory(
    scene_image_id: UUID,
    data: MemorySaveRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Save or unsave a scene image as a memory."""
    # Update with ownership check via session
    query = """
        UPDATE scene_images si
        SET is_memory = :is_memory,
            saved_at = CASE WHEN :is_memory THEN NOW() ELSE NULL END
        FROM sessions e
        WHERE si.id = :scene_image_id
          AND si.episode_id = e.id
          AND e.user_id = :user_id
        RETURNING si.id, si.episode_id, si.image_id, si.sequence_index, si.caption,
                  si.triggered_by_message_id, si.trigger_type, si.is_memory, si.saved_at,
                  si.avatar_kit_id, si.derived_from_asset_id, si.created_at
    """
    row = await db.fetch_one(
        query,
        {
            "scene_image_id": str(scene_image_id),
            "is_memory": data.is_memory,
            "user_id": str(user_id),
        },
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scene image not found",
        )

    # Fetch asset data
    asset_query = """
        SELECT storage_path, prompt, style_tags
        FROM image_assets
        WHERE id = :image_id
    """
    asset = await db.fetch_one(asset_query, {"image_id": str(row["image_id"])})

    storage = StorageService.get_instance()
    result = dict(row)
    result["storage_path"] = asset["storage_path"]
    result["image_url"] = await storage.create_signed_url("scenes", asset["storage_path"])
    result["prompt"] = asset["prompt"]
    result["style_tags"] = asset["style_tags"] or []

    return SceneImageWithAsset(**result)


@router.get("/memories", response_model=List[Memory])
async def list_memories(
    user_id: UUID = Depends(get_current_user_id),
    character_id: Optional[UUID] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db),
):
    """List user's saved memories (starred scene cards)."""
    # Use the helper function (updated to use scene_images)
    query = "SELECT * FROM get_user_memories(:user_id, :character_id, :limit)"
    rows = await db.fetch_all(
        query,
        {
            "user_id": str(user_id),
            "character_id": str(character_id) if character_id else None,
            "limit": limit,
        },
    )

    storage = StorageService.get_instance()
    results = []
    for row in rows:
        data = dict(row)
        data["image_url"] = await storage.create_signed_url("scenes", data["storage_path"])
        results.append(Memory(**data))

    return results
