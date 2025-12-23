# Quiz Strategy v3.0 — The Split

> **Version**: 3.0.0
> **Status**: Active Development
> **Updated**: 2025-12-23

---

## Executive Summary

This document captures the strategic pivot for Play Mode quizzes, including the first principles and industry insights that drove the decision. **Reference this document when creating new quizzes or refactoring existing ones.**

---

## Part 1: First Principles & Industry Insights

### What Makes Personality Tests Go Viral

Based on analysis of successful viral tests (MBTI, Enneagram, Love Languages, BuzzFeed quizzes, attachment style tests), there are **distinct viral mechanics** that drive sharing:

#### Mechanic 1: Identity Validation
> "This is so me"

- User feels *seen* and *understood*
- Result gives them **language for something they've felt but couldn't articulate**
- They share because they want others to understand them better
- Examples: MBTI ("I'm an INFJ"), Attachment Style ("I'm anxious-avoidant"), Enneagram ("I'm a Type 4")

**Key characteristics:**
- Result becomes part of self-description
- Creates vocabulary for identity
- Depth over humor
- User pauses, reflects, feels something

#### Mechanic 2: Social Comparison
> "What did you get?"

- Creates immediate conversation starter
- Implicit ranking/spectrum invites comparison
- They share to see where friends land
- Examples: "How X Are You?" tests, Purity tests, alignment charts

**Key characteristics:**
- Results exist on a spectrum/scale
- Easy to compare ("I'm more X than you")
- Fun over depth
- Instantly shareable, screenshot-able

#### Mechanic 3: Self-Deprecating Humor
> "I feel called out"

- Being "roasted" by the test feels intimate
- Specificity creates "how did it know?" moments
- Humor makes vulnerability safe
- Examples: "Which trash fire are you?", "Your red flags" tests

**Key characteristics:**
- Pointed observations that feel personal
- Funny enough to share without embarrassment
- Roast energy, not therapy energy

### The Critical Insight

**Most failed quizzes try to blend these mechanics.** The result is:
- Not insightful enough to feel like identity validation
- Not funny enough to be pure entertainment
- Feels "halfway there" — neither deep nor delightful

**Successful quizzes pick ONE primary mechanic and optimize ruthlessly for it.**

### MZ (Gen Z/Millennial) Language Considerations

Current vernacular that signals "gets it":
- "unhinged" — positive/neutral, means entertaining chaos
- "feral" — similar to unhinged, implies loss of social restraint
- "delulu" — delusional, often about romantic prospects
- "the ick" — sudden turn-off, often irrational
- "giving..." — "this is giving [energy]"
- "chronically online" — extremely internet-native behavior
- "brainrot" — when internet culture has gone too deep

Avoid:
- "pervert" — dated, carries judgment
- Clinical psychology terms used incorrectly
- Trying too hard to sound young

---

## Part 2: The v2.0 Problem

### Diagnosis

Both quizzes (Romance Quiz, Freak Test) in v2.0 suffered from **mechanic blending**:

| Issue | Evidence |
|-------|----------|
| Trying to be spicy AND insightful | Results had "roast" energy but also tried to be meaningful |
| Questions reveal preferences, not patterns | "What would you do?" vs "Why do you do this?" |
| Results feel like horoscopes | Vague enough to fit anyone |
| "Your people" section feels forced | Generic character references don't land |
| LLM evaluation lacks distinct voice | Both quizzes sound similar |

### User Feedback Signal

"Seems halfway there, not quite intriguing enough" — This is the classic symptom of mechanic blending.

---

## Part 3: The v3.0 Solution

### Strategic Split

Each quiz owns ONE primary mechanic:

| Quiz | Primary Mechanic | Secondary | Forbidden |
|------|-----------------|-----------|-----------|
| **Dating Personality Test** | Identity validation | Light self-deprecation | Pure humor, ranking |
| **The Unhinged Test** | Social comparison | Self-deprecating humor | Deep psychology |

---

## Part 4: Dating Personality Test (Identity Quiz)

### Core Purpose

Give users **language for their dating patterns**. The result should feel like a revelation, not entertainment.

### Viral Mechanic

**Identity validation** — The result becomes part of how they describe themselves.

Target reaction: "Oh, I finally have a word for this thing I do."

### Naming

Options (decide based on testing):
- "What's Your Dating Pattern?"
- "What's Your Love Trap?"
- "What's Your Red Flag?" (current — self-aware angle)

### Tone

**The therapist who just said something uncomfortably accurate.**

- Warm but incisive
- Not trying to be funny — trying to be true
- Specific, not generic
- Should create a "...damn, okay" moment

### Result Types

Reframe existing tropes as **identity patterns** (what they DO and WHY):

| Key | Name | Pattern | Underlying Fear/Need |
|-----|------|---------|---------------------|
| `slow_burn` | SLOW BURN | Uses patience as protection | Fear of wanting something you might not get |
| `second_chance` | SECOND CHANCE | Romanticizes potential over reality | Fear of accepting that something is truly over |
| `all_in` | ALL IN | Uses vulnerability as armor | Fear of being seen as guarded/cold |
| `push_pull` | PUSH & PULL | Creates distance to test closeness | Fear of being trapped or losing independence |
| `slow_reveal` | SLOW REVEAL | Makes people earn access | Fear of being known and rejected anyway |

### Question Philosophy

**Reveal patterns, not preferences.**

| v2.0 (Preference) | v3.0 (Pattern) |
|-------------------|----------------|
| "When you catch feelings, you:" | "You pull away when things get serious because:" |
| "Your biggest dating dealbreaker is:" | "You've ended things right when they got good because:" |
| Surface behavior | Underlying psychology |

### Result Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                          [emoji]                                │
│                                                                 │
│                      your pattern is                            │
│                                                                 │
│                       SLOW BURN                                 │
│                                                                 │
│            you use patience as protection                       │
├─────────────────────────────────────────────────────────────────┤
│  THE TRUTH IS...                                                │
│                                                                 │
│  [One devastating paragraph about their actual pattern.         │
│   Not what they do — why they do it. Should feel like           │
│   being seen by someone who knows them too well.]               │
├─────────────────────────────────────────────────────────────────┤
│  YOU TELL YOURSELF...                                           │
│                                                                 │
│  "I just like when it builds naturally."                        │
│                                                                 │
│  BUT ACTUALLY...                                                │
│                                                                 │
│  You're terrified of wanting something you might not get.       │
│  Patience isn't your virtue — it's your defense.                │
├─────────────────────────────────────────────────────────────────┤
│  WHAT YOU ACTUALLY NEED                                         │
│                                                                 │
│  [Brief, direct. One or two sentences max.]                     │
├─────────────────────────────────────────────────────────────────┤
│  Match strength: 87%                                            │
│  ████████████████░░░░                                           │
└─────────────────────────────────────────────────────────────────┘
```

**REMOVED:**
- ❌ "Your people" (fictional characters)
- ❌ Strengths/Challenges format
- ❌ Compatibility section
- ❌ Anything that dilutes the core insight

### LLM Prompt Direction

The LLM should analyze answers and generate results that feel like:

> "You picked 'wait to see if they reach out first' three times. You call it 'matching energy.' It's not. You're terrified of wanting something you might not get, so you've made patience into a personality trait. The Slow Burn isn't about savoring anticipation — it's about never being the one who wanted it more."

**NOT:**

> "You're a Slow Burn! You value anticipation and enjoy the buildup of romantic tension. Your patient approach means you create deep, meaningful connections."

---

## Part 5: The Unhinged Test (Comparison Quiz)

### Core Purpose

Pure entertainment. Where do you fall on the chaos spectrum?

### Viral Mechanic

**Social comparison** — Users want to know where they land and compare with friends.

Target reaction: "I got Casually Unhinged, what about you?"

### Naming

**"How Unhinged Are You?"**

- Clear spectrum implied
- Current MZ language
- No explanation needed

### Tone

**Your most chaotic friend who has no filter but makes you laugh at yourself.**

- Actively trying to be funny
- Roasting, not analyzing
- Quotable one-liners
- Should make them screenshot immediately

### Result Types (5 Levels)

| Level | Name | Vibe |
|-------|------|------|
| 1 | VANILLA BEAN | "You're the friend who actually reads the terms and conditions" |
| 2 | SPICY CURIOUS | "One foot in chaos, one foot in 'but what would my mom think'" |
| 3 | CASUALLY UNHINGED | "You have stories you only tell after the third drink" |
| 4 | ABSOLUTELY FERAL | "You don't have intrusive thoughts, you ARE the intrusive thought" |
| 5 | CERTIFIED MENACE | "The devil takes notes from you" |

### Question Philosophy

**Scenarios that expose behavior.** The funnier and more specific, the better.

Good energy:
- "It's 2am and you can't sleep. You:"
- "Your ex's new partner follows you on Instagram. You:"
- "The group chat has been quiet for 3 hours. You:"
- "You're slightly tipsy and have your phone. You:"

### Result Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                          [emoji]                                │
│                                                                 │
│                    your unhinged level                          │
│                                                                 │
│                   CASUALLY UNHINGED                             │
│                                                                 │
│        "you've seen things. you've done things."                │
├─────────────────────────────────────────────────────────────────┤
│  [Short, punchy description. 2-3 sentences max.                 │
│   Should be quotable on its own.]                               │
├─────────────────────────────────────────────────────────────────┤
│  WE NOTICED...                                                  │
│                                                                 │
│  • [Specific roast about their answer #1]                       │
│  • [Specific roast about their answer #2]                       │
│  • [Specific roast about their answer #3]                       │
├─────────────────────────────────────────────────────────────────┤
│  VIBE CHECK                                                     │
│                                                                 │
│  "[One devastating/hilarious sentence that captures             │
│    their chaos energy. Should be screenshot-worthy.]"           │
├─────────────────────────────────────────────────────────────────┤
│  ░░░░░░░░░░████████████░░░░░░░░░░                               │
│  vanilla        ↑ you        menace                             │
└─────────────────────────────────────────────────────────────────┘
```

**REMOVED:**
- ❌ Deep psychological analysis
- ❌ "Your people" section
- ❌ Advice section
- ❌ Anything that kills the fun

### LLM Prompt Direction

The LLM should generate results that feel like:

> "You said you'd 'check their profile 3 times that day' — bestie that's not checking, that's surveillance. You picked 'send a meme at 3am' like that's normal behavior. Your screen time is a crime scene. You're not casually unhinged, you're running a full operation from your Notes app."

**NOT:**

> "Based on your answers, you exhibit moderate chaos tendencies. You balance spontaneity with self-awareness and know when to embrace your wilder side."

---

## Part 6: Implementation Checklist

### Documentation Updates

- [x] Strategy document (this file)
- [ ] Update README.md to reference v3.0
- [ ] Archive or update TROPE_CONTENT_SPEC.md
- [ ] Archive or update QUIZ_MODE_SPEC.md

### Dating Personality Test

- [ ] Rewrite 5 questions (pattern-focused)
- [ ] Rewrite result content for each type
- [ ] Update LLM prompt in `quiz.py`
- [ ] Update frontend result component
- [ ] Remove "your people" section
- [ ] Test evaluation quality

### Unhinged Test

- [ ] Polish/rewrite questions if needed
- [ ] Rewrite result content (punchier)
- [ ] Update LLM prompt in `quiz.py`
- [ ] Update frontend result component
- [ ] Add spectrum visualization
- [ ] Remove any depth/advice sections
- [ ] Test evaluation quality

### Shared

- [ ] Update share text formats
- [ ] Update OG image generation
- [ ] Update ShareResultClient.tsx

---

## Part 7: File Reference

| File | Purpose | v3.0 Changes Needed |
|------|---------|---------------------|
| `web/src/lib/quiz-data.ts` | Question definitions | Rewrite questions |
| `web/src/app/play/romance/page.tsx` | Romance quiz page | Update result display |
| `web/src/app/play/freak/page.tsx` | Freak test page | Update result display |
| `web/src/app/r/[shareId]/ShareResultClient.tsx` | Share page | Remove "your people" |
| `substrate-api/.../services/quiz.py` | LLM evaluation | Rewrite prompts |
| `substrate-api/.../models/evaluation.py` | Result types | May need updates |

---

## Part 8: Success Metrics

### Dating Personality Test

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Time on result page | >45s | They're reading and absorbing |
| Share text includes type name | 80%+ | Identity adoption working |
| Return visits | 20%+ | Depth creates stickiness |
| "This is so me" sentiment | Qualitative | Core mechanic landing |

### Unhinged Test

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Screenshot rate | High | Results are visually quotable |
| Share completion | 50%+ | Social comparison working |
| Completion rate | 95%+ | Fun = no drop-off |
| Friend tag/comparison | Qualitative | "What did you get?" happening |

---

## Part 9: Open Questions

1. **Naming for Dating Test**: Keep "What's Your Red Flag?" or pivot to "What's Your Dating Pattern?"
2. **Question count**: 5 questions enough signal, or increase to 7?
3. **Result depth**: How much text before identity test feels like homework?
4. **Spectrum visualization**: How prominently to show ranking in Unhinged Test?

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0.0 | 2025-12-23 | Strategic split: Identity test vs. Social comparison test. Added first principles documentation. |
| 2.0.0 | 2025-12-21 | Quiz-based approach, LLM evaluation added |
| 1.0.0 | 2024-12-20 | Original conversation-based Play Mode |
