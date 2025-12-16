"""Episode models - DEPRECATED: Use session.py instead.

This file provides backwards compatibility aliases.
All new code should import from app.models.session.
"""

# Re-export from session for backwards compatibility
from app.models.session import (
    Session as Episode,
    SessionCreate as EpisodeCreate,
    SessionUpdate as EpisodeUpdate,
    SessionSummary as EpisodeSummary,
    SessionWithMessages as EpisodeWithMessages,
)

__all__ = [
    "Episode",
    "EpisodeCreate",
    "EpisodeUpdate",
    "EpisodeSummary",
    "EpisodeWithMessages",
]
