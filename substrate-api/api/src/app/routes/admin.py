"""Admin API routes for analytics and dashboard."""
import logging
import os
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.deps import get_db
from app.dependencies import get_current_user_id

log = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/admin", tags=["Admin"])


# List of allowed admin emails (same pattern as studio)
# Default to kvkthecreator@gmail.com if env var not set
ADMIN_ALLOWED_EMAILS = os.getenv("STUDIO_ALLOWED_EMAILS", "kvkthecreator@gmail.com").split(",")
log.info(f"Admin allowed emails: {ADMIN_ALLOWED_EMAILS}")


def is_admin_email(email: str) -> bool:
    """Check if email is in the admin allowlist."""
    if not email:
        return False
    allowed = [e.lower().strip() for e in ADMIN_ALLOWED_EMAILS if e]
    return email.lower().strip() in allowed


# =============================================================================
# Response Models
# =============================================================================


class OverviewStats(BaseModel):
    total_users: int
    users_7d: int
    users_30d: int
    premium_users: int
    total_revenue_cents: int
    total_messages: int
    total_sessions: int


class SignupDay(BaseModel):
    date: str
    count: int


class UserEngagement(BaseModel):
    id: str
    display_name: str
    email: Optional[str] = None
    subscription_status: str
    spark_balance: int
    messages_sent_count: int
    flux_generations_used: int
    session_count: int
    engagement_count: int
    created_at: str
    last_active: Optional[str] = None
    signup_source: Optional[str] = None
    signup_campaign: Optional[str] = None
    signup_medium: Optional[str] = None
    signup_content: Optional[str] = None
    signup_landing_page: Optional[str] = None
    signup_referrer: Optional[str] = None


class Purchase(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    pack_name: str
    sparks_amount: int
    price_cents: int
    status: str
    created_at: str


class AdminStatsResponse(BaseModel):
    overview: OverviewStats
    signups_by_day: List[SignupDay]
    users: List[UserEngagement]
    purchases: List[Purchase]


# =============================================================================
# Helper: Verify Admin Access
# =============================================================================


async def verify_admin_access(request: Request, user_id: UUID, db) -> str:
    """Verify the requesting user has admin access. Returns email."""
    # Get user email from JWT claims (stored by auth middleware)
    jwt_payload = getattr(request.state, "jwt_payload", None)
    log.info(f"Admin access check - jwt_payload keys: {jwt_payload.keys() if jwt_payload else 'None'}")

    user_email = jwt_payload.get("email") if jwt_payload else None
    log.info(f"Admin access check - user_email: {user_email}, allowed: {ADMIN_ALLOWED_EMAILS}")

    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required - email not available in token"
        )

    if not is_admin_email(user_email):
        log.warning(f"Admin access denied for email: {user_email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user_email


# =============================================================================
# Admin Stats Endpoint
# =============================================================================


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    request: Request,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get comprehensive admin stats for the dashboard."""
    await verify_admin_access(request, user_id, db)

    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    # Overview stats - run queries in parallel conceptually (sequential for simplicity)
    overview_query = """
    SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE created_at > :seven_days_ago) as users_7d,
        (SELECT COUNT(*) FROM users WHERE created_at > :thirty_days_ago) as users_30d,
        (SELECT COUNT(*) FROM users WHERE subscription_status = 'premium') as premium_users,
        (SELECT COALESCE(SUM(price_cents), 0) FROM topup_purchases WHERE status = 'completed') as total_revenue_cents,
        (SELECT COALESCE(SUM(messages_sent_count), 0) FROM users) as total_messages,
        (SELECT COUNT(*) FROM sessions) as total_sessions
    """
    overview_row = await db.fetch_one(overview_query, {
        "seven_days_ago": seven_days_ago,
        "thirty_days_ago": thirty_days_ago
    })

    overview = OverviewStats(
        total_users=overview_row["total_users"],
        users_7d=overview_row["users_7d"],
        users_30d=overview_row["users_30d"],
        premium_users=overview_row["premium_users"],
        total_revenue_cents=overview_row["total_revenue_cents"],
        total_messages=overview_row["total_messages"],
        total_sessions=overview_row["total_sessions"],
    )

    # Signups by day (last 30 days)
    signups_query = """
    SELECT
        DATE(created_at) as signup_date,
        COUNT(*) as count
    FROM users
    WHERE created_at > :thirty_days_ago
    GROUP BY DATE(created_at)
    ORDER BY signup_date ASC
    """
    signups_rows = await db.fetch_all(signups_query, {"thirty_days_ago": thirty_days_ago})
    signups_by_day = [
        SignupDay(date=str(row["signup_date"]), count=row["count"])
        for row in signups_rows
    ]

    # User engagement (all users with metrics)
    users_query = """
    SELECT
        u.id,
        u.display_name,
        u.subscription_status,
        u.spark_balance,
        u.messages_sent_count,
        u.flux_generations_used,
        u.created_at,
        u.signup_source,
        u.signup_campaign,
        u.signup_medium,
        u.signup_content,
        u.signup_landing_page,
        u.signup_referrer,
        (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as session_count,
        (SELECT COUNT(*) FROM engagements WHERE user_id = u.id) as engagement_count,
        (SELECT MAX(last_interaction_at) FROM engagements WHERE user_id = u.id) as last_active
    FROM users u
    ORDER BY u.created_at DESC
    LIMIT 100
    """
    users_rows = await db.fetch_all(users_query)
    users = [
        UserEngagement(
            id=str(row["id"]),
            display_name=row["display_name"] or "User",
            subscription_status=row["subscription_status"] or "free",
            spark_balance=row["spark_balance"] or 0,
            messages_sent_count=row["messages_sent_count"] or 0,
            flux_generations_used=row["flux_generations_used"] or 0,
            session_count=row["session_count"],
            engagement_count=row["engagement_count"],
            created_at=row["created_at"].isoformat() if row["created_at"] else "",
            last_active=row["last_active"].isoformat() if row["last_active"] else None,
            signup_source=row["signup_source"],
            signup_campaign=row["signup_campaign"],
            signup_medium=row["signup_medium"],
            signup_content=row["signup_content"],
            signup_landing_page=row["signup_landing_page"],
            signup_referrer=row["signup_referrer"],
        )
        for row in users_rows
    ]

    # Recent purchases
    purchases_query = """
    SELECT
        p.id,
        p.user_id,
        u.display_name as user_name,
        p.pack_name,
        p.sparks_amount,
        p.price_cents,
        p.status,
        p.created_at
    FROM topup_purchases p
    LEFT JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 20
    """
    purchases_rows = await db.fetch_all(purchases_query)
    purchases = [
        Purchase(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            user_name=row["user_name"] or "User",
            pack_name=row["pack_name"],
            sparks_amount=row["sparks_amount"],
            price_cents=row["price_cents"],
            status=row["status"],
            created_at=row["created_at"].isoformat() if row["created_at"] else "",
        )
        for row in purchases_rows
    ]

    return AdminStatsResponse(
        overview=overview,
        signups_by_day=signups_by_day,
        users=users,
        purchases=purchases,
    )
