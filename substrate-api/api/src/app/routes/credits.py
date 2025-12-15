"""Credits (Sparks) API routes.

Handles spark balance queries, spending checks, and transaction history.
See docs/monetization/CREDITS_SYSTEM_PROPOSAL.md for design.
"""

import logging
import os
from typing import List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.dependencies import get_current_user_id
from app.services.credits import CreditsService, InsufficientSparksError

log = logging.getLogger(__name__)

router = APIRouter(prefix="/credits", tags=["Credits"])


# ============================================================================
# Response Models
# ============================================================================


class BalanceResponse(BaseModel):
    """User's spark balance."""
    balance: int
    lifetime_earned: int
    lifetime_spent: int
    subscription_status: str


class SparkCheckResponse(BaseModel):
    """Result of checking if user can afford a feature."""
    allowed: bool
    balance: int
    cost: int
    balance_after: int
    message: Optional[str] = None


class TransactionResponse(BaseModel):
    """A spark transaction record."""
    id: str
    amount: int
    balance_after: int
    transaction_type: str
    description: Optional[str]
    created_at: str


class TransactionHistoryResponse(BaseModel):
    """List of transactions with pagination info."""
    transactions: List[TransactionResponse]
    count: int


class FeatureCostResponse(BaseModel):
    """Cost of a feature in sparks."""
    feature_key: str
    display_name: str
    spark_cost: int
    description: Optional[str] = None
    premium_only: bool = False


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    user_id: UUID = Depends(get_current_user_id),
):
    """Get current spark balance and lifetime stats."""
    credits_service = CreditsService.get_instance()
    stats = await credits_service.get_user_credits_stats(user_id)

    return BalanceResponse(
        balance=stats["balance"],
        lifetime_earned=stats["lifetime_earned"],
        lifetime_spent=stats["lifetime_spent"],
        subscription_status=stats["subscription_status"],
    )


@router.get("/check/{feature_key}", response_model=SparkCheckResponse)
async def check_balance(
    feature_key: str,
    user_id: UUID = Depends(get_current_user_id),
):
    """Check if user can afford a feature."""
    credits_service = CreditsService.get_instance()

    try:
        result = await credits_service.check_balance(user_id, feature_key)
        return SparkCheckResponse(
            allowed=result.allowed,
            balance=result.balance,
            cost=result.cost,
            balance_after=result.balance_after,
            message=result.message,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/history", response_model=TransactionHistoryResponse)
async def get_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: UUID = Depends(get_current_user_id),
):
    """Get transaction history."""
    credits_service = CreditsService.get_instance()
    transactions = await credits_service.get_transaction_history(user_id, limit, offset)

    return TransactionHistoryResponse(
        transactions=[
            TransactionResponse(
                id=str(tx.id),
                amount=tx.amount,
                balance_after=tx.balance_after,
                transaction_type=tx.transaction_type,
                description=tx.description,
                created_at=tx.created_at.isoformat(),
            )
            for tx in transactions
        ],
        count=len(transactions),
    )


@router.get("/costs", response_model=List[FeatureCostResponse])
async def get_feature_costs():
    """
    Get all feature costs (public endpoint).

    Returns the cost in sparks for each feature.
    Note: chat_message has cost=0 (free) by design.
    """
    credits_service = CreditsService.get_instance()
    costs = await credits_service.get_all_feature_costs()

    return [
        FeatureCostResponse(
            feature_key=cost["feature_key"],
            display_name=cost["display_name"],
            spark_cost=cost["spark_cost"],
            description=cost.get("description"),
            premium_only=cost.get("premium_only", False),
        )
        for cost in costs
    ]


# ============================================================================
# Top-Up Routes
# ============================================================================

topup_router = APIRouter(prefix="/topup", tags=["Top-Up"])

# Top-up pack configurations
# In production, variant IDs would come from Lemon Squeezy product setup
TOPUP_PACKS = {
    "starter": {
        "sparks": 25,
        "price_cents": 499,
        "variant_id": os.getenv("TOPUP_STARTER_VARIANT_ID", ""),
    },
    "popular": {
        "sparks": 60,
        "price_cents": 999,
        "variant_id": os.getenv("TOPUP_POPULAR_VARIANT_ID", ""),
    },
    "best_value": {
        "sparks": 150,
        "price_cents": 1999,
        "variant_id": os.getenv("TOPUP_BESTVALUE_VARIANT_ID", ""),
    },
}


class TopupPackResponse(BaseModel):
    """Top-up pack details."""
    pack_name: str
    sparks: int
    price_cents: int
    price_display: str
    per_spark_cents: float
    bonus_percent: int


class TopupCheckoutRequest(BaseModel):
    """Request to create a top-up checkout."""
    pack_name: str


class TopupCheckoutResponse(BaseModel):
    """Checkout URL response."""
    checkout_url: str


@topup_router.get("/packs", response_model=List[TopupPackResponse])
async def get_topup_packs():
    """Get available top-up packs with pricing."""
    packs = []
    base_rate = 499 / 25  # Starter pack rate (cents per spark)

    for name, pack in TOPUP_PACKS.items():
        per_spark = pack["price_cents"] / pack["sparks"]
        bonus = int((1 - per_spark / base_rate) * 100) if per_spark < base_rate else 0

        packs.append(TopupPackResponse(
            pack_name=name,
            sparks=pack["sparks"],
            price_cents=pack["price_cents"],
            price_display=f"${pack['price_cents'] / 100:.2f}",
            per_spark_cents=round(per_spark, 2),
            bonus_percent=bonus,
        ))

    return packs


@topup_router.post("/checkout", response_model=TopupCheckoutResponse)
async def create_topup_checkout(
    request: TopupCheckoutRequest,
    user_id: UUID = Depends(get_current_user_id),
):
    """Create a Lemon Squeezy checkout session for a top-up pack."""
    if request.pack_name not in TOPUP_PACKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid pack name. Valid options: {list(TOPUP_PACKS.keys())}",
        )

    pack = TOPUP_PACKS[request.pack_name]

    if not pack["variant_id"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Top-up packs are not configured yet. Please try again later.",
        )

    api_key = os.getenv("LEMONSQUEEZY_API_KEY")
    store_id = os.getenv("LEMONSQUEEZY_STORE_ID")
    success_url = os.getenv("CHECKOUT_SUCCESS_URL", "https://fantazy-five.vercel.app/settings?tab=billing")

    if not api_key or not store_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment system not configured",
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.lemonsqueezy.com/v1/checkouts",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/vnd.api+json",
                    "Accept": "application/vnd.api+json",
                },
                json={
                    "data": {
                        "type": "checkouts",
                        "attributes": {
                            "checkout_data": {
                                "custom": {
                                    "user_id": str(user_id),
                                    "pack_name": request.pack_name,
                                    "sparks_amount": str(pack["sparks"]),
                                    "purchase_type": "topup",
                                }
                            },
                            "product_options": {
                                "redirect_url": f"{success_url}&topup=success",
                            },
                        },
                        "relationships": {
                            "store": {
                                "data": {"type": "stores", "id": store_id}
                            },
                            "variant": {
                                "data": {"type": "variants", "id": pack["variant_id"]}
                            },
                        },
                    }
                },
                timeout=30.0,
            )

        if response.status_code != 201:
            log.error(f"Lemon Squeezy checkout failed: {response.status_code} {response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to create checkout session",
            )

        checkout_data = response.json()
        checkout_url = checkout_data["data"]["attributes"]["url"]

        return TopupCheckoutResponse(checkout_url=checkout_url)

    except httpx.RequestError as e:
        log.error(f"Lemon Squeezy request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service temporarily unavailable",
        )
