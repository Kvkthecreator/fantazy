"""
YARNNN Agents - Multi-Provider LLM Integration

This package contains agents using various LLM providers:
- Anthropic (Claude) for research, reporting, thinking partner
- Google (Gemini) for content generation with image support

Agents:
- BaseAgent: Shared execution logic (Anthropic)
- ResearchAgent: Intelligence gathering with web search (Anthropic)
- ContentAgent: Content generation (Anthropic, legacy)
- GeminiContentAgent: Content + image generation (Gemini)
- ReportingAgent: Document generation (Anthropic)
- ThinkingPartnerAgent: Interactive ideation (Anthropic)

Architecture:
- No session persistence (context assembled per-call)
- Multi-provider support via factory pattern
- Tool execution via substrate-API HTTP
- Streaming support for frontend updates
"""

import os
from typing import Union

from .base_agent import BaseAgent, AgentContext
from .research_agent import ResearchAgent, create_research_agent
from .content_agent import ContentAgent, create_content_agent
from .reporting_agent import ReportingAgent, create_reporting_agent
from .thinking_partner_agent import ThinkingPartnerAgent, create_thinking_partner_agent
from .gemini_content_agent import GeminiContentAgent, create_gemini_content_agent


def get_content_agent(
    basket_id: str,
    workspace_id: str,
    work_ticket_id: str,
    user_id: str,
    user_jwt: str = None,
    provider: str = None,
    **kwargs,
) -> Union[ContentAgent, GeminiContentAgent]:
    """
    Factory for content agents - select provider based on config.

    Args:
        basket_id: Basket ID
        workspace_id: Workspace ID
        work_ticket_id: Work ticket ID
        user_id: User ID
        user_jwt: Optional JWT for auth
        provider: "anthropic" or "gemini" (default from env: CONTENT_AGENT_PROVIDER)
        **kwargs: Additional agent arguments

    Returns:
        ContentAgent (Anthropic) or GeminiContentAgent (Gemini)

    Note:
        Default provider is "gemini" for unified text+image generation.
        Set CONTENT_AGENT_PROVIDER=anthropic to use Claude instead.
    """
    provider = provider or os.getenv("CONTENT_AGENT_PROVIDER", "gemini")

    if provider == "gemini":
        return create_gemini_content_agent(
            basket_id=basket_id,
            workspace_id=workspace_id,
            work_ticket_id=work_ticket_id,
            user_id=user_id,
            user_jwt=user_jwt,
            **kwargs,
        )
    else:
        return create_content_agent(
            basket_id=basket_id,
            workspace_id=workspace_id,
            work_ticket_id=work_ticket_id,
            user_id=user_id,
            user_jwt=user_jwt,
            **kwargs,
        )


__all__ = [
    "BaseAgent",
    "AgentContext",
    "ResearchAgent",
    "create_research_agent",
    "ContentAgent",
    "create_content_agent",
    "GeminiContentAgent",
    "create_gemini_content_agent",
    "get_content_agent",  # Factory function
    "ReportingAgent",
    "create_reporting_agent",
    "ThinkingPartnerAgent",
    "create_thinking_partner_agent",
]
