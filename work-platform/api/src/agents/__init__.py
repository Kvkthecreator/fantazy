"""
YARNNN Agent Executors - Direct Anthropic API Integration

This package contains agent executors that use direct Anthropic API calls
instead of the Claude Agent SDK. First-principled design with work-oriented
context assembly.

Executors:
- BaseAgentExecutor: Shared execution logic
- ResearchExecutor: Intelligence gathering with web search
- ContentExecutor: Content generation with Skills
- ReportingExecutor: Document generation

Architecture:
- No session persistence (context assembled per-call)
- Direct API calls via AnthropicDirectClient
- Tool execution via substrate-API HTTP
- Streaming support for frontend updates
"""

from .base_executor import BaseAgentExecutor, AgentContext
from .research_executor import ResearchExecutor, create_research_executor

__all__ = [
    "BaseAgentExecutor",
    "AgentContext",
    "ResearchExecutor",
    "create_research_executor",
]
