"""Scene generation service.

Handles automatic scene card generation for key conversation moments.
Works with existing ImageService for generation, StorageService for upload.

NOTE: This service is used for automatic scene generation during chat.
For manual scene generation, see routes/scenes.py which has fuller avatar kit support.
"""

import logging
import uuid
import os
from typing import Optional, Dict, Any
from uuid import UUID

from app.services.image import ImageService
from app.services.llm import LLMService
from app.services.storage import StorageService

log = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# KONTEXT MODE PROMPT TEMPLATE (Phase 1C: Improved for facial expression focus)
# Used when we have an anchor/reference image. Character appearance comes from
# the reference image, so prompt describes ONLY action/setting/mood/expression.
# ═══════════════════════════════════════════════════════════════════════════════
KONTEXT_PROMPT_TEMPLATE = """Create a scene transformation prompt for FLUX Kontext. A reference image provides character appearance.

CRITICAL: DO NOT describe appearance (hair, eyes, face features, clothing).
DO describe: facial expression, body language, specific action, environmental context, emotional tone.

SETTING & MOMENT:
- Location: {scene}
- What's happening: {moment}

Focus on:
1. FACIAL EXPRESSION - Specific emotion visible in eyes/mouth (vulnerable, teasing, conflicted)
2. WITHIN-SCENE COMPOSITION - Spatial relationship to environment (leaning against, reaching for, turning away from)
3. BODY LANGUAGE - Gesture or posture that conveys the emotional beat
4. ENVIRONMENTAL INTERACTION - How character engages with the space/objects

Write a detailed prompt (50-70 words).

FORMAT: "[specific expression], [precise action/gesture], [environmental interaction], [lighting/atmosphere], [camera angle], anime style, cinematic"

GOOD EXAMPLES:
- "eyes downcast with slight smile, fingers tracing café table edge, leaning back against counter with one foot crossed over ankle, warm dim lighting from overhead pendant lamp, slightly low angle shot, anime style, cinematic"
- "vulnerable expression with parted lips, reaching for coffee cup but hesitating mid-motion, standing at window with rain-blurred cityscape behind, backlit by cool evening light, medium close-up, anime style, cinematic"

BAD EXAMPLES:
- "standing in café" ← Too vague, no expression/gesture detail
- "brown-haired girl smiling" ← Describing appearance instead of scene

Your prompt:"""

# ═══════════════════════════════════════════════════════════════════════════════
# T2I MODE PROMPT TEMPLATE (Phase 1C: Improved for narrative composition)
# Used when NO reference image exists. Must include full character appearance.
# ═══════════════════════════════════════════════════════════════════════════════
T2I_PROMPT_TEMPLATE = """Create an image prompt for this narrative moment. Include full character description AND compositional details.

CHARACTER:
- Name: {character_name}
- Appearance: {appearance_prompt}

SETTING & MOMENT:
- Location: {scene}
- What's happening: {moment}

Write a detailed prompt (60-90 words) that captures the emotional beat through composition.

Focus on:
1. CHARACTER APPEARANCE - Full description from appearance_prompt
2. FACIAL EXPRESSION - Specific emotion conveyed through eyes/mouth
3. BODY LANGUAGE - Gesture, posture, action that tells the story
4. ENVIRONMENTAL COMPOSITION - Spatial relationship to setting
5. LIGHTING & ATMOSPHERE - Mood-enhancing details
6. CAMERA FRAMING - Shot type that serves the narrative

FORMAT: "solo, 1girl, [full appearance], [specific expression], [detailed action/gesture], [environmental interaction], [lighting/atmosphere], [camera angle], anime style, cinematic"

GOOD EXAMPLE: "solo, 1girl, young woman with messy black hair and tired eyes, vulnerable expression with slight smile, wiping down espresso machine while glancing sideways toward door, leaning against café counter with one hand on hip, warm dim overhead lighting casting soft shadows, rain visible through window behind, medium shot from slight low angle, anime style, cinematic"

BAD EXAMPLE: "girl in café smiling" ← Too vague, no compositional detail

Your prompt:"""

CAPTION_PROMPT = """Write a short poetic caption (1-2 sentences) that captures this emotional moment. Keep it evocative but brief.

Scene: {prompt}

Caption:"""

# ═══════════════════════════════════════════════════════════════════════════════
# OBJECT MODE PROMPT TEMPLATE (Director visual_type: object)
# Used for close-up shots of significant items (letters, phones, keys, etc.)
# No character in frame - just the object with atmospheric context.
# ═══════════════════════════════════════════════════════════════════════════════
OBJECT_PROMPT_TEMPLATE = """Create a close-up image prompt for a significant object in this scene.

SETTING: {scene}
OBJECT/MOMENT: {moment}

Write a prompt (30-50 words) for a dramatic close-up of the object.
Focus on: the item itself, lighting, atmosphere, emotional weight.

FORMAT: "[object in detail], [setting context], [dramatic lighting], [mood], anime style, cinematic close-up"

Example: "crumpled handwritten letter on mahogany desk, single desk lamp casting warm glow, rain shadows on paper, melancholic atmosphere, anime style, cinematic close-up"

Your prompt:"""

# ═══════════════════════════════════════════════════════════════════════════════
# ATMOSPHERE MODE PROMPT TEMPLATE (Director visual_type: atmosphere)
# Used for setting/mood shots without any characters visible.
# Establishes emotional context through environment alone.
# ═══════════════════════════════════════════════════════════════════════════════
ATMOSPHERE_PROMPT_TEMPLATE = """Create an atmospheric establishing shot prompt. NO characters in frame.

SETTING: {scene}
MOOD TO CONVEY: {moment}

Write a prompt (40-60 words) for an empty scene that captures the mood.
Focus on: environment details, lighting, atmospheric elements, emotional tone.

FORMAT: "[setting description], [time/lighting], [atmospheric details], [mood], anime style, cinematic, no people"

Example: "empty convenience store interior at 3am, harsh fluorescent lights humming, rain-streaked windows, lonely atmosphere, anime style, cinematic, no people, atmospheric depth"

Your prompt:"""


class SceneService:
    """Service for generating and managing scene cards."""

    def __init__(self, db):
        self.db = db
        self.image_service = ImageService.get_instance()
        self.llm_service = LLMService.get_instance()
        self.storage_service = StorageService.get_instance()

    async def should_generate_scene(
        self,
        episode_id: UUID,
        trigger_type: str,
        message_count: int,
    ) -> bool:
        """Determine if we should generate a scene card.

        Trigger types:
        - episode_start: First message of episode
        - stage_change: Relationship stage advanced
        - milestone: Progress milestone (every 10 messages)
        """
        # Check how many scenes already exist for this episode
        count_query = """
            SELECT COUNT(*) as count FROM scene_images
            WHERE episode_id = :episode_id
        """
        result = await self.db.fetch_one(count_query, {"episode_id": str(episode_id)})
        existing_count = result["count"] if result else 0

        # Limits to avoid spam
        max_scenes_per_episode = 5

        if existing_count >= max_scenes_per_episode:
            return False

        if trigger_type == "episode_start":
            # Generate scene at episode start (first message)
            return message_count <= 2 and existing_count == 0

        elif trigger_type == "milestone":
            # Generate at message milestones
            milestones = [10, 25, 50]
            return message_count in milestones

        elif trigger_type == "stage_change":
            # Always generate on stage change
            return True

        return False

    async def generate_scene_for_moment(
        self,
        episode_id: UUID,
        user_id: UUID,
        character_id: UUID,
        character_name: str,
        scene_setting: str,
        moment_description: str,
        trigger_type: str,
        message_id: Optional[UUID] = None,
        # Avatar kit data (optional, for consistency)
        appearance_prompt: Optional[str] = None,
        style_prompt: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        avatar_kit_id: Optional[UUID] = None,
        # Anchor image for Kontext mode
        anchor_image: Optional[bytes] = None,
    ) -> Optional[Dict[str, Any]]:
        """Generate a scene card for a conversation moment.

        Returns the generated scene data or None if generation fails.

        If anchor_image is provided, uses FLUX Kontext (reference-based).
        Otherwise falls back to T2I with appearance_prompt.
        """
        try:
            # ═══════════════════════════════════════════════════════════════
            # Determine mode and generate appropriate prompt
            # ═══════════════════════════════════════════════════════════════
            use_kontext = anchor_image is not None

            if use_kontext:
                # KONTEXT MODE: Phase 1C improved prompting for facial expressions
                log.info(f"KONTEXT MODE: Generating scene for episode {episode_id}")
                prompt_request = KONTEXT_PROMPT_TEMPLATE.format(
                    scene=scene_setting or "A cozy setting",
                    moment=moment_description,
                )
                system_prompt = """You are an expert at writing scene transformation prompts for FLUX Kontext.

Phase 1C Goal: Better facial expressions and within-scene composition, not just generic poses.

CRITICAL: A reference image provides character appearance. Your prompt must describe ONLY:
- FACIAL EXPRESSION (specific emotion in eyes/mouth)
- BODY LANGUAGE (gesture, posture)
- ENVIRONMENTAL INTERACTION (spatial relationship to setting/objects)
- LIGHTING & CAMERA ANGLE (how the moment is framed)

NEVER mention: hair color, eye color, face shape, clothing, physical appearance

ALWAYS include:
1. Specific facial expression (not just "smiling" - be precise)
2. Detailed gesture or action
3. How they interact with the environment
4. Lighting that enhances the mood
5. Camera angle that serves the emotional beat"""

            else:
                # T2I MODE: Phase 1C improved prompting for narrative composition
                log.info(f"T2I MODE: Generating scene for episode {episode_id}")
                prompt_request = T2I_PROMPT_TEMPLATE.format(
                    character_name=character_name,
                    appearance_prompt=appearance_prompt or "A character",
                    scene=scene_setting or "A cozy setting",
                    moment=moment_description,
                )
                system_prompt = """You are an expert at writing image generation prompts for anime-style narrative illustrations.

Phase 1C Goal: Character portraits that tell a story through composition, not just likeness.

CRITICAL RULES:
1. ALWAYS start with "solo, 1girl" (or "solo, 1boy" for male characters)
2. Include FULL character appearance from appearance_prompt
3. Add SPECIFIC facial expression (not just "smiling")
4. Describe DETAILED gesture/action (not just "standing")
5. Show ENVIRONMENTAL INTERACTION (how they engage with the space)
6. Specify LIGHTING that enhances mood
7. Include CAMERA ANGLE that serves the narrative beat
8. NEVER include multiple people - only the character

Think cinematically: This is a single frame that must convey an emotional story."""

            prompt_response = await self.llm_service.generate([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_request},
            ], max_tokens=300)
            scene_prompt = prompt_response.content.strip()

            # Append style prompt if provided
            if style_prompt:
                scene_prompt = f"{scene_prompt}, {style_prompt}"

            log.info(f"Generated {'KONTEXT' if use_kontext else 'T2I'} prompt: {scene_prompt[:100]}...")

            # ═══════════════════════════════════════════════════════════════
            # Generate image using appropriate method
            # ═══════════════════════════════════════════════════════════════
            if use_kontext:
                # Use FLUX Kontext with reference image
                kontext_service = ImageService.get_client("replicate", "black-forest-labs/flux-kontext-pro")
                image_response = await kontext_service.edit(
                    prompt=scene_prompt,
                    reference_images=[anchor_image],
                    aspect_ratio="1:1",
                )
            else:
                # Fall back to T2I
                base_negative = "multiple people, two people, twins, couple, pair, duo, 2girls, 2boys, group, crowd"
                final_negative = f"{base_negative}, photorealistic, 3D render, harsh shadows, text, watermark"
                if negative_prompt:
                    final_negative = f"{final_negative}, {negative_prompt}"

                image_response = await self.image_service.generate(
                    prompt=scene_prompt,
                    negative_prompt=final_negative,
                    width=1024,
                    height=1024,
                )

            if not image_response.images:
                log.warning("No image generated")
                return None

            image_bytes = image_response.images[0]
            image_id = uuid.uuid4()

            # Upload to storage
            storage_path = await self.storage_service.upload_scene(
                image_bytes=image_bytes,
                user_id=user_id,
                episode_id=episode_id,
                image_id=image_id,
            )

            # Generate caption
            caption = None
            try:
                caption_response = await self.llm_service.generate([
                    {"role": "user", "content": CAPTION_PROMPT.format(prompt=scene_prompt)},
                ], max_tokens=100)
                caption = caption_response.content.strip().strip('"')
            except Exception as e:
                log.warning(f"Caption generation failed: {e}")

            # Get next sequence index
            index_query = "SELECT get_next_episode_image_index(:episode_id) as idx"
            index_row = await self.db.fetch_one(index_query, {"episode_id": str(episode_id)})
            sequence_index = index_row["idx"] if index_row else 0

            # Save to database
            # 1. Create image_asset record
            await self.db.execute("""
                INSERT INTO image_assets (
                    id, type, user_id, character_id, storage_bucket, storage_path,
                    prompt, model_used, latency_ms, file_size_bytes
                )
                VALUES (
                    :id, 'scene', :user_id, :character_id, 'scenes', :storage_path,
                    :prompt, :model_used, :latency_ms, :file_size_bytes
                )
            """, {
                "id": str(image_id),
                "user_id": str(user_id),
                "character_id": str(character_id),
                "storage_path": storage_path,
                "prompt": scene_prompt,
                "model_used": image_response.model,
                "latency_ms": image_response.latency_ms,
                "file_size_bytes": len(image_bytes),
            })

            # 2. Create scene_images record (renamed from episode_images)
            await self.db.execute("""
                INSERT INTO scene_images (
                    episode_id, image_id, sequence_index, caption,
                    triggered_by_message_id, trigger_type, avatar_kit_id
                )
                VALUES (
                    :episode_id, :image_id, :sequence_index, :caption,
                    :message_id, :trigger_type, :avatar_kit_id
                )
            """, {
                "episode_id": str(episode_id),
                "image_id": str(image_id),
                "sequence_index": sequence_index,
                "caption": caption,
                "message_id": str(message_id) if message_id else None,
                "trigger_type": trigger_type,
                "avatar_kit_id": str(avatar_kit_id) if avatar_kit_id else None,
            })

            # Construct image URL
            supabase_url = os.getenv("SUPABASE_URL", "")
            image_url = f"{supabase_url}/storage/v1/object/authenticated/scenes/{storage_path}"

            log.info(f"Generated scene for episode {episode_id}: {caption}")

            return {
                "image_id": str(image_id),
                "episode_id": str(episode_id),
                "storage_path": storage_path,
                "image_url": image_url,
                "caption": caption,
                "sequence_index": sequence_index,
            }

        except Exception as e:
            log.error(f"Scene generation failed: {e}")
            return None

    async def generate_director_visual(
        self,
        visual_type: str,
        episode_id: UUID,
        user_id: UUID,
        character_id: UUID,
        character_name: str,
        scene_setting: str,
        visual_hint: str,
        # Avatar kit data (optional, for character visual_type)
        appearance_prompt: Optional[str] = None,
        style_prompt: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        avatar_kit_id: Optional[UUID] = None,
        anchor_image: Optional[bytes] = None,
    ) -> Optional[Dict[str, Any]]:
        """Generate a visual based on Director's visual_type classification.

        Routes to appropriate generation pipeline based on visual_type:
        - character: Cinematic insert (T2I environmental shot, Phase 1B strategy)
        - object: Close-up of significant item (no character reference)
        - atmosphere: Setting/mood shot (no character, empty scene)
        - instruction: Not handled here (text card, no image generation)
        - none: Not handled here (no visual needed)

        Phase 1B Strategy: All Director auto-gen uses T2I cinematic inserts.
        Character consistency de-emphasized in favor of narrative impact.

        Returns the generated scene data or None if generation fails.
        """
        if visual_type == "character":
            # Character type generates cinematic insert with appearance context
            # Uses character's appearance_prompt for visual consistency
            return await self._generate_cinematic_insert(
                episode_id=episode_id,
                user_id=user_id,
                character_id=character_id,
                scene_setting=scene_setting,
                visual_hint=visual_hint,
                appearance_prompt=appearance_prompt,
                style_prompt=style_prompt,
            )

        elif visual_type == "object":
            return await self._generate_object_visual(
                episode_id=episode_id,
                user_id=user_id,
                character_id=character_id,
                scene_setting=scene_setting,
                visual_hint=visual_hint,
                style_prompt=style_prompt,
            )

        elif visual_type == "atmosphere":
            return await self._generate_atmosphere_visual(
                episode_id=episode_id,
                user_id=user_id,
                character_id=character_id,
                scene_setting=scene_setting,
                visual_hint=visual_hint,
                style_prompt=style_prompt,
            )

        else:
            log.warning(f"Unknown visual_type '{visual_type}', skipping generation")
            return None

    async def _generate_cinematic_insert(
        self,
        episode_id: UUID,
        user_id: UUID,
        character_id: UUID,
        scene_setting: str,
        visual_hint: str,
        appearance_prompt: Optional[str] = None,
        style_prompt: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Generate narrative moment image (auto-gen, manual T2I quality).

        Captures the emotional beat through compositional framing, similar to manual generation
        but triggered automatically by Director.

        Focus: MOMENT + COMPOSITION + ATMOSPHERE
        - Action/gesture happening in this exact moment
        - Environmental grounding (location-specific details)
        - Lighting and mood matching conversation emotion
        - Character presence varies (partial, silhouette, or environmental based on moment)

        Args:
            appearance_prompt: Character's visual description (from character or avatar_kit)
            style_prompt: Art style (e.g., "manhwa style, soft colors" or avatar_kit.style_prompt)

        Examples:
        - Hand reaching for coffee cup, trembling slightly, warm café lighting, rain outside
        - Character at window, back turned, rain-blurred cityscape, melancholic atmosphere
        - Two shadows on wall, intimate proximity, soft evening light filtering through

        Emphasizes composition and emotional resonance over character detail.
        """
        try:
            # Get recent conversation context for mood/vibe
            conversation_summary = await self.get_recent_conversation_summary(episode_id, limit=3)
            log.info(f"CINEMATIC INSERT CONTEXT - conversation_summary: {conversation_summary[:200]}...")

            # Determine the art style description for prompting
            # style_prompt comes from avatar_kit.style_prompt or mapped from style_preset
            style_description = style_prompt or "manhwa style, soft colors, elegant features"
            # Extract style keyword for prompt (e.g., "manhwa", "anime", "cinematic")
            if "manhwa" in style_description.lower() or "webtoon" in style_description.lower():
                style_keyword = "manhwa/webtoon"
            elif "anime" in style_description.lower():
                style_keyword = "anime"
            elif "cinematic" in style_description.lower() or "realistic" in style_description.lower():
                style_keyword = "cinematic/semi-realistic"
            else:
                style_keyword = "illustrated"

            # Build character appearance context if available
            appearance_context = ""
            if appearance_prompt:
                appearance_context = f"\nCHARACTER APPEARANCE: {appearance_prompt}"

            # Generate narrative moment prompt (similar to manual T2I, but auto-generated)
            prompt_request = f"""Create a narrative moment image prompt for this scene.

SETTING/LOCATION: {scene_setting or "An intimate setting"}
EMOTIONAL BEAT: {visual_hint}
CONVERSATION CONTEXT: {conversation_summary}{appearance_context}

Write a detailed prompt (60-80 words) that captures the emotional beat through composition.

Focus on:
1. VISUAL MOMENT - What's happening in this exact moment (action, gesture, posture)
2. EMOTIONAL EXPRESSION - Mood conveyed through body language or environmental cues
3. ENVIRONMENTAL COMPOSITION - How the setting grounds the moment
4. LIGHTING & ATMOSPHERE - Color temperature, mood-enhancing details that match the emotion
5. CAMERA FRAMING - Shot type that serves the narrative (medium shot, low angle, etc.)

STYLE GUIDE:
- Character presence allowed (partial, silhouette, or environmental focus - varies by moment)
- If character is visible, use provided appearance details for consistency
- Emphasize COMPOSITION over character detail
- Location-specific environmental details (penthouse cityscape, café ambiance, etc.)
- Lighting must match both location AND emotional tone
- Art style: {style_keyword} aesthetic, cinematic framing

FORMAT: Descriptive paragraph focusing on the MOMENT and COMPOSITION

GOOD EXAMPLE: "Character's hand reaching for coffee cup on weathered wooden table, fingers trembling slightly, warm amber light from café window casting long afternoon shadows, rain visible through glass behind, steam rising from untouched cup, medium close-up with selective focus, melancholic atmosphere"

BAD EXAMPLE: "Person in café" ← Too vague, no emotional detail

Your prompt:"""

            system_prompt = f"""You are an expert at writing narrative moment prompts for {style_keyword} style scenes.

These are MOMENTS IN TIME - capturing the emotional beat through composition, action, and atmosphere.

CRITICAL RULES:
- Focus on THE MOMENT: What's happening right now (gesture, action, posture, environmental detail)
- COMPOSITION OVER DETAIL: Frame the scene to tell the emotional story
- Location specificity: Extract setting details (café, penthouse, farm, etc.) and ground the moment there
- Emotional resonance: Lighting, weather, atmosphere must match the conversation's mood
- Character presence varies by moment: Sometimes partial/silhouette, sometimes environmental only
- If character appearance is provided, incorporate key visual traits when character is visible
- Avoid generic portraits: Every shot should have narrative purpose
- Style: {style_keyword} aesthetic, cinematic framing, atmospheric mood

Think: Narrative moments that ground emotion in physical space and action."""

            log.info(f"CINEMATIC INSERT INPUT - visual_hint: {visual_hint}")

            prompt_response = await self.llm_service.generate([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_request},
            ], max_tokens=500)  # Increased from 250 to avoid Gemini Flash truncation
            scene_prompt = prompt_response.content.strip()

            log.info(f"CINEMATIC INSERT LLM OUTPUT (raw): {scene_prompt}")

            # Add base anime style if no custom style provided
            if style_prompt:
                scene_prompt = f"{scene_prompt}, {style_prompt}"
            else:
                scene_prompt = f"{scene_prompt}, anime style, cinematic composition, atmospheric lighting, emotional depth"

            log.info(f"CINEMATIC INSERT FINAL PROMPT: {scene_prompt}")

            # Generate using T2I - allowing character presence but avoiding generic portraits
            negative = "photorealistic, 3D render, low quality, blurry, distorted anatomy, text, watermark"
            image_response = await self.image_service.generate(
                prompt=scene_prompt,
                negative_prompt=negative,
                width=1024,
                height=768,  # 4:3 for insert shots
            )

            return await self._save_generated_image(
                image_response=image_response,
                episode_id=episode_id,
                user_id=user_id,
                character_id=character_id,
                scene_prompt=scene_prompt,
                trigger_type="director_auto",
            )

        except Exception as e:
            log.error(f"Cinematic insert generation failed: {e}")
            return None

    async def _generate_object_visual(
        self,
        episode_id: UUID,
        user_id: UUID,
        character_id: UUID,
        scene_setting: str,
        visual_hint: str,
        style_prompt: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Generate object close-up visual (no character)."""
        try:
            # Generate prompt for object close-up
            prompt_request = OBJECT_PROMPT_TEMPLATE.format(
                scene=scene_setting or "A setting",
                moment=visual_hint,
            )
            system_prompt = """You are an expert at writing cinematic close-up prompts.
Focus on the object itself - its details, textures, lighting.
Create atmospheric tension through the object, not characters.
NEVER include people or faces in your prompt."""

            prompt_response = await self.llm_service.generate([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_request},
            ], max_tokens=200)
            scene_prompt = prompt_response.content.strip()

            # Apply style (from avatar_kit or preset mapping)
            style_to_apply = style_prompt or "manhwa style, soft colors, elegant features"
            scene_prompt = f"{scene_prompt}, {style_to_apply}"

            log.info(f"OBJECT MODE: {scene_prompt[:100]}...")

            # Generate using T2I (no character reference needed)
            negative = "person, people, face, human, character, figure, silhouette, photorealistic, 3D render"
            image_response = await self.image_service.generate(
                prompt=scene_prompt,
                negative_prompt=negative,
                width=1024,
                height=1024,
            )

            return await self._save_generated_image(
                image_response=image_response,
                episode_id=episode_id,
                user_id=user_id,
                character_id=character_id,
                scene_prompt=scene_prompt,
                trigger_type="director_auto",
            )

        except Exception as e:
            log.error(f"Object visual generation failed: {e}")
            return None

    async def _generate_atmosphere_visual(
        self,
        episode_id: UUID,
        user_id: UUID,
        character_id: UUID,
        scene_setting: str,
        visual_hint: str,
        style_prompt: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Generate atmospheric/setting visual (no character)."""
        try:
            # Generate prompt for atmosphere shot
            prompt_request = ATMOSPHERE_PROMPT_TEMPLATE.format(
                scene=scene_setting or "A setting",
                moment=visual_hint,
            )
            system_prompt = """You are an expert at writing atmospheric establishing shot prompts.
Create mood through environment - lighting, weather, empty spaces.
NEVER include people, characters, or figures in your prompt.
Focus on the feeling of the space itself."""

            prompt_response = await self.llm_service.generate([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_request},
            ], max_tokens=200)
            scene_prompt = prompt_response.content.strip()

            # Apply style (from avatar_kit or preset mapping)
            style_to_apply = style_prompt or "manhwa style, soft colors, elegant features"
            scene_prompt = f"{scene_prompt}, {style_to_apply}"

            log.info(f"ATMOSPHERE MODE: {scene_prompt[:100]}...")

            # Generate using T2I for backgrounds
            negative = "person, people, face, human, character, figure, silhouette, portrait, photorealistic, 3D render"
            image_response = await self.image_service.generate(
                prompt=scene_prompt,
                negative_prompt=negative,
                width=1024,
                height=576,  # 16:9 for atmospheric shots
            )

            return await self._save_generated_image(
                image_response=image_response,
                episode_id=episode_id,
                user_id=user_id,
                character_id=character_id,
                scene_prompt=scene_prompt,
                trigger_type="director_auto",
            )

        except Exception as e:
            log.error(f"Atmosphere visual generation failed: {e}")
            return None

    async def _save_generated_image(
        self,
        image_response,
        episode_id: UUID,
        user_id: UUID,
        character_id: UUID,
        scene_prompt: str,
        trigger_type: str,
        avatar_kit_id: Optional[UUID] = None,
    ) -> Optional[Dict[str, Any]]:
        """Common image saving logic for all visual types."""
        if not image_response.images:
            log.warning("No image generated")
            return None

        image_bytes = image_response.images[0]
        image_id = uuid.uuid4()

        # Upload to storage
        storage_path = await self.storage_service.upload_scene(
            image_bytes=image_bytes,
            user_id=user_id,
            episode_id=episode_id,
            image_id=image_id,
        )

        # Generate caption
        caption = None
        try:
            caption_input = CAPTION_PROMPT.format(prompt=scene_prompt)
            log.info(f"CAPTION INPUT - scene_prompt length: {len(scene_prompt)}, first 200 chars: {scene_prompt[:200]}")

            caption_response = await self.llm_service.generate([
                {"role": "user", "content": caption_input},
            ], max_tokens=200)  # Increased from 100 to avoid Gemini Flash truncation
            caption = caption_response.content.strip().strip('"')

            log.info(f"CAPTION OUTPUT: {caption}")
        except Exception as e:
            log.warning(f"Caption generation failed: {e}")

        # Get next sequence index
        index_query = "SELECT get_next_episode_image_index(:episode_id) as idx"
        index_row = await self.db.fetch_one(index_query, {"episode_id": str(episode_id)})
        sequence_index = index_row["idx"] if index_row else 0

        # Save to database
        await self.db.execute("""
            INSERT INTO image_assets (
                id, type, user_id, character_id, storage_bucket, storage_path,
                prompt, model_used, latency_ms, file_size_bytes
            )
            VALUES (
                :id, 'scene', :user_id, :character_id, 'scenes', :storage_path,
                :prompt, :model_used, :latency_ms, :file_size_bytes
            )
        """, {
            "id": str(image_id),
            "user_id": str(user_id),
            "character_id": str(character_id),
            "storage_path": storage_path,
            "prompt": scene_prompt,
            "model_used": image_response.model,
            "latency_ms": image_response.latency_ms,
            "file_size_bytes": len(image_bytes),
        })

        await self.db.execute("""
            INSERT INTO scene_images (
                episode_id, image_id, sequence_index, caption,
                trigger_type, avatar_kit_id
            )
            VALUES (
                :episode_id, :image_id, :sequence_index, :caption,
                :trigger_type, :avatar_kit_id
            )
        """, {
            "episode_id": str(episode_id),
            "image_id": str(image_id),
            "sequence_index": sequence_index,
            "caption": caption,
            "trigger_type": trigger_type,
            "avatar_kit_id": str(avatar_kit_id) if avatar_kit_id else None,
        })

        supabase_url = os.getenv("SUPABASE_URL", "")
        image_url = f"{supabase_url}/storage/v1/object/authenticated/scenes/{storage_path}"

        log.info(f"Generated scene for episode {episode_id}: {caption}")

        return {
            "image_id": str(image_id),
            "episode_id": str(episode_id),
            "storage_path": storage_path,
            "image_url": image_url,
            "caption": caption,
            "sequence_index": sequence_index,
        }

    async def get_recent_conversation_summary(
        self,
        episode_id: UUID,
        limit: int = 5,
    ) -> str:
        """Get a summary of recent conversation for scene context."""
        query = """
            SELECT role, content
            FROM messages
            WHERE episode_id = :episode_id
            ORDER BY created_at DESC
            LIMIT :limit
        """
        rows = await self.db.fetch_all(query, {
            "episode_id": str(episode_id),
            "limit": limit,
        })

        if not rows:
            return "Starting a new conversation"

        # Summarize recent exchange
        messages = [f"{row['role']}: {row['content'][:100]}" for row in reversed(rows)]
        return "\n".join(messages)
