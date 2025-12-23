# Director Phase 2: Memory & Hook Ownership - Revised Implementation

> **Status**: READY TO IMPLEMENT
> **Created**: 2024-12-24
> **Priority**: P1 (High - Architectural Clarity)
> **Estimated Time**: 6-8 hours
> **Related**: DIRECTOR_REFACTORING.md Phase 2

---

## Executive Summary

Move memory and hook extraction **fully to Director ownership**, consolidating post-conversation processing into a single coherent domain. This eliminates the split responsibility between `ConversationService._process_exchange()` (legacy) and Director's unused `save_memory` fields.

**Key Changes**:
- ✅ Director becomes **sole owner** of post-exchange processing (memory, hooks, beats)
- ✅ Preserve **series-scoped memory** architecture (memories by series, not by character)
- ✅ Clean up legacy `ConversationService._process_exchange()` method
- ✅ Maintain backwards compatibility for character-only queries (free chat)

---

## Background: Memory Relational Scoping

### Current Architecture (Working Correctly)

Memory events support **dual scoping**:

1. **Series-Scoped** (Preferred):
   ```python
   # memory_events table has series_id column (added in code, not in migration 005)
   INSERT INTO memory_events (user_id, character_id, episode_id, series_id, ...)

   # Retrieval prioritizes series
   WHERE user_id = :user_id AND series_id = :series_id
   ```

2. **Character-Scoped** (Fallback for free chat):
   ```python
   # When no series_id (free chat mode)
   WHERE user_id = :user_id AND character_id = :character_id
   ```

### Why This Matters

Per platform philosophy:
- **Series-scoped**: "Your story with Romantic Tension Series" - memories belong to the narrative arc
- **Character-scoped**: "Your free chat with Emma" - memories belong to the character relationship
- **Use case**: Same character can appear in multiple series with independent memory contexts

**Example**:
- User chats with Emma in "Hometown Crush" series → memories scoped to that series
- User chats with Emma in free chat → separate memory pool (character-scoped)
- User chats with Emma in "Office Romance" series → third independent memory pool

---

## Current State Analysis

### What's Working

1. **MemoryService.save_memories()** correctly handles series_id:
   ```python
   # File: services/memory.py:281-339
   async def save_memories(
       user_id, character_id, episode_id, memories,
       series_id: Optional[UUID] = None,  # ← Supports series scoping
   ):
       # Auto-fetches series_id from session if not provided
       if not series_id:
           session_query = "SELECT series_id FROM sessions WHERE id = :episode_id"
   ```

2. **MemoryService.get_relevant_memories()** correctly retrieves by series:
   ```python
   # File: services/memory.py:378-444
   async def get_relevant_memories(
       user_id, character_id, limit=10,
       series_id: Optional[UUID] = None,  # ← Series-scoped retrieval
   ):
       if series_id:
           # Series-scoped query (preferred)
           WHERE series_id = :series_id
       else:
           # Character-scoped fallback
           WHERE character_id = :character_id
   ```

3. **ConversationService.get_context()** passes series_id correctly:
   ```python
   # File: services/conversation.py:448-451
   memories = await self.memory_service.get_relevant_memories(
       user_id, character_id, limit=10,
       series_id=series_id  # ← Retrieved from session
   )
   ```

### What's Broken / Unclear

1. **Dual Ownership**: Memory extraction happens in TWO places:
   - `ConversationService._process_exchange()` (lines 1023-1078)
   - Director has unused `save_memory` fields in DirectorActions

2. **No series_id passed to save_memories()**:
   ```python
   # File: conversation.py:1046-1052
   await self.memory_service.save_memories(
       user_id=user_id,
       character_id=character_id,
       episode_id=episode_id,
       memories=extracted_memories,
       # series_id MISSING! ← It auto-fetches, but not explicit
   )
   ```

3. **Hooks not series-aware**:
   - `hooks` table has NO `series_id` column
   - Hooks are character-scoped only (might be intentional?)
   - Question: Should hooks be series-scoped too?

---

## Decision: Move to Director Ownership

### Rationale

**Director Protocol says:**
> "Director is the brain, eyes, ears, and hands of the conversation system"
> - Eyes/Ears: Observes all exchanges
> - Brain: Evaluates semantically
> - Hands: Triggers deterministic actions

Memory/hook extraction is **observation + triggering actions** → Director's job.

**Why not keep MemoryService separate?**
- Memory extraction is part of post-exchange evaluation (Director's Phase 2)
- Director already evaluates beats, visuals, completion → memory is the same pattern
- Consolidation reduces confusion about "who does what after LLM responds"

**MemoryService still exists for:**
- Storage (save_memories, save_hooks)
- Retrieval (get_relevant_memories, get_active_hooks)
- LLM prompting (MEMORY_EXTRACTION_PROMPT, HOOK_EXTRACTION_PROMPT)

**Director orchestrates; MemoryService executes.**

---

## Implementation Plan

### Step 1: Add Memory/Hook Extraction to Director (2-3 hours)

#### 1.1. Update DirectorOutput to include extracted data

```python
# File: services/director.py:239-257
@dataclass
class DirectorOutput:
    """Output from Director processing."""
    # Core state
    turn_count: int
    is_complete: bool
    completion_trigger: Optional[str]

    # Semantic evaluation result
    evaluation: Optional[Dict[str, Any]] = None

    # Deterministic actions
    actions: Optional[DirectorActions] = None

    # NEW: Extracted data for storage
    extracted_memories: List[ExtractedMemory] = field(default_factory=list)
    extracted_hooks: List[ExtractedHook] = field(default_factory=list)
    beat_data: Optional[Dict[str, Any]] = None
```

**Note**: These fields already exist but are unused! We're just populating them.

#### 1.2. Call MemoryService from Director.process_exchange()

```python
# File: services/director.py:564-637 (process_exchange method)
async def process_exchange(
    self,
    session: Session,
    episode_template: Optional[EpisodeTemplate],
    messages: List[Dict[str, str]],
    character_id: UUID,
    user_id: UUID,
) -> DirectorOutput:
    """Process exchange with semantic evaluation."""

    # ... existing code (evaluation, actions, completion) ...

    # NEW: Extract memories and hooks (Phase 2 responsibility)
    extracted_memories = []
    extracted_hooks = []
    beat_data = None

    # Get existing memories for deduplication
    existing_memories = await self.memory_service.get_relevant_memories(
        user_id, character_id, limit=20,
        series_id=session.series_id  # ← Series-aware
    )

    # Extract memories and beat classification (single LLM call)
    extracted_memories, beat_data = await self.memory_service.extract_memories(
        user_id=user_id,
        character_id=character_id,
        episode_id=session.id,
        messages=messages,
        existing_memories=existing_memories,
    )

    # Save memories (Director orchestrates, MemoryService executes)
    if extracted_memories:
        await self.memory_service.save_memories(
            user_id=user_id,
            character_id=character_id,
            episode_id=session.id,
            memories=extracted_memories,
            series_id=session.series_id,  # ← Explicit series scoping
        )
        log.info(f"Director saved {len(extracted_memories)} memories")

    # Extract and save hooks
    extracted_hooks = await self.memory_service.extract_hooks(messages)
    if extracted_hooks:
        await self.memory_service.save_hooks(
            user_id=user_id,
            character_id=character_id,
            episode_id=session.id,
            hooks=extracted_hooks,
        )
        log.info(f"Director saved {len(extracted_hooks)} hooks")

    # Update relationship dynamic with beat classification
    if beat_data:
        try:
            await self.memory_service.update_relationship_dynamic(
                user_id=user_id,
                character_id=character_id,
                beat_type=beat_data.get("type", "neutral"),
                tension_change=int(beat_data.get("tension_change", 0)),
                milestone=beat_data.get("milestone"),
            )
            log.info(f"Director updated dynamic: beat={beat_data.get('type')}")
        except Exception as e:
            log.error(f"Failed to update relationship dynamic: {e}")

    # Return with extracted data
    return DirectorOutput(
        turn_count=new_turn_count,
        is_complete=is_complete,
        completion_trigger=completion_trigger,
        evaluation=evaluation,
        actions=actions,
        extracted_memories=extracted_memories,
        extracted_hooks=extracted_hooks,
        beat_data=beat_data,
    )
```

#### 1.3. Inject MemoryService into Director.__init__()

```python
# File: services/director.py:281-283
def __init__(self, db):
    self.db = db
    self.llm = LLMService.get_instance()
    self.memory_service = MemoryService(db)  # ← NEW: Inject MemoryService
```

---

### Step 2: Remove Legacy Extraction from ConversationService (1 hour)

#### 2.1. Delete ConversationService._process_exchange() method

```python
# File: services/conversation.py:1023-1078
# DELETE THIS ENTIRE METHOD
async def _process_exchange(
    self,
    user_id: UUID,
    character_id: UUID,
    episode_id: UUID,
    messages: List[Dict[str, str]],
):
    """Process a conversation exchange for memories, hooks, and beat classification."""
    # ... 55 lines of code ... ← DELETE ALL OF THIS
```

#### 2.2. Remove calls to _process_exchange()

**In send_message()** (line 132-140):
```python
# REMOVE THIS:
# Also run legacy memory extraction until fully absorbed
await self._process_exchange(
    user_id=user_id,
    character_id=character_id,
    episode_id=episode.id,
    messages=full_messages,
)
```

**In send_message_stream()** (line 336-343):
```python
# REMOVE THIS:
# Also run legacy memory extraction until fully absorbed by Director
await self._process_exchange(
    user_id=user_id,
    character_id=character_id,
    episode_id=episode.id,
    messages=full_messages,
)
```

---

### Step 3: Handle Hooks Series-Scoping Decision (2 hours)

#### Decision Point: Should hooks be series-scoped?

**Current State**: Hooks table has NO series_id column
```sql
CREATE TABLE hooks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    character_id UUID NOT NULL,  -- Scoped by character only
    episode_id UUID,
    -- NO series_id column
    ...
)
```

**Options**:

**Option A: Keep hooks character-scoped** (Recommended)
- **Rationale**: Hooks are "reminders to follow up" - inherently personal, not series-specific
- **Example**: "User mentioned job interview Tuesday" - should trigger in ANY conversation with that character
- **Implementation**: No migration needed, keep current behavior

**Option B: Make hooks series-scoped**
- **Rationale**: Hooks are narrative continuity tools - should respect series boundaries
- **Example**: In "Hometown Crush" series, hook "ask about ex-boyfriend" shouldn't appear in free chat
- **Implementation**: Add `series_id` column, migrate existing hooks

**Recommendation**: **Option A** (character-scoped hooks)

**Reasoning**:
- Hooks are **callback triggers**, not narrative state
- User expectations: If they mentioned something personal, character should remember across all contexts
- Series-scoping adds complexity without clear UX benefit
- Can revisit if users report "hook leakage" issues

#### Implementation (Option A - No Changes)

No migration needed. Document the decision:

```python
# File: services/memory.py (add docstring to save_hooks)
async def save_hooks(
    self,
    user_id: UUID,
    character_id: UUID,
    episode_id: UUID,
    hooks: List[ExtractedHook],
):
    """Save extracted hooks to database.

    NOTE: Hooks are character-scoped, not series-scoped. This is intentional.
    Hooks represent "things to follow up on" that should carry across all
    conversations with a character, regardless of which series/episode.

    Example: If user mentions "job interview Tuesday" in free chat, the hook
    should also trigger in series episodes with the same character.
    """
```

---

### Step 4: Update Documentation (1-2 hours)

#### 4.1. Update DIRECTOR_PROTOCOL.md

```markdown
## Phase 2: Post-Evaluation (after character LLM)

After the character responds, Director evaluates and extracts:

### Semantic Evaluation
- **Visual Detection**: Should we generate an image? (character/object/atmosphere/instruction/none)
- **Completion Status**: Is this episode ready to close? (going/closing/done)
- **Next Episode**: Should we suggest moving to the next episode?

### Memory Extraction (NEW in v2.3)
- **Memories**: Facts, preferences, events, goals, relationships, emotions
- **Beat Classification**: playful/flirty/tense/vulnerable/charged/longing/neutral
- **Tension Tracking**: Changes in romantic tension (-15 to +15)
- **Milestones**: first_spark, almost_moment, jealousy_triggered, etc.

### Hook Extraction (NEW in v2.3)
- **Reminders**: Time-based callbacks ("job interview Thursday")
- **Follow-ups**: Topics to revisit ("how did the date go?")
- **Scheduled**: Future events to check on

### Storage
Director orchestrates extraction via LLM, then delegates storage to MemoryService:
- Memories: Saved with **series_id** for series-scoped isolation
- Hooks: Saved with **character_id** only (cross-series)
- Beats: Update engagement.dynamic (tone, tension_level)

### Data Flow
```
Character LLM responds
    ↓
DirectorService.process_exchange()
    ↓
MemoryService.extract_memories() ← LLM call
MemoryService.extract_hooks() ← LLM call
    ↓
MemoryService.save_memories(series_id=...) ← Series-scoped
MemoryService.save_hooks() ← Character-scoped
MemoryService.update_relationship_dynamic()
    ↓
DirectorOutput returned to ConversationService
```
```

#### 4.2. Update CONTEXT_LAYERS.md

```markdown
## Layer 4: Memory & Hooks

**Source**: `memory_events`, `hooks` tables
**Refresh**: Per session (retrieved)
**Scope**: Series-level for memories, character-level for hooks
**Owner**: MemoryService (storage/retrieval), Director (extraction)

### Memory Scoping Architecture

Memories are **series-scoped** (preferred) or **character-scoped** (fallback):

1. **Series-Scoped** (Episodic Narratives):
   - User + Series → Independent memory pool
   - Example: "Hometown Crush" memories don't leak into "Office Romance"
   - Same character, different stories, different memory contexts

2. **Character-Scoped** (Free Chat):
   - User + Character → Shared memory across all non-series chats
   - Fallback when no series_id present

### Hook Scoping Architecture

Hooks are **character-scoped only** (not series-specific):

- Rationale: Hooks are "reminders to follow up" - should carry across all conversations
- Example: "Job interview Tuesday" hook triggers in both free chat AND series episodes
- Design decision: Callback triggers are personal, not narrative-bounded
```

#### 4.3. Update CHANGELOG.md

```markdown
## 2024-12-24

### Changed
- **[DIRECTOR_PROTOCOL.md]** v2.3 - Memory/Hook Extraction Ownership
  - Director now owns all post-exchange processing (memory, hooks, beats)
  - Removed dual ownership (ConversationService._process_exchange deleted)
  - Clarified memory scoping: series-level (preferred), character-level (fallback)
  - Clarified hook scoping: character-level only (cross-series by design)
  - Director orchestrates extraction, MemoryService handles storage/retrieval

- **[CONTEXT_LAYERS.md]** v1.6.0 - Memory/Hook scoping documentation
  - Added explicit scoping architecture for memories (series > character)
  - Documented hooks as character-scoped (intentional cross-series behavior)
  - Updated Layer 4 ownership: MemoryService + Director collaboration

### Removed
- **ConversationService**: `_process_exchange()` method (55 lines) - consolidated into Director
- **ConversationService**: Duplicate memory/hook extraction calls
```

---

## Testing Strategy

### Unit Tests

1. **test_director_extracts_memories()**
   - Director.process_exchange() calls MemoryService.extract_memories()
   - Extracted memories include series_id from session
   - Beat data properly extracted and returned

2. **test_director_extracts_hooks()**
   - Director.process_exchange() calls MemoryService.extract_hooks()
   - Hooks saved without series_id (character-scoped)

3. **test_memory_series_scoping()**
   - Save memories with series_id → retrieve by series_id works
   - Save memories without series_id → retrieve by character_id works (fallback)

### Integration Tests

1. **test_conversation_with_series_memory()**
   - Send message in series episode
   - Verify memories saved with session.series_id
   - Verify memories retrievable by series_id

2. **test_free_chat_memory()**
   - Send message in free chat (no episode_template_id)
   - Verify memories saved without series_id
   - Verify memories retrievable by character_id

3. **test_hook_cross_series()**
   - Create hook in Series A
   - Start conversation in Series B (same character)
   - Verify hook appears in Series B context (cross-series behavior)

### Manual QA

- Create series episode, chat, verify memories scoped to series
- Create free chat, verify separate memory pool
- Mention future event, verify hook triggers in different contexts

---

## Migration & Rollout

### Database Changes

**None required**. The schema already supports everything:
- `memory_events.series_id` column exists (added in code, used by save_memories)
- `hooks` table doesn't need series_id (intentionally character-scoped)

### Code Migration

1. Deploy Director changes first (additive, non-breaking)
2. Deploy ConversationService cleanup (removes legacy code)
3. Monitor logs for "Director saved X memories" to confirm new path working

### Backwards Compatibility

- Existing memories continue working (series_id nullable, fallback to character_id)
- Existing hooks continue working (no schema change)
- No breaking changes to API contracts

---

## Success Criteria

- [ ] Director.process_exchange() extracts and saves memories with series_id
- [ ] ConversationService._process_exchange() deleted (no legacy path)
- [ ] Memory scoping works: series-scoped retrieval, character-scoped fallback
- [ ] Hook scoping works: character-scoped (cross-series)
- [ ] Documentation updated: DIRECTOR_PROTOCOL.md, CONTEXT_LAYERS.md, CHANGELOG.md
- [ ] All tests pass
- [ ] No duplicate memory extraction (only Director path runs)

---

## Open Questions

1. **Hook Scoping**: Final confirmation - keep character-scoped or make series-scoped?
   - **Recommendation**: Character-scoped (current behavior)
   - **Reason**: Callbacks are personal, not narrative-bounded

2. **Memory Deduplication**: Should Director check for duplicate memories before saving?
   - **Current**: Passes existing_memories to extract_memories() LLM prompt
   - **Question**: Should we add DB-level uniqueness constraint?
   - **Recommendation**: Keep LLM-based deduplication (more flexible)

3. **Beat Tracking**: Should beats be stored in a separate table or just in engagement.dynamic?
   - **Current**: Stored in engagement.dynamic JSONB (recent_beats array)
   - **Question**: Would a beats table enable better analytics?
   - **Recommendation**: Keep in engagement.dynamic (simpler, working well)

---

## Future Enhancements (Out of Scope)

1. **Hook Series-Scoping Toggle**
   - Add optional `series_id` to hooks table
   - Allow content creators to mark hooks as "series-specific" vs "character-global"
   - UI: Toggle in Studio for hook scoping preference

2. **Memory Importance Decay**
   - Automatically reduce importance_score of old memories over time
   - Prevents ancient facts from dominating context
   - Formula: `importance_score * decay_factor(days_since_created)`

3. **Beat Analytics Dashboard**
   - Track beat distribution across episodes (playful vs. tense vs. vulnerable)
   - Identify "stuck" relationships (too many neutral beats)
   - Content quality signal for studio creators

---

## References

- [DIRECTOR_REFACTORING.md](./DIRECTOR_REFACTORING.md) - Parent plan
- [DIRECTOR_PROTOCOL.md](../quality/core/DIRECTOR_PROTOCOL.md) - Protocol spec
- [CONTEXT_LAYERS.md](../quality/core/CONTEXT_LAYERS.md) - Layer 4 (Memory)
- [MemoryService](../../substrate-api/api/src/app/services/memory.py) - Storage/retrieval
- [DirectorService](../../substrate-api/api/src/app/services/director.py) - Orchestration

---

**End of Phase 2 Implementation Plan**
