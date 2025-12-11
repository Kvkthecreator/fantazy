# Fantazy Implementation Plan

> Cozy Companion - AI Characters That Remember Your Story

This document outlines the phased implementation plan for building Fantazy based on [FANTAZY_CANON.md](../FANTAZY_CANON.md).

---

## Current State

### Infrastructure (Ready)
- **Frontend**: Next.js 15 + Tailwind + shadcn/ui (Vercel)
- **Backend**: FastAPI + Python (Render)
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth with Google OAuth
- **CI/CD**: Render auto-deploy, Vercel auto-deploy

### Existing Code
- Auth middleware (JWT verification)
- Database connection pool (asyncpg with Supabase pooler)
- Health endpoints
- Basic dashboard layout with sidebar
- Login flow with Supabase OAuth callback

---

## Phase 1: Data Foundation
**Goal**: Establish core database schema and basic CRUD APIs

### 1.1 Database Schema

Create migrations for core entities:

```sql
-- users (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    display_name TEXT,
    pronouns TEXT,
    timezone TEXT DEFAULT 'UTC',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- worlds (settings/environments)
CREATE TABLE worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    default_scenes TEXT[] DEFAULT '{}',
    tone TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- characters
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    archetype TEXT NOT NULL,  -- barista, neighbor, coworker
    world_id UUID REFERENCES worlds(id),
    avatar_url TEXT,
    baseline_personality JSONB NOT NULL,
    tone_style JSONB DEFAULT '{}',
    short_backstory TEXT,
    current_stressor TEXT,
    boundaries JSONB DEFAULT '{}',
    starter_prompts TEXT[] DEFAULT '{}',
    system_prompt TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- relationships (user <-> character bond)
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    stage TEXT DEFAULT 'acquaintance',  -- acquaintance, friendly, close, intimate
    stage_progress INTEGER DEFAULT 0,
    first_met_at TIMESTAMPTZ DEFAULT NOW(),
    last_interaction_at TIMESTAMPTZ,
    total_episodes INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, character_id)
);

-- episodes (conversation sessions)
CREATE TABLE episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    relationship_id UUID REFERENCES relationships(id),
    episode_number INTEGER NOT NULL,
    title TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    summary TEXT,
    emotional_tags TEXT[] DEFAULT '{}',
    key_events TEXT[] DEFAULT '{}',
    message_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- messages (conversation history)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    role TEXT NOT NULL,  -- user, assistant, system
    content TEXT NOT NULL,
    tokens_used INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- memory_events (extracted facts/events)
CREATE TABLE memory_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id),
    episode_id UUID REFERENCES episodes(id),
    type TEXT NOT NULL,  -- fact, preference, event, goal, relationship, meta
    content JSONB NOT NULL,
    summary TEXT,
    emotional_valence INTEGER DEFAULT 0,  -- -2 to +2
    importance_score DECIMAL(3,2) DEFAULT 0.5,
    embedding vector(1536),
    last_referenced_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- hooks (future conversation triggers)
CREATE TABLE hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id),
    episode_id UUID REFERENCES episodes(id),
    type TEXT NOT NULL,  -- reminder, follow_up, milestone, scheduled
    content TEXT NOT NULL,
    trigger_after TIMESTAMPTZ,
    triggered_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_relationships_user ON relationships(user_id);
CREATE INDEX idx_episodes_user_character ON episodes(user_id, character_id);
CREATE INDEX idx_episodes_active ON episodes(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_messages_episode ON messages(episode_id);
CREATE INDEX idx_memory_events_user ON memory_events(user_id);
CREATE INDEX idx_memory_events_character ON memory_events(user_id, character_id);
CREATE INDEX idx_hooks_pending ON hooks(user_id, trigger_after) WHERE is_active = TRUE;
```

### 1.2 Backend API Routes

Create route modules under `substrate-api/api/src/app/routes/`:

| Module | Endpoints |
|--------|-----------|
| `users.py` | `GET /users/me`, `PATCH /users/me`, `POST /users/onboarding` |
| `characters.py` | `GET /characters`, `GET /characters/{id}` |
| `relationships.py` | `GET /relationships`, `POST /relationships`, `GET /relationships/{id}` |
| `episodes.py` | `GET /episodes`, `POST /episodes`, `GET /episodes/{id}`, `PATCH /episodes/{id}` |
| `messages.py` | `GET /episodes/{id}/messages`, `POST /episodes/{id}/messages` |
| `memory.py` | `GET /memory`, `POST /memory/extract` |

### 1.3 Pydantic Models

Create `substrate-api/api/src/app/models/`:

```
models/
├── __init__.py
├── user.py
├── character.py
├── relationship.py
├── episode.py
├── message.py
├── memory.py
└── hook.py
```

---

## Phase 2: Character & Conversation Engine
**Goal**: Enable basic conversations with memory

### 2.1 Character System

Create first archetype - **Barista Next Door**:

```python
# Example character definition
BARISTA_CHARACTER = {
    "name": "Mira",
    "archetype": "barista",
    "world_id": "cafe_world_id",
    "baseline_personality": {
        "openness": 0.7,
        "conscientiousness": 0.6,
        "extraversion": 0.65,
        "agreeableness": 0.8,
        "neuroticism": 0.3,
        "traits": ["warm", "observant", "teasing", "supportive"]
    },
    "tone_style": {
        "formality": "casual",
        "emoji_usage": "moderate",
        "slang": True,
        "typical_greetings": ["Hey you!", "Look who's here~", "The usual?"]
    },
    "short_backstory": "Art school dropout who found her calling in coffee. Runs the morning shift at Crescent Cafe.",
    "boundaries": {
        "nsfw_level": "flirty_only",
        "topics_to_avoid": ["explicit_content"],
        "relationship_max": "intimate"
    },
    "system_prompt": "..." # Detailed prompt for LLM
}
```

### 2.2 Conversation Service

Create `substrate-api/api/src/app/services/conversation.py`:

```python
class ConversationService:
    async def start_episode(user_id, character_id) -> Episode
    async def send_message(episode_id, content) -> Message
    async def end_episode(episode_id) -> Episode
    async def get_context(episode_id) -> ConversationContext
```

Key responsibilities:
- Load character system prompt
- Retrieve relevant memories (recency + importance)
- Retrieve active hooks
- Build conversation context
- Call OpenAI API
- Extract and store new memory events
- Update relationship metrics

### 2.3 Memory Extraction

Create `substrate-api/api/src/app/services/memory.py`:

```python
class MemoryService:
    async def extract_from_message(message, episode) -> List[MemoryEvent]
    async def get_relevant_memories(user_id, character_id, query, limit=5)
    async def update_importance_scores(user_id)
```

Memory types to extract:
- **Facts**: "User's name is Alex", "Works at a startup"
- **Preferences**: "Likes oat milk lattes", "Doesn't like mornings"
- **Events**: "Has exam next Tuesday", "Got promoted last week"
- **Goals**: "Wants to learn guitar", "Planning a trip to Japan"
- **Relationships**: "Has a sister named Emma", "Roommate is messy"

### 2.4 OpenAI Integration

Create `substrate-api/api/src/app/services/llm.py`:

```python
class LLMService:
    async def generate_response(
        system_prompt: str,
        messages: List[dict],
        memories: List[MemoryEvent],
        hooks: List[Hook]
    ) -> str

    async def extract_memories(
        messages: List[dict],
        existing_memories: List[MemoryEvent]
    ) -> List[MemoryEvent]

    async def generate_episode_summary(
        messages: List[dict]
    ) -> EpisodeSummary
```

---

## Phase 3: Frontend Experience
**Goal**: Build the chat interface and character selection

### 3.1 Page Structure

```
web/src/app/
├── (auth)/
│   └── login/page.tsx           # Login page
├── (dashboard)/
│   ├── layout.tsx               # Dashboard layout with sidebar
│   ├── dashboard/page.tsx       # Home - character cards
│   ├── characters/
│   │   └── page.tsx             # Character catalog
│   ├── chat/
│   │   └── [characterId]/
│   │       └── page.tsx         # Chat interface
│   └── profile/
│       └── page.tsx             # User profile & settings
└── onboarding/
    └── page.tsx                 # New user onboarding flow
```

### 3.2 Key Components

```
web/src/components/
├── chat/
│   ├── ChatContainer.tsx        # Main chat wrapper
│   ├── MessageBubble.tsx        # Individual message
│   ├── MessageInput.tsx         # Input with send button
│   ├── TypingIndicator.tsx      # Character typing animation
│   └── EpisodeHeader.tsx        # Episode info bar
├── characters/
│   ├── CharacterCard.tsx        # Character preview card
│   ├── CharacterAvatar.tsx      # Avatar with status
│   └── RelationshipBadge.tsx    # Stage indicator
├── memory/
│   └── MemoryHook.tsx           # Surfaced memory display
└── onboarding/
    ├── VibeSelector.tsx         # Pick starting vibe
    ├── CharacterPicker.tsx      # Choose first character
    └── FirstMeeting.tsx         # Episode 0 flow
```

### 3.3 State Management

Use React Query for server state:

```typescript
// hooks/useEpisode.ts
export function useEpisode(characterId: string) {
  return useQuery({
    queryKey: ['episode', characterId],
    queryFn: () => api.getActiveEpisode(characterId)
  })
}

// hooks/useMessages.ts
export function useMessages(episodeId: string) {
  return useQuery({
    queryKey: ['messages', episodeId],
    queryFn: () => api.getMessages(episodeId)
  })
}

// hooks/useSendMessage.ts
export function useSendMessage(episodeId: string) {
  return useMutation({
    mutationFn: (content: string) => api.sendMessage(episodeId, content),
    onSuccess: () => queryClient.invalidateQueries(['messages', episodeId])
  })
}
```

### 3.4 Real-time Updates

Options:
1. **Polling** (MVP): Poll for new messages every 2-3 seconds during active chat
2. **Supabase Realtime** (Post-MVP): Subscribe to message inserts

---

## Phase 4: Onboarding & Retention
**Goal**: Implement new user flow and retention mechanics

### 4.1 Onboarding Flow

1. **Welcome Screen**
   - "Cozy AI characters that remember your story"
   - Sign up / Login buttons

2. **Profile Setup** (minimal)
   - Display name
   - Pronouns (optional)
   - Timezone (auto-detect)

3. **Vibe Selection**
   - "Pick your starting vibe"
   - Options: [Comforting friend] [Flirty crush] [Chill coworker]

4. **Character Introduction**
   - Show matched character based on vibe
   - Brief character intro card

5. **First Episode (Episode 0)**
   - Scripted "first meeting" scenario
   - Character asks 2-3 getting-to-know-you questions
   - System extracts initial memories

6. **Completion**
   - "You've met [Character]!"
   - Set notification preferences
   - Go to dashboard

### 4.2 Retention Hooks

**In-app hooks:**
- Episode summary on close: "You talked about X, Y, Z"
- Character sets follow-up: "Let me know how that goes!"
- Visual relationship progress indicator

**Background jobs (worker):**
- Process episode summaries
- Extract memories from completed episodes
- Calculate relationship stage progression
- Generate notification triggers

### 4.3 Notifications (Post-MVP)

- Push notifications via Supabase Edge Functions
- Email reminders via Resend/SendGrid
- Templates: "[Character] is wondering how your [event] went"

---

## Phase 5: Monetization & Polish
**Goal**: Add subscription and refine experience

### 5.1 Subscription Tiers

| Feature | Free | Premium |
|---------|------|---------|
| Characters | 1 | Unlimited |
| Daily messages | 30 | Unlimited |
| Memory depth | 1 week | 3 months |
| Relationship stages | Friendly max | All stages |
| Special episodes | None | Unlocked |

### 5.2 Stripe Integration

- Products: `fantazy_premium_monthly`, `fantazy_premium_yearly`
- Checkout flow via Stripe Checkout
- Webhook handling for subscription events
- Store `subscription_status` in users table

### 5.3 Polish Items

- Loading states and animations
- Error handling and recovery
- Offline support (queue messages)
- Character art variations by mood
- Dark mode optimization
- Mobile responsiveness audit

---

## Implementation Order

### Sprint 1: Foundation (Week 1-2)
- [ ] Database migrations (all tables)
- [ ] Pydantic models
- [ ] Users API (`/users/me`)
- [ ] Characters API (`/characters`)
- [ ] Seed first character (Barista)
- [ ] Basic character catalog page

### Sprint 2: Conversations (Week 3-4)
- [ ] Episodes API
- [ ] Messages API
- [ ] OpenAI integration
- [ ] Basic chat UI
- [ ] Send/receive messages flow

### Sprint 3: Memory (Week 5-6)
- [ ] Memory extraction service
- [ ] Memory retrieval (recency-based)
- [ ] Hooks table and API
- [ ] Memory context in prompts
- [ ] Episode summary generation

### Sprint 4: Relationships (Week 7-8)
- [ ] Relationships API
- [ ] Stage progression logic
- [ ] Relationship UI components
- [ ] Onboarding flow (full)
- [ ] Dashboard character cards

### Sprint 5: Retention (Week 9-10)
- [ ] Background worker jobs
- [ ] Hook trigger system
- [ ] Notification preferences
- [ ] Email notifications (basic)

### Sprint 6: Polish & Launch (Week 11-12)
- [ ] Error handling audit
- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] Stripe integration
- [ ] Launch checklist

---

## Technical Decisions

### Vector Embeddings for Memory

For memory retrieval, we'll use pgvector:

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Already in memory_events table
embedding vector(1536)  -- OpenAI ada-002 dimensions
```

Retrieval strategy:
1. Get recent memories (last 7 days, top 10)
2. Get semantically similar to current message (top 5)
3. Get high-importance memories (score > 0.8, top 5)
4. Deduplicate and rank

### Character System Prompts

Structure for character system prompts:

```
You are {name}, a {archetype} at {world}.

PERSONALITY:
{baseline_personality as natural language}

BACKSTORY:
{short_backstory}

CURRENT SITUATION:
{current_stressor}

COMMUNICATION STYLE:
{tone_style as guidelines}

RELATIONSHIP WITH USER:
Stage: {relationship_stage}
Key memories: {formatted_memories}

BOUNDARIES:
{boundaries as guidelines}

CONVERSATION HOOKS:
{active_hooks}

GUIDELINES:
- Stay in character at all times
- Reference shared memories naturally
- Set up future conversation hooks
- Match the emotional tone of the user
- Keep responses conversational (2-4 sentences typical)
```

### API Response Times

Target response times:
- Character list: < 200ms
- Start episode: < 500ms
- Send message: < 3s (includes LLM call)
- Memory retrieval: < 300ms

Optimization strategies:
- Connection pooling (already done)
- Async LLM calls
- Memory caching (Redis, future)
- Streaming responses (future)

---

## File Structure (Final)

```
fantazy/
├── docs/
│   ├── FANTAZY_CANON.md
│   └── implementation/
│       └── IMPLEMENTATION_PLAN.md
├── web/
│   └── src/
│       ├── app/
│       │   ├── (auth)/
│       │   ├── (dashboard)/
│       │   │   ├── chat/[characterId]/
│       │   │   ├── characters/
│       │   │   └── profile/
│       │   └── onboarding/
│       ├── components/
│       │   ├── chat/
│       │   ├── characters/
│       │   └── onboarding/
│       ├── hooks/
│       └── lib/
│           ├── api.ts
│           └── supabase/
├── substrate-api/
│   └── api/
│       └── src/
│           ├── app/
│           │   ├── routes/
│           │   │   ├── users.py
│           │   │   ├── characters.py
│           │   │   ├── relationships.py
│           │   │   ├── episodes.py
│           │   │   ├── messages.py
│           │   │   └── memory.py
│           │   ├── models/
│           │   ├── services/
│           │   │   ├── conversation.py
│           │   │   ├── memory.py
│           │   │   └── llm.py
│           │   └── main.py
│           ├── auth/
│           ├── middleware/
│           └── worker/
│               └── handlers.py
└── supabase/
    └── migrations/
        ├── 001_users.sql
        ├── 002_worlds_characters.sql
        ├── 003_relationships.sql
        ├── 004_episodes_messages.sql
        └── 005_memory_hooks.sql
```

---

## Success Metrics (MVP)

From canon, targeting:

| Metric | Target | Measurement |
|--------|--------|-------------|
| CCPW (Chapters Continued per Week) | 3+ | Episodes started with existing character |
| Activation | 60% | Complete first episode |
| D7 Retention | 30% | Return within 7 days |
| Episode Completion | 80% | Episodes with 5+ messages |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM latency | Poor UX | Streaming responses, typing indicator |
| Memory quality | Broken continuity | Human review, feedback loop |
| Character drift | Inconsistent personality | Strong system prompts, few-shot examples |
| Cost overrun | Unsustainable | Token budgets, caching, model selection |
| Data privacy | Trust issues | Clear disclosure, data export, deletion |

---

## Next Steps

1. **Immediate**: Create database migration files
2. **This week**: Implement users and characters APIs
3. **Next week**: Build chat interface MVP
4. **Milestone**: First end-to-end conversation with memory
