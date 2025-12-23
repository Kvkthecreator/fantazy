# Director Refactoring - Implementation Plan

> **Status**: PLANNED
> **Created**: 2024-12-24
> **Owner**: Engineering
> **Related ADRs**: ADR-002 (Theatrical Model)

---

## Executive Summary

The Director domain has evolved to v2.2 (Theatrical Model) but has **critical gaps** between documentation and implementation. This plan addresses broken auto-generation, unclear ownership boundaries, and missing subscription gating, while preparing for enhanced Director interjections.

**Key Problems**:
1. ❌ Auto-visual generation is broken (unreachable code path)
2. ❌ Subscription-tier gating not enforced for auto-gen
3. ⚠️ Memory/hook extraction ownership split between Director and legacy MemoryService
4. ⚠️ Director interjection system not implemented (next-episode suggestions, user guidance)

**Timeline**: 3-4 days
**Risk Level**: Medium (touches conversation flow, monetization, Director protocol)

---

## Background

### What We Built (ADR-002: Theatrical Model)

Director Protocol v2.2 successfully implemented:
- ✅ Deterministic pre-guidance (no LLM calls for pacing)
- ✅ Scene motivation fields (`scene_objective`, `scene_obstacle`, `scene_tactic`) in EpisodeTemplate
- ✅ Genre doctrines moved from Character to Director runtime injection
- ✅ Semantic post-evaluation for visual triggers and completion status

### What Broke / Was Never Finished

1. **Auto-Generation Pipeline**: `DirectorActions.deduct_sparks` field doesn't exist, making the generation trigger unreachable
2. **Subscription Enforcement**: Free vs. Premium visual access not gated in auto-gen path
3. **Memory Extraction**: Director has `save_memory` fields but doesn't use them; MemoryService still does all extraction
4. **Director Interjections**: Documented in protocol but never implemented (suggest next episode, guide user behavior)

### Why This Matters

- **User Experience**: Auto-generated visuals should work (they don't)
- **Monetization**: Premium users aren't getting differentiated visual experience
- **Platform Philosophy**: Director should guide progression, not just observe
- **Code Quality**: Dead code and unclear ownership creates technical debt

---

## Implementation Phases

### **Phase 1: Fix Auto-Generation Pipeline**
**Status**: Not Started
**Priority**: P0 (Critical - Broken Feature)
**Estimated Time**: 4-6 hours

#### Tasks

1.1. **Fix DirectorActions Data Model**
   - Add missing `deduct_sparks` field OR remove the broken check
   - Decision: Remove spark-gating from auto-gen (already paid via `episode_cost`)
   - File: `substrate-api/api/src/app/services/director.py`

1.2. **Wire Subscription Status to Director**
   - Pass `subscription_status` to `decide_actions()`
   - Gate auto-gen by subscription tier (free users get manual-only)
   - File: `substrate-api/api/src/app/services/conversation.py`

1.3. **Validate Budget Tracking**
   - Confirm `generations_used` increments correctly
   - Confirm `generation_budget` from EpisodeTemplate enforced
   - Test: cinematic mode (3-4 gens), minimal mode (1 gen at climax)

1.4. **Add Observability**
   - Log when Director wants to generate but is blocked
   - Metrics: `director.auto_gen.skipped` (by reason: no_budget, free_user, disabled)
   - File: `substrate-api/api/src/app/services/director.py`

#### Acceptance Criteria

- [ ] Premium user in cinematic episode gets auto-generated visuals at beats
- [ ] Free user in cinematic episode does NOT get auto-gen (manual "Capture Moment" only)
- [ ] `generations_used` increments correctly, respects `generation_budget`
- [ ] Logs clearly show why generation was skipped when it doesn't happen

#### Files Changed

- `substrate-api/api/src/app/services/director.py` (DirectorActions, decide_actions, execute_actions)
- `substrate-api/api/src/app/services/conversation.py` (send_message_stream)
- `substrate-api/api/src/app/models/episode_template.py` (validation for visual_mode + generation_budget)

---

### **Phase 2: Clarify Memory & Hook Extraction Ownership**
**Status**: Not Started
**Priority**: P1 (High - Architectural Clarity)
**Estimated Time**: 3-4 hours

#### Decision Point

**Option A**: Director owns extraction (future state)
- Director calls MemoryService during `process_exchange()`
- Remove `_process_exchange()` from ConversationService
- Director becomes single source of truth for post-conversation processing

**Option B**: Keep MemoryService ownership (current state, formalize it)
- Remove unused `save_memory`/`memory_content` fields from DirectorActions
- Document that MemoryService is canonical extraction path
- Director focuses on visual/completion/pacing only

**Recommendation**: **Option B** (formalize current state)

**Rationale**:
- MemoryService extraction is working and battle-tested
- Director shouldn't do everything (separation of concerns)
- Memory extraction is complex (LLM prompt, deduplication, beat classification)
- Director's job is orchestration, not extraction

#### Tasks

2.1. **Remove Unused Director Fields**
   - Delete `save_memory` and `memory_content` from `DirectorActions` dataclass
   - Remove dead code references
   - File: `substrate-api/api/src/app/services/director.py`

2.2. **Formalize MemoryService Ownership**
   - Keep `ConversationService._process_exchange()` as canonical path
   - Add docstring: "Memory extraction is owned by MemoryService, not Director"
   - File: `substrate-api/api/src/app/services/conversation.py`

2.3. **Update Documentation**
   - DIRECTOR_PROTOCOL.md: Remove "memory extraction" from Phase 2 responsibilities
   - Add new section: "What Director Does NOT Do" → "Memory/Hook Extraction (owned by MemoryService)"
   - File: `docs/quality/core/DIRECTOR_PROTOCOL.md`

#### Acceptance Criteria

- [ ] No unused fields in DirectorActions
- [ ] Documentation clearly states MemoryService owns extraction
- [ ] No confusion about "who extracts memories" in codebase

#### Files Changed

- `substrate-api/api/src/app/services/director.py`
- `substrate-api/api/src/app/services/conversation.py` (docstrings)
- `docs/quality/core/DIRECTOR_PROTOCOL.md`

---

### **Phase 3: Implement Director Interjection System (v1)**
**Status**: Not Started
**Priority**: P1 (High - Product Enhancement)
**Estimated Time**: 6-8 hours

#### Concept: Passive Suggestions

Director observes conversation flow and emits **non-blocking suggestions** to guide progression:

| Interjection Type | Trigger Condition | User-Facing Message | Technical Signal |
|-------------------|-------------------|---------------------|------------------|
| **Next Episode Suggestion** | `status: done` but user sends 3+ more messages | "✨ Ready for the next chapter? Episode 2 awaits." | `director_suggestion: next_episode` |
| **Tension Warning** | `tension_change < 0` for 3 consecutive turns | "💭 Things are getting too comfortable..." | `director_suggestion: increase_tension` |
| **Stalled Scene** | No meaningful beats for 5+ turns | "🎬 Try a different approach?" | `director_suggestion: scene_stalled` |
| **Tactic Failing** | `scene_tactic` not achieving `scene_objective` for N turns | "🎭 This isn't working. Change tactics?" | `director_suggestion: tactic_ineffective` |

**Design Principle**: Suggestions, not commands. User can ignore them.

#### Tasks

3.1. **Add Interjection Detection Logic**
   - New method: `DirectorService.detect_interjections(session, evaluation, director_state)`
   - Returns: `List[DirectorInterjection]` (type, message, metadata)
   - File: `substrate-api/api/src/app/services/director.py`

3.2. **Extend director_state Tracking**
   - Add `director_state.interjection_history` (last 5 suggestions)
   - Add `director_state.consecutive_low_tension_turns` (counter)
   - Add `director_state.turns_since_last_beat` (counter)
   - File: `substrate-api/api/src/app/models/session.py` (director_state JSONB)

3.3. **Emit Interjection Events in Stream**
   - New stream event: `{"type": "director_suggestion", "suggestion_type": "...", "message": "..."}`
   - Emit after `done` event in conversation stream
   - File: `substrate-api/api/src/app/services/conversation.py`

3.4. **Frontend Integration (Stub)**
   - Document expected frontend behavior (show as subtle toast/banner)
   - No blocking implementation (out of scope for this phase)
   - File: Add to `docs/quality/core/DIRECTOR_UI_TOOLKIT.md`

3.5. **Testing Scenarios**
   - Test: Episode semantic complete, user keeps chatting → suggest next episode
   - Test: Tension drops for 3 turns → suggest increase tension
   - Test: No beats for 5 turns → suggest scene stalled

#### Acceptance Criteria

- [ ] Director emits `director_suggestion` events at appropriate moments
- [ ] Suggestions don't repeat (use interjection_history to prevent spam)
- [ ] director_state persists tracking data across turns
- [ ] Documentation explains each suggestion type and trigger condition

#### Files Changed

- `substrate-api/api/src/app/services/director.py` (detect_interjections)
- `substrate-api/api/src/app/services/conversation.py` (stream emission)
- `substrate-api/api/src/app/models/session.py` (director_state schema)
- `docs/quality/core/DIRECTOR_PROTOCOL.md` (add Interjection System section)
- `docs/quality/core/DIRECTOR_UI_TOOLKIT.md` (frontend guidance)

---

### **Phase 4: Documentation Audit & Alignment**
**Status**: Not Started
**Priority**: P1 (High - Source of Truth)
**Estimated Time**: 2-3 hours

#### Tasks

4.1. **Update DIRECTOR_PROTOCOL.md**
   - Version bump: v2.2 → v2.3 (with interjections)
   - Fix "Phase 2" description (remove memory extraction, add interjections)
   - Add new section: "Director Interjection System"
   - File: `docs/quality/core/DIRECTOR_PROTOCOL.md`

4.2. **Update CONTEXT_LAYERS.md**
   - Layer 6 (Director): Clarify it provides pacing + interjections, NOT memory extraction
   - File: `docs/quality/core/CONTEXT_LAYERS.md`

4.3. **Update CHANGELOG.md**
   - Add entry for Director v2.3 changes
   - Note: Auto-generation fixed, memory ownership clarified, interjections added
   - File: `docs/quality/CHANGELOG.md`

4.4. **Create Decision Record (Optional)**
   - ADR-003: Director Interjection System
   - Rationale: Passive suggestions align with theatrical model (stage manager calling out issues)
   - File: `docs/decisions/ADR-003-director-interjections.md` (optional)

#### Acceptance Criteria

- [ ] DIRECTOR_PROTOCOL.md accurately reflects implemented behavior
- [ ] No mentions of Director extracting memories (that's MemoryService)
- [ ] Interjection system documented with examples
- [ ] CHANGELOG entry exists

#### Files Changed

- `docs/quality/core/DIRECTOR_PROTOCOL.md`
- `docs/quality/core/CONTEXT_LAYERS.md`
- `docs/quality/CHANGELOG.md`
- (optional) `docs/decisions/ADR-003-director-interjections.md`

---

## Testing Strategy

### Unit Tests

- `test_director_decide_actions()` - visual triggers, budget tracking, subscription gating
- `test_director_detect_interjections()` - all interjection types fire correctly
- `test_director_state_tracking()` - counters increment, history maintained

### Integration Tests

- `test_auto_generation_premium_user()` - visual generated at beats
- `test_auto_generation_free_user()` - NO visual generated (manual only)
- `test_interjection_next_episode()` - suggestion fires when episode complete but user continues
- `test_interjection_tension_warning()` - fires after 3 consecutive low-tension turns

### Manual QA

- Premium user in cinematic episode: verify visuals appear at establish/escalate/peak phases
- Free user in cinematic episode: verify NO auto-visuals, manual "Capture Moment" works
- Complete episode, keep chatting: verify "next episode" suggestion appears
- Have 5 turns with no beats: verify "scene stalled" suggestion

---

## Migration Path

### Database Changes

None required. Existing schema supports all features:
- `sessions.director_state` (JSONB) - can store interjection tracking
- `sessions.generations_used` - already exists
- `episode_templates.visual_mode`, `generation_budget` - already exist

### Backwards Compatibility

- Existing sessions continue working (director_state extends gracefully)
- Free users won't see behavior change (auto-gen was already broken)
- Premium users get NEW feature (working auto-gen)

### Feature Flags

Consider adding:
- `ENABLE_DIRECTOR_INTERJECTIONS` (default: true) - allow disabling suggestions
- Keep existing: `ENABLE_AUTO_SCENE_GENERATION` (default: true)

---

## Rollout Plan

### Stage 1: Phase 1 (Auto-Generation Fix)
- Deploy to staging
- Test with premium test account
- Monitor `director.auto_gen.triggered` vs `director.auto_gen.skipped` metrics
- **Go/No-Go**: Auto-gen works for premium, blocked for free

### Stage 2: Phase 2 (Memory Ownership Clarity)
- Documentation-only change
- Deploy with Phase 1
- **Go/No-Go**: No dead code in DirectorActions

### Stage 3: Phase 3 (Interjections v1)
- Deploy to staging first (could be polarizing)
- A/B test: 50% users get interjections, 50% don't
- Measure: Do users act on suggestions? (episode transitions, tension recovery)
- **Go/No-Go**: Interjections improve engagement OR are neutral (not annoying)

### Stage 4: Phase 4 (Documentation)
- Deploy docs alongside code changes
- **Go/No-Go**: Docs match reality

---

## Success Metrics

### Phase 1 (Auto-Gen)
- **Metric**: `auto_gen_trigger_rate` (% of eligible moments that trigger generation)
- **Target**: >60% for premium cinematic episodes
- **Metric**: `auto_gen_blocked_rate_free_users`
- **Target**: 100% (free users never get auto-gen)

### Phase 3 (Interjections)
- **Metric**: `interjection_action_rate` (% of suggestions user acts on)
- **Target**: >15% (if lower, suggestions are ignored/annoying)
- **Metric**: `episode_transition_rate_with_suggestion` vs `without_suggestion`
- **Target**: Suggestion increases transitions by >20%

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Auto-gen costs spike** | Low | High | Budget enforcement already in place (`generation_budget`), monitor spend |
| **Interjections feel intrusive** | Medium | Medium | A/B test, make dismissible, cap frequency (1 per 5 turns max) |
| **Free users complain about no auto-gen** | Medium | Low | Communicate premium feature clearly, improve manual "Capture Moment" UX |
| **Memory extraction breaks** | Low | High | No changes to extraction logic, just ownership clarification |

---

## Open Questions

1. **Interjection Frequency**: Max 1 per 5 turns? Per episode? User preference?
2. **Interjection Persistence**: Should dismissed suggestions never reappear, or retry after N turns?
3. **Premium Differentiation**: Should free users see "upgrade to unlock auto-visuals" prompt when Director decides to generate?
4. **Next-Episode Flow**: Should interjection include a direct "Start Episode 2" CTA, or just suggest?

---

## Future Enhancements (Out of Scope)

### Phase 5: Active Interjections (Director as Character Voice)
- Director injects guidance directly into character LLM context (not just UI)
- Example: Character LLM sees "DIRECTOR NOTE: User wants more vulnerability. Share something risky."
- Risk: High (could break character voice if not careful)

### Phase 6: Multi-Turn Direction
- Director sets `active_direction` that persists for N turns
- Example: "Push for intimacy" guidance stays active until user reciprocates
- Complex: Requires Director to evaluate goal achievement per turn

### Phase 7: Adaptive Pacing
- Director adjusts `turn_budget` dynamically based on user engagement
- Example: If user highly engaged, extend episode budget from 15 to 20 turns
- Requires: User engagement signals (typing speed, response length, sentiment)

---

## References

- [ADR-002: Theatrical Production Model](../decisions/ADR-002-theatrical-architecture.md)
- [DIRECTOR_PROTOCOL.md](../quality/core/DIRECTOR_PROTOCOL.md)
- [CONTEXT_LAYERS.md](../quality/core/CONTEXT_LAYERS.md)
- [EPISODE-0_CANON.md](../EPISODE-0_CANON.md) - Platform philosophy
- [Director Audit Report](./DIRECTOR_AUDIT_2024-12-24.md) - Findings that led to this plan

---

## Appendix: Code Snippets

### A. Fix Auto-Generation Trigger (Phase 1.1)

**Before** (Broken):
```python
# conversation.py:300-304
if ENABLE_AUTO_SCENE_GENERATION and actions.deduct_sparks > 0:  # ← Field doesn't exist!
    asyncio.create_task(self._generate_auto_scene(...))
```

**After** (Fixed):
```python
# conversation.py:300-315
if ENABLE_AUTO_SCENE_GENERATION and actions.visual_type != "none":
    # Check subscription tier for auto-gen eligibility
    if subscription_status == "premium" or episode_template.visual_mode == VisualMode.MINIMAL:
        asyncio.create_task(self._generate_auto_scene(...))
    else:
        # Free user - skip auto-gen but log the trigger
        log.info(f"Auto-gen skipped: free user, visual_type={actions.visual_type}")
```

### B. Director Interjection Detection (Phase 3.1)

```python
# director.py (new method)
def detect_interjections(
    self,
    session: Session,
    evaluation: Dict[str, Any],
    director_state: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Detect if Director should suggest user action.

    Returns list of interjection suggestions to emit.
    """
    interjections = []

    # Track state
    turns_since_complete = director_state.get("turns_since_complete", 0)
    consecutive_low_tension = director_state.get("consecutive_low_tension_turns", 0)
    turns_since_beat = director_state.get("turns_since_last_beat", 0)

    # Interjection 1: Suggest next episode if user keeps chatting after completion
    if evaluation.get("status") == "done" and turns_since_complete >= 3:
        interjections.append({
            "type": "next_episode",
            "message": "✨ Ready for the next chapter? The story continues.",
            "metadata": {"turns_since_complete": turns_since_complete},
        })

    # Interjection 2: Tension warning if low for 3+ turns
    if consecutive_low_tension >= 3:
        interjections.append({
            "type": "increase_tension",
            "message": "💭 Things are getting too comfortable...",
            "metadata": {"consecutive_low_tension": consecutive_low_tension},
        })

    # Interjection 3: Scene stalling if no beats for 5+ turns
    beat_detected = evaluation.get("beat", {}).get("type") != "neutral"
    if not beat_detected and turns_since_beat >= 5:
        interjections.append({
            "type": "scene_stalled",
            "message": "🎬 Try a different approach?",
            "metadata": {"turns_since_beat": turns_since_beat},
        })

    return interjections
```

---

**End of Implementation Plan**
