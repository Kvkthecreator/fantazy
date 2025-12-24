-- Migration: 046_memory_series_scoping.sql
-- Purpose: Add series_id to memory_events for series-scoped memory isolation
-- Reference: docs/quality/core/DIRECTOR_PROTOCOL.md v2.3 - Memory & Hook Extraction Ownership
-- Date: 2024-12-24
--
-- CONTEXT:
-- Director Protocol v2.3 moved memory extraction ownership to Director.
-- Memories should be scoped to series (preferred) for narrative isolation.
-- Hooks remain character-scoped (cross-series by design).
--
-- WHAT THIS MIGRATION DOES:
-- 1. Add series_id column to memory_events table
-- 2. Add foreign key constraint to series table
-- 3. Create indexes for efficient series-scoped queries
-- 4. Verify schema state

-- ============================================================================
-- PHASE 1: ADD SERIES_ID COLUMN
-- ============================================================================

ALTER TABLE memory_events
    ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES series(id) ON DELETE SET NULL;

COMMENT ON COLUMN memory_events.series_id IS 'Series-scoped memory isolation (preferred scope). NULL indicates character-scoped fallback for non-series episodes.';

-- ============================================================================
-- PHASE 2: CREATE INDEXES FOR SERIES-SCOPED QUERIES
-- ============================================================================

-- Index for series-scoped memory retrieval
CREATE INDEX IF NOT EXISTS idx_memory_events_series ON memory_events(series_id)
    WHERE series_id IS NOT NULL;

-- Composite index for user + series queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_memory_events_user_series ON memory_events(user_id, series_id)
    WHERE series_id IS NOT NULL;

-- Composite index for character + series queries (series-first retrieval)
CREATE INDEX IF NOT EXISTS idx_memory_events_character_series ON memory_events(character_id, series_id)
    WHERE character_id IS NOT NULL AND series_id IS NOT NULL;

-- ============================================================================
-- PHASE 3: VERIFY SCHEMA STATE
-- ============================================================================

DO $$
DECLARE
    series_id_col BOOLEAN;
    idx_series BOOLEAN;
    idx_user_series BOOLEAN;
BEGIN
    -- Check series_id column exists
    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'memory_events' AND column_name = 'series_id'
    ) INTO series_id_col;

    -- Check series index exists
    SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE tablename = 'memory_events' AND indexname = 'idx_memory_events_series'
    ) INTO idx_series;

    -- Check user+series composite index exists
    SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE tablename = 'memory_events' AND indexname = 'idx_memory_events_user_series'
    ) INTO idx_user_series;

    IF NOT series_id_col THEN
        RAISE EXCEPTION 'Migration failed: series_id column not added to memory_events';
    END IF;

    IF NOT idx_series THEN
        RAISE EXCEPTION 'Migration failed: idx_memory_events_series not created';
    END IF;

    IF NOT idx_user_series THEN
        RAISE EXCEPTION 'Migration failed: idx_memory_events_user_series not created';
    END IF;

    RAISE NOTICE 'Migration 046_memory_series_scoping completed successfully';
    RAISE NOTICE '  - series_id column added to memory_events';
    RAISE NOTICE '  - 3 indexes created for series-scoped queries';
    RAISE NOTICE '  - Series-scoped memory isolation now enabled';
END $$;

-- ============================================================================
-- DOCUMENTATION NOTES
-- ============================================================================

-- Memory Scoping Architecture (Director Protocol v2.3):
--
-- SERIES-SCOPED (Preferred):
--   - Memories belong to "your story with this series"
--   - Isolated per-series to prevent narrative bleed
--   - Director saves with explicit series_id when available
--
-- CHARACTER-SCOPED (Fallback):
--   - Used for free chat mode (no series context)
--   - Shared across all non-series episodes with that character
--   - series_id = NULL indicates character-scoped memory
--
-- HOOKS (Character-scoped always):
--   - Hooks remain character-scoped by design
--   - Personal callbacks transcend series boundaries
--   - No series_id column on hooks table (intentional)
--
-- Director Ownership:
--   - Director.process_exchange() extracts memories after each turn
--   - MemoryService handles storage with series_id scoping
--   - ConversationService._process_exchange() removed (v2.3)
