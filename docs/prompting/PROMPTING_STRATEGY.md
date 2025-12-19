# Prompting Strategy

> **Version**: 2.0
> **Updated**: 2024-12-20
> **Status**: Active

---

## Overview

This document defines how prompts are configured and composed for the Fantazy conversation system. The system uses a **layered prompt architecture** where static configuration (character, episode) combines with dynamic runtime context (memories, conversation history, Director feedback).

---

## Prompt Composition Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: CHARACTER IDENTITY (static)                          │
│  Source: characters.system_prompt                               │
│  Defines: Voice, personality, boundaries, response style        │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: SERIES/EPISODE CONTEXT (static per episode)          │
│  Source: episode_templates, series                              │
│  Defines: Setting, dramatic question, genre, resolution types   │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: ENGAGEMENT CONTEXT (dynamic)                         │
│  Source: engagements, sessions                                  │
│  Defines: History depth, time together, dynamic (tone/tension)  │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: MEMORY & HOOKS (dynamic, retrieved)                  │
│  Source: memory_events, hooks                                   │
│  Defines: User facts, preferences, follow-up topics             │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: CONVERSATION STATE (dynamic, per-turn)               │
│  Source: messages, Director evaluation                          │
│  Defines: Recent exchanges, turn count, progression signals     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 6: DIRECTOR FEEDBACK (dynamic, per-turn)                │
│  Source: DirectorService evaluation                             │
│  Defines: Visual triggers, completion status, narrative pacing  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer Details

### Layer 1: Character Identity

**Source**: `characters` table

| Field | Purpose |
|-------|---------|
| `system_prompt` | Core character voice and behavior doctrine |
| `baseline_personality` | Trait weights (warmth, wit, intensity) |
| `tone_style` | Response style (formal, casual, poetic) |
| `speech_patterns` | Linguistic quirks, catchphrases |
| `life_arc` | Current goal, struggle, secret dream |
| `boundaries` | Content limits for this character |

**Placeholders in system_prompt**:
- `{memories}` → Injected from Layer 4
- `{hooks}` → Injected from Layer 4
- `{relationship_stage}` → From Layer 3 (deprecated, always "acquaintance")

### Layer 2: Series/Episode Context

**Source**: `episode_templates`, `series` tables

| Field | Purpose |
|-------|---------|
| `situation` | **Physical setting** - grounds ALL responses spatially |
| `episode_frame` | Stage direction / narrative framing |
| `dramatic_question` | Core tension to explore (not resolve quickly) |
| `resolution_types` | Valid ways this episode can conclude |
| `genre` | Informs Director evaluation style |
| `series_id` | Links episodes for serial continuity |

**Critical**: `situation` is the most important field. Without physical grounding, responses become generic.

**Good** (with situation): "I glance up from the espresso machine, steam rising..."
**Bad** (without): "I look at you with a mysterious smile..."

### Layer 3: Engagement Context

**Source**: `engagements`, `sessions` tables

| Field | Purpose |
|-------|---------|
| `total_sessions` | How many conversations with this character |
| `total_messages` | Message count for depth estimation |
| `time_since_first_met` | "2 weeks", "3 days" - temporal grounding |
| `dynamic.tone` | Current emotional register |
| `dynamic.tension_level` | 0-100 intensity scale |

**Note**: Stage progression (`acquaintance` → `intimate`) is sunset. Connection depth is implicit via session/message counts and memory richness.

### Layer 4: Memory & Hooks

**Source**: `memory_events`, `hooks` tables (retrieved by relevance)

| Type | Retrieval | Purpose |
|------|-----------|---------|
| Memories | 10 most relevant (importance + recency) | User facts, preferences, history |
| Hooks | 5 active (untriggered, past trigger date) | Follow-up conversation topics |

**Memory types**: `fact`, `preference`, `event`, `goal`, `relationship`, `emotion`

**Hook types**: `reminder`, `follow_up`, `milestone`, `scheduled`

### Layer 5: Conversation State

**Source**: `messages` table, session state

| Field | Purpose |
|-------|---------|
| `messages` | Last 20 messages for context window |
| `turn_count` | Exchange count this episode |
| `session_state` | `active`, `paused`, `faded`, `complete` |

**Turn counting**: One turn = one user message + one character response. Turn count informs:
- Director rhythmic visual triggers
- Episode pacing decisions
- Conversation depth awareness

### Layer 6: Director Feedback

**Source**: `DirectorService` evaluation (runs after each character response)

| Signal | Values | Purpose |
|--------|--------|---------|
| `status` | `going`, `closing`, `done` | Episode progression state |
| `visual_type` | `character`, `object`, `atmosphere`, `instruction`, `none` | What visual (if any) to generate |
| `visual_hint` | String description | Scene generation guidance |

**The Director Loop**:
```
User message → Character responds → Director evaluates → Actions triggered
                                           ↓
                     [generate visual? suggest next episode? extract memory?]
```

---

## Runtime Flow

### Per-Turn Sequence

```
1. CONTEXT BUILD
   ├── Fetch character (Layer 1)
   ├── Fetch episode template (Layer 2)
   ├── Fetch engagement (Layer 3)
   ├── Retrieve memories & hooks (Layer 4)
   └── Fetch recent messages (Layer 5)

2. PROMPT COMPOSE
   ├── Inject memories/hooks into character system_prompt
   ├── Append engagement context
   ├── Append episode dynamics (situation, frame, question)
   ├── Append moment layer (last exchange + tension)
   └── Format message array for LLM

3. CHARACTER LLM CALL
   └── Generate response (streamed to user)

4. DIRECTOR EVALUATION (post-response)
   ├── Evaluate exchange semantically
   ├── Determine visual_type and status
   └── Return action signals

5. ACTION EXECUTION
   ├── If visual_type != 'none': trigger scene generation
   ├── If status == 'done': suggest next episode
   ├── Extract memories (background)
   └── Extract hooks (background)
```

---

## Configuration Reference

### Retrieval Limits

| Parameter | Default | Location |
|-----------|---------|----------|
| Message history | 20 | `conversation.py` |
| Memory retrieval | 10 | `conversation.py` |
| Hook retrieval | 5 | `conversation.py` |
| Director context | 6 messages (3 exchanges) | `director.py` |

### LLM Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| Model | `gemini-2.0-flash` | Primary conversation model |
| Temperature | 0.8 | Response creativity |
| Max tokens | 1024 | Response length cap |

### Director Triggers

| Mode | Trigger | Configuration |
|------|---------|---------------|
| `peaks` | Semantic (Director decides) | Default |
| `rhythmic` | Every N turns | `scene_interval` field |
| `off` | Manual only | `auto_scene_mode = 'off'` |

---

## Token Budget

### Per-Turn Estimate

| Component | Tokens |
|-----------|--------|
| Character system_prompt | 200-500 |
| Memories (10) | 200-400 |
| Hooks (5) | 100-200 |
| Episode dynamics | ~150 |
| Engagement context | ~100 |
| Message history (20) | 1000-3000 |
| User message | 20-200 |
| **Input Total** | **~2000-4500** |
| **Output (response)** | 100-300 |

### LLM Calls Per Turn

| Call | Purpose | Blocking |
|------|---------|----------|
| Character response | Main dialogue | Yes (streamed) |
| Director evaluation | Visual/progression | No (post-response) |
| Memory extraction | Save user facts | No (background) |
| Hook extraction | Save follow-ups | No (background) |

---

## Key Files

| File | Purpose |
|------|---------|
| `services/conversation.py` | Orchestrates full flow, builds context |
| `services/director.py` | Semantic evaluation, action decisions |
| `models/message.py` | `ConversationContext`, `to_messages()` |
| `services/memory.py` | Memory/hook extraction prompts |
| `services/llm.py` | LLM provider abstraction |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2024-12-20 | Director V2 semantic evaluation, visual taxonomy |
| 1.0 | 2024-12 | Initial layered architecture |
