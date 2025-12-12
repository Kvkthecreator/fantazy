-- Migration: 013_lemonsqueezy_subscription
-- Description: Add Lemon Squeezy subscription tracking to users table

-- Add Lemon Squeezy customer and subscription IDs
ALTER TABLE users ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id TEXT;

-- Index for lookups by LS IDs
CREATE INDEX IF NOT EXISTS idx_users_ls_customer ON users(lemonsqueezy_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_ls_subscription ON users(lemonsqueezy_subscription_id);

-- Subscription events log for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,  -- 'created', 'updated', 'cancelled', 'resumed', 'expired', 'payment_failed', 'payment_success'
    event_source TEXT NOT NULL DEFAULT 'lemonsqueezy',
    ls_subscription_id TEXT,
    ls_customer_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying events by user
CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created ON subscription_events(created_at DESC);

-- Enable RLS on subscription_events
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription events
CREATE POLICY subscription_events_select_own ON subscription_events
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert (webhooks come through backend)
-- No insert policy for regular users - backend uses service role

COMMENT ON TABLE subscription_events IS 'Audit log of subscription lifecycle events from Lemon Squeezy';
COMMENT ON COLUMN users.lemonsqueezy_customer_id IS 'Lemon Squeezy customer ID for this user';
COMMENT ON COLUMN users.lemonsqueezy_subscription_id IS 'Active Lemon Squeezy subscription ID';
