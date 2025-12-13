"""Usage tracking service for metered features."""
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from dateutil.relativedelta import relativedelta

from app.deps import get_db
from app.models.usage import UsageStats, QuotaCheckResult

logger = logging.getLogger(__name__)

# Quota constants
FLUX_QUOTA_FREE = 5
FLUX_QUOTA_PREMIUM = 50


class UsageService:
    """Handles usage tracking and quota enforcement."""

    _instance: Optional["UsageService"] = None

    @classmethod
    def get_instance(cls) -> "UsageService":
        """Get singleton instance of UsageService."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_flux_quota(self, subscription_status: str) -> int:
        """Get Flux quota based on subscription status."""
        if subscription_status == "premium":
            return FLUX_QUOTA_PREMIUM
        return FLUX_QUOTA_FREE

    async def get_usage_stats(self, user_id: str) -> UsageStats:
        """Get current usage statistics for a user."""
        db = await get_db()

        row = await db.fetch_one(
            """
            SELECT
                subscription_status,
                flux_generations_used,
                flux_generations_reset_at,
                messages_sent_count,
                messages_reset_at
            FROM users
            WHERE id = :user_id
            """,
            {"user_id": user_id},
        )

        if not row:
            raise ValueError(f"User {user_id} not found")

        subscription_status = row["subscription_status"] or "free"
        quota = self._get_flux_quota(subscription_status)
        flux_used = row["flux_generations_used"] or 0

        return UsageStats(
            flux_used=flux_used,
            flux_quota=quota,
            flux_remaining=max(0, quota - flux_used),
            flux_resets_at=row["flux_generations_reset_at"] or datetime.now(timezone.utc),
            messages_sent=row["messages_sent_count"] or 0,
            messages_resets_at=row["messages_reset_at"] or datetime.now(timezone.utc),
            subscription_status=subscription_status,
        )

    async def check_flux_quota(self, user_id: str) -> QuotaCheckResult:
        """
        Check if user can generate a Flux image.
        Also handles automatic counter reset if billing period has passed.
        """
        # Check if reset is needed first
        await self._maybe_reset_flux_counter(user_id)

        # Get current stats
        stats = await self.get_usage_stats(user_id)

        allowed = stats.flux_remaining > 0

        message = None
        if not allowed:
            if stats.subscription_status == "free":
                message = (
                    f"You've used all {stats.flux_quota} free image generations this month. "
                    f"Upgrade to Premium for {FLUX_QUOTA_PREMIUM} generations/month."
                )
            else:
                message = (
                    f"You've reached your monthly limit of {stats.flux_quota} image generations. "
                    "Your quota resets on your next billing date."
                )

        return QuotaCheckResult(
            allowed=allowed,
            current_usage=stats.flux_used,
            quota=stats.flux_quota,
            remaining=stats.flux_remaining,
            message=message,
        )

    async def increment_flux_usage(
        self,
        user_id: str,
        character_id: Optional[str] = None,
        episode_id: Optional[str] = None,
        model_used: Optional[str] = None,
    ) -> UsageStats:
        """
        Increment Flux usage counter and log event.
        Call this AFTER successful image generation.
        """
        db = await get_db()

        # Increment counter
        await db.execute(
            """
            UPDATE users
            SET flux_generations_used = COALESCE(flux_generations_used, 0) + 1,
                updated_at = NOW()
            WHERE id = :user_id
            """,
            {"user_id": user_id},
        )

        # Log event for analytics
        metadata = {
            "model_used": model_used,
        }
        if character_id:
            metadata["character_id"] = character_id
        if episode_id:
            metadata["episode_id"] = episode_id

        await db.execute(
            """
            INSERT INTO usage_events (user_id, event_type, character_id, episode_id, metadata)
            VALUES (:user_id, 'flux_generation', :character_id, :episode_id, :metadata)
            """,
            {
                "user_id": user_id,
                "character_id": character_id,
                "episode_id": episode_id,
                "metadata": json.dumps(metadata),
            },
        )

        logger.info(f"Flux usage incremented for user {user_id}")

        return await self.get_usage_stats(user_id)

    async def increment_message_count(
        self,
        user_id: str,
        character_id: Optional[str] = None,
        episode_id: Optional[str] = None,
    ) -> None:
        """
        Increment message counter (tracking only, no enforcement).
        This is fire-and-forget - doesn't block the chat flow.
        """
        db = await get_db()

        try:
            # Increment counter
            await db.execute(
                """
                UPDATE users
                SET messages_sent_count = COALESCE(messages_sent_count, 0) + 1,
                    updated_at = NOW()
                WHERE id = :user_id
                """,
                {"user_id": user_id},
            )

            # Log event for analytics
            metadata = {}
            if character_id:
                metadata["character_id"] = character_id
            if episode_id:
                metadata["episode_id"] = episode_id

            await db.execute(
                """
                INSERT INTO usage_events (user_id, event_type, character_id, episode_id, metadata)
                VALUES (:user_id, 'message_sent', :character_id, :episode_id, :metadata)
                """,
                {
                    "user_id": user_id,
                    "character_id": character_id,
                    "episode_id": episode_id,
                    "metadata": json.dumps(metadata),
                },
            )
        except Exception as e:
            # Don't fail the chat if tracking fails
            logger.warning(f"Failed to track message for user {user_id}: {e}")

    async def _maybe_reset_flux_counter(self, user_id: str) -> bool:
        """
        Reset Flux counter if billing period has passed.
        Returns True if counter was reset.
        """
        db = await get_db()
        now = datetime.now(timezone.utc)

        # Fetch current state
        row = await db.fetch_one(
            """
            SELECT
                subscription_status,
                flux_generations_reset_at,
                subscription_expires_at
            FROM users
            WHERE id = :user_id
            """,
            {"user_id": user_id},
        )

        if not row:
            return False

        subscription_status = row["subscription_status"] or "free"
        reset_at = row["flux_generations_reset_at"]

        if not reset_at:
            # No reset date set, initialize it
            await db.execute(
                """
                UPDATE users
                SET flux_generations_reset_at = NOW()
                WHERE id = :user_id
                """,
                {"user_id": user_id},
            )
            return False

        # Ensure reset_at is timezone-aware
        if reset_at.tzinfo is None:
            reset_at = reset_at.replace(tzinfo=timezone.utc)

        should_reset = False

        if subscription_status == "premium":
            # Premium users: reset 1 month after last reset
            next_reset = reset_at + relativedelta(months=1)
            if now >= next_reset:
                should_reset = True
        else:
            # Free users: reset on 1st of each month
            current_month_start = now.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            if reset_at < current_month_start:
                should_reset = True

        if should_reset:
            await db.execute(
                """
                UPDATE users
                SET flux_generations_used = 0,
                    flux_generations_reset_at = NOW(),
                    updated_at = NOW()
                WHERE id = :user_id
                """,
                {"user_id": user_id},
            )
            logger.info(f"Reset Flux counter for user {user_id}")
            return True

        return False

    async def reset_on_subscription_change(self, user_id: str) -> None:
        """
        Reset counters when subscription status changes (upgrade/downgrade).
        Call this from subscription webhook handler.
        """
        db = await get_db()

        await db.execute(
            """
            UPDATE users
            SET flux_generations_used = 0,
                flux_generations_reset_at = NOW(),
                updated_at = NOW()
            WHERE id = :user_id
            """,
            {"user_id": user_id},
        )

        logger.info(f"Reset usage counters for user {user_id} on subscription change")

    async def get_usage_history(
        self,
        user_id: str,
        event_type: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        """
        Get usage history for analytics/debugging.
        """
        db = await get_db()

        if event_type:
            rows = await db.fetch_all(
                """
                SELECT id, event_type, character_id, episode_id, metadata, created_at
                FROM usage_events
                WHERE user_id = :user_id AND event_type = :event_type
                ORDER BY created_at DESC
                LIMIT :limit
                """,
                {"user_id": user_id, "event_type": event_type, "limit": limit},
            )
        else:
            rows = await db.fetch_all(
                """
                SELECT id, event_type, character_id, episode_id, metadata, created_at
                FROM usage_events
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT :limit
                """,
                {"user_id": user_id, "limit": limit},
            )

        return [dict(row) for row in rows]
