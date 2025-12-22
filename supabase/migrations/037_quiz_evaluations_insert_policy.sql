-- Migration: 037_quiz_evaluations_insert_policy.sql
-- Purpose: Allow inserting quiz evaluations without authentication
-- Reference: Quiz evaluations from /play are public endpoints
-- Date: 2025-12-23

-- ============================================================================
-- ADD INSERT POLICY FOR QUIZ EVALUATIONS
-- ============================================================================

-- Quiz evaluations (session_id IS NULL) can be inserted by anyone
-- This supports the public quiz flow where anonymous users take tests
CREATE POLICY "Anyone can insert quiz evaluations"
    ON session_evaluations FOR INSERT
    WITH CHECK (session_id IS NULL);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    policy_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polrelid = 'session_evaluations'::regclass
        AND polname = 'Anyone can insert quiz evaluations'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
        RAISE EXCEPTION 'Migration failed: INSERT policy was not created';
    END IF;

    RAISE NOTICE 'Migration 037_quiz_evaluations_insert_policy completed successfully';
END $$;
