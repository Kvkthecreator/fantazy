"""Games Service - Orchestrates bounded episode gameplay.

This service manages the flirt test and other game-type episodes.
It wraps ConversationService and DirectorService for bounded episodes
with completion detection and evaluation.

Reference: docs/plans/FLIRT_TEST_IMPLEMENTATION_PLAN.md
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional
from uuid import UUID

from app.models.episode_template import EpisodeTemplate
from app.models.session import Session
from app.models.message import MessageRole
from app.models.evaluation import generate_share_id
from app.services.conversation import ConversationService
from app.services.director import DirectorService
from app.services.llm import LLMService, CHARACTER_RESPONSE_SCHEMA, render_structured_response
from app.services.memory import MemoryService

log = logging.getLogger(__name__)


@dataclass
class GameStartResult:
    """Result of starting a game session."""
    session_id: UUID
    character_id: UUID
    character_name: str
    character_avatar_url: Optional[str]
    opening_line: str
    turn_budget: int
    situation: str


@dataclass
class GameMessageResult:
    """Result of a game message exchange."""
    message_content: str
    turn_count: int
    turns_remaining: int
    is_complete: bool
    structured_response: Optional[Dict[str, Any]]
    evaluation: Optional[Dict[str, Any]]


class GamesService:
    """Service for managing game-type episodes.

    Games are bounded episodes with:
    - Fixed turn budget
    - Structured character output
    - Automatic completion detection
    - Evaluation generation at completion
    """

    def __init__(self, db):
        self.db = db
        self.llm = LLMService.get_instance()
        self.conversation_service = ConversationService(db)
        self.director_service = DirectorService(db)
        self.memory_service = MemoryService(db)

    async def start_game(
        self,
        user_id: UUID,
        game_slug: str,
        character_choice: Optional[str] = None,
    ) -> GameStartResult:
        """Start a new game session.

        Args:
            user_id: User UUID
            game_slug: Game identifier (e.g., "flirt-test")
            character_choice: Optional character preference ("m" or "f")

        Returns:
            GameStartResult with session info
        """
        # Find the game series and episode template
        if character_choice == "m":
            series_slug = f"{game_slug}-m"
        elif character_choice == "f":
            series_slug = f"{game_slug}-f"
        else:
            # Default to random or first available
            series_slug = f"{game_slug}-f"

        # Get series and its entry episode
        series_query = """
            SELECT s.id as series_id, et.*, c.name as character_name, c.avatar_url as character_avatar_url
            FROM series s
            JOIN episode_templates et ON et.series_id = s.id
            JOIN characters c ON c.id = et.character_id
            WHERE s.slug = :series_slug
            AND et.episode_type = 'entry'
            AND et.status = 'active'
            LIMIT 1
        """
        row = await self.db.fetch_one(series_query, {"series_slug": series_slug})

        if not row:
            # Fallback: try without the suffix
            row = await self.db.fetch_one(series_query, {"series_slug": game_slug})

        if not row:
            raise ValueError(f"Game not found: {game_slug}")

        episode_template = EpisodeTemplate(**{
            k: row[k] for k in row.keys()
            if k not in ("series_id", "character_name", "character_avatar_url")
            and k in EpisodeTemplate.model_fields
        })

        # Create session
        session = await self.conversation_service.get_or_create_episode(
            user_id=user_id,
            character_id=episode_template.character_id,
            episode_template_id=episode_template.id,
        )

        # Initialize director state
        await self._initialize_director_state(session.id)

        return GameStartResult(
            session_id=session.id,
            character_id=episode_template.character_id,
            character_name=row["character_name"],
            character_avatar_url=row["character_avatar_url"],
            opening_line=episode_template.opening_line,
            turn_budget=episode_template.turn_budget or 7,
            situation=episode_template.situation,
        )

    async def send_message(
        self,
        user_id: UUID,
        session_id: UUID,
        content: str,
    ) -> GameMessageResult:
        """Send a message in a game session.

        Uses structured output for character responses.

        Args:
            user_id: User UUID
            session_id: Session UUID
            content: User message content

        Returns:
            GameMessageResult with response and game state
        """
        # Get session and template
        session, episode_template = await self._get_session_with_template(session_id, user_id)

        # Build context
        context = await self.conversation_service.get_context(
            user_id=user_id,
            character_id=session.character_id,
            episode_id=session_id,
        )

        # Save user message
        await self.conversation_service._save_message(
            episode_id=session_id,
            role=MessageRole.USER,
            content=content,
        )

        # Add user message to context
        context.messages.append({"role": "user", "content": content})

        # Generate structured response
        formatted_messages = context.to_messages()
        structured_response = await self.llm.generate_structured(
            messages=formatted_messages,
            response_schema=CHARACTER_RESPONSE_SCHEMA,
        )

        # Render for display
        display_content = render_structured_response(structured_response)

        # Save assistant message
        await self.conversation_service._save_message(
            episode_id=session_id,
            role=MessageRole.ASSISTANT,
            content=display_content,
            metadata={"structured": structured_response},
        )

        # Process with Director
        director_output = await self.director_service.process_exchange(
            session=session,
            episode_template=episode_template,
            messages=context.messages + [{"role": "assistant", "content": display_content}],
            character_id=session.character_id,
            user_id=user_id,
            structured_response=structured_response,
        )

        # Calculate turns remaining
        turn_budget = episode_template.turn_budget or 7 if episode_template else 7
        turns_remaining = max(0, turn_budget - director_output.turn_count)

        return GameMessageResult(
            message_content=display_content,
            turn_count=director_output.turn_count,
            turns_remaining=turns_remaining,
            is_complete=director_output.is_complete,
            structured_response=structured_response,
            evaluation=director_output.evaluation,
        )

    async def send_message_stream(
        self,
        user_id: UUID,
        session_id: UUID,
        content: str,
    ) -> AsyncIterator[str]:
        """Send a message and stream the response.

        For games, we still stream but include structured metadata in the final event.
        """
        # Get session and template
        session, episode_template = await self._get_session_with_template(session_id, user_id)

        # Build context
        context = await self.conversation_service.get_context(
            user_id=user_id,
            character_id=session.character_id,
            episode_id=session_id,
        )

        # Save user message
        await self.conversation_service._save_message(
            episode_id=session_id,
            role=MessageRole.USER,
            content=content,
        )
        context.messages.append({"role": "user", "content": content})

        # For games, generate structured response (non-streaming for now)
        # TODO: Could implement streaming with structured postprocessing
        formatted_messages = context.to_messages()
        structured_response = await self.llm.generate_structured(
            messages=formatted_messages,
            response_schema=CHARACTER_RESPONSE_SCHEMA,
        )

        display_content = render_structured_response(structured_response)

        # Stream the display content in chunks
        for i in range(0, len(display_content), 10):
            chunk = display_content[i:i+10]
            yield json.dumps({"type": "chunk", "content": chunk})

        # Save message
        await self.conversation_service._save_message(
            episode_id=session_id,
            role=MessageRole.ASSISTANT,
            content=display_content,
            metadata={"structured": structured_response},
        )

        # Process with Director
        director_output = await self.director_service.process_exchange(
            session=session,
            episode_template=episode_template,
            messages=context.messages + [{"role": "assistant", "content": display_content}],
            character_id=session.character_id,
            user_id=user_id,
            structured_response=structured_response,
        )

        turn_budget = episode_template.turn_budget or 7 if episode_template else 7
        turns_remaining = max(0, turn_budget - director_output.turn_count)

        # Yield completion event
        if director_output.is_complete:
            yield json.dumps({
                "type": "episode_complete",
                "turn_count": director_output.turn_count,
                "evaluation": director_output.evaluation,
            })
        else:
            yield json.dumps({
                "type": "message_complete",
                "content": display_content,
                "turn_count": director_output.turn_count,
                "turns_remaining": turns_remaining,
                "mood": structured_response.get("mood"),
            })

        yield json.dumps({"type": "done"})

    async def get_result(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> Optional[Dict[str, Any]]:
        """Get the evaluation result for a completed game session.

        Args:
            session_id: Session UUID
            user_id: User UUID (for authorization)

        Returns:
            Evaluation result or None if not complete
        """
        # Verify ownership and get session
        session_query = """
            SELECT s.*, c.name as character_name, c.avatar_url as character_avatar_url
            FROM sessions s
            JOIN characters c ON c.id = s.character_id
            WHERE s.id = :session_id AND s.user_id = :user_id
        """
        row = await self.db.fetch_one(session_query, {
            "session_id": str(session_id),
            "user_id": str(user_id),
        })

        if not row:
            return None

        if row["session_state"] != "complete":
            return None

        # Get evaluation
        eval_query = """
            SELECT * FROM session_evaluations
            WHERE session_id = :session_id
            ORDER BY created_at DESC
            LIMIT 1
        """
        eval_row = await self.db.fetch_one(eval_query, {"session_id": str(session_id)})

        if not eval_row:
            return None

        result = json.loads(eval_row["result"]) if isinstance(eval_row["result"], str) else eval_row["result"]

        return {
            "evaluation": {
                "id": str(eval_row["id"]),
                "evaluation_type": eval_row["evaluation_type"],
                "result": result,
                "share_id": eval_row["share_id"],
                "share_count": eval_row["share_count"],
            },
            "share_url": f"/r/{eval_row['share_id']}",
            "character_id": str(row["character_id"]),
            "character_name": row["character_name"],
            "series_id": str(row["series_id"]) if row["series_id"] else None,
        }

    async def _get_session_with_template(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> tuple[Session, Optional[EpisodeTemplate]]:
        """Get session and its episode template."""
        session_query = """
            SELECT s.*, et.*
            FROM sessions s
            LEFT JOIN episode_templates et ON et.id = s.episode_template_id
            WHERE s.id = :session_id AND s.user_id = :user_id
        """
        row = await self.db.fetch_one(session_query, {
            "session_id": str(session_id),
            "user_id": str(user_id),
        })

        if not row:
            raise ValueError(f"Session not found: {session_id}")

        # Split row into session and template fields
        session_fields = {k: row[k] for k in Session.model_fields if k in row.keys()}
        session = Session(**session_fields)

        episode_template = None
        if row["episode_template_id"]:
            template_fields = {k: row[k] for k in EpisodeTemplate.model_fields if k in row.keys()}
            try:
                episode_template = EpisodeTemplate(**template_fields)
            except Exception as e:
                log.warning(f"Failed to parse episode template: {e}")

        return session, episode_template

    async def _initialize_director_state(self, session_id: UUID):
        """Initialize director state for a new game session."""
        await self.db.execute(
            """
            UPDATE sessions
            SET turn_count = 0,
                director_state = :director_state
            WHERE id = :session_id
            """,
            {
                "session_id": str(session_id),
                "director_state": json.dumps({
                    "tension_level": 30,
                    "signals": [],
                    "mood_history": [],
                }),
            }
        )
