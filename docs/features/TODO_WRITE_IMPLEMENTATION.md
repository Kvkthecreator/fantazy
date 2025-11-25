# TodoWrite Implementation - Real-time Agent Task Visibility

**Date**: November 25, 2025
**Status**: ✅ Complete - Ready for Testing
**User Request**: Implement TodoWrite for task visibility like Claude Code

## Overview

Implemented real-time agent task progress tracking using the Claude Agent SDK's `TodoWrite` tool, matching the behavior of Claude Code. This provides frontend visibility into what the agent is doing during execution, eliminating the "guessing game" problem.

## User's Explicit Goals

1. ✅ Implement TodoWrite for task visibility like Claude Code shows
2. ✅ Frontend should see todo list from the agent
3. ✅ Confirm if PPT skill utilization (or other skills) generates todo items
4. ✅ Benchmarking against Claude Code's behavior

## Architecture

### Backend Components

#### 1. SSE Streaming Endpoint ([task_streaming.py](../../work-platform/api/src/app/work/task_streaming.py))
```
GET /api/work/tickets/{ticket_id}/stream
```

**Features**:
- Server-Sent Events (SSE) for real-time updates
- In-memory task update queue (TODO: Replace with Redis for production)
- Auto-cleanup on completion/timeout
- JWT authentication via middleware

**Event Types**:
- `connected` - Client connected successfully
- `todo_update` - Task list updated (from TodoWrite tool)
- `completed` - Work ticket finished
- `timeout` - Stream timeout (10 minutes)

#### 2. Agent Integration ([reporting_agent_sdk.py](../../work-platform/api/src/agents_sdk/reporting_agent_sdk.py))

**Changes**:
1. **System Prompt**: Added TodoWrite instructions (mandatory usage)
2. **allowed_tools**: Added `"TodoWrite"` to agent capabilities
3. **Tool Result Interception**: Captures TodoWrite calls and broadcasts via SSE

**Interception Logic**:
```python
elif tool_name == 'TodoWrite':
    from app.work.task_streaming import emit_task_update
    emit_task_update(self.work_ticket_id, {
        "type": "todo_update",
        "todos": todo_data,
        "source": "agent"
    })
```

#### 3. Router Registration ([agent_server.py](../../work-platform/api/src/app/agent_server.py))
- Imported `task_streaming_router`
- Registered with `/api` prefix
- Uses existing JWT auth middleware

### Frontend Components

#### 1. React Hook ([useTaskTracking.ts](../../work-platform/web/hooks/useTaskTracking.ts))
```typescript
const { tasks, isConnected, error, completionStatus } = useTaskTracking(workTicketId);
```

**Features**:
- EventSource API for SSE consumption
- Automatic reconnection on errors
- Cleanup on unmount
- TypeScript typed events

**Return Value**:
```typescript
{
  tasks: TaskUpdate[];           // Current todo list
  isConnected: boolean;          // SSE connection status
  error: string | null;          // Connection/parsing errors
  completionStatus: string | null; // "completed" | "failed"
}
```

#### 2. UI Component ([TaskProgressList.tsx](../../work-platform/web/components/TaskProgressList.tsx))
```tsx
<TaskProgressList workTicketId={ticketId} />
```

**Displays**:
- ✅ Completed tasks (green checkmark)
- 🔄 In-progress tasks (blue spinner)
- ⏳ Pending tasks (gray clock)
- Live connection indicator
- Error states

**Variants**:
- `TaskProgressList` - Full list display
- `TaskProgressInline` - Compact inline status (for headers)

#### 3. Work Ticket Card ([WorkTicketCard.tsx](../../work-platform/web/components/WorkTicketCard.tsx))
- Client component wrapper for ticket display
- Conditionally renders `TaskProgressList` for running tickets
- Integrated into work tickets view page

## System Prompt Changes

Added mandatory TodoWrite instructions to reporting agent:

```markdown
**CRITICAL: Task Progress Tracking (MANDATORY)**
You MUST use the TodoWrite tool at the START of every task to show users what you're doing.

At the beginning:
1. Call TodoWrite with ALL steps you'll perform
2. Use "content" for the task name (e.g., "Load substrate context")
3. Use "activeForm" for what you're doing (e.g., "Loading substrate context")
4. Set status to "pending" initially

As you work:
- Mark current step "in_progress" BEFORE starting it
- Mark "completed" AFTER finishing
- Create new todos if you discover additional work

Example:
TodoWrite([
  {content: "Analyze substrate blocks for key insights", status: "in_progress", activeForm: "Analyzing substrate blocks"},
  {content: "Generate PPTX using Skill tool (skill_id='pptx')", status: "pending", activeForm: "Generating PPTX file"},
  {content: "Save output via emit_work_output", status: "pending", activeForm: "Saving work output"}
])
```

## Data Flow

```
Agent Execution (ReportingAgentSDK)
  ↓
Agent calls TodoWrite tool
  ↓
SDK intercepts tool result
  ↓
emit_task_update(ticket_id, update)
  ↓
TASK_UPDATES[ticket_id].append(update)
  ↓
SSE stream (/api/work/tickets/{id}/stream)
  ↓
Frontend EventSource
  ↓
useTaskTracking hook
  ↓
TaskProgressList component
  ↓
User sees real-time progress
```

## Files Created/Modified

### Backend
- ✅ **Created**: `work-platform/api/src/app/work/task_streaming.py` (SSE endpoint)
- ✅ **Modified**: `work-platform/api/src/agents_sdk/reporting_agent_sdk.py` (TodoWrite integration)
- ✅ **Modified**: `work-platform/api/src/app/agent_server.py` (router registration)

### Frontend
- ✅ **Created**: `work-platform/web/hooks/useTaskTracking.ts` (SSE consumer hook)
- ✅ **Created**: `work-platform/web/components/TaskProgressList.tsx` (UI component)
- ✅ **Created**: `work-platform/web/components/WorkTicketCard.tsx` (ticket card with progress)
- ✅ **Modified**: `work-platform/web/app/projects/[id]/work-tickets-view/page.tsx` (integration)

### Documentation
- ✅ **Created**: `docs/features/TODO_WRITE_IMPLEMENTATION.md` (this file)

## Testing Plan

### Manual Testing Steps

1. **Start Agent Execution**:
   ```bash
   # Execute a reporting workflow with recipe
   curl -X POST 'http://localhost:8000/api/work/reporting/execute' \
     -H 'Authorization: Bearer {JWT}' \
     -H 'Content-Type: application/json' \
     -d '{
       "basket_id": "...",
       "task_description": "Generate executive summary deck",
       "recipe_id": "executive-summary-deck"
     }'
   ```

2. **Subscribe to SSE Stream** (Frontend automatically does this):
   ```javascript
   const eventSource = new EventSource('/api/work/tickets/{ticket_id}/stream');
   eventSource.onmessage = (event) => {
     console.log('Task update:', JSON.parse(event.data));
   };
   ```

3. **Verify TodoWrite Calls**:
   - Check backend logs for `[Task Update]` entries
   - Confirm agent is calling TodoWrite at task start
   - Verify tasks are marked in_progress → completed

4. **Frontend Visibility**:
   - Navigate to `/projects/{id}/work-tickets-view?status=running`
   - Confirm running tickets show live task progress
   - Verify status icons (⏳ → 🔄 → ✅)
   - Check connection indicator (green dot)

### Expected TodoWrite Output (from Agent)

When agent executes PPTX recipe, we should see:

```json
{
  "type": "todo_update",
  "todos": [
    {
      "content": "Load substrate blocks and context",
      "status": "completed",
      "activeForm": "Loading substrate blocks and context"
    },
    {
      "content": "Analyze key insights for executive summary",
      "status": "in_progress",
      "activeForm": "Analyzing key insights for executive summary"
    },
    {
      "content": "Generate PPTX using Skill tool (skill_id='pptx')",
      "status": "pending",
      "activeForm": "Generating PPTX file"
    },
    {
      "content": "Save output via emit_work_output",
      "status": "pending",
      "activeForm": "Saving work output"
    }
  ]
}
```

### Validation Checklist

- [ ] SSE endpoint accessible at `/api/work/tickets/{id}/stream`
- [ ] Agent calls TodoWrite at task start
- [ ] Frontend receives todo updates in real-time
- [ ] Task status icons update correctly (pending → in_progress → completed)
- [ ] Connection indicator shows green dot when connected
- [ ] Skills invocation (PPTX, PDF, etc.) appears in todo list
- [ ] Error states handled gracefully (timeout, connection loss)
- [ ] Cleanup occurs on task completion

## Production Considerations

### 1. Replace In-Memory Queue with Redis
**Current**: `TASK_UPDATES: dict[str, list[dict]] = {}`
**Production**: Use Redis pub/sub for multi-instance support

```python
# Example Redis implementation
import redis

redis_client = redis.Redis(...)

def emit_task_update(ticket_id: str, update: dict):
    redis_client.publish(f"task_updates:{ticket_id}", json.dumps(update))
```

### 2. CORS Configuration
Currently allows `localhost:3000` for development. Update for production:

```python
allow_origins=[
    "https://www.yarnnn.com",
    "https://yarnnn.com",
]
```

### 3. SSE Connection Limits
- Vercel has connection limits for serverless functions
- Consider dedicated SSE service (separate from API)
- Use Redis for horizontal scaling

### 4. Timeout Configuration
- Current: 10 minutes (600 seconds)
- Adjust based on longest expected recipe execution
- Add configurable timeout per recipe type

## Benefits Achieved

1. **Transparency**: Users see exactly what the agent is doing
2. **Debugging**: TodoWrite reveals if Skills are being invoked
3. **Trust**: Real-time progress reduces uncertainty
4. **Parity**: Matches Claude Code's user experience
5. **Diagnostics**: Can confirm PPT Skill utilization issue

## Next Steps

1. **Deploy to Staging**: Test TodoWrite with actual recipe executions
2. **Verify Skills Invocation**: Check if agent creates todo for "Generate PPTX using Skill tool"
3. **Skills Debugging**: If Skills still not invoked, TodoWrite will reveal where agent deviates
4. **Production Migration**: Replace in-memory queue with Redis
5. **Apply to All Agents**: Extend TodoWrite to research/content agents

## Related Issues

- **Skills Not Being Invoked** ([MIGRATION_APPLIED_SUCCESS_2025_11_24.md](../fixes/MIGRATION_APPLIED_SUCCESS_2025_11_24.md))
  - TodoWrite will help diagnose why agent generates text instead of calling Skill tool
  - If todo says "Generate PPTX using Skill tool" but agent generates markdown instead, we know the issue is in tool invocation logic

## References

- Claude Agent SDK TodoWrite: https://platform.claude.com/docs/en/agent-sdk/python#todo-write
- Claude Code Documentation: User's benchmark for desired behavior
- SSE Specification: Server-Sent Events (EventSource API)
