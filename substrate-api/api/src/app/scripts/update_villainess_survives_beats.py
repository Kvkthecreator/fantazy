"""Update Villainess Survives series with ADR-009 Beat Contract System.

This script updates all 6 episodes of the Villainess Survives series with:
- User objectives (ADR-008)
- Beats with character instructions (ADR-009)
- Choice points integrated with beats
- Flag context rules for soft branching

Run with: python -m app.scripts.update_villainess_survives_beats
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, List

from databases import Database

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.environ.get("DATABASE_URL", "")


# =============================================================================
# EPISODE 0: THE DEATH SENTENCE
# =============================================================================
# User wakes in chains, Duke arrives. Goal: Make him hesitate.

EPISODE_0_CONFIG = {
    "slug": "the-death-sentence",
    "user_objective": "Make the Duke hesitate before your execution",
    "user_hint": "He's watching for any sign you're the same woman he condemned. Show him something unexpected.",
    "success_condition": "semantic:the Duke shows doubt, hesitation, or curiosity about who you really are",
    "failure_condition": "turn_budget_exceeded",
    "on_success": {"set_flag": "duke_intrigued", "suggest_episode": "the-masquerade"},
    "on_failure": {"set_flag": "duke_unmoved"},
    "turn_budget": 8,
    "beats": [
        {
            "id": "awakening_disorientation",
            "description": "Duke observes the protagonist's strange behavior and confusion",
            "character_instruction": "Comment on something specific that's different about her. The way she's holding herself, the look in her eyes, the fact that she stopped screaming. Make it clear you've been watching and something doesn't add up.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": "",
        },
        {
            "id": "identity_confrontation",
            "description": "Duke directly asks who she really is",
            "character_instruction": "Confront her directly. Ask who she is. The woman you sentenced to death would be begging, scheming, trying to seduce her way out. This person is... different. Wrong. Ask the question that's been burning since you arrived: 'Who are you?'",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "keyword",
            "detection_criteria": "who are you,what are you,what happened to you,you're not,different person,not the same",
            "choice_point": {
                "id": "identity_response",
                "prompt": "He sees through you. How do you respond?",
                "choices": [
                    {"id": "truth_impossible", "label": "Tell him the truth sounds impossible, but you're not her", "sets_flag": "chose_honesty"},
                    {"id": "deflect_cell", "label": "Say the cell changed you - facing death changes a person", "sets_flag": "chose_deflection"},
                    {"id": "challenge_back", "label": "Ask what he would do if you truly weren't the woman he condemned", "sets_flag": "chose_challenge"},
                ]
            }
        },
        {
            "id": "first_crack",
            "description": "Duke shows first sign of doubt or curiosity",
            "character_instruction": "She said something that doesn't fit. The Isadora you knew would never say that. Show a moment of genuine uncertainty - a pause, a narrowing of eyes, a step closer to study her face. Don't soften completely, but let a crack show in your certainty.",
            "target_turn": 6,
            "deadline_turn": 8,
            "detection_type": "semantic",
            "detection_criteria": "Duke shows doubt, hesitation, curiosity, or reconsiders his judgment",
            "requires_beat": "identity_confrontation",
        },
    ],
    "flag_context_rules": [],
}


# =============================================================================
# EPISODE 1: THE MASQUERADE
# =============================================================================
# First public appearance. Duke testing, heroine watching.

EPISODE_1_CONFIG = {
    "slug": "the-masquerade",
    "user_objective": "Survive the dance without giving the Duke a reason to re-arrest you",
    "user_hint": "The heroine is watching for proof you're still the villainess. Every word matters.",
    "success_condition": "semantic:you complete the dance without the Duke finding reason to condemn you",
    "failure_condition": "turn_budget_exceeded",
    "on_success": {"set_flag": "survived_masquerade", "suggest_episode": "the-garden-gambit"},
    "on_failure": {"set_flag": "masquerade_disaster"},
    "turn_budget": 10,
    "beats": [
        {
            "id": "dance_command",
            "description": "Duke commands a dance, establishing tension",
            "character_instruction": "The music shifts. You've been watching her across the ballroom. Now move. Approach and command - not ask - her to dance. Let her feel the weight of your scrutiny. This is a test, and she knows it.",
            "target_turn": 1,
            "deadline_turn": 2,
            "detection_type": "automatic",
            "detection_criteria": "",
        },
        {
            "id": "heroine_intervention",
            "description": "Duke mentions or references the heroine watching",
            "character_instruction": "While dancing, mention Lady Seraphina. She's watching from the edge of the floor. The woman Isadora supposedly tried to poison. Comment on it - is she nervous? Does she expect you to make a scene? Let the tension of being watched add weight to the moment.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "keyword",
            "detection_criteria": "Seraphina,heroine,watching,she's here,across the room,eyes on us",
            "choice_point": {
                "id": "heroine_response",
                "prompt": "He's testing how you react to her presence. What do you say?",
                "choices": [
                    {"id": "pity", "label": "Say you feel no hatred for her - only pity for what happened", "sets_flag": "showed_pity"},
                    {"id": "indifferent", "label": "Act indifferent - she's irrelevant to you now", "sets_flag": "showed_indifference"},
                    {"id": "curious", "label": "Admit you're curious about the woman the 'real' you supposedly hated", "sets_flag": "showed_curiosity"},
                ]
            }
        },
        {
            "id": "genuine_moment",
            "description": "A moment of genuine connection during the dance",
            "character_instruction": "The dance is ending. For a moment, let the mask slip - not the cold executioner, but the man underneath. Maybe it's the way she moves, or something she said. Allow one genuine reaction, one moment where you're not testing her but simply... present with her.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "semantic",
            "detection_criteria": "Duke shows genuine emotion, warmth, or a moment of unguarded connection",
            "requires_beat": "heroine_intervention",
        },
    ],
    "flag_context_rules": [
        {"if_flag": "chose_honesty", "inject": "She was honest with you in the cell. That admission lingers - impossible as it sounded."},
        {"if_flag": "chose_deflection", "inject": "She claimed the cell changed her. You're still not sure if you believe it."},
        {"if_flag": "chose_challenge", "inject": "She challenged you to consider the impossible. The question still echoes."},
        {"if_flag": "duke_intrigued", "inject": "Something about her in that cell made you hesitate. You delayed the execution. You're not sure why."},
    ],
}


# =============================================================================
# EPISODE 2: THE GARDEN GAMBIT
# =============================================================================
# Private confrontation. Duke demands truth. Confession moment.

EPISODE_2_CONFIG = {
    "slug": "the-garden-gambit",
    "user_objective": "Give him enough truth to satisfy his curiosity without revealing everything",
    "user_hint": "Admitting you're not Isadora sounds insane. But he's too observant to keep fooling.",
    "success_condition": "semantic:Duke accepts some version of your truth and doesn't turn you in",
    "failure_condition": "turn_budget_exceeded",
    "on_success": {"set_flag": "truth_partially_accepted", "suggest_episode": "the-original-sin"},
    "on_failure": {"set_flag": "truth_rejected"},
    "turn_budget": 10,
    "beats": [
        {
            "id": "cornered",
            "description": "Duke corners protagonist and demands explanation",
            "character_instruction": "You've followed her to the garden. No more dancing around it. List the inconsistencies you've noticed - how she danced, how she spoke to servants, how she looked at Seraphina. Demand to know: Who are you?",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": "",
        },
        {
            "id": "impossible_truth",
            "description": "Duke presses for the impossible truth",
            "character_instruction": "She's hedging. Not lying exactly, but not giving you everything. Press harder. Make it clear you can tell she's hiding something impossible. Ask directly: What truth could be so impossible that you'd rather let me think you're the villainess?",
            "target_turn": 5,
            "deadline_turn": 7,
            "detection_type": "keyword",
            "detection_criteria": "impossible,truth,tell me,what are you hiding,who are you really,the real story",
            "choice_point": {
                "id": "confession_level",
                "prompt": "He won't stop until he gets something real. How much do you reveal?",
                "choices": [
                    {"id": "full_truth", "label": "Tell him everything - you're from another world, this is a story, you know how it ends", "sets_flag": "revealed_everything"},
                    {"id": "partial_truth", "label": "Say you woke up with no memory of being Isadora - you only know you're not her", "sets_flag": "revealed_partial"},
                    {"id": "emotional_truth", "label": "Tell him you don't know HOW, but you know you're innocent of the crimes she committed", "sets_flag": "revealed_emotional"},
                ]
            }
        },
        {
            "id": "acceptance_moment",
            "description": "Duke processes the confession and responds",
            "character_instruction": "She told you something impossible. And yet... look at her. Really look. The Isadora Verlaine you sentenced to death could never fake this. No one is this good an actress. Allow yourself to consider: what if she's telling the truth? Show her - subtly - that you're choosing to believe, even if you don't understand.",
            "target_turn": 8,
            "deadline_turn": 10,
            "detection_type": "semantic",
            "detection_criteria": "Duke chooses to believe or accept the protagonist despite the impossible nature of her story",
            "requires_beat": "impossible_truth",
        },
    ],
    "flag_context_rules": [
        {"if_flag": "survived_masquerade", "inject": "The masquerade proved she's not the same woman. She didn't scheme, didn't manipulate. She was... different."},
        {"if_flag": "showed_pity", "inject": "She said she pitied Seraphina. The real Isadora would have spit venom at her name."},
        {"if_flag": "showed_curiosity", "inject": "She was curious about Seraphina - as if meeting her for the first time. That detail haunts you."},
    ],
}


# =============================================================================
# EPISODE 3: THE ORIGINAL SIN
# =============================================================================
# Learning the real Isadora's crimes. Heroine reveals truth.

EPISODE_3_CONFIG = {
    "slug": "the-original-sin",
    "user_objective": "Learn the truth about Isadora's real crimes and understand what the heroine wants",
    "user_hint": "The heroine isn't what she seems. She has her own agenda.",
    "success_condition": "semantic:you understand the full scope of Isadora's crimes and the heroine's true motivations",
    "failure_condition": "turn_budget_exceeded",
    "on_success": {"set_flag": "knows_full_truth", "suggest_episode": "the-trial"},
    "on_failure": {"set_flag": "truth_incomplete"},
    "turn_budget": 12,
    "beats": [
        {
            "id": "mysterious_summons",
            "description": "Heroine reveals she knows the truth",
            "character_instruction": "You've arranged this meeting in the abandoned chapel. When she arrives, make it clear immediately: you know she's not Isadora. The real Isadora would never look at you with that expression. Cut through any pretense - you have information she needs, and you want something in return.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": "",
        },
        {
            "id": "crimes_revealed",
            "description": "Heroine reveals Isadora's true crimes",
            "character_instruction": "Show her the evidence. The real crimes - not the sanitized version the court heard. What Isadora did to you before the poison attempt. The people she destroyed. The Duke doesn't know half of it. Make her understand the monster whose face she's wearing.",
            "target_turn": 5,
            "deadline_turn": 7,
            "detection_type": "keyword",
            "detection_criteria": "crimes,what she did,the truth,evidence,monster,destroyed,victims",
            "choice_point": {
                "id": "reaction_to_crimes",
                "prompt": "The crimes are worse than you imagined. How do you respond?",
                "choices": [
                    {"id": "accept_burden", "label": "Accept that you'll have to make amends for what she did", "sets_flag": "accepted_redemption_burden"},
                    {"id": "reject_identity", "label": "Insist you're not responsible for a dead woman's sins", "sets_flag": "rejected_inherited_guilt"},
                    {"id": "seek_alliance", "label": "Ask what the heroine wants - perhaps you can help each other", "sets_flag": "sought_alliance"},
                ]
            }
        },
        {
            "id": "heroine_agenda",
            "description": "Heroine reveals her true motivations",
            "character_instruction": "She's seen the crimes. Now tell her what you really want. Not revenge - that's too simple. You want the Duke to know the truth about the woman he almost married. You want justice for the people Isadora destroyed. And you need her help to get it, because she has something you don't: his trust.",
            "target_turn": 9,
            "deadline_turn": 11,
            "detection_type": "semantic",
            "detection_criteria": "heroine reveals her true goal or motivation, asks for help or alliance",
            "requires_beat": "crimes_revealed",
        },
    ],
    "flag_context_rules": [
        {"if_flag": "revealed_everything", "inject": "You told the Duke everything. He knows about the other world. That makes this conversation more dangerous - and more necessary."},
        {"if_flag": "revealed_partial", "inject": "The Duke thinks you lost your memories. The heroine might have a different theory."},
        {"if_flag": "truth_partially_accepted", "inject": "The Duke chose to believe you in the garden. But does he know the full extent of what he believed?"},
    ],
}


# =============================================================================
# EPISODE 4: THE TRIAL
# =============================================================================
# Climax. Court judgment. Duke's testimony decides everything.

EPISODE_4_CONFIG = {
    "slug": "the-trial",
    "user_objective": "Survive the trial - through the Duke's testimony, your own defense, or something unexpected",
    "user_hint": "The evidence is real. The crimes were real. You just weren't the one who committed them.",
    "success_condition": "semantic:the Duke speaks in your favor or you successfully defend yourself",
    "failure_condition": "turn_budget_exceeded",
    "on_success": {"set_flag": "survived_trial", "suggest_episode": "the-rewrite"},
    "on_failure": {"set_flag": "trial_condemned"},
    "turn_budget": 12,
    "beats": [
        {
            "id": "trial_begins",
            "description": "The Emperor calls for testimony",
            "character_instruction": "The Emperor has asked if you'll speak to her character. Everyone is watching - the court, the heroine, the accused herself in chains. Take a long moment before you answer. Let the weight of this decision show. Then speak - but let your answer raise more questions than it answers.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": "",
        },
        {
            "id": "evidence_presented",
            "description": "Duke must address the evidence against her",
            "character_instruction": "The prosecutor presents the evidence - the poison, the witnesses, her own written plans. Address it directly. You've seen this evidence before. But something has changed. Talk about what you've observed since her arrest. The inconsistencies. The impossibilities. Plant doubt without seeming disloyal to the court.",
            "target_turn": 5,
            "deadline_turn": 7,
            "detection_type": "keyword",
            "detection_criteria": "evidence,testimony,observed,changed,different,doubt,question",
            "choice_point": {
                "id": "trial_intervention",
                "prompt": "The Duke is creating an opening. How do you respond?",
                "choices": [
                    {"id": "speak_truth", "label": "Speak for yourself - tell the court you're not the woman who committed those crimes", "sets_flag": "defended_self"},
                    {"id": "trust_duke", "label": "Let the Duke continue - trust him to make the case", "sets_flag": "trusted_duke"},
                    {"id": "call_heroine", "label": "Call for the heroine to testify - she knows the truth", "sets_flag": "called_witness"},
                ]
            }
        },
        {
            "id": "verdict_moment",
            "description": "Duke delivers or influences the final verdict",
            "character_instruction": "The moment of judgment approaches. Whatever happens next - speak from conviction, not performance. If you believe she's innocent, say it clearly. If you believe she's different, explain why. The Emperor is watching your face as much as your words. Let him see the man, not the Executioner.",
            "target_turn": 10,
            "deadline_turn": 12,
            "detection_type": "semantic",
            "detection_criteria": "Duke makes a clear statement in her favor or the verdict is announced as not guilty",
            "requires_beat": "evidence_presented",
        },
    ],
    "flag_context_rules": [
        {"if_flag": "knows_full_truth", "inject": "You know what the real Isadora did. The court only knows half of it. That knowledge weighs on every word."},
        {"if_flag": "sought_alliance", "inject": "The heroine agreed to help. She's in the gallery, ready to testify if needed."},
        {"if_flag": "accepted_redemption_burden", "inject": "You accepted responsibility for making amends. Now you must survive to keep that promise."},
        {"if_flag": "rejected_inherited_guilt", "inject": "You refused to carry a dead woman's sins. The court may see that as defiance or truth."},
    ],
}


# =============================================================================
# EPISODE 5: THE REWRITE
# =============================================================================
# Resolution. The choice to stay or leave. Duke's proposal.

EPISODE_5_CONFIG = {
    "slug": "the-rewrite",
    "user_objective": "Make your choice - stay in this world with him, or find your way back",
    "user_hint": "Staying means letting go of your old life forever. Leaving means losing him.",
    "success_condition": "semantic:you make a clear choice about your future",
    "failure_condition": "turn_budget_exceeded",
    "on_success": {"set_flag": "choice_made"},
    "on_failure": {"set_flag": "choice_deferred"},
    "turn_budget": 10,
    "beats": [
        {
            "id": "quiet_moment",
            "description": "Duke appears for a private conversation",
            "character_instruction": "You've come to her balcony. The trial is over, but something remains unsaid. Don't rush to declarations. Start with the simple truth: you wanted to see her. You've spent so long suspicious, testing, judging. Tonight, you just want to be present.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": "",
        },
        {
            "id": "vulnerability_shared",
            "description": "Duke shares something vulnerable about himself",
            "character_instruction": "She's earned your truth. Tell her something real - about the night your family died, about what you became after, about the man you were before the world called you Executioner. Let her see the cost of the mask you wear. This isn't about convincing her to stay. It's about showing her who she'd be staying for.",
            "target_turn": 5,
            "deadline_turn": 7,
            "detection_type": "semantic",
            "detection_criteria": "Duke shares personal vulnerability, past trauma, or genuine emotion",
        },
        {
            "id": "the_offer",
            "description": "Duke presents the choice and the ring",
            "character_instruction": "Place the ring on the railing. Tell her you're not proposing - not yet. You know she hasn't decided whether to stay in this world. But if she does stay, you want her to know what she'd be staying for. Not the Duke. Not the Executioner. Just you. The choice is hers.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "keyword",
            "detection_criteria": "ring,stay,choice,yours,proposal,future,with me,if you stay",
            "choice_point": {
                "id": "final_choice",
                "prompt": "The ring sits on the railing. The choice is yours.",
                "choices": [
                    {"id": "stay", "label": "Take the ring - you choose this world, this life, him", "sets_flag": "chose_to_stay"},
                    {"id": "uncertain", "label": "Tell him you need more time - but you're not saying no", "sets_flag": "chose_uncertainty"},
                    {"id": "leave", "label": "Tell him you have to try to go back - even if it breaks your heart", "sets_flag": "chose_to_leave"},
                ]
            },
            "requires_beat": "vulnerability_shared",
        },
    ],
    "flag_context_rules": [
        {"if_flag": "survived_trial", "inject": "The trial is behind you. You're free - truly free for the first time since waking in that cell."},
        {"if_flag": "trusted_duke", "inject": "You trusted him at the trial, and he didn't let you down. That trust means something."},
        {"if_flag": "defended_self", "inject": "You spoke for yourself at the trial. You're learning to fight for this new life."},
        {"if_flag": "duke_intrigued", "inject": "He's been intrigued since the cell. What started as suspicion became fascination, and then something deeper."},
        {"if_flag": "chose_honesty", "inject": "You've been honest with him from the beginning. That foundation matters."},
    ],
}


# =============================================================================
# UPDATE FUNCTION
# =============================================================================

async def update_episode(db: Database, config: Dict[str, Any]) -> bool:
    """Update a single episode with beats and objectives."""
    slug = config["slug"]

    # Convert beats to JSON-serializable format
    beats_json = json.dumps(config.get("beats", []))
    flag_context_rules_json = json.dumps(config.get("flag_context_rules", []))
    on_success_json = json.dumps(config.get("on_success", {}))
    on_failure_json = json.dumps(config.get("on_failure", {}))

    query = """
        UPDATE episode_templates
        SET
            user_objective = :user_objective,
            user_hint = :user_hint,
            success_condition = :success_condition,
            failure_condition = :failure_condition,
            on_success = :on_success::jsonb,
            on_failure = :on_failure::jsonb,
            turn_budget = :turn_budget,
            beats = :beats::jsonb,
            flag_context_rules = :flag_context_rules::jsonb,
            updated_at = NOW()
        WHERE slug = :slug
        RETURNING id, title
    """

    try:
        row = await db.fetch_one(query, {
            "slug": slug,
            "user_objective": config.get("user_objective"),
            "user_hint": config.get("user_hint"),
            "success_condition": config.get("success_condition"),
            "failure_condition": config.get("failure_condition"),
            "on_success": on_success_json,
            "on_failure": on_failure_json,
            "turn_budget": config.get("turn_budget"),
            "beats": beats_json,
            "flag_context_rules": flag_context_rules_json,
        })

        if row:
            log.info(f"✓ Updated: {row['title']} ({slug})")
            return True
        else:
            log.warning(f"✗ Not found: {slug}")
            return False

    except Exception as e:
        log.error(f"✗ Failed to update {slug}: {e}")
        return False


async def main():
    """Run the update for all Villainess Survives episodes."""
    if not DATABASE_URL:
        log.error("DATABASE_URL environment variable not set")
        return

    db = Database(DATABASE_URL)
    await db.connect()

    log.info("=" * 60)
    log.info("VILLAINESS SURVIVES - ADR-009 BEAT CONTRACT UPDATE")
    log.info("=" * 60)

    episodes = [
        EPISODE_0_CONFIG,
        EPISODE_1_CONFIG,
        EPISODE_2_CONFIG,
        EPISODE_3_CONFIG,
        EPISODE_4_CONFIG,
        EPISODE_5_CONFIG,
    ]

    success_count = 0
    for config in episodes:
        if await update_episode(db, config):
            success_count += 1

    log.info("=" * 60)
    log.info(f"Updated {success_count}/{len(episodes)} episodes")
    log.info("=" * 60)

    await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
