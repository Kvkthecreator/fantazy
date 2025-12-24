# Quality System Changelog

All notable changes to the Quality System documentation.

Format: `[Document] vX.Y.Z - YYYY-MM-DD`

---

## [Unreleased]

### Proposed
- Interactive instruction cards (clickable choices)
- Pacing visualization in ChatHeader

---

## 2024-12-24

### Added
- **[ADR-003]** Image Generation Strategy - Cinematic Inserts for Auto-Gen
  - Two-track strategy: Auto-gen = T2I cinematic inserts, Manual = dual mode (T2I + Kontext)
  - Anime insert shot philosophy (Makoto Shinkai, Cowboy Bebop)
  - Environmental storytelling over character consistency for auto-gen
  - Cost reduction: $0.05 vs $0.15 per auto-gen (67% savings)
  - Improved manual prompting: facial expressions, body language, composition

- **[modalities/IMAGE_GENERATION.md]** v1.2.0 - Hybrid trigger model + observability
  - **v1.2 Update**: Turn-based visual triggers (deterministic WHEN + semantic WHAT)
  - Strategic philosophy: Two-track generation approach
  - Track 1 (Auto-gen): Cinematic insert shot standards, prompting templates, quality checklist
  - Track 2 (Manual): Kontext Pro and T2I mode specifications with Phase 1C improvements
  - Subscription & budget gating logic
  - Quality anti-patterns catalog with fixes
  - Cost analysis and economics
  - Evolution tracking with open questions
  - Provider configuration documentation (Phase 1E)

- **[DIRECTOR_PHASE_2_4_VISUAL_OBSERVABILITY.md]** - Implementation plan for hybrid model
  - Root cause analysis: LLM-driven visual triggers unreliable (Gemini Flash too conservative)
  - Solution architecture: Deterministic turn-based triggers (25%, 50%, 75% of episode)
  - Observability enhancements: raw_response logging, visual_decisions history, parse_method tracking
  - Testing strategy and success metrics
  - Migration path and rollout plan

### Changed
- **[DIRECTOR_PROTOCOL.md]** v2.4.0 - Hybrid Visual Triggers + Observability
  - **NEW Section**: "Visual Trigger Strategy (v2.4 - Hybrid Model)"
  - Replaced LLM-driven visual decisions with deterministic turn-based triggers
  - Simplified LLM prompt: description-only (no SIGNAL format, no complex parsing)
  - Added observability fields: raw_response, parse_method, visual_decisions history
  - Benefits: Predictable, testable, reliable, model-agnostic

- **[DIRECTOR_PROTOCOL.md]** v2.3.0 - Memory & Hook Extraction Ownership
  - Director now owns all post-exchange processing (memory, hooks, beats)
  - Removed dual ownership (ConversationService._process_exchange deleted)
  - Clarified memory scoping: series-level (preferred), character-level (fallback)
  - Clarified hook scoping: character-level only (cross-series by design)
  - Director orchestrates extraction; MemoryService handles storage/retrieval
  - Added "Director vs MemoryService Ownership" table
  - Updated data flow diagram for v2.3

- **[CONTEXT_LAYERS.md]** v1.3.0 - Memory/Hook Scoping Architecture
  - Added explicit scoping architecture for memories (series > character)
  - Documented hooks as character-scoped (intentional cross-series behavior)
  - Updated Layer 4 ownership: MemoryService + Director collaboration
  - Added extraction ownership flow diagram
  - Design decision: Callbacks are personal, not narrative-bounded

- **[ImageService]** Default provider changed from Gemini Flash to FLUX Schnell (Phase 1E)
  - DEFAULT_PROVIDER: "gemini" → "replicate"
  - DEFAULT_MODEL: "gemini-3-flash-preview" → "black-forest-labs/flux-schnell"
  - Rationale: FLUX Schnell properly supports negative prompts, Gemini Flash doesn't
  - Cost improvement: Auto-gen now $0.003 vs intended $0.05 (94% cheaper!)
  - Fixed manual T2I generation 500 error

- **[SceneService]** Image generation refactoring (Phase 1A/1B/1C/1E)
  - Phase 1A: Fixed broken auto-gen trigger, added subscription gating
  - Phase 1B: Added `_generate_cinematic_insert()` for Director auto-gen
  - Phase 1C: Improved `KONTEXT_PROMPT_TEMPLATE` and `T2I_PROMPT_TEMPLATE` in services/scene.py
  - Phase 1E: Applied Phase 1C improvements to routes/scenes.py (manual generation)
  - Auto-gen now T2I only (no avatar kit lookup, simplified pipeline)
  - Manual generation retains dual mode with improved prompting

- **[Manual Generation Routes]** Phase 1C template improvements applied (Phase 1E)
  - Updated KONTEXT_PROMPT_TEMPLATE with facial expression/composition focus
  - Updated T2I_PROMPT_TEMPLATE with 6 focus areas (appearance, expression, body language, composition, lighting, camera)
  - Added good/bad examples to both templates
  - Fixed 500 error by switching to FLUX Schnell default provider

- **[DirectorService]** Hybrid visual trigger model (v2.4 - commit 317cb551)
  - Added `_should_generate_visual_deterministic()` - pure function, turn-based trigger logic
  - Modified `decide_actions()` - call deterministic check first, use LLM description only
  - Simplified `evaluate_exchange()` prompt - removed SIGNAL format, just VISUAL + STATUS
  - Updated `_parse_evaluation()` - extract description & status (no complex regex)
  - Enhanced `process_exchange()` - save raw_response, parse_method, visual_decisions history
  - Added logging: warnings on parse failures, info on visual triggers with reasons
  - Deterministic triggers: 25%, 50%, 75% for cinematic (budget=3), 90%+ for minimal

### Fixed
- **[Frontend - ChatContainer]** Auto-gen scene images now appear in chat without page refresh (commit 685cdc95)
  - Root cause: useScenes hook only loaded scenes once on episode mount
  - Solution: Wire visual_pending event from useChat to trigger scene refresh
  - Added refreshScenesRef + onVisualPending callback with 1-second setTimeout
  - Completes Director v2.4 end-to-end pipeline (backend + frontend)

- **[Director Auto-Gen]** Visual triggers now reliable and observable (v2.4)
  - Root cause: Gemini Flash evaluated ALL turns as visual_type="none" despite clear visual moments
  - Fix: Replaced LLM decision with deterministic turn-based triggers
  - Impact: Auto-gen will now fire predictably at 25%, 50%, 75% of episode
  - Observability: Can now see full LLM responses and decision reasons in director_state
- **[HOTFIX]** Director completely broken - removed orphaned execute_actions() call (commit bf3331c0)
  - Phase 1A removed execute_actions() method but missed removing the call in process_exchange()
  - Caused: 'DirectorService' object has no attribute 'execute_actions' error on every exchange
  - Impact: Director silently failed - no turn_count updates, no memory/hook extraction, no auto-gen images
  - Fix: Removed orphaned method call from process_exchange() line 570
  - Result: Director now runs properly, all Phase 2 features now functional

### Removed
- **[ConversationService]**: `_process_exchange()` method (55 lines)
  - Legacy memory/hook extraction consolidated into Director
  - Duplicate extraction calls removed from send_message() and send_message_stream()

- **[DirectorActions]**: Obsolete fields removed
  - `save_memory`, `memory_content` (moved to process_exchange v2.3)
  - `execute_actions()` method (dead code, counter moved to generation path)

- **[Stream Events]**: Legacy spark-charging fields removed
  - `sparks_deducted` field from visual_pending events
  - `needs_sparks` event type (Ticket + Moments has no per-gen charging)

---

## 2024-12-23

### Changed
- **[DIRECTOR_PROTOCOL.md]** v2.1.0 - Hardened on Ticket + Moments model
  - Replaced Auto-Scene Modes section with Visual Mode section
  - Removed legacy `auto_scene_mode`, `scene_interval`, `spark_cost_per_scene` references
  - Visual costs now included in `episode_cost` (no per-image charging)
  - Director triggers on semantic evaluation, not turn counts

- **[DIRECTOR_UI_TOOLKIT.md]** v1.1.0 - Ticket + Moments alignment
  - Replaced legacy configuration with `visual_mode`, `generation_budget`, `episode_cost`
  - Updated Spark Balance Handling for entry-gate model
  - Removed per-generation spark checking from data flow

- **[CONTEXT_LAYERS.md]** v1.5.0 - Genre architecture decided (ADR-001)
  - `character.genre` **removed** - genre belongs to Story, not Character
  - `GENRE_DOCTRINES` moved from `build_system_prompt()` to Director
  - Genre doctrine now injected via `DirectorGuidance.to_prompt_section()` at runtime
  - `build_system_prompt()` is now genre-agnostic (personality, voice, boundaries only)

- **[CONTEXT_LAYERS.md]** v1.4.0 - Clarification items resolved
  - `turn_budget` documented as Director domain (pacing, not hard limit)
  - `series_finale` removed (never used)
  - Genre hierarchy documented for future consolidation (3 levels: character, episode, series)

- **[CONTEXT_LAYERS.md]** v1.3.0 - Engagement layer cleanup
  - Stage progression (`stage`, `stage_progress`) sunset - dynamic system replaces it
  - `relationship_stage`/`relationship_progress` removed from ConversationContext
  - Prompt now uses dynamic `tone` instead of static stage labels

- **[CONTEXT_LAYERS.md]** v1.2.0 - Boundaries simplification
  - Simplified `boundaries` to only `flirting_level` and `nsfw_allowed`
  - Replaced Character Dynamics card with focused Energy Level card
  - `flirting_level` now surfaced with clear UI (reserved/playful/flirty/bold)

- **[CONTEXT_LAYERS.md]** v1.1.0 - Character data model simplification
  - `short_backstory` and `full_backstory` merged into single `backstory` field
  - `current_stressor` removed - episode `situation` now conveys emotional state
  - `life_arc` removed - backstory + archetype + genre doctrine provide character depth
  - Added `likes/dislikes` documentation (first 5 used in prompt)

### Removed
- **Episode Layer (Visual)**: Legacy visual generation fields:
  - `auto_scene_mode` - superseded by `visual_mode`
  - `scene_interval` - rhythmic mode removed (semantic triggers only)
  - `spark_cost_per_scene` - costs now in `episode_cost`
- **Episode Layer (Dynamics)**: Unused fields:
  - `arc_hints`, `beat_guidance`, `fade_hints` - never used in prompt generation
- **Director Service**: Legacy fallback code for `auto_scene_mode`
- **Character Dynamics UI**: Removed 9 fields that were never used in prompt generation:
  - `availability`, `vulnerability_pacing`, `desire_expression`, `physical_comfort`
  - `dynamics_notes`, `can_reject_user`, `relationship_max_stage`
  - `avoided_topics`, `has_own_boundaries`
- **Character Layer**: `life_arc` field (was half-implemented, no UI)
- **Character Layer**: `current_stressor` field (redundant with episode situation)
- **ConversationContext**: `character_life_arc` field and `_format_life_arc()` method
- **ConversationContext**: `relationship_stage` and `relationship_progress` fields
- **Engagement Model**: `inside_jokes` field (never populated)
- **Episode Template**: `series_finale` field (never used in prompts or Director)
- **Character Model**: `relationship_stage_thresholds` field (never read)
- **Prompt Templates**: `Relationship: {relationship_stage}` from scene prompts
- **Create Wizard**: `can_reject_user` toggle (was never used)
- **Memory Model**: `MemoryType.META` (never extracted or formatted)
- **Memory Model**: `MemoryQuery` class (never used - retrieval done in service)
- **Hook Model**: `HookType.ANNIVERSARY` (never extracted - not in LLM prompt)
- **Hook Model**: `context` field on Hook and HookCreate (never populated)

### Migration
- Database migration `042_drop_sunset_engagement_columns.sql` drops stage progression fields
- Database migration `041_drop_legacy_visual_columns.sql` drops legacy visual fields
- Database migration `039_consolidate_backstory_fields.sql` merges backstory fields
- UI Backstory tab simplified to single textarea
- Likes/dislikes now show "X/5 used in prompt" indicator
- CharacterBoundaries model simplified to 2 fields
- DEFAULT_BOUNDARIES reduced from 6 fields to 2

---

## 2025-12-20

### Added
- **[modalities/TEXT_RESPONSES.md]** v1.0.0 - Text response quality specification
  - Action-dialogue pattern standard
  - Notation conventions (* vs parentheses)
  - Length guidelines with variety principle
  - Physical grounding requirements
  - Anti-patterns catalog (therapist response, exposition dump, etc.)
  - Prompt structure recommendations
  - Quality checklist

### Changed
- **[play/]** Play Mode character prompts refined for shorter, flirtier responses
  - Added emphatic length constraints (1-2 sentences max)
  - Added good/bad response examples
  - Simplified prompt structure

---

## 2024-12-20 (Night)

### Added
- **[play/README.md]** v1.0.0 - Play Mode system overview
  - Document structure for viral experiences
  - Decision log and current state

- **[play/PLAY_MODE_ARCHITECTURE.md]** v1.1.0 - Play Mode architecture
  - Routing specification (/play, /play/[slug], /r/[id])
  - Anonymous-until-conversion auth flow
  - **Content isolation via series_type: "play"**
  - **Male + Female character variants (Jack/Emma)**
  - **Comprehensive share infrastructure and virality spec**
  - Post-auth flow and session linking
  - Analytics events for viral tracking

- **[play/TROPE_SYSTEM.md]** v1.0.0 - Romantic Trope taxonomy
  - 5 Romantic Tropes (replacing Flirt Archetypes)
  - Behavioral signals for detection
  - LLM evaluation prompt specification
  - Static content requirements

- **[play/RESULT_REPORT_SPEC.md]** v1.0.0 - Result report design
  - Report structure (identity, evidence, callback, cultural)
  - Share card specification
  - Component requirements

- **[play/IMPLEMENTATION_STATUS.md]** v1.1.0 - Implementation tracking
  - **Critical path items identified (DB constraint, missing methods)**
  - Current state audit (Flirt Test v1)
  - Gap analysis for Romantic Trope v2
  - 6-phase implementation plan

---

## 2024-12-20 (Evening)

### Added
- **[DIRECTOR_UI_TOOLKIT.md]** v1.0.0 - Director UI responsibilities
  - Complete stream event catalog
  - Visual type taxonomy with cost model
  - Auto-scene mode configuration
  - Component mapping (SceneCard, InstructionCard, etc.)
  - Frontend hook interface
  - Data flow diagram

### Implemented
- Director pre-guidance (Phase 1) in conversation flow
- Turn-aware pacing in conversation service
- Genre beat injection via GENRE_BEATS lookup
- Pacing field in StreamDirectorState

---

## 2024-12-20

### Added
- **[QUALITY_FRAMEWORK.md]** v1.0.0 - Initial quality framework
  - Three quality dimensions: Contextual Coherence, Emotional Resonance, Narrative Momentum
  - Quality levels (1-5) with definitions
  - Quality anti-patterns catalog
  - Success signals by genre
  - Measurement protocol

- **[CONTEXT_LAYERS.md]** v1.0.0 - Context layer specification
  - 6-layer architecture documented
  - Layer 6 (Director Guidance) proposed
  - Token budget estimates
  - Layer composition order

- **[DIRECTOR_PROTOCOL.md]** v2.0.0 - Director behavior specification
  - Two-phase model: pre-guidance + post-evaluation
  - Pacing algorithm defined
  - Visual type taxonomy
  - Genre-specific director behavior
  - Auto-scene modes

- **[README.md]** - Quality system overview
  - Document structure
  - Usage guide for engineers/creators
  - Version policy
  - Migration notes

---

## Migration from Previous Docs

| Old Location | New Location | Status |
|--------------|--------------|--------|
| `docs/prompting/PROMPTING_STRATEGY.md` | Remains (implementation) | Reference |
| `docs/character-philosophy/Genre 01 — Romantic Tension.md` | `docs/quality/genres/ROMANTIC_TENSION.md` | Planned |
| `docs/character-philosophy/Genre 02 — Psychological Thriller.md` | `docs/quality/genres/PSYCHOLOGICAL_THRILLER.md` | Planned |
| `docs/character-philosophy/PHILOSOPHY.md` | Absorbed into QUALITY_FRAMEWORK | Archived |

---

## Version Numbering

- **Major (X.0.0)**: Breaking changes to quality expectations or behavior
- **Minor (0.X.0)**: New guidance, features, or enhanced clarity
- **Patch (0.0.X)**: Typos, clarifications, examples

---

## How to Add Entries

1. Add entry under `[Unreleased]` section during development
2. Move to dated section when deployed
3. Include document name, version, and brief description
4. Link to relevant PRs or issues if applicable
