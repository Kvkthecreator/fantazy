"""Conversation service - orchestrates chat interactions."""

import asyncio
import json
import logging
import re
from typing import AsyncIterator, Dict, List, Optional
from uuid import UUID

from app.models.character import Character
from app.models.session import Session
from app.models.message import Message, MessageRole, ConversationContext, MemorySummary, HookSummary, PropSummary
from app.models.engagement import Engagement
from app.models.episode_template import EpisodeTemplate, VisualMode
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
        user_id: Optional[UUID],
        character_id: UUID,
        content: str,
        episode_template_id: Optional[UUID] = None,
        guest_session_id: Optional[str] = None,
    ) -> Message:
        """Send a message and get a response.

        Supports both authenticated users and guest sessions.

        This orchestrates the full conversation flow:
        1. Check rate limit (abuse prevention) - skip for guests
        2. Get or create active episode (or use existing guest session)
        3. Build conversation context
        4. Save user message
        5. Generate LLM response
        6. Save assistant message
        7. Run Director for ALL episodes (memory, hooks, turn counting, completion)
        8. Record message for rate limiting - skip for guests
        """
        # Check rate limit (skip for guest sessions)
        if user_id:
            subscription_status = await self._get_user_subscription_status(user_id)
            rate_check = await self.rate_limiter.check_rate_limit(user_id, subscription_status)

            if not rate_check.allowed:
                raise RateLimitExceededError(
                    message=rate_check.message or "Rate limit exceeded",
                    reset_at=rate_check.reset_at,
                    cooldown_seconds=rate_check.cooldown_seconds,
                    remaining=rate_check.remaining,
                )

        # Get episode (either find existing guest session or create for authenticated user)
        if guest_session_id:
            # For guests, find the existing session by guest_session_id
            episode_query = """
                SELECT * FROM sessions
                WHERE guest_session_id = :guest_id
                AND character_id = :character_id
            """
            episode_row = await self.db.fetch_one(episode_query, {
                "guest_id": guest_session_id,
                "character_id": str(character_id),
            })
            if not episode_row:
                raise ValueError(f"Guest session {guest_session_id} not found")
            episode = Session(**dict(episode_row))
        else:
            # For authenticated users, get or create episode
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

        # Track message for analytics (skip for guests - no user_id)
        if user_id:
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

        # Mark hooks as triggered (batch into single query for efficiency)
        # Skip for guests - they don't have hooks/memories
        if context.hooks and user_id:
            hook_ids = [str(hook.id) for hook in context.hooks]
            await self.db.execute(
                "UPDATE hooks SET triggered_at = NOW() WHERE id = ANY(:hook_ids)",
                {"hook_ids": hook_ids},
            )

        # Record message for rate limiting (skip for guests)
        if user_id:
            await self.rate_limiter.record_message(user_id)

        # Director Phase 2: Run in background (v2.7 - fire-and-forget for fast response)
        full_messages = context.messages + [{"role": "assistant", "content": llm_response.content}]
        asyncio.create_task(
            self._run_director_phase2_background(
                episode_id=episode.id,
                episode_template=episode_template,
                full_messages=full_messages,
                character_id=character_id,
                user_id=user_id,
                character_name=context.character_name,
            )
        )

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
        user_id: Optional[UUID],
        character_id: UUID,
        content: str,
        episode_template_id: Optional[UUID] = None,
        guest_session_id: Optional[str] = None,
    ) -> AsyncIterator[str]:
        """Send a message and stream the response.

        Supports both authenticated users and guest sessions.

        Director Protocol v2.0:
        - PHASE 1: Pre-guidance (before LLM) - pacing, tension, genre beat
        - PHASE 2: Post-evaluation (after LLM) - visuals, completion, memory

        Per DIRECTOR_ARCHITECTURE.md, Director runs for ALL episodes:
        - Open episodes: turn counting, memory, hooks, beat tracking
        - Bounded episodes: all of the above + completion detection + evaluation
        """
        # Check rate limit (skip for guest sessions)
        if user_id:
            subscription_status = await self._get_user_subscription_status(user_id)
            rate_check = await self.rate_limiter.check_rate_limit(user_id, subscription_status)

            if not rate_check.allowed:
                raise RateLimitExceededError(
                    message=rate_check.message or "Rate limit exceeded",
                    reset_at=rate_check.reset_at,
                    cooldown_seconds=rate_check.cooldown_seconds,
                    remaining=rate_check.remaining,
                )

        # Get episode (either find existing guest session or create for authenticated user)
        log.info(f"[GUEST_DEBUG] send_message_stream start: user_id={user_id}, guest_session_id={guest_session_id}, character_id={character_id}")
        if guest_session_id:
            # For guests, find the existing session by guest_session_id
            episode_query = """
                SELECT * FROM sessions
                WHERE guest_session_id = :guest_id
                AND character_id = :character_id
            """
            episode_row = await self.db.fetch_one(episode_query, {
                "guest_id": guest_session_id,
                "character_id": str(character_id),
            })
            log.info(f"[GUEST_DEBUG] Guest session lookup: found={episode_row is not None}")
            if not episode_row:
                raise ValueError(f"Guest session {guest_session_id} not found")
            episode = Session(**dict(episode_row))
            log.info(f"[GUEST_DEBUG] Guest session loaded: id={episode.id}")
        else:
            # For authenticated users, get or create episode
            episode = await self.get_or_create_episode(
                user_id, character_id, episode_template_id=episode_template_id
            )

        # Get episode template if session has one (for Director integration)
        episode_template = await self._get_episode_template(episode.episode_template_id)
        log.info(f"[GUEST_DEBUG] Episode template: {episode_template.id if episode_template else None}")

        # Build context
        log.info(f"[GUEST_DEBUG] Building context...")
        context = await self.get_context(user_id, character_id, episode.id)
        log.info(f"[GUEST_DEBUG] Context built: {len(context.messages)} messages")

        # Save user message
        log.info(f"[GUEST_DEBUG] Saving user message...")
        await self._save_message(
            episode_id=episode.id,
            role=MessageRole.USER,
            content=content,
        )

        # Track message for analytics (skip for guests - no user_id)
        if user_id:
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
        # ADR-001: Genre doctrine is injected here by Director, not baked into
        # character system_prompt. Genre comes from episode_template/series.
        if episode_template:
            try:
                # Get character's energy level for genre-specific guidance
                char_boundaries = context.character_boundaries or {}
                energy_level = char_boundaries.get("flirting_level", "playful")

                # Director Protocol v2.2: Deterministic, no LLM call
                # Motivation (objective/obstacle/tactic) now comes from Episode upstream
                guidance = self.director_service.generate_pre_guidance(
                    genre=getattr(episode_template, 'genre', 'romantic_tension'),
                    situation=episode_template.situation or "",
                    turn_count=episode.turn_count,
                    turn_budget=getattr(episode_template, 'turn_budget', None),
                    energy_level=energy_level,
                )
                # Inject guidance into context (includes genre doctrine)
                context.director_guidance = guidance.to_prompt_section()
                log.debug(f"Director pre-guidance: pacing={guidance.pacing}, genre={guidance.genre}")
            except Exception as e:
                log.warning(f"Director pre-guidance failed: {e}")

        # Generate streaming response (with Director guidance in context)
        log.info(f"[GUEST_DEBUG] Formatting messages for LLM...")
        formatted_messages = context.to_messages()
        log.info(f"[GUEST_DEBUG] Formatted {len(formatted_messages)} messages, starting LLM stream...")
        full_response = []

        async for chunk in self.llm.generate_stream(formatted_messages):
            full_response.append(chunk)
            yield json.dumps({"type": "chunk", "content": chunk})

        response_content = "".join(full_response)
        log.info(f"[GUEST_DEBUG] LLM response complete: {len(response_content)} chars")

        # Save assistant message
        await self._save_message(
            episode_id=episode.id,
            role=MessageRole.ASSISTANT,
            content=response_content,
            model_used=self.llm.model,
        )

        # Mark hooks as triggered (batch into single query for efficiency)
        # Skip for guests - they don't have hooks
        if context.hooks and user_id:
            hook_ids = [str(hook.id) for hook in context.hooks]
            await self.db.execute(
                "UPDATE hooks SET triggered_at = NOW() WHERE id = ANY(:hook_ids)",
                {"hook_ids": hook_ids},
            )

        # Record message for rate limiting (skip for guests)
        if user_id:
            await self.rate_limiter.record_message(user_id)

        # Check if we should suggest scene generation
        # (frontend can show a "visualize" prompt)
        message_count = len(context.messages) + 2  # +2 for this exchange
        should_suggest_scene = self._should_suggest_scene(message_count)

        # Get current turn count from session for done event
        # Director will increment this in background, but we predict the next state
        current_turn_count = episode.turn_count
        next_turn_count = current_turn_count + 1  # Director increments by 1 per exchange
        turn_budget = episode_template.turn_budget if episode_template else None
        pacing = self.director_service.determine_pacing(next_turn_count, turn_budget)

        # v2.8: Calculate suggest_next immediately (was deferred to background)
        # Director v2.6: suggest_next triggers when turn exactly equals budget
        # turn_budget of 0 means open-ended (never suggest)
        suggest_next = (turn_budget is not None and turn_budget > 0 and next_turn_count == turn_budget)

        # Build next_suggestion payload if we're suggesting next episode
        next_suggestion = None
        if suggest_next and episode_template and episode_template.series_id:
            # Look up next episode in series
            next_ep = await self._get_next_episode_in_series(
                series_id=episode_template.series_id,
                current_episode_number=episode_template.episode_number,
            )
            if next_ep:
                next_suggestion = {
                    "episode_id": str(next_ep["id"]),
                    "title": next_ep["title"],
                    "slug": next_ep["slug"],
                    "episode_number": next_ep["episode_number"],
                }

        # Build done event - sent IMMEDIATELY for fast perceived response
        done_event = {
            "type": "done",
            "content": response_content,
            "suggest_scene": should_suggest_scene,
            "episode_id": str(episode.id),
            # Include predicted Director state (background will finalize)
            "director": {
                "turn_count": next_turn_count,
                "turns_remaining": max(0, turn_budget - next_turn_count) if turn_budget else None,
                "suggest_next": suggest_next,
                "is_complete": False,  # DEPRECATED: kept for backward compat
                "status": "going",
                "pacing": pacing,
            },
        }

        yield json.dumps(done_event)

        # v2.8: Emit next_episode_suggestion event if turn budget reached
        if suggest_next:
            suggestion_event = {
                "type": "next_episode_suggestion",
                "turn_count": next_turn_count,
                "trigger": "turn_limit",
                "next_suggestion": next_suggestion,
            }
            yield json.dumps(suggestion_event)

        # ADR-005 v2: Director-owned prop revelation detection
        # Director detects when character naturally mentions props (semantic, not turn-based)
        if episode_template:
            try:
                revealed_props = await self.director_service.detect_prop_revelations(
                    session_id=episode.id,
                    episode_template_id=episode_template.id,
                    assistant_response=response_content,
                    current_turn=next_turn_count,
                )
                for prop_data in revealed_props:
                    prop_event = {
                        "type": "prop_reveal",
                        "prop": prop_data,
                        "turn": next_turn_count,
                        "trigger": "director_detected",
                    }
                    yield json.dumps(prop_event)
            except Exception as e:
                log.warning(f"Prop revelation detection failed: {e}")

        # =====================================================================
        # DIRECTOR PHASE 2: Post-Evaluation (BACKGROUND - fire-and-forget)
        # =====================================================================
        # v2.7: Moved to background task for instant response finalization.
        # Memory/hook extraction, beat classification, and visual triggers run async.
        # This reduces perceived latency by 800ms-2.5s.
        # Skip for guests - they don't need memory/hook processing and user_id is None
        if user_id:
            full_messages = context.messages + [{"role": "assistant", "content": response_content}]

            asyncio.create_task(
                self._run_director_phase2_background(
                    episode_id=episode.id,
                    episode_template=episode_template,
                    full_messages=full_messages,
                    character_id=character_id,
                    user_id=user_id,
                    character_name=context.character_name,
                )
            )

    async def get_context(
        self,
        user_id: Optional[UUID],
        character_id: UUID,
        episode_id: Optional[UUID] = None,
    ) -> ConversationContext:
        """Build conversation context for LLM.

        Supports both authenticated users and guest sessions (user_id = None).
        For guests, engagement/memories/hooks are skipped.
        """
        # Get character
        char_query = "SELECT * FROM characters WHERE id = :character_id"
        char_row = await self.db.fetch_one(char_query, {"character_id": str(character_id)})
        if not char_row:
            raise ValueError(f"Character {character_id} not found")
        character = Character(**dict(char_row))

        # Get engagement (skip for guests - no user_id)
        engagement = None
        if user_id:
            eng_query = """
                SELECT * FROM engagements
                WHERE user_id = :user_id AND character_id = :character_id
            """
            eng_row = await self.db.fetch_one(eng_query, {"user_id": str(user_id), "character_id": str(character_id)})
            engagement = Engagement(**dict(eng_row)) if eng_row else None
        relationship = engagement  # Backwards compatibility alias

        # Get series_id from session for memory retrieval
        series_id = None
        series_genre_prompt = None  # Will hold formatted genre settings
        if episode_id:
            session_query = "SELECT series_id FROM sessions WHERE id = :episode_id"
            session_row = await self.db.fetch_one(session_query, {"episode_id": str(episode_id)})
            if session_row and session_row["series_id"]:
                series_id = session_row["series_id"]

                # Fetch series genre_settings and format as prompt section
                # Handle case where genre_settings column doesn't exist (migration pending)
                try:
                    series_query = "SELECT genre, genre_settings FROM series WHERE id = :series_id"
                    series_row = await self.db.fetch_one(series_query, {"series_id": str(series_id)})
                except Exception:
                    # Column doesn't exist - fall back to just genre
                    series_query = "SELECT genre FROM series WHERE id = :series_id"
                    series_row = await self.db.fetch_one(series_query, {"series_id": str(series_id)})

                if series_row:
                    # Convert Record to dict for safe .get() access
                    series_dict = dict(series_row)
                    genre_prompt = await self._format_genre_settings(
                        series_dict["genre"],
                        series_dict.get("genre_settings")  # Now .get() works on dict
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

        # Get relevant memories (skip for guests - no user_id)
        memory_summaries = []
        if user_id:
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

        # Get active hooks (skip for guests - no user_id)
        hook_summaries = []
        if user_id:
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

        # NOTE: character_life_arc removed - backstory + archetype + genre doctrine provide depth
        # Character's emotional state comes from episode situation, not a separate life_arc field

        # Get relationship dynamic (skip for guests - no user_id)
        relationship_dynamic = {}
        relationship_milestones = []
        if user_id:
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
        # Scene motivation (ADR-002: Theatrical Model)
        scene_objective = None
        scene_obstacle = None
        scene_tactic = None

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
                # ADR-002: Now includes scene motivation fields
                template_query = """
                    SELECT situation, episode_frame, dramatic_question, resolution_types, series_id,
                           scene_objective, scene_obstacle, scene_tactic
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

                    # Scene motivation (ADR-002: Theatrical Model)
                    scene_objective = template_row["scene_objective"]
                    scene_obstacle = template_row["scene_obstacle"]
                    scene_tactic = template_row["scene_tactic"]

                    # If part of a series, get series context from previous episodes
                    # Skip for guests - they don't have prior episode history
                    if template_row["series_id"] and user_id:
                        series_context = await self._get_series_context(
                            user_id, character_id, template_row["series_id"], template_id
                        )

        # Load props for this episode (ADR-005: Layer 2.5)
        props = []
        current_turn = 0
        if episode_id:
            # Get current turn count from session
            turn_query = "SELECT turn_count FROM sessions WHERE id = :episode_id"
            turn_row = await self.db.fetch_one(turn_query, {"episode_id": str(episode_id)})
            current_turn = turn_row["turn_count"] if turn_row else 0

            # Get episode_template_id from session for prop lookup
            session_info = await self.db.fetch_one(
                "SELECT episode_template_id FROM sessions WHERE id = :episode_id",
                {"episode_id": str(episode_id)}
            )
            if session_info and session_info["episode_template_id"]:
                template_id_for_props = session_info["episode_template_id"]

                # Fetch props for this episode template with revelation state
                props_query = """
                    SELECT
                        p.id, p.name, p.slug, p.prop_type, p.description,
                        p.content, p.content_format, p.image_url,
                        p.reveal_mode, p.reveal_turn_hint, p.is_key_evidence,
                        sp.revealed_at IS NOT NULL as is_revealed,
                        sp.revealed_turn
                    FROM props p
                    LEFT JOIN session_props sp ON sp.prop_id = p.id AND sp.session_id = :session_id
                    WHERE p.episode_template_id = :template_id
                    ORDER BY p.display_order
                """
                prop_rows = await self.db.fetch_all(props_query, {
                    "template_id": str(template_id_for_props),
                    "session_id": str(episode_id),
                })

                props = [
                    PropSummary(
                        id=row["id"],
                        name=row["name"],
                        slug=row["slug"],
                        prop_type=row["prop_type"],
                        description=row["description"],
                        content=row["content"],
                        content_format=row["content_format"],
                        image_url=row["image_url"],
                        reveal_mode=row["reveal_mode"],
                        reveal_turn_hint=row["reveal_turn_hint"],
                        is_key_evidence=row["is_key_evidence"],
                        is_revealed=row["is_revealed"] or False,
                        revealed_turn=row["revealed_turn"],
                    )
                    for row in prop_rows
                ]

        return ConversationContext(
            character_system_prompt=character.system_prompt,
            character_name=character.name,
            # NOTE: character_life_arc removed
            messages=messages,
            memories=memory_summaries,
            hooks=hook_summaries,
            # NOTE: relationship_stage/relationship_progress removed (EP-01 pivot)
            # Dynamic relationship (tone, tension, beats) provides engagement context
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
            # Scene motivation (ADR-002: Theatrical Model)
            scene_objective=scene_objective,
            scene_obstacle=scene_obstacle,
            scene_tactic=scene_tactic,
            # Character boundaries (ADR-001: needed by Director for energy_level)
            character_boundaries=character.boundaries,
            # Series genre settings (per GENRE_SETTINGS_ARCHITECTURE)
            series_genre_prompt=series_genre_prompt,
            # Props (ADR-005: Layer 2.5)
            props=props,
            current_turn=current_turn,
        )

    async def get_or_create_episode(
        self,
        user_id: UUID,
        character_id: UUID,
        scene: Optional[str] = None,
        episode_template_id: Optional[UUID] = None,
    ) -> Session:
        """Get active session or create a new one.

        ADR-004: Sessions are scoped by (user_id, character_id, series_id, episode_template_id):
        - Character-level isolation: Each character has its own playthrough of a series
        - Series-level isolation: Each series has independent conversation history
        - Episode-level isolation: Each episode template has its own session

        Unified Template Model: Free chat now uses auto-generated templates
        (is_free_chat=TRUE) instead of episode_template_id=NULL. This gives
        free chat feature parity with episode chat.

        This means a user can play the same series with different characters,
        and each (user, series, character) tuple gets its own distinct playthrough.

        Args:
            user_id: User UUID
            character_id: Character UUID (determines which character's playthrough)
            scene: Optional custom scene description
            episode_template_id: Optional episode template ID (overrides scene)
        """
        # Unified Template Model: If no template provided, get/create free chat template
        # This ensures ALL conversations have a template, enabling full Director features
        if not episode_template_id:
            free_chat_template = await self._get_or_create_free_chat_template(character_id)
            episode_template_id = free_chat_template.id
            log.debug(f"Using free chat template {episode_template_id} for character {character_id}")

        # Determine series_id from episode_template (if provided)
        series_id = None
        effective_scene = scene
        opening_line = None

        episode_cost = 0  # Default: free (for free chat or Episode 0)

        role_id = None  # Role for the session (ADR-004)

        # For opening_line substitution: track canonical character name
        canonical_character_name = None

        # Template is now guaranteed to exist (either passed in or free chat template)
        if episode_template_id:
            template_query = """
                SELECT et.situation, et.title, et.opening_line, et.series_id, et.episode_cost, et.role_id,
                       c.name as canonical_character_name
                FROM episode_templates et
                LEFT JOIN characters c ON c.id = et.character_id
                WHERE et.id = :template_id
            """
            template_row = await self.db.fetch_one(template_query, {"template_id": str(episode_template_id)})
            if template_row:
                effective_scene = template_row["situation"]
                opening_line = template_row["opening_line"]
                series_id = template_row["series_id"]
                episode_cost = template_row["episode_cost"] or 0
                role_id = template_row["role_id"]
                canonical_character_name = template_row["canonical_character_name"]

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

        # Check for existing session scoped by (user, series, character, episode_template)
        # ADR-004: Each (user, series, character) tuple gets its own playthrough
        # This ensures separate conversation histories per character per series
        # IMPORTANT: We look for ANY existing session (active OR inactive) to preserve message history
        #
        # Unified Template Model: episode_template_id is now always set (free chat uses is_free_chat templates)
        # For backward compat during migration, we also check for legacy NULL sessions
        row = None

        # Primary lookup: session with this specific episode_template_id
        if series_id:
            query = """
                SELECT * FROM sessions
                WHERE user_id = :user_id
                AND character_id = :character_id
                AND series_id = :series_id
                AND episode_template_id = :episode_template_id
                ORDER BY is_active DESC, started_at DESC
                LIMIT 1
            """
            row = await self.db.fetch_one(query, {
                "user_id": str(user_id),
                "character_id": str(character_id),
                "series_id": str(series_id),
                "episode_template_id": str(episode_template_id),
            })
        else:
            # No series - look up by character and episode_template_id
            # Also check for series_id IS NULL to avoid matching sessions with different series
            query = """
                SELECT * FROM sessions
                WHERE user_id = :user_id
                AND character_id = :character_id
                AND series_id IS NULL
                AND episode_template_id = :episode_template_id
                ORDER BY is_active DESC, started_at DESC
                LIMIT 1
            """
            row = await self.db.fetch_one(query, {
                "user_id": str(user_id),
                "character_id": str(character_id),
                "episode_template_id": str(episode_template_id),
            })

        # Backward compat: Check if template is free chat and look for legacy NULL session
        # This allows existing free chat sessions to continue working before backfill migration
        if not row:
            template_check = await self.db.fetch_one(
                "SELECT is_free_chat FROM episode_templates WHERE id = :id",
                {"id": str(episode_template_id)}
            )
            if template_check and template_check["is_free_chat"]:
                # This is a free chat template - check for legacy session with NULL episode_template_id
                legacy_query = """
                    SELECT * FROM sessions
                    WHERE user_id = :user_id AND character_id = :character_id
                    AND episode_template_id IS NULL
                    ORDER BY is_active DESC, started_at DESC
                    LIMIT 1
                """
                legacy_row = await self.db.fetch_one(legacy_query, {
                    "user_id": str(user_id),
                    "character_id": str(character_id),
                })
                if legacy_row:
                    # Found legacy session - migrate it to use the free chat template
                    await self.db.execute(
                        "UPDATE sessions SET episode_template_id = :template_id WHERE id = :session_id",
                        {"template_id": str(episode_template_id), "session_id": str(legacy_row["id"])}
                    )
                    row = await self.db.fetch_one(
                        "SELECT * FROM sessions WHERE id = :id",
                        {"id": str(legacy_row["id"])}
                    )
                    log.info(f"Migrated legacy free chat session {legacy_row['id']} to template {episode_template_id}")

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

        # Create session with series_id and role_id for proper scoping (ADR-004)
        # session_state must be set explicitly to 'active' for series progress tracking
        create_query = """
            INSERT INTO sessions (user_id, character_id, engagement_id, episode_number, scene, episode_template_id, series_id, role_id, session_state, entry_paid)
            VALUES (:user_id, :character_id, :engagement_id, :episode_number, :scene, :episode_template_id, :series_id, :role_id, :session_state, :entry_paid)
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
                "role_id": str(role_id) if role_id else None,
                "session_state": "active",  # Explicit state for progress tracking
                "entry_paid": entry_paid,
            },
        )

        session = Session(**dict(new_row))
        episode = session  # Backwards compatibility alias

        # If template has an opening_line, save it as the first assistant message
        # This ensures the LLM has context of what the character "already said"
        if opening_line:
            # ADR-004: Substitute canonical character name with selected character's name
            # This allows user-created characters to play episodes authored for canonical characters
            if canonical_character_name:
                # Fetch selected character's name
                char_name_query = "SELECT name FROM characters WHERE id = :character_id"
                char_name_row = await self.db.fetch_one(char_name_query, {"character_id": str(character_id)})
                if char_name_row and char_name_row["name"] != canonical_character_name:
                    selected_character_name = char_name_row["name"]
                    # Replace canonical name with selected character's name (case-insensitive)
                    opening_line = re.sub(
                        re.escape(canonical_character_name),
                        selected_character_name,
                        opening_line,
                        flags=re.IGNORECASE
                    )
                    log.info(f"Substituted character name: {canonical_character_name} -> {selected_character_name}")

            await self._save_message(
                episode_id=session.id,
                role=MessageRole.ASSISTANT,
                content=opening_line,
            )
            log.info(f"Injected opening_line for session {session.id}")

            # ADR-005 v2: Detect props mentioned in opening_line
            # This handles mystery/thriller props that should reveal from turn 0
            if episode_template_id:
                try:
                    revealed_props = await self.director_service.detect_prop_revelations(
                        session_id=session.id,
                        episode_template_id=episode_template_id,
                        assistant_response=opening_line,
                        current_turn=0,
                    )
                    if revealed_props:
                        log.info(f"Opening line revealed {len(revealed_props)} props")
                except Exception as e:
                    log.warning(f"Opening line prop detection failed: {e}")

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

        Routes to appropriate generation pipeline based on visual_type:
        - character: Character scene using appearance_prompt + style_preset
        - object: Close-up of item (no character)
        - atmosphere: Setting/mood shot (no character)

        This runs as a background task and won't block the stream.
        """
        try:
            # Fetch character appearance data (user-created or from avatar kit)
            # For canonical characters, avatar_kit.style_prompt has richer style info
            char_query = """
                SELECT
                    c.appearance_prompt,
                    c.style_preset,
                    c.is_user_created,
                    c.active_avatar_kit_id,
                    COALESCE(c.appearance_prompt, ak.appearance_prompt) as resolved_appearance,
                    ak.style_prompt as ak_style_prompt,
                    ak.negative_prompt
                FROM characters c
                LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
                WHERE c.id = :character_id
            """
            char_row = await self.db.fetch_one(char_query, {"character_id": str(character_id)})

            # Resolve style_prompt with proper fallback chain:
            # 1. For canonical characters: prefer avatar_kit.style_prompt (richer style info)
            # 2. For user-created characters: map style_preset to style_prompt
            # 3. Default: manhwa style
            style_preset = char_row["style_preset"] if char_row else None
            is_user_created = char_row["is_user_created"] if char_row else False
            ak_style_prompt = char_row["ak_style_prompt"] if char_row else None

            style_prompt_map = {
                "anime": "anime style, vibrant colors, expressive features",
                "cinematic": "cinematic style, realistic lighting, dramatic composition",
                "manhwa": "manhwa style, soft colors, elegant features",
            }

            if not is_user_created and ak_style_prompt:
                # Canonical character: use avatar_kit's rich style prompt
                style_prompt = ak_style_prompt
            elif style_preset in style_prompt_map:
                # User-created character or canonical without ak style: use preset mapping
                style_prompt = style_prompt_map[style_preset]
            else:
                # Default fallback
                style_prompt = "manhwa style, soft colors, elegant features"

            appearance_prompt = char_row["resolved_appearance"] if char_row else None
            negative_prompt = char_row["negative_prompt"] if char_row else None

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
                avatar_kit_id=char_row["active_avatar_kit_id"] if char_row else None,
                anchor_image=None,  # T2I only for auto-gen
            )

            if result:
                # Increment generations_used counter
                await self.db.execute(
                    """
                    UPDATE sessions
                    SET generations_used = generations_used + 1
                    WHERE id = :episode_id
                    """,
                    {"episode_id": str(episode_id)},
                )
                log.info(f"Auto-generated {visual_type} scene for episode {episode_id}: {result.get('image_id')}")
            else:
                log.warning(f"Auto-scene generation returned no result for episode {episode_id}")

        except Exception as e:
            log.error(f"Auto-scene generation failed for episode {episode_id}: {e}")

    async def _run_director_phase2_background(
        self,
        episode_id: UUID,
        episode_template: Optional[EpisodeTemplate],
        full_messages: List[Dict],
        character_id: UUID,
        user_id: UUID,
        character_name: str,
    ):
        """Run Director Phase 2 processing in background (fire-and-forget).

        v2.7: This runs AFTER the done event is sent to minimize perceived latency.
        Handles: memory/hook extraction, beat classification, visual triggers.

        This background task reduces response finalization delay by 800ms-2.5s.
        """
        try:
            # Refresh session to get latest turn_count and director_state
            refreshed_session = await self._get_session(episode_id)
            if not refreshed_session:
                log.warning(f"Background Director: session {episode_id} not found")
                return

            # Director processes ALL episodes (open + bounded)
            director_output = await self.director_service.process_exchange(
                session=refreshed_session,
                episode_template=episode_template,
                messages=full_messages,
                character_id=character_id,
                user_id=user_id,
            )

            # Handle visual generation if triggered
            if director_output.actions and director_output.actions.visual_type not in ("none", "instruction"):
                actions = director_output.actions

                # Auto-generate scene image if conditions met
                if ENABLE_AUTO_SCENE_GENERATION:
                    # Check subscription tier (premium only for auto-gen)
                    user_row = await self.db.fetch_one(
                        "SELECT subscription_status FROM users WHERE id = :user_id",
                        {"user_id": str(user_id)}
                    )
                    is_premium = user_row and user_row["subscription_status"] == "premium"

                    if is_premium:
                        # Check budget not exhausted
                        visual_mode = getattr(episode_template, 'visual_mode', 'none') if episode_template else 'none'
                        generation_budget = getattr(episode_template, 'generation_budget', 0) if episode_template else 0

                        if visual_mode in ("cinematic", "minimal") and refreshed_session.generations_used < generation_budget:
                            # Run scene generation (already async, but we await here since we're in background)
                            await self._generate_auto_scene(
                                episode_id=episode_id,
                                user_id=user_id,
                                character_id=character_id,
                                character_name=character_name,
                                scene_setting=episode_template.situation if episode_template else "",
                                visual_hint=actions.visual_hint or "the current moment",
                                visual_type=actions.visual_type,
                            )
                            log.info(f"Background auto-gen: {actions.visual_type} (session {refreshed_session.id})")
                        else:
                            log.debug(f"Background auto-gen skipped: budget exhausted or visual_mode={visual_mode}")
                    else:
                        log.debug(f"Background auto-gen skipped: user {user_id} not premium")

            # Log completion for debugging
            log.info(
                f"Background Director completed: episode={episode_id}, "
                f"turn={director_output.turn_count}, suggest_next={director_output.suggest_next}"
            )

        except Exception as e:
            # Log but don't raise - this is fire-and-forget
            log.error(f"Background Director Phase 2 failed for episode {episode_id}: {e}")

    # NOTE: _process_exchange() removed - Director now owns memory/hook extraction (v2.3)

    async def _get_next_episode_in_series(
        self,
        series_id: UUID,
        current_episode_number: int,
    ) -> Optional[Dict]:
        """Get the next episode in a series by episode number.

        v2.8: Used for next_episode_suggestion event payload.
        Returns the next episode template if it exists.
        """
        query = """
            SELECT id, title, slug, episode_number
            FROM episode_templates
            WHERE series_id = :series_id
            AND episode_number = :next_number
            AND status = 'active'
        """
        row = await self.db.fetch_one(query, {
            "series_id": str(series_id),
            "next_number": current_episode_number + 1,
        })
        return dict(row) if row else None

    # NOTE: _check_automatic_prop_reveals() removed in ADR-005 v2.
    # Prop revelation is now Director-owned via detect_prop_revelations().
    # See director.py DirectorService.detect_prop_revelations()

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

    async def _get_or_create_free_chat_template(
        self,
        character_id: UUID,
    ) -> EpisodeTemplate:
        """Get or create a free chat template for a character.

        Unified Template Model: Free chat now uses an auto-generated template
        instead of having episode_template_id = NULL. This gives free chat
        feature parity with episode chat (Director, visuals, turn tracking).

        The template is created with:
        - visual_mode = "none" (no auto-visuals by default)
        - turn_budget = None (open-ended)
        - episode_cost = 0 (free)
        - is_free_chat = True (hidden from episode discovery)
        """
        import uuid as uuid_module

        # Check for existing free chat template
        query = """
            SELECT * FROM episode_templates
            WHERE character_id = :character_id AND is_free_chat = TRUE
            LIMIT 1
        """
        row = await self.db.fetch_one(query, {"character_id": str(character_id)})

        if row:
            try:
                return EpisodeTemplate(**{
                    k: row[k] for k in row.keys()
                    if k in EpisodeTemplate.model_fields
                })
            except Exception as e:
                log.warning(f"Failed to parse existing free chat template: {e}")

        # Get character info for template creation
        char_row = await self.db.fetch_one(
            "SELECT name, archetype FROM characters WHERE id = :id",
            {"id": str(character_id)}
        )

        if not char_row:
            raise ValueError(f"Character {character_id} not found")

        character_name = char_row["name"]
        archetype = char_row["archetype"] or "romantic"

        # Create new free chat template
        template_id = uuid_module.uuid4()

        insert_query = """
            INSERT INTO episode_templates (
                id, character_id, title, slug, situation, opening_line,
                genre, turn_budget, visual_mode, generation_budget,
                episode_cost, is_free_chat, is_default, status, episode_number
            )
            VALUES (
                :id, :character_id, :title, :slug, :situation, :opening_line,
                :genre, :turn_budget, :visual_mode, :generation_budget,
                :episode_cost, :is_free_chat, :is_default, :status, :episode_number
            )
            RETURNING *
        """

        new_row = await self.db.fetch_one(insert_query, {
            "id": str(template_id),
            "character_id": str(character_id),
            "title": f"Chat with {character_name}",
            "slug": f"free-chat-{character_id}",
            "situation": f"An open conversation with {character_name}.",
            "opening_line": "",  # No opening line for free chat
            "genre": "romantic_tension",
            "turn_budget": 0,  # 0 means open-ended
            "visual_mode": VisualMode.NONE,  # Default: no auto-visuals
            "generation_budget": 0,  # No auto-gens by default
            "episode_cost": 0,  # Free
            "is_free_chat": True,
            "is_default": False,
            "status": "active",
            "episode_number": -1,  # -1 to avoid conflict with character's episode 0
        })

        log.info(f"Created free chat template for character {character_id}: {template_id}")

        return EpisodeTemplate(**{
            k: new_row[k] for k in new_row.keys()
            if k in EpisodeTemplate.model_fields
        })

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
