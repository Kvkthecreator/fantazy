"""Pydantic models for Fantazy API."""

from app.models.user import (
    User,
    UserCreate,
    UserUpdate,
    UserPreferences,
    OnboardingData,
)
from app.models.character import (
    Character,
    CharacterSummary,
    CharacterPersonality,
    CharacterToneStyle,
    CharacterBoundaries,
)
from app.models.world import World, WorldSummary
from app.models.engagement import (
    Engagement,
    EngagementCreate,
    EngagementUpdate,
    EngagementWithCharacter,
    # Backwards compatibility aliases
    Relationship,
    RelationshipCreate,
    RelationshipUpdate,
    RelationshipWithCharacter,
)
from app.models.session import (
    Session,
    SessionCreate,
    SessionSummary,
    SessionUpdate,
    SessionWithMessages,
    # Backwards compatibility aliases
    Episode,
    EpisodeCreate,
    EpisodeSummary,
    EpisodeUpdate,
    EpisodeWithMessages,
)
from app.models.message import (
    Message,
    MessageCreate,
    MessageRole,
    ConversationContext,
)
from app.models.memory import (
    MemoryEvent,
    MemoryEventCreate,
    MemoryType,
    MemoryQuery,
)
from app.models.hook import (
    Hook,
    HookCreate,
    HookType,
)
from app.models.usage import (
    UsageStats,
    UsageResponse,
    FluxUsage,
    MessageUsage,
    QuotaCheckResult,
    UsageEvent,
    UsageEventCreate,
)

__all__ = [
    # User
    "User",
    "UserCreate",
    "UserUpdate",
    "UserPreferences",
    "OnboardingData",
    # Character
    "Character",
    "CharacterSummary",
    "CharacterPersonality",
    "CharacterToneStyle",
    "CharacterBoundaries",
    # World
    "World",
    "WorldSummary",
    # Engagement (new)
    "Engagement",
    "EngagementCreate",
    "EngagementUpdate",
    "EngagementWithCharacter",
    # Relationship (deprecated aliases)
    "Relationship",
    "RelationshipCreate",
    "RelationshipUpdate",
    "RelationshipWithCharacter",
    # Session (new)
    "Session",
    "SessionCreate",
    "SessionSummary",
    "SessionUpdate",
    "SessionWithMessages",
    # Episode (deprecated aliases)
    "Episode",
    "EpisodeCreate",
    "EpisodeSummary",
    "EpisodeUpdate",
    "EpisodeWithMessages",
    # Message
    "Message",
    "MessageCreate",
    "MessageRole",
    "ConversationContext",
    # Memory
    "MemoryEvent",
    "MemoryEventCreate",
    "MemoryType",
    "MemoryQuery",
    # Hook
    "Hook",
    "HookCreate",
    "HookType",
    # Usage
    "UsageStats",
    "UsageResponse",
    "FluxUsage",
    "MessageUsage",
    "QuotaCheckResult",
    "UsageEvent",
    "UsageEventCreate",
]
