# Romantic Trope Content Specification

> **Version**: 2.0.0
> **Status**: Canonical
> **Updated**: 2025-12-20

---

## Overview

This document defines the content for the 5 romantic tropes used in Play Mode. The content is designed for **maximum virality** with MBTI/personality test energy - the kind of result that makes people screenshot and share.

**Design Principle**: Unhinged but affectionate. Make them feel seen. Make them laugh. Make them share.

---

## The 5 Romantic Tropes — Unhinged Edition

### 1. SLOW BURN

**Tagline**: the tension is the whole point and you know it

**Description**:
You'd rather wait three seasons for a kiss than rush it. You've said "I just think it's better when it builds" at least once this month. Eye contact across a room? That's your whole love language. You're not playing hard to get — you genuinely believe anticipation is the best part. Other people think you're patient. You know you're just savoring it.

**Callback Format**:
`You told {character}: "{quote}" ...yeah, we clocked you immediately.`

**Your People**:
darcy & elizabeth • jim & pam • connell & marianne

**Share Text**:
`I'm a SLOW BURN — the tension is the whole point. what's yours?`

---

### 2. SECOND CHANCE

**Tagline**: you never really closed that chapter, did you

**Description**:
You still think about the one that got away. Not in a sad way — in a "the timing was just wrong" way. You believe some people are meant to find their way back to each other. Reunion episodes are your weakness. You've definitely stalked an ex's Instagram "just to see how they're doing." You're not hung up on the past — you just think some stories deserve a second draft.

**Callback Format**:
`You told {character}: "{quote}" ...you're already writing the sequel in your head.`

**Your People**:
mia & sebastian • noah & allie • jesse & céline

**Share Text**:
`I'm a SECOND CHANCE — some stories deserve a sequel. what's yours?`

---

### 3. ALL IN

**Tagline**: when you know, you know — and you KNEW

**Description**:
You don't do slow. You don't do games. When you feel it, you say it, and honestly? That's terrifying to most people. You've been called "intense" like it's a bad thing. It's not. You'd rather be rejected for being honest than liked for being careful. While everyone else is calculating their next move, you already made yours. Life's too short to pretend you don't care.

**Callback Format**:
`You told {character}: "{quote}" ...no hesitation. respect.`

**Your People**:
rachel & nick • lara jean & peter • jake & amy

**Share Text**:
`I'm ALL IN — when I know, I know. what's yours?`

---

### 4. PUSH & PULL

**Tagline**: you want them to work for it (and you'll work for it too)

**Description**:
Hot then cold. Close then distant. It's not games — it's tension, and you're fluent in it. You flirt by arguing. You show love by teasing. The chase is half the fun and you refuse to apologize for it. People say they want straightforward, but they keep coming back to you. You're exhausting in the best way. Boring could never be your problem.

**Callback Format**:
`You told {character}: "{quote}" ...push, pull, we see you.`

**Your People**:
kat & patrick • jess & nick • lorelai & luke

**Share Text**:
`I'm a PUSH & PULL — the chase is half the fun. what's yours?`

---

### 5. SLOW REVEAL

**Tagline**: they have to earn the real you

**Description**:
You're not cold — you're careful. There's a version of you that most people get, and then there's the version that only comes out when someone proves they're paying attention. You test people without them knowing. You reward curiosity and punish assumptions. People call you "mysterious" and you let them, because explaining yourself sounds exhausting. The right person will figure it out.

**Callback Format**:
`You told {character}: "{quote}" ...you let that one slip, didn't you.`

**Your People**:
jane & rochester • fleabag & the priest • bella & edward

**Share Text**:
`I'm a SLOW REVEAL — you have to earn the real me. what's yours?`

---

## Result Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│                          [emoji]                            │
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
│  You told Jack: "I like taking my time"                     │
│  ...yeah, we clocked you immediately.                       │
├─────────────────────────────────────────────────────────────┤
│                      your people                            │
│        darcy & elizabeth • jim & pam • connell & marianne   │
├─────────────────────────────────────────────────────────────┤
│  match ─────────────────────────────────────── 87%          │
└─────────────────────────────────────────────────────────────┘

                    [ share result ]

                      [ try again ]

                      ep-0.com/play
```

---

## Share Infrastructure

### Share Text
Pre-formatted for each trope, ready to copy/paste or share via native share sheet.

### OG Image (1200x630)

```
┌─────────────────────────────────────┐
│                                     │
│         I'm a SLOW BURN             │
│                                     │
│   the tension is the whole point    │
│                                     │
│      what's your romantic trope?    │
│           ep-0.com/play             │
│                                     │
└─────────────────────────────────────┘
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-12-20 | Complete rewrite - maximum virality, MBTI energy |
| 1.0.0 | 2025-12-20 | Initial spec (deprecated) |
