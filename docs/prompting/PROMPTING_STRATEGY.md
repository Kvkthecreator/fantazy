# Prompting Strategy

> **Version**: 2.1
> **Updated**: 2024-12-20
> **Status**: Canonical (verified against codebase)

---

## Overview

This document defines how prompts are configured and composed for the Fantazy conversation system. The system uses a **layered prompt architecture** where static configuration (character, episode) combines with dynamic runtime context (memories, conversation history, Director feedback).

**Core Architecture**: Actor/Director Model
- **Episode Template** = Director's Notes (situation, dramatic_question, frame)
- **Character System Prompt** = Actor's Direction (genre doctrine, personality)
- **ConversationContext** = Stage Setup (physical grounding, memories, hooks)
- **Director Service** = Runtime Orchestrator (semantic evaluation, completion, scene generation)

---

## Prompt Composition Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: CHARACTER IDENTITY (static)                          │
│  Source: characters.system_prompt + life_arc                    │
│  Defines: Voice, personality, boundaries, current struggles     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: EPISODE CONTEXT (static per episode)                 │
│  Source: episode_templates                                      │
│  Defines: Situation (CRITICAL), frame, dramatic_question       │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: ENGAGEMENT CONTEXT (dynamic per user)                │
│  Source: engagements                                            │
│  Defines: Session count, time together, tone/tension dynamic    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: MEMORY & HOOKS (dynamic, retrieved)                  │
│  Source: memory_events, hooks (series-scoped)                   │
│  Defines: User facts (10), follow-up topics (5)                │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: CONVERSATION STATE (per-turn)                        │
│  Source: messages (last 20), session.turn_count                │
│  Defines: Recent exchanges, moment layer                        │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 6: DIRECTOR FEEDBACK (post-response)                    │
│  Source: DirectorService.evaluate_exchange()                    │
│  Defines: Visual triggers, completion status, next episode      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer Details

### Layer 1: Character Identity

**Source**: `characters` table

| Field | DB Column | Purpose |
|-------|-----------|---------|
| System Prompt | `system_prompt` | Core voice, genre doctrine, behavior rules |
| Life Arc | `life_arc` (JSONB) | `{current_goal, current_struggle, secret_dream}` |
| Current Stressor | `current_stressor` | What's weighing on them now |
| Personality | `baseline_personality` | Trait weights (warmth, wit, intensity) |
| Tone Style | `tone_style` | Response style guidance |
| Speech Patterns | `speech_patterns` | Linguistic quirks, catchphrases |
| Boundaries | `boundaries` | Content limits for this character |

**Placeholders in system_prompt**:
- `{memories}` → Injected from Layer 4 (formatted by type)
- `{hooks}` → Injected from Layer 4 (with suggested openers)
- `{relationship_stage}` → Always "acquaintance" (stage progression sunset)

### Layer 2: Episode Context

**Source**: `episode_templates` table (via session.episode_template_id)

| Field | DB Column | Purpose |
|-------|-----------|---------|
| **Situation** | `situation` | **CRITICAL**: Physical grounding for ALL responses |
| Episode Frame | `episode_frame` | Director's stage direction (platform-generated) |
| Dramatic Question | `dramatic_question` | Core tension to explore (not resolve quickly) |
| Resolution Types | `resolution_types[]` | `['positive', 'neutral', 'negative', 'surprise']` |
| **Scene Objective** | `scene_objective` | What character wants from user this scene (ADR-002) |
| **Scene Obstacle** | `scene_obstacle` | What's stopping them from just asking (ADR-002) |
| **Scene Tactic** | `scene_tactic` | How they're trying to get what they want (ADR-002) |
| Genre | `genre` | Informs Director semantic evaluation |
| Turn Budget | `turn_budget` | Optional hard limit for completion |
| Auto Scene Mode | `auto_scene_mode` | `off`, `peaks`, `rhythmic` |
| Scene Interval | `scene_interval` | Turns between auto-scenes (rhythmic mode) |

**Scene Motivation (ADR-002 Theatrical Model)**:

Scene motivation fields are the "director's notes" internalized during rehearsal. They are injected into the prompt as:
```
SCENE MOTIVATION (internalized direction - play this subtly):
What you want: {scene_objective}
What's stopping you: {scene_obstacle}
How you're playing it: {scene_tactic}
```

**Physical Grounding is PRIMARY**:

The `situation` field is formatted FIRST in episode dynamics. The LLM is instructed to "ground ALL responses in this reality."

```
Good (with situation): "I glance up from the espresso machine, steam rising..."
Bad (without situation): "I look at you with a mysterious smile..."
```

### Layer 3: Engagement Context

**Source**: `engagements` table

| Field | DB Column | Purpose |
|-------|-----------|---------|
| Total Sessions | `total_sessions` | How many conversations with this character |
| Time Since First Met | calculated from `first_met_at` | "2 weeks", "3 days" - temporal grounding |
| Dynamic | `dynamic` (JSONB) | `{tone, tension_level, recent_beats[]}` |
| Milestones | `milestones[]` | Relationship achievements reached |

**Formatted in prompt as**:
```
RELATIONSHIP CONTEXT:
- Episodes together: {total_sessions}
- Time since meeting: {time_since_first_met}
- Current dynamic: {tone} at intensity {tension_level}/100
- Recent beats: {recent_beats}
```

### Layer 4: Memory & Hooks

**Source**: `memory_events`, `hooks` tables

**Memory Retrieval** (series-scoped):
```sql
SELECT * FROM memory_events
WHERE user_id = ? AND series_id = ?
  AND is_active = TRUE
ORDER BY importance_score DESC, created_at DESC
LIMIT 10
-- Max 3 per type via ROW_NUMBER partition
```

| Memory Type | Example | Prompt Section |
|-------------|---------|----------------|
| `fact` | "Works as a teacher" | "About them:" |
| `event` | "Starting new job next month" | "Recent in their life:" |
| `preference` | "Loves indie rock" | "Their tastes:" |
| `relationship` | "Close with their mom" | "People in their life:" |
| `goal` | "Wants to travel to Japan" | "Goals/aspirations:" |
| `emotion` | "Excited but nervous" | "How they've been feeling:" |

**Hook Retrieval**:
```sql
SELECT * FROM hooks
WHERE user_id = ? AND character_id = ?
  AND is_active = TRUE
  AND trigger_after <= NOW()
  AND triggered_at IS NULL
ORDER BY priority DESC
LIMIT 5
```

| Hook Type | Example | Purpose |
|-----------|---------|---------|
| `reminder` | Job interview Thursday | Time-based callback |
| `follow_up` | Their sister's wedding | Topic to revisit |
| `milestone` | First month together | Relationship marker |
| `scheduled` | Birthday next week | Calendar event |

### Layer 5: Conversation State

**Source**: `messages` table, `sessions` table

| Field | Source | Purpose |
|-------|--------|---------|
| Messages | Last 20 from `messages` | Context window |
| Turn Count | `sessions.turn_count` | Director tracking |
| Session State | `sessions.session_state` | `active`, `paused`, `faded`, `complete` |

**Moment Layer** (appended to prompt):
```
MOMENT LAYER (Priority - respond to THIS):
- Their last line: "{last_user_message}"
- Your last line: "{last_assistant_message}"
- Unresolved tension: {dramatic_question}
- Setting anchor: {situation}
```

### Layer 6: Director Feedback

**Source**: `DirectorService.evaluate_exchange()` (runs post-response)

The Director receives the last 6 messages (3 exchanges) and evaluates semantically:

**Evaluation Input**:
- `messages[-6:]` - Recent exchanges
- `character_name` - For context
- `genre` - From episode_template
- `situation` - Physical setting
- `dramatic_question` - Core tension

**Evaluation Output**:
```python
{
    "visual_type": "character|object|atmosphere|instruction|none",
    "visual_hint": "evocative description for scene generation",
    "status": "going|closing|done"
}
```

**Director Actions** (deterministic from evaluation):
```python
DirectorActions(
    visual_type: str,           # What kind of visual
    visual_hint: str,           # Scene prompt
    suggest_next: bool,         # Recommend next episode
    deduct_sparks: int,         # Cost (default 5)
    needs_sparks: bool,         # First-time spark prompt
)
```

---

## Turn Count & Conversation Evolution

### How Turn Count Influences the Experience

Turn count is tracked in `sessions.turn_count` and incremented after each exchange.

**Turn Count Effects**:

| Turn Range | Director Behavior | Narrative Effect |
|------------|-------------------|------------------|
| 0-3 | Establishment | Setting grounded, tension introduced |
| 4-8 | Development | Relationship dynamic explored |
| 8-15 | Escalation | Stakes raised, visual moments likely |
| 15+ | Resolution zone | Director may signal "closing" or "done" |

**Completion Triggers**:

| Trigger | Condition | Result |
|---------|-----------|--------|
| Semantic | Director returns `status: "done"` | `completion_trigger: "semantic"` |
| Turn Limit | `turn_count >= turn_budget` | `completion_trigger: "turn_limit"` |

### Auto-Scene Generation Based on Turns

**Mode: `peaks`** (default)
- Director evaluates each exchange semantically
- If `visual_type != "none"`, triggers scene generation
- Happens at emotional peaks naturally

**Mode: `rhythmic`**
- Generates scene every `scene_interval` turns
- PLUS semantic peaks
- Creates comic-book pacing feel

**Mode: `off`**
- No auto-generation
- User must manually request ("Visualize it")

---

## Director Feedback Loop

The Director creates a feedback loop that influences conversation progression:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONVERSATION TURN                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. BUILD CONTEXT                                                │
│     get_context() assembles all 6 layers                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. CHARACTER LLM                                                │
│     to_messages() → LLM → Streamed response to user             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. DIRECTOR EVALUATION (post-response)                         │
│     evaluate_exchange() → {visual_type, status, hint}           │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  VISUAL ACTION   │ │  COMPLETION      │ │  MEMORY ACTION   │
│  if visual_type  │ │  if status=done  │ │  extract_memories│
│  != "none"       │ │  or turn_budget  │ │  extract_hooks   │
│  → generate_scene│ │  → suggest_next  │ │  (background)    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. STATE UPDATE                                                 │
│     session.turn_count++                                        │
│     session.director_state = {last_evaluation}                  │
│     if complete: session_state = "complete"                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [NEXT TURN or COMPLETION]
```

**Director State Persistence**:
```python
session.director_state = {
    "last_evaluation": {visual_type, status, hint},
    "spark_prompt_shown": bool  # Avoid repeated prompts
}
```

---

## Series-Scoped Memory

**Critical Architecture Decision**: Memory is scoped at the **Series level**, not Character level.

```sql
-- Memory retrieval prioritizes series_id
SELECT * FROM memory_events
WHERE user_id = :user_id
  AND series_id = :series_id  -- PRIMARY SCOPE
  AND is_active = TRUE
```

**Implications**:
- Memory belongs to "your story with this series"
- Same character in different series = independent memories
- Enables future remix features without memory contamination

```
SERIES: "Stolen Moments" (Soo-ah)
└── Session 1: Memory: "User's name is Alex"
└── Session 2: Character: "Alex, right?"

DIFFERENT SERIES: "Summer Café" (also Soo-ah)
└── Session 1: Memory: NONE (fresh series)
```

---

## Configuration Reference

### Retrieval Limits

| Parameter | Default | Location |
|-----------|---------|----------|
| Message history | 20 | `conversation.py:get_context()` |
| Memory retrieval | 10 (max 3 per type) | `memory.py:get_relevant_memories()` |
| Hook retrieval | 5 | `conversation.py:get_context()` |
| Director context | 6 messages (3 exchanges) | `director.py:evaluate_exchange()` |

### LLM Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| Model | `gemini-2.0-flash` | Primary conversation model |
| Temperature | 0.8 | Response creativity |
| Max tokens | 1024 | Response length cap |

### Episode Template Fields

| Field | Type | Purpose |
|-------|------|---------|
| `situation` | TEXT | **CRITICAL**: Physical grounding |
| `episode_frame` | TEXT | Platform stage direction |
| `dramatic_question` | TEXT | Core narrative tension |
| `resolution_types` | TEXT[] | Valid endings |
| `scene_objective` | TEXT | What character wants from user (ADR-002) |
| `scene_obstacle` | TEXT | What's stopping them (ADR-002) |
| `scene_tactic` | TEXT | How they're playing it (ADR-002) |
| `genre` | TEXT | Director evaluation context |
| `auto_scene_mode` | TEXT | `off`, `peaks`, `rhythmic` |
| `scene_interval` | INT | Turns between rhythmic scenes |
| `turn_budget` | INT | Optional hard completion limit |
| `spark_cost_per_scene` | INT | Cost per auto-scene (default 5) |

---

## Token Budget

### Per-Turn Estimate

| Component | Tokens |
|-----------|--------|
| Character system_prompt | 200-500 |
| Life arc | ~100 |
| Memories (10) | 200-400 |
| Hooks (5) | 100-200 |
| Episode dynamics | ~150 |
| Engagement context | ~100 |
| Moment layer | ~120 |
| Message history (20) | 1000-3000 |
| User message | 20-200 |
| **Input Total** | **~2000-4800** |
| **Output (response)** | 100-300 |

### LLM Calls Per Turn

| Call | Purpose | Timing |
|------|---------|--------|
| Character response | Main dialogue | Blocking (streamed) |
| Director evaluation | Visual/progression | Post-response |
| Memory extraction | Save user facts | Background |
| Hook extraction | Save follow-ups | Background |

---

## Key Files

| File | Purpose |
|------|---------|
| `services/conversation.py` | `get_context()`, `send_message_stream()` |
| `models/message.py` | `ConversationContext`, `to_messages()` |
| `services/director.py` | `evaluate_exchange()`, `decide_actions()` |
| `services/memory.py` | `extract_memories()`, `get_relevant_memories()` |
| `services/llm.py` | LLM provider abstraction |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1 | 2024-12-20 | Verified against codebase, added turn count effects, Director feedback loop |
| 2.0 | 2024-12-20 | Director V2 semantic evaluation, visual taxonomy |
| 1.0 | 2024-12 | Initial layered architecture |
