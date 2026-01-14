-- Migration: 059_guest_sessions
-- Description: Enable guest mode for Episode 0 trials
-- Created: 2026-01-14

-- ============================================================================
-- 1. Make user_id nullable in sessions (allow guest sessions)
-- ============================================================================

ALTER TABLE sessions
ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================================
-- 2. Add guest session tracking columns
-- ============================================================================

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS guest_session_id TEXT,
ADD COLUMN IF NOT EXISTS guest_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS guest_ip_hash TEXT,
ADD COLUMN IF NOT EXISTS guest_converted_at TIMESTAMPTZ;

-- Add constraint: Either user_id OR guest_session_id must be set
-- Add constraint to ensure either user_id or guest_session_id is set
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sessions_user_or_guest_check'
    ) THEN
        ALTER TABLE sessions
        ADD CONSTRAINT sessions_user_or_guest_check
        CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL);
    END IF;
END $$;

-- ============================================================================
-- 3. Indexes for guest session operations
-- ============================================================================

-- Guest session lookup by guest_session_id
CREATE INDEX IF NOT EXISTS idx_sessions_guest_id ON sessions(guest_session_id)
WHERE guest_session_id IS NOT NULL;

-- Guest session cleanup (find expired sessions)
-- Note: Cannot use NOW() in index predicate, so index all guest sessions by created_at
CREATE INDEX IF NOT EXISTS idx_sessions_guest_expired ON sessions(guest_created_at)
WHERE user_id IS NULL;

-- IP-based rate limiting lookups
CREATE INDEX IF NOT EXISTS idx_sessions_guest_ip ON sessions(guest_ip_hash, guest_created_at)
WHERE guest_ip_hash IS NOT NULL;

-- ============================================================================
-- 4. Update RLS policies for guest access
-- ============================================================================

-- Drop existing restrictive policy
DROP POLICY IF EXISTS sessions_select_own ON sessions;
DROP POLICY IF EXISTS episodes_select_own ON sessions;  -- Handle old name

-- New policy: Allow selecting own sessions OR guest sessions by guest_session_id
-- Note: guest_session_id is passed via app-level header validation, not RLS
-- For now, we'll use a simpler approach: authenticated users see theirs, guests handled by app
CREATE POLICY sessions_select_own ON sessions
FOR SELECT USING (
    auth.uid() = user_id  -- Authenticated users see their own
    OR user_id IS NULL    -- Allow reading guest sessions (app validates guest_session_id)
);

-- Update insert policy to allow guest sessions
DROP POLICY IF EXISTS sessions_insert_own ON sessions;
DROP POLICY IF EXISTS episodes_insert_own ON sessions;  -- Handle old name

CREATE POLICY sessions_insert_own ON sessions
FOR INSERT WITH CHECK (
    auth.uid() = user_id  -- Authenticated users create with their user_id
    OR (user_id IS NULL AND guest_session_id IS NOT NULL)  -- Guests create with guest_session_id
);

-- Update policy allows only authenticated users
DROP POLICY IF EXISTS sessions_update_own ON sessions;
DROP POLICY IF EXISTS episodes_update_own ON sessions;  -- Handle old name

CREATE POLICY sessions_update_own ON sessions
FOR UPDATE USING (
    auth.uid() = user_id  -- Only authenticated users can update
);

-- ============================================================================
-- 5. Update messages RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS messages_select_own ON messages;
DROP POLICY IF EXISTS messages_insert_own ON messages;

-- Allow reading messages from both authenticated and guest sessions
CREATE POLICY messages_select_own ON messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM sessions
        WHERE sessions.id = messages.episode_id
        AND (
            sessions.user_id = auth.uid()  -- Authenticated user's session
            OR sessions.user_id IS NULL    -- Guest session (app-level validation)
        )
    )
);

-- Allow inserting messages to both authenticated and guest sessions
CREATE POLICY messages_insert_own ON messages
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM sessions
        WHERE sessions.id = messages.episode_id
        AND (
            sessions.user_id = auth.uid()
            OR sessions.user_id IS NULL
        )
    )
);

-- ============================================================================
-- 6. Guest session cleanup function
-- ============================================================================

-- Function to delete expired guest sessions (>24 hours old, not converted)
CREATE OR REPLACE FUNCTION cleanup_expired_guest_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete guest sessions older than 24 hours that haven't been converted
    DELETE FROM sessions
    WHERE user_id IS NULL
    AND guest_session_id IS NOT NULL
    AND guest_created_at < NOW() - INTERVAL '24 hours'
    AND guest_converted_at IS NULL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for manual cleanup if needed)
GRANT EXECUTE ON FUNCTION cleanup_expired_guest_sessions() TO authenticated;

-- ============================================================================
-- 7. Add comment for documentation
-- ============================================================================

COMMENT ON COLUMN sessions.guest_session_id IS
'UUID stored in client localStorage for guest session continuity. NULL for authenticated sessions.';

COMMENT ON COLUMN sessions.guest_ip_hash IS
'SHA256 hash of client IP for rate limiting (3 sessions per IP per 24h). NULL for authenticated sessions.';

COMMENT ON COLUMN sessions.guest_created_at IS
'Timestamp when guest session was created. Used for expiration (24h). NULL for authenticated sessions.';

COMMENT ON COLUMN sessions.guest_converted_at IS
'Timestamp when guest session was converted to authenticated session. NULL if not converted.';

COMMENT ON FUNCTION cleanup_expired_guest_sessions() IS
'Deletes guest sessions older than 24 hours that have not been converted. Returns count of deleted sessions. Should be run daily via cron.';
