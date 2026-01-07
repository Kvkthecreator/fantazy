-- Migration: 055_security_fixes.sql
-- Purpose: Fix Supabase security linter warnings
-- Date: 2025-01-07
--
-- Fixes:
-- 1. user_usage_stats view - change from SECURITY DEFINER to SECURITY INVOKER
-- 2. user_credits_stats view - change from SECURITY DEFINER to SECURITY INVOKER
-- 3. episode_templates table - enable RLS
--
-- Reference: Supabase Database Linter
-- https://supabase.com/docs/guides/database/database-linter

-- ============================================================================
-- FIX 1: Recreate user_usage_stats view with SECURITY INVOKER
-- ============================================================================
-- This view was created in 014_usage_tracking.sql without explicit security mode,
-- defaulting to SECURITY DEFINER which bypasses RLS of the querying user.
-- Changing to SECURITY INVOKER ensures RLS policies of the `users` table apply.

DROP VIEW IF EXISTS user_usage_stats;

CREATE VIEW user_usage_stats
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW user_usage_stats IS 'User usage stats view (SECURITY INVOKER - respects RLS)';

-- ============================================================================
-- FIX 2: Recreate user_credits_stats view with SECURITY INVOKER
-- ============================================================================
-- This view was created in 016_credits_system.sql without explicit security mode.
-- Changing to SECURITY INVOKER ensures only authorized data is returned.

DROP VIEW IF EXISTS user_credits_stats;

CREATE VIEW user_credits_stats
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW user_credits_stats IS 'User credits stats view (SECURITY INVOKER - respects RLS)';

-- ============================================================================
-- FIX 3: Enable RLS on episode_templates
-- ============================================================================
-- episode_templates is exposed to PostgREST but had RLS disabled.
-- This table contains canonical content that should be publicly readable
-- but not modifiable by regular users.

ALTER TABLE episode_templates ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read active episode templates
-- (This matches the pattern used for series, characters, worlds)
DROP POLICY IF EXISTS episode_templates_select_public ON episode_templates;
CREATE POLICY episode_templates_select_public ON episode_templates
    FOR SELECT
    TO authenticated
    USING (status = 'active' OR status IS NULL);  -- Allow both active and NULL (legacy)

-- Policy: Service role can do everything (for admin/backend operations)
-- Note: service_role bypasses RLS by default, but explicit policy for clarity

-- Grant appropriate permissions
GRANT SELECT ON episode_templates TO authenticated;
GRANT ALL ON episode_templates TO service_role;

COMMENT ON TABLE episode_templates IS 'Episode templates with RLS enabled - public read for active content';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    usage_view_security TEXT;
    credits_view_security TEXT;
    episode_rls_enabled BOOLEAN;
BEGIN
    -- Check user_usage_stats security
    SELECT CASE
        WHEN v.relrowsecurity THEN 'SECURITY INVOKER'
        ELSE 'Check pg_views'
    END INTO usage_view_security
    FROM pg_class v
    JOIN pg_namespace n ON v.relnamespace = n.oid
    WHERE v.relname = 'user_usage_stats' AND n.nspname = 'public';

    -- Check user_credits_stats security
    SELECT CASE
        WHEN v.relrowsecurity THEN 'SECURITY INVOKER'
        ELSE 'Check pg_views'
    END INTO credits_view_security
    FROM pg_class v
    JOIN pg_namespace n ON v.relnamespace = n.oid
    WHERE v.relname = 'user_credits_stats' AND n.nspname = 'public';

    -- Check episode_templates RLS
    SELECT relrowsecurity INTO episode_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'episode_templates' AND n.nspname = 'public';

    IF NOT episode_rls_enabled THEN
        RAISE EXCEPTION 'Migration failed: episode_templates RLS not enabled';
    END IF;

    RAISE NOTICE 'Migration 055_security_fixes completed successfully';
    RAISE NOTICE '  - user_usage_stats: recreated with SECURITY INVOKER';
    RAISE NOTICE '  - user_credits_stats: recreated with SECURITY INVOKER';
    RAISE NOTICE '  - episode_templates: RLS enabled with public read policy';
END $$;
