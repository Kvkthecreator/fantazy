-- Migration: 018_assign_seed_characters
-- Description: Assign existing seed characters to the creator account
-- This makes the seed characters visible in the Studio for management

-- Find the user by email and assign all unowned characters to them
-- Using kvkthecreator@gmail.com as the studio owner

UPDATE characters
SET created_by = (
    SELECT id FROM users WHERE id IN (
        SELECT id FROM auth.users WHERE email = 'kvkthecreator@gmail.com'
    )
)
WHERE created_by IS NULL;

-- Also backfill the new fields for existing characters that don't have them
UPDATE characters
SET
    status = COALESCE(status, CASE WHEN is_active THEN 'active' ELSE 'draft' END),
    content_rating = COALESCE(content_rating, 'sfw'),
    categories = COALESCE(categories, '{}')
WHERE status IS NULL OR content_rating IS NULL;

-- Set opening_situation and opening_line from existing data if not set
-- For Mira - extract from her character setup
UPDATE characters
SET
    opening_situation = 'You walk into Crescent Cafe during a quiet afternoon. The smell of fresh coffee fills the air, and soft lo-fi music plays in the background. The barista behind the counter looks up as the door chimes.',
    opening_line = 'oh hey~ wasn''t sure i''d see you today. the usual?'
WHERE slug = 'mira' AND opening_situation IS NULL;

-- For Kai
UPDATE characters
SET
    opening_situation = 'You bump into your neighbor in the hallway of Greenview Apartments. They''re carrying a bag of takeout and have headphones around their neck.',
    opening_line = 'oh hey. you''re up late too huh'
WHERE slug = 'kai' AND opening_situation IS NULL;
