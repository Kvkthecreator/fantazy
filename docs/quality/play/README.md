# Play Mode System

> **Version**: 3.0.0
> **Status**: Active Development
> **Updated**: 2025-12-23

---

## Purpose

This folder contains the **Play Mode System** — specifications for viral, shareable personality quiz experiences that serve as customer acquisition channels.

Play Mode experiences are:
- **Quiz-based** — Static questions with LLM-powered personalized evaluation
- **Anonymous until conversion** — No auth wall before result
- **Designed for virality** — Each quiz optimized for a specific viral mechanic
- **Gateway to Episode 0** — Result page promotes full interactive stories

---

## v3.0 Strategic Direction

> **See [QUIZ_STRATEGY_V3.md](QUIZ_STRATEGY_V3.md) for the complete strategic framework, first principles, and implementation details.**

### The Core Insight

Most quizzes fail by blending viral mechanics. v3.0 separates them:

| Quiz | Primary Mechanic | Target Reaction |
|------|-----------------|-----------------|
| **Dating Personality Test** | Identity validation | "This is so me" |
| **The Unhinged Test** | Social comparison | "What did you get?" |

### Key Changes from v2.0

- **Separated mechanics** — Each quiz owns ONE viral hook
- **Removed "your people"** — Fictional character references felt forced
- **Dating test = depth** — Reveals patterns, not preferences
- **Unhinged test = fun** — Pure entertainment, no psychology
- **Distinct LLM voices** — Therapist vs. Chaotic friend

---

## Document Structure

```
docs/quality/play/
├── README.md                    ← You are here
├── QUIZ_STRATEGY_V3.md          ← v3.0 Strategic framework (START HERE)
├── QUIZ_MODE_SPEC.md            ← Quiz implementation specification
├── TROPE_CONTENT_SPEC.md        ← Romantic Trope content copy
├── PLAY_MODE_ARCHITECTURE.md    ← Legacy (deprecated)
├── TROPE_SYSTEM.md              ← Trope taxonomy and signals
├── RESULT_REPORT_SPEC.md        ← Result page structure
└── IMPLEMENTATION_STATUS.md     ← Implementation tracking (outdated)
```

---

## Current Approach: Quiz Mode (v3.0)

### Strategic Pivot

The original conversation-based "Flirt Test" was replaced with a **static quiz** because:
1. **Consistent quality** — No LLM variance in the experience
2. **Proven viral format** — MBTI/BuzzFeed-style quizzes have established shareability
3. **Fast iteration** — Questions can be A/B tested without backend changes
4. **Same payoff** — Trope identity result remains the viral hook

### User Flow

```
/play
  └── Quiz Landing Page
        ├── Title: "What's Your Red Flag?"
        ├── Subtitle: "5 questions. brutal honesty. no judgment (ok maybe a little)"
        └── CTA: "Find Out"
              │
              ▼
        Question Flow (5 questions)
        ├── Q1 → Q2 → Q3 → Q4 → Q5
        ├── Progress indicator
        └── Each question: scenario + 5 answer options (one per trope)
              │
              ▼
        Result Page
        ├── Hero: emoji + title + tagline
        ├── Description paragraph
        ├── "In Relationships" section
        ├── Strengths & Challenges
        ├── Advice
        ├── Compatibility ("you vibe with")
        ├── Share button (primary CTA)
        └── "Try Episode 0" section
              ├── Hometown Crush card
              └── Coffee Shop Crush card
```

---

## Implementation Status

| Component | Location | Status |
|-----------|----------|--------|
| Quiz data | `web/src/lib/quiz-data.ts` | ✅ Live |
| Quiz types | `web/src/types/index.ts` | ✅ Live |
| QuizProgress | `web/src/components/quiz/QuizProgress.tsx` | ✅ Live |
| QuizQuestion | `web/src/components/quiz/QuizQuestion.tsx` | ✅ Live |
| QuizResult | `web/src/components/quiz/QuizResult.tsx` | ✅ Live |
| Play page | `web/src/app/play/page.tsx` | ✅ Live |

### What's NOT Used Anymore

The following were part of the conversation-based approach and are **deprecated**:
- `/play/hometown-crush/*` conversation flow
- `/play/flirt-test/*` routes
- Backend games API for play mode
- LLM-based trope evaluation

---

## The 5 Romantic Tropes

| Trope | Tagline |
|-------|---------|
| SLOW BURN | the tension is the whole point and you know it |
| SECOND CHANCE | you never really closed that chapter, did you |
| ALL IN | when you know, you know — and you KNEW |
| PUSH & PULL | you want them to work for it (and you'll work for it too) |
| SLOW REVEAL | they have to earn the real you |

See [TROPE_CONTENT_SPEC.md](TROPE_CONTENT_SPEC.md) for full content.

---

## Technical Details

### Scoring Logic

Each question has 5 options, one mapping to each trope. After 5 questions:
- Highest score = result trope
- Ties broken by: last answered trope wins (recency = stronger signal)

```typescript
function calculateTrope(answers: Record<number, RomanticTrope>): RomanticTrope {
  const scores = { slow_burn: 0, second_chance: 0, all_in: 0, push_pull: 0, slow_reveal: 0 };
  let lastAnswered: RomanticTrope = 'slow_burn';

  for (const trope of Object.values(answers)) {
    scores[trope]++;
    lastAnswered = trope;
  }

  const maxScore = Math.max(...Object.values(scores));
  const winners = Object.entries(scores)
    .filter(([_, score]) => score === maxScore)
    .map(([trope]) => trope as RomanticTrope);

  return winners.length > 1 && winners.includes(lastAnswered) ? lastAnswered : winners[0];
}
```

### No Backend Required

Quiz mode is **entirely frontend**:
- Questions stored in `quiz-data.ts`
- Scoring calculated client-side
- No API calls during quiz flow
- Share via native share API or clipboard copy

---

## Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Completion rate | 90%+ | Quiz is short (<60 seconds) |
| Share rate | 35%+ | Primary viral mechanism |
| Episode 0 click-through | 15%+ | Conversion to full stories |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [QUIZ_MODE_SPEC.md](QUIZ_MODE_SPEC.md) | Full quiz specification |
| [TROPE_CONTENT_SPEC.md](TROPE_CONTENT_SPEC.md) | Trope content copy |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0.0 | 2025-12-23 | Strategic split: Identity test vs. Social comparison test |
| 2.0.0 | 2025-12-21 | Quiz-based approach replaces conversation-based |
| 1.0.0 | 2024-12-20 | Initial Play Mode system documentation |
