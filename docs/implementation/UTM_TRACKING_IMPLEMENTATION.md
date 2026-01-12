# UTM Tracking Implementation

> **Priority**: P0 - CRITICAL
> **Effort**: 4-6 hours
> **Impact**: Enables measuring which campaigns drive engaged users

---

## The Problem

Right now you cannot answer:
- Which Reddit campaigns drive signups? (otome_isekai vs manhwa_regressor)
- Do TikTok or Reddit users activate better?
- Which series landing pages convert best?
- Are the new "Start Chat" ads better than "Play Now" ads?

**You're spending $50+ on ads with zero attribution.**

---

## The Solution

Capture UTM parameters at landing → Store on signup → Display in admin dashboard

---

## Implementation Steps

### Step 1: Database Schema (5 min)

Add attribution fields to users table:

```sql
-- Migration: Add UTM tracking fields
ALTER TABLE users
ADD COLUMN signup_source TEXT,
ADD COLUMN signup_campaign TEXT,
ADD COLUMN signup_medium TEXT,
ADD COLUMN signup_content TEXT,
ADD COLUMN signup_landing_page TEXT,
ADD COLUMN signup_referrer TEXT;

-- Index for filtering in admin dashboard
CREATE INDEX idx_users_signup_source ON users(signup_source);
CREATE INDEX idx_users_signup_campaign ON users(signup_campaign);
```

Save as: `supabase/migrations/030_utm_tracking.sql`

### Step 2: Capture UTM Parameters on Landing (30 min)

**File**: `web/src/lib/utils/attribution.ts`

```typescript
interface Attribution {
  source: string | null;
  campaign: string | null;
  medium: string | null;
  content: string | null;
  landingPage: string;
  referrer: string;
}

export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return getDefaultAttribution();

  const params = new URLSearchParams(window.location.search);

  const attribution: Attribution = {
    source: params.get('utm_source'),
    campaign: params.get('utm_campaign'),
    medium: params.get('utm_medium'),
    content: params.get('utm_content'),
    landingPage: window.location.pathname,
    referrer: document.referrer || 'direct'
  };

  // Store in localStorage to persist through auth flow
  localStorage.setItem('signup_attribution', JSON.stringify(attribution));

  return attribution;
}

export function getStoredAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem('signup_attribution');
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearAttribution() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('signup_attribution');
}

function getDefaultAttribution(): Attribution {
  return {
    source: null,
    campaign: null,
    medium: null,
    content: null,
    landingPage: '/',
    referrer: 'direct'
  };
}
```

### Step 3: Capture on Series Pages (10 min)

**File**: `web/src/app/series/[slug]/page.tsx`

Add at the top of the component:

```typescript
import { captureAttribution } from '@/lib/utils/attribution';

export default function SeriesPage({ params }: PageProps) {
  // ... existing code ...

  // Capture attribution when user lands on series page
  useEffect(() => {
    captureAttribution();
  }, []);

  // ... rest of component ...
}
```

### Step 4: Save on User Creation (30 min)

**Option A: Database Trigger** (Recommended - works for all auth methods)

```sql
-- Migration: Auto-populate attribution from metadata
CREATE OR REPLACE FUNCTION handle_user_attribution()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract attribution from user metadata (if exists)
  NEW.signup_source := NEW.raw_user_meta_data->>'signup_source';
  NEW.signup_campaign := NEW.raw_user_meta_data->>'signup_campaign';
  NEW.signup_medium := NEW.raw_user_meta_data->>'signup_medium';
  NEW.signup_content := NEW.raw_user_meta_data->>'signup_content';
  NEW.signup_landing_page := NEW.raw_user_meta_data->>'signup_landing_page';
  NEW.signup_referrer := NEW.raw_user_meta_data->>'signup_referrer';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_attribution_trigger
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_attribution();
```

**Option B: In Auth Callback** (Simpler but only for OAuth)

**File**: `web/src/app/auth/callback/route.ts`

```typescript
import { getStoredAttribution, clearAttribution } from '@/lib/utils/attribution';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Get stored attribution
      const attribution = getStoredAttribution();

      if (attribution) {
        // Save to user profile
        await supabase
          .from('users')
          .update({
            signup_source: attribution.source,
            signup_campaign: attribution.campaign,
            signup_medium: attribution.medium,
            signup_content: attribution.content,
            signup_landing_page: attribution.landingPage,
            signup_referrer: attribution.referrer
          })
          .eq('id', data.user.id);

        // Clear from localStorage
        clearAttribution();
      }

      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

### Step 5: Display in Admin Dashboard (1-2 hours)

**File**: `web/src/app/admin/page.tsx`

Add columns to user table:

```typescript
// In the user engagement table section
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>User</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Source</TableHead> {/* NEW */}
      <TableHead>Campaign</TableHead> {/* NEW */}
      <TableHead>Messages</TableHead>
      <TableHead>Sessions</TableHead>
      <TableHead>Signed Up</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map((user) => (
      <TableRow key={user.id}>
        <TableCell>{user.display_name || 'User'}</TableCell>
        <TableCell>
          <Badge>{user.subscription_status}</Badge>
        </TableCell>
        <TableCell> {/* NEW */}
          {user.signup_source || 'unknown'}
        </TableCell>
        <TableCell> {/* NEW */}
          {user.signup_campaign || '-'}
        </TableCell>
        {/* ... rest of columns ... */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

Add campaign performance metrics:

```typescript
// Calculate signup by source
const signupsBySource = users.reduce((acc, user) => {
  const source = user.signup_source || 'unknown';
  acc[source] = (acc[source] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// Calculate activation rate by source
const activationBySource = users.reduce((acc, user) => {
  const source = user.signup_source || 'unknown';
  if (!acc[source]) {
    acc[source] = { total: 0, activated: 0 };
  }
  acc[source].total += 1;
  if (user.total_messages > 0) {
    acc[source].activated += 1;
  }
  return acc;
}, {} as Record<string, { total: number; activated: number }>);

// Display in dashboard
<Card>
  <CardHeader>
    <CardTitle>Campaign Performance</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Signups</TableHead>
          <TableHead>Activated</TableHead>
          <TableHead>Activation Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(activationBySource).map(([source, stats]) => (
          <TableRow key={source}>
            <TableCell className="font-medium">{source}</TableCell>
            <TableCell>{stats.total}</TableCell>
            <TableCell>{stats.activated}</TableCell>
            <TableCell>
              {((stats.activated / stats.total) * 100).toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

---

## Testing

### Test 1: Verify Capture

1. Clear localStorage
2. Visit: `http://localhost:3000/series/villainess-survives?utm_source=reddit&utm_campaign=test&utm_medium=cpc`
3. Open DevTools → Application → Local Storage
4. Check for `signup_attribution` key with JSON value

### Test 2: Verify Storage on Signup

1. Complete signup flow from Test 1
2. Check database:
```sql
SELECT
  display_name,
  signup_source,
  signup_campaign,
  signup_medium,
  signup_landing_page,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 5;
```

### Test 3: Verify Admin Display

1. Go to `/admin`
2. Check user table has Source and Campaign columns
3. Check Campaign Performance card shows data

---

## URL Structure for Ads

Update all ad URLs to include UTM parameters:

### Reddit - Otome Isekai
```
https://ep-0.com/series/villainess-survives?utm_source=reddit&utm_campaign=oi-villainess-v2&utm_medium=cpc
```

### Reddit - Manhwa Regressor
```
https://ep-0.com/series/seventeen-days?utm_source=reddit&utm_campaign=manhwa-regressor-v2&utm_medium=cpc
```

### TikTok - Otome Isekai
```
https://ep-0.com/series/villainess-survives?utm_source=tiktok&utm_campaign=oi-villainess-jan&utm_medium=video
```

### Testing New "Start Chat" vs Old "Play Now"
```
Old: utm_campaign=oi-villainess-v1
New: utm_campaign=oi-villainess-v2-chat
```

Then compare activation rates in admin dashboard.

---

## Expected Results

After implementation, you'll be able to see:

```
Campaign Performance:

Source    Campaign              Signups  Activated  Rate
reddit    oi-villainess-v1     7        0          0%     (Play Now)
reddit    oi-villainess-v2     5        2          40%    (Start Chat)
reddit    manhwa-regressor-v2  3        1          33%    (Start Chat)
tiktok    oi-villainess-jan    8        0          0%     (needs fixing)
```

This will **prove** whether the new ad copy is working.

---

## Effort Breakdown

| Task | Time | Difficulty |
|------|------|------------|
| Database migration | 5 min | Easy |
| Attribution utils | 30 min | Easy |
| Capture on landing | 10 min | Easy |
| Save on signup | 30 min | Medium |
| Admin dashboard UI | 1-2 hours | Medium |
| Testing | 30 min | Easy |
| **TOTAL** | **3-4 hours** | **Medium** |

---

## Priority

**DO THIS WEEK** before spending more on ads.

Without attribution, you're flying blind. You won't know if the new "Start Chat" ads actually work better.

---

## Next Steps

1. [ ] Run database migration
2. [ ] Create attribution utils file
3. [ ] Add capture to series pages
4. [ ] Add save to auth callback
5. [ ] Update admin dashboard
6. [ ] Test with UTM params
7. [ ] Update all ad URLs
8. [ ] Monitor results

