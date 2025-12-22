"""Conversation service - orchestrates chat interactions."""

import asyncio
import json
import logging
from typing import AsyncIterator, Dict, List, Optional
from uuid import UUID

from app.models.character import Character
from app.models.session import Session
from app.models.message import Message, MessageRole, ConversationContext, MemorySummary, HookSummary
from app.models.engagement import Engagement
from app.models.episode_template import EpisodeTemplate, AutoSceneMode
from app.services.llm import LLMService
from app.services.memory import MemoryService
from app.services.usage import UsageService
from app.services.rate_limiter import MessageRateLimiter, RateLimitExceededError
from app.services.director import DirectorService
from app.services.scene import SceneService

log = logging.getLogger(__name__)

# Whether to auto-generate scenes (can be disabled via env var)
ENABLE_AUTO_SCENE_GENERATION = True


class ConversationService:
    """Service for managing character conversations."""

    def __init__(self, db):
        self.db = db
        self.llm = LLMService.get_instance()
        self.memory_service = MemoryService(db)
        self.usage_service = UsageService.get_instance()
        self.rate_limiter = MessageRateLimiter.get_instance()
        self.director_service = DirectorService(db)
        self.scene_service = SceneService(db)

    async def send_message(
        self,
        user_id: UUID,
        character_id: UUID,
        content: str,
        episode_template_id: Optional[UUID] = None,
    ) -> Message:
        """Send a message and get a response.

        This orchestrates the full conversation flow:
        1. Check rate limit (abuse prevention)
        2. Get or create active episode (with episode_template_id if provided)
        3. Build conversation context
        4. Save user message
        5. Generate LLM response
        6. Save assistant message
        7. Run Director for ALL episodes (memory, hooks, turn counting, completion)
        8. Record message for rate limiting
        """
        # Check rate limit (messages are FREE but rate-limited for abuse prevention)
        subscription_status = await self._get_user_subscription_status(user_id)
        rate_check = await self.rate_limiter.check_rate_limit(user_id, subscription_status)

        if not rate_check.allowed:
            raise RateLimitExceededError(
                message=rate_check.message or "Rate limit exceeded",
                reset_at=rate_check.reset_at,
                cooldown_seconds=rate_check.cooldown_seconds,
                remaining=rate_check.remaining,
            )

        # Get or create episode (with episode_template_id for proper session scoping)
        episode = await self.get_or_create_episode(
            user_id, character_id, episode_template_id=episode_template_id
        )

        # Get episode template if session has one (for Director integration)
        episode_template = await self._get_episode_template(episode.episode_template_id)

        # Build context
        context = await self.get_context(user_id, character_id, episode.id)

        # Save user message
        user_message = await self._save_message(
            episode_id=episode.id,
            role=MessageRole.USER,
            content=content,
        )

        # Track message for analytics (non-blocking, fire-and-forget)
        await self.usage_service.increment_message_count(
            user_id=str(user_id),
            character_id=str(character_id),
            episode_id=str(episode.id),
        )

        # Add user message to context
        context.messages.append({"role": "user", "content": content})

        # Generate response
        formatted_messages = context.to_messages()
        llm_response = await self.llm.generate(formatted_messages)

        # Save assistant message
        assistant_message = await self._save_message(
            episode_id=episode.id,
            role=MessageRole.ASSISTANT,
            content=llm_response.content,
            model_used=llm_response.model,
            tokens_input=llm_response.tokens_input,
            tokens_output=llm_response.tokens_output,
            latency_ms=llm_response.latency_ms,
        )

        # Mark hooks as triggered
        for hook in context.hooks:
            await self._mark_hook_triggered(hook.id)

        # Director integration (per DIRECTOR_ARCHITECTURE.md)
        # Director runs for ALL episodes - handles memory, hooks, turn counting, completion
        full_messages = context.messages + [{"role": "assistant", "content": llm_response.content}]
        try:
            # Director is the unified post-exchange processor
            refreshed_session = await self._get_session(episode.id)
            if refreshed_session:
                await self.director_service.process_exchange(
                    session=refreshed_session,
                    episode_template=episode_template,  # Can be None for free-form
                    messages=full_messages,
                    character_id=character_id,
                    user_id=user_id,
                )

            # Also run legacy memory extraction until fully absorbed
            await self._process_exchange(
                user_id=user_id,
                character_id=character_id,
                episode_id=episode.id,
                messages=full_messages,
            )
        except Exception as e:
            log.error(f"Director/memory processing failed: {e}")

        # Record message for rate limiting (after successful send)
        await self.rate_limiter.record_message(user_id)

        return assistant_message

    async def _get_user_subscription_status(self, user_id: UUID) -> str:
        """Get user's subscription status for rate limiting."""
        row = await self.db.fetch_one(
            "SELECT subscription_status FROM users WHERE id = :user_id",
            {"user_id": str(user_id)},
        )
        return row["subscription_status"] if row and row["subscription_status"] else "free"

    async def send_message_stream(
        self,
        user_id: UUID,
        character_id: UUID,
        content: str,
        episode_template_id: Optional[UUID] = None,
    ) -> AsyncIterator[str]:
        """Send a message and stream the response.

        Director Protocol v2.0:
        - PHASE 1: Pre-guidance (before LLM) - pacing, tension, genre beat
        - PHASE 2: Post-evaluation (after LLM) - visuals, completion, memory

        Per DIRECTOR_ARCHITECTURE.md, Director runs for ALL episodes:
        - Open episodes: turn counting, memory, hooks, beat tracking
        - Bounded episodes: all of the above + completion detection + evaluation
        """
        # Check rate limit (messages are FREE but rate-limited for abuse prevention)
        subscription_status = await self._get_user_subscription_status(user_id)
        rate_check = await self.rate_limiter.check_rate_limit(user_id, subscription_status)

        if not rate_check.allowed:
            raise RateLimitExceededError(
                message=rate_check.message or "Rate limit exceeded",
                reset_at=rate_check.reset_at,
                cooldown_seconds=rate_check.cooldown_seconds,
                remaining=rate_check.remaining,
            )

        # Get or create episode (with episode_template_id for proper session scoping)
        episode = await self.get_or_create_episode(
            user_id, character_id, episode_template_id=episode_template_id
        )

        # Get episode template if session has one (for Director integration)
        episode_template = await self._get_episode_template(episode.episode_template_id)

        # Build context
        context = await self.get_context(user_id, character_id, episode.id)

        # Save user message
        await self._save_message(
            episode_id=episode.id,
            role=MessageRole.USER,
            content=content,
        )

        # Track message for analytics (non-blocking, fire-and-forget)
        await self.usage_service.increment_message_count(
            user_id=str(user_id),
            character_id=str(character_id),
            episode_id=str(episode.id),
        )

        # Add user message to context
        context.messages.append({"role": "user", "content": content})

        # =====================================================================
        # DIRECTOR PHASE 1: Pre-Guidance (before character LLM)
        # =====================================================================
        # Generate pacing and tension guidance based on turn position and genre
        if episode_template:
            try:
                guidance = await self.director_service.generate_pre_guidance(
                    messages=context.messages,
                    genre=getattr(episode_template, 'genre', 'romantic_tension'),
                    situation=episode_template.situation or "",
                    dramatic_question=episode_template.dramatic_question or "",
                    turn_count=episode.turn_count,
                    turn_budget=getattr(episode_template, 'turn_budget', None),
                )
                # Inject guidance into context
                context.director_guidance = guidance.to_prompt_section()
                log.debug(f"Director pre-guidance: pacing={guidance.pacing}")
            except Exception as e:
                log.warning(f"Director pre-guidance failed: {e}")

        # Generate streaming response (with Director guidance in context)
        formatted_messages = context.to_messages()
        full_response = []

        async for chunk in self.llm.generate_stream(formatted_messages):
            full_response.append(chunk)
            yield json.dumps({"type": "chunk", "content": chunk})

        response_content = "".join(full_response)

        # Save assistant message
        await self._save_message(
            episode_id=episode.id,
            role=MessageRole.ASSISTANT,
            content=response_content,
            model_used=self.llm.model,
        )

        # Mark hooks as triggered
        for hook in context.hooks:
            await self._mark_hook_triggered(hook.id)

        # =====================================================================
        # DIRECTOR PHASE 2: Post-Evaluation (after character LLM)
        # =====================================================================
        # Evaluate exchange for visuals, completion, and memory extraction
        # Director runs for ALL episodes - handles turn counting, completion detection, evaluation
        full_messages = context.messages + [{"role": "assistant", "content": response_content}]
        director_output = None
        refreshed_session = None

        try:
            # Refresh session to get latest turn_count and director_state
            refreshed_session = await self._get_session(episode.id)
            if refreshed_session:
                # Director processes ALL episodes (open + bounded)
                director_output = await self.director_service.process_exchange(
                    session=refreshed_session,
                    episode_template=episode_template,  # Can be None for free-form
                    messages=full_messages,
                    character_id=character_id,
                    user_id=user_id,
                )

                # Emit Director action events
                if director_output.actions:
                    actions = director_output.actions

                    # Visual pending (if generating)
                    if actions.visual_type != "none":
                        if actions.visual_type == "instruction":
                            # Instruction cards are immediate (no image generation)
                            yield json.dumps({
                                "type": "instruction_card",
                                "content": actions.visual_hint or "",
                            }) + "\n"
                        else:
                            # Image-based visual - emit pending, then generate async
                            yield json.dumps({
                                "type": "visual_pending",
                                "visual_type": actions.visual_type,
                                "visual_hint": actions.visual_hint,
                                "sparks_deducted": actions.deduct_sparks,
                            }) + "\n"

                            # Actually generate the scene image (async, fire-and-forget)
                            if ENABLE_AUTO_SCENE_GENERATION and actions.deduct_sparks > 0:
                                asyncio.create_task(
                                    self._generate_auto_scene(
                                        episode_id=episode.id,
                                        user_id=user_id,
                                        character_id=character_id,
                                        character_name=context.character_name,
                                        scene_setting=episode_template.situation if episode_template else "",
                                        visual_hint=actions.visual_hint or "the current moment",
                                        visual_type=actions.visual_type,
                                    )
                                )

                    # Needs sparks prompt (first time only)
                    if actions.needs_sparks:
                        yield json.dumps({
                            "type": "needs_sparks",
                            "message": "You need more Sparks to unlock auto-generated scenes.",
                        }) + "\n"

                # Emit episode_complete event if Director detected completion
                if director_output.is_complete:
                    yield json.dumps({
                        "type": "episode_complete",
                        "turn_count": director_output.turn_count,
                        "trigger": director_output.completion_trigger or "unknown",
                        "next_suggestion": await self.director_service.suggest_next_episode(
                            session=refreshed_session,
                            evaluation=director_output.evaluation,
                        ),
                    }) + "\n"

            # Also run legacy memory extraction until fully absorbed by Director
            await self._process_exchange(
                user_id=user_id,
                character_id=character_id,
                episode_id=episode.id,
                messages=full_messages,
            )
        except Exception as e:
            log.error(f"Director/memory processing failed: {e}")

        # Record message for rate limiting (after successful exchange)
        await self.rate_limiter.record_message(user_id)

        # Check if we should suggest scene generation
        # (frontend can show a "visualize" prompt)
        message_count = len(context.messages) + 2  # +2 for this exchange
        should_suggest_scene = self._should_suggest_scene(message_count)

        # Build done event with Director data for ALL episodes
        done_event = {
            "type": "done",
            "content": response_content,
            "suggest_scene": should_suggest_scene,
            "episode_id": str(episode.id),
        }

        # ALWAYS include Director state for ALL episodes (open + bounded)
        # This surfaces turn tracking, pacing, semantic status, etc. for every conversation
        if director_output:
            turn_budget = episode_template.turn_budget if episode_template else None
            # Calculate pacing for frontend display
            pacing = self.director_service.determine_pacing(
                director_output.turn_count,
                turn_budget,
            )
            done_event["director"] = {
                "turn_count": director_output.turn_count,
                "turns_remaining": max(0, turn_budget - director_output.turn_count) if turn_budget else None,
                "is_complete": director_output.is_complete,
                "status": director_output.evaluation.get("status") if director_output.evaluation else "going",
                "pacing": pacing,  # establish/develop/escalate/peak/resolve
            }

        yield json.dumps(done_event)

    async def get_context(
        self,
        user_id: UUID,
        character_id: UUID,
        episode_id: Optional[UUID] = None,
    ) -> ConversationContext:
        """Build conversation context for LLM."""
        # Get character
        char_query = "SELECT * FROM characters WHERE id = :character_id"
        char_row = await self.db.fetch_one(char_query, {"character_id": str(character_id)})
        if not char_row:
            raise ValueError(f"Character {character_id} not found")
        character = Character(**dict(char_row))

        # Get engagement (was relationship)
        eng_query = """
            SELECT * FROM engagements
            WHERE user_id = :user_id AND character_id = :character_id
        """
        eng_row = await self.db.fetch_one(eng_query, {"user_id": str(user_id), "character_id": str(character_id)})
        engagement = Engagement(**dict(eng_row)) if eng_row else None
        relationship = engagement  # Backwards compatibility alias

        # Get series_id from session for series-scoped memory retrieval
        series_id = None
        series_genre_prompt = None  # Will hold formatted genre settings
        if episode_id:
            session_query = "SELECT series_id FROM sessions WHERE id = :episode_id"
            session_row = await self.db.fetch_one(session_query, {"episode_id": str(episode_id)})
            if session_row and session_row["series_id"]:
                series_id = session_row["series_id"]

                # Fetch series genre_settings and format as prompt section
                series_query = "SELECT genre, genre_settings FROM series WHERE id = :series_id"
                series_row = await self.db.fetch_one(series_query, {"series_id": str(series_id)})
                if series_row:
                    genre_prompt = await self._format_genre_settings(
                        series_row["genre"],
                        series_row["genre_settings"]
                    )
                    if genre_prompt:
                        series_genre_prompt = genre_prompt

        # Get recent messages from episode
        messages = []
        if episode_id:
            msg_query = """
                SELECT role, content FROM messages
                WHERE episode_id = :episode_id
                ORDER BY created_at DESC
                LIMIT 20
            """
            msg_rows = await self.db.fetch_all(msg_query, {"episode_id": str(episode_id)})
            messages = [
                {"role": row["role"], "content": row["content"]}
                for row in reversed(msg_rows)
            ]

        # Get relevant memories (series-scoped if available)
        memories = await self.memory_service.get_relevant_memories(
            user_id, character_id, limit=10, series_id=series_id
        )
        memory_summaries = [
            MemorySummary(
                id=m.id,
                type=m.type.value,
                summary=m.summary,
                importance_score=float(m.importance_score),
            )
            for m in memories
        ]

        # Get active hooks
        hooks = await self.memory_service.get_active_hooks(
            user_id, character_id, limit=5
        )
        hook_summaries = [
            HookSummary(
                id=h.id,
                type=h.type.value,
                content=h.content,
                suggested_opener=h.suggested_opener,
            )
            for h in hooks
        ]

        # Calculate time since first met
        time_since_first_met = ""
        if relationship and relationship.first_met_at:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            first_met = relationship.first_met_at
            if first_met.tzinfo is None:
                first_met = first_met.replace(tzinfo=timezone.utc)
            delta = now - first_met
            if delta.days == 0:
                time_since_first_met = "Just met today"
            elif delta.days == 1:
                time_since_first_met = "1 day"
            elif delta.days < 7:
                time_since_first_met = f"{delta.days} days"
            elif delta.days < 30:
                weeks = delta.days // 7
                time_since_first_met = f"{weeks} week{'s' if weeks > 1 else ''}"
            else:
                months = delta.days // 30
                time_since_first_met = f"{months} month{'s' if months > 1 else ''}"

        # Get character life arc from character data (if available)
        character_life_arc = {}
        if hasattr(character, 'life_arc') and character.life_arc:
            character_life_arc = character.life_arc
        elif character.current_stressor:
            # Fallback: use current_stressor as the struggle
            character_life_arc = {"current_struggle": character.current_stressor}

        # Get relationship dynamic (Phase 4: Beat-aware system)
        relationship_dynamic_data = await self.memory_service.get_relationship_dynamic(
            user_id, character_id
        )
        relationship_dynamic = relationship_dynamic_data.get("dynamic", {}) if relationship_dynamic_data else {}
        relationship_milestones = relationship_dynamic_data.get("milestones", []) if relationship_dynamic_data else []

        # Get episode dynamics from episode_template (per EPISODE_DYNAMICS_CANON.md)
        episode_situation = None  # Physical setting/scenario - CRITICAL for grounding
        episode_frame = None
        dramatic_question = None
        resolution_types = ["positive", "neutral", "negative"]
        series_context = None

        if episode_id:
            # Get episode_template_id and scene from the session
            session_query = "SELECT episode_template_id, scene FROM sessions WHERE id = :episode_id"
            session_row = await self.db.fetch_one(session_query, {"episode_id": str(episode_id)})

            # Use session's scene as fallback for episode_situation
            if session_row and session_row["scene"]:
                episode_situation = session_row["scene"]

            if session_row and session_row["episode_template_id"]:
                template_id = session_row["episode_template_id"]
                # Fetch episode dynamics from template (situation is the primary physical grounding)
                template_query = """
                    SELECT situation, episode_frame, dramatic_question, resolution_types, series_id
                    FROM episode_templates
                    WHERE id = :template_id
                """
                template_row = await self.db.fetch_one(template_query, {"template_id": str(template_id)})

                if template_row:
                    # situation is the primary physical grounding (overrides session.scene)
                    if template_row["situation"]:
                        episode_situation = template_row["situation"]
                    episode_frame = template_row["episode_frame"]
                    dramatic_question = template_row["dramatic_question"]
                    resolution_types_raw = template_row["resolution_types"]
                    if resolution_types_raw:
                        resolution_types = list(resolution_types_raw) if not isinstance(resolution_types_raw, str) else resolution_types

                    # If part of a series, get series context from previous episodes
                    if template_row["series_id"]:
                        series_context = await self._get_series_context(
                            user_id, character_id, template_row["series_id"], template_id
                        )

        return ConversationContext(
            character_system_prompt=character.system_prompt,
            character_name=character.name,
            character_life_arc=character_life_arc,
            messages=messages,
            memories=memory_summaries,
            hooks=hook_summaries,
            # Stage is sunset - always return "acquaintance" (EP-01 pivot)
            relationship_stage="acquaintance",
            relationship_progress=0,
            total_episodes=engagement.total_sessions if engagement else 0,
            time_since_first_met=time_since_first_met,
            relationship_dynamic=relationship_dynamic,
            relationship_milestones=relationship_milestones,
            # Episode dynamics (per EPISODE_DYNAMICS_CANON.md)
            episode_situation=episode_situation,  # Physical grounding - CRITICAL
            episode_frame=episode_frame,
            dramatic_question=dramatic_question,
            resolution_types=resolution_types,
            series_context=series_context,
            # Series genre settings (per GENRE_SETTINGS_ARCHITECTURE)
            series_genre_prompt=series_genre_prompt,
        )

    async def get_or_create_episode(
        self,
        user_id: UUID,
        character_id: UUID,
        scene: Optional[str] = None,
        episode_template_id: Optional[UUID] = None,
    ) -> Session:
        """Get active session or create a new one.

        Sessions are scoped by (user_id, series_id, episode_template_id) for:
        - Series-level isolation: Each series has independent conversation history
        - Episode-level isolation: Each episode template has its own session
        - Free chat mode: episode_template_id = NULL represents unstructured chat

        Args:
            user_id: User UUID
            character_id: Character UUID
            scene: Optional custom scene description
            episode_template_id: Optional episode template ID (overrides scene)
        """
        # Determine series_id from episode_template (if provided)
        series_id = None
        effective_scene = scene
        opening_line = None

        episode_cost = 0  # Default: free (for free chat or Episode 0)

        if episode_template_id:
            template_query = """
                SELECT situation, title, opening_line, series_id, episode_cost
                FROM episode_templates WHERE id = :template_id
            """
            template_row = await self.db.fetch_one(template_query, {"template_id": str(episode_template_id)})
            if template_row:
                effective_scene = template_row["situation"]
                opening_line = template_row["opening_line"]
                series_id = template_row["series_id"]
                episode_cost = template_row["episode_cost"] or 0

        # If no series from template, try to get series from character
        if not series_id:
            char_series_query = """
                SELECT s.id FROM series s
                JOIN characters c ON c.id = ANY(s.featured_characters)
                WHERE c.id = :character_id
                LIMIT 1
            """
            series_row = await self.db.fetch_one(char_series_query, {"character_id": str(character_id)})
            if series_row:
                series_id = series_row["id"]

        # Check for existing session scoped by (user, series, episode_template)
        # This ensures separate conversation histories per episode within a series
        # IMPORTANT: We look for ANY existing session (active OR inactive) to preserve message history
        row = None
        if series_id and episode_template_id:
            # Episode mode: find session for this specific episode template
            # First try active, then any session (to reactivate if needed)
            query = """
                SELECT * FROM sessions
                WHERE user_id = :user_id
                AND series_id = :series_id
                AND episode_template_id = :episode_template_id
                ORDER BY is_active DESC, started_at DESC
                LIMIT 1
            """
            row = await self.db.fetch_one(query, {
                "user_id": str(user_id),
                "series_id": str(series_id),
                "episode_template_id": str(episode_template_id),
            })
        elif series_id:
            # Free chat mode within series: find session without episode_template
            query = """
                SELECT * FROM sessions
                WHERE user_id = :user_id
                AND series_id = :series_id
                AND episode_template_id IS NULL
                ORDER BY is_active DESC, started_at DESC
                LIMIT 1
            """
            row = await self.db.fetch_one(query, {
                "user_id": str(user_id),
                "series_id": str(series_id),
            })
        else:
            # Legacy fallback: character-only scoping (no series)
            query = """
                SELECT * FROM sessions
                WHERE user_id = :user_id AND character_id = :character_id
                ORDER BY is_active DESC, started_at DESC
                LIMIT 1
            """
            row = await self.db.fetch_one(query, {"user_id": str(user_id), "character_id": str(character_id)})

        if row:
            session = Session(**dict(row))
            # Reactivate if inactive (user returning to an existing episode)
            if not session.is_active:
                reactivate_query = """
                    UPDATE sessions
                    SET is_active = TRUE, session_state = 'active'
                    WHERE id = :session_id
                """
                await self.db.execute(reactivate_query, {"session_id": str(session.id)})
                session.is_active = True
                session.session_state = "active"
                log.info(f"Reactivated existing session {session.id} for episode_template {episode_template_id}")
            return session

        # Ensure user exists in public.users (auto-create if missing)
        # This handles cases where the auth trigger didn't fire
        await self._ensure_user_exists(user_id)

        # Ensure engagement exists
        eng_query = """
            INSERT INTO engagements (user_id, character_id)
            VALUES (:user_id, :character_id)
            ON CONFLICT (user_id, character_id) DO UPDATE SET updated_at = NOW()
            RETURNING id
        """
        eng_row = await self.db.fetch_one(eng_query, {"user_id": str(user_id), "character_id": str(character_id)})
        engagement_id = eng_row["id"]

        # Get next episode number (scoped by series if available)
        if series_id:
            count_query = """
                SELECT COALESCE(MAX(episode_number), 0) + 1 as next_num
                FROM sessions
                WHERE user_id = :user_id AND series_id = :series_id
            """
            count_row = await self.db.fetch_one(count_query, {"user_id": str(user_id), "series_id": str(series_id)})
        else:
            count_query = """
                SELECT COALESCE(MAX(episode_number), 0) + 1 as next_num
                FROM sessions
                WHERE user_id = :user_id AND character_id = :character_id
            """
            count_row = await self.db.fetch_one(count_query, {"user_id": str(user_id), "character_id": str(character_id)})
        episode_number = count_row["next_num"]

        # === EPISODE ACCESS GATE (Ticket + Moments Model) ===
        # For paid episodes (episode_cost > 0), check user can afford and deduct sparks
        entry_paid = False  # Will be True if user pays or episode is free

        if episode_cost > 0:
            from app.services.credits import CreditsService, InsufficientSparksError

            # Check if user is premium (bypass spark cost)
            user_query = "SELECT subscription_status FROM users WHERE id = :user_id"
            user_row = await self.db.fetch_one(user_query, {"user_id": str(user_id)})
            is_premium = user_row and user_row["subscription_status"] == "premium"

            if is_premium:
                # Premium users get all episodes for free
                entry_paid = True
                log.info(f"Premium user {user_id} accessing episode for free")
            else:
                # Non-premium: deduct sparks
                credits = CreditsService.get_instance()
                try:
                    await credits.spend(
                        user_id=user_id,
                        feature_key="episode_access",
                        explicit_cost=episode_cost,
                        reference_id=str(episode_template_id) if episode_template_id else None,
                        metadata={"episode_template_id": str(episode_template_id) if episode_template_id else None},
                    )
                    entry_paid = True
                    log.info(f"User {user_id} paid {episode_cost} sparks to access episode")
                except InsufficientSparksError:
                    # Can't afford - raise HTTP 402
                    from fastapi import HTTPException, status
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail={
                            "error": "insufficient_sparks",
                            "required": episode_cost,
                            "message": f"This episode costs {episode_cost} Sparks to start",
                        }
                    )
        else:
            # Free episode (Episode 0, Play Mode, or free chat)
            entry_paid = True

        # Create session with series_id for proper scoping
        # session_state must be set explicitly to 'active' for series progress tracking
        create_query = """
            INSERT INTO sessions (user_id, character_id, engagement_id, episode_number, scene, episode_template_id, series_id, session_state, entry_paid)
            VALUES (:user_id, :character_id, :engagement_id, :episode_number, :scene, :episode_template_id, :series_id, :session_state, :entry_paid)
            RETURNING *
        """
        new_row = await self.db.fetch_one(
            create_query,
            {
                "user_id": str(user_id),
                "character_id": str(character_id),
                "engagement_id": str(engagement_id),
                "episode_number": episode_number,
                "scene": effective_scene,
                "episode_template_id": str(episode_template_id) if episode_template_id else None,
                "series_id": str(series_id) if series_id else None,
                "session_state": "active",  # Explicit state for progress tracking
                "entry_paid": entry_paid,
            },
        )

        session = Session(**dict(new_row))
        episode = session  # Backwards compatibility alias

        # If template has an opening_line, save it as the first assistant message
        # This ensures the LLM has context of what the character "already said"
        if opening_line:
            await self._save_message(
                episode_id=session.id,
                role=MessageRole.ASSISTANT,
                content=opening_line,
            )
            log.info(f"Injected opening_line for session {session.id}")

        return session

    async def end_episode(
        self,
        user_id: UUID,
        character_id: UUID,
    ) -> Optional[Session]:
        """End the active session and generate summary."""
        # Get active session
        query = """
            SELECT * FROM sessions
            WHERE user_id = :user_id AND character_id = :character_id AND is_active = TRUE
        """
        row = await self.db.fetch_one(query, {"user_id": str(user_id), "character_id": str(character_id)})

        if not row:
            return None

        session = Session(**dict(row))

        # Get messages for summary
        msg_query = """
            SELECT role, content FROM messages
            WHERE episode_id = :session_id
            ORDER BY created_at
        """
        msg_rows = await self.db.fetch_all(msg_query, {"session_id": str(session.id)})
        messages = [{"role": r["role"], "content": r["content"]} for r in msg_rows]

        # Get character name for summary
        char_query = "SELECT name FROM characters WHERE id = :character_id"
        char_row = await self.db.fetch_one(char_query, {"character_id": str(character_id)})
        character_name = char_row["name"] if char_row else "Character"

        # Generate summary
        summary_data = await self.memory_service.generate_episode_summary(
            character_name=character_name,
            messages=messages,
        )

        # Update session
        update_query = """
            UPDATE sessions
            SET
                is_active = FALSE,
                ended_at = NOW(),
                summary = :summary,
                emotional_tags = :emotional_tags,
                key_events = :key_events
            WHERE id = :session_id
            RETURNING *
        """
        updated_row = await self.db.fetch_one(
            update_query,
            {
                "summary": summary_data.get("summary"),
                "emotional_tags": summary_data.get("emotional_tags", []),
                "key_events": summary_data.get("key_events", []),
                "session_id": str(session.id),
            },
        )

        return Session(**dict(updated_row))

    async def _ensure_user_exists(self, user_id: UUID) -> None:
        """Ensure user exists in public.users table.

        This is a fallback for cases where the auth.users trigger didn't fire
        (e.g., user signed up before trigger was created, or trigger failed).
        """
        query = """
            INSERT INTO users (id, display_name)
            VALUES (:user_id, 'User')
            ON CONFLICT (id) DO NOTHING
        """
        await self.db.execute(query, {"user_id": str(user_id)})

    async def _save_message(
        self,
        episode_id: UUID,
        role: MessageRole,
        content: str,
        model_used: Optional[str] = None,
        tokens_input: Optional[int] = None,
        tokens_output: Optional[int] = None,
        latency_ms: Optional[int] = None,
    ) -> Message:
        """Save a message to the database."""
        query = """
            INSERT INTO messages (episode_id, role, content, model_used, tokens_input, tokens_output, latency_ms)
            VALUES (:episode_id, :role, :content, :model_used, :tokens_input, :tokens_output, :latency_ms)
            RETURNING *
        """
        row = await self.db.fetch_one(
            query,
            {
                "episode_id": str(episode_id),
                "role": role.value,
                "content": content,
                "model_used": model_used,
                "tokens_input": tokens_input,
                "tokens_output": tokens_output,
                "latency_ms": latency_ms,
            },
        )
        return Message(**dict(row))

    async def _mark_hook_triggered(self, hook_id: UUID):
        """Mark a hook as triggered."""
        query = "UPDATE hooks SET triggered_at = NOW() WHERE id = :hook_id"
        await self.db.execute(query, {"hook_id": str(hook_id)})

    def _should_suggest_scene(self, message_count: int) -> bool:
        """Determine if we should suggest scene generation.

        Suggests scene at conversation milestones:
        - First exchange (message 2)
        - After 6 messages
        - After 12 messages
        - Every 10 messages after that

        Returns True if frontend should prompt user to visualize.
        """
        if not ENABLE_AUTO_SCENE_GENERATION:
            return False

        milestones = [2, 6, 12, 22, 32, 42]
        return message_count in milestones

    async def _generate_auto_scene(
        self,
        episode_id: UUID,
        user_id: UUID,
        character_id: UUID,
        character_name: str,
        scene_setting: str,
        visual_hint: str,
        visual_type: str = "character",
    ):
        """Generate a scene image automatically (Director-triggered).

        This runs as a background task and won't block the stream.
        Routes to appropriate generation pipeline based on visual_type:
        - character: Character in scene (Kontext with anchor or T2I)
        - object: Close-up of item (no character)
        - atmosphere: Setting/mood shot (no character)
        """
        try:
            # Get avatar kit for character consistency (only needed for character type)
            anchor_image = None
            appearance_prompt = None
            style_prompt = None
            negative_prompt = None
            avatar_kit_id = None

            if visual_type == "character":
                kit_row = await self.db.fetch_one(
                    """
                    SELECT ak.id, ak.appearance_prompt, ak.style_prompt, ak.negative_prompt,
                           aa.storage_path
                    FROM avatar_kits ak
                    LEFT JOIN avatar_assets aa ON aa.avatar_kit_id = ak.id AND aa.asset_type = 'anchor'
                    WHERE ak.character_id = :character_id
                    ORDER BY ak.created_at DESC
                    LIMIT 1
                    """,
                    {"character_id": str(character_id)}
                )

                if kit_row:
                    avatar_kit_id = kit_row["id"]
                    appearance_prompt = kit_row.get("appearance_prompt")
                    style_prompt = kit_row.get("style_prompt")
                    negative_prompt = kit_row.get("negative_prompt")

                    # Load anchor image if available
                    if kit_row.get("storage_path"):
                        try:
                            from app.services.storage import StorageService
                            storage = StorageService.get_instance()
                            anchor_image = await storage.download(
                                bucket="avatars",
                                path=kit_row["storage_path"]
                            )
                        except Exception as e:
                            log.warning(f"Failed to load anchor image: {e}")

            # Generate the visual using the Director-aware method
            result = await self.scene_service.generate_director_visual(
                visual_type=visual_type,
                episode_id=episode_id,
                user_id=user_id,
                character_id=character_id,
                character_name=character_name,
                scene_setting=scene_setting,
                visual_hint=visual_hint,
                appearance_prompt=appearance_prompt,
                style_prompt=style_prompt,
                negative_prompt=negative_prompt,
                avatar_kit_id=avatar_kit_id,
                anchor_image=anchor_image,
            )

            if result:
                log.info(f"Auto-generated {visual_type} scene for episode {episode_id}: {result.get('image_id')}")
            else:
                log.warning(f"Auto-scene generation returned no result for episode {episode_id}")

        except Exception as e:
            log.error(f"Auto-scene generation failed for episode {episode_id}: {e}")

    async def _process_exchange(
        self,
        user_id: UUID,
        character_id: UUID,
        episode_id: UUID,
        messages: List[Dict[str, str]],
    ):
        """Process a conversation exchange for memories, hooks, and beat classification."""
        # Get existing memories for deduplication
        existing_memories = await self.memory_service.get_relevant_memories(
            user_id, character_id, limit=20
        )

        # Extract memories and beat classification (single LLM call)
        extracted_memories, beat_data = await self.memory_service.extract_memories(
            user_id=user_id,
            character_id=character_id,
            episode_id=episode_id,
            messages=messages,
            existing_memories=existing_memories,
        )

        if extracted_memories:
            await self.memory_service.save_memories(
                user_id=user_id,
                character_id=character_id,
                episode_id=episode_id,
                memories=extracted_memories,
            )
            log.info(f"Saved {len(extracted_memories)} memories")

        # Update relationship dynamic with beat classification
        if beat_data:
            try:
                await self.memory_service.update_relationship_dynamic(
                    user_id=user_id,
                    character_id=character_id,
                    beat_type=beat_data.get("type", "neutral"),
                    tension_change=int(beat_data.get("tension_change", 0)),
                    milestone=beat_data.get("milestone"),
                )
                log.info(f"Updated relationship dynamic: beat={beat_data.get('type')}")
            except Exception as e:
                log.error(f"Failed to update relationship dynamic: {e}")

        # Extract hooks
        extracted_hooks = await self.memory_service.extract_hooks(messages)

        if extracted_hooks:
            await self.memory_service.save_hooks(
                user_id=user_id,
                character_id=character_id,
                episode_id=episode_id,
                hooks=extracted_hooks,
            )
            log.info(f"Saved {len(extracted_hooks)} hooks")

    async def _get_series_context(
        self,
        user_id: UUID,
        character_id: UUID,
        series_id: str,
        current_template_id: str,
    ) -> Optional[str]:
        """Build series context from previous episodes for serial continuity.

        Per EPISODE_DYNAMICS_CANON.md: For serial series, provide summary bridge
        of what happened before to maintain narrative continuity.
        """
        # Get episode order from series
        series_query = """
            SELECT episode_order, series_type FROM series WHERE id = :series_id
        """
        series_row = await self.db.fetch_one(series_query, {"series_id": str(series_id)})

        if not series_row or series_row["series_type"] != "serial":
            # Only provide series context for serial series
            return None

        episode_order = series_row["episode_order"] or []
        if not episode_order or not isinstance(episode_order, list):
            return None

        # Find current episode's position in order
        try:
            current_index = episode_order.index(current_template_id)
        except ValueError:
            return None

        if current_index == 0:
            # First episode in series, no prior context
            return None

        # Get summaries from user's completed sessions for prior episodes
        prior_template_ids = episode_order[:current_index]

        # Fetch summaries from completed sessions
        summaries_query = """
            SELECT s.summary, et.title, et.episode_number
            FROM sessions s
            JOIN episode_templates et ON s.episode_template_id = et.id
            WHERE s.user_id = :user_id
            AND s.character_id = :character_id
            AND s.episode_template_id = ANY(:template_ids)
            AND s.summary IS NOT NULL
            ORDER BY et.episode_number
        """
        summary_rows = await self.db.fetch_all(summaries_query, {
            "user_id": str(user_id),
            "character_id": str(character_id),
            "template_ids": prior_template_ids,
        })

        if not summary_rows:
            return None

        # Build context string
        context_parts = []
        for row in summary_rows:
            title = row["title"] or f"Episode {row['episode_number'] or '?'}"
            summary = row["summary"] or ""
            if summary:
                context_parts.append(f"• {title}: {summary}")

        if not context_parts:
            return None

        return "Previous episodes:\n" + "\n".join(context_parts)

    async def _get_episode_template(
        self,
        episode_template_id: Optional[UUID],
    ) -> Optional[EpisodeTemplate]:
        """Get episode template by ID.

        Used by Director integration to check completion_mode.
        """
        if not episode_template_id:
            return None

        query = "SELECT * FROM episode_templates WHERE id = :template_id"
        row = await self.db.fetch_one(query, {"template_id": str(episode_template_id)})

        if not row:
            return None

        try:
            return EpisodeTemplate(**{
                k: row[k] for k in row.keys()
                if k in EpisodeTemplate.model_fields
            })
        except Exception as e:
            log.warning(f"Failed to parse episode template: {e}")
            return None

    async def _get_session(self, session_id: UUID) -> Optional[Session]:
        """Get session by ID.

        Used by Director to get fresh turn_count and director_state.
        """
        query = "SELECT * FROM sessions WHERE id = :session_id"
        row = await self.db.fetch_one(query, {"session_id": str(session_id)})

        if not row:
            return None

        return Session(**dict(row))

    async def _format_genre_settings(
        self,
        genre: Optional[str],
        genre_settings: Optional[dict],
    ) -> Optional[str]:
        """Format genre settings as a prompt section.

        Merges preset defaults with custom settings and formats for LLM injection.
        """
        from app.models.series import GENRE_SETTING_PRESETS, GenreSettings

        if not genre and not genre_settings:
            return None

        # Get preset defaults
        genre_name = genre or "romantic_tension"
        preset = GENRE_SETTING_PRESETS.get(genre_name, GENRE_SETTING_PRESETS.get("romantic_tension", {}))

        # Parse genre_settings if it's a string (from DB JSON)
        settings_dict = genre_settings or {}
        if isinstance(settings_dict, str):
            try:
                settings_dict = json.loads(settings_dict)
            except (json.JSONDecodeError, TypeError):
                settings_dict = {}

        # Merge preset with custom settings
        merged = {**preset, **settings_dict}

        # Create GenreSettings object and format
        try:
            settings_obj = GenreSettings(**merged)
            prompt_section = settings_obj.to_prompt_section()
            return prompt_section if prompt_section else None
        except Exception as e:
            log.warning(f"Failed to format genre settings: {e}")
            return None
