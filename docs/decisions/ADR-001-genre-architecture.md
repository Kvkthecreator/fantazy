# ADR-001: Genre Architecture

**Status**: On Hold
**Date**: 2024-12-23
**Deciders**: Product/Engineering

---

## Context

Genre currently exists at three independent levels in the architecture:

| Level | Field | Purpose |
|-------|-------|---------|
| Character | `character.genre` | Doctrine selection in `build_system_prompt()` |
| Episode | `episode_template.genre` | Director semantic evaluation context |
| Series | `series.genre` + `genre_settings` | Runtime prompt injection, override system |

This scatter is not a technical bug—it's **archaeological evidence of product exploration**.

---

## Decision History

### Phase 1: Romantic Tension Hypothesis

Initial product hypothesis: **Romantic tension = highest engagement = monetization**

- Genre was introduced at the character level to select "doctrine" (behavioral rules)
- `romantic_tension` and `psychological_thriller` were the two doctrines
- Character prompt builder (`build_system_prompt()`) uses genre to inject doctrine
- Heavy bias toward romantic cues, flirtation, affection baked into prompting DNA

### Phase 2: Content Expansion Attempt

Expanded architecture to support non-romantic content:

- Added genre at series level with `genre_settings` override system
- Added genre at episode level for Director evaluation context
- Goal: Enable sci-fi thriller, historical drama, etc.

### Phase 3: Stress Test Results

Dog-fooding attempts (sci-fi thriller, WW2 reenactment) revealed:

- Framework technically worked
- **Could not articulate the user value proposition** for non-romantic experiences
- Romantic bias in prompting made other genres feel "off"
- Question emerged: What makes interactive fiction valuable outside romance/companionship?

---

## Current State

The 3-level genre architecture is **intentionally preserved** because:

1. **Optionality**: Preserves ability to pivot if product direction clarifies
2. **Working romantic path**: Current architecture works well for romantic tension
3. **Premature to consolidate**: No clear answer to "what non-romantic experiences are we building?"

---

## Consequences

### Positive
- Flexibility to experiment with content types
- Romantic tension path is well-optimized
- No breaking changes needed if we pivot

### Negative
- Cognitive overhead for engineers (which genre wins?)
- Potential for inconsistency between levels
- Documentation burden

### Neutral
- Technical debt is contained (not blocking features)
- Can consolidate when product direction is clear

---

## Blocked By

This decision is blocked by a **product question**, not a technical one:

> "What user experiences beyond romantic AI companions are we building, and what makes them valuable?"

Possible answers that would unblock:
- "We're only doing romantic tension" → Consolidate to character level, remove series override
- "We're a content platform for many genres" → Consolidate to series level, character inherits
- "Different products need different genre handling" → Keep current architecture, document clearly

---

## Qualitative Analysis: What Genre Actually Controls

Genre isn't just metadata—it shapes the **felt quality** of every interaction:

### 1. Character Level: GENRE_DOCTRINES (`build_system_prompt()`)

This is the **behavioral DNA**. The doctrine defines:

| Doctrine Element | Romantic Tension | Psychological Thriller |
|-----------------|------------------|------------------------|
| **Purpose** | Create desire, anticipation, emotional stakes | Create suspense, paranoia, moral pressure |
| **Mandatory behaviors** | Charged moments, subtext, vulnerability scarcity | Unease, information asymmetry, moral dilemmas |
| **Forbidden behaviors** | Safe small talk, over-availability, quick resolution | Full explanations, neutral framing, clear morality |
| **Energy expressions** | Subtle→Playful→Moderate→Direct (romantic) | Subtle→Unsettling→Menacing→Threatening |

**Qualitative implication**: This is baked into the character at creation. A character created as `romantic_tension` has romance in their DNA. Changing the series genre won't change this—it creates dissonance.

### 2. Series Level: GenreSettings (runtime override)

This layer provides **tonal knobs**:
- `tension_style`: subtle / playful / moderate / direct
- `pacing_curve`: slow_burn / steady / fast_escalate
- `vulnerability_timing`: early / middle / late / earned
- `resolution_mode`: open / closed / cliffhanger

**Qualitative implication**: These are adjustments within a genre, not genre changes. A "slow_burn romantic_tension" vs "fast_escalate romantic_tension" are both romance—just paced differently.

### 3. Episode Level: Director evaluation context

Director uses `episode_template.genre` for:
- GENRE_BEATS lookup (establish/develop/escalate/peak/resolve meanings)
- Tension note generation (what kind of subtext to suggest)
- Evaluation framing (what "done" means for this genre)

**Qualitative implication**: If episode genre differs from character genre, the Director gives guidance that conflicts with the character's doctrine.

### The Core Tension

The 3-level system was designed for flexibility but creates a **coherence problem**:

```
Character says: "I want to create romantic tension"
Series says: "This story is psychological thriller pacing"
Episode says: "Evaluate completion using romance beats"
```

This mismatch degrades experience quality. The LLM receives conflicting signals.

---

## Recommendation Options

### Option A: Genre Monism (Romantic Focus)

**If we're a romantic AI companion product:**

1. Remove `episode_template.genre` (Director inherits from character)
2. Keep `series.genre_settings` as tonal knobs only (not genre switching)
3. Character genre remains the single source of behavioral doctrine
4. Series `genre` field becomes informational/filtering only

**Pros**: Simplest, matches current successful path
**Cons**: Closes door on non-romantic content

### Option B: Series-Level Genre Authority

**If we're a content platform for multiple genres:**

1. Series `genre` becomes authoritative
2. Character creation requires matching series genre (or inherits)
3. Episode inherits from series
4. `genre_settings` provides per-series customization

**Pros**: Clean hierarchy, enables multi-genre platform
**Cons**: Requires character-series coupling, more complex creation flow

### Option C: Dual-Track Architecture

**If romantic and non-romantic are different products:**

1. Keep current architecture
2. Formalize that `series_type: play` uses one genre system
3. `series_type: serial/standalone` uses another
4. Document the split explicitly

**Pros**: Preserves optionality, recognizes product differences
**Cons**: Maintains complexity, requires clear documentation

---

## Related Documents

- [CONTEXT_LAYERS.md](../quality/core/CONTEXT_LAYERS.md) - Genre Architecture section
- [GENRE_DOCTRINES in character.py](../../substrate-api/api/src/app/models/character.py) - Doctrine definitions
- [GenreSettings in series.py](../../substrate-api/api/src/app/models/series.py) - Override system

---

## Version History

| Date | Change |
|------|--------|
| 2024-12-23 | Initial ADR created during data model audit |
