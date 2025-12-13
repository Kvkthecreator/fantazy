# Phase 4: Narrative Foundation (Beat-Aware Relationships)

> **Status**: Implementation
> **Approach**: Minimal, unified system combining beats + dynamic state
> **Risk Level**: Low (no new LLM calls, ~2% token increase)

---

## Executive Summary

Replace the blunt stage-based relationship system with a dynamic, beat-aware approach that enables:
- **Pacing awareness** - AI knows recent conversation flow
- **Tension tracking** - Single meter for emotional energy
- **Milestone flags** - Significant moments remembered
- **Future flexibility** - Foundation for episode arcs if needed

**Key principle**: Maximum addictiveness through narrative intelligence, not complexity.

---

## What We're Changing

### Removing (Blunt Counter System)

```python
# OLD - meaningless progression
stage: "acquaintance" | "friendly" | "close" | "intimate"
stage_progress: 17  # Just a counter
```

### Adding (Dynamic Beat-Aware System)

```python
# NEW - actual narrative intelligence
dynamic: {
    "tone": "playful",           # Current vibe
    "tension_level": 35,         # 0-100, emotional energy
    "recent_beats": ["playful", "flirty", "tense", "comfort", "playful"]
}
milestones: ["first_secret_shared", "flirted_back"]
```

---

## Implementation Details

### 1. Database Migration

**File**: `supabase/migrations/015_relationship_dynamics.sql`

```sql
-- Add dynamic relationship tracking
ALTER TABLE relationships ADD COLUMN dynamic JSONB DEFAULT '{
    "tone": "warm",
    "tension_level": 30,
    "recent_beats": []
}';

ALTER TABLE relationships ADD COLUMN milestones TEXT[] DEFAULT '{}';

-- Keep old columns for now (can drop later after validation)
-- stage and stage_progress remain but are deprecated
```

### 2. Memory Extraction Enhancement

**File**: `services/memory.py`

Add beat classification to existing extraction (no new LLM call):

```python
MEMORY_EXTRACTION_PROMPT = """
... existing prompt ...

Additionally, classify this exchange:

beat_classification:
  type: playful | flirty | tense | vulnerable | supportive | conflict | comfort | neutral
  tension_change: integer from -15 to +15 (negative = tension decreased, positive = increased)
  milestone: null OR one of:
    - "first_secret_shared" (character revealed something personal)
    - "user_opened_up" (user shared something vulnerable)
    - "first_flirt" (first explicitly flirty exchange)
    - "had_disagreement" (conflict or tension moment)
    - "comfort_moment" (meaningful emotional support)
    - "inside_joke_created" (shared humor reference established)
"""
```

### 3. Context Building Refactor

**File**: `models/message.py`

Replace `STAGE_GUIDELINES` with dynamic context:

```python
def _format_relationship_dynamic(self) -> str:
    """Format dynamic relationship context for LLM."""
    if not self.relationship_dynamic:
        return "This is a new connection. Be warm and curious."

    tone = self.relationship_dynamic.get("tone", "warm")
    tension = self.relationship_dynamic.get("tension_level", 30)
    recent_beats = self.relationship_dynamic.get("recent_beats", [])[-5:]

    # Tension interpretation
    if tension < 20:
        tension_desc = "relaxed, comfortable"
    elif tension < 40:
        tension_desc = "light, easy-going"
    elif tension < 60:
        tension_desc = "some unresolved energy"
    elif tension < 80:
        tension_desc = "heightened, something brewing"
    else:
        tension_desc = "intense, needs resolution"

    # Beat flow analysis
    beat_flow = " → ".join(recent_beats) if recent_beats else "just starting"

    # Pacing suggestion based on recent beats
    pacing_hint = self._get_pacing_hint(recent_beats, tension)

    return f"""RELATIONSHIP DYNAMIC:
Current tone: {tone}
Tension: {tension}/100 ({tension_desc})
Recent flow: {beat_flow}
{pacing_hint}"""

def _get_pacing_hint(self, recent_beats: list, tension: int) -> str:
    """Generate pacing suggestion based on beat history."""
    if not recent_beats:
        return "Start naturally - get to know each other."

    last_beat = recent_beats[-1]
    beat_counts = {}
    for b in recent_beats:
        beat_counts[b] = beat_counts.get(b, 0) + 1

    hints = []

    # Avoid repetition
    if beat_counts.get(last_beat, 0) >= 2:
        hints.append(f"You've had multiple {last_beat} moments - consider shifting energy")

    # Tension-based suggestions
    if tension > 60 and last_beat not in ["comfort", "supportive"]:
        hints.append("Tension is high - might be time for resolution or escalation")
    elif tension < 20 and "tense" not in recent_beats[-3:]:
        hints.append("Things are very comfortable - some playful tension could add spark")

    # After vulnerability
    if last_beat == "vulnerable":
        hints.append("They just opened up - acknowledge it meaningfully")

    # After conflict
    if last_beat in ["conflict", "tense"]:
        hints.append("There's tension - address it, don't ignore it")

    if hints:
        return "PACING:\n" + "\n".join(f"- {h}" for h in hints)
    return ""
```

### 4. Relationship Update Flow

After each exchange:

```python
async def update_relationship_dynamic(
    self,
    relationship_id: UUID,
    beat_type: str,
    tension_change: int,
    milestone: Optional[str]
):
    """Update relationship with beat classification results."""

    # Get current dynamic
    row = await self.db.fetch_one(
        "SELECT dynamic, milestones FROM relationships WHERE id = :id",
        {"id": str(relationship_id)}
    )

    dynamic = row["dynamic"] or {"tone": "warm", "tension_level": 30, "recent_beats": []}
    milestones = row["milestones"] or []

    # Update recent beats (keep last 10)
    recent_beats = dynamic.get("recent_beats", [])
    recent_beats.append(beat_type)
    recent_beats = recent_beats[-10:]

    # Update tension (clamp 0-100)
    tension = dynamic.get("tension_level", 30) + tension_change
    tension = max(0, min(100, tension))

    # Derive tone from recent beats
    tone = self._derive_tone(recent_beats, tension)

    # Add milestone if new
    if milestone and milestone not in milestones:
        milestones.append(milestone)

    # Save
    new_dynamic = {
        "tone": tone,
        "tension_level": tension,
        "recent_beats": recent_beats
    }

    await self.db.execute(
        """UPDATE relationships
           SET dynamic = :dynamic, milestones = :milestones, updated_at = NOW()
           WHERE id = :id""",
        {"id": str(relationship_id), "dynamic": json.dumps(new_dynamic), "milestones": milestones}
    )
```

---

## Token Budget

| Component | Before | After | Change |
|-----------|--------|-------|--------|
| System prompt base | ~400 | ~400 | 0 |
| Stage guidelines | ~150 | 0 | -150 |
| Dynamic context | 0 | ~120 | +120 |
| Pacing hints | 0 | ~50 | +50 |
| Memory extraction prompt | ~300 | ~350 | +50 |
| **Total per message** | ~2500 | ~2570 | **+2.8%** |

---

## Beat Types

| Beat | Description | Tension Effect |
|------|-------------|----------------|
| `playful` | Light, fun energy | -5 to +5 |
| `flirty` | Romantic/attraction energy | +5 to +10 |
| `tense` | Conflict, disagreement, friction | +10 to +15 |
| `vulnerable` | Emotional openness, sharing | -5 to +5 |
| `supportive` | Comfort, encouragement | -10 to -5 |
| `conflict` | Direct disagreement | +10 to +15 |
| `comfort` | Resolution, reassurance | -15 to -5 |
| `neutral` | Normal conversation | -2 to +2 |

---

## Milestones

| Milestone | Trigger |
|-----------|---------|
| `first_secret_shared` | Character reveals something personal |
| `user_opened_up` | User shares vulnerability |
| `first_flirt` | First explicitly flirty exchange |
| `had_disagreement` | Conflict or tension moment |
| `comfort_moment` | Meaningful emotional support |
| `inside_joke_created` | Shared humor reference |
| `deep_conversation` | Extended meaningful exchange |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/015_relationship_dynamics.sql` | New migration |
| `services/memory.py` | Add beat extraction to prompt |
| `services/conversation.py` | Call relationship update after extraction |
| `models/message.py` | Replace stage context with dynamic context |
| `models/relationship.py` | Add dynamic/milestones fields |

---

## Rollback Plan

If issues arise:
1. Old `stage` and `stage_progress` columns preserved
2. Can revert context building to use old stage system
3. Beat extraction is additive - can be ignored

---

## Success Metrics

After deployment, monitor:
- Average conversation length (should increase)
- Scene generation rate (should increase if conversations are richer)
- Return user rate (primary stickiness metric)

---

## Future Extensions (Not Now)

Once validated, this foundation enables:
- Episode arcs with beat sequences
- Cliffhanger detection (high tension at session end)
- Narrative suggestions ("This would be a good moment for X")
- Scene prompt enhancement based on beat type
