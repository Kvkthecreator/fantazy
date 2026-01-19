"""Sessions API routes (formerly Episodes)."""
from datetime import datetime
from typing import List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.session import Session, SessionCreate, SessionSummary, SessionUpdate

router = APIRouter(prefix="/sessions", tags=["Sessions"])


# =============================================================================
# User Chats (Sessions grouped by character with character info)
# =============================================================================

class ChatItem(BaseModel):
    """A chat session with character info for My Chats page."""
    session_id: str
    character_id: str
    character_name: str
    character_avatar_url: Optional[str] = None
    character_archetype: Optional[str] = None
    is_free_chat: bool  # True if template has is_free_chat=TRUE (or legacy NULL)
    episode_number: Optional[int] = None
    episode_title: Optional[str] = None
    series_id: Optional[str] = None
    series_title: Optional[str] = None
    message_count: int
    last_message_at: Optional[str] = None
    session_state: str
    is_active: bool


class UserChatsResponse(BaseModel):
    """Response for user's chat sessions."""
    items: List[ChatItem]


@router.get("/user/chats", response_model=UserChatsResponse)
async def get_user_chats(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db),
):
    """Get user's free chat sessions with character info.

    Returns free chat sessions - identified by:
    - episode_template.is_free_chat = TRUE (unified template model)
    - OR episode_template_id IS NULL (legacy sessions, backward compat)

    Sorted by most recent activity.
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    query = """
        SELECT
            s.id as session_id,
            s.character_id,
            c.name as character_name,
            c.avatar_url as character_avatar_url,
            c.archetype as character_archetype,
            TRUE as is_free_chat,
            s.episode_number,
            NULL as episode_title,
            s.series_id,
            ser.title as series_title,
            COALESCE((SELECT COUNT(*) FROM messages m WHERE m.episode_id = s.id), 0) as message_count,
            s.started_at as last_message_at,
            COALESCE(s.session_state, 'active') as session_state,
            s.is_active
        FROM sessions s
        JOIN characters c ON c.id = s.character_id
        LEFT JOIN series ser ON ser.id = s.series_id
        LEFT JOIN episode_templates et ON et.id = s.episode_template_id
        WHERE s.user_id = :user_id
        AND (
            et.is_free_chat = TRUE
            OR s.episode_template_id IS NULL
        )
        ORDER BY s.started_at DESC
        LIMIT :limit
    """

    rows = await db.fetch_all(query, {"user_id": user_id, "limit": limit})

    items = []
    for row in rows:
        items.append(ChatItem(
            session_id=str(row["session_id"]),
            character_id=str(row["character_id"]),
            character_name=row["character_name"],
            character_avatar_url=row["character_avatar_url"],
            character_archetype=row["character_archetype"],
            is_free_chat=row["is_free_chat"],
            episode_number=row["episode_number"],
            episode_title=row["episode_title"],
            series_id=str(row["series_id"]) if row["series_id"] else None,
            series_title=row["series_title"],
            message_count=row["message_count"] or 0,
            last_message_at=row["last_message_at"].isoformat() if row["last_message_at"] else None,
            session_state=row["session_state"],
            is_active=row["is_active"],
        ))

    return UserChatsResponse(items=items)


@router.delete("/user/chats/{character_id}/reset", status_code=status.HTTP_200_OK)
async def reset_free_chat(
    character_id: UUID,
    request: Request,
    db=Depends(get_db),
):
    """Reset free chat sessions with a specific character.

    This deletes free chat sessions identified by:
    - episode_template.is_free_chat = TRUE (unified template model)
    - OR episode_template_id IS NULL (legacy sessions)

    Episode-based sessions are not affected.
    This action is irreversible.
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Delete free chat sessions (messages cascade automatically)
    # Handles both unified template model and legacy NULL sessions
    delete_query = """
        DELETE FROM sessions s
        USING episode_templates et
        WHERE s.user_id = :user_id
        AND s.character_id = :character_id
        AND s.episode_template_id = et.id
        AND et.is_free_chat = TRUE
    """
    await db.execute(
        delete_query, {"user_id": user_id, "character_id": str(character_id)}
    )

    # Also delete legacy NULL sessions (backward compat)
    delete_legacy_query = """
        DELETE FROM sessions
        WHERE user_id = :user_id
        AND character_id = :character_id
        AND episode_template_id IS NULL
    """
    await db.execute(
        delete_legacy_query, {"user_id": user_id, "character_id": str(character_id)}
    )

    # Soft-delete memories from free chat sessions
    # For unified model, we need to find sessions with is_free_chat templates
    # For legacy, episode_id IS NULL in memory_events
    delete_memories_query = """
        UPDATE memory_events me
        SET is_active = FALSE
        WHERE me.user_id = :user_id
        AND me.character_id = :character_id
        AND (
            me.episode_id IS NULL
            OR me.episode_id IN (
                SELECT s.id FROM sessions s
                JOIN episode_templates et ON et.id = s.episode_template_id
                WHERE s.user_id = :user_id
                AND s.character_id = :character_id
                AND et.is_free_chat = TRUE
            )
        )
    """
    await db.execute(
        delete_memories_query, {"user_id": user_id, "character_id": str(character_id)}
    )

    return {"status": "reset", "character_id": str(character_id)}


@router.get("", response_model=List[SessionSummary])
async def list_sessions(
    user_id: UUID = Depends(get_current_user_id),
    character_id: Optional[UUID] = Query(None),
    active_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db=Depends(get_db),
):
    """List sessions for the current user."""
    conditions = ["user_id = :user_id"]
    values = {"user_id": str(user_id), "limit": limit, "offset": offset}

    if character_id:
        conditions.append("character_id = :character_id")
        values["character_id"] = str(character_id)

    if active_only:
        conditions.append("is_active = TRUE")

    query = f"""
        SELECT id, character_id, episode_number, title, started_at, ended_at,
               message_count, is_active
        FROM sessions
        WHERE {" AND ".join(conditions)}
        ORDER BY started_at DESC
        LIMIT :limit OFFSET :offset
    """

    rows = await db.fetch_all(query, values)
    return [SessionSummary(**dict(row)) for row in rows]


@router.post("", response_model=Session, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Start a new session with a character."""
    # Get or create engagement
    eng_query = """
        INSERT INTO engagements (user_id, character_id)
        VALUES (:user_id, :character_id)
        ON CONFLICT (user_id, character_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
    """
    eng_row = await db.fetch_one(eng_query, {"user_id": str(user_id), "character_id": str(data.character_id)})
    engagement_id = eng_row["id"]

    # Close any active sessions with this character
    close_query = """
        UPDATE sessions
        SET is_active = FALSE, ended_at = NOW()
        WHERE user_id = :user_id AND character_id = :character_id AND is_active = TRUE
    """
    await db.execute(close_query, {"user_id": str(user_id), "character_id": str(data.character_id)})

    # Get next episode number
    count_query = """
        SELECT COALESCE(MAX(episode_number), 0) + 1 as next_num
        FROM sessions
        WHERE user_id = :user_id AND character_id = :character_id
    """
    count_row = await db.fetch_one(count_query, {"user_id": str(user_id), "character_id": str(data.character_id)})
    episode_number = count_row["next_num"]

    # Create new session with explicit session_state for progress tracking
    query = """
        INSERT INTO sessions (user_id, character_id, engagement_id, episode_number, title, scene, session_state)
        VALUES (:user_id, :character_id, :engagement_id, :episode_number, :title, :scene, :session_state)
        RETURNING *
    """
    row = await db.fetch_one(
        query,
        {
            "user_id": str(user_id),
            "character_id": str(data.character_id),
            "engagement_id": str(engagement_id),
            "episode_number": episode_number,
            "title": data.title,
            "scene": data.scene,
            "session_state": "active",
        },
    )

    return Session(**dict(row))


@router.get("/active/{character_id}")
async def get_active_session(
    character_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
) -> Optional[Session]:
    """Get the active session with a character, if any."""
    query = """
        SELECT * FROM sessions
        WHERE user_id = :user_id AND character_id = :character_id AND is_active = TRUE
        ORDER BY started_at DESC
        LIMIT 1
    """
    row = await db.fetch_one(query, {"user_id": str(user_id), "character_id": str(character_id)})

    if not row:
        return None

    return Session(**dict(row))


@router.get("/{session_id}", response_model=Session)
async def get_session(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get a specific session."""
    query = """
        SELECT * FROM sessions
        WHERE id = :session_id AND user_id = :user_id
    """
    row = await db.fetch_one(query, {"session_id": str(session_id), "user_id": str(user_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return Session(**dict(row))


@router.patch("/{session_id}", response_model=Session)
async def update_session(
    session_id: UUID,
    data: SessionUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update a session."""
    updates = []
    values = {"session_id": str(session_id), "user_id": str(user_id)}

    if data.title is not None:
        updates.append("title = :title")
        values["title"] = data.title

    if data.scene is not None:
        updates.append("scene = :scene")
        values["scene"] = data.scene

    if data.is_active is not None:
        updates.append("is_active = :is_active")
        values["is_active"] = data.is_active
        if not data.is_active:
            updates.append("ended_at = :ended_at")
            values["ended_at"] = datetime.utcnow()

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    query = f"""
        UPDATE sessions
        SET {", ".join(updates)}
        WHERE id = :session_id AND user_id = :user_id
        RETURNING *
    """

    row = await db.fetch_one(query, values)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return Session(**dict(row))


@router.post("/{session_id}/end", response_model=Session)
async def end_session(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """End an active session."""
    query = """
        UPDATE sessions
        SET is_active = FALSE, ended_at = NOW()
        WHERE id = :session_id AND user_id = :user_id AND is_active = TRUE
        RETURNING *
    """
    row = await db.fetch_one(query, {"session_id": str(session_id), "user_id": str(user_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active session not found",
        )

    return Session(**dict(row))


# =============================================================================
# Props API (ADR-005: Canonical Story Objects)
# =============================================================================

class SessionProp(BaseModel):
    """Prop with revelation state for a session."""
    id: str
    name: str
    slug: str
    prop_type: str
    description: str
    content: Optional[str] = None
    content_format: Optional[str] = None
    image_url: Optional[str] = None
    reveal_mode: str
    reveal_turn_hint: Optional[int] = None
    is_key_evidence: bool
    evidence_tags: List[str] = []
    display_order: int
    # Revelation state
    is_revealed: bool
    revealed_at: Optional[str] = None
    revealed_turn: Optional[int] = None


class SessionPropsResponse(BaseModel):
    """Props for a session with revelation state."""
    session_id: str
    props: List[SessionProp]
    current_turn: int


class PropRevealResponse(BaseModel):
    """Response after revealing a prop."""
    prop_id: str
    revealed_at: str
    revealed_turn: int
    prop: SessionProp


@router.get("/{session_id}/props", response_model=SessionPropsResponse)
async def get_session_props(
    session_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get all props for a session with revelation state.

    ADR-005: Props are canonical story objects with exact, immutable content.
    Returns props from the episode template associated with this session,
    along with whether each prop has been revealed to the user.
    """
    # Get session and verify ownership
    session_query = """
        SELECT id, episode_template_id, turn_count, user_id
        FROM sessions
        WHERE id = :session_id AND user_id = :user_id
    """
    session = await db.fetch_one(session_query, {
        "session_id": str(session_id),
        "user_id": str(user_id),
    })

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if not session["episode_template_id"]:
        # No episode template = no props
        return SessionPropsResponse(
            session_id=str(session_id),
            props=[],
            current_turn=session["turn_count"] or 0,
        )

    # Fetch props with revelation state
    props_query = """
        SELECT
            p.id, p.name, p.slug, p.prop_type, p.description,
            p.content, p.content_format, p.image_url,
            p.reveal_mode, p.reveal_turn_hint, p.is_key_evidence,
            p.evidence_tags, p.display_order,
            sp.revealed_at,
            sp.revealed_turn
        FROM props p
        LEFT JOIN session_props sp ON sp.prop_id = p.id AND sp.session_id = :session_id
        WHERE p.episode_template_id = :template_id
        ORDER BY p.display_order
    """
    prop_rows = await db.fetch_all(props_query, {
        "session_id": str(session_id),
        "template_id": str(session["episode_template_id"]),
    })

    props = []
    for row in prop_rows:
        # Parse evidence_tags if needed
        evidence_tags = row["evidence_tags"] or []
        if isinstance(evidence_tags, str):
            import json
            evidence_tags = json.loads(evidence_tags)

        props.append(SessionProp(
            id=str(row["id"]),
            name=row["name"],
            slug=row["slug"],
            prop_type=row["prop_type"],
            description=row["description"],
            content=row["content"],
            content_format=row["content_format"],
            image_url=row["image_url"],
            reveal_mode=row["reveal_mode"],
            reveal_turn_hint=row["reveal_turn_hint"],
            is_key_evidence=row["is_key_evidence"],
            evidence_tags=evidence_tags,
            display_order=row["display_order"],
            is_revealed=row["revealed_at"] is not None,
            revealed_at=row["revealed_at"].isoformat() if row["revealed_at"] else None,
            revealed_turn=row["revealed_turn"],
        ))

    return SessionPropsResponse(
        session_id=str(session_id),
        props=props,
        current_turn=session["turn_count"] or 0,
    )


@router.post("/{session_id}/props/{prop_id}/reveal", response_model=PropRevealResponse)
async def reveal_prop(
    session_id: UUID,
    prop_id: UUID,
    reveal_trigger: Optional[str] = Query(None, description="How the prop was revealed"),
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Mark a prop as revealed in a session.

    ADR-005: Props are revealed once per session. Subsequent reveals are no-ops
    that return the existing revelation data.

    reveal_trigger can be:
    - "character_showed" - Character naturally revealed it
    - "player_asked" - Player explicitly requested to see it
    - "automatic" - Revealed based on turn_hint
    - "gated_unlock" - Prerequisite prop was revealed
    """
    # Get session and verify ownership
    session_query = """
        SELECT id, episode_template_id, turn_count, user_id
        FROM sessions
        WHERE id = :session_id AND user_id = :user_id
    """
    session = await db.fetch_one(session_query, {
        "session_id": str(session_id),
        "user_id": str(user_id),
    })

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Verify prop belongs to this session's episode
    prop_query = """
        SELECT p.*, p.evidence_tags
        FROM props p
        WHERE p.id = :prop_id
        AND p.episode_template_id = :template_id
    """
    prop = await db.fetch_one(prop_query, {
        "prop_id": str(prop_id),
        "template_id": str(session["episode_template_id"]),
    })

    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prop not found for this session's episode",
        )

    current_turn = session["turn_count"] or 0

    # Check if already revealed
    existing_query = """
        SELECT * FROM session_props
        WHERE session_id = :session_id AND prop_id = :prop_id
    """
    existing = await db.fetch_one(existing_query, {
        "session_id": str(session_id),
        "prop_id": str(prop_id),
    })

    if existing:
        # Already revealed - return existing data
        revealed_at = existing["revealed_at"]
        revealed_turn = existing["revealed_turn"]
    else:
        # Insert new revelation
        from datetime import datetime, timezone
        revealed_at = datetime.now(timezone.utc)
        revealed_turn = current_turn

        insert_query = """
            INSERT INTO session_props (session_id, prop_id, revealed_turn, reveal_trigger)
            VALUES (:session_id, :prop_id, :revealed_turn, :reveal_trigger)
        """
        await db.execute(insert_query, {
            "session_id": str(session_id),
            "prop_id": str(prop_id),
            "revealed_turn": revealed_turn,
            "reveal_trigger": reveal_trigger or "character_showed",
        })

    # Parse evidence_tags
    evidence_tags = prop["evidence_tags"] or []
    if isinstance(evidence_tags, str):
        import json
        evidence_tags = json.loads(evidence_tags)

    session_prop = SessionProp(
        id=str(prop["id"]),
        name=prop["name"],
        slug=prop["slug"],
        prop_type=prop["prop_type"],
        description=prop["description"],
        content=prop["content"],
        content_format=prop["content_format"],
        image_url=prop["image_url"],
        reveal_mode=prop["reveal_mode"],
        reveal_turn_hint=prop["reveal_turn_hint"],
        is_key_evidence=prop["is_key_evidence"],
        evidence_tags=evidence_tags,
        display_order=prop["display_order"],
        is_revealed=True,
        revealed_at=revealed_at.isoformat() if hasattr(revealed_at, 'isoformat') else str(revealed_at),
        revealed_turn=revealed_turn,
    )

    return PropRevealResponse(
        prop_id=str(prop_id),
        revealed_at=revealed_at.isoformat() if hasattr(revealed_at, 'isoformat') else str(revealed_at),
        revealed_turn=revealed_turn,
        prop=session_prop,
    )


# =============================================================================
# ADR-008: User Objectives - Choice Points
# =============================================================================

import json as json_lib


class ChoiceRequest(BaseModel):
    """Request to record a user's choice at a choice point."""
    choice_point_id: str
    selected_option_id: str


class ChoiceResponse(BaseModel):
    """Response after recording a choice."""
    status: str
    choice_point_id: str
    selected_option_id: str
    flag_set: Optional[str] = None


@router.post("/{session_id}/choice", response_model=ChoiceResponse)
async def record_choice(
    session_id: UUID,
    data: ChoiceRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Record user's choice at a choice point (ADR-008).

    This endpoint:
    - Validates the choice point exists in the episode template
    - Records the choice in director_state.choices_made
    - Sets any flags associated with the selected choice
    - Marks the choice point as triggered to prevent re-triggering

    Returns the flag that was set (if any) so frontend can update state.
    """
    # Get session with template info
    session_query = """
        SELECT s.id, s.user_id, s.episode_template_id, s.director_state,
               et.choice_points
        FROM sessions s
        LEFT JOIN episode_templates et ON et.id = s.episode_template_id
        WHERE s.id = :session_id AND s.user_id = :user_id
    """
    session = await db.fetch_one(session_query, {
        "session_id": str(session_id),
        "user_id": str(user_id),
    })

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Parse choice_points from template
    choice_points_raw = session["choice_points"]
    if isinstance(choice_points_raw, str):
        choice_points = json_lib.loads(choice_points_raw)
    elif choice_points_raw is None:
        choice_points = []
    else:
        choice_points = choice_points_raw

    # Find the matching choice point
    choice_point = None
    for cp in choice_points:
        if cp.get("id") == data.choice_point_id:
            choice_point = cp
            break

    if not choice_point:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Choice point '{data.choice_point_id}' not found in episode",
        )

    # Find the selected choice
    selected_choice = None
    for choice in choice_point.get("choices", []):
        if choice.get("id") == data.selected_option_id:
            selected_choice = choice
            break

    if not selected_choice:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid option '{data.selected_option_id}' for choice point",
        )

    # Update director_state
    director_state_raw = session["director_state"]
    if isinstance(director_state_raw, str):
        director_state = json_lib.loads(director_state_raw)
    elif director_state_raw is None:
        director_state = {}
    else:
        director_state = dict(director_state_raw)

    # Initialize tracking structures if needed
    if "choices_made" not in director_state:
        director_state["choices_made"] = []
    if "triggered_choices" not in director_state:
        director_state["triggered_choices"] = []
    if "flags" not in director_state:
        director_state["flags"] = {}

    # Record the choice
    director_state["choices_made"].append({
        "choice_point_id": data.choice_point_id,
        "selected": data.selected_option_id,
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Mark as triggered (prevent re-triggering)
    if data.choice_point_id not in director_state["triggered_choices"]:
        director_state["triggered_choices"].append(data.choice_point_id)

    # Set flag if specified
    flag_set = None
    if selected_choice.get("sets_flag"):
        flag_set = selected_choice["sets_flag"]
        director_state["flags"][flag_set] = True

    # Save updated director_state
    update_query = """
        UPDATE sessions
        SET director_state = :director_state
        WHERE id = :session_id
    """
    await db.execute(update_query, {
        "session_id": str(session_id),
        "director_state": json_lib.dumps(director_state),
    })

    return ChoiceResponse(
        status="recorded",
        choice_point_id=data.choice_point_id,
        selected_option_id=data.selected_option_id,
        flag_set=flag_set,
    )


# =============================================================================
# Guest Sessions (Anonymous Episode 0 trials)
# =============================================================================

import hashlib
import uuid as uuid_lib
from datetime import timezone


class GuestSessionCreate(BaseModel):
    """Data for creating a guest session."""
    character_id: UUID
    episode_template_id: UUID  # Must be Episode 0
    guest_session_id: Optional[str] = None  # Client-provided or auto-generated


class GuestSessionResponse(BaseModel):
    """Response for guest session creation."""
    session_id: str
    guest_session_id: str
    messages_remaining: int  # 5 minus current message count
    episode_template_id: str
    character_id: str


class ConvertGuestSessionRequest(BaseModel):
    """Request to convert guest session to authenticated."""
    guest_session_id: str


class ConvertGuestSessionResponse(BaseModel):
    """Response after converting guest session."""
    session_id: str
    message_count: int
    converted: bool


@router.post("/guest", response_model=GuestSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_guest_session(
    data: GuestSessionCreate,
    request: Request,
    db=Depends(get_db),
):
    """Create an anonymous guest session for Episode 0 trial.

    Rate limiting: Max 3 guest sessions per IP per 24 hours.
    Message limit: 5 messages per guest session (enforced in conversation endpoint).

    This endpoint:
    - Allows anonymous users to try Episode 0 without signing up
    - Stores session with user_id = NULL and guest_session_id for tracking
    - Returns guest_session_id for client to store in localStorage
    - Enforces IP-based rate limiting to prevent abuse
    """
    # Get client IP for rate limiting
    forwarded_for = request.headers.get("X-Forwarded-For")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.client.host
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()

    # Check IP-based rate limit (prevent abuse)
    count_query = """
        SELECT COUNT(*) as session_count
        FROM sessions
        WHERE guest_ip_hash = :ip_hash
        AND guest_created_at > NOW() - INTERVAL '24 hours'
    """
    row = await db.fetch_one(count_query, {"ip_hash": ip_hash})

    if row and row["session_count"] >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Guest session limit reached. Please sign up to continue chatting."
        )

    # Verify episode template exists and is Episode 0
    template_query = """
        SELECT episode_number, series_id, character_id
        FROM episode_templates
        WHERE id = :template_id
    """
    template = await db.fetch_one(template_query, {"template_id": str(data.episode_template_id)})

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode template not found"
        )

    if template["episode_number"] != 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest sessions are only allowed for Episode 0. Sign up to access other episodes."
        )

    # Generate or use provided guest_session_id
    guest_session_id = data.guest_session_id or str(uuid_lib.uuid4())

    # Check if guest session already exists (user resuming)
    existing_query = """
        SELECT id, message_count, user_id
        FROM sessions
        WHERE guest_session_id = :guest_id
    """
    existing = await db.fetch_one(existing_query, {"guest_id": guest_session_id})

    if existing:
        # Check if session was already converted
        if existing["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This guest session has been converted. Please log in to continue."
            )

        # Resume existing guest session
        return GuestSessionResponse(
            session_id=str(existing["id"]),
            guest_session_id=guest_session_id,
            messages_remaining=max(0, 5 - (existing["message_count"] or 0)),
            episode_template_id=str(data.episode_template_id),
            character_id=str(data.character_id),
        )

    # Create new guest session
    insert_query = """
        INSERT INTO sessions (
            user_id,
            character_id,
            episode_template_id,
            series_id,
            episode_number,
            guest_session_id,
            guest_created_at,
            guest_ip_hash,
            session_state
        )
        VALUES (
            NULL,
            :character_id,
            :episode_template_id,
            :series_id,
            0,
            :guest_session_id,
            :created_at,
            :ip_hash,
            'active'
        )
        RETURNING id
    """

    row = await db.fetch_one(
        insert_query,
        {
            "character_id": str(data.character_id),
            "episode_template_id": str(data.episode_template_id),
            "series_id": str(template["series_id"]) if template["series_id"] else None,
            "guest_session_id": guest_session_id,
            "created_at": datetime.now(timezone.utc),
            "ip_hash": ip_hash,
        },
    )

    return GuestSessionResponse(
        session_id=str(row["id"]),
        guest_session_id=guest_session_id,
        messages_remaining=5,
        episode_template_id=str(data.episode_template_id),
        character_id=str(data.character_id),
    )


@router.post("/guest/convert", response_model=ConvertGuestSessionResponse)
async def convert_guest_session(
    data: ConvertGuestSessionRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Convert a guest session to an authenticated user's session.

    Called after user signs up - links the guest conversation to their account.
    All messages are preserved and the session becomes theirs.

    This endpoint:
    - Updates session.user_id from NULL to the authenticated user's ID
    - Sets session.guest_converted_at timestamp for analytics
    - Creates or updates engagement record
    - Returns session details for frontend to continue conversation
    """
    # Find guest session
    query = """
        SELECT id, character_id, message_count, user_id
        FROM sessions
        WHERE guest_session_id = :guest_id
    """
    session = await db.fetch_one(query, {"guest_id": data.guest_session_id})

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest session not found. It may have expired (24 hour limit)."
        )

    # Check if already converted
    if session["user_id"]:
        if str(session["user_id"]) == str(user_id):
            # Already converted to this user - return success
            return ConvertGuestSessionResponse(
                session_id=str(session["id"]),
                message_count=session["message_count"] or 0,
                converted=True,
            )
        else:
            # Converted to different user - conflict
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This guest session belongs to another user."
            )

    # Convert session to authenticated
    update_query = """
        UPDATE sessions
        SET
            user_id = :user_id,
            guest_converted_at = NOW()
        WHERE guest_session_id = :guest_id
        AND user_id IS NULL
        RETURNING id, message_count
    """
    result = await db.fetch_one(update_query, {
        "user_id": str(user_id),
        "guest_id": data.guest_session_id,
    })

    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to convert guest session. Please try again."
        )

    # Create or update engagement record
    eng_query = """
        INSERT INTO engagements (user_id, character_id)
        VALUES (:user_id, :character_id)
        ON CONFLICT (user_id, character_id) DO UPDATE
        SET updated_at = NOW()
    """
    await db.execute(eng_query, {
        "user_id": str(user_id),
        "character_id": str(session["character_id"]),
    })

    return ConvertGuestSessionResponse(
        session_id=str(result["id"]),
        message_count=result["message_count"] or 0,
        converted=True,
    )
