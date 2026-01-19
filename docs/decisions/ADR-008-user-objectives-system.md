# ADR-008: User Objectives System

> **Status**: Accepted
> **Date**: 2026-01-19
> **Deciders**: Kevin Kim (Founder)

---

## Context

Episode-0's canon establishes that "people don't engage with characters—they engage with situations" and "the user's presence must matter." However, the current implementation gives users no explicit goals or stakes:

- Characters have `scene_objective`, `scene_obstacle`, `scene_tactic` (ADR-002)
- Users have... nothing. No visible goal, no success/failure conditions, no consequences.

The activation funnel shows 70% dropoff before first session, 77% never send a message. Users don't know what they're supposed to *do*.

**The missing piece:** User-facing objectives that make their participation meaningful.

---

## Decision

Implement a **User Objectives System** that gives users explicit goals with visible stakes and consequences.

### Core Components

#### 1. User Objectives (per Episode)

```python
EpisodeTemplate(
    # Existing character-facing motivation (ADR-002)
    scene_objective="You want them to notice you've been waiting",
    scene_obstacle="You can't seem too eager",
    scene_tactic="Pretend to be busy, but leave openings",

    # NEW: User-facing objective
    user_objective="Get them to admit why they're really here",
    user_hint="They're deflecting. Push gently on what they're avoiding.",

    # NEW: Success/failure conditions
    success_condition="semantic:character_reveals_true_motivation",
    failure_condition="turn_budget_exceeded",

    # NEW: Consequences
    on_success={"set_flag": "trust_established", "suggest_episode": "ep2_trust_path"},
    on_failure={"set_flag": "tension_unresolved", "suggest_episode": "ep2_distance_path"},
)
```

#### 2. Choice Points (within Episodes)

```python
EpisodeTemplate(
    # ...
    choice_points=[
        {
            "id": "reveal_moment",
            "trigger": "turn:5",  # Or "after_objective:establish_rapport"
            "prompt": "They're waiting for your answer.",
            "choices": [
                {"id": "honest", "label": "Tell them the truth", "sets_flag": "chose_honesty"},
                {"id": "deflect", "label": "Change the subject", "sets_flag": "chose_avoidance"},
            ]
        }
    ]
)
```

#### 3. State Persistence (Flags)

Flags persist in `Session.director_state` and carry across episodes within a series:

```python
director_state = {
    "objectives": {
        "current": "get_them_to_open_up",
        "status": "in_progress",  # pending, in_progress, completed, failed
        "completed_at_turn": None,
    },
    "flags": {
        "trust_established": True,
        "chose_honesty": True,
    },
    "choices_made": [
        {"episode": 1, "choice_id": "reveal_moment", "selected": "honest"}
    ]
}
```

#### 4. Context Injection (Soft Branching)

Flags affect future episodes without requiring hard-branched content:

```python
# In ConversationContext.build_episode_dynamics()
if flags.get("trust_established"):
    inject_context("They remember you were honest with them. There's a foundation of trust.")
elif flags.get("tension_unresolved"):
    inject_context("Things between you feel unfinished. There's something unsaid.")
```

---

## Implementation

### Database Schema Changes

```sql
-- Migration: 047_user_objectives.sql

ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS user_objective TEXT;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS user_hint TEXT;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS success_condition TEXT;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS failure_condition TEXT;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS on_success JSONB DEFAULT '{}';
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS on_failure JSONB DEFAULT '{}';
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS choice_points JSONB DEFAULT '[]';
```

### Backend Components

#### Director Extensions

```python
# In director.py

async def evaluate_objective(
    self,
    objective: str,
    success_condition: str,
    messages: List[Dict],
    character_response: str,
    turn_count: int,
) -> ObjectiveStatus:
    """Evaluate if user achieved their objective."""

    if success_condition.startswith("semantic:"):
        # LLM evaluation
        criteria = success_condition.replace("semantic:", "")
        return await self._semantic_objective_check(objective, criteria, messages, character_response)

    elif success_condition.startswith("keyword:"):
        # Deterministic keyword check
        keywords = success_condition.replace("keyword:", "").split(",")
        return self._keyword_check(character_response, keywords)

    elif success_condition.startswith("turn:"):
        # Turn-based (survive N turns)
        threshold = int(success_condition.replace("turn:", ""))
        return "completed" if turn_count >= threshold else "in_progress"

    return "in_progress"

def check_choice_point_trigger(
    self,
    choice_points: List[Dict],
    turn_count: int,
    completed_objectives: List[str],
) -> Optional[Dict]:
    """Check if any choice point should trigger."""
    for cp in choice_points:
        trigger = cp.get("trigger", "")
        if trigger.startswith("turn:"):
            if turn_count == int(trigger.replace("turn:", "")):
                return cp
        elif trigger.startswith("after_objective:"):
            obj_id = trigger.replace("after_objective:", "")
            if obj_id in completed_objectives:
                return cp
    return None
```

#### SSE Events

```python
# New event types in conversation streaming

# When episode starts (with objective)
yield {"type": "objective_start", "objective": user_objective, "hint": user_hint}

# When objective is completed
yield {"type": "objective_completed", "objective": user_objective, "turn": turn_count}

# When choice point triggers
yield {"type": "choice_point", "id": cp_id, "prompt": prompt, "choices": choices}

# When user makes a choice (after POST /sessions/{id}/choice)
yield {"type": "choice_made", "choice_id": choice_id, "selected": selected_option}
```

#### New Endpoint

```python
# In sessions.py

@router.post("/{session_id}/choice")
async def record_choice(
    session_id: UUID,
    choice_data: ChoiceRequest,  # { choice_point_id: str, selected_option_id: str }
    user_id: UUID = Depends(get_current_user_id),
    db = Depends(get_db),
):
    """Record user's choice at a choice point."""
    session = await get_session(session_id, user_id, db)

    # Update director_state with choice
    director_state = session.director_state or {}
    choices_made = director_state.get("choices_made", [])
    choices_made.append({
        "choice_point_id": choice_data.choice_point_id,
        "selected": choice_data.selected_option_id,
        "turn": session.turn_count,
    })

    # Set flag from choice
    choice_point = get_choice_point(session.episode_template_id, choice_data.choice_point_id)
    selected_choice = next(c for c in choice_point["choices"] if c["id"] == choice_data.selected_option_id)
    if selected_choice.get("sets_flag"):
        flags = director_state.get("flags", {})
        flags[selected_choice["sets_flag"]] = True
        director_state["flags"] = flags

    director_state["choices_made"] = choices_made
    await update_session_director_state(session_id, director_state, db)

    return {"status": "recorded", "flag_set": selected_choice.get("sets_flag")}
```

### Frontend Components

#### ObjectiveCard

```tsx
// components/chat/ObjectiveCard.tsx

interface ObjectiveCardProps {
  objective: string;
  hint?: string;
  status: "active" | "completed" | "failed";
}

export function ObjectiveCard({ objective, hint, status }: ObjectiveCardProps) {
  return (
    <div className={cn(
      "rounded-xl p-4 border",
      status === "active" && "border-amber-500/30 bg-amber-500/5",
      status === "completed" && "border-green-500/30 bg-green-500/5",
      status === "failed" && "border-red-500/30 bg-red-500/5",
    )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {status === "active" && <Target className="h-5 w-5 text-amber-500" />}
          {status === "completed" && <CheckCircle className="h-5 w-5 text-green-500" />}
          {status === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">
            {status === "active" && "Your objective"}
            {status === "completed" && "Objective completed"}
            {status === "failed" && "Objective incomplete"}
          </p>
          <p className="text-sm mt-1">{objective}</p>
          {hint && status === "active" && (
            <p className="text-xs text-muted-foreground mt-2 italic">💡 {hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### ChoiceCard (Interactive)

```tsx
// components/chat/ChoiceCard.tsx

interface ChoiceCardProps {
  prompt: string;
  choices: Array<{ id: string; label: string }>;
  onChoiceSelect: (choiceId: string) => void;
  disabled?: boolean;
}

export function ChoiceCard({ prompt, choices, onChoiceSelect, disabled }: ChoiceCardProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="text-xs uppercase tracking-widest text-amber-500/70 mb-3">
        Choose your path
      </p>
      <p className="text-sm font-medium mb-4">{prompt}</p>
      <div className="space-y-2">
        {choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => onChoiceSelect(choice.id)}
            disabled={disabled}
            className={cn(
              "w-full text-left py-3 px-4 rounded-lg border transition-colors",
              "border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/10",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### useChat Hook Extensions

```typescript
// In useChat.ts

// New state
const [currentObjective, setCurrentObjective] = useState<ObjectiveState | null>(null);
const [activeChoicePoint, setActiveChoicePoint] = useState<ChoicePoint | null>(null);

// New SSE handlers
} else if (event.type === "objective_start") {
  setCurrentObjective({
    objective: event.objective,
    hint: event.hint,
    status: "active",
  });
} else if (event.type === "objective_completed") {
  setCurrentObjective(prev => prev ? { ...prev, status: "completed" } : null);
} else if (event.type === "choice_point") {
  setActiveChoicePoint({
    id: event.id,
    prompt: event.prompt,
    choices: event.choices,
  });
}

// New action
const selectChoice = async (choicePointId: string, choiceId: string) => {
  await api.sessions.recordChoice(sessionId, { choice_point_id: choicePointId, selected_option_id: choiceId });
  setActiveChoicePoint(null);
  // Choice affects story—character will respond in next exchange
};
```

---

## Success Condition Types

| Type | Format | Example | Use Case |
|------|--------|---------|----------|
| **Semantic** | `semantic:<criteria>` | `semantic:character_admits_feelings` | Complex emotional/narrative goals |
| **Keyword** | `keyword:<words>` | `keyword:love,care,feelings` | Specific word triggers |
| **Turn-based** | `turn:<N>` | `turn:7` | Survival/endurance goals |
| **Flag-based** | `flag:<flag_name>` | `flag:trust_established` | Compound objectives |

---

## Soft Branching Model

This system uses **soft branching**—same episode templates, different context based on flags.

### Why Soft > Hard Branching

| Hard Branching | Soft Branching |
|----------------|----------------|
| Episode 2A vs Episode 2B (different templates) | Episode 2 with injected context |
| Exponential authoring cost (2^n episodes) | Linear authoring cost |
| Users realize branches converge, feel cheated | Subtle differences feel personal |
| Difficult to maintain | Easy to extend |

### How It Works

```python
# Episode 2 template (same for all users)
EpisodeTemplate(
    title="The Second Meeting",
    situation="You run into them unexpectedly at the bookstore.",

    # Context varies based on Episode 1 outcome
    flag_context_rules=[
        {"if_flag": "trust_established", "inject": "There's a warmth between you. They smile when they see you."},
        {"if_flag": "tension_unresolved", "inject": "Things feel awkward. Last time didn't end well."},
        {"if_flag": "chose_honesty", "inject": "They remember your honesty. It meant something."},
    ]
)
```

The LLM receives different context → character behaves differently → user's choices mattered.

---

## Migration Strategy

### Phase 1: Schema + Display (Days 1-2)
1. Run migration to add new columns
2. Add ObjectiveCard component
3. Display objective at episode start (static, no completion detection yet)
4. Author objectives for 2-3 test series

### Phase 2: Completion Detection (Days 3-4)
1. Implement Director.evaluate_objective()
2. Add objective_completed SSE event
3. UI feedback on completion
4. Test with semantic conditions

### Phase 3: Consequences + Flags (Days 5-6)
1. Implement flag persistence in director_state
2. Add on_success/on_failure processing
3. Context injection based on flags
4. Author flag-aware content for test series

### Phase 4: Choice Points (Days 7-8)
1. Implement choice_points processing
2. Add choice_point SSE event
3. Make ChoiceCard interactive
4. Add POST /sessions/{id}/choice endpoint
5. Author choice points for test series

---

## Alternatives Considered

### 1. Implicit Objectives Only (Rejected)
Keep objectives internal (scene_objective), don't show users.
**Rejected:** Users don't know what to do, high dropoff continues.

### 2. Hard Branching (Deferred)
Different episode templates for different paths.
**Deferred:** Exponential complexity, soft branching achieves 80% of value.

### 3. Separate Sandbox (Rejected)
Build in /play route first, migrate later.
**Rejected:** No users to protect, delays learning, canon already supports this.

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Sent first message | 23% | 50%+ | Do visible objectives encourage first reply? |
| Sent 5+ messages | 13% | 30%+ | Do stakes drive continued engagement? |
| Episode completion | ~0% | 40%+ | Do users reach objective resolution? |
| D1 retention | 0% | 15%+ | Do consequences drive return? |

---

## Related Documents

- **ADR-002**: Theatrical Architecture (scene motivation)
- **EPISODE-0_CANON.md**: Platform philosophy
- **PHILOSOPHY.md**: Character design principles
- **ADR-000**: Founding vision (episode structure as moat)

---

## Conclusion

The User Objectives System completes the promise of the platform canon: **situations with stakes where the user's presence matters.** This isn't a pivot—it's finishing what the architecture was designed for.

Characters have objectives. Now users will too.
