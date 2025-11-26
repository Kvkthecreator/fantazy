# Work-Platform Frontend Auth Patterns Audit

**Date**: 2025-11-26
**Status**: ⚠️ Inconsistencies Found - Requires Cleanup

---

## 🎯 Executive Summary

The work-platform frontend has **multiple auth patterns** that have evolved during debugging and refactoring. This audit identifies:

- ✅ **Working patterns** (should be standardized)
- ⚠️ **Inconsistencies** (need cleanup)
- ❌ **Anti-patterns** (should be removed)

**Key Finding**: We have 3 different backend URL environment variables and inconsistent auth forwarding.

---

## 📊 Auth Pattern Categories

### 1. **Direct Supabase Access** (User/Workspace Management)

**Purpose**: Access work-platform tables directly
**Pattern**: Route handler creates Supabase client, queries DB directly
**Auth**: Supabase session + RLS

**Example**: [baskets/[basketId]/route.ts](web/app/api/baskets/[basketId]/route.ts)
```typescript
export async function GET(request: NextRequest, { params }) {
  const supabase = createRouteHandlerClient({ cookies });

  // Get session for auth
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Query Supabase tables directly
  const { data: basket } = await supabase.from('baskets').select('*').eq('id', basketId).single();

  return NextResponse.json(basket);
}
```

**Used By**:
- `/api/baskets/[basketId]` ✅
- `/api/projects/[id]/context` ✅ (queries blocks table directly)
- Most workspace/project metadata routes ✅

**Status**: ✅ **GOOD PATTERN** - Avoids substrate-API auth issues

---

### 2. **Proxy to work-platform Backend** (Agent Execution)

**Purpose**: Forward requests to work-platform API (FastAPI on Render)
**Pattern**: Next.js route extracts JWT, forwards to backend
**Auth**: JWT in Authorization header

**Example**: [work/research/execute/route.ts](web/app/api/work/research/execute/route.ts)
```typescript
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }

  const backendResponse = await fetch(`${BACKEND_URL}/api/work/research/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  return NextResponse.json(await backendResponse.json());
}
```

**Used By**:
- `/api/work/research/execute` ✅
- `/api/work/content/execute` ✅
- `/api/work/reporting/execute` ✅
- `/api/projects/new` ✅

**Status**: ✅ **GOOD PATTERN** - Correct JWT forwarding

---

### 3. **Proxy to substrate-API** (Legacy Substrate Operations)

**Purpose**: Forward requests to substrate-API (FastAPI on Render)
**Pattern**: Next.js route extracts JWT, forwards to substrate-API
**Auth**: JWT in Authorization header

**Example**: [baskets/[basketId]/assets/route.ts](web/app/api/baskets/[basketId]/assets/route.ts)
```typescript
export async function GET(request: NextRequest, { params }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const response = await fetch(
    `${SUBSTRATE_API_URL}/api/substrate/baskets/${basketId}/assets`,
    {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return NextResponse.json(await response.json());
}
```

**Used By**:
- `/api/baskets/[basketId]/assets/*` ✅ (reference assets - PDFs, screenshots)
- Legacy substrate routes ⏸️

**Status**: ⚠️ **LEGACY PATTERN** - Should use direct DB access when possible

---

### 4. **Client-Side fetchWithToken** (Browser Calls)

**Purpose**: Client components calling Next.js API routes
**Pattern**: Utility function auto-adds JWT token
**Auth**: JWT in Authorization + sb-access-token headers

**Example**: [fetchWithToken.ts](web/lib/fetchWithToken.ts)
```typescript
export async function fetchWithToken(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No authenticated user found. Please log in to continue.");
  }

  const session = await supabase.auth.getSession();
  const jwt = session.data.session?.access_token ?? "";

  return fetch(url, {
    ...init,
    headers: {
      "sb-access-token": jwt,
      "Authorization": `Bearer ${jwt}`,
      "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
}
```

**Used By**:
- Client components calling `/api/*` routes
- Direct substrate-API calls from browser (deprecated)

**Status**: ⚠️ **INCONSISTENT** - Has backend routing logic that should be in API routes

---

## ❌ Problems Identified

### Problem 1: **Multiple Backend URL Environment Variables**

**Found**:
```typescript
// Pattern 1 (work/research/execute/route.ts)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://yarnnn-app-fullstack.onrender.com";

// Pattern 2 (projects/new/route.ts)
const WORK_PLATFORM_API_URL = process.env.NEXT_PUBLIC_WORK_PLATFORM_API_URL || 'http://localhost:8000';

// Pattern 3 (baskets/assets/route.ts)
const SUBSTRATE_API_URL = process.env.SUBSTRATE_API_URL || 'http://localhost:10000';
```

**Issue**: Inconsistent naming across files. Should standardize.

**Recommendation**:
```typescript
// Standardize to these 2 env vars:
const WORK_PLATFORM_API_URL = process.env.NEXT_PUBLIC_WORK_PLATFORM_API_URL || 'http://localhost:8000';
const SUBSTRATE_API_URL = process.env.NEXT_PUBLIC_SUBSTRATE_API_URL || 'http://localhost:10000';
```

---

### Problem 2: **fetchWithToken Has Backend Routing Logic**

**Issue**: `fetchWithToken.ts` lines 28-44 have logic to route specific paths to backend:

```typescript
const backendRoutes = ['/api/p3/', '/api/p4/', '/api/dumps/', '/api/health/', '/api/integrations/', '/api/tp/'];
const isBackendRoute = backendRoutes.some(route => input.startsWith(route));

if (isBackendRoute) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  url = `${apiBase}${input}`;
}
```

**Problem**: This belongs in API routes, not in client utility
**Risk**: Client-side routing decisions can be bypassed

**Recommendation**: Remove this logic. All backend calls should go through Next.js API routes.

---

### Problem 3: **Inconsistent Error Messages**

**Found**:
- `{ detail: 'Authentication required' }` (work/research/execute)
- `{ error: 'Authentication required' }` (baskets/[basketId])
- `{ message: 'Unauthorized' }` (some routes)

**Recommendation**: Standardize to `{ error: 'message' }` or `{ detail: 'message' }` consistently

---

### Problem 4: **Duplicate Supabase Client Patterns**

**Found**:
```typescript
// Pattern A (workspace/change-requests/page.tsx) - DEPRECATED
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
const supabase = createServerComponentClient<Database>({ cookies });

// Pattern B (all API routes) - CORRECT
import { createRouteHandlerClient } from '@/lib/supabase/clients';
const supabase = createRouteHandlerClient({ cookies });
```

**Issue**: `workspace/change-requests/page.tsx` uses deprecated direct import

**Recommendation**: Update to use wrapper from `@/lib/supabase/clients`

---

## ✅ Recommended Standard Patterns

### Pattern 1: **Server Component Data Fetching**

```typescript
import { createServerComponentClient } from '@/lib/supabase/clients';
import { cookies } from 'next/headers';

export default async function ProjectPage({ params }) {
  const supabase = createServerComponentClient({ cookies });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  // Query work-platform tables directly
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single();

  return <ProjectView project={project} />;
}
```

**Use When**: Server component needs data from work-platform DB

---

### Pattern 2: **API Route - Direct DB Access**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase/clients';

export async function GET(request: NextRequest, { params }) {
  const supabase = createRouteHandlerClient({ cookies });

  // Authenticate
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Query DB directly (work-platform or substrate tables)
  const { data, error } = await supabase.from('table_name').select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

**Use When**: Accessing work-platform or substrate tables directly (same DB)

---

### Pattern 3: **API Route - Proxy to Backend**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase/clients';

const WORK_PLATFORM_API_URL = process.env.NEXT_PUBLIC_WORK_PLATFORM_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  // Authenticate and get JWT
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Forward to backend with JWT
  const body = await request.json();
  const response = await fetch(`${WORK_PLATFORM_API_URL}/api/work/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
```

**Use When**: Agent execution, complex operations requiring backend logic

---

### Pattern 4: **Client Component - Call Next.js API Route**

```typescript
'use client';

export function MyComponent() {
  async function executeWork() {
    const response = await fetch('/api/work/research/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'research' }),
    });

    if (!response.ok) {
      throw new Error('Execution failed');
    }

    const data = await response.json();
    return data;
  }

  return <button onClick={executeWork}>Execute</button>;
}
```

**Use When**: Client component needs to trigger backend operation

**Note**: Next.js API route handles auth, client doesn't need to pass JWT manually

---

## 🔧 Recommended Fixes

### Fix 1: Standardize Environment Variables

**Create**: `work-platform/web/.env.example`
```bash
# Supabase (user auth + DB)
NEXT_PUBLIC_SUPABASE_URL=https://galytxxkrbksilekmhcw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Backend APIs
NEXT_PUBLIC_WORK_PLATFORM_API_URL=https://yarnnn-app-fullstack.onrender.com
NEXT_PUBLIC_SUBSTRATE_API_URL=https://yarnnn-enterprise-api.onrender.com
```

**Update**: All API routes to use consistent env var names

---

### Fix 2: Remove Routing Logic from fetchWithToken

**Before**:
```typescript
// fetchWithToken.ts has backend routing logic
const backendRoutes = ['/api/p3/', '/api/p4/', ...];
if (isBackendRoute) {
  url = `${apiBase}${input}`;
}
```

**After**:
```typescript
// fetchWithToken.ts - simple auth wrapper only
export async function fetchWithToken(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  return fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      'Authorization': `Bearer ${session.access_token}`,
    },
  });
}
```

**Note**: Routing decisions made in API routes, not client

---

### Fix 3: Update Legacy Supabase Import

**File**: `work-platform/web/app/workspace/change-requests/page.tsx`

**Before**:
```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
const supabase = createServerComponentClient<Database>({ cookies });
```

**After**:
```typescript
import { createServerComponentClient } from '@/lib/supabase/clients';
const supabase = createServerComponentClient({ cookies });
```

---

### Fix 4: Standardize Error Responses

**Pattern**:
```typescript
// Auth errors
return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

// Not found errors
return NextResponse.json({ error: 'Resource not found' }, { status: 404 });

// Validation errors
return NextResponse.json({ error: 'Invalid request', details: validationErrors }, { status: 400 });

// Server errors
return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
```

**Update**: All API routes to use this pattern

---

## 📋 File Audit Summary

### ✅ Good Patterns (No Changes Needed)

| File | Pattern | Auth | Status |
|------|---------|------|--------|
| `api/baskets/[basketId]/route.ts` | Direct DB | Supabase session | ✅ |
| `api/projects/[id]/context/route.ts` | Direct DB | Supabase session | ✅ |
| `api/work/research/execute/route.ts` | Backend proxy | JWT forwarding | ✅ |
| `api/work/content/execute/route.ts` | Backend proxy | JWT forwarding | ✅ |
| `api/work/reporting/execute/route.ts` | Backend proxy | JWT forwarding | ✅ |

### ⚠️ Needs Cleanup

| File | Issue | Fix |
|------|-------|-----|
| `lib/fetchWithToken.ts` | Backend routing logic | Remove routing, keep auth only |
| `workspace/change-requests/page.tsx` | Deprecated import | Use `@/lib/supabase/clients` |
| Multiple API routes | Inconsistent env var names | Standardize to `NEXT_PUBLIC_WORK_PLATFORM_API_URL` |
| Multiple API routes | Inconsistent error format | Use `{ error: 'message' }` pattern |

---

## 🎯 Decision Matrix: When to Use Each Pattern

### Use **Direct DB Access** When:
- ✅ Querying work-platform tables (projects, work_tickets, etc.)
- ✅ Querying substrate tables that support RLS (blocks, baskets, etc.)
- ✅ Simple CRUD operations
- ✅ Want to avoid backend API latency

### Use **Backend Proxy** When:
- ✅ Agent execution (requires Claude SDK, complex logic)
- ✅ Work orchestration flows
- ✅ Operations requiring backend services (circuit breakers, retries)
- ✅ Legacy substrate operations (until migrated to direct DB)

### Avoid:
- ❌ Client calling backend APIs directly (always go through Next.js API routes)
- ❌ Mixing auth patterns in the same route
- ❌ Hardcoded backend URLs (use env vars)

---

## 📚 See Also

- **[Supabase Auth Helpers Docs](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)** - Official patterns
- **[Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)** - API route patterns
- **[YARNNN_LAYERED_ARCHITECTURE_V4.md](../../docs/architecture/YARNNN_LAYERED_ARCHITECTURE_V4.md)** - Layer separation

---

**Status**: ⚠️ Audit complete - cleanup recommended
**Priority**: Medium (not blocking, but improves consistency)
**Effort**: ~2-3 hours to fix all inconsistencies
