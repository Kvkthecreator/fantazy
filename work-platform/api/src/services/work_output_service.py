"""
Work Output Service - Orchestrates writing agent outputs to substrate-API.

This service handles the complete flow:
1. Agent executes and returns structured outputs
2. Service writes each output to substrate-API via BFF
3. Session status is updated based on output count

Key Pattern:
- Agent produces outputs (via emit_work_output tool)
- Service writes them to substrate-API (via substrate_client)
- User reviews in supervision UI (via substrate-API routes)
- Status transitions are independent from substrate governance
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from clients.substrate_client import get_substrate_client, SubstrateAPIError

logger = logging.getLogger(__name__)


def write_agent_outputs(
    basket_id: str,
    work_ticket_id: str,
    agent_type: str,
    outputs: List[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]] = None,
    target_context_role: Optional[str] = None,
    auto_promote: bool = False,
) -> Dict[str, Any]:
    """
    Write agent outputs to substrate-API for user supervision.

    This function is called after agent execution completes.
    Each output becomes a row in the work_outputs table with status 'pending_review'.

    Args:
        basket_id: Basket UUID
        work_ticket_id: Work session UUID (from work-platform DB)
        agent_type: Type of agent (research, content, reporting)
        outputs: List of output dictionaries from agent execution
                 Each should have: output_type, title, body, confidence, source_context_ids, tool_call_id
        metadata: Additional metadata to attach to each output
        target_context_role: Context role this output targets for promotion
        auto_promote: Whether to auto-promote after approval

    Returns:
        {
            "success": bool,
            "outputs_written": int,
            "output_ids": List[str],
            "errors": List[str]
        }

    Example:
        # After agent.deep_dive() returns
        result = agent.deep_dive("competitor analysis")
        outputs = result.get("work_outputs", [])

        write_result = write_agent_outputs(
            basket_id=basket_id,
            work_ticket_id=ticket_id,
            agent_type="research",
            outputs=outputs,
            target_context_role="trend_digest",
            auto_promote=True
        )
    """
    client = get_substrate_client()
    output_ids = []
    errors = []

    logger.info(
        f"Writing {len(outputs)} agent outputs for session {work_ticket_id} "
        f"to basket {basket_id}"
        f"{f' (target_role={target_context_role}, auto_promote={auto_promote})' if target_context_role else ''}"
    )

    for i, output in enumerate(outputs):
        try:
            # Extract fields from output dict
            created_output = client.create_work_output(
                basket_id=basket_id,
                work_ticket_id=work_ticket_id,
                output_type=output.get("output_type", "insight"),
                agent_type=agent_type,
                title=output.get("title", f"Output #{i+1}"),
                body=output.get("body", {"summary": "No content"}),
                confidence=output.get("confidence", 0.5),
                source_context_ids=output.get("source_context_ids", []),
                tool_call_id=output.get("tool_call_id"),
                metadata=metadata or {},
                target_context_role=target_context_role,
                auto_promote=auto_promote,
            )

            output_id = created_output.get("id")
            output_ids.append(output_id)
            logger.debug(f"Created work output {output_id}: {output.get('title', 'untitled')}")

        except SubstrateAPIError as e:
            error_msg = f"Failed to write output #{i+1}: {e.message}"
            logger.error(error_msg)
            errors.append(error_msg)

        except Exception as e:
            error_msg = f"Unexpected error writing output #{i+1}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)

    success = len(errors) == 0
    if not success:
        logger.warning(
            f"Wrote {len(output_ids)}/{len(outputs)} outputs with {len(errors)} errors"
        )
    else:
        logger.info(f"Successfully wrote {len(output_ids)} outputs to substrate-API")

    return {
        "success": success,
        "outputs_written": len(output_ids),
        "output_ids": output_ids,
        "errors": errors,
    }


def get_pending_outputs_for_session(
    basket_id: str,
    work_ticket_id: str,
) -> List[Dict[str, Any]]:
    """
    Get all pending review outputs for a work session.

    Args:
        basket_id: Basket UUID
        work_ticket_id: Work session UUID

    Returns:
        List of work output records with status 'pending_review'
    """
    client = get_substrate_client()

    try:
        result = client.list_work_outputs(
            basket_id=basket_id,
            work_ticket_id=work_ticket_id,
            supervision_status="pending_review",
        )
        return result.get("outputs", [])

    except SubstrateAPIError as e:
        logger.error(f"Failed to get pending outputs: {e.message}")
        return []


def get_supervision_summary(basket_id: str) -> Dict[str, Any]:
    """
    Get supervision dashboard summary for a basket.

    Args:
        basket_id: Basket UUID

    Returns:
        Supervision statistics including pending count
    """
    client = get_substrate_client()

    try:
        stats = client.get_supervision_stats(basket_id)
        return {
            "total": stats.get("total_outputs", 0),
            "pending": stats.get("pending_review", 0),
            "approved": stats.get("approved", 0),
            "rejected": stats.get("rejected", 0),
            "needs_revision": stats.get("revision_requested", 0),
            "requires_attention": stats.get("pending_review", 0) > 0,
        }

    except SubstrateAPIError as e:
        logger.error(f"Failed to get supervision summary: {e.message}")
        return {
            "total": 0,
            "pending": 0,
            "approved": 0,
            "rejected": 0,
            "needs_revision": 0,
            "requires_attention": False,
            "error": str(e.message),
        }


def approve_output(
    basket_id: str,
    output_id: str,
    reviewer_id: str,
    notes: Optional[str] = None,
) -> bool:
    """
    Approve a work output (convenience wrapper).

    Args:
        basket_id: Basket UUID
        output_id: Output UUID
        reviewer_id: User ID of reviewer
        notes: Optional approval notes

    Returns:
        True if successful, False otherwise
    """
    client = get_substrate_client()

    try:
        client.update_work_output_status(
            basket_id=basket_id,
            output_id=output_id,
            supervision_status="approved",
            reviewer_notes=notes,
            reviewer_id=reviewer_id,
        )
        logger.info(f"Approved work output {output_id}")
        return True

    except SubstrateAPIError as e:
        logger.error(f"Failed to approve output {output_id}: {e.message}")
        return False


def reject_output(
    basket_id: str,
    output_id: str,
    reviewer_id: str,
    notes: str,
) -> bool:
    """
    Reject a work output (convenience wrapper).

    Args:
        basket_id: Basket UUID
        output_id: Output UUID
        reviewer_id: User ID of reviewer
        notes: Rejection notes (required)

    Returns:
        True if successful, False otherwise
    """
    if not notes or len(notes.strip()) == 0:
        logger.error("Rejection notes are required")
        return False

    client = get_substrate_client()

    try:
        client.update_work_output_status(
            basket_id=basket_id,
            output_id=output_id,
            supervision_status="rejected",
            reviewer_notes=notes,
            reviewer_id=reviewer_id,
        )
        logger.info(f"Rejected work output {output_id}")
        return True

    except SubstrateAPIError as e:
        logger.error(f"Failed to reject output {output_id}: {e.message}")
        return False


def request_revision(
    basket_id: str,
    output_id: str,
    reviewer_id: str,
    feedback: str,
) -> bool:
    """
    Request revision for a work output (convenience wrapper).

    Args:
        basket_id: Basket UUID
        output_id: Output UUID
        reviewer_id: User ID of reviewer
        feedback: Revision feedback (required)

    Returns:
        True if successful, False otherwise
    """
    if not feedback or len(feedback.strip()) == 0:
        logger.error("Revision feedback is required")
        return False

    client = get_substrate_client()

    try:
        client.update_work_output_status(
            basket_id=basket_id,
            output_id=output_id,
            supervision_status="revision_requested",
            reviewer_notes=feedback,
            reviewer_id=reviewer_id,
        )
        logger.info(f"Requested revision for work output {output_id}")
        return True

    except SubstrateAPIError as e:
        logger.error(f"Failed to request revision for output {output_id}: {e.message}")
        return False
