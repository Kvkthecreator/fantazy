-- Migration: 014_usage_tracking
-- Description: Add usage tracking for metered features (Flux generations, messages)

-- Add usage tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS flux_generations_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS flux_generations_reset_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS messages_sent_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS messages_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Usage events table for analytics and debugging
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,  -- 'flux_generation', 'message_sent'
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_type ON usage_events(user_id, event_type, created_at DESC);

-- Enable RLS on usage_events
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage events
CREATE POLICY usage_events_select_own ON usage_events
    FOR SELECT USING (auth.uid() = user_id);

-- Function to get user's Flux quota based on subscription status
CREATE OR REPLACE FUNCTION get_flux_quota(sub_status TEXT)
RETURNS INTEGER AS $$
BEGIN
    CASE sub_status
        WHEN 'premium' THEN RETURN 50;
        WHEN 'free' THEN RETURN 5;
        ELSE RETURN 5;  -- Default to free tier
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- View for current usage stats (convenience for debugging/admin)
CREATE OR REPLACE VIEW user_usage_stats AS
SELECT
    u.id,
    u.display_name,
    u.subscription_status,
    u.flux_generations_used,
    get_flux_quota(u.subscription_status) as flux_quota,
    GREATEST(0, get_flux_quota(u.subscription_status) - COALESCE(u.flux_generations_used, 0)) as flux_remaining,
    u.flux_generations_reset_at,
    u.messages_sent_count,
    u.messages_reset_at,
    u.subscription_expires_at
FROM users u;

-- ============================================================================
-- GRANTS for usage_events
-- ============================================================================
-- Backend uses service_role for inserts (via DATABASE_URL with service role)
-- Users can only read their own events (via RLS policy above)
GRANT SELECT ON usage_events TO authenticated;
GRANT ALL ON usage_events TO service_role;

-- Grant execute on quota function
GRANT EXECUTE ON FUNCTION get_flux_quota(TEXT) TO authenticated, service_role;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE usage_events IS 'Audit log of metered feature usage (Flux generations, messages)';
COMMENT ON COLUMN users.flux_generations_used IS 'Number of Flux image generations used in current billing period';
COMMENT ON COLUMN users.flux_generations_reset_at IS 'When the Flux generation counter was last reset';
COMMENT ON COLUMN users.messages_sent_count IS 'Number of messages sent in current period (tracking only, not enforced)';
COMMENT ON COLUMN users.messages_reset_at IS 'When the message counter was last reset';
COMMENT ON FUNCTION get_flux_quota IS 'Returns the Flux generation quota based on subscription status';
