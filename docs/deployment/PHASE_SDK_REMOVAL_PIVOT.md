# Phase: Agent SDK Removal & Substrate-First Architecture Pivot

**Document Version:** 1.0
**Created:** 2025-11-27
**Recovery Tag:** `pre-sdk-removal`
**Status:** ACTIVE IMPLEMENTATION

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background & Decision History](#2-background--decision-history)
3. [Architecture Diagnostic Findings](#3-architecture-diagnostic-findings)
4. [Strategic Decisions](#4-strategic-decisions)
5. [Target Architecture](#5-target-architecture)
6. [Implementation Plan](#6-implementation-plan)
7. [Migration Guide](#7-migration-guide)
8. [Rollback Procedure](#8-rollback-procedure)
9. [Success Criteria](#9-success-criteria)
10. [Appendix: Raw Diagnostic Data](#10-appendix-raw-diagnostic-data)

---

## 1. Executive Summary

### What We're Doing

Removing dependency on the Claude Agent SDK in favor of direct Anthropic API integration, with substrate-api as the single source of truth for context and memory management.

### Why

1. **Agent SDK provides less than assumed** - Client-side wrapper, not server-side session management
2. **Dual storage redundancy** - SDK JSONL files + our DB tables = confusion about source of truth
3. **Token inefficiency** - Full conversation history re-sent every turn (linear growth)
4. **Substrate underutilization** - 40+ empty tables, work outputs never flow to blocks

### Key Outcomes

- **Single source of truth**: substrate-api for all context/memory
- **First-principled sessions**: Work-oriented, not conversation-based
- **Direct API calls**: Remove SDK middleman
- **Clean codebase**: Aggressive deletion of legacy approaches

### Recovery Point

```bash
# Created before any changes
git tag: pre-sdk-removal
git checkout pre-sdk-removal  # To rollback if needed
```

---

## 2. Background & Decision History

### 2.1 YARNNN Platform Evolution

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 1: substrate-api as THE Product (Pre-2025-Q4)                     │
├─────────────────────────────────────────────────────────────────────────┤
│ Vision: "Context layer for AI" - Semantic substrate for any LLM        │
│                                                                         │
│ P0: Raw dumps (user uploads, captures)                                  │
│ P1: Extraction → semantic blocks with embeddings                        │
│ P2: Relationships (block-to-block connections)                          │
│ P3: Insights (user-facing narrative summaries)                          │
│ P4: Documents (portable context artifacts for 3rd party LLMs)           │
│                                                                         │
│ GTM Attempt: Hard to gain traction as pure infrastructure layer         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Pivot to work-platform (Dog-fooding) (2025-Q4)                 │
├─────────────────────────────────────────────────────────────────────────┤
│ Decision: Build agent-based work tools on top of substrate              │
│                                                                         │
│ - Adopted Claude Agent SDK (assumed high leverage)                      │
│ - Built work_outputs as agent artifacts                                 │
│ - Intentionally separated agent outputs from substrate mutation         │
│ - substrate-api became BFF service provider                             │
│                                                                         │
│ Key Assumption: Agent SDK provides server-side session management       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Critical Junction (2025-11-27) - THIS DOCUMENT                 │
├─────────────────────────────────────────────────────────────────────────┤
│ Discovery: Agent SDK assumptions were incorrect                         │
│                                                                         │
│ Reality:                                                                 │
│ - SDK is client-side wrapper (spawns Node CLI subprocess)               │
│ - Sessions stored as local JSONL files, not Anthropic servers           │
│ - "Resume" re-sends full history to stateless API                       │
│ - Prompt caching is API feature, not SDK-specific                       │
│                                                                         │
│ Decision: Remove SDK, go direct API + substrate-first                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Why Agent SDK Was Adopted

**Original assumptions (incorrect):**
- Server-side session persistence (like OpenAI threads)
- Magic token efficiency beyond prompt caching
- Required infrastructure for agent-based systems

**Reality discovered:**
- Client-side JSONL storage (files in `~/.claude/`)
- Same prompt caching any API user gets
- Convenience wrapper we can replace

### 2.3 Why Agent Outputs Were Separated from Substrate

**Intentional design decision:**

Agent outputs (research findings, web search results, PDFs) are NOT necessarily "knowledge" worthy of substrate promotion. Examples:

- Web search results: Raw information, may be redundant
- PDF analysis: Derivative content, source exists elsewhere
- Draft content: Iterative, not canonical knowledge

Therefore, `work_outputs` was designed as a staging area, NOT direct substrate injection.

**This was correct** - the missing piece was the curation/promotion flow.

### 2.4 P2-P3-P4 Historical Context

**P2 (Relationships):**
- Original purpose: Deep semantic connections between blocks
- Testing revealed: High token cost, low ROI on downstream quality
- Decision: Defer, not core to work orchestration

**P3 (Insights/Narrative):**
- Original purpose: User-facing substrate summaries
- Current reality: Agents query substrate directly
- Decision: Defer, agents don't need pre-rolled narratives

**P4 (Documents/Artifacts):**
- Original purpose: Portable context for 3rd party LLMs
- Pivot opportunity: Repurpose as "basket context snapshot"
- Decision: Repurpose for internal agent context caching

---

## 3. Architecture Diagnostic Findings

### 3.1 Database State (2025-11-27)

**Tables with data:**
| Table | Rows | Status |
|-------|------|--------|
| substrate_tombstones | 148 | Active |
| work_requests | 37 | Active |
| work_tickets | 37 | Active |
| work_outputs | 28 | ALL pending_review |
| blocks | 19 | Very low |
| agent_sessions | 14 | sdk_session_id = NULL |

**Empty tables (sampling):**
- documents: 0 rows
- context_items: 0 rows
- block_links: 0 rows
- substrate_relationships: 0 rows
- ~35 more tables: 0 rows

### 3.2 Agent SDK Storage Analysis

**Local JSONL files found:**
```
~/.claude/projects/-Users-macbook-yarnnn-app-fullstack/
├── 2cb06bdb-*.jsonl (58 MB - very large)
├── 029c419e-*.jsonl (12 MB)
├── 80b5ca73-*.jsonl (48 MB)
└── agent-*.jsonl (1-3 KB each)
```

**Token usage from JSONL (actual data):**
```json
// Turn 1: Cache creation
{
  "input_tokens": 3,
  "cache_creation_input_tokens": 29164,
  "cache_read_input_tokens": 0
}

// Turn 3: Growing context
{
  "input_tokens": 1857,
  "cache_creation_input_tokens": 7736,
  "cache_read_input_tokens": 34809
}
```

**Observation:** `cache_read_input_tokens` grows each turn, confirming full history re-send.

### 3.3 Session Storage Gap

**agent_sessions table reality:**
```sql
agent_type       | has_sdk_session | history_count
-----------------+-----------------+--------------
research         | false           | 0
content          | false           | 0
reporting        | false           | 0
thinking_partner | false           | 0
```

- `sdk_session_id`: Always NULL (never stored)
- `conversation_history`: Always empty array
- Sessions exist only in SDK JSONL files

### 3.4 Work Output → Block Gap

```sql
-- No work outputs have been promoted to blocks
SELECT count(*) FROM work_outputs
WHERE substrate_proposal_id IS NOT NULL;
-- Result: 0

-- All work outputs are pending
SELECT supervision_status, count(*) FROM work_outputs
GROUP BY supervision_status;
-- Result: pending_review = 28
```

---

## 4. Strategic Decisions

### 4.1 Remove Agent SDK Dependency

**Decision:** YES - Remove `claude-agent-sdk` from requirements

**Rationale:**
- SDK provides client-side convenience we can implement ourselves
- Removes Node.js dependency (currently in Dockerfile)
- Eliminates dual storage (JSONL + DB)
- Gives us full control over API integration

**Implementation:**
- Replace `ClaudeSDKClient` with direct `anthropic.AsyncAnthropic`
- Move tool definitions to work-platform native code
- Remove `@anthropic-ai/claude-code` npm dependency

### 4.2 First-Principled Sessions (Not Conversation-Based)

**Decision:** Work-oriented sessions, not chat history

**Current (Agent SDK):**
```
Session = Conversation history (messages array)
Resume = Re-send all messages to stateless API
Token cost = O(n) where n = conversation length
```

**Target (First-Principled):**
```
Session = Work context (project, request, ticket, metadata)
Resume = Query relevant substrate blocks
Token cost = O(1) bounded by context window strategy
```

**Key insight:** Agents don't need to "remember" conversations. They need relevant context for the current task.

### 4.3 Substrate-API Remains BFF (Not Execution Layer)

**Decision:** substrate-api = memory/context layer ONLY

**Responsibilities:**
- ✅ Context block CRUD
- ✅ Semantic search
- ✅ Reference asset management
- ✅ Work output storage
- ✅ Proposal/governance
- ❌ Agent execution (stays in work-platform)
- ❌ Work orchestration (stays in work-platform)

**work-platform responsibilities:**
- Agent execution logic
- Work orchestration (requests, tickets)
- User-facing API
- Frontend

### 4.4 Work Output Promotion Flow

**Decision:** Three-path promotion from work_outputs

```
work_output (agent artifact)
    │
    ├─[A] Archive/Delete
    │     Not substrate-worthy, discard
    │
    ├─[B] Reference Asset
    │     Files (PDF, images) → reference_assets table
    │
    └─[C] Substrate Promotion
          Knowledge extraction → raw_dump → P0-P1 → blocks
          OR direct block creation for high-confidence findings
```

### 4.5 P2/P3 Deprecation, P4 Repurposing

**P2 (Relationships):** DEFER
- High cost, low proven ROI
- Keep schema, don't actively use

**P3 (Insights):** DEFER
- Agents query directly, don't need pre-rolled narratives
- Keep schema, don't actively use

**P4 (Documents):** REPURPOSE
- New purpose: "Basket Context Snapshot"
- One document per basket
- Updated on substrate mutation or daily cron
- Provides compacted context for agents (like cache prefix)
- Enables context continuity across agent invocations

### 4.6 Claude Skills Integration

**Decision:** Skills for Content Agent only, via direct API

**Scope:**
- Use pre-built Claude Skills (PDF, XLSX, PPTX, etc.)
- Content Agent is primary consumer
- Direct API integration, not SDK wrapper
- Configure at agent-type level

---

## 5. Target Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WORK-PLATFORM                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Frontend (Next.js)                                               │   │
│  │ - Projects, Work Requests, Work Tickets                          │   │
│  │ - Work Output Review/Curation UI                                 │   │
│  │ - Agent Execution Triggers                                       │   │
│  └─────────────────────────────────┬───────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼───────────────────────────────┐   │
│  │ API (FastAPI)                                                    │   │
│  │ ┌───────────────────┐  ┌───────────────────────────────────┐    │   │
│  │ │ Work Orchestration │  │ Agent Executors                   │    │   │
│  │ │ - /work/research   │  │ - ResearchAgentExecutor           │    │   │
│  │ │ - /work/content    │  │ - ContentAgentExecutor            │    │   │
│  │ │ - /work/reporting  │  │ - ReportingAgentExecutor          │    │   │
│  │ └───────────────────┘  └───────────────┬───────────────────┘    │   │
│  │                                         │                        │   │
│  │                        ┌────────────────┴────────────────┐       │   │
│  │                        │ Direct Anthropic Client         │       │   │
│  │                        │ anthropic.AsyncAnthropic()      │       │   │
│  │                        │ - /v1/messages API              │       │   │
│  │                        │ - Skills API (content agent)    │       │   │
│  │                        └────────────────┬────────────────┘       │   │
│  └─────────────────────────────────────────┼────────────────────────┘   │
└────────────────────────────────────────────┼────────────────────────────┘
                                             │
                              ┌──────────────┴──────────────┐
                              │    HTTP (BFF Pattern)       │
                              └──────────────┬──────────────┘
                                             │
┌────────────────────────────────────────────▼────────────────────────────┐
│                          SUBSTRATE-API (BFF)                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Context & Memory Services                                        │   │
│  │ - /api/baskets/{id}/blocks (CRUD + semantic search)             │   │
│  │ - /api/baskets/{id}/work-outputs (agent artifacts)              │   │
│  │ - /api/baskets/{id}/assets (reference files)                    │   │
│  │ - /api/baskets/{id}/context-snapshot (P4 repurposed)            │   │
│  │ - /api/proposals (governance)                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Database (Supabase PostgreSQL)                                   │   │
│  │ - blocks (semantic knowledge)                                    │   │
│  │ - work_outputs (agent artifacts)                                 │   │
│  │ - reference_assets (files)                                       │   │
│  │ - baskets, workspaces (organization)                             │   │
│  │ - pgvector (semantic search)                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Agent Execution Flow (Target)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Work Request Created                                                 │
│    "Research AI chip market for competitive analysis"                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. Work Ticket Created                                                  │
│    - agent_type: research                                               │
│    - status: pending                                                    │
│    - basket_id: linked                                                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Context Assembly (via substrate-api)                                 │
│    ┌─────────────────────────────────────────────────────────────┐     │
│    │ a. Load basket context snapshot (P4 document)               │     │
│    │ b. Semantic query for relevant blocks                       │     │
│    │ c. Load reference assets for agent type                     │     │
│    │ d. Load work ticket metadata/constraints                    │     │
│    └─────────────────────────────────────────────────────────────┘     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. Direct Anthropic API Call                                            │
│    POST /v1/messages                                                    │
│    {                                                                    │
│      "model": "claude-sonnet-4-5-20250929",                             │
│      "system": [context_snapshot + agent_instructions],                 │
│      "messages": [{"role": "user", "content": task_description}],       │
│      "tools": [emit_work_output, web_search, substrate_query]           │
│    }                                                                    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. Tool Call Processing                                                 │
│    - emit_work_output → INSERT work_outputs                             │
│    - web_search → execute, return results                               │
│    - substrate_query → semantic search, return blocks                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. Work Ticket Updated                                                  │
│    - status: completed                                                  │
│    - token_usage: {input, output, cache_read, cache_create}            │
│    - outputs: [work_output_ids]                                         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. Work Output Curation (User Action)                                   │
│    ┌─────────────────────────────────────────────────────────────┐     │
│    │ [A] Archive/Delete - Not substrate-worthy                   │     │
│    │ [B] Promote to Asset - File → reference_assets              │     │
│    │ [C] Promote to Substrate - Knowledge → blocks               │     │
│    └─────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 P4 Context Snapshot (Repurposed)

**Purpose:** Compacted basket context for agent consumption

**Structure:**
```json
{
  "basket_id": "uuid",
  "snapshot_version": 42,
  "generated_at": "2025-11-27T10:00:00Z",
  "trigger": "substrate_mutation | daily_cron",

  "summary": {
    "block_count": 19,
    "semantic_types": ["fact", "insight", "action"],
    "anchor_roles": ["problem", "solution", "constraint"],
    "last_mutation": "2025-11-26T12:00:00Z"
  },

  "narrative": "This basket contains research on AI chip markets...",

  "key_blocks": [
    {"id": "uuid", "title": "...", "semantic_type": "fact", "summary": "..."},
    // Top N blocks by relevance/recency
  ],

  "recent_changes": [
    {"timestamp": "...", "action": "block_created", "block_id": "..."},
    // Last M mutations
  ]
}
```

**Update triggers:**
1. After any substrate mutation (block create/update/delete)
2. Daily cron job (catch-up for any missed triggers)

**Agent usage:**
- Loaded as part of system prompt
- Provides "big picture" without loading all blocks
- Enables context continuity across invocations

---

## 6. Implementation Plan

### Phase 1: Foundation (Days 1-3)

#### 1.1 Create Direct Anthropic Client

**File:** `work-platform/api/src/clients/anthropic_client.py`

```python
from anthropic import AsyncAnthropic
from typing import List, Dict, Any, Optional

class AnthropicDirectClient:
    """Direct Anthropic API client replacing Agent SDK."""

    def __init__(self):
        self.client = AsyncAnthropic()

    async def execute_agent(
        self,
        agent_type: str,
        system_prompt: str,
        user_message: str,
        tools: List[Dict[str, Any]],
        model: str = "claude-sonnet-4-5-20250929",
    ) -> Dict[str, Any]:
        """Execute agent with direct API call."""
        response = await self.client.messages.create(
            model=model,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
            tools=tools,
            max_tokens=8192,
        )
        return self._process_response(response)
```

#### 1.2 Create Base Agent Executor

**File:** `work-platform/api/src/agents/base_executor.py`

```python
class BaseAgentExecutor:
    """Base class for all agent executors."""

    def __init__(
        self,
        basket_id: str,
        workspace_id: str,
        work_ticket_id: str,
    ):
        self.basket_id = basket_id
        self.workspace_id = workspace_id
        self.work_ticket_id = work_ticket_id
        self.anthropic = AnthropicDirectClient()
        self.substrate = SubstrateClient()

    async def assemble_context(self) -> str:
        """Assemble context from substrate."""
        # 1. Load context snapshot (P4)
        snapshot = await self.substrate.get_context_snapshot(self.basket_id)

        # 2. Query relevant blocks
        blocks = await self.substrate.semantic_search(
            self.basket_id,
            query=self.get_context_query(),
        )

        # 3. Load reference assets
        assets = await self.substrate.get_reference_assets(
            self.basket_id,
            agent_type=self.agent_type,
        )

        return self.format_context(snapshot, blocks, assets)

    async def execute(self, task: str) -> Dict[str, Any]:
        """Execute the agent task."""
        context = await self.assemble_context()
        system_prompt = self.build_system_prompt(context)
        tools = self.get_tools()

        result = await self.anthropic.execute_agent(
            agent_type=self.agent_type,
            system_prompt=system_prompt,
            user_message=task,
            tools=tools,
        )

        return result
```

#### 1.3 Delete Agent SDK Code

**Files to delete:**
- `work-platform/api/src/agents_sdk/` (entire directory)
- `work-platform/api/test_agent_sdk_*.py` (test files)

**Files to modify:**
- `work-platform/api/src/requirements.txt` - Remove `claude-agent-sdk`
- `work-platform/api/Dockerfile` - Remove Node.js installation

### Phase 2: Agent Executors (Days 4-6)

#### 2.1 Research Agent Executor

**File:** `work-platform/api/src/agents/research_executor.py`

- Port system prompt from `research_agent_sdk.py`
- Implement `emit_work_output` as direct function call
- Implement `web_search` tool
- Implement `substrate_query` tool

#### 2.2 Content Agent Executor

**File:** `work-platform/api/src/agents/content_executor.py`

- Port system prompt from `content_agent_sdk.py`
- Implement Claude Skills integration (direct API)
- Platform-specific subagent logic

#### 2.3 Reporting Agent Executor

**File:** `work-platform/api/src/agents/reporting_executor.py`

- Port system prompt from `reporting_agent_sdk.py`
- Implement Skills for file generation

### Phase 3: Work Output Promotion (Days 7-9)

#### 3.1 Promotion Service

**File:** `work-platform/api/src/services/work_output_promotion.py`

```python
class WorkOutputPromotionService:
    """Handle work output promotion to substrate."""

    async def promote(
        self,
        work_output_id: str,
        promotion_type: Literal["archive", "asset", "substrate"],
        user_id: str,
    ) -> PromotionResult:
        """Promote work output based on type."""

        if promotion_type == "archive":
            return await self._archive(work_output_id)
        elif promotion_type == "asset":
            return await self._promote_to_asset(work_output_id)
        elif promotion_type == "substrate":
            return await self._promote_to_substrate(work_output_id)
```

#### 3.2 Schema Additions

```sql
-- Add promotion tracking to work_outputs
ALTER TABLE work_outputs
ADD COLUMN promoted_to_block_id UUID REFERENCES blocks(id),
ADD COLUMN extracted_to_raw_dump_id UUID REFERENCES raw_dumps(id),
ADD COLUMN promotion_method TEXT CHECK (
    promotion_method IN ('archive', 'asset', 'substrate_direct', 'substrate_extraction')
),
ADD COLUMN promoted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN promoted_by UUID REFERENCES auth.users(id);
```

### Phase 4: P4 Context Snapshot (Days 10-12)

#### 4.1 Snapshot Service

**File:** `substrate-api/api/src/services/context_snapshot.py`

```python
class ContextSnapshotService:
    """Generate and manage basket context snapshots."""

    async def generate_snapshot(self, basket_id: str) -> ContextSnapshot:
        """Generate context snapshot for basket."""
        blocks = await self.get_basket_blocks(basket_id)

        snapshot = ContextSnapshot(
            basket_id=basket_id,
            snapshot_version=self.get_next_version(basket_id),
            generated_at=datetime.utcnow(),
            summary=self.generate_summary(blocks),
            narrative=await self.generate_narrative(blocks),
            key_blocks=self.extract_key_blocks(blocks),
            recent_changes=await self.get_recent_changes(basket_id),
        )

        await self.store_snapshot(snapshot)
        return snapshot
```

#### 4.2 Mutation Trigger

```sql
-- Trigger snapshot regeneration on substrate mutation
CREATE OR REPLACE FUNCTION trigger_snapshot_regeneration()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue snapshot regeneration
    INSERT INTO snapshot_regeneration_queue (basket_id, triggered_at)
    VALUES (NEW.basket_id, NOW())
    ON CONFLICT (basket_id) DO UPDATE SET triggered_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blocks_snapshot_trigger
AFTER INSERT OR UPDATE OR DELETE ON blocks
FOR EACH ROW EXECUTE FUNCTION trigger_snapshot_regeneration();
```

### Phase 5: Cleanup & Testing (Days 13-15)

#### 5.1 Remove Legacy Code

- Delete `agents_sdk/` directory
- Remove SDK imports from all files
- Update Dockerfile (remove Node.js)
- Update requirements.txt

#### 5.2 Integration Tests

- Test each agent executor end-to-end
- Test work output promotion flow
- Test context snapshot generation
- Test semantic search in context assembly

---

## 7. Migration Guide

### 7.1 Removing Agent SDK from Dockerfile

**Before:**
```dockerfile
# Install Node.js 18.x (REQUIRED for Claude Code CLI)
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code
```

**After:**
```dockerfile
# Node.js no longer required - using direct Anthropic API
# Dockerfile is now Python-only
```

### 7.2 Removing SDK from Requirements

**Before:**
```
claude-agent-sdk>=0.1.8  # Official Anthropic SDK
```

**After:**
```
anthropic>=0.40.0  # Direct API client (already present)
```

### 7.3 Migrating Agent Code

**Before (SDK pattern):**
```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async with ClaudeSDKClient(options=self._options) as client:
    await client.connect(session_id=session_id)
    await client.query(prompt)
    async for message in client.receive_response():
        # process
```

**After (Direct API):**
```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic()
response = await client.messages.create(
    model="claude-sonnet-4-5-20250929",
    system=system_prompt,
    messages=[{"role": "user", "content": prompt}],
    tools=tools,
)
# process response.content
```

---

## 8. Rollback Procedure

### 8.1 Full Rollback

If the pivot needs to be completely reverted:

```bash
# Checkout the recovery tag
git checkout pre-sdk-removal

# Create a new branch from this point if needed
git checkout -b rollback-from-pivot

# Force push if needed (coordinate with team)
git push origin main --force
```

### 8.2 Partial Rollback

If specific components need rollback:

```bash
# Restore specific files from tag
git checkout pre-sdk-removal -- work-platform/api/src/agents_sdk/
git checkout pre-sdk-removal -- work-platform/api/Dockerfile
```

### 8.3 Database Rollback

Schema changes are additive (new columns). No destructive migrations.

To rollback schema:
```sql
-- Remove new columns if needed
ALTER TABLE work_outputs
DROP COLUMN IF EXISTS promoted_to_block_id,
DROP COLUMN IF EXISTS extracted_to_raw_dump_id,
DROP COLUMN IF EXISTS promotion_method,
DROP COLUMN IF EXISTS promoted_at,
DROP COLUMN IF EXISTS promoted_by;
```

---

## 9. Success Criteria

### 9.1 Technical Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Node.js dependency | Required | Removed |
| Agent SDK dependency | Required | Removed |
| Session storage | Dual (JSONL + DB) | Single (substrate-api) |
| Work output promotion | 0% | 100% supported |
| Context snapshot | Not exists | 1 per basket |

### 9.2 Functional Criteria

- [ ] Research agent executes via direct API
- [ ] Content agent executes with Skills
- [ ] Reporting agent generates files
- [ ] Work outputs can be promoted to substrate
- [ ] Context snapshots generated on mutation
- [ ] All existing tests pass

### 9.3 Performance Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Agent execution startup | ~3s (CLI spawn) | ~500ms (direct API) |
| Context assembly | N/A | <2s |
| Token efficiency | Linear growth | Bounded by snapshot |

---

## 10. Appendix: Raw Diagnostic Data

### 10.1 Database Table Inventory (2025-11-27)

```
schemaname |          table_name           | row_count
-----------+-------------------------------+-----------
public     | substrate_tombstones          |       148
public     | work_requests                 |        37
public     | work_tickets                  |        37
public     | work_outputs                  |        28
public     | timeline_events               |        24
public     | proposal_executions           |        19
public     | blocks                        |        19
public     | app_events                    |        15
public     | agent_sessions                |        14
public     | baskets                       |         4
public     | proposals                     |         5
public     | documents                     |         0
public     | context_items                 |         0
public     | block_links                   |         0
... (40+ more tables with 0 rows)
```

### 10.2 Agent Sessions Reality

```sql
SELECT agent_type, sdk_session_id IS NOT NULL as has_sdk,
       jsonb_array_length(conversation_history) as history_count
FROM agent_sessions;

-- Result: ALL sessions have sdk_session_id = NULL, history_count = 0
```

### 10.3 Work Output Status

```sql
SELECT supervision_status, count(*) FROM work_outputs GROUP BY supervision_status;
-- Result: pending_review = 28 (ALL)
```

### 10.4 Block State Distribution

```sql
SELECT state, count(*) FROM blocks GROUP BY state;
-- Result: ACCEPTED = 19 (ALL)
```

### 10.5 Embedding Status

```sql
SELECT count(*) as total, count(embedding) as with_embedding FROM blocks;
-- Result: total = 19, with_embedding = 19 (100%)
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-27 | Claude + Kevin | Initial pivot documentation |

---

**Recovery Tag:** `pre-sdk-removal`
**Next Document:** Implementation tracking in this file or separate PHASE_SDK_REMOVAL_PROGRESS.md
