# Claude Agent SDK + Skills Investigation

**Date:** 2025-11-26
**Status:** ONGOING - Isolating Skill Tool Issue
**Severity:** HIGH - 100% of Skill-based work tickets failing

---

## Executive Summary

The Claude Agent SDK successfully handles text-based generation but **completely fails when the Skill tool is enabled**. The SDK's `receive_response()` iterator returns nothing when Skills are in the allowed_tools array, even though:
- ✅ Claude Code CLI installed at `/usr/bin/claude`
- ✅ All 4 Skills present in `/app/.claude/skills/`
- ✅ Agent configuration correct (`allowed_tools`, `setting_sources`)
- ✅ System prompts include Skill instructions
- ✅ API key configured

---

## Evidence Summary

### ✅ What Works: Text-Based Generation

**Database Evidence:**
```sql
-- 4 successful work tickets from Nov 24-25
ticket_id | status    | agent_type | output_type  | generation_method | body_length
----------|-----------|------------|--------------|-------------------|------------
cc004714  | completed | reporting  | report_draft | text              | 3505
5e00b83c  | completed | reporting  | report_draft | text              | 9597
d0105f07  | completed | reporting  | report_draft | text              | 10923
6ff24ea1  | completed | reporting  | report_draft | text              | 12958
```

**Key Points:**
- All used the **reporting agent**
- All used `generation_method: "text"` (NOT Skills)
- Produced substantial text outputs (3,505 - 12,958 characters)
- Some used the SAME `executive-summary-deck` recipe (before Skills were added)
- **This proves the SDK itself works for text responses**

### ❌ What Doesn't Work: Skill Tool

**Diagnostic Test Results:**

**Skills Infrastructure:**
```json
{
  "working_directory": "/app",
  "claude_dir_exists": true,
  "skills_dir_exists": true,
  "available_skills": ["xlsx", "pptx", "pdf", "docx"],
  "claude_cli": {
    "found": true,
    "path": "/usr/bin/claude"
  }
}
```

**Agent Configuration:**
```json
{
  "model": "claude-sonnet-4-5",
  "allowed_tools": ["TodoWrite", "emit_work_output", "Skill"],
  "setting_sources": ["user", "project"],
  "system_prompt_has_skill_instructions": true
}
```

**Skill Invocation Test:**
```json
{
  "status": "success",
  "tool_calls": [],
  "skill_invoked": false,
  "response_text": "(no text response)",
  "response_length": 0,
  "message_count": 0
}
```

**Critical Finding:** The SDK's `receive_response()` iterator yields **ZERO messages** when Skills are enabled.

---

## Timeline of Investigation

### Phase 1: Tracking Page Refactor (Nov 25)
- User reported no visibility into execution details
- Refactored tracking page with diagnostics and warnings
- Identified pattern: All recent tickets completing with zero outputs

### Phase 2: Database Analysis (Nov 25)
- Confirmed 5 recent `executive-summary-deck` tickets: ALL zero outputs
- Execution times reasonable (70-300 seconds)
- Metadata showed `output_count: 0`, `final_todos: []`
- No errors recorded

### Phase 3: Skills Infrastructure Check (Nov 26)
- Created `/api/diagnostics/skills` endpoint
- **Discovered Claude CLI NOT installed** (first root cause)
- Updated Dockerfile to install `@anthropic-ai/claude-code`
- Deployment successful, CLI now at `/usr/bin/claude`

### Phase 4: Enhanced Logging (Nov 26)
- Added comprehensive INFO-level logging to `reporting_agent_sdk.py`
- Switched from `logger.info()` to `print(flush=True)` for visibility
- Logs showed: NO messages from SDK iterator

### Phase 5: User Insight - Text vs Skills (Nov 26)
- User pointed out: Previous work ticket DID produce text-based output
- Investigation confirmed: SDK works for text, NOT for Skills
- **This narrowed the problem to the Skill tool specifically**

### Phase 6: Basic SDK Test (Nov 26 - IN PROGRESS)
- Created `/api/diagnostics/test-basic-sdk` endpoint
- Tests SDK WITHOUT Skills (just text responses)
- Will definitively prove SDK works, isolating Skill tool as the problem
- Deployment in progress...

---

## Technical Analysis

### Claude Agent SDK Architecture

```
Python Code (reporting_agent_sdk.py)
    ↓
claude-agent-sdk (Python package)
    ↓ wraps/spawns
claude (Node.js CLI binary)
    ↓ loads
Skills (.claude/skills/)
    ↓ generates
Files (PPTX, PDF, etc.)
```

### Expected Flow (When Working)

1. **Agent SDK Initialization:**
   ```python
   options = ClaudeAgentOptions(
       model="claude-sonnet-4-5",
       allowed_tools=["Skill"],
       setting_sources=["user", "project"],  # Required for Skills
   )
   ```

2. **SDK Connection:**
   ```python
   async with ClaudeSDKClient(options=options) as client:
       await client.connect()
       await client.query("Create a PPTX presentation...")
   ```

3. **Response Iteration (EXPECTED):**
   ```python
   async for message in client.receive_response():
       # Should yield messages with content blocks:
       # - text blocks (agent thinking)
       # - tool_use blocks (invoking Skill tool)
       # - tool_result blocks (file_id from Skill)
   ```

4. **Output Capture:**
   ```python
   if block.type == 'tool_result' and tool_name == 'Skill':
       file_id = block.result['file_id']
       emit_work_output(file_id=file_id, ...)
   ```

### Actual Flow (Currently Broken)

1. ✅ Agent SDK initializes successfully
2. ✅ SDK connection succeeds (no errors)
3. ✅ Query sent to SDK
4. ❌ **Iterator yields ZERO messages**
   - No text blocks
   - No tool calls
   - No errors
   - Just silent completion
5. ❌ No outputs generated

---

## Hypotheses

### Hypothesis 1: Skills Incompatible with Server Environments ⚠️ LIKELY
**Evidence:**
- Skills may be designed for interactive terminal use only
- Server environments lack TTY, user input, etc.
- Claude CLI might require interactive session for Skills

**Test:** Basic SDK test (text-only) will confirm if SDK works in server environment

### Hypothesis 2: Missing Skills Configuration 🤔 POSSIBLE
**Evidence:**
- `setting_sources: ["user", "project"]` is required
- We have this configured
- But maybe there's additional config needed?

**Next Steps:**
- Check Claude Code CLI documentation for server deployment
- Look for environment variables or config files

### Hypothesis 3: SDK Version Compatibility 🤔 POSSIBLE
**Evidence:**
- Using `claude-agent-sdk>=0.1.8` (Nov 19, 2025)
- Using `@anthropic-ai/claude-code` (latest)
- Version mismatch possible?

**Next Steps:**
- Check if specific SDK version requires specific CLI version
- Try pinning exact versions

### Hypothesis 4: Authentication/Permission Issue ❌ UNLIKELY
**Evidence:**
- API key is configured correctly (confirmed via diagnostic)
- SDK connects successfully
- If auth was the issue, we'd see errors, not silent failure

---

## Next Actions (Priority Order)

### 1. ✅ Complete Basic SDK Test (IN PROGRESS)
**Purpose:** Definitively prove SDK works for text-only responses

**Expected Result:**
```json
{
  "status": "success",
  "message_count": 1,
  "response_text": "Hello! Here's counting: 1, 2, 3.",
  "response_length": 35
}
```

**If This Succeeds:**
- Proves SDK fundamentally works in server environment
- Confirms issue is ONLY with Skill tool
- Narrows investigation to Skills-specific configuration

**If This Fails:**
- Indicates broader SDK compatibility issue
- May need to abandon SDK approach entirely
- Consider alternatives (direct Anthropic API, etc.)

### 2. Investigate Claude Code CLI Server Mode
**Research:**
- Check if Claude CLI has "server mode" or "daemon mode"
- Look for environment variables for non-interactive use
- Review official documentation for production deployment

**Possible Findings:**
- CLI might require `--headless` or similar flag
- Might need to spawn CLI separately and connect via IPC
- Skills might not be supported in non-interactive mode

### 3. Test Alternative Approaches

**Option A: Direct Anthropic API (No SDK)**
```python
# Use anthropic Python client directly
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

response = client.messages.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": prompt}],
    # No Skills support, but text generation works
)
```

**Pros:**
- Simple, reliable
- No CLI dependency
- Known to work in server environments

**Cons:**
- No Skills support
- Would need to implement PPTX generation ourselves
- Loses Skills ecosystem

**Option B: Implement Our Own File Generation**
```python
# Use python-pptx library directly
from pptx import Presentation

# Generate PPTX based on agent's text output
prs = Presentation()
# Parse agent output and create slides
```

**Pros:**
- Full control over output format
- No CLI dependency
- Works in any environment

**Cons:**
- More code to maintain
- Need to parse agent output
- Loses Skills abstraction

### 4. Reach Out to Anthropic Support
**Questions to Ask:**
- Is the Claude Agent SDK designed for server/production use?
- Are Skills supported in non-interactive environments?
- Is there a recommended approach for server-side PPTX generation?
- Any examples of production deployments using Skills?

---

## Code References

### Key Files Modified

1. **[Dockerfile](work-platform/api/Dockerfile)**
   - Added Claude Code CLI installation (lines 18-22)
   - Verifies CLI presence during build

2. **[diagnostics.py](work-platform/api/src/app/routes/diagnostics.py)**
   - `/api/diagnostics/skills` - Infrastructure check
   - `/api/diagnostics/agent-config` - Configuration validation
   - `/api/diagnostics/test-skill-invocation` - Skill test (fails)
   - `/api/diagnostics/test-basic-sdk` - Basic test (pending)

3. **[reporting_agent_sdk.py](work-platform/api/src/agents_sdk/reporting_agent_sdk.py)**
   - Enhanced logging (lines 447-531, 732-815)
   - Tracks message count, content blocks, tool calls

4. **[agent_server.py](work-platform/api/src/app/agent_server.py)**
   - Auth whitelist for diagnostic endpoints (line 128)

---

## Metrics

### Failure Rate
- **Skill-based tickets:** 100% failure (0 outputs)
- **Text-based tickets:** 100% success (substantial outputs)

### Resource Usage
- **Execution time:** 70-300 seconds (reasonable, not hanging)
- **Memory:** No issues observed
- **CPU:** No issues observed

### User Impact
- **Autonomous work:** Completely blocked
- **Workaround:** None available
- **Severity:** HIGH - Core functionality unavailable

---

## Deployment History

| Commit   | Change                          | Result                      |
|----------|----------------------------------|------------------------------|
| fb84dfe0 | Install Claude Code CLI         | CLI now available            |
| 02f731f7 | Enhanced logging                | Visibility into SDK behavior |
| 5b2ca254 | Add basic SDK test              | Test endpoint created        |
| 17d58e5a | Whitelist test endpoint         | Auth bypass for diagnostics  |

---

## Open Questions

1. **Is the SDK designed for production use?**
   - Documentation unclear on server deployments
   - All examples seem to be for interactive terminal use

2. **Are Skills supported in headless environments?**
   - No clear documentation on this
   - May be terminal-only feature

3. **Why does the iterator return nothing?**
   - No errors thrown
   - No logs from CLI
   - Silent failure suggests CLI not spawning or connecting

4. **What's the recommended production approach?**
   - Should we use Skills?
   - Should we use direct API?
   - Should we implement our own file generation?

---

## Status: AWAITING BASIC SDK TEST RESULTS

Once the basic SDK test completes, we'll know definitively whether to:
- **Path A:** Fix Skills configuration (if basic SDK works)
- **Path B:** Abandon SDK approach (if basic SDK also fails)
- **Path C:** Hybrid approach (SDK for text, custom code for files)

**Next Update:** After deployment completes (~3 minutes)
