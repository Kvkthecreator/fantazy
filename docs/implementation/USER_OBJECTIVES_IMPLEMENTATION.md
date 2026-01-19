# User Objectives System - Implementation Plan

> **Reference**: ADR-008
> **Status**: Ready to implement
> **Date**: 2026-01-19

---

## Overview

Transform Episode-0 from "chat with a character" to "complete a mission with stakes."

**Before:** User enters, character talks, user can type anything, nothing structurally changes.

**After:** User sees their objective, works toward it, system detects completion, consequences affect future episodes.

---

## Phase 1: Schema + Display (Foundation)

### 1.1 Database Migration

**File:** `migrations/047_user_objectives.sql`

```sql
-- User Objectives System (ADR-008)

-- User-facing objective fields
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS user_objective TEXT;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS user_hint TEXT;

-- Success/failure conditions
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS success_condition TEXT;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS failure_condition TEXT DEFAULT 'turn_budget_exceeded';

-- Consequences (what happens on success/failure)
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS on_success JSONB DEFAULT '{}';
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS on_failure JSONB DEFAULT '{}';

-- Choice points (interactive decision moments)
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS choice_points JSONB DEFAULT '[]';

-- Flag-based context injection rules
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS flag_context_rules JSONB DEFAULT '[]';

-- Index for querying episodes with objectives
CREATE INDEX IF NOT EXISTS idx_episode_templates_has_objective
ON episode_templates ((user_objective IS NOT NULL));

COMMENT ON COLUMN episode_templates.user_objective IS 'User-facing goal for this episode (visible in UI)';
COMMENT ON COLUMN episode_templates.user_hint IS 'Hint to help user achieve objective';
COMMENT ON COLUMN episode_templates.success_condition IS 'Condition format: semantic:<criteria>, keyword:<words>, turn:<N>, flag:<name>';
COMMENT ON COLUMN episode_templates.on_success IS 'JSON: {set_flag: string, suggest_episode: string}';
COMMENT ON COLUMN episode_templates.on_failure IS 'JSON: {set_flag: string, suggest_episode: string}';
COMMENT ON COLUMN episode_templates.choice_points IS 'JSON array of choice point definitions';
COMMENT ON COLUMN episode_templates.flag_context_rules IS 'JSON array: [{if_flag: string, inject: string}]';
```

### 1.2 Backend Model Updates

**File:** `substrate-api/api/src/app/models/episode_template.py`

Add new fields to EpisodeTemplate model:

```python
# User Objectives (ADR-008)
user_objective: Optional[str] = None  # User-facing goal
user_hint: Optional[str] = None  # Hint to help achieve objective
success_condition: Optional[str] = None  # semantic:X, keyword:X, turn:N
failure_condition: str = "turn_budget_exceeded"
on_success: Dict[str, Any] = Field(default_factory=dict)
on_failure: Dict[str, Any] = Field(default_factory=dict)
choice_points: List[Dict[str, Any]] = Field(default_factory=list)
flag_context_rules: List[Dict[str, Any]] = Field(default_factory=list)
```

### 1.3 API Response Updates

**File:** `substrate-api/api/src/app/routes/episode_templates.py`

Include new fields in episode template responses:

```python
class EpisodeTemplateResponse(BaseModel):
    # ... existing fields ...

    # User Objectives (ADR-008)
    user_objective: Optional[str] = None
    user_hint: Optional[str] = None
    success_condition: Optional[str] = None
    # Note: on_success, on_failure, choice_points are admin-only
```

### 1.4 Frontend: ObjectiveCard Component

**File:** `web/src/components/chat/ObjectiveCard.tsx`

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Target, CheckCircle, XCircle } from "lucide-react";

export type ObjectiveStatus = "active" | "completed" | "failed";

interface ObjectiveCardProps {
  objective: string;
  hint?: string;
  status: ObjectiveStatus;
}

export function ObjectiveCard({ objective, hint, status }: ObjectiveCardProps) {
  return (
    <div className={cn(
      "my-4 rounded-xl p-4 border transition-colors",
      status === "active" && "border-amber-500/30 bg-gradient-to-br from-amber-950/50 to-black/50",
      status === "completed" && "border-green-500/30 bg-gradient-to-br from-green-950/50 to-black/50",
      status === "failed" && "border-red-500/30 bg-gradient-to-br from-red-950/50 to-black/50",
    )}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-full bg-black/30">
          {status === "active" && <Target className="h-4 w-4 text-amber-400" />}
          {status === "completed" && <CheckCircle className="h-4 w-4 text-green-400" />}
          {status === "failed" && <XCircle className="h-4 w-4 text-red-400" />}
        </div>
        <div className="flex-1">
          <p className={cn(
            "text-xs uppercase tracking-widest mb-1",
            status === "active" && "text-amber-500/70",
            status === "completed" && "text-green-500/70",
            status === "failed" && "text-red-500/70",
          )}>
            {status === "active" && "Your objective"}
            {status === "completed" && "Objective completed"}
            {status === "failed" && "Objective incomplete"}
          </p>
          <p className="text-sm font-medium text-white">{objective}</p>
          {hint && status === "active" && (
            <p className="text-xs text-white/60 mt-2 italic">💡 {hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 1.5 Frontend: Display in Chat

**File:** `web/src/components/chat/ChatContainer.tsx`

Add ObjectiveCard after episode opening:

```tsx
import { ObjectiveCard, ObjectiveStatus } from "./ObjectiveCard";

// In component:
const [objectiveStatus, setObjectiveStatus] = useState<ObjectiveStatus>("active");

// In render, after opening card:
{episodeTemplate?.user_objective && (
  <ObjectiveCard
    objective={episodeTemplate.user_objective}
    hint={episodeTemplate.user_hint}
    status={objectiveStatus}
  />
)}
```

### 1.6 Frontend Types

**File:** `web/src/types/index.ts`

```typescript
// Episode template with objectives
export interface EpisodeTemplate {
  // ... existing fields ...
  user_objective?: string;
  user_hint?: string;
  success_condition?: string;
}

// Objective state in chat
export interface ObjectiveState {
  objective: string;
  hint?: string;
  status: "active" | "completed" | "failed";
  completedAtTurn?: number;
}

// Choice point
export interface ChoicePoint {
  id: string;
  prompt: string;
  choices: Array<{
    id: string;
    label: string;
  }>;
}
```

---

## Phase 2: Completion Detection

### 2.1 Director: Objective Evaluation

**File:** `substrate-api/api/src/app/services/director.py`

```python
from enum import Enum

class ObjectiveStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class ObjectiveEvaluation:
    status: ObjectiveStatus
    confidence: float = 1.0
    reason: Optional[str] = None

async def evaluate_objective(
    self,
    user_objective: str,
    success_condition: str,
    messages: List[Dict[str, str]],
    character_response: str,
    turn_count: int,
    turn_budget: int,
) -> ObjectiveEvaluation:
    """Evaluate if user achieved their objective."""

    # Parse condition type
    if not success_condition:
        return ObjectiveEvaluation(status=ObjectiveStatus.IN_PROGRESS)

    condition_type, condition_value = success_condition.split(":", 1) if ":" in success_condition else (success_condition, "")

    if condition_type == "semantic":
        return await self._evaluate_semantic_objective(
            user_objective, condition_value, messages, character_response
        )

    elif condition_type == "keyword":
        keywords = [k.strip().lower() for k in condition_value.split(",")]
        response_lower = character_response.lower()
        if any(kw in response_lower for kw in keywords):
            return ObjectiveEvaluation(status=ObjectiveStatus.COMPLETED, reason="Keyword detected")
        return ObjectiveEvaluation(status=ObjectiveStatus.IN_PROGRESS)

    elif condition_type == "turn":
        threshold = int(condition_value)
        if turn_count >= threshold:
            return ObjectiveEvaluation(status=ObjectiveStatus.COMPLETED, reason=f"Turn {turn_count} reached")
        return ObjectiveEvaluation(status=ObjectiveStatus.IN_PROGRESS)

    elif condition_type == "flag":
        # Check if flag exists in director_state (handled at session level)
        return ObjectiveEvaluation(status=ObjectiveStatus.IN_PROGRESS)

    return ObjectiveEvaluation(status=ObjectiveStatus.IN_PROGRESS)

async def _evaluate_semantic_objective(
    self,
    user_objective: str,
    success_criteria: str,
    messages: List[Dict[str, str]],
    character_response: str,
) -> ObjectiveEvaluation:
    """Use LLM to evaluate if objective was achieved."""

    # Format recent conversation
    recent = messages[-6:] if len(messages) > 6 else messages
    conversation = "\n".join([
        f"{'User' if m['role'] == 'user' else 'Character'}: {m['content'][:200]}"
        for m in recent
    ])

    prompt = f"""Evaluate if the user achieved their objective in this conversation.

USER'S OBJECTIVE: {user_objective}
SUCCESS CRITERIA: {success_criteria}

RECENT CONVERSATION:
{conversation}

CHARACTER'S LATEST RESPONSE:
{character_response[:500]}

Based on the conversation, has the user achieved their objective?
Answer with exactly one word: YES, NO, or PARTIAL

Answer:"""

    response = await self.llm.generate(
        messages=[{"role": "user", "content": prompt}],
        model="claude-3-5-haiku-20241022",  # Fast model for evaluation
        max_tokens=10,
        temperature=0,
    )

    answer = response.strip().upper()
    if answer == "YES":
        return ObjectiveEvaluation(status=ObjectiveStatus.COMPLETED, confidence=0.9)
    elif answer == "PARTIAL":
        return ObjectiveEvaluation(status=ObjectiveStatus.IN_PROGRESS, confidence=0.7)
    else:
        return ObjectiveEvaluation(status=ObjectiveStatus.IN_PROGRESS, confidence=0.9)
```

### 2.2 Conversation Service: Objective Tracking

**File:** `substrate-api/api/src/app/services/conversation.py`

In `process_message` or streaming handler, after character response:

```python
# Evaluate objective if episode has one
if episode_template.user_objective and episode_template.success_condition:
    objective_eval = await self.director.evaluate_objective(
        user_objective=episode_template.user_objective,
        success_condition=episode_template.success_condition,
        messages=messages,
        character_response=character_response,
        turn_count=session.turn_count,
        turn_budget=episode_template.turn_budget or 10,
    )

    # Update session director_state
    director_state = session.director_state or {}
    objectives_state = director_state.get("objectives", {})
    objectives_state["status"] = objective_eval.status.value

    if objective_eval.status == ObjectiveStatus.COMPLETED:
        objectives_state["completed_at_turn"] = session.turn_count
        # Emit SSE event
        yield {"type": "objective_completed", "turn": session.turn_count}

        # Process on_success
        if episode_template.on_success:
            await self._process_objective_outcome(session, episode_template.on_success, director_state)

    director_state["objectives"] = objectives_state
    await self.session_repo.update_director_state(session.id, director_state)
```

### 2.3 SSE Event Types

**File:** `substrate-api/api/src/app/services/conversation.py`

Add new event types to streaming:

```python
# At episode start (if objective exists)
if episode_template.user_objective:
    yield {
        "type": "objective_start",
        "objective": episode_template.user_objective,
        "hint": episode_template.user_hint,
    }

# On objective completion
yield {
    "type": "objective_completed",
    "objective": episode_template.user_objective,
    "turn": session.turn_count,
}

# On objective failure (turn budget exceeded without completion)
yield {
    "type": "objective_failed",
    "objective": episode_template.user_objective,
    "reason": "turn_budget_exceeded",
}
```

### 2.4 Frontend: Handle Objective Events

**File:** `web/src/hooks/useChat.ts`

```typescript
// New state
const [currentObjective, setCurrentObjective] = useState<ObjectiveState | null>(null);

// In SSE handler
} else if (event.type === "objective_start") {
  setCurrentObjective({
    objective: event.objective,
    hint: event.hint,
    status: "active",
  });
} else if (event.type === "objective_completed") {
  setCurrentObjective(prev => prev ? {
    ...prev,
    status: "completed",
    completedAtTurn: event.turn,
  } : null);
  // Could trigger confetti, sound, etc.
} else if (event.type === "objective_failed") {
  setCurrentObjective(prev => prev ? {
    ...prev,
    status: "failed",
  } : null);
}

// Return from hook
return {
  // ... existing
  currentObjective,
};
```

---

## Phase 3: Consequences + Flags

### 3.1 Process Objective Outcomes

**File:** `substrate-api/api/src/app/services/conversation.py`

```python
async def _process_objective_outcome(
    self,
    session: Session,
    outcome: Dict[str, Any],
    director_state: Dict[str, Any],
):
    """Process success/failure outcome - set flags, determine next episode."""

    # Set flag
    if "set_flag" in outcome:
        flags = director_state.get("flags", {})
        flags[outcome["set_flag"]] = True
        director_state["flags"] = flags

    # Store suggested next episode (used by completion flow)
    if "suggest_episode" in outcome:
        director_state["suggested_next_episode"] = outcome["suggest_episode"]
```

### 3.2 Flag-Based Context Injection

**File:** `substrate-api/api/src/app/services/conversation.py`

In context building:

```python
def _inject_flag_context(
    self,
    context: ConversationContext,
    flags: Dict[str, bool],
    flag_context_rules: List[Dict[str, str]],
) -> str:
    """Inject context based on flags from previous episodes."""

    injections = []
    for rule in flag_context_rules:
        flag_name = rule.get("if_flag")
        if flag_name and flags.get(flag_name):
            injections.append(rule.get("inject", ""))

    if injections:
        return "\n\n".join([
            "## Context from your history",
            *injections
        ])
    return ""
```

### 3.3 Load Flags from Series History

**File:** `substrate-api/api/src/app/services/conversation.py`

```python
async def _get_series_flags(
    self,
    user_id: UUID,
    series_id: UUID,
    db,
) -> Dict[str, bool]:
    """Get accumulated flags from all completed episodes in this series."""

    query = """
    SELECT director_state->'flags' as flags
    FROM sessions
    WHERE user_id = :user_id
      AND series_id = :series_id
      AND session_state = 'complete'
    ORDER BY ended_at DESC
    """

    rows = await db.fetch_all(query, {"user_id": user_id, "series_id": series_id})

    # Merge all flags (later episodes override earlier)
    merged_flags = {}
    for row in reversed(rows):  # Oldest first
        if row["flags"]:
            merged_flags.update(row["flags"])

    return merged_flags
```

---

## Phase 4: Choice Points

### 4.1 Check Choice Point Triggers

**File:** `substrate-api/api/src/app/services/director.py`

```python
def check_choice_point_trigger(
    self,
    choice_points: List[Dict[str, Any]],
    turn_count: int,
    objectives_state: Dict[str, Any],
    already_triggered: List[str],
) -> Optional[Dict[str, Any]]:
    """Check if any choice point should trigger this turn."""

    for cp in choice_points:
        cp_id = cp.get("id", "")
        if cp_id in already_triggered:
            continue

        trigger = cp.get("trigger", "")

        if trigger.startswith("turn:"):
            trigger_turn = int(trigger.replace("turn:", ""))
            if turn_count == trigger_turn:
                return cp

        elif trigger.startswith("after_objective:"):
            # Trigger after specific objective completed
            required_status = trigger.replace("after_objective:", "")
            if objectives_state.get("status") == "completed":
                return cp

    return None
```

### 4.2 Choice Point SSE Event

**File:** `substrate-api/api/src/app/services/conversation.py`

After character response, check for choice points:

```python
# Check for choice point trigger
if episode_template.choice_points:
    triggered_cps = director_state.get("triggered_choice_points", [])
    triggered_cp = self.director.check_choice_point_trigger(
        choice_points=episode_template.choice_points,
        turn_count=session.turn_count,
        objectives_state=director_state.get("objectives", {}),
        already_triggered=triggered_cps,
    )

    if triggered_cp:
        # Mark as triggered
        triggered_cps.append(triggered_cp["id"])
        director_state["triggered_choice_points"] = triggered_cps
        director_state["pending_choice"] = triggered_cp["id"]

        # Emit SSE event
        yield {
            "type": "choice_point",
            "id": triggered_cp["id"],
            "prompt": triggered_cp.get("prompt", ""),
            "choices": triggered_cp.get("choices", []),
        }
```

### 4.3 Choice Recording Endpoint

**File:** `substrate-api/api/src/app/routes/sessions.py`

```python
class ChoiceRequest(BaseModel):
    choice_point_id: str
    selected_option_id: str

@router.post("/{session_id}/choice")
async def record_choice(
    session_id: UUID,
    choice_data: ChoiceRequest,
    user_id: UUID = Depends(get_current_user_id),
    db = Depends(get_db),
):
    """Record user's choice at a choice point."""

    # Get session
    session = await get_session_by_id(session_id, db)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get episode template for choice point definitions
    episode = await get_episode_template(session.episode_template_id, db)

    # Find the choice point
    choice_point = next(
        (cp for cp in (episode.choice_points or []) if cp.get("id") == choice_data.choice_point_id),
        None
    )
    if not choice_point:
        raise HTTPException(status_code=400, detail="Invalid choice point")

    # Find the selected choice
    selected = next(
        (c for c in choice_point.get("choices", []) if c.get("id") == choice_data.selected_option_id),
        None
    )
    if not selected:
        raise HTTPException(status_code=400, detail="Invalid choice option")

    # Update director_state
    director_state = session.director_state or {}

    # Record the choice
    choices_made = director_state.get("choices_made", [])
    choices_made.append({
        "choice_point_id": choice_data.choice_point_id,
        "selected": choice_data.selected_option_id,
        "turn": session.turn_count,
        "timestamp": datetime.utcnow().isoformat(),
    })
    director_state["choices_made"] = choices_made

    # Set flag if choice has one
    if selected.get("sets_flag"):
        flags = director_state.get("flags", {})
        flags[selected["sets_flag"]] = True
        director_state["flags"] = flags

    # Clear pending choice
    director_state.pop("pending_choice", None)

    # Save
    await update_session_director_state(session_id, director_state, db)

    return {
        "status": "recorded",
        "choice_point_id": choice_data.choice_point_id,
        "selected": choice_data.selected_option_id,
        "flag_set": selected.get("sets_flag"),
    }
```

### 4.4 Frontend: ChoiceCard Component

**File:** `web/src/components/chat/ChoiceCard.tsx`

```tsx
"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface Choice {
  id: string;
  label: string;
}

interface ChoiceCardProps {
  prompt: string;
  choices: Choice[];
  onChoiceSelect: (choiceId: string) => Promise<void>;
}

export function ChoiceCard({ prompt, choices, onChoiceSelect }: ChoiceCardProps) {
  const [selecting, setSelecting] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = async (choiceId: string) => {
    if (selected) return; // Already selected

    setSelecting(choiceId);
    try {
      await onChoiceSelect(choiceId);
      setSelected(choiceId);
    } finally {
      setSelecting(null);
    }
  };

  return (
    <div className="my-6 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/50 to-black/50 p-4">
      <p className="text-xs uppercase tracking-widest text-amber-500/70 mb-3">
        Choose your path
      </p>
      <p className="text-sm font-medium text-white mb-4">{prompt}</p>
      <div className="space-y-2">
        {choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => handleSelect(choice.id)}
            disabled={!!selected || !!selecting}
            className={cn(
              "w-full text-left py-3 px-4 rounded-lg border transition-all",
              selected === choice.id
                ? "border-amber-500 bg-amber-500/20 text-white"
                : "border-amber-500/20 text-white/80",
              !selected && !selecting && "hover:border-amber-500/50 hover:bg-amber-500/10",
              (selected || selecting) && selected !== choice.id && "opacity-40",
              selecting === choice.id && "animate-pulse"
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-xs text-amber-500/50 mt-3 text-center">
          Your choice has been made
        </p>
      )}
    </div>
  );
}
```

### 4.5 Frontend: useChat Integration

**File:** `web/src/hooks/useChat.ts`

```typescript
// New state
const [activeChoicePoint, setActiveChoicePoint] = useState<ChoicePoint | null>(null);

// SSE handler
} else if (event.type === "choice_point") {
  setActiveChoicePoint({
    id: event.id,
    prompt: event.prompt,
    choices: event.choices,
  });
} else if (event.type === "choice_recorded") {
  setActiveChoicePoint(null);
}

// New action
const selectChoice = async (choicePointId: string, choiceId: string) => {
  if (!sessionId) return;

  const response = await api.sessions.recordChoice(sessionId, {
    choice_point_id: choicePointId,
    selected_option_id: choiceId,
  });

  setActiveChoicePoint(null);

  // The next character message will acknowledge the choice
  return response;
};

// Return from hook
return {
  // ... existing
  activeChoicePoint,
  selectChoice,
};
```

---

## Phase 5: Content Authoring

### Example: Test Series with Objectives

**Series:** "The Arrangement" (already exists)
**Episode 0:** "The Meeting"

```python
EpisodeTemplate(
    title="The Meeting",
    episode_number=0,
    situation="A coffee shop. 3pm on a Tuesday. They're already waiting when you arrive.",
    dramatic_question="What is this arrangement really about?",

    # Character motivation (existing)
    scene_objective="Feel out if this person is serious or wasting your time",
    scene_obstacle="You've been burned before by people who weren't committed",
    scene_tactic="Be charming but guarded—let them prove themselves",

    # User objective (new)
    user_objective="Figure out what they're really looking for",
    user_hint="They're being vague about their expectations. Try to get specifics.",
    success_condition="semantic:character_reveals_true_motivation",
    failure_condition="turn_budget_exceeded",

    on_success={"set_flag": "good_first_impression", "suggest_episode": "ep1"},
    on_failure={"set_flag": "awkward_start", "suggest_episode": "ep1"},

    # Choice point
    choice_points=[
        {
            "id": "first_impression",
            "trigger": "turn:4",
            "prompt": "They ask what you're hoping to get out of this.",
            "choices": [
                {"id": "honest", "label": "Be completely honest", "sets_flag": "chose_honesty"},
                {"id": "mysterious", "label": "Keep your cards close", "sets_flag": "chose_mystery"},
                {"id": "flirty", "label": "Turn it into a joke", "sets_flag": "chose_deflection"},
            ]
        }
    ],

    turn_budget=10,
)
```

**Episode 1:** "The Second Meeting"

```python
EpisodeTemplate(
    title="The Second Meeting",
    episode_number=1,
    situation="A week later. They texted asking to meet again. Same café.",

    # Flag-based context (new)
    flag_context_rules=[
        {"if_flag": "good_first_impression", "inject": "Last time went well. They seemed genuinely interested."},
        {"if_flag": "awkward_start", "inject": "Last time was... weird. You're not sure why they wanted to meet again."},
        {"if_flag": "chose_honesty", "inject": "They remember your honesty. It made an impression."},
        {"if_flag": "chose_mystery", "inject": "You kept things mysterious. They're still trying to figure you out."},
        {"if_flag": "chose_deflection", "inject": "You deflected with humor last time. They found it charming, but..."},
    ],

    user_objective="Learn something real about them this time",
    success_condition="semantic:character_shares_vulnerability",
    # ...
)
```

---

## Testing Checklist

### Phase 1: Display
- [ ] Migration runs successfully
- [ ] ObjectiveCard renders correctly
- [ ] Objective appears after episode opening
- [ ] Studio can edit user_objective field

### Phase 2: Completion
- [ ] Semantic evaluation works
- [ ] Keyword evaluation works
- [ ] Turn-based evaluation works
- [ ] SSE events fire correctly
- [ ] UI updates on completion

### Phase 3: Flags
- [ ] Flags persist in director_state
- [ ] Flags load from previous episodes
- [ ] Context injection works
- [ ] Character behavior differs based on flags

### Phase 4: Choices
- [ ] Choice points trigger at correct turn
- [ ] ChoiceCard renders correctly
- [ ] Choice selection records to backend
- [ ] Flags set from choices
- [ ] UI disables after selection

---

## Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| First message sent | 23% | 50%+ | Visible objective encourages reply |
| 5+ messages sent | 13% | 30%+ | Stakes drive engagement |
| Episode completion | ~0% | 40%+ | Users reach resolution |
| D1 return | 0% | 15%+ | Consequences drive return |

---

## Next Steps

1. **Run migration** (047_user_objectives.sql)
2. **Update backend models**
3. **Create ObjectiveCard component**
4. **Wire up display in ChatContainer**
5. **Author objectives for 2-3 test series**
6. **Deploy Phase 1**
7. **Measure impact on activation**
8. **Proceed to Phase 2**
