# Director Architecture

> **Status**: Active
> **Created**: 2024-12-19
> **Purpose**: Define the Director/Observer/Operator entity for episode management, evaluation, and narrative continuity.

---

## Overview

The **Director** is a system entity that observes, evaluates, and operates conversations without being visible to users. It works alongside the Character (the "actor") to enable bounded episodes, progression tracking, and derived outputs like scores and recommendations.

### Metaphor

| Role | Responsibility | Visibility |
|------|----------------|------------|
| **Character** | Acting — dialogue, emotion, persona | User sees |
| **Director** | Observing, judging, operating — state & system management | Hidden |

The Director is the **brain, eyes, ears, and hands** of the interaction:
- **Eyes & Ears**: Observes all exchanges, user signals, character responses
- **Brain**: Interprets state, decides beat progression, detects completion
- **Hands**: Triggers system actions (completion, UI elements, next-episode suggestions)
- **Operator**: Controls system levers — manages the machinery of the conversation

---

## Director Capabilities

| Capability | Description | Use Case |
|------------|-------------|----------|
| **Beat Tracking** | Track progression through narrative beats | Guided/gated episodes |
| **Turn Counting** | Track exchange count per session | Turn-limited games |
| **Signal Collection** | Gather user behavior patterns | Scoring, personalization |
| **Completion Detection** | Determine when episode is "done" | Bounded episodes |
| **Evaluation Generation** | Produce reports, scores, summaries | Games, episode summaries |
| **Next Episode Suggestion** | Recommend continuation | **All episodes** |
| **State Injection** | Provide context to character LLM | Memory, flags, nudges |
| **UI Triggers** | Surface choices, scene cards, prompts | Structured content |

### Universal Application: Next Episode Suggestion

The Director's `suggest_next_episode` capability applies to **all episode types**, not just bounded ones:

| Scenario | Director Action |
|----------|-----------------|
| Flirt test completes | Evaluate → Result → Suggest Episode 1 of series |
| Mystery episode completes | Clue revealed → Suggest next episode |
| Open-ended episode fades | Detect natural pause → Suggest related episode |
| Series completed | Suggest thematically matched series |

---

## Integration with Current Architecture

### Current Flow (from `conversation.py`)

```
User message
    ↓
ConversationService.send_message_stream()
    ↓
Build ConversationContext (memories, hooks, episode dynamics)
    ↓
LLM.generate_stream() → Character response
    ↓
_process_exchange() → Extract memories, update relationship_dynamic
    ↓
Return to user
```

### New Flow with Director (Merged)

**Decision**: Director absorbs `_process_exchange()` — unified post-exchange processing.

```
User message
    ↓
ConversationService.send_message_stream()
    ↓
Build ConversationContext
    ↓
LLM.generate_stream() → Structured character output (JSON)
    ↓
DirectorService.process_exchange() → REPLACES _process_exchange()
    ├── Extract memories, hooks
    ├── Update relationship dynamic
    ├── Increment turn count
    ├── Track beat + user signals
    ├── Check completion conditions
    ├── If complete: generate evaluation, suggest next
    └── Return DirectorOutput
    ↓
Return to user (with director signals)
```

**Rationale**: Single LLM call can extract all signals. One service for all post-exchange logic.

### Implementation: Post-Processing Model

The Director runs **after** each exchange as a post-processing step. This:
- Keeps character generation pure and fast
- Allows Director logic to be optional (skip for open-ended content)
- Enables gradual rollout

```python
# In conversation.py send_message_stream()

# After _process_exchange()
if episode_template.completion_mode != 'open':
    director_output = await self.director_service.evaluate(
        session_id=session.id,
        messages=context.messages + [{"role": "assistant", "content": response_content}],
        episode_template=episode_template,
    )

    if director_output.is_complete:
        yield json.dumps({
            "type": "episode_complete",
            "evaluation": director_output.evaluation,
            "next_episode": director_output.next_suggestion,
        })
```

---

## Schema Extensions

### Session Extensions

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
    turn_count INT DEFAULT 0,
    director_state JSONB DEFAULT '{}',
    completion_trigger TEXT DEFAULT NULL;

-- director_state structure:
-- {
--   "current_beat": "escalation",
--   "beats_completed": ["establishment", "complication"],
--   "user_signals": {"confident": 3, "hesitant": 1, "playful": 2},
--   "tension_curve": [0.3, 0.5, 0.7],
--   "flags": {"key_moment_reached": true}
-- }
```

### Episode Template Extensions

```sql
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS
    completion_mode TEXT DEFAULT 'open',  -- open, beat_gated, turn_limited, objective
    turn_budget INT DEFAULT NULL,
    completion_criteria JSONB DEFAULT NULL;

-- completion_criteria structure (varies by mode):
-- turn_limited: {"max_turns": 8}
-- beat_gated: {"required_beat": "pivot", "require_resolution": true}
-- objective: {"objective_key": "accusation_made"}
```

### Session Evaluations (New Table)

```sql
CREATE TABLE session_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    evaluation_type TEXT NOT NULL,  -- 'flirt_archetype', 'episode_summary', 'mystery_progress'
    result JSONB NOT NULL,
    model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- result structure varies by type:
-- flirt_archetype: {"archetype": "tension_builder", "scores": {...}, "description": "..."}
-- episode_summary: {"summary": "...", "key_moments": [...], "emotional_arc": "..."}
-- mystery_progress: {"clues_found": [...], "suspects_cleared": [...], "current_theory": "..."}
```

---

## Completion Modes

| Mode | Trigger | Use Case |
|------|---------|----------|
| `open` | Never (user decides) | Default, open-ended chat |
| `beat_gated` | Final beat + resolution detected | Most series episodes |
| `turn_limited` | Turn budget exhausted | Games, quick challenges |
| `objective` | Specific flag set | Mystery (accusation), choices |

### Completion Detection Logic

```python
class DirectorService:
    async def check_completion(
        self,
        session: Session,
        episode_template: EpisodeTemplate,
        director_state: dict,
    ) -> tuple[bool, str | None]:
        """Check if episode should complete.

        Returns (is_complete, trigger_reason)
        """
        mode = episode_template.completion_mode

        if mode == 'open':
            return False, None

        if mode == 'turn_limited':
            budget = episode_template.turn_budget or 10
            if director_state.get('turn_count', 0) >= budget:
                return True, 'turn_limit'

        if mode == 'beat_gated':
            criteria = episode_template.completion_criteria or {}
            required_beat = criteria.get('required_beat', 'pivot')
            beats_completed = director_state.get('beats_completed', [])
            if required_beat in beats_completed:
                return True, 'beat_complete'

        if mode == 'objective':
            criteria = episode_template.completion_criteria or {}
            objective_key = criteria.get('objective_key')
            flags = director_state.get('flags', {})
            if flags.get(objective_key):
                return True, 'objective_met'

        return False, None
```

---

## Completion Logic Details

### Turn Definition

One **turn** = one user message + one assistant response (a complete exchange).

```python
# Turn counting happens after each complete exchange
async def increment_turn(self, session_id: UUID) -> int:
    result = await self.db.fetch_one("""
        UPDATE sessions
        SET turn_count = turn_count + 1
        WHERE id = :session_id
        RETURNING turn_count
    """, {"session_id": str(session_id)})
    return result["turn_count"]
```

### Completion Mode: `turn_limited`

Simplest mode — episode completes after N turns.

```python
async def check_turn_limited(
    self,
    turn_count: int,
    turn_budget: int,
) -> tuple[bool, str | None]:
    if turn_count >= turn_budget:
        return True, "turn_limit"
    return False, None
```

**Recommended turn budgets**:
| Content Type | Budget | Rationale |
|--------------|--------|-----------|
| Flirt test | 6-8 | Enough for signal, short enough for completion |
| Quick challenge | 4-5 | Snackable, high completion rate |
| Mini episode | 10-12 | Deeper but still bounded |

### Completion Mode: `beat_gated`

Episode completes when required narrative beat is reached.

**Beat progression** (standard sequence):
1. `establishment` — Scene set, characters introduced
2. `complication` — Tension introduced, stakes raised
3. `escalation` — Conflict peaks, pressure mounts
4. `pivot` — Key moment, user choice matters most
5. `resolution` — Outcome revealed (optional, can be next episode)

**Beat detection** — two approaches:

**Heuristic (v1)**: Infer from turn position
```python
def infer_beat_from_turn(turn_count: int, turn_budget: int) -> str:
    progress = turn_count / turn_budget
    if progress < 0.25:
        return "establishment"
    elif progress < 0.5:
        return "complication"
    elif progress < 0.75:
        return "escalation"
    else:
        return "pivot"
```

**LLM-based (v2)**: Classify after each exchange
```python
async def detect_beat_llm(self, messages: list[dict]) -> str:
    prompt = """Analyze this conversation exchange and classify the current narrative beat.

LAST EXCHANGE:
User: {user_message}
Character: {character_response}

Which beat best describes the current moment?
- establishment: Setting the scene, initial dynamics
- complication: New tension or obstacle introduced
- escalation: Stakes raised, pressure mounting
- pivot: Critical moment, response matters most

Return only the beat name."""

    return await self.llm.generate(prompt)
```

### Completion Mode: `objective`

Episode completes when specific flag is set (event-driven).

```python
async def check_objective(
    self,
    director_state: dict,
    objective_key: str,
) -> tuple[bool, str | None]:
    flags = director_state.get("flags", {})
    if flags.get(objective_key):
        return True, "objective_met"
    return False, None
```

**Use cases**:
- Mystery: `accusation_made` — user accuses a suspect
- Choice point: `decision_selected` — user picks A or B
- Discovery: `clue_found` — key information revealed

**Setting flags**: Director sets flags based on conversation analysis
```python
async def check_for_objective_signals(
    self,
    messages: list[dict],
    objective_key: str,
) -> bool:
    # LLM analyzes if objective condition was met
    prompt = f"""Analyze if the user's last message indicates: {objective_key}

    User message: {messages[-2]["content"]}

    Return JSON: {{"met": true/false, "confidence": 0.0-1.0}}"""

    result = await self.llm.generate_json(prompt)
    return result.get("met", False) and result.get("confidence", 0) > 0.7
```

### Evaluation Timing

**Decision**: Generate evaluation **immediately** on completion.

Rationale:
- Users expect instant result (personality test UX)
- Evaluation LLM call is fast (~1-2s)
- Avoids "calculating..." state and extra round-trip

```python
async def on_episode_complete(
    self,
    session_id: UUID,
    trigger: str,
    messages: list[dict],
    director_state: dict,
) -> dict:
    # Generate evaluation immediately
    evaluation = await self.generate_evaluation(
        session_id=session_id,
        evaluation_type="flirt_archetype",
        messages=messages,
        director_state=director_state,
    )

    # Persist evaluation with share_id
    share_id = self._generate_share_id()  # e.g., "abc123"
    await self._save_evaluation(session_id, evaluation, share_id)

    # Get next suggestion
    next_suggestion = await self.suggest_next_episode(session_id, evaluation)

    return {
        "evaluation": evaluation,
        "share_id": share_id,
        "next_suggestion": next_suggestion,
    }
```

### Beat Display (User Visibility)

**Decision**: Hidden by default. Optional progress indicator for certain content.

| Content Type | Beat Visibility | Rationale |
|--------------|-----------------|-----------|
| Flirt test | Hidden | Game feel, surprise result |
| Mystery serial | Optional progress bar | "Episode 2 of 4" |
| Open-ended | Hidden | No defined end |

If shown, display as progress dots or subtle indicator, not beat names.

---

## Director Evaluation

When episode completes, Director generates an evaluation based on episode type.

### Flirt Test Evaluation

```python
async def evaluate_flirt_test(
    self,
    session_id: UUID,
    messages: list[dict],
    director_state: dict,
) -> dict:
    """Evaluate flirt conversation and assign archetype."""

    prompt = """Analyze this flirtatious conversation and classify the user's flirt style.

CONVERSATION:
{conversation}

USER SIGNALS OBSERVED:
{signals}

Based on the user's responses, determine their flirt archetype:
- tension_builder: Masters the pause, creates anticipation
- bold_mover: Direct, confident, takes initiative
- playful_tease: Light, fun, uses humor
- slow_burn: Patient, builds connection over time
- mysterious_allure: Intriguing, doesn't reveal everything

Return JSON:
{
  "archetype": "<archetype_key>",
  "confidence": 0.0-1.0,
  "primary_signals": ["signal1", "signal2"],
  "description": "One sentence describing their style"
}"""

    # Call evaluation LLM
    result = await self.llm.generate_json(prompt.format(
        conversation=self._format_conversation(messages),
        signals=json.dumps(director_state.get('user_signals', {})),
    ))

    return result
```

### Episode Summary Evaluation

```python
async def evaluate_episode_summary(
    self,
    session_id: UUID,
    messages: list[dict],
    character_name: str,
) -> dict:
    """Generate episode summary for serial continuity."""

    # Similar pattern - LLM generates structured summary
    # Used for series_context in subsequent episodes
```

---

## Next Episode Suggestion

The Director suggests next steps based on context:

```python
async def suggest_next_episode(
    self,
    session: Session,
    evaluation: dict | None,
    series: Series | None,
) -> dict | None:
    """Suggest next episode or series."""

    # 1. If in a series, suggest next episode in order
    if series and series.episode_order:
        current_idx = series.episode_order.index(str(session.episode_template_id))
        if current_idx < len(series.episode_order) - 1:
            next_template_id = series.episode_order[current_idx + 1]
            return {
                "type": "next_episode",
                "episode_template_id": next_template_id,
                "series_id": series.id,
            }

    # 2. If evaluation has archetype, suggest matched series
    if evaluation and evaluation.get('archetype'):
        matched_series = await self._get_archetype_matched_series(
            evaluation['archetype']
        )
        return {
            "type": "matched_series",
            "series": matched_series,
        }

    # 3. Default: suggest same character's other content
    return {
        "type": "character_content",
        "character_id": session.character_id,
    }
```

---

## Conversation Data Types

A conversation contains multiple data types flowing through different channels:

### Message-Level Data Types

| Type | Source | Storage | Display |
|------|--------|---------|---------|
| **User message** | User | `messages` table | Chat bubble |
| **Character response** | Character LLM | `messages` table | Chat bubble |
| **Director metadata** | Director | `messages.metadata` | Hidden |

### System-Level Data Types (Stream Events)

| Type | Source | Trigger | Display |
|------|--------|---------|---------|
| **Scene card** | Episode template | Episode start | Visual card |
| **Beat indicator** | Director | Beat transition | Progress UI (optional) |
| **Completion signal** | Director | Episode complete | UI transition |
| **Evaluation result** | Director | Post-completion | Result screen |
| **Next suggestion** | Director | Post-completion | CTA buttons |
| **Choice prompt** | Director | Objective mode | Selection UI |

### Structured Character Output

Character LLM responses use **structured output** to separate content types:

```json
{
  "dialogue": "You're brave, I'll give you that.",
  "action": "She raises an eyebrow, a smirk tugging at her lips",
  "internal": "Why does he make me nervous?",
  "mood": "intrigued",
  "tension_shift": 0.1
}
```

**Rendered for user** (display format):
```
*She raises an eyebrow, a smirk tugging at her lips*
"You're brave, I'll give you that."
```

**Benefits of structured output**:
- Clean separation for Director analysis
- Consistent formatting
- Mood/tension signals without parsing
- Enables dialogue-only or action-only views (future)

### Message Metadata Enrichment

Director enriches each message with observation data:

```json
{
  "role": "assistant",
  "content": "*She raises an eyebrow* \"You're brave, I'll give you that.\"",
  "metadata": {
    "structured": {
      "dialogue": "You're brave, I'll give you that.",
      "action": "She raises an eyebrow",
      "mood": "intrigued",
      "tension_shift": 0.1
    },
    "director": {
      "turn_number": 3,
      "beat": "complication",
      "user_signals": ["confident", "playful"],
      "completion_eligible": false
    }
  }
}
```

### Stream Response Structure

```python
# Character response chunks (real-time)
yield {"type": "chunk", "content": chunk}

# Structured response complete
yield {
    "type": "message_complete",
    "content": rendered_content,  # For display
    "structured": {
        "dialogue": "...",
        "action": "...",
        "mood": "intrigued"
    },
    "director": {
        "turn_count": 5,
        "beat": "escalation",
        "completion_eligible": false
    }
}

# Episode completion (if triggered)
yield {
    "type": "episode_complete",
    "trigger": "turn_limit",
    "evaluation": {
        "archetype": "tension_builder",
        "description": "You know exactly when to pause..."
    },
    "next_suggestion": {
        "type": "character_continuity",
        "character_id": "...",
        "prompt": "Mina enjoyed that. Keep going?"
    }
}

# Stream end
yield {"type": "done"}

---

## Director Service Interface

```python
class DirectorService:
    """Service for episode observation, evaluation, and guidance."""

    async def evaluate(
        self,
        session_id: UUID,
        messages: list[dict],
        episode_template: EpisodeTemplate,
    ) -> DirectorOutput:
        """Run Director evaluation after exchange.

        Returns:
            DirectorOutput with updated state, completion status,
            evaluation if complete, next suggestion.
        """

    async def update_turn_count(self, session_id: UUID) -> int:
        """Increment and return turn count."""

    async def update_beat(
        self,
        session_id: UUID,
        beat: str,
        signals: dict,
    ) -> None:
        """Update current beat and user signals."""

    async def check_completion(
        self,
        session: Session,
        episode_template: EpisodeTemplate,
        director_state: dict,
    ) -> tuple[bool, str | None]:
        """Check if episode should complete."""

    async def generate_evaluation(
        self,
        session_id: UUID,
        evaluation_type: str,
        messages: list[dict],
        director_state: dict,
    ) -> dict:
        """Generate evaluation (score, summary, etc.)."""

    async def suggest_next_episode(
        self,
        session: Session,
        evaluation: dict | None,
        series: Series | None,
    ) -> dict | None:
        """Suggest next episode or content."""


@dataclass
class DirectorOutput:
    """Output from Director evaluation."""

    director_state: dict
    turn_count: int
    is_complete: bool
    completion_trigger: str | None
    evaluation: dict | None
    next_suggestion: dict | None
```

---

## Implementation Priority

### Phase 1: Flirt Test MVP
1. **Schema migration** — Add columns to sessions, episode_templates; create session_evaluations
2. **Structured character output** — Modify LLM call to return JSON with dialogue/action/mood
3. **DirectorService** — Turn counting, completion detection (`turn_limited`)
4. **Evaluation generation** — Flirt archetype classification
5. **Stream events** — `message_complete`, `episode_complete` with evaluation
6. **Share infrastructure** — `session_evaluations` with share_id, result endpoint

### Phase 2: Core Integration
7. **Next episode suggestion** — Character continuity, series matching
8. **Message metadata enrichment** — Director state in messages.metadata
9. **Beat tracking (heuristic)** — Turn-position-based beat inference

### Phase 3: Advanced Modes (Future)
10. **Beat tracking (LLM)** — Real-time beat classification
11. **Objective mode** — Flag-based completion for mystery/choices
12. **Choice prompts** — UI for A/B decision points

---

## Relationship to GTM Plan

This architecture enables the Viral Play Feature:

| GTM Requirement | Director Capability |
|-----------------|---------------------|
| Bounded flirt test | `completion_mode: turn_limited` |
| Archetype result | `evaluate_flirt_test()` |
| "Continue with character" CTA | `suggest_next_episode()` |
| Series-matched suggestions | Archetype → series matching |

The Director is **built for games, reusable for all content**.

---

## References

- [VIRAL_PLAY_FEATURE_GTM.md](plans/VIRAL_PLAY_FEATURE_GTM.md) — GTM strategy
- [EPISODE_DYNAMICS_CANON.md](EPISODE_DYNAMICS_CANON.md) — Episode philosophy
- [conversation.py](../substrate-api/api/src/app/services/conversation.py) — Current implementation
