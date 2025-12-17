# EP-01 Pivot: Episode-First Interaction Model

**Status:** APPROVED - Implementation In Progress

**Scope:** Fundamental shift in product hierarchy from character-centric to episode-centric

**Last Updated:** 2024-12-16

---

## DECISIONS (Finalized)

| Decision | Resolution |
|----------|------------|
| **Terminology** | Keep `episode_templates` (no rename to "scenarios") - "episode" is the brand |
| **Relationship scope** | User ↔ Character (memories persist across ALL episodes with same character) |
| **Opening beat source of truth** | `episode_templates` only - REMOVE from `characters` table |
| **Scene cards** | Use `episode_frame` field for opening stage direction |
| **User POV** | First-person ("I", "me") - already works, no change needed |
| **Character POV** | Counterpart ("you") - already works, no change needed |
| **User Identity** | "As Yourself" (Genesis Stage) - see CONTENT_ARCHITECTURE_CANON.md Section 5 |

---

---

## 1. Executive Summary

This document proposes a conceptual pivot from **"chat with characters"** to **"enter episodes"** as the primary user mental model. Characters become counterparts cast into scenarios, rather than hosts that users visit.

This is not a UI change. It's a hierarchy inversion that affects:
- Discovery/browse experience
- Data model relationships
- The fundamental meaning of "chat"
- POV and narrative voice

---

## 2. The Pivot Defined

### Current Model: Character-Centric

```
User → "Chat with Sora" → Episodes happen within that relationship
       ─────────────────
       Character is the product
       Episodes are scenarios for that character
```

- **Discovery:** "Meet Sora" → (her episodes underneath)
- **Relationship:** User ↔ Character
- **Chat mental model:** "I'm texting Sora"
- **Character's burden:** Must establish scene, carry world-building

### Proposed Model: Episode-Centric

```
User → "Enter Coffee Shop Crush" → Sora is cast as counterpart
       ─────────────────────────
       Episode/Scenario is the product
       Character is who you experience it WITH
```

- **Discovery:** "Coffee Shop Crush" card (Sora is the lead)
- **Relationship:** User ↔ Episode (with Character as counterpart)
- **Chat mental model:** "I'm in this scene, she's here with me"
- **Platform's burden:** Sets the stage; character just speaks

---

## 3. Comparison Matrix

| Aspect | Character-First | Episode-First |
|--------|-----------------|---------------|
| **What user browses** | Characters | Scenarios/Episodes |
| **What user "enters"** | A chat with someone | A situation |
| **Character's role** | Host/subject | Counterpart/scene partner |
| **Platform's role** | Connects you to character | Sets the stage, casts the character |
| **"Chat" is...** | Messaging a person | Playing out a scene |
| **World-building by** | Character (narration) | Platform (scene cards) |
| **Discovery card shows** | Avatar + name | Scenario premise + lead character |

---

## 4. POV Modes (Per-Genre Selection)

The episode-first model clarifies how narrative voice should work:

### 4.1 Counterpart POV (Recommended Default)

Character narrates + reacts. User is "you" in the scene.

```
Character: "You're here late. I was starting to think you weren't coming."
```

- Best for: romance, thriller, most chat-native vibes
- Feels like: you're talking to someone who is present and alive
- Character speaks naturally; scene context from visuals

### 4.2 Player-Protagonist POV (Deliberate Use Only)

User is "you" as the main actor; character is a companion/voice in ear.

```
Character: "The door on your left. Hurry - they're coming."
```

- Best for: action, mission, game-like arcs
- Risk: can feel like interactive fiction more than "chat with someone"
- Character becomes guide, not counterpart

### 4.3 Hybrid POV (Recommended for Fantazy)

Character talks normally, but platform adds scene cards as stage direction.

```
┌─────────────────────────────────────────┐
│ [The café is empty. Rain streaks the    │
│  window. She hasn't turned around yet.] │
└─────────────────────────────────────────┘

Character: "Lock the door behind you."
```

- Best for: cinematic openings without forcing character to narrate everything
- Platform provides stage direction; character stays in voice
- Leverages existing scene card infrastructure

### 4.4 User Identity Model (Cross-Reference)

> **See: CONTENT_ARCHITECTURE_CANON.md Section 5 - User Identity Model**

The POV modes above assume the **"As Yourself"** user identity model:

- User connects to episodes **as themselves**, not as a predefined protagonist
- Character speaks TO "you" (the user)
- User's name is learned through natural conversation → stored in Memory
- No user avatar — user is the "camera"/POV experiencing the scene

This is **locked for Genesis Stage**. Protagonist mode (user plays AS a character) is a future consideration for fictional IP worlds where "as yourself" doesn't make sense.

---

## 5. Narrative Voice Layers

| Layer | Voice | Content | Implementation |
|-------|-------|---------|----------------|
| **Scene Card** | Platform/Narrator | Setting, atmosphere, what user "sees" | `scene_images` with caption |
| **Character Message** | Counterpart | Dialogue, reaction, what they *say* | `messages.role = 'assistant'` |
| **User Message** | Implied "you" | Response, action, choice | `messages.role = 'user'` |

Key insight: The character no longer carries world-building burden. The scenario and scene cards do.

---

## 6. Schema Implications

### 6.1 Current Schema Hierarchy

```
worlds
  └── characters ──owns──▶ episode_templates
           │
           └── relationships (User ↔ Character)
                    │
                    └── episodes (runtime instances)
```

Characters own episode_templates. Relationships are User ↔ Character.

### 6.2 Proposed Schema Hierarchy

```
scenarios (elevated, first-class)
    │
    ├── genre
    ├── situation / premise
    ├── scene_config
    ├── opening_sequence (scene cards + first line)
    │
    └── cast
         └── character_id (counterpart)
         └── role_type ('counterpart' | 'guide' | 'antagonist')

episodes (runtime)
    ├── scenario_id (not template_id)
    ├── character_id (which character is cast)
    ├── user_id
    └── ...

relationships
    ├── User ↔ Scenario (progress through THIS story)
    │   OR
    └── User ↔ Character-in-Scenario (contextual relationship)
```

### 6.3 Migration Considerations

| Current | Proposed | Notes |
|---------|----------|-------|
| `episode_templates` | `scenarios` | Rename + elevate |
| `episode_templates.character_id` | `scenarios.default_character_id` | Character is cast, not owner |
| `relationships` | Keep or split | May need scenario-scoped relationships |
| `episodes.template_id` | `episodes.scenario_id` | Terminology alignment |

---

## 7. Discovery UX Implications

### Current Discovery

```
┌─────────────────────────────────────────────────────────┐
│  [Sora Avatar]     [Mira Avatar]     [Kai Avatar]       │
│   "Sora"            "Mira"            "Kai"             │
│   Barista           Neighbor          Coworker          │
│                                                         │
│   ↓ Tap to see episodes ↓                               │
└─────────────────────────────────────────────────────────┘
```

### Episode-First Discovery

```
┌─────────────────────────────────────────────────────────┐
│  [Scene: Café, late night]                              │
│  "Coffee Shop Crush"                                    │
│  She's closing up. You're still here.                   │
│  ──────────────────────────────────                     │
│  Featuring: Sora                                        │
│                                                         │
│  [Scene: Apartment hallway]                             │
│  "The Thin Wall"                                        │
│  Your neighbor heard everything.                        │
│  ──────────────────────────────────                     │
│  Featuring: Mira                                        │
└─────────────────────────────────────────────────────────┘
```

The scenario IS the hook. The character is who you experience it with.

---

## 8. What "Chat" Becomes

### Current: Conversation Paradigm

- User opens app → selects character → "chats" with them
- Mental model: texting a friend/crush
- Episodes feel like: conversation topics or moods

### Proposed: Scene Paradigm

- User opens app → selects scenario → enters scene with counterpart
- Mental model: stepping into a moment
- Episodes feel like: chapters or scenes in a story

The chat interface remains, but what it *represents* shifts from "conversation" to "interactive scene."

### Primitive Hierarchy

```
Scene       = A discrete narrative moment (platform framing + counterpart dialogue)
Episode     = A sequence of scenes (or single extended scene)
Arc         = Progression across episodes with a character
Relationship = Accumulated history across arcs
```

---

## 9. Alignment with Existing Canon

### FANTAZY_CANON.md Alignment

> "People don't engage with characters. They engage with situations."

This pivot operationalizes that insight. Situations (scenarios) become the browsable product.

> "Characters are containers. Episodes are entry points. Chats are live scenes."

Episode-first makes "episodes are entry points" literal in the UX.

> "Fantazy's job is to manufacture that moment instantly."

Scenario-first discovery = moment-first discovery.

### EPISODES_CANON_PHILOSOPHY.md Alignment

> "Episodes are earned narrative moments, not content to browse."

Tension: This says episodes shouldn't be "browsed," but discovered through progression. The pivot may need to reconcile:
- Episode 0 = browsable entry point (the hook)
- Episodes 1-N = earned through engagement

> "Episode 0 must answer, within 30 seconds: Who is this? Where am I? Why is this moment charged? Why should I reply now?"

Episode-first discovery makes Episode 0 the product card itself.

---

## 10. Open Questions

### 10.1 Relationship Scope

If relationships are User ↔ Character, does episode-first change that?

Options:
- Keep User ↔ Character (relationship transcends scenarios)
- Add User ↔ Scenario (progress is scenario-scoped)
- Both (layered: scenario progress + character bond)

### 10.2 Character Reuse Across Scenarios

Can Sora appear in multiple scenarios with different premises?

- "Coffee Shop Crush" (romance, café)
- "The Last Shift" (thriller, café under siege)

If yes: scenarios are truly independent, characters are cast.
If no: scenarios are still character-owned, just elevated in UX.

### 10.3 Terminology Finalization

| Current Term | Candidate Terms | Decision Needed |
|--------------|-----------------|-----------------|
| `episode_templates` | `scenarios`, `premises`, `moments` | |
| `episodes` | `sessions`, `playthroughs`, `instances` | |
| `chat` | `scene`, `session`, `interaction` | |

### 10.4 Scene Card as Narrative Device

How much narrative weight do scene cards carry?

- Minimal: Just atmosphere/visuals (current)
- Moderate: Stage direction, brief context (hybrid POV)
- Heavy: Full narration, user actions described (risks feeling like IF)

---

## 11. Implementation Phases (Tentative)

### Phase 1: Terminology + Schema Alignment

- Rename `episode_templates` → `scenarios` (or chosen term)
- Add `scenarios.premise` field for discovery card text
- Update frontend to show scenario-first cards

### Phase 2: Scene Card Evolution

- Add opening scene card to scenario definition
- Implement hybrid POV: platform scene card + character first line
- Update chat UI to render scene cards as stage direction

### Phase 3: Relationship Model Decision

- Decide on relationship scope (character vs scenario vs both)
- Migrate data if needed
- Update progression logic

### Phase 4: Discovery UX Overhaul

- Redesign discover page as scenario browser
- Character becomes "featuring" credit, not primary
- Episode 0 becomes the scenario card itself

---

## 12. Summary

The EP-01 pivot proposes:

1. **Scenarios as first-class products** (not character-owned templates)
2. **Characters as counterparts** (cast into scenarios, not hosts)
3. **Platform as director** (scene cards set stage, not character narration)
4. **Hybrid POV** (platform stage direction + character dialogue)
5. **"Chat" reframed as "scene"** (interactive moment, not conversation)

This aligns with existing canon principles while operationalizing the insight that users engage with situations, not characters.

---

---

## 13. Implementation Cross-Check (Current State)

### 13.1 What Already Supports Episode-First

The codebase has **partial episode-first infrastructure** already:

| Component | Current State | Episode-First Ready? |
|-----------|--------------|---------------------|
| `episode_templates` table | Exists, has `situation`, `opening_line`, `background_image_url` | ✅ Yes |
| `EpisodeDiscoveryItem` type | Returns episodes with character context | ✅ Yes |
| `/episode-templates` API | Has `list_all_episodes()` for cross-character discovery | ✅ Yes |
| `episode_type` field | `entry`, `core`, `expansion`, `special` per canon | ✅ Yes |
| `episodes.episode_template_id` | Runtime links to template | ✅ Yes |

### 13.2 What's Still Character-First

| Component | Current State | Issue |
|-----------|--------------|-------|
| `episode_templates.character_id` | FK to characters (ownership) | Character owns templates, not vice versa |
| `characters.opening_situation/line` | Duplicates template fields | Ambiguous which is source of truth |
| `relationships` | User ↔ Character only | No scenario-scoped relationships |
| Frontend discovery | Likely character-browse → episodes underneath | UX is character-first |
| Route naming | `/episode-templates` | Could be `/scenarios` for clarity |

### 13.3 Terminology (FINALIZED)

| Current Term | Decision | Notes |
|--------------|----------|-------|
| `episode_templates` | **KEEP** | "Episode" is the brand, no rename |
| `episode_templates.character_id` | **KEEP** | Semantically: character is cast into episode |
| `EpisodeDiscoveryItem` | **KEEP** | Already episode-first in naming |
| `Episode` (runtime) | **KEEP** | Runtime instance |
| `opening_line` | **KEEP** | Clear enough |

### 13.4 Redundancy to Resolve (RESOLVED)

**Characters vs Episode Templates - Opening Beat**

Current state has opening beat in TWO places:

```python
# characters table (TO BE REMOVED)
opening_situation: str  # "Scene setup for the first chat"
opening_line: str       # "Character's first message"

# episode_templates table (SOURCE OF TRUTH)
situation: str          # Same purpose
opening_line: str       # Same purpose
```

**RESOLUTION: Remove from characters table.**

- `episode_templates` is the single source of truth for opening beats
- Characters may have a `default_episode_template_id` to identify their Episode 0
- This eliminates ambiguity and enforces episode-first architecture

---

## 14. First Principles Check (Canon Alignment)

### 14.1 FANTAZY_CANON.md Alignment

| Canon Statement | EP-01 Pivot Alignment |
|-----------------|----------------------|
| "People don't engage with characters. They engage with situations." | ✅ **Direct support** - situations (scenarios) become the product |
| "Characters are containers. Episodes are entry points." | ✅ **Direct support** - episodes/scenarios are what users browse |
| "Fantazy's job is to manufacture that moment instantly." | ✅ **Supported** - scenario card IS the moment |
| "Episode-first" philosophy | ✅ **This pivot operationalizes it** |

**Canon reinforcement from FANTAZY_CANON.md:**
> "Characters are containers for moments."

This pivot takes that literally: the scenario IS the moment, the character IS the container you experience it with.

### 14.2 EPISODES_CANON_PHILOSOPHY.md Alignment

| Canon Statement | EP-01 Pivot Alignment |
|-----------------|----------------------|
| "Episodes are earned narrative moments, not content to browse." | ⚠️ **Tension** - Episode 0 is browsable, 1-N are earned |
| "Episode 0 is the sharpest hook" | ✅ **Supported** - Episode 0 scenario card = the hook |
| "Soft-sequential progression" | ✅ **Compatible** - progression can be scenario-scoped |
| "Relationship state is implicit" | ✅ **Compatible** - no meters, just felt |

**Resolution for "not content to browse" tension:**

The canon says episodes shouldn't be "browsed" but Episode 0 is explicitly designed as a hook. The pivot interprets this as:

- **Episode 0 (entry)** = Browsable scenario cards on discovery
- **Episodes 1-N (core/expansion)** = Unlocked through engagement, not browsed

This is consistent: users browse *entry points* (Episode 0s), but *progress* through the arc.

### 14.3 PHILOSOPHY.md Alignment

| Canon Statement | EP-01 Pivot Alignment |
|-----------------|----------------------|
| "Situation over personality" | ✅ **Core thesis** - scenario > character in hierarchy |
| "Constraint creates character" | ✅ **Compatible** - characters still have rails within scenarios |
| "Continuity creates connection" | ⚠️ **Question** - is continuity scenario-scoped or character-scoped? |

**Open question from philosophy alignment:**

The pivot needs to decide: does relationship continuity persist across scenarios with the same character, or is each scenario a fresh start?

**Recommendation:** Relationship is User ↔ Character, accumulated across ALL scenarios. Memories and stage persist. This means:
- "Coffee Shop Crush" (Scenario A) with Sora → memories persist
- "Late Night Confession" (Scenario B) with Sora → same relationship, memories carry over
- Scenarios are entry points to a continuous relationship, not isolated experiences

---

## 15. Verdict: Is This Pivot Correct?

### First Principles Assessment

| Principle | Current State | With Pivot | Verdict |
|-----------|--------------|------------|---------|
| Situations > Characters | ⚠️ Partial (infra yes, UX no) | ✅ Fully operationalized | Improvement |
| Episodes are entry points | ⚠️ Partial (data yes, framing no) | ✅ Scenarios ARE the entry | Improvement |
| Characters are containers | ⚠️ Characters own episodes | ✅ Scenarios cast characters | Alignment |
| Reply gravity | Neutral | Neutral (implementation detail) | No change |
| Continuity = relationship | ✅ Works | ✅ Preserved if relationship is User ↔ Character | Preserved |

### Risks

1. **User mental model disruption** - Users may expect "chat with X" not "enter scenario"
2. **Relationship scope ambiguity** - Need clear decision on character vs scenario relationships
3. **Migration complexity** - Renaming `episode_templates` → `scenarios` touches many files

### Recommendation

**APPROVED. Proceeding with implementation.**

Key decisions (finalized):

1. **Relationship scope:** User ↔ Character (memories persist across ALL episodes) ✅
2. **Terminology:** Keep `episode_templates` - "episode" is the brand ✅
3. **Discovery UX:** Episode cards as primary browse, "featuring [Character]" as secondary ✅
4. **Redundancy cleanup:** Remove `opening_situation`/`opening_line` from `characters` table ✅

---

---

## 16. Taxonomy Refinement (FINALIZED)

The episode-first pivot revealed legacy terminology ambiguity. This section establishes the canonical taxonomy.

### 16.1 Core Concepts

| Term | Definition | Implementation |
|------|------------|----------------|
| **Character** | Persona with identity, personality, visual identity | `characters` table |
| **Episode Template** | Pre-defined scenario (situation, opening_line, episode_frame) | `episode_templates` table |
| **Session** | Runtime conversation instance (formerly "episode") | `sessions` table (rename from `episodes`) |
| **Engagement** | Lightweight user↔character link for stats (formerly "relationship") | `engagements` table (rename from `relationships`) |
| **Memory** | Facts, preferences, events that persist across sessions | `memory_events` table |

### 16.2 Taxonomy Hierarchy

```
CHARACTER (Persona)
├── Identity: name, archetype, personality
├── Visual: avatar_kit, gallery
├── Episodes: episode_templates owned by character
│
├── EPISODE TEMPLATE (Scenario)
│   ├── situation: The setup ("Late night at the café...")
│   ├── opening_line: Character's first message
│   ├── episode_frame: Platform stage direction (scene card text)
│   ├── background_image_url: Visual for discovery card
│   ├── episode_type: entry | core | expansion | special
│   └── is_default: TRUE for Episode 0

USER
├── ENGAGEMENT (per character)
│   ├── user_id, character_id
│   ├── total_sessions: Count of sessions
│   ├── total_messages: Sum across sessions
│   ├── first_met_at: First session timestamp
│   ├── last_interaction_at: Most recent message
│   ├── is_favorite, is_archived
│   └── NO STAGE (sunset)
│
├── SESSION (runtime - per episode template)
│   ├── user_id, character_id, episode_template_id
│   ├── engagement_id (links to engagement)
│   ├── title: Episode template title
│   ├── Messages, scene_images
│   └── is_active: TRUE = current session
│
└── MEMORY (per character, persists across all sessions)
    ├── user_id, character_id
    ├── Accumulated facts, preferences, events
    └── Referenced during all sessions with this character
```

### 16.3 Key Decisions

#### Session Concurrency
**Decision: One active session per character (Option A)**

- When user starts a new episode template, previous session for that character becomes inactive
- User can resume previous sessions from "My Chats" history
- Prevents confusion of multiple concurrent conversations with same character

#### Stage Progression
**Decision: SUNSET - No stage progression**

The `stage` concept (acquaintance → friendly → close → intimate) is legacy "AI companion" thinking. In the episode-first model:

- Episodes are scenarios, not relationship milestones
- All episodes are accessible (no required_stage gating)
- Episode 0 is recommended starting point, not forced
- User chooses when to switch episodes
- Depth emerges from memory accumulation, not stage meters

**Migration:** Drop `stage`, `stage_progress`, `relationship_stage_thresholds` columns.

#### Engagement vs Relationship
**Decision: Rename and simplify**

"Relationship" implies emotional bond tracking which is not our job. "Engagement" is a neutral, stats-focused term.

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `relationships.stage` | REMOVED | No stage tracking |
| `relationships.stage_progress` | REMOVED | No progression meters |
| `total_episodes` | `total_sessions` | Renamed for clarity |
| `relationship_notes` | REMOVED or keep as `engagement_notes` | TBD |

#### Episode vs Session Naming
**Decision: Rename runtime table**

- `episode_templates` = Pre-defined scenarios (keep name - "episode" is the brand)
- `episodes` → `sessions` = Runtime conversation instances (rename)

This clarifies:
- "Episode" = the scenario template (what you browse)
- "Session" = the runtime instance (what you play)

### 16.4 Episode Progression Model

#### No Gating
All episode templates for a character are accessible. No `required_stage` field.

#### Soft Guidance
- Episode 0 is `is_default = TRUE`, positioned first in UI
- UI can suggest "Start here" but doesn't block other choices
- Episode types (`entry`, `core`, `expansion`, `special`) inform UI ordering, not access

#### User-Directed Flow
```
User browses episodes for Character X
  → Sees all episodes (E0, E1, E2...)
  → E0 has "Start Here" badge
  → User can choose any episode to begin
  → Starting new episode → new session (previous session inactive)
  → Memory persists across all sessions
```

### 16.5 Memory Persistence Model

**Scope: User ↔ Character (cross-session)**

Memory accumulates across ALL sessions with a character:

```
Session 1 (E0: Coffee Shop Crush)
  → Memory: "User mentioned they like jazz"

Session 2 (E1: Late Night Confession)
  → Memory recalled: Character references jazz preference
  → New memory: "User shared about their job stress"

Session 3 (E0: Coffee Shop Crush - replay)
  → All previous memories available
  → Character can reference both jazz + job stress
```

This creates the feeling of continuity without relationship stages.

---

## 17. Schema Migration Summary

### Tables to Rename

| Current | New | Notes |
|---------|-----|-------|
| `relationships` | `engagements` | Clean break, new semantics |
| `episodes` | `sessions` | Runtime instances |

### Columns to Drop

| Table | Column | Reason |
|-------|--------|--------|
| `relationships/engagements` | `stage` | No stage progression |
| `relationships/engagements` | `stage_progress` | No stage progression |
| `characters` | `relationship_stage_thresholds` | No stage progression |
| `episode_templates` | `required_stage` (if exists) | No gating |

### Columns to Rename

| Table | Old | New |
|-------|-----|-----|
| `engagements` | `total_episodes` | `total_sessions` |

### Foreign Keys to Update

All references to `episodes` → `sessions`:
- `messages.episode_id` → `messages.session_id`
- `scene_images.episode_id` → `scene_images.session_id`
- `memory_events.episode_id` → `memory_events.session_id`

All references to `relationships` → `engagements`:
- `episodes/sessions.relationship_id` → `sessions.engagement_id`

---

## Related Documents

- `docs/CONTENT_ARCHITECTURE_CANON.md` — Content taxonomy, User Identity Model (Section 5)
- `docs/GLOSSARY.md` — Canonical terminology reference
- `docs/FANTAZY_CANON.md` — Platform definition
- `docs/EPISODES_CANON_PHILOSOPHY.md` — Episode structure and progression
- `docs/character-philosophy/PHILOSOPHY.md` — Character design principles
- `docs/architecture/SYSTEM_ARCHITECTURE.md` — Technical architecture
- `docs/implementation/SESSION_ENGAGEMENT_REFACTOR.md` — Implementation plan for this refactor
