# Work Orchestration: Comprehensive Design & UX Flow

**Date**: November 25, 2025
**Status**: Architecture Analysis & Refactoring Proposal

## Current State Analysis

### User Journey (As-Is)

```
1. Project Overview
   ↓
2. "New Work Request" button
   ↓
3. Recipe Gallery (/projects/{id}/work-tickets/new)
   - Browse recipe cards (reporting, research, content)
   - Each card shows: icon, name, description, agent type, format
   ↓
4. Select Recipe → Configure (/projects/{id}/work-tickets/new/configure)
   - Fill parameters (topic, audience, detail_level, etc.)
   - Dynamic form based on recipe.configurable_parameters
   ↓
5. Submit → API Call
   - POST /api/work/{agent_type}/execute
   - Backend creates work_request + work_ticket
   - Agent executes (60-300 seconds)
   - Returns work_ticket_id
   ↓
6. Redirect → Work Tickets View (/projects/{id}/work-tickets-view)
   - Server-rendered list of all tickets
   - Filter by status (pending/running/completed/failed)
   - Filter by agent type
   ↓
7. Click Ticket → Outputs Page (/projects/{id}/outputs)
   - Shows ALL outputs for the basket (not ticket-specific!)
   - User must hunt for their output
```

### Critical Gaps Identified

#### 1. **No Real-Time Progress Visibility**
- **Current**: User submits → sees loading → redirects to list → hopes ticket appears
- **Problem**: No way to see agent working, no TodoWrite visibility, "guessing game"
- **Impact**: User anxiety, looks broken, can't diagnose failures

#### 2. **Broken Output Consumption Flow**
- **Current**: Ticket card links to `/projects/{id}/outputs` (ALL outputs, not filtered)
- **Problem**: User can't find THEIR output from THAT ticket
- **Missing**: Direct ticket → output mapping, output detail view

#### 3. **State Management Confusion**
- **Backend**: work_request → work_ticket → work_output (clear hierarchy)
- **Frontend**: Disconnected pages, no state persistence, no real-time updates
- **Missing**: Proper state machine for ticket lifecycle

#### 4. **No Single Source of Truth for Execution State**
- **Backend**: work_tickets.status (pending → running → completed/failed)
- **Frontend**: Polls? Server-renders? SSE for TodoWrite but not for status?
- **Missing**: Unified real-time state synchronization

#### 5. **Output Viewing is Broken**
- **Current**: `/projects/{id}/outputs` shows ALL outputs, not ticket-specific
- **Problem**: Ticket card links here, but user sees unrelated outputs
- **Missing**: `/work-tickets/{ticket_id}/outputs` or output detail modal

---

## Proposed Architecture: End-to-End Flow

### Phase 1: Recipe Selection (✅ Good)
**Route**: `/projects/{id}/work-tickets/new`

**Current State**: Recipe gallery works well
- ✅ Fetches from `work_recipes` table
- ✅ Filters by `status='active'`
- ✅ Shows cards with icons, descriptions
- ✅ Groups by agent_type

**No Changes Needed**

---

### Phase 2: Recipe Configuration (✅ Good)
**Route**: `/projects/{id}/work-tickets/new/configure?recipe={slug}`

**Current State**: Dynamic form generation works
- ✅ Loads recipe from database
- ✅ Generates form from `configurable_parameters`
- ✅ Validates required fields
- ✅ Calls correct agent endpoint

**No Changes Needed**

---

### Phase 3: Execution & Real-Time Progress (🔴 NEEDS MAJOR REFACTOR)

#### Current Problems:
1. API call is synchronous (5 min timeout, blocks frontend)
2. No progress visibility during execution
3. TodoWrite implemented but not surfaced properly
4. Redirect happens AFTER completion (user waits 5 min)

#### Proposed Solution: Async Execution + Live Tracking Page

**3a. Submit Recipe → Immediate Redirect**
```typescript
// In RecipeConfigureClient.tsx
const response = await fetch(endpoint, {
  method: "POST",
  body: JSON.stringify({
    ...requestBody,
    async: true  // NEW: Don't wait for completion
  })
});

const { work_ticket_id } = await response.json();

// Redirect immediately to tracking page
router.push(`/projects/${projectId}/work-tickets/${work_ticket_id}/track`);
```

**3b. NEW PAGE: Live Execution Tracking**
**Route**: `/projects/{id}/work-tickets/{ticketId}/track`

**Purpose**: Single page that shows:
1. Ticket metadata (recipe, parameters, agent type)
2. Real-time status (pending → running → completed/failed)
3. TodoWrite task progress (via SSE)
4. Output preview (when completed)
5. Actions (view output, cancel execution, retry)

**UI Layout**:
```
┌─────────────────────────────────────────────────┐
│ Recipe: Executive Summary Deck                  │
│ Agent: Reporting • Format: PPTX • Status: 🔄    │
├─────────────────────────────────────────────────┤
│ Parameters:                                     │
│ • Topic: Q4 Product Roadmap                     │
│ • Audience: Executives                          │
│ • Detail: High-level overview                   │
├─────────────────────────────────────────────────┤
│ Progress:                                       │
│ ✅ Load substrate context (2.3s)                │
│ ✅ Analyze key insights (5.1s)                  │
│ 🔄 Generate PPTX using Skill tool               │
│ ⏳ Save output via emit_work_output             │
├─────────────────────────────────────────────────┤
│ [View Output] [Cancel] [Back to Tickets]       │
└─────────────────────────────────────────────────┘
```

**Data Sources**:
- **Ticket metadata**: Initial server render from `work_tickets` table
- **Real-time status**: SSE stream OR Supabase Realtime on `work_tickets.status`
- **TodoWrite progress**: SSE stream from `/api/work/tickets/{id}/stream`
- **Output preview**: Fetch when status=completed

---

### Phase 4: Output Consumption (🔴 NEEDS COMPLETE REDESIGN)

#### Current Problems:
1. Ticket cards link to `/projects/{id}/outputs` (wrong!)
2. Outputs page shows ALL outputs (not filtered by ticket)
3. No output detail view
4. No way to download/view file outputs (PPTX, PDF)

#### Proposed Solution: Ticket-Specific Output View

**Option A: Dedicated Output Page**
**Route**: `/projects/{id}/work-tickets/{ticketId}/outputs`

```typescript
// Fetch outputs for THIS ticket only
const { data: outputs } = await supabase
  .from('work_outputs')
  .select('*')
  .eq('work_ticket_id', ticketId)
  .order('created_at', { ascending: false });
```

**Option B: Modal/Drawer from Tracking Page**
When execution completes, show output inline on tracking page:
- Markdown preview
- File download button (PPTX, PDF, XLSX)
- Regenerate button (retry with same params)

**Recommendation**: Use Option B (keep user on tracking page)

---

### Phase 5: Ticket Management (🟡 NEEDS REFINEMENT)

#### Current State: Work Tickets List
**Route**: `/projects/{id}/work-tickets-view`

**What Works**:
- ✅ Server-rendered list
- ✅ Filter by status
- ✅ Filter by agent type
- ✅ Shows output count
- ✅ WorkTicketCard with TodoWrite (NEW)

**What's Broken**:
- ❌ Card links to `/outputs` (wrong destination)
- ❌ No real-time status updates (requires page refresh)
- ❌ TodoWrite only shows for running tickets (should show historical)

**Proposed Changes**:

1. **Fix Card Link**:
```typescript
// In WorkTicketCard.tsx
<Link href={`/projects/${projectId}/work-tickets/${ticket.id}/track`}>
  {/* Show ticket details + click to see execution/outputs */}
</Link>
```

2. **Add Real-Time Status Updates**:
```typescript
// Use Supabase Realtime for work_tickets table
useEffect(() => {
  const subscription = supabase
    .channel('work_tickets')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'work_tickets',
      filter: `basket_id=eq.${basketId}`
    }, (payload) => {
      // Update ticket status in real-time
      setTickets(prev => prev.map(t =>
        t.id === payload.new.id ? payload.new : t
      ));
    })
    .subscribe();
}, [basketId]);
```

3. **Show Historical TodoWrite Data**:
Store final TodoWrite state in `work_tickets.metadata.final_todos`:
```json
{
  "final_todos": [
    {"content": "Load context", "status": "completed", "activeForm": "Loaded context"},
    {"content": "Generate PPTX", "status": "completed", "activeForm": "Generated PPTX"}
  ]
}
```

---

## Unified State Management

### Backend: Work Execution State Machine

```
work_request (tracking, billing)
  ↓
work_ticket (execution tracking)
  status: pending → running → completed/failed
  metadata: {
    recipe_id, recipe_parameters,
    execution_time_ms, output_count,
    final_todos: [...],  // NEW: Store final TodoWrite state
    error_message (if failed)
  }
  ↓
work_outputs[] (results)
  each output: {
    title, body, file_id, file_format,
    generation_method: "skill" | "text",
    agent_type, output_type
  }
```

### Frontend: Real-Time Synchronization

**Three Data Streams**:

1. **Initial State** (Server Render):
   - Fetch ticket metadata from database
   - Render page with initial data

2. **Status Updates** (Supabase Realtime):
   - Subscribe to `work_tickets` table changes
   - Update ticket status (pending → running → completed)
   - Update metadata (execution_time_ms, output_count)

3. **TodoWrite Progress** (SSE):
   - Subscribe to `/api/work/tickets/{id}/stream`
   - Show live task progress
   - Store final state in ticket metadata when completed

**Why Three Streams?**
- **Server Render**: Fast initial load, SEO-friendly
- **Realtime**: Status changes (DB-driven, works across tabs)
- **SSE**: TodoWrite (ephemeral, only during execution)

---

## Proposed Routing Structure

```
/projects/{id}/work-tickets/
├── new/                          # Recipe Gallery (✅ Good)
│   └── configure?recipe={slug}   # Recipe Configuration (✅ Good)
│
├── {ticketId}/
│   ├── track                     # 🆕 Live Execution Tracking (NEW!)
│   │   - Real-time status
│   │   - TodoWrite progress
│   │   - Output preview when done
│   │   - Actions (view, retry, cancel)
│   │
│   └── outputs (optional)        # Output detail view (or use modal)
│
└── view (current: work-tickets-view)  # Ticket List (🟡 Refine)
    - Link cards to /track (not /outputs)
    - Add Realtime status updates
    - Show historical TodoWrite data
```

---

## Implementation Plan

### Step 1: Create Live Tracking Page (HIGH PRIORITY)
**File**: `/projects/{id}/work-tickets/{ticketId}/track/page.tsx`

**Features**:
1. Server-render ticket metadata
2. Client component for real-time updates
3. Supabase Realtime subscription for status
4. SSE subscription for TodoWrite
5. Output preview when completed
6. Actions (view output, retry, download)

**Components**:
- `TicketTrackingPage` (server component)
- `TicketTrackingClient` (client component)
- `TaskProgressList` (already exists ✅)
- `OutputPreview` (new component)

### Step 2: Make Recipe Execution Async (BACKEND)
**File**: `workflow_reporting.py`, `workflow_research.py`, `workflow_content.py`

**Changes**:
1. Add `async: bool = False` parameter to request
2. If async=True:
   - Create work_ticket with status="pending"
   - Return immediately with ticket_id
   - Queue execution in background (Celery/RQ or fire-and-forget)
3. If async=False (default):
   - Keep current synchronous behavior (for backwards compat)

### Step 3: Fix Ticket Card Links
**File**: `WorkTicketCard.tsx`

**Change**:
```typescript
// OLD: href={`/projects/${projectId}/outputs`}
// NEW:
href={`/projects/${projectId}/work-tickets/${ticket.id}/track`}
```

### Step 4: Add Realtime Status Updates to Ticket List
**File**: `work-tickets-view/page.tsx` + new client component

**Changes**:
1. Create `TicketListClient` component
2. Subscribe to Supabase Realtime for work_tickets
3. Update ticket statuses in real-time
4. Show toast notifications for completions

### Step 5: Store Final TodoWrite State in Metadata
**File**: `reporting_agent_sdk.py` (and other agent SDKs)

**Changes**:
```python
# In finally block after execution:
final_todos = TASK_UPDATES.get(work_ticket_id, [])
supabase.table("work_tickets").update({
    "metadata": {
        **existing_metadata,
        "final_todos": final_todos
    }
}).eq("id", work_ticket_id).execute()
```

### Step 6: Output Preview Component
**File**: `OutputPreview.tsx`

**Features**:
- Markdown rendering (for text outputs)
- File download button (for PPTX, PDF, XLSX)
- Regenerate button (retry with same params)
- Share/export options

---

## Benefits of This Design

1. **Transparency**: User sees exactly what's happening (TodoWrite + status)
2. **Immediate Feedback**: No 5-minute wait, redirect happens immediately
3. **Clear Navigation**: Recipe → Configure → Track → Output (linear flow)
4. **Proper State Management**: Realtime + SSE + Server render working together
5. **Output Accessibility**: Direct link from ticket to its outputs
6. **Debugging**: TodoWrite reveals Skills invocation issues
7. **Scalability**: Async execution prevents frontend timeout issues
8. **Multi-Tab Support**: Realtime subscriptions work across browser tabs

---

## Migration Path (Non-Breaking)

### Phase 1 (Immediate):
1. Create tracking page (`/work-tickets/{id}/track`)
2. Update ticket card links to point to tracking page
3. Keep synchronous execution (for now)

### Phase 2 (Short-term):
1. Add async execution option to backend
2. Add Realtime subscriptions to ticket list
3. Store final TodoWrite state in metadata

### Phase 3 (Long-term):
1. Deprecate `/projects/{id}/outputs` (or repurpose)
2. Make async execution default
3. Add advanced features (cancel, retry, scheduling)

---

## Key Questions to Address

1. **Async Execution**: Should we use Celery/RQ, or just fire-and-forget threads?
2. **Output Storage**: Should outputs link to ticket_id (already does via FK)?
3. **File Downloads**: Do we need signed URLs for Supabase Storage?
4. **Error Handling**: How to surface agent errors to user (show in tracking page)?
5. **Cancellation**: Should users be able to cancel running executions?
6. **Historical TodoWrite**: Store in metadata or separate table?

---

## Next Steps

Please review this comprehensive design and let me know:

1. Does this match your vision for the complete user experience?
2. Any architectural concerns or different approaches you'd prefer?
3. Should we start with the tracking page (Step 1) or another component?
4. Are there UX patterns from other tools you'd like to emulate?

Once aligned, I'll implement the tracking page as the cornerstone of this refactored flow.
