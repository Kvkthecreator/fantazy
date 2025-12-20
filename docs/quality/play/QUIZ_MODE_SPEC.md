# Quiz Mode Specification

> **Version**: 1.0.0
> **Status**: Draft
> **Updated**: 2025-12-21

---

## Overview

Quiz Mode replaces the 4-turn conversation approach with a static, quiz-based experience. Users answer 5-6 multiple choice questions and receive a romantic trope result. This approach prioritizes:

1. **Consistent quality** - No LLM variance in the experience
2. **Proven viral format** - MBTI/BuzzFeed-style quizzes have established shareability
3. **Fast iteration** - Questions can be A/B tested easily
4. **Same payoff** - Trope identity result remains the viral hook

---

## Quiz Theme Options

### Primary: "What's Your Red Flag?"
- Self-deprecating, funny framing
- High shareability - people love roasting themselves
- Maps cleanly to existing tropes

### Alternative Themes (Future)
- "How Unhinged Is Your Love Life?"
- "Your Romantic Villain Era"
- "What Kind of Lover Are You?"

---

## User Flow

```
/play
  └── Quiz Landing Page
        ├── Title: "What's Your Red Flag?"
        ├── Subtitle: "5 questions. brutal honesty. no judgment (ok maybe a little)"
        └── CTA: "Find Out"
              │
              ▼
        Question Flow (5-6 questions)
        ├── Q1 → Q2 → Q3 → Q4 → Q5 → (Q6 optional)
        ├── Progress indicator
        └── Each question: scenario + 5 answer options (one per trope)
              │
              ▼
        Result Page
        ├── Trope identity (emoji, title, tagline)
        ├── Description paragraph
        ├── "your people" references
        ├── Share button (primary CTA)
        └── "Try Episode 0" section
              ├── Hometown Crush card
              └── Coffee Shop Crush card
```

---

## Question Design

### Format
Each question presents a scenario with 5 answer options. Each option maps to one trope.

### Scoring
- Each answer adds 1 point to its corresponding trope
- After all questions, highest score = result trope
- Ties broken by: last answered trope wins (recency = stronger signal)

### Question Style
Scenario-based with a casual, slightly unhinged tone.

---

## Sample Questions

### Q1: The Text Back
**"They finally text back after 6 hours. You:"**

| Option | Trope |
|--------|-------|
| Wait exactly 6 hours and 1 minute to respond. Balance. | push_pull |
| Already drafted 4 versions of your reply in Notes | slow_burn |
| "Finally! I was starting to spiral" (send immediately) | all_in |
| Check if they've been active elsewhere first | slow_reveal |
| Wonder if this is the universe giving you a second chance | second_chance |

### Q2: The Ex Situation
**"Your ex likes your Instagram story. You:"**

| Option | Trope |
|--------|-------|
| Screenshot it and send to the group chat for analysis | slow_burn |
| Already know what it means. Time to have The Talk. | all_in |
| Like something of theirs back. The game is on. | push_pull |
| Ignore it but check their profile 3 times that day | slow_reveal |
| Feel a flutter. Maybe the timing is finally right? | second_chance |

### Q3: The First Date Energy
**"On a first date, you're most likely to:"**

| Option | Trope |
|--------|-------|
| Ask about their last relationship (for research purposes) | second_chance |
| Tell them you're having a great time. Out loud. With words. | all_in |
| Tease them until they're slightly confused but intrigued | push_pull |
| Give them just enough to want a second date | slow_reveal |
| Enjoy the tension of not knowing where this is going | slow_burn |

### Q4: The Feelings Check
**"When you catch feelings, you:"**

| Option | Trope |
|--------|-------|
| Tell them. Life's too short for games. | all_in |
| Create situations to see if they feel it too | push_pull |
| Sit with it for weeks before doing anything | slow_burn |
| Drop hints and see if they're paying attention | slow_reveal |
| Wonder if this is fate correcting a past mistake | second_chance |

### Q5: The Dealbreaker
**"Your biggest dating dealbreaker is someone who:"**

| Option | Trope |
|--------|-------|
| Rushes things before the tension has time to build | slow_burn |
| Plays too hard to get (that's YOUR move) | push_pull |
| Can't handle emotional honesty | all_in |
| Asks too many questions too soon | slow_reveal |
| Refuses to believe people can change | second_chance |

### Q6 (Optional): The Rom-Com Moment
**"Your ideal rom-com moment:"**

| Option | Trope |
|--------|-------|
| Running into your ex at a wedding, both single | second_chance |
| The slow realization after years of friendship | slow_burn |
| Confessing your feelings in the rain, no hesitation | all_in |
| The enemies-to-lovers arc where banter becomes something more | push_pull |
| They finally see the real you after breaking down your walls | slow_reveal |

---

## Result Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│                          [emoji]                            │
│                                                             │
│                   your red flag is...                       │
│                                                             │
│                       SLOW BURN                             │
│                                                             │
│        the tension is the whole point and you know it       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  You'd rather wait three seasons for a kiss than rush it.  │
│  You've said "I just think it's better when it builds"     │
│  at least once this month...                                │
├─────────────────────────────────────────────────────────────┤
│                      your people                            │
│        darcy & elizabeth • jim & pam • connell & marianne   │
└─────────────────────────────────────────────────────────────┘

                    [ share result ]  ← Primary CTA

┌─────────────────────────────────────────────────────────────┐
│                  ready for the real thing?                  │
│                                                             │
│    try episode 0 — free interactive romance stories        │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  Hometown       │    │  Coffee Shop    │                │
│  │  Crush          │    │  Crush          │                │
│  │  [image]        │    │  [image]        │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘

                      ep-0.com/play
```

---

## Technical Implementation

### What We Keep
- `/play` route structure
- Anonymous user flow (create anon user, link on auth)
- Result/share infrastructure
- Trope content (ROMANTIC_TROPES in evaluation.py)
- Share page (`/r/[shareId]`)

### What Changes
- Replace conversation UI with quiz UI
- Remove LLM calls for quiz flow (scoring is deterministic)
- Simplify session model (just store answers, not messages)
- Update result page layout (add Episode 0 CTA section)

### New Components
- `QuizQuestion` - Single question with 5 options
- `QuizProgress` - Progress indicator (dots or bar)
- `QuizResult` - Result display with share + Episode 0 CTAs
- `SeriesCard` - Clickable card for series promotion

### Data Model

```typescript
interface QuizSession {
  id: string;
  anonymous_id: string | null;
  user_id: string | null;
  answers: Record<number, RomanticTrope>;  // question_index -> selected trope
  result_trope: RomanticTrope | null;
  created_at: string;
  completed_at: string | null;
}
```

### Scoring Logic (Frontend)

```typescript
function calculateTrope(answers: Record<number, RomanticTrope>): RomanticTrope {
  const scores: Record<RomanticTrope, number> = {
    slow_burn: 0,
    second_chance: 0,
    all_in: 0,
    push_pull: 0,
    slow_reveal: 0,
  };

  let lastAnswered: RomanticTrope = 'slow_burn';

  for (const trope of Object.values(answers)) {
    scores[trope]++;
    lastAnswered = trope;
  }

  // Find max score
  const maxScore = Math.max(...Object.values(scores));
  const winners = Object.entries(scores)
    .filter(([_, score]) => score === maxScore)
    .map(([trope]) => trope as RomanticTrope);

  // Tie-breaker: last answered wins
  if (winners.length > 1 && winners.includes(lastAnswered)) {
    return lastAnswered;
  }

  return winners[0];
}
```

---

## Migration Notes

### Routes
- `/play/hometown-crush/*` → Archive or redirect to `/play`
- `/play` → New quiz landing page
- `/play/result` → Updated result page with Episode 0 CTAs

### Backend
- Quiz sessions can use existing `sessions` table with `series_type: 'quiz'`
- Or create lightweight `quiz_sessions` table
- Evaluation still saved to `session_evaluations` for share functionality

---

## Success Metrics

1. **Completion rate** - % who finish all questions
2. **Share rate** - % who click share after result
3. **Episode 0 conversion** - % who click through to series
4. **Time to complete** - Should be <60 seconds

---

## Phase 1 Scope

1. Single quiz: "What's Your Red Flag?"
2. 5 questions (can add 6th later)
3. Same 5 tropes with existing content
4. Share functionality
5. Episode 0 CTA with 2 series cards

---

## Future Considerations

- Multiple quiz themes (same tropes, different questions)
- Randomize question order
- A/B test question variations
- Add "your match" feature (compare with friends)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-21 | Initial quiz mode spec |
