"""Fantazy API routes."""

from app.routes import (
    health,
    users,
    characters,
    engagements,
    sessions,
    episode_templates,
    messages,
    memory,
    hooks,
    conversation,
    scenes,
    subscription,
    credits,
    avatars,
    studio,
    # Backwards compatibility aliases
    relationships,
    episodes,
)

__all__ = [
    "health",
    "users",
    "characters",
    # New names
    "engagements",
    "sessions",
    # Legacy aliases
    "relationships",
    "episodes",
    "episode_templates",
    "messages",
    "memory",
    "hooks",
    "conversation",
    "scenes",
    "subscription",
    "credits",
    "avatars",
    "studio",
]
