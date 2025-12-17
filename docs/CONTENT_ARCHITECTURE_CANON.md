# Fantazy Content Architecture Canon

**Status:** CANONICAL - Genesis Stage

**Scope:** Content taxonomy, entity relationships, editorial philosophy, production planning

**Created:** 2024-12-17

**Related:** EP-01_pivot_CANON.md, FANTAZY_CANON.md, GLOSSARY.md, Genre docs

---

## 1. Executive Summary

This document establishes the canonical content architecture for Fantazy's **Genesis Stage** — the foundational period where all content is platform-produced.

**Genesis Stage Focus:**
- All content is **internally scaffolded** (Worlds, Series, Characters, Episodes)
- Users consume experiences, not create them
- Studio tooling remains internal (email-gated)
- Architecture designed for future extensibility, but built for platform production now

The architecture follows a **Marvel Comics editorial model**: clear guidelines and relationships, but flexibility in how stories are told. Rules guide creation; they don't enforce rigid structures.

**Future Horizons (Post-Stabilization):**
- User character/episode creation within platform-defined worlds (TBD)
- Creator marketplace (much later, requires user feedback + market validation)

---

## 2. Design Principles

### 2.1 The Marvel Philosophy

Marvel Comics has successfully managed:
- Thousands of characters across decades
- Multiple universes (616, Ultimate, MCU)
- Shared continuity with creative freedom
- Canon hierarchy (main continuity, what-ifs, variants)
- Cross-character events and team-ups

**We adopt this philosophy:**

> **Rules guide. They don't constrain.**
>
> A character belongs to a world, but can guest in others.
> An episode belongs to a series, but can stand alone.
> Memory persists, but stories can diverge.

### 2.2 Netflix + TikTok Hybrid

Our interaction model combines:

| Netflix (Series) | TikTok (Moments) | Fantazy |
|------------------|------------------|---------|
| Episodes in order | Random discovery | Series with flexible entry |
| Binge sessions | Quick hits | Session-based with memory |
| Premium production | Moment-based browsing | Platform-produced, moment-first discovery |
| Subscription model | Swipe/browse UX | Sparks + Premium hybrid |

### 2.3 Scalability Requirements

The architecture must support:
- 10 → 10,000 characters without structural changes
- Multiple worlds and series running concurrently
- Cross-character discovery and recommendation
- Future extensibility for creator/user content (not built now)

---

## 3. Content Taxonomy

### 3.1 Entity Hierarchy

```
FANTAZY CONTENT UNIVERSE
│
├── WORLD (Universe/Setting)
│   │
│   ├── SERIES (Narrative Container)
│   │   └── Episode Templates (ordered)
│   │
│   └── CHARACTERS (can appear across series)
│       └── Episode Templates (character-anchored)
│
└── RUNTIME (Per-User)
    ├── Sessions (episode instances)
    ├── Engagements (user ↔ character)
    └── Memories (persist across sessions)
```

### 3.2 Entity Definitions

#### WORLD (Universe/Setting)

The ambient reality where stories take place.

| Attribute | Description |
|-----------|-------------|
| `name` | Display name ("Nexus Tower") |
| `slug` | URL-safe identifier |
| `genre` | Primary genre (romantic_tension, psychological_thriller) |
| `description` | Setting overview |
| `tone` | Emotional register (intimate, tense, playful) |
| `ambient_details` | World-specific context (JSON) |
| `rules` | Genre rules that apply (JSON) |

**Guidelines:**
- A world establishes "what kind of stories happen here"
- Characters inherit world's genre and tone as defaults
- World rules are guidelines, not hard constraints
- One world can contain multiple genres (genre blending)

**Examples:**
- "Crescent Cafe" — intimate romantic tension, late-night encounters
- "Nexus Tower" — corporate thriller, power dynamics, secrets
- "Meridian Institute" — psychological thriller, research ethics, isolation

---

#### SERIES (Narrative Container)

A narrative container that groups episodes into a coherent experience.

| Attribute | Description |
|-----------|-------------|
| `title` | Series title ("The Midnight Protocol") |
| `slug` | URL-safe identifier |
| `world_id` | Primary world (optional — can be cross-world) |
| `series_type` | standalone, serial, anthology, crossover |
| `description` | What this series is about |
| `featured_characters` | Characters cast in this series (JSON array of IDs) |
| `episode_order` | Ordered list of episode template IDs |
| `total_episodes` | Planned episode count |
| `status` | draft, active, completed |

**Series Types:**

| Type | Description | Example |
|------|-------------|---------|
| `standalone` | Self-contained story, any episode can be entry | "Coffee Shop Encounters" |
| `serial` | Sequential narrative, Episode 0 recommended first | "The Safehouse Files" |
| `anthology` | Themed collection, loosely connected | "Late Night Confessions" |
| `crossover` | Multiple characters from different worlds | "When Worlds Collide" |

**Guidelines:**
- Series are OPTIONAL — episodes can exist without a series
- Characters can appear in multiple series
- Serial series have soft sequencing (recommendations, not locks)
- Crossover series can pull characters from different worlds

---

#### CHARACTER (Persona)

The counterpart you experience stories WITH.

| Attribute | Description |
|-----------|-------------|
| `name` | Character name |
| `slug` | URL-safe identifier |
| `archetype` | Role type (barista, handler, researcher) |
| `world_id` | Primary home world |
| `genre` | Primary genre (can differ from world) |
| `personality` | Baseline traits (JSON) |
| `visual_identity` | Avatar kit reference |
| `system_prompt` | LLM behavior contract |
| `can_crossover` | Whether character can appear outside home world |

**Guidelines:**
- Characters belong to ONE primary world but can guest in others
- Character personality persists across all series/episodes
- Memory is character-scoped (user remembers THIS character across all stories)
- Archetype guides behavior but doesn't lock it

---

#### EPISODE TEMPLATE (Moment/Scenario)

The atomic unit of experience — a specific situation to enter.

| Attribute | Description |
|-----------|-------------|
| `title` | Episode title ("The Diner") |
| `slug` | URL-safe identifier |
| `character_id` | Anchor character (required) |
| `series_id` | Parent series (optional) |
| `episode_number` | Sequence in series (0 = entry) |
| `episode_type` | entry, core, expansion, special |
| `situation` | Scene description |
| `episode_frame` | Platform stage direction |
| `opening_line` | Character's first message |
| `background_image_url` | Scene visual |

**Episode Types:**

| Type | Purpose | Discovery |
|------|---------|-----------|
| `entry` | First experience with character/series | Browsable, recommended start |
| `core` | Main narrative beats | Sequenced within series |
| `expansion` | Deeper exploration, optional | Available after engagement |
| `special` | Events, crossovers, limited-time | Highlighted/promoted |

**Guidelines:**
- Every episode has ONE anchor character (who speaks)
- Episodes can reference other characters without them being present
- Entry episodes are always accessible (no hard locks)
- Episode frame sets the scene; character delivers dialogue

---

### 3.3 Entity Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CONTENT LAYER (Static)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   WORLD ─────────────────────────────────────────────────────┐         │
│     │                                                        │         │
│     │  contains                                              │         │
│     │                                                        │         │
│     ├────────► CHARACTER ◄──────────────────────────────┐    │         │
│     │              │                                    │    │         │
│     │              │ anchors                            │    │         │
│     │              │                                    │    │         │
│     │              ▼                                    │    │         │
│     │        EPISODE TEMPLATE ◄────── part of ──────────┤    │         │
│     │                                                   │    │         │
│     │                                                   │    │         │
│     └────────► SERIES ──────────────────────────────────┘    │         │
│                  │                                           │         │
│                  │ features characters                       │         │
│                  │ orders episodes                           │         │
│                  └───────────────────────────────────────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        RUNTIME LAYER (Per-User)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   USER                                                                  │
│     │                                                                   │
│     ├──────► ENGAGEMENT (per character)                                 │
│     │            │  total_sessions, total_messages                      │
│     │            │  first_met_at, is_favorite                          │
│     │            │                                                      │
│     │            └──► MEMORY (persists across all sessions)            │
│     │                                                                   │
│     └──────► SESSION (per episode template instance)                   │
│                  │  messages, scene_images                              │
│                  │  linked to engagement                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Genesis Stage: Production Model

During the Genesis Stage, all content is platform-produced. This section defines the production workflow and quality standards.

### 4.1 Production Ownership

| Entity | Created By | Tooling |
|--------|------------|---------|
| **Worlds** | Platform team | Studio UI + bulk scripts |
| **Series** | Platform team | Studio UI + bulk scripts |
| **Characters** | Platform team | Studio UI + bulk scripts |
| **Episode Templates** | Platform team | Studio UI + bulk scripts |

### 4.2 Quality Standards (All Content)

Every piece of content must pass:

- **Genre compliance** — Follows genre doctrine (see Genre docs)
- **Episode quality gates** — Instant clarity, tension, user implication, reply gravity
- **Visual consistency** — Avatar kit, background, opening line feel unified
- **Conversation testing** — System prompt produces expected behavior

### 4.3 Future Extensibility (Not Built Now)

The architecture supports future content sources, but these are **not implemented**:

| Future Source | What Users Could Create | Constraints |
|---------------|------------------------|-------------|
| User Characters | Characters + Episode Templates | Within platform-defined Worlds |
| Creator Marketplace | Full content packages | Verification + revenue share |

These will only be considered post-stabilization with real user feedback.

---

## 5. User Identity Model

This section defines **how users connect into episodes** — a fundamental architectural decision that affects content framing, memory scope, and future extensibility.

### 5.1 Genesis Stage Decision: "As Yourself"

**LOCKED FOR GENESIS STAGE**

Users connect to episodes **as themselves**, not as a predefined protagonist character.

| Attribute | Source | Notes |
|-----------|--------|-------|
| **Name** | `users.display_name` | Optional; character uses "you" if not set |
| **Pronouns** | `users.pronouns` | For natural character references |
| **Visual** | None | User is the "camera"/POV — no avatar |
| **Identity** | Implicit | User is themselves, transported into the scene |

### 5.2 How This Works

```
USER EXPERIENCE FLOW
════════════════════

1. User browses Series/Episodes
        │
        ▼
2. User selects an Episode
   "Coffee Shop Crush" featuring Mira
        │
        ▼
3. User ENTERS the episode AS THEMSELVES
   ┌─────────────────────────────────────────┐
   │ [Scene Card: The café is nearly empty.  │
   │  Rain streaks the window...]            │
   └─────────────────────────────────────────┘

   Mira: "You're here late. I was starting
         to think you weren't coming."
        │
        ▼
4. User responds AS THEMSELVES
   User: "Traffic was brutal. Got anything
         strong left?"
        │
        ▼
5. Character learns user's name through
   natural conversation → stored in Memory
```

### 5.3 Why "As Yourself"

| Reason | Explanation |
|--------|-------------|
| **Core fantasy alignment** | The product is being desired/noticed AS YOU |
| **Romantic tension works** | "She's interested in ME" not "She's interested in my avatar" |
| **Psychological thriller works** | "I am in danger" creates real stakes |
| **Memory model stays clean** | User↔Character scope, not Persona↔Character |
| **Simpler implementation** | No user avatar kits, no protagonist selection UI |
| **80-90% content coverage** | All Genesis Stage worlds support this model |

### 5.4 Counterpart POV (Default)

The character is the **counterpart** — they speak TO the user, react TO the user, are interested in the user.

```
Character speaks TO you:
  "You're here late. I was starting to think you weren't coming."

NOT narrating your actions:
  "You walk in and sit down at the counter."
```

Platform scene cards handle stage direction. Character stays in natural dialogue.

### 5.5 User Name Handling

**Option C (Selected): Natural Introduction**

- Character uses "you" by default
- User can introduce themselves naturally in conversation
- Character remembers via Memory system
- Feels organic, not form-filling

```
Mira: "You're here late..."
User: "Yeah, I'm Alex. Sorry about that."
Mira: "Alex. I'll remember that."

[Memory extracted: "User's name is Alex"]

Future sessions:
Mira: "Alex. Back again?"
```

### 5.6 World Compatibility

Genesis Stage worlds must be compatible with "as yourself" framing:

| World Type | Compatible? | Notes |
|------------|-------------|-------|
| Grounded (cafes, apartments, offices) | ✅ Yes | User could plausibly be there |
| Semi-grounded (corporate thriller) | ✅ Yes | User is "new employee", "asset", etc. |
| Fantasy (magic, sci-fi) | ⚠️ Depends | May need "isekai" framing |
| Fictional IP (SpongeBob, etc.) | ❌ No | Requires protagonist mode (not built) |

**Genesis Stage Rule:** Only build worlds where "as yourself" makes sense.

### 5.7 Future Consideration: Protagonist Mode

Some worlds may eventually require users to play AS a defined character. This is **not implemented** but the architecture should not preclude it.

**When Protagonist Mode Would Apply:**
- Fictional universes where "yourself" doesn't fit
- Established IP experiences (user IS the main character)
- Ensemble/adventure scenarios with defined roles

**What Protagonist Mode Would Require:**
```sql
-- FUTURE: World-level user mode setting
-- ALTER TABLE worlds ADD COLUMN user_mode VARCHAR(20) DEFAULT 'self';
-- Values: 'self' | 'protagonist'

-- FUTURE: If protagonist mode, which character the user plays as
-- ALTER TABLE worlds ADD COLUMN protagonist_character_id UUID REFERENCES characters(id);
```

**Implications if Built:**
- Episode templates would be written differently
- Scene generation would include user avatar (two characters in frame)
- Memory scope might change to Persona↔Character
- Significantly more complex — defer to post-Genesis

### 5.8 User Identity Summary

| Decision | Genesis Stage | Future Consideration |
|----------|---------------|---------------------|
| User connects as | Themselves | Could add Protagonist mode |
| User visual | None (POV camera) | Could add user avatar kit |
| User name | Natural introduction → Memory | Same |
| Memory scope | User↔Character | Could add Persona↔Character |
| World compatibility | "As yourself" only | Could add protagonist worlds |

---

## 6. Editorial Guidelines (Marvel-Style)

### 6.1 World Guidelines

> **A world is a promise to the user about what kind of experience awaits.**

| Guideline | Rationale |
|-----------|-----------|
| World genre sets expectations | Users browsing "Nexus Tower" expect thriller, not romance comedy |
| World tone is a default, not a lock | A thriller world can have tender moments |
| Worlds should feel distinct | No two worlds should blur together |
| Cross-world requires justification | "Why is this cafe barista in the spy tower?" |

### 6.2 Character Guidelines

> **Characters are containers for moments, not chatbots to befriend.**

| Guideline | Rationale |
|-----------|-----------|
| One archetype, many expressions | A "barista" can be warm, distant, or mysterious |
| Personality persists | Character should feel consistent across episodes |
| Memory creates connection | Reference past interactions naturally |
| Boundaries are sacred | Character limits are not user-circumventable |

### 6.3 Series Guidelines

> **Series are invitations, not requirements.**

| Guideline | Rationale |
|-----------|-----------|
| Entry episode = the hook | Must work standalone, must create pull |
| Serial series soft-sequence | "Start here" not "Must start here" |
| Series can be replayed | No permanent state changes (memory is external) |
| Cross-character series need chemistry | Don't force character pairings |

### 6.4 Episode Guidelines

> **Every episode must answer: Why now? Why me? Why reply?**

| Guideline | Rationale |
|-----------|-----------|
| Cold open, in medias res | No "Hi, I'm [name]" openings |
| Episode frame sets the stage | Platform narration, not character |
| Opening line has gravity | User should feel compelled to respond |
| Stakes must be present | Something to gain or lose |

---

## 7. Discovery Architecture

### 7.1 Browse Hierarchy

```
HOME
├── Featured (curated hero content)
├── Continue (active sessions)
├── For You (personalized recommendations)
│
├── Browse by World
│   └── [World] → Characters + Series
│
├── Browse by Mood/Genre
│   └── [Tag] → Filtered episodes
│
└── Character Detail
    └── [Character] → Their episodes across series
```

### 7.2 Discovery Signals

| Signal | Weight | Description |
|--------|--------|-------------|
| Genre match | High | User's preferred genres |
| Engagement depth | High | Characters user has history with |
| Recency | Medium | Fresh content boosted |
| World affinity | Medium | Worlds user has explored |
| Episode type | Low | Entry episodes surface more broadly |

---

## 8. World Bible Template

For Genesis Stage content production, each World requires a **World Bible** — a comprehensive document defining all content within that universe.

### 8.1 World Bible Structure

```
WORLD BIBLE: [World Name]
═══════════════════════════

1. WORLD IDENTITY
   ├── Genre: (romantic_tension | psychological_thriller | ...)
   ├── Tone: (intimate | tense | playful | paranoid | ...)
   ├── Core Promise: What experience does this world deliver?
   ├── Setting Details: Time, place, ambient context
   └── Visual Doctrine: Lighting, palette, framing rules

2. SERIES MANIFEST
   └── Series: [Title]
       ├── Series Type: (standalone | serial | anthology)
       ├── Episode Count: X planned
       ├── Premise: One-sentence hook
       └── Featured Characters: [list]

3. CHARACTER ROSTER
   └── Character: [Name]
       ├── Archetype: (barista | handler | researcher | ...)
       ├── Role in World: Primary / Supporting / Guest
       ├── Series Appearances: [which series]
       ├── Personality Summary: Core traits
       └── Relationships: To other characters in world (if any)

4. EPISODE TEMPLATES (Per Series)
   └── Episode [N]: [Title]
       ├── Episode Type: (entry | core | expansion | special)
       ├── Situation: Scene setup
       ├── Episode Frame: Platform stage direction
       ├── Opening Line: Character's first message
       ├── Emotional Stakes: What's at risk
       └── Ring Coverage: Which narrative rings this hits (1-4)

5. CROSS-REFERENCES
   ├── Characters that can guest from other worlds
   ├── Series crossover potential
   └── Shared lore/continuity notes
```

### 8.2 World Bible Examples

| World | Genre | Core Promise | Primary Series |
|-------|-------|--------------|----------------|
| Crescent Cafe | Romantic Tension | Late-night intimacy, charged encounters | "Coffee Shop Encounters" |
| Nexus Tower | Psychological Thriller | Corporate secrets, power dynamics | "The Handler Files" |
| Meridian Institute | Psychological Thriller | Research ethics, isolation, paranoia | "Subject Zero" |

### 8.3 Production Workflow

```
1. Create World Bible (this template)
        │
        ▼
2. Review with Genre Doctrine
   (Does it follow genre rules?)
        │
        ▼
3. Scaffold in Database
   (bulk scripts or Studio UI)
        │
        ▼
4. Generate Visual Assets
   (Avatar kits, backgrounds)
        │
        ▼
5. Test Conversations
   (System prompt validation)
        │
        ▼
6. Publish to Discovery
```

---

## 9. Schema Evolution

### 9.1 New Tables Required

```sql
-- SERIES: Narrative container grouping episodes
CREATE TABLE series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    world_id UUID REFERENCES worlds(id),
    series_type VARCHAR(20) DEFAULT 'standalone',  -- standalone, serial, anthology, crossover
    featured_characters JSONB DEFAULT '[]',         -- Array of character IDs
    episode_order JSONB DEFAULT '[]',               -- Ordered array of episode template IDs
    total_episodes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',             -- draft, active, completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add series reference to episode_templates
ALTER TABLE episode_templates ADD COLUMN series_id UUID REFERENCES series(id);

-- Add crossover flag to characters
ALTER TABLE characters ADD COLUMN can_crossover BOOLEAN DEFAULT FALSE;
```

### 9.2 Migration Path

**Phase 1: Schema Addition**
- Add `series` table
- Add `series_id` to episode_templates
- Add `can_crossover` to characters

**Phase 2: Existing Content Mapping**
- Group existing episodes into series
- E.g., "Coffee Shop Encounters" series for Crescent Cafe characters

**Phase 3: Studio UI Updates**
- Add series creation/management to Studio
- Update episode template creation to reference series

**Phase 4: Discovery Updates**
- Surface series in browse hierarchy
- Enable series-based navigation

---

## 10. Relationship to Existing Canon

### 10.1 Alignment with EP-01 Pivot

| EP-01 Decision | Content Architecture Support |
|----------------|------------------------------|
| Episode-first discovery | Series surface episodes as primary browse |
| Character as counterpart | Characters anchor episodes, not own them |
| Memory persists per character | Unchanged — cross-series memory |
| Episode frame for stage direction | Unchanged — platform narration |

### 10.2 Alignment with Genre Docs

| Genre Doc | Content Architecture Support |
|-----------|------------------------------|
| Quality gates (4 mandatory) | Applied to all platform content |
| Episode structure rules | Guidelines enforced via World Bible review |
| Visual doctrine | Consistent quality for Genesis Stage |

---

## 11. Future Considerations

### 11.1 Not In Scope (Genesis Stage)

- **User content creation** — Users creating characters/episodes (post-stabilization)
- **Creator marketplace** — Third-party content with revenue share (much later)
- **Branching narratives** — User choices affecting series progression
- **Multiplayer series** — Multiple users in same series instance
- **AI-assisted creation** — Studio tools that auto-generate content

### 11.2 Open Questions (For Post-Genesis)

1. **User creation scope**: If users create, what constraints apply?
2. **Memory isolation**: Should user-created content share memory with official?
3. **Cross-world permissions**: How to handle character guest appearances at scale?
4. **Series forking**: Can users create variants of official series?

---

## 12. Glossary

| Term | Definition | DB Entity |
|------|------------|-----------|
| **World** | Universe/setting where stories take place | `worlds` |
| **Series** | Narrative container grouping episodes into a coherent experience | `series` |
| **Character** | Persona/counterpart you experience stories WITH | `characters` |
| **Episode Template** | Pre-authored scenario — the atomic unit of experience | `episode_templates` |
| **Session** | Runtime conversation instance (user playing an episode) | `sessions` |
| **Engagement** | Lightweight user↔character stats link | `engagements` |
| **Memory** | Facts, preferences, events that persist across sessions | `memory_events` |
| **World Bible** | Production document defining all content within a world | (doc, not DB) |

See also: `docs/GLOSSARY.md` for complete terminology reference.

---

## 13. Summary

The Fantazy Content Architecture establishes:

1. **Flexible taxonomy**: World → Series → Episode Template → Character with optional relationships
2. **User Identity Model**: Users connect as themselves (Genesis Stage), protagonist mode deferred
3. **Marvel-style guidelines**: Rules that guide, not constrain
4. **Genesis Stage focus**: All content platform-produced, future extensibility designed but not built
5. **World Bible model**: Structured production planning for each universe
6. **Netflix + TikTok hybrid**: Series depth with moment-based discovery

**For runtime episode mechanics** (session lifecycle, progression, stakes, monetization), see `docs/EPISODE_DYNAMICS_CANON.md`.

> **The architecture's job is to make production structured and discovery delightful —**
> **while maintaining quality that keeps users coming back.**

---

## Related Documents

- `docs/GLOSSARY.md` — Canonical terminology reference
- `docs/EPISODE_DYNAMICS_CANON.md` — Episode mechanics, progression, session lifecycle, monetization
- `docs/EP-01_pivot_CANON.md` — Episode-first philosophy
- `docs/FANTAZY_CANON.md` — Platform definition
- `docs/EPISODES_CANON_PHILOSOPHY.md` — Episode design principles
- `docs/architecture/SYSTEM_ARCHITECTURE.md` — Technical architecture
- `docs/character-philosophy/Genre 01 — Romantic Tension.md`
- `docs/character-philosophy/Genre 02 — Psychological Thriller- Suspense.md`
- `docs/implementation/STUDIO_EPISODE_FIRST_REFACTOR.md` — Studio implementation plan
