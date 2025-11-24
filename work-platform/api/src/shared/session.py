"""
Session management for agents

Handles agent identity and Claude session tracking with database persistence.
"""

import uuid
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class AgentSession(BaseModel):
    """
    Represents an agent execution session with database persistence.

    An agent_session is persistent (one per basket + agent_type) and represents
    a long-lived Claude SDK session that accumulates conversation history.

    Database Schema (agent_sessions table):
        id: UUID primary key
        workspace_id: UUID reference to workspaces
        basket_id: UUID reference to baskets
        agent_type: TEXT ('research', 'content', 'reporting')
        sdk_session_id: TEXT (Claude SDK session for resume)
        conversation_history: JSONB array of messages
        state: JSONB agent-specific state
        last_active_at: TIMESTAMPTZ
        created_at: TIMESTAMPTZ
        created_by_user_id: UUID reference to auth.users
        metadata: JSONB

    Attributes:
        id: Database UUID (str representation)
        workspace_id: Workspace identifier
        basket_id: Basket identifier
        agent_type: Type of agent (research, content, reporting)
        sdk_session_id: Claude SDK session ID for conversation resume
        conversation_history: List of conversation turns
        state: Agent-specific state dict
        last_active_at: Last activity timestamp
        created_at: Creation timestamp
        created_by_user_id: User who created session
        metadata: Additional metadata
    """

    # Database fields
    id: Optional[str] = None
    workspace_id: str
    basket_id: str
    agent_type: str
    sdk_session_id: Optional[str] = None

    # Hierarchical session management
    parent_session_id: Optional[str] = None  # FK to parent session (TP is root with NULL)
    created_by_session_id: Optional[str] = None  # Audit trail: which session created this

    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)
    state: Dict[str, Any] = Field(default_factory=dict)
    last_active_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    created_by_user_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Legacy fields (for compatibility with existing code)
    agent_id: Optional[str] = None
    claude_session_id: Optional[str] = None  # Alias for sdk_session_id
    task_id: Optional[str] = None
    task_metadata: Dict[str, Any] = Field(default_factory=dict)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    status: str = "active"
    tasks_completed: int = 0
    proposals_created: List[str] = Field(default_factory=list)
    errors: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True

    def __init__(self, **data):
        """Initialize with field aliasing for backwards compatibility."""
        # Alias claude_session_id → sdk_session_id
        if 'claude_session_id' in data and data['claude_session_id'] and not data.get('sdk_session_id'):
            data['sdk_session_id'] = data['claude_session_id']
        super().__init__(**data)

    @classmethod
    async def get_or_create(
        cls,
        basket_id: str,
        workspace_id: str,
        agent_type: str,
        user_id: str,
    ) -> "AgentSession":
        """
        Get existing agent session or create new one.

        Agent sessions are unique per (basket_id, agent_type) combination.
        This ensures ONE persistent session per agent type per basket.

        Args:
            basket_id: Basket UUID
            workspace_id: Workspace UUID
            agent_type: Agent type ('research', 'content', 'reporting')
            user_id: User UUID creating the session

        Returns:
            AgentSession instance (loaded from DB or newly created)

        Raises:
            RuntimeError: If database operations fail
        """
        try:
            from app.utils.supabase import supabase_admin
            supabase = supabase_admin()

            # Try to find existing session
            result = supabase.table("agent_sessions").select("*").eq(
                "basket_id", basket_id
            ).eq("agent_type", agent_type).execute()

            if result.data and len(result.data) > 0:
                # Found existing session
                session_data = result.data[0]
                logger.info(
                    f"Found existing agent_session: id={session_data['id']}, "
                    f"type={agent_type}, basket={basket_id}"
                )

                # Update last_active_at
                supabase.table("agent_sessions").update({
                    "last_active_at": datetime.utcnow().isoformat()
                }).eq("id", session_data["id"]).execute()

                return cls(**session_data)

            # Create new session
            logger.info(
                f"Creating new agent_session: type={agent_type}, basket={basket_id}"
            )

            new_session_data = {
                "workspace_id": workspace_id,
                "basket_id": basket_id,
                "agent_type": agent_type,
                "created_by_user_id": user_id,
                "last_active_at": datetime.utcnow().isoformat(),
                "conversation_history": [],
                "state": {},
                "metadata": {}
            }

            result = supabase.table("agent_sessions").insert(
                new_session_data
            ).execute()

            if not result.data or len(result.data) == 0:
                raise RuntimeError("Failed to create agent_session in database")

            session_data = result.data[0]
            logger.info(f"Created agent_session: id={session_data['id']}")

            return cls(**session_data)

        except Exception as e:
            logger.error(f"Failed to get_or_create agent_session: {e}", exc_info=True)
            raise RuntimeError(f"AgentSession.get_or_create failed: {e}") from e

    async def save(self) -> None:
        """
        Save session state to database.

        Updates last_active_at, sdk_session_id, conversation_history, state, and metadata.
        """
        if not self.id:
            raise ValueError("Cannot save session without id (use get_or_create first)")

        try:
            from app.utils.supabase import supabase_admin
            supabase = supabase_admin()

            update_data = {
                "sdk_session_id": self.sdk_session_id,
                "conversation_history": self.conversation_history,
                "state": self.state,
                "metadata": self.metadata,
                "last_active_at": datetime.utcnow().isoformat()
            }

            supabase.table("agent_sessions").update(update_data).eq("id", self.id).execute()

            logger.debug(f"Saved agent_session: id={self.id}")

        except Exception as e:
            logger.error(f"Failed to save agent_session: {e}", exc_info=True)
            raise RuntimeError(f"AgentSession.save failed: {e}") from e

    def update_claude_session(self, sdk_session_id: str) -> None:
        """
        Update Claude SDK session ID (synchronous wrapper for compatibility).

        Args:
            sdk_session_id: New Claude SDK session ID from ClaudeSDKClient
        """
        self.sdk_session_id = sdk_session_id
        self.claude_session_id = sdk_session_id  # Keep alias in sync

        # Log but don't await (for backwards compatibility with sync code)
        logger.info(
            f"Updated claude_session_id for agent_session {self.id}: {sdk_session_id}"
        )

        # Schedule async save (fire-and-forget for now)
        # In production, consider using background tasks or celery
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self.save())
            else:
                loop.run_until_complete(self.save())
        except Exception as e:
            logger.warning(f"Could not schedule async save: {e}")

    # Legacy methods for backwards compatibility
    def add_proposal(self, proposal_id: str):
        """Add a proposal ID to this session"""
        if proposal_id not in self.proposals_created:
            self.proposals_created.append(proposal_id)

    def add_error(self, error: Exception, context: Optional[str] = None):
        """Add an error to this session"""
        self.errors.append({
            "error": str(error),
            "type": type(error).__name__,
            "context": context,
            "timestamp": datetime.utcnow().isoformat()
        })

    def complete(self):
        """Mark session as completed"""
        self.status = "completed"
        self.ended_at = datetime.utcnow()

    def fail(self, error: Optional[Exception] = None):
        """Mark session as failed"""
        self.status = "failed"
        self.ended_at = datetime.utcnow()
        if error:
            self.add_error(error)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/storage"""
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "basket_id": self.basket_id,
            "agent_type": self.agent_type,
            "sdk_session_id": self.sdk_session_id,
            # Hierarchical session fields
            "parent_session_id": self.parent_session_id,
            "created_by_session_id": self.created_by_session_id,
            # Timestamps and metadata
            "last_active_at": self.last_active_at.isoformat() if self.last_active_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "metadata": self.metadata,
            # Legacy fields
            "agent_id": self.agent_id,
            "claude_session_id": self.sdk_session_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "status": self.status,
            "tasks_completed": self.tasks_completed,
            "proposals_created": self.proposals_created,
            "error_count": len(self.errors),
        }


def generate_agent_id(agent_type: str) -> str:
    """
    Generate a unique agent ID.

    Args:
        agent_type: Type of agent (knowledge, content, code, etc.)

    Returns:
        Unique agent identifier
    """
    unique_id = uuid.uuid4().hex[:8]
    return f"agent_{agent_type}_{unique_id}"
