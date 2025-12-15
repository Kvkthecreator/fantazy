# Credits System Proposal

## Overview

This document proposes a virtual credits system ("Sparks") that abstracts the monetization layer from actual costs, enabling flexible pricing for current and future features.

---

## 1. Naming & Branding

**Recommended name: "Sparks"**

Rationale:
- Fits the fantasy/magic theme of Fantazy
- Feels generative ("spark of creativity")
- Avoids casino/gambling connotations of "coins"
- Short, memorable, works as verb ("spark a scene")

Alternative options: Credits, Gems, Essence, Mana

---

## 2. Core Economics

### Initial Pricing (1 Spark ≈ $0.10 value)

| Action | Spark Cost | Real Cost | Margin | Notes |
|--------|------------|-----------|--------|-------|
| **Chat message** | **0 (FREE)** | ~$0.0004 | N/A | **Deliberate decision - see Section 2.1** |
| Image generation (Flux) | 1 Spark | ~$0.05 | 50% | Primary monetization lever |
| Video generation (future) | 15 Sparks | ~$1.00 | 33% | |
| Voice message (future) | 1 Spark | ~$0.01 | 90% | |
| Premium pose/scene unlock | 3 Sparks | $0 | 100% | |

### Subscription Allocation

| Tier | Monthly Sparks | Price | Effective $/Spark |
|------|----------------|-------|-------------------|
| Free | 5 | $0 | - |
| Premium | 100 | $19.99 | $0.20 |

Note: Premium users get 100 Sparks (vs current 50 generations) - this gives headroom for mixed usage across features.

### Top-Up Packs (One-Time Purchase)

| Pack | Sparks | Price | $/Spark | Bonus |
|------|--------|-------|---------|-------|
| Starter | 25 | $4.99 | $0.20 | - |
| Popular | 60 | $9.99 | $0.17 | +20% |
| Best Value | 150 | $19.99 | $0.13 | +50% |

---

## 2.1 Message Economics: Deliberate Free Tier

> **ARCHITECTURAL DECISION**: Chat messages are FREE and do not consume Sparks.
> This is a deliberate, analyzed decision - not an omission.

### Why Messages Are Free

#### Economic Analysis

**Current LLM: Gemini 2.0 Flash**

| Metric | Value |
|--------|-------|
| Input cost | $0.10 / 1M tokens |
| Output cost | $0.40 / 1M tokens |
| Avg context per message | ~3,000 tokens |
| Avg response length | ~300 tokens |
| **Cost per message** | **~$0.0004** |

**Monthly Cost Per User (Chat Only)**

| User Type | Messages/Month | LLM Cost | Notes |
|-----------|----------------|----------|-------|
| Light | 100 | ~$0.04 | Casual user |
| Average | 500 | ~$0.20 | Engaged user |
| Heavy | 2,000 | ~$0.80 | Power user |
| Extreme | 5,000 | ~$2.00 | Potential abuse territory |

#### Cost Comparison: Messages vs Images

| Feature | Cost Per Unit | Ratio | Enforcement Value |
|---------|---------------|-------|-------------------|
| Flux Image | $0.05 | 125x | High - primary cost lever |
| Chat Message | $0.0004 | 1x | Low - negligible cost |

**Images are 125x more expensive than messages.** Quota enforcement ROI is dramatically higher for images.

#### Strategic Rationale

1. **Core Loop Protection**
   - Chat IS the product - it's the primary engagement mechanism
   - Gating chat creates anxiety and breaks immersion
   - Chat engagement drives image generation (the monetizable action)
   - Limiting chat = limiting the funnel to paid features

2. **Competitor Analysis**
   - Character.ai: Uses wait times, not hard caps
   - Replika: Unlimited chat on free tier
   - NovelAI: Chat is unlimited; images are gated
   - Industry norm: Soft friction, not hard denial

3. **User Psychology**
   - Counting messages creates resource anxiety
   - Users self-censor to "save" messages
   - Breaks the illusion of relationship with companion
   - Premium value prop of "unlimited chat" is compelling

4. **Economic Reality**
   - Enforcement complexity > cost savings
   - At $0.0004/message, even 5,000 messages = $2.00
   - Support overhead from confused users exceeds savings
   - Already tracking messages - can add limits if abuse emerges

#### Decision Matrix

| Factor | Charge Sparks | Keep Free | Winner |
|--------|---------------|-----------|--------|
| User experience | Worse | Better | Free |
| Revenue impact | Minimal | None | Tie |
| Abuse prevention | Better | Via rate limits | Tie |
| Implementation cost | Higher | Lower | Free |
| Competitor parity | Worse | Better | Free |
| Core loop health | Damaged | Preserved | Free |

**Verdict: Messages remain FREE with abuse protections.**

---

## 2.2 Message Abuse Prevention System

> **REQUIREMENT**: While messages are free, abuse must be prevented.
> This section specifies the abuse detection and rate limiting system.

### Abuse Threat Model

| Threat | Description | Impact | Mitigation |
|--------|-------------|--------|------------|
| Bot spam | Automated message flooding | API costs, DB bloat | Rate limiting |
| API scraping | Extracting model responses | IP theft | Auth + rate limits |
| Resource exhaustion | Intentional overuse | Service degradation | Throttling |
| Free tier abuse | Excessive usage without converting | Unsustainable costs | Soft limits |

### Rate Limiting Specification

#### Tier-Based Limits

| Tier | Messages/Hour | Messages/Day | Burst Limit | Cooldown When Exceeded |
|------|---------------|--------------|-------------|------------------------|
| Free | 30 | 100 | 5 in 10s | 60s between messages |
| Premium | 120 | Unlimited | 10 in 10s | None |

#### Implementation: Rate Limiter Service

```python
# app/services/rate_limiter.py

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
from redis import Redis  # or use in-memory for MVP
import logging

logger = logging.getLogger(__name__)

class RateLimitResult:
    allowed: bool
    remaining: int
    reset_at: Optional[datetime]
    cooldown_seconds: Optional[int]
    message: Optional[str]

class MessageRateLimiter:
    """Rate limiter for chat messages."""

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

    def __init__(self, redis_client: Optional[Redis] = None):
        self.redis = redis_client
        # Fallback to in-memory if no Redis
        self._memory_store: dict = {}

    async def check_rate_limit(
        self,
        user_id: UUID,
        subscription_status: str = "free"
    ) -> RateLimitResult:
        """Check if user can send a message."""
        limits = self.LIMITS.get(subscription_status, self.LIMITS["free"])
        user_key = str(user_id)
        now = datetime.utcnow()

        # Get current counts
        hour_count = await self._get_count(user_key, "hour")
        day_count = await self._get_count(user_key, "day")
        burst_count = await self._get_count(user_key, "burst")

        # Check burst limit (spam protection)
        if burst_count >= limits["burst_count"]:
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_at=now + timedelta(seconds=limits["burst_window_seconds"]),
                cooldown_seconds=limits["burst_window_seconds"],
                message="Slow down! Please wait a moment before sending another message."
            )

        # Check hourly limit
        if limits["per_hour"] and hour_count >= limits["per_hour"]:
            reset_at = await self._get_reset_time(user_key, "hour")
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_at=reset_at,
                cooldown_seconds=limits["cooldown_seconds"],
                message=f"You've reached your hourly message limit. Resets in {self._format_time_remaining(reset_at)}."
            )

        # Check daily limit (free tier only)
        if limits["per_day"] and day_count >= limits["per_day"]:
            reset_at = await self._get_reset_time(user_key, "day")
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_at=reset_at,
                cooldown_seconds=None,
                message="You've reached your daily message limit. Upgrade to Premium for unlimited messages, or wait until tomorrow."
            )

        # Calculate remaining
        remaining = min(
            (limits["per_hour"] - hour_count) if limits["per_hour"] else float('inf'),
            (limits["per_day"] - day_count) if limits["per_day"] else float('inf')
        )

        return RateLimitResult(
            allowed=True,
            remaining=int(remaining),
            reset_at=None,
            cooldown_seconds=None,
            message=None
        )

    async def record_message(self, user_id: UUID) -> None:
        """Record a message was sent (call after successful send)."""
        user_key = str(user_id)
        await self._increment(user_key, "hour", ttl_seconds=3600)
        await self._increment(user_key, "day", ttl_seconds=86400)
        await self._increment(user_key, "burst", ttl_seconds=10)

    async def _get_count(self, user_key: str, window: str) -> int:
        """Get current count for a time window."""
        key = f"ratelimit:{user_key}:{window}"
        if self.redis:
            return int(self.redis.get(key) or 0)
        return self._memory_store.get(key, {}).get("count", 0)

    async def _increment(self, user_key: str, window: str, ttl_seconds: int) -> None:
        """Increment counter for a time window."""
        key = f"ratelimit:{user_key}:{window}"
        if self.redis:
            pipe = self.redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, ttl_seconds)
            pipe.execute()
        else:
            if key not in self._memory_store:
                self._memory_store[key] = {"count": 0, "expires": datetime.utcnow() + timedelta(seconds=ttl_seconds)}
            self._memory_store[key]["count"] += 1

    async def _get_reset_time(self, user_key: str, window: str) -> datetime:
        """Get when the rate limit resets."""
        key = f"ratelimit:{user_key}:{window}"
        if self.redis:
            ttl = self.redis.ttl(key)
            return datetime.utcnow() + timedelta(seconds=max(ttl, 0))
        entry = self._memory_store.get(key, {})
        return entry.get("expires", datetime.utcnow())

    def _format_time_remaining(self, reset_at: datetime) -> str:
        """Format time remaining as human-readable string."""
        delta = reset_at - datetime.utcnow()
        minutes = int(delta.total_seconds() / 60)
        if minutes < 1:
            return "less than a minute"
        elif minutes == 1:
            return "1 minute"
        elif minutes < 60:
            return f"{minutes} minutes"
        else:
            hours = minutes // 60
            return f"{hours} hour{'s' if hours > 1 else ''}"
```

#### Integration with Conversation Service

```python
# Update app/services/conversation.py

from app.services.rate_limiter import MessageRateLimiter, RateLimitResult

class ConversationService:
    def __init__(self, db):
        self.db = db
        self.llm = LLMService.get_instance()
        self.memory_service = MemoryService(db)
        self.usage_service = UsageService.get_instance()
        self.rate_limiter = MessageRateLimiter()  # Add rate limiter

    async def send_message(
        self,
        user_id: UUID,
        character_id: UUID,
        content: str,
    ) -> Message:
        # Get user subscription status
        user = await self._get_user(user_id)
        subscription_status = user.get("subscription_status", "free")

        # Check rate limit BEFORE processing
        rate_check = await self.rate_limiter.check_rate_limit(user_id, subscription_status)
        if not rate_check.allowed:
            raise RateLimitExceededError(
                message=rate_check.message,
                reset_at=rate_check.reset_at,
                cooldown_seconds=rate_check.cooldown_seconds
            )

        # ... existing message processing ...

        # Record message AFTER successful send
        await self.rate_limiter.record_message(user_id)

        return assistant_message
```

#### API Error Response

```python
# app/routes/conversation.py

from fastapi import HTTPException, status

class RateLimitExceededError(Exception):
    def __init__(self, message: str, reset_at: datetime, cooldown_seconds: Optional[int]):
        self.message = message
        self.reset_at = reset_at
        self.cooldown_seconds = cooldown_seconds

@router.post("/send")
async def send_message(...):
    try:
        response = await conversation_service.send_message(...)
        return response
    except RateLimitExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "rate_limit_exceeded",
                "message": e.message,
                "reset_at": e.reset_at.isoformat() if e.reset_at else None,
                "cooldown_seconds": e.cooldown_seconds,
                "upgrade_url": "/settings?tab=subscription"
            },
            headers={
                "Retry-After": str(e.cooldown_seconds) if e.cooldown_seconds else "60"
            }
        )
```

### Abuse Detection & Alerting

#### Anomaly Detection Rules

| Rule | Threshold | Action |
|------|-----------|--------|
| Hourly spike | >3x normal hourly rate | Log + alert |
| Sustained high volume | >1000 msgs/day for 3+ days | Review account |
| Burst patterns | >20 msgs/minute repeatedly | Temporary throttle |
| Off-hours activity | >100 msgs between 2-6am local | Flag for review |
| Identical messages | >10 identical msgs in sequence | Block + alert |

#### Database Schema for Abuse Tracking

```sql
-- Add to migration 015_credits_system.sql

-- Abuse flags table
CREATE TABLE abuse_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    flag_type TEXT NOT NULL,          -- 'rate_spike', 'sustained_volume', 'burst_pattern', 'duplicate_spam'
    severity TEXT DEFAULT 'low',      -- 'low', 'medium', 'high', 'critical'

    details JSONB DEFAULT '{}',       -- Context about the flag
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,                 -- Admin who resolved
    resolution_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_abuse_flags_user_id ON abuse_flags(user_id);
CREATE INDEX idx_abuse_flags_unresolved ON abuse_flags(resolved) WHERE resolved = false;

-- Add abuse tracking columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_throttled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS throttled_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS abuse_score INTEGER DEFAULT 0;  -- Running abuse score
```

#### Abuse Monitoring Service

```python
# app/services/abuse_monitor.py

class AbuseMonitor:
    """Background service to detect and flag abusive patterns."""

    RULES = {
        "hourly_spike": {
            "threshold_multiplier": 3.0,
            "severity": "medium",
        },
        "sustained_volume": {
            "daily_threshold": 1000,
            "consecutive_days": 3,
            "severity": "high",
        },
        "duplicate_spam": {
            "identical_threshold": 10,
            "severity": "high",
        },
    }

    async def check_user(self, user_id: UUID) -> list[dict]:
        """Run all abuse checks for a user. Returns list of triggered flags."""
        flags = []

        # Check hourly spike
        if await self._check_hourly_spike(user_id):
            flags.append({"type": "hourly_spike", "severity": "medium"})

        # Check duplicate messages
        if await self._check_duplicate_spam(user_id):
            flags.append({"type": "duplicate_spam", "severity": "high"})

        # Record flags if any
        for flag in flags:
            await self._record_flag(user_id, flag)

        return flags

    async def _check_duplicate_spam(self, user_id: UUID) -> bool:
        """Check for repeated identical messages."""
        # Query recent messages and check for duplicates
        # Implementation depends on your message storage
        pass

    async def _record_flag(self, user_id: UUID, flag: dict) -> None:
        """Record an abuse flag in the database."""
        await self.db.table("abuse_flags").insert({
            "user_id": str(user_id),
            "flag_type": flag["type"],
            "severity": flag["severity"],
            "details": flag.get("details", {}),
        }).execute()

        # Update user abuse score
        await self.db.table("users").update({
            "abuse_score": self.db.raw("abuse_score + 1")
        }).eq("id", str(user_id)).execute()

        # Auto-throttle for high severity
        if flag["severity"] in ["high", "critical"]:
            await self._throttle_user(user_id, hours=24)

    async def _throttle_user(self, user_id: UUID, hours: int) -> None:
        """Apply temporary throttle to a user."""
        throttle_until = datetime.utcnow() + timedelta(hours=hours)
        await self.db.table("users").update({
            "is_throttled": True,
            "throttled_until": throttle_until.isoformat()
        }).eq("id", str(user_id)).execute()

        logger.warning(f"User {user_id} throttled until {throttle_until} due to abuse")
```

### Frontend: Rate Limit UI

```typescript
// web/src/components/chat/RateLimitBanner.tsx

interface RateLimitBannerProps {
  resetAt: Date;
  remaining: number;
  isPremium: boolean;
}

export function RateLimitBanner({ resetAt, remaining, isPremium }: RateLimitBannerProps) {
  const timeRemaining = useTimeRemaining(resetAt);

  if (remaining > 10) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-600">
          <Clock className="h-4 w-4" />
          <span className="text-sm">
            {remaining === 0
              ? `Message limit reached. Resets in ${timeRemaining}`
              : `${remaining} messages remaining this hour`}
          </span>
        </div>

        {!isPremium && (
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-600 hover:text-amber-700"
            onClick={() => window.location.href = '/settings?tab=subscription'}
          >
            <Crown className="h-4 w-4 mr-1" />
            Go Unlimited
          </Button>
        )}
      </div>
    </div>
  );
}
```

### Summary: Message Policy

| Aspect | Specification |
|--------|---------------|
| **Spark Cost** | 0 (FREE) |
| **Rationale** | Core loop protection, negligible cost, competitor parity |
| **Free Tier Limits** | 30/hour, 100/day, with cooldowns |
| **Premium Limits** | 120/hour, unlimited daily |
| **Abuse Detection** | Spike detection, duplicate spam, sustained volume |
| **Enforcement** | Soft limits (cooldowns), not hard denial |
| **Future Flexibility** | Can add Spark cost later if LLM costs increase |

---

## 3. Database Schema

### New Tables

```sql
-- Migration: 015_credits_system.sql

-- Credits ledger - immutable transaction log
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Transaction details
    amount INTEGER NOT NULL,              -- Positive = credit, Negative = debit
    balance_after INTEGER NOT NULL,       -- Running balance for auditability

    -- Transaction type
    transaction_type TEXT NOT NULL,       -- 'subscription_grant', 'topup_purchase', 'generation_spend', 'refund', 'bonus', 'expiry'

    -- Reference to source
    reference_type TEXT,                  -- 'subscription', 'purchase', 'generation', 'promotion'
    reference_id TEXT,                    -- ID of related entity (subscription_id, purchase_id, etc.)

    -- Metadata
    description TEXT,                     -- Human-readable description
    metadata JSONB DEFAULT '{}',          -- Additional context (feature used, model, etc.)

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,               -- Optional expiry for granted credits

    -- Indexing
    CONSTRAINT valid_transaction_type CHECK (
        transaction_type IN ('subscription_grant', 'topup_purchase', 'generation_spend', 'refund', 'bonus', 'expiry', 'admin_adjustment')
    )
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);

-- Top-up purchases tracking
CREATE TABLE topup_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Lemon Squeezy reference
    ls_order_id TEXT UNIQUE,
    ls_variant_id TEXT NOT NULL,

    -- Purchase details
    pack_name TEXT NOT NULL,              -- 'starter', 'popular', 'best_value'
    sparks_amount INTEGER NOT NULL,       -- Total sparks granted
    price_cents INTEGER NOT NULL,         -- Price paid in cents
    currency TEXT DEFAULT 'USD',

    -- Status
    status TEXT DEFAULT 'completed',      -- 'pending', 'completed', 'refunded'

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'refunded'))
);

CREATE INDEX idx_topup_purchases_user_id ON topup_purchases(user_id);

-- Credit cost configuration (admin-adjustable)
CREATE TABLE credit_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    feature_key TEXT UNIQUE NOT NULL,     -- 'flux_generation', 'video_generation', 'voice_message'
    display_name TEXT NOT NULL,           -- 'Image Generation'
    spark_cost INTEGER NOT NULL,          -- Cost in sparks

    -- Feature flags
    is_active BOOLEAN DEFAULT true,
    premium_only BOOLEAN DEFAULT false,

    -- Metadata
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default costs
-- NOTE: chat_message is explicitly listed at 0 cost as a documented architectural decision
-- See Section 2.1 "Message Economics: Deliberate Free Tier" for rationale
INSERT INTO credit_costs (feature_key, display_name, spark_cost, description) VALUES
    ('flux_generation', 'Image Generation', 1, 'Generate a custom scene image'),
    ('video_generation', 'Video Generation', 15, 'Generate a short video clip'),
    ('voice_message', 'Voice Message', 1, 'Generate a voice message from companion'),
    ('chat_message', 'Chat Message', 0, 'Send a message (FREE - see Section 2.1 for rationale)');
```

### User Table Modifications

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS spark_balance INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_sparks_earned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_sparks_spent INTEGER DEFAULT 0;

-- Function to get current balance (can be used for consistency checks)
CREATE OR REPLACE FUNCTION calculate_spark_balance(p_user_id UUID)
RETURNS INTEGER AS $$
    SELECT COALESCE(SUM(amount), 0)::INTEGER
    FROM credit_transactions
    WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- Function to get feature cost
CREATE OR REPLACE FUNCTION get_spark_cost(p_feature_key TEXT)
RETURNS INTEGER AS $$
    SELECT spark_cost FROM credit_costs WHERE feature_key = p_feature_key AND is_active = true;
$$ LANGUAGE sql STABLE;
```

---

## 4. Backend Service

### Credits Service (`app/services/credits.py`)

```python
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from enum import Enum

class TransactionType(str, Enum):
    SUBSCRIPTION_GRANT = "subscription_grant"
    TOPUP_PURCHASE = "topup_purchase"
    GENERATION_SPEND = "generation_spend"
    REFUND = "refund"
    BONUS = "bonus"
    EXPIRY = "expiry"
    ADMIN_ADJUSTMENT = "admin_adjustment"

class SparkCheckResult(BaseModel):
    allowed: bool
    balance: int
    cost: int
    balance_after: int
    message: Optional[str] = None

class SparkTransaction(BaseModel):
    id: UUID
    amount: int
    balance_after: int
    transaction_type: TransactionType
    description: str
    created_at: datetime

class CreditsService:
    def __init__(self, supabase_client):
        self.db = supabase_client

    async def get_balance(self, user_id: UUID) -> int:
        """Get current spark balance for user."""
        result = await self.db.table("users").select("spark_balance").eq("id", str(user_id)).single().execute()
        return result.data.get("spark_balance", 0) if result.data else 0

    async def get_feature_cost(self, feature_key: str) -> int:
        """Get spark cost for a feature."""
        result = await self.db.table("credit_costs").select("spark_cost").eq("feature_key", feature_key).eq("is_active", True).single().execute()
        if not result.data:
            raise ValueError(f"Unknown feature: {feature_key}")
        return result.data["spark_cost"]

    async def check_balance(self, user_id: UUID, feature_key: str) -> SparkCheckResult:
        """Check if user has enough sparks for a feature."""
        balance = await self.get_balance(user_id)
        cost = await self.get_feature_cost(feature_key)

        allowed = balance >= cost
        return SparkCheckResult(
            allowed=allowed,
            balance=balance,
            cost=cost,
            balance_after=balance - cost if allowed else balance,
            message=None if allowed else f"Insufficient Sparks. You have {balance}, need {cost}."
        )

    async def spend(
        self,
        user_id: UUID,
        feature_key: str,
        reference_id: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> SparkTransaction:
        """Spend sparks for a feature. Returns transaction or raises error."""
        check = await self.check_balance(user_id, feature_key)
        if not check.allowed:
            raise InsufficientSparksError(check.message, balance=check.balance, cost=check.cost)

        cost = await self.get_feature_cost(feature_key)

        # Atomic balance update + transaction insert
        # Using a transaction to ensure consistency
        async with self.db.transaction():
            # Update user balance
            await self.db.table("users").update({
                "spark_balance": check.balance_after,
                "lifetime_sparks_spent": self.db.raw(f"lifetime_sparks_spent + {cost}")
            }).eq("id", str(user_id)).execute()

            # Insert transaction record
            tx_result = await self.db.table("credit_transactions").insert({
                "user_id": str(user_id),
                "amount": -cost,
                "balance_after": check.balance_after,
                "transaction_type": TransactionType.GENERATION_SPEND,
                "reference_type": "generation",
                "reference_id": reference_id,
                "description": f"Spent {cost} Spark(s) on {feature_key}",
                "metadata": metadata or {}
            }).execute()

        return SparkTransaction(**tx_result.data[0])

    async def grant(
        self,
        user_id: UUID,
        amount: int,
        transaction_type: TransactionType,
        description: str,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        metadata: Optional[dict] = None
    ) -> SparkTransaction:
        """Grant sparks to a user."""
        current_balance = await self.get_balance(user_id)
        new_balance = current_balance + amount

        async with self.db.transaction():
            # Update user balance
            await self.db.table("users").update({
                "spark_balance": new_balance,
                "lifetime_sparks_earned": self.db.raw(f"lifetime_sparks_earned + {amount}")
            }).eq("id", str(user_id)).execute()

            # Insert transaction record
            tx_result = await self.db.table("credit_transactions").insert({
                "user_id": str(user_id),
                "amount": amount,
                "balance_after": new_balance,
                "transaction_type": transaction_type,
                "reference_type": reference_type,
                "reference_id": reference_id,
                "description": description,
                "expires_at": expires_at.isoformat() if expires_at else None,
                "metadata": metadata or {}
            }).execute()

        return SparkTransaction(**tx_result.data[0])

    async def grant_subscription_sparks(self, user_id: UUID, subscription_id: str, is_premium: bool) -> SparkTransaction:
        """Grant monthly subscription sparks."""
        amount = 100 if is_premium else 5
        return await self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.SUBSCRIPTION_GRANT,
            description=f"Monthly {'Premium' if is_premium else 'Free'} Sparks",
            reference_type="subscription",
            reference_id=subscription_id,
            expires_at=datetime.utcnow() + timedelta(days=31)  # Optional: expire unused sparks
        )

    async def grant_topup_sparks(self, user_id: UUID, pack_name: str, amount: int, order_id: str) -> SparkTransaction:
        """Grant sparks from top-up purchase."""
        return await self.grant(
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.TOPUP_PURCHASE,
            description=f"Purchased {pack_name} pack ({amount} Sparks)",
            reference_type="purchase",
            reference_id=order_id,
            expires_at=None  # Purchased sparks don't expire
        )

    async def get_transaction_history(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0
    ) -> list[SparkTransaction]:
        """Get user's transaction history."""
        result = await self.db.table("credit_transactions") \
            .select("*") \
            .eq("user_id", str(user_id)) \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()

        return [SparkTransaction(**tx) for tx in result.data]


class InsufficientSparksError(Exception):
    def __init__(self, message: str, balance: int, cost: int):
        super().__init__(message)
        self.balance = balance
        self.cost = cost
```

---

## 5. API Endpoints

### Credits Routes (`app/routes/credits.py`)

```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from ..services.credits import CreditsService, InsufficientSparksError
from ..dependencies import get_current_user, get_credits_service

router = APIRouter(prefix="/credits", tags=["credits"])

class BalanceResponse(BaseModel):
    balance: int
    lifetime_earned: int
    lifetime_spent: int

class SparkCheckResponse(BaseModel):
    allowed: bool
    balance: int
    cost: int
    balance_after: int
    message: Optional[str]

class TransactionResponse(BaseModel):
    id: str
    amount: int
    balance_after: int
    transaction_type: str
    description: str
    created_at: str

class TransactionHistoryResponse(BaseModel):
    transactions: list[TransactionResponse]
    total_count: int

class FeatureCostResponse(BaseModel):
    feature_key: str
    display_name: str
    spark_cost: int

@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    user = Depends(get_current_user),
    credits_service: CreditsService = Depends(get_credits_service)
):
    """Get current spark balance."""
    balance = await credits_service.get_balance(user.id)
    # Also fetch lifetime stats
    user_data = await credits_service.db.table("users").select(
        "lifetime_sparks_earned", "lifetime_sparks_spent"
    ).eq("id", str(user.id)).single().execute()

    return BalanceResponse(
        balance=balance,
        lifetime_earned=user_data.data.get("lifetime_sparks_earned", 0),
        lifetime_spent=user_data.data.get("lifetime_sparks_spent", 0)
    )

@router.get("/check/{feature_key}", response_model=SparkCheckResponse)
async def check_balance(
    feature_key: str,
    user = Depends(get_current_user),
    credits_service: CreditsService = Depends(get_credits_service)
):
    """Check if user can afford a feature."""
    try:
        result = await credits_service.check_balance(user.id, feature_key)
        return SparkCheckResponse(**result.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/history", response_model=TransactionHistoryResponse)
async def get_history(
    limit: int = 20,
    offset: int = 0,
    user = Depends(get_current_user),
    credits_service: CreditsService = Depends(get_credits_service)
):
    """Get transaction history."""
    transactions = await credits_service.get_transaction_history(user.id, limit, offset)
    return TransactionHistoryResponse(
        transactions=[TransactionResponse(**tx.dict()) for tx in transactions],
        total_count=len(transactions)  # TODO: Add actual count query
    )

@router.get("/costs", response_model=list[FeatureCostResponse])
async def get_feature_costs(
    credits_service: CreditsService = Depends(get_credits_service)
):
    """Get all feature costs (public endpoint for UI)."""
    result = await credits_service.db.table("credit_costs").select("*").eq("is_active", True).execute()
    return [FeatureCostResponse(**cost) for cost in result.data]
```

### Top-Up Routes (`app/routes/topup.py`)

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..dependencies import get_current_user, get_credits_service
import os
import httpx

router = APIRouter(prefix="/topup", tags=["topup"])

TOPUP_PACKS = {
    "starter": {"sparks": 25, "price_cents": 499, "variant_id": "VARIANT_ID_1"},
    "popular": {"sparks": 60, "price_cents": 999, "variant_id": "VARIANT_ID_2"},
    "best_value": {"sparks": 150, "price_cents": 1999, "variant_id": "VARIANT_ID_3"},
}

class TopupPackResponse(BaseModel):
    pack_name: str
    sparks: int
    price_cents: int
    price_display: str
    per_spark_cents: float
    bonus_percent: int

class CheckoutRequest(BaseModel):
    pack_name: str

class CheckoutResponse(BaseModel):
    checkout_url: str

@router.get("/packs", response_model=list[TopupPackResponse])
async def get_topup_packs():
    """Get available top-up packs."""
    packs = []
    base_rate = 499 / 25  # Starter pack rate

    for name, pack in TOPUP_PACKS.items():
        per_spark = pack["price_cents"] / pack["sparks"]
        bonus = int((1 - per_spark / base_rate) * 100) if per_spark < base_rate else 0

        packs.append(TopupPackResponse(
            pack_name=name,
            sparks=pack["sparks"],
            price_cents=pack["price_cents"],
            price_display=f"${pack['price_cents'] / 100:.2f}",
            per_spark_cents=round(per_spark, 2),
            bonus_percent=bonus
        ))

    return packs

@router.post("/checkout", response_model=CheckoutResponse)
async def create_topup_checkout(
    request: CheckoutRequest,
    user = Depends(get_current_user)
):
    """Create checkout session for top-up pack."""
    if request.pack_name not in TOPUP_PACKS:
        raise HTTPException(status_code=400, detail="Invalid pack name")

    pack = TOPUP_PACKS[request.pack_name]

    # Create Lemon Squeezy checkout
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.lemonsqueezy.com/v1/checkouts",
            headers={
                "Authorization": f"Bearer {os.getenv('LEMONSQUEEZY_API_KEY')}",
                "Content-Type": "application/vnd.api+json",
                "Accept": "application/vnd.api+json"
            },
            json={
                "data": {
                    "type": "checkouts",
                    "attributes": {
                        "checkout_data": {
                            "custom": {
                                "user_id": str(user.id),
                                "pack_name": request.pack_name,
                                "sparks_amount": pack["sparks"],
                                "purchase_type": "topup"
                            }
                        },
                        "product_options": {
                            "redirect_url": f"{os.getenv('CHECKOUT_SUCCESS_URL')}?topup=success"
                        }
                    },
                    "relationships": {
                        "store": {
                            "data": {"type": "stores", "id": os.getenv("LEMONSQUEEZY_STORE_ID")}
                        },
                        "variant": {
                            "data": {"type": "variants", "id": pack["variant_id"]}
                        }
                    }
                }
            }
        )

    if response.status_code != 201:
        raise HTTPException(status_code=500, detail="Failed to create checkout")

    checkout_url = response.json()["data"]["attributes"]["url"]
    return CheckoutResponse(checkout_url=checkout_url)
```

---

## 6. Integration with Scene Generation

### Updated Scene Generation (`app/routes/scenes.py`)

```python
# Replace quota check with credits check

from ..services.credits import CreditsService, InsufficientSparksError

@router.post("/generate")
async def generate_scene(
    request: SceneGenerationRequest,
    user = Depends(get_current_user),
    credits_service: CreditsService = Depends(get_credits_service),
    flux_service: FluxService = Depends(get_flux_service)
):
    # Check spark balance
    check = await credits_service.check_balance(user.id, "flux_generation")
    if not check.allowed:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,  # 402 for payment required
            detail={
                "error": "insufficient_sparks",
                "message": check.message,
                "balance": check.balance,
                "cost": check.cost,
                "upgrade_url": "/settings?tab=sparks"
            }
        )

    # Generate the scene
    try:
        scene = await flux_service.generate(request)

        # Spend sparks after successful generation
        await credits_service.spend(
            user_id=user.id,
            feature_key="flux_generation",
            reference_id=str(scene.id),
            metadata={"character_id": str(request.character_id)}
        )

        return scene
    except Exception as e:
        # Don't charge if generation fails
        raise HTTPException(status_code=500, detail="Generation failed")
```

---

## 7. Webhook Handler Updates

### Handle Top-Up Purchases (`app/routes/subscription.py`)

```python
# Add to existing webhook handler

@router.post("/webhooks/lemonsqueezy")
async def handle_webhook(request: Request, credits_service: CreditsService = Depends(get_credits_service)):
    # ... existing signature verification ...

    event_name = payload.get("meta", {}).get("event_name")
    custom_data = payload.get("meta", {}).get("custom_data", {})

    # Handle top-up purchase
    if event_name == "order_created" and custom_data.get("purchase_type") == "topup":
        user_id = custom_data.get("user_id")
        pack_name = custom_data.get("pack_name")
        sparks_amount = custom_data.get("sparks_amount")
        order_id = payload.get("data", {}).get("id")

        # Record purchase
        await db.table("topup_purchases").insert({
            "user_id": user_id,
            "ls_order_id": order_id,
            "ls_variant_id": custom_data.get("variant_id"),
            "pack_name": pack_name,
            "sparks_amount": sparks_amount,
            "price_cents": payload.get("data", {}).get("attributes", {}).get("total"),
            "status": "completed"
        }).execute()

        # Grant sparks
        await credits_service.grant_topup_sparks(
            user_id=UUID(user_id),
            pack_name=pack_name,
            amount=sparks_amount,
            order_id=order_id
        )

        return {"status": "ok"}

    # Handle subscription events (existing logic)
    if event_name == "subscription_created":
        # ... existing subscription logic ...

        # Grant initial sparks
        await credits_service.grant_subscription_sparks(
            user_id=UUID(user_id),
            subscription_id=subscription_id,
            is_premium=True
        )

    # ... rest of existing handler ...
```

---

## 8. Frontend Components

### useSparks Hook (`web/src/hooks/useSparks.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface SparkBalance {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

interface SparkCheck {
  allowed: boolean;
  balance: number;
  cost: number;
  balanceAfter: number;
  message?: string;
}

interface TopupPack {
  packName: string;
  sparks: number;
  priceCents: number;
  priceDisplay: string;
  perSparkCents: number;
  bonusPercent: number;
}

export function useSparks() {
  const queryClient = useQueryClient();

  const { data: balance, isLoading } = useQuery<SparkBalance>({
    queryKey: ['sparks', 'balance'],
    queryFn: () => api.credits.getBalance(),
  });

  const checkBalance = async (featureKey: string): Promise<SparkCheck> => {
    return api.credits.check(featureKey);
  };

  const { data: topupPacks } = useQuery<TopupPack[]>({
    queryKey: ['topup', 'packs'],
    queryFn: () => api.topup.getPacks(),
  });

  const purchaseTopup = useMutation({
    mutationFn: (packName: string) => api.topup.checkout(packName),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  const invalidateBalance = () => {
    queryClient.invalidateQueries({ queryKey: ['sparks'] });
  };

  return {
    balance: balance?.balance ?? 0,
    lifetimeEarned: balance?.lifetimeEarned ?? 0,
    lifetimeSpent: balance?.lifetimeSpent ?? 0,
    isLoading,
    checkBalance,
    topupPacks,
    purchaseTopup,
    invalidateBalance,

    // Computed
    isLow: (balance?.balance ?? 0) <= 5,
    isEmpty: (balance?.balance ?? 0) === 0,
  };
}
```

### SparkBalance Component (`web/src/components/sparks/SparkBalance.tsx`)

```tsx
import { Sparkles, Plus, TrendingUp } from 'lucide-react';
import { useSparks } from '@/hooks/useSparks';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SparkBalanceProps {
  compact?: boolean;
  showBuyButton?: boolean;
}

export function SparkBalance({ compact = false, showBuyButton = true }: SparkBalanceProps) {
  const { balance, isLow, isEmpty, isLoading } = useSparks();

  if (isLoading) {
    return <div className="animate-pulse h-8 w-20 bg-muted rounded" />;
  }

  return (
    <div className={cn(
      "flex items-center gap-2",
      compact ? "text-sm" : "text-base"
    )}>
      <div className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
        isEmpty ? "bg-red-500/10 text-red-500" :
        isLow ? "bg-amber-500/10 text-amber-500" :
        "bg-purple-500/10 text-purple-500"
      )}>
        <Sparkles className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <span className="font-semibold">{balance}</span>
        {!compact && <span className="text-muted-foreground">Sparks</span>}
      </div>

      {showBuyButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => window.location.href = '/settings?tab=sparks'}
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
```

### TopupPacks Component (`web/src/components/sparks/TopupPacks.tsx`)

```tsx
import { Sparkles, Zap, Crown } from 'lucide-react';
import { useSparks } from '@/hooks/useSparks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PACK_ICONS = {
  starter: Sparkles,
  popular: Zap,
  best_value: Crown,
};

export function TopupPacks() {
  const { topupPacks, purchaseTopup } = useSparks();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {topupPacks?.map((pack) => {
        const Icon = PACK_ICONS[pack.packName as keyof typeof PACK_ICONS] || Sparkles;
        const isPopular = pack.packName === 'popular';
        const isBestValue = pack.packName === 'best_value';

        return (
          <Card
            key={pack.packName}
            className={cn(
              "relative overflow-hidden transition-all hover:shadow-lg",
              isPopular && "border-purple-500 shadow-purple-500/20",
              isBestValue && "border-amber-500 shadow-amber-500/20"
            )}
          >
            {isPopular && (
              <Badge className="absolute top-2 right-2 bg-purple-500">
                Most Popular
              </Badge>
            )}
            {isBestValue && (
              <Badge className="absolute top-2 right-2 bg-amber-500">
                Best Value
              </Badge>
            )}

            <CardHeader className="text-center pb-2">
              <Icon className={cn(
                "h-8 w-8 mx-auto mb-2",
                isPopular ? "text-purple-500" :
                isBestValue ? "text-amber-500" :
                "text-muted-foreground"
              )} />
              <CardTitle className="capitalize">{pack.packName.replace('_', ' ')}</CardTitle>
            </CardHeader>

            <CardContent className="text-center space-y-4">
              <div>
                <span className="text-4xl font-bold">{pack.sparks}</span>
                <span className="text-muted-foreground ml-1">Sparks</span>
              </div>

              {pack.bonusPercent > 0 && (
                <Badge variant="secondary" className="text-green-600">
                  +{pack.bonusPercent}% bonus
                </Badge>
              )}

              <div className="text-sm text-muted-foreground">
                ${(pack.perSparkCents / 100).toFixed(2)} per Spark
              </div>

              <Button
                className="w-full"
                variant={isPopular ? "default" : "outline"}
                onClick={() => purchaseTopup.mutate(pack.packName)}
                disabled={purchaseTopup.isPending}
              >
                {pack.priceDisplay}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

### InsufficientSparksModal (`web/src/components/sparks/InsufficientSparksModal.tsx`)

```tsx
import { Sparkles, ShoppingCart, Crown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSparks } from '@/hooks/useSparks';
import { useSubscription } from '@/hooks/useSubscription';

interface InsufficientSparksModalProps {
  open: boolean;
  onClose: () => void;
  cost: number;
  featureName?: string;
}

export function InsufficientSparksModal({
  open,
  onClose,
  cost,
  featureName = 'this feature'
}: InsufficientSparksModalProps) {
  const { balance } = useSparks();
  const { isPremium, upgrade } = useSubscription();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Not Enough Sparks
          </DialogTitle>
          <DialogDescription>
            You need {cost} Spark{cost > 1 ? 's' : ''} for {featureName}, but you only have {balance}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {!isPremium && (
            <Button
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              onClick={() => {
                upgrade();
                onClose();
              }}
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Premium (100 Sparks/month)
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.href = '/settings?tab=sparks';
              onClose();
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Buy Spark Packs
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 9. Migration Strategy

### Phase 1: Database & Backend (Week 1)
1. Create migration `015_credits_system.sql`
2. Implement `CreditsService`
3. Add `/credits` and `/topup` routes
4. Update webhook handler for top-ups

### Phase 2: Integrate with Existing Features (Week 2)
1. Replace quota check in scene generation with spark check
2. Update subscription grant to use sparks
3. Migrate existing users:
   ```sql
   -- Grant sparks based on current quota usage
   UPDATE users SET spark_balance =
     CASE subscription_status
       WHEN 'premium' THEN 100 - COALESCE(flux_generations_used, 0)
       ELSE 5 - COALESCE(flux_generations_used, 0)
     END
   WHERE spark_balance = 0;
   ```

### Phase 3: Frontend (Week 3)
1. Implement `useSparks` hook
2. Build Spark components (balance, packs, modal)
3. Update Settings page with Sparks tab
4. Replace usage meter with spark balance display

### Phase 4: Launch Top-Ups (Week 4)
1. Create Lemon Squeezy variants for packs
2. Test full purchase flow
3. Enable top-up packs in UI

---

## 10. Future Extensibility

This system easily supports:

- **New features**: Just add row to `credit_costs` table
- **Dynamic pricing**: Update `spark_cost` without code changes
- **Promotions**: Grant bonus sparks via admin endpoint
- **Referrals**: Grant sparks when referee signs up
- **Daily rewards**: Scheduled job to grant small amounts
- **Achievements**: Grant sparks for milestones
- **Gifting**: Transfer sparks between users
- **Expiring credits**: Subscription sparks expire, purchased don't

---

## Summary

This credits system ("Sparks") provides:

1. **Abstraction** - Decouples user-facing economy from real costs
2. **Flexibility** - Easy to add features with different costs
3. **Monetization paths** - Subscription + top-ups + promotions
4. **Auditability** - Complete transaction ledger
5. **User experience** - Clear, themed currency with progress visibility
6. **Future-proof** - Ready for video, voice, and other features

The implementation builds on your existing Lemon Squeezy integration and database patterns, minimizing new infrastructure while maximizing flexibility.

---

## Appendix A: Feature Cost Reference

| Feature | Spark Cost | Real Cost | Enforcement | Notes |
|---------|------------|-----------|-------------|-------|
| **Chat Message** | **0 (FREE)** | ~$0.0004 | Rate limiting only | See Section 2.1 |
| Image Generation | 1 | ~$0.05 | Hard limit | Primary monetization |
| Video Generation | 15 | ~$1.00 | Hard limit | Future feature |
| Voice Message | 1 | ~$0.01 | Hard limit | Future feature |
| Premium Scene Unlock | 2-3 | $0 | Hard limit | Zero marginal cost |

---

## Appendix B: Decision Log

| Date | Decision | Rationale | Section |
|------|----------|-----------|---------|
| 2024-XX-XX | Messages are FREE | Cost too low ($0.0004) to justify UX damage; chat is core loop | 2.1 |
| 2024-XX-XX | Soft limits for free tier | Prevents abuse without hard denial; matches competitor patterns | 2.2 |
| 2024-XX-XX | Sparks abstraction layer | Enables flexible pricing for future features (video, voice) | 1, 2 |

---

## Appendix C: Future Considerations

### If Message Costs Need to Change

The system is designed to easily add message costs later if needed:

1. **Trigger conditions** for reconsidering free messages:
   - Switch to more expensive LLM (Claude, GPT-4) increasing cost >10x
   - Abuse patterns that rate limiting cannot contain
   - Business model pivot requiring message monetization

2. **Implementation path** if messages need to cost Sparks:
   - Update `credit_costs` table: `UPDATE credit_costs SET spark_cost = 1 WHERE feature_key = 'chat_message'`
   - Add Spark check to conversation service (code already in place, just needs activation)
   - Update rate limiting to work alongside Spark costs
   - Frontend already handles "insufficient sparks" modal

3. **Recommended approach** if monetizing messages:
   - Start with very low cost (0.1 Spark = 10 messages per Spark)
   - Bundle messages into conversation "sessions" rather than per-message
   - Consider daily free allowance before Sparks kick in

### Message Tracking Analytics

The current `messages_sent_count` and `usage_events` tracking should be used to:
- Monitor average messages per user per day/week/month
- Identify abuse patterns before they become costly
- Inform future pricing decisions with real data
- Calculate actual LLM costs per user segment
