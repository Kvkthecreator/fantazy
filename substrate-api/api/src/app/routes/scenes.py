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
    SceneGalleryItem,
    SceneGenerateRequest,
    SceneGenerateResponse,
    SceneImageWithAsset,
)
from app.services.image import ImageService
from app.services.llm import LLMService
from app.services.storage import StorageService
from app.services.usage import UsageService
from app.services.credits import CreditsService, InsufficientSparksError
from app.services.content_image_generation import ALL_EPISODE_BACKGROUNDS

log = logging.getLogger(__name__)

router = APIRouter(prefix="/scenes", tags=["Scenes"])


# ═══════════════════════════════════════════════════════════════════════════════
# KONTEXT MODE PROMPT TEMPLATE
# Used when we have an anchor/reference image. Character appearance comes from
# the reference image, so prompt describes ONLY action/setting/mood.
# ═══════════════════════════════════════════════════════════════════════════════
KONTEXT_PROMPT_TEMPLATE = """Create an image prompt capturing THIS EXACT MOMENT from the conversation.

CRITICAL: The reference image shows the character's appearance.
DO NOT describe face, hair, eyes, or clothing.
ONLY describe ACTION, SETTING, and EXPRESSION.

═══════════════════════════════════════════════════════════════════════════════
STEP 1: THE CONVERSATION (What's happening RIGHT NOW?)
═══════════════════════════════════════════════════════════════════════════════
{conversation_summary}

═══════════════════════════════════════════════════════════════════════════════
STEP 2: THE SETTING (Where are they?)
═══════════════════════════════════════════════════════════════════════════════
{episode_situation}

Episode context: {episode_frame}

═══════════════════════════════════════════════════════════════════════════════
STEP 3: THE EMOTIONAL BEAT
═══════════════════════════════════════════════════════════════════════════════
Relationship: {relationship_stage} | Tone: {emotional_tone} | Tension: {tension_level}/100

Tension guide:
- 0-30: Casual, comfortable, soft gaze
- 30-60: Attentive, warm eye contact, slightly leaning in
- 60-80: Intense gaze, dramatic lighting, close proximity
- 80-100: Intimate, charged atmosphere, breath-close

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK: Write ONE prompt (40-60 words)
═══════════════════════════════════════════════════════════════════════════════
Capture what's happening in the conversation above:
1. WHAT action matches the conversation? (Don't invent - use what they're discussing)
2. WHERE exactly? (Use the setting details)
3. WHAT expression fits the emotional tone?

FORMAT: "[action from conversation], [setting details], [lighting], [expression], anime style, cinematic"

Your prompt:"""

# ═══════════════════════════════════════════════════════════════════════════════
# T2I MODE PROMPT TEMPLATE
# Used when NO reference image exists. Must include full character appearance.
# ═══════════════════════════════════════════════════════════════════════════════
T2I_PROMPT_TEMPLATE = """Create an image prompt capturing THIS EXACT MOMENT. Include character appearance.

CHARACTER: {character_name}
Appearance: {appearance_prompt}

═══════════════════════════════════════════════════════════════════════════════
STEP 1: THE CONVERSATION (What's happening RIGHT NOW?)
═══════════════════════════════════════════════════════════════════════════════
{conversation_summary}

═══════════════════════════════════════════════════════════════════════════════
STEP 2: THE SETTING (Where are they?)
═══════════════════════════════════════════════════════════════════════════════
{episode_situation}

Episode context: {episode_frame}

═══════════════════════════════════════════════════════════════════════════════
STEP 3: THE EMOTIONAL BEAT
═══════════════════════════════════════════════════════════════════════════════
Relationship: {relationship_stage} | Tone: {emotional_tone} | Tension: {tension_level}/100

Tension guide:
- 0-30: Casual, comfortable, soft gaze
- 30-60: Attentive, warm eye contact, slightly leaning in
- 60-80: Intense gaze, dramatic lighting, close proximity
- 80-100: Intimate, charged atmosphere, breath-close

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK: Write ONE prompt (50-80 words)
═══════════════════════════════════════════════════════════════════════════════
Capture what's happening in the conversation above:
1. Start with "solo, 1girl" (or 1boy) + character appearance
2. WHAT action matches the conversation? (Don't invent - use what they're discussing)
3. WHERE exactly? (Use the setting details)
4. WHAT expression fits the emotional tone?

FORMAT: "solo, 1girl, [appearance], [action from conversation], [setting], [lighting], [expression], anime style, cinematic"

Your prompt:"""



# Spark costs for different generation modes
SPARK_COST_T2I = 1
SPARK_COST_KONTEXT = 3


@router.post("/generate", response_model=SceneGenerateResponse)
async def generate_scene(
    data: SceneGenerateRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Generate a scene image for an episode.

    If no prompt is provided, one will be auto-generated from episode context.
    Uses avatar kit for character consistency when available.

    generation_mode parameter:
    - "t2i": Text-to-image (1 spark) - always uses full prompt description
    - "kontext": Character reference (3 sparks) - uses anchor image for consistency
    - None: Auto-detect based on anchor availability
    """
    credits_service = CreditsService.get_instance()

    # Determine spark cost based on requested mode (may be adjusted later if mode is auto)
    # For now, assume T2I cost for initial check if mode is auto
    requested_mode = data.generation_mode
    if requested_mode == "kontext":
        spark_cost = SPARK_COST_KONTEXT
    else:
        spark_cost = SPARK_COST_T2I

    # Check spark balance before generation
    spark_check = await credits_service.check_balance(user_id, "flux_generation", explicit_cost=spark_cost)

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

    # Verify episode ownership and get character + avatar kit info + relationship context + episode template
    episode_query = """
        SELECT
            e.id, e.title, e.scene, e.episode_template_id,
            c.name as character_name,
            c.id as character_id,
            c.active_avatar_kit_id,
            ak.appearance_prompt,
            ak.style_prompt,
            ak.negative_prompt,
            ak.primary_anchor_id,
            'acquaintance' as relationship_stage,
            eng.dynamic as relationship_dynamic,
            et.title as episode_template_title,
            et.situation as episode_situation,
            et.episode_frame,
            et.dramatic_question
        FROM sessions e
        JOIN characters c ON c.id = e.character_id
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN engagements eng ON eng.character_id = c.id AND eng.user_id = e.user_id
        LEFT JOIN episode_templates et ON et.id = e.episode_template_id
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

    # ═══════════════════════════════════════════════════════════════════════════
    # BUILD CONVERSATION CONTEXT (the moment we're capturing)
    # Priority: Recent messages (full detail) > Session summary > Generic
    # ═══════════════════════════════════════════════════════════════════════════

    # Get recent messages with fuller content (last 6 messages, 300 chars each)
    messages_query = """
        SELECT role, content
        FROM messages
        WHERE episode_id = :episode_id
        ORDER BY created_at DESC
        LIMIT 6
    """
    messages = await db.fetch_all(messages_query, {"episode_id": str(data.episode_id)})

    if messages:
        # Build conversation context from recent messages
        recent_exchange = "\n".join(
            [f"{m['role'].upper()}: {m['content'][:300]}" for m in reversed(messages)]
        )
        conversation_summary = f"RECENT CONVERSATION:\n{recent_exchange}"
    else:
        conversation_summary = "The conversation is just beginning."

    # Also get the session summary if available (narrative arc context)
    session_summary_query = """
        SELECT summary, scene FROM sessions WHERE id = :episode_id
    """
    session_row = await db.fetch_one(session_summary_query, {"episode_id": str(data.episode_id)})
    session_narrative = session_row["summary"] if session_row and session_row["summary"] else None

    if session_narrative:
        conversation_summary = f"SESSION CONTEXT: {session_narrative}\n\n{conversation_summary}"

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
    # User can explicitly request a mode, or we auto-detect based on anchor availability
    # ═══════════════════════════════════════════════════════════════════════════
    primary_anchor_id = episode["primary_anchor_id"]
    use_kontext = False
    anchor_bytes = None
    actual_spark_cost = spark_cost  # Will be used for final spend

    # If user explicitly requested Kontext mode, try to use it
    if requested_mode == "kontext":
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
                    actual_spark_cost = SPARK_COST_KONTEXT
                    log.info(f"KONTEXT MODE (user requested): Using anchor reference {primary_anchor_id}")
                else:
                    log.warning("KONTEXT MODE requested but anchor not found, falling back to T2I")
                    actual_spark_cost = SPARK_COST_T2I
            except Exception as e:
                log.warning(f"KONTEXT MODE requested but failed to fetch anchor, falling back to T2I: {e}")
                actual_spark_cost = SPARK_COST_T2I
        else:
            log.warning("KONTEXT MODE requested but no anchor configured, falling back to T2I")
            actual_spark_cost = SPARK_COST_T2I
    elif requested_mode == "t2i":
        # User explicitly requested T2I mode
        use_kontext = False
        actual_spark_cost = SPARK_COST_T2I
        log.info("T2I MODE (user requested): Using text-to-image")
    else:
        # Auto-detect mode based on anchor availability (legacy behavior)
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
                    actual_spark_cost = SPARK_COST_KONTEXT
                    log.info(f"KONTEXT MODE (auto): Using anchor reference {primary_anchor_id}")
            except Exception as e:
                log.warning(f"Failed to fetch anchor, falling back to T2I: {e}")

        if not use_kontext:
            actual_spark_cost = SPARK_COST_T2I
            log.info("T2I MODE (auto): No anchor available, using text-to-image")

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: Generate prompt using appropriate template for the mode
    # Kontext: Describe action/setting/mood ONLY (appearance from reference)
    # T2I: Include full character appearance in prompt
    # ═══════════════════════════════════════════════════════════════════════════
    prompt = data.prompt
    if not prompt:
        llm = LLMService.get_instance()

        # Extract episode context - prioritize predefined configs, then template data
        episode_title = episode["episode_template_title"] or episode["title"]

        # Check if we have a predefined background config for this episode
        episode_bg_config = ALL_EPISODE_BACKGROUNDS.get(episode_title, {})

        if episode_bg_config:
            # Use the rich config from content_image_generation.py
            location = episode_bg_config.get("location", "")
            time_desc = episode_bg_config.get("time", "")
            mood = episode_bg_config.get("mood", "")
            episode_situation = f"{location}. {time_desc}. {mood}".strip(". ")
            log.info(f"Using predefined episode config for '{episode_title}'")
        else:
            # Fall back to template data
            episode_situation = episode["episode_situation"] or episode["scene"] or "A cozy setting"
            log.info(f"No predefined config for '{episode_title}', using template situation")

        episode_frame = episode["episode_frame"] or "A moment of connection"

        if use_kontext:
            # KONTEXT MODE: Prompt describes scene transformation only
            prompt_request = KONTEXT_PROMPT_TEMPLATE.format(
                episode_situation=episode_situation,
                episode_frame=episode_frame,
                relationship_stage=relationship_stage,
                emotional_tone=emotional_tone,
                tension_level=tension_level,
                conversation_summary=conversation_summary,
            )
            system_prompt = """You are an expert at writing scene prompts for FLUX Kontext.

CRITICAL: A reference image of the character will be provided separately.
Your prompt must describe ONLY the scene/action - NOT the character's appearance.

DO NOT mention: hair color, eye color, face features, clothing details
DO describe: action, pose, setting, lighting, expression

MOST IMPORTANT:
1. Read the CONVERSATION first - capture what's actually happening
2. Use the SETTING provided - ground the scene in that specific place
3. Match the expression to the conversation's emotional tone"""

        else:
            # T2I MODE: Prompt includes full character appearance
            prompt_request = T2I_PROMPT_TEMPLATE.format(
                character_name=episode["character_name"],
                appearance_prompt=appearance_prompt,
                episode_situation=episode_situation,
                episode_frame=episode_frame,
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
5. Use the PHYSICAL SETTING provided - this is where the scene takes place
6. Match lighting to the specific location"""

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
            episode_id, image_id, sequence_index, trigger_type, avatar_kit_id
        )
        VALUES (
            :episode_id, :image_id, :sequence_index, :trigger_type, :avatar_kit_id
        )
        RETURNING id
    """
    await db.execute(
        scene_image_query,
        {
            "episode_id": str(data.episode_id),
            "image_id": str(image_id),
            "sequence_index": sequence_index,
            "trigger_type": data.trigger_type,
            "avatar_kit_id": str(avatar_kit_id) if avatar_kit_id else None,
        },
    )

    # Create signed URL for the new image
    image_url = await storage.create_signed_url("scenes", storage_path)

    # Spend sparks after successful generation (use actual cost based on mode used)
    await credits_service.spend(
        user_id=user_id,
        feature_key="flux_generation",
        reference_id=str(image_id),
        metadata={
            "character_id": str(episode["character_id"]),
            "episode_id": str(data.episode_id),
            "model_used": image_response.model,
            "generation_mode": "kontext" if use_kontext else "t2i",
        },
        explicit_cost=actual_spark_cost,
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
        caption=None,  # No longer generating poetic captions
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


@router.get("/gallery", response_model=List[SceneGalleryItem])
async def list_all_scenes(
    user_id: UUID = Depends(get_current_user_id),
    character_id: Optional[UUID] = Query(None, description="Filter by character"),
    limit: int = Query(50, ge=1, le=100, description="Max scenes to return"),
    db=Depends(get_db),
):
    """List all scene cards for the user (gallery view).

    Returns all generated scenes, not just saved memories.
    Includes series/episode context for organization.
    """
    query = """
        SELECT
            si.image_id,
            si.episode_id,
            si.is_memory,
            si.trigger_type,
            si.created_at,
            s.character_id,
            c.name as character_name,
            ser.title as series_title,
            et.title as episode_title,
            ia.storage_path,
            ia.prompt
        FROM scene_images si
        JOIN sessions s ON s.id = si.episode_id
        JOIN characters c ON c.id = s.character_id
        JOIN image_assets ia ON ia.id = si.image_id
        LEFT JOIN episode_templates et ON et.id = s.episode_template_id
        LEFT JOIN series ser ON ser.id = et.series_id
        WHERE s.user_id = :user_id
    """
    params = {"user_id": str(user_id), "limit": limit}

    if character_id:
        query += " AND s.character_id = :character_id"
        params["character_id"] = str(character_id)

    query += " ORDER BY si.created_at DESC LIMIT :limit"

    rows = await db.fetch_all(query, params)

    storage = StorageService.get_instance()
    results = []
    for row in rows:
        data = dict(row)
        data["image_url"] = await storage.create_signed_url("scenes", data["storage_path"])
        results.append(SceneGalleryItem(**data))

    return results
