# ADR-002: Theatrical Production Model

> **Status**: Accepted
> **Date**: 2024-12-23
> **Deciders**: Architecture Review

---

## Context

Episode-0's Director was generating per-turn motivation (objective/obstacle/tactic) via LLM calls. While this produced *wanting* responses, it had problems:

1. **Latency**: Extra LLM call on every user message
2. **Inconsistency**: Generated tactics sometimes contradicted genre conventions
3. **Wrong abstraction**: Motivation is a *scene* property, not a *turn* property

The question: Where should scene motivation live?

---

## Decision

Adopt a **theatrical production model** where:

| Layer | Theater Equivalent | Responsibility |
|-------|-------------------|----------------|
| **Genre (Series)** | The Play's Style | Genre conventions (HOW to flirt, HOW to build suspense) |
| **Episode** | The Scene | Scene setup + motivation (objective/obstacle/tactic) |
| **Director (Runtime)** | Stage Manager | Pacing + physical grounding only |
| **Character** | Actor | Improvise within the established frame |
| **User** | Improv Partner | Untrained participant |

### Key Principle

> The director doesn't whisper in the actor's ear during the show. The direction was internalized during rehearsal.

- **Rehearsal** = Episode template authoring
- **Performance** = The chat
- **Stage Manager** = Director at runtime

---

## Consequences

### Positive

1. **Faster responses**: No LLM call for pre-guidance (deterministic)
2. **Consistent tactics**: Genre conventions are static, not generated
3. **Content-driven quality**: Motivation quality depends on Episode authoring
4. **Clearer separation**: Director does pacing, Episode does motivation

### Negative

1. **More authoring burden**: Episode templates need motivation fields
2. **Less adaptive**: Motivation doesn't change based on conversation flow
3. **Migration needed**: Existing episodes need motivation fields added

### Neutral

1. **Director still does post-evaluation**: Visual triggers, completion status (LLM call)
2. **Genre doctrines unchanged**: Static lookup, already works well

---

## Implementation

### Director Protocol v2.2

```python
# BEFORE (v2.1): Generated per-turn
guidance = await director.generate_pre_guidance(
    messages=messages,
    genre=genre,
    situation=situation,
    dramatic_question=dramatic_question,
    ...
)
# Returns: DirectorGuidance with objective/obstacle/tactic from LLM

# AFTER (v2.2): Deterministic
guidance = director.generate_pre_guidance(
    genre=genre,
    situation=situation,
    turn_count=turn_count,
    ...
)
# Returns: DirectorGuidance with pacing/grounding only
```

### Future: EpisodeTemplate with Scene Motivation

```python
EpisodeTemplate(
    situation="Minji is at the café, your usual spot...",
    dramatic_question="Will she finally say what's on her mind?",

    # Scene direction (authored, not generated)
    scene_objective="You want them to notice you've been waiting",
    scene_obstacle="You can't seem too eager, you have pride",
    scene_tactic="Pretend to be busy, but leave openings",
)
```

---

## Alternatives Considered

### 1. Keep Per-Turn Generation

**Rejected**: Latency cost + inconsistency not worth the adaptivity.

### 2. Generate Motivation Once Per Episode Start

**Considered**: Generate objective/obstacle/tactic when episode starts, cache it.
**Rejected**: Still an LLM call, still might contradict genre conventions. If we're going to author motivation anyway, do it at template level.

### 3. Hybrid: Authored Default + Generated Override

**Considered**: Episode has default motivation, Director can override if conversation diverges.
**Deferred**: Adds complexity. Start with pure authored approach, measure quality.

---

## Related

- **ADR-001**: Genre belongs to Story (Series/Episode), not Character
- **DIRECTOR_PROTOCOL.md**: v2.2 implementation details
- **EPISODE-0_CANON.md**: Platform canon with theatrical model

---

## Review Notes

This decision aligns with the platform's content-first philosophy. Quality comes from authored content (episodes, characters), not from runtime generation. The Director should orchestrate, not create.
