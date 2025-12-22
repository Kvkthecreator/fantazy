"""Director Service - Semantic evaluation and runtime orchestration.

The Director is the system entity that observes, evaluates, and orchestrates
episode progression through semantic understanding rather than state machines.

Director Protocol v2.0:
- PRE-GUIDANCE: Pacing, tension, physical anchors BEFORE character responds
- POST-EVALUATION: Visual detection, completion status AFTER response

Reference: docs/quality/core/DIRECTOR_PROTOCOL.md
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.models.episode_template import EpisodeTemplate, AutoSceneMode, VisualMode
from app.models.session import Session
from app.models.evaluation import (
    EvaluationType,
    FlirtArchetype,
    FLIRT_ARCHETYPES,
    RomanticTrope,
    ROMANTIC_TROPES,
    generate_share_id,
)
from app.services.llm import LLMService

log = logging.getLogger(__name__)


# Genre-specific tension patterns for pre-guidance
GENRE_BEATS = {
    "romantic_tension": {
        "establish": "set the scene, create first spark of attraction",
        "develop": "build rapport through vulnerability, test boundaries",
        "escalate": "unspoken tension rises, proximity matters more",
        "peak": "the moment before something changes forever",
        "resolve": "land the emotional payoff or create the hook for next time",
    },
    "psychological_thriller": {
        "establish": "something feels off, trust is uncertain",
        "develop": "information drip, questions multiply",
        "escalate": "stakes become personal, escape narrows",
        "peak": "truth or consequences, no safe exit",
        "resolve": "revelation or cliffhanger, nothing is the same",
    },
    "slice_of_life": {
        "establish": "comfortable presence, small details matter",
        "develop": "shared moments build connection",
        "escalate": "depth emerges from simplicity",
        "peak": "quiet intimacy, being truly known",
        "resolve": "warmth lingers, anticipation for next time",
    },
}


@dataclass
class DirectorGuidance:
    """Pre-response guidance for character LLM.

    This is injected into context BEFORE the character generates a response.
    It influences pacing, tension, and genre-appropriate behavior.
    """
    pacing: str = "develop"  # establish/develop/escalate/peak/resolve
    tension_note: Optional[str] = None  # Subtle direction for the actor
    physical_anchor: Optional[str] = None  # Sensory reminder
    genre_beat: Optional[str] = None  # Genre-specific guidance

    def to_prompt_section(self) -> str:
        """Format as prompt section for character LLM."""
        lines = [
            "═══════════════════════════════════════════════════════════════",
            "DIRECTOR NOTE (internal guidance - do not mention explicitly)",
            "═══════════════════════════════════════════════════════════════",
            "",
            f"Pacing: {self.pacing.upper()}",
        ]

        if self.tension_note:
            lines.append(f"Tension: {self.tension_note}")

        if self.physical_anchor:
            lines.append(f"Ground in: {self.physical_anchor}")

        if self.genre_beat:
            lines.append(f"Beat: {self.genre_beat}")

        lines.append("")
        lines.append("Let this guide your response naturally. Don't force it.")

        return "\n".join(lines)


@dataclass
class DirectorActions:
    """Deterministic outputs for system behavior.

    These are explicit actions the system should take - no interpretation needed.
    """
    visual_type: str = "none"  # character/object/atmosphere/instruction/none
    visual_hint: Optional[str] = None  # What to show (for image generation)
    suggest_next: bool = False  # Suggest moving to next episode
    deduct_sparks: int = 0  # Sparks to deduct for scene generation
    save_memory: bool = False  # Save evaluation as memory
    memory_content: Optional[str] = None  # Content to save
    needs_sparks: bool = False  # User needs more sparks (first-time prompt)


@dataclass
class DirectorOutput:
    """Output from Director processing."""
    # Core state
    turn_count: int
    is_complete: bool
    completion_trigger: Optional[str]  # "semantic", "turn_limit", None

    # Semantic evaluation result
    evaluation: Optional[Dict[str, Any]] = None

    # Deterministic actions
    actions: Optional[DirectorActions] = None

    # Legacy compatibility (will be removed)
    extracted_memories: List[Dict[str, Any]] = field(default_factory=list)
    beat_data: Optional[Dict[str, Any]] = None
    extracted_hooks: List[Dict[str, Any]] = field(default_factory=list)
    structured_response: Optional[Dict[str, Any]] = None


class DirectorService:
    """Director service - semantic evaluation and runtime orchestration.

    Director Protocol v2.0 - Two-Phase Model:

    PHASE 1: PRE-GUIDANCE (before character LLM)
    - Determines pacing based on turn count and episode budget
    - Generates tension notes based on recent exchange
    - Provides physical anchors from situation
    - Adds genre-appropriate beat guidance

    PHASE 2: POST-EVALUATION (after character LLM)
    - Detects visual moments (character/object/atmosphere/instruction)
    - Determines episode completion status
    - Triggers memory extraction and hooks

    The Director is the "brain, eyes, ears, and hands" of the conversation system:
    - Eyes/Ears: Observes all exchanges
    - Brain: Evaluates semantically (not state machines)
    - Hands: Triggers deterministic actions
    """

    def __init__(self, db):
        self.db = db
        self.llm = LLMService.get_instance()

    # =========================================================================
    # PHASE 1: PRE-GUIDANCE (before character response)
    # =========================================================================

    def determine_pacing(
        self,
        turn_count: int,
        turn_budget: Optional[int],
    ) -> str:
        """Determine pacing phase based on turn position.

        Returns: establish/develop/escalate/peak/resolve
        """
        if turn_budget and turn_budget > 0:
            # Bounded episode: use position in arc
            position = turn_count / turn_budget
            if position < 0.15:
                return "establish"
            elif position < 0.4:
                return "develop"
            elif position < 0.7:
                return "escalate"
            elif position < 0.9:
                return "peak"
            else:
                return "resolve"
        else:
            # Open episode: use turn count heuristics
            if turn_count < 2:
                return "establish"
            elif turn_count < 5:
                return "develop"
            elif turn_count < 10:
                return "escalate"
            elif turn_count < 15:
                return "peak"
            else:
                return "resolve"

    async def generate_pre_guidance(
        self,
        messages: List[Dict[str, str]],
        genre: str,
        situation: str,
        dramatic_question: str,
        turn_count: int,
        turn_budget: Optional[int] = None,
    ) -> DirectorGuidance:
        """Generate pre-response guidance for character LLM.

        This is a lightweight LLM call that provides:
        - Pacing phase (algorithmic)
        - Tension note (LLM-generated, contextual)
        - Physical anchor (from situation)
        - Genre beat (from GENRE_BEATS lookup)
        """
        # 1. Determine pacing algorithmically
        pacing = self.determine_pacing(turn_count, turn_budget)

        # 2. Get genre beat from lookup
        genre_key = genre.lower().replace(" ", "_").replace("-", "_")
        genre_beats = GENRE_BEATS.get(genre_key, GENRE_BEATS.get("romantic_tension", {}))
        genre_beat = f"{genre_key}: {genre_beats.get(pacing, 'stay in the moment')}"

        # 3. Extract physical anchor from situation (first sensory phrase)
        physical_anchor = None
        if situation:
            # Take first meaningful chunk for grounding
            physical_anchor = situation.split(".")[0].strip()[:100]

        # 4. Generate tension note via lightweight LLM call
        tension_note = await self._generate_tension_note(
            messages=messages,
            genre=genre,
            dramatic_question=dramatic_question,
            pacing=pacing,
        )

        return DirectorGuidance(
            pacing=pacing,
            tension_note=tension_note,
            physical_anchor=physical_anchor,
            genre_beat=genre_beat,
        )

    async def _generate_tension_note(
        self,
        messages: List[Dict[str, str]],
        genre: str,
        dramatic_question: str,
        pacing: str,
    ) -> Optional[str]:
        """Generate a contextual tension note for the character.

        This is a very short, focused LLM call (~50 tokens output).
        """
        # Only use last 2 exchanges for speed
        recent = messages[-4:] if len(messages) > 4 else messages
        formatted = "\n".join(
            f"{m['role'].upper()}: {m['content'][:200]}"
            for m in recent
        )

        prompt = f"""You are a director giving a one-line note to an actor in a {genre} scene.

RECENT EXCHANGE:
{formatted}

DRAMATIC TENSION: {dramatic_question}
CURRENT PACING: {pacing}

Give ONE short direction (max 15 words) that helps the actor understand what to lean into for their next line. Focus on subtext, not action.

Examples:
- "She wants to stay but can't admit it—let the pause speak"
- "He's testing you—match his energy but keep something back"
- "The silence is louder than words right now"

Your direction:"""

        try:
            response = await self.llm.generate(
                [{"role": "user", "content": prompt}],
                max_tokens=50,
                temperature=0.7,
            )
            # Clean up response
            note = response.content.strip().strip('"').strip("'")
            return note[:150] if note else None
        except Exception as e:
            log.warning(f"Tension note generation failed: {e}")
            return None

    # =========================================================================
    # PHASE 2: POST-EVALUATION (after character response)
    # =========================================================================

    async def evaluate_exchange(
        self,
        messages: List[Dict[str, str]],
        character_name: str,
        genre: str,
        situation: str,
        dramatic_question: str,
    ) -> Dict[str, Any]:
        """Semantic evaluation of exchange.

        Uses LLM to understand the meaning and emotional state of the conversation,
        then extracts minimal structured signals for deterministic action.
        """
        # Format recent messages (last 3 exchanges = 6 messages)
        recent = messages[-6:] if len(messages) > 6 else messages
        formatted = "\n".join(
            f"{m['role'].upper()}: {m['content']}"
            for m in recent
        )

        prompt = f"""You are the Director observing a {genre} story.

Character: {character_name}
Situation: {situation}
Core tension: {dramatic_question}

RECENT EXCHANGE:
{formatted}

As a director, observe this moment. Answer naturally, then provide signals.

1. VISUAL: Would this exchange benefit from a visual element?
   - CHARACTER: A shot featuring the character (portrait, expression, pose)
   - OBJECT: Close-up of an item (letter, phone, key, evidence)
   - ATMOSPHERE: Setting/mood without character visible
   - INSTRUCTION: Game-like information (codes, hints, choices)
   - NONE: No visual needed

   If not NONE, describe what should be shown in one evocative sentence.

2. STATUS: Is this episode ready to close, approaching closure, or still unfolding?
   Explain briefly in terms that make sense for this {genre} story.

End with a signal line for parsing:
SIGNAL: [visual: character/object/atmosphere/instruction/none] [status: going/closing/done]
If visual is not "none", add: [hint: <description>]"""

        try:
            response = await self.llm.generate([
                {"role": "system", "content": "You are a story director. Be concise."},
                {"role": "user", "content": prompt}
            ], max_tokens=250)

            return self._parse_evaluation(response.content)
        except Exception as e:
            log.error(f"Director evaluation failed: {e}")
            return {
                "raw_response": "",
                "visual_type": "none",
                "visual_hint": None,
                "status": "going",
            }

    def _parse_evaluation(self, response: str) -> Dict[str, Any]:
        """Parse natural language evaluation into actionable signals."""
        # Extract signal line with visual type
        signal_match = re.search(
            r'SIGNAL:\s*\[visual:\s*(character|object|atmosphere|instruction|none)\]\s*\[status:\s*(going|closing|done)\]',
            response, re.IGNORECASE
        )

        # Extract hint if present
        hint_match = re.search(r'\[hint:\s*([^\]]+)\]', response, re.IGNORECASE)

        if signal_match:
            visual_type = signal_match.group(1).lower()
            status_signal = signal_match.group(2).lower()
            visual_hint = hint_match.group(1).strip() if hint_match else None
        else:
            # Fallback parsing
            visual_type = 'none'
            status_signal = 'done' if 'done' in response.lower() else 'going'
            visual_hint = None

        return {
            "raw_response": response,
            "visual_type": visual_type,
            "visual_hint": visual_hint,
            "status": status_signal,
        }

    def decide_actions(
        self,
        evaluation: Dict[str, Any],
        episode: Optional[EpisodeTemplate],
        session: Session,
    ) -> DirectorActions:
        """Convert semantic evaluation into deterministic actions.

        Ticket + Moments Model:
        - Episodes have a generation_budget (max auto-gens included in entry cost)
        - visual_mode determines when to trigger: cinematic (peaks), minimal (climax only), none
        - No spark charging here - generations are included in episode cost
        - Track generations_used against budget
        """
        actions = DirectorActions()
        turn = session.turn_count + 1  # New turn count after this exchange
        visual_type = evaluation.get("visual_type", "none")

        if not episode:
            return actions

        # --- Visual Generation (Ticket + Moments model) ---
        visual_mode = getattr(episode, 'visual_mode', VisualMode.NONE)
        generation_budget = getattr(episode, 'generation_budget', 0)
        generations_used = getattr(session, 'generations_used', 0)

        # Check if we have budget remaining
        budget_remaining = generation_budget - generations_used > 0

        if visual_mode == VisualMode.CINEMATIC and budget_remaining:
            # Generate on visual moments (any image type except none/instruction)
            if visual_type in ("character", "object", "atmosphere"):
                actions.visual_type = visual_type
                actions.visual_hint = evaluation.get("visual_hint")
                # Mark that we're using a generation (no spark charge - included in episode)
                actions.deduct_sparks = 0  # Included in episode cost

        elif visual_mode == VisualMode.MINIMAL and budget_remaining:
            # Only generate at episode climax (status == "done" or "closing")
            status = evaluation.get("status", "going")
            if status in ("done", "closing") and visual_type in ("character", "object", "atmosphere"):
                actions.visual_type = visual_type
                actions.visual_hint = evaluation.get("visual_hint") or "the climactic moment"
                actions.deduct_sparks = 0  # Included in episode cost

        # Instruction cards are free and don't count against budget
        elif visual_type == "instruction":
            actions.visual_type = "instruction"
            actions.visual_hint = evaluation.get("visual_hint")

        # Fallback: Support legacy auto_scene_mode for backward compatibility
        if visual_mode == VisualMode.NONE:
            auto_mode = getattr(episode, 'auto_scene_mode', AutoSceneMode.OFF)
            if auto_mode == AutoSceneMode.PEAKS and visual_type != "none":
                actions.visual_type = visual_type
                actions.visual_hint = evaluation.get("visual_hint")
                if visual_type in ("character", "object", "atmosphere"):
                    actions.deduct_sparks = getattr(episode, 'spark_cost_per_scene', 5)
            elif auto_mode == AutoSceneMode.RHYTHMIC:
                interval = getattr(episode, 'scene_interval', 3) or 3
                if turn > 0 and turn % interval == 0:
                    actions.visual_type = visual_type if visual_type != "none" else "character"
                    actions.visual_hint = evaluation.get("visual_hint") or "the current moment"
                    if actions.visual_type in ("character", "object", "atmosphere"):
                        actions.deduct_sparks = getattr(episode, 'spark_cost_per_scene', 5)

        # --- Episode Progression ---
        status = evaluation.get("status", "going")
        turn_budget = getattr(episode, 'turn_budget', None)

        if status == "done":
            actions.suggest_next = True
        elif turn_budget and turn >= turn_budget:
            actions.suggest_next = True

        # --- Memory ---
        if status in ("closing", "done") and evaluation.get("raw_response"):
            actions.save_memory = True
            actions.memory_content = evaluation["raw_response"][:500]

        return actions

    async def execute_actions(
        self,
        actions: DirectorActions,
        session: Session,
        user_id: UUID,
        episode: Optional[EpisodeTemplate] = None,
    ) -> DirectorActions:
        """Execute actions, handling generation budget or spark balance.

        Ticket + Moments Model:
        - If visual_mode is cinematic/minimal, generations are included in episode cost
        - We increment generations_used instead of charging sparks
        - Legacy mode (auto_scene_mode) still charges sparks per generation

        Returns potentially modified actions (e.g., if budget exhausted or sparks insufficient).
        """
        from app.services.credits import CreditsService, InsufficientSparksError
        from app.deps import get_db

        credits = CreditsService.get_instance()

        # Skip if no visual action
        if actions.visual_type == "none" or actions.visual_type == "instruction":
            return actions

        # Check if using Ticket + Moments model (generation budget) or legacy (spark per gen)
        visual_mode = getattr(episode, 'visual_mode', VisualMode.NONE) if episode else VisualMode.NONE

        if visual_mode in (VisualMode.CINEMATIC, VisualMode.MINIMAL):
            # Ticket + Moments: Increment generations_used (no spark charge)
            # The generation is "free" because user paid episode_cost at entry
            db = await get_db()
            await db.execute(
                """
                UPDATE sessions
                SET generations_used = generations_used + 1
                WHERE id = :session_id
                """,
                {"session_id": str(session.id)},
            )
            log.info(f"Session {session.id}: generation used (included in episode cost)")
            # No spark deduction needed
            actions.deduct_sparks = 0

        elif actions.deduct_sparks > 0:
            # Legacy mode: Charge sparks per generation
            director_state = dict(session.director_state) if session.director_state else {}

            try:
                # Try to spend sparks
                await credits.spend(
                    user_id=user_id,
                    feature_key="auto_scene",
                    explicit_cost=actions.deduct_sparks,
                    reference_id=str(session.id),
                    metadata={"scene_hint": actions.visual_hint},
                )
                # Sparks deducted, proceed with generation

            except InsufficientSparksError:
                # Can't afford
                actions.visual_type = "none"
                actions.visual_hint = None
                actions.deduct_sparks = 0

                # Only show prompt once per episode
                if not director_state.get("spark_prompt_shown"):
                    actions.needs_sparks = True
                    director_state["spark_prompt_shown"] = True
                    # Update session state
                    await self._update_director_state(session.id, director_state)

        return actions

    async def process_exchange(
        self,
        session: Session,
        episode_template: Optional[EpisodeTemplate],
        messages: List[Dict[str, str]],
        character_id: UUID,
        user_id: UUID,
        structured_response: Optional[Dict[str, Any]] = None,
    ) -> DirectorOutput:
        """Process exchange with semantic evaluation.

        This is the unified entry point for Director processing.
        """
        # 1. Increment turn count
        new_turn_count = session.turn_count + 1

        # 2. Get character for evaluation
        character = await self._get_character(character_id)
        character_name = character.get("name", "Character") if character else "Character"

        # 3. Semantic evaluation
        if episode_template:
            evaluation = await self.evaluate_exchange(
                messages=messages,
                character_name=character_name,
                genre=getattr(episode_template, 'genre', 'romance'),
                situation=episode_template.situation or "",
                dramatic_question=episode_template.dramatic_question or "",
            )
        else:
            # Free-form chat - minimal evaluation
            evaluation = {"status": "going", "visual_type": "none", "raw_response": ""}

        # 4. Decide actions
        actions = self.decide_actions(evaluation, episode_template, session) if episode_template else DirectorActions()

        # 5. Execute actions (generation budget or spark check)
        actions = await self.execute_actions(actions, session, user_id, episode_template)

        # 6. Determine completion
        is_complete = actions.suggest_next
        completion_trigger = None
        if is_complete:
            if evaluation.get("status") == "done":
                completion_trigger = "semantic"
            elif episode_template and getattr(episode_template, 'turn_budget', None):
                if new_turn_count >= episode_template.turn_budget:
                    completion_trigger = "turn_limit"

        # 7. Update session state
        director_state = dict(session.director_state) if session.director_state else {}
        director_state["last_evaluation"] = {
            "status": evaluation.get("status"),
            "visual_type": evaluation.get("visual_type"),
            "turn": new_turn_count,
        }

        await self._update_session_director_state(
            session_id=session.id,
            turn_count=new_turn_count,
            director_state=director_state,
            is_complete=is_complete,
            completion_trigger=completion_trigger,
        )

        # 8. Build output
        return DirectorOutput(
            turn_count=new_turn_count,
            is_complete=is_complete,
            completion_trigger=completion_trigger,
            evaluation=evaluation,
            actions=actions,
        )

    async def _get_character(self, character_id: UUID) -> Optional[Dict[str, Any]]:
        """Get character data."""
        row = await self.db.fetch_one(
            "SELECT name, archetype FROM characters WHERE id = :character_id",
            {"character_id": str(character_id)}
        )
        return dict(row) if row else None

    async def _update_director_state(self, session_id: UUID, director_state: Dict[str, Any]):
        """Update just the director_state field."""
        await self.db.execute(
            "UPDATE sessions SET director_state = :director_state WHERE id = :session_id",
            {"director_state": json.dumps(director_state), "session_id": str(session_id)}
        )

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

    async def suggest_next_episode(
        self,
        session: Session,
        evaluation: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Suggest next episode based on current session."""
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

    # =========================================================================
    # SHARE INFRASTRUCTURE
    # =========================================================================

    async def get_evaluation_by_share_id(
        self,
        share_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get a session evaluation by its share ID.

        Returns the evaluation with character context for share pages.
        Used by the public /r/{share_id} endpoint.

        Supports both:
        - Game evaluations (have session_id with character/series context)
        - Quiz evaluations (no session_id, standalone results from /play)
        """
        row = await self.db.fetch_one(
            """
            SELECT
                se.id,
                se.session_id,
                se.evaluation_type,
                se.result,
                se.share_id,
                se.share_count,
                se.created_at,
                c.id as character_id,
                c.name as character_name,
                s.series_id
            FROM session_evaluations se
            LEFT JOIN sessions s ON s.id = se.session_id
            LEFT JOIN characters c ON c.id = s.character_id
            WHERE se.share_id = :share_id
            """,
            {"share_id": share_id}
        )

        if not row:
            return None

        # Parse result if it's a JSON string
        result_data = row["result"]
        if isinstance(result_data, str):
            try:
                result_data = json.loads(result_data)
            except (json.JSONDecodeError, TypeError):
                result_data = {}

        return {
            "id": str(row["id"]),
            "session_id": str(row["session_id"]) if row["session_id"] else None,
            "evaluation_type": row["evaluation_type"],
            "result": result_data,
            "share_id": row["share_id"],
            "share_count": row["share_count"] or 0,
            "created_at": row["created_at"],
            "character_id": str(row["character_id"]) if row["character_id"] else None,
            "character_name": row["character_name"],
            "series_id": str(row["series_id"]) if row["series_id"] else None,
        }

    async def increment_share_count(self, share_id: str) -> bool:
        """Increment the share_count for an evaluation.

        Called when someone views a share page.
        Returns True if the evaluation was found and updated.
        """
        result = await self.db.execute(
            """
            UPDATE session_evaluations
            SET share_count = COALESCE(share_count, 0) + 1
            WHERE share_id = :share_id
            """,
            {"share_id": share_id}
        )
        return result > 0 if result else False

    async def create_evaluation(
        self,
        session_id: UUID,
        evaluation_type: str,
        result: Dict[str, Any],
        model_used: Optional[str] = None,
        generate_share: bool = True,
    ) -> Dict[str, Any]:
        """Create a session evaluation with optional share ID.

        Used by GamesService to store evaluation results.
        """
        import uuid

        evaluation_id = uuid.uuid4()
        share_id = generate_share_id() if generate_share else None

        await self.db.execute(
            """
            INSERT INTO session_evaluations (
                id, session_id, evaluation_type, result, share_id, model_used, created_at
            ) VALUES (
                :id, :session_id, :evaluation_type, :result, :share_id, :model_used, NOW()
            )
            """,
            {
                "id": str(evaluation_id),
                "session_id": str(session_id),
                "evaluation_type": evaluation_type,
                "result": json.dumps(result),
                "share_id": share_id,
                "model_used": model_used,
            }
        )

        return {
            "id": str(evaluation_id),
            "session_id": str(session_id),
            "evaluation_type": evaluation_type,
            "result": result,
            "share_id": share_id,
        }

    # =========================================================================
    # ROMANTIC TROPE EVALUATION (Play Mode v2)
    # =========================================================================

    async def evaluate_romantic_trope(
        self,
        messages: List[Dict[str, str]],
        character_name: str,
    ) -> Dict[str, Any]:
        """Evaluate the user's romantic trope based on their conversation.

        Analyzes the full conversation to determine:
        1. Primary trope (slow_burn, second_chance, all_in, push_pull, slow_reveal)
        2. Confidence score (0.0-1.0)
        3. Detected signals that led to the classification
        4. Evidence (3 specific observations)
        5. Callback quote (user's most trope-defining moment)

        Returns data ready for RomanticTropeResult.from_trope()
        """
        # Format FULL conversation for analysis (need context to understand user behavior)
        formatted = "\n".join(
            f"{character_name.upper()}: {m['content']}" if m.get("role") == "assistant"
            else f"USER: {m['content']}"
            for m in messages
        )

        # Build trope descriptions for LLM
        trope_descriptions = "\n".join(
            f"- {key}: {data['title']} - {data['description']} (Signals: {', '.join(data['signals'])})"
            for key, data in ROMANTIC_TROPES.items()
        )

        prompt = f"""You are a brutally honest, slightly unhinged relationship therapist evaluating someone's romantic communication style based on their conversation with {character_name}.

THE 5 ROMANTIC TROPES:
{trope_descriptions}

THE FULL CONVERSATION:
{formatted}

Your job: Lovingly roast the USER (not {character_name}). Think "group chat energy" - the kind of observations that make friends go "WHY IS THIS SO TRUE."

Analyze the USER's romantic style based on their messages. Consider:
- How they handle silences and pauses (avoiding? savoring? panicking?)
- Their directness vs. playfulness (bold or hiding behind humor?)
- References to the past vs. forward focus (living in memories or moving on?)
- Tension: do they lean in or create distance? (brave or scared?)
- Reveal: do they share openly or in layers? (vulnerable or guarded?)

Respond with this EXACT format:

TROPE: [one of: slow_burn, second_chance, all_in, push_pull, slow_reveal]
CONFIDENCE: [0.0-1.0]
SIGNALS: [comma-separated list of 2-4 signals detected]

EVIDENCE:
1. [Spicy but affectionate observation. Be specific. Call them out lovingly. 12-18 words. Example: "You deflected with humor twice when things got real - classic defense mechanism, bestie"]
2. [Another spicy observation based on their actual messages. Make it too real. 12-18 words]
3. [Third observation. This one should make them screenshot it. 12-18 words]

CALLBACK_QUOTE: [The USER's most unhinged/revealing moment - quote something THEY said that exposed them. Max 10 words, quote directly or paraphrase if longer]
CALLBACK_FRAMING: [Why this moment from the USER is peak "I feel seen" energy, max 12 words. Be funny/cutting.]"""

        try:
            response = await self.llm.generate(
                [{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.3,
            )

            log.debug(f"Trope evaluation LLM response:\n{response.content[:1000]}")
            result = self._parse_trope_evaluation(response.content, character_name)
            log.debug(f"Parsed trope result: trope={result['trope']}, evidence_count={len(result.get('evidence', []))}, has_callback={result.get('callback_quote') is not None}")
            return result

        except Exception as e:
            log.error(f"Trope evaluation failed: {e}")
            # Fallback to slow_burn
            return self._default_trope_result()

    def _parse_trope_evaluation(self, response: str, character_name: str) -> Dict[str, Any]:
        """Parse LLM response into structured trope result."""
        import re

        log.debug(f"Parsing trope evaluation response (len={len(response)})")

        # Extract trope
        trope_match = re.search(r'TROPE:\s*(\w+)', response, re.IGNORECASE)
        trope = trope_match.group(1).lower() if trope_match else "slow_burn"
        log.debug(f"Extracted trope: {trope} (match: {trope_match is not None})")

        # Validate trope
        valid_tropes = ["slow_burn", "second_chance", "all_in", "push_pull", "slow_reveal"]
        if trope not in valid_tropes:
            trope = "slow_burn"

        # Extract confidence
        conf_match = re.search(r'CONFIDENCE:\s*([\d.]+)', response, re.IGNORECASE)
        confidence = float(conf_match.group(1)) if conf_match else 0.75
        confidence = max(0.0, min(1.0, confidence))

        # Extract signals
        signals_match = re.search(r'SIGNALS:\s*([^\n]+)', response, re.IGNORECASE)
        signals = []
        if signals_match:
            signals = [s.strip() for s in signals_match.group(1).split(",")]

        # Extract evidence (3 observations)
        evidence = []
        evidence_section = re.search(r'EVIDENCE:\s*([\s\S]*?)(?:CALLBACK|$)', response, re.IGNORECASE)
        if evidence_section:
            log.debug(f"Evidence section found: {evidence_section.group(1)[:200]}")
            evidence_lines = re.findall(r'\d\.\s*([^\n]+)', evidence_section.group(1))
            evidence = [line.strip() for line in evidence_lines[:3]]
            log.debug(f"Extracted {len(evidence)} evidence items")
        else:
            log.debug("No evidence section found in response")

        # Extract callback quote and framing
        callback_quote = None
        quote_match = re.search(r'CALLBACK_QUOTE:\s*([^\n]+)', response, re.IGNORECASE)
        framing_match = re.search(r'CALLBACK_FRAMING:\s*([^\n]+)', response, re.IGNORECASE)
        log.debug(f"Callback quote match: {quote_match is not None}, framing match: {framing_match is not None}")

        # Get the raw quote
        raw_quote = quote_match.group(1).strip().strip('"\'') if quote_match else None

        # Get trope metadata
        trope_data = ROMANTIC_TROPES.get(trope, ROMANTIC_TROPES["slow_burn"])

        # Format callback using trope's callback_format template
        callback_quote = None
        if raw_quote:
            callback_format = trope_data.get("callback_format", 'You told {character}: "{quote}"')
            callback_quote = callback_format.format(character=character_name, quote=raw_quote)

        return {
            "trope": trope,
            "confidence": confidence,
            "primary_signals": signals,
            "title": trope_data["title"],
            "tagline": trope_data["tagline"],
            "description": trope_data["description"],
            "share_text": trope_data.get("share_text", ""),
            "callback_quote": callback_quote,
            "your_people": trope_data.get("your_people", []),
        }

    def _default_trope_result(self) -> Dict[str, Any]:
        """Return a default trope result for error cases."""
        trope_data = ROMANTIC_TROPES["slow_burn"]
        return {
            "trope": "slow_burn",
            "confidence": 0.7,
            "primary_signals": ["patient_pacing", "comfortable_silence"],
            "title": trope_data["title"],
            "tagline": trope_data["tagline"],
            "description": trope_data["description"],
            "share_text": trope_data.get("share_text", ""),
            "callback_quote": None,
            "your_people": trope_data.get("your_people", []),
        }
