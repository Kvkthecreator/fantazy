# ADR: Unified Work Orchestration Architecture

**Status:** Proposed
**Date:** 2025-12-05
**Authors:** Claude + User
**Supersedes:** ADR_CONTINUOUS_WORK_MODEL.md (partial)

## Context

The current work execution system has three separate paths that create work_tickets:

1. **Manual UI** → Creates `work_request` → Creates `work_ticket` → Executes via `WorkTicketExecutor`
2. **Thinking Partner** → Creates `work_ticket` directly (no execution triggered)
3. **Scheduled** → Creates `work_ticket` directly (no execution triggered)

This fragmentation causes:
- TP and Scheduled tickets get stuck in `pending` forever
- No unified audit trail (some skip work_request)
- Inconsistent metadata schemas
- Scheduling treated as separate from recipes

## Decision

### Core Principles

1. **All work flows through work_request** - Every piece of work, regardless of origin, creates a work_request first
2. **Scheduling is first-class** - Every work_request can have optional scheduling; recipes define schedulability
3. **Single queue processor** - One background worker processes all pending tickets
4. **Unified metadata schema** - Consistent structure across all sources

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WORK ENTRY POINTS                               │
├───────────────────┬───────────────────┬───────────────────┬─────────────────┤
│    Manual UI      │ Thinking Partner  │   Schedule Cron   │      API        │
│  (Work Request    │   (TP Recipe      │  (project_        │   (External     │
│   Modal)          │    Tool)          │   schedules)      │    Trigger)     │
└─────────┬─────────┴─────────┬─────────┴─────────┬─────────┴────────┬────────┘
          │                   │                   │                  │
          ▼                   ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          POST /api/work/queue                                │
│                                                                              │
│  Unified work_request creation endpoint                                      │
│  • Validates recipe + context requirements                                   │
│  • Creates work_request with normalized metadata                             │
│  • Creates work_ticket in pending state                                      │
│  • Optionally creates/updates project_schedule                               │
│  • Returns work_request_id for tracking                                      │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           work_requests table                                │
│                                                                              │
│  • Audit trail for all work                                                  │
│  • Source tracking (manual, thinking_partner, schedule, api)                 │
│  • Recipe reference                                                          │
│  • Scheduling intent (one_shot vs recurring)                                 │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           work_tickets table                                 │
│                                                                              │
│  • Execution state tracking                                                  │
│  • Links to work_request, schedule, context                                  │
│  • Queue priority                                                            │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WORK QUEUE PROCESSOR                                   │
│                   (Background Worker / Cron)                                 │
│                                                                              │
│  Polls pending tickets every N seconds:                                      │
│  1. SELECT FROM work_tickets WHERE status = 'pending' ORDER BY priority      │
│  2. Lock ticket (UPDATE SET status = 'running')                              │
│  3. Invoke WorkTicketExecutor.execute_work_ticket()                          │
│  4. Handle completion/failure/checkpoint                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WorkTicketExecutor                                  │
│                     (Existing execution engine)                              │
│                                                                              │
│  • Provisions context envelope                                               │
│  • Creates/uses agent session                                                │
│  • Executes agent task                                                       │
│  • Saves work_outputs                                                        │
│  • Handles checkpoints                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Schema Changes

### work_requests (extend existing)

```sql
ALTER TABLE work_requests
ADD COLUMN recipe_id UUID REFERENCES work_recipes(id),
ADD COLUMN recipe_slug TEXT,  -- Denormalized for quick access
ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'thinking_partner', 'schedule', 'api')),
ADD COLUMN scheduling_intent JSONB DEFAULT NULL;
-- scheduling_intent example:
-- {
--   "mode": "recurring",           -- "one_shot" | "recurring"
--   "frequency": "weekly",         -- "weekly" | "biweekly" | "monthly" | "custom"
--   "day_of_week": 1,              -- 0-6 (Sunday-Saturday)
--   "time_of_day": "09:00:00",     -- UTC
--   "cron_expression": null        -- For custom
-- }
```

### work_recipes (extend existing)

```sql
ALTER TABLE work_recipes
ADD COLUMN schedulable BOOLEAN DEFAULT true,
ADD COLUMN default_frequency TEXT,  -- Suggested scheduling if enabled
ADD COLUMN min_interval_hours INTEGER DEFAULT 24;  -- Minimum time between runs
```

### work_tickets (already extended in continuous_work_model migration)

Existing columns already support this:
- `work_request_id` - FK to work_request
- `schedule_id` - FK to project_schedules
- `mode` - 'one_shot' | 'continuous'
- `cycle_number` - For continuous tickets
- `source` - 'manual' | 'thinking_partner' | 'schedule' | 'api'

### Unified Metadata Schema

All work_requests use this structure in `parameters` JSONB:

```json
{
  "recipe": {
    "slug": "trend_digest",
    "name": "Trend Digest",
    "parameters": {
      "timeframe": "week"
    }
  },
  "context": {
    "basket_id": "uuid",
    "requirements": ["problem", "customer"],
    "snapshot_at_creation": { /* optional context snapshot */ }
  },
  "execution": {
    "priority": 5,
    "mode": "one_shot",
    "approval_strategy": "final_only"
  },
  "scheduling": {
    "enabled": false,
    "frequency": null,
    "day_of_week": null,
    "time_of_day": null
  },
  "origin": {
    "source": "thinking_partner",
    "tp_session_id": "uuid",
    "triggered_at": "2025-12-05T10:00:00Z"
  }
}
```

## Implementation Plan

### Phase 1: Unified Entry Point (1 day)

1. Create `POST /api/work/queue` endpoint:
   - Accepts recipe_slug, basket_id, parameters, scheduling_intent
   - Validates recipe exists and context requirements met
   - Creates work_request with normalized metadata
   - Creates work_ticket in pending state
   - Returns { work_request_id, work_ticket_id }

2. Update `recipe_tools.py` `trigger_recipe()`:
   - Call `/api/work/queue` instead of direct ticket insert
   - Pass `source: "thinking_partner"` and `tp_session_id`

3. Update schedule executor:
   - Call `/api/work/queue` with `source: "schedule"` and `schedule_id`
   - Remove direct ticket creation logic

### Phase 2: Queue Processor (1 day)

1. Create `POST /api/work/process` endpoint:
   - Query pending tickets ordered by priority, created_at
   - Lock ticket (set status = 'running')
   - Call WorkTicketExecutor.execute_work_ticket()
   - Handle result (completed, failed, checkpoint)

2. Create cron job for queue processor:
   - Runs every 30 seconds
   - Calls POST /api/work/process
   - Processes up to 5 tickets per invocation

### Phase 3: Recipe Scheduling Integration (1 day)

1. Extend work_recipes with scheduling metadata
2. Update recipe discovery endpoints to include schedulability
3. Update project_schedules creation to validate recipe.schedulable
4. Add scheduling toggle to Work Request UI

### Phase 4: TP Config Updates (0.5 day)

1. Update TP recipe tools to use new queue endpoint
2. Update TP system prompt with scheduling-aware recipes
3. Test end-to-end TP → work_request → ticket → execution flow

## Alternatives Considered

### 1. Keep three separate paths, add execution triggers

**Rejected:** Doesn't solve audit trail or metadata consistency issues.

### 2. Use database triggers for queue processing

**Rejected:** Less controllable, harder to debug, Supabase function limits.

### 3. Combine work_request and work_ticket into single table

**Rejected:** work_request is the "intent" (what user wants), work_ticket is "execution" (how/when it runs). Keeping them separate enables:
- Multiple tickets per request (retries, iterations)
- Better audit trail
- Cleaner state machine

## Migration Strategy

1. Deploy schema changes (backward compatible - all new columns nullable or have defaults)
2. Deploy new queue endpoint alongside existing paths
3. Update TP to use queue endpoint
4. Update schedule executor to use queue endpoint
5. Deploy queue processor cron
6. Monitor for stuck tickets, verify execution
7. Remove legacy direct-insert code paths

## Success Metrics

1. **Zero stuck tickets** - All pending tickets eventually processed
2. **Unified audit trail** - Every work has a work_request
3. **Source visibility** - Can filter tickets by source
4. **Scheduling works** - Scheduled recipes execute on time

## Related Documents

- [ADR_CONTINUOUS_WORK_MODEL.md](./ADR_CONTINUOUS_WORK_MODEL.md) - Continuous work concepts
- [THINKING_PARTNER_IMPLEMENTATION_PLAN.md](../implementation/THINKING_PARTNER_IMPLEMENTATION_PLAN.md) - TP architecture
- [scheduling.md](../features/scheduling.md) - Scheduling feature design
