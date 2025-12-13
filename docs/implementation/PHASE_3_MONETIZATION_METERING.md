# Phase 3: Monetization Metering

> **Goal**: Close the monetization loop by implementing usage tracking and quota enforcement for image generation, with passive message tracking for analytics.

---

## Context

### What Exists
- Lemon Squeezy subscription integration (checkout, webhooks, portal)
- `subscription_status` field on users (`free`, `premium`, `cancelled`)
- Pricing decision: $19/month, 50 Flux generations/month
- FLUX Kontext scene generation via Replicate
- Frontend subscription components and settings page

### What's Missing
- **No usage tracking** - Can't measure how many images a user has generated
- **No quota enforcement** - Free and premium users have unlimited generation access
- **No upgrade moments** - No natural prompts to convert free → paid
- **No usage visibility** - Users can't see their remaining credits

---

## Design Decisions

### 1. Flux Metering: Track + Enforce

Image generation is the primary cost lever (~$0.05/image) and the natural premium gate.

| User Type | Monthly Quota | Behavior at Limit |
|-----------|---------------|-------------------|
| Free | 5 images | Soft block + upgrade prompt |
| Premium | 50 images | Soft block + top-up prompt (future) |

**Why these numbers:**
- Free tier (5): Enough to experience the feature, not enough to abuse
- Premium tier (50): ~$2.50 cost, leaves healthy margin at $19 price point

### 2. Message Metering: Track Only (No Enforcement)

LLM costs are secondary (~$0.01-0.02/message) and gating hurts the core loop.

| Tracking | Enforcement |
|----------|-------------|
| Yes - count messages per period | No - unlimited for all tiers |

**Rationale:**
- Chat volume drives emotional connection drives retention
- Need usage data before setting limits
- Cost absorbed in subscription margin
- Revisit after 30-60 days with real data

### 3. Billing Period Alignment

Reset counters on subscription renewal date (not calendar month).

- Premium users: reset on `subscription_renews_at`
- Free users: reset on 1st of each month (simpler)

---

## Database Schema

### Migration: `014_usage_tracking.sql`

```sql
-- Usage tracking for metered features
-- Tracks Flux generations (enforced) and messages (analytics only)

-- Add usage tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS
    flux_generations_used INTEGER DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS
    flux_generations_reset_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE users ADD COLUMN IF NOT EXISTS
    messages_sent_count INTEGER DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS
    messages_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Usage history for analytics and debugging
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,  -- 'flux_generation', 'message_sent'
    metadata JSONB DEFAULT '{}',  -- character_id, episode_id, model_used, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user
    ON usage_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_type
    ON usage_events(event_type, created_at DESC);

-- Function to get user's Flux quota based on subscription status
CREATE OR REPLACE FUNCTION get_flux_quota(sub_status TEXT)
RETURNS INTEGER AS $$
BEGIN
    CASE sub_status
        WHEN 'premium' THEN RETURN 50;
        WHEN 'free' THEN RETURN 5;
        ELSE RETURN 5;  -- Default to free tier
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- View for current usage stats (convenience)
CREATE OR REPLACE VIEW user_usage_stats AS
SELECT
    u.id,
    u.subscription_status,
    u.flux_generations_used,
    get_flux_quota(u.subscription_status) as flux_quota,
    get_flux_quota(u.subscription_status) - u.flux_generations_used as flux_remaining,
    u.flux_generations_reset_at,
    u.messages_sent_count,
    u.messages_reset_at
FROM users u;
```

---

## Backend Implementation

### 1. Usage Models

```python
# substrate-api/api/src/app/models/usage.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal

class UsageStats(BaseModel):
    """Current usage statistics for a user."""
    flux_used: int
    flux_quota: int
    flux_remaining: int
    flux_resets_at: datetime
    messages_sent: int
    messages_resets_at: datetime
    subscription_status: str

class UsageEvent(BaseModel):
    """A single usage event for tracking."""
    event_type: Literal["flux_generation", "message_sent"]
    metadata: dict = {}

class QuotaCheckResult(BaseModel):
    """Result of checking if user can perform an action."""
    allowed: bool
    current_usage: int
    quota: int
    remaining: int
    message: Optional[str] = None
```

### 2. Usage Service

```python
# substrate-api/api/src/app/services/usage.py

from datetime import datetime, timezone
from typing import Optional
import logging

from app.deps import get_database
from app.models.usage import UsageStats, QuotaCheckResult

logger = logging.getLogger(__name__)

FLUX_QUOTA_FREE = 5
FLUX_QUOTA_PREMIUM = 50

class UsageService:
    """Handles usage tracking and quota enforcement."""

    _instance: Optional["UsageService"] = None

    @classmethod
    def get_instance(cls) -> "UsageService":
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
        db = get_database()

        row = await db.fetch_one("""
            SELECT
                subscription_status,
                flux_generations_used,
                flux_generations_reset_at,
                messages_sent_count,
                messages_reset_at
            FROM users
            WHERE id = :user_id
        """, {"user_id": user_id})

        if not row:
            raise ValueError(f"User {user_id} not found")

        quota = self._get_flux_quota(row["subscription_status"])

        return UsageStats(
            flux_used=row["flux_generations_used"] or 0,
            flux_quota=quota,
            flux_remaining=max(0, quota - (row["flux_generations_used"] or 0)),
            flux_resets_at=row["flux_generations_reset_at"],
            messages_sent=row["messages_sent_count"] or 0,
            messages_resets_at=row["messages_reset_at"],
            subscription_status=row["subscription_status"] or "free"
        )

    async def check_flux_quota(self, user_id: str) -> QuotaCheckResult:
        """Check if user can generate a Flux image."""
        stats = await self.get_usage_stats(user_id)

        # Check if reset is needed
        await self._maybe_reset_flux_counter(user_id, stats)

        # Re-fetch after potential reset
        stats = await self.get_usage_stats(user_id)

        allowed = stats.flux_remaining > 0

        message = None
        if not allowed:
            if stats.subscription_status == "free":
                message = "You've used all your free image generations this month. Upgrade to Premium for 50 generations/month."
            else:
                message = "You've reached your monthly image generation limit. Your quota resets on your next billing date."

        return QuotaCheckResult(
            allowed=allowed,
            current_usage=stats.flux_used,
            quota=stats.flux_quota,
            remaining=stats.flux_remaining,
            message=message
        )

    async def increment_flux_usage(
        self,
        user_id: str,
        character_id: Optional[str] = None,
        episode_id: Optional[str] = None,
        model_used: Optional[str] = None
    ) -> UsageStats:
        """Increment Flux usage counter and log event."""
        db = get_database()

        # Increment counter
        await db.execute("""
            UPDATE users
            SET flux_generations_used = COALESCE(flux_generations_used, 0) + 1,
                updated_at = NOW()
            WHERE id = :user_id
        """, {"user_id": user_id})

        # Log event for analytics
        await db.execute("""
            INSERT INTO usage_events (user_id, event_type, metadata)
            VALUES (:user_id, 'flux_generation', :metadata)
        """, {
            "user_id": user_id,
            "metadata": {
                "character_id": character_id,
                "episode_id": episode_id,
                "model_used": model_used
            }
        })

        logger.info(f"Flux usage incremented for user {user_id}")

        return await self.get_usage_stats(user_id)

    async def increment_message_count(
        self,
        user_id: str,
        character_id: Optional[str] = None,
        episode_id: Optional[str] = None
    ) -> None:
        """Increment message counter (tracking only, no enforcement)."""
        db = get_database()

        # Increment counter
        await db.execute("""
            UPDATE users
            SET messages_sent_count = COALESCE(messages_sent_count, 0) + 1,
                updated_at = NOW()
            WHERE id = :user_id
        """, {"user_id": user_id})

        # Log event for analytics
        await db.execute("""
            INSERT INTO usage_events (user_id, event_type, metadata)
            VALUES (:user_id, 'message_sent', :metadata)
        """, {
            "user_id": user_id,
            "metadata": {
                "character_id": character_id,
                "episode_id": episode_id
            }
        })

    async def _maybe_reset_flux_counter(self, user_id: str, stats: UsageStats) -> bool:
        """Reset Flux counter if billing period has passed."""
        db = get_database()
        now = datetime.now(timezone.utc)

        # For premium users, check against subscription renewal
        # For free users, reset on 1st of month
        should_reset = False

        if stats.subscription_status == "premium":
            # Fetch subscription renewal date
            row = await db.fetch_one("""
                SELECT subscription_expires_at
                FROM users
                WHERE id = :user_id
            """, {"user_id": user_id})

            if row and row["subscription_expires_at"]:
                # If we're past the reset date but before expiry, reset
                # This handles the case where renewal happened
                if stats.flux_resets_at < row["subscription_expires_at"] and now >= stats.flux_resets_at:
                    # Calculate next reset (1 month from last reset)
                    from dateutil.relativedelta import relativedelta
                    next_reset = stats.flux_resets_at + relativedelta(months=1)
                    if now >= next_reset:
                        should_reset = True
        else:
            # Free users: reset on 1st of each month
            current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if stats.flux_resets_at < current_month_start:
                should_reset = True

        if should_reset:
            await db.execute("""
                UPDATE users
                SET flux_generations_used = 0,
                    flux_generations_reset_at = NOW(),
                    updated_at = NOW()
                WHERE id = :user_id
            """, {"user_id": user_id})
            logger.info(f"Reset Flux counter for user {user_id}")
            return True

        return False

    async def reset_on_subscription_change(self, user_id: str) -> None:
        """Reset counters when subscription status changes (upgrade/downgrade)."""
        db = get_database()

        await db.execute("""
            UPDATE users
            SET flux_generations_used = 0,
                flux_generations_reset_at = NOW(),
                updated_at = NOW()
            WHERE id = :user_id
        """, {"user_id": user_id})

        logger.info(f"Reset usage counters for user {user_id} on subscription change")
```

### 3. Integration Points

#### Scene Generation (enforce quota)

```python
# In substrate-api/api/src/app/routes/scenes.py

from app.services.usage import UsageService

@router.post("/scenes/generate")
async def generate_scene(
    request: SceneGenerateRequest,
    user = Depends(get_current_user)
):
    usage_service = UsageService.get_instance()

    # Check quota before generation
    quota_check = await usage_service.check_flux_quota(str(user.id))

    if not quota_check.allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "quota_exceeded",
                "message": quota_check.message,
                "usage": {
                    "used": quota_check.current_usage,
                    "quota": quota_check.quota,
                    "remaining": quota_check.remaining
                }
            }
        )

    # Generate the scene...
    result = await generate_flux_scene(...)

    # Increment usage after successful generation
    await usage_service.increment_flux_usage(
        user_id=str(user.id),
        character_id=request.character_id,
        episode_id=request.episode_id,
        model_used="flux-kontext"
    )

    return result
```

#### Conversation (track messages, no enforcement)

```python
# In substrate-api/api/src/app/services/conversation.py

from app.services.usage import UsageService

async def send_message(self, episode_id: str, content: str, user_id: str):
    # ... existing message handling ...

    # Track message (fire and forget, don't block on this)
    usage_service = UsageService.get_instance()
    await usage_service.increment_message_count(
        user_id=user_id,
        character_id=episode.character_id,
        episode_id=episode_id
    )

    # ... continue with LLM call ...
```

#### Subscription Webhook (reset on upgrade)

```python
# In substrate-api/api/src/app/routes/subscription.py

from app.services.usage import UsageService

async def handle_subscription_created(user_id: str, payload: dict):
    # ... existing subscription handling ...

    # Reset usage counters on upgrade
    usage_service = UsageService.get_instance()
    await usage_service.reset_on_subscription_change(user_id)
```

---

## API Endpoints

### GET /users/me/usage

Returns current usage statistics.

**Response:**
```json
{
    "flux": {
        "used": 12,
        "quota": 50,
        "remaining": 38,
        "resets_at": "2025-01-13T00:00:00Z"
    },
    "messages": {
        "sent": 247,
        "resets_at": "2025-01-13T00:00:00Z"
    },
    "subscription_status": "premium"
}
```

### Implementation

```python
# In substrate-api/api/src/app/routes/users.py

@router.get("/users/me/usage")
async def get_my_usage(user = Depends(get_current_user)):
    usage_service = UsageService.get_instance()
    stats = await usage_service.get_usage_stats(str(user.id))

    return {
        "flux": {
            "used": stats.flux_used,
            "quota": stats.flux_quota,
            "remaining": stats.flux_remaining,
            "resets_at": stats.flux_resets_at.isoformat()
        },
        "messages": {
            "sent": stats.messages_sent,
            "resets_at": stats.messages_resets_at.isoformat()
        },
        "subscription_status": stats.subscription_status
    }
```

---

## Frontend Integration

### 1. Usage Hook

```typescript
// web/src/hooks/useUsage.ts

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface UsageStats {
    flux: {
        used: number;
        quota: number;
        remaining: number;
        resets_at: string;
    };
    messages: {
        sent: number;
        resets_at: string;
    };
    subscription_status: string;
}

export function useUsage() {
    return useQuery<UsageStats>({
        queryKey: ['usage'],
        queryFn: async () => {
            const response = await apiClient.get('/users/me/usage');
            return response.data;
        },
        staleTime: 30 * 1000, // 30 seconds
        refetchOnWindowFocus: true
    });
}
```

### 2. Usage Display Component

```typescript
// web/src/components/usage/UsageMeter.tsx

'use client';

import { useUsage } from '@/hooks/useUsage';
import { Progress } from '@/components/ui/progress';

export function UsageMeter() {
    const { data: usage, isLoading } = useUsage();

    if (isLoading || !usage) return null;

    const percentage = (usage.flux.used / usage.flux.quota) * 100;
    const isLow = usage.flux.remaining <= 5;
    const isEmpty = usage.flux.remaining === 0;

    return (
        <div className="p-4 rounded-lg bg-muted">
            <div className="flex justify-between text-sm mb-2">
                <span>Image generations</span>
                <span className={isEmpty ? 'text-destructive' : isLow ? 'text-warning' : ''}>
                    {usage.flux.remaining} remaining
                </span>
            </div>
            <Progress
                value={percentage}
                className={isEmpty ? 'bg-destructive/20' : ''}
            />
            <p className="text-xs text-muted-foreground mt-1">
                {usage.flux.used} of {usage.flux.quota} used this month
            </p>
        </div>
    );
}
```

### 3. Quota Exceeded Modal

```typescript
// web/src/components/usage/QuotaExceededModal.tsx

'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { UpgradeButton } from '@/components/subscription/UpgradeButton';
import { useUsage } from '@/hooks/useUsage';

interface QuotaExceededModalProps {
    open: boolean;
    onClose: () => void;
}

export function QuotaExceededModal({ open, onClose }: QuotaExceededModalProps) {
    const { data: usage } = useUsage();
    const isFree = usage?.subscription_status === 'free';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isFree ? 'Upgrade to Continue' : 'Monthly Limit Reached'}
                    </DialogTitle>
                    <DialogDescription>
                        {isFree ? (
                            <>
                                You've used all {usage?.flux.quota} free image generations
                                this month. Upgrade to Premium for {50} generations per month.
                            </>
                        ) : (
                            <>
                                You've used all {usage?.flux.quota} image generations
                                this month. Your quota will reset on your next billing date.
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {isFree && (
                    <div className="mt-4">
                        <UpgradeButton className="w-full" />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

### 4. Integration in Scene Generation

```typescript
// Example: in scene generation button/component

const [showQuotaModal, setShowQuotaModal] = useState(false);

async function handleGenerateScene() {
    try {
        const result = await apiClient.post('/scenes/generate', { ... });
        // Handle success
    } catch (error) {
        if (error.response?.status === 429) {
            setShowQuotaModal(true);
        } else {
            // Handle other errors
        }
    }
}

return (
    <>
        <Button onClick={handleGenerateScene}>Generate Scene</Button>
        <QuotaExceededModal
            open={showQuotaModal}
            onClose={() => setShowQuotaModal(false)}
        />
    </>
);
```

---

## Settings Page Updates

Add usage display to the existing settings page:

```typescript
// In web/src/app/(dashboard)/settings/page.tsx

import { UsageMeter } from '@/components/usage/UsageMeter';

// Add to the settings page layout:
<section>
    <h2>Usage This Month</h2>
    <UsageMeter />
</section>
```

---

## Implementation Checklist

### Database
- [x] Create migration `014_usage_tracking.sql`
- [ ] Run migration on Supabase

### Backend
- [x] Create `models/usage.py`
- [x] Create `services/usage.py`
- [x] Add `GET /users/me/usage` endpoint
- [x] Integrate quota check in scene generation
- [x] Integrate message tracking in conversation service
- [x] Add usage reset to subscription webhook handler

### Frontend
- [x] Create `hooks/useUsage.ts`
- [x] Create `components/usage/UsageMeter.tsx`
- [x] Create `components/usage/QuotaExceededModal.tsx`
- [x] Add usage display to settings page
- [x] Handle 429 responses in scene generation UI

### Testing
- [ ] Test quota enforcement (free user hits 5 limit)
- [ ] Test quota enforcement (premium user hits 50 limit)
- [ ] Test counter reset on month rollover
- [ ] Test counter reset on subscription upgrade
- [ ] Test message tracking doesn't block chat flow

---

## Future Considerations (Not in Scope)

### Top-Up Credit Packs
If users want more generations mid-cycle, consider:
- One-time purchase packs (10 for $X, 25 for $Y)
- These would add to a separate `bonus_credits` field
- Bonus credits don't reset monthly

### Message Limits
If analytics show problematic usage patterns:
- Add soft limits (warning at N messages)
- Add hard limits (block at M messages)
- Differentiate free/premium limits

### Usage Analytics Dashboard
For internal monitoring:
- Daily/weekly generation counts
- User distribution (power users vs casual)
- Cost tracking and margin analysis

---

## Success Criteria

Phase 3 is complete when:
1. Free users are limited to 5 Flux generations/month
2. Premium users are limited to 50 Flux generations/month
3. Users see their usage stats in settings
4. Quota exceeded triggers upgrade prompt for free users
5. Message counts are tracked (visible in analytics, not enforced)
6. Counters reset appropriately on billing cycle
