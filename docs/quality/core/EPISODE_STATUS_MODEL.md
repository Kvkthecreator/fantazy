# Episode Status Model

> **Version**: 1.0.0
> **Status**: Active
> **Created**: 2024-12-26

---

## Purpose

Define the canonical model for episode status, clearly separating:
1. **Progress tracking** (user metrics, watch history)
2. **Suggestion flow** (next episode prompts)
3. **Gating logic** (future: mystery/thriller progression gates)

---

## The Netflix Analogy

Think of episodes like Netflix content:

| Concept | Netflix | Episode-0 |
|---------|---------|-----------|
| **Progress** | "75% watched" | Turn count / turn_budget |
| **Completed** | User finished watching | User explicitly marks done OR starts next |
| **Up Next** | Auto-play suggestion | Turn budget reached → show suggestion |
| **Gate** | N/A (open binge) | Future: Mystery unlock, choice consequence |

**Key Insight**: "Completed" status is for **user metrics**, not for **suggestion flow**.

---

## Three Decoupled Concerns

### 1. Suggestion Flow (Director-Driven)

**Trigger**: `turn_count >= turn_budget` (default: 10)

**Behavior**:
- Backend sends `next_episode_suggestion` event
- Frontend shows inline suggestion card
- User can: tap to continue, dismiss, or keep chatting
- No state change required

**Data Flow**:
```
Turn budget reached
    ↓
Director emits next_episode_suggestion event
    ↓
Frontend shows InlineSuggestionCard (dismissible)
    ↓
User taps → navigate to next episode
User dismisses → card hidden, chat continues
```

**NOT controlled by**: `isEpisodeComplete`, `session_state`, or any "completion" flag

### 2. Progress Tracking (User Metrics)

**Purpose**: Netflix-style "watch progress" for series UI

**Trigger**:
- User explicitly starts next episode (implicit: current = done)
- User explicitly marks episode "done" (future UI)
- Natural threshold crossed (e.g., 80% of turn_budget)

**Database Fields**:
- `sessions.session_state`: active → complete (explicit user action)
- `sessions.resolution_type`: positive/neutral/negative/faded (optional)

**Uses**:
- Series progress UI ("Ep 2/6 completed")
- Dashboard "continue watching" lists
- Analytics (completion rates)

**NOT used for**: Triggering suggestions, gating content

### 3. Gating Logic (Future)

**Purpose**: Genre-specific progression requirements

**Use Cases**:
- Mystery: "Solve clue X before Episode 3"
- Thriller: "Make choice at episode end to unlock branch"
- Game-like: "Achieve score threshold to continue"

**Database Fields** (future):
- `episode_templates.unlock_condition`: JSON describing requirements
- `sessions.unlock_status`: locked/unlocked/bypassed

**Design Principles**:
- Opt-in per episode template (most episodes have no gate)
- Explicit unlock, not implicit
- Can be bypassed (accessibility, purchase)

---

## State Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           SUGGESTION FLOW               │
                    │  (turn_budget reached → show card)      │
                    │  Independent. No state change.          │
                    └─────────────────────────────────────────┘
                                       │
                                       │ user taps "Next Episode"
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROGRESS TRACKING                               │
│  session_state: active ──────────────────────────────────▶ complete     │
│                         (user starts next OR marks done)                │
│                                                                         │
│  Used for: UI badges, series progress, analytics                        │
└─────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ if episode has unlock_condition
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         GATING LOGIC (Future)                           │
│  unlock_status: locked ──▶ unlocked (condition met) ──▶ can play        │
│                                                                         │
│  Used for: Mystery clues, thriller choices, game progression            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Changes (v2.6)

### Backend Changes

**conversation.py** - Event Renamed:
```python
# BEFORE (confusing: "complete" implies state change)
if director_output.is_complete:
    yield {"type": "episode_complete", ...}

# AFTER (clear: just a suggestion, no state change)
if director_output.suggest_next:
    yield {"type": "next_episode_suggestion", ...}
```

**director.py** - Field Renamed:
```python
# BEFORE
is_complete: bool  # Misleading name
completion_trigger: str  # Implies completion

# AFTER
suggest_next: bool  # Clear: it's a suggestion
suggestion_trigger: str  # Why suggestion was triggered
```

### Frontend Changes

**useChat.ts** - State Simplified:
```typescript
// BEFORE (conflated concerns)
const [isEpisodeComplete, setIsEpisodeComplete] = useState(false);
const [nextSuggestion, setNextSuggestion] = useState(null);
// Render: {!isEpisodeComplete && nextSuggestion && <Card />}  // BUG!

// AFTER (suggestion-only, decoupled)
const [nextSuggestion, setNextSuggestion] = useState(null);
const [suggestionDismissed, setSuggestionDismissed] = useState(false);
// Render: {nextSuggestion && !suggestionDismissed && <Card />}  // Clear!
```

**ChatContainer.tsx** - Rendering Fixed:
```typescript
// BEFORE (broken logic)
{isEpisodeComplete && evaluation && <CompletionCard />}
{!isEpisodeComplete && nextSuggestion && <SuggestionCard />}  // Never renders!

// AFTER (simple, correct)
{nextSuggestion && !suggestionDismissed && !evaluation && (
  <InlineSuggestionCard
    onDismiss={() => setSuggestionDismissed(true)}
  />
)}
{evaluation && <InlineCompletionCard />}  // Games evaluation (separate concern)
```

---

## Stream Event Schema

### next_episode_suggestion (v2.6)

```typescript
interface NextEpisodeSuggestionEvent {
  type: "next_episode_suggestion";
  turn_count: number;
  trigger: "turn_limit";  // Only trigger type in v2.6
  next_episode: {
    episode_id: string;
    title: string;
    slug: string;
    episode_number: number;
    situation: string;
    character_id: string;
  } | null;  // null = series complete
}
```

### done event (unchanged)

```typescript
interface DoneEvent {
  type: "done";
  content: string;
  suggest_scene: boolean;
  director: {
    turn_count: number;
    turns_remaining: number | null;
    pacing: string;
    status: string;  // "going" | "closing" | "done" (semantic, NOT for completion)
    is_complete: boolean;  // DEPRECATED: ignore this field
  };
}
```

---

## Migration Notes

### Breaking Changes

1. **Event type renamed**: `episode_complete` → `next_episode_suggestion`
2. **Frontend state**: `isEpisodeComplete` removed from suggestion logic
3. **Director output**: `is_complete` → `suggest_next`

### Backward Compatibility

- Frontend should handle both event types during transition
- Backend continues to populate `is_complete` in done event (deprecated)

---

## Related Documents

- `docs/quality/core/DIRECTOR_PROTOCOL.md` - Director responsibilities
- `docs/GLOSSARY.md` - Session state definitions
- `substrate-api/api/src/app/models/session.py` - Session model

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-26 | Initial model - decouple suggestion flow from progress tracking |
