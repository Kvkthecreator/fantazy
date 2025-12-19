# Director V2 Implementation Plan

> **Status**: Ready for implementation
> **Created**: 2024-12-19
> **Reference**: [DIRECTOR_ARCHITECTURE.md](../DIRECTOR_ARCHITECTURE.md)

---

## Overview

Refactor Director from state-machine approach to semantic evaluation. Key changes:
- Remove `completion_mode`, `beat_guidance`, `completion_criteria`
- Add semantic evaluation with SIGNAL line parsing
- Implement visual type taxonomy (character/object/atmosphere/instruction/none)
- Implement auto-visual generation (peaks/rhythmic modes)
- Integrate spark spending for image-based visuals (instruction cards are free)

---

## Implementation Decisions

### LLM Model
- **Use**: `gemini-2.0-flash` (free tier, default)
- **Rationale**: Simple ~200 token evaluation, <1s latency expected

### Scene Generation
- **Approach**: Async with streaming
- **Flow**:
  1. Director detects visual moment
  2. Emit `scene_pending` event immediately
  3. Generate image async (~5-10s)
  4. Emit `scene_ready` when complete
- **Frontend**: Show skeleton, swap in real image

### Spark Balance Handling
- **First insufficient balance**: Emit `needs_sparks` event with prompt
- **Subsequent**: Skip silently (no spam)
- **Track**: `director_state.spark_prompt_shown` flag per episode

### Evaluation Storage
- **Immediate**: Store in `director_state.last_evaluation`
- **Future**: `director_evaluations` table for analytics (phase 2)

---

## Phase 1: Schema Migration

### 1.1 Add New Columns to episode_templates

```sql
-- Migration: xxx_director_v2_episode_settings.sql

ALTER TABLE episode_templates
ADD COLUMN IF NOT EXISTS genre TEXT DEFAULT 'romance';

ALTER TABLE episode_templates
ADD COLUMN IF NOT EXISTS auto_scene_mode TEXT DEFAULT 'off';
-- Values: 'off', 'peaks', 'rhythmic'

ALTER TABLE episode_templates
ADD COLUMN IF NOT EXISTS scene_interval INT DEFAULT NULL;
-- Only used when auto_scene_mode = 'rhythmic'

ALTER TABLE episode_templates
ADD COLUMN IF NOT EXISTS spark_cost_per_scene INT DEFAULT 5;

ALTER TABLE episode_templates
ADD COLUMN IF NOT EXISTS series_finale BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN episode_templates.auto_scene_mode IS
  'off: manual only, peaks: on visual moments, rhythmic: every N turns';
```

### 1.2 Drop Legacy Columns (after data migration)

```sql
-- Migration: xxx_director_v2_cleanup.sql
-- Run AFTER updating existing data

ALTER TABLE episode_templates
DROP COLUMN IF EXISTS completion_mode;

ALTER TABLE episode_templates
DROP COLUMN IF EXISTS completion_criteria;

ALTER TABLE episode_templates
DROP COLUMN IF EXISTS beat_guidance;

-- Clean up director_state in sessions (remove beat tracking)
UPDATE sessions
SET director_state = '{}'::jsonb
WHERE director_state::text LIKE '%beats_completed%'
   OR director_state::text LIKE '%current_beat%';
```

### 1.3 Update Existing Episodes

```sql
-- Update Code Violet episodes
UPDATE episode_templates SET
  genre = 'medical_romance',
  auto_scene_mode = 'peaks',
  spark_cost_per_scene = 5
WHERE series_id = 'e4eb8fb1-2664-41b6-8d33-6736e4c40b67';

-- Update Penthouse Secrets episodes
UPDATE episode_templates SET
  genre = 'dark_romance',
  auto_scene_mode = 'peaks',
  spark_cost_per_scene = 5
WHERE series_id IN (SELECT id FROM series WHERE slug = 'penthouse-secrets');

-- Update other series (romance default)
UPDATE episode_templates SET
  genre = 'romance',
  auto_scene_mode = 'off',
  spark_cost_per_scene = 5
WHERE genre IS NULL OR genre = 'romance';

-- Mark series finales
UPDATE episode_templates SET series_finale = TRUE
WHERE title IN ('Dawn Rounds', 'The Price');
```

---

## Phase 2: Director Service Refactor

### 2.1 New Evaluation Method

**File**: `substrate-api/api/src/app/services/director.py`

```python
async def evaluate_exchange(
    self,
    messages: list[dict],
    character_name: str,
    genre: str,
    situation: str,
    dramatic_question: str,
) -> dict:
    """Semantic evaluation of exchange."""

    # Format recent messages (last 3 exchanges = 6 messages)
    recent = messages[-6:] if len(messages) > 6 else messages
    formatted = "\n".join(
        f"{m['role'].upper()}: {m['content']}"
        for m in recent
    )

    prompt = f"""You are the Director observing a {genre} story.

Character: {character_name}
Situation: {situation}
Core tension: {dramatic_question}

RECENT EXCHANGE:
{formatted}

As a director, observe this moment. Answer naturally, then provide signals.

1. VISUAL: Would this exchange benefit from a visual element?
   - CHARACTER: A shot featuring the character (portrait, expression, pose)
   - OBJECT: Close-up of an item (letter, phone, key, evidence)
   - ATMOSPHERE: Setting/mood without character visible
   - INSTRUCTION: Game-like information (codes, hints, choices)
   - NONE: No visual needed

   If not NONE, describe what should be shown in one evocative sentence.

2. STATUS: Is this episode ready to close, approaching closure, or still unfolding?
   Explain briefly in terms that make sense for this {genre} story.

End with a signal line for parsing:
SIGNAL: [visual: character/object/atmosphere/instruction/none] [status: going/closing/done]
If visual is not "none", add: [hint: <description>]"""

    response = await self.llm.generate([
        {"role": "system", "content": "You are a story director. Be concise."},
        {"role": "user", "content": prompt}
    ], max_tokens=250)

    return self._parse_evaluation(response.content)


def _parse_evaluation(self, response: str) -> dict:
    """Parse natural language evaluation into actionable signals."""
    import re

    # Extract signal line with visual type
    signal_match = re.search(
        r'SIGNAL:\s*\[visual:\s*(character|object|atmosphere|instruction|none)\]\s*\[status:\s*(going|closing|done)\]',
        response, re.IGNORECASE
    )

    # Extract hint if present
    hint_match = re.search(r'\[hint:\s*([^\]]+)\]', response, re.IGNORECASE)

    if signal_match:
        visual_type = signal_match.group(1).lower()
        status_signal = signal_match.group(2).lower()
        visual_hint = hint_match.group(1).strip() if hint_match else None
    else:
        # Fallback parsing
        visual_type = 'none'
        status_signal = 'done' if 'done' in response.lower() else 'going'
        visual_hint = None

    return {
        "raw_response": response,
        "visual_type": visual_type,      # character/object/atmosphere/instruction/none
        "visual_hint": visual_hint,
        "status": status_signal,
    }
```

### 2.2 Action Decision Logic

```python
@dataclass
class DirectorActions:
    """Deterministic outputs for system behavior."""
    visual_type: str = "none"           # character/object/atmosphere/instruction/none
    visual_hint: Optional[str] = None
    suggest_next: bool = False
    deduct_sparks: int = 0
    save_memory: bool = False
    memory_content: Optional[str] = None
    needs_sparks: bool = False


def decide_actions(
    evaluation: dict,
    episode: EpisodeTemplate,
    session: Session,
) -> DirectorActions:
    """Convert semantic evaluation into deterministic actions."""

    actions = DirectorActions()
    turn = session.turn_count
    visual_type = evaluation.get("visual_type", "none")

    # --- Visual Generation ---
    auto_mode = getattr(episode, 'auto_scene_mode', 'off')

    if auto_mode == "peaks":
        # Generate on visual moments (any type except none)
        if visual_type != "none":
            actions.visual_type = visual_type
            actions.visual_hint = evaluation.get("visual_hint")
            # Only charge sparks for image generation (not instruction cards)
            if visual_type in ("character", "object", "atmosphere"):
                actions.deduct_sparks = getattr(episode, 'spark_cost_per_scene', 5)

    elif auto_mode == "rhythmic":
        interval = getattr(episode, 'scene_interval', 3)
        if turn > 0 and turn % interval == 0:
            # Use detected type, or default to character
            actions.visual_type = visual_type if visual_type != "none" else "character"
            actions.visual_hint = evaluation.get("visual_hint") or "the current moment"
            if actions.visual_type in ("character", "object", "atmosphere"):
                actions.deduct_sparks = getattr(episode, 'spark_cost_per_scene', 5)

    # --- Episode Progression ---
    status = evaluation.get("status", "going")
    turn_budget = getattr(episode, 'turn_budget', None)

    if status == "done":
        actions.suggest_next = True
    elif turn_budget and turn >= turn_budget:
        actions.suggest_next = True

    # --- Memory ---
    if status in ("closing", "done") and evaluation.get("raw_response"):
        actions.save_memory = True
        actions.memory_content = evaluation["raw_response"][:500]

    return actions
```

### 2.3 Action Execution with Spark Handling

```python
async def execute_actions(
    self,
    actions: DirectorActions,
    session: Session,
    user_id: UUID,
) -> DirectorActions:
    """Execute actions, handling spark balance."""

    from app.services.credits import CreditsService, InsufficientSparksError

    credits = CreditsService.get_instance()

    # Handle scene generation with spark check
    if actions.generate_scene and actions.deduct_sparks > 0:
        director_state = session.director_state or {}

        try:
            # Try to spend sparks
            await credits.spend(
                user_id=user_id,
                feature_key="auto_scene",
                explicit_cost=actions.deduct_sparks,
                reference_id=str(session.id),
                metadata={"scene_hint": actions.scene_hint},
            )
            # Sparks deducted, proceed with generation

        except InsufficientSparksError as e:
            # Can't afford
            actions.generate_scene = False
            actions.deduct_sparks = 0

            # Only show prompt once per episode
            if not director_state.get("spark_prompt_shown"):
                actions.needs_sparks = True
                director_state["spark_prompt_shown"] = True
                # Update session state
                await self._update_director_state(session.id, director_state)

    return actions
```

### 2.4 Refactored process_exchange

```python
async def process_exchange(
    self,
    session: Session,
    episode_template: Optional[EpisodeTemplate],
    messages: List[Dict[str, str]],
    character_id: UUID,
    user_id: UUID,
) -> DirectorOutput:
    """Process exchange with semantic evaluation."""

    # 1. Increment turn count
    new_turn_count = session.turn_count + 1

    # 2. Get episode context
    character = await self._get_character(character_id)

    # 3. Semantic evaluation
    if episode_template:
        evaluation = await self.evaluate_exchange(
            messages=messages,
            character_name=character.name,
            genre=getattr(episode_template, 'genre', 'romance'),
            situation=episode_template.situation or "",
            dramatic_question=episode_template.dramatic_question or "",
        )
    else:
        # Free-form chat - minimal evaluation
        evaluation = {"status": "going", "visual_moment": None, "raw_response": ""}

    # 4. Decide actions
    actions = decide_actions(evaluation, episode_template, session) if episode_template else DirectorActions()

    # 5. Execute actions (spark check, etc.)
    actions = await self.execute_actions(actions, session, user_id)

    # 6. Update session state
    director_state = dict(session.director_state) if session.director_state else {}
    director_state["last_evaluation"] = {
        "status": evaluation.get("status"),
        "visual_moment": evaluation.get("visual_moment"),
        "turn": new_turn_count,
    }

    await self._update_session_director_state(
        session_id=session.id,
        turn_count=new_turn_count,
        director_state=director_state,
        is_complete=actions.suggest_next,
        completion_trigger="semantic" if evaluation.get("status") == "done" else "turn_limit" if actions.suggest_next else None,
    )

    # 7. Build output
    return DirectorOutput(
        extracted_memories=[],
        beat_data=None,
        extracted_hooks=[],
        turn_count=new_turn_count,
        is_complete=actions.suggest_next,
        completion_trigger="semantic" if evaluation.get("status") == "done" else None,
        structured_response=None,
        evaluation=evaluation,
        actions=actions,  # New field
    )
```

---

## Phase 3: Stream Events & Frontend

### 3.1 New Stream Events

**In `conversation.py`:**

```python
# After director processes exchange
if director_output.actions:
    actions = director_output.actions

    # Scene pending (if generating)
    if actions.generate_scene:
        yield json.dumps({
            "type": "scene_pending",
            "scene_hint": actions.scene_hint,
            "sparks_deducted": actions.deduct_sparks,
        }) + "\n"

        # Kick off async scene generation
        asyncio.create_task(
            self._generate_and_emit_scene(
                session=session,
                scene_hint=actions.scene_hint,
                # ... other params
            )
        )

    # Needs sparks prompt
    if actions.needs_sparks:
        yield json.dumps({
            "type": "needs_sparks",
            "balance": user.spark_balance,
            "cost": episode_template.spark_cost_per_scene,
        }) + "\n"

# Director state (always)
yield json.dumps({
    "type": "director",
    "turn_count": director_output.turn_count,
    "status": director_output.evaluation.get("status") if director_output.evaluation else "going",
    "turns_remaining": max(0, turn_budget - director_output.turn_count) if turn_budget else None,
}) + "\n"

# Episode complete
if director_output.is_complete:
    yield json.dumps({
        "type": "episode_complete",
        "turn_count": director_output.turn_count,
        "trigger": director_output.completion_trigger or "unknown",
        "next_suggestion": await self.director.suggest_next_episode(session, None),
    }) + "\n"
```

### 3.2 TypeScript Types

**In `web/src/types/index.ts`:**

```typescript
// New stream event types
interface StreamScenePendingEvent {
  type: "scene_pending";
  scene_hint: string;
  sparks_deducted: number;
}

interface StreamSceneReadyEvent {
  type: "scene_ready";
  image_url: string;
  caption?: string;
}

interface StreamNeedsSparksEvent {
  type: "needs_sparks";
  balance: number;
  cost: number;
}

interface StreamDirectorEvent {
  type: "director";
  turn_count: number;
  status: "going" | "closing" | "done";
  turns_remaining: number | null;
}
```

### 3.3 Frontend Handling

**In `useChat.ts`:**

```typescript
// Handle scene_pending
case "scene_pending":
  setScenePending({
    hint: event.scene_hint,
    sparksDeducted: event.sparks_deducted,
  });
  break;

// Handle scene_ready
case "scene_ready":
  setScenePending(null);
  addSceneCard({
    imageUrl: event.image_url,
    caption: event.caption,
  });
  break;

// Handle needs_sparks
case "needs_sparks":
  setSparkPrompt({
    balance: event.balance,
    cost: event.cost,
  });
  break;
```

---

## Phase 4: Testing & Cleanup

### 4.1 Test Cases

1. **Peaks mode**: Visual moment detection triggers scene
2. **Rhythmic mode**: Scene every N turns regardless of content
3. **Spark deduction**: Balance decreases, transaction created
4. **Insufficient sparks**: First time shows prompt, subsequent skip
5. **Semantic closure**: LLM says "done" → suggest_next fires
6. **Turn limit**: Budget reached → suggest_next fires
7. **Memory save**: Closing/done saves evaluation to memory

### 4.2 Cleanup Tasks

- [ ] Delete old `completion_mode`, `completion_criteria`, `beat_guidance` columns
- [ ] Remove `check_completion()` old logic
- [ ] Remove `_evaluate_flirt_archetype()` if not needed
- [ ] Update API docs
- [ ] Clean test sessions with corrupted director_state

---

## File Changes Summary

| File | Changes |
|------|---------|
| `director.py` | Add `evaluate_exchange`, `_parse_evaluation`, `decide_actions`, `execute_actions`; refactor `process_exchange` |
| `conversation.py` | Add new stream events; wire async scene generation |
| `credits.py` | Add `auto_scene` feature key (or use explicit_cost) |
| `episode_template.py` | Add new fields to model |
| `useChat.ts` | Handle new event types |
| `types/index.ts` | Add new event interfaces |
| Migration SQL | Schema changes |

---

## Rollout

1. **Day 1**: Schema migration (add columns, keep old)
2. **Day 2**: Deploy backend changes (new evaluation running alongside old)
3. **Day 3**: Frontend changes
4. **Day 4**: Test thoroughly
5. **Day 5**: Drop legacy columns, cleanup
