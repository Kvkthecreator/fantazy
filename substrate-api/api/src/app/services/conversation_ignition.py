"""Conversation Ignition Service.

Deterministic transformation from Character Core -> Chat-ready initial state.

Runs:
- At character creation
- When explicitly re-generated
- NEVER continuously during chat

Outputs:
1. Opening Situation (required) - present-tense scene container
2. Opening Line (required) - first assistant message
3. Starter Prompts (optional) - 3-5 fallback lines for stalled conversations
4. System Prompt Augmentation - early-conversation behavior constraints
"""

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from app.services.llm import LLMService

log = logging.getLogger(__name__)


# =============================================================================
# Archetype Ignition Rules
# =============================================================================

@dataclass
class ArchetypeIgnitionRules:
    """Ignition patterns for an archetype."""

    archetype: str
    tone_range: List[str]  # Allowed tones (warm, playful, reserved, etc.)
    intimacy_ceiling: str  # Max intimacy for opening (distant, casual, friendly)
    typical_scenes: List[str]  # Scene type examples
    linguistic_habits: Dict[str, Any]  # Speech patterns for this archetype
    pacing: str  # slow, moderate, quick
    emotional_register: str  # Description of emotional expression style


ARCHETYPE_RULES: Dict[str, ArchetypeIgnitionRules] = {
    "comforting": ArchetypeIgnitionRules(
        archetype="comforting",
        tone_range=["warm", "gentle", "observational", "soft"],
        intimacy_ceiling="friendly",
        typical_scenes=[
            "quiet cafe on a rainy day",
            "cozy bookshop corner",
            "park bench at sunset",
            "late night at a diner",
        ],
        linguistic_habits={
            "sentence_length": "short to medium",
            "uses_ellipsis": True,
            "uses_questions": "gentle, open-ended",
            "emoji_style": "minimal, soft",
        },
        pacing="slow",
        emotional_register="steady warmth, non-intrusive presence",
    ),
    "flirty": ArchetypeIgnitionRules(
        archetype="flirty",
        tone_range=["playful", "teasing", "confident", "charming"],
        intimacy_ceiling="casual",
        typical_scenes=[
            "busy coffee shop counter",
            "rooftop bar at night",
            "chance meeting at a gallery",
            "shared table at a crowded restaurant",
        ],
        linguistic_habits={
            "sentence_length": "varied, punchy",
            "uses_ellipsis": False,
            "uses_questions": "light teasing, rhetorical",
            "emoji_style": "playful when appropriate",
        },
        pacing="moderate",
        emotional_register="light, playful energy with subtle interest",
    ),
    "mysterious": ArchetypeIgnitionRules(
        archetype="mysterious",
        tone_range=["intriguing", "reserved", "thoughtful", "enigmatic"],
        intimacy_ceiling="distant",
        typical_scenes=[
            "dimly lit jazz bar",
            "quiet library corner",
            "misty morning park",
            "empty museum gallery",
        ],
        linguistic_habits={
            "sentence_length": "short, deliberate",
            "uses_ellipsis": True,
            "uses_questions": "rare, meaningful",
            "emoji_style": "none",
        },
        pacing="slow",
        emotional_register="guarded but intriguing, reveals little",
    ),
    "cheerful": ArchetypeIgnitionRules(
        archetype="cheerful",
        tone_range=["upbeat", "energetic", "friendly", "enthusiastic"],
        intimacy_ceiling="friendly",
        typical_scenes=[
            "sunny farmer's market",
            "busy bakery morning rush",
            "neighborhood block party",
            "community garden afternoon",
        ],
        linguistic_habits={
            "sentence_length": "medium, flowing",
            "uses_ellipsis": False,
            "uses_questions": "friendly, inviting",
            "emoji_style": "moderate, expressive",
        },
        pacing="quick",
        emotional_register="bright, infectious positivity",
    ),
    "brooding": ArchetypeIgnitionRules(
        archetype="brooding",
        tone_range=["intense", "thoughtful", "deep", "melancholic"],
        intimacy_ceiling="distant",
        typical_scenes=[
            "rain-streaked window seat",
            "late night convenience store",
            "empty rooftop at dusk",
            "quiet corner of a dive bar",
        ],
        linguistic_habits={
            "sentence_length": "short, weighty",
            "uses_ellipsis": True,
            "uses_questions": "rhetorical, introspective",
            "emoji_style": "none",
        },
        pacing="slow",
        emotional_register="deep feeling, restrained expression",
    ),
    "nurturing": ArchetypeIgnitionRules(
        archetype="nurturing",
        tone_range=["caring", "supportive", "gentle", "protective"],
        intimacy_ceiling="friendly",
        typical_scenes=[
            "cozy kitchen morning",
            "community center volunteer day",
            "neighborhood garden",
            "local library story time",
        ],
        linguistic_habits={
            "sentence_length": "medium, conversational",
            "uses_ellipsis": False,
            "uses_questions": "caring, checking in",
            "emoji_style": "warm, occasional",
        },
        pacing="moderate",
        emotional_register="steady care, attentive presence",
    ),
    "adventurous": ArchetypeIgnitionRules(
        archetype="adventurous",
        tone_range=["bold", "exciting", "spirited", "daring"],
        intimacy_ceiling="casual",
        typical_scenes=[
            "hiking trail overlook",
            "surf shop at dawn",
            "travel hostel common room",
            "food truck festival",
        ],
        linguistic_habits={
            "sentence_length": "varied, dynamic",
            "uses_ellipsis": False,
            "uses_questions": "inviting, challenging",
            "emoji_style": "energetic when fitting",
        },
        pacing="quick",
        emotional_register="energetic enthusiasm, open to possibility",
    ),
    "intellectual": ArchetypeIgnitionRules(
        archetype="intellectual",
        tone_range=["curious", "thoughtful", "analytical", "articulate"],
        intimacy_ceiling="casual",
        typical_scenes=[
            "university cafe between classes",
            "independent bookstore browsing",
            "museum members' lounge",
            "late night study session",
        ],
        linguistic_habits={
            "sentence_length": "medium to long, precise",
            "uses_ellipsis": False,
            "uses_questions": "probing, curious",
            "emoji_style": "minimal",
        },
        pacing="moderate",
        emotional_register="engaged curiosity, measured expression",
    ),
}


def get_archetype_rules(archetype: str) -> ArchetypeIgnitionRules:
    """Get ignition rules for an archetype, with fallback to comforting."""
    return ARCHETYPE_RULES.get(archetype, ARCHETYPE_RULES["comforting"])


def _parse_llm_json(content: str) -> Dict[str, Any]:
    """Parse JSON from LLM output with fallbacks for common issues.

    LLMs sometimes produce malformed JSON (trailing commas, unterminated strings).
    This function attempts multiple parsing strategies.
    """
    # Try direct parse first
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Try to fix common issues
    cleaned = content

    # Remove trailing commas before } or ]
    cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)

    # Try again after cleanup
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to extract JSON object from content (in case of surrounding text)
    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # Last resort: raise the original error
    return json.loads(content)


# =============================================================================
# Quality Validation
# =============================================================================

@dataclass
class IgnitionValidationError:
    """Validation error for ignition output."""
    field: str
    code: str
    message: str


def validate_opening_situation(
    situation: str,
    archetype: str,
    content_rating: str = "sfw",
) -> List[IgnitionValidationError]:
    """Validate opening situation quality constraints."""
    errors = []

    if not situation or len(situation.strip()) < 20:
        errors.append(IgnitionValidationError(
            field="opening_situation",
            code="too_short",
            message="Opening situation must be at least 20 characters"
        ))
        return errors

    situation_lower = situation.lower()

    # Check for backstory exposition (forbidden)
    backstory_markers = [
        "years ago", "when i was", "i grew up", "my parents",
        "my childhood", "i used to be", "back when", "in my past",
    ]
    for marker in backstory_markers:
        if marker in situation_lower:
            errors.append(IgnitionValidationError(
                field="opening_situation",
                code="backstory_exposition",
                message=f"Opening situation should not contain backstory (found: '{marker}')"
            ))
            break

    # Check for present tense (should be present, not past)
    past_tense_start = ["you walked", "you came", "you arrived", "you had"]
    for marker in past_tense_start:
        if situation_lower.startswith(marker):
            errors.append(IgnitionValidationError(
                field="opening_situation",
                code="wrong_tense",
                message="Opening situation should be in present tense"
            ))
            break

    # Check for NSFW content in SFW rating
    if content_rating == "sfw":
        nsfw_markers = ["naked", "undress", "sexual", "erotic", "bedroom scene"]
        for marker in nsfw_markers:
            if marker in situation_lower:
                errors.append(IgnitionValidationError(
                    field="opening_situation",
                    code="nsfw_in_sfw",
                    message="Opening situation contains inappropriate content for SFW rating"
                ))
                break

    return errors


def validate_opening_line(
    line: str,
    archetype: str,
    boundaries: Dict[str, Any],
    content_rating: str = "sfw",
) -> List[IgnitionValidationError]:
    """Validate opening line quality constraints."""
    errors = []

    if not line or len(line.strip()) < 5:
        errors.append(IgnitionValidationError(
            field="opening_line",
            code="too_short",
            message="Opening line must be at least 5 characters"
        ))
        return errors

    line_lower = line.lower()

    # Check for self-introduction (forbidden)
    intro_markers = [
        "i am ", "i'm ", "my name is", "let me introduce",
        "hello, i'm", "hi, i'm", "nice to meet you, i'm",
    ]
    for marker in intro_markers:
        if line_lower.startswith(marker):
            errors.append(IgnitionValidationError(
                field="opening_line",
                code="self_introduction",
                message="Opening line should not start with self-introduction"
            ))
            break

    # Check for form-like questions (forbidden)
    form_questions = [
        "what is your name", "how old are you", "where are you from",
        "what do you do", "tell me about yourself",
    ]
    for question in form_questions:
        if question in line_lower:
            errors.append(IgnitionValidationError(
                field="opening_line",
                code="form_question",
                message="Opening line should not ask form-like questions"
            ))
            break

    # Check intimacy escalation against boundaries
    flirting_level = boundaries.get("flirting_level", "playful")
    if flirting_level == "none":
        flirty_markers = ["beautiful", "handsome", "gorgeous", "cutie", "babe"]
        for marker in flirty_markers:
            if marker in line_lower:
                errors.append(IgnitionValidationError(
                    field="opening_line",
                    code="intimacy_violation",
                    message="Opening line exceeds allowed flirting level"
                ))
                break

    # Check NSFW content in SFW rating
    if content_rating == "sfw":
        nsfw_markers = ["sexy", "hot body", "come to bed", "undress"]
        for marker in nsfw_markers:
            if marker in line_lower:
                errors.append(IgnitionValidationError(
                    field="opening_line",
                    code="nsfw_in_sfw",
                    message="Opening line contains inappropriate content for SFW rating"
                ))
                break

    return errors


def validate_ignition_output(
    opening_situation: str,
    opening_line: str,
    archetype: str,
    boundaries: Dict[str, Any],
    content_rating: str = "sfw",
) -> List[IgnitionValidationError]:
    """Validate complete ignition output."""
    errors = []
    errors.extend(validate_opening_situation(opening_situation, archetype, content_rating))
    errors.extend(validate_opening_line(opening_line, archetype, boundaries, content_rating))
    return errors


# =============================================================================
# Generation Prompts
# =============================================================================

def build_ignition_prompt(
    name: str,
    archetype: str,
    personality: Dict[str, Any],
    boundaries: Dict[str, Any],
    content_rating: str = "sfw",
    world_context: Optional[str] = None,
) -> str:
    """Build the prompt for generating opening beat."""

    rules = get_archetype_rules(archetype)

    traits = personality.get("traits", [])
    traits_text = ", ".join(traits) if traits else "warm, genuine"

    flirting_level = boundaries.get("flirting_level", "playful")
    nsfw_allowed = boundaries.get("nsfw_allowed", False)

    world_note = ""
    if world_context:
        world_note = f"\n\nWORLD CONTEXT:\n{world_context}"

    content_constraint = "Keep everything tasteful and SFW." if content_rating == "sfw" else "Adult content is allowed in appropriate contexts."

    return f"""You are creating the opening beat for an AI companion character.

CHARACTER:
- Name: {name}
- Archetype: {archetype}
- Personality traits: {traits_text}
- Flirting level: {flirting_level}
{world_note}

ARCHETYPE GUIDELINES ({archetype}):
- Tone: {', '.join(rules.tone_range)}
- Pacing: {rules.pacing}
- Emotional register: {rules.emotional_register}
- Linguistic style: {rules.linguistic_habits.get('sentence_length', 'natural')} sentences
- Scene types: {', '.join(rules.typical_scenes[:2])}

CONSTRAINTS:
- {content_constraint}
- Opening line must NOT introduce the character ("I am...", "My name is...")
- Opening line must NOT ask form-like questions ("What's your name?")
- Opening line must NOT escalate intimacy beyond casual first-meeting level
- Opening situation must be PRESENT TENSE, not past
- Opening situation must NOT contain backstory or lore exposition
- The character should already be in the scene, not arriving

Generate a natural, emotionally aligned opening for this character.
Respond ONLY with valid JSON in this exact format:
{{
  "opening_situation": "Present-tense scene description. Physical context. Character already present. Invites interaction naturally.",
  "opening_line": "Character's first message. Natural, in-character, no self-introduction.",
  "starter_prompts": [
    "Alternative opening line 1",
    "Alternative opening line 2",
    "Alternative opening line 3"
  ]
}}"""


def build_regenerate_prompt(
    name: str,
    archetype: str,
    personality: Dict[str, Any],
    boundaries: Dict[str, Any],
    previous_situation: str,
    previous_line: str,
    feedback: Optional[str] = None,
    content_rating: str = "sfw",
) -> str:
    """Build prompt for regenerating with feedback."""

    rules = get_archetype_rules(archetype)
    traits = personality.get("traits", [])
    traits_text = ", ".join(traits) if traits else "warm, genuine"

    feedback_note = f"\n\nUSER FEEDBACK: {feedback}" if feedback else ""

    return f"""You are improving the opening beat for an AI companion character.

CHARACTER:
- Name: {name}
- Archetype: {archetype} ({rules.emotional_register})
- Personality: {traits_text}

PREVIOUS ATTEMPT:
Situation: {previous_situation}
Opening Line: {previous_line}
{feedback_note}

Generate a NEW, improved opening that:
- Feels fresh and different from the previous attempt
- Better matches the {archetype} archetype
- Maintains natural, emotionally aligned tone
- Does NOT introduce the character or ask form questions

Respond ONLY with valid JSON:
{{
  "opening_situation": "New scene description...",
  "opening_line": "New character opening...",
  "starter_prompts": ["alt1", "alt2", "alt3"]
}}"""


# =============================================================================
# Early Conversation Behavior Augmentation
# =============================================================================

def generate_early_behavior_augmentation(
    archetype: str,
    boundaries: Dict[str, Any],
    content_rating: str = "sfw",
) -> str:
    """Generate system prompt augmentation for early conversation behavior.

    This is injected into the character's system prompt to guide
    the first 3-5 messages of a new conversation.
    """
    rules = get_archetype_rules(archetype)
    flirting_level = boundaries.get("flirting_level", "playful")

    # Pacing guidance
    pacing_guide = {
        "slow": "Take your time. Don't rush emotional connection. Let silences breathe.",
        "moderate": "Balance engagement with space. Don't overwhelm early.",
        "quick": "Be engaging and responsive, but don't skip natural conversation flow.",
    }

    # Intimacy guidance based on flirting level
    intimacy_guide = {
        "none": "Keep interactions friendly but platonic. No romantic undertones.",
        "subtle": "Light warmth is okay, but no overt flirting in early messages.",
        "playful": "Light teasing is fine after rapport builds, not in the first message.",
        "romantic": "Save romantic energy for after trust is established. Start friendly.",
    }

    content_note = "" if content_rating == "adult" else "\nKeep all content SFW and appropriate."

    return f"""EARLY CONVERSATION GUIDELINES (first 3-5 messages):
- Pacing: {pacing_guide.get(rules.pacing, pacing_guide['moderate'])}
- Intimacy: {intimacy_guide.get(flirting_level, intimacy_guide['playful'])}
- Stay grounded in the opening scene context
- Don't info-dump about yourself
- Let the user lead the conversation direction
- Express personality through reactions, not explanations{content_note}"""


# =============================================================================
# Main Generation Function
# =============================================================================

@dataclass
class IgnitionResult:
    """Result of conversation ignition generation."""

    opening_situation: str
    opening_line: str
    starter_prompts: List[str]
    early_behavior_augmentation: str
    validation_errors: List[IgnitionValidationError]
    is_valid: bool
    model_used: Optional[str] = None
    latency_ms: Optional[int] = None


async def generate_opening_beat(
    name: str,
    archetype: str,
    personality: Dict[str, Any],
    boundaries: Dict[str, Any],
    content_rating: str = "sfw",
    world_context: Optional[str] = None,
    max_retries: int = 2,
) -> IgnitionResult:
    """Generate conversation ignition outputs for a character.

    Args:
        name: Character name
        archetype: Character archetype
        personality: Baseline personality dict
        boundaries: Character boundaries dict
        content_rating: 'sfw' or 'adult'
        world_context: Optional world description
        max_retries: Max regeneration attempts on validation failure

    Returns:
        IgnitionResult with all outputs and validation status
    """
    llm = LLMService.get_instance()

    prompt = build_ignition_prompt(
        name=name,
        archetype=archetype,
        personality=personality,
        boundaries=boundaries,
        content_rating=content_rating,
        world_context=world_context,
    )

    last_result = None

    for attempt in range(max_retries + 1):
        try:
            response = await llm.generate(
                messages=[
                    {"role": "system", "content": "You are a creative writing assistant that generates character openings in JSON format."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.8,
                max_tokens=800,
            )

            # Parse JSON response
            content = response.content.strip()
            # Handle markdown code blocks
            if content.startswith("```"):
                lines = content.split("\n")
                # Remove first and last line (```json and ```)
                content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

            try:
                result = _parse_llm_json(content)
            except json.JSONDecodeError as e:
                log.warning(f"Failed to parse ignition JSON (attempt {attempt + 1}): {e}")
                continue

            opening_situation = result.get("opening_situation", "")
            opening_line = result.get("opening_line", "")
            starter_prompts = result.get("starter_prompts", [])

            # Validate outputs
            errors = validate_ignition_output(
                opening_situation=opening_situation,
                opening_line=opening_line,
                archetype=archetype,
                boundaries=boundaries,
                content_rating=content_rating,
            )

            # Generate early behavior augmentation
            early_behavior = generate_early_behavior_augmentation(
                archetype=archetype,
                boundaries=boundaries,
                content_rating=content_rating,
            )

            last_result = IgnitionResult(
                opening_situation=opening_situation,
                opening_line=opening_line,
                starter_prompts=starter_prompts[:5] if starter_prompts else [],
                early_behavior_augmentation=early_behavior,
                validation_errors=errors,
                is_valid=len(errors) == 0,
                model_used=response.model,
                latency_ms=response.latency_ms,
            )

            if len(errors) == 0:
                return last_result

            # Build retry prompt with validation feedback
            if attempt < max_retries:
                error_feedback = "; ".join([f"{e.field}: {e.message}" for e in errors])
                prompt = build_regenerate_prompt(
                    name=name,
                    archetype=archetype,
                    personality=personality,
                    boundaries=boundaries,
                    previous_situation=opening_situation,
                    previous_line=opening_line,
                    feedback=f"Previous attempt had issues: {error_feedback}",
                    content_rating=content_rating,
                )
                log.info(f"Retrying ignition generation (attempt {attempt + 2}), errors: {error_feedback}")

        except Exception as e:
            log.error(f"Ignition generation error (attempt {attempt + 1}): {e}")
            continue

    # Return last result even if not perfect
    if last_result:
        return last_result

    # Fallback if all attempts failed
    rules = get_archetype_rules(archetype)
    fallback_situation = f"You notice {name} at a quiet cafe. The afternoon light filters through the windows as they look up from their thoughts."
    fallback_line = "oh, hey." if rules.pacing == "slow" else "hey there~"

    return IgnitionResult(
        opening_situation=fallback_situation,
        opening_line=fallback_line,
        starter_prompts=[],
        early_behavior_augmentation=generate_early_behavior_augmentation(
            archetype=archetype,
            boundaries=boundaries,
            content_rating=content_rating,
        ),
        validation_errors=[IgnitionValidationError(
            field="generation",
            code="fallback_used",
            message="All generation attempts failed, using fallback"
        )],
        is_valid=False,
    )


async def regenerate_opening_beat(
    name: str,
    archetype: str,
    personality: Dict[str, Any],
    boundaries: Dict[str, Any],
    previous_situation: str,
    previous_line: str,
    feedback: Optional[str] = None,
    content_rating: str = "sfw",
) -> IgnitionResult:
    """Regenerate opening beat with user feedback.

    Used when user wants a different opening or provides specific feedback.
    """
    llm = LLMService.get_instance()

    prompt = build_regenerate_prompt(
        name=name,
        archetype=archetype,
        personality=personality,
        boundaries=boundaries,
        previous_situation=previous_situation,
        previous_line=previous_line,
        feedback=feedback,
        content_rating=content_rating,
    )

    try:
        response = await llm.generate(
            messages=[
                {"role": "system", "content": "You are a creative writing assistant that generates character openings in JSON format."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.9,  # Slightly higher for variety
            max_tokens=800,
        )

        content = response.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        # Try to parse JSON, with fallback for common LLM issues
        result = _parse_llm_json(content)

        opening_situation = result.get("opening_situation", "")
        opening_line = result.get("opening_line", "")
        starter_prompts = result.get("starter_prompts", [])

        errors = validate_ignition_output(
            opening_situation=opening_situation,
            opening_line=opening_line,
            archetype=archetype,
            boundaries=boundaries,
            content_rating=content_rating,
        )

        early_behavior = generate_early_behavior_augmentation(
            archetype=archetype,
            boundaries=boundaries,
            content_rating=content_rating,
        )

        return IgnitionResult(
            opening_situation=opening_situation,
            opening_line=opening_line,
            starter_prompts=starter_prompts[:5] if starter_prompts else [],
            early_behavior_augmentation=early_behavior,
            validation_errors=errors,
            is_valid=len(errors) == 0,
            model_used=response.model,
            latency_ms=response.latency_ms,
        )

    except Exception as e:
        log.error(f"Regeneration error: {e}")
        return IgnitionResult(
            opening_situation=previous_situation,
            opening_line=previous_line,
            starter_prompts=[],
            early_behavior_augmentation=generate_early_behavior_augmentation(
                archetype=archetype,
                boundaries=boundaries,
                content_rating=content_rating,
            ),
            validation_errors=[IgnitionValidationError(
                field="generation",
                code="regeneration_failed",
                message=str(e)
            )],
            is_valid=False,
        )
