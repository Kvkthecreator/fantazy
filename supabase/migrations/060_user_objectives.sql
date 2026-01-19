-- Migration: 060_user_objectives.sql
-- User Objectives System (ADR-008)
-- Adds user-facing objectives, success/failure conditions, consequences, and choice points

-- User-facing objective (what the user is trying to achieve)
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS user_objective TEXT;

-- Optional hint to help users (displayed in UI)
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS user_hint TEXT;

-- Success condition format: semantic:<criteria>, keyword:<words>, turn:<N>, flag:<name>
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS success_condition TEXT;

-- Failure condition (default: turn budget exceeded)
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS failure_condition TEXT DEFAULT 'turn_budget_exceeded';

-- Consequences on success: { "set_flag": "flag_name", "suggest_episode": "episode_id" }
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS on_success JSONB DEFAULT '{}';

-- Consequences on failure: { "set_flag": "flag_name", "suggest_episode": "episode_id" }
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS on_failure JSONB DEFAULT '{}';

-- Choice points: interactive decision moments
-- Format: [{ "id": "choice_id", "trigger": "turn:5", "prompt": "...", "choices": [...] }]
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS choice_points JSONB DEFAULT '[]';

-- Flag-based context injection rules
-- Format: [{ "if_flag": "flag_name", "inject": "context string" }]
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS flag_context_rules JSONB DEFAULT '[]';

-- Add comments for documentation
COMMENT ON COLUMN episode_templates.user_objective IS 'User-facing objective displayed in chat UI (ADR-008)';
COMMENT ON COLUMN episode_templates.user_hint IS 'Optional hint to help users achieve the objective';
COMMENT ON COLUMN episode_templates.success_condition IS 'Condition format: semantic:<criteria>, keyword:<words>, turn:<N>, flag:<name>';
COMMENT ON COLUMN episode_templates.failure_condition IS 'Condition for objective failure, defaults to turn_budget_exceeded';
COMMENT ON COLUMN episode_templates.on_success IS 'Actions on success: set_flag, suggest_episode';
COMMENT ON COLUMN episode_templates.on_failure IS 'Actions on failure: set_flag, suggest_episode';
COMMENT ON COLUMN episode_templates.choice_points IS 'Interactive choice moments: [{id, trigger, prompt, choices}]';
COMMENT ON COLUMN episode_templates.flag_context_rules IS 'Context injection based on flags: [{if_flag, inject}]';
