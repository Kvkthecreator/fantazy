"""Subscription management API routes (Lemon Squeezy integration)."""

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.deps import get_db
from app.dependencies import get_current_user_id

log = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/subscription", tags=["Subscription"])

# Lemon Squeezy configuration
LEMONSQUEEZY_API_KEY = os.getenv("LEMONSQUEEZY_API_KEY")
LEMONSQUEEZY_STORE_ID = os.getenv("LEMONSQUEEZY_STORE_ID", "221652")
LEMONSQUEEZY_VARIANT_ID = os.getenv(
    "LEMONSQUEEZY_VARIANT_ID", "90f25ea9-0c71-4007-a61b-9df15094e3dc"
)
LEMONSQUEEZY_WEBHOOK_SECRET = os.getenv(
    "LEMONSQUEEZY_WEBHOOK_SECRET", "ls_wh_ftz_7k9X2mPqR4vL8n"
)


class CheckoutRequest(BaseModel):
    """Request to create a checkout session."""

    variant_id: Optional[str] = None  # Use default if not provided


class CheckoutResponse(BaseModel):
    """Response with checkout URL."""

    checkout_url: str


class SubscriptionStatus(BaseModel):
    """Current subscription status."""

    status: str  # 'free', 'premium', 'cancelled'
    expires_at: Optional[str] = None
    customer_id: Optional[str] = None
    subscription_id: Optional[str] = None


@router.get("/status", response_model=SubscriptionStatus)
async def get_subscription_status(
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get current user's subscription status."""
    query = """
        SELECT
            subscription_status,
            subscription_expires_at,
            lemonsqueezy_customer_id,
            lemonsqueezy_subscription_id
        FROM users
        WHERE id = :user_id
    """
    row = await db.fetch_one(query, {"user_id": str(user_id)})

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return SubscriptionStatus(
        status=row["subscription_status"] or "free",
        expires_at=row["subscription_expires_at"].isoformat()
        if row["subscription_expires_at"]
        else None,
        customer_id=row["lemonsqueezy_customer_id"],
        subscription_id=row["lemonsqueezy_subscription_id"],
    )


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CheckoutRequest,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Create a Lemon Squeezy checkout session for the current user."""
    if not LEMONSQUEEZY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service not configured",
        )

    variant_id = request.variant_id or LEMONSQUEEZY_VARIANT_ID

    # Get user email from Supabase auth (for pre-filling checkout)
    # For now, we just pass user_id in custom data
    user_query = "SELECT display_name FROM users WHERE id = :user_id"
    user_row = await db.fetch_one(user_query, {"user_id": str(user_id)})

    checkout_data = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": {
                    "custom": {
                        "user_id": str(user_id),  # Critical: links payment to user
                    }
                },
                "product_options": {
                    "redirect_url": os.getenv(
                        "CHECKOUT_SUCCESS_URL",
                        "https://fantazy-five.vercel.app/settings?subscription=success",
                    ),
                },
            },
            "relationships": {
                "store": {"data": {"type": "stores", "id": LEMONSQUEEZY_STORE_ID}},
                "variant": {"data": {"type": "variants", "id": variant_id}},
            },
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.lemonsqueezy.com/v1/checkouts",
            headers={
                "Authorization": f"Bearer {LEMONSQUEEZY_API_KEY}",
                "Content-Type": "application/vnd.api+json",
                "Accept": "application/vnd.api+json",
            },
            json=checkout_data,
            timeout=30.0,
        )

        if response.status_code != 201:
            log.error(f"Lemon Squeezy checkout error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to create checkout session",
            )

        data = response.json()
        checkout_url = data["data"]["attributes"]["url"]

        log.info(f"Created checkout for user {user_id}: {checkout_url}")
        return CheckoutResponse(checkout_url=checkout_url)


@router.get("/portal")
async def get_customer_portal(
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get Lemon Squeezy customer portal URL for managing subscription."""
    if not LEMONSQUEEZY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service not configured",
        )

    # Get customer ID
    query = "SELECT lemonsqueezy_customer_id FROM users WHERE id = :user_id"
    row = await db.fetch_one(query, {"user_id": str(user_id)})

    if not row or not row["lemonsqueezy_customer_id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found. Subscribe first to manage your subscription.",
        )

    customer_id = row["lemonsqueezy_customer_id"]

    # Get customer portal URL from Lemon Squeezy
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.lemonsqueezy.com/v1/customers/{customer_id}",
            headers={
                "Authorization": f"Bearer {LEMONSQUEEZY_API_KEY}",
                "Accept": "application/vnd.api+json",
            },
            timeout=30.0,
        )

        if response.status_code != 200:
            log.error(f"Failed to get customer: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to get customer portal",
            )

        data = response.json()
        portal_url = data["data"]["attributes"]["urls"]["customer_portal"]

        return {"portal_url": portal_url}


# Webhook router - separate prefix, no auth required
webhook_router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify Lemon Squeezy webhook signature."""
    if not LEMONSQUEEZY_WEBHOOK_SECRET:
        log.warning("Webhook secret not configured, skipping verification")
        return True

    expected = hmac.new(
        LEMONSQUEEZY_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


def parse_iso_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO 8601 date string to datetime object."""
    if not date_str:
        return None
    try:
        # Handle various ISO formats
        # Remove 'Z' and replace with +00:00 for fromisoformat
        if date_str.endswith("Z"):
            date_str = date_str[:-1] + "+00:00"
        return datetime.fromisoformat(date_str)
    except (ValueError, TypeError):
        log.warning(f"Failed to parse date: {date_str}")
        return None


@webhook_router.post("/lemonsqueezy")
async def handle_lemonsqueezy_webhook(
    request: Request,
    db=Depends(get_db),
):
    """Handle Lemon Squeezy webhook events."""
    # Get raw body for signature verification
    body = await request.body()
    signature = request.headers.get("X-Signature", "")

    if not verify_webhook_signature(body, signature):
        log.warning("Invalid webhook signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature",
        )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    event_name = payload.get("meta", {}).get("event_name", "")
    log.info(f"Received Lemon Squeezy webhook: {event_name}")

    # Extract user_id from custom data
    custom_data = payload.get("meta", {}).get("custom_data", {})
    user_id = custom_data.get("user_id")

    # Extract subscription data
    attrs = payload.get("data", {}).get("attributes", {})
    subscription_id = str(payload.get("data", {}).get("id", ""))
    customer_id = str(attrs.get("customer_id", ""))

    # If no user_id in custom data, try to find by customer_id
    if not user_id and customer_id:
        query = "SELECT id FROM users WHERE lemonsqueezy_customer_id = :customer_id"
        row = await db.fetch_one(query, {"customer_id": customer_id})
        if row:
            user_id = str(row["id"])

    if not user_id:
        log.warning(f"No user_id found for webhook event: {event_name}")
        # Still return 200 to acknowledge receipt
        return {"status": "ok", "message": "No user_id found"}

    # Log the event
    await db.execute(
        """
        INSERT INTO subscription_events
            (user_id, event_type, ls_subscription_id, ls_customer_id, payload)
        VALUES
            (:user_id, :event_type, :ls_subscription_id, :ls_customer_id, :payload)
        """,
        {
            "user_id": user_id,
            "event_type": event_name,
            "ls_subscription_id": subscription_id,
            "ls_customer_id": customer_id,
            "payload": json.dumps(payload),
        },
    )

    # Handle specific events
    if event_name == "subscription_created":
        await handle_subscription_created(db, user_id, attrs, subscription_id, customer_id)
    elif event_name == "subscription_updated":
        await handle_subscription_updated(db, user_id, attrs, subscription_id)
    elif event_name in ("subscription_cancelled", "subscription_expired"):
        await handle_subscription_ended(db, user_id, attrs)
    elif event_name == "subscription_resumed":
        await handle_subscription_resumed(db, user_id, attrs, subscription_id)
    elif event_name == "subscription_payment_failed":
        log.warning(f"Payment failed for user {user_id}")
        # Could send notification, but don't downgrade yet (grace period)
    elif event_name == "subscription_payment_success":
        # Renewal successful - update expiry
        renews_at = parse_iso_date(attrs.get("renews_at"))
        if renews_at:
            await db.execute(
                """
                UPDATE users
                SET subscription_expires_at = :renews_at, updated_at = NOW()
                WHERE id = :user_id
                """,
                {"user_id": user_id, "renews_at": renews_at},
            )

    return {"status": "ok"}


async def handle_subscription_created(
    db, user_id: str, attrs: dict, subscription_id: str, customer_id: str
):
    """Activate premium subscription for user."""
    renews_at = parse_iso_date(attrs.get("renews_at"))
    status_value = attrs.get("status", "active")

    # Map LS status to our status
    sub_status = "premium" if status_value in ("active", "on_trial") else "free"

    await db.execute(
        """
        UPDATE users SET
            subscription_status = :status,
            subscription_expires_at = :renews_at,
            lemonsqueezy_customer_id = :customer_id,
            lemonsqueezy_subscription_id = :subscription_id,
            updated_at = NOW()
        WHERE id = :user_id
        """,
        {
            "user_id": user_id,
            "status": sub_status,
            "renews_at": renews_at,
            "customer_id": customer_id,
            "subscription_id": subscription_id,
        },
    )
    log.info(f"Activated premium subscription for user {user_id}")


async def handle_subscription_updated(
    db, user_id: str, attrs: dict, subscription_id: str
):
    """Handle subscription updates (plan changes, etc.)."""
    renews_at = parse_iso_date(attrs.get("renews_at"))
    status_value = attrs.get("status", "active")

    sub_status = "premium" if status_value in ("active", "on_trial", "past_due") else "free"

    await db.execute(
        """
        UPDATE users SET
            subscription_status = :status,
            subscription_expires_at = :renews_at,
            lemonsqueezy_subscription_id = :subscription_id,
            updated_at = NOW()
        WHERE id = :user_id
        """,
        {
            "user_id": user_id,
            "status": sub_status,
            "renews_at": renews_at,
            "subscription_id": subscription_id,
        },
    )
    log.info(f"Updated subscription for user {user_id}: {sub_status}")


async def handle_subscription_ended(db, user_id: str, attrs: dict):
    """Downgrade user to free tier."""
    await db.execute(
        """
        UPDATE users SET
            subscription_status = 'free',
            subscription_expires_at = NULL,
            updated_at = NOW()
        WHERE id = :user_id
        """,
        {"user_id": user_id},
    )
    log.info(f"Downgraded user {user_id} to free tier")


async def handle_subscription_resumed(
    db, user_id: str, attrs: dict, subscription_id: str
):
    """Reactivate subscription after pause/resume."""
    renews_at = parse_iso_date(attrs.get("renews_at"))

    await db.execute(
        """
        UPDATE users SET
            subscription_status = 'premium',
            subscription_expires_at = :renews_at,
            lemonsqueezy_subscription_id = :subscription_id,
            updated_at = NOW()
        WHERE id = :user_id
        """,
        {
            "user_id": user_id,
            "renews_at": renews_at,
            "subscription_id": subscription_id,
        },
    )
    log.info(f"Resumed subscription for user {user_id}")
