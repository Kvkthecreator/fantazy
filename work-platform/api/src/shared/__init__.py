"""
Shared Utilities for YARNNN Work Platform

This package contains core utilities used across the work platform:
- AgentSession: Database persistence for agent sessions
- WorkOutput tools: Structured output tools for Claude agents
- Interfaces: Abstract interfaces for memory/governance providers
"""

from .session import AgentSession, generate_agent_id
from .work_output_tools import (
    EMIT_WORK_OUTPUT_TOOL,
    parse_work_outputs_from_response,
    WorkOutput,
)
from .interfaces import (
    MemoryProvider,
    Context,
    GovernanceProvider,
    Change,
    Proposal,
    Task,
    TaskProvider,
    extract_metadata_from_contexts,
)

__all__ = [
    # Session management
    "AgentSession",
    "generate_agent_id",
    # Work output tools
    "EMIT_WORK_OUTPUT_TOOL",
    "parse_work_outputs_from_response",
    "WorkOutput",
    # Interfaces
    "MemoryProvider",
    "Context",
    "GovernanceProvider",
    "Change",
    "Proposal",
    "Task",
    "TaskProvider",
    "extract_metadata_from_contexts",
]
