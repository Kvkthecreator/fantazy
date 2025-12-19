"""Director Service - Unified post-exchange processing.

The Director is the system entity that observes, evaluates, and orchestrates
episode progression. It merges with the existing _process_exchange() flow
to avoid duplicate LLM calls.

Reference: docs/DIRECTOR_ARCHITECTURE.md
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from app.models.episode_template import CompletionMode, EpisodeTemplate
from app.models.session import Session
from app.models.evaluation import (
    SessionEvaluation,
    SessionEvaluationCreate,
    EvaluationType,
    FlirtArchetype,
    FLIRT_ARCHETYPES,
    generate_share_id,
)
from app.services.llm import LLMService

log = logging.getLogger(__name__)


@dataclass
class DirectorOutput:
    """Output from Director processing."""
    # Memory/hook data (existing behavior)
    extracted_memories: List[Dict[str, Any]]
    beat_data: Optional[Dict[str, Any]]
    extracted_hooks: List[Dict[str, Any]]

    # Director-specific data
    turn_count: int
    is_complete: bool
    completion_trigger: Optional[str]  # "turn_limit", "beat_gate", "objective", None

    # Structured character output (if enabled)
    structured_response: Optional[Dict[str, Any]]

    # Evaluation (if episode completed)
    evaluation: Optional[Dict[str, Any]]


@dataclass
class CompletionCheck:
    """Result of completion check."""
    is_complete: bool
    trigger: Optional[str]  # What triggered completion
    reason: Optional[str]  # Human-readable reason


class DirectorService:
    """Director service - unified post-exchange processing.

    The Director is the "brain, eyes, ears, and hands" of the conversation system:
    - Eyes/Ears: Observes all exchanges
    - Brain: Evaluates state, progression, completion
    - Hands: Triggers actions (completion, UI updates, evaluations)

    This service merges with _process_exchange() to avoid duplicate analysis.
    """

    def __init__(self, db):
        self.db = db
        self.llm = LLMService.get_instance()

    async def process_exchange(
        self,
        session: Session,
        episode_template: Optional[EpisodeTemplate],
        messages: List[Dict[str, str]],
        character_id: UUID,
        user_id: UUID,
        structured_response: Optional[Dict[str, Any]] = None,
    ) -> DirectorOutput:
        """Process a complete exchange.

        This is the unified entry point that replaces _process_exchange().
        It handles:
        1. Memory/hook extraction (existing behavior)
        2. Turn counting and state updates
        3. Completion detection
        4. Evaluation generation (if complete)

        Args:
            session: Current session
            episode_template: Template if playing an episode (can be None for free-form)
            messages: Full conversation history
            character_id: Character UUID
            user_id: User UUID
            structured_response: Structured LLM output (if using structured mode)

        Returns:
            DirectorOutput with all processing results
        """
        # 1. Increment turn count
        new_turn_count = session.turn_count + 1

        # 2. Update director state with structured response signals
        director_state = dict(session.director_state)
        if structured_response:
            # Extract signals from structured response
            tension_shift = structured_response.get("tension_shift", 0)
            mood = structured_response.get("mood")

            # Update tension level
            current_tension = director_state.get("tension_level", 50)
            new_tension = max(0, min(100, current_tension + int(tension_shift * 10)))
            director_state["tension_level"] = new_tension

            # Track mood history
            mood_history = director_state.get("mood_history", [])
            if mood:
                mood_history.append(mood)
                director_state["mood_history"] = mood_history[-10:]  # Keep last 10

            # Track signals for evaluation
            signals = director_state.get("signals", [])
            signals.append({
                "turn": new_turn_count,
                "mood": mood,
                "tension_shift": tension_shift,
            })
            director_state["signals"] = signals[-20:]  # Keep last 20

        # 3. Check completion
        completion = await self.check_completion(
            session=session,
            episode_template=episode_template,
            turn_count=new_turn_count,
            director_state=director_state,
        )

        # 4. Update session in database
        await self._update_session_director_state(
            session_id=session.id,
            turn_count=new_turn_count,
            director_state=director_state,
            is_complete=completion.is_complete,
            completion_trigger=completion.trigger,
        )

        # 5. Generate evaluation if complete
        evaluation = None
        if completion.is_complete and episode_template:
            evaluation = await self.generate_evaluation(
                session_id=session.id,
                evaluation_type=self._get_evaluation_type(episode_template),
                messages=messages,
                director_state=director_state,
            )

        return DirectorOutput(
            extracted_memories=[],  # Will be populated by caller (memory_service)
            beat_data=None,  # Will be populated by caller
            extracted_hooks=[],  # Will be populated by caller
            turn_count=new_turn_count,
            is_complete=completion.is_complete,
            completion_trigger=completion.trigger,
            structured_response=structured_response,
            evaluation=evaluation,
        )

    async def check_completion(
        self,
        session: Session,
        episode_template: Optional[EpisodeTemplate],
        turn_count: int,
        director_state: Dict[str, Any],
    ) -> CompletionCheck:
        """Check if episode should complete.

        Checks based on completion_mode:
        - open: Never auto-complete (user/fade decides)
        - turn_limited: Complete when turn_count >= turn_budget
        - beat_gated: Complete when required beat is reached (future)
        - objective: Complete when objective is achieved (future)
        """
        if not episode_template:
            return CompletionCheck(is_complete=False, trigger=None, reason=None)

        completion_mode = getattr(episode_template, 'completion_mode', CompletionMode.OPEN)

        if completion_mode == CompletionMode.OPEN:
            return CompletionCheck(is_complete=False, trigger=None, reason=None)

        elif completion_mode == CompletionMode.TURN_LIMITED:
            turn_budget = getattr(episode_template, 'turn_budget', None)
            if turn_budget and turn_count >= turn_budget:
                return CompletionCheck(
                    is_complete=True,
                    trigger="turn_limit",
                    reason=f"Reached turn limit ({turn_count}/{turn_budget})"
                )
            return CompletionCheck(is_complete=False, trigger=None, reason=None)

        elif completion_mode == CompletionMode.BEAT_GATED:
            # Future: Check if required beat has been reached
            criteria = getattr(episode_template, 'completion_criteria', {})
            required_beat = criteria.get("required_beat")
            current_beat = director_state.get("current_beat")

            if required_beat and current_beat == required_beat:
                return CompletionCheck(
                    is_complete=True,
                    trigger="beat_gate",
                    reason=f"Reached required beat: {required_beat}"
                )
            return CompletionCheck(is_complete=False, trigger=None, reason=None)

        elif completion_mode == CompletionMode.OBJECTIVE:
            # Future: Check if objective is achieved
            return CompletionCheck(is_complete=False, trigger=None, reason=None)

        return CompletionCheck(is_complete=False, trigger=None, reason=None)

    async def generate_evaluation(
        self,
        session_id: UUID,
        evaluation_type: str,
        messages: List[Dict[str, str]],
        director_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Generate evaluation at episode completion.

        Currently supports:
        - flirt_archetype: Classify user's flirt style

        Future:
        - mystery_summary: Summarize mystery episode
        - compatibility: Character compatibility score
        """
        if evaluation_type == EvaluationType.FLIRT_ARCHETYPE:
            result = await self._evaluate_flirt_archetype(messages, director_state)
        else:
            # Default to episode summary
            result = await self._evaluate_episode_summary(messages, director_state)

        # Generate share ID
        share_id = generate_share_id()

        # Save to database
        evaluation_id = await self._save_evaluation(
            session_id=session_id,
            evaluation_type=evaluation_type,
            result=result,
            share_id=share_id,
        )

        return {
            "id": str(evaluation_id),
            "session_id": str(session_id),
            "evaluation_type": evaluation_type,
            "result": result,
            "share_id": share_id,
        }

    async def _evaluate_flirt_archetype(
        self,
        messages: List[Dict[str, str]],
        director_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Evaluate flirt archetype from conversation."""
        # Format conversation for analysis
        conversation = "\n".join(
            f"{m['role'].upper()}: {m['content']}"
            for m in messages
            if m['role'] in ('user', 'assistant')
        )

        # Format signals
        signals = director_state.get("signals", [])
        signals_str = json.dumps(signals, indent=2) if signals else "No signals tracked"

        prompt = f"""Analyze this flirtatious conversation and classify the user's flirt style.

CONVERSATION:
{conversation}

STRUCTURED SIGNALS:
{signals_str}

Based on the user's responses, determine their primary flirt archetype:
- tension_builder: Masters the pause, creates anticipation, comfortable with silence
- bold_mover: Direct, confident, takes initiative, says what they want
- playful_tease: Light, fun, uses humor, keeps it breezy
- slow_burn: Patient, builds connection, values depth over speed
- mysterious_allure: Intriguing, doesn't reveal everything, leaves them wanting more

Return ONLY valid JSON (no markdown):
{{
    "archetype": "<key>",
    "confidence": 0.0-1.0,
    "primary_signals": ["signal1", "signal2", "signal3"],
    "reasoning": "Brief explanation of why this archetype"
}}"""

        try:
            response = await self.llm.generate([
                {"role": "system", "content": "You are an expert at analyzing flirtation styles and romantic communication patterns. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ])

            # Parse response
            result = json.loads(response.content)
            archetype = result.get("archetype", FlirtArchetype.PLAYFUL_TEASE)

            # Get metadata from constants
            metadata = FLIRT_ARCHETYPES.get(archetype, FLIRT_ARCHETYPES[FlirtArchetype.PLAYFUL_TEASE])

            return {
                "archetype": archetype,
                "confidence": result.get("confidence", 0.7),
                "primary_signals": result.get("primary_signals", []),
                "title": metadata["title"],
                "description": metadata["description"],
            }

        except Exception as e:
            log.error(f"Flirt archetype evaluation failed: {e}")
            # Default fallback
            return {
                "archetype": FlirtArchetype.PLAYFUL_TEASE,
                "confidence": 0.5,
                "primary_signals": [],
                "title": FLIRT_ARCHETYPES[FlirtArchetype.PLAYFUL_TEASE]["title"],
                "description": FLIRT_ARCHETYPES[FlirtArchetype.PLAYFUL_TEASE]["description"],
            }

    async def _evaluate_episode_summary(
        self,
        messages: List[Dict[str, str]],
        director_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Generate episode summary evaluation."""
        # Simple summary - can be enhanced later
        return {
            "summary": "Episode completed",
            "turn_count": len([m for m in messages if m['role'] == 'user']),
            "final_tension": director_state.get("tension_level", 50),
        }

    def _get_evaluation_type(self, episode_template: EpisodeTemplate) -> str:
        """Determine evaluation type from episode template."""
        # Check completion_criteria for evaluation type hint
        criteria = getattr(episode_template, 'completion_criteria', {})
        if criteria.get("evaluation_type"):
            return criteria["evaluation_type"]

        # Check series/title for hints
        title = episode_template.title.lower() if episode_template.title else ""
        if "flirt" in title or "test" in title:
            return EvaluationType.FLIRT_ARCHETYPE

        return EvaluationType.EPISODE_SUMMARY

    async def _update_session_director_state(
        self,
        session_id: UUID,
        turn_count: int,
        director_state: Dict[str, Any],
        is_complete: bool,
        completion_trigger: Optional[str],
    ):
        """Update session with Director state."""
        updates = {
            "turn_count": turn_count,
            "director_state": json.dumps(director_state),
        }

        if is_complete:
            updates["session_state"] = "complete"
            updates["completion_trigger"] = completion_trigger

        set_clause = ", ".join(f"{k} = :{k}" for k in updates.keys())
        updates["session_id"] = str(session_id)

        await self.db.execute(
            f"UPDATE sessions SET {set_clause} WHERE id = :session_id",
            updates
        )

    async def _save_evaluation(
        self,
        session_id: UUID,
        evaluation_type: str,
        result: Dict[str, Any],
        share_id: str,
    ) -> UUID:
        """Save evaluation to database."""
        row = await self.db.fetch_one(
            """
            INSERT INTO session_evaluations (session_id, evaluation_type, result, share_id, model_used)
            VALUES (:session_id, :evaluation_type, :result, :share_id, :model_used)
            RETURNING id
            """,
            {
                "session_id": str(session_id),
                "evaluation_type": evaluation_type,
                "result": json.dumps(result),
                "share_id": share_id,
                "model_used": self.llm.model_name if hasattr(self.llm, 'model_name') else None,
            }
        )
        return row["id"]

    async def get_evaluation_by_share_id(self, share_id: str) -> Optional[Dict[str, Any]]:
        """Get evaluation by share ID (for share pages)."""
        row = await self.db.fetch_one(
            """
            SELECT
                se.*,
                s.character_id,
                c.name as character_name,
                s.series_id
            FROM session_evaluations se
            JOIN sessions s ON s.id = se.session_id
            LEFT JOIN characters c ON c.id = s.character_id
            WHERE se.share_id = :share_id
            """,
            {"share_id": share_id}
        )

        if not row:
            return None

        return {
            "evaluation_type": row["evaluation_type"],
            "result": json.loads(row["result"]) if isinstance(row["result"], str) else row["result"],
            "share_id": row["share_id"],
            "share_count": row["share_count"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "character_id": str(row["character_id"]) if row["character_id"] else None,
            "character_name": row["character_name"],
            "series_id": str(row["series_id"]) if row["series_id"] else None,
        }

    async def increment_share_count(self, share_id: str):
        """Increment share count for analytics."""
        await self.db.execute(
            "UPDATE session_evaluations SET share_count = share_count + 1 WHERE share_id = :share_id",
            {"share_id": share_id}
        )

    async def suggest_next_episode(
        self,
        session: Session,
        evaluation: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Suggest next episode based on current session and evaluation.

        Future enhancement: Use evaluation results to match appropriate content.
        """
        if not session.series_id:
            return None

        # Get next episode in series order
        row = await self.db.fetch_one(
            """
            SELECT
                et.id,
                et.title,
                et.slug,
                et.episode_number,
                et.situation,
                et.character_id
            FROM episode_templates et
            WHERE et.series_id = :series_id
            AND et.episode_number > :current_episode
            AND et.status = 'active'
            ORDER BY et.episode_number
            LIMIT 1
            """,
            {
                "series_id": str(session.series_id),
                "current_episode": session.episode_number if hasattr(session, 'episode_number') else 0,
            }
        )

        if not row:
            return None

        return {
            "episode_id": str(row["id"]),
            "title": row["title"],
            "slug": row["slug"],
            "episode_number": row["episode_number"],
            "situation": row["situation"],
            "character_id": str(row["character_id"]) if row["character_id"] else None,
        }
