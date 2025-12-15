"""Credits (Sparks) service for virtual currency management.

Handles spark balance tracking, spending, and granting.
See docs/monetization/CREDITS_SYSTEM_PROPOSAL.md for design rationale.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.deps import get_db

logger = logging.getLogger(__name__)


class TransactionType(str, Enum):
    """Types of spark transactions."""
    SUBSCRIPTION_GRANT = "subscription_grant"
    TOPUP_PURCHASE = "topup_purchase"
    GENERATION_SPEND = "generation_spend"
    REFUND = "refund"
    BONUS = "bonus"
    EXPIRY = "expiry"
    ADMIN_ADJUSTMENT = "admin_adjustment"


class SparkCheckResult(BaseModel):
    """Result of checking if user can afford a feature."""
    allowed: bool
    balance: int
    cost: int
    balance_after: int
    message: Optional[str] = None


class SparkTransaction(BaseModel):
    """A spark transaction record."""
    id: UUID
    user_id: UUID
    amount: int
    balance_after: int
    transaction_type: str
    description: Optional[str]
    created_at: datetime


class InsufficientSparksError(Exception):
    """Raised when user doesn't have enough sparks."""
    def __init__(self, message: str, balance: int, cost: int):
        super().__init__(message)
        self.message = message
        self.balance = balance
        self.cost = cost


class CreditsService:
    """Service for managing user spark credits."""

    _instance: Optional["CreditsService"] = None

    @classmethod
    def get_instance(cls) -> "CreditsService":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def get_balance(self, user_id: UUID) -> int:
        """Get current spark balance for user."""
        db = await get_db()
        row = await db.fetch_one(
            "SELECT spark_balance FROM users WHERE id = :user_id",
            {"user_id": str(user_id)},
        )
        return row["spark_balance"] if row else 0

    async def get_feature_cost(self, feature_key: str) -> int:
        """Get spark cost for a feature."""
        db = await get_db()
        row = await db.fetch_one(
            """
            SELECT spark_cost FROM credit_costs
            WHERE feature_key = :feature_key AND is_active = true
            """,
            {"feature_key": feature_key},
        )
        if not row:
            logger.warning(f"Unknown feature key: {feature_key}, defaulting to 0")
            return 0
        return row["spark_cost"]

    async def check_balance(self, user_id: UUID, feature_key: str) -> SparkCheckResult:
        """Check if user has enough sparks for a feature."""
        balance = await self.get_balance(user_id)
        cost = await self.get_feature_cost(feature_key)

        # Cost of 0 means free (e.g., chat messages)
        if cost == 0:
            return SparkCheckResult(
                allowed=True,
                balance=balance,
                cost=0,
                balance_after=balance,
                message=None,
            )

        allowed = balance >= cost
        return SparkCheckResult(
            allowed=allowed,
            balance=balance,
            cost=cost,
            balance_after=balance - cost if allowed else balance,
            message=None if allowed else f"Insufficient Sparks. You have {balance}, need {cost}.",
        )

    async def spend(
        self,
        user_id: UUID,
        feature_key: str,
        reference_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> SparkTransaction:
        """
        Spend sparks for a feature.

        Args:
            user_id: User ID
            feature_key: Feature being used (e.g., 'flux_generation')
            reference_id: Optional reference to the generated item
            metadata: Optional additional context

        Returns:
            SparkTransaction record

        Raises:
            InsufficientSparksError: If user doesn't have enough sparks
        """
        check = await self.check_balance(user_id, feature_key)

        # Free features don't create transactions
        if check.cost == 0:
            return SparkTransaction(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                user_id=user_id,
                amount=0,
                balance_after=check.balance,
                transaction_type=TransactionType.GENERATION_SPEND,
                description=f"Free feature: {feature_key}",
                created_at=datetime.now(timezone.utc),
            )

        if not check.allowed:
            raise InsufficientSparksError(
                check.message or "Insufficient sparks",
                balance=check.balance,
                cost=check.cost,
            )

        db = await get_db()
        cost = check.cost
        new_balance = check.balance_after

        # Update user balance
        await db.execute(
            """
            UPDATE users
            SET spark_balance = :new_balance,
                lifetime_sparks_spent = COALESCE(lifetime_sparks_spent, 0) + :cost,
                updated_at = NOW()
            WHERE id = :user_id
            """,
            {"user_id": str(user_id), "new_balance": new_balance, "cost": cost},
        )

        # Insert transaction record
        tx_row = await db.fetch_one(
            """
            INSERT INTO credit_transactions (
                user_id, amount, balance_after, transaction_type,
                reference_type, reference_id, description, metadata
            )
            VALUES (
                :user_id, :amount, :balance_after, :transaction_type,
                :reference_type, :reference_id, :description, :metadata
            )
            RETURNING id, user_id, amount, balance_after, transaction_type, description, created_at
            """,
            {
                "user_id": str(user_id),
                "amount": -cost,
                "balance_after": new_balance,
                "transaction_type": TransactionType.GENERATION_SPEND,
                "reference_type": "generation",
                "reference_id": reference_id,
                "description": f"Spent {cost} Spark(s) on {feature_key}",
                "metadata": json.dumps(metadata or {}),
            },
        )

        logger.info(f"User {user_id} spent {cost} sparks on {feature_key}, balance: {new_balance}")

        return SparkTransaction(
            id=UUID(tx_row["id"]),
            user_id=UUID(tx_row["user_id"]),
            amount=tx_row["amount"],
            balance_after=tx_row["balance_after"],
            transaction_type=tx_row["transaction_type"],
            description=tx_row["description"],
            created_at=tx_row["created_at"],
        )

    async def grant(
        self,
        user_id: UUID,
        amount: int,
        transaction_type: TransactionType,
        description: str,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        metadata: Optional[dict] = None,
    ) -> SparkTransaction:
        """
        Grant sparks to a user.

        Args:
            user_id: User ID
            amount: Number of sparks to grant (positive)
            transaction_type: Type of grant (subscription, topup, bonus, etc.)
            description: Human-readable description
            reference_type: Type of reference (subscription, purchase, etc.)
            reference_id: ID of the reference entity
            expires_at: Optional expiry time for granted sparks
            metadata: Optional additional context

        Returns:
            SparkTransaction record
        """
        if amount <= 0:
            raise ValueError("Grant amount must be positive")

        db = await get_db()

        # Get current balance
        current_balance = await self.get_balance(user_id)
        new_balance = current_balance + amount

        # Update user balance
        await db.execute(
            """
            UPDATE users
            SET spark_balance = :new_balance,
                lifetime_sparks_earned = COALESCE(lifetime_sparks_earned, 0) + :amount,
                updated_at = NOW()
            WHERE id = :user_id
            """,
            {"user_id": str(user_id), "new_balance": new_balance, "amount": amount},
        )

        # Insert transaction record
        tx_row = await db.fetch_one(
            """
            INSERT INTO credit_transactions (
                user_id, amount, balance_after, transaction_type,
                reference_type, reference_id, description, metadata, expires_at
            )
            VALUES (
                :user_id, :amount, :balance_after, :transaction_type,
                :reference_type, :reference_id, :description, :metadata, :expires_at
            )
            RETURNING id, user_id, amount, balance_after, transaction_type, description, created_at
            """,
            {
                "user_id": str(user_id),
                "amount": amount,
                "balance_after": new_balance,
                "transaction_type": transaction_type,
                "reference_type": reference_type,
                "reference_id": reference_id,
                "description": description,
                "metadata": json.dumps(metadata or {}),
                "expires_at": expires_at.isoformat() if expires_at else None,
            },
        )

        logger.info(f"Granted {amount} sparks to user {user_id}: {description}")

        return SparkTransaction(
            id=UUID(tx_row["id"]),
            user_id=UUID(tx_row["user_id"]),
            amount=tx_row["amount"],
            balance_after=tx_row["balance_after"],
            transaction_type=tx_row["transaction_type"],
            description=tx_row["description"],
            created_at=tx_row["created_at"],
        )

    async def grant_subscription_sparks(
        self,
        user_id: UUID,
        subscription_id: str,
        is_premium: bool,
    ) -> SparkTransaction:
        """
        Grant monthly subscription sparks.

        Args:
            user_id: User ID
            subscription_id: Lemon Squeezy subscription ID
            is_premium: Whether this is a premium subscription

        Returns:
            SparkTransaction record
        """
        amount = 100 if is_premium else 5
        tier = "Premium" if is_premium else "Free"

        return await self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.SUBSCRIPTION_GRANT,
            description=f"Monthly {tier} Sparks ({amount})",
            reference_type="subscription",
            reference_id=subscription_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=31),
        )

    async def grant_topup_sparks(
        self,
        user_id: UUID,
        pack_name: str,
        amount: int,
        order_id: str,
    ) -> SparkTransaction:
        """
        Grant sparks from a top-up purchase.

        Args:
            user_id: User ID
            pack_name: Name of the pack purchased
            amount: Number of sparks
            order_id: Lemon Squeezy order ID

        Returns:
            SparkTransaction record
        """
        return await self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.TOPUP_PURCHASE,
            description=f"Purchased {pack_name} pack ({amount} Sparks)",
            reference_type="purchase",
            reference_id=order_id,
            expires_at=None,  # Purchased sparks don't expire
        )

    async def get_transaction_history(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[SparkTransaction]:
        """
        Get user's transaction history.

        Args:
            user_id: User ID
            limit: Max transactions to return
            offset: Pagination offset

        Returns:
            List of SparkTransaction records
        """
        db = await get_db()
        rows = await db.fetch_all(
            """
            SELECT id, user_id, amount, balance_after, transaction_type, description, created_at
            FROM credit_transactions
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """,
            {"user_id": str(user_id), "limit": limit, "offset": offset},
        )

        return [
            SparkTransaction(
                id=UUID(row["id"]),
                user_id=UUID(row["user_id"]),
                amount=row["amount"],
                balance_after=row["balance_after"],
                transaction_type=row["transaction_type"],
                description=row["description"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    async def get_all_feature_costs(self) -> list[dict]:
        """Get all active feature costs for display."""
        db = await get_db()
        rows = await db.fetch_all(
            """
            SELECT feature_key, display_name, spark_cost, description, premium_only
            FROM credit_costs
            WHERE is_active = true
            ORDER BY spark_cost DESC, display_name
            """
        )
        return [dict(row) for row in rows]

    async def get_user_credits_stats(self, user_id: UUID) -> dict:
        """Get comprehensive credits stats for a user."""
        db = await get_db()
        row = await db.fetch_one(
            """
            SELECT
                spark_balance,
                lifetime_sparks_earned,
                lifetime_sparks_spent,
                subscription_status
            FROM users
            WHERE id = :user_id
            """,
            {"user_id": str(user_id)},
        )

        if not row:
            return {
                "balance": 0,
                "lifetime_earned": 0,
                "lifetime_spent": 0,
                "subscription_status": "free",
            }

        return {
            "balance": row["spark_balance"] or 0,
            "lifetime_earned": row["lifetime_sparks_earned"] or 0,
            "lifetime_spent": row["lifetime_sparks_spent"] or 0,
            "subscription_status": row["subscription_status"] or "free",
        }
