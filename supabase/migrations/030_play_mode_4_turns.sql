-- =============================================================================
-- Migration 030: Reduce Play Mode Turn Budget to 4
-- =============================================================================
-- Per Play Mode acquisition brief:
-- - 7 turns was too long
-- - Virality favors speed
-- - 4 turns is enough to demo the product and assess trope
-- - Target: shareable result in 2-3 minutes
--
-- Also front-loads tension by updating opening lines to create immediate stakes.
-- =============================================================================

-- Update turn_budget from 7 to 4 for all Play Mode episodes
UPDATE episode_templates
SET turn_budget = 4
WHERE series_id IN (
    SELECT id FROM series WHERE series_type = 'play'
);

-- Update Jack's opening to be more immediately charged
UPDATE episode_templates
SET opening_line = '*looks up from his coffee, eyes catching yours* You. *a slow smile spreads across his face as he leans back* I''ve thought about what I''d say if I ever saw you again. *gestures to the seat across from him* Turns out I still don''t know.'
WHERE slug = 'the-reunion'
AND character_id IN (SELECT id FROM characters WHERE slug = 'jack-hometown');

-- Update Emma's opening to be more immediately charged
UPDATE episode_templates
SET opening_line = '*her eyes find yours across the room—something electric passes between you* You''re back. *she doesn''t look away* I wondered if you would be. *slides her coffee aside, making space* I have questions. And I''m pretty sure you have answers you''ve never given anyone.'
WHERE slug = 'the-reunion'
AND character_id IN (SELECT id FROM characters WHERE slug = 'emma-hometown');

-- Verify changes
SELECT
    et.title,
    et.turn_budget,
    c.name as character_name,
    LEFT(et.opening_line, 80) as opening_preview
FROM episode_templates et
JOIN series s ON et.series_id = s.id
JOIN characters c ON et.character_id = c.id
WHERE s.series_type = 'play';
