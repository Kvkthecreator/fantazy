# Episode System

> **Version**: 2.0
> **Updated**: 2024-12-20
> **Status**: Canonical

---

## Overview

This document defines the episode system: what episodes are, how they work at runtime, and how they create value. It consolidates episode philosophy and mechanics into a single authoritative reference.

**Core Premise:**
> The journey IS the experience. Structure exists to enhance the moment-to-moment interaction, not to gate a destination.

---

## 1. What Is an Episode?

An **Episode** is a self-contained, high-tension narrative moment that advances the emotional relationship between user and character.

### Episodes ARE:
- **In media res** - Already happening when you enter
- **Emotionally charged** - Stakes from the first message
- **Narratively gravitational** - Wants to go somewhere
- **Anticipation-building** - Leaves you wanting more

### Episodes are NOT:
- Backstory dumps
- Generic roleplay prompts
- Interchangeable scenarios
- Chat sandboxes

---

## 2. Episode Types

| Type | Purpose | Access | Example |
|------|---------|--------|---------|
| **Entry (Ep 0)** | First impression, hook | Always accessible | "Coffee Shop Crush" |
| **Core (Ep 1-N)** | Relationship progression | Sequential | "The Second Cup" |
| **Expansion** | Deeper facets, reward | Conditional | "Her Sketchbook" |
| **Special** | Experiments, events | Labeled non-canon | "Valentine's Day" |

### Entry Episode (Episode 0)
- One per series
- Optimized for cold-start attraction
- Must answer within 30 seconds: Who? Where? Why charged? Why reply now?
- The sharpest hook, not the shallowest episode

### Core Episodes
- Sequential progression within series
- Each changes the relationship state
- Unlocking based on engagement, not grinding

### Expansion Episodes
- Explore alternate emotional facets
- Feel like: "You've reached a side not everyone sees"

### Special Episodes
- Clearly labeled non-canon
- Do not affect progression
- Seasonal events, what-ifs, experiments

---

## 3. Episode Template Schema

```
EPISODE TEMPLATE
═══════════════════════════════════════════════════════════════

1. METADATA
   ├── title, slug, episode_number
   ├── episode_type: entry | core | expansion | special
   ├── series_id
   └── character_id

2. DRAMATIC QUESTION
   └── The tension to explore (not an objective)
   └── Example: "Will she let you stay after closing?"

3. OPENING STATE
   ├── situation: Physical setting (CRITICAL for grounding)
   ├── episode_frame: Stage direction
   ├── opening_line: Character's first message
   └── background_image_url: Visual context

4. SCENE MOTIVATION (ADR-002 Theatrical Model)
   ├── scene_objective: What character wants from user
   ├── scene_obstacle: What's stopping them
   └── scene_tactic: How they're playing it

5. RESOLUTION SPACE
   └── resolution_types: [positive, neutral, negative, surprise]

6. DIRECTOR SIGNALS
   ├── auto_scene_mode: off | peaks | rhythmic
   ├── scene_interval: N (if rhythmic)
   └── spark_cost_per_scene: int
```

### Situation Field (Critical)

The `situation` field is the most important for immersive responses. It provides physical grounding.

**Good** (with situation): "I glance up from the espresso machine, steam rising..."
**Bad** (without): "I look at you with a mysterious smile..."

---

## 4. Session Lifecycle

```
USER ENTERS EPISODE
        │
        ▼
┌─────────────────────────────────────────┐
│ OPENING PHASE                           │
│ • Episode frame displayed               │
│ • Character delivers opening line       │
│ • Dramatic question is implicit         │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ MIDDLE PHASE (Guided Improvisation)     │
│ • User and character exchange messages  │
│ • Director observes each exchange       │
│ • Tension escalates naturally           │
│ • Scene images generated at moments     │
│ • Memory extraction ongoing             │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ RESOLUTION DETECTION                    │
│ Director signals: going → closing → done│
│ (NOT arbitrary message count)           │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ CLOSING PHASE                           │
│ • Resolution type determined            │
│ • Memory extraction finalized           │
│ • Hooks captured for future             │
│ • Next episode suggested                │
└─────────────────────────────────────────┘
```

### Session States

| State | Definition | User Experience |
|-------|------------|-----------------|
| **Active** | Currently in conversation | Chat interface open |
| **Paused** | User left mid-conversation | Can resume where left off |
| **Faded** | Natural conversation pause | Can extend or start new |
| **Complete** | Dramatic arc addressed | Badge, suggested next |

**Key Principle:** Episodes don't "end" — they **fade** with natural closings. User always has control.

---

## 5. The Director System

The **Director** is a hidden system entity that observes conversations and drives episode experience.

### Director Evaluation (Per Exchange)

After each character response, the Director evaluates:

| Signal | Values | Purpose |
|--------|--------|---------|
| `status` | `going`, `closing`, `done` | Episode progression |
| `visual_type` | `character`, `object`, `atmosphere`, `instruction`, `none` | What visual to generate |
| `visual_hint` | Description string | Scene generation guidance |

### Visual Type Taxonomy

| Type | Description | Cost |
|------|-------------|------|
| `character` | Character in moment (portrait + setting) | Sparks |
| `object` | Close-up of item (letter, phone, key) | Sparks |
| `atmosphere` | Setting/mood without character | Sparks |
| `instruction` | Game-like text (codes, hints) | Free |
| `none` | No visual needed | Free |

### Auto-Scene Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `off` | Manual only | Default |
| `peaks` | Generate on visual moments | Emotional highs |
| `rhythmic` | Every N turns + peaks | Comic-book feel |

---

## 6. Progression Model

### What Progresses

| Layer | What Changes | User Feels |
|-------|--------------|------------|
| **Memory** | Facts accumulate | "She remembers me" |
| **Episodes** | New content recommended | "More to discover" |
| **Behavior** | LLM adjusts based on history | "She's different now" |
| **Reveals** | Later episodes show more | "Learning her secrets" |

### Memory Scoping

**Critical Architecture Decision:** Memory is scoped at the **Series level**, not Character level.

- Memory belongs to "your story with this series"
- Different series with same character have independent memory
- Enables future remix features without memory contamination

```
SERIES: "Stolen Moments" (Soo-ah)
Session 1 → Memory: "User's name is Alex"
Session 2 → Character: "Alex, right?"

DIFFERENT SERIES: "Summer Café" (also Soo-ah)
Session 1 → Memory: NONE (fresh series)
```

---

## 7. Series Types

### Standalone
- Episodes don't build on each other
- Any order, high replay value
- Best for: variety, casual engagement

### Serial
- Episodes build sequentially
- Memory critical for continuity
- Best for: deep engagement, relationship arcs

### Anthology
- Thematic connection, not sequential
- Same character, different situations
- Best for: thematic exploration

### Crossover
- Characters from different series meet
- Special event feel
- Best for: surprises, limited-time content

---

## 8. User Control Model

> **Users control WHEN and WHICH episodes. Platform controls HOW the episode unfolds.**

### User Controls
| Domain | Control |
|--------|---------|
| Navigation | Which episode, when to start/leave |
| Pacing | How fast to respond, when to return |
| Exploration | Which series, which character |
| Conversation | Messages steer direction |

### Platform Controls
| Domain | Control |
|--------|---------|
| Narrative | How story unfolds, character behavior |
| Stakes | Character authenticity, consequences |
| Progression | What unlocks, what's recommended |

### Netflix-Style Freedom
- Start anywhere (any entry episode)
- Skip forward (jump to next)
- Rewatch (replay with memory)
- Pause (session resumable)
- Binge (multiple sessions)

---

## 9. Stakes & Authenticity

### What Creates Stakes

| Mechanism | Example |
|-----------|---------|
| Character Autonomy | Character can reject, get upset |
| Temporal Tension | "Café is closing" |
| Emotional Investment | Memory makes loss feel real |
| Consequence Persistence | Bad outcomes remembered |

### Character Autonomy Spectrum

```
Servile (BAD)         Authentic (GOOD)        Hostile (BAD)
─────────────────────────────────────────────────────────
"Whatever you want"   "I don't know..."       "I hate you"
Always agrees         Has moods, limits       Always rejects
User gets bored       User feels stakes       User gives up
```

### Failure Handling

**Decision:** Recoverable but remembered.

- Bad outcomes persist in memory
- Recovery paths built into future content
- Failure becomes PART of the story, not the end

---

## 10. Context Management

### Context Build Per Session

```
1. CHARACTER FOUNDATION
   └── Character system prompt

2. EPISODE CONTEXT
   ├── Situation (physical grounding)
   ├── Episode frame
   ├── Dramatic question
   └── Resolution space

3. SERIES MEMORY (series-scoped)
   ├── All memories within THIS series
   └── Relevance-weighted

4. SERIES CONTEXT (serial only)
   └── Previous episode summaries

5. SESSION HISTORY
   └── Current conversation messages
```

### Token Budget

| Layer | Budget | Priority |
|-------|--------|----------|
| Character prompt | ~500-800 | Critical |
| Episode context | ~300-500 | Critical |
| Memory context | ~500-1000 | High |
| Series context | ~200-400 | Medium (serial) |
| Session history | Remaining | Sliding window |

---

## 11. Database Schema Reference

### Key Tables

| Table | Purpose |
|-------|---------|
| `episode_templates` | Episode definitions |
| `sessions` | Runtime conversations |
| `memory_events` | Extracted facts (series-scoped) |
| `engagements` | User-character stats |

### Session Scoping

Sessions are scoped by: `(user_id, series_id, episode_template_id)`

- Each episode within series has independent session
- `episode_template_id = NULL` = free chat mode
- Memory queries use `series_id` as primary scope

---

## 12. Configuration Reference

### Episode Template Fields

| Field | Type | Purpose |
|-------|------|---------|
| `situation` | text | Physical setting (CRITICAL) |
| `episode_frame` | text | Stage direction |
| `dramatic_question` | text | Tension to explore |
| `scene_objective` | text | What character wants (ADR-002) |
| `scene_obstacle` | text | What's stopping them (ADR-002) |
| `scene_tactic` | text | How they're playing it (ADR-002) |
| `resolution_types` | text[] | Valid endings |
| `auto_scene_mode` | enum | off, peaks, rhythmic |
| `scene_interval` | int | Turns between scenes (rhythmic) |

### Session Fields

| Field | Type | Values |
|-------|------|--------|
| `session_state` | varchar | active, paused, faded, complete |
| `resolution_type` | varchar | positive, neutral, negative, surprise |
| `episode_summary` | text | Generated at completion (serial) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2024-12-20 | Consolidated philosophy + dynamics, Director V2 integration |
| 1.0 | 2024-12 | Initial episode dynamics canon |
