# Claude Code CLI Missing - Root Cause & Fix

**Date:** 2025-11-26
**Commit:** fb84dfe0
**Severity:** CRITICAL - 100% of Skill-based work tickets failing

---

## Problem Summary

All work tickets using the `executive-summary-deck` recipe (and any recipe requiring Skills) were completing with **ZERO outputs** despite:
- ✅ Skills installed at `/app/.claude/skills/`
- ✅ Agent configuration correct (`allowed_tools`, `setting_sources`)
- ✅ System prompts including Skill instructions
- ✅ Reasonable execution times (70-300 seconds)

---

## Root Cause Discovered

### Diagnostic Evidence

**CLI Check Result:**
```json
{
  "claude_cli": {
    "found": false,
    "path": null
  }
}
```

**SDK Behavior:**
```json
{
  "tool_calls": [],
  "skill_invoked": false,
  "response_text": "(no text response)",
  "response_length": 0
}
```

**The Missing Link:**
The **Claude Code CLI** was not installed in the Docker container.

### Why This Broke Everything

The Claude Agent SDK is a **Python wrapper** around the **Claude Code CLI** (a Node.js application). The architecture is:

```
Python Code
    ↓
claude-agent-sdk (Python package)
    ↓
claude-code (Node.js CLI) ← THIS WAS MISSING
    ↓
Skills (.claude/skills/)
    ↓
File generation (PPTX, PDF, etc.)
```

Without the CLI installed:
- SDK's `ClaudeSDKClient` initializes successfully (no error)
- SDK's `connect()` completes (appears to work)
- SDK's `query()` accepts prompts (no failure)
- SDK's `receive_response()` iterator **returns nothing**
  - No messages
  - No content blocks
  - No tool calls
  - Just silent completion

This is why agents appeared to "complete successfully" but produced zero outputs.

---

## The Misleading Dockerfile Comment

**Original Comment (WRONG):**
```dockerfile
# NOTE: Claude Code CLI is bundled with claude-agent-sdk Python package
# The Python SDK will manage the CLI installation and lifecycle automatically
# No need to install it separately via npm
```

This was **incorrect**. The CLI is NOT bundled with the Python package and does NOT install automatically.

---

## The Fix

### Dockerfile Changes

**Before:**
```dockerfile
# Verify Node.js and npm installed
RUN node --version && npm --version

# NOTE: Claude Code CLI is bundled with claude-agent-sdk Python package
# The Python SDK will manage the CLI installation and lifecycle automatically
# No need to install it separately via npm

# Set working directory
WORKDIR /app
```

**After:**
```dockerfile
# Verify Node.js and npm installed
RUN node --version && npm --version

# Install Claude Code CLI globally
# The Python SDK (claude-agent-sdk) wraps this CLI, so it must be installed
RUN npm install -g @anthropic-ai/claude-code

# Verify Claude Code CLI is accessible
RUN which claude-code && claude-code --version

# Set working directory
WORKDIR /app
```

### What This Does

1. **Installs CLI globally** via npm
2. **Verifies installation** - build will fail if CLI not found
3. **Makes CLI accessible** in PATH for SDK to invoke

---

## Investigation Timeline

### Phase 1: Tracking Page Refactor
- User reported no todo list or outputs showing after completion
- Refactored tracking page with comprehensive diagnostics
- Added warning banners for zero-output scenarios

### Phase 2: Database Analysis
```sql
-- Query showed 5 recent tickets ALL with:
status: "completed"
execution_time_ms: 70-300s
metadata.output_count: 0
metadata.final_todos: []
work_outputs count: 0
```

### Phase 3: Skills Infrastructure Check
- Created `/api/diagnostics/skills` endpoint
- Confirmed Skills present at `/app/.claude/skills/`
- Confirmed SKILL.md files accessible
- All 4 Skills found (pptx, pdf, xlsx, docx)

### Phase 4: Agent Configuration Check
- Created `/api/diagnostics/agent-config` endpoint
- Confirmed `allowed_tools` includes "Skill"
- Confirmed `setting_sources = ["user", "project"]`
- Confirmed system prompt has Skill instructions

### Phase 5: Skill Invocation Test
- Created `/api/diagnostics/test-skill-invocation` endpoint
- **CRITICAL FINDING**: SDK returns completely empty responses
- Zero tool calls, zero text, zero everything

### Phase 6: Enhanced Logging
- Added INFO-level logging to `reporting_agent_sdk.py`
- Track every message, every content block, every tool call
- Iteration summaries showing message count vs output count

### Phase 7: PYTHONPATH Hypothesis
- User suggested checking PYTHONPATH configuration
- Verified working directory is `/app` (correct)
- Skills at `/app/.claude/skills/` (correct path)
- PYTHONPATH not the issue

### Phase 8: **ROOT CAUSE IDENTIFIED**
- Added Claude CLI check to diagnostics
- **DISCOVERED: `claude-code` NOT FOUND**
- Updated Dockerfile to install CLI
- Deployed fix (commit fb84dfe0)

---

## Expected Behavior After Fix

### Immediate Effects

1. **Docker Build**
   - CLI installation during build: `npm install -g @anthropic-ai/claude-code`
   - Verification step: `claude-code --version`
   - Build fails fast if CLI unavailable

2. **Diagnostics Endpoint**
   ```json
   {
     "claude_cli": {
       "found": true,
       "path": "/usr/local/bin/claude-code"
     }
   }
   ```

3. **Skill Invocation Test**
   ```json
   {
     "tool_calls": [{"tool": "Skill", "input": "..."}],
     "skill_invoked": true,
     "response_text": "I'll create a presentation...",
     "response_length": 234
   }
   ```

4. **Enhanced Logging (Production)**
   ```
   [REPORTING-RECIPE] Starting SDK response iteration...
   [REPORTING-RECIPE] Message #1: type=AgentMessage
   [REPORTING-RECIPE] Processing 5 content blocks
   [REPORTING-RECIPE] Block #0: type=text
   [REPORTING-RECIPE] 📝 Text block: 234 chars - Preview: Creating executive summary...
   [REPORTING-RECIPE] Block #1: type=tool_use
   [REPORTING-RECIPE] ⚙️ Tool use detected: TodoWrite
   [REPORTING-RECIPE] Block #2: type=tool_result
   [REPORTING-RECIPE] ✅ Tool result from: TodoWrite
   [REPORTING-RECIPE] Block #3: type=tool_use
   [REPORTING-RECIPE] ⚙️ Tool use detected: Skill
   [REPORTING-RECIPE] Block #4: type=tool_result
   [REPORTING-RECIPE] ✅ Tool result from: emit_work_output
   [REPORTING-RECIPE] Iteration complete: 1 messages, 1 outputs, 234 chars
   ```

### Functional Changes

**Work Tickets Will Now:**
- ✅ Show real-time progress via TodoWrite
- ✅ Invoke Skill tool for PPTX generation
- ✅ Generate work_outputs with file_id
- ✅ Complete with metadata.output_count > 0
- ✅ Populate metadata.final_todos with execution steps
- ✅ Display results in tracking page

**User Experience:**
- Real-time todo list updates (SSE streaming)
- Completed tickets show historical execution steps
- Work outputs section populated with PPTX files
- No more "completed without outputs" warnings

---

## Testing Plan

### 1. Verify Build Success
```bash
# Watch Render deployment logs for:
# ✅ npm install -g @anthropic-ai/claude-code
# ✅ which claude-code
# ✅ claude-code --version
```

### 2. Run Diagnostics (After Deploy)
```bash
# Check CLI installed
curl https://yarnnn-app-fullstack.onrender.com/api/diagnostics/skills | jq '.claude_cli'
# Expected: {"found": true, "path": "/usr/local/bin/claude-code"}

# Test Skill invocation
curl -X POST https://yarnnn-app-fullstack.onrender.com/api/diagnostics/test-skill-invocation | jq
# Expected: skill_invoked = true, tool_calls array populated
```

### 3. Create Real Work Ticket
```bash
# Via frontend: Create new work request
# Recipe: executive-summary-deck
# Watch tracking page for:
# - Real-time todo updates
# - Tool invocations in logs
# - Final PPTX output
```

### 4. Monitor Production Logs
```bash
# In Render dashboard, filter for:
[REPORTING-RECIPE]
# Should see full message iteration with tool calls
```

---

## Files Changed

### Modified
1. **work-platform/api/Dockerfile**
   - Added: `npm install -g @anthropic-ai/claude-code`
   - Added: CLI verification step
   - Removed: Misleading comment about automatic installation

2. **work-platform/api/src/agents_sdk/reporting_agent_sdk.py**
   - Added: Comprehensive INFO-level logging
   - Added: Message counting and iteration summaries
   - Added: Content block type tracking with previews

3. **work-platform/api/src/app/routes/diagnostics.py**
   - Added: `/diagnostics/skills` - Skills + CLI check
   - Added: `/diagnostics/agent-config` - Configuration validation
   - Added: `/diagnostics/test-skill-invocation` - End-to-end test

4. **work-platform/web/app/projects/[id]/work-tickets/[ticketId]/track/TicketTrackingClient.tsx**
   - Added: Warning banners for zero outputs
   - Added: Diagnostics panel
   - Added: Historical execution trace
   - Added: Expected vs actual output comparison

### Created
1. **TRACKING_PAGE_REFACTOR_SUMMARY.md** - UI changes documentation
2. **LOGGING_ENHANCEMENT_SUMMARY.md** - Logging strategy documentation
3. **CLAUDE_CLI_ROOT_CAUSE_FIX.md** - This document

---

## Key Learnings

### 1. **Trust But Verify**
The Dockerfile comment was wrong. Always verify infrastructure assumptions with diagnostics.

### 2. **Silent Failures Are Dangerous**
The SDK returning empty responses without errors made this hard to diagnose. Added comprehensive logging to prevent this in future.

### 3. **Layered Diagnostics**
Having multiple diagnostic endpoints at different layers (Skills, Agent Config, Invocation Test) helped narrow down the issue systematically.

### 4. **User Intuition Matters**
User's suggestion about PYTHONPATH led to checking working directory, which led to checking CLI installation. Good instinct.

---

## Impact Assessment

### Before Fix
- **Work tickets**: 100% failure rate for Skill-based recipes
- **User experience**: "Completed" tickets with no deliverables
- **Debugging**: No visibility into why outputs missing
- **Time wasted**: 70-300 seconds per ticket for nothing

### After Fix
- **Work tickets**: Should complete with expected outputs
- **User experience**: Real-time progress + final deliverables
- **Debugging**: Comprehensive logging at every step
- **Confidence**: CLI verification prevents future regressions

---

## Next Actions

1. **Monitor first successful ticket** - Confirm PPTX generation works
2. **Validate logging quality** - Ensure INFO logs show full execution
3. **Archive old tickets** - Mark pre-fix tickets as "infrastructure failure"
4. **Update documentation** - Correct deployment guides about CLI requirement

---

## Deployment Status

**Commit**: fb84dfe0
**Pushed**: 2025-11-26
**Render Status**: Building...
**ETA**: 3-5 minutes

Once build completes, the Claude Code CLI will be available and Skills will work as designed.
