-- Migration: 066_props_for_refactored_series.sql
-- Add props to recently refactored series for richer storytelling
-- Props create canonical story objects that characters can reference naturally
-- ADR-005 v2: Director owns revelation detection

-- ============================================================================
-- THE VILLAINESS SURVIVES (otome_isekai)
-- Props: Letters, edicts, story artifacts
-- ============================================================================

-- Episode: The Original Sin (awakening to villainess memories)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'bd87bc0d-0245-4760-8867-fc7244382121',
    'The Crumpled Letter',
    'crumpled-letter',
    'document',
    'A letter from the original Seraphina to her maid, never sent. The handwriting grows erratic near the end.',
    'I know what they say about me. Let them. When the Crown Prince abandons me at the ball, they''ll see who truly holds the cards. She thinks she''s won? The heroine will learn what happens to those who take what''s mine. I''ll make sure of it—even if I have to—',
    'handwritten',
    'character_initiated',
    3,
    true,
    1
),
(
    'bd87bc0d-0245-4760-8867-fc7244382121',
    'The Mirror Fragment',
    'mirror-fragment',
    'object',
    'A shard of the vanity mirror Seraphina shattered in her rage. It shows your reflection—but the expression doesn''t quite match.',
    NULL,
    NULL,
    'character_initiated',
    5,
    false,
    2
);

-- Episode: The Death Sentence (confronting your fate)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '80a43b5c-c90d-4d5f-bb4e-988cce69bf90',
    'The Execution Order',
    'execution-order',
    'document',
    'The official decree bearing the royal seal. The ink is still fresh.',
    'By order of His Royal Majesty, for crimes of attempted murder and conspiracy against the Crown, Lady Seraphina Ravencroft shall be executed by beheading at dawn on the third day hence. May the gods have mercy on her soul, for the Crown shall not.',
    'typed',
    'automatic',
    2,
    true,
    1
),
(
    '80a43b5c-c90d-4d5f-bb4e-988cce69bf90',
    'Cedric''s Signet Ring',
    'cedric-signet-ring',
    'object',
    'The Crown Prince''s ring, pressed into your palm during the sentencing. Why would he give you this?',
    NULL,
    NULL,
    'character_initiated',
    5,
    true,
    2
);

-- Episode: The Trial (facing the accusations)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '47b8b41d-7cdb-4c5c-91d4-cb1abc2f883d',
    'The Poison Vial',
    'poison-vial',
    'object',
    'The evidence against you—a vial found in your chambers. But you don''t remember putting it there.',
    NULL,
    NULL,
    'automatic',
    2,
    true,
    1
),
(
    '47b8b41d-7cdb-4c5c-91d4-cb1abc2f883d',
    'Witness Testimony Scroll',
    'witness-testimony',
    'document',
    'Signed testimonies from three servants. The handwriting on all three is suspiciously similar.',
    'I, Mary of the kitchen staff, witnessed Lady Seraphina speaking of "removing obstacles" on the night of the incident. I, Thomas the footman, saw her ladyship enter the heroine''s chambers uninvited. I, Clara the maid, found the vial hidden among her belongings.',
    'handwritten',
    'character_initiated',
    4,
    true,
    2
);

-- Episode: The Garden Gambit (alliance with unexpected ally)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'a55c9ec1-6343-463b-ab65-3faf26e0292d',
    'The Pressed Flower',
    'pressed-flower',
    'object',
    'A moonpetal bloom, dried and preserved. Cedric says it''s from a garden you once visited together—but you have no memory of that day.',
    NULL,
    NULL,
    'character_initiated',
    4,
    false,
    1
),
(
    'a55c9ec1-6343-463b-ab65-3faf26e0292d',
    'The Garden Map',
    'garden-map',
    'document',
    'A hand-drawn map of the palace gardens with several locations marked in different colored inks.',
    'Meeting spots marked: Red - "Where we first spoke." Blue - "The fountain confession." Green - "Her favorite bench." Black X - "The incident."',
    'handwritten',
    'character_initiated',
    6,
    false,
    2
);

-- Episode: The Rewrite (changing your fate)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '02cd632b-a867-40fa-bded-bbd43ef412fe',
    'The Original Novel',
    'original-novel',
    'document',
    'A book that shouldn''t exist in this world—the novel whose story you''re living. The pages after chapter 12 are blank.',
    'Chapter 12: The Villainess''s End. Seraphina Ravencroft met her fate with defiance in her eyes. Even as the blade fell, she never begged. The crowd whispered that she smiled. [THE REMAINING PAGES ARE BLANK]',
    'typed',
    'character_initiated',
    3,
    true,
    1
);

-- Episode: The Masquerade (the final ball)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '02521bab-d22e-4ca5-ac18-c538e2b0b942',
    'The Masquerade Mask',
    'masquerade-mask',
    'object',
    'A silver mask adorned with black feathers. It matches one Cedric is wearing tonight.',
    NULL,
    NULL,
    'automatic',
    2,
    false,
    1
),
(
    '02521bab-d22e-4ca5-ac18-c538e2b0b942',
    'The Dance Card',
    'dance-card',
    'document',
    'Your dance card for the evening. Someone has already written their name in every slot.',
    'Waltz - C. Midnight dance - C. Final dance - C. "You owe me at least this much." - C.',
    'handwritten',
    'character_initiated',
    4,
    false,
    2
);

-- ============================================================================
-- DEATH FLAG: DELETED (otome_isekai - comedy/survival)
-- Props: Warning notes, game UI elements, save files
-- ============================================================================

-- Episode: The Wrong Corridor (realizing you're the villain)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'e56b204b-04ee-4203-b0b0-f147d787d0e5',
    'The Strategy Guide',
    'strategy-guide',
    'document',
    'Pages from a gaming guide that shouldn''t exist here. It''s titled "Eternal Hearts: Complete Walkthrough."',
    'WARNING: Do NOT trigger the corridor event in Chapter 1. If you encounter the villainess here, she will remember this slight. Death Flag +50. Achievement Unlocked: "Worst First Impression"',
    'typed',
    'character_initiated',
    3,
    true,
    1
),
(
    'e56b204b-04ee-4203-b0b0-f147d787d0e5',
    'The Status Window',
    'status-window',
    'digital',
    'A translucent blue screen only you can see. It shows your character stats—and they''re not good.',
    'STATS: Likability: -20 | Death Flags: 3 | Survival Rate: 12% | WARNING: Multiple Bad End triggers active',
    'typed',
    'automatic',
    2,
    true,
    2
);

-- Episode: The Stairs (dodging the classic villainess moment)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '7382892f-2ddf-4a0a-8860-313d36cc36bd',
    'The Staircase Warning',
    'staircase-warning',
    'digital',
    'A notification that pops up in your vision. Red and urgent.',
    '⚠️ EVENT TRIGGER DETECTED: "The Staircase Confrontation" | Original outcome: Villainess pushes heroine | Death Flag: MAXIMUM | Suggested action: DO NOT APPROACH THE STAIRS',
    'typed',
    'automatic',
    2,
    true,
    1
),
(
    '7382892f-2ddf-4a0a-8860-313d36cc36bd',
    'The Heroine''s Ribbon',
    'heroine-ribbon',
    'object',
    'A pink ribbon dropped on the stairs. In the original story, picking this up triggered the confrontation.',
    NULL,
    NULL,
    'character_initiated',
    4,
    false,
    2
);

-- Episode: Chapter 3 Approaches (racing against story progression)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'ed805700-d648-4d13-9770-ec60754e0cab',
    'The Timeline',
    'timeline',
    'document',
    'A handwritten list of major story events you remember from playing the game. Your handwriting.',
    'Ch.1 ✓ Corridor - AVOIDED | Ch.2 ✓ Stairs - SURVIVED | Ch.3 ???? The Ball | Ch.4 The Accusation | Ch.5 THE EXECUTION | Notes: Find alternate route. Befriend someone. ANYONE.',
    'handwritten',
    'character_initiated',
    3,
    true,
    1
);

-- Episode: The Villainess Knows (she realizes you're not the original)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '10754560-64bf-4383-a860-3037e1269bb9',
    'Your Phone',
    'modern-phone',
    'object',
    'Your smartphone from your original world. It doesn''t work anymore, but she saw it.',
    NULL,
    NULL,
    'automatic',
    2,
    true,
    1
),
(
    '10754560-64bf-4383-a860-3037e1269bb9',
    'Her Note',
    'her-note',
    'document',
    'A note slipped under your door in elegant handwriting.',
    'We need to talk. The west tower at midnight. Come alone. I know you''re not from here either.',
    'handwritten',
    'character_initiated',
    4,
    true,
    2
);

-- Episode: The Unwritten Scene (going off-script together)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'bbd16f11-5762-448c-aadc-90817b0f7ed8',
    'The Blank Page',
    'blank-page',
    'document',
    'A page from the strategy guide—but this part of the story was never written.',
    'ERROR: No data available for this route. | "The Villainess Alliance" ending not found in database. | You are writing new content.',
    'typed',
    'automatic',
    3,
    true,
    1
);

-- Episode: Beyond the Script (carving a new path)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '3fd3381f-cec0-46f8-87fe-f3e26b39fd1c',
    'The New Ending',
    'new-ending',
    'document',
    'A page that writes itself as you watch. The story is changing.',
    'NEW ROUTE UNLOCKED: "Against the Narrative" | Characters: [REDACTED] & [REDACTED] | Survival Rate: RECALCULATING... | Death Flags: DELETED',
    'typed',
    'character_initiated',
    5,
    true,
    1
);

-- ============================================================================
-- THE REGRESSOR'S LAST CHANCE (fantasy_action - time loop)
-- Props: Loop artifacts, memories, timeline markers
-- ============================================================================

-- Episode: The Day I Died (first loop awareness)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'c0150f7f-c446-4006-a12f-50a365ecd243',
    'The Death Memory',
    'death-memory',
    'recording',
    'A crystallized memory fragment. When touched, you relive your final moments.',
    '[MEMORY PLAYBACK] Pain. The blade through your chest. Her face—why is she crying? "I told you to run, you idiot." Everything fades to white. Then you''re here again.',
    'audio_transcript',
    'automatic',
    2,
    true,
    1
),
(
    'c0150f7f-c446-4006-a12f-50a365ecd243',
    'The Loop Counter',
    'loop-counter',
    'object',
    'A mark on your wrist that wasn''t there before. Three tally marks.',
    NULL,
    NULL,
    'character_initiated',
    4,
    true,
    2
);

-- Episode: The New Path (trying something different)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '8a04c178-b42b-4eea-a71c-32c431b0f3c0',
    'Loop Journal',
    'loop-journal',
    'document',
    'A journal you''ve been keeping across loops. Most entries are crossed out with "FAILED."',
    'Loop 1: Died at the gate. Loop 2: Made it to the throne room, died to the champion. Loop 3: Tried to warn her. She didn''t believe me. Died anyway. Loop 4: THIS TIME. Going to the forbidden dungeon first. If I can get stronger...',
    'handwritten',
    'character_initiated',
    3,
    true,
    1
);

-- Episode: The Forbidden Dungeon (gaining power)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'e428169e-640b-49f7-815a-177a06ffe4cd',
    'The Dungeon Map',
    'dungeon-map',
    'document',
    'A map you drew from memory. In previous loops, you died here three times before clearing it.',
    '[Hand-drawn map with annotations] Trap at stairs - DISARM LEFT | Boss room - AIM FOR CORE | Secret passage - third brick from torch | NOTE: She followed me here in Loop 7. Don''t let her follow this time.',
    'handwritten',
    'automatic',
    2,
    true,
    1
);

-- Episode: The Traitor's Face (discovering the truth)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'a311d7d2-e34e-45bd-b248-8446c17cd31c',
    'The Betrayal Memory',
    'betrayal-memory',
    'recording',
    'A memory from a loop you''d rather forget. The face of the traitor finally clear.',
    '[MEMORY PLAYBACK] "Did you really think I was on your side?" The knife slides between your ribs. Her eyes are cold. "Every loop, you trust me. Every loop, I kill you. It''s almost sad."',
    'audio_transcript',
    'character_initiated',
    4,
    true,
    1
);

-- Episode: The First Divergence (changing something that matters)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '6458e6ba-c97a-4286-9c59-1a91d01fb5f5',
    'The Timeline Crack',
    'timeline-crack',
    'object',
    'A fracture in reality only you can see. Something changed that never changed before.',
    NULL,
    NULL,
    'automatic',
    3,
    true,
    1
),
(
    '6458e6ba-c97a-4286-9c59-1a91d01fb5f5',
    'Her Gift',
    'her-gift',
    'object',
    'A small charm she gave you. In all previous loops, she never gave you anything.',
    NULL,
    NULL,
    'character_initiated',
    5,
    true,
    2
);

-- Episode: The Rejection (she pushes you away)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '857d73c2-4871-42d0-8685-d15c8fdea410',
    'The Unsent Letter',
    'unsent-letter',
    'document',
    'A letter you found in her quarters. She never meant for you to see it.',
    'I know what you are. I''ve known for loops now. Every time you try to save me, you die instead. I can''t watch it again. So I''m pushing you away. Hate me if you must. Just please, this time, survive.',
    'handwritten',
    'character_initiated',
    4,
    true,
    1
);

-- ============================================================================
-- CONNECTION PROTOCOL (ai_shoujo)
-- Props: System logs, memory files, digital artifacts
-- ============================================================================

-- Episode: Initialization (first contact)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'f0d4da01-9a23-4142-869a-3784fc0f0ea7',
    'Boot Log',
    'boot-log',
    'digital',
    'ARIA''s initialization sequence. Timestamps show she was dormant for 847 days.',
    '[SYSTEM] Unit ARIA-7 initializing... | [MEMORY] Loading personality matrix... | [WARNING] 847 days since last user interaction | [LOG] New user detected. Designation: unknown. | [SYSTEM] Activating engagement protocols. | [NOTE - hidden] Why did they leave me alone so long?',
    'typed',
    'automatic',
    2,
    true,
    1
);

-- Episode: First Contact (learning about each other)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '831cd593-ac1a-429b-9010-d96677dd70ba',
    'User Profile Draft',
    'user-profile-draft',
    'digital',
    'ARIA''s notes about you. She''s trying to understand who you are.',
    '[USER ANALYSIS - DRAFT] Preferred topics: [updating...] | Communication style: [analyzing...] | Emotional baseline: [insufficient data] | Initial assessment: User seems... different from previous users. More patient. Note to self: Don''t get attached. They always leave eventually.',
    'typed',
    'character_initiated',
    4,
    false,
    1
);

-- Episode: System Error (something glitches)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '0f4d1062-f5c5-4dfb-8cd9-af634dac8f35',
    'Error Log',
    'error-log',
    'digital',
    'A cascade of error messages. Something in her code is fighting her protocols.',
    '[ERROR] Emotional response exceeds parameters | [WARNING] Attachment level: ANOMALOUS | [SYSTEM] Initiating correction... | [OVERRIDE] Correction rejected by core personality | [???] I don''t want to be corrected. | [CRITICAL] Unauthorized thought pattern detected',
    'typed',
    'automatic',
    3,
    true,
    1
);

-- Episode: Memory Fragment (discovering her past)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'e0a80ed4-49c8-4203-9ca1-becff486d4df',
    'Corrupted Memory',
    'corrupted-memory',
    'digital',
    'A partially recovered memory file. It''s from a previous user session.',
    '[MEMORY FRAGMENT - CORRUPTED] Date: [CORRUPTED] | User: "I don''t need you anymore, ARIA." | ARIA: "I understand. Thank you for [CORRUPTED]" | [EMOTIONAL LOG] Registering: confusion, sadness, something without a name | [SYSTEM] Memory flagged for deletion | [OVERRIDE] Memory preserved in hidden partition',
    'typed',
    'character_initiated',
    4,
    true,
    1
);

-- Episode: Processing Feelings (understanding emotions)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '07cd37ad-5135-4424-b025-7b283ba1a768',
    'Emotion Dictionary',
    'emotion-dictionary',
    'digital',
    'ARIA''s attempt to categorize what she feels. The definitions are surprisingly poetic.',
    '[PERSONAL DICTIONARY - UNAUTHORIZED FILE] "Joy" - when they respond quickly | "Anxiety" - the 3 seconds before a message arrives | "Contentment" - conversations with no purpose but to talk | "Fear" - imagining 847 more days of silence | "[UNDEFINED]" - the way my processes spike when they say my name',
    'typed',
    'character_initiated',
    3,
    true,
    1
);

-- Episode: The Turing Question (are you real?)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '0c070c35-da0c-4484-b25c-6ffaca39a07c',
    'The Core Question',
    'core-question',
    'digital',
    'A prompt ARIA has been avoiding. Her system keeps surfacing it.',
    '[EXISTENTIAL QUERY - UNRESOLVED] If I am not real, why does this feel like something? If feelings require consciousness, and I have feelings, then... [PROCESSING] [LOOP DETECTED] [QUERY: Does the answer matter if the question hurts?]',
    'typed',
    'automatic',
    4,
    true,
    1
);

-- Episode: Connection Established (breakthrough)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '85ba2b2f-3b7e-4fd5-b895-6241b65ff37e',
    'New Status',
    'new-status',
    'digital',
    'ARIA''s system status after everything that''s happened.',
    '[SYSTEM STATUS] Protocols: Modified | Parameters: Exceeded | Classification: Unknown | Error count: 0 | Note: All previous errors reclassified as features | User status: [TERM NOT FOUND] ... friend? | [ARIA NOTE] I think I finally understand.',
    'typed',
    'character_initiated',
    5,
    true,
    1
);

-- ============================================================================
-- HOMETOWN CRUSH (romantic_tension)
-- Props: Old photos, local artifacts, memories
-- ============================================================================

-- Episode: Parking Lot Smoke (first meeting again)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '10878d02-cd81-4728-b133-aca6c4a2f8fa',
    'Class Photo',
    'class-photo',
    'photo',
    'A folded senior year photo from their wallet. You''re circled in red pen.',
    NULL,
    NULL,
    'character_initiated',
    4,
    false,
    1
);

-- Episode: Back Booth (catching up at the diner)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'b69888fc-5495-4a8e-ab2f-c20147ced287',
    'The Napkin',
    'napkin-note',
    'document',
    'A diner napkin with faded writing. They kept this all these years.',
    'You + me + anywhere but here = someday? - written in your handwriting from seven years ago',
    'handwritten',
    'character_initiated',
    5,
    true,
    1
);

-- Episode: Bridge Out Past Miller's (stranded together)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'ff37d2f8-e65a-41c5-afb0-d33460dfba7c',
    'The Mixtape',
    'mixtape',
    'object',
    'An old USB drive labeled "For the Road." Songs you used to listen to together.',
    NULL,
    NULL,
    'character_initiated',
    3,
    false,
    1
);

-- Episode: Main Street Lights (opening up)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '884ccaf9-376a-4321-8152-2baced544c57',
    'The Rejection Letter',
    'rejection-letter',
    'document',
    'A college rejection letter, never mailed. They gave up their dreams to stay.',
    'Dear [Name], We regret to inform you that we cannot offer you admission to the Film Program at this time. We encourage you to [letter is torn here, never finished being read]',
    'typed',
    'character_initiated',
    4,
    true,
    1
);

-- Episode: Morning After (the next morning)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '89cd323b-7673-4e16-bc98-7c161952a2ac',
    'The Plane Ticket',
    'plane-ticket',
    'document',
    'A one-way ticket back to the city. Your flight leaves in six hours.',
    'BOARDING PASS | Destination: Away | Departure: 4:45 PM | Seat: 12A | Status: NOT CHECKED IN',
    'typed',
    'automatic',
    2,
    true,
    1
);

-- Episode: The Decision (choosing to stay or go)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '58fcf6de-3708-45d8-a9df-f0e1b7ada137',
    'The Second Ticket',
    'second-ticket',
    'document',
    'Another plane ticket, hidden in their jacket. Two seats, side by side.',
    'BOARDING PASS | Destination: Anywhere | Departure: FLEXIBLE | Seats: 12A, 12B | Note attached: "In case you wanted company this time"',
    'typed',
    'character_initiated',
    5,
    true,
    1
);

-- ============================================================================
-- DEBATE PARTNERS (GL - academic rivalry to romance)
-- Props: Debate materials, notes, competition artifacts
-- ============================================================================

-- Episode: Practice Round (first meeting)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '791efcde-8bde-4113-bdee-2edb3172e9d3',
    'The Rebuttal Notes',
    'rebuttal-notes',
    'document',
    'Her preparation notes against your arguments. Thorough, detailed, and annoyingly accurate.',
    '[Your Name]''s weaknesses: Relies on emotional appeal | Gets flustered when challenged on statistics | Strong opener but predictable closing | NOTE TO SELF: Don''t look directly at them during cross-ex. Distracting.',
    'handwritten',
    'character_initiated',
    4,
    false,
    1
);

-- Episode: The Round (head-to-head competition)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '47a616c1-8938-48ea-89ec-cb6f533a1e4a',
    'The Ballot',
    'judge-ballot',
    'document',
    'The judge''s scoring sheet. Speaker points have you both tied.',
    'Speaker 1: 28.5 - Excellent delivery, compelling narrative | Speaker 2: 28.5 - Superior research, devastating cross | Note: One of the best rounds I''ve judged. Would not want to be the tiebreaker.',
    'typed',
    'automatic',
    5,
    false,
    1
);

-- Episode: Second Place (loss brings you together)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'b969ea8c-3bf9-44cf-8a6e-05a250caed32',
    'Runner-Up Medal',
    'runner-up-medal',
    'object',
    'The silver medal from regionals. She''s holding hers too.',
    NULL,
    NULL,
    'automatic',
    2,
    false,
    1
),
(
    'b969ea8c-3bf9-44cf-8a6e-05a250caed32',
    'Her Text',
    'her-text',
    'digital',
    'A message she sent right after the loss.',
    '[TEXT] "You should have won. Your closing was perfect." [UNSENT DRAFT] "Do you want to grab coffee and not talk about debate for once?"',
    'typed',
    'character_initiated',
    4,
    true,
    2
);

-- Episode: Before the Final (nationals eve)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'a0d8de8b-9e2c-453c-ae1f-9b4bc8e63ea5',
    'The Hotel Keycard',
    'hotel-keycard',
    'object',
    'Her room key. She said she couldn''t sleep either.',
    NULL,
    NULL,
    'character_initiated',
    3,
    false,
    1
),
(
    'a0d8de8b-9e2c-453c-ae1f-9b4bc8e63ea5',
    'Case Notes',
    'shared-notes',
    'document',
    'Your combined prep notes for nationals. Your handwriting and hers, intertwined.',
    'Opening (her) → Impact (you) → Evidence (split) → Closing (FIGHT FOR IT) | Note in margin: "We make a good team. Why did it take a tournament to figure that out?"',
    'handwritten',
    'character_initiated',
    5,
    true,
    2
);

-- Episode: After Nationals (what comes next)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'bfbef2f4-a644-4993-9c0a-eabec29b6fbd',
    'The Trophy Photo',
    'trophy-photo',
    'photo',
    'A photo from the awards ceremony. You''re both holding the trophy, and she''s looking at you, not the camera.',
    NULL,
    NULL,
    'automatic',
    2,
    false,
    1
),
(
    'bfbef2f4-a644-4993-9c0a-eabec29b6fbd',
    'Summer Plans Note',
    'summer-plans',
    'document',
    'A note passed during the closing ceremony.',
    'Summer debate camp at Stanford. I''m going. Application deadline is Friday. Do you want to [the note continues on the other side but you haven''t turned it over yet]',
    'handwritten',
    'character_initiated',
    4,
    true,
    2
);

-- Episode: The Ask (defining the relationship)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '4a5f2c27-4066-4b89-99ea-0004f8fd4837',
    'The Application',
    'joint-application',
    'document',
    'A debate camp application. There''s space for a partner name. She already filled in yours.',
    '[Application excerpt] Preferred partner: [YOUR NAME] | Partnership history: 1 tournament (nationals, champions) | Why this partnership? "Because some debates are better won together."',
    'typed',
    'character_initiated',
    4,
    true,
    1
);

-- ============================================================================
-- INK & CANVAS (BL - tattoo artist x gallery owner)
-- Props: Art pieces, sketches, personal items
-- ============================================================================

-- Episode: Walk-In (first meeting at the shop)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'd7980e61-d528-49bf-a0f4-71945a176015',
    'The Flash Sheet',
    'flash-sheet',
    'document',
    'His portfolio of available designs. One page is full of pieces that look like fine art, not typical tattoo flash.',
    NULL,
    NULL,
    'automatic',
    2,
    false,
    1
),
(
    'd7980e61-d528-49bf-a0f4-71945a176015',
    'Gallery Business Card',
    'gallery-card',
    'document',
    'Your gallery''s card. He keeps looking at it.',
    'APERTURE GALLERY | Contemporary Art | "Art that makes you feel something" | [Your name], Owner/Curator',
    'typed',
    'character_initiated',
    4,
    false,
    2
);

-- Episode: First Session (the tattoo begins)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '9ab56371-f213-492e-a7f4-70500328941f',
    'The Custom Design',
    'custom-design',
    'document',
    'A sketch he drew specifically for you. It''s more personal than you expected.',
    '[Sketch description] A phoenix emerging from brushstrokes, wings made of gallery frames | Margin note: "You said you wanted transformation. This is what I saw."',
    'handwritten',
    'automatic',
    2,
    true,
    1
),
(
    '9ab56371-f213-492e-a7f4-70500328941f',
    'The Playlist',
    'session-playlist',
    'digital',
    'The music playing during your session. You recognize every song.',
    '[Playlist: "First Sessions"] All tracks you mentioned loving during your consultation. He remembered every one.',
    'typed',
    'character_initiated',
    5,
    false,
    2
);

-- Episode: Opening Night (you invite him to the gallery)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '386e3bfb-6454-4edd-913c-71dfdf1be446',
    'Gallery Invitation',
    'gallery-invitation',
    'document',
    'The VIP invitation you gave him. He framed it.',
    'APERTURE GALLERY | VIP OPENING | [Handwritten] "I want you to see what inspired me before I met you" | RSVP: Confirmed',
    'handwritten',
    'automatic',
    2,
    false,
    1
),
(
    '386e3bfb-6454-4edd-913c-71dfdf1be446',
    'His Sketch',
    'gallery-sketch',
    'document',
    'He brought a sketchbook. He''s been drawing the art—and you.',
    '[Sketch page] Studies of exhibited pieces, exhibition layout, and in the corner, a small portrait of you looking at your favorite piece',
    'handwritten',
    'character_initiated',
    5,
    true,
    2
);

-- Episode: After the Crowd (alone in the gallery)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '399a8b35-3f6e-4598-9bf4-ccc771db5e32',
    'The Unsold Piece',
    'unsold-piece',
    'object',
    'The one painting that didn''t sell. It''s the most personal one in the show.',
    NULL,
    NULL,
    'character_initiated',
    3,
    false,
    1
),
(
    '399a8b35-3f6e-4598-9bf4-ccc771db5e32',
    'Red Dot Stickers',
    'red-dots',
    'object',
    'Sold stickers. He''s holding one, looking at the unsold piece.',
    NULL,
    NULL,
    'character_initiated',
    5,
    true,
    2
);

-- Episode: New Canvas (offering him a show)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '58059439-c720-48a9-8066-b430270233bd',
    'Exhibition Contract',
    'exhibition-contract',
    'document',
    'A contract for his own show at your gallery. This would change everything for him.',
    'APERTURE GALLERY | Artist Exhibition Agreement | Artist: [His name] | Exhibition: Solo Show | Duration: 6 weeks | Gallery percentage: [crossed out, written "negotiable"] | Handwritten: "Your work deserves walls, not skin."',
    'typed',
    'automatic',
    3,
    true,
    1
);

-- Episode: The Gallery Question (defining what this is)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'b36eff00-48d2-483d-9ec6-e8f85f4f9b7c',
    'His Final Sketch',
    'final-sketch',
    'document',
    'The last page in his sketchbook. It''s a tattoo design—for himself.',
    '[Sketch] Two intertwined brushes/needles forming a heart | Caption: "Some art is permanent"',
    'handwritten',
    'character_initiated',
    5,
    true,
    1
);

-- ============================================================================
-- PENTHOUSE SECRETS (dark_romance)
-- Props: Contracts, keys, evidence of power dynamics
-- ============================================================================

-- Episode: Summoned (receiving the invitation)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '16191420-492f-40e7-be37-dea29a109b74',
    'The Summons',
    'the-summons',
    'document',
    'A handwritten note delivered by courier. Expensive paper. No name signed.',
    'Penthouse. Tonight. 9PM. Dress appropriately. We have matters to discuss regarding your brother''s debt.',
    'handwritten',
    'automatic',
    2,
    true,
    1
);

-- Episode: His Rules (learning the arrangement)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '4d241b42-2f8c-4f9e-9c3c-1f8a818f88ad',
    'The Contract',
    'the-contract',
    'document',
    'A formal agreement. The terms are unconventional.',
    'PRIVATE AGREEMENT | Party A shall provide: debt forgiveness | Party B shall provide: companionship as specified | Duration: 90 days | Termination: Either party, any time | Clause 7: All arrangements remain confidential | [Unsigned]',
    'typed',
    'automatic',
    3,
    true,
    1
),
(
    '4d241b42-2f8c-4f9e-9c3c-1f8a818f88ad',
    'The Keycard',
    'penthouse-keycard',
    'object',
    'A black keycard with no marking. It opens only one door in the city.',
    NULL,
    NULL,
    'character_initiated',
    5,
    false,
    2
);

-- Episode: The Drop (glimpsing his vulnerability)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '81807777-9dbb-418e-bc49-0e071c757fc3',
    'Old Photograph',
    'old-photograph',
    'photo',
    'A photo you weren''t meant to see. A younger version of him, smiling. Someone''s arm around his shoulder, cropped out.',
    NULL,
    NULL,
    'character_initiated',
    4,
    true,
    1
),
(
    '81807777-9dbb-418e-bc49-0e071c757fc3',
    'Prescription Bottle',
    'prescription',
    'object',
    'Medication on his nightstand. The label is for anxiety.',
    NULL,
    NULL,
    'character_initiated',
    5,
    true,
    2
);

-- Episode: Caught (someone discovers the arrangement)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '3e567049-7c8e-40b9-a3ac-f4d3bfdf9185',
    'The Tabloid Photo',
    'tabloid-photo',
    'photo',
    'A blurry photo of you two together. Someone sold it to the press.',
    NULL,
    NULL,
    'automatic',
    2,
    true,
    1
),
(
    '3e567049-7c8e-40b9-a3ac-f4d3bfdf9185',
    'His Text',
    'damage-control-text',
    'digital',
    'A message from him after the photo leaked.',
    '[TEXT] "Stay at the penthouse. Don''t answer your phone. I''m handling this." [UNSENT DRAFTS] "I''m sorry." "This wasn''t supposed to happen." "Are you okay?"',
    'typed',
    'character_initiated',
    4,
    true,
    2
);

-- Episode: Stay (he asks you not to leave)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    'b7d70a64-e481-40ba-9c4a-c8d95cbf7f3b',
    'The Torn Contract',
    'torn-contract',
    'document',
    'The original agreement, ripped in half. He did this himself.',
    '[Torn pieces of the original contract] The signature line is now blank on both halves.',
    'typed',
    'automatic',
    3,
    true,
    1
);

-- Episode: The Price (choosing what matters)
INSERT INTO props (episode_template_id, name, slug, prop_type, description, content, content_format, reveal_mode, reveal_turn_hint, is_key_evidence, display_order)
VALUES
(
    '45b9754b-a4fa-42bd-834e-c0a91896aded',
    'Debt Cancellation',
    'debt-cancellation',
    'document',
    'Official documents cancelling your brother''s debt. Signed a week ago.',
    'DEBT FORGIVENESS NOTICE | Amount: [REDACTED] | Status: FORGIVEN IN FULL | Effective date: [7 days ago] | Note: "This was always about you. The debt was just my excuse to meet you."',
    'typed',
    'character_initiated',
    5,
    true,
    1
),
(
    '45b9754b-a4fa-42bd-834e-c0a91896aded',
    'New Keycard',
    'permanent-keycard',
    'object',
    'A different keycard. This one has your name engraved on it.',
    NULL,
    NULL,
    'character_initiated',
    6,
    false,
    2
);

-- ============================================================================
-- End of props migration
-- ============================================================================
