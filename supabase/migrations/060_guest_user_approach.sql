-- Migration: 060_guest_user_approach
-- Description: Switch guest sessions from user_id=NULL to shared GUEST_USER_ID
-- Created: 2026-01-15
--
-- This migration changes the guest session approach:
-- - Instead of user_id=NULL for guests, use a shared GUEST_USER_ID
-- - This allows all existing code paths to work without Optional[UUID] handling
-- - Guest sessions are still isolated by their unique session records and guest_session_id

-- ============================================================================
-- 1. Create the shared guest user record
-- ============================================================================

-- Use a well-known UUID for the guest user
-- UUID: 00000000-0000-0000-0000-000000000001
INSERT INTO users (id, display_name, subscription_status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Guest', 'free')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Update existing guest sessions to use GUEST_USER_ID
-- ============================================================================

UPDATE sessions
SET user_id = '00000000-0000-0000-0000-000000000001'
WHERE user_id IS NULL
AND guest_session_id IS NOT NULL;

-- ============================================================================
-- 3. Drop the old constraint and add NOT NULL back to user_id
-- ============================================================================

-- Drop the old constraint that allowed either user_id or guest_session_id
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_or_guest_check;

-- Make user_id required again (all rows now have a user_id)
ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- 4. Update RLS policies for simpler approach
-- ============================================================================

-- Drop the guest-aware policies
DROP POLICY IF EXISTS sessions_select_own ON sessions;
DROP POLICY IF EXISTS sessions_insert_own ON sessions;
DROP POLICY IF EXISTS sessions_update_own ON sessions;

-- Simpler policy: users see their own sessions OR guest sessions (GUEST_USER_ID)
CREATE POLICY sessions_select_own ON sessions
FOR SELECT USING (
    auth.uid() = user_id
    OR user_id = '00000000-0000-0000-0000-000000000001'  -- Guest sessions visible via app-level auth
);

-- Insert: users can create their own OR guest sessions
CREATE POLICY sessions_insert_own ON sessions
FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR user_id = '00000000-0000-0000-0000-000000000001'
);

-- Update: users can update their own sessions
CREATE POLICY sessions_update_own ON sessions
FOR UPDATE USING (
    auth.uid() = user_id
    OR user_id = '00000000-0000-0000-0000-000000000001'
);

-- ============================================================================
-- 5. Update messages RLS policies
-- ============================================================================

DROP POLICY IF EXISTS messages_select_own ON messages;
DROP POLICY IF EXISTS messages_insert_own ON messages;

-- Messages readable from own sessions or guest sessions
CREATE POLICY messages_select_own ON messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM sessions
        WHERE sessions.id = messages.episode_id
        AND (
            sessions.user_id = auth.uid()
            OR sessions.user_id = '00000000-0000-0000-0000-000000000001'
        )
    )
);

-- Messages insertable to own sessions or guest sessions
CREATE POLICY messages_insert_own ON messages
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM sessions
        WHERE sessions.id = messages.episode_id
        AND (
            sessions.user_id = auth.uid()
            OR sessions.user_id = '00000000-0000-0000-0000-000000000001'
        )
    )
);

-- ============================================================================
-- 6. Update cleanup function
-- ============================================================================

-- Update cleanup function to use GUEST_USER_ID
CREATE OR REPLACE FUNCTION cleanup_expired_guest_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete guest sessions older than 24 hours that haven't been converted
    DELETE FROM sessions
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
    AND guest_session_id IS NOT NULL
    AND guest_created_at < NOW() - INTERVAL '24 hours'
    AND guest_converted_at IS NULL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Update index for guest cleanup
-- ============================================================================

DROP INDEX IF EXISTS idx_sessions_guest_expired;

-- Index for finding expired guest sessions
CREATE INDEX IF NOT EXISTS idx_sessions_guest_expired ON sessions(guest_created_at)
WHERE user_id = '00000000-0000-0000-0000-000000000001';

-- ============================================================================
-- 8. Add documentation
-- ============================================================================

COMMENT ON TABLE users IS
'User accounts. Includes a special GUEST_USER_ID (00000000-0000-0000-0000-000000000001) for anonymous guest sessions.';
