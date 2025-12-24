# Director Protocol

> **Version**: 2.5.0
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

## Visual Trigger Strategy (v2.4 - Hybrid Model)

**Problem**: LLM-driven visual triggers (`"Would this benefit from a visual?"`) proved unreliable in production:
- Gemini 3 Flash evaluated every turn as `visual_type: "none"` despite clear visual moments
- Regex parsing fragile (exact `SIGNAL:` format required)
- Zero observability (couldn't see raw LLM responses)

**Solution**: **Hybrid Deterministic + Semantic Model**

### Visual Mode Resolution (v2.5 - Manual-First Strategy)

**UPDATED (2024-12-24)**: After quality assessment, switched to **manual-first philosophy**:
- **Default**: All episodes use `visual_mode='none'` (text-only, fast, no interruptions)
- **Opt-in**: Users can enable experimental auto-gen via Settings > Preferences toggle
- **Manual generation**: "Capture Moment" (1 Spark) remains the primary, proven path

**Rationale**:
- Auto-gen quality not yet consistent (abstract/confusing images vs clear manual portraits)
- Generation time (5-10 seconds) interrupts narrative flow
- Manual T2I provides reliable, high-quality results with user control
- Auto-gen improved prompts (dropped Shinkai environmental-only) available for opt-in users

```python
def resolve_visual_mode(episode, user_preferences):
    """Resolve visual_mode with user preference override.

    Manual-first model: Episodes default to 'none', users opt-in for experimental auto-gen.
    """
    episode_mode = episode.visual_mode  # Creator's intent (typically 'none')
    user_override = user_preferences.get("visual_mode_override")

    if user_override == "always_off":
        # User explicitly disabled (accessibility/performance/data-saving)
        return VisualMode.NONE
    elif user_override == "always_on":
        # User opted into experimental auto-gen
        if episode_mode == VisualMode.NONE:
            return VisualMode.MINIMAL  # Upgrade to minimal auto-gen
        elif episode_mode == VisualMode.MINIMAL:
            return VisualMode.CINEMATIC  # Upgrade to full auto-gen
        else:
            return episode_mode
    else:  # "episode_default" or null
        # Default: Respect episode setting (typically 'none' for manual-first)
        return episode_mode
```

**Benefits**:
- ✅ Fast, uninterrupted narrative by default
- ✅ Manual generation (1 Spark) provides proven quality when users want images
- ✅ Experimental auto-gen available for users who opt-in via settings
- ✅ No degraded experience from inconsistent auto-gen quality

### When to Generate (Deterministic)

Visual generation triggers are **turn-based**, not LLM-driven:

```python
def should_generate_visual(turn_count, turn_budget, visual_mode, generations_used, generation_budget):
    """Pure function - predictable, testable, no LLM calls.

    NOTE: visual_mode should be the RESOLVED mode (after user preference override).
    """

    if generations_used >= generation_budget:
        return False, "budget_exhausted"

    if visual_mode == "cinematic":
        # Generate at narrative beats: 25%, 50%, 75% of episode
        position = turn_count / turn_budget if turn_budget else turn_count / 10

        # Budget of 3: trigger at 25%, 50%, 75%
        if generation_budget == 3:
            triggers = [0.25, 0.5, 0.75]
            for i, trigger_pos in enumerate(triggers):
                if i == generations_used and position >= trigger_pos:
                    return True, f"turn_position_{trigger_pos}"

    elif visual_mode == "minimal":
        # Only at climax (90%+ of episode)
        position = turn_count / turn_budget if turn_budget else 0
        if position >= 0.9:
            return True, "climax_reached"

    return False, "no_trigger_point"
```

**Benefits**:
- ✅ Predictable (e.g., 12-turn episode with budget 3 → images at turns 3, 6, 9)
- ✅ Testable (no LLM variability)
- ✅ Observable (exact reason for each decision)
- ✅ Model-agnostic (works regardless of LLM backend)

### What to Show (Semantic)

LLM generates **description only**, no structured parsing:

```python
# BEFORE (v2.3): Ask LLM to decide AND describe
prompt = """Would this exchange benefit from a visual?
- CHARACTER: shot featuring character
- OBJECT: close-up of item
- ATMOSPHERE: setting/mood
- NONE: no visual

Answer with: SIGNAL: [visual: X] [status: Y] [hint: description]"""

# AFTER (v2.4): Just describe the moment
prompt = f"""Describe this {genre} story moment in one evocative sentence for a cinematic insert shot.
Focus on: mood, lighting, composition, symbolic objects.
Style: anime environmental storytelling (Makoto Shinkai, Cowboy Bebop).

Recent exchange:
{messages}

One sentence only:"""

# No regex parsing - use raw text as visual_hint!
```

**Benefits**:
- ✅ No parse failures (plain text, no format requirements)
- ✅ Clearer LLM task ("describe" vs "judge + decide + describe")
- ✅ Better descriptions (LLM focused on quality, not structure)

### Observability (v2.4)

Director now logs full evaluation context:

```json
{
  "director_state": {
    "last_evaluation": {
      "turn": 5,
      "status": "going",
      "visual_type": "character",
      "visual_hint": "rain streaking down café window, warm amber light from inside...",
      "raw_response": "full LLM response here",  // NEW
      "parse_method": "hybrid_deterministic"     // NEW
    },
    "visual_decisions": [  // NEW: Decision history
      {
        "turn": 3,
        "triggered": true,
        "reason": "turn_position_0.25",
        "description": "close-up of hands exchanging note..."
      },
      {
        "turn": 4,
        "triggered": false,
        "reason": "budget_remaining_2_of_3"
      }
    ]
  }
}
```

**Why This Matters**:
- Can debug visual failures (see exact LLM output)
- Can analyze trigger patterns (why images appear when they do)
- Can tune thresholds (adjust turn positions based on data)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.4.0 | 2024-12-24 | **Hybrid Visual Triggers**: Replace LLM-driven visual decisions with deterministic turn-based triggers. Add observability (raw_response, visual_decisions history). Simplify LLM to description-only (no SIGNAL parsing). |
| 2.3.0 | 2024-12-24 | **Memory & Hook Extraction Ownership**: Director orchestrates post-exchange processing (memory/hook extraction, beat classification). Series-scoped memory isolation. |
| 2.2.0 | 2024-12-23 | **Theatrical Model**: Remove per-turn motivation generation. Director becomes deterministic stage manager. Motivation moves upstream to Episode/Genre. |
| 2.1.0 | 2024-12-23 | Motivation-driven direction: objective/obstacle/tactic via LLM |
| 2.0.0 | 2024-12-20 | Added pre-response guidance phase, pacing algorithm |
| 1.0.0 | 2024-12-20 | Initial protocol (post-evaluation only) |

---

## Related Documents

- `docs/EPISODE-0_CANON.md` - Platform canon with theatrical model
- `docs/decisions/ADR-002-theatrical-architecture.md` - Architecture decision record
- `docs/quality/core/GENRE_DOCTRINES.md` - Genre convention definitions
