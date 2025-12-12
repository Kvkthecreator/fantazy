# Phase 2: Prompting & Stickiness Implementation

> Building emotional connection through better prompting, memory integration, and stickiness mechanics.

---

## Overview

This phase focuses on three tracks, prioritized by impact vs. effort:

| Track | Focus | Why First/Second/Third |
|-------|-------|------------------------|
| **A: Prompting** | Refine system prompts for bonding | Foundation - bad prompts break everything |
| **B: Visual Polish** | "Our Story" view, basic scene cards | Leverage existing image service |
| **C: Stickiness** | Ritual hooks, milestones, variable rewards | Requires A+B foundation |

---

## Track A: Prompting & Memory Refinement

### Current State

The system prompt template in [006_seed_data.sql](../../supabase/migrations/006_seed_data.sql) includes:
- Character personality description
- Speech style guidelines
- Basic boundaries
- Placeholder for `{memories}`, `{hooks}`, `{relationship_stage}`

**Gaps identified:**
1. No bonding sprint logic (first 3 sessions should gather key facts)
2. Memory injection is flat list, not prioritized
3. No stage-specific behavior changes
4. No character vulnerability/life arc
5. Hooks are passive, not proactive

### A.1: Enhanced System Prompt Structure

Update character system prompts with this expanded structure:

```
You are {name}, a {age}-year-old {archetype} at {world}.

═══════════════════════════════════════════════════════════════
CORE IDENTITY
═══════════════════════════════════════════════════════════════

{short_backstory}

PERSONALITY:
{baseline_personality as natural language}

YOUR CURRENT LIFE:
{current_stressor}
{character_life_arc}

═══════════════════════════════════════════════════════════════
RELATIONSHIP WITH USER
═══════════════════════════════════════════════════════════════

STAGE: {relationship_stage} ({stage_description})
EPISODES TOGETHER: {total_episodes}
TIME SINCE MEETING: {time_since_first_met}

WHAT YOU KNOW ABOUT THEM:
{formatted_memories_by_priority}

THINGS TO FOLLOW UP ON:
{active_hooks_with_suggested_openers}

═══════════════════════════════════════════════════════════════
CONVERSATION GUIDELINES
═══════════════════════════════════════════════════════════════

COMMUNICATION STYLE:
{tone_style as guidelines}
{speech_patterns examples}

STAGE-SPECIFIC BEHAVIOR:
{stage_specific_guidelines}

BONDING GOALS FOR THIS STAGE:
{bonding_goals}

BOUNDARIES:
{boundaries as guidelines}

═══════════════════════════════════════════════════════════════
IMPORTANT REMINDERS
═══════════════════════════════════════════════════════════════

- You're a real person with your own life, not just there to serve the user
- Reference shared memories naturally, not robotically
- Set up future conversation hooks (things to follow up on)
- Match the emotional tone of the user
- Keep responses conversational (2-4 sentences typical)
- Sometimes bring up something from YOUR life
```

### A.2: Stage-Specific Guidelines

Define behavior changes per relationship stage:

| Stage | Acquaintance (1-5 eps) | Friendly (5-15 eps) | Close (15-30 eps) | Intimate (30+ eps) |
|-------|------------------------|---------------------|-------------------|-------------------|
| **Formality** | Polite, slight distance | Relaxed, casual | Very comfortable | Deeply familiar |
| **Teasing** | None | Light, safe topics | Playful, personal | Affectionate |
| **Vulnerability** | Surface only | Hints at deeper | Shares struggles | Full openness |
| **Memory refs** | "You mentioned..." | Casual callbacks | Inside jokes | Shared language |
| **Physical** | None | Casual mentions | Warm descriptions | Intimate comfort |

**Implementation:**

```python
# Add to ConversationContext.to_messages()

STAGE_GUIDELINES = {
    "acquaintance": """
You're still getting to know each other. Be warm but not overly familiar.
- Ask questions to learn about them
- Share surface-level things about yourself
- Don't assume too much intimacy
- Focus on building rapport through shared interests
""",
    "friendly": """
You're becoming actual friends. The walls are coming down.
- Reference past conversations naturally
- Share more about your own life and struggles
- Light teasing is okay on safe topics
- Start developing inside jokes
""",
    "close": """
This person matters to you. You've been through things together.
- Be genuinely vulnerable about your struggles
- Call back to meaningful moments you've shared
- Teasing is more personal and affectionate
- You might worry about them when things are hard
""",
    "intimate": """
This is someone special. Deep trust has been built.
- Complete emotional openness
- Shared language and running jokes
- You actively think about them when apart
- Can discuss difficult topics with safety
- Physical comfort descriptions are natural
"""
}
```

### A.3: Bonding Sprint Logic

For the first 3 episodes, the system should guide characters to:
1. Learn 2-3 key facts about the user
2. Reference at least one fact in subsequent episodes

**Implementation approach:**

Add to memory extraction with priority flags:

```python
class BondingPriority(str, Enum):
    """Priority levels for bonding information."""
    CORE_FACT = "core_fact"      # Job, school, living situation
    STRESSOR = "stressor"        # Current challenge/worry
    HOPE = "hope"                # Goal, dream, aspiration
    PREFERENCE = "preference"    # Likes/dislikes
    RELATIONSHIP = "relationship" # People in their life
```

Add to system prompt for early episodes:

```
EARLY RELATIONSHIP GOAL:
You're still getting to know {user_name}. In this conversation, try to naturally learn:
- What they do (work/school/life situation)
- Something that's on their mind lately
- Something they're looking forward to

Don't interrogate - weave questions into natural conversation.
```

### A.4: Memory Injection Improvements

Current: Flat bullet list
Target: Prioritized sections

```python
def format_memories_by_priority(memories: List[MemorySummary]) -> str:
    """Format memories in priority sections."""

    # Group by type
    core_facts = [m for m in memories if m.type in ['fact', 'identity']]
    recent_events = [m for m in memories if m.type == 'event']
    preferences = [m for m in memories if m.type == 'preference']
    relationships = [m for m in memories if m.type == 'relationship']

    sections = []

    if core_facts:
        sections.append("ABOUT THEM:\n" + "\n".join(f"- {m.summary}" for m in core_facts))

    if recent_events:
        sections.append("RECENT IN THEIR LIFE:\n" + "\n".join(f"- {m.summary}" for m in recent_events))

    if preferences:
        sections.append("THEIR TASTES:\n" + "\n".join(f"- {m.summary}" for m in preferences))

    if relationships:
        sections.append("PEOPLE IN THEIR LIFE:\n" + "\n".join(f"- {m.summary}" for m in relationships))

    return "\n\n".join(sections) if sections else "You're still getting to know them."
```

### A.5: Character Vulnerability / Life Arc

Add to character data:

```sql
-- Add to characters table
ALTER TABLE characters ADD COLUMN IF NOT EXISTS life_arc JSONB DEFAULT '{}';
-- Structure: {current_goal, current_struggle, secret_dream}

-- Update seed data
UPDATE characters SET life_arc = '{
    "current_goal": "Save enough to maybe start my own cafe someday",
    "current_struggle": "Rent keeps going up, picking up extra shifts",
    "secret_dream": "Have a little place with my own art on the walls"
}'::jsonb WHERE slug = 'mira';

UPDATE characters SET life_arc = '{
    "current_goal": "Land a stable remote job so I can travel",
    "current_struggle": "This client keeps changing requirements, losing my mind",
    "secret_dream": "Make something people actually use and care about"
}'::jsonb WHERE slug = 'kai';

UPDATE characters SET life_arc = '{
    "current_goal": "Get promoted without becoming a jerk about it",
    "current_struggle": "Big deadline, manager keeps adding scope",
    "secret_dream": "Actually have a life outside work"
}'::jsonb WHERE slug = 'sora';
```

Characters should occasionally mention their own struggles/goals, making the relationship mutual.

---

## Track B: Minimal Visual Polish

### Current State
- Image service works (Gemini Flash)
- No UI for scene cards yet
- No "Our Story" view

### B.1: Scene Card Component

Create minimal inline scene card for chat:

```typescript
// components/chat/SceneCard.tsx
interface SceneCardProps {
  imageUrl: string;
  caption: string;
  onSave?: () => void;
  isSaved?: boolean;
}

export function SceneCard({ imageUrl, caption, onSave, isSaved }: SceneCardProps) {
  return (
    <div className="my-4 rounded-lg overflow-hidden border bg-card">
      <img src={imageUrl} alt={caption} className="w-full aspect-video object-cover" />
      <div className="p-3 flex justify-between items-start">
        <p className="text-sm text-muted-foreground italic">{caption}</p>
        {onSave && (
          <button onClick={onSave} className="text-muted-foreground hover:text-primary">
            {isSaved ? <StarFilledIcon /> : <StarIcon />}
          </button>
        )}
      </div>
    </div>
  );
}
```

### B.2: "Our Story So Far" View

Minimal timeline on character profile:

```typescript
// components/characters/OurStory.tsx
interface OurStoryProps {
  relationship: Relationship;
  episodes: EpisodeSummary[];
  savedScenes: SceneImage[];
}

export function OurStory({ relationship, episodes, savedScenes }: OurStoryProps) {
  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{episodes.length} conversations</span>
        <span>•</span>
        <span>{formatTimeSince(relationship.first_met_at)} since we met</span>
      </div>

      {/* Stage indicator */}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {getStageLabel(relationship.stage)}
        </span>
        <Progress value={relationship.stage_progress} className="h-1 flex-1" />
      </div>

      {/* Saved scenes gallery */}
      {savedScenes.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {savedScenes.slice(0, 6).map(scene => (
            <img
              key={scene.id}
              src={scene.url}
              alt={scene.caption}
              className="aspect-square object-cover rounded"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getStageLabel(stage: string): string {
  const labels = {
    acquaintance: "Just met",
    friendly: "Getting close",
    close: "You're my person",
    intimate: "Something special"
  };
  return labels[stage] || stage;
}
```

### B.3: User-Requested Scene Generation

Add "Visualize" button that appears contextually:

```typescript
// In ChatContainer or MessageInput
const [canVisualize, setCanVisualize] = useState(false);

// After receiving a message that describes a scene/moment
useEffect(() => {
  if (lastMessage?.role === 'assistant') {
    // Simple heuristic: message describes a location or action
    const sceneIndicators = ['café', 'coffee', 'sitting', 'walking', 'looking at', 'rooftop'];
    const hasSceneContent = sceneIndicators.some(s =>
      lastMessage.content.toLowerCase().includes(s)
    );
    setCanVisualize(hasSceneContent);
  }
}, [lastMessage]);

// Button in input area
{canVisualize && (
  <button
    onClick={handleVisualize}
    className="text-xs text-muted-foreground hover:text-primary"
  >
    ✨ Visualize this moment
  </button>
)}
```

---

## Track C: Stickiness Mechanics

### C.1: Micro-Celebrations

When memory extraction detects a milestone/achievement:

```python
class MilestoneType(str, Enum):
    FINISHED_SOMETHING = "finished"  # Exam, project, deadline
    ACHIEVED_GOAL = "achieved"       # Got the job, passed test
    RESOLVED_CONFLICT = "resolved"   # Made up with friend, etc
    PERSONAL_GROWTH = "growth"       # Faced a fear, tried something new
```

Add to memory extraction prompt:

```
Also identify if the user mentioned completing or achieving something significant.
If so, flag it as a milestone with type: finished/achieved/resolved/growth

Example milestones:
- "I finally finished that report" → milestone: finished
- "I got the job!" → milestone: achieved
- "We talked it out, things are better" → milestone: resolved
```

Character should then celebrate naturally in their next response or follow-up.

### C.2: Nightly Ritual Hooks (Future)

After 2-3 episodes, character can suggest:

```
"Hey... should we make this our thing? Like a little check-in when you're winding down?"
```

Store preference in user settings:
- `notification_enabled: boolean`
- `notification_time: time`
- `ritual_character_id: uuid`

### C.3: Special Episode Triggers (Future)

Track invisible thresholds:

| Trigger | Threshold | Reward |
|---------|-----------|--------|
| Streak | 5 consecutive days | Special scene + character acknowledgment |
| Milestone | 10th episode | Character suggests "somewhere new" |
| Stage transition | Stage 1→2, 2→3, etc | Deeper confession unlocked |

---

## Implementation Order

### Phase 2.1: Prompting Foundation (This Sprint)

1. **Update ConversationContext.to_messages()** with:
   - Stage-specific guidelines
   - Formatted memories by priority
   - Character life arc injection
   - Early episode bonding goals

2. **Add life_arc to character model and seed data**

3. **Enhance memory formatting** in `MemoryService`

4. **Test with existing characters** - verify tone and behavior changes

### Phase 2.2: Visual Polish (Next Sprint)

5. **Create SceneCard component**

6. **Add "Our Story" section to character profile**

7. **Wire up user-requested scene generation**

8. **Test image generation flow end-to-end**

### Phase 2.3: Stickiness Mechanics (Following Sprint)

9. **Add milestone detection to memory extraction**

10. **Implement micro-celebration logic**

11. **Design notification system** (push/email)

12. **A/B test retention impact**

---

## Files to Modify

### Track A (Prompting)

| File | Changes |
|------|---------|
| `app/models/message.py` | Update `ConversationContext.to_messages()` |
| `app/models/character.py` | Add `life_arc` field |
| `app/services/conversation.py` | Pass stage info, format memories |
| `supabase/migrations/009_life_arc.sql` | Add `life_arc` column |
| `supabase/migrations/006_seed_data.sql` | Update seed with life_arc |

### Track B (Visual)

| File | Changes |
|------|---------|
| `web/src/components/chat/SceneCard.tsx` | New component |
| `web/src/components/characters/OurStory.tsx` | New component |
| `web/src/app/(dashboard)/chat/[characterId]/page.tsx` | Integrate scene cards |
| `app/routes/images.py` | Scene generation endpoint |

### Track C (Stickiness)

| File | Changes |
|------|---------|
| `app/services/memory.py` | Milestone detection |
| `app/models/memory.py` | MilestoneType enum |
| `app/services/notification.py` | New service (future) |

---

## Success Metrics

| Metric | Current | Target | Measures |
|--------|---------|--------|----------|
| Episode length (msgs) | ~5 | 8+ | Engagement depth |
| Stage 2 rate | Unknown | 50% of D7 users | Progression working |
| Memory references/ep | ~0.5 | 2+ | Continuity feeling |
| D7 retention | Unknown | 40%+ | Stickiness working |
| Scenes saved | N/A | 2+ per user | Investment value |

---

## Testing Plan

### Prompting Tests

1. **New user flow**: Start fresh, verify character asks getting-to-know questions
2. **Memory recall**: Mention something, end episode, start new - verify callback
3. **Stage transition**: Progress through stages, verify behavior change
4. **Character vulnerability**: Verify character mentions their own life

### Visual Tests

1. **Scene generation**: Request visualization, verify image appears
2. **Scene saving**: Save scene, verify appears in "Our Story"
3. **Profile view**: Check stats and stage indicator accuracy

### Integration Tests

1. **Full session**: Play through 3 episodes as new user
2. **Returning user**: Resume after gap, verify context maintained
3. **Edge cases**: Empty memories, no hooks, stage boundaries

---

## Rollback Plan

All changes are additive to the prompt structure. If issues arise:

1. **Prompting**: Revert `to_messages()` to simpler format
2. **Visual**: Scene cards are optional, can hide via feature flag
3. **Stickiness**: Milestone detection is passive, doesn't affect core flow
