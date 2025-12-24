# Director Phase 2.4: Visual Trigger Observability & Hybrid Model

> **Status**: IN PROGRESS
> **Created**: 2024-12-24
> **Owner**: Engineering
> **Related**: DIRECTOR_PROTOCOL.md v2.4, IMAGE_GENERATION.md v1.2

---

## Problem Statement

### What We Discovered

Production testing (2024-12-24) revealed that Director auto-generation is **completely non-functional** despite passing Phase 1 fixes:

**Symptoms**:
- User (premium, `visual_mode: cinematic`, `generation_budget: 3`) chatted for 5 turns
- Director ran successfully (`turn_count: 5`, `director_state` populated)
- Conversation contained clear visual moments ("coffee stain", "faces inches apart")
- **Result**: `visual_type: "none"` for all 5 turns, zero auto-gen images

**Root Cause Analysis**:

1. **LLM Inconsistency**: Gemini 3 Flash (default Director LLM) evaluates too conservatively
2. **Parse Fragility**: Regex requires exact `SIGNAL: [visual: X] [status: Y]` format - any deviation = fallback to `visual_type: "none"`
3. **Zero Observability**: `director_state` only saves final classification, not raw LLM response
4. **Silent Failures**: No logging showing WHY visual was skipped (parse failure vs LLM decision)

### First Principles: Why LLM-Driven Triggers Are Fragile

**Current Approach**: Ask LLM "Would this exchange benefit from a visual element?"

**Problems**:
- Subjective judgment varies by model (Gemini vs Claude vs GPT)
- Requires strict output format for parsing
- No transparency when it fails
- Can't A/B test or tune without LLM retraining

**Better Approach**: **Deterministic triggers + Semantic descriptions**

- **When to generate**: Turn-based (3rd turn, 50% through arc, climax)
- **What to show**: LLM describes the moment (no structured parsing needed)
- **Why this works**: Predictable, testable, transparent, LLM-agnostic

---

## Solution: Hybrid Model

### Architecture

```python
# DETERMINISTIC: When to generate (turn-based)
def should_generate_visual(turn_count, turn_budget, visual_mode, generations_used, generation_budget):
    """Pure function - no LLM calls."""
    if generations_used >= generation_budget:
        return False, "budget_exhausted"

    if visual_mode == "cinematic":
        # Generate at narrative beats based on turn position
        position = turn_count / turn_budget if turn_budget else turn_count / 10

        # Budget of 3: trigger at 25%, 50%, 75% of episode
        if generation_budget == 3:
            triggers = [0.25, 0.5, 0.75]
        elif generation_budget == 4:
            triggers = [0.2, 0.4, 0.6, 0.8]
        else:
            # Fallback: fixed turns
            triggers = [3, 6, 9]

        # Check if we're at a trigger point
        for i, trigger_pos in enumerate(triggers):
            if i == generations_used and position >= trigger_pos:
                return True, f"turn_position_{trigger_pos}"

    elif visual_mode == "minimal":
        # Only at climax (90%+ or final turns)
        position = turn_count / turn_budget if turn_budget else 0
        if position >= 0.9:
            return True, "climax_reached"

    return False, "no_trigger_point"

# SEMANTIC: What to show (LLM describes, no parsing)
async def get_visual_description(messages, genre, situation):
    """Simple prompt - just describe the moment."""
    prompt = f"""You are observing a {genre} story moment.

Recent exchange:
{format_messages(messages[-6:])}

Describe this moment in one evocative sentence for a cinematic insert shot.
Focus on: mood, lighting, composition, symbolic objects.
Style: anime environmental storytelling (Makoto Shinkai, Cowboy Bebop).

One sentence only:"""

    response = await llm.generate(prompt, max_tokens=80)
    return response.content.strip()  # No parsing needed!
```

### Benefits

| Current (LLM-Driven) | New (Hybrid) | Improvement |
|---------------------|--------------|-------------|
| LLM decides if visual needed | Turn position decides | **Predictable, testable** |
| Regex parses structured output | Plain text description | **No parse failures** |
| Falls back to `"none"` silently | Logs trigger decision | **Observable** |
| Model-dependent behavior | Model-agnostic | **Reliable** |
| "Would this benefit from visual?" | "Describe this moment" | **Clearer task** |

---

## Implementation Plan

### Phase 1: Add Observability (IMMEDIATE)

**Goal**: See what's happening before we change behavior

#### Tasks

1.1. **Expand director_state Logging**
   - Add `raw_response` field to capture full LLM output
   - Add `parse_method` field ("regex_match" | "fallback")
   - Add `visual_decisions` array with decision history

1.2. **Add DEBUG Logging**
   - Log full evaluation prompt sent to LLM
   - Log full LLM response before parsing
   - Log why visual was triggered/skipped

1.3. **Add Metrics Tracking**
   - `director.evaluation.parse_success` vs `parse_failure`
   - `director.visual.triggered` vs `skipped` (by reason)
   - `director.visual.llm_said_none` vs `regex_failed`

#### Files Changed

- `substrate-api/api/src/app/services/director.py`
  - Update `process_exchange()` to save `raw_response`
  - Update `_parse_evaluation()` to log parse method
  - Add logging to `decide_actions()`

#### Expected Output

```json
{
  "director_state": {
    "last_evaluation": {
      "turn": 5,
      "status": "going",
      "visual_type": "none",
      "visual_hint": null,
      "raw_response": "This is a subtle moment of connection...\nSIGNAL: [visual: none] [status: going]",
      "parse_method": "regex_match"
    },
    "visual_decisions": [
      {"turn": 1, "triggered": false, "reason": "visual_type_none", "llm_response_preview": "..."},
      {"turn": 2, "triggered": false, "reason": "visual_type_none", "llm_response_preview": "..."},
      {"turn": 3, "triggered": false, "reason": "visual_type_none", "llm_response_preview": "..."}
    ]
  }
}
```

---

### Phase 2: Implement Hybrid Model (AFTER OBSERVABILITY)

**Goal**: Replace LLM-driven triggers with deterministic + semantic hybrid

#### Tasks

2.1. **Add Deterministic Trigger Logic**
   - New method: `DirectorService._should_generate_visual_deterministic()`
   - Returns: `(should_generate: bool, reason: str)`
   - Based on: turn position, visual_mode, generation_budget

2.2. **Simplify LLM Evaluation Prompt**
   - Remove "Would this benefit from visual?" question
   - Remove SIGNAL format requirement
   - Change to: "Describe this moment in one sentence"
   - No regex parsing - use raw text as visual_hint

2.3. **Update decide_actions()**
   - Call `_should_generate_visual_deterministic()` first
   - If true, call simplified LLM for description only
   - Set `actions.visual_type = "character"` (default for auto-gen)
   - Set `actions.visual_hint = llm_description`

2.4. **Add Fallback Classification**
   - If we need to preserve `visual_type` granularity (character/object/atmosphere)
   - Use simple keyword matching on description:
     - Contains "hands", "eyes", "face" → "character"
     - Contains "cup", "letter", "phone" → "object"
     - Contains "window", "light", "rain" → "atmosphere"
   - Default: "character"

#### Files Changed

- `substrate-api/api/src/app/services/director.py`
  - Add `_should_generate_visual_deterministic()`
  - Modify `evaluate_exchange()` to use simpler prompt
  - Update `decide_actions()` to use hybrid model
  - Remove regex parsing from `_parse_evaluation()`

#### Example Flow

```python
# decide_actions() - NEW LOGIC
def decide_actions(self, evaluation, episode, session):
    actions = DirectorActions()

    # Deterministic: Should we generate?
    should_generate, reason = self._should_generate_visual_deterministic(
        turn_count=session.turn_count + 1,
        turn_budget=episode.turn_budget,
        visual_mode=episode.visual_mode,
        generations_used=session.generations_used,
        generation_budget=episode.generation_budget,
    )

    if should_generate:
        # Semantic: What should we show?
        description = await self._get_visual_description(messages, genre, situation)

        actions.visual_type = "character"  # Default for cinematic inserts
        actions.visual_hint = description
        log.info(f"Visual triggered: {reason}, hint='{description[:50]}...'")
    else:
        log.debug(f"Visual skipped: {reason}")

    # Status evaluation can stay LLM-driven (less critical)
    actions.suggest_next = evaluation.get("status") == "done"

    return actions
```

---

### Phase 3: Enhanced Observability (OPTIONAL)

**Goal**: Production-grade logging infrastructure

#### Tasks (Future)

3.1. **Structured Logging**
   - Use JSON format for all Director logs
   - Ship to Render log aggregation
   - Enable querying: "show me all visual_type:none decisions"

3.2. **Dashboard Metrics**
   - Grafana/Datadog: Director evaluation success rate
   - Alert if `visual.triggered` drops below 30% for premium users
   - Track `generations_used` distribution across episodes

3.3. **A/B Testing Framework**
   - Flag: `DIRECTOR_VISUAL_STRATEGY` = "llm_driven" | "hybrid" | "pure_deterministic"
   - Split users 50/50 to compare performance
   - Metric: User satisfaction, manual gen frequency

---

## Testing Strategy

### Before Deployment (Observability)

1. Create test episode with `visual_mode: cinematic`, `generation_budget: 3`
2. Chat for 8-10 turns with clear visual moments
3. Check `director_state.visual_decisions` array
4. Verify we can see raw LLM responses
5. Confirm logging shows parse success/failure

### After Deployment (Hybrid Model)

1. **Deterministic Triggers Test**
   - Episode with `turn_budget: 12`, `generation_budget: 3`
   - Expect images at turns: 3 (25%), 6 (50%), 9 (75%)
   - Verify `visual_decisions[].reason` shows "turn_position_0.25" etc.

2. **Visual Description Quality**
   - Check `scene_images.prompt_used` contains cinematic descriptions
   - Should NOT contain SIGNAL format artifacts
   - Should be 1-2 sentences, evocative

3. **Budget Enforcement**
   - Verify generation stops at `generation_budget` limit
   - Verify `generations_used` increments correctly

---

## Migration Path

### Rollout Strategy

**Stage 1: Observability Only** (This PR)
- Add logging, no behavior change
- Deploy to production
- Collect data for 24 hours
- Analyze: What is Gemini actually saying? How often does regex fail?

**Stage 2: Hybrid Model** (Follow-up PR)
- Based on Stage 1 data, implement deterministic triggers
- Feature flag: `DIRECTOR_VISUAL_STRATEGY=hybrid`
- A/B test: 50% hybrid, 50% current (if current ever works)
- Measure: auto-gen success rate, image quality, user engagement

**Stage 3: Full Cutover**
- Remove LLM-driven trigger logic entirely
- Make hybrid model the default
- Clean up dead code (regex parsing)

### Backwards Compatibility

- Existing sessions continue working (director_state extends gracefully)
- No database migrations needed (JSONB stores arbitrary data)
- API contracts unchanged (still emits `visual_pending` events)

---

## Success Metrics

### Observability Phase

- **Metric**: `director.visual_decisions.logged` > 0 (we can see decisions)
- **Metric**: `director.evaluation.raw_response.captured` = 100% (no data loss)
- **Target**: 100% of evaluations logged with full context

### Hybrid Model Phase

- **Metric**: `auto_gen.trigger_rate` (% of eligible turns that generate)
- **Target**: 80%+ for premium cinematic episodes (vs 0% currently)
- **Metric**: `visual.description_quality` (manual review of 20 samples)
- **Target**: 90%+ are cinematic/evocative (not generic)
- **Metric**: `parse_failure_rate`
- **Target**: 0% (no regex parsing anymore)

---

## Open Questions

1. **Turn Triggers**: Fixed positions (25%, 50%, 75%) or adaptive based on detected beats?
2. **Visual Type Granularity**: Do we need character/object/atmosphere distinction, or just "cinematic insert"?
3. **LLM for Description**: Keep Gemini Flash for speed, or switch to Claude Haiku for quality?
4. **Episode Status**: Keep LLM-driven "going/closing/done" or make deterministic too?

---

## Related Documents

- [DIRECTOR_PROTOCOL.md v2.4](../quality/core/DIRECTOR_PROTOCOL.md) - Updated with hybrid model
- [IMAGE_GENERATION.md v1.2](../quality/modalities/IMAGE_GENERATION.md) - Auto-gen trigger strategy
- [ADR-003: Image Generation Strategy](../decisions/ADR-003-image-generation-strategy.md)
- [DIRECTOR_REFACTORING.md](./DIRECTOR_REFACTORING.md) - Original Phase 1-3 plan

---

**End of Phase 2.4 Plan**
