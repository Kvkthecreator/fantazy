# Director Architecture

> **Status**: Active (v2 - Semantic Rewrite)
> **Created**: 2024-12-19
> **Updated**: 2024-12-19
> **Purpose**: Define the Director as a semantic runtime engine that drives episode experience through natural language understanding and deterministic actions.

---

## Overview

The **Director** is a hidden system entity that observes conversations and drives the episode experience. Unlike video game directors that rely on state machines and explicit triggers, our Director leverages the LLM's semantic understanding to evaluate conversations naturally, then executes deterministic actions based on those observations.

### Core Principle: Semantic Evaluation → Deterministic Actions

```
┌─────────────────────────────────────────────────────────────────┐
│                        DIRECTOR                                  │
├─────────────────────────────────────────────────────────────────┤
│  SEMANTIC EVALUATION          │  DETERMINISTIC ACTIONS          │
│  (LLM understands meaning)    │  (Code executes behavior)       │
│                               │                                  │
│  "Was this visually           │  generate_scene: true/false     │
│   evocative?"                 │  scene_hint: string             │
│                               │                                  │
│  "Is this episode ready       │  suggest_next: true/false       │
│   to close?"                  │  deduct_sparks: int             │
│                               │                                  │
│  Natural language answers     │  Explicit system triggers        │
│  Genre-appropriate reasoning  │  Monetization, state changes     │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Approach?

**Video game directors** (L4D, Hades) need explicit state machines because games don't understand meaning. They track discrete signals: `player_health < 30% → spawn_medkit`.

**Our LLM-based Director** already understands what's happening. When a character says "I haven't slept in 36 hours and I just lost a patient," the LLM knows this is vulnerability, a potential connection moment, that the user's response matters. We don't need to tag this as `beat: "vulnerability_reveal"` — the meaning is in the text.

**Previous approach (deprecated)**: Pre-defined completion modes (`beat_gated`, `objective`), structured beat tracking, typed evaluation schemas. This created sophisticated metadata the system couldn't actually use.

**New approach**: Ask the LLM simple questions in natural language. Parse minimal signals from the response. Execute deterministic actions.

---

## Director Capabilities

| Capability | How It Works | Trigger |
|------------|--------------|---------|
| **Scene Generation** | LLM identifies visual moments → Director triggers image generation | Semantic ("worth capturing") or rhythmic (every N turns) |
| **Episode Progression** | LLM senses closure → Director suggests next episode | Semantic ("ready to close") or hard cap (turn budget) |
| **Turn Counting** | Increment after each exchange | Every exchange |
| **Memory Extraction** | LLM identifies what mattered → Director saves to memory | Semantic ("significance") |
| **Spark Deduction** | Attached to actions (scene generation, etc.) | Action execution |

---

## The Dual-LLM Architecture

Two LLM roles, one conversation:

| Role | Purpose | Visibility |
|------|---------|------------|
| **Character LLM** | Generate in-character response (dialogue, emotion) | User sees output |
| **Director LLM** | Observe exchange, evaluate semantically | Hidden from user |

The Character acts. The Director watches and decides what happens next.

```
User message
    ↓
ConversationService.send_message_stream()
    ↓
Build ConversationContext
    ↓
Character LLM → Generate response (streamed to user)
    ↓
Director LLM → Evaluate exchange (post-processing)
    ↓
Execute actions (scene, progression, memory, sparks)
    ↓
Return director signals to frontend
```

---

## Semantic Evaluation

The Director asks simple, natural questions. The LLM answers in genre-appropriate language.

### Visual Type Taxonomy

Not all visuals are character portraits. The Director classifies the visual type to route to the correct rendering pipeline:

| Visual Type | Description | Rendering | Cost |
|-------------|-------------|-----------|------|
| `character` | Character in a moment (portrait + setting) | Image gen with Kontext/T2I | Sparks |
| `object` | Close-up of item (letter, phone, key) | Image gen, no character | Sparks |
| `atmosphere` | Setting/mood without character | Background image gen | Sparks |
| `instruction` | Game-like info (codes, hints, choices) | Styled text card | Free |
| `none` | No visual needed | Nothing | Free |

**Examples by genre:**

| Genre | Moment | Visual Type | Hint |
|-------|--------|-------------|------|
| Romance | She smiled and looked away | `character` | Maya turning away, smile visible in reflection |
| Romance | The letter sat unopened between them | `object` | Unopened letter on café table, morning light |
| Mystery | User notices alibi inconsistency | `none` | — |
| Mystery | Clue discovered | `object` | Close-up of train ticket with wrong date |
| Thriller | Threatening text received | `object` | Phone screen showing "I know where you are" |
| Medical | Maya gives you a task | `instruction` | Supply Room - Code: 4721 |

### The Prompt

```python
async def evaluate_exchange(
    self,
    messages: list[dict],
    character_name: str,
    genre: str,
    situation: str,
    dramatic_question: str,
) -> dict:
    prompt = f"""You are the Director observing a {genre} story.

Character: {character_name}
Situation: {situation}
Core tension: {dramatic_question}

RECENT EXCHANGE:
{format_messages(messages[-6:])}

As a director, observe this moment. Answer naturally, then provide signals.

1. VISUAL: Would this exchange benefit from a visual element?
   - CHARACTER: A shot featuring the character (portrait, expression, pose)
   - OBJECT: Close-up of an item (letter, phone, key, evidence)
   - ATMOSPHERE: Setting/mood without character visible
   - INSTRUCTION: Game-like information (codes, hints, choices)
   - NONE: No visual needed

   If not NONE, describe what should be shown in one evocative sentence.

2. STATUS: Is this episode ready to close, approaching closure, or still unfolding?
   Explain briefly in terms that make sense for this {genre} story.

End with a signal line for parsing:
SIGNAL: [visual: character/object/atmosphere/instruction/none] [status: going/closing/done]
If visual is not "none", add: [hint: <description>]"""

    response = await self.llm.generate(prompt)
    return self._parse_evaluation(response.content)
```

### Genre-Appropriate Responses

The LLM naturally adapts to genre and selects appropriate visual type:

**Romance - character moment:**
```
Maya turned away but you could see her smiling in the reflection. She's stopped
pretending this is professional, though she hasn't said it out loud yet.

SIGNAL: [visual: character] [status: closing] [hint: Maya turning away, smile visible in window reflection]
```

**Romance - object tension:**
```
The letter sits on the table between them. Neither wants to acknowledge what's
inside, but it's all either of them can think about.

SIGNAL: [visual: object] [status: going] [hint: unopened letter on café table, two coffee cups nearby, morning light]
```

**Mystery - no visual:**
```
The alibi inconsistency is noted but not confronted. The user is circling but
hasn't committed to an accusation. The tension needs to build further.

SIGNAL: [visual: none] [status: going]
```

**Thriller - object tension:**
```
The phone buzzes face-down on the table. Both of them know who it is. The threat
is no longer abstract — it's here, and the next move matters.

SIGNAL: [visual: object] [status: done] [hint: phone screen glowing with blocked number, threatening message visible]
```

**Medical drama - instruction:**
```
Maya needs backup now. The crash cart is in the supply room at the end of the
hall. She shouts the code over her shoulder as she runs.

SIGNAL: [visual: instruction] [status: going] [hint: Supply Room - End of Hall - Code: 4721]
```

### Parsing the Response

Extract visual type, hint, and status:

```python
def _parse_evaluation(self, response: str) -> dict:
    """Parse natural language evaluation into actionable signals."""
    import re

    # Extract signal line with visual type
    signal_match = re.search(
        r'SIGNAL:\s*\[visual:\s*(character|object|atmosphere|instruction|none)\]\s*\[status:\s*(going|closing|done)\]',
        response, re.IGNORECASE
    )

    # Extract hint if present
    hint_match = re.search(r'\[hint:\s*([^\]]+)\]', response, re.IGNORECASE)

    if signal_match:
        visual_type = signal_match.group(1).lower()  # character/object/atmosphere/instruction/none
        status_signal = signal_match.group(2).lower()
        visual_hint = hint_match.group(1).strip() if hint_match else None
    else:
        # Fallback parsing
        visual_type = 'none'
        status_signal = 'done' if 'done' in response.lower() else 'going'
        visual_hint = None

    return {
        "raw_response": response,
        "visual_type": visual_type,      # "character", "object", "atmosphere", "instruction", "none"
        "visual_hint": visual_hint,       # Description of what to show
        "status": status_signal,          # "going", "closing", "done"
    }
```

---

## Deterministic Actions

Actions are explicit, predictable, and driven by episode settings + evaluation signals.

### DirectorActions

```python
@dataclass
class DirectorActions:
    """Deterministic outputs for system behavior."""

    # Visual generation
    visual_type: str = "none"           # character/object/atmosphere/instruction/none
    visual_hint: Optional[str] = None   # What to show

    # Episode progression
    suggest_next: bool = False

    # Monetization
    deduct_sparks: int = 0

    # Memory
    save_memory: bool = False
    memory_content: Optional[str] = None

    # Flags
    needs_sparks: bool = False  # User doesn't have enough
```

### Action Decision Logic

```python
def decide_actions(
    evaluation: dict,
    episode: EpisodeSettings,
    session: Session,
) -> DirectorActions:
    """Convert semantic evaluation into deterministic actions."""

    actions = DirectorActions()
    turn = session.turn_count
    visual_type = evaluation.get("visual_type", "none")

    # --- Visual Generation ---
    if episode.auto_scene_mode == "peaks":
        # Generate on visual moments (any type except none)
        if visual_type != "none":
            actions.visual_type = visual_type
            actions.visual_hint = evaluation.get("visual_hint")
            # Only charge sparks for image generation (not instruction cards)
            if visual_type in ("character", "object", "atmosphere"):
                actions.deduct_sparks = episode.spark_cost_per_scene

    elif episode.auto_scene_mode == "rhythmic":
        # Generate every N turns
        if turn > 0 and turn % episode.scene_interval == 0:
            # Use detected type, or default to character
            actions.visual_type = visual_type if visual_type != "none" else "character"
            actions.visual_hint = evaluation.get("visual_hint") or "the current moment"
            if actions.visual_type in ("character", "object", "atmosphere"):
                actions.deduct_sparks = episode.spark_cost_per_scene

    # --- Episode Progression ---
    status = evaluation.get("status", "going")

    if status == "done":
        actions.suggest_next = True
    elif episode.turn_budget and turn >= episode.turn_budget:
        # Hard cap reached
        actions.suggest_next = True

    # --- Memory ---
    if status in ("closing", "done"):
        # Save something meaningful as episode winds down
        actions.save_memory = True
        actions.memory_content = evaluation.get("raw_response", "")[:500]

    return actions
```

### Action Execution

```python
async def execute_actions(
    self,
    actions: DirectorActions,
    session: Session,
    user: User,
) -> DirectorActions:
    """Execute actions, handling constraints like spark balance."""

    # Check spark balance for scene generation
    if actions.generate_scene and actions.deduct_sparks > 0:
        if user.sparks >= actions.deduct_sparks:
            await self.deduct_sparks(user.id, actions.deduct_sparks)
            await self.queue_scene_generation(session, actions.scene_hint)
        else:
            # Can't afford — signal to frontend
            actions.generate_scene = False
            actions.needs_sparks = True
            actions.deduct_sparks = 0

    # Save memory
    if actions.save_memory and actions.memory_content:
        await self.memory_service.save(
            session_id=session.id,
            content=actions.memory_content,
            memory_type="episode_moment",
        )

    # Prep next episode suggestion
    if actions.suggest_next:
        await self.prep_episode_transition(session)

    return actions
```

---

## Episode Settings

Episode templates become simpler — behavior-focused rather than logic-heavy.

### Simplified Schema

```python
@dataclass
class EpisodeSettings:
    """Episode configuration for Director behavior."""

    # --- Context (for LLM evaluation) ---
    situation: str              # "ER at 2 AM, you're lost looking for someone"
    dramatic_question: str      # "Can connection happen under pressure?"
    genre: str                  # "medical_romance", "mystery", "thriller"

    # --- Completion ---
    turn_budget: Optional[int]  # Hard cap, or None for open-ended

    # --- Visual Rhythm ---
    auto_scene_mode: str        # "off", "peaks", "rhythmic"
    scene_interval: Optional[int]  # For rhythmic mode (every N turns)
    spark_cost_per_scene: int   # Monetization per auto-generated scene

    # --- Progression ---
    next_episode_id: Optional[UUID]  # What comes after
    series_finale: bool         # Different handling for series end
```

### Database Schema

```sql
-- Episode templates (simplified)
ALTER TABLE episode_templates
    DROP COLUMN IF EXISTS completion_mode,
    DROP COLUMN IF EXISTS completion_criteria,
    DROP COLUMN IF EXISTS beat_guidance;

ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS
    genre TEXT DEFAULT 'romance',
    auto_scene_mode TEXT DEFAULT 'off',  -- 'off', 'peaks', 'rhythmic'
    scene_interval INT DEFAULT NULL,
    spark_cost_per_scene INT DEFAULT 5,
    series_finale BOOLEAN DEFAULT FALSE;

-- Keep these existing columns:
-- situation TEXT
-- dramatic_question TEXT
-- turn_budget INT
-- next_episode_id UUID (via series linkage)
```

### auto_scene_mode Options

| Mode | Behavior | Use Case |
|------|----------|----------|
| `off` | No auto-generation; user clicks button | Default, manual control |
| `peaks` | Generate when Director detects visual moment | Emotional highs, key reveals |
| `rhythmic` | Generate every N turns (+ peaks) | Comic-book feel, consistent visuals |

---

## Session State

### Session Model

```python
@dataclass
class Session:
    # ... existing fields ...

    # Director state
    turn_count: int = 0
    director_state: dict = field(default_factory=dict)

    # Completion
    session_state: str = "active"  # active, complete
    completion_trigger: Optional[str] = None  # "semantic", "turn_limit"
```

### director_state Contents

Minimal — just what's needed for continuity:

```python
director_state = {
    "last_evaluation": {
        "status": "closing",
        "visual_type": "character",
        "visual_hint": "She turned away to hide her smile",
    },
    "visuals_generated": 3,
    "sparks_spent": 15,
}
```

No beat tracking. No signal accumulation. The LLM re-evaluates fresh each exchange.

---

## Frontend Integration

### Stream Events

```python
# After character response completes
yield {
    "type": "director",
    "turn_count": session.turn_count,
    "evaluation": {
        "status": evaluation["status"],
        "visual_type": evaluation.get("visual_type", "none"),
        "visual_hint": evaluation.get("visual_hint"),
    },
    "actions": {
        "visual_type": actions.visual_type,      # character/object/atmosphere/instruction/none
        "visual_hint": actions.visual_hint,
        "suggesting_next": actions.suggest_next,
        "sparks_deducted": actions.deduct_sparks,
        "needs_sparks": actions.needs_sparks,
    },
}

# If generating a visual (async for images, immediate for instruction)
if actions.visual_type == "instruction":
    # Instruction cards render immediately (no image gen)
    yield {
        "type": "instruction_card",
        "content": actions.visual_hint,
    }
elif actions.visual_type in ("character", "object", "atmosphere"):
    # Image-based visuals start async generation
    yield {
        "type": "visual_pending",
        "visual_type": actions.visual_type,
        "hint": actions.visual_hint,
        "sparks_deducted": actions.deduct_sparks,
    }
    # Kick off async generation, emit visual_ready when done

# If episode complete
if actions.suggest_next:
    yield {
        "type": "episode_complete",
        "turn_count": session.turn_count,
        "trigger": "semantic" if evaluation["status"] == "done" else "turn_limit",
        "next_suggestion": await self.get_next_episode(session),
    }
```

### TypeScript Types

```typescript
type VisualType = "character" | "object" | "atmosphere" | "instruction" | "none";

interface StreamDirectorEvent {
  type: "director";
  turn_count: number;

  evaluation: {
    status: "going" | "closing" | "done";
    visual_type: VisualType;
    visual_hint: string | null;
  };

  actions: {
    visual_type: VisualType;
    visual_hint?: string;
    suggesting_next: boolean;
    sparks_deducted: number;
    needs_sparks: boolean;
  };
}

// Image-based visual starting generation
interface StreamVisualPendingEvent {
  type: "visual_pending";
  visual_type: "character" | "object" | "atmosphere";
  hint: string;
  sparks_deducted: number;
}

// Image-based visual ready
interface StreamVisualReadyEvent {
  type: "visual_ready";
  visual_type: "character" | "object" | "atmosphere";
  image_url: string;
  caption?: string;
}

// Instruction card (immediate, no image gen)
interface StreamInstructionCardEvent {
  type: "instruction_card";
  content: string;  // "Supply Room - Code: 4721"
}

interface StreamEpisodeCompleteEvent {
  type: "episode_complete";
  turn_count: number;
  trigger: "semantic" | "turn_limit";
  next_suggestion: EpisodeSuggestion | null;
}

interface StreamNeedsSparksEvent {
  type: "needs_sparks";
  balance: number;
  cost: number;
}
```

### UI Components by Visual Type

| Visual Type | Component | Rendering |
|-------------|-----------|-----------|
| `character` | `<SceneCard>` | Image with character (Kontext/T2I) |
| `object` | `<ObjectCard>` | Close-up image, no character |
| `atmosphere` | `<AtmosphereCard>` | Background/setting image |
| `instruction` | `<InstructionCard>` | Styled text card (no image) |
| `none` | — | Nothing rendered |

### UI Responses to Actions

| Action | UI Behavior |
|--------|-------------|
| `visual_type: "character"` | Show skeleton → render SceneCard when ready |
| `visual_type: "object"` | Show skeleton → render ObjectCard when ready |
| `visual_type: "instruction"` | Immediately render InstructionCard (free, no async) |
| `suggesting_next: true` | Show InlineSuggestionCard with next episode |
| `needs_sparks: true` | Show spark purchase prompt |
| `status: "closing"` | Optional: subtle visual cue that episode is winding down |

---

## Monetization Integration

Scene generation is the primary spark sink:

```python
# Episode settings drive cost
episode.auto_scene_mode = "peaks"
episode.spark_cost_per_scene = 5  # 5 sparks per auto-generated scene

# User-initiated scenes (button click) can have different cost
MANUAL_SCENE_COST = 3

# Premium episodes might have higher visual density
premium_episode.auto_scene_mode = "rhythmic"
premium_episode.scene_interval = 3  # Scene every 3 turns
premium_episode.spark_cost_per_scene = 5  # 5 sparks × ~4 scenes = 20 sparks/episode
```

### Spark Flow

```
Episode starts
    ↓
Turn 1: Director evaluates → no visual moment → no sparks
    ↓
Turn 2: Director evaluates → visual moment detected
    ↓
Check user sparks >= 5?
    ├── Yes → Deduct 5, generate scene, show in chat
    └── No → Set needs_sparks=true, prompt purchase
    ↓
Turn 3-N: Continue...
    ↓
Episode complete → Suggest next episode
```

---

## Comparison: Old vs New

| Aspect | Old Approach | New Approach |
|--------|--------------|--------------|
| **Completion detection** | `completion_mode` enum, beat tracking | Semantic "status: done" signal |
| **Beat tracking** | `beats_completed[]`, `current_beat` | None — LLM evaluates fresh |
| **Evaluation schema** | Typed (`flirt_archetype`, `mystery_progress`) | Freeform natural language |
| **Scene triggers** | Manual button only | Auto on peaks or rhythm |
| **Episode metadata** | Heavy (`beat_guidance`, `completion_criteria`) | Light (`genre`, `dramatic_question`) |
| **Flexibility** | Genre-specific logic required | Genre-agnostic, LLM adapts |

---

## Implementation Phases

### Phase 1: Semantic Evaluation Core
1. Refactor `DirectorService.process_exchange()` to use semantic evaluation prompt
2. Implement `_parse_evaluation()` with SIGNAL line parsing
3. Implement `decide_actions()` logic
4. Update stream events to include director signals
5. Add `auto_scene_mode`, `scene_interval`, `spark_cost_per_scene` to episode_templates

### Phase 2: Scene Generation Integration
6. Wire auto-scene generation to existing scene service
7. Implement spark checking/deduction in `execute_actions()`
8. Frontend: Handle `generating_scene` and `needs_sparks` actions
9. Add SceneCardSkeleton for loading state

### Phase 3: Cleanup
10. Remove unused columns: `completion_mode`, `completion_criteria`, `beat_guidance`
11. Simplify `director_state` schema
12. Update existing episodes to use new settings

---

## Key Design Decisions

### Why no beat tracking?

Beats were a video game concept ported to LLMs. The LLM doesn't need us to tell it "you're in the escalation phase" — it can feel when tension is rising. Beat tracking created metadata we couldn't use (no code to detect beats) and rigid structures that didn't match genre diversity.

### Why freeform evaluation?

Pre-defining `connection_level: "genuine"` or `tension: 0.7` forces the LLM into our mental model. Different genres have different "what matters" — romance cares about vulnerability moments, mystery cares about clue revelation, thriller cares about threat escalation. Natural language lets the LLM express genre-appropriate observations.

### Why structured actions?

User-facing behavior must be predictable. "Generate a scene" is a yes/no with clear cost. "Suggest next episode" triggers specific UI. Monetization requires explicit spark deduction. The semantic layer interprets; the action layer executes.

### Why SIGNAL line?

Balance between rich evaluation (for debugging, potential features) and reliable parsing. The LLM writes naturally, then summarizes into parseable format. Fallback parsing handles cases where SIGNAL line is malformed.

---

## References

- [EPISODE_DYNAMICS_CANON.md](EPISODE_DYNAMICS_CANON.md) — Episode philosophy
- [conversation.py](../substrate-api/api/src/app/services/conversation.py) — Conversation service
- [director.py](../substrate-api/api/src/app/services/director.py) — Current Director implementation
