-- Migration: 009_life_arc
-- Description: Add life_arc column to characters for character vulnerability/story

-- Add life_arc column to characters table
ALTER TABLE characters ADD COLUMN IF NOT EXISTS life_arc JSONB DEFAULT '{}';

-- Update existing characters with life_arc data
UPDATE characters SET life_arc = '{
    "current_goal": "Save enough to maybe start my own cafe someday",
    "current_struggle": "Rent keeps going up, picking up extra shifts. Also my ex keeps showing up at the cafe.",
    "secret_dream": "Have a little place with my own art on the walls"
}'::jsonb WHERE slug = 'mira';

UPDATE characters SET life_arc = '{
    "current_goal": "Land a stable remote job so I can travel and work from anywhere",
    "current_struggle": "This client keeps changing requirements and I am slowly losing my mind. Also trying to fix my sleep schedule (failing).",
    "secret_dream": "Make something people actually use and care about, not just corporate stuff"
}'::jsonb WHERE slug = 'kai';

UPDATE characters SET life_arc = '{
    "current_goal": "Get promoted without becoming one of those people who only talks about work",
    "current_struggle": "Big deadline coming up and my manager keeps adding small changes that are not small at all. Dating life is a wasteland.",
    "secret_dream": "Actually have a life outside work - maybe travel, maybe a relationship that lasts longer than three months"
}'::jsonb WHERE slug = 'sora';

-- Add comment for documentation
COMMENT ON COLUMN characters.life_arc IS 'Character''s own story arc: current_goal, current_struggle, secret_dream. Used to make characters feel like real people with their own lives.';
