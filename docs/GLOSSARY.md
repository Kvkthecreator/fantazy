# Fantazy Glossary

**Status:** CANONICAL

**Purpose:** Single source of truth for all platform terminology

**Last Updated:** 2024-12-17

---

## Content Layer (Static Entities)

| Term | Definition | DB Table | Notes |
|------|------------|----------|-------|
| **World** | Universe/setting where stories take place. Establishes genre, tone, and ambient context. | `worlds` | Characters inherit world's genre as default |
| **Series** | Narrative container grouping episodes into a coherent experience. Can be standalone, serial, anthology, or crossover. | `series` | Optional — episodes can exist without a series |
| **Character** | Persona/counterpart you experience stories WITH. Has personality, visual identity, and behavioral contract (system_prompt). | `characters` | Belongs to one primary world, can guest in others |
| **Episode Template** | Pre-authored scenario — the atomic unit of experience. Defines situation, opening line, and episode frame. | `episode_templates` | Every episode has ONE anchor character |
| **Avatar Kit** | Visual identity package for a character — prompts and anchor images for consistent generation. | `avatar_kits` | Contains appearance_prompt, style_prompt, primary_anchor |

---

## Runtime Layer (Per-User Entities)

| Term | Definition | DB Table | Notes |
|------|------------|----------|-------|
| **Session** | Runtime conversation instance — a user playing through an episode template. | `sessions` | Formerly called "episode" (runtime) |
| **Engagement** | Lightweight user↔character stats link. Tracks total_sessions, total_messages, first_met_at. | `engagements` | Formerly called "relationship" |
| **Memory** | Facts, preferences, events extracted from conversations that persist across sessions. | `memory_events` | Scoped to user↔character, cross-session |
| **Hook** | Future engagement trigger — topics to revisit, reminders, follow-ups. | `hooks` | Extracted async from conversations |
| **Message** | Individual chat exchange within a session. | `messages` | Role: user or assistant |
| **Scene Image** | Generated visual representing a moment in the conversation. | `scene_images` | Linked to session |

---

## Production Concepts

| Term | Definition | Notes |
|------|------------|-------|
| **World Bible** | Production document defining all content within a world — characters, series, episodes, relationships. | See template in CONTENT_ARCHITECTURE_CANON.md |
| **Genesis Stage** | Current platform phase where all content is platform-produced. No user/creator content. | Precedes any UGC features |
| **Episode Frame** | Platform stage direction shown before character's opening line. Sets the scene without character narrating. | Displayed as scene card in UI |
| **Opening Line** | Character's first message in an episode. Must have gravity — compel response. | Source of truth: episode_templates |

---

## Episode Taxonomy

| Term | Definition | Notes |
|------|------------|-------|
| **Entry Episode** | First experience with character/series (Episode 0). Browsable, recommended start. | Always accessible, the "hook" |
| **Core Episode** | Main narrative beats within a series. Sequenced. | Episodes 1-N |
| **Expansion Episode** | Deeper exploration, optional content. | Available after engagement |
| **Special Episode** | Events, crossovers, limited-time content. | Can be non-canon |

---

## Series Types

| Type | Definition | Example |
|------|------------|---------|
| **Standalone** | Self-contained story, any episode can be entry. | "Coffee Shop Encounters" |
| **Serial** | Sequential narrative, Episode 0 recommended first. | "The Safehouse Files" |
| **Anthology** | Themed collection, loosely connected episodes. | "Late Night Confessions" |
| **Crossover** | Multiple characters from different worlds. | "When Worlds Collide" |

---

## Genre Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Genre Doctrine** | Behavioral rules baked into character system_prompt at creation time. | See Genre docs |
| **Romantic Tension** | Genre 01: "The product is tension, not affection" | Desire, proximity, vulnerability |
| **Psychological Thriller** | Genre 02: "The product is uncertainty, not fear" | Suspense, paranoia, secrecy |

---

## Narrative Model

| Term | Definition | Notes |
|------|------------|-------|
| **Ring Model** | Four concentric narrative layers: Situation → Trigger → Escalation → Resolution | All episodes should hit Rings 1-3 minimum |
| **Cold Open** | Opening in medias res — already happening, no preamble | Mandatory for all episodes |
| **Reply Gravity** | The quality that makes silence feel like loss. Opening must compel response. | Quality gate for episodes |

---

## Discovery Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Featured** | Curated hero content on home page | Platform-selected |
| **Continue** | Active sessions the user can resume | Per-user |
| **For You** | Personalized recommendations | Based on engagement history |

---

## User Identity Model (Genesis Stage)

| Term | Definition | Notes |
|------|------------|-------|
| **As Yourself** | User connects to episodes as themselves, not as a predefined character. | Genesis Stage default. See CONTENT_ARCHITECTURE_CANON.md Section 5 |
| **Counterpart POV** | Character speaks TO the user, reacts TO the user. User is the implicit "you". | Default narrative POV for all content |
| **Natural Introduction** | User's name is learned through conversation and stored in Memory, not form-filling. | Feels organic; character uses "you" until name is shared |
| **POV Camera** | User has no visual avatar — they are the "camera" experiencing the scene. | No user avatar kit in Genesis Stage |
| **Protagonist Mode** | (Future) User plays AS a predefined character in fictional universes. | Not implemented in Genesis Stage |

---

## World Compatibility (Genesis Stage)

| World Type | User Mode | Notes |
|------------|-----------|-------|
| **Grounded** | As Yourself | Cafes, apartments, offices — user could plausibly be there |
| **Semi-grounded** | As Yourself | Corporate thriller — user is "new employee", "asset", etc. |
| **Fantasy** | As Yourself (isekai) | User transported into the world as themselves |
| **Fictional IP** | Protagonist Mode | Requires user to BE a character (SpongeBob, etc.) — deferred |

---

## Technical Terms

| Term | Definition | Notes |
|------|------------|-------|
| **System Prompt** | LLM behavioral contract for a character. Contains genre doctrine + persona. | Built at character creation time |
| **Kontext Mode** | Image generation using reference anchor for character consistency | Uses FLUX Kontext |
| **T2I Mode** | Text-to-image fallback when no anchor image exists | Uses appearance_prompt |

---

## Episode Dynamics

| Term | Definition | Notes |
|------|------------|-------|
| **Guided Improvisation** | Design philosophy where episodes are "stages with rails" — not scripts, not sandboxes. LLM interprets director's notes while responding authentically. | Core episode mechanics model |
| **Dramatic Question** | The narrative tension an episode explores. NOT a quest objective — a tension to inhabit. | Example: "Will she let you stay after closing?" |
| **Resolution Space** | Array of valid ending types for an episode: positive, neutral, negative, surprise. | LLM chooses based on conversation flow |
| **Beat Guidance** | Soft narrative waypoints in episode template — establishment, complication, escalation, pivot markers. | Director's notes for LLM |
| **Actor/Director Model** | Episode template = director's vision; LLM = actor's interpretation. | See EPISODE_DYNAMICS_CANON.md |

---

## Session States

| State | Definition | Notes |
|-------|------------|-------|
| **Active** | Currently in conversation | Chat interface open |
| **Paused** | User left mid-conversation | Can resume where left off |
| **Faded** | Natural conversation pause reached | Can extend or start new session |
| **Complete** | Dramatic question addressed | Resolution reached (any type) |

---

## Progression Model

| Term | Definition | Notes |
|------|------------|-------|
| **Memory as Progression** | Implicit progression via accumulated memories — no visible meters, just felt continuity. | Core progression philosophy |
| **Episode Fade** | Natural pause point in conversation. Character signals pause, user can continue or leave. | Not a hard "end" |
| **Episode Mastery** | Replaying episode to see multiple resolutions. | Replay value mechanic |
| **Series Progression** | For serial series, memories + episode summaries carry forward across episodes. | Context management at boundaries |

---

## Stakes & Engagement

| Term | Definition | Notes |
|------|------------|-------|
| **Character Autonomy** | Character can reject, leave, get upset — not servile, not hostile, but authentic. | Creates meaningful stakes |
| **Temporal Tension** | Episode implies urgency (café closing, meeting ending, etc.). | Soft pressure mechanism |
| **Consequence Persistence** | Bad outcomes remembered in future sessions. | "She's still upset from last time" |

---

## Monetization Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Spark Cost** | Resource spent to start an episode/session. Scarcity = value. | Core monetization |
| **Session Extension** | Paying to continue past natural fade. | "Just a little more" |
| **Premium Episode** | Episodes with higher spark cost. Exclusive feels special. | Tiered content |

---

## Deprecated Terms

| Old Term | Replaced By | Reason |
|----------|-------------|--------|
| Relationship | **Engagement** | "Relationship" implied emotional tracking; engagement is stats-focused |
| Episode (runtime) | **Session** | Disambiguate from Episode Template |
| Arc | **Series** | "Series" is more intuitive (Netflix mental model) |
| Stage | (removed) | Stage progression sunset in EP-01 pivot |
| Stage Progress | (removed) | Connection depth now implicit via memory |

---

## Related Documents

- `docs/CONTENT_ARCHITECTURE_CANON.md` — Content taxonomy and architecture
- `docs/EPISODE_DYNAMICS_CANON.md` — Episode mechanics, progression, monetization
- `docs/EP-01_pivot_CANON.md` — Episode-first philosophy
- `docs/FANTAZY_CANON.md` — Platform definition
- `docs/EPISODES_CANON_PHILOSOPHY.md` — Episode design principles
- `docs/architecture/SYSTEM_ARCHITECTURE.md` — Technical architecture
