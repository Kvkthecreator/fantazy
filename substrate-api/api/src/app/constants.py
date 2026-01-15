"""Application-wide constants."""

from uuid import UUID

# Guest user ID - a shared user record for all anonymous guest sessions.
# This allows guest sessions to use all existing code paths that expect a user_id.
# Guest sessions are still isolated by their unique session records and guest_session_id.
GUEST_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
