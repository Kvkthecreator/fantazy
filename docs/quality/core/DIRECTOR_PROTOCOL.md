# Director Protocol

> **Version**: 2.3.0
> **Status**: Active
> **Updated**: 2024-12-24

---

## Purpose

The Director is the **stage manager** of the conversation - providing pacing and grounding while respecting actor autonomy.

---

## The Theatrical Model (v2.2)

v2.2 reframes Director through theatrical production:

| Layer | Theater Equivalent | What It Provides |
|-------|-------------------|------------------|
| **Genre (Series)** | The Play's Style | "This is romantic comedy" - genre conventions |
| **Episode** | The Scene | Situation, dramatic question, scene motivation |
| **Director (Runtime)** | Stage Manager | Pacing, physical grounding |
| **Character** | Actor | Improvises within the established frame |

**Key Insight:** The director doesn't whisper in the actor's ear during the show. The direction was *internalized* during rehearsal (Episode setup). During performance (chat), the stage manager only calls pacing.

---

## What Moved Upstream (v2.2)

### REMOVED from Director Runtime:

| Field | Now Lives In | Rationale |
|-------|--------------|-----------|
| `objective` | EpisodeTemplate | Scene motivation is authored, not generated |
| `obstacle` | EpisodeTemplate | Part of dramatic setup |
| `tactic` | Genre Doctrine | "Flirt through play" is a genre convention |
| Per-turn LLM calls | N/A | Deterministic is faster + more consistent |

### Why This Change:

v2.1 generated motivation per-turn via LLM. Problems:
- **Latency**: Extra LLM call on every message
- **Inconsistency**: Generated tactics sometimes contradicted genre conventions
- **Wrong abstraction**: Motivation is a *scene* property, not a *turn* property

In theater, actors don't get new motivation each line. They internalize the scene's stakes and improvise within that frame.

---

## Director Role (v2.2)

The Director at runtime provides ONLY:

1. **Pacing** - Where we are in the arc (algorithmic)
2. **Physical Grounding** - Sensory anchor from episode situation
3. **Genre Lookup** - Energy descriptions, closing reminder

```python
@dataclass
class DirectorGuidance:
    pacing: str           # "establish" | "develop" | "escalate" | "peak" | "resolve"
    physical_anchor: str  # "warm café interior, afternoon sun"
    genre: str            # For doctrine lookup
    energy_level: str     # "reserved" | "playful" | "flirty" | "bold"
```

**No LLM call. Fully deterministic.**

---

## Prompt Output (v2.2)

```
═══════════════════════════════════════════════════════════════
DIRECTOR: ROMANTIC TENSION
═══════════════════════════════════════════════════════════════

Ground in: warm café interior, afternoon sun

Pacing: DEVELOP
Energy: Tension through restraint, meaningful glances, careful words

Remember: You are a person with your own desires, moods, and boundaries. Tension is the gift you give.
```

Note: No "THIS MOMENT" motivation block. That's now in the Episode setup.

---

## Pacing Algorithm

| Phase | Turn Range (Open) | With Budget |
|-------|-------------------|-------------|
| `establish` | 0-1 | 0-15% |
| `develop` | 2-4 | 15-40% |
| `escalate` | 5-9 | 40-70% |
| `peak` | 10-14 | 70-90% |
| `resolve` | 15+ | 90-100% |

Pacing is **deterministic** based on turn count and optional turn budget.

---

## What Director Still Does

| Responsibility | How |
|----------------|-----|
| **Pacing** | Algorithmic from turn_count/turn_budget |
| **Physical grounding** | Extract from episode.situation |
| **Genre energy** | Lookup from GENRE_DOCTRINES |
| **Post-evaluation** | Visual triggers, completion status (Phase 2) |

---

## What Director Does NOT Do

| Not Responsible For | Why | Now Lives In |
|---------------------|-----|--------------|
| Scene motivation | Authored content | EpisodeTemplate |
| Genre conventions | Static rules | GENRE_DOCTRINES |
| Character voice | Actor autonomy | Character DNA |
| Plot/arc | Authored content | EpisodeTemplate |

---

## Phase 2: Post-Exchange Processing (v2.3 - Expanded)

After the character responds, Director orchestrates all post-exchange processing:

### Semantic Evaluation

```python
DirectorEvaluation(
    visual_type: str,      # "character" | "object" | "atmosphere" | "instruction" | "none"
    visual_hint: str,      # "close-up on her hands, fidgeting"
    status: str,           # "going" | "closing" | "done"
)
```

### Memory & Hook Extraction (NEW in v2.3)

Director now owns memory/hook extraction and beat tracking:

**Memories**: Facts, preferences, events, goals, relationships, emotions
- Extracted via `MemoryService.extract_memories()` (LLM call)
- Saved with `series_id` for **series-scoped isolation**
- Fallback to `character_id` for free chat mode

**Hooks**: Reminders, follow-ups, scheduled callbacks
- Extracted via `MemoryService.extract_hooks()` (LLM call)
- Saved with `character_id` only (**cross-series by design**)
- Rationale: Callbacks like "job interview Thursday" should trigger everywhere

**Beat Classification**: Narrative beats for tension tracking
- Type: playful, flirty, tense, vulnerable, charged, longing, neutral
- Tension change: -15 to +15 (positive = increase tension)
- Milestone: first_spark, almost_moment, jealousy_triggered, etc.
- Updates `engagement.dynamic` JSONB (tone, tension_level, recent_beats)

### Data Flow (v2.3)

```
Character LLM responds
    ↓
DirectorService.process_exchange()
    ↓
1. Semantic evaluation (visual_type, status)
2. Memory extraction (MemoryService.extract_memories)
3. Hook extraction (MemoryService.extract_hooks)
4. Beat classification → engagement.dynamic
    ↓
MemoryService.save_memories(series_id=session.series_id)  ← Series-scoped
MemoryService.save_hooks()  ← Character-scoped
MemoryService.update_relationship_dynamic()
    ↓
DirectorOutput(
    extracted_memories, extracted_hooks, beat_data
)
```

### Director vs MemoryService Ownership

**Director orchestrates; MemoryService executes.**

| Responsibility | Owner | Role |
|----------------|-------|------|
| **Extraction decision** | Director | When to extract, coordination |
| **LLM prompting** | MemoryService | Memory extraction prompts |
| **Storage** | MemoryService | Database writes |
| **Retrieval** | MemoryService | Query memories/hooks |
| **Scoping logic** | MemoryService | Series vs character scoping |

Director calls MemoryService methods but doesn't reimplement extraction logic.

---

## Scene Motivation in EpisodeTemplate (Implemented)

Scene motivation (objective/obstacle/tactic) is authored into EpisodeTemplate:

```python
# EpisodeTemplate with scene direction (IMPLEMENTED)
EpisodeTemplate(
    situation="Minji is at the café, your usual spot...",
    dramatic_question="Will she finally say what's on her mind?",

    # Scene direction (authored, not generated)
    scene_objective="You want them to notice you've been waiting",
    scene_obstacle="You can't seem too eager, you have pride",
    scene_tactic="Pretend to be busy, but leave openings",
)
```

**Database Fields** (migration 045):
- `scene_objective` - What the character wants from the user in this scene
- `scene_obstacle` - What's stopping the character from just asking directly
- `scene_tactic` - How the character is trying to get what they want

**Prompt Injection**: Scene motivation is formatted in `ConversationContext.build_episode_dynamics()`:
```
SCENE MOTIVATION (internalized direction - play this subtly):
What you want: {scene_objective}
What's stopping you: {scene_obstacle}
How you're playing it: {scene_tactic}
```

This makes motivation a **content authoring** concern, not a runtime generation concern. Studio UI supports editing these fields per episode.

---

## Data Flow (v2.2)

```
User sends message
    ↓
ConversationService.send_message()
    ↓
DirectorService.generate_pre_guidance()  ← NO LLM CALL
    ↓
DirectorGuidance(pacing, physical_anchor, genre, energy)
    ↓
.to_prompt_section()
    ↓
Injected into context.director_guidance
    ↓
Character LLM generates response
```

---

## Quality Metrics (v2.2)

| Metric | Target | Notes |
|--------|--------|-------|
| Pre-guidance latency | < 5ms | Deterministic, no LLM |
| Pacing accuracy | 100% | Algorithmic |
| Genre doctrine coverage | All active genres | Static config |

---

## Implementation Reference

**Files:**
- `substrate-api/api/src/app/services/director.py` - DirectorGuidance, generate_pre_guidance
- `substrate-api/api/src/app/services/conversation.py` - Integration point

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.2.0 | 2024-12-23 | **Theatrical Model**: Remove per-turn motivation generation. Director becomes deterministic stage manager. Motivation moves upstream to Episode/Genre. |
| 2.1.0 | 2024-12-23 | Motivation-driven direction: objective/obstacle/tactic via LLM |
| 2.0.0 | 2024-12-20 | Added pre-response guidance phase, pacing algorithm |
| 1.0.0 | 2024-12-20 | Initial protocol (post-evaluation only) |

---

## Related Documents

- `docs/EPISODE-0_CANON.md` - Platform canon with theatrical model
- `docs/decisions/ADR-002-theatrical-architecture.md` - Architecture decision record
- `docs/quality/core/GENRE_DOCTRINES.md` - Genre convention definitions
