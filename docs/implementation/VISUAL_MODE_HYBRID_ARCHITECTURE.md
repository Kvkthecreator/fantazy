# Visual Mode Hybrid Architecture

> **Status**: IMPLEMENTED (Backend) - Frontend Pending
> **Date**: 2024-12-24
> **Commit**: c298c187
> **Related**: MONETIZATION_v2.0.md, DIRECTOR_PROTOCOL.md v2.4

---

## Overview

Implements a **hybrid visual_mode system** that balances **episode-level creator intent** with **user-level accessibility/performance preferences**.

### Problem Solved

**Original Design** (MONETIZATION_v2.0.md, Decision 2):
- Episode templates define `visual_mode` (cinematic/minimal/none)
- Users had NO override capability
- Issues:
  - No accessibility opt-out (screen readers, cognitive load)
  - No performance control (slow connections, limited data, battery)
  - No user agency for personal preferences

**Proposed Solution**: All paid episodes default to `cinematic`, but allow user override

### Design Decision

**Hybrid Model**:
- **Episode sets default** (creator intent)
- **User can override** (accessibility/performance needs)
- **Default behavior unchanged** (episode_default or null = respect creator)

---

## Architecture

### Resolution Logic

```python
def resolve_visual_mode(episode_template, user_preferences):
    episode_visual_mode = episode_template.visual_mode  # cinematic/minimal/none
    user_override = user_preferences.get("visual_mode_override")

    if user_override == "always_off":
        return VisualMode.NONE  # Text-only mode
    elif user_override == "always_on":
        # Upgrade visuals
        if episode_visual_mode == VisualMode.NONE:
            return VisualMode.MINIMAL
        elif episode_visual_mode == VisualMode.MINIMAL:
            return VisualMode.CINEMATIC
        else:
            return episode_visual_mode
    else:  # "episode_default" or None
        return episode_visual_mode  # Respect creator intent
```

### User Preference Options

| Option | Behavior | Use Case |
|--------|----------|----------|
| `"always_off"` | Force `visual_mode=none` | Accessibility (screen readers), Performance (slow connection), Data saving, Personal preference |
| `"always_on"` | Upgrade visuals (none→minimal→cinematic) | Power users who want maximum visuals even on text-focused episodes |
| `"episode_default"` or `null` | Respect episode template | Default behavior (most users) |

### Database Schema

**users table** (existing):
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    preferences JSONB DEFAULT '{}'::jsonb,
    ...
);
```

**Preferences structure** (after update):
```json
{
    "notification_enabled": true,
    "theme": "system",
    "visual_mode_override": "episode_default"  // NEW
}
```

**episode_templates table** (existing):
```sql
CREATE TABLE episode_templates (
    id UUID PRIMARY KEY,
    visual_mode TEXT DEFAULT 'none',  -- 'cinematic' | 'minimal' | 'none'
    generation_budget INTEGER DEFAULT 0,
    episode_cost INTEGER DEFAULT 3,
    ...
);
```

---

## Implementation

### Phase 1: Backend Model ✅

**File**: `substrate-api/api/src/app/models/user.py`

```python
class UserPreferences(BaseModel):
    """User preferences stored as JSON."""
    notification_enabled: bool = True
    notification_time: Optional[str] = None
    theme: str = "system"
    language: str = "en"
    vibe_preference: Optional[str] = None
    visual_mode_override: Optional[str] = None  # NEW
```

### Phase 2: Director Service ✅

**File**: `substrate-api/api/src/app/services/director.py`

**New Methods**:
1. `_get_user_preferences(user_id)` - Fetch from database
2. `_resolve_visual_mode_with_user_preference(episode_visual_mode, user_preferences)` - Resolution logic

**Updated Methods**:
1. `decide_actions()` - Now async, accepts `user_preferences` parameter
2. `process_exchange()` - Fetches user preferences before calling `decide_actions()`
3. Visual decisions logging - Uses resolved visual_mode

**Logging**:
```python
# Debug logs show when override is applied
log.debug(f"User override: always_off, forcing visual_mode=none")
log.debug(f"User override: always_on, upgrading minimal → cinematic")
log.debug(f"User override: episode_default, respecting episode visual_mode={episode_visual_mode}")
```

### Phase 3: Database Migration 🔄 (Pending)

**File**: `docs/implementation/VISUAL_MODE_MIGRATION.sql`

**Updates**:
1. All paid episodes (`episode_cost > 0`): `visual_mode = 'cinematic'`, `generation_budget = 3`
2. Episode 0 (free entry): `visual_mode = 'cinematic'`, `generation_budget = 2`
3. Play Mode: Already `visual_mode = 'cinematic'` (no change)

**Rationale**:
- Auto-gen is "included in episode price" (Ticket + Moments model)
- Users expect visuals when paying 3 Sparks
- Users can still opt-out via `visual_mode_override = "always_off"`

**Execution**:
```bash
# When database connection stabilizes
psql -h <host> -U <user> -d <db> -f docs/implementation/VISUAL_MODE_MIGRATION.sql
```

### Phase 4: Frontend Settings UI ⏳ (Pending)

**Proposed Location**: `/settings` or `/profile/preferences`

**UI Mockup**:
```tsx
<SettingsSection title="Visual Experience">
  <RadioGroup value={visualOverride} onChange={updatePreference}>
    <Radio value="episode_default">
      <strong>Follow episode design</strong> (recommended)
      <Text size="sm" color="muted">
        Let creators control the visual experience
      </Text>
    </Radio>

    <Radio value="always_off">
      <strong>Text-only mode</strong>
      <Text size="sm" color="muted">
        Disable auto-generation (accessibility, performance, data-saving)
      </Text>
    </Radio>

    <Radio value="always_on">
      <strong>Maximum visuals</strong>
      <Text size="sm" color="muted">
        Enable visuals even on text-focused episodes
      </Text>
    </Radio>
  </RadioGroup>
</SettingsSection>
```

**API Integration**:
```typescript
// Update user preferences
await api.users.updatePreferences({
  visual_mode_override: "always_off"
});
```

---

## Benefits

| Aspect | Before (Episode-Only) | After (Hybrid) |
|--------|----------------------|----------------|
| **Creator control** | ✅ Full | ✅ Respected by default |
| **User accessibility** | ❌ No opt-out | ✅ Can disable auto-gen |
| **Performance control** | ❌ No control | ✅ User can save data |
| **Cost predictability** | ✅ Same | ✅ Same (override doesn't change episode price) |
| **UX complexity** | ✅ Simple | ⚠️ Slightly more complex (but opt-in) |
| **Edge cases** | ❌ No flexibility | ✅ Supports accessibility/performance needs |

---

## Use Cases

### Use Case 1: Default User (No Override)

**Setup**: User has `visual_mode_override = null` or `"episode_default"`

**Behavior**:
- Paid episodes with `visual_mode = "cinematic"` → 3 auto-gens at narrative beats
- Episode 0 with `visual_mode = "cinematic"` → 2 auto-gens
- Play Mode → Respects episode setting
- **User experience**: Unchanged from episode-level design

### Use Case 2: Accessibility User (always_off)

**Setup**: User is vision-impaired, using screen reader

**Behavior**:
- Sets `visual_mode_override = "always_off"`
- ALL episodes force `visual_mode = none`
- No auto-gen images interrupt screen reader flow
- Manual "Capture Moment" still available (user's choice)
- **User experience**: Text-only, no interruptions

### Use Case 3: Data-Conscious User (always_off)

**Setup**: User on limited mobile data plan

**Behavior**:
- Sets `visual_mode_override = "always_off"`
- Saves ~0.5-1MB per episode (3-4 images * ~200KB each)
- Can re-enable when on WiFi
- **User experience**: Faster load times, data savings

### Use Case 4: Visual Enthusiast (always_on)

**Setup**: User wants maximum visuals even on text-focused episodes

**Behavior**:
- Sets `visual_mode_override = "always_on"`
- Episodes with `visual_mode = "none"` upgrade to `"minimal"` (1 image)
- Episodes with `visual_mode = "minimal"` upgrade to `"cinematic"` (3 images)
- **User experience**: Rich visual experience across all content

---

## Testing

### Backend Testing

**Test 1: User with no override (default)**
```python
user_preferences = {}  # or {"visual_mode_override": "episode_default"}
episode = EpisodeTemplate(visual_mode="cinematic")

resolved = director._resolve_visual_mode_with_user_preference(
    episode.visual_mode, user_preferences
)
assert resolved == VisualMode.CINEMATIC  # No change
```

**Test 2: User with always_off**
```python
user_preferences = {"visual_mode_override": "always_off"}
episode = EpisodeTemplate(visual_mode="cinematic")

resolved = director._resolve_visual_mode_with_user_preference(
    episode.visual_mode, user_preferences
)
assert resolved == VisualMode.NONE  # Forced to none
```

**Test 3: User with always_on (upgrade none→minimal)**
```python
user_preferences = {"visual_mode_override": "always_on"}
episode = EpisodeTemplate(visual_mode="none")

resolved = director._resolve_visual_mode_with_user_preference(
    episode.visual_mode, user_preferences
)
assert resolved == VisualMode.MINIMAL  # Upgraded
```

**Test 4: User with always_on (upgrade minimal→cinematic)**
```python
user_preferences = {"visual_mode_override": "always_on"}
episode = EpisodeTemplate(visual_mode="minimal")

resolved = director._resolve_visual_mode_with_user_preference(
    episode.visual_mode, user_preferences
)
assert resolved == VisualMode.CINEMATIC  # Upgraded
```

### End-to-End Testing

1. **Setup**: Create test user with premium subscription
2. **Baseline**: Chat in cinematic episode, verify 3 auto-gens appear
3. **Override to always_off**: Update preferences, refresh chat, verify NO auto-gens
4. **Override to always_on**: Update preferences, chat in minimal episode, verify 3 auto-gens (upgraded)
5. **Reset to default**: Update preferences, verify episode default respected

---

## Rollout Plan

### Stage 1: Backend Deployment ✅

**Status**: COMPLETED (commit c298c187)

**Actions**:
- Deploy backend changes (UserPreferences, DirectorService)
- Existing users: `visual_mode_override = null` (default behavior)
- No user-facing changes yet

**Risk**: Low (additive change, no breaking behavior)

### Stage 2: Database Migration 🔄

**Status**: READY (VISUAL_MODE_MIGRATION.sql)

**Actions**:
- Execute migration script when database connection stabilizes
- Update paid episodes to cinematic
- Verify distribution matches expectations

**Risk**: Low (episodes already have visual_mode field, just changing values)

### Stage 3: Frontend UI ⏳

**Status**: PENDING

**Actions**:
- Add settings page/section for visual preferences
- API integration for updating user preferences
- User education (tooltip/help text explaining options)

**Risk**: Medium (UX complexity, user education needed)

### Stage 4: Monitoring 📊

**Metrics to Track**:
- `visual_mode_override` distribution (% using always_off, always_on, default)
- Auto-gen trigger rate before/after override
- User feedback on accessibility improvements
- Manual generation frequency (does always_off increase manual gens?)

**Success Criteria**:
- < 5% of users use always_off (accessibility/performance edge cases)
- < 1% of users use always_on (power users)
- > 94% of users use default (episode-driven design works for most)
- No increase in support tickets about unexpected visual behavior

---

## Open Questions

1. **Settings UI Placement**: Should visual preferences be in:
   - General settings (/settings)
   - Profile preferences (/profile/preferences)
   - Episode-specific override (per-episode toggle)?

2. **User Education**: How to communicate:
   - Default behavior (respect creator intent)
   - When to use always_off (accessibility, performance)
   - When to use always_on (visual enthusiasts)

3. **Analytics**: Should we track:
   - Why users disable visuals? (survey prompt on always_off selection)
   - Correlation between visual_mode and engagement metrics?

4. **Future Enhancements**:
   - Per-series override? (e.g., "always cinematic for this character")
   - Adaptive mode? (auto-disable on slow connection)
   - Preview mode? (show what episode would look like with override)

---

## Related Documents

- [MONETIZATION_v2.0.md](../monetization/MONETIZATION_v2.0.md) - Original episode-level visual_mode design
- [DIRECTOR_PROTOCOL.md v2.4](../quality/core/DIRECTOR_PROTOCOL.md) - Hybrid visual trigger model
- [VISUAL_MODE_MIGRATION.sql](./VISUAL_MODE_MIGRATION.sql) - Database migration script
- [IMAGE_GENERATION.md v1.2](../quality/modalities/IMAGE_GENERATION.md) - Auto-gen strategy
- [CHANGELOG.md](../quality/CHANGELOG.md) - Implementation history

---

**End of Visual Mode Hybrid Architecture Document**
