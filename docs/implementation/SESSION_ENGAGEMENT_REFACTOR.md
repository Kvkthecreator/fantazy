# Session/Engagement Refactor Implementation Plan

**Status:** APPROVED - Ready for Execution

**Scope:** Rename tables and columns to align with EP-01 Episode-First taxonomy; sunset stage progression

**Last Updated:** 2024-12-16

**Related:** `docs/EP-01_pivot_CANON.md` Sections 16-17

---

## Executive Summary

This refactor implements the taxonomy decisions from EP-01:

1. **Rename `episodes` → `sessions`** (runtime conversation instances)
2. **Rename `relationships` → `engagements`** (lightweight user↔character stats)
3. **Drop stage progression columns** (no relationship stages)
4. **Update all foreign key references**

**Data Loss Assessment:** None. All 12 existing relationships have `stage = 'acquaintance'` (default). No user-visible stage progression has been used.

---

## Phase 1: Schema Migration

### 1.1 Rename Tables

```sql
-- Step 1: Rename episodes → sessions
ALTER TABLE episodes RENAME TO sessions;

-- Step 2: Rename relationships → engagements
ALTER TABLE relationships RENAME TO engagements;
```

### 1.2 Rename Columns

```sql
-- In sessions table: relationship_id → engagement_id
ALTER TABLE sessions RENAME COLUMN relationship_id TO engagement_id;

-- In engagements table: total_episodes → total_sessions
ALTER TABLE engagements RENAME COLUMN total_episodes TO total_sessions;

-- Optional: relationship_notes → engagement_notes (or drop)
ALTER TABLE engagements RENAME COLUMN relationship_notes TO engagement_notes;
```

### 1.3 Drop Stage Columns

```sql
-- Drop stage progression from engagements
ALTER TABLE engagements DROP COLUMN IF EXISTS stage;
ALTER TABLE engagements DROP COLUMN IF EXISTS stage_progress;

-- Drop stage thresholds from characters
ALTER TABLE characters DROP COLUMN IF EXISTS relationship_stage_thresholds;
```

### 1.4 Update Foreign Key Names (for clarity)

```sql
-- Update FK constraint names to match new table names
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS episodes_relationship_id_fkey,
  ADD CONSTRAINT sessions_engagement_id_fkey
    FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL;

-- Other FK constraints will auto-update with table rename
```

### 1.5 Update Index Names

```sql
-- Rename indexes to match new table names
ALTER INDEX IF EXISTS episodes_pkey RENAME TO sessions_pkey;
ALTER INDEX IF EXISTS idx_episodes_active RENAME TO idx_sessions_active;
ALTER INDEX IF EXISTS idx_episodes_character RENAME TO idx_sessions_character;
ALTER INDEX IF EXISTS idx_episodes_relationship RENAME TO idx_sessions_engagement;
ALTER INDEX IF EXISTS idx_episodes_started RENAME TO idx_sessions_started;
ALTER INDEX IF EXISTS idx_episodes_template RENAME TO idx_sessions_template;
ALTER INDEX IF EXISTS idx_episodes_user RENAME TO idx_sessions_user;
ALTER INDEX IF EXISTS idx_episodes_user_character RENAME TO idx_sessions_user_character;

ALTER INDEX IF EXISTS relationships_pkey RENAME TO engagements_pkey;
ALTER INDEX IF EXISTS idx_relationships_character RENAME TO idx_engagements_character;
ALTER INDEX IF EXISTS idx_relationships_dynamic RENAME TO idx_engagements_dynamic;
ALTER INDEX IF EXISTS idx_relationships_last_interaction RENAME TO idx_engagements_last_interaction;
ALTER INDEX IF EXISTS idx_relationships_user RENAME TO idx_engagements_user;
ALTER INDEX IF EXISTS idx_relationships_user_active RENAME TO idx_engagements_user_active;
ALTER INDEX IF EXISTS relationships_user_id_character_id_key RENAME TO engagements_user_id_character_id_key;
```

### 1.6 Update RLS Policies

```sql
-- Sessions policies (were episodes_*)
DROP POLICY IF EXISTS episodes_insert_own ON sessions;
DROP POLICY IF EXISTS episodes_select_own ON sessions;
DROP POLICY IF EXISTS episodes_update_own ON sessions;

CREATE POLICY sessions_insert_own ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sessions_select_own ON sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sessions_update_own ON sessions FOR UPDATE USING (auth.uid() = user_id);

-- Engagements policies (were relationships_*)
DROP POLICY IF EXISTS relationships_delete_own ON engagements;
DROP POLICY IF EXISTS relationships_insert_own ON engagements;
DROP POLICY IF EXISTS relationships_select_own ON engagements;
DROP POLICY IF EXISTS relationships_update_own ON engagements;

CREATE POLICY engagements_delete_own ON engagements FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY engagements_insert_own ON engagements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY engagements_select_own ON engagements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY engagements_update_own ON engagements FOR UPDATE USING (auth.uid() = user_id);
```

### 1.7 Update Trigger Function

```sql
-- Update trigger function name and references
ALTER FUNCTION update_relationship_on_episode_end() RENAME TO update_engagement_on_session_end;

-- Update trigger
DROP TRIGGER IF EXISTS episode_end_trigger ON sessions;
CREATE TRIGGER session_end_trigger
  AFTER UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_engagement_on_session_end();
```

---

## Phase 2: Backend Code Updates

### 2.1 Models

| File | Changes |
|------|---------|
| `models/relationship.py` | Rename to `models/engagement.py`, update class names |
| `models/episode.py` | Rename to `models/session.py`, update class names |
| `models/character.py` | Remove `relationship_stage_thresholds` field |

**Key model changes:**

```python
# engagement.py (was relationship.py)
class Engagement(BaseModel):
    id: str
    user_id: str
    character_id: str
    # REMOVED: stage, stage_progress
    total_sessions: int  # was total_episodes
    total_messages: int
    first_met_at: datetime
    last_interaction_at: Optional[datetime]
    # ...

# session.py (was episode.py)
class Session(BaseModel):
    id: str
    user_id: str
    character_id: str
    engagement_id: Optional[str]  # was relationship_id
    episode_template_id: Optional[str]
    # ...
```

### 2.2 Routes

| File | Changes |
|------|---------|
| `routes/relationships.py` | Rename to `routes/engagements.py`, update endpoints |
| `routes/episodes.py` | Rename to `routes/sessions.py`, update endpoints |
| `routes/chat.py` | Update references to sessions/engagements |
| `routes/characters.py` | Remove stage-related logic |

**Endpoint changes:**

| Old Endpoint | New Endpoint |
|--------------|--------------|
| `/relationships` | `/engagements` |
| `/relationships/{id}` | `/engagements/{id}` |
| `/characters/{id}/relationship` | `/characters/{id}/engagement` |
| `/characters/{id}/episodes` | `/characters/{id}/sessions` |
| `/episodes` | `/sessions` |
| `/episodes/{id}` | `/sessions/{id}` |
| `/episodes/{id}/messages` | `/sessions/{id}/messages` |

### 2.3 Services

| File | Changes |
|------|---------|
| `services/episode_service.py` | Rename to `services/session_service.py` |
| `services/relationship_service.py` | Rename to `services/engagement_service.py` |
| `services/chat_service.py` | Update to use new table names |
| `services/memory_service.py` | Update episode_id → session_id references |

### 2.4 SQL Queries

All raw SQL queries need table/column name updates:

```python
# Before
"SELECT * FROM episodes WHERE ..."
"SELECT * FROM relationships WHERE ..."
"... relationship_id ..."
"... total_episodes ..."

# After
"SELECT * FROM sessions WHERE ..."
"SELECT * FROM engagements WHERE ..."
"... engagement_id ..."
"... total_sessions ..."
```

---

## Phase 3: Frontend Code Updates

### 3.1 Types

| File | Changes |
|------|---------|
| `types/index.ts` | Update type names and field names |

```typescript
// Before
interface Relationship { ... }
interface RelationshipWithCharacter { ... }
interface Episode { ... }
interface EpisodeSummary { ... }

// After
interface Engagement {
  // Remove: stage, stage_progress
  total_sessions: number;  // was total_episodes
  // ...
}
interface EngagementWithCharacter { ... }
interface Session {
  engagement_id: string | null;  // was relationship_id
  // ...
}
interface SessionSummary { ... }
```

### 3.2 API Client

| File | Changes |
|------|---------|
| `lib/api/client.ts` | Update endpoint paths, method names |

```typescript
// Before
api.relationships.get(id)
api.episodes.get(id)

// After
api.engagements.get(id)
api.sessions.get(id)
```

### 3.3 Pages

| File | Changes |
|------|---------|
| `app/(dashboard)/dashboard/chats/page.tsx` | Update to use sessions/engagements |
| `app/(dashboard)/dashboard/page.tsx` | Update relationship → engagement |
| `app/(dashboard)/discover/page.tsx` | Minor updates if needed |
| `app/chat/[characterSlug]/page.tsx` | Update episode → session references |

### 3.4 Remove Stage UI

Any UI showing relationship stage/progress meters should be removed:
- Stage badges
- Progress bars
- Stage unlock notifications

---

## Phase 4: Testing & Verification

### 4.1 Pre-Migration Verification

```sql
-- Count records before migration
SELECT 'episodes' as table_name, COUNT(*) as count FROM episodes
UNION ALL
SELECT 'relationships', COUNT(*) FROM relationships
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'scene_images', COUNT(*) FROM scene_images
UNION ALL
SELECT 'memory_events', COUNT(*) FROM memory_events;
```

### 4.2 Post-Migration Verification

```sql
-- Verify tables renamed
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('sessions', 'engagements', 'episodes', 'relationships');

-- Verify columns dropped
SELECT column_name FROM information_schema.columns
WHERE table_name = 'engagements'
AND column_name IN ('stage', 'stage_progress');  -- Should return empty

-- Verify column renamed
SELECT column_name FROM information_schema.columns
WHERE table_name = 'engagements' AND column_name = 'total_sessions';

-- Verify FK integrity
SELECT COUNT(*) FROM sessions s
LEFT JOIN engagements e ON s.engagement_id = e.id
WHERE s.engagement_id IS NOT NULL AND e.id IS NULL;  -- Should be 0
```

### 4.3 Functional Tests

1. **Start new session** - Create engagement if needed, start session
2. **Continue session** - Resume existing active session
3. **Switch episode template** - Previous session inactive, new session active
4. **View chat history** - List all sessions for character
5. **Memory recall** - Memories persist across sessions

---

## Rollback Plan

If critical issues discovered:

```sql
-- Rollback table renames
ALTER TABLE sessions RENAME TO episodes;
ALTER TABLE engagements RENAME TO relationships;

-- Rollback column renames
ALTER TABLE episodes RENAME COLUMN engagement_id TO relationship_id;
ALTER TABLE relationships RENAME COLUMN total_sessions TO total_episodes;

-- Note: Dropped columns cannot be restored - would need backup
```

**Recommendation:** Take database snapshot before migration.

---

## Execution Checklist

### Pre-Migration
- [ ] Database snapshot/backup
- [ ] Verify no active users (low-traffic window)
- [ ] Pre-migration record counts

### Phase 1: Schema
- [ ] Rename tables
- [ ] Rename columns
- [ ] Drop stage columns
- [ ] Update FK constraints
- [ ] Rename indexes
- [ ] Update RLS policies
- [ ] Update triggers

### Phase 2: Backend
- [ ] Rename model files
- [ ] Update model classes
- [ ] Rename route files
- [ ] Update endpoints
- [ ] Update services
- [ ] Update SQL queries
- [ ] Run backend tests

### Phase 3: Frontend
- [ ] Update types
- [ ] Update API client
- [ ] Update pages
- [ ] Remove stage UI
- [ ] Run frontend build

### Post-Migration
- [ ] Post-migration verification queries
- [ ] Functional testing
- [ ] Monitor error logs

---

## Files to Modify

### Backend (substrate-api/api/src/app/)

| Action | File |
|--------|------|
| Rename | `models/relationship.py` → `models/engagement.py` |
| Rename | `models/episode.py` → `models/session.py` |
| Update | `models/character.py` |
| Update | `models/__init__.py` |
| Rename | `routes/relationships.py` → `routes/engagements.py` |
| Rename | `routes/episodes.py` → `routes/sessions.py` |
| Update | `routes/chat.py` |
| Update | `routes/characters.py` |
| Update | `routes/__init__.py` |
| Update | `services/chat_service.py` |
| Update | `services/memory_service.py` |

### Frontend (web/src/)

| Action | File |
|--------|------|
| Update | `types/index.ts` |
| Update | `lib/api/client.ts` |
| Update | `app/(dashboard)/dashboard/chats/page.tsx` |
| Update | `app/(dashboard)/dashboard/page.tsx` |
| Update | `app/chat/[characterSlug]/page.tsx` |

---

## Success Criteria

1. **Schema:** `sessions` and `engagements` tables exist; old names don't
2. **No stage:** `stage` and `stage_progress` columns removed
3. **API:** All endpoints respond correctly with new names
4. **Frontend:** App builds and runs without errors
5. **Data:** All pre-existing records preserved and accessible
6. **UX:** Users can start/continue sessions, memories persist
