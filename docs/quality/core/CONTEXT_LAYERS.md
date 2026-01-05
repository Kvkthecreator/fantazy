# Context Layers

> **Version**: 1.5.0
> **Status**: Active
> **Updated**: 2025-01-01

---

## Purpose

This document defines the **6-layer context architecture** that composes every character prompt. It specifies what each layer contributes and how layers interact.

---

## Layer Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: CHARACTER IDENTITY                                    │
│  Static per character. Voice, personality, boundaries.          │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: EPISODE CONTEXT                                       │
│  Static per episode. Situation, frame, dramatic question.       │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2.5: PROPS (ADR-005)                                     │
│  Static per episode. Canonical objects with exact content.      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: ENGAGEMENT CONTEXT                                    │
│  Dynamic per user. Session count, time together, dynamic.       │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: MEMORY & HOOKS                                        │
│  Dynamic, retrieved. User facts, pending callbacks.             │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: CONVERSATION STATE                                    │
│  Per-turn. Recent messages, turn count, moment focus.           │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 6: DIRECTOR GUIDANCE                                     │
│  Per-turn. Pacing hint, tension note, genre beat.               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Character Identity

**Source**: `characters` table
**Refresh**: Never (static)

### Components

| Component | Purpose | Example |
|-----------|---------|---------|
| System Prompt | Core voice and behavior | Genre doctrine, communication style |
| Backstory | Character history/context | Background, motivations, personality depth |
| Personality | Trait weights | Warmth: 0.8, Wit: 0.6, Intensity: 0.7 |
| Flirting Level | Energy/intimacy intensity | reserved, playful, flirty, bold |
| Speech Patterns | Voice consistency | Emoji usage, slang level, message length |
| Likes/Dislikes | Preferences (first 5 used) | Conversation hooks and personality details |

> **Note**: `life_arc` and `current_stressor` have been removed. Character emotional state is now conveyed through episode `situation`. Backstory + archetype + genre doctrine provide sufficient character depth.
>
> **Note**: Boundaries simplified to only `flirting_level` and `nsfw_allowed`. Removed unused fields: `availability`, `vulnerability_pacing`, `desire_expression`, `physical_comfort`, `can_reject_user`, `relationship_max_stage`, `avoided_topics`, `has_own_boundaries`, `dynamics_notes`.

### Quality Impact
- **High**: Determines voice consistency
- **Failure mode**: Character sounds generic or inconsistent

---

## Layer 2: Episode Context

**Source**: `episode_templates` table
**Refresh**: Per episode

### Components

| Component | Purpose | Priority |
|-----------|---------|----------|
| **Situation** | Physical grounding | CRITICAL |
| Episode Frame | Stage direction | High |
| Dramatic Question | Core tension | High |
| **Scene Objective** | What character wants (ADR-002) | High |
| **Scene Obstacle** | What's stopping them (ADR-002) | High |
| **Scene Tactic** | How they're playing it (ADR-002) | High |
| Genre | Doctrine selection | High |
| Resolution Types | Valid endings | Medium |

### Director Configuration Fields

| Field | Purpose | Owner |
|-------|---------|-------|
| `turn_budget` | Pacing calculation (establish/develop/escalate/peak/resolve) | Director |
| `genre` | Semantic evaluation context | Director + Character |

**`turn_budget`**: Director uses this for pacing phase calculation. Not a hard limit - semantic completion (`status: done`) is the actual trigger. Also surfaces `turns_remaining` to frontend for Games UI.

> **Removed**: `series_finale` - never used in prompt generation or Director logic

### Genre Architecture (ADR-001 - DECIDED)

**Genre belongs to Story (Series/Episode), not Character.**

| Domain | Owns | Does NOT Own |
|--------|------|--------------|
| **Character** | Personality, voice, boundaries | ~~Genre~~ (removed) |
| **Series** | `genre`, `genre_settings` | - |
| **Episode** | `genre` (inherits from Series) | - |
| **Director** | Genre doctrine injection | - |

**Implementation**:
- `character.genre` field **removed** (ADR-001)
- `GENRE_DOCTRINES` moved from `build_system_prompt()` to Director
- Genre doctrine injected via `DirectorGuidance.to_prompt_section()` at runtime
- Director reads genre from `episode_template.genre` → falls back to `series.genre`

**Rationale**: Characters are *people* with personality and voice. Genre is the *type of story* they're in. The same character can authentically exist in romance, thriller, or drama contexts. Genre-specific guidance (mandatory behaviors, forbidden patterns) is scene direction, not character identity.

See: [ADR-001: Genre Architecture](../../decisions/ADR-001-genre-architecture.md)

### The Situation Imperative

The `situation` field is the most important context element. It must be:
- Specific (not "a café" but "late-night café, rain on windows, just the two of you")
- Sensory (lighting, sounds, physical details)
- Tension-laden (why is this moment charged?)

**Quality Impact**:
```
Good (with situation): "I glance up from the espresso machine, steam rising..."
Bad (without situation): "I look at you with a mysterious smile..."
```

### Dramatic Question Quality

| Weak | Strong |
|------|--------|
| "Will they connect?" | "Will she show you the sketch she's been hiding?" |
| "Will the moment pass?" | "Can you make her laugh before the café closes?" |

Dramatic questions must be:
- Episode-specific (not reusable)
- Action-oriented (implies what could happen)
- Tension-sustaining (not resolved in 2 turns)

### Scene Motivation (ADR-002 Theatrical Model)

Scene motivation fields are the "director's notes" that the character internalizes during "rehearsal" (context building). These guide behavior without being visible to users.

| Field | Purpose | Example |
|-------|---------|---------|
| `scene_objective` | What character wants from user | "You want them to finally notice the signs" |
| `scene_obstacle` | What's stopping them | "You can't seem too eager, you have pride" |
| `scene_tactic` | How they're playing it | "Pretend to be busy, but leave openings" |

**Prompt Injection**: Formatted by `ConversationContext.build_episode_dynamics()`:
```
SCENE MOTIVATION (internalized direction - play this subtly):
What you want: {scene_objective}
What's stopping you: {scene_obstacle}
How you're playing it: {scene_tactic}
```

**Key Principle**: The director doesn't whisper in the actor's ear during the show. The direction was internalized during rehearsal.

---

## Layer 2.5: Props (ADR-005)

**Source**: `props` table (authored), `session_props` table (revelation tracking)
**Refresh**: Per episode (static), per turn (revelation state)
**Status**: PROPOSED (ADR-005)

### Purpose

Props are **canonical story objects** with exact, immutable content. They solve the "details don't stick" problem where LLMs improvise inconsistent details for key story elements.

| Problem | Solution |
|---------|----------|
| "The note" changes content each mention | Prop has exact `content` field |
| Evidence can't be tracked cross-episode | Props persist via `session_props` |
| No visual anchors for key items | Pre-generated prop images |

### Components

| Component | Source | Purpose |
|-----------|--------|---------|
| Name | `props.name` | "The Yellow Note" |
| Description | `props.description` | Physical description |
| Content | `props.content` | Exact text/transcript (canonical) |
| Image | `props.image_url` | Pre-generated visual |
| Reveal State | `session_props` | Has player seen this? |

### Prop Types

| Type | Example | Content Format |
|------|---------|---------------|
| `document` | Note, letter, contract | Handwritten/typed text |
| `photo` | Surveillance photo, yearbook | Image + caption |
| `object` | Key, mixtape, heirloom | Description only |
| `recording` | Voicemail, video | Transcript |
| `digital` | Text message, email | Exact digital content |

### Revelation Mechanics

Props track whether player has "seen" them:

| Mode | Behavior |
|------|----------|
| `character_initiated` | Character shows prop naturally in conversation |
| `player_requested` | Player must ask to see it ("show me the note") |
| `automatic` | Revealed at specific turn |
| `gated` | Requires prior prop to be revealed first |

### Format in Prompt

```
═══════════════════════════════════════════════════════════════
PROPS IN THIS SCENE
═══════════════════════════════════════════════════════════════

PROP: The Yellow Note [NOT YET SHOWN]
Description: A torn piece of yellow legal paper with hasty handwriting
Reveal mode: character_initiated
[You have this but haven't shown it yet. Introduce when dramatically appropriate.]

PROP: The Anonymous Text [REVEALED]
Description: Screenshot of the text message that started everything
Content: "Don't trust Daniel. Ask him what really happened at 10:47."
[Reference this naturally. Player has seen it.]
```

### Quality Impact

- **Consistency**: The note says the same thing every time
- **Trackability**: System knows what player has discovered
- **Cross-episode continuity**: Episode 2 can reference Episode 1's evidence
- **Visual anchors**: Pre-generated images for key items

### Genre Applications

| Genre | Prop Examples |
|-------|--------------|
| Mystery | Evidence, documents, photos |
| Romance | Letters, mementos, shared items |
| Thriller | Maps, supplies, warning signs |
| Drama | Heirlooms, contracts, photos |

See: [ADR-005: Props Domain](../../decisions/ADR-005-props-domain.md)

---

## Layer 3: Engagement Context

**Source**: `engagements` table
**Refresh**: Per session

### Components

| Component | Calculation | Purpose |
|-----------|-------------|---------|
| Session Count | `total_sessions` | Relationship depth signal |
| Time Together | `NOW() - first_met_at` | Temporal grounding |
| Dynamic | `{tone, tension_level}` | Current mood |
| Recent Beats | `dynamic.recent_beats[]` | What just happened |
| Milestones | `milestones[]` | Significant relationship moments |

> **Note**: Stage progression (`stage`, `stage_progress`) sunset in EP-01 pivot. The dynamic relationship system (tone, tension, beats, milestones) provides richer engagement context than static stages.
>
> **Removed fields**: `inside_jokes` (never populated), `relationship_stage_thresholds` (never read)

### Format in Prompt

```
RELATIONSHIP CONTEXT:
- Episodes together: 5
- Time since meeting: 2 weeks
- Current dynamic: warm at intensity 65/100
- Recent beats: ["shared a secret", "argued about music"]
```

### Quality Impact
- Prevents relationship regression ("So what do you do?")
- Enables natural evolution (more casual over time)

---

## Layer 4: Memory & Hooks

**Source**: `memory_events`, `hooks` tables
**Refresh**: Per session (retrieved)
**Owner**: MemoryService (storage/retrieval), Director (extraction)

### Memory Scoping Architecture (v1.3)

Memories are **series-scoped** (preferred) or **character-scoped** (fallback):

#### 1. Series-Scoped Memories (Episodic Narratives)

```sql
-- Preferred: Series-scoped retrieval
SELECT * FROM memory_events
WHERE user_id = ? AND series_id = ?
  AND is_active = TRUE
ORDER BY importance_score DESC, created_at DESC
LIMIT 10
```

**Use case**: Episodic narratives where memories belong to "your story with this series"
- Example: "Hometown Crush" series memories don't leak into "Office Romance"
- Same character, different stories, different memory contexts

#### 2. Character-Scoped Memories (Free Chat Fallback)

```sql
-- Fallback: Character-scoped retrieval (when no series_id)
SELECT * FROM memory_events
WHERE user_id = ? AND character_id = ?
  AND is_active = TRUE
ORDER BY importance_score DESC, created_at DESC
LIMIT 10
```

**Use case**: Open-ended conversations not bound to a series
- Memories shared across all non-series chats with that character

### Memory Types

| Type | Example | Prompt Section |
|------|---------|----------------|
| `fact` | "Works as a teacher" | "About them:" |
| `event` | "Starting new job Monday" | "Recent in their life:" |
| `preference` | "Loves indie rock" | "Their tastes:" |
| `relationship` | "Close with their mom" | "People in their life:" |
| `goal` | "Wants to travel to Japan" | "Goals/aspirations:" |
| `emotion` | "Nervous about the move" | "How they've been feeling:" |

### Hook Scoping Architecture (v1.3)

Hooks are **character-scoped only** (not series-specific):

```sql
-- Hooks are intentionally cross-series
SELECT * FROM hooks
WHERE user_id = ? AND character_id = ?
  AND is_active = TRUE
  AND trigger_after <= NOW()
  AND triggered_at IS NULL
ORDER BY priority DESC
LIMIT 5
```

**Rationale**: Hooks are "reminders to follow up" - should carry across all conversations

| Type | Example | Use |
|------|---------|-----|
| `reminder` | "Job interview Thursday" | Time-based callback |
| `follow_up` | "Sister's wedding" | Topic to revisit |
| `milestone` | "One month together" | Relationship marker |

**Design decision**: A callback like "job interview Thursday" should trigger in both free chat AND series episodes with the same character. Hooks are personal, not narrative-bounded.

### Extraction Ownership (v1.3)

**Director Protocol v2.3**: Director now owns memory/hook extraction

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
```

Director orchestrates extraction; MemoryService handles LLM prompting and storage.

### Quality Impact
- Enables "she remembers me" feeling
- Prevents repetitive questions
- Creates natural callbacks
- Series isolation prevents memory leakage between narratives

---

## Layer 5: Conversation State

**Source**: `messages` table, `sessions` table
**Refresh**: Per turn

### Components

| Component | Source | Purpose |
|-----------|--------|---------|
| Message History | Last 20 messages | Immediate context |
| Turn Count | `session.turn_count` | Pacing awareness |
| Session State | `active/paused/faded/complete` | Lifecycle |

### Moment Layer Format

```
MOMENT LAYER (Priority - respond to THIS):
- Their last line: "I guess I should go..."
- Your last line: "Wait—"
- Unresolved tension: Will she stay?
- Setting anchor: doorway, 2am, rain outside
```

### Quality Impact
- Focuses response on immediate moment
- Prevents wandering off-topic
- Maintains physical grounding

---

## Layer 6: Director Guidance

**Source**: `DirectorService` (new)
**Refresh**: Per turn (pre-response)
**Status**: PROPOSED

### Components

| Component | Values | Purpose |
|-----------|--------|---------|
| Pacing Phase | `establish/develop/escalate/peak/resolve` | Where in arc |
| Tension Note | Free text | Subtle direction |
| Physical Anchor | Free text | Sensory reminder |
| Genre Beat | Free text | Genre-appropriate hint |

### Format in Prompt

```
DIRECTOR NOTE (internal guidance):
- Pacing: escalate (turn 8/15)
- Tension: She's holding back—let the silence speak
- Anchor: The rain on windows, steam from her cup
- Beat: romantic tension—unspoken words matter more than said
```

### Quality Impact
- Pre-guides response quality (not post-evaluation)
- Turn-aware pacing
- Genre-specific tension

---

## Layer Composition Order

Layers are assembled in this order (later = higher priority):

1. Character system prompt (foundation)
2. Episode dynamics (situation, frame, question, scene motivation)
3. Engagement context (relationship stats)
4. Memory section (retrieved facts)
5. Hook section (pending callbacks)
6. Moment layer (immediate focus)
7. Director note (guidance)

---

## Token Budget

| Layer | Est. Tokens | Priority | Notes |
|-------|-------------|----------|-------|
| Character prompt | 300-500 | Critical | |
| Episode context | 150-250 | Critical | Includes scene motivation |
| Engagement | 50-100 | High | |
| Memories | 200-400 | High | |
| Hooks | 50-150 | Medium | |
| Message history | 1000-3000 | Sliding window | |
| Moment layer | 100-150 | Critical | |
| Director note | 50-100 | High | |
| **Total Input** | ~2000-4550 | | |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.5.0 | 2025-01-01 | Clarified that any character can play any episode (ADR-004). No special adaptation layer needed — Character + Episode naturally compose. |
| 1.4.0 | 2024-12-23 | Resolved clarification items: turn_budget documented as Director domain, series_finale removed, genre hierarchy documented for future consolidation. |
| 1.3.0 | 2024-12-23 | Added Episode Layer clarification items (turn_budget, series_finale, genre hierarchy). Hardened on Ticket + Moments model. |
| 1.2.0 | 2024-12-23 | Simplified boundaries to flirting_level + nsfw_allowed only. Removed Character Dynamics UI (9 unused fields) |
| 1.1.0 | 2024-12-23 | Simplified character data: merged backstory fields, removed life_arc/current_stressor |
| 1.0.0 | 2024-12-20 | Initial 6-layer specification, added Layer 6 (Director Guidance) |
