"""
Abstract interfaces for pluggable providers

These interfaces define the contracts that integrations must implement
to work with the Claude Agent SDK.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Callable, Awaitable
from pydantic import BaseModel
from enum import Enum


# === Data Models ===

class Context(BaseModel):
    """Generic context item from memory"""
    content: str
    metadata: Dict[str, Any] = {}
    confidence: float = 1.0


class Change(BaseModel):
    """Generic change to be proposed"""
    operation: str  # "create", "update", "delete"
    target: str  # What is being changed
    data: Dict[str, Any]
    reasoning: Optional[str] = None


class Proposal(BaseModel):
    """Generic governance proposal"""
    id: str
    changes: List[Change]
    status: str  # "pending", "approved", "rejected"
    confidence: float = 0.7
    reasoning: Optional[str] = None
    metadata: Dict[str, Any] = {}


class Task(BaseModel):
    """Generic task to be executed"""
    id: str
    description: str
    status: str  # "pending", "in_progress", "completed", "failed"
    metadata: Dict[str, Any] = {}


# === Lifecycle Hook Models ===

class InterruptDecision(str, Enum):
    """Decision on how to handle an interrupt signal"""
    PAUSE = "pause"      # Pause execution, save state
    CONTINUE = "continue"  # Acknowledge but continue
    ABORT = "abort"      # Stop execution completely


class StepContext(BaseModel):
    """
    Context passed to on_step_start hook.

    Contains information about the step being executed.
    """
    step_name: str
    inputs: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}


class StepResult(BaseModel):
    """
    Result passed to on_step_end hook.

    Contains information about the completed step.
    """
    step_name: str
    output: Any
    success: bool
    error: Optional[str] = None  # Error message as string
    error_type: Optional[str] = None  # Exception class name
    duration: float = 0.0
    metadata: Dict[str, Any] = {}


class AgentState(BaseModel):
    """
    Current agent state passed to all hooks.

    Minimal state object - applications can access agent.memory,
    agent.session, etc. directly if needed.
    """
    agent_id: str
    session_id: Optional[str] = None
    current_step: Optional[str] = None
    metadata: Dict[str, Any] = {}


# === Hook Type Signatures ===

# Step lifecycle hooks
StepStartHook = Callable[[AgentState, StepContext], Awaitable[None]]
StepEndHook = Callable[[AgentState, StepResult], Awaitable[None]]

# Execution lifecycle hooks
ExecuteStartHook = Callable[[AgentState, str], Awaitable[None]]
ExecuteEndHook = Callable[[AgentState, Any], Awaitable[None]]

# Interrupt handling
InterruptHook = Callable[[AgentState, str, Dict[str, Any]], Awaitable[InterruptDecision]]

# Error handling
ErrorHook = Callable[[AgentState, Exception, Optional[str]], Awaitable[None]]

# Checkpoint opportunity
CheckpointHook = Callable[[AgentState, str, Dict[str, Any]], Awaitable[None]]


# === Provider Interfaces ===

class MemoryProvider(ABC):
    """
    Abstract interface for memory/knowledge providers.

    Implementations provide long-term memory storage and retrieval
    for agents (e.g., YARNNN substrate, Notion database, vector store).

    Example implementations:
        - YarnnnMemory: YARNNN substrate integration
        - NotionMemory: Notion database integration
        - VectorMemory: Generic vector store (Pinecone, Weaviate)
    """

    @abstractmethod
    async def query(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 20
    ) -> List[Context]:
        """
        Query memory for relevant context.

        Args:
            query: Semantic query string
            filters: Optional filters (provider-specific)
            limit: Maximum results to return

        Returns:
            List of relevant context items
        """
        pass

    @abstractmethod
    async def get_all(
        self,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> List[Context]:
        """
        Get all memory items (with optional filtering).

        Args:
            filters: Optional filters (provider-specific)
            limit: Maximum results to return

        Returns:
            List of context items
        """
        pass

    async def summarize(self) -> Dict[str, Any]:
        """
        Get summary statistics about memory.

        Returns:
            Summary statistics (count, categories, etc.)

        Optional: Providers can override for custom summaries
        """
        all_items = await self.get_all()
        return {
            "total_items": len(all_items),
            "provider": self.__class__.__name__
        }


class GovernanceProvider(ABC):
    """
    Abstract interface for governance/approval providers.

    Implementations provide proposal-based change management
    with human approval workflows.

    Example implementations:
        - YarnnnGovernance: YARNNN proposal system
        - GitHubGovernance: GitHub PR-based approval
        - SlackGovernance: Slack-based approval workflow
    """

    @abstractmethod
    async def propose(
        self,
        changes: List[Change],
        confidence: float = 0.7,
        reasoning: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Proposal:
        """
        Create a governance proposal for changes.

        Args:
            changes: List of changes to propose
            confidence: Agent's confidence in changes (0.0-1.0)
            reasoning: Explanation of why changes are needed
            metadata: Additional metadata (agent_session_id, etc.)

        Returns:
            Created proposal with ID and status
        """
        pass

    @abstractmethod
    async def get_proposal_status(self, proposal_id: str) -> Proposal:
        """
        Get current status of a proposal.

        Args:
            proposal_id: Proposal identifier

        Returns:
            Proposal with current status
        """
        pass

    @abstractmethod
    async def wait_for_approval(
        self,
        proposal_id: str,
        timeout: int = 3600,
        poll_interval: int = 5
    ) -> bool:
        """
        Wait for proposal approval (blocking).

        Args:
            proposal_id: Proposal to monitor
            timeout: Maximum wait time in seconds
            poll_interval: Polling frequency in seconds

        Returns:
            True if approved, False if rejected

        Raises:
            TimeoutError: If approval not received within timeout
        """
        pass

    async def should_auto_approve(
        self,
        proposal: Proposal,
        auto_approve: bool = False,
        confidence_threshold: float = 0.8
    ) -> bool:
        """
        Check if proposal should be auto-approved.

        Args:
            proposal: Proposal to check
            auto_approve: Whether auto-approval is enabled
            confidence_threshold: Minimum confidence for auto-approval

        Returns:
            True if should auto-approve, False otherwise

        Optional: Providers can override for custom logic
        """
        if not auto_approve:
            return False
        return proposal.confidence >= confidence_threshold


# === Metadata Helpers ===

def extract_metadata_from_contexts(
    contexts: List[Context],
    metadata_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Extract metadata from context list using generic pattern.

    Convention: First context with special marker content contains metadata.
    Common markers: "[AGENT EXECUTION CONTEXT]", "[METADATA]"

    This is a generic helper that works with ANY metadata structure.
    Implementations can inject custom data without changing SDK interfaces.

    Args:
        contexts: List of Context objects from memory query
        metadata_key: Optional specific key to extract from metadata.
                     If None, returns entire metadata dictionary.

    Returns:
        Metadata dictionary or empty dict if not found

    Example:
        # Get all metadata
        metadata = extract_metadata_from_contexts(contexts)

        # Get specific metadata keys (implementation-specific)
        assets = extract_metadata_from_contexts(contexts, "reference_assets")
        config = extract_metadata_from_contexts(contexts, "agent_config")

    Design:
        - Backward compatible: Returns {} if no metadata found
        - Generic: Works with any metadata structure
        - Implementation-agnostic: No assumptions about metadata schema
    """
    if not contexts:
        return {}

    # Check first context for metadata marker
    first = contexts[0]
    if hasattr(first, 'metadata') and first.metadata:
        # Check if this is a metadata context (implementation convention)
        # Common markers: "[AGENT EXECUTION CONTEXT]", "[METADATA]"
        if first.content in ["[AGENT EXECUTION CONTEXT]", "[METADATA]"]:
            if metadata_key:
                return first.metadata.get(metadata_key, {})
            return first.metadata

    return {}


class TaskProvider(ABC):
    """
    Abstract interface for task/work providers.

    Implementations provide task queue and scheduling for agents.

    Example implementations:
        - FileTaskProvider: File-based task queue
        - RedisTaskProvider: Redis-based task queue
        - WebhookTaskProvider: Webhook-triggered tasks

    Note: This is optional - agents can run without a task provider
    """

    @abstractmethod
    async def get_pending_tasks(
        self,
        agent_id: str,
        limit: int = 10
    ) -> List[Task]:
        """
        Get pending tasks for an agent.

        Args:
            agent_id: Agent identifier
            limit: Maximum tasks to return

        Returns:
            List of pending tasks
        """
        pass

    @abstractmethod
    async def update_task_status(
        self,
        task_id: str,
        status: str,
        result: Optional[Any] = None,
        error: Optional[str] = None
    ) -> Task:
        """
        Update task status.

        Args:
            task_id: Task identifier
            status: New status ("in_progress", "completed", "failed")
            result: Task result (if completed)
            error: Error message (if failed)

        Returns:
            Updated task
        """
        pass

    @abstractmethod
    async def create_task(
        self,
        agent_id: str,
        description: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Task:
        """
        Create a new task.

        Args:
            agent_id: Agent that should handle task
            description: Task description
            metadata: Additional metadata

        Returns:
            Created task
        """
        pass
