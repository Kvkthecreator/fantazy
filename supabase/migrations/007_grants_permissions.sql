-- Migration: 007_grants_permissions
-- Description: Add proper GRANTS for service_role and authenticated users

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant sequence usage (for gen_random_uuid, etc.)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ============================================================================
-- USERS table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT ALL ON users TO service_role;

-- ============================================================================
-- WORLDS table (read-only for users)
-- ============================================================================
GRANT SELECT ON worlds TO authenticated;
GRANT ALL ON worlds TO service_role;

-- ============================================================================
-- CHARACTERS table (read-only for users)
-- ============================================================================
GRANT SELECT ON characters TO authenticated;
GRANT ALL ON characters TO service_role;

-- ============================================================================
-- RELATIONSHIPS table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON relationships TO authenticated;
GRANT ALL ON relationships TO service_role;

-- ============================================================================
-- EPISODES table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON episodes TO authenticated;
GRANT ALL ON episodes TO service_role;

-- ============================================================================
-- MESSAGES table
-- ============================================================================
GRANT SELECT, INSERT ON messages TO authenticated;
GRANT ALL ON messages TO service_role;

-- ============================================================================
-- MEMORY_EVENTS table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON memory_events TO authenticated;
GRANT ALL ON memory_events TO service_role;

-- ============================================================================
-- HOOKS table
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON hooks TO authenticated;
GRANT ALL ON hooks TO service_role;

-- ============================================================================
-- Functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_relevant_memories(UUID, UUID, vector, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_active_hooks(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_episode_message_count() TO service_role;
GRANT EXECUTE ON FUNCTION update_relationship_on_episode_end() TO service_role;

-- ============================================================================
-- Default privileges for future tables
-- ============================================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE ON SEQUENCES TO authenticated, service_role;
