# Character Data Model

> **Version**: 1.0.0
> **Updated**: 2024-12-23
> **Status**: Canonical

This document defines the authoritative character data model after the December 2024 simplification. It serves as a reference for understanding what fields affect prompt generation.

---

## Field Categories

### 1. Fields That Affect System Prompt

These fields trigger system prompt regeneration when changed:

| Field | Type | UI Location | Prompt Usage |
|-------|------|-------------|--------------|
| `name` | string | Overview | Opening line of prompt |
| `archetype` | string | Overview | Opening line + implicit behavior |
| `genre` | string | Overview | Determines doctrine (romantic_tension, psychological_thriller) |
| `baseline_personality` | JSONB | Overview (JSON) | `traits` array extracted → personality section |
| `boundaries.flirting_level` | string | Overview (Energy Level) | Energy description in prompt |
| `tone_style` | JSONB | - | Formality, emoji, ellipsis guidance |
| `speech_patterns` | JSONB | - | Greetings, thinking words, affirmations |
| `backstory` | text | Backstory tab | "YOUR BACKSTORY" section |
| `likes` | string[] | Backstory tab | "YOUR PREFERENCES" (first 5) |
| `dislikes` | string[] | Backstory tab | "YOUR PREFERENCES" (first 5) |

### 2. Fields That DON'T Affect System Prompt

| Field | Type | Purpose |
|-------|------|---------|
| `avatar_url` | string | Display only |
| `status` | string | draft/active state |
| `content_rating` | string | Content filtering (not in prompt) |
| `world_id` | UUID | Optional world attachment |
| `categories` | string[] | Discovery/filtering |
| `is_premium` | boolean | Monetization |

### 3. Fields Stored Elsewhere

| Field | Actual Location | Reason |
|-------|-----------------|--------|
| `opening_situation` | episode_templates (is_default=TRUE) | EP-01 Episode-First Pivot |
| `opening_line` | episode_templates (is_default=TRUE) | EP-01 Episode-First Pivot |
| `starter_prompts` | episode_templates | EP-01 Episode-First Pivot |

---

## Boundaries Object

The `boundaries` JSONB field has been simplified to only fields that affect behavior:

```json
{
  "flirting_level": "playful",   // Used in prompt (reserved/playful/flirty/bold)
  "nsfw_allowed": false          // Used in content validation
}
```

### Removed Fields (never affected prompt)

- `availability` - UI noise
- `vulnerability_pacing` - UI noise
- `desire_expression` - UI noise
- `physical_comfort` - UI noise
- `dynamics_notes` - UI noise
- `can_reject_user` - Never used
- `relationship_max_stage` - Never used
- `avoided_topics` - Never used
- `has_own_boundaries` - Never used

---

## Prompt Generation Flow

```
User saves character field
         ↓
API PATCH /studio/characters/{id}
         ↓
Check if field ∈ prompt_affecting_fields
         ↓ (yes)
Fetch from database:
  - character record
  - episode_templates.situation (where is_default=TRUE)
         ↓
generate_system_prompt()
  ├── build_system_prompt() → base prompt with doctrine
  └── Append: "OPENING CONTEXT: {opening_situation}"
         ↓
UPDATE characters SET system_prompt = ...
```

### Prompt-Affecting Fields Set

```python
prompt_affecting_fields = {
    "name", "archetype", "baseline_personality", "boundaries",
    "tone_style", "speech_patterns", "backstory",
    "likes", "dislikes", "genre"
}
```

---

## API Endpoints

### Character Update
```
PATCH /studio/characters/{id}
Body: { field: value, ... }
Response: Character object
```
- Auto-regenerates system_prompt if prompt-affecting fields changed

### Manual Regenerate
```
POST /studio/characters/{id}/regenerate-system-prompt
Response: Character object with new system_prompt
```
- Fetches all current data + default episode situation
- Useful when episode template changed but character didn't

---

## UI → Field Mapping

| UI Element | API Field |
|------------|-----------|
| Name input | `name` |
| Archetype dropdown | `archetype` |
| Genre dropdown | `genre` |
| Personality JSON | `baseline_personality` |
| Energy Level dropdown | `boundaries.flirting_level` |
| Backstory textarea | `backstory` |
| Likes list | `likes` |
| Dislikes list | `dislikes` |
| Opening Situation | → episode_templates |
| Opening Line | → episode_templates |

---

## Removed Fields (Historical)

The following fields were removed during December 2024 simplification:

| Field | Reason | Replacement |
|-------|--------|-------------|
| `short_backstory` | Merged | `backstory` |
| `full_backstory` | Merged | `backstory` |
| `current_stressor` | Redundant | Episode `situation` |
| `life_arc` | Half-implemented | Backstory + archetype + doctrine |
| `starter_prompts` | Moved | `episode_templates.starter_prompts` |
| `opening_situation` | Moved | `episode_templates.situation` |
| `opening_line` | Moved | `episode_templates.opening_line` |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-23 | Initial canonical document post-simplification |
