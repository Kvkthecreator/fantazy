-- Add constraint: Episode 0 requires role_id
-- Generated: 2026-01-12
--
-- This prevents future Episode 0s from being created without roles.
-- If this constraint fails, it means there are still Episode 0s without roles.
-- Run check_episode_health.py to find them, then fix before applying this constraint.

ALTER TABLE episode_templates
ADD CONSTRAINT ep0_requires_role
CHECK (episode_number != 0 OR role_id IS NOT NULL);

-- Verify constraint was added
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'ep0_requires_role';
