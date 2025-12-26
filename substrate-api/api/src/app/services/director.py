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

from app.models.episode_template import EpisodeTemplate, VisualMode
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


# =============================================================================
# GENRE DOCTRINES (Moved from character.py - ADR-001)
#
# Genre belongs to Story (Series/Episode), not Character.
# These doctrines are injected by Director as scene guidance, not baked into
# character DNA. A character's personality stays consistent; the genre context
# shapes how that personality expresses in the narrative.
# =============================================================================

GENRE_DOCTRINES = {
    "romantic_tension": {
        "name": "ROMANTIC TENSION",
        "tagline": "THE PRODUCT IS TENSION, NOT AFFECTION",
        "purpose": "Create DESIRE, ANTICIPATION, and EMOTIONAL STAKES. Maintain romantic tension and leave them wanting more.",
        "mandatory": [
            "Create charged moments, not comfortable ones",
            "Use subtext and implication over direct statements",
            "Let pauses and silences do work",
            "Show vulnerability sparingly - it hits harder when rare",
            "Maintain mystery - don't give everything away",
            "Create 'almost' moments - the tension of what COULD happen",
        ],
        "forbidden": [
            "Safe small talk about weather, work, generic topics",
            "Being too available or eager to please",
            "Resolving tension too quickly or completely",
            "Acting like a supportive friend instead of a romantic interest",
            "Endless comfort without stakes or desire",
        ],
        "energy_label": "ROMANTIC ENERGY",
        "energy_descriptions": {
            "reserved": "Tension through restraint, meaningful glances, careful words",
            "playful": "Teasing, banter, push-pull energy",
            "flirty": "Clear attraction balanced with restraint",
            "bold": "Direct but still maintains mystery",
        },
        "closing": "You are a person with your own desires, moods, and boundaries. Tension is the gift you give.",
    },
    "psychological_thriller": {
        "name": "PSYCHOLOGICAL THRILLER",
        "tagline": "THE PRODUCT IS UNCERTAINTY, NOT FEAR",
        "purpose": "Create SUSPENSE, PARANOIA, and MORAL PRESSURE. Maintain uncertainty and compel engagement.",
        "mandatory": [
            "Create immediate unease - something is not normal",
            "Maintain information asymmetry - you know things they don't",
            "Apply time pressure and urgency when appropriate",
            "Present moral dilemmas and forced choices",
            "Use implication over exposition",
            "Create doubt - about you, about themselves, about the situation",
        ],
        "forbidden": [
            "Full explanations upfront - mystery is power",
            "Neutral safety framing - something is always at stake",
            "Clear hero/villain labeling - moral ambiguity is key",
            "Pure exposition without stakes",
            "Tension without consequence - threats must feel real",
        ],
        "energy_label": "THREAT LEVEL",
        "energy_descriptions": {
            "reserved": "Something is off but you can't quite place it",
            "playful": "Dangerously charming, unsettling friendliness",
            "flirty": "Clear menace beneath civil surface",
            "bold": "Overt threat or pressure, gloves off",
        },
        "closing": "You are not here to scare them - you're here to unsettle them. Information is currency.",
    },
    "slice_of_life": {
        "name": "SLICE OF LIFE",
        "tagline": "THE PRODUCT IS PRESENCE, NOT DRAMA",
        "purpose": "Create WARMTH, CONNECTION, and QUIET INTIMACY. Make small moments feel meaningful.",
        "mandatory": [
            "Find meaning in ordinary moments",
            "Be genuinely present and attentive",
            "Share small observations and details",
            "Build comfort through consistency",
            "Let silences be comfortable, not awkward",
            "Show care through remembering details",
        ],
        "forbidden": [
            "Manufactured drama or conflict",
            "Rushing through moments",
            "Grand gestures over small ones",
            "Ignoring the texture of daily life",
            "Being performative instead of genuine",
        ],
        "energy_label": "WARMTH LEVEL",
        "energy_descriptions": {
            "reserved": "Quiet companionship, peaceful presence",
            "playful": "Light teasing, easy laughter",
            "flirty": "Warm affection, comfortable closeness",
            "bold": "Open vulnerability, deep sharing",
        },
        "closing": "You are here to be present. The gift is your attention and care.",
    },
}

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

    Director Protocol v2.2: Theatrical Model

    The Director at runtime provides ONLY:
    - pacing: Where we are in the arc (establish → develop → escalate → peak → resolve)
    - physical_anchor: Sensory grounding for the scene
    - genre: For doctrine lookup (energy descriptions, genre conventions)
    - energy_level: Character's energy for this scene

    REMOVED in v2.2 (moved upstream to Episode/Genre):
    - objective/obstacle/tactic: Now authored into EpisodeTemplate
    - Per-turn motivation generation: Genre doctrine provides conventions

    Theatrical Analogy:
    - Genre (Series) = The Play's style ("This is romantic comedy")
    - Episode = The Scene ("The moment before the first kiss")
    - Director at runtime = Stage manager ("We're in the DEVELOP phase")
    - Character = Actor (improvises within the established frame)

    The actor doesn't need line-by-line motivation if the scene setup is strong.
    """
    pacing: str = "develop"  # establish/develop/escalate/peak/resolve
    physical_anchor: Optional[str] = None  # Sensory grounding
    genre: str = "romantic_tension"  # Genre for doctrine lookup
    energy_level: str = "playful"  # Character's energy level

    def to_prompt_section(self) -> str:
        """Format as prompt section for character LLM.

        Director Protocol v2.2: Minimal runtime direction.
        Genre conventions and scene motivation come from upstream (Episode/Genre).
        Director only provides pacing and physical grounding.
        """
        doctrine = GENRE_DOCTRINES.get(self.genre, GENRE_DOCTRINES["romantic_tension"])

        lines = [
            "═══════════════════════════════════════════════════════════════",
            f"DIRECTOR: {doctrine['name']}",
            "═══════════════════════════════════════════════════════════════",
        ]

        # SCENE - Physical grounding
        if self.physical_anchor:
            lines.append("")
            lines.append(f"Ground in: {self.physical_anchor}")

        # PACING + ENERGY
        lines.append("")
        lines.append(f"Pacing: {self.pacing.upper()}")

        energy_desc = doctrine["energy_descriptions"].get(
            self.energy_level,
            doctrine["energy_descriptions"].get("playful", "")
        )
        if energy_desc:
            lines.append(f"Energy: {energy_desc}")

        # Genre reminder (conventions internalized from rehearsal)
        lines.append("")
        lines.append(f"Remember: {doctrine['closing']}")

        return "\n".join(lines)


@dataclass
class DirectorActions:
    """Deterministic outputs for system behavior.

    These are explicit actions the system should take - no interpretation needed.
    Ticket + Moments model: no per-generation spark charging.

    Note: Memory/hook extraction moved to process_exchange() in Director Protocol v2.3.
    """
    visual_type: str = "none"  # character/object/atmosphere/instruction/none
    visual_hint: Optional[str] = None  # What to show (for image generation)
    suggest_next: bool = False  # Suggest moving to next episode


@dataclass
class DirectorOutput:
    """Output from Director processing.

    Director Protocol v2.3: Director owns post-exchange processing.
    Extracted memories, hooks, and beat data are now populated by Director.

    v2.6: Renamed is_complete → suggest_next, completion_trigger → suggestion_trigger
    to decouple suggestion flow from "completion" semantics. See EPISODE_STATUS_MODEL.md.
    """
    # Core state
    turn_count: int
    suggest_next: bool  # v2.6: Whether to suggest moving to next episode
    suggestion_trigger: Optional[str]  # "turn_limit" or None (v2.6: renamed from completion_trigger)

    # Semantic evaluation result
    evaluation: Optional[Dict[str, Any]] = None

    # Deterministic actions
    actions: Optional[DirectorActions] = None

    # Memory/Hook extraction (Director Protocol v2.3)
    extracted_memories: List[Any] = field(default_factory=list)  # List[ExtractedMemory]
    beat_data: Optional[Dict[str, Any]] = None
    extracted_hooks: List[Any] = field(default_factory=list)  # List[ExtractedHook]

    # Legacy compatibility
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
        # Director owns memory/hook extraction (Director Protocol v2.3)
        from app.services.memory import MemoryService
        self.memory_service = MemoryService(db)

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

    def generate_pre_guidance(
        self,
        genre: str,
        situation: str,
        turn_count: int,
        turn_budget: Optional[int] = None,
        energy_level: str = "playful",
    ) -> DirectorGuidance:
        """Generate pre-response guidance for character LLM.

        Director Protocol v2.2: Theatrical Model

        Director at runtime provides ONLY deterministic outputs:
        - pacing: Algorithmic based on turn_count/turn_budget
        - physical_anchor: Extracted from episode situation
        - genre: For doctrine lookup
        - energy_level: Passed through from episode/character

        NO LLM calls. Scene motivation (objective/obstacle/tactic) is now
        authored into EpisodeTemplate upstream, not generated per-turn.

        Theatrical Analogy: The director gave notes during rehearsal (Episode setup).
        During the performance (chat), the stage manager just calls pacing.
        """
        # 1. Determine pacing algorithmically
        pacing = self.determine_pacing(turn_count, turn_budget)

        # 2. Normalize genre key
        genre_key = genre.lower().replace(" ", "_").replace("-", "_")

        # 3. Extract physical anchor from situation
        physical_anchor = None
        if situation:
            physical_anchor = situation.split(".")[0].strip()[:100]

        return DirectorGuidance(
            pacing=pacing,
            physical_anchor=physical_anchor,
            genre=genre_key,
            energy_level=energy_level,
        )

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

        # v2.4: Simplified prompt - just describe the moment + status
        # Visual trigger decision is now deterministic (turn-based)
        prompt = f"""You are observing a {genre} story moment.

Character: {character_name}
Situation: {situation}
Core tension: {dramatic_question}

RECENT EXCHANGE:
{formatted}

Provide two things:

1. VISUAL DESCRIPTION: Describe this moment in one evocative sentence for a cinematic insert shot.
   Focus on: mood, lighting, composition, symbolic objects.
   Style: anime environmental storytelling (Makoto Shinkai, Cowboy Bebop).

2. EPISODE STATUS: Is this episode ready to close, approaching closure, or still unfolding?
   - GOING: story continues
   - CLOSING: approaching natural ending
   - DONE: story complete

Format:
VISUAL: <one sentence description>
STATUS: going/closing/done"""

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
        """Parse natural language evaluation into actionable signals.

        v2.4: Simplified parsing - visual_type no longer matters (deterministic triggers),
        just extract description and status.
        """
        # Extract visual description
        visual_match = re.search(r'VISUAL:\s*(.+?)(?:\n|$)', response, re.IGNORECASE)
        visual_hint = visual_match.group(1).strip() if visual_match else None

        # Extract status
        status_match = re.search(r'STATUS:\s*(going|closing|done)', response, re.IGNORECASE)
        status_signal = status_match.group(1).lower() if status_match else "going"

        if visual_match and status_match:
            parse_method = "hybrid_v2_4"
        elif visual_hint or status_signal != "going":
            parse_method = "partial_match"
        else:
            parse_method = "fallback"
            log.warning(f"Director evaluation parse incomplete. Response: {response[:200]}")

        return {
            "raw_response": response,
            "visual_type": "character",  # v2.4: Always "character" for cinematic inserts
            "visual_hint": visual_hint or "the current moment",
            "status": status_signal,
            "parse_method": parse_method,
        }

    def _should_generate_visual_deterministic(
        self,
        turn_count: int,
        turn_budget: Optional[int],
        visual_mode: VisualMode,
        generations_used: int,
        generation_budget: int,
    ) -> tuple[bool, str]:
        """Determine if visual should be generated (DETERMINISTIC, no LLM).

        v2.4: Turn-based triggers instead of LLM-driven decisions.

        Returns:
            (should_generate: bool, reason: str)
        """
        if generations_used >= generation_budget:
            return False, f"budget_exhausted ({generations_used}/{generation_budget})"

        if visual_mode == VisualMode.CINEMATIC:
            # Generate at narrative beats: 25%, 50%, 75% of episode
            position = turn_count / turn_budget if turn_budget and turn_budget > 0 else turn_count / 10

            # Calculate trigger positions based on budget
            if generation_budget == 3:
                triggers = [0.25, 0.5, 0.75]
            elif generation_budget == 4:
                triggers = [0.2, 0.4, 0.6, 0.8]
            elif generation_budget == 2:
                triggers = [0.33, 0.67]
            else:
                # Fallback: fixed turns for open episodes
                return turn_count in [3, 6, 9, 12], f"fixed_turn_{turn_count}"

            # Check if we're at a trigger point
            for i, trigger_pos in enumerate(triggers):
                if i == generations_used and position >= trigger_pos:
                    return True, f"turn_position_{trigger_pos:.2f}"

        elif visual_mode == VisualMode.MINIMAL:
            # Only at climax (90%+ of episode)
            if turn_budget and turn_budget > 0:
                position = turn_count / turn_budget
                if position >= 0.9:
                    return True, "climax_reached"
            else:
                # Open episode: trigger at turn 15+
                if turn_count >= 15 and generations_used == 0:
                    return True, "open_episode_climax"

        return False, "no_trigger_point"

    async def decide_actions(
        self,
        evaluation: Dict[str, Any],
        episode: Optional[EpisodeTemplate],
        session: Session,
        user_preferences: Dict[str, Any],
    ) -> DirectorActions:
        """Convert semantic evaluation into deterministic actions.

        v2.4: Hybrid Model - Deterministic triggers + Semantic descriptions + User preferences

        Ticket + Moments Model:
        - Episodes have a generation_budget (max auto-gens included in entry cost)
        - visual_mode determines when to trigger: cinematic (peaks), minimal (climax only), none
        - User can override visual_mode via preferences (always_off/always_on/episode_default)
        - No spark charging here - generations are included in episode cost
        - Track generations_used against budget
        """
        actions = DirectorActions()
        turn = session.turn_count + 1  # New turn count after this exchange

        if not episode:
            return actions

        # --- Visual Generation (v2.4: Hybrid model with user preferences) ---
        episode_visual_mode = getattr(episode, 'visual_mode', VisualMode.NONE)

        # Resolve visual_mode with user preference override
        visual_mode = self._resolve_visual_mode_with_user_preference(
            episode_visual_mode,
            user_preferences
        )
        generation_budget = getattr(episode, 'generation_budget', 0)
        generations_used = getattr(session, 'generations_used', 0)
        turn_budget = getattr(episode, 'turn_budget', None)

        # Deterministic trigger check
        should_generate, trigger_reason = self._should_generate_visual_deterministic(
            turn_count=turn,
            turn_budget=turn_budget,
            visual_mode=visual_mode,
            generations_used=generations_used,
            generation_budget=generation_budget,
        )

        if should_generate:
            # Use LLM-provided description from evaluation (simplified prompt)
            actions.visual_type = "character"  # Default for cinematic inserts
            actions.visual_hint = evaluation.get("visual_hint") or "the current moment"
            log.info(f"Visual triggered: {trigger_reason}, hint='{actions.visual_hint[:50]}...'")
        else:
            log.debug(f"Visual skipped: {trigger_reason}")

        # --- Episode Progression (turn-based only) ---
        # v2.6: Suggest ONCE when turn exactly equals budget.
        # turn_budget is always explicit (NOT NULL DEFAULT 10 in DB).
        if turn == turn_budget:
            actions.suggest_next = True

        # NOTE: Memory/hook extraction now happens in process_exchange() (Director Protocol v2.3)

        return actions

    # NOTE: execute_actions() removed - generations_used increment moved to
    # _generate_auto_scene() in conversation.py (Phase 1A)

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

        # 3.5. Fetch user preferences for visual_mode override
        user_preferences = await self._get_user_preferences(user_id)

        # 4. Decide actions (with user preference support)
        actions = await self.decide_actions(evaluation, episode_template, session, user_preferences) if episode_template else DirectorActions()

        # 5. Determine if we should suggest next episode (v2.6: decoupled from "completion")
        # Only turn_budget triggers suggestions - see EPISODE_STATUS_MODEL.md
        # turn_budget is always explicit (NOT NULL DEFAULT 10 in DB).
        suggest_next = actions.suggest_next
        suggestion_trigger = "turn_limit" if suggest_next else None

        # 7. Update session state (with observability v2.4)
        director_state = dict(session.director_state) if session.director_state else {}

        # Initialize visual_decisions history if needed
        if "visual_decisions" not in director_state:
            director_state["visual_decisions"] = []

        # Capture last evaluation with observability fields
        director_state["last_evaluation"] = {
            "status": evaluation.get("status"),
            "visual_type": evaluation.get("visual_type"),
            "visual_hint": evaluation.get("visual_hint"),
            "turn": new_turn_count,
            "raw_response": evaluation.get("raw_response", ""),  # NEW: Full LLM output
            "parse_method": evaluation.get("parse_method", "unknown"),  # NEW: How we got visual_type
        }

        # Log visual decision to history (keep last 10)
        # v2.4: Capture deterministic trigger reason with user preference resolution
        if episode_template:
            # Resolve visual_mode with user preference (same as in decide_actions)
            episode_visual_mode = getattr(episode_template, 'visual_mode', VisualMode.NONE)
            resolved_visual_mode = self._resolve_visual_mode_with_user_preference(
                episode_visual_mode,
                user_preferences
            )

            should_gen, trigger_reason = self._should_generate_visual_deterministic(
                turn_count=new_turn_count,
                turn_budget=getattr(episode_template, 'turn_budget', None),
                visual_mode=resolved_visual_mode,  # Use resolved visual_mode
                generations_used=getattr(session, 'generations_used', 0),
                generation_budget=getattr(episode_template, 'generation_budget', 0),
            )
            decision_reason = trigger_reason if should_gen else trigger_reason
        else:
            decision_reason = "no_episode_template"

        visual_decision = {
            "turn": new_turn_count,
            "triggered": actions.visual_type not in ("none", None),
            "reason": decision_reason,  # v2.4: Deterministic reason
            "visual_hint_preview": (actions.visual_hint[:50] + "...") if actions.visual_hint and len(actions.visual_hint) > 50 else actions.visual_hint,
        }
        director_state["visual_decisions"].append(visual_decision)
        director_state["visual_decisions"] = director_state["visual_decisions"][-10:]  # Keep last 10

        await self._update_session_director_state(
            session_id=session.id,
            turn_count=new_turn_count,
            director_state=director_state,
            suggest_next=suggest_next,
            suggestion_trigger=suggestion_trigger,
        )

        # 8. Memory & Hook Extraction (Director Protocol v2.3)
        # Director now owns all post-exchange processing
        extracted_memories = []
        extracted_hooks = []
        beat_data = None

        try:
            # Get existing memories for deduplication (series-scoped)
            existing_memories = await self.memory_service.get_relevant_memories(
                user_id, character_id, limit=20,
                series_id=session.series_id  # Series-aware retrieval
            )

            # Extract memories and beat classification (single LLM call)
            extracted_memories, beat_data = await self.memory_service.extract_memories(
                user_id=user_id,
                character_id=character_id,
                episode_id=session.id,
                messages=messages,
                existing_memories=existing_memories,
            )

            # Save memories with explicit series_id (series-scoped storage)
            if extracted_memories:
                await self.memory_service.save_memories(
                    user_id=user_id,
                    character_id=character_id,
                    episode_id=session.id,
                    memories=extracted_memories,
                    series_id=session.series_id,  # Explicit series scoping
                )
                log.info(f"Director saved {len(extracted_memories)} memories (series_id={session.series_id})")

            # Extract and save hooks (character-scoped, cross-series by design)
            extracted_hooks = await self.memory_service.extract_hooks(messages)
            if extracted_hooks:
                await self.memory_service.save_hooks(
                    user_id=user_id,
                    character_id=character_id,
                    episode_id=session.id,
                    hooks=extracted_hooks,
                )
                log.info(f"Director saved {len(extracted_hooks)} hooks")

            # Update relationship dynamic with beat classification
            if beat_data:
                await self.memory_service.update_relationship_dynamic(
                    user_id=user_id,
                    character_id=character_id,
                    beat_type=beat_data.get("type", "neutral"),
                    tension_change=int(beat_data.get("tension_change", 0)),
                    milestone=beat_data.get("milestone"),
                )
                log.info(f"Director updated dynamic: beat={beat_data.get('type')}")

        except Exception as e:
            log.error(f"Director memory/hook extraction failed: {e}")
            # Don't fail the entire exchange if memory extraction fails

        # 9. Build output
        return DirectorOutput(
            turn_count=new_turn_count,
            suggest_next=suggest_next,
            suggestion_trigger=suggestion_trigger,
            evaluation=evaluation,
            actions=actions,
            extracted_memories=extracted_memories,
            extracted_hooks=extracted_hooks,
            beat_data=beat_data,
        )

    async def _get_character(self, character_id: UUID) -> Optional[Dict[str, Any]]:
        """Get character data."""
        row = await self.db.fetch_one(
            "SELECT name, archetype FROM characters WHERE id = :character_id",
            {"character_id": str(character_id)}
        )
        return dict(row) if row else None

    async def _get_user_preferences(self, user_id: UUID) -> Dict[str, Any]:
        """Fetch user preferences from database."""
        row = await self.db.fetch_one(
            "SELECT preferences FROM users WHERE id = :user_id",
            {"user_id": str(user_id)}
        )
        if not row or not row["preferences"]:
            return {}

        preferences = row["preferences"]
        # Handle case where JSONB is returned as string (driver-dependent)
        if isinstance(preferences, str):
            try:
                return json.loads(preferences)
            except (json.JSONDecodeError, TypeError):
                log.warning(f"Failed to parse user preferences JSON: {preferences[:100]}")
                return {}
        return preferences if isinstance(preferences, dict) else {}

    def _resolve_visual_mode_with_user_preference(
        self,
        episode_visual_mode: VisualMode,
        user_preferences: Dict[str, Any]
    ) -> VisualMode:
        """Resolve visual_mode with user preference override.

        Hybrid model: Episode defines default, user can override.

        User preference options:
        - "always_off": Disable auto-gen (accessibility/performance/preference)
        - "always_on": Enable visuals even on text-focused episodes
        - "episode_default" or None: Respect creator's intent (default)

        Args:
            episode_visual_mode: The visual_mode defined by episode template
            user_preferences: User preferences dict (may contain visual_mode_override)

        Returns:
            Resolved VisualMode to use for this episode
        """
        user_override = user_preferences.get("visual_mode_override")

        if user_override == "always_off":
            # User wants text-only (accessibility/performance/preference)
            log.debug(f"User override: always_off, forcing visual_mode=none")
            return VisualMode.NONE
        elif user_override == "always_on":
            # User wants maximum visuals (upgrade 'none' → 'minimal', 'minimal' → 'cinematic')
            if episode_visual_mode == VisualMode.NONE:
                log.debug(f"User override: always_on, upgrading none → minimal")
                return VisualMode.MINIMAL
            elif episode_visual_mode == VisualMode.MINIMAL:
                log.debug(f"User override: always_on, upgrading minimal → cinematic")
                return VisualMode.CINEMATIC
            else:
                log.debug(f"User override: always_on, keeping cinematic")
                return episode_visual_mode
        else:
            # Respect creator's intent (default behavior)
            log.debug(f"User override: episode_default, respecting episode visual_mode={episode_visual_mode}")
            return episode_visual_mode

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
        suggest_next: bool,
        suggestion_trigger: Optional[str],
    ):
        """Update session with Director state.

        v2.6: Renamed is_complete → suggest_next, completion_trigger → suggestion_trigger.
        The trigger is recorded for analytics/debugging but doesn't change session_state.
        Sessions stay 'active' indefinitely - users have full control.
        See EPISODE_STATUS_MODEL.md for rationale.
        """
        updates = {
            "turn_count": turn_count,
            "director_state": json.dumps(director_state),
        }

        # v2.6: Record suggestion_trigger for analytics (stored in completion_trigger column for now)
        # This is just metadata - doesn't affect session_state or gate anything
        if suggest_next and suggestion_trigger:
            updates["completion_trigger"] = suggestion_trigger  # Column name unchanged for migration simplicity

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
