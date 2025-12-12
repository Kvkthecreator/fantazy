# Image Generation Costs & Subscription Model

## Overview

This document outlines the cost structure for character image generation and the proposed subscription model for Fantazy.

---

## Visual Rendering Approaches

### Approach Comparison

| Approach | Cost | Quality | Use Case |
|----------|------|---------|----------|
| Pre-generated Library | ~$0.05/image (one-time) | Good | Filler scenes, common scenarios |
| Runtime Flux Generation | ~$0.05/image (per use) | Excellent | High-impact moments, user-triggered |
| Overlay/Parallax | ~$0 (CSS only) | Limited | Simple VN-style presentations |

### Strategic Recommendation

Focus on **pre-generated library + sparse Flux moments** rather than complex overlay systems:
- Pre-generate 20-30 images per character covering common scenarios
- Reserve runtime Flux generation for high-impact story moments
- Overlay approach has positioning limitations (avatar poses don't fit all backgrounds naturally)

---

## Cost Breakdown

### Pre-Generated Library (One-Time)

| Item | Cost | Notes |
|------|------|-------|
| Per image (Flux) | ~$0.05 | BFL API pricing |
| Per character (20 images) | ~$1.00 | Covers common scenarios |
| Per character (30 images) | ~$1.50 | Extended coverage |
| 10 launch characters | ~$10-15 | Negligible startup cost |

**Batch generation is economically negligible** - even 100 characters with 30 images each = ~$150 total.

### Runtime Flux Generation (Per Use)

| Usage Pattern | Images/Month | Cost/User/Month |
|---------------|--------------|-----------------|
| Light user | 5 scenes | ~$0.25 |
| Average user | 20 scenes | ~$1.00 |
| Heavy user | 50 scenes | ~$2.50 |

### Chat API Costs (LLM)

| Usage Level | Est. Cost/User/Month |
|-------------|---------------------|
| Light | ~$0.50-1.00 |
| Average | ~$1.00-2.00 |
| Heavy | ~$2.00-4.00 |

---

## Subscription Model

### Tier Structure

#### Free Tier
- Access to pre-generated image library
- Basic chat functionality
- Limited daily messages
- **Cost to serve**: ~$0.50-1.00/active user/month

#### Premium Tier ($19/month)
- Unlimited chat
- **50 Flux scene generations per month**
- Priority features
- Custom character requests
- **Cost to serve**: ~$5-7/active user/month

### Margin Analysis

| Tier | Revenue | Est. Cost | Gross Margin |
|------|---------|-----------|--------------|
| Free | $0 | ~$0.50-1.00 | Negative (acquisition) |
| Premium | $19 | ~$7 | **~63%** |

---

## Competitor Benchmarks

| Platform | Free Tier | Premium Price | Notes |
|----------|-----------|---------------|-------|
| Character.ai | Limited msgs | $10/month (c.ai+) | No image gen |
| NovelAI | Trial | $10-25/month | Image gen included |
| Replika | Basic chat | $15-20/month | Voice, AR features |
| Crushon.ai | Limited | $10-30/month | NSFW focus |

**Key insight**: $10-15/month is validated market pricing for AI companion apps.

---

## Economic Viability

### Unit Economics (Premium User)

```
Revenue:              $19.00/month
- Lemon Squeezy fee:  -$1.45 (~5% + $0.50)
- Flux costs:         -$2.50 (50 images)
- Chat API:           -$2.00 (average usage)
- Infra/other:        -$1.00
= Net margin:         $12.05/user/month (~63%)
```

### Scaling Considerations

- **Library generation**: Fixed cost, scales with characters not users
- **Runtime Flux**: Scales linearly with usage (capped by quota)
- **Chat API**: Primary variable cost, scales with engagement

### Risk Mitigation

1. **Quota caps** on Flux generation prevent runaway costs
2. **Library-first strategy** reduces runtime generation needs
3. **Usage-based premium** tiers can capture heavy users

---

## Implementation Notes

### Library Generation Strategy

1. Define 20-30 common scene types per character:
   - Emotional states (happy, sad, surprised, angry, embarrassed)
   - Settings (bedroom, cafe, school, park, night scene)
   - Actions (waving, sitting, standing, close-up)

2. Batch generate during character creation
3. Store in CDN for fast delivery
4. Cost is amortized across all users

### Runtime Generation Triggers

Reserve Flux generation for:
- User-requested custom scenes
- Story milestone moments
- Special character interactions
- Premium feature unlocks

---

## Summary

The hybrid approach (pre-generated library + selective Flux) provides:
- **Low marginal cost** per user
- **High-quality visuals** when they matter
- **Sustainable margins** at $19/month pricing (~63%)
- **Competitive positioning** in the AI companion market
