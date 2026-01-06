# Episode Architecture: The Escape Room Pattern

> **Status**: Reference Pattern (not mandatory, but proven effective)
> **Applies to**: Episode/series scaffolding, prop design, pacing decisions

## The Core Insight

Interactive fiction faces a fundamental tension:
- **Open sandbox** → player wanders, story dissipates, no tension
- **Linear scripting** → player feels like they're reading, not participating
- **Branching paths** → combinatorial explosion, most content unseen

The "escape room" pattern creates a third way: **bounded freedom with gated progression**.

## Pattern Definition

An escape room episode has:

| Element | Description | Example |
|---------|-------------|---------|
| **Bounded space** | Physical or situational constraint that limits scope | Locked room, stranded cabin, stuck elevator |
| **Clear stakes** | Obvious goal without explicit instructions | Escape, survive, solve, connect |
| **Gated progression** | Props/revelations unlock at designed intervals | Keycard at turn 3, confession at turn 6 |
| **Forced interaction** | No opt-out; characters must engage | Can't leave, can't ignore each other |

## Why It Works

### Psychologically
1. **Stakes without instructions** - You know what you need (escape/solve) without being told what to say
2. **Props as progress markers** - Physical objects anchor abstract narrative beats
3. **Constraint creates intimacy** - "Trapped together" forces interaction naturally
4. **Discovery pacing** - Turn hints gate reveals, story breathes at designed intervals

### Technically
1. **Automatic reveal mode** - Props fire at exact turns via Director (no LLM judgment needed)
2. **Predictable session length** - Turn budget creates natural episode boundaries
3. **Designable, not just writable** - Structure carries content; quality more consistent
4. **Collectible layer** - Props become game-like inventory items

## Genre Adaptation

The pattern is genre-agnostic. The skeleton remains constant; the emotional texture changes:

| Element | Thriller | Romance | Mystery |
|---------|----------|---------|---------|
| Bounded space | Underground facility | Stuck in elevator | Investigation window |
| Stakes | Escape alive | Emotional connection | Find the truth |
| Progression gate | Access keycards | Shared vulnerabilities | Clues/evidence |
| Forced interaction | Survival requires cooperation | Can't avoid each other | Must engage to solve |

### Examples in Codebase

**The Blacksite** (survival_thriller):
- Bounded: Underground research facility
- Stakes: Escape before they find you
- Props: Subject tag → Keycard → Facility map → Override code
- Forced: Alex is your only ally; you need each other

**Locked In** (forced_proximity):
- Bounded: Elevator → Cabin → Escape room
- Stakes: Stuck together, tension building
- Props: Dying phone → Shared blanket → Booking confirmation
- Forced: Literally cannot leave; must interact

## Prop Design Principles

### 1. Two Props Per Episode
Consistent pacing. One early (establish), one mid-to-late (escalate or reveal).

### 2. Staggered Turn Hints
```
Episode 0: turns 0, 3
Episode 1: turns 2, 5
Episode 2: turns 4, 8
Episode 3: turns 2, 6
```
Creates rhythm without predictability.

### 3. Automatic Reveal Mode
For thriller/mystery genres, use `reveal_mode: automatic`. Director fires props at exact turn—no reliance on LLM to weave keywords.

For romance, `character_initiated` can work if prop guidelines encourage natural mention.

### 4. Props Should Feel Discovered
Good: "She notices your wristband for the first time. 'A-7749. That's... that's a subject number.'"
Bad: "Here is a wristband with the number A-7749."

## Episode Arc Structure

Standard 4-episode arc with escalating stakes:

| Episode | Pacing Phase | Tension | Props Role |
|---------|--------------|---------|------------|
| 0 | Establish | Low → Medium | Introduce world, first mystery |
| 1 | Develop | Medium | Deepen relationship, complicate situation |
| 2 | Escalate | Medium → High | Stakes rise, trust tested |
| 3 | Peak/Resolve | High → Resolution | Truth revealed, choice made |

## Implementation Checklist

When scaffolding a new series:

- [ ] Define the bounded space (what constrains them?)
- [ ] Identify the stakes (what do they want/fear?)
- [ ] Design 2 props per episode with turn hints
- [ ] Set reveal_mode to `automatic` for reliability
- [ ] Write situation that establishes constraint immediately
- [ ] Ensure dramatic_question creates tension, not just curiosity
- [ ] Map props to narrative beats (discovery, complication, revelation)

## Anti-Patterns

**Avoid:**
- Props without turn hints (when do they appear?)
- More than 3 props per episode (cluttered, diluted impact)
- `player_requested` mode for key reveals (player may never ask)
- Situation that allows easy exit (kills the constraint)
- Props that are just "interesting objects" without narrative function

## Relationship to Other Docs

- **DIRECTOR_PROTOCOL.md**: How Director uses genre doctrines and turn hints
- **EPISODE_STATUS_MODEL.md**: How turn budgets create session boundaries
- **CONTEXT_LAYERS.md**: How props feed into character context

## Future Considerations

This pattern could extend to:
- **Multi-character episodes**: Multiple POVs in same bounded space
- **Branching props**: Different props revealed based on player choices
- **Cross-episode props**: Items that persist and evolve across series

---

*This document captures learnings from The Blacksite, Locked In, Blackout, and The Last Message series development. Pattern emerged organically and proved effective across genres.*
