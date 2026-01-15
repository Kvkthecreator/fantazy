"""Conversation API routes - the main chat endpoint."""
import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.deps import get_db
from app.dependencies import get_current_user_id, get_optional_user_id
from app.models.message import MessageCreate, Message
from app.models.session import Session
from app.services.conversation import ConversationService
from app.services.rate_limiter import RateLimitExceededError

router = APIRouter(prefix="/conversation", tags=["Conversation"])


@router.post("/{character_id}/send", response_model=Message)
async def send_message(
    character_id: UUID,
    data: MessageCreate,
    request: Request,
    user_id: Optional[UUID] = Depends(get_optional_user_id),
    db=Depends(get_db),
):
    """Send a message to a character and get a response.

    Supports both authenticated users and guest sessions (Episode 0 only).

    This is the main conversation endpoint that:
    1. Gets or creates an active episode
    2. Loads conversation context (messages, memories, hooks)
    3. Sends to LLM and gets response
    4. Saves both messages
    5. Extracts memories and hooks from the exchange

    For guest sessions:
    - Requires X-Guest-Session-Id header
    - Limited to 5 messages per session
    - Only works with Episode 0
    """
    # Extract guest_session_id from headers (if present)
    guest_session_id = request.headers.get("X-Guest-Session-Id")

    # Require either user_id OR guest_session_id
    if not user_id and not guest_session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication or guest session ID required"
        )

    # Guest session handling
    if guest_session_id and not user_id:
        # Verify guest session exists and enforce message limit
        session_query = """
            SELECT id, message_count, episode_template_id, user_id
            FROM sessions
            WHERE guest_session_id = :guest_id
            AND character_id = :character_id
        """
        session = await db.fetch_one(session_query, {
            "guest_id": guest_session_id,
            "character_id": str(character_id),
        })

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Guest session not found"
            )

        # Check if session was converted (has user_id now)
        if session["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This guest session has been converted. Please log in to continue."
            )

        # Enforce 5-message limit for guests (user gets 5 responses total)
        # Count user messages only (since opening message is system/assistant)
        user_message_count_query = """
            SELECT COUNT(*) as count
            FROM messages
            WHERE episode_id = :session_id
            AND role = 'user'
        """
        message_count_row = await db.fetch_one(user_message_count_query, {
            "session_id": str(session["id"])
        })
        user_message_count = message_count_row["count"] if message_count_row else 0

        if user_message_count >= 5:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "guest_message_limit",
                    "message": "You've reached the guest message limit. Sign up to continue!",
                    "messages_sent": user_message_count,
                    "limit": 5,
                }
            )

    service = ConversationService(db)

    try:
        response = await service.send_message(
            user_id=user_id,  # Can be None for guests
            character_id=character_id,
            content=data.content,
            episode_template_id=data.episode_template_id,
            guest_session_id=guest_session_id,  # Pass to service
        )
        return response
    except RateLimitExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "rate_limit_exceeded",
                "message": e.message,
                "reset_at": e.reset_at.isoformat() if e.reset_at else None,
                "cooldown_seconds": e.cooldown_seconds,
                "remaining": e.remaining,
                "upgrade_url": "/settings?tab=subscription",
            },
            headers={
                "Retry-After": str(e.cooldown_seconds) if e.cooldown_seconds else "60"
            },
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{character_id}/send/stream")
async def send_message_stream(
    character_id: UUID,
    data: MessageCreate,
    request: Request,
    user_id: Optional[UUID] = Depends(get_optional_user_id),
    db=Depends(get_db),
):
    """Send a message and stream the response.

    Supports both authenticated users and guest sessions (Episode 0 only).
    Returns a Server-Sent Events stream with the character's response.

    For guest sessions:
    - Requires X-Guest-Session-Id header
    - Limited to 5 messages per session
    - Only works with Episode 0
    """
    # Extract guest_session_id from headers (if present)
    guest_session_id = request.headers.get("X-Guest-Session-Id")

    # Require either user_id OR guest_session_id
    if not user_id and not guest_session_id:
        return StreamingResponse(
            iter(["data: [ERROR] Authentication or guest session ID required\n\n"]),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    # Guest session handling - verify session and enforce message limit
    if guest_session_id and not user_id:
        session_query = """
            SELECT id, message_count, episode_template_id, user_id
            FROM sessions
            WHERE guest_session_id = :guest_id
            AND character_id = :character_id
        """
        session = await db.fetch_one(session_query, {
            "guest_id": guest_session_id,
            "character_id": str(character_id),
        })

        if not session:
            return StreamingResponse(
                iter(["data: [ERROR] Guest session not found\n\n"]),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
            )

        # Check if session was converted (has user_id now)
        if session["user_id"]:
            error_data = json.dumps({
                "type": "error",
                "error": "session_converted",
                "message": "This guest session has been converted. Please log in to continue.",
            })
            return StreamingResponse(
                iter([f"data: {error_data}\n\n"]),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
            )

        # Enforce 5-message limit for guests
        user_message_count_query = """
            SELECT COUNT(*) as count
            FROM messages
            WHERE episode_id = :session_id
            AND role = 'user'
        """
        message_count_row = await db.fetch_one(user_message_count_query, {
            "session_id": str(session["id"])
        })
        user_message_count = message_count_row["count"] if message_count_row else 0

        if user_message_count >= 5:
            error_data = json.dumps({
                "type": "error",
                "error": "guest_message_limit",
                "message": "You've reached the guest message limit. Sign up to continue!",
                "messages_sent": user_message_count,
                "limit": 5,
            })
            return StreamingResponse(
                iter([f"data: {error_data}\n\n"]),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
            )

    service = ConversationService(db)

    async def generate():
        try:
            async for chunk in service.send_message_stream(
                user_id=user_id,
                character_id=character_id,
                content=data.content,
                episode_template_id=data.episode_template_id,
                guest_session_id=guest_session_id,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except RateLimitExceededError as e:
            # Send rate limit error as structured SSE event
            error_data = json.dumps({
                "type": "error",
                "error": "rate_limit_exceeded",
                "message": e.message,
                "reset_at": e.reset_at.isoformat() if e.reset_at else None,
                "cooldown_seconds": e.cooldown_seconds,
                "remaining": e.remaining,
            })
            yield f"data: {error_data}\n\n"
        except Exception as e:
            import logging
            import traceback
            log = logging.getLogger(__name__)
            log.error(f"Streaming error: {type(e).__name__}: {str(e)}")
            log.error(traceback.format_exc())
            error_msg = f"{type(e).__name__}: {str(e)}" if str(e) else type(e).__name__
            yield f"data: [ERROR] {error_msg}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/{character_id}/context")
async def get_conversation_context(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get the conversation context for debugging/preview.

    Returns the assembled context that would be sent to the LLM.
    """
    service = ConversationService(db)

    context = await service.get_context(
        user_id=user_id,
        character_id=character_id,
    )

    # NOTE: relationship_stage/relationship_progress removed (EP-01 pivot)
    # Dynamic relationship (tone, tension) provides engagement context instead
    return {
        "relationship_dynamic": context.relationship_dynamic,
        "relationship_milestones": context.relationship_milestones,
        "message_count": len(context.messages),
        "memory_count": len(context.memories),
        "hook_count": len(context.hooks),
        "memories": [{"type": m.type, "summary": m.summary} for m in context.memories],
        "hooks": [{"type": h.type, "content": h.content} for h in context.hooks],
    }


@router.post("/{character_id}/start", response_model=Session)
async def start_episode(
    character_id: UUID,
    scene: Optional[str] = None,
    episode_template_id: Optional[UUID] = None,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Start a new episode with a character.

    If there's already an active episode, returns that instead.

    Args:
        character_id: Character to start episode with
        scene: Optional custom scene description
        episode_template_id: Optional episode template ID (overrides scene)
    """
    service = ConversationService(db)

    episode = await service.get_or_create_episode(
        user_id=user_id,
        character_id=character_id,
        scene=scene,
        episode_template_id=episode_template_id,
    )

    return episode


@router.post("/{character_id}/end", response_model=Session)
async def end_episode(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """End the active episode with a character.

    This will:
    1. Generate an episode summary
    2. Update relationship stats
    3. Create any follow-up hooks
    """
    service = ConversationService(db)

    episode = await service.end_episode(
        user_id=user_id,
        character_id=character_id,
    )

    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active episode found",
        )

    return episode
