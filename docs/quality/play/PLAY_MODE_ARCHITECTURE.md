# Play Mode Architecture

> **Version**: 1.2.0
> **Status**: Canonical
> **Updated**: 2025-12-20

---

## Overview

Play Mode is a **bounded episode experience** within the existing series architecture. It serves as:
- **Viral entry point** — shareable, low-commitment experiences
- **Customer acquisition channel** — result screen is the conversion point
- **Product demo** — users experience core value (AI conversation) before signup

---

## Content Isolation

### series_type: "play"

Play Mode content uses `series_type: "play"` to isolate from core experience:

```python
{
    "series_type": "play",  # NOT "standalone"
    # ...
}
```

**Filtering Behavior**:

| Endpoint | Default Behavior |
|----------|-----------------|
| `GET /series` | Excludes `series_type = 'play'` |
| `GET /series?include_play=true` | Includes play content |
| `GET /series?series_type=play` | Only play content |
| Homepage / Browse | Never shows play content |
| `/play` routes | Only shows play content |

**Implementation** (already in `routes/series.py`):
```python
if not include_play and not series_type:
    query += " AND series_type != 'play'"
```

**Migration Required**: Add 'play' to series_type CHECK constraint:
```sql
ALTER TABLE series DROP CONSTRAINT IF EXISTS series_series_type_check;
ALTER TABLE series ADD CONSTRAINT series_series_type_check
    CHECK (series_type IN ('standalone', 'serial', 'anthology', 'crossover', 'play'));
```

---

## Routing

```
ep-0.com/play                        → Landing page for all play experiences
ep-0.com/play/hometown-crush         → Play mode for Hometown Crush
ep-0.com/series/hometown-crush       → Full series page (existing)
ep-0.com/r/[share_id]                → Public result view
```

### Rationale

| Route | Purpose |
|-------|---------|
| `/play` | Viral entry point — clean, shareable, discoverable |
| `/play/[series-slug]` | Series connection without nested complexity |
| `/series/[slug]` | Full experience entry for organic/returning users |
| `/r/[id]` | Short for sharing (like youtu.be links) |

---

## Auth Flow

```
/play → Select experience → 4 turns (anonymous) → Result (anonymous) → Share (anonymous)
                                                                     ↓
                                                        "Continue with Jack" → Auth gate
                                                        "Try another series" → Auth gate
                                                        "Save to profile"    → Auth gate
```

**Key Principle**: The result screen is the end of the free experience. Everything after requires account.

---

## Experience Flow

### 1. Entry (`/play/hometown-crush`)

User lands on play page:
- Character introduction (Jack)
- Situation preview (coffee shop, hometown return)
- "Start" CTA

### 2. Conversation (4 turns)

Anonymous session:
- Director tracks turn count
- 4 turns is enough to demo product and assess trope (virality favors speed)
- Post-evaluation detects signals for trope classification
- No auth required
- Target: shareable result in 2-3 minutes

### 3. Result (`/play/hometown-crush/result`)

Anonymous result display:
- Trope assignment (e.g., "The Slow Burn")
- Personalized evidence ("Why this fits you")
- Callback quote ("Your moment")
- Cultural references ("Slow Burns in the wild")
- Share CTA (primary)
- Continue/Save CTAs (auth-gated)

### 4. Share (`/r/[share_id]`)

Public result view:
- Same result card
- Share count
- "Take the test" CTA
- Dynamic OG metadata for social previews

---

## Architecture Decisions

### Bounded Episode Model

Play experiences use the **existing episode architecture**:

```python
# Episode Template Configuration
{
    "completion_mode": "turn_limited",
    "turn_budget": 4,  # Reduced from 7 - virality favors speed
    "completion_criteria": {
        "evaluation_type": "romantic_trope"  # or "flirt_archetype" for v1
    }
}
```

**Why**: Infrastructure already exists for turn tracking, Director integration, completion detection. No parallel system needed.

### Anonymous Sessions

Anonymous users receive a disposable UUID that doesn't persist beyond the session:

```python
# Anonymous session handling in games.py
async def get_game_user_id(
    user_id: Optional[UUID] = Depends(get_optional_user_id),
    x_anonymous_id: Optional[str] = Header(None, alias="X-Anonymous-Id"),
) -> UUID:
    """Get user ID for games - authenticated user or anonymous session."""
    # Prefer authenticated user
    if user_id:
        return user_id
    # Use anonymous ID from header if provided
    if x_anonymous_id:
        try:
            return UUID(x_anonymous_id)
        except ValueError:
            pass
    # Generate new anonymous ID
    return uuid4()
```

**Client Flow**:
1. `/start` returns `anonymous_id` for anonymous users
2. Client stores in sessionStorage
3. Subsequent calls include `X-Anonymous-Id` header
4. Session is linked to user on auth conversion

**Conversion Flow**:
1. Anonymous session completes
2. Evaluation created with `share_id`
3. User clicks "Continue with Jack"
4. Auth gate → Account created
5. Session linked to new `user_id`
6. Full series unlocked

### Evaluation Storage

Evaluations are stored in `session_evaluations`:

```sql
CREATE TABLE session_evaluations (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    evaluation_type TEXT NOT NULL,      -- 'flirt_archetype', 'romantic_trope'
    result JSONB NOT NULL,              -- Trope data + evidence
    share_id TEXT UNIQUE,               -- 8-char URL-safe ID
    share_count INT DEFAULT 0,
    model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Director Integration

Play Mode uses Director Protocol v2.0:

### Phase 1: Pre-Guidance

Before character response:
- Pacing phase based on turn position (7-turn arc)
- Genre beat injection (romantic_tension)
- Physical anchor from situation
- Tension note (lightweight LLM call)

### Phase 2: Post-Evaluation

After character response:
- Signal detection for trope classification
- Completion status check
- Memory extraction (for continuation)

### Completion Trigger

```python
# In DirectorService.process_exchange()
if turn_count >= turn_budget:
    # Generate evaluation
    evaluation = await self.generate_evaluation(
        session_id=session.id,
        evaluation_type="romantic_trope",
        messages=messages,
        director_state=session.director_state,
    )
    return DirectorOutput(
        is_complete=True,
        evaluation=evaluation,
        trigger="turn_limit",
    )
```

---

## Content Requirements

### Character Selection: Male & Female Options

Like Flirt Test v1, Hometown Crush offers **two character variants**:

| Variant | Character | Series Slug | Notes |
|---------|-----------|-------------|-------|
| Male | Jack | `hometown-crush-m` | "Your high school almost-something" |
| Female | Emma | `hometown-crush-f` | "The one who got away" |

**User Flow**:
1. User lands on `/play/hometown-crush`
2. Character selection screen (Jack or Emma)
3. Selection routes to appropriate series (`hometown-crush-m` or `hometown-crush-f`)
4. Same evaluation, different character voice

### Series Configuration (x2)

```python
# Male variant
{
    "title": "Hometown Crush",
    "slug": "hometown-crush-m",
    "tagline": "You're back in your hometown...",
    "series_type": "play",  # Isolates from core
    "genre": "romantic_tension",
    "status": "active",
}

# Female variant
{
    "title": "Hometown Crush",
    "slug": "hometown-crush-f",
    "tagline": "You're back in your hometown...",
    "series_type": "play",
    "genre": "romantic_tension",
    "status": "active",
}
```

### Character Configuration (x2)

```python
# Jack (male)
{
    "name": "Jack",
    "slug": "jack-hometown",
    "personality_summary": "Your high school almost-something. You never quite figured out what you were back then.",
    "system_prompt": "...",  # Optimized for trope signal detection
}

# Emma (female)
{
    "name": "Emma",
    "slug": "emma-hometown",
    "personality_summary": "The one who got away. She still has that look in her eyes.",
    "system_prompt": "...",  # Same trope detection, different voice
}
```

### Episode Template Configuration (x2)

```python
# Same template structure for both, different opening lines
{
    "title": "The Reunion",
    "slug": "the-reunion",
    "episode_type": "entry",
    "completion_mode": "turn_limited",
    "turn_budget": 4,  # Reduced from 7 - virality favors speed
    "situation": "Coffee shop. You're back in your hometown for the first time in years. You didn't expect to see them here.",
    "opening_line": "...",  # Character-specific
    "dramatic_question": "Will old feelings resurface, or have you both changed too much?",
    "completion_criteria": {
        "evaluation_type": "romantic_trope"
    }
}
```

---

## Frontend Components

### Required Pages

| Route | Component | Status |
|-------|-----------|--------|
| `/play` | PlayLandingPage | 🔄 New |
| `/play/[slug]` | PlayStartPage | 🔄 Adapt from flirt-test |
| `/play/[slug]/chat` | PlayChatPage | 🔄 Adapt from flirt-test |
| `/play/[slug]/result` | PlayResultPage | 🔄 Enhance for tropes |
| `/r/[shareId]` | ShareResultPage | ✅ Exists |

### Required Components

| Component | Purpose | Status |
|-----------|---------|--------|
| TropeResultCard | Display trope with evidence | 🔄 New |
| PersonalizedEvidence | "Why this fits you" section | 🔄 New |
| CallbackQuote | "Your moment" quote display | 🔄 New |
| CulturalReferences | "In the wild" examples | 🔄 New |
| ShareCard | OG image preview | 🔄 Redesign |

---

## API Endpoints

### Existing (Reusable)

```
POST /games/{game_slug}/start          → Start session
POST /games/{game_slug}/{id}/message   → Send message
GET  /games/{game_slug}/{id}/result    → Get result
GET  /games/r/{share_id}               → Public result
POST /games/r/{share_id}/view          → Track view
```

### New (If Needed)

```
GET /play                              → List play experiences
GET /play/{slug}                       → Get play experience metadata
```

---

## Share Infrastructure & Virality (First-Class Concern)

Shareability is the **core growth mechanism** for Play Mode. Every decision should optimize for share rate and click-through.

### Share Link Anatomy

```
https://ep-0.com/r/abc12345
         └─────┬─────┘└──┬──┘
           short path   8-char ID
```

**Why `/r/`**:
- Short (like youtu.be, bit.ly)
- Memorable
- Doesn't reveal product structure
- Works in character-limited contexts (Twitter, SMS)

### Share Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      RESULT SCREEN                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ Share My Result ]  ← PRIMARY CTA (largest, most prominent)   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [ Continue with Jack → ]  ← Auth-gated                         │
│  [ Save to Profile ]       ← Auth-gated                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Share Button Behavior

```typescript
const handleShare = async () => {
  const shareData = {
    title: `I'm ${result.title}!`,
    text: `I'm ${result.title}! What's your romantic trope?`,
    url: `${window.location.origin}/r/${result.share_id}`,
  };

  // 1. Try native share (mobile-first)
  if (navigator.share && navigator.canShare(shareData)) {
    await navigator.share(shareData);
    trackEvent('share_native', { trope: result.trope });
    return;
  }

  // 2. Fallback: Copy to clipboard
  await navigator.clipboard.writeText(
    `${shareData.text} ${shareData.url}`
  );
  trackEvent('share_copy', { trope: result.trope });
  showToast('Link copied!');
};
```

### OG Metadata (Critical for Click-Through)

The share link MUST have compelling OG tags:

```html
<!-- /r/[shareId] page -->
<meta property="og:title" content="I'm a Slow Burn!" />
<meta property="og:description" content="I know the best things take time. What's your romantic trope?" />
<meta property="og:image" content="https://ep-0.com/og/trope/slow_burn.png" />
<meta property="og:url" content="https://ep-0.com/r/abc12345" />
<meta name="twitter:card" content="summary_large_image" />
```

**OG Image Requirements**:
- 1200x630px (optimal for Facebook/LinkedIn/Twitter)
- Trope name prominent
- Tagline included
- Clear CTA: "What's your romantic trope?"
- ep-0 branding subtle but present

### Share Page Flow

```
User clicks shared link → /r/abc12345
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SHARE PAGE                                  │
├─────────────────────────────────────────────────────────────────┤
│  "Someone shared their result"                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │            THE SLOW BURN                                │   │
│  │     "You know the best things take time"                │   │
│  │                                                         │   │
│  │     [Result card - same as original]                    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Shared 47 times                                                │
│                                                                 │
│  [ What's YOUR Romantic Trope? ]  ← PRIMARY CTA                 │
│                                                                 │
│  [ Share This Result ]            ← Secondary                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Routes to /play/hometown-crush
```

### Post-Auth Flow (Conversion Point)

When user clicks "Continue with [Character]" or "Save to Profile":

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUTH MODAL                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Continue your story with Jack                                  │
│                                                                 │
│  [ Sign in with Google ]                                        │
│  [ Sign in with Apple ]                                         │
│                                                                 │
│  ─── or ───                                                     │
│                                                                 │
│  [ Continue with Email ]                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (after auth)
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION LINKING                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Link anonymous session to new user_id                       │
│  2. Save evaluation to user profile                             │
│  3. Unlock full series access                                   │
│  4. Redirect to /series/hometown-crush (full experience)        │
└─────────────────────────────────────────────────────────────────┘
```

### Analytics Events (Virality Tracking)

| Event | Trigger | Properties |
|-------|---------|------------|
| `play_start` | User starts experience | `series_slug`, `character` |
| `play_complete` | 4 turns finished | `series_slug`, `trope`, `confidence` |
| `share_attempt` | Share button clicked | `trope`, `method` |
| `share_success` | Share completed | `trope`, `method` |
| `share_click` | Someone clicks share link | `share_id`, `referrer` |
| `share_to_play` | Share viewer starts test | `share_id`, `trope` |
| `auth_gate_shown` | Auth modal appears | `trigger` (continue/save) |
| `auth_complete` | User creates account | `method`, `from_share` |

### Viral Coefficient Calculation

```
K = (share_rate) × (click_through_rate) × (completion_rate)

Example:
K = 0.35 × 0.25 × 0.75 = 0.066

For each completer:
- 35% share
- Of shares, 25% get clicked
- Of clickers, 75% complete

100 completers → 35 shares → 8.75 visitors → 6.56 completers → 2.3 shares...

Total organic multiplier: 1 / (1 - K) ≈ 1.07x
```

**Target**: K > 0.1 for meaningful organic amplification.

---

## Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Play Start Rate | 80% | Of visitors to `/play/hometown-crush` |
| Completion Rate | 85% | Of those who start (4 turns is very short) |
| **Share Rate** | **35%** | **Of completers — the key viral metric** |
| **Click-through on Shares** | **25%** | **Recipients who visit** |
| Account Creation | 15% | Of completers (share OR continue) |
| Continue with Character | 40% | Of account creators |
| Paid Conversion | 10% | Of those who continue (longer term) |

**Viral Coefficient Target**: K > 0.1

At 35% share and 25% CTR: K-factor ≈ 0.066. Meaningful organic amplification on top of paid/organic acquisition.

---

## Migration Path

### From Flirt Test v1 to Romantic Trope v2

1. **Preserve existing**: Keep `/play/flirt-test` working
2. **Add new content**: Create Hometown Crush series + Jack character
3. **Extend evaluation**: Add `romantic_trope` evaluation type
4. **Build new UI**: TropeResultCard with evidence sections
5. **Launch at `/play`**: Landing page with Hometown Crush featured
6. **Deprecate v1**: Eventually sunset flirt-test

### Backward Compatibility

- `evaluation_type: "flirt_archetype"` continues to work
- Existing share links remain functional
- No breaking changes to API

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [TROPE_SYSTEM.md](TROPE_SYSTEM.md) | Trope taxonomy and behavioral signals |
| [RESULT_REPORT_SPEC.md](RESULT_REPORT_SPEC.md) | Result page design spec |
| [DIRECTOR_PROTOCOL.md](../core/DIRECTOR_PROTOCOL.md) | Director evaluation logic |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2025-12-20 | Reduced turn_budget from 7 to 4, implemented anonymous sessions via X-Anonymous-Id header, updated opening lines to front-load tension |
| 1.1.0 | 2024-12-20 | Added share infrastructure details |
| 1.0.0 | 2024-12-20 | Initial Play Mode architecture |
