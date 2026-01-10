# Activation & Growth Analysis

> Last updated: 2026-01-09
> Status: Early data collection phase

## Current Metrics (as of Jan 10, 2026)

| Metric | Value | Notes |
|--------|-------|-------|
| Total Signups | ~14 | Excluding test accounts |
| Engaged Users | 3 | Sent 1+ messages |
| Activation Rate | 21% | Signups → First message |
| Paid Users | 1 | Premium subscription |
| Visitor → Signup | 2.7% | 520 visitors → 14 signups |
| Bounce Rate | 89% | Homepage, pre-fix |

## Key Insights: Activation + Traffic Issues

### Problem #1: 79% Never Send a Message
After fixing Episode 0 paywall, activation improved from 15% → 21%, but still 79% of signups never engage.

### Problem #2: 89% Bounce Rate
**Root cause identified**: Message mismatch between ads and landing pages.

| Issue | Details |
|-------|---------|
| **TikTok ads** | Series-specific ("You wake up as Lady Verlaine") |
| **Landing page** | Generic platform messaging ("Live the story") |
| **Post-signup** | Redirected to `/discover` (catalog view, not the series they wanted) |
| **Result** | Confusion → Bounce |

### Problem #3: TikTok Mistargeting
- 74% of traffic from South Korea (361/520 visitors)
- Product is English-only
- Explains 30-40% of bounce rate

---

## Issues Fixed

| Issue | Status | Date Fixed | Impact |
|-------|--------|------------|--------|
| Episode 0 charged 3 Sparks instead of 0 | ✅ Fixed | 2026-01-09 | Activation 15% → 21% |
| Series pages login-gated | ✅ Fixed | 2026-01-10 | TBD (measuring) |
| Homepage routes to `/discover` instead of `/dashboard` | ✅ Fixed | 2026-01-10 | TBD (measuring) |
| TikTok ads target South Korea | 🔄 In progress | User fixing | TBD |

## Funnel Analysis

### Current (Pre-Fix, Jan 10)
```
520 visitors (100%)
    ↓ 2.7% convert
14 signups (2.7%)
    ↓ 21% activate  ← BOTTLENECK
3 engaged users (0.6% of visitors)
    ↓ 33% convert
1 paid user (7% of signups, 33% of engaged)
```

### Projected (Post-Fix, with series-specific landing pages)
```
520 visitors (100%)
    ↓ 10% convert (4x improvement)
52 signups (10%)
    ↓ 60% activate (3x improvement)
31 engaged users (6% of visitors)
    ↓ 10% convert
3 paid users
```

**Key levers**:
1. Series-specific landing pages → 2.7% → 10% signup rate
2. Dashboard routing → 21% → 60% activation rate
3. Result: 0.6% → 6% visitor-to-engaged conversion (10x improvement)

## User Behavior Patterns

| Pattern | Count | Likely Cause |
|---------|-------|--------------|
| Signed up, never opened chat | 9 | Onboarding unclear, paywall |
| Opened chat, sent 0 msgs | 2 | Confused by UI, waiting for AI |
| Sent messages, engaged | 2 | Success case |

## Hypotheses to Test

### Why users don't activate

1. **Paywall on Episode 0** (fixed) - New users had 0 Sparks, Episode 0 cost 3
2. **Category confusion** - Expect a game/visual novel, see chat UI
3. **No clear "start here"** - Don't know what to click after signup
4. **Waiting for AI** - Don't realize they need to send first message

### Fixes Implemented (Jan 10, 2026)

| Priority | Fix | Status | Impact |
|----------|-----|--------|--------|
| P0 | Episode 0 free | ✅ Done | Activation +6% |
| P0 | Series pages public (ungated) | ✅ Done | Signup rate 2.7% → 10% (projected) |
| P0 | Homepage routes to /dashboard | ✅ Done | Activation 21% → 60% (projected) |
| P0 | TikTok exclude South Korea | 🔄 User fixing | Bounce 89% → 60% (projected) |

### Future Fixes (Not Needed Yet)

| Priority | Fix | Effort | Notes |
|----------|-----|--------|-------|
| P1 | Auto-send opening message | Medium | Wait for data post-fix |
| P2 | "Start here" CTA emphasis | Low | Already exists on /dashboard |
| P3 | Instant demo (5 free messages) | High | Defer until activation measured post-fix |
| P4 | Onboarding tooltip/tour | Medium | Low ROI, defer |

## Reddit Ads Performance

### Current Campaign: reddit_romance

| Metric | Value |
|--------|-------|
| Spend | $5.82 |
| Impressions | 10,082 |
| Clicks | 40 |
| CPC | $0.15 |
| CTR | 0.397% |

### New Campaigns (Created Jan 9)

**otome_isekai**
- Target: r/OtomeIsekai, r/otomegames, r/RomanceBooks, r/shoujo
- Series: Villainess Survives, Death Flag: Deleted
- Headlines:
  - "Transmigrated as the villainess. Now what?"
  - "You know how this novel ends. Change it."
  - "The death flag is in 6 days. Survive."

**manhwa_regressor**
- Target: r/manhwa, r/sololeveling, r/OmniscientReader
- Series: Regressor's Last Chance
- Headlines:
  - "You died. You regressed. Rewrite the ending."
  - "The Hero failed. This time, you won't."
  - "10 years back. You remember everything."

### CTA Considerations

Reddit CTAs are pre-set (not customizable). Options:

| CTA | Recommendation |
|-----|----------------|
| "Learn More" | Safer - sets expectation of info page first |
| "Play Now" | Higher intent but risks expectation mismatch |
| "Sign Up" | Honest but lower CTR |
| "Get Started" | Good middle ground |

**Current choice: "Learn More"** - More honest about the flow, reduces bounce from users expecting instant gameplay.

### Category Education Challenge

Users from Reddit romance/manhwa communities may not understand "interactive chat fiction" as a category. They might expect:
- Visual novel
- Mobile game
- Quiz

**Potential solutions:**
- Landing page copy: "It's like texting a character from your favorite manhwa"
- Show chat UI screenshot/GIF on landing page
- Ad copy that sets expectations: "Text-based interactive story"

## Conversion Benchmarks

| Metric | Industry Typical | Our Target |
|--------|------------------|------------|
| Free → Paid | 2-5% | 3% |
| Freemium games | 1-3% | - |
| Niche passionate audience | 5-10% | 5% |

## Pre-Seed VC Readiness

### What VCs want to see

| Signal | Threshold | Our Status |
|--------|-----------|------------|
| Retention D7 | >20% | Unknown |
| Retention D30 | >10% | Unknown |
| Conversion | 2-3%+ | Unknown |
| MRR | $1-5K | $0 |
| Signups | 500-1000 | 13 |

### Milestones before VC conversations

1. [ ] 100 signups
2. [ ] 20+ engaged users (sent messages)
3. [ ] Measure activation rate post-Episode-0-fix
4. [ ] First organic paid conversion
5. [ ] D7 retention data

**Estimated timeline:** 4-6 weeks at current ad spend

## Next Actions

### This Week
- [x] Fix Episode 0 paywall (done)
- [ ] Launch otome_isekai campaign
- [ ] Launch manhwa_regressor campaign
- [ ] Monitor next 20 signups for activation

### Next 2 Weeks
- [ ] Reach 50 signups
- [ ] Measure post-fix activation rate
- [ ] Interview churned users (if possible)
- [ ] Decide on P1 fix (auto-send opening message?)

### Month 1 Goals
- [ ] 100 signups
- [ ] 20+ engaged users
- [ ] First paid conversion
- [ ] Identify top-performing ad campaign/audience

## Series-Specific Landing Page Strategy (Jan 10, 2026)

### The Problem We Solved

**Before**:
- TikTok ads: "You wake up as Lady Verlaine" (series-specific)
- User clicks → Generic homepage ("Live the story")
- Confusion → 89% bounce rate
- Post-signup → Redirected to `/discover` (catalog, not the series)
- Result: 2.7% signup, 21% activation

**After**:
- TikTok ads: Same series-specific content
- User clicks → **Series page** (`/series/the-villainess-survives`)
- See exact story they clicked on
- Clear "Start Episode 0 Free" CTA
- Post-signup → Direct to episode chat
- Projected: 10% signup, 60% activation

### URL Structure (CRITICAL REFERENCE)

**All ads and TikTok links MUST use series-specific URLs**:

```
Format: https://ep-0.com/series/[series-slug]

Examples:
- https://ep-0.com/series/the-villainess-survives  (Otome Isekai)
- https://ep-0.com/series/death-flag-deleted       (Manhwa Regressor)
- https://ep-0.com/series/midnight-burn            (K-pop Idol)
- https://ep-0.com/series/corner-office            (CEO Romance)
```

### Finding Series Slugs

**Method 1: Via Web UI**
1. Go to `/discover` page (when logged in)
2. Click any series card
3. URL shows the slug: `/series/[this-is-the-slug]`

**Method 2: Via API**
```bash
curl https://api.ep-0.com/series?status=active | jq '.[] | {title, slug}'
```

### When to Use Generic Homepage

**Use `ep-0.com` ONLY for**:
- Brand awareness (no specific series)
- Press mentions
- Direct navigation
- Generic social media bios

**For all series-specific content** → Always use `/series/[slug]` URLs

---

## Appendix: User Engagement Data (Jan 9)

| User | Messages | Sessions | Status | Signed Up |
|------|----------|----------|--------|-----------|
| kevin | 26 | 7 | Engaged | Dec 12 |
| User | 30 | 2 | Engaged | Jan 8 |
| Hubba Subba | 0 | 1 | Opened, didn't send | Jan 8 |
| Nicky Nicholas | 0 | 1 | Opened, didn't send | Dec 17 |
| Others (9) | 0 | 0 | Never tried | Various |
