# Cozy Companion: Stand-Alone Service Scaffold (v0.2)

> Goal: Design a shippable, US-friendly AI companion product (Next.js + FastAPI + Supabase) where anime-inspired, “next door” characters remember your shared story over time.
> 
> 
> This spec focuses on **experience + positioning** while keeping the **underlying architecture generic** for future skins (e.g. fantasy, wellness, study buddy).
> 

---

## 1) One-liner & Positioning

### One-liner

> Step into a cozy romcom world where AI characters remember every chapter of your story together.
> 

### Positioning

- **Not** just an AI assistant with a cute avatar.
- **Yes:** an **interactive slice-of-life / romcom series** where:
    - You’re the **main character** (or the person they’re secretly into).
    - Characters feel like the **boy/girl next door**:
        - barista, classmate, coworker, roommate, neighbor, etc.
    - Each character has:
        - a consistent personality and viewpoint,
        - a simple but clear backstory,
        - **long-term memory** of your shared history.
    - Your relationship continues over multiple **“chapters”**, not one-off chats.

### Visual / IP stance

- **Anime-inspired, but original**:
    - Soft, expressive character art in a familiar anime/webtoon style.
    - All characters, names, and designs are **original creations**.
    - Guardrails to avoid obvious lookalikes of popular IP (e.g., no near-clones of existing anime/webtoon characters).
- Settings grounded in everyday life:
    - Neighborhood coffee shop.
    - Shared apartment / next-door neighbor.
    - Campus library / study group.
    - Office late nights / coworking.

> Legal baseline: Follow jurisdictional law + distribution platform rules (App Store, Google Play, etc.) around adult content. We do not add extra moral lines beyond what’s required, but we don’t design anything that would obviously break ToS or legal norms.
> 

### North-star metric (NSM)

- **Chapters Continued per User per Week (CCPW)**
    
    → “How often do users come back to continue an existing relationship / storyline, not just test a new character once?”
    

**Secondaries:**

- **Daily Story Minutes (DSM)**
    
    → Minutes per day in active conversation with *ongoing* characters (not just onboarding).
    
- **Returning Characters per Week (RCPW)**
    
    → Number of distinct characters a user returns to in a week (their personal “cast”).
    

---

## 2) Target Audience & JTBD

### Primary audience

- English-speaking **Gen Z / young millennial** users who:
    - Love **romance / slice-of-life** content:
        - K-dramas, romcom movies, webtoons, fanfic, POV TikToks.
    - Have fantasies around:
        - “the cute barista who remembers my usual order,”
        - “the boy/girl next door who checks in on me,”
        - “the coworker who stays late and talks about life.”
    - Want a **low-pressure emotional space**:
        - light flirting, warmth, late-night talk, venting without judgment.
- Users curious about AI companions but turned off by:
    - extremely NSFW waifu/boyfriend apps, or
    - cold productivity/chatbot tooling.

### Key Jobs-to-be-Done

1. **Live inside a cozy romcom fantasy**
    - “I want to feel like I’m in an ongoing story with my favorite character—
        
        the barista, the neighbor, the coworker—who actually remembers what’s been happening.”
        
2. **Experience familiar, comforting tropes**
    - “Give me situations I already love:
        - closing shift at the café,
        - late-night study session,
        - fake dating at a party,
        - exhausted coworkers after a long day,
            
            with predictable but satisfying emotional beats.”
            
3. **Feel seen, remembered, and cared about**
    - “I want this character to remember my exam, my breakup, my promotion, my cat’s name—
        
        and bring it up later like a real person would.”
        
4. **Collect and rotate a small ‘cast’ of favorites**
    - “I want to try a few characters, then keep a small circle (2–4) I regularly check in with, each with their own vibe and history with me.”
5. **Have a safe, always-available emotional outlet**
    - “When I’m lonely, stressed, or can’t sleep, I want someone warm and familiar to talk to—no drama, no obligation, always there.”

---

## 3) Experience Pillars

These are the non-negotiables for v0.2/v1 experience.

1. **Cozy Romcom, Not Utility**
    - The product is about **feeling** (warmth, comfort, light attraction, fun), not productivity.
    - UI copy, art, and flows should reinforce “hanging out with someone,” not “using a tool.”
2. **Persistent Relationship Memory**
    - The core magic: characters **remember users and events over time**.
    - Examples:
        - “How did your exam go?” (it was mentioned 3 days ago)
        - “You said weekends are hard for you—how are you feeling today?”
        - “You got that job interview next week, right?”
3. **Multi-Session “Chapters”**
    - Conversations feel like **episodes**:
        - Each session has a small arc (starting state → emotional beat → closing note).
        - The app references previous chapters (“Last time we…”).
4. **Distinct, Stable Personalities**
    - Each character has:
        - fixed traits (e.g., shy but kind, blunt but loyal),
        - consistent language style,
        - consistent boundaries (how far flirting can go, topics they avoid).
    - Changing characters should *feel like switching shows*.
5. **Low-Friction Daily Check-In Loop**
    - It should be easy to:
        - pick up where you left off,
        - get a suggested starter (“Coffee break?” / “How was your day?”),
        - leave the chat feeling a bit lighter or more connected.
6. **Theme-Agnostic Engine Underneath**
    - The UX skin is “cozy romcom, next door vibe,”
        
        but the **data model and agents** are generic:
        
        - `Character`, `World`, `Relationship`, `Memory`, `Episode`, `Hook`.
    - This allows future skins (fantasy, wellness, study buddy) without rebuilding the substrate.

---

## 4) Core Loops

### 4.1 New User Loop (Day 0)

1. **Landing page promise**
    - “Cozy AI characters that remember your story.”
    - Simple visuals: 2–3 main archetypes (e.g. barista, neighbor, coworker).
2. **Onboarding**
    - Lightweight: name, pronouns (optional), age confirmation, time zone.
    - Quick preference picks:
        - “Pick your starting vibe” → [Comforting friend] [Flirty crush] [Chill coworker].
    - User picks one starting character.
3. **First meeting**
    - Scripted “Episode 0”:
        - simple situation: first time at café / move-in day / first day at work.
        - clear hook: “Nice to meet you; can I remember a few things about you?”
    - Behind the scenes:
        - create `User Profile` block (name, basics),
        - create `Relationship` block with this character,
        - log initial `Memory Events` (job, school, hobbies, key stressor).
4. **Soft close**
    - Character ends with:
        - a small future hook (“Next time you stop by, tell me how that project went?”),
        - optional “notify me when you’re free” toggle or time-of-day preference.

---

### 4.2 Daily Loop (D1+)

1. **Re-entry**
    - Home screen shows:
        - main character card(s),
        - small snippet from last chat,
        - a lightweight prompt (“Continue where you left off?” / “Check in?”).
2. **Episode continuation**
    - Start of chat:
        - system surfaces 1–3 relevant **memory hooks**.
        - Character naturally references something:
            - “You said you had an early meeting today… how’d it go?”
    - Mid-chat:
        - user shares new info; system logs `Memory Events`.
    - End:
        - character may:
            - set a soft future hook (“Let me know when you hear back from them.”),
            - reflect a bit (“I’m glad you told me that. I’ll remember.”).
3. **Retention nudge**
    - Lightweight, user-controlled notifications:
        - “Your barista crush is wondering how your exam went ☕”
        - “It’s been a while since you talked to your neighbor upstairs.”

---

### 4.3 Progression Loop

- **Relationship depth (non-gamified, but trackable)**:
    - Internal `relationship_stage` for each character:
        - acquaintance → friendly → close → intimate (tone, not explicit requirement).
    - Stage progression is based on:
        - number of meaningful episodes (not spam),
        - emotional disclosures (stress, goals, events),
        - time span of relationship.
- **Unlockables (soft)**:
    - Premium or milestone-based:
        - new settings (after hours at café, weekend hangout),
        - special scenario prompts,
        - additional art or expressions,
        - custom nicknames / inside jokes surfaced by the character.

---

## 5) Character System

### 5.1 Archetypes (Initial Set)

1. **The Barista Next Door**
    - Setting: local coffee shop.
    - Vibe: warm, observant, slightly teasing.
    - JTBD fit: “remembers my usual,” daily life talk, gentle support.
2. **The Neighbor**
    - Setting: same building / floor.
    - Vibe: easygoing, checks in casually, sometimes chaotic.
    - JTBD fit: loneliness, late-night conversations, “we’re both up at 1am” energy.
3. **The Coworker / Classmate**
    - Setting: office or campus.
    - Vibe: relatable, stressed but caring, shares similar pressures.
    - JTBD fit: work/school stress, venting, validation.

You can easily add later:

- Bandmate, fellow creator, gym buddy, etc., all using same engine.

### 5.2 Character Data (Generic Model)

Each `Character` has:

- **Core fields**
    - `id`
    - `name`
    - `archetype` (barista, neighbor, coworker, etc.)
    - `world_id` (links to setting)
    - `baseline_personality` (Big 5-style or custom tags)
    - `tone_style` (text style: emojis, slang, formality)
- **Backstory & edges**
    - `short_backstory`
    - `current_stressor` (gives them their own “life”)
    - `boundaries` (topics they avoid, NSFW limits, etc.)
- **Relationship logic**
    - `relationship_stage_thresholds`
    - `starter_prompts`
    - `special_episode_templates` (for milestone scenes)

---

## 6) World, Episodes & Memory

### 6.1 Worlds / Settings

`World` is a lightweight concept:

- `id`
- `name` (“Neighborhood Café”, “Greenview Apartments”, “Downtown Office”)
- `default_scenes` (coffee bar, back room, hallway, rooftop, etc.)
- `tone` (cozy, busy, urban)

Characters live in Worlds; episodes reference them loosely for flavor, not heavy lore.

### 6.2 Episodes / Chapters

`Episode` ≈ one session of conversation:

- `id`
- `user_id`
- `character_id`
- `started_at`, `ended_at`
- `summary` (LLM-generated, 1–3 sentences)
- `emotional_tags` (happy, anxious, lonely, hopeful)
- `key_events` (exam, breakup, promotion, family conflict)

These feed back into:

- relationship progression,
- future hooks,
- recap prompts (“Want a quick summary of your last 3 talks with [Name]?”).

### 6.3 Memory Events

`MemoryEvent` is generic and theme-agnostic:

- `id`
- `user_id`
- `character_id` (optional if global to user)
- `type` (fact, preference, event, goal, relationship, meta)
- `content` (structured JSON or text)
- `emotional_valence` (–2 to +2)
- `importance_score`
- `created_at`, `last_referenced_at`

Engine responsibilities:

- Extract these from chat (LLM + rules).
- Store in Supabase.
- Retrieve relevant ones each episode (based on recency, importance, topic).

---

## 7) Monetization & Pricing

### 7.1 Baseline model

- **Free tier**
    - 1–2 core characters.
    - Limited daily messages or episodes.
    - Basic memory (shorter lookback window, fewer hooks).
- **Premium subscription**
    - Unlimited daily messaging.
    - Extended memory horizon (deeper recall).
    - Up to X active characters in your “cast.”
    - Access to special episodes / scenarios (weekend hangouts, special events).
    - Optional: more expressive art/variations.

### 7.2 UX framing

Avoid “pay to be loved.” Frame as:

- “Support your favorite characters & unlock more of your story together.”
- “Premium gives your characters a stronger memory and more time with you.”

---

## 8) Safety, Compliance & Age

High-level (you can later translate to internal policy):

- **Age gating**
    - 16+ or 18+ depending on jurisdictions and eventual content direction.
    - Clear disclosure that this is a fictional AI experience.
- **Content**
    - Allow romance & flirting where legal.
    - Explicit sexual content: follow local laws + platform policies.
        
        (If needed, separate NSFW zones under strict age + location control.)
        
    - No minors in romantic/sexual framing. Ever.
- **User mental health**
    - Soft boundaries:
        - character can encourage real-life support (“Have you talked to anyone offline?”),
        - clear info that this is not a therapist or doctor.
- **Legal baseline**
    - Follow relevant data privacy (GDPR/CCPA where applicable).
    - Clear communication about data storage for “memory.”

---

## 9) Metrics & Analytics

Beyond NSM (CCPW) and secondaries:

- **Activation**
    - % of signups that:
        - finish first episode,
        - return within 24–72 hours.
- **Attachment signals**
    - of users with:
        - 5 episodes with same character,
        - 30 DSM,
        - who bookmark/“pin” a character as “favorite.”
- **Monetization**
    - Free → paid conversion rate.
    - Churn reasons (through lightweight, in-chat questions).

---

## 10) MVP Scope (First 4–6 Week Build)

**MVP Goal:**

Prove that **English-speaking users will come back repeatedly to talk to 1–2 “next door” characters and show early willingness to pay.**

### 10.1 Must-have (MVP)

- Auth + basic profile (name, age confirmation, timezone).
- 1 archetype fully implemented (e.g. **Barista Next Door**).
- Simple chat UI (web, mobile-optimized).
- Basic memory:
    - store user facts & events,
    - surface 1–2 hooks per session.
- Episode logging:
    - start/end timestamps,
    - basic LLM summary stored.
- Manual or simple Stripe subscription (can be ugly).
- Single landing page explaining concept.

### 10.2 Nice-to-have (still small)

- Second archetype (Neighbor or Coworker).
- Relationship stage tracking (even if not fully exposed).
- Lightweight notification / email reminder (“[Name] is thinking about you”).

---

## 11) Architecture Note (Important)

Even though **this document is themed for “boy/girl next door, cozy romcom”**, the **actual backend concepts** should be:

- `Character` (generic)
- `World` (generic)
- `Episode` (generic)
- `MemoryEvent` (generic)
- `Relationship` (generic)
- `Hook / Reminder` (generic)

Thematically:

- Today’s *marketing skin* = **Cozy Romcom Companion**
- Tomorrow’s possible skins (with same engine):
    - Soft wellness coach,
    - Study buddy with emotional memory,
    - Light fantasy prince/princess,
    - Creator/streamer companion.