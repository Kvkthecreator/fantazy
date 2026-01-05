# ADR-005: Props Domain - Canonical Story Objects

> **Status**: Proposed
> **Date**: 2025-01-05
> **Deciders**: Architecture Review

---

## Context

Episode-0's mystery and thriller series revealed a gap: **the vibe works, but details don't stick**.

During testing of "The Last Message" (mystery genre), Daniel the character successfully created tension and suspicion. However:

1. **The Yellow Note** - Referenced multiple times but content varied ("I have to finish this..." vs improvised variants)
2. **The Anonymous Text** - The inciting incident, but exact wording never anchored
3. **The Stalker** - Mentioned but no concrete details (photo, description) to track

This is the difference between:
- **Atmospheric storytelling** (mood, tension, suspicion) - working via Genre Doctrines
- **Evidential storytelling** (clues, objects, anchored facts) - not working

### Why This Matters Beyond Mystery

Props aren't just for mystery. Consider:

| Genre | Example Props | Purpose |
|-------|--------------|---------|
| **Mystery** | The note, the photo, the key | Evidence to track |
| **Romance** | The mixtape, the letter, the shared item | Relationship anchors |
| **Thriller** | The map, the supply list, the warning sign | Survival mechanics |
| **Drama** | The family heirloom, the contract | Emotional weight |

Props create **canonical anchors** that:
- Stay consistent across turns (LLM references exact content)
- Persist across episodes (Episode 2 can reference Episode 1's prop)
- Enable visual generation (pre-authored prompts, consistent imagery)
- Provide progression gates (can't proceed until player "examines the note")

---

## Decision

Introduce **Props** as a first-class domain, positioned as **Layer 2.5** in the Context Architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: CHARACTER IDENTITY                                    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: EPISODE CONTEXT                                       │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2.5: PROPS (NEW)                                         │
│  Static per episode. Canonical objects with exact content.      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: ENGAGEMENT CONTEXT                                    │
│  ... (continues as before)                                      │
```

### Key Design Principles

1. **Props are authored, not generated** - Like scene motivation (ADR-002), props are content authoring, not runtime generation
2. **Props have canonical content** - The note's text is exact and immutable
3. **Props track revelation state** - System knows which props player has "seen"
4. **Props can have visuals** - Pre-generated images for consistency

---

## Schema Design

### Props Table

```sql
CREATE TABLE props (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_template_id UUID NOT NULL REFERENCES episode_templates(id),

    -- Identity
    name VARCHAR(100) NOT NULL,           -- "The Yellow Note"
    slug VARCHAR(100) NOT NULL,           -- "yellow-note"

    -- What the prop IS
    prop_type VARCHAR(50) NOT NULL,       -- document, object, photo, recording, digital
    description TEXT NOT NULL,            -- "A torn piece of legal paper with hasty handwriting"

    -- Canonical content (if applicable)
    content TEXT,                         -- Exact text/transcript ON the prop
    content_format VARCHAR(50),           -- handwritten, typed, audio_transcript, null

    -- Visual representation
    image_url TEXT,                       -- Pre-generated image
    image_prompt TEXT,                    -- Prompt for regeneration/consistency

    -- Revelation mechanics
    reveal_mode VARCHAR(50) DEFAULT 'character_initiated',
        -- character_initiated: Character shows it naturally
        -- player_requested: Player must ask to see it
        -- automatic: Revealed at specific turn
        -- gated: Requires prior prop or condition
    reveal_turn_hint INT,                 -- Suggested turn (soft guidance for pacing)
    prerequisite_prop_id UUID REFERENCES props(id),  -- Must reveal X before Y

    -- Narrative weight
    is_key_evidence BOOLEAN DEFAULT FALSE,  -- Critical for mystery resolution
    evidence_tags JSONB DEFAULT '[]',       -- ["handwriting", "timeline", "suspect_A"]

    -- Ordering
    display_order INT DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(episode_template_id, slug)
);

-- Index for episode lookup
CREATE INDEX idx_props_episode ON props(episode_template_id);
```

### Session Props Table (Revelation Tracking)

```sql
CREATE TABLE session_props (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    prop_id UUID NOT NULL REFERENCES props(id) ON DELETE CASCADE,

    -- Revelation tracking
    revealed_at TIMESTAMPTZ DEFAULT NOW(),
    revealed_turn INT NOT NULL,
    reveal_trigger VARCHAR(100),          -- "character_showed", "player_asked", "automatic"

    -- Player interaction
    examined_count INT DEFAULT 1,         -- Times player asked to see/review
    last_examined_at TIMESTAMPTZ,

    UNIQUE(session_id, prop_id)
);

-- Index for session lookup
CREATE INDEX idx_session_props_session ON session_props(session_id);
```

---

## Context Injection

### Director Integration

Props are injected in Layer 2.5, between Episode Context and Engagement:

```python
# In ConversationContext.to_messages() or build_episode_dynamics()

def _format_props_context(self, available_props, revealed_props):
    """Format props for LLM context injection."""
    if not available_props:
        return ""

    sections = []

    # Props available to show this episode
    sections.append("═══════════════════════════════════════════════════════════════")
    sections.append("PROPS IN THIS SCENE")
    sections.append("═══════════════════════════════════════════════════════════════")

    for prop in available_props:
        is_revealed = prop.id in revealed_props

        if is_revealed:
            # Player has seen this - character can reference freely
            sections.append(f"""
PROP: {prop.name} [REVEALED]
Description: {prop.description}
{f'Content: "{prop.content}"' if prop.content else ''}
[Reference this naturally. Player has seen it.]
""")
        else:
            # Not yet revealed - character knows it exists
            sections.append(f"""
PROP: {prop.name} [NOT YET SHOWN]
Description: {prop.description}
Reveal mode: {prop.reveal_mode}
[You have this but haven't shown it yet. Introduce when dramatically appropriate.]
""")

    return "\n".join(sections)
```

### Prompt Output Example

```
═══════════════════════════════════════════════════════════════
PROPS IN THIS SCENE
═══════════════════════════════════════════════════════════════

PROP: The Yellow Note [NOT YET SHOWN]
Description: A torn piece of yellow legal paper with hasty handwriting, creased from being folded multiple times
Reveal mode: character_initiated
[You have this but haven't shown it yet. Introduce when dramatically appropriate.]

PROP: The Anonymous Text [REVEALED]
Description: A screenshot of the text message that started everything
Content: "Don't trust Daniel. Ask him what really happened at 10:47."
[Reference this naturally. Player has seen it.]
```

---

## Frontend Integration

### New SSE Event: `prop_reveal`

When a prop is revealed (detected via LLM evaluation or explicit player action):

```json
{
  "type": "prop_reveal",
  "prop": {
    "id": "uuid",
    "name": "The Yellow Note",
    "prop_type": "document",
    "description": "A torn piece of yellow legal paper...",
    "content": "I have to finish this or he'll never stop watching us...",
    "content_format": "handwritten",
    "image_url": "https://..."
  },
  "turn": 5,
  "trigger": "character_showed"
}
```

### UI Components

1. **PropCard** - Inline card shown when prop is revealed (similar to InlineSuggestionCard)
2. **PropDrawer** - Collapsible drawer showing all revealed props (evidence board)
3. **PropModal** - Full view of prop with image and content

### Evidence Drawer (Mystery/Thriller)

For investigative genres, surface an "Evidence" or "Clues" drawer:

```
┌─────────────────────────────────┐
│ 📋 Evidence (3 items)      [▼] │
├─────────────────────────────────┤
│ ○ The Anonymous Text            │
│ ○ The Yellow Note               │
│ ○ The Coffee Shop Photo         │
└─────────────────────────────────┘
```

---

## Image Generation Strategy

### Pre-Generation at Scaffold Time

Props should have images generated during content authoring, not runtime:

1. **Consistency** - Same image every time prop is shown
2. **Quality control** - Author can approve/regenerate before publish
3. **No latency** - Image ready when prop is revealed

### Generation Approach

Use existing image generation infrastructure (Replicate/Flux or Gemini Imagen):

```python
# In scaffold script or Studio UI
PROP_IMAGE_PROMPTS = {
    "yellow-note": {
        "prompt": """photograph of a torn piece of yellow legal paper with handwritten cursive text,
        creased and slightly water-stained, dramatic side lighting, noir mystery aesthetic,
        on dark wood surface, shallow depth of field, no readable text""",
        "negative": "clear text, typed, printed, digital, bright colors, cheerful",
        "dimensions": (768, 768),  # Square for flexibility
    }
}
```

### Visual Style by Genre

| Genre | Prop Image Style |
|-------|-----------------|
| Mystery/Noir | High contrast, dramatic shadows, desaturated |
| Romance | Soft lighting, warm tones, intimate framing |
| Thriller | Cold tones, harsh light, clinical |
| Drama | Natural lighting, emotional focus |

---

## Series-Wide Implications

### Cross-Episode Prop References

Props can persist and evolve across episodes:

```sql
-- Episode 2 references Episode 1's note with new context
INSERT INTO props (episode_template_id, name, slug, ...)
VALUES (
    'episode-2-id',
    'The Yellow Note (Analyzed)',
    'yellow-note-analyzed',
    ...
);
-- Links to original via evidence_tags or narrative
```

### All Series Should Consider Props

| Series | Prop Opportunities |
|--------|-------------------|
| **The Last Message** | Note, text message, photo, security footage |
| **Blackout** | Map, supply inventory, warning signs, radio |
| **Cheerleader Crush** | Mixtape, yearbook note, team photo |
| **Hometown Crush** | Love letter, shared item, photo |

Props aren't mandatory but **enhance** any series with tangible story elements.

---

## Implementation Phases

### Phase 1: Schema + Scaffold (This PR)
- [ ] Migration: `props` and `session_props` tables
- [ ] Add props to scaffold_the_last_message.py (3-4 props)
- [ ] Generate prop images via existing image scripts
- [ ] Basic API endpoints: GET /episodes/{id}/props

### Phase 2: Context Integration
- [ ] Director injects available props into context
- [ ] Track prop revelations in session_props
- [ ] LLM evaluation detects prop mentions (optional)

### Phase 3: Frontend
- [ ] `prop_reveal` SSE event handling
- [ ] PropCard component
- [ ] Evidence drawer (mystery/thriller)
- [ ] Prop detail modal

### Phase 4: Studio UI
- [ ] Props editor in episode template form
- [ ] Prop image generation/upload
- [ ] Preview props in episode preview

---

## Alternatives Considered

### 1. Inline Props in Episode Description

**Rejected**: Props mixed into `situation` or `dramatic_question` aren't trackable or referenceable.

### 2. Props as Special Memory Type

**Considered**: Store props in `memory_events` with type="prop".
**Rejected**: Props are authored content (static), memories are extracted content (dynamic). Different lifecycle.

### 3. Props Generated by LLM at Runtime

**Rejected**: Same reason as ADR-002 for scene motivation. Authored content > generated content for consistency.

---

## Consequences

### Positive

1. **Consistent details** - The note says the same thing every turn
2. **Cross-episode continuity** - Episode 2 can reference Episode 1's prop reliably
3. **Visual anchors** - Pre-generated images for key story objects
4. **Player engagement** - Evidence board creates investment in mystery
5. **Authoring clarity** - Writers define exactly what players can discover

### Negative

1. **Authoring burden** - Each episode needs prop definitions
2. **More tables** - Additional schema complexity
3. **Context tokens** - Props add to prompt length

### Neutral

1. **Optional feature** - Series without props continue working as before
2. **Genre-agnostic** - Useful for mystery but applicable to any genre

---

## Related Documents

- **ADR-002**: Theatrical Architecture (authored content philosophy)
- **CONTEXT_LAYERS.md**: Layer architecture (Props = Layer 2.5)
- **DIRECTOR_PROTOCOL.md**: Context injection patterns
- **ADR-003**: Image Generation Strategy (prop image generation)

---

## Open Questions

1. **Prop revelation detection**: Should LLM explicitly signal "I showed the note" or detect via text analysis?
2. **Cross-series props**: Can the same prop (e.g., character's signature item) appear in multiple series?
3. **User-created props**: Future consideration - can users add props in user-generated episodes?

---

## Review Notes

This ADR follows the platform's content-first philosophy (ADR-002). Props are authored artifacts that enable consistent, trackable story elements. The Director orchestrates revelation timing, but prop content is immutable once authored.

The key insight: **Mystery needs evidence, romance needs mementos, thriller needs supplies.** Props provide the tangible layer that makes interactive fiction feel real.
