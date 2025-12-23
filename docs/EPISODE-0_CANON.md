# Episode-0 Platform Canon

> This document defines what Episode-0 is, regardless of genre, theme, or studio.
> Updated 2024-12-23 with architecture audit findings.

---

## 1. What Episode-0 Is (Platform Definition)

Episode-0 is a **chat-based episodic experience platform**.

It enables users to:

- enter **pre-authored narrative moments**
- interact in real time
- influence how scenes emotionally and narratively unfold

Episode-0 is not defined by romance, fantasy, or any single genre.

> Episode-0 is a system for turning moments into interactive stories.

**Characters** are containers.

**Episodes** are entry points.

**Chats** are live scenes.

---

## 2. The Episode-0 Thesis (Genre-Agnostic)

> People don't engage with characters. They engage with situations.

Across genres — romance, thriller, mystery, horror, slice-of-life, sci-fi — high engagement comes from:

- immediacy
- emotional stakes
- narrative implication
- being personally implicated in a moment

Episode-0's job is to **manufacture that moment instantly**.

---

## 3. Core Structural Primitive: Episodes

Episode-0 treats **episodes as first-class citizens**.

An episode is:

- a specific situation
- at a specific moment in time
- with something already in motion
- where the user matters *now*

This holds true whether the episode is:

- a romantic tension beat
- a mystery reveal
- a horror encounter
- a dramatic confrontation
- a cozy slice-of-life moment

> The platform is episode-first. Themes are layered on top.

---

## 4. Platform Content Standards (Universal)

Regardless of genre, every Episode-0 episode must pass:

### A. Instant Situational Clarity

Within seconds, the user understands:

- where they are
- what's happening
- why they're involved

### B. Narrative Tension

There is *something unresolved*:

- emotional
- informational
- relational
- situational

### C. User Implication

The moment would be different **without the user**.

### D. Reply Gravity

The opening demands response.

Silence feels like loss.

These standards apply to **all studios**, all themes.

---

## 5. Episode-0's Role vs. Studios

**Episode-0 (Platform)** provides:

- the episodic engine
- the conversation ignition system
- visual layering (background + avatar)
- memory and relationship tracking
- safety, moderation, tooling
- distribution and monetization

**Studios** provide:

- genre
- tone
- narrative rules
- creative constraints
- content-specific quality bars

> Episode-0 is the Netflix.
>
> Studios are the Netflix Originals teams.

---

## 6. Core Data Model (Genre-Agnostic)

The platform engine is built on generic primitives:

| Primitive | Purpose |
|-----------|---------|
| `Character` | Container for personality, voice, boundaries |
| `World` | Setting context (café, apartment, office, etc.) |
| `EpisodeTemplate` | Pre-authored scenario entry point |
| `Session` | User's conversation instance (runtime) |
| `Engagement` | User ↔ Character stats link (lightweight) |
| `MemoryEvent` | Extracted facts, events, preferences |
| `Hook` | Future engagement triggers |

> **Note (EP-01 Pivot):** Session replaced the runtime Episode concept. Engagement replaced Relationship
> and removed stage progression — connection depth is now implicit via memory accumulation and
> episode count rather than explicit stage labels.

These primitives power any genre. The theme is layered via studio configuration.

---

## 7. The 6-Layer Context Architecture

Per architecture audit (2024-12-23), context flows through 6 layers:

| Layer | Owner | Responsibility |
|-------|-------|----------------|
| **1. Character** | Character DNA | WHO they are: personality, voice, boundaries |
| **2. Episode** | EpisodeTemplate | WHERE/WHEN: physical setting, dramatic question |
| **3. Engagement** | Engagement record | HISTORY: total episodes, time since meeting |
| **4. Memory** | MemoryService | WHAT WE KNOW: extracted facts, preferences |
| **5. Conversation** | Message history | IMMEDIATE: last 20 messages in current session |
| **6. Director** | DirectorService | HOW TO PLAY: pacing, tension, genre doctrine |

### ADR-001: Genre Architecture Decision

**Genre belongs to Story (Series/Episode), not Character.**

- Characters define WHO someone is (personality, voice, boundaries)
- Genre defines WHAT KIND OF STORY they're in
- These are orthogonal concerns

Genre doctrine is now injected by Director at runtime, not baked into character system_prompt.

---

## 8. The Theatrical Model (ADR-002)

Episode-0 adopts a **theatrical production model** for conversation architecture:

| Layer | Theater Equivalent | What It Provides |
|-------|-------------------|------------------|
| **Genre (Series)** | The Play's Style | "This is romantic comedy" - genre conventions |
| **Episode** | The Scene | Situation, dramatic question, scene motivation |
| **Director (Runtime)** | Stage Manager | Pacing, physical grounding |
| **Character** | Actor | Improvises within the established frame |
| **User** | Improv Partner | Untrained participant who can say anything |

### The Key Insight

In theater, the director doesn't whisper in the actor's ear during the show. The direction was **internalized during rehearsal**.

Applied to Episode-0:
- **Rehearsal** = Episode template authoring (situation, dramatic question, motivation)
- **Performance** = The chat (character improvises with user)
- **Stage Manager** = Director at runtime (just pacing + grounding)

### The User as Improv Partner

Episode-0 is like **improv theater with a trained partner**:
- The character (trained actor) knows the genre, the scene, the stakes
- The user (untrained participant) can say anything
- The magic is when the trained actor *makes the untrained participant look good*

---

## 9. Director Protocol v2.2

The Director is now a **stage manager**, not a line-by-line director.

### What Director Provides at Runtime

```python
DirectorGuidance(
    pacing: str,           # "establish" | "develop" | "escalate" | "peak" | "resolve"
    physical_anchor: str,  # "warm café interior, afternoon sun"
    genre: str,            # For doctrine lookup
    energy_level: str,     # "reserved" | "playful" | "flirty" | "bold"
)
```

**No LLM call. Fully deterministic.**

### What Moved Upstream

| Field | Now Lives In | Rationale |
|-------|--------------|-----------|
| `objective` | EpisodeTemplate | Scene motivation is authored, not generated |
| `obstacle` | EpisodeTemplate | Part of dramatic setup |
| `tactic` | Genre Doctrine | "Flirt through play" is a genre convention |

### Phase 2: Post-Evaluation (Unchanged)

- **Visual Detection**: should we generate an image?
- **Completion Status**: is this episode ready to close?
- **Memory Extraction**: what should we remember?

---

## 10. Scene Motivation in Episodes

Scene motivation (objective/obstacle/tactic) is now a **content authoring** concern:

```python
# EpisodeTemplate with scene direction
EpisodeTemplate(
    situation="Minji is at the café, your usual spot...",
    dramatic_question="Will she finally say what's on her mind?",

    # Scene direction (authored by content creator)
    scene_objective="You want them to notice you've been waiting",
    scene_obstacle="You can't seem too eager, you have pride",
    scene_tactic="Pretend to be busy, but leave openings",
)
```

### Why This Works

| Approach | Problem |
|----------|---------|
| Generate motivation per-turn | Latency, inconsistency, wrong abstraction |
| Author motivation per-scene | Consistent, fast, content-driven |

In theater, actors don't get new motivation each line. They internalize the scene's stakes and improvise within that frame.

### Genre Conventions (Static)

Genre doctrine defines HOW to execute tactics:

| Genre | Convention |
|-------|------------|
| Romantic Tension | Flirt through play, not confession. Withhold > reveal. |
| Psychological Thriller | Build trust slowly. Offer small things first. |
| Slice of Life | Comfort in mundane. Presence > drama. |

These are **static rules** in `GENRE_DOCTRINES`, not generated per-turn.

---

## 11. Architecture Summary

### The 6-Layer Context (Updated)

| Layer | Owner | Responsibility |
|-------|-------|----------------|
| **1. Character** | Character DNA | WHO: personality, voice, boundaries |
| **2. Episode** | EpisodeTemplate | SCENE: situation, dramatic question, motivation |
| **3. Genre** | Series/Episode | STYLE: genre conventions, tactics |
| **4. Engagement** | Engagement record | HISTORY: total episodes, time since meeting |
| **5. Memory** | MemoryService | WHAT WE KNOW: extracted facts, preferences |
| **6. Director** | DirectorService | PACING: where we are in the arc |

### Data Flow (v2.2)

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
    ↓
DirectorService.evaluate_exchange()  ← LLM CALL (post only)
```

### What's Next

1. **Add scene motivation fields to EpisodeTemplate** (objective/obstacle/tactic)
2. **Enhance GENRE_DOCTRINES** with tactical conventions per genre
3. **Test the pull** with authored motivation vs. generated

---

## 12. North Star Metric

**Episodes Started per User per Week (ESPW)**

→ "How often do users engage with narrative moments?"

**Secondary Metrics:**

- Episode Completion Rate
- Return Rate (users coming back within 72h)
- Cross-character exploration
- Conversion to premium

**Quality Metric (new):**

- Average conversation length per episode
- User re-engagement with same character within 24h

---

## 13. Active Studios

### Studio 1: Romantic Tension
- Focus: desire, attraction, vulnerability, proximity
- See: `docs/character-philosophy/Genre 01 — Romantic Tension.md`

### Studio 2: Psychological Thriller
- Focus: suspense, paranoia, secrecy, moral pressure
- See: `docs/character-philosophy/Genre 02 — Psychological Thriller- Suspense.md`

### Future Studios (Planned)
- Cozy Slice-of-Life
- Mystery / Investigation
- Fantasy Adventure

Each studio follows Episode-0 platform rules while defining its own creative bar.

---

## 14. Key Strategic Takeaway

You are **not** building a romance app.

You are:

- **elevating Episode-0 above any single genre**
- while allowing genres to thrive *inside it*

This is the difference between:

- a category app
- and a **content platform**

---

## Related Documents

- `docs/character-philosophy/PHILOSOPHY.md` — Character design philosophy
- `docs/character-philosophy/Genre 01 — Romantic Tension.md` — Romance studio doctrine
- `docs/character-philosophy/Genre 02 — Psychological Thriller- Suspense.md` — Thriller studio doctrine
- `docs/decisions/ADR-001-genre-architecture.md` — Genre belongs to Story, not Character
- `docs/decisions/ADR-002-theatrical-architecture.md` — Theatrical production model
- `docs/quality/core/DIRECTOR_PROTOCOL.md` — Director Protocol v2.2 (stage manager model)
