# UTM Tracking Implementation - COMPLETE

> **Status**: ✅ Implementation Complete - Ready for Testing
> **Date**: 2026-01-12

---

## What Was Implemented

UTM tracking and campaign attribution has been fully implemented across the stack. You can now track which campaigns drive signups and which users activate.

---

## Files Changed

### Frontend

1. **[web/src/lib/utils/attribution.ts](../../web/src/lib/utils/attribution.ts)** - NEW
   - Utility functions to capture and store UTM parameters
   - Uses localStorage to persist through auth flow

2. **[web/src/components/AttributionSaver.tsx](../../web/src/components/AttributionSaver.tsx)** - NEW
   - Client component that saves attribution to database after auth
   - Runs once per user, only if not already saved

3. **[web/src/app/series/[slug]/page.tsx](../../web/src/app/series/[slug]/page.tsx)** - MODIFIED
   - Added `captureAttribution()` call on page load
   - Stores UTM params when user lands from ad

4. **[web/src/app/(dashboard)/layout.tsx](../../web/src/app/(dashboard)/layout.tsx)** - MODIFIED
   - Added `<AttributionSaver />` component
   - Runs after authentication to save attribution data

5. **[web/src/app/admin/page.tsx](../../web/src/app/admin/page.tsx)** - MODIFIED
   - Added "Source" and "Campaign" columns to user table
   - Added "Campaign Performance" card showing activation rates by campaign
   - Updated CSV export to include attribution data

6. **[web/src/types/index.ts](../../web/src/types/index.ts)** - MODIFIED
   - Added attribution fields to `AdminUserEngagement` interface

### Backend

7. **[substrate-api/api/src/app/routes/admin.py](../../substrate-api/api/src/app/routes/admin.py)** - MODIFIED
   - Added attribution fields to `UserEngagement` model
   - Updated SQL query to fetch attribution data
   - Returns attribution in API response

### Database

8. **[supabase/migrations/057_utm_tracking.sql](../../supabase/migrations/057_utm_tracking.sql)** - NEW
   - Adds 6 new columns to users table:
     - `signup_source` (utm_source)
     - `signup_campaign` (utm_campaign)
     - `signup_medium` (utm_medium)
     - `signup_content` (utm_content)
     - `signup_landing_page` (first page visited)
     - `signup_referrer` (HTTP referrer)
   - Creates indexes for filtering

---

## How It Works

### 1. User Lands from Ad

```
User clicks: https://ep-0.com/series/villainess-survives?utm_source=reddit&utm_campaign=oi-v2&utm_medium=cpc
                                                          ↓
Series page loads → captureAttribution() runs → Stores in localStorage:
{
  source: "reddit",
  campaign: "oi-v2",
  medium: "cpc",
  landingPage: "/series/villainess-survives",
  referrer: "https://www.reddit.com"
}
```

### 2. User Signs Up

```
User clicks "Start Episode" → Redirected to /login
                           ↓
OAuth flow completes → Redirected back to app
                    ↓
User lands on /dashboard (authenticated)
```

### 3. Attribution Saved

```
Dashboard loads → AttributionSaver component runs
               ↓
Checks: Is user authenticated? Yes
Checks: Attribution in localStorage? Yes
Checks: Already saved in database? No
               ↓
Saves to database → Clears localStorage
               ↓
Done! Attribution is now tied to user record.
```

### 4. View in Admin Dashboard

```
/admin page → Fetches users with attribution
           ↓
User Table shows:
- Source: reddit
- Campaign: oi-v2

Campaign Performance card shows:
- reddit / oi-v2: 5 signups, 2 activated (40%)
```

---

## Next Steps

### 1. Run the Database Migration

**You need to manually apply the migration:**

```bash
# Connect to Supabase and run:
psql YOUR_DATABASE_URL < supabase/migrations/057_utm_tracking.sql
```

Or use the Supabase dashboard:
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/057_utm_tracking.sql`
3. Run the query

### 2. Update All Ad URLs

Add UTM parameters to every ad campaign:

**Reddit - Otome Isekai:**
```
https://ep-0.com/series/villainess-survives?utm_source=reddit&utm_campaign=oi-villainess-v2&utm_medium=cpc
```

**Reddit - Manhwa Regressor:**
```
https://ep-0.com/series/seventeen-days?utm_source=reddit&utm_campaign=manhwa-regressor-v2&utm_medium=cpc
```

**TikTok:**
```
https://ep-0.com/series/villainess-survives?utm_source=tiktok&utm_campaign=oi-villainess-jan&utm_medium=video
```

### 3. Test End-to-End

**Manual test:**

1. Clear your browser's localStorage
2. Visit: `http://localhost:3000/series/villainess-survives?utm_source=test&utm_campaign=manual-test`
3. Sign up with a new email
4. After signup, go to `/admin`
5. Check the user table - you should see:
   - Source: "test"
   - Campaign: "manual-test"

**Database verification:**

```sql
SELECT
  display_name,
  signup_source,
  signup_campaign,
  signup_landing_page,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 5;
```

### 4. Monitor Campaign Performance

After a few days of running ads with UTM parameters:

1. Go to `/admin`
2. Check "Campaign Performance" card
3. Compare activation rates:
   - reddit/oi-villainess-v1 (Play Now) vs v2 (Start Chat)
   - reddit vs tiktok
   - Different series landing pages

**Example output:**
```
Source    Campaign              Signups  Activated  Rate
reddit    oi-villainess-v1     7        0          0%     (Play Now - OLD)
reddit    oi-villainess-v2     5        2          40%    (Start Chat - NEW)
tiktok    oi-villainess-jan    8        1          12%    (needs work)
```

This tells you:
- ✅ Reddit "Start Chat" ads are working (40% activation)
- ❌ Reddit "Play Now" ads don't work (0% activation)
- ⚠️ TikTok needs better targeting (12% activation)

---

## URL Parameters Reference

### Required Parameters

- `utm_source` - Traffic source (reddit, tiktok, google, twitter)
- `utm_campaign` - Specific campaign name (oi-villainess-v2, manhwa-regressor-v1)
- `utm_medium` - Marketing medium (cpc, video, organic, email)

### Optional Parameters

- `utm_content` - For A/B testing ad variants (button-red, headline-a)

### Examples

**A/B testing headlines:**
```
https://ep-0.com/series/villainess-survives?utm_source=reddit&utm_campaign=oi-v2&utm_medium=cpc&utm_content=headline-a
https://ep-0.com/series/villainess-survives?utm_source=reddit&utm_campaign=oi-v2&utm_medium=cpc&utm_content=headline-b
```

Then in admin dashboard, filter by `signup_content` to see which headline converts better.

---

## Troubleshooting

### Attribution Not Saving

**Check 1: localStorage**
- Open DevTools → Application → Local Storage
- Should see `signup_attribution` key with JSON value
- If missing: `captureAttribution()` didn't run on series page

**Check 2: Database**
```sql
SELECT signup_source, signup_campaign FROM users WHERE id = 'USER_ID';
```
- If NULL: AttributionSaver didn't run or failed
- Check browser console for errors

**Check 3: Admin API**
- Check if `/admin/stats` returns attribution fields
- If not: Backend query might be missing the fields

### Users Show "unknown" Source

This is normal for:
- Users who signed up before this implementation
- Users who visited directly (typed URL, no UTM params)
- Users from organic search

### Campaign Performance Card Empty

- Need at least 1 user with attribution data
- Run test signup with UTM parameters first

---

## Benefits

### Before UTM Tracking

❌ No idea which ads work
❌ Can't compare Reddit vs TikTok
❌ Don't know if "Start Chat" beats "Play Now"
❌ Can't optimize ad spend

### After UTM Tracking

✅ See exactly which campaigns drive engaged users
✅ Compare activation rates by source
✅ A/B test ad copy and measure results
✅ Stop spending on campaigns that don't work
✅ Double down on campaigns that do work

---

## Cost-Per-Engaged-User Calculation

With attribution, you can now calculate true CPEU:

```
Campaign: reddit/oi-villainess-v2
- Ad Spend: $20
- Clicks: 100
- Signups: 10
- Activated (sent messages): 4

Cost per click: $20 / 100 = $0.20
Cost per signup: $20 / 10 = $2.00
Cost per ENGAGED user: $20 / 4 = $5.00 ✅ This is what matters!
```

Compare to old campaign:
```
Campaign: reddit/oi-villainess-v1 (Play Now)
- Ad Spend: $15
- Clicks: 120
- Signups: 12
- Activated: 0

Cost per ENGAGED user: ∞ 💸 Wasted money
```

**Decision**: Stop v1, increase budget on v2.

---

## Next Documentation

- [REDDIT_ADS_REVISED_COPY.md](../marketing/REDDIT_ADS_REVISED_COPY.md) - Ad copy with UTM URLs
- [CHANNEL_STRATEGY.md](../plans/CHANNEL_STRATEGY.md) - Overall marketing strategy

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-12 | Initial implementation complete |
