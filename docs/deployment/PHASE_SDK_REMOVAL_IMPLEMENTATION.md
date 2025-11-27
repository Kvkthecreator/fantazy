# SDK Removal Implementation Tracker

**Created**: 2025-11-27
**Recovery Point**: `pre-sdk-removal` tag

## Overview

This document tracks the implementation of the Agent SDK removal pivot. All changes follow the decisions documented in `PHASE_SDK_REMOVAL_PIVOT.md`.

## Phase 1: Foundation (Direct Anthropic Client + Base Executor)

### 1.1 Create Direct Anthropic Client
- **File**: `work-platform/api/src/clients/anthropic_client.py`
- **Status**: IN PROGRESS
- **Purpose**: Replace ClaudeSDKClient with direct `anthropic.AsyncAnthropic()` calls
- **Key Features**:
  - Streaming message support
  - Tool integration (WebSearch, emit_work_output)
  - Token tracking for cost analysis
  - No session management (first-principled design)

### 1.2 Create Base Agent Executor
- **File**: `work-platform/api/src/agents/base_executor.py`
- **Status**: PENDING
- **Purpose**: Shared agent execution logic
- **Key Features**:
  - Context assembly from substrate + WorkBundle
  - Tool execution (emit_work_output via substrate-API)
  - Streaming support for frontend
  - Error handling and recovery

### 1.3 Delete agents_sdk/ Directory
- **Files to Delete**:
  ```
  work-platform/api/src/agents_sdk/
  ├── __init__.py
  ├── agent_session_manager.py
  ├── content_agent_sdk.py
  ├── orchestration_patterns.py
  ├── reporting_agent_sdk.py
  ├── research_agent_sdk.py
  ├── shared_tools_mcp.py
  ├── stream_processor.py
  ├── thinking_partner_sdk.py
  ├── tp_tools_mcp.py
  └── work_bundle.py
  ```
- **Status**: PENDING (after executors working)

### 1.4 Update requirements.txt
- **File**: `work-platform/api/requirements.txt`
- **Change**: Remove `claude-agent-sdk>=0.1.8`
- **Status**: PENDING

### 1.5 Update Dockerfile
- **File**: `work-platform/api/Dockerfile`
- **Change**: Remove Node.js installation (Claude Code CLI no longer needed)
- **Status**: PENDING

---

## Phase 2: Agent Executors

### 2.1 Research Agent Executor
- **File**: `work-platform/api/src/agents/research_executor.py`
- **Status**: PENDING
- **Features**: WebSearch, emit_work_output, substrate query

### 2.2 Content Agent Executor
- **File**: `work-platform/api/src/agents/content_executor.py`
- **Status**: PENDING
- **Features**: Skills integration via direct API, emit_work_output

### 2.3 Reporting Agent Executor
- **File**: `work-platform/api/src/agents/reporting_executor.py`
- **Status**: PENDING
- **Features**: Document generation, emit_work_output

---

## Phase 3: Work Output Promotion

### 3.1 Promotion Service
- **File**: `work-platform/api/src/services/work_output_promotion.py`
- **Status**: PENDING
- **Paths**: archive, reference_asset, substrate

### 3.2 Database Schema
- **Migration**: Add `promotion_path` column to work_outputs
- **Status**: PENDING

---

## Phase 4: P4 Context Snapshot (Basket Context Snapshot)

### 4.1 Snapshot Service
- **File**: `substrate-api/api/src/services/basket_snapshot.py`
- **Status**: PENDING
- **Purpose**: Cache flattened context for agent consumption

### 4.2 Mutation Triggers
- **Status**: PENDING
- **Purpose**: Invalidate/update snapshot on substrate mutations

---

## Phase 5: Cleanup & Verification

### 5.1 Delete Test Files
- **Files**:
  ```
  work-platform/api/test_agent_sdk_*.py
  work-platform/api/test_pptx_skill.py
  work-platform/api/test_sdk_behavior.py
  work-platform/api/tests/phase4/test_agent_integration.py
  work-platform/api/tests/verify_sdk_metadata.py
  ```
- **Status**: PENDING

### 5.2 Update Route Imports
- Update `workflow_research.py` to use new executor
- Update `workflow_reporting.py` to use new executor
- Update `thinking_partner.py` to use new executor
- **Status**: PENDING

### 5.3 Commit and Deploy
- **Status**: PENDING

---

## Implementation Notes

### What We're Keeping
1. **SubstrateClient** (`clients/substrate_client.py`) - BFF pattern for substrate access
2. **SubstrateQueryAdapter** (`adapters/substrate_adapter.py`) - On-demand substrate queries
3. **WorkBundle** pattern - Metadata + asset pointers (NOT blocks)
4. **AgentSession** model - For session tracking (not SDK session)
5. **emit_work_output** flow - Via substrate-API HTTP

### What We're Removing
1. `claude-agent-sdk` package dependency
2. Node.js + Claude Code CLI from Dockerfile
3. All MCP server code (shared_tools_mcp.py, tp_tools_mcp.py)
4. ClaudeSDKClient wrapper code
5. SDK-specific stream processor

### Key Architectural Decisions
1. **No conversation persistence** - First-principled context (work-oriented)
2. **Direct API calls** - `anthropic.AsyncAnthropic()` replaces ClaudeSDKClient
3. **Tool implementation** - HTTP calls to substrate-API (not MCP)
4. **Streaming** - Native Anthropic streaming events

---

## Commit History

| Date | Commit | Description |
|------|--------|-------------|
| 2025-11-27 | ae2af259 | Created pivot documentation |
| 2025-11-27 | TBD | Phase 1.1 - Direct Anthropic Client |
