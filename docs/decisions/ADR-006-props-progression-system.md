# ADR-006: Props as Progression System

> **Status**: Draft / Under Consideration
> **Date**: 2025-01-05
> **Deciders**: Product Review
> **Depends on**: ADR-005 (Props Domain)

---

## Context

ADR-005 established props as canonical story objects for narrative consistency. During implementation review, a larger opportunity emerged: **props could become the game layer** that transforms chat companions into narrative games.

### The Insight

Current state:
- Chat companions have vibes but no stakes
- Players enjoy conversations but don't feel progression
- Engagement is session-based, not journey-based

Proposed evolution:
- Props become collectible progression markers
- Story advancement gates behind prop discovery
- Player agency in directing conversation toward discovery
- Cross-session persistence creates "relationship inventory"

### Competitive Landscape

| Category | Examples | Strength | Weakness |
|----------|----------|----------|----------|
| Visual Novels | Choices, Episode | Authored quality, progression | No real conversation, scripted |
| AI Chat | Character.ai, Replika | Conversational, intimate | No game structure, no stakes |
| Text Adventures | AI Dungeon | Player agency, exploration | Weak character consistency |

**Gap in market:** No one combines chat companion warmth + game progression depth + authored quality control.

Props-as-progression could fill this gap.

---

## Decision Options

### Option A: Full Progression System (Big Bet)

Transform props into the core game mechanic:

```
┌─────────────────────────────────────────────────────────────────┐
│  PROPS AS GAME LAYER                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AUTHORED PROPS              USER COLLECTION          GATING    │
│  ├─ Episode-scoped    ──►    ├─ Permanent owned   ──► ├─ Episodes│
│  ├─ Reveal conditions        ├─ Cross-session        ├─ Content │
│  └─ Narrative purpose        └─ Character-grouped    └─ Premium │
│                                                                  │
│  DISCOVERY                   MONETIZATION                        │
│  ├─ Player-directed          ├─ Sparks to unlock early          │
│  ├─ Conversation earned      ├─ Premium exclusive props         │
│  └─ Milestone triggered      └─ Re-summon in future sessions    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Schema additions:**

```sql
-- User's permanent prop collection
CREATE TABLE user_props (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prop_id UUID NOT NULL REFERENCES props(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id),

    -- Acquisition context
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    earned_session_id UUID REFERENCES sessions(id),
    earn_context TEXT,  -- "Daniel showed you this in Episode 1, Turn 5"

    -- Engagement tracking
    view_count INT DEFAULT 1,
    last_viewed_at TIMESTAMPTZ,

    -- Premium features
    is_premium BOOLEAN DEFAULT FALSE,
    sparks_spent INT DEFAULT 0,

    UNIQUE(user_id, prop_id)
);

-- Episode unlock requirements
CREATE TABLE episode_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_template_id UUID NOT NULL REFERENCES episode_templates(id),
    required_prop_id UUID NOT NULL REFERENCES props(id),
    requirement_type VARCHAR(50) DEFAULT 'must_have',  -- must_have, any_of, premium_bypass

    UNIQUE(episode_template_id, required_prop_id)
);

CREATE INDEX idx_user_props_user ON user_props(user_id);
CREATE INDEX idx_user_props_character ON user_props(user_id, character_id);
```

**New features required:**

1. **Collection Gallery** - User can browse all earned props, grouped by character
2. **Prop Gating** - Episodes locked until prerequisite props collected
3. **Re-summon** - Request character show a prop again (sparks cost?)
4. **Premium Props** - Exclusive items available via sparks purchase
5. **Discovery Hints** - Director guides player toward undiscovered props
6. **Progress Indicators** - "3/7 props collected in this series"

**Risks:**
- Significant scope expansion
- Transforms product positioning (companion → game)
- Heavy authoring burden for prop-based episode design
- May break simplicity that makes chat intimate

**Potential upside:**
- Clear monetization hooks
- Stronger retention mechanics
- Differentiated market position
- Re-engagement reasons (come back to collect more)

---

### Option B: Lightweight Experiment (Validate First)

Test the hypothesis with minimal changes before full commitment.

**Experiment design:**

1. **Series:** The Last Message (already has props)
2. **Scope:** Add 1-2 "gating props" concept manually
3. **Mechanic:** Episode 2 mentions "You'll need to find X first"
4. **Tracking:** Manual observation of player behavior
5. **Duration:** 2 weeks of user testing

**Implementation (minimal):**

```sql
-- Just add to existing props table
ALTER TABLE props ADD COLUMN IF NOT EXISTS
    is_progression_gate BOOLEAN DEFAULT FALSE;

ALTER TABLE props ADD COLUMN IF NOT EXISTS
    gates_episode_id UUID REFERENCES episode_templates(id);
```

**Frontend changes:**
- Show "X props collected" badge on character card
- Episode selector shows lock icon if prerequisites not met
- Simple "You need to discover [prop name] first" message

**Success metrics:**
- Do users mention/ask about props more?
- Do users complete more episodes when props create stakes?
- Do users return to collect missing props?
- Would users pay sparks to unlock gated content early?

**If successful:** Proceed to Option A with confidence
**If not:** Props remain narrative enhancement only (ADR-005 scope)

---

## Recommendation

**Start with Option B (Lightweight Experiment).**

Rationale:
1. Validates hypothesis before major investment
2. Preserves current product simplicity
3. Provides data for monetization decisions
4. Can iterate toward Option A if metrics support it

The risk of overbuilding is higher than the risk of underbuilding. Props-as-progression is exciting but unproven. Let users tell us if they want it.

---

## Genre-Specific Applications

If validated, props-as-progression maps differently per genre:

### Mystery (The Last Message)
- **Prop purpose:** Evidence collection
- **Gating:** Can't accuse until you have proof
- **Player motivation:** Solve the case
- **Monetization:** Unlock "classified files" early

### Thriller (Blackout)
- **Prop purpose:** Survival supplies
- **Gating:** Can't attempt escape without gear
- **Player motivation:** Stay alive
- **Monetization:** Premium survival items

### Romance (Coffee Shop Crush)
- **Prop purpose:** Relationship mementos
- **Gating:** Lighter - milestones unlock deeper content
- **Player motivation:** Build "our story" collection
- **Monetization:** Exclusive keepsakes, anniversary items

---

## Implementation Phases (If Option A Approved)

### Phase 1: User Collection
- [ ] `user_props` table migration
- [ ] Automatic earning when `session_props` reveals
- [ ] API: GET /users/{id}/props (collection endpoint)
- [ ] Frontend: Collection gallery page

### Phase 2: Gallery UI
- [ ] Props grouped by character
- [ ] Prop detail modal with earn context
- [ ] "X of Y collected" progress indicators
- [ ] Share prop to social (future)

### Phase 3: Episode Gating
- [ ] `episode_requirements` table
- [ ] Episode selector shows lock states
- [ ] "Requires: [prop names]" display
- [ ] Graceful unlock flow

### Phase 4: Monetization Hooks
- [ ] Premium props (sparks to unlock)
- [ ] Early unlock bypass (sparks to skip gate)
- [ ] Re-summon feature (sparks to show again)
- [ ] Prop generation (sparks for custom memento)

### Phase 5: Discovery Enhancement
- [ ] Director hints toward undiscovered props
- [ ] "You're close to finding something" signals
- [ ] Prop radar / warm-cold mechanic

---

## Open Questions

1. **Free vs Paid collection?** Can users see their collection for free, or is gallery itself premium?
2. **Cross-character props?** Can the same prop appear in multiple series?
3. **User-generated props?** Can users create custom mementos?
4. **Prop trading/gifting?** Social features around props?
5. **Time-limited props?** Seasonal/event exclusives?

---

## Related Documents

- **ADR-005**: Props Domain (foundation)
- **ADR-002**: Theatrical Architecture (authoring philosophy)
- **ADR-003**: Image Generation (prop visuals)
- **SPARKS.md**: Monetization mechanics

---

## Review Notes

This ADR represents a potential product pivot from "chat companion" to "narrative game." The lightweight experiment (Option B) is designed to validate before committing to the larger vision.

Key question: **Does adding game structure enhance or diminish the intimacy that makes chat companions compelling?**

The answer will come from user behavior, not speculation.
