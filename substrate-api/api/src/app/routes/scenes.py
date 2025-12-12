"""Scene generation API routes."""
import logging
import os
import uuid
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.image import (
    EpisodeImageWithAsset,
    Memory,
    MemorySaveRequest,
    SceneGenerateRequest,
    SceneGenerateResponse,
)
from app.services.image import ImageService
from app.services.llm import LLMService
from app.services.storage import StorageService

log = logging.getLogger(__name__)

router = APIRouter(prefix="/scenes", tags=["Scenes"])


SCENE_PROMPT_TEMPLATE = """Based on the following conversation context, generate a vivid scene description for an anime-style illustration.

Episode context:
- Title: {episode_title}
- Scene setting: {scene}
- Character: {character_name}
- Recent conversation summary: {conversation_summary}

Generate a scene description that:
1. Captures the current mood and setting
2. Shows the character in the described environment
3. Uses warm, cozy anime aesthetics
4. Includes specific visual details (lighting, colors, atmosphere)

Format your response as a single paragraph scene description suitable for image generation.
Style tags to incorporate: anime style, soft lighting, warm colors, slice-of-life aesthetic.
"""

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
    """
    # Verify episode ownership
    episode_query = """
        SELECT e.id, e.title, e.scene, c.name as character_name, c.id as character_id
        FROM episodes e
        JOIN characters c ON c.id = e.character_id
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

    # Generate prompt if not provided
    prompt = data.prompt
    if not prompt:
        # Use LLM to generate scene prompt
        llm = LLMService.get_instance()
        prompt_request = SCENE_PROMPT_TEMPLATE.format(
            episode_title=episode["title"] or f"Episode with {episode['character_name']}",
            scene=episode["scene"] or "A cozy setting",
            character_name=episode["character_name"],
            conversation_summary=conversation_summary,
        )

        try:
            response = await llm.generate([
                {"role": "system", "content": "You are a creative scene description writer for anime-style illustrations."},
                {"role": "user", "content": prompt_request},
            ])
            prompt = response.content.strip()
        except Exception as e:
            log.warning(f"Failed to generate scene prompt: {e}")
            # Fallback to basic prompt
            prompt = f"A cozy scene with {episode['character_name']} in an anime style, warm lighting, soft colors"

    # Generate the image
    image_service = ImageService.get_instance()
    try:
        image_response = await image_service.generate(
            prompt=prompt,
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
    storage = StorageService.get_instance()
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

    # Get next sequence index
    index_query = "SELECT get_next_episode_image_index(:episode_id) as idx"
    index_row = await db.fetch_one(index_query, {"episode_id": str(data.episode_id)})
    sequence_index = index_row["idx"] if index_row else 0

    # Save to database
    # 1. Create image_asset record
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

    # 2. Create episode_images record
    episode_image_query = """
        INSERT INTO episode_images (
            episode_id, image_id, sequence_index, caption, trigger_type
        )
        VALUES (
            :episode_id, :image_id, :sequence_index, :caption, :trigger_type
        )
        RETURNING id
    """
    await db.execute(
        episode_image_query,
        {
            "episode_id": str(data.episode_id),
            "image_id": str(image_id),
            "sequence_index": sequence_index,
            "caption": caption,
            "trigger_type": data.trigger_type,
        },
    )

    # Construct image URL
    supabase_url = os.getenv("SUPABASE_URL", "")
    image_url = f"{supabase_url}/storage/v1/object/authenticated/scenes/{storage_path}"

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
    )


@router.get("/episode/{episode_id}", response_model=List[EpisodeImageWithAsset])
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

    query = """
        SELECT
            ei.id, ei.episode_id, ei.image_id, ei.sequence_index, ei.caption,
            ei.triggered_by_message_id, ei.trigger_type, ei.is_memory, ei.saved_at,
            ei.created_at,
            ia.storage_path, ia.prompt, ia.style_tags
        FROM episode_images ei
        JOIN image_assets ia ON ia.id = ei.image_id
        WHERE ei.episode_id = :episode_id
        ORDER BY ei.sequence_index ASC
    """
    rows = await db.fetch_all(query, {"episode_id": str(episode_id)})

    supabase_url = os.getenv("SUPABASE_URL", "")
    results = []
    for row in rows:
        data = dict(row)
        data["image_url"] = f"{supabase_url}/storage/v1/object/authenticated/scenes/{data['storage_path']}"
        results.append(EpisodeImageWithAsset(**data))

    return results


@router.patch("/{episode_image_id}/memory", response_model=EpisodeImageWithAsset)
async def toggle_memory(
    episode_image_id: UUID,
    data: MemorySaveRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Save or unsave a scene image as a memory."""
    # Update with ownership check via episode
    query = """
        UPDATE episode_images ei
        SET is_memory = :is_memory,
            saved_at = CASE WHEN :is_memory THEN NOW() ELSE NULL END
        FROM episodes e
        WHERE ei.id = :episode_image_id
          AND ei.episode_id = e.id
          AND e.user_id = :user_id
        RETURNING ei.id, ei.episode_id, ei.image_id, ei.sequence_index, ei.caption,
                  ei.triggered_by_message_id, ei.trigger_type, ei.is_memory, ei.saved_at,
                  ei.created_at
    """
    row = await db.fetch_one(
        query,
        {
            "episode_image_id": str(episode_image_id),
            "is_memory": data.is_memory,
            "user_id": str(user_id),
        },
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode image not found",
        )

    # Fetch asset data
    asset_query = """
        SELECT storage_path, prompt, style_tags
        FROM image_assets
        WHERE id = :image_id
    """
    asset = await db.fetch_one(asset_query, {"image_id": str(row["image_id"])})

    supabase_url = os.getenv("SUPABASE_URL", "")
    result = dict(row)
    result["storage_path"] = asset["storage_path"]
    result["image_url"] = f"{supabase_url}/storage/v1/object/authenticated/scenes/{asset['storage_path']}"
    result["prompt"] = asset["prompt"]
    result["style_tags"] = asset["style_tags"] or []

    return EpisodeImageWithAsset(**result)


@router.get("/memories", response_model=List[Memory])
async def list_memories(
    user_id: UUID = Depends(get_current_user_id),
    character_id: Optional[UUID] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db),
):
    """List user's saved memories (starred scene cards)."""
    # Use the helper function
    query = "SELECT * FROM get_user_memories(:user_id, :character_id, :limit)"
    rows = await db.fetch_all(
        query,
        {
            "user_id": str(user_id),
            "character_id": str(character_id) if character_id else None,
            "limit": limit,
        },
    )

    supabase_url = os.getenv("SUPABASE_URL", "")
    results = []
    for row in rows:
        data = dict(row)
        data["image_url"] = f"{supabase_url}/storage/v1/object/authenticated/scenes/{data['storage_path']}"
        results.append(Memory(**data))

    return results
