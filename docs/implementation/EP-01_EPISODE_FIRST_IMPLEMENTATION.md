# EP-01 Episode-First Implementation Plan

**Status:** IN PROGRESS
**Created:** 2024-12-16
**Reference:** `docs/EP-01_pivot_CANON.md`

---

## Executive Summary

This plan implements the Episode-First pivot by:
1. Removing redundant `opening_situation` and `opening_line` from `characters` table
2. Ensuring `episode_templates` is the single source of truth for opening beats
3. Wiring up `episode_frame` for scene card functionality
4. Cleaning up all legacy references in backend and frontend code

---

## Pre-Implementation Verification

### Data Verification (COMPLETED)

All 10 characters with `opening_situation`/`opening_line` data already have corresponding `episode_templates` with the same data:

| Character | Has opening_* in characters | Has episode_template | Template has situation |
|-----------|----------------------------|---------------------|----------------------|
| Kai | yes | yes | yes |
| Jade | yes | yes | yes |
| Felix | yes | yes | yes |
| Ash | yes | yes | yes |
| Mira | yes | yes | yes |
| River | yes | yes | yes |
| Sora | yes | yes | yes |
| Raven | yes | yes | yes |
| Luna | yes | yes | yes |
| Morgan | yes | yes | yes |

**Safe to drop columns.** No data loss will occur.

---

## Implementation Steps

### Phase 1: Schema Cleanup

#### 1.1 Drop redundant columns from `characters` table

```sql
-- Drop opening_situation and opening_line from characters
-- These are now exclusively in episode_templates
ALTER TABLE characters DROP COLUMN IF EXISTS opening_situation;
ALTER TABLE characters DROP COLUMN IF EXISTS opening_line;
```

#### 1.2 Drop `role_frame` if unused

```sql
-- Check if role_frame is used
SELECT COUNT(*) FROM characters WHERE role_frame IS NOT NULL;
-- If 0, drop it
ALTER TABLE characters DROP COLUMN IF EXISTS role_frame;
```

### Phase 2: Backend Code Cleanup

#### 2.1 Files to update

| File | Changes |
|------|---------|
| `models/character.py` | Remove `opening_situation`, `opening_line` fields from models |
| `routes/studio.py` | Remove references to character opening_* fields |
| `services/conversation_ignition.py` | Ensure it reads from episode_templates only |
| `scripts/calibration_sprint.py` | Remove/update references |
| `scripts/scaffold_genre02.py` | Remove/update references |

#### 2.2 Validation

- `CharacterCreateInput` - Remove `opening_situation`, `opening_line` requirements
- `validate_chat_ready()` - Update validation to not require opening_* on character

### Phase 3: Frontend Code Cleanup

#### 3.1 Files to update

| File | Changes |
|------|---------|
| `types/index.ts` | Remove `opening_situation`, `opening_line` from Character type |
| `lib/api/client.ts` | Update any character creation/update methods |
| `app/studio/characters/[id]/page.tsx` | Remove opening beat editing from character page |
| `app/studio/create/page.tsx` | Remove opening beat from character creation |
| `components/chat/ChatContainer.tsx` | Ensure it reads opening from episode_template |

### Phase 4: Episode Frame Wiring (Scene Cards)

#### 4.1 Current state

- `episode_templates.episode_frame` exists but unused
- Purpose: Stage direction text for opening scene card

#### 4.2 Implementation

1. Add `episode_frame` to `EpisodeDiscoveryItem` response
2. Frontend renders `episode_frame` as scene card before first message
3. Styling: Italicized, muted, distinct from character messages

### Phase 5: Validation & Testing

1. Verify no references to `opening_situation`/`opening_line` on characters
2. Verify episode creation uses episode_template correctly
3. Verify chat container displays opening_line from template
4. Verify scene cards render episode_frame correctly

---

## Rollback Plan

If issues arise:
```sql
-- Re-add columns if needed
ALTER TABLE characters ADD COLUMN opening_situation TEXT;
ALTER TABLE characters ADD COLUMN opening_line TEXT;

-- Restore data from episode_templates
UPDATE characters c
SET
    opening_situation = et.situation,
    opening_line = et.opening_line
FROM episode_templates et
WHERE et.character_id = c.id AND et.is_default = true;
```

---

## Success Criteria

- [ ] `characters` table no longer has `opening_situation`, `opening_line`, `role_frame`
- [ ] All backend code references removed
- [ ] All frontend code references removed
- [ ] Chat still works correctly (opening_line from episode_template)
- [ ] No TypeScript/Python errors
- [ ] Episode discovery endpoint returns complete data

---

## Related Files

Backend:
- `substrate-api/api/src/app/models/character.py`
- `substrate-api/api/src/app/routes/studio.py`
- `substrate-api/api/src/app/services/conversation.py`
- `substrate-api/api/src/app/services/conversation_ignition.py`

Frontend:
- `web/src/types/index.ts`
- `web/src/lib/api/client.ts`
- `web/src/app/studio/characters/[id]/page.tsx`
- `web/src/app/studio/create/page.tsx`
- `web/src/components/chat/ChatContainer.tsx`
