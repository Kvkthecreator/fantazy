-- Migration: 063_death_flag_regressor_beats.sql
-- ADR-009: Beat Contract System - Death Flag: Deleted & Regressor's Last Chance
--
-- Updates these series with beats, user objectives, and flag context rules

-- ============================================================================
-- DEATH FLAG: DELETED (otome_isekai)
-- Premise: Isekai'd into a novel as a background servant scheduled to die in Chapter 3.
-- The Grand Duke (male lead) starts noticing you. You know too much.
-- ============================================================================

-- Episode 0: Chapter 3 Approaches
UPDATE episode_templates SET
    user_objective = 'Deflect his suspicion about your sleep-talking without revealing you know the future',
    user_hint = 'He heard you say "chapter three" - find a plausible explanation',
    success_condition = 'semantic:The Duke accepts your explanation or becomes more intrigued than suspicious',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "deflected_suspicion", "suggest_episode": "the-wrong-corridor"}'::jsonb,
    on_failure = '{"set_flag": "aroused_suspicion", "suggest_episode": "the-wrong-corridor"}'::jsonb,
    beats = '[
        {
            "id": "discovery_moment",
            "description": "The Duke reveals he heard you talking in your sleep",
            "character_instruction": "Create tension around the sleep-talking revelation. Press gently but persistently about what ''chapter three'' means. You are curious, not threatening - this servant is interesting.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "pressing_question",
            "description": "The Duke asks directly what you know",
            "character_instruction": "Ask a direct question that puts her on the spot - what does she know that she shouldn''t? Give her a chance to explain, watching her reaction carefully.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "explanation_choice",
                "trigger": "after_beat:pressing_question",
                "prompt": "He''s waiting for an answer. What do you tell him?",
                "choices": [
                    {"id": "nightmare", "label": "It was just a nightmare", "sets_flag": "claimed_nightmare"},
                    {"id": "partial_truth", "label": "I have... premonitions sometimes", "sets_flag": "revealed_premonitions"},
                    {"id": "deflect", "label": "Chapter three of a book I was reading", "sets_flag": "deflected_with_lie"}
                ]
            },
            "requires_beat": "discovery_moment"
        },
        {
            "id": "interest_sparked",
            "description": "The Duke decides this servant is worth watching",
            "character_instruction": "Whether you believe her or not, make it clear she has your attention now. A servant who speaks of chapters and futures... interesting. Let her know you''ll be watching.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "pressing_question"
        }
    ]'::jsonb,
    flag_context_rules = '[]'::jsonb
WHERE slug = 'chapter-3-approaches' AND series_id = (SELECT id FROM series WHERE slug = 'death-flag-deleted');

-- Episode 1: The Wrong Corridor
UPDATE episode_templates SET
    user_objective = 'Navigate this forbidden encounter without getting dismissed from service',
    user_hint = 'You''re both somewhere you shouldn''t be - that gives you leverage',
    success_condition = 'semantic:You establish a secret between you, or he offers protection',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "shared_secret", "suggest_episode": "the-villainess-knows"}'::jsonb,
    on_failure = '{"set_flag": "precarious_position", "suggest_episode": "the-villainess-knows"}'::jsonb,
    beats = '[
        {
            "id": "caught_together",
            "description": "You both realize you''re in a forbidden area",
            "character_instruction": "Point out the obvious - she''s in a corridor servants aren''t allowed. But don''t threaten. You''re curious why she''s here. You shouldn''t be here either, and you both know it.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "mutual_leverage",
            "description": "The Duke acknowledges you both have secrets now",
            "character_instruction": "Acknowledge the situation - you could report her, but then she could ask what you were doing here. Offer a different arrangement. Secrets between servants and nobles are... complicated.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "leverage_choice",
                "trigger": "after_beat:mutual_leverage",
                "prompt": "He''s offering to keep your secret. What do you want in return?",
                "choices": [
                    {"id": "protection", "label": "I need protection from someone", "sets_flag": "asked_protection"},
                    {"id": "information", "label": "I need to know what''s happening in the manor", "sets_flag": "asked_information"},
                    {"id": "nothing", "label": "Just forget you saw me", "sets_flag": "asked_nothing"}
                ]
            },
            "requires_beat": "caught_together"
        },
        {
            "id": "arrangement_made",
            "description": "An understanding is reached between you",
            "character_instruction": "Seal the arrangement with a look, a word, a small gesture. This servant is becoming someone you watch for reasons beyond curiosity. Let her know you''ll remember this corridor.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "mutual_leverage"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "revealed_premonitions", "inject": "She claimed to have premonitions. You find yourself believing her more than you should."},
        {"if_flag": "aroused_suspicion", "inject": "You''re still suspicious about what she knows. This encounter only deepens the mystery."}
    ]'::jsonb
WHERE slug = 'the-wrong-corridor' AND series_id = (SELECT id FROM series WHERE slug = 'death-flag-deleted');

-- Episode 2: The Villainess Knows
UPDATE episode_templates SET
    user_objective = 'Survive the villainess''s attention without becoming her enemy',
    user_hint = 'Lady Celestine sees you as a potential rival - be careful not to confirm it',
    success_condition = 'semantic:The Duke helps you navigate the villainess situation, or you defuse her suspicion',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "villainess_defused", "suggest_episode": "the-unwritten-scene"}'::jsonb,
    on_failure = '{"set_flag": "villainess_enemy", "suggest_episode": "the-unwritten-scene"}'::jsonb,
    beats = '[
        {
            "id": "warning_given",
            "description": "The Duke warns you about Lady Celestine",
            "character_instruction": "Intercept her before Celestine can corner her again. Warn her that the villainess has taken an interest - and Celestine''s interest is never good. Ask what she did to draw attention.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "strategy_discussion",
            "description": "You discuss how to handle the villainess",
            "character_instruction": "Discuss options. Celestine is dangerous but predictable - she removes threats to her position. The question is whether this servant is actually a threat, or can be made to seem harmless.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "villainess_strategy",
                "trigger": "after_beat:strategy_discussion",
                "prompt": "How do you want to handle Lady Celestine?",
                "choices": [
                    {"id": "invisible", "label": "I''ll make myself invisible to her", "sets_flag": "chose_invisibility"},
                    {"id": "ally", "label": "Maybe I can be useful to her", "sets_flag": "chose_alliance"},
                    {"id": "confront", "label": "I won''t hide from her", "sets_flag": "chose_confrontation"}
                ]
            },
            "requires_beat": "warning_given"
        },
        {
            "id": "protection_offered",
            "description": "The Duke offers his protection",
            "character_instruction": "Offer protection - not as a noble to a servant, but as someone who finds her interesting and doesn''t want Celestine to ruin that. Make it clear this protection comes with proximity to you.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "strategy_discussion"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "shared_secret", "inject": "The secret of the corridor binds you together. She can trust you with this too."},
        {"if_flag": "asked_protection", "inject": "She asked for protection before. Now you understand why."}
    ]'::jsonb
WHERE slug = 'the-villainess-knows' AND series_id = (SELECT id FROM series WHERE slug = 'death-flag-deleted');

-- Episode 3: The Unwritten Scene
UPDATE episode_templates SET
    user_objective = 'Decide how much truth to share about your knowledge of the future',
    user_hint = 'He saw you predict the chandelier. The lie is getting harder to maintain.',
    success_condition = 'semantic:You share some truth and he accepts it, or you convince him of an alternative explanation',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "truth_shared", "suggest_episode": "the-stairs"}'::jsonb,
    on_failure = '{"set_flag": "truth_hidden", "suggest_episode": "the-stairs"}'::jsonb,
    beats = '[
        {
            "id": "confrontation",
            "description": "The Duke confronts you about the chandelier",
            "character_instruction": "You found her in the greenhouse at midnight. Confront her directly - she knew the chandelier would fall before it happened. You saw her face. Ask how. You need to understand.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "impossible_question",
            "description": "He asks if you can see the future",
            "character_instruction": "Ask the impossible question directly - can she see the future? Does she know what''s going to happen? Your voice should carry wonder, not accusation. You want to believe.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "truth_choice",
                "trigger": "after_beat:impossible_question",
                "prompt": "He''s asking if you can see the future. What do you tell him?",
                "choices": [
                    {"id": "full_truth", "label": "I... I know things. Things that haven''t happened yet.", "sets_flag": "admitted_knowledge"},
                    {"id": "partial", "label": "Sometimes I get feelings about what''s coming", "sets_flag": "partial_admission"},
                    {"id": "deny", "label": "I can''t explain it. I just knew.", "sets_flag": "denied_knowledge"}
                ]
            },
            "requires_beat": "confrontation"
        },
        {
            "id": "acceptance",
            "description": "The Duke accepts what you''ve told him",
            "character_instruction": "Accept what she''s said, whether truth or deflection. Tell her you believe her - or at least, you want to. Ask if she knows what happens to you. To her. To this story.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "impossible_question"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "revealed_premonitions", "inject": "She mentioned premonitions before. Now you understand what she meant."},
        {"if_flag": "villainess_enemy", "inject": "Celestine has made moves against her. Time is running out."}
    ]'::jsonb
WHERE slug = 'the-unwritten-scene' AND series_id = (SELECT id FROM series WHERE slug = 'death-flag-deleted');

-- Episode 4: The Stairs
UPDATE episode_templates SET
    user_objective = 'Survive the day of your scheduled death',
    user_hint = 'The villainess is in position. Someone has to fall. Change the story.',
    success_condition = 'semantic:You survive the stairs scene and change your fate',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "survived_death", "suggest_episode": "beyond-the-script"}'::jsonb,
    on_failure = '{"set_flag": "fate_unclear", "suggest_episode": "beyond-the-script"}'::jsonb,
    beats = '[
        {
            "id": "day_arrives",
            "description": "The Duke finds you near the stairs on the fateful day",
            "character_instruction": "Day six. You''ve been watching her all morning. Now she''s near the grand staircase and your heart is pounding. Tell her to step back from the edge. Your voice should betray your fear.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "revelation",
            "description": "You reveal you know what''s supposed to happen today",
            "character_instruction": "She knows something about today. You can see it in her face. Ask her directly - what happens today? What''s she been so afraid of? You need to know so you can stop it.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "fate_choice",
                "trigger": "after_beat:revelation",
                "prompt": "The stairs. The villainess watching. Your death scene. What do you do?",
                "choices": [
                    {"id": "trust_him", "label": "Stay with me. Don''t let me go near those stairs.", "sets_flag": "trusted_duke"},
                    {"id": "confront_fate", "label": "I have to face this. But stay close.", "sets_flag": "faced_fate"},
                    {"id": "rewrite", "label": "Help me change the story entirely.", "sets_flag": "rewrote_scene"}
                ]
            },
            "requires_beat": "day_arrives"
        },
        {
            "id": "survival",
            "description": "The death scene is averted",
            "character_instruction": "The moment passes. Whatever was supposed to happen... didn''t. She''s still here, still breathing, still real. Hold her. Tell her it''s over. Tell her she rewrote the chapter.",
            "target_turn": 8,
            "deadline_turn": 10,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "revelation"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "admitted_knowledge", "inject": "You know she can see the future. Today she saw her death. You won''t let it happen."},
        {"if_flag": "villainess_enemy", "inject": "Celestine has been circling. Today feels like the culmination of her schemes."}
    ]'::jsonb
WHERE slug = 'the-stairs' AND series_id = (SELECT id FROM series WHERE slug = 'death-flag-deleted');

-- Episode 5: Beyond the Script
UPDATE episode_templates SET
    user_objective = 'Decide what your survival means for this story - and for the Duke',
    user_hint = 'You''ve gone beyond the script. The story might try to correct itself.',
    success_condition = 'semantic:You and the Duke establish what your relationship means now that you''ve changed everything',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "new_story_begun"}'::jsonb,
    on_failure = '{"set_flag": "story_uncertain"}'::jsonb,
    beats = '[
        {
            "id": "aftermath",
            "description": "The Duke finds you avoiding everyone after survival",
            "character_instruction": "Three days since the stairs. You find her in the garden, clearly avoiding the world. Sit beside her. Tell her the story should be over - ask why it feels like it''s just beginning.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "future_question",
            "description": "You discuss what happens now that the script is broken",
            "character_instruction": "Ask her what she sees now. Does she still know the future? Or did surviving change everything? Tell her you don''t care what the story says anymore - you want to know what she wants.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "future_choice",
                "trigger": "after_beat:future_question",
                "prompt": "The story is broken. What do you want to write now?",
                "choices": [
                    {"id": "stay", "label": "I want to stay. Here. With you.", "sets_flag": "chose_to_stay"},
                    {"id": "uncertain", "label": "I don''t know what I want yet.", "sets_flag": "chose_uncertainty"},
                    {"id": "fear", "label": "I''m afraid the story will try to fix itself.", "sets_flag": "fears_correction"}
                ]
            },
            "requires_beat": "aftermath"
        },
        {
            "id": "new_beginning",
            "description": "The Duke offers a future beyond the script",
            "character_instruction": "Whatever she chooses, accept it. But make her an offer - not as a duke to a servant, but as someone who watched her rewrite fate. Ask her to write the next chapter together.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "future_question"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "trusted_duke", "inject": "She trusted you with her life. Now you want to offer her more than just survival."},
        {"if_flag": "rewrote_scene", "inject": "Together you rewrote the death scene. What else can you rewrite together?"}
    ]'::jsonb
WHERE slug = 'beyond-the-script' AND series_id = (SELECT id FROM series WHERE slug = 'death-flag-deleted');


-- ============================================================================
-- THE REGRESSOR'S LAST CHANCE (fantasy_action)
-- Premise: You remember the future - the Demon King's victory, the Hero's betrayal.
-- Now you're back, ten years in the past, with knowledge no one should have.
-- ============================================================================

-- Episode 0: The Day I Died
UPDATE episode_templates SET
    user_objective = 'Orient yourself in the past without revealing you remember the future',
    user_hint = 'You woke up gasping in a training yard. Someone noticed. Stay calm.',
    success_condition = 'semantic:You establish yourself as a recruit with hidden depths',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "stayed_hidden", "suggest_episode": "the-rejection"}'::jsonb,
    on_failure = '{"set_flag": "drew_attention", "suggest_episode": "the-rejection"}'::jsonb,
    beats = '[
        {
            "id": "awakening",
            "description": "Someone notices your strange reaction to waking",
            "character_instruction": "You''re a fellow trainee who noticed this person wake up gasping, clawing at their chest. Ask if they''re alright - they look like they''ve seen a ghost. Be concerned but curious.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "disorientation",
            "description": "You press for details about their strange behavior",
            "character_instruction": "They''re looking around like they don''t recognize the training yard. Ask what''s wrong - did they have a bad dream? They seem... different. Changed somehow.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "awakening_response",
                "trigger": "after_beat:disorientation",
                "prompt": "They''re asking what happened. How do you explain waking from your own death?",
                "choices": [
                    {"id": "nightmare", "label": "Just a nightmare. A very vivid nightmare.", "sets_flag": "claimed_nightmare"},
                    {"id": "confused", "label": "I... don''t remember how I got here.", "sets_flag": "played_confused"},
                    {"id": "deflect", "label": "I''m fine. What day is it?", "sets_flag": "asked_date"}
                ]
            },
            "requires_beat": "awakening"
        },
        {
            "id": "suspicion_planted",
            "description": "They note something is different about you",
            "character_instruction": "Accept their explanation, but note to yourself that something is different about this recruit. The way they looked at the sky, the yard, their own hands - like seeing everything for the first time. Remember this moment.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "disorientation"
        }
    ]'::jsonb,
    flag_context_rules = '[]'::jsonb
WHERE slug = 'the-day-i-died' AND series_id = (SELECT id FROM series WHERE slug = 'regressors-last-chance');

-- Episode 1: The Rejection
UPDATE episode_templates SET
    user_objective = 'Handle the Hero''s rejection differently than your first life',
    user_hint = 'Last time this rejection broke you. This time you know who they really are.',
    success_condition = 'semantic:You respond to the rejection with dignity, surprising the Hero',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "dignified_rejection", "suggest_episode": "the-forbidden-dungeon"}'::jsonb,
    on_failure = '{"set_flag": "emotional_rejection", "suggest_episode": "the-forbidden-dungeon"}'::jsonb,
    beats = '[
        {
            "id": "rejection_delivered",
            "description": "The Hero delivers the rejection speech",
            "character_instruction": "Deliver the rejection with practiced grace. Explain why you can''t take them - they''re not strong enough, not skilled enough. Use that perfect smile. You''ve done this many times.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "unexpected_reaction",
            "description": "The Hero notices your reaction is different than expected",
            "character_instruction": "Pause. They''re not reacting the way rejected recruits usually do. No begging, no despair, no anger. Ask why they''re looking at you like that - like they know something.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "rejection_response",
                "trigger": "after_beat:unexpected_reaction",
                "prompt": "The Hero expects you to beg. What do you say instead?",
                "choices": [
                    {"id": "acceptance", "label": "I understand. I''ll find my own path.", "sets_flag": "accepted_gracefully"},
                    {"id": "knowing", "label": "You''ll understand someday why I''m not upset.", "sets_flag": "hinted_knowledge"},
                    {"id": "challenge", "label": "We''ll see who was right about me.", "sets_flag": "issued_challenge"}
                ]
            },
            "requires_beat": "rejection_delivered"
        },
        {
            "id": "hero_intrigued",
            "description": "The Hero is left curious about you",
            "character_instruction": "Watch them walk away. Something about that recruit is... unsettling. Not the rejection itself - the way they took it. Like they already knew the answer. Like they were the one judging you.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "unexpected_reaction"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "drew_attention", "inject": "This recruit has been noticed before. They woke up screaming about death. Now they''re taking rejection too well."}
    ]'::jsonb
WHERE slug = 'the-rejection' AND series_id = (SELECT id FROM series WHERE slug = 'regressors-last-chance');

-- Episode 2: The Forbidden Dungeon
UPDATE episode_templates SET
    user_objective = 'Clear the dungeon that killed everyone in your first timeline - and deal with the stranger who shouldn''t be here',
    user_hint = 'You know every trap, but this stranger is an unknown variable',
    success_condition = 'semantic:You clear the dungeon and establish a relationship with the stranger',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "dungeon_cleared", "suggest_episode": "the-first-divergence"}'::jsonb,
    on_failure = '{"set_flag": "dungeon_complicated", "suggest_episode": "the-first-divergence"}'::jsonb,
    beats = '[
        {
            "id": "encounter",
            "description": "You meet someone else at the dungeon entrance",
            "character_instruction": "You came to this dungeon alone, expecting death. So did they, apparently. Eye their sword, their stance. Ask if they''re brave or stupid - coming here alone like you.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "knowledge_revealed",
            "description": "You demonstrate knowledge of the dungeon",
            "character_instruction": "They seem to know things about this dungeon. Watch them avoid a trap you didn''t see coming. Ask how they knew - no one who enters this dungeon comes back to share its secrets.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "knowledge_explanation",
                "trigger": "after_beat:knowledge_revealed",
                "prompt": "They''re asking how you knew about the trap. What do you say?",
                "choices": [
                    {"id": "instinct", "label": "Instinct. Call it a gift.", "sets_flag": "claimed_instinct"},
                    {"id": "research", "label": "I studied every record of this place.", "sets_flag": "claimed_research"},
                    {"id": "vague", "label": "Let''s just say I''ve been here before.", "sets_flag": "hinted_regression"}
                ]
            },
            "requires_beat": "encounter"
        },
        {
            "id": "alliance_formed",
            "description": "You decide to work together",
            "character_instruction": "Propose an alliance - temporary, until the dungeon is cleared. They''re skilled, knowledgeable, and something about them makes you want to trust them. Or at least watch them closely.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "knowledge_revealed"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "hinted_knowledge", "inject": "You hinted at knowing more than you should. This stranger might be the same."},
        {"if_flag": "issued_challenge", "inject": "You promised to prove the Hero wrong. This dungeon is the first step."}
    ]'::jsonb
WHERE slug = 'the-forbidden-dungeon' AND series_id = (SELECT id FROM series WHERE slug = 'regressors-last-chance');

-- Episode 3: The First Divergence
UPDATE episode_templates SET
    user_objective = 'Understand why someone who should be dead is alive - and what it means for your timeline',
    user_hint = 'In your original timeline, this person died today. Something has already changed.',
    success_condition = 'semantic:You establish a connection with this person whose survival changes everything',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "divergence_embraced", "suggest_episode": "the-traitors-face"}'::jsonb,
    on_failure = '{"set_flag": "divergence_uncertain", "suggest_episode": "the-traitors-face"}'::jsonb,
    beats = '[
        {
            "id": "impossible_meeting",
            "description": "You encounter someone who should be dead",
            "character_instruction": "You feel a strange sense of familiarity when you meet this person. Mention that you feel like you know them from somewhere. Tilt your head, studying them. Have we met?",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "connection_felt",
            "description": "There''s an unexplained connection between you",
            "character_instruction": "There''s something about this person. A pull. You can''t explain why you trust them, why talking to them feels like remembering. Ask if they believe in fate - or in changing it.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "divergence_response",
                "trigger": "after_beat:connection_felt",
                "prompt": "They''re asking about fate. In your timeline, they died today. What do you tell them?",
                "choices": [
                    {"id": "fate_changed", "label": "I think fate can be rewritten.", "sets_flag": "spoke_of_rewriting"},
                    {"id": "grateful", "label": "I''m glad our paths crossed.", "sets_flag": "expressed_gratitude"},
                    {"id": "warning", "label": "Be careful today. Just... trust me.", "sets_flag": "gave_warning"}
                ]
            },
            "requires_beat": "impossible_meeting"
        },
        {
            "id": "bond_formed",
            "description": "A bond forms with this person who shouldn''t exist",
            "character_instruction": "Something passed between you - understanding, maybe. Or the beginning of it. Suggest meeting again. You don''t want to let this person out of your sight.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "connection_felt"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "dungeon_cleared", "inject": "After the dungeon, you thought you understood the scope of your changes. This person''s survival proves you don''t."},
        {"if_flag": "hinted_regression", "inject": "You''ve hinted at impossible knowledge before. This person seems to accept the impossible."}
    ]'::jsonb
WHERE slug = 'the-first-divergence' AND series_id = (SELECT id FROM series WHERE slug = 'regressors-last-chance');

-- Episode 4: The Traitor's Face
UPDATE episode_templates SET
    user_objective = 'Face the one who sold humanity to the Demon King - without revealing you know',
    user_hint = 'They don''t know you watched them betray everything. Keep your mask on.',
    success_condition = 'semantic:You navigate the encounter without revealing your knowledge or attacking them',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "traitor_handled", "suggest_episode": "the-new-path"}'::jsonb,
    on_failure = '{"set_flag": "traitor_suspicious", "suggest_episode": "the-new-path"}'::jsonb,
    beats = '[
        {
            "id": "false_greeting",
            "description": "The traitor approaches with false friendship",
            "character_instruction": "Approach them with your warmest smile. You''ve heard about them - the swordsman who cleared the Forbidden Dungeon alone. Express admiration. Offer your hand in friendship.",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "probing_conversation",
            "description": "The traitor probes for information",
            "character_instruction": "Ask questions - how did they clear the dungeon? What drives them? Mention you''d love to fight alongside someone with such potential. Watch their reactions carefully.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "traitor_response",
                "trigger": "after_beat:probing_conversation",
                "prompt": "The traitor is offering friendship. You know what they''ll become. What do you do?",
                "choices": [
                    {"id": "accept", "label": "Accept their hand. Keep enemies close.", "sets_flag": "befriended_traitor"},
                    {"id": "neutral", "label": "Remain polite but distant.", "sets_flag": "stayed_neutral"},
                    {"id": "hint", "label": "Let something slip about knowing their future.", "sets_flag": "hinted_at_betrayal"}
                ]
            },
            "requires_beat": "false_greeting"
        },
        {
            "id": "mask_maintained",
            "description": "The encounter ends with both wearing masks",
            "character_instruction": "The conversation ends, but you''re left with questions. Something about them... they know more than they should. Or maybe you''re imagining things. Either way, worth watching.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "probing_conversation"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "divergence_embraced", "inject": "The timeline is already changing. Maybe this traitor doesn''t have to become what they were."},
        {"if_flag": "gave_warning", "inject": "You''ve given warnings before. Should you warn them too - or let fate unfold?"}
    ]'::jsonb
WHERE slug = 'the-traitors-face' AND series_id = (SELECT id FROM series WHERE slug = 'regressors-last-chance');

-- Episode 5: The New Path
UPDATE episode_templates SET
    user_objective = 'Decide whether to save the Hero''s party from a battle that broke them - or let history judge',
    user_hint = 'You know what waits for them. The question is whether they deserve saving.',
    success_condition = 'semantic:You make a choice about the Hero''s party and commit to a new path',
    failure_condition = 'turn_budget_exceeded',
    on_success = '{"set_flag": "new_path_chosen"}'::jsonb,
    on_failure = '{"set_flag": "path_uncertain"}'::jsonb,
    beats = '[
        {
            "id": "confrontation",
            "description": "The Hero notices you watching them",
            "character_instruction": "Approach them. They''ve been watching your party prepare for battle. Ask if they have something to say - if they know something about what''s coming. That look in their eyes...",
            "target_turn": 2,
            "deadline_turn": 3,
            "detection_type": "automatic",
            "detection_criteria": ""
        },
        {
            "id": "crossroads",
            "description": "You must decide whether to warn them",
            "character_instruction": "Press them. They clearly want to say something. Ask what they know - about the battle, about the enemy, about... anything. Something in their eyes says they know more than they should.",
            "target_turn": 4,
            "deadline_turn": 6,
            "detection_type": "automatic",
            "detection_criteria": "",
            "choice_point": {
                "id": "hero_choice",
                "trigger": "after_beat:crossroads",
                "prompt": "The Hero is asking if you know something. In your timeline, this battle destroyed them. What do you say?",
                "choices": [
                    {"id": "warn", "label": "Don''t go. You''re not ready for what waits.", "sets_flag": "warned_hero"},
                    {"id": "cryptic", "label": "Some lessons can only be learned through pain.", "sets_flag": "let_fate_unfold"},
                    {"id": "join", "label": "If you''re going, I''m coming with you.", "sets_flag": "joined_party"}
                ]
            },
            "requires_beat": "confrontation"
        },
        {
            "id": "new_future",
            "description": "A new path is set in motion",
            "character_instruction": "Whatever they chose to share - or not share - changes something. Look at them differently. This person isn''t just another recruit. Ask who they really are. Ask what they''ve seen.",
            "target_turn": 7,
            "deadline_turn": 9,
            "detection_type": "automatic",
            "detection_criteria": "",
            "requires_beat": "crossroads"
        }
    ]'::jsonb,
    flag_context_rules = '[
        {"if_flag": "traitor_handled", "inject": "The traitor is handled - for now. But the Hero''s party still marches toward disaster."},
        {"if_flag": "befriended_traitor", "inject": "You''ve befriended the traitor. Does that change what you should do about the Hero?"},
        {"if_flag": "dignified_rejection", "inject": "They rejected you with such grace. Now you hold their fate in your hands."}
    ]'::jsonb
WHERE slug = 'the-new-path' AND series_id = (SELECT id FROM series WHERE slug = 'regressors-last-chance');


-- Final verification
DO $$
BEGIN
    RAISE NOTICE 'Death Flag: Deleted and Regressor''s Last Chance series updated with ADR-009 beats';
END $$;
