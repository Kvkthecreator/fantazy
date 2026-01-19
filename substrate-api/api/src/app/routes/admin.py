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
    # Guest session stats
    guest_sessions_total: int = 0
    guest_sessions_24h: int = 0
    guest_sessions_converted: int = 0


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


class GuestSession(BaseModel):
    id: str
    guest_session_id: str
    character_name: str
    message_count: int
    created_at: str
    ip_hash: Optional[str] = None
    converted: bool = False
    converted_at: Optional[str] = None


class AdminStatsResponse(BaseModel):
    overview: OverviewStats
    signups_by_day: List[SignupDay]
    users: List[UserEngagement]
    purchases: List[Purchase]
    guest_sessions: List[GuestSession] = []


# =============================================================================
# Activation Funnel Models
# =============================================================================


class FunnelStep(BaseModel):
    step: str
    count: int
    percentage: float  # Percentage of total signups


class CohortRetention(BaseModel):
    cohort_date: str  # Week start date
    cohort_size: int
    day_1: float  # % returned day 1
    day_7: float  # % returned within 7 days
    day_14: float  # % returned within 14 days
    day_30: float  # % returned within 30 days


class MessageDistribution(BaseModel):
    bucket: str  # e.g., "0", "1-5", "6-10", "11-25", "26-50", "51+"
    count: int
    percentage: float


class DropoffPoint(BaseModel):
    description: str
    user_count: int
    example_users: List[str] = []  # Display names for manual follow-up


class SourceActivation(BaseModel):
    source: str
    campaign: Optional[str]
    signups: int
    activated: int  # Users with at least 1 message
    engaged: int  # Users with 5+ messages
    retained: int  # Users who returned after day 1
    activation_rate: float
    engagement_rate: float


class ActivationFunnelResponse(BaseModel):
    funnel: List[FunnelStep]
    message_distribution: List[MessageDistribution]
    dropoff_analysis: List[DropoffPoint]
    source_performance: List[SourceActivation]
    cohort_retention: List[CohortRetention]
    insights: List[str]  # Auto-generated insights


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
    one_day_ago = now - timedelta(days=1)
    overview_query = """
    SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE created_at > :seven_days_ago) as users_7d,
        (SELECT COUNT(*) FROM users WHERE created_at > :thirty_days_ago) as users_30d,
        (SELECT COUNT(*) FROM users WHERE subscription_status = 'premium') as premium_users,
        (SELECT COALESCE(SUM(price_cents), 0) FROM topup_purchases WHERE status = 'completed') as total_revenue_cents,
        (SELECT COALESCE(SUM(messages_sent_count), 0) FROM users) as total_messages,
        (SELECT COUNT(*) FROM sessions) as total_sessions,
        (SELECT COUNT(*) FROM sessions WHERE guest_session_id IS NOT NULL) as guest_sessions_total,
        (SELECT COUNT(*) FROM sessions WHERE guest_session_id IS NOT NULL AND guest_created_at > :one_day_ago) as guest_sessions_24h,
        (SELECT COUNT(*) FROM sessions WHERE guest_session_id IS NOT NULL AND guest_converted_at IS NOT NULL) as guest_sessions_converted
    """
    overview_row = await db.fetch_one(overview_query, {
        "seven_days_ago": seven_days_ago,
        "thirty_days_ago": thirty_days_ago,
        "one_day_ago": one_day_ago,
    })

    overview = OverviewStats(
        total_users=overview_row["total_users"],
        users_7d=overview_row["users_7d"],
        users_30d=overview_row["users_30d"],
        premium_users=overview_row["premium_users"],
        total_revenue_cents=overview_row["total_revenue_cents"],
        total_messages=overview_row["total_messages"],
        total_sessions=overview_row["total_sessions"],
        guest_sessions_total=overview_row["guest_sessions_total"] or 0,
        guest_sessions_24h=overview_row["guest_sessions_24h"] or 0,
        guest_sessions_converted=overview_row["guest_sessions_converted"] or 0,
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

    # Guest sessions (recent)
    guest_sessions_query = """
    SELECT
        s.id,
        s.guest_session_id,
        s.guest_created_at,
        s.guest_ip_hash,
        s.guest_converted_at,
        c.name as character_name,
        (SELECT COUNT(*) FROM messages WHERE episode_id = s.id) as message_count
    FROM sessions s
    LEFT JOIN characters c ON s.character_id = c.id
    WHERE s.guest_session_id IS NOT NULL
    ORDER BY s.guest_created_at DESC
    LIMIT 50
    """
    guest_rows = await db.fetch_all(guest_sessions_query)
    guest_sessions = [
        GuestSession(
            id=str(row["id"]),
            guest_session_id=row["guest_session_id"] or "",
            character_name=row["character_name"] or "Unknown",
            message_count=row["message_count"] or 0,
            created_at=row["guest_created_at"].isoformat() if row["guest_created_at"] else "",
            ip_hash=row["guest_ip_hash"][:8] + "..." if row["guest_ip_hash"] else None,  # Truncate for privacy
            converted=row["guest_converted_at"] is not None,
            converted_at=row["guest_converted_at"].isoformat() if row["guest_converted_at"] else None,
        )
        for row in guest_rows
    ]

    return AdminStatsResponse(
        overview=overview,
        signups_by_day=signups_by_day,
        users=users,
        purchases=purchases,
        guest_sessions=guest_sessions,
    )


# =============================================================================
# Activation Funnel Endpoint
# =============================================================================


@router.get("/funnel", response_model=ActivationFunnelResponse)
async def get_activation_funnel(
    request: Request,
    days: int = 30,  # Look back period
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get detailed activation funnel analysis."""
    await verify_admin_access(request, user_id, db)

    now = datetime.utcnow()
    lookback = now - timedelta(days=days)

    # ==========================================================================
    # 1. FUNNEL STEPS
    # ==========================================================================
    funnel_query = """
    WITH user_metrics AS (
        SELECT
            u.id,
            u.messages_sent_count,
            (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as session_count,
            (SELECT COUNT(*) FROM sessions WHERE user_id = u.id AND episode_number = 0) as ep0_sessions,
            (SELECT COUNT(*) FROM sessions WHERE user_id = u.id AND episode_number > 0) as ep1_plus_sessions,
            (SELECT COUNT(*) FROM engagements WHERE user_id = u.id) as characters_engaged
        FROM users u
        WHERE u.created_at > :lookback
    )
    SELECT
        COUNT(*) as total_signups,
        COUNT(*) FILTER (WHERE session_count > 0) as started_any_session,
        COUNT(*) FILTER (WHERE ep0_sessions > 0) as started_ep0,
        COUNT(*) FILTER (WHERE messages_sent_count > 0) as sent_first_message,
        COUNT(*) FILTER (WHERE messages_sent_count >= 5) as sent_5_messages,
        COUNT(*) FILTER (WHERE messages_sent_count >= 10) as sent_10_messages,
        COUNT(*) FILTER (WHERE messages_sent_count >= 25) as sent_25_messages,
        COUNT(*) FILTER (WHERE ep1_plus_sessions > 0) as started_ep1_plus,
        COUNT(*) FILTER (WHERE characters_engaged >= 2) as engaged_2_plus_chars
    FROM user_metrics
    """
    funnel_row = await db.fetch_one(funnel_query, {"lookback": lookback})

    total = funnel_row["total_signups"] or 1  # Avoid division by zero
    funnel = [
        FunnelStep(step="Signed up", count=funnel_row["total_signups"], percentage=100.0),
        FunnelStep(step="Started any session", count=funnel_row["started_any_session"], percentage=round(funnel_row["started_any_session"] / total * 100, 1)),
        FunnelStep(step="Started Episode 0", count=funnel_row["started_ep0"], percentage=round(funnel_row["started_ep0"] / total * 100, 1)),
        FunnelStep(step="Sent first message", count=funnel_row["sent_first_message"], percentage=round(funnel_row["sent_first_message"] / total * 100, 1)),
        FunnelStep(step="Sent 5+ messages", count=funnel_row["sent_5_messages"], percentage=round(funnel_row["sent_5_messages"] / total * 100, 1)),
        FunnelStep(step="Sent 10+ messages", count=funnel_row["sent_10_messages"], percentage=round(funnel_row["sent_10_messages"] / total * 100, 1)),
        FunnelStep(step="Sent 25+ messages", count=funnel_row["sent_25_messages"], percentage=round(funnel_row["sent_25_messages"] / total * 100, 1)),
        FunnelStep(step="Started Episode 1+", count=funnel_row["started_ep1_plus"], percentage=round(funnel_row["started_ep1_plus"] / total * 100, 1)),
        FunnelStep(step="Engaged 2+ characters", count=funnel_row["engaged_2_plus_chars"], percentage=round(funnel_row["engaged_2_plus_chars"] / total * 100, 1)),
    ]

    # ==========================================================================
    # 2. MESSAGE DISTRIBUTION
    # ==========================================================================
    distribution_query = """
    WITH bucketed AS (
        SELECT
            CASE
                WHEN messages_sent_count = 0 THEN '0'
                WHEN messages_sent_count BETWEEN 1 AND 5 THEN '1-5'
                WHEN messages_sent_count BETWEEN 6 AND 10 THEN '6-10'
                WHEN messages_sent_count BETWEEN 11 AND 25 THEN '11-25'
                WHEN messages_sent_count BETWEEN 26 AND 50 THEN '26-50'
                WHEN messages_sent_count BETWEEN 51 AND 100 THEN '51-100'
                ELSE '100+'
            END as bucket,
            CASE
                WHEN messages_sent_count = 0 THEN 1
                WHEN messages_sent_count BETWEEN 1 AND 5 THEN 2
                WHEN messages_sent_count BETWEEN 6 AND 10 THEN 3
                WHEN messages_sent_count BETWEEN 11 AND 25 THEN 4
                WHEN messages_sent_count BETWEEN 26 AND 50 THEN 5
                WHEN messages_sent_count BETWEEN 51 AND 100 THEN 6
                ELSE 7
            END as sort_order
        FROM users
        WHERE created_at > :lookback
    )
    SELECT bucket, COUNT(*) as count
    FROM bucketed
    GROUP BY bucket, sort_order
    ORDER BY sort_order
    """
    dist_rows = await db.fetch_all(distribution_query, {"lookback": lookback})
    total_for_dist = sum(row["count"] for row in dist_rows) or 1
    message_distribution = [
        MessageDistribution(
            bucket=row["bucket"],
            count=row["count"],
            percentage=round(row["count"] / total_for_dist * 100, 1)
        )
        for row in dist_rows
    ]

    # ==========================================================================
    # 3. DROPOFF ANALYSIS
    # ==========================================================================
    dropoff_query = """
    WITH user_journey AS (
        SELECT
            u.id,
            u.display_name,
            u.messages_sent_count,
            (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as session_count,
            (SELECT COUNT(*) FROM sessions WHERE user_id = u.id AND episode_number = 0) as ep0_count
        FROM users u
        WHERE u.created_at > :lookback
    )
    SELECT
        'Signed up but never started a session' as description,
        COUNT(*) as user_count,
        array_agg(display_name) FILTER (WHERE display_name IS NOT NULL) as example_names
    FROM user_journey WHERE session_count = 0

    UNION ALL

    SELECT
        'Started session but sent 0 messages' as description,
        COUNT(*) as user_count,
        array_agg(display_name) FILTER (WHERE display_name IS NOT NULL) as example_names
    FROM user_journey WHERE session_count > 0 AND messages_sent_count = 0

    UNION ALL

    SELECT
        'Sent 1-3 messages then stopped' as description,
        COUNT(*) as user_count,
        array_agg(display_name) FILTER (WHERE display_name IS NOT NULL) as example_names
    FROM user_journey WHERE messages_sent_count BETWEEN 1 AND 3

    UNION ALL

    SELECT
        'Sent 4-10 messages then stopped' as description,
        COUNT(*) as user_count,
        array_agg(display_name) FILTER (WHERE display_name IS NOT NULL) as example_names
    FROM user_journey WHERE messages_sent_count BETWEEN 4 AND 10
    """
    dropoff_rows = await db.fetch_all(dropoff_query, {"lookback": lookback})
    dropoff_analysis = [
        DropoffPoint(
            description=row["description"],
            user_count=row["user_count"],
            example_users=(row["example_names"] or [])[:5]  # Limit to 5 examples
        )
        for row in dropoff_rows
    ]

    # ==========================================================================
    # 4. SOURCE PERFORMANCE
    # ==========================================================================
    source_query = """
    WITH source_metrics AS (
        SELECT
            COALESCE(u.signup_source, 'direct') as source,
            u.signup_campaign as campaign,
            u.id,
            u.messages_sent_count,
            u.created_at,
            (SELECT MAX(last_interaction_at) FROM engagements WHERE user_id = u.id) as last_active
        FROM users u
        WHERE u.created_at > :lookback
    )
    SELECT
        source,
        campaign,
        COUNT(*) as signups,
        COUNT(*) FILTER (WHERE messages_sent_count > 0) as activated,
        COUNT(*) FILTER (WHERE messages_sent_count >= 5) as engaged,
        COUNT(*) FILTER (WHERE last_active IS NOT NULL AND last_active > created_at + interval '1 day') as retained
    FROM source_metrics
    GROUP BY source, campaign
    ORDER BY signups DESC
    LIMIT 20
    """
    source_rows = await db.fetch_all(source_query, {"lookback": lookback})
    source_performance = [
        SourceActivation(
            source=row["source"],
            campaign=row["campaign"],
            signups=row["signups"],
            activated=row["activated"],
            engaged=row["engaged"],
            retained=row["retained"],
            activation_rate=round(row["activated"] / row["signups"] * 100, 1) if row["signups"] > 0 else 0,
            engagement_rate=round(row["engaged"] / row["signups"] * 100, 1) if row["signups"] > 0 else 0,
        )
        for row in source_rows
    ]

    # ==========================================================================
    # 5. COHORT RETENTION (Weekly cohorts)
    # ==========================================================================
    cohort_query = """
    WITH weekly_cohorts AS (
        SELECT
            u.id,
            DATE_TRUNC('week', u.created_at) as cohort_week,
            u.created_at as signup_date,
            (SELECT MIN(m.created_at) FROM messages m
             JOIN sessions s ON m.episode_id = s.id
             WHERE s.user_id = u.id) as first_message_at,
            (SELECT MAX(last_interaction_at) FROM engagements WHERE user_id = u.id) as last_active
        FROM users u
        WHERE u.created_at > :lookback
    )
    SELECT
        cohort_week,
        COUNT(*) as cohort_size,
        COUNT(*) FILTER (WHERE last_active > signup_date + interval '1 day') as returned_day_1,
        COUNT(*) FILTER (WHERE last_active > signup_date + interval '7 days') as returned_day_7,
        COUNT(*) FILTER (WHERE last_active > signup_date + interval '14 days') as returned_day_14,
        COUNT(*) FILTER (WHERE last_active > signup_date + interval '30 days') as returned_day_30
    FROM weekly_cohorts
    GROUP BY cohort_week
    ORDER BY cohort_week DESC
    LIMIT 8
    """
    cohort_rows = await db.fetch_all(cohort_query, {"lookback": lookback})
    cohort_retention = [
        CohortRetention(
            cohort_date=str(row["cohort_week"].date()) if row["cohort_week"] else "",
            cohort_size=row["cohort_size"],
            day_1=round(row["returned_day_1"] / row["cohort_size"] * 100, 1) if row["cohort_size"] > 0 else 0,
            day_7=round(row["returned_day_7"] / row["cohort_size"] * 100, 1) if row["cohort_size"] > 0 else 0,
            day_14=round(row["returned_day_14"] / row["cohort_size"] * 100, 1) if row["cohort_size"] > 0 else 0,
            day_30=round(row["returned_day_30"] / row["cohort_size"] * 100, 1) if row["cohort_size"] > 0 else 0,
        )
        for row in cohort_rows
    ]

    # ==========================================================================
    # 6. AUTO-GENERATED INSIGHTS
    # ==========================================================================
    insights = []

    # Find biggest dropoff
    for i, step in enumerate(funnel[1:], 1):
        prev_step = funnel[i - 1]
        dropoff = prev_step.percentage - step.percentage
        if dropoff > 20:
            insights.append(f"⚠️ Major dropoff: {dropoff:.0f}% of users lost between '{prev_step.step}' and '{step.step}'")

    # Zero message users
    zero_msg_pct = next((d.percentage for d in message_distribution if d.bucket == "0"), 0)
    if zero_msg_pct > 30:
        insights.append(f"🚨 {zero_msg_pct:.0f}% of users never sent a single message - onboarding friction issue")

    # Best performing source
    if source_performance:
        best_source = max(source_performance, key=lambda x: x.activation_rate if x.signups >= 5 else 0)
        if best_source.signups >= 5:
            insights.append(f"✅ Best activation: '{best_source.source}' at {best_source.activation_rate:.0f}% (n={best_source.signups})")

    # Low engagement rate
    if funnel_row["sent_5_messages"] and total > 10:
        five_msg_rate = funnel_row["sent_5_messages"] / total * 100
        if five_msg_rate < 20:
            insights.append(f"📉 Only {five_msg_rate:.0f}% reach 5+ messages - users not finding value quickly")

    return ActivationFunnelResponse(
        funnel=funnel,
        message_distribution=message_distribution,
        dropoff_analysis=dropoff_analysis,
        source_performance=source_performance,
        cohort_retention=cohort_retention,
        insights=insights,
    )
