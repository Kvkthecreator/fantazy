"""Conversation API routes - the main chat endpoint."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.message import MessageCreate, Message
from app.models.episode import Episode
from app.services.conversation import ConversationService

router = APIRouter(prefix="/conversation", tags=["Conversation"])


@router.post("/{character_id}/send", response_model=Message)
async def send_message(
    character_id: UUID,
    data: MessageCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Send a message to a character and get a response.

    This is the main conversation endpoint that:
    1. Gets or creates an active episode
    2. Loads conversation context (messages, memories, hooks)
    3. Sends to LLM and gets response
    4. Saves both messages
    5. Extracts memories and hooks from the exchange
    """
    service = ConversationService(db)

    try:
        response = await service.send_message(
            user_id=user_id,
            character_id=character_id,
            content=data.content,
        )
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{character_id}/send/stream")
async def send_message_stream(
    character_id: UUID,
    data: MessageCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Send a message and stream the response.

    Returns a Server-Sent Events stream with the character's response.
    """
    service = ConversationService(db)

    async def generate():
        try:
            async for chunk in service.send_message_stream(
                user_id=user_id,
                character_id=character_id,
                content=data.content,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

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

    return {
        "relationship_stage": context.relationship_stage,
        "relationship_progress": context.relationship_progress,
        "message_count": len(context.messages),
        "memory_count": len(context.memories),
        "hook_count": len(context.hooks),
        "memories": [{"type": m.type, "summary": m.summary} for m in context.memories],
        "hooks": [{"type": h.type, "content": h.content} for h in context.hooks],
    }


@router.post("/{character_id}/start", response_model=Episode)
async def start_episode(
    character_id: UUID,
    scene: Optional[str] = None,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Start a new episode with a character.

    If there's already an active episode, returns that instead.
    """
    service = ConversationService(db)

    episode = await service.get_or_create_episode(
        user_id=user_id,
        character_id=character_id,
        scene=scene,
    )

    return episode


@router.post("/{character_id}/end", response_model=Episode)
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
