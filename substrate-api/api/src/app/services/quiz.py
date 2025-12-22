"""Quiz Service - LLM-based evaluation for static quizzes.

This service handles evaluation of static multiple-choice quizzes
using LLM for personalized, engaging results.

Supports:
- romantic_trope: "What's Your Red Flag?" quiz
- freak_level: "How Freaky Are You?" quiz
"""

import json
import logging
import re
from typing import Any, Dict, List
from uuid import uuid4

from app.models.evaluation import (
    EvaluationType,
    ROMANTIC_TROPES,
    generate_share_id,
)
from app.services.llm import LLMService

log = logging.getLogger(__name__)


# Freak Level types for the new quiz
FREAK_LEVELS = {
    "vanilla": {
        "title": "VANILLA BEAN",
        "tagline": "you like what you like and that's valid",
        "description": "You're classic, comfortable, and confident in your preferences. While others are out here doing the most, you know that sometimes the original flavor hits different. You've perfected the basics and honestly? That's a skill. Not everyone can make simple feel this good.",
        "emoji": "🍦",
        "color": "text-amber-100",
        "share_text": "I'm VANILLA BEAN — classic never goes out of style. How freaky are you?",
    },
    "spicy": {
        "title": "SPICY CURIOUS",
        "tagline": "one foot in comfort, one foot in chaos",
        "description": "You're not vanilla, but you're not fully unhinged either. You like to keep things interesting without going off the deep end. You'll try something new if the vibe is right, but you also appreciate a good classic. The perfect blend of adventurous and sensible.",
        "emoji": "🌶️",
        "color": "text-orange-400",
        "share_text": "I'm SPICY CURIOUS — adventurous with a safety net. How freaky are you?",
    },
    "unhinged": {
        "title": "CASUALLY UNHINGED",
        "tagline": "you've seen things. you've done things.",
        "description": "Your browser history would make your therapist take notes. You've got stories you'll only tell after the third drink. You're not trying to shock anyone — this is just how you're wired. Normal is a setting on a washing machine, and you don't do laundry.",
        "emoji": "🔥",
        "color": "text-red-500",
        "share_text": "I'm CASUALLY UNHINGED — my therapist takes notes. How freaky are you?",
    },
    "feral": {
        "title": "ABSOLUTELY FERAL",
        "tagline": "you are the intrusive thought",
        "description": "You don't have intrusive thoughts — you ARE the intrusive thought. Your friends come to you for advice they're too scared to Google. You've probably been banned from something. You exist in a space beyond judgment, and honestly? We respect it.",
        "emoji": "👹",
        "color": "text-purple-500",
        "share_text": "I'm ABSOLUTELY FERAL — I AM the intrusive thought. How freaky are you?",
    },
    "menace": {
        "title": "CERTIFIED MENACE",
        "tagline": "the devil takes notes from you",
        "description": "You're not just freaky — you're a lifestyle. Your energy could power a small city. When you walk into a room, the vibe shifts permanently. You've transcended categories entirely. At this point, you're not participating in the quiz, the quiz is studying you.",
        "emoji": "😈",
        "color": "text-fuchsia-600",
        "share_text": "I'm a CERTIFIED MENACE — the devil takes notes from me. How freaky are you?",
    },
}


class QuizService:
    """Service for evaluating static quizzes with LLM."""

    def __init__(self, db):
        self.db = db
        self.llm = LLMService.get_instance()

    async def evaluate_quiz(
        self,
        quiz_type: str,
        answers: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Evaluate quiz answers and return personalized result.

        Args:
            quiz_type: Type of quiz ("romantic_trope" or "freak_level")
            answers: List of QuizAnswer dicts with question_id, question_text,
                    selected_answer, selected_trope

        Returns:
            Dict with evaluation_type, result, and share_id
        """
        if quiz_type == "romantic_trope":
            return await self._evaluate_romantic_trope(answers)
        elif quiz_type == "freak_level":
            return await self._evaluate_freak_level(answers)
        else:
            raise ValueError(f"Unknown quiz type: {quiz_type}")

    async def _evaluate_romantic_trope(
        self,
        answers: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Evaluate romantic trope quiz with LLM personalization."""
        # Format answers for LLM
        formatted_answers = "\n".join(
            f"Q: {a['question_text']}\nA: {a['selected_answer']} (→ {a['selected_trope']})"
            for a in answers
        )

        # Count trope scores
        trope_scores = {}
        for a in answers:
            trope = a["selected_trope"]
            trope_scores[trope] = trope_scores.get(trope, 0) + 1

        # Build trope descriptions
        trope_descriptions = "\n".join(
            f"- {key}: {data['title']} - {data['tagline']}"
            for key, data in ROMANTIC_TROPES.items()
        )

        prompt = f"""You're a brutally honest, slightly unhinged relationship therapist evaluating someone's romantic style based on their quiz answers.

THE 5 ROMANTIC TROPES:
{trope_descriptions}

THEIR ANSWERS:
{formatted_answers}

CURRENT SCORES: {json.dumps(trope_scores)}

Your job: Lovingly roast them. Think "group chat energy" - the kind of observations that make friends go "WHY IS THIS SO TRUE."

Analyze their pattern and pick the BEST matching trope (even if there's a tie, commit to one based on the vibe of their answers).

Consider:
- The overall pattern, not just raw scores
- Which answers were most revealing
- What their choices say about their romantic psychology

Respond with this EXACT format:

TROPE: [one of: slow_burn, second_chance, all_in, push_pull, slow_reveal]
CONFIDENCE: [0.7-0.95]

EVIDENCE:
1. [Spicy observation about their answer pattern. Be specific. Call them out lovingly. 12-18 words]
2. [Another observation. Make it too real. 12-18 words]
3. [Third observation. This one should make them screenshot it. 12-18 words]

VIBE_CHECK: [One devastating sentence that captures their whole romantic energy. Make it quotable. 15-25 words]"""

        try:
            response = await self.llm.generate(
                [{"role": "user", "content": prompt}],
                max_tokens=400,
                temperature=0.7,
            )

            result = self._parse_romantic_trope_result(response.content)

            # Save to database and get share_id
            share_id = await self._save_evaluation(
                evaluation_type="romantic_trope",
                result=result,
            )

            return {
                "evaluation_type": "romantic_trope",
                "result": result,
                "share_id": share_id,
            }

        except Exception as e:
            log.error(f"Romantic trope evaluation failed: {e}")
            # Fallback: use simple scoring
            return await self._fallback_romantic_trope(trope_scores)

    def _parse_romantic_trope_result(self, response: str) -> Dict[str, Any]:
        """Parse LLM response for romantic trope quiz."""
        # Extract trope
        trope_match = re.search(r'TROPE:\s*(\w+)', response, re.IGNORECASE)
        trope = trope_match.group(1).lower() if trope_match else "slow_burn"

        # Validate trope
        valid_tropes = list(ROMANTIC_TROPES.keys())
        if trope not in valid_tropes:
            trope = "slow_burn"

        # Extract confidence
        conf_match = re.search(r'CONFIDENCE:\s*([\d.]+)', response, re.IGNORECASE)
        confidence = float(conf_match.group(1)) if conf_match else 0.8
        confidence = max(0.0, min(1.0, confidence))

        # Extract evidence
        evidence = []
        evidence_section = re.search(r'EVIDENCE:\s*([\s\S]*?)(?:VIBE_CHECK|$)', response, re.IGNORECASE)
        if evidence_section:
            evidence_lines = re.findall(r'\d\.\s*([^\n]+)', evidence_section.group(1))
            evidence = [line.strip() for line in evidence_lines[:3]]

        # Extract vibe check
        vibe_match = re.search(r'VIBE_CHECK:\s*([^\n]+)', response, re.IGNORECASE)
        vibe_check = vibe_match.group(1).strip() if vibe_match else None

        # Get trope metadata
        trope_data = ROMANTIC_TROPES.get(trope, ROMANTIC_TROPES["slow_burn"])

        return {
            "trope": trope,
            "confidence": confidence,
            "title": trope_data["title"],
            "tagline": trope_data["tagline"],
            "description": trope_data["description"],
            "share_text": trope_data.get("share_text", ""),
            "evidence": evidence,
            "vibe_check": vibe_check,
            "your_people": trope_data.get("your_people", []),
        }

    async def _fallback_romantic_trope(
        self,
        trope_scores: Dict[str, int],
    ) -> Dict[str, Any]:
        """Fallback evaluation when LLM fails."""
        # Find highest scoring trope
        if not trope_scores:
            trope = "slow_burn"
        else:
            trope = max(trope_scores, key=trope_scores.get)

        trope_data = ROMANTIC_TROPES.get(trope, ROMANTIC_TROPES["slow_burn"])

        result = {
            "trope": trope,
            "confidence": 0.75,
            "title": trope_data["title"],
            "tagline": trope_data["tagline"],
            "description": trope_data["description"],
            "share_text": trope_data.get("share_text", ""),
            "evidence": [],
            "vibe_check": None,
            "your_people": trope_data.get("your_people", []),
        }

        share_id = await self._save_evaluation(
            evaluation_type="romantic_trope",
            result=result,
        )

        return {
            "evaluation_type": "romantic_trope",
            "result": result,
            "share_id": share_id,
        }

    async def _evaluate_freak_level(
        self,
        answers: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Evaluate freak level quiz with LLM personalization."""
        # Format answers for LLM
        formatted_answers = "\n".join(
            f"Q: {a['question_text']}\nA: {a['selected_answer']} (→ {a['selected_trope']})"
            for a in answers
        )

        # Count level scores
        level_scores = {}
        for a in answers:
            level = a["selected_trope"]
            level_scores[level] = level_scores.get(level, 0) + 1

        # Build level descriptions
        level_descriptions = "\n".join(
            f"- {key}: {data['title']} - {data['tagline']}"
            for key, data in FREAK_LEVELS.items()
        )

        prompt = f"""You're a chaotic bestie who's way too honest, evaluating someone's "freak level" based on their quiz answers.

THE 5 FREAK LEVELS (from mild to wild):
{level_descriptions}

THEIR ANSWERS:
{formatted_answers}

CURRENT SCORES: {json.dumps(level_scores)}

Your job: Read them for filth (lovingly). This should feel like a group chat roast that's painfully accurate.

Analyze their pattern and pick the BEST matching level. Commit to one based on the overall vibe.

Respond with this EXACT format:

LEVEL: [one of: vanilla, spicy, unhinged, feral, menace]
CONFIDENCE: [0.7-0.95]

EVIDENCE:
1. [Call out a specific pattern in their answers. Be unhinged but accurate. 12-18 words]
2. [Another observation that hits too close to home. 12-18 words]
3. [The devastating closer. Make them screenshot this. 12-18 words]

VIBE_CHECK: [One absolutely unhinged sentence summarizing their energy. Maximum chaos. 15-25 words]"""

        try:
            response = await self.llm.generate(
                [{"role": "user", "content": prompt}],
                max_tokens=400,
                temperature=0.8,
            )

            result = self._parse_freak_level_result(response.content)

            # Save to database and get share_id
            share_id = await self._save_evaluation(
                evaluation_type="freak_level",
                result=result,
            )

            return {
                "evaluation_type": "freak_level",
                "result": result,
                "share_id": share_id,
            }

        except Exception as e:
            log.error(f"Freak level evaluation failed: {e}")
            # Fallback: use simple scoring
            return await self._fallback_freak_level(level_scores)

    def _parse_freak_level_result(self, response: str) -> Dict[str, Any]:
        """Parse LLM response for freak level quiz."""
        # Extract level
        level_match = re.search(r'LEVEL:\s*(\w+)', response, re.IGNORECASE)
        level = level_match.group(1).lower() if level_match else "spicy"

        # Validate level
        valid_levels = list(FREAK_LEVELS.keys())
        if level not in valid_levels:
            level = "spicy"

        # Extract confidence
        conf_match = re.search(r'CONFIDENCE:\s*([\d.]+)', response, re.IGNORECASE)
        confidence = float(conf_match.group(1)) if conf_match else 0.8
        confidence = max(0.0, min(1.0, confidence))

        # Extract evidence
        evidence = []
        evidence_section = re.search(r'EVIDENCE:\s*([\s\S]*?)(?:VIBE_CHECK|$)', response, re.IGNORECASE)
        if evidence_section:
            evidence_lines = re.findall(r'\d\.\s*([^\n]+)', evidence_section.group(1))
            evidence = [line.strip() for line in evidence_lines[:3]]

        # Extract vibe check
        vibe_match = re.search(r'VIBE_CHECK:\s*([^\n]+)', response, re.IGNORECASE)
        vibe_check = vibe_match.group(1).strip() if vibe_match else None

        # Get level metadata
        level_data = FREAK_LEVELS.get(level, FREAK_LEVELS["spicy"])

        return {
            "level": level,
            "confidence": confidence,
            "title": level_data["title"],
            "tagline": level_data["tagline"],
            "description": level_data["description"],
            "emoji": level_data["emoji"],
            "color": level_data["color"],
            "share_text": level_data.get("share_text", ""),
            "evidence": evidence,
            "vibe_check": vibe_check,
        }

    async def _fallback_freak_level(
        self,
        level_scores: Dict[str, int],
    ) -> Dict[str, Any]:
        """Fallback evaluation when LLM fails."""
        # Find highest scoring level
        if not level_scores:
            level = "spicy"
        else:
            level = max(level_scores, key=level_scores.get)

        level_data = FREAK_LEVELS.get(level, FREAK_LEVELS["spicy"])

        result = {
            "level": level,
            "confidence": 0.75,
            "title": level_data["title"],
            "tagline": level_data["tagline"],
            "description": level_data["description"],
            "emoji": level_data["emoji"],
            "color": level_data["color"],
            "share_text": level_data.get("share_text", ""),
            "evidence": [],
            "vibe_check": None,
        }

        share_id = await self._save_evaluation(
            evaluation_type="freak_level",
            result=result,
        )

        return {
            "evaluation_type": "freak_level",
            "result": result,
            "share_id": share_id,
        }

    async def _save_evaluation(
        self,
        evaluation_type: str,
        result: Dict[str, Any],
    ) -> str:
        """Save evaluation to database and return share_id.

        Quiz evaluations don't have sessions - they're standalone results
        from the static quiz flow in /play. session_id is NULL for these.
        """
        evaluation_id = uuid4()
        share_id = generate_share_id()

        try:
            await self.db.execute(
                """
                INSERT INTO session_evaluations (
                    id, session_id, evaluation_type, result, share_id, created_at
                ) VALUES (
                    :id, NULL, :evaluation_type, :result, :share_id, NOW()
                )
                """,
                {
                    "id": str(evaluation_id),
                    "evaluation_type": evaluation_type,
                    "result": json.dumps(result),
                    "share_id": share_id,
                }
            )
        except Exception as e:
            log.error(f"Failed to save evaluation: {e}")
            # Still return a share_id even if save fails
            # (result will work in current session, just won't persist)

        return share_id
