"""
Agent Session Manager - Singleton for persistent agent session lifecycle.

Provides centralized management of persistent agent sessions across the YARNNN platform.
Ensures one session per basket+agent_type with proper database integration.
"""

import logging
from typing import Any, Dict, Optional, Union

from shared.session import AgentSession
from agents_sdk.work_bundle import WorkBundle

logger = logging.getLogger(__name__)


class AgentSessionManager:
    """
    Singleton manager for persistent agent sessions.

    Responsibilities:
    - Get or create persistent agent sessions via AgentSession.get_or_create()
    - Cache active agent instances in memory
    - Provide session lifecycle management (create, resume, cleanup)
    - Integrate with Claude SDK session persistence

    Usage:
        manager = AgentSessionManager()
        agent_session = await manager.get_or_create_session(
            basket_id="...",
            workspace_id="...",
            agent_type="content",
            user_id="..."
        )
    """

    _instance: Optional["AgentSessionManager"] = None
    _sessions: Dict[str, AgentSession] = {}  # Cache: "{basket_id}:{agent_type}" -> AgentSession

    def __new__(cls):
        """Singleton pattern - only one instance exists."""
        if cls._instance is None:
            cls._instance = super(AgentSessionManager, cls).__new__(cls)
        return cls._instance

    async def get_or_create_session(
        self,
        basket_id: str,
        workspace_id: str,
        agent_type: str,
        user_id: str,
        parent_session_id: Optional[str] = None,
    ) -> AgentSession:
        """
        Get existing persistent session or create new one.

        Args:
            basket_id: Basket UUID
            workspace_id: Workspace UUID
            agent_type: "research" | "content" | "reporting" | "thinking_partner"
            user_id: User UUID
            parent_session_id: For hierarchical sessions (specialist → TP parent)

        Returns:
            AgentSession with conversation history and SDK session ID
        """
        cache_key = f"{basket_id}:{agent_type}"

        # Check memory cache first
        if cache_key in self._sessions:
            logger.info(f"Using cached session for {cache_key}")
            return self._sessions[cache_key]

        # Get or create from database
        logger.info(f"Fetching session from database for {cache_key}")
        session = await AgentSession.get_or_create(
            basket_id=basket_id,
            workspace_id=workspace_id,
            agent_type=agent_type,
            user_id=user_id,
            parent_session_id=parent_session_id,
        )

        # Cache in memory
        self._sessions[cache_key] = session
        logger.info(f"Session cached: {session.id} (SDK session: {session.sdk_session_id})")

        return session

    async def update_session(
        self,
        session: AgentSession,
        new_message: Dict[str, Any],
    ) -> None:
        """
        Update session with new conversation message.

        Args:
            session: AgentSession to update
            new_message: Message dict to append to conversation_history
        """
        session.conversation_history.append(new_message)
        await session.save()
        logger.debug(f"Session {session.id} updated with new message")

    async def save_session_state(
        self,
        session: AgentSession,
        state_updates: Dict[str, Any],
    ) -> None:
        """
        Save arbitrary state to session.

        Args:
            session: AgentSession to update
            state_updates: State dict to merge into session.state
        """
        session.state.update(state_updates)
        await session.save()
        logger.debug(f"Session {session.id} state updated")

    def clear_cache(self, basket_id: Optional[str] = None, agent_type: Optional[str] = None) -> None:
        """
        Clear session cache.

        Args:
            basket_id: If provided, clear only this basket's sessions
            agent_type: If provided, clear only this agent type's sessions
        """
        if basket_id and agent_type:
            cache_key = f"{basket_id}:{agent_type}"
            if cache_key in self._sessions:
                del self._sessions[cache_key]
                logger.info(f"Cleared cache for {cache_key}")
        elif basket_id:
            keys_to_delete = [k for k in self._sessions.keys() if k.startswith(f"{basket_id}:")]
            for key in keys_to_delete:
                del self._sessions[key]
            logger.info(f"Cleared {len(keys_to_delete)} sessions for basket {basket_id}")
        elif agent_type:
            keys_to_delete = [k for k in self._sessions.keys() if k.endswith(f":{agent_type}")]
            for key in keys_to_delete:
                del self._sessions[key]
            logger.info(f"Cleared {len(keys_to_delete)} sessions for agent type {agent_type}")
        else:
            count = len(self._sessions)
            self._sessions.clear()
            logger.info(f"Cleared all {count} cached sessions")

    async def initialize_agent_from_session(
        self,
        session: AgentSession,
        bundle: WorkBundle,
    ) -> Any:
        """
        Initialize agent SDK instance from persistent session.

        This will be implemented after agent refactors (Steps 4-6).
        Returns appropriate agent type (ContentAgentSDK, ResearchAgentSDK, ReportingAgentSDK).

        Args:
            session: Persistent AgentSession
            bundle: WorkBundle with task context

        Returns:
            Agent SDK instance with session resumed
        """
        # Import here to avoid circular imports
        from agents_sdk.content_agent_sdk import ContentAgentSDK
        from agents_sdk.research_agent_sdk import ResearchAgentSDK
        from agents_sdk.reporting_agent_sdk import ReportingAgentSDK

        agent_class_map = {
            "content": ContentAgentSDK,
            "research": ResearchAgentSDK,
            "reporting": ReportingAgentSDK,
        }

        agent_class = agent_class_map.get(session.agent_type)
        if not agent_class:
            raise ValueError(f"Unknown agent type: {session.agent_type}")

        logger.info(f"Initializing {session.agent_type} agent with session {session.id}")

        # Agent class will handle session resume via session.sdk_session_id
        # This pattern will be implemented in Steps 4-6
        agent = agent_class(bundle=bundle, session=session)

        return agent

    def get_session_summary(self) -> Dict[str, Any]:
        """Get summary of cached sessions for debugging."""
        return {
            "total_cached": len(self._sessions),
            "sessions": [
                {
                    "cache_key": key,
                    "session_id": session.id,
                    "agent_type": session.agent_type,
                    "basket_id": session.basket_id,
                    "sdk_session_id": session.sdk_session_id,
                    "conversation_length": len(session.conversation_history),
                }
                for key, session in self._sessions.items()
            ]
        }
