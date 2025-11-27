# SDK Removal Implementation Tracker

**Created**: 2025-11-27
**Recovery Point**: `pre-sdk-removal` tag
**Last Updated**: 2025-11-27

## Overview

This document tracks the implementation of the Agent SDK removal pivot. All changes follow the decisions documented in `PHASE_SDK_REMOVAL_PIVOT.md`.

## Status Summary

| Phase | Status | Commits |
|-------|--------|---------|
| Phase 1: Foundation | ✅ COMPLETE | 166a2e09, 2f798ecf |
| Phase 2: Agent Executors | ⏳ PARTIAL (Research done) | - |
| Phase 3: Work Output Promotion | ⏸️ PENDING | - |
| Phase 4: P4 Context Snapshot | ⏸️ PENDING | - |
| Phase 5: Cleanup | ⏸️ PENDING | - |

---

## Phase 1: Foundation ✅ COMPLETE

### 1.1 Create Direct Anthropic Client ✅
- **File**: `work-platform/api/src/clients/anthropic_client.py`
- **Status**: ✅ COMPLETE
- **Commit**: 166a2e09
- **Key Features**:
  - `AnthropicDirectClient` class with async support
  - `execute()` method for synchronous tool loops
  - `execute_streaming()` method for real-time updates
  - Built-in `emit_work_output` tool execution via substrate-API HTTP
  - Token tracking (input, output, cache_read, cache_creation)
  - No session management (first-principled design)

### 1.2 Create Base Agent Executor ✅
- **File**: `work-platform/api/src/agents/base_executor.py`
- **Status**: ✅ COMPLETE
- **Commit**: 166a2e09
- **Key Features**:
  - `BaseAgentExecutor` abstract class
  - `AgentContext` dataclass for work-oriented context
  - Context assembly from substrate + prior outputs
  - Tool context management for emit_work_output
  - Streaming support via `execute_streaming()`

### 1.3 Create Research Executor ✅
- **File**: `work-platform/api/src/agents/research_executor.py`
- **Status**: ✅ COMPLETE
- **Commit**: 166a2e09
- **Key Features**:
  - Extends `BaseAgentExecutor`
  - Deep-dive research with structured outputs
  - Web search integration (planned)
  - Prior work deduplication
  - Research-specific system prompt

### 1.4 Delete agents_sdk/ Directory ✅
- **Status**: ✅ COMPLETE
- **Commit**: 166a2e09
- **Files Deleted**:
  - `__init__.py`
  - `agent_session_manager.py`
  - `content_agent_sdk.py`
  - `orchestration_patterns.py`
  - `reporting_agent_sdk.py`
  - `research_agent_sdk.py`
  - `shared_tools_mcp.py`
  - `stream_processor.py`
  - `thinking_partner_sdk.py`
  - `tp_tools_mcp.py`
  - `work_bundle.py`

### 1.5 Update requirements.txt ✅
- **File**: `work-platform/api/requirements.txt`
- **Status**: ✅ COMPLETE
- **Commit**: 166a2e09
- **Change**: Removed `claude-agent-sdk>=0.1.8`

### 1.6 Update Dockerfile ✅
- **File**: `work-platform/api/Dockerfile`
- **Status**: ✅ COMPLETE
- **Commit**: 166a2e09
- **Changes**:
  - Removed Node.js installation
  - Removed Claude Code CLI installation
  - Simplified to Python + minimal dependencies

### 1.7 Update Route Imports ✅
- **Status**: ✅ COMPLETE
- **Commit**: 2f798ecf
- **Changes**:
  - `workflow_research.py`: Now uses `ResearchExecutor`
  - `workflow_reporting.py`: Returns migration pending status
  - `thinking_partner.py`: Returns migration notice with recommendations
  - `diagnostics.py`: New direct API test endpoints

### 1.8 Delete SDK Test Files ✅
- **Status**: ✅ COMPLETE
- **Commit**: 166a2e09
- **Files Deleted**:
  - `test_agent_sdk_hello.py`
  - `test_agent_sdk_skills.py`
  - `test_agent_sdk_subagents.py`
  - `test_pptx_skill.py`
  - `test_sdk_behavior.py`

---

## Phase 2: Agent Executors ⏳ PARTIAL

### 2.1 Research Agent Executor ✅
- **File**: `work-platform/api/src/agents/research_executor.py`
- **Status**: ✅ COMPLETE
- **Commit**: 166a2e09

### 2.2 Content Agent Executor ⏸️
- **File**: `work-platform/api/src/agents/content_executor.py`
- **Status**: ⏸️ PENDING
- **Notes**: Needs Skills integration decision

### 2.3 Reporting Agent Executor ⏸️
- **File**: `work-platform/api/src/agents/reporting_executor.py`
- **Status**: ⏸️ PENDING
- **Notes**: Similar to research, document generation focus

### 2.4 Thinking Partner Executor ⏸️
- **File**: `work-platform/api/src/agents/thinking_partner_executor.py`
- **Status**: ⏸️ PENDING
- **Notes**: Orchestration logic needs design decision

---

## Phase 3: Work Output Promotion ⏸️ PENDING

### 3.1 Promotion Service
- **File**: `work-platform/api/src/services/work_output_promotion.py`
- **Status**: ⏸️ PENDING
- **Paths**: archive, reference_asset, substrate

### 3.2 Database Schema
- **Migration**: Add `promotion_path` column to work_outputs
- **Status**: ⏸️ PENDING

---

## Phase 4: P4 Context Snapshot ⏸️ PENDING

### 4.1 Snapshot Service
- **File**: `substrate-api/api/src/services/basket_snapshot.py`
- **Status**: ⏸️ PENDING

### 4.2 Mutation Triggers
- **Status**: ⏸️ PENDING

---

## Implementation Notes

### What We Kept
1. **SubstrateClient** (`clients/substrate_client.py`) - BFF pattern for substrate access
2. **SubstrateQueryAdapter** (`adapters/substrate_adapter.py`) - On-demand substrate queries
3. **shared/session.py** - AgentSession model (but not using SDK sessions)
4. **emit_work_output** flow - Via substrate-API HTTP (now in anthropic_client.py)

### What We Removed
1. `claude-agent-sdk` package dependency
2. Node.js + Claude Code CLI from Dockerfile
3. All MCP server code (shared_tools_mcp.py, tp_tools_mcp.py)
4. ClaudeSDKClient wrapper code
5. SDK-specific stream processor
6. All SDK test files

### Architecture Changes
1. **No conversation persistence** - First-principled context (work-oriented)
2. **Direct API calls** - `anthropic.AsyncAnthropic()` replaces ClaudeSDKClient
3. **Tool implementation** - HTTP calls to substrate-API (not MCP)
4. **Streaming** - Native Anthropic streaming events

---

## Commit History

| Date | Commit | Description |
|------|--------|-------------|
| 2025-11-27 | ae2af259 | Created pivot documentation |
| 2025-11-27 | 166a2e09 | Phase 1: SDK removal + direct API client |
| 2025-11-27 | 2f798ecf | Fix: Update routes to remove SDK dependencies |

---

## Testing

### Diagnostic Endpoints
```
GET  /api/diagnostics/migration-status   # Migration status
GET  /api/diagnostics/skills             # Skills availability (post-SDK)
GET  /api/diagnostics/agent-config       # Agent configuration
POST /api/diagnostics/test-direct-api    # Test Anthropic API
POST /api/diagnostics/test-emit-work-output  # Test emit tool
POST /api/diagnostics/test-research-workflow # Test ResearchExecutor
```

### Workflow Endpoints
```
POST /api/work/research/execute   # ✅ Active (ResearchExecutor)
POST /api/work/reporting/execute  # ⏸️ Pending migration
POST /api/tp/chat                 # ⚠️ Limited (returns migration notice)
```

---

## Next Steps

1. **Test Research Workflow**: Deploy and test `/api/work/research/execute`
2. **Implement ContentExecutor**: If needed for content generation
3. **Implement ReportingExecutor**: If needed for document generation
4. **Consider Thinking Partner**: Design orchestration without SDK
5. **Work Output Promotion**: Implement archive/asset/substrate paths
