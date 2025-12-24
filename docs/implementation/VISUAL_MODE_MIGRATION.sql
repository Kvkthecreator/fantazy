-- Visual Mode Migration Script
-- Phase 3: Update all paid episodes to cinematic mode (database migration)
-- Date: 2024-12-24
-- Purpose: Implement hybrid visual_mode architecture with episode defaults

-- =============================================================================
-- STEP 1: Check current state
-- =============================================================================

-- Count episodes by visual_mode and cost
SELECT
    visual_mode,
    episode_cost,
    COUNT(*) as episode_count
FROM episode_templates
GROUP BY visual_mode, episode_cost
ORDER BY episode_cost, visual_mode;

-- =============================================================================
-- STEP 2: Update paid episodes to cinematic (episode_cost > 0)
-- =============================================================================

-- Set all paid episodes (episode_cost > 0) to cinematic with budget of 3
UPDATE episode_templates
SET
    visual_mode = 'cinematic',
    generation_budget = 3
WHERE
    episode_cost > 0
    AND visual_mode != 'cinematic';

-- Verify update
SELECT
    'Paid episodes updated' as action,
    COUNT(*) as count
FROM episode_templates
WHERE episode_cost > 0 AND visual_mode = 'cinematic';

-- =============================================================================
-- STEP 3: Update Episode 0 (free entry) to cinematic with lower budget
-- =============================================================================

-- Set Episode 0 (free episodes) to cinematic but with budget of 2 (cost control)
UPDATE episode_templates
SET
    visual_mode = 'cinematic',
    generation_budget = 2
WHERE
    episode_cost = 0
    AND title ILIKE '%episode 0%'
    AND visual_mode != 'cinematic';

-- Verify update
SELECT
    'Episode 0 updated' as action,
    COUNT(*) as count
FROM episode_templates
WHERE episode_cost = 0 AND title ILIKE '%episode 0%' AND visual_mode = 'cinematic';

-- =============================================================================
-- STEP 4: Keep Play Mode as-is (already free with cinematic)
-- =============================================================================

-- Play Mode episodes should already be:
-- - episode_cost = 0
-- - visual_mode = 'cinematic'
-- - generation_budget = 3-4

-- Verify Play Mode episodes
SELECT
    'Play Mode check' as action,
    title,
    visual_mode,
    generation_budget,
    episode_cost
FROM episode_templates
WHERE title ILIKE '%play mode%';

-- =============================================================================
-- STEP 5: Final verification
-- =============================================================================

-- Count episodes by visual_mode and cost (after migration)
SELECT
    CASE
        WHEN episode_cost = 0 THEN 'Free'
        ELSE 'Paid'
    END as cost_tier,
    visual_mode,
    generation_budget,
    COUNT(*) as episode_count
FROM episode_templates
GROUP BY cost_tier, visual_mode, generation_budget
ORDER BY cost_tier, visual_mode;

-- Check for any outliers (episodes that don't fit expected pattern)
SELECT
    title,
    episode_cost,
    visual_mode,
    generation_budget,
    CASE
        WHEN episode_cost > 0 AND visual_mode != 'cinematic' THEN 'Paid should be cinematic'
        WHEN episode_cost > 0 AND generation_budget < 3 THEN 'Paid budget should be 3'
        WHEN episode_cost = 0 AND visual_mode = 'none' THEN 'Free episode with no visuals'
        ELSE 'OK'
    END as status
FROM episode_templates
WHERE
    (episode_cost > 0 AND visual_mode != 'cinematic')
    OR (episode_cost > 0 AND generation_budget < 3)
    OR (episode_cost = 0 AND visual_mode = 'none');

-- =============================================================================
-- Expected Results After Migration:
-- =============================================================================
--
-- Paid Episodes (episode_cost > 0):
--   visual_mode = 'cinematic', generation_budget = 3
--   Rationale: Auto-gen included in episode price, users expect visuals
--
-- Episode 0 (free entry):
--   visual_mode = 'cinematic', generation_budget = 2
--   Rationale: Showcase visual experience, lower budget for cost control
--
-- Play Mode (free):
--   visual_mode = 'cinematic', generation_budget = 3-4 (varies)
--   Rationale: Already free, good showcase for platform
--
-- User Override:
--   Users can now set visual_mode_override in preferences:
--   - "always_off": Text-only (accessibility/performance)
--   - "always_on": Maximum visuals (upgrade none→minimal→cinematic)
--   - "episode_default" or null: Respect creator's intent (default)
-- =============================================================================
