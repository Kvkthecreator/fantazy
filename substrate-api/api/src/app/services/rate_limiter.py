"""Rate limiter service for message abuse prevention.

Messages are FREE (0 spark cost) but rate-limited to prevent abuse.
See docs/monetization/CREDITS_SYSTEM_PROPOSAL.md Section 2.2 for design rationale.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""
    allowed: bool
    remaining: int
    reset_at: Optional[datetime]
    cooldown_seconds: Optional[int]
    message: Optional[str]


class RateLimitExceededError(Exception):
    """Raised when rate limit is exceeded."""
    def __init__(
        self,
        message: str,
        reset_at: Optional[datetime] = None,
        cooldown_seconds: Optional[int] = None,
        remaining: int = 0,
    ):
        super().__init__(message)
        self.message = message
        self.reset_at = reset_at
        self.cooldown_seconds = cooldown_seconds
        self.remaining = remaining


class MessageRateLimiter:
    """
    Rate limiter for chat messages.

    Uses in-memory storage for MVP. Can be upgraded to Redis for production scale.

    Rate limits (per user):
    - Free tier: 30/hour, 100/day, burst limit of 5 in 10s
    - Premium tier: 120/hour, unlimited daily, burst limit of 10 in 10s
    """

    # Tier configurations
    LIMITS = {
        "free": {
            "per_hour": 30,
            "per_day": 100,
            "burst_count": 5,
            "burst_window_seconds": 10,
            "cooldown_seconds": 60,
        },
        "premium": {
            "per_hour": 120,
            "per_day": None,  # Unlimited
            "burst_count": 10,
            "burst_window_seconds": 10,
            "cooldown_seconds": 0,
        },
    }

    _instance: Optional["MessageRateLimiter"] = None

    def __init__(self):
        # In-memory storage: {user_id: {window: {count, expires}}}
        self._store: Dict[str, Dict[str, dict]] = {}

    @classmethod
    def get_instance(cls) -> "MessageRateLimiter":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_user_store(self, user_id: str) -> Dict[str, dict]:
        """Get or create user's rate limit store."""
        if user_id not in self._store:
            self._store[user_id] = {}
        return self._store[user_id]

    def _get_count(self, user_id: str, window: str) -> int:
        """Get current count for a time window."""
        store = self._get_user_store(user_id)
        entry = store.get(window)

        if not entry:
            return 0

        # Check if expired
        if datetime.now(timezone.utc) > entry["expires"]:
            del store[window]
            return 0

        return entry["count"]

    def _increment(self, user_id: str, window: str, ttl_seconds: int) -> int:
        """Increment counter for a time window. Returns new count."""
        store = self._get_user_store(user_id)
        now = datetime.now(timezone.utc)

        entry = store.get(window)

        # Check if expired or doesn't exist
        if not entry or now > entry["expires"]:
            store[window] = {
                "count": 1,
                "expires": now + timedelta(seconds=ttl_seconds),
            }
            return 1

        entry["count"] += 1
        return entry["count"]

    def _get_reset_time(self, user_id: str, window: str) -> datetime:
        """Get when the rate limit resets."""
        store = self._get_user_store(user_id)
        entry = store.get(window)

        if not entry:
            return datetime.now(timezone.utc)

        return entry["expires"]

    def _format_time_remaining(self, reset_at: datetime) -> str:
        """Format time remaining as human-readable string."""
        delta = reset_at - datetime.now(timezone.utc)
        total_seconds = max(0, int(delta.total_seconds()))

        if total_seconds < 60:
            return "less than a minute"
        elif total_seconds < 120:
            return "1 minute"
        elif total_seconds < 3600:
            minutes = total_seconds // 60
            return f"{minutes} minutes"
        else:
            hours = total_seconds // 3600
            return f"{hours} hour{'s' if hours > 1 else ''}"

    async def check_rate_limit(
        self,
        user_id: UUID,
        subscription_status: str = "free",
    ) -> RateLimitResult:
        """
        Check if user can send a message.

        Args:
            user_id: User ID
            subscription_status: 'free' or 'premium'

        Returns:
            RateLimitResult with allowed status and remaining count
        """
        limits = self.LIMITS.get(subscription_status, self.LIMITS["free"])
        user_key = str(user_id)
        now = datetime.now(timezone.utc)

        # Get current counts
        hour_count = self._get_count(user_key, "hour")
        day_count = self._get_count(user_key, "day")
        burst_count = self._get_count(user_key, "burst")

        # Check burst limit (spam protection)
        if burst_count >= limits["burst_count"]:
            reset_at = self._get_reset_time(user_key, "burst")
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_at=reset_at,
                cooldown_seconds=limits["burst_window_seconds"],
                message="Slow down! Please wait a moment before sending another message.",
            )

        # Check hourly limit
        if limits["per_hour"] and hour_count >= limits["per_hour"]:
            reset_at = self._get_reset_time(user_key, "hour")
            time_remaining = self._format_time_remaining(reset_at)
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_at=reset_at,
                cooldown_seconds=limits["cooldown_seconds"],
                message=f"You've reached your hourly message limit. Resets in {time_remaining}.",
            )

        # Check daily limit (free tier only)
        if limits["per_day"] and day_count >= limits["per_day"]:
            reset_at = self._get_reset_time(user_key, "day")
            time_remaining = self._format_time_remaining(reset_at)
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_at=reset_at,
                cooldown_seconds=None,
                message=f"You've reached your daily message limit. Upgrade to Premium for unlimited messages, or wait until tomorrow. Resets in {time_remaining}.",
            )

        # Calculate remaining (use the most restrictive limit)
        remaining_hour = (limits["per_hour"] - hour_count) if limits["per_hour"] else float('inf')
        remaining_day = (limits["per_day"] - day_count) if limits["per_day"] else float('inf')
        remaining = int(min(remaining_hour, remaining_day))

        return RateLimitResult(
            allowed=True,
            remaining=remaining,
            reset_at=None,
            cooldown_seconds=None,
            message=None,
        )

    async def record_message(self, user_id: UUID) -> None:
        """
        Record that a message was sent.
        Call this AFTER successful message processing.
        """
        user_key = str(user_id)

        # Increment all windows
        self._increment(user_key, "hour", ttl_seconds=3600)
        self._increment(user_key, "day", ttl_seconds=86400)
        self._increment(user_key, "burst", ttl_seconds=10)

        logger.debug(f"Recorded message for user {user_id}")

    async def get_rate_limit_status(
        self,
        user_id: UUID,
        subscription_status: str = "free",
    ) -> dict:
        """
        Get current rate limit status for display.

        Returns dict with current usage and limits.
        """
        limits = self.LIMITS.get(subscription_status, self.LIMITS["free"])
        user_key = str(user_id)

        hour_count = self._get_count(user_key, "hour")
        day_count = self._get_count(user_key, "day")

        hour_reset = self._get_reset_time(user_key, "hour")
        day_reset = self._get_reset_time(user_key, "day")

        return {
            "hourly": {
                "used": hour_count,
                "limit": limits["per_hour"],
                "remaining": max(0, (limits["per_hour"] or 0) - hour_count) if limits["per_hour"] else None,
                "resets_at": hour_reset.isoformat(),
            },
            "daily": {
                "used": day_count,
                "limit": limits["per_day"],
                "remaining": max(0, (limits["per_day"] or 0) - day_count) if limits["per_day"] else None,
                "resets_at": day_reset.isoformat(),
            },
            "subscription_status": subscription_status,
        }

    def cleanup_expired(self) -> int:
        """
        Clean up expired entries from memory.
        Call periodically to prevent memory bloat.
        Returns number of entries cleaned.
        """
        now = datetime.now(timezone.utc)
        cleaned = 0

        users_to_remove = []

        for user_id, windows in self._store.items():
            windows_to_remove = []

            for window, entry in windows.items():
                if now > entry["expires"]:
                    windows_to_remove.append(window)

            for window in windows_to_remove:
                del windows[window]
                cleaned += 1

            if not windows:
                users_to_remove.append(user_id)

        for user_id in users_to_remove:
            del self._store[user_id]

        if cleaned > 0:
            logger.debug(f"Cleaned {cleaned} expired rate limit entries")

        return cleaned
