# Core SDK Workflow Audit & Refactoring Plan

**Date:** 2025-11-26
**Philosophy Shift:** Skills → Core SDK Hardening
**Goal:** Build confidence in fundamental SDK capabilities before attempting Skills

---

## Problem Statement

We've been focused on Skills (PPTX/PDF generation) as the center of attention, but we haven't validated that the **core Claude Agent SDK workflow** actually works in our production environment.

**Critical Gaps:**
1. ❓ Does SDK receive and parse text responses correctly?
2. ❓ Does TodoWrite tool work for real-time progress tracking?
3. ❓ Does emit_work_output MCP tool work for saving results?
4. ❓ Can we achieve a successful end-to-end workflow without Skills?

**Database Evidence Suggests Text Generation DOES Work:**
- 4 successful tickets from Nov 24-25 produced text-based outputs (3,505-12,958 chars)
- BUT: Those might have been from a DIFFERENT code path (legacy agent?)
- We need to VALIDATE the current SDK implementation works

---

## Current Architecture Analysis

### Service Philosophy (As Implemented)

```python
# reporting_agent_sdk.py Lines 277-289
self._options = ClaudeAgentOptions(
    model=self.model,
    system_prompt=self._build_system_prompt(),
    mcp_servers={"shared_tools": shared_tools},
    allowed_tools=[
        "mcp__shared_tools__emit_work_output",  # ✅ Custom MCP tool
        "Skill",                                 # ❌ UNVALIDATED - blocking everything
        "code_execution",                        # ❓ UNVALIDATED
        "TodoWrite"                              # ❓ UNVALIDATED - critical for UX
    ],
    setting_sources=["user", "project"],  # Required for Skills
)
```

**Problem:** We're loading 4 tools but haven't validated ANY of them work correctly.

### Three Core Capabilities to Validate

#### 1. **Text Generation** (Fundamental)
**What:** SDK receives Claude's text responses
**Why Critical:** Everything else builds on this
**Current Status:** ❓ UNVALIDATED (3 messages yielded, 0 text extracted)

```python
# Expected flow
async for message in client.receive_response():
    if hasattr(message, 'content'):
        for block in message.content:
            if block.type == 'text':
                text += block.text  # ← This should work
```

**Test Required:** Simple text generation (no tools)

#### 2. **TodoWrite Tool** (Real-time UX)
**What:** Agent calls TodoWrite to show progress
**Why Critical:** User visibility into autonomous work
**Current Status:** ❓ UNVALIDATED

```python
# Expected flow
TodoWrite([
    {content: "Analyzing data", status: "in_progress", activeForm: "Analyzing..."},
    {content: "Writing report", status: "pending", activeForm: "Writing report"}
])
# Should emit TASK_UPDATES via Supabase Realtime
```

**Integration Points:**
- Frontend: SSE connection to `/api/work/tickets/{id}/task-updates`
- Backend: `shared_tools_mcp.py` → `emit_task_update()` → Supabase channel

**Test Required:** TodoWrite invocation + SSE reception

#### 3. **emit_work_output Tool** (Deliverables)
**What:** Agent calls emit_work_output to save text-based results
**Why Critical:** Without this, no outputs saved to DB
**Current Status:** ❓ UNVALIDATED in current SDK code

```python
# Expected flow
emit_work_output(
    output_type="report_draft",
    title="Monthly Report",
    body=report_text,  # Markdown or plain text
    generation_method="text"
)
# Should insert into work_outputs table
```

**Test Required:** Text output saving + DB verification

---

## Refactoring Strategy

### Phase 1: Minimal SDK Validation (TODAY)

**Goal:** Prove SDK can do basic text generation with ZERO tools

**Test Endpoint:** `/api/diagnostics/test-minimal-sdk`

```python
@router.post("/test-minimal-sdk")
async def test_minimal_sdk():
    """
    Absolute minimal SDK test:
    - No tools
    - No MCP servers
    - Just: query → receive_response → extract text
    """
    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        system_prompt="You are a helpful assistant.",
        # NO allowed_tools
        # NO mcp_servers
        # NO setting_sources
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.connect()
        await client.query("Say hello and count to 3.")

        # Critical: Inspect EXACT message structure
        messages = []
        async for message in client.receive_response():
            messages.append({
                "type": type(message).__name__,
                "has_content": hasattr(message, 'content'),
                "content_type": type(message.content).__name__ if hasattr(message, 'content') else None,
                "content_length": len(message.content) if hasattr(message, 'content') else 0,
            })

        return {"messages": messages}
```

**Success Criteria:**
- ✅ At least 1 message received
- ✅ Message has `.content` attribute
- ✅ Content is parseable (list of blocks?)
- ✅ Text extracted successfully

**If This Fails:** SDK fundamentally broken → abandon SDK approach

### Phase 2: TodoWrite Validation (AFTER Phase 1)

**Goal:** Prove TodoWrite tool works end-to-end

**Test Endpoint:** `/api/diagnostics/test-todowrite`

```python
@router.post("/test-todowrite")
async def test_todowrite():
    """
    Test TodoWrite tool invocation and SSE delivery
    """
    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        system_prompt="""You are a task tracker.

When the user says "start task", immediately call TodoWrite with:
[{content: "Test task", status: "in_progress", activeForm: "Testing task"}]

Then respond with "Task created".""",
        allowed_tools=["TodoWrite"],  # ONLY TodoWrite
        # NO Skill
        # NO mcp_servers yet
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.connect()
        await client.query("Start task")

        tool_calls = []
        async for message in client.receive_response():
            for block in message.content:
                if block.type == 'tool_use' and block.name == 'TodoWrite':
                    tool_calls.append(block.input)

        return {
            "todowrite_called": len(tool_calls) > 0,
            "tool_calls": tool_calls
        }
```

**Success Criteria:**
- ✅ TodoWrite tool is invoked
- ✅ Tool input matches expected structure
- ✅ Frontend SSE receives TASK_UPDATES event (manual test)

**If This Fails:** TodoWrite integration broken → fix MCP setup

### Phase 3: emit_work_output Validation (AFTER Phase 2)

**Goal:** Prove text-based outputs can be saved

**Test Endpoint:** `/api/diagnostics/test-work-output`

```python
@router.post("/test-work-output")
async def test_work_output():
    """
    Test emit_work_output MCP tool
    """
    # Create test work ticket
    ticket_id = "test-" + uuid.uuid4().hex[:8]

    shared_tools = create_shared_tools_server(
        basket_id="test-basket",
        work_ticket_id=ticket_id,
        agent_type="reporting"
    )

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        system_prompt="""You are a report writer.

When the user says "write report", you MUST:
1. Generate a simple text report
2. Call emit_work_output with:
   - output_type: "report_draft"
   - title: "Test Report"
   - body: the report text
   - generation_method: "text"
3. Respond with "Report saved".""",
        mcp_servers={"shared_tools": shared_tools},
        allowed_tools=["mcp__shared_tools__emit_work_output"],
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.connect()
        await client.query("Write report")

        tool_calls = []
        async for message in client.receive_response():
            for block in message.content:
                if block.type == 'tool_use':
                    tool_calls.append({
                        "tool": block.name,
                        "input": block.input
                    })

    # Check database
    outputs = await db.execute(
        "SELECT * FROM work_outputs WHERE work_ticket_id = $1",
        ticket_id
    )

    return {
        "tool_called": any(t['tool'].endswith('emit_work_output') for t in tool_calls),
        "outputs_in_db": len(outputs),
        "tool_calls": tool_calls
    }
```

**Success Criteria:**
- ✅ emit_work_output tool is invoked
- ✅ Work output saved to database
- ✅ Output has correct structure (output_type, body, etc.)

**If This Fails:** MCP integration broken → fix shared_tools_mcp.py

### Phase 4: End-to-End Text Workflow (AFTER Phase 3)

**Goal:** Prove complete workflow without Skills

**Test Recipe:** `simple-text-report` (NEW)

```yaml
# work_recipes table
slug: simple-text-report
name: Simple Text Report
agent_type: reporting
output_format: markdown  # NOT pptx/pdf (no Skills)

execution_template:
  task: "Generate a brief summary report about {topic}"

output_specification:
  - type: report_draft
    format: markdown
    description: "Text-based summary report"
```

**Implementation:**

```python
# reporting_agent_sdk.py - NEW method
async def generate_text_report(
    self,
    topic: str,
    instructions: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate a simple text report.

    NO Skills, NO code_execution - just:
    1. TodoWrite for progress
    2. Text generation
    3. emit_work_output for saving
    """
    options = ClaudeAgentOptions(
        model=self.model,
        system_prompt=f"""You are a report writer.

Generate a concise report about: {topic}

WORKFLOW:
1. Call TodoWrite with your plan
2. Write a 3-paragraph report
3. Call emit_work_output to save it
4. Respond with summary

Instructions: {instructions or 'None'}""",
        mcp_servers={"shared_tools": self._create_shared_tools()},
        allowed_tools=[
            "TodoWrite",
            "mcp__shared_tools__emit_work_output"
        ],
        # NO Skill, NO code_execution, NO setting_sources
    )

    work_outputs = []
    response_text = ""

    async with ClaudeSDKClient(options=options) as client:
        await client.connect()
        await client.query(f"Generate report about {topic}")

        async for message in client.receive_response():
            for block in message.content:
                if block.type == 'text':
                    response_text += block.text
                elif block.type == 'tool_result':
                    # Track outputs created
                    if 'output_id' in block.result:
                        work_outputs.append(block.result['output_id'])

    return {
        "status": "completed",
        "output_count": len(work_outputs),
        "response_text": response_text,
        "output_ids": work_outputs
    }
```

**Success Criteria:**
- ✅ TodoWrite shows progress in real-time
- ✅ Text report generated (200+ words)
- ✅ emit_work_output saves to database
- ✅ Frontend displays completed output

**If This Fails:** Integration issue between components → debug systematically

---

## Refactoring Checklist

### Immediate Actions (Today)

- [ ] **Create `/api/diagnostics/test-minimal-sdk`**
  - No tools, just text
  - Inspect exact message structure
  - Determine why text extraction fails

- [ ] **Fix Text Extraction Logic**
  - Based on minimal SDK test results
  - Update message parsing in all methods
  - Add comprehensive logging

- [ ] **Remove Skills from Default Configuration**
  ```python
  # BEFORE
  allowed_tools=["Skill", "TodoWrite", "emit_work_output", "code_execution"]

  # AFTER (hardened core first)
  allowed_tools=["TodoWrite", "mcp__shared_tools__emit_work_output"]
  # Add Skills LATER after core works
  ```

### Short-term (This Week)

- [ ] **Create TodoWrite validation test**
  - Test tool invocation
  - Test SSE delivery to frontend
  - Fix any integration issues

- [ ] **Create emit_work_output validation test**
  - Test MCP tool invocation
  - Test database insertion
  - Verify output structure

- [ ] **Create simple-text-report recipe**
  - No Skills dependency
  - Just TodoWrite + text + emit_work_output
  - End-to-end validation

- [ ] **Update `execute_recipe()` method**
  - Make Skills OPTIONAL
  - Default to text generation
  - Only invoke Skills if format=pptx/pdf/xlsx/docx

### Medium-term (Next Week)

- [ ] **Create Core SDK Test Suite**
  ```
  tests/sdk/
    test_minimal_text.py      # Phase 1
    test_todowrite.py          # Phase 2
    test_emit_output.py        # Phase 3
    test_end_to_end_text.py    # Phase 4
  ```

- [ ] **Document Working Patterns**
  - What message structure looks like
  - How to extract text correctly
  - How to parse tool results
  - Common gotchas

- [ ] **Revisit Skills (ONLY AFTER CORE WORKS)**
  - Try minimal Skills test again
  - Document Skills-specific issues
  - Determine if Skills are production-ready

---

## Architecture Principles

### 1. **Layered Validation**
```
Layer 1: SDK Connects + Receives Messages     ← Test first
Layer 2: Text Extraction Works                ← Then this
Layer 3: TodoWrite Tool Works                 ← Then this
Layer 4: emit_work_output Tool Works          ← Then this
Layer 5: End-to-End Text Workflow             ← Then this
Layer 6: Skills (PPTX/PDF) (OPTIONAL)         ← LAST
```

### 2. **Fail Fast, Fail Clearly**
- Each test should have ONE purpose
- If test fails, we know EXACTLY what's broken
- No "maybe it's X or Y" - precise diagnostics

### 3. **Progressive Enhancement**
- Start with minimal working configuration
- Add ONE capability at a time
- Validate each addition before moving forward
- Skills are an ENHANCEMENT, not a REQUIREMENT

### 4. **Production-Ready Core**
Even without Skills, we should have:
- ✅ Real-time progress tracking (TodoWrite)
- ✅ Text-based report generation
- ✅ Output saving (emit_work_output)
- ✅ User visibility into agent work

This is VALUABLE even without PPTX generation.

---

## Success Metrics

### Core SDK Health (Must Achieve)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Text generation success | 100% | ❓ | UNKNOWN |
| TodoWrite invocation | 100% | ❓ | UNKNOWN |
| emit_work_output saving | 100% | ❓ | UNKNOWN |
| End-to-end text workflow | 100% | 0% | FAILING |

### Skills Health (Nice to Have)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| PPTX generation | 80%+ | 0% | FAILING |
| PDF generation | 80%+ | ❓ | UNKNOWN |

**Philosophy:** Core must be 100% before Skills can be 0%.

---

## Next Steps (Prioritized)

### Step 1: Minimal SDK Test (30 minutes)
1. Create `/api/diagnostics/test-minimal-sdk` endpoint
2. Deploy and run test
3. Analyze message structure
4. Document findings

### Step 2: Fix Text Extraction (1-2 hours)
1. Based on Step 1 findings
2. Update message parsing logic
3. Test with simple prompts
4. Validate text extraction works

### Step 3: TodoWrite Validation (2-3 hours)
1. Create TodoWrite test endpoint
2. Test tool invocation
3. Test SSE delivery
4. Fix any integration issues

### Step 4: emit_work_output Validation (2-3 hours)
1. Create MCP tool test endpoint
2. Test database insertion
3. Verify output structure
4. Fix any issues

### Step 5: End-to-End Text Workflow (3-4 hours)
1. Create simple-text-report recipe
2. Update execute_recipe() to support text-only
3. Test full workflow
4. Validate frontend displays results

**Total Time Estimate:** 1-2 days for hardened core SDK

---

## Open Questions

1. **Why did text-based tickets succeed before?**
   - Were they using a different code path?
   - Legacy agent vs new SDK agent?
   - Need to trace execution path

2. **What is the exact message structure from SDK?**
   - Need to inspect actual objects returned
   - Document the structure for future reference

3. **Do we need Skills at all for MVP?**
   - Text-based reports might be sufficient
   - PPTX/PDF can be generated client-side from markdown
   - Skills could be a v2 feature

4. **Is the SDK designed for server use?**
   - Documentation unclear
   - May need to reach out to Anthropic
   - Alternative: Direct Anthropic API

---

## Risk Mitigation

### If Core SDK Fails
**Backup Plan:** Direct Anthropic API

```python
# Replace ClaudeSDKClient with direct API
import anthropic

client = anthropic.Anthropic(api_key=api_key)

response = client.messages.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": prompt}],
    tools=[
        {
            "name": "TodoWrite",
            "description": "...",
            "input_schema": {...}
        },
        {
            "name": "emit_work_output",
            "description": "...",
            "input_schema": {...}
        }
    ]
)

# Parse response.content blocks
for block in response.content:
    if block.type == 'text':
        print(block.text)
    elif block.type == 'tool_use':
        # Execute tool
        result = execute_tool(block.name, block.input)
```

**Pros:**
- No CLI dependency
- Known to work in production
- Full control over tool execution

**Cons:**
- No Skills support
- Need to implement tool execution ourselves
- More code to maintain

---

## Conclusion

**Current Problem:** We're trying to use Skills before validating the core SDK works.

**New Approach:** Build confidence layer by layer:
1. Text generation (fundamental)
2. TodoWrite (UX)
3. emit_work_output (deliverables)
4. End-to-end text workflow (production-ready)
5. Skills (optional enhancement)

**Philosophy Shift:**
- **Before:** "Skills don't work, fix Skills"
- **After:** "Core SDK unvalidated, harden core first"

**Expected Outcome:**
- Production-ready text-based reporting (valuable on its own)
- Clear understanding of SDK capabilities and limitations
- Informed decision about Skills (use, replace, or defer)

**Time to Value:**
- 1-2 days to hardened core
- Immediate user value from text reports
- Skills investigation can happen in parallel or later
