"""
Agent SDK Client: Wrapper for Claude Agent SDK with work session context.

This service bridges work sessions with agent execution:
1. Creates agents via factory with substrate adapters
2. Provisions context envelopes to agents
3. Executes agents with task-specific configurations
4. Captures outputs and artifacts
5. Handles checkpoint detection

Phase 2: Agent Execution & Checkpoints
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from agents_sdk import (
    create_research_agent_sdk,
    create_content_agent_sdk,
    create_reporting_agent_sdk,
)
from clients.substrate_client import SubstrateClient
from shared.session import AgentSession

logger = logging.getLogger(__name__)


class AgentSDKClient:
    """
    Client for executing work sessions via Claude Agent SDK.

    Responsibilities:
    - Agent instantiation with substrate adapters
    - Context envelope provision
    - Task execution orchestration
    - Output capture and artifact creation
    - Checkpoint detection
    """

    def __init__(self, substrate_client: Optional[SubstrateClient] = None):
        """
        Initialize Agent SDK client.

        Args:
            substrate_client: Optional substrate client (creates one if not provided)
        """
        self.substrate_client = substrate_client or SubstrateClient()
        logger.info("[AGENT SDK CLIENT] Initialized")

    async def create_agent(
        self,
        agent_type: str,
        basket_id: str | UUID,
        workspace_id: str,
        work_ticket_id: str,
        user_id: str,
        agent_session: Optional[AgentSession] = None,
    ):
        """
        Create agent instance for work session execution.

        Uses pre-existing agent_session from project scaffolding for conversation continuity.
        If no session provided, will create/fetch one (for backward compatibility).

        Args:
            agent_type: Type of agent (research, content, reporting)
            basket_id: Basket ID for agent context
            workspace_id: Workspace ID for authorization
            work_ticket_id: Work ticket ID for execution tracking (output tagging only)
            user_id: User ID for governance operations
            agent_session: Pre-existing AgentSession from scaffolding (recommended)

        Returns:
            Agent instance (ResearchAgent, ContentCreatorAgent, or ReportingAgent)

        Raises:
            ValueError: If agent_type is invalid
            ImportError: If SDK not available
        """
        # Get or create agent session (persistent, one per basket+agent_type)
        if not agent_session:
            logger.info(
                f"[AGENT SDK CLIENT] No session provided, creating/fetching for "
                f"{agent_type} agent, basket {basket_id}"
            )
            agent_session = await AgentSession.get_or_create(
                basket_id=str(basket_id),
                workspace_id=workspace_id,
                agent_type=agent_type,
                user_id=user_id,
            )
        else:
            logger.info(
                f"[AGENT SDK CLIENT] Using provided session {agent_session.id} for "
                f"{agent_type} agent (basket={basket_id}, work_ticket={work_ticket_id})"
            )

        # Create agent SDK instance with persistent session + work_ticket_id for output tracking
        if agent_type == "research":
            return create_research_agent_sdk(
                basket_id=str(basket_id),
                workspace_id=workspace_id,
                work_ticket_id=work_ticket_id,
                session=agent_session,  # Pass session for conversation continuity
            )
        elif agent_type == "content":
            return create_content_agent_sdk(
                basket_id=str(basket_id),
                workspace_id=workspace_id,
                work_ticket_id=work_ticket_id,
                session=agent_session,  # Pass session for conversation continuity
            )
        elif agent_type == "reporting":
            return create_reporting_agent_sdk(
                basket_id=str(basket_id),
                workspace_id=workspace_id,
                work_ticket_id=work_ticket_id,
                session=agent_session,  # Pass session for conversation continuity
            )
        else:
            raise ValueError(
                f"Unknown agent type: {agent_type}. "
                f"Supported: research, content, reporting"
            )

    async def provision_context_envelope(
        self,
        agent,
        task_document_id: UUID,
        basket_id: UUID
    ) -> Dict[str, Any]:
        """
        Fetch and provision context envelope to agent.

        Args:
            agent: Agent instance
            task_document_id: UUID of P4 context envelope document
            basket_id: Basket ID

        Returns:
            Context envelope dictionary

        Note:
            The agent SDK agents have memory adapters that can query substrate.
            This method fetches the pre-generated context envelope and provides
            it as initial context to the agent.
        """
        logger.info(
            f"[AGENT SDK CLIENT] Provisioning context envelope {task_document_id}"
        )

        try:
            # Fetch context envelope P4 document from substrate
            envelope_doc = await self.substrate_client.get_document(
                basket_id=str(basket_id),
                document_id=str(task_document_id)
            )

            if not envelope_doc:
                logger.warning(
                    f"[AGENT SDK CLIENT] Context envelope {task_document_id} not found. "
                    f"Agent will query substrate directly."
                )
                return {}

            # Extract context from P4 document composition
            context_data = envelope_doc.get("composition", {})

            logger.info(
                f"[AGENT SDK CLIENT] ✅ Context envelope provisioned: "
                f"{len(context_data.get('narrative_sections', []))} sections, "
                f"{len(context_data.get('substrate_references', []))} references"
            )

            return context_data

        except Exception as e:
            logger.error(
                f"[AGENT SDK CLIENT] Failed to fetch context envelope: {e}. "
                f"Agent will query substrate directly."
            )
            return {}
