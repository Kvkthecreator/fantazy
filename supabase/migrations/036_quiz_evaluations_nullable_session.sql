-- Migration: 036_quiz_evaluations_nullable_session.sql
-- Purpose: Allow session_evaluations to store quiz results without a real session
-- Reference: Quiz evaluations from /play don't have game sessions
-- Date: 2025-12-22

-- ============================================================================
-- PHASE 1: MAKE session_id NULLABLE
-- ============================================================================

-- Drop the existing foreign key constraint
ALTER TABLE session_evaluations DROP CONSTRAINT IF EXISTS session_evaluations_session_id_fkey;

-- Make session_id nullable (quizzes don't have sessions)
ALTER TABLE session_evaluations ALTER COLUMN session_id DROP NOT NULL;

-- Re-add the foreign key but allow NULL values
ALTER TABLE session_evaluations
ADD CONSTRAINT session_evaluations_session_id_fkey
FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

-- ============================================================================
-- PHASE 2: UPDATE RLS POLICY FOR QUIZ EVALUATIONS
-- ============================================================================

-- Drop the old ownership policy (it requires session lookup)
DROP POLICY IF EXISTS "Users can read own evaluations" ON session_evaluations;

-- Quiz evaluations (no session_id) are publicly readable if they have a share_id
-- This is already covered by "Evaluations with share_id are publicly readable"

-- Users can still read evaluations from their own sessions
CREATE POLICY "Users can read own session evaluations"
    ON session_evaluations FOR SELECT
    USING (
        session_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = session_evaluations.session_id
            AND sessions.user_id = auth.uid()
        )
    );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    is_nullable BOOLEAN;
BEGIN
    SELECT is_nullable = 'YES'
    INTO is_nullable
    FROM information_schema.columns
    WHERE table_name = 'session_evaluations'
    AND column_name = 'session_id';

    IF NOT is_nullable THEN
        RAISE EXCEPTION 'Migration failed: session_id is not nullable';
    END IF;

    RAISE NOTICE 'Migration 036_quiz_evaluations_nullable_session completed successfully';
    RAISE NOTICE 'session_evaluations.session_id is now nullable for quiz evaluations';
END $$;
