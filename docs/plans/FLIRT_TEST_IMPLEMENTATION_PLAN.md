# Flirt Test Implementation Plan

> **Status**: Ready for Implementation
> **Created**: 2024-12-19
> **Target**: ep-0.com/games/flirt-test

---

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Schema strategy | Extend existing (not separate game tables) |
| Director integration | Merge with `_process_exchange()` |
| Character output | Structured JSON (dialogue/action/mood) |
| Turn budget | 7 turns |
| Evaluation timing | Immediate on completion |
| Beat visibility | Hidden |
| Auth model | Anonymous first, account optional |

---

## Implementation Phases

### Phase 1: Schema & Infrastructure

**1.1 Database Migration**

Create migration: `XXX_director_and_evaluations.sql`

```sql
-- Extend sessions for Director tracking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS turn_count INT DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS director_state JSONB DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS completion_trigger TEXT;

-- Extend episode_templates for completion modes
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS completion_mode TEXT DEFAULT 'open';
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS turn_budget INT;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS completion_criteria JSONB;

-- New table: session evaluations (shareable results)
CREATE TABLE session_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    evaluation_type TEXT NOT NULL,
    result JSONB NOT NULL,
    share_id TEXT UNIQUE,
    share_count INT DEFAULT 0,
    model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for share link lookups
CREATE INDEX idx_session_evaluations_share_id ON session_evaluations(share_id);

-- RLS policies
ALTER TABLE session_evaluations ENABLE ROW LEVEL SECURITY;

-- Anyone can read evaluations (for share links)
CREATE POLICY "Evaluations are publicly readable"
    ON session_evaluations FOR SELECT
    USING (true);

-- Only system can insert/update (via service role)
CREATE POLICY "System can manage evaluations"
    ON session_evaluations FOR ALL
    USING (auth.role() = 'service_role');
```

**1.2 Update Python Models**

- `substrate-api/api/src/app/models/session.py` — Add turn_count, director_state, completion_trigger
- `substrate-api/api/src/app/models/episode_template.py` — Add completion_mode, turn_budget, completion_criteria
- Create `substrate-api/api/src/app/models/evaluation.py` — SessionEvaluation model

**1.3 Update TypeScript Types**

- `web/src/types/index.ts` — Add evaluation types, completion mode types

---

### Phase 2: DirectorService

**2.1 Create DirectorService**

`substrate-api/api/src/app/services/director.py`

```python
class DirectorService:
    """Unified post-exchange processing."""

    async def process_exchange(
        self,
        session: Session,
        episode_template: EpisodeTemplate | None,
        messages: list[dict],
        structured_response: dict,  # From character LLM
        character_id: UUID,
        user_id: UUID,
    ) -> DirectorOutput:
        """Process complete exchange — replaces _process_exchange()."""

    async def check_completion(
        self,
        session: Session,
        episode_template: EpisodeTemplate | None,
    ) -> tuple[bool, str | None]:
        """Check if episode should complete."""

    async def generate_evaluation(
        self,
        session_id: UUID,
        evaluation_type: str,
        messages: list[dict],
        director_state: dict,
    ) -> dict:
        """Generate evaluation (archetype, summary, etc.)."""

    async def suggest_next_episode(
        self,
        session: Session,
        evaluation: dict | None,
    ) -> dict | None:
        """Suggest next content."""
```

**2.2 Integrate with ConversationService**

Modify `conversation.py`:
- Replace `_process_exchange()` call with `director_service.process_exchange()`
- Update stream to yield Director events

---

### Phase 3: Structured Character Output

**3.1 Modify LLM Service**

Update `llm.py` to support structured output mode:

```python
async def generate_structured(
    self,
    messages: list[dict],
    schema: dict,  # JSON schema for response
) -> dict:
    """Generate structured JSON response."""
```

**3.2 Character Response Schema**

```json
{
    "dialogue": "string",
    "action": "string | null",
    "internal": "string | null",
    "mood": "string",
    "tension_shift": "number (-1.0 to 1.0)"
}
```

**3.3 Rendering Function**

```python
def render_structured_response(structured: dict) -> str:
    """Convert structured output to display format."""
    parts = []
    if structured.get("action"):
        parts.append(f"*{structured['action']}*")
    if structured.get("dialogue"):
        parts.append(f'"{structured["dialogue"]}"')
    return " ".join(parts)
```

---

### Phase 4: Games Content

**4.1 Create Flirt Test Series (x2)**

One male character, one female character.

```python
# Series 1: Female character
series_f = {
    "title": "Flirt Test",
    "slug": "flirt-test-f",
    "tagline": "How do you flirt?",
    "series_type": "standalone",
    "genre": "romantic_tension",
    "world_id": REAL_LIFE_WORLD_ID,
    "status": "active",
}

# Series 2: Male character
series_m = {
    "title": "Flirt Test",
    "slug": "flirt-test-m",
    "tagline": "How do you flirt?",
    "series_type": "standalone",
    "genre": "romantic_tension",
    "world_id": REAL_LIFE_WORLD_ID,
    "status": "active",
}
```

**4.2 Create Characters (x2)**

Design characters optimized for flirt signal detection:
- Responsive to different flirt styles
- Escalates tension naturally over 7 turns
- System prompt includes Director hooks for signal extraction

**4.3 Create Episode Templates (x2)**

```python
episode_template = {
    "title": "The Test",
    "slug": "the-test",
    "episode_number": 0,
    "episode_type": "entry",
    "situation": "Coffee shop. You lock eyes across the room...",
    "opening_line": "...",
    "completion_mode": "turn_limited",
    "turn_budget": 7,
    "beat_guidance": {
        "establishment": "Initial spark, testing the waters",
        "complication": "Playful obstacle or misread",
        "escalation": "Stakes raised, tension peaks",
        "pivot": "The moment that reveals their style"
    }
}
```

---

### Phase 5: Evaluation System

**5.1 Flirt Archetypes**

Define 5 archetypes:

| Archetype | Key | Description |
|-----------|-----|-------------|
| The Tension Builder | `tension_builder` | Masters the pause, creates anticipation |
| The Bold Mover | `bold_mover` | Direct, confident, takes initiative |
| The Playful Tease | `playful_tease` | Light, fun, uses humor |
| The Slow Burn | `slow_burn` | Patient, builds connection over time |
| The Mysterious Allure | `mysterious_allure` | Intriguing, doesn't reveal everything |

**5.2 Evaluation Prompt**

```python
FLIRT_EVALUATION_PROMPT = """
Analyze this flirtatious conversation and classify the user's flirt style.

CONVERSATION:
{conversation}

STRUCTURED SIGNALS:
{signals}

Based on the user's responses, determine their primary flirt archetype:
- tension_builder: Masters the pause, creates anticipation, comfortable with silence
- bold_mover: Direct, confident, takes initiative, says what they want
- playful_tease: Light, fun, uses humor, keeps it breezy
- slow_burn: Patient, builds connection, values depth over speed
- mysterious_allure: Intriguing, doesn't reveal everything, leaves them wanting more

Return JSON:
{
    "archetype": "<key>",
    "confidence": 0.0-1.0,
    "primary_signals": ["signal1", "signal2", "signal3"],
    "title": "The [Archetype Name]",
    "description": "One engaging sentence describing their style"
}
"""
```

**5.3 Share ID Generation**

```python
import secrets
import string

def generate_share_id(length: int = 8) -> str:
    """Generate URL-safe share ID."""
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))
```

---

### Phase 6: API Endpoints

**6.1 Games Endpoints**

```
POST /games/flirt-test/start
  → Creates session, returns session_id + character choice

POST /games/flirt-test/{session_id}/message
  → Standard message flow, returns response + director state

GET /games/flirt-test/{session_id}/result
  → Returns evaluation (if complete)
```

**6.2 Share Endpoints**

```
GET /r/{share_id}
  → Returns evaluation result for display

POST /r/{share_id}/increment
  → Increment share_count (analytics)
```

---

### Phase 7: Frontend

**7.1 Routes**

```
/games/flirt-test          → Character selection + start
/games/flirt-test/chat     → Chat UI (simplified)
/games/flirt-test/result   → Result screen
/r/[share_id]              → Public result view
```

**7.2 Components**

- `GamesChatContainer` — Simplified chat for games (no sidebar, focused UI)
- `FlirtTestResult` — Result display with archetype, share buttons
- `ShareCard` — OG image preview component

**7.3 Stream Handling**

Handle new event types:
- `message_complete` — Update UI with structured response
- `episode_complete` — Transition to result screen

---

### Phase 8: Share Infrastructure

**8.1 OG Image Generation**

Edge function or API endpoint:

```
GET /api/og/result/{share_id}
  → Returns dynamic OG image for social preview
```

Use Vercel OG or similar for dynamic image generation.

**8.2 Meta Tags**

Result page includes:
```html
<meta property="og:title" content="I'm a Tension Builder!" />
<meta property="og:description" content="Take the flirt test..." />
<meta property="og:image" content="https://ep-0.com/api/og/result/abc123" />
```

---

## Implementation Order

| Step | Task | Deps | Est. Effort |
|------|------|------|-------------|
| 1 | Schema migration | — | S |
| 2 | Python models update | 1 | S |
| 3 | TypeScript types | 1 | S |
| 4 | DirectorService skeleton | 2 | M |
| 5 | Structured LLM output | — | M |
| 6 | Director integration in ConversationService | 4, 5 | M |
| 7 | Games content (series, chars, episodes) | 1 | M |
| 8 | Evaluation generation | 4, 7 | M |
| 9 | Games API endpoints | 6, 8 | M |
| 10 | Share API endpoints | 8 | S |
| 11 | Frontend routes | 9 | M |
| 12 | Chat UI for games | 11 | M |
| 13 | Result screen | 11 | M |
| 14 | OG image generation | 10 | M |
| 15 | Share result page | 10, 14 | S |

**Effort**: S = small (< 2 hours), M = medium (2-4 hours)

---

## Success Criteria

- [ ] User can start flirt test without auth
- [ ] 7-turn conversation completes automatically
- [ ] Evaluation generates with archetype assignment
- [ ] Result is shareable with unique URL
- [ ] Share link shows OG preview image
- [ ] "Continue with character" CTA leads to account creation
- [ ] Kill switch: can delete content + route, core unaffected

---

## References

- [VIRAL_PLAY_FEATURE_GTM.md](VIRAL_PLAY_FEATURE_GTM.md) — Strategy
- [DIRECTOR_ARCHITECTURE.md](../DIRECTOR_ARCHITECTURE.md) — Technical spec
