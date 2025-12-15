"""Scene generation API routes."""
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


# Scene prompt template - will be enhanced with avatar kit data in Phase 3
SCENE_PROMPT_TEMPLATE = """Create an image generation prompt for this moment.

Context:
- Character: {character_name}
- Appearance: {appearance_prompt}
- Setting: {scene}
- Conversation: {conversation_summary}

Write a concise image prompt (50-80 words) that:
- Describes ONE person matching the appearance description
- Focuses on mood, lighting, and atmosphere
- Uses comma-separated descriptive tags

Format: "[character description], [action/pose], [setting], [lighting], [mood], anime style, detailed background"

Example output: "young woman with long dark hair, sitting by window holding tea cup, cozy cafe interior, golden hour sunlight streaming through glass, peaceful contemplative mood, anime style, detailed background, soft colors"

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

    # Verify episode ownership and get character + avatar kit info
    episode_query = """
        SELECT
            e.id, e.title, e.scene,
            c.name as character_name,
            c.id as character_id,
            c.active_avatar_kit_id,
            ak.appearance_prompt,
            ak.style_prompt,
            ak.negative_prompt,
            ak.primary_anchor_id
        FROM episodes e
        JOIN characters c ON c.id = e.character_id
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id AND ak.status = 'active'
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

    # Generate prompt if not provided
    prompt = data.prompt
    if not prompt:
        # Use LLM to generate scene prompt
        llm = LLMService.get_instance()
        prompt_request = SCENE_PROMPT_TEMPLATE.format(
            character_name=episode["character_name"],
            appearance_prompt=appearance_prompt,
            scene=episode["scene"] or "A cozy setting",
            conversation_summary=conversation_summary,
        )

        try:
            response = await llm.generate([
                {"role": "system", "content": "You are a creative scene description writer for anime-style illustrations."},
                {"role": "user", "content": prompt_request},
            ])
            prompt = response.content.strip()

            # Append style prompt if available
            if style_prompt:
                prompt = f"{prompt}, {style_prompt}"

        except Exception as e:
            log.warning(f"Failed to generate scene prompt: {e}")
            # Fallback to basic prompt with appearance
            prompt = f"{appearance_prompt}, in an anime style, warm lighting, soft colors"

    # Get storage service instance (used for both anchor download and scene upload)
    storage = StorageService.get_instance()

    # Generate the image
    # Check if we have an anchor reference for character consistency
    primary_anchor_id = episode["primary_anchor_id"]
    use_reference = False
    anchor_bytes = None

    if primary_anchor_id:
        # Fetch anchor image for reference-based generation
        try:
            anchor_query = """
                SELECT storage_path FROM avatar_assets
                WHERE id = :anchor_id AND is_active = TRUE
            """
            anchor = await db.fetch_one(anchor_query, {"anchor_id": str(primary_anchor_id)})
            if anchor:
                anchor_bytes = await storage.download("avatars", anchor["storage_path"])
                use_reference = True
                log.info(f"Using anchor reference for scene generation: {primary_anchor_id}")
        except Exception as e:
            log.warning(f"Failed to fetch anchor for reference: {e}")
            # Fall back to T2I without reference

    try:
        if use_reference and anchor_bytes:
            # Use FLUX Kontext for character-consistent generation
            kontext_service = ImageService.get_client("replicate", "black-forest-labs/flux-kontext-pro")
            image_response = await kontext_service.edit(
                prompt=prompt,
                reference_images=[anchor_bytes],
                aspect_ratio="1:1",
            )
        else:
            # Fall back to standard T2I (no reference available)
            image_service = ImageService.get_instance()
            image_response = await image_service.generate(
                prompt=prompt,
                negative_prompt=negative_prompt or None,
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
    """List all scene images for an episode."""
    # Verify episode ownership
    episode_check = await db.fetch_one(
        "SELECT id FROM episodes WHERE id = :episode_id AND user_id = :user_id",
        {"episode_id": str(episode_id), "user_id": str(user_id)},
    )

    if not episode_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found",
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
    # Update with ownership check via episode (using renamed table)
    query = """
        UPDATE scene_images si
        SET is_memory = :is_memory,
            saved_at = CASE WHEN :is_memory THEN NOW() ELSE NULL END
        FROM episodes e
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
