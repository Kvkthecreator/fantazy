-- Migration: 016_credits_system
-- Description: Implement Sparks credits system with rate limiting and abuse prevention
-- See: docs/monetization/CREDITS_SYSTEM_PROPOSAL.md

-- ============================================================================
-- CREDITS SYSTEM TABLES
-- ============================================================================

-- Credits ledger - immutable transaction log
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Transaction details
    amount INTEGER NOT NULL,              -- Positive = credit, Negative = debit
    balance_after INTEGER NOT NULL,       -- Running balance for auditability

    -- Transaction type
    transaction_type TEXT NOT NULL,

    -- Reference to source
    reference_type TEXT,                  -- 'subscription', 'purchase', 'generation', 'promotion'
    reference_id TEXT,                    -- ID of related entity

    -- Metadata
    description TEXT,                     -- Human-readable description
    metadata JSONB DEFAULT '{}',          -- Additional context

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,               -- Optional expiry for granted credits

    CONSTRAINT valid_transaction_type CHECK (
        transaction_type IN (
            'subscription_grant',
            'topup_purchase',
            'generation_spend',
            'refund',
            'bonus',
            'expiry',
            'admin_adjustment'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON credit_transactions(user_id, created_at DESC);

-- Top-up purchases tracking
CREATE TABLE IF NOT EXISTS topup_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Lemon Squeezy reference
    ls_order_id TEXT UNIQUE,
    ls_variant_id TEXT NOT NULL,

    -- Purchase details
    pack_name TEXT NOT NULL,              -- 'starter', 'popular', 'best_value'
    sparks_amount INTEGER NOT NULL,       -- Total sparks granted
    price_cents INTEGER NOT NULL,         -- Price paid in cents
    currency TEXT DEFAULT 'USD',

    -- Status
    status TEXT DEFAULT 'completed',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_topup_status CHECK (status IN ('pending', 'completed', 'refunded'))
);

CREATE INDEX IF NOT EXISTS idx_topup_purchases_user_id ON topup_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_topup_purchases_created ON topup_purchases(created_at DESC);

-- Credit cost configuration (admin-adjustable feature pricing)
CREATE TABLE IF NOT EXISTS credit_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    feature_key TEXT UNIQUE NOT NULL,     -- 'flux_generation', 'video_generation', etc.
    display_name TEXT NOT NULL,           -- 'Image Generation'
    spark_cost INTEGER NOT NULL,          -- Cost in sparks (0 = free)

    -- Feature flags
    is_active BOOLEAN DEFAULT true,
    premium_only BOOLEAN DEFAULT false,

    -- Metadata
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default costs
-- NOTE: chat_message is explicitly 0 (FREE) - see Section 2.1 of CREDITS_SYSTEM_PROPOSAL.md
INSERT INTO credit_costs (feature_key, display_name, spark_cost, description) VALUES
    ('chat_message', 'Chat Message', 0, 'Send a message (FREE - deliberate decision, see docs)'),
    ('flux_generation', 'Image Generation', 1, 'Generate a custom scene image'),
    ('video_generation', 'Video Generation', 15, 'Generate a short video clip (future)'),
    ('voice_message', 'Voice Message', 1, 'Generate a voice message from companion (future)')
ON CONFLICT (feature_key) DO NOTHING;

-- ============================================================================
-- USER TABLE MODIFICATIONS
-- ============================================================================

-- Add spark balance columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS spark_balance INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_sparks_earned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_sparks_spent INTEGER DEFAULT 0;

-- ============================================================================
-- ABUSE PREVENTION TABLES
-- ============================================================================

-- Abuse flags table for tracking suspicious activity
CREATE TABLE IF NOT EXISTS abuse_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    flag_type TEXT NOT NULL,              -- 'rate_spike', 'sustained_volume', 'burst_pattern', 'duplicate_spam'
    severity TEXT DEFAULT 'low',          -- 'low', 'medium', 'high', 'critical'

    details JSONB DEFAULT '{}',           -- Context about the flag
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,                     -- Admin who resolved
    resolution_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_flag_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_abuse_flags_user_id ON abuse_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_unresolved ON abuse_flags(resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_abuse_flags_created ON abuse_flags(created_at DESC);

-- Add throttle columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_throttled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS throttled_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS abuse_score INTEGER DEFAULT 0;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get spark cost for a feature
CREATE OR REPLACE FUNCTION get_spark_cost(p_feature_key TEXT)
RETURNS INTEGER AS $$
    SELECT COALESCE(spark_cost, 0)
    FROM credit_costs
    WHERE feature_key = p_feature_key AND is_active = true;
$$ LANGUAGE sql STABLE;

-- Function to calculate user's spark balance from transactions (for consistency checks)
CREATE OR REPLACE FUNCTION calculate_spark_balance(p_user_id UUID)
RETURNS INTEGER AS $$
    SELECT COALESCE(SUM(amount), 0)::INTEGER
    FROM credit_transactions
    WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- Function to get spark quota based on subscription (for subscription grants)
CREATE OR REPLACE FUNCTION get_spark_quota(sub_status TEXT)
RETURNS INTEGER AS $$
BEGIN
    CASE sub_status
        WHEN 'premium' THEN RETURN 100;
        WHEN 'free' THEN RETURN 5;
        ELSE RETURN 5;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- VIEW FOR ADMIN/DEBUGGING
-- ============================================================================

CREATE OR REPLACE VIEW user_credits_stats AS
SELECT
    u.id,
    u.display_name,
    u.subscription_status,
    u.spark_balance,
    u.lifetime_sparks_earned,
    u.lifetime_sparks_spent,
    u.is_throttled,
    u.throttled_until,
    u.abuse_score,
    (SELECT COUNT(*) FROM credit_transactions WHERE user_id = u.id) as total_transactions,
    (SELECT COUNT(*) FROM topup_purchases WHERE user_id = u.id AND status = 'completed') as total_purchases
FROM users u;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE topup_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_flags ENABLE ROW LEVEL SECURITY;

-- Credit transactions: users can read their own
CREATE POLICY credit_transactions_select_own ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Topup purchases: users can read their own
CREATE POLICY topup_purchases_select_own ON topup_purchases
    FOR SELECT USING (auth.uid() = user_id);

-- Credit costs: everyone can read (public pricing)
CREATE POLICY credit_costs_select_all ON credit_costs
    FOR SELECT USING (true);

-- Abuse flags: only service_role can access (admin only)
-- No policies for authenticated - they shouldn't see their own flags

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Credit transactions
GRANT SELECT ON credit_transactions TO authenticated;
GRANT ALL ON credit_transactions TO service_role;

-- Topup purchases
GRANT SELECT ON topup_purchases TO authenticated;
GRANT ALL ON topup_purchases TO service_role;

-- Credit costs (read-only for all)
GRANT SELECT ON credit_costs TO authenticated, anon;
GRANT ALL ON credit_costs TO service_role;

-- Abuse flags (service_role only)
GRANT ALL ON abuse_flags TO service_role;

-- Functions
GRANT EXECUTE ON FUNCTION get_spark_cost(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION calculate_spark_balance(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_spark_quota(TEXT) TO authenticated, service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE credit_transactions IS 'Immutable ledger of all spark credit transactions';
COMMENT ON TABLE topup_purchases IS 'Record of one-time spark pack purchases';
COMMENT ON TABLE credit_costs IS 'Configuration table for feature spark costs (admin-adjustable)';
COMMENT ON TABLE abuse_flags IS 'Flags for suspicious user activity patterns';

COMMENT ON COLUMN users.spark_balance IS 'Current spark balance (denormalized for performance)';
COMMENT ON COLUMN users.lifetime_sparks_earned IS 'Total sparks ever earned (subscriptions + purchases + bonuses)';
COMMENT ON COLUMN users.lifetime_sparks_spent IS 'Total sparks ever spent on features';
COMMENT ON COLUMN users.is_throttled IS 'Whether user is currently rate-limited due to abuse';
COMMENT ON COLUMN users.throttled_until IS 'When the throttle expires';
COMMENT ON COLUMN users.abuse_score IS 'Running abuse score for flagging';

COMMENT ON COLUMN credit_costs.spark_cost IS 'Cost in sparks. 0 = free (e.g., chat messages)';
COMMENT ON FUNCTION get_spark_cost IS 'Get the spark cost for a feature by key';
COMMENT ON FUNCTION get_spark_quota IS 'Get monthly spark quota based on subscription status';
