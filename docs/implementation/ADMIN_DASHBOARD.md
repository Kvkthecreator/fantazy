# Admin Analytics Dashboard

## Overview
Build an admin dashboard at `/admin` that provides product analytics including user signups, engagement metrics, subscription/payment tracking, and usage patterns.

## Status: IMPLEMENTED

### Files Created/Modified:
- `substrate-api/api/src/app/routes/admin.py` - API endpoint
- `substrate-api/api/src/app/main.py` - Register admin router
- `web/src/lib/supabase/middleware.ts` - Add `/admin` to protected routes
- `web/src/lib/api/client.ts` - Add admin API methods
- `web/src/types/index.ts` - Admin types
- `web/src/app/admin/page.tsx` - Admin dashboard page

## Route & Access Control
- **Route:** `/app/admin/page.tsx` (single page, no route group needed)
- **Protection:** Reuse existing `isInternalEmail()` check in middleware
- Add `/admin` to protected routes in `middleware.ts`

## Dashboard Sections

### 1. Overview Cards (Top Row)
| Metric | Source |
|--------|--------|
| Total Users | `COUNT(*) FROM users` |
| Users (7d) | `COUNT(*) FROM users WHERE created_at > NOW() - 7 days` |
| Premium Users | `COUNT(*) FROM users WHERE subscription_status = 'premium'` |
| Total Revenue | `SUM(price_cents) FROM topup_purchases WHERE status = 'completed'` |

### 2. Signup Trends Chart
- Daily signups for last 30 days
- Query: `SELECT DATE(created_at), COUNT(*) FROM users GROUP BY DATE(created_at)`
- Simple CSS-based bar chart (no external charting library)

### 3. User Engagement Table
Show all users with key metrics:
| Column | Source |
|--------|--------|
| Name | `display_name` |
| Signup | `created_at` |
| Status | `subscription_status` |
| Messages | `messages_sent_count` |
| Images | `flux_generations_used` |
| Sparks | `spark_balance` |
| Sessions | `COUNT(*) FROM sessions` |
| Last Active | `MAX(last_interaction_at) FROM engagements` or derived |

Sortable columns, most recent first by default.

### 4. Revenue Breakdown
- Subscription vs Topup revenue
- Recent purchases table (last 10)
- Query: `SELECT * FROM topup_purchases ORDER BY created_at DESC LIMIT 10`

### 5. Content Engagement (Optional/Future)
- Most popular series/episodes
- Session completion rates
- Average messages per session

## Implementation Approach

### Backend: New API Endpoint
Single `/admin/stats` endpoint in the Python API that returns all dashboard data:

```python
# substrate-api/api/src/app/routes/admin.py
@router.get("/stats")
async def get_admin_stats():
    return {
        "overview": {...},
        "signups_by_day": [...],
        "users": [...],
        "purchases": [...]
    }
```

### Frontend: Single Page Component
```
/app/admin/page.tsx - Client component with data fetching
```

## UI Components
- Reuse shadcn: Card, Badge, Skeleton
- Simple CSS bar chart for signup trends
- Tailwind for layout (grid of cards)

## Security
- Admin route protected by `isInternalEmail()` (same as studio)
- API endpoint requires authentication + internal email check
- No new env vars needed
