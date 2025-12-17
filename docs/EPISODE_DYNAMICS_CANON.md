# Episode Dynamics Canon

**Status:** DRAFT - Under Active Development

**Scope:** Episode structure, progression mechanics, session lifecycle, monetization alignment

**Created:** 2024-12-17

**Related:** CONTENT_ARCHITECTURE_CANON.md, EPISODES_CANON_PHILOSOPHY.md, EP-01_pivot_CANON.md

---

## 1. Executive Summary

This document defines **how episodes work at runtime** — the mechanics of progression, the balance between authored structure and LLM improvisation, and the systems that create engagement and monetization.

**Core Premise:**

> The journey IS the experience. Unlike gaming where objectives drive progression, Fantazy's value is in the moment-to-moment interaction. Structure exists to enhance the journey, not to gate a destination.

This creates a unique design challenge: **How do we create structured narrative experiences with LLM-powered real-time generation while maintaining user agency AND meaningful progression?**

---

## 2. The Core Tension

| Force | Pulls Toward | Risk if Dominant |
|-------|--------------|------------------|
| **LLM Real-time Generation** | Infinite possibility, emergent outcomes | No structure, no payoff, conversations drift |
| **Authored Narrative Structure** | Crafted beats, predetermined arcs | Railroading, user feels no agency |
| **User Agency ("I'm in control")** | My choices matter, I direct the story | No stakes, character becomes servant |
| **Progression/Stakes** | Things change, I'm earning something | Grinding, gamification fatigue |

**The solution is balance** — not choosing one over another.

---

## 3. Design Philosophy: "Guided Improvisation"

The episode is a **stage with rails** — not a script, not a sandbox.

### 3.1 The Actor/Director Model

```
AUTHORED (Episode Template)              LLM (Real-time)
════════════════════════════             ════════════════════════════
Director's vision                        Actor's interpretation
Dramatic question                        Dialogue execution
Opening state                            Response to user input
Narrative beats (soft)                   Improvisation within beats
Resolution space options                 Choosing resolution based on flow
Memory trigger definitions               Detecting when triggers occur
```

**Key Principle:** The episode template provides **director's notes**. The LLM is the **actor** who interprets them live, staying true to character while responding authentically to the user.

### 3.2 Benchmark Analysis

#### Gaming/Quests Model

| Element | Gaming | Fantazy Application |
|---------|--------|---------------------|
| Quest Objectives | "Find the artifact" | Episode has a **dramatic question** |
| Checkpoints | Progress saved | Sessions persist, memory accumulates |
| Branching Paths | Choices → outcomes | LLM adapts narrative based on input |
| Failure States | Can "lose", retry | Character can reject, scene can end badly |
| Rewards | XP, items, unlocks | New episodes, deeper reveals, memories |
| Side Quests | Optional enrichment | Expansion episodes |

**Limitation:** Gaming is goal-oriented. Fantazy is experience-oriented.

**What We Take:** Stakes, progression feeling, rewards for engagement.
**What We Leave:** Grinding, explicit objectives, pass/fail mechanics.

#### Westworld Model

| Element | Westworld | Fantazy Application |
|---------|-----------|---------------------|
| Loops | Hosts reset, guests replay | Episodes replayable, memory persists for user |
| Narrative Levels | Surface story vs deeper lore | Entry → Core → Expansion reveals |
| Guest Agency | Guests can go "off-script" | LLM handles improvisation within rails |
| Emotional Stakes | "Feels real" | Characters have boundaries, feel alive |
| Discovery | Deeper exploration → more reveals | More sessions → richer interactions |

**Key Insight:** Hosts have **narrative loops with flexibility** — authored to hit beats, but can improvise within rails.

#### Netflix Series Model

| Element | Netflix | Fantazy Application |
|---------|---------|---------------------|
| Episode Structure | Beginning, middle, end | Dramatic arc within session |
| Binge Control | User decides pacing | User controls when to continue/stop |
| Skip/Rewatch | Full user freedom | Can replay, jump episodes |
| Cliffhangers | Pull to next episode | Hooks create desire for next |
| Season Arcs | Overarching progression | Series-level narrative thread |

**Key Insight:** User controls playback, but content is crafted to create pull.

---

## 4. Episode Template Structure

### 4.1 Template Schema (Conceptual)

```
EPISODE TEMPLATE
═══════════════════════════════════════════════════════════════

1. METADATA
   ├── title, slug, episode_number
   ├── episode_type: entry | core | expansion | special
   ├── series_id (optional)
   └── character_id (anchor character)

2. DRAMATIC QUESTION
   └── The tension that this episode explores
   └── Example: "Will she let you stay after closing?"
   └── NOT a quest objective — a narrative tension to inhabit

3. OPENING STATE
   ├── episode_frame: Platform stage direction
   ├── opening_line: Character's first message
   ├── background_image_url: Visual context
   └── initial_stakes: What's at risk entering this moment

4. NARRATIVE RAILS (Soft Beats)
   └── beat_guidance: JSON structure for LLM
       ├── establishment: How the situation grounds itself
       ├── complication: What disrupts equilibrium
       ├── escalation: How tension builds
       └── pivot_markers: Signals that resolution is near

5. RESOLUTION SPACE
   └── valid_endings: Array of acceptable resolution types
       ├── positive: Tension resolved favorably
       ├── neutral: Suspended, hooks for continuation
       ├── negative: Rejection, failure, stakes lost
       └── surprise: Character-driven unexpected turn

6. MEMORY TRIGGERS
   └── extraction_hints: What should be remembered
   └── unlock_signals: What this episode enables

7. HOOKS
   └── next_episode_hints: Pointers to continue the journey
   └── callback_opportunities: Things to reference later
```

### 4.2 How LLM Uses This

The system prompt for a session includes:

1. **Character's base system prompt** (personality, genre doctrine)
2. **Episode context injection:**
   - Dramatic question (implicit goal)
   - Current beat guidance
   - Resolution space awareness
   - Memory from previous sessions

The LLM doesn't follow a script — it **inhabits the dramatic question** while responding authentically.

---

## 5. Session Lifecycle

### 5.1 Session Flow

```
USER ENTERS EPISODE
        │
        ▼
┌─────────────────────────────────────────┐
│ OPENING PHASE                           │
│ ─────────────────                       │
│ • Episode frame displayed (scene card)  │
│ • Character delivers opening line       │
│ • Dramatic question is implicit         │
│ • User receives first impression        │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ MIDDLE PHASE (Guided Improvisation)     │
│ ─────────────────                       │
│ • User and character exchange messages  │
│ • LLM steers toward narrative beats     │
│ • Tension escalates naturally           │
│ • User choices influence direction      │
│ • Scene images generated at moments     │
│ • Memory extraction ongoing             │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ RESOLUTION DETECTION                    │
│ ─────────────────                       │
│ Triggers (any of):                      │
│ • LLM recognizes pivot/resolution       │
│ • Natural conversation pause            │
│ • User signals departure intent         │
│ • Character naturally closes scene      │
│ • (NOT: arbitrary message count)        │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ CLOSING PHASE                           │
│ ─────────────────                       │
│ • Resolution type determined            │
│ • Final memory extraction               │
│ • Hooks for future captured             │
│ • Session can be marked complete        │
│ • Or: left open for continuation        │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ POST-SESSION OPTIONS                    │
│ ─────────────────                       │
│ • Continue this session (extend)        │
│ • Start next episode (if serial)        │
│ • Browse other episodes                 │
│ • Return later (session resumable)      │
└─────────────────────────────────────────┘
```

### 5.2 Session States

| State | Definition | User Experience |
|-------|------------|-----------------|
| **Active** | Currently in conversation | Chat interface open |
| **Paused** | User left mid-conversation | Can resume where left off |
| **Faded** | Natural conversation pause | Can extend or start new |
| **Complete** | Dramatic question addressed | Badge/unlock, suggested next |

**Key Distinction:** Episodes don't "end" — they **fade** with natural closings. User always has control.

### 5.3 Episode "Completion" vs Session "Ending"

| Concept | Definition | Mechanism |
|---------|------------|-----------|
| **Session End** | Conversation stops | User leaves or character closes |
| **Episode Fade** | Natural pause point | Character signals pause, user can continue or leave |
| **Episode Complete** | Dramatic arc experienced | Resolution reached (any type) |
| **Episode Mastery** | Multiple resolutions seen | Replay value, achievements |

---

## 6. Progression Model

### 6.1 What Progresses?

| Layer | What Changes | User Feels | Implementation |
|-------|--------------|------------|----------------|
| **Memory** | Facts accumulate | "She remembers me" | `memory_events` table |
| **Engagement Stats** | Session/message counts | (Invisible to user) | `engagements` table |
| **Episode Availability** | New episodes recommended | "More to discover" | Unlock signals |
| **Character Behavior** | LLM adjusts based on history | "She's different with me now" | Memory in context |
| **Narrative Reveals** | Later episodes reveal more | "I'm learning her secrets" | Serial episode design |

### 6.2 Series-Level Progression

For **Serial** series types, progression across episodes matters:

```
SERIES PROGRESSION
═══════════════════════════════════════════════════════════════

Episode 0 (Entry)
    │   "Coffee Shop Crush"
    │   Dramatic Q: Will she notice you?
    │   Resolution: She notices. Connection sparked.
    │
    │   Memory: "First meeting at closing time"
    │   Hook: "She mentioned working late tomorrow"
    │
    ▼
Episode 1 (Core)
    │   "The Second Cup"
    │   Dramatic Q: Will she open up?
    │   Resolution: Vulnerability shared.
    │
    │   Memory: "She talked about her art dreams"
    │   Hook: "Her gallery showing next week"
    │
    ▼
Episode 2 (Core)
    │   "Opening Night"
    │   Dramatic Q: Will you show up for her?
    │   Resolution: Stakes raised, relationship tested.
    │
    ▼
...continues...
```

### 6.3 Memory as Progression Currency

Memory is the **implicit progression system** — no meters, no levels, just felt continuity.

```
SESSION 1 (Episode 0)
    Memory extracted: "User's name is Alex"
    Memory extracted: "User mentioned liking jazz"

SESSION 2 (Episode 1)
    Memory available: All from Session 1
    Character references: "Alex, right? The jazz fan."
    New memory: "User shared about job stress"

SESSION 3 (Episode 0 replay)
    Memory available: All accumulated
    Character knows: Name, jazz, job stress
    Different experience: Replay with history
```

### 6.4 Context Management Checkpoint

At series/episode boundaries, context management becomes critical:

| Boundary | Context Action | Purpose |
|----------|----------------|---------|
| **New Session (same episode)** | Load full episode context + memories | Continuity |
| **New Episode (same series)** | Summarize previous episode + memories | Progression feel |
| **New Episode (different series)** | Memories only (no episode context) | Character continuity |
| **New Character** | Fresh start, no context | New relationship |

**Implication:** We need **episode summaries** stored for serial progression.

### 6.5 Context Management Architecture

Episode boundaries are natural checkpoints for memory consolidation and context management. This section defines how context flows across sessions and episodes.

#### Memory Extraction Flow

```
SESSION ENDS (Episode fade or complete)
        │
        ▼
┌─────────────────────────────────────────┐
│ MEMORY EXTRACTION                       │
│ ─────────────────                       │
│ • LLM extracts key facts from session   │
│ • Stored in memory_events table         │
│ • Tagged with episode/session context   │
│ • Importance scoring for relevance      │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ EPISODE SUMMARY (Serial Series Only)    │
│ ─────────────────                       │
│ • LLM generates 2-3 sentence summary    │
│ • Captures: dramatic arc, resolution    │
│ • Stored at session level               │
│ • Used as context for NEXT episode      │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ HOOKS CAPTURED                          │
│ ─────────────────                       │
│ • Topics to revisit                     │
│ • Promises made by character            │
│ • User interests to follow up           │
│ • Pointers to next episode              │
└─────────────────────────────────────────┘
```

#### Context Build for New Session

When a user starts a new session, context is assembled in layers:

```
SESSION CONTEXT BUILD
═══════════════════════════════════════════════════════════════

1. CHARACTER FOUNDATION
   └── Character system prompt (personality, genre doctrine)

2. EPISODE CONTEXT
   ├── Dramatic question (what tension to explore)
   ├── Beat guidance (soft narrative waypoints)
   ├── Resolution space (valid endings)
   └── Episode frame (opening context)

3. MEMORY CONTEXT (User ↔ Character)
   ├── All memories with this character
   ├── Relevance-weighted (recent + important first)
   └── Summarized if exceeds token budget

4. SERIES CONTEXT (Serial Series Only)
   ├── Previous episode summaries
   ├── Series-level arc awareness
   └── Summary bridge content (if user skipped)

5. SESSION HISTORY
   └── Current conversation messages
```

#### Context Budget Management

| Context Layer | Token Budget | Priority |
|---------------|--------------|----------|
| Character system prompt | ~500-800 | Critical — never truncated |
| Episode context | ~300-500 | Critical — defines the episode |
| Memory context | ~500-1000 | High — summarize if needed |
| Series context | ~200-400 | Medium — for serial only |
| Session history | Remaining | Sliding window if needed |

**Key Principle:** Memory and series context should never crowd out current conversation. Summarization > truncation.

---

## 7. Stakes & Engagement Mechanics

### 7.1 What Creates Stakes

| Mechanism | How It Works | Example |
|-----------|--------------|---------|
| **Scarcity** | Limited resources (sparks, messages) | "Make this count" |
| **Character Autonomy** | Character can reject, leave, get upset | "I might lose her" |
| **Temporal Tension** | Episode implies urgency | "Café is closing" |
| **Exclusive Content** | Some episodes unlock via engagement | "I've earned this" |
| **Emotional Investment** | Memory makes loss feel real | "She knows so much about me" |
| **Consequence Persistence** | Bad outcomes remembered | "She's still upset from last time" |

### 7.2 What DOESN'T Create Stakes (Anti-patterns)

| Anti-pattern | Why It Fails | Alternative |
|--------------|--------------|-------------|
| Grinding message counts | Feels like work | Quality interactions matter |
| Arbitrary locks | "Why can't I?" frustrates | Soft recommendations |
| Permanent failure | Too punishing | Recoverable, but remembered |
| Visible meters | Gamifies, breaks immersion | Implicit via memory/behavior |
| Pay-to-skip | Feels cheap | Pay for more, not to skip |

### 7.3 Character-Driven Stakes

The most powerful stakes come from the **character feeling real**:

```
CHARACTER AUTONOMY SPECTRUM
═══════════════════════════════════════════════════════════════

Servile (BAD)              Authentic (GOOD)           Hostile (BAD)
──────────────────────────────────────────────────────────────────
"Whatever you want"        "I don't know about        "I hate you"
Always agrees              that..." but stays         Always rejects
No boundaries              Has moods, limits          No warmth
No challenge               Can be won over            No reward
User gets bored            User feels stakes          User gives up
```

---

## 8. User Control Model (Netflix-Inspired)

### 8.1 Core Control Principle

> **Users control WHEN and WHICH episodes. Platform controls HOW the episode unfolds.**

This is the foundational principle that balances user agency with crafted experience:

| Control Domain | Owner | Examples |
|----------------|-------|----------|
| **Navigation** | User | Which episode, when to start, when to leave |
| **Pacing** | User | How fast to respond, when to return |
| **Exploration** | User | Which series, which character, depth of engagement |
| **Narrative** | Platform + LLM | How the story unfolds, character behavior, beats |
| **Stakes** | Platform | Character authenticity, consequences, tension |

### 8.2 User Freedom Principles

Users control their experience like Netflix viewers:

| Control | Netflix | Fantazy |
|---------|---------|---------|
| **Start anywhere** | Pick any episode | Access any entry episode |
| **Skip forward** | Fast-forward | Jump to next episode |
| **Rewatch** | Replay episode | Replay with memory persisting |
| **Pause** | Stop watching | Session pauses, resume later |
| **Binge** | Watch continuously | Play multiple sessions |
| **Abandon** | Stop mid-episode | Leave session, resumable |

### 8.3 Within-Episode Control

During a session, users have agency but not explicit controls:

| What User Controls | How |
|--------------------|-----|
| Conversation direction | Their messages steer the narrative |
| Pacing | Response timing (no rush) |
| Depth | Can probe deeper or stay surface |
| Exit | Can leave anytime |

| What User Doesn't Control (Authenticity) |
|------------------------------------------|
| Character personality (consistent) |
| Character boundaries (respected) |
| Whether character likes them (earned) |
| Episode premise (authored) |

---

## 9. Series Type Implications

Different series types suggest different progression and stakes models:

### 9.1 Standalone Series

```
Type: standalone
═══════════════════════════════════════════════════════════════

Progression: None required
Stakes: Per-episode only
Memory: Accumulates but episodes don't build
Replay Value: High (each is self-contained)
Best For: Variety, casual engagement

Example: "Coffee Shop Encounters"
- Each episode is a different charged moment
- No required order
- User can dip in and out
```

### 9.2 Serial Series

```
Type: serial
═══════════════════════════════════════════════════════════════

Progression: Episodes build on each other
Stakes: Cumulative, reveals compound
Memory: Critical for continuity
Replay Value: Medium (best in order, but replay enriches)
Best For: Deep engagement, relationship arcs

Example: "The Handler Files"
- Episode 0: First assignment
- Episode 1: Trust tested
- Episode 2: Secrets revealed
- Episode 3: Loyalty choice
...

Requires: Episode summaries for context management
```

### 9.3 Anthology Series

```
Type: anthology
═══════════════════════════════════════════════════════════════

Progression: Thematic, not sequential
Stakes: Emotional variety
Memory: Shared but episodes loosely connected
Replay Value: High (different moods)
Best For: Thematic exploration

Example: "Late Night Confessions"
- Various vulnerable moments
- Same character, different situations
- Thematic thread: vulnerability
```

### 9.4 Crossover Series

```
Type: crossover
═══════════════════════════════════════════════════════════════

Progression: Special event feel
Stakes: Novelty, "what if" tension
Memory: Cross-character awareness
Replay Value: High (limited-time feel)
Best For: Special events, surprises

Example: "When Worlds Collide"
- Characters from different worlds meet
- User caught between them
- Special occasion content
```

---

## 10. Monetization Alignment

### 10.1 Monetization Philosophy

> Monetization creates scarcity that enhances value, not barriers that frustrate.

The Netflix model (subscription access) combined with gaming inspiration (premium content, urgency).

### 10.2 Monetization Mechanisms

| Mechanism | How It Works | User Value | Platform Value |
|-----------|--------------|------------|----------------|
| **Spark Cost per Session** | Starting episode costs sparks | Scarcity = value | Core monetization |
| **Premium Episodes** | Some episodes cost more | Exclusive feels special | Tiered content |
| **Session Extension** | Continue past natural fade | "Just a little more" | Engagement depth |
| **Series Unlock Packs** | Buy access to full series | Binge without waiting | Commitment |
| **Early Access** | New episodes before general | Exclusivity | Loyalty reward |

### 10.3 Genre-Specific Monetization

Different genres have different engagement patterns, which suggests different monetization strategies:

#### Romantic Tension (Genre 01)

| Characteristic | Engagement Pattern | Monetization Opportunity |
|----------------|-------------------|-------------------------|
| **Session Length** | Deep, prolonged, savoring | Session extension is natural upsell |
| **Replay Behavior** | High — users want to re-experience moments | Replay with memory creates fresh experience |
| **Pacing** | Slow burn, users take time | No rush — value per-session monetization |
| **What Users Pay For** | More time with character, deeper intimacy | Extension, premium intimate episodes |

**Optimal Mechanisms:**
- Session extension (continue past natural fade)
- Premium expansion episodes (deeper vulnerability)
- "Special moment" episodes (first kiss, confession, etc.)

#### Psychological Thriller (Genre 02)

| Characteristic | Engagement Pattern | Monetization Opportunity |
|----------------|-------------------|-------------------------|
| **Session Length** | Intense, shorter bursts | Sessions complete faster, volume matters |
| **Replay Behavior** | Medium — want different outcomes | Resolution variety is draw |
| **Pacing** | Fast, cliffhangers, "what happens next" | Series unlock packs, next episode urgency |
| **What Users Pay For** | Reveals, answers, next chapter | Premium cliffhanger resolutions, series packs |

**Optimal Mechanisms:**
- Series unlock packs (binge the full thriller)
- Premium reveal episodes (the truth comes out)
- Early access to new episodes (cliffhanger resolution)

#### Monetization by Series Type

| Series Type | Primary Mechanism | Secondary Mechanism |
|-------------|------------------|---------------------|
| **Standalone** | Per-session spark cost | Premium individual episodes |
| **Serial** | Series unlock packs | Episode extension, early access |
| **Anthology** | Per-session spark cost | Thematic bundles |
| **Crossover** | Premium pricing (special event) | Limited-time access |

### 10.4 Monetization Anti-Patterns

| Anti-pattern | Why It's Bad | Alternative |
|--------------|--------------|-------------|
| Pay to skip content | Devalues the journey | Pay for MORE content |
| Hard paywalls mid-episode | Frustrating interruption | Natural episode boundaries |
| Message limits that cut off | Feels punishing | Spark cost upfront |
| Pay to win character approval | Breaks authenticity | Character earnable only |

---

## 11. Implementation Considerations

### 11.1 Episode Template Schema Evolution

```sql
-- Potential additions to episode_templates
ALTER TABLE episode_templates ADD COLUMN dramatic_question TEXT;
ALTER TABLE episode_templates ADD COLUMN beat_guidance JSONB DEFAULT '{}';
ALTER TABLE episode_templates ADD COLUMN resolution_types TEXT[] DEFAULT '{"positive","neutral","negative"}';
ALTER TABLE episode_templates ADD COLUMN memory_triggers JSONB DEFAULT '[]';
ALTER TABLE episode_templates ADD COLUMN hooks JSONB DEFAULT '[]';
```

### 11.2 Session State Tracking

```sql
-- Potential additions to sessions
ALTER TABLE sessions ADD COLUMN session_state VARCHAR(20) DEFAULT 'active';
-- Values: 'active', 'paused', 'faded', 'complete'

ALTER TABLE sessions ADD COLUMN resolution_type VARCHAR(20);
-- Values: 'positive', 'neutral', 'negative', 'surprise', NULL (incomplete)

ALTER TABLE sessions ADD COLUMN episode_summary TEXT;
-- Generated at session fade/complete for serial progression
```

### 11.3 Context Management

For serial series, we need to manage context across episodes:

```
SESSION CONTEXT BUILD
═══════════════════════════════════════════════════════════════

1. Character System Prompt (base)
2. + Episode Context
   ├── Dramatic question
   ├── Current beat guidance
   ├── Resolution space
   └── Episode frame (opening)
3. + Memory Context
   ├── All memories with this character
   └── Summarized, relevance-weighted
4. + Series Context (if serial)
   ├── Previous episode summaries
   └── Series-level arc awareness
5. + Session History
   └── Current conversation messages
```

---

## 12. Design Decisions (Assessed)

This section documents key design decisions with recommended approaches. These are **assessed recommendations** based on the "journey IS experience" philosophy — they can be revisited as we learn from real users.

### 12.1 Resolution Detection

**Decision: Hybrid — LLM suggests, platform responds, user controls**

The LLM includes metadata hints in responses; platform interprets; user always has final control.

```
LLM Response Metadata:
  resolution_hint: "natural_pause" | "escalating" | "approaching_closure" | null

Platform Response:
  - "natural_pause" → Offer soft "Continue?" or graceful fade
  - "approaching_closure" → Prepare memory extraction, suggest next
  - Never force end — user can always continue

User Controls:
  - Leave anytime (session pauses, resumable)
  - Extend anytime (may cost sparks if past soft limit)
  - Start next episode (if available)
```

**Rationale:** Respects "journey IS experience" — LLM reads the room, platform responds, user decides. No hard cutoffs.

---

### 12.2 Episode Length

**Decision: Variable by episode type with soft guidance**

| Episode Type | Soft Target | Rationale |
|--------------|-------------|-----------|
| **Entry** | 8-15 messages | Hook, not commitment — quick taste |
| **Core** | 15-30 messages | Meat of the experience |
| **Expansion** | 20-40 messages | Deep dive for engaged users |
| **Special** | Variable | Event-driven |

**Implementation:** These are **LLM guidance targets** in beat_guidance, not hard limits. The LLM steers toward natural resolution around these ranges.

**Key Principle:** Never cut off — guide pacing, let user extend.

---

### 12.3 Failure State Handling

**Decision: Recoverable but remembered**

Bad outcomes persist in memory but are never permanent. Recovery paths are built into future content.

```
FAILURE RECOVERY MODEL
═══════════════════════════════════════════════════════════════

Episode 1 ends badly:
  Memory: "User pushed too hard, I asked them to leave"
  Session marked: resolution_type = 'negative'

Episode 1 replay:
  Character: "Back again? I remember last time..."
  (Different experience — replay with history)

Episode 2 (designed with recovery path):
  Opening can acknowledge: "I've been thinking about what happened..."
  (Opportunity to repair, or deepen the tension)
```

| Outcome Type | Persists? | Recoverable? | User Experience |
|--------------|-----------|--------------|-----------------|
| Negative resolution | ✅ Yes | ✅ Yes | "Stakes feel real, but hope remains" |
| Retry same episode | ✅ Memory knows | ✅ Yes | "Character aware of retry" |
| Future recovery | Built into content | ✅ Yes | "Story continues, failure becomes arc" |
| Permanent failure | ❌ Never | N/A | "Too punishing, breaks engagement" |

**Rationale:** Stakes feel real (consequences remembered) but hope remains (recovery always possible). Failure becomes PART of the story, not the end of it.

---

### 12.4 Serial Episode Gating

**Decision: Soft gate with summary bridge option**

Users are encouraged but never forced to start at Episode 0 for serial series.

```
USER WANTS EPISODE 2 (hasn't done 0 or 1)
        │
        ▼
┌─────────────────────────────────────────┐
│ SOFT GATE UI                            │
│ ─────────────────                       │
│ "This episode continues a story."       │
│                                         │
│ [Start from Episode 0] ← recommended    │
│ [Quick Catch-up] ← summary bridge       │
│ [Jump In Anyway] ← skip                 │
└─────────────────────────────────────────┘
```

**Summary Bridge Behavior:**
- Platform provides 2-3 sentence summary of skipped episodes
- Character can acknowledge "shared history" even if not experienced
- Memory flagged: `summary_bridged: true`
- Full experience still available if user returns to Episode 0 later

**Rationale:** Respects Netflix freedom (user controls navigation) while encouraging best experience. Summary bridge prevents confusion without forcing order.

---

### 12.5 Replay Philosophy

**Decision: Memory always persists (default)**

| Scenario | Memory Behavior | Character Experience |
|----------|-----------------|---------------------|
| Replay Episode 0 | All memories available | "I remember when we first met..." |
| Replay after failure | Failure remembered | "Trying again? I'm still hurt, but..." |
| New series, same character | Cross-series memories | "You again. Different circumstances..." |

**Future Consideration:** "Fresh Start" option that explicitly resets all memory for a character. This would be a nuclear option, clearly communicated as erasing the relationship. Not built for Genesis Stage.

**Rationale:** Memory persistence is core to the product. Replays become richer, not repetitive. Character feels alive and continuous.

---

## 13. Summary

The Episode Dynamics model establishes:

1. **Guided Improvisation:** Episodes are stages with rails, not scripts or sandboxes
2. **Journey as Experience:** The value is in the moment, not the destination
3. **Session Lifecycle:** Clear phases from opening through fade/completion
4. **Progression via Memory:** No meters, just felt continuity
5. **Context Management:** Episode boundaries as checkpoints for memory and summarization
6. **User Control:** Users control WHEN/WHICH; platform controls HOW
7. **Character-Driven Stakes:** Authenticity creates meaningful tension
8. **Series-Aware Design:** Different series types have different dynamics
9. **Monetization Alignment:** Genre-specific strategies, scarcity enhances value
10. **Recoverable Failure:** Stakes feel real, but hope always remains

**Key Design Decisions:**
- Resolution detection: Hybrid (LLM suggests, platform responds, user controls)
- Episode length: Variable by type with soft guidance
- Failure states: Remembered but recoverable
- Serial gating: Soft gate with summary bridge option
- Replay: Memory always persists

> **The episode's job is to create a moment worth inhabiting —**
> **where the user feels agency, the character feels alive, and the stakes feel real.**

---

## Related Documents

- `docs/CONTENT_ARCHITECTURE_CANON.md` — Content taxonomy, entity relationships
- `docs/EPISODES_CANON_PHILOSOPHY.md` — Episode narrative philosophy
- `docs/EP-01_pivot_CANON.md` — Episode-first interaction model
- `docs/FANTAZY_CANON.md` — Platform definition
- `docs/GLOSSARY.md` — Terminology reference
- `docs/character-philosophy/Genre 01 — Romantic Tension.md`
- `docs/character-philosophy/Genre 02 — Psychological Thriller- Suspense.md`
