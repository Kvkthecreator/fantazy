"""
YARNNN Agents - Direct Anthropic API Integration

This package contains agents that use direct Anthropic API calls
instead of the Claude Agent SDK. First-principled design with work-oriented
context assembly.

Agents:
- BaseAgent: Shared execution logic
- ResearchAgent: Intelligence gathering with web search
- ContentAgent: Content generation with tools pattern
- ReportingAgent: Document generation with Skills API
- ThinkingPartnerAgent: Interactive ideation (scaffold)

Architecture:
- No session persistence (context assembled per-call)
- Direct API calls via AnthropicDirectClient
- Tool execution via substrate-API HTTP
- Streaming support for frontend updates
"""

from .base_agent import BaseAgent, AgentContext
from .research_agent import ResearchAgent, create_research_agent
from .content_agent import ContentAgent, create_content_agent
from .reporting_agent import ReportingAgent, create_reporting_agent
from .thinking_partner_agent import ThinkingPartnerAgent, create_thinking_partner_agent

__all__ = [
    "BaseAgent",
    "AgentContext",
    "ResearchAgent",
    "create_research_agent",
    "ContentAgent",
    "create_content_agent",
    "ReportingAgent",
    "create_reporting_agent",
    "ThinkingPartnerAgent",
    "create_thinking_partner_agent",
]
