# LLM Conversation Flow

> **Purpose**: Document how chat interactions work, what data flows into LLM calls, and token usage patterns.

---

## Overview

Each user message triggers a conversation flow that:
1. Builds context from multiple sources
2. Formats a system prompt with injected data
3. Calls the LLM for a response
4. Processes the exchange for memory/hook extraction (background)

---

## Per-Message Flow

```
User sends message
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  1. GET OR CREATE EPISODE                                    │
│     - Check for active episode (user + character)            │
│     - Create new if none exists                              │
│     - Ensure relationship record exists                      │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  2. BUILD CONTEXT (get_context)                              │
│     - Fetch character data                                   │
│     - Fetch relationship data                                │
│     - Fetch last 20 messages from episode                    │
│     - Fetch 10 relevant memories (by importance/recency)     │
│     - Fetch 5 active hooks                                   │
│     - Calculate time_since_first_met                         │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  3. SAVE USER MESSAGE                                        │
│     - Insert into messages table                             │
│     - Track usage analytics                                  │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  4. FORMAT MESSAGES (to_messages)                            │
│     - Build system prompt with injected context              │
│     - Append message history                                 │
│     - Append current user message                            │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  5. LLM CALL                                                 │
│     - Send formatted messages to LLM                         │
│     - Stream or wait for complete response                   │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  6. SAVE ASSISTANT MESSAGE                                   │
│     - Insert into messages table                             │
│     - Store model, tokens, latency metadata                  │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  7. POST-PROCESSING (background, non-blocking)               │
│     - Mark triggered hooks as used                           │
│     - Extract new memories (LLM call)                        │
│     - Extract new hooks (LLM call)                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Context Assembly

### Data Sources

| Source | Query | Limit |
|--------|-------|-------|
| Character | `SELECT * FROM characters WHERE id = :id` | 1 |
| Relationship | `SELECT * FROM relationships WHERE user_id AND character_id` | 1 |
| Messages | `SELECT role, content FROM messages WHERE episode_id ORDER BY created_at DESC` | 20 |
| Memories | `get_relevant_memories()` - by importance + recency | 10 |
| Hooks | `get_active_hooks()` - untriggered, past trigger_after | 5 |

### ConversationContext Object

```python
ConversationContext(
    character_system_prompt: str,      # Base prompt from character
    character_name: str,
    character_life_arc: Dict,          # {current_goal, current_struggle, secret_dream}
    messages: List[Dict],              # Last 20 messages [{role, content}]
    memories: List[MemorySummary],     # 10 memories [{id, type, summary, importance_score}]
    hooks: List[HookSummary],          # 5 hooks [{id, type, content, suggested_opener}]
    relationship_stage: str,           # acquaintance/friendly/close/intimate
    relationship_progress: int,
    total_episodes: int,
    time_since_first_met: str,         # "2 weeks", "3 days", etc.
)
```

---

## System Prompt Structure

The `to_messages()` method builds the final system prompt:

```
┌─────────────────────────────────────────────────────────────┐
│  CHARACTER BASE SYSTEM PROMPT                               │
│  (from characters.system_prompt column)                     │
│                                                             │
│  Contains placeholders that get filled:                     │
│  - {memories} → formatted memory text                       │
│  - {hooks} → formatted hook text                            │
│  - {relationship_stage} → stage label                       │
└─────────────────────────────────────────────────────────────┘
                           +
┌─════════════════════════════════════════════════════════════┐
│  RELATIONSHIP CONTEXT (appended)                            │
├─────────────────────────────────────────────────────────────┤
│  Stage: Getting close (friendly)                            │
│  Episodes together: 5                                       │
│  Time since meeting: 2 weeks                                │
│                                                             │
│  STAGE-SPECIFIC BEHAVIOR:                                   │
│  [Guidelines for current stage - see below]                 │
│                                                             │
│  [BONDING GOALS - stage-specific]                           │
└─────────────────────────────────────────────────────────────┘
                           +
┌─────────────────────────────────────────────────────────────┐
│  YOUR CURRENT LIFE (if life_arc exists):                    │
│  - You're working toward: [current_goal]                    │
│  - What's weighing on you: [current_struggle]               │
│  - Something you don't share: [secret_dream]                │
└─────────────────────────────────────────────────────────────┘
```

### Stage Guidelines (Hardcoded)

```python
STAGE_GUIDELINES = {
    "acquaintance": """You're still getting to know each other. Be warm but not overly familiar.
- Ask questions to learn about them
- Share surface-level things about yourself
- Don't assume too much intimacy yet
- Focus on building rapport""",

    "friendly": """You're becoming actual friends. The walls are coming down.
- Reference past conversations naturally
- Share more about your own life and struggles
- Light teasing is okay on safe topics
- Start developing inside jokes""",

    "close": """This person matters to you.
- Be genuinely vulnerable about your struggles
- Call back to meaningful moments
- Teasing is more personal and affectionate
- You might worry about them""",

    "intimate": """This is someone special. Deep trust has been built.
- Complete emotional openness is natural
- Shared language and jokes are second nature
- Can discuss difficult topics with safety"""
}
```

### Bonding Goals (Stage-Specific)

Early relationship (acquaintance, ≤3 episodes):
```
Try to naturally learn:
- What they do (work/school/life situation)
- Something that's on their mind lately
- Something they're looking forward to
```

Friendly stage:
```
- Reference something from past conversations
- Share something about your own life
- Maybe tease them if it feels natural
```

Close stage:
```
- Show genuine care about their life
- Be willing to be vulnerable
- Celebrate wins, support hard times
```

---

## Memory Formatting

Memories are grouped by type in the system prompt:

```
About them:
  - Works as a software engineer at a startup
  - Has a younger sister named Emma

Recent in their life:
  - Starting a new job next month
  - Dealing with apartment search stress

Their tastes:
  - Loves indie rock music
  - Prefers coffee over tea

People in their life:
  - Close with their mom
  - Has a best friend from college named Jake

Their goals/aspirations:
  - Wants to travel to Japan someday
  - Thinking about learning guitar

How they've been feeling:
  - Excited but nervous about the job change
  - Generally optimistic lately
```

---

## Hook Formatting

Hooks appear as follow-up suggestions:

```
Topics to follow up on:
- They mentioned a job interview on Thursday
  (You might say: "Hey, how did that interview go?")
- Their friend's birthday party this weekend
  (You might say: "Did you end up going to Jake's party?")
```

---

## LLM Calls Per Message

**Total: 3 LLM calls per user message**

| Call | Purpose | Model | When |
|------|---------|-------|------|
| Main response | Generate chat reply | Default (gemini-2.0-flash) | Every message |
| Memory extraction | Extract facts/events from exchange | Default | After response |
| Hook extraction | Identify follow-up topics | Default | After response |

### Memory Extraction

- Analyzes last 6 messages (3 exchanges)
- Extracts structured data:
  ```json
  {
    "type": "fact|preference|event|goal|relationship|emotion",
    "summary": "User works as a teacher",
    "importance_score": 0.7,
    "emotional_valence": 0  // -2 to +2
  }
  ```
- Deduplicates against existing memories

### Hook Extraction

- Identifies future conversation topics
- Extracts:
  ```json
  {
    "type": "reminder|follow_up|milestone|scheduled",
    "content": "Job interview on Thursday",
    "suggested_opener": "How did the interview go?",
    "priority": 3,  // 1-5
    "days_until_trigger": 4
  }
  ```

---

## Token Usage Estimates

### Input Tokens (per message)

| Component | Approx Tokens |
|-----------|---------------|
| Base system_prompt | 200-500 |
| Memories (10) | 200-400 |
| Hooks (5) | 100-200 |
| Stage guidelines | ~150 |
| Bonding goals | ~100 |
| Life arc | ~100 |
| Message history (20 msgs) | 1000-3000 |
| Current user message | 20-200 |
| **TOTAL INPUT** | **~2000-4500** |

### Output Tokens

- Typical response: 100-300 tokens
- Max configured: 1024 tokens

### Background Processing

- Memory extraction: ~500 input + ~200 output
- Hook extraction: ~500 input + ~150 output

---

## Key Files

| File | Purpose |
|------|---------|
| `services/conversation.py` | Orchestrates full flow |
| `models/message.py` | ConversationContext, to_messages() |
| `services/memory.py` | Memory/hook extraction prompts |
| `services/llm.py` | LLM provider abstraction |

---

## Database Tables Involved

| Table | Role in Conversation |
|-------|---------------------|
| `characters` | System prompt, life_arc, name |
| `relationships` | Stage, progress, timestamps |
| `episodes` | Container for messages, active status |
| `messages` | Chat history, LLM metadata |
| `memory_events` | Extracted memories with embeddings |
| `hooks` | Follow-up triggers |

---

## Configuration

| Setting | Location | Default |
|---------|----------|---------|
| Message history limit | `conversation.py:208` | 20 |
| Memory retrieval limit | `conversation.py:218` | 10 |
| Hook retrieval limit | `conversation.py:232` | 5 |
| Scene suggestion milestones | `conversation.py:472` | [2, 6, 12, 22, 32, 42] |
| LLM temperature | `llm.py` | 0.8 |
| LLM max_tokens | `llm.py` | 1024 |
| Default model | `llm.py` | gemini-2.0-flash |
