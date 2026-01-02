/**
 * Fantazy API Types
 */

// User types
export interface User {
  id: string;
  display_name: string | null;
  pronouns: string | null;
  timezone: string;
  age_confirmed: boolean;
  onboarding_completed: boolean;
  onboarding_step: string | null;
  preferences: Record<string, unknown>;
  subscription_status: string;
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserUpdate {
  display_name?: string;
  pronouns?: string;
  timezone?: string;
  preferences?: UserPreferences;
  onboarding_completed?: boolean;
  onboarding_step?: string;
}

export interface UserPreferences {
  notification_enabled?: boolean;
  notification_time?: string;
  theme?: string;
  language?: string;
  vibe_preference?: string;
  visual_mode_override?: "always_off" | "always_on" | "episode_default";
}

// Character types
export type Genre = "romantic_tension" | "psychological_thriller";

export interface CharacterSummary {
  id: string;
  name: string;
  slug: string;
  archetype: string;
  avatar_url: string | null;
  backstory: string | null; // NOTE: short_backstory/full_backstory merged into backstory
  is_premium: boolean;
  genre?: Genre;
}

export interface AvatarGalleryItem {
  id: string;
  url: string;
  label: string | null;
  is_primary: boolean;
}

export interface CharacterProfile extends CharacterSummary {
  // NOTE: backstory inherited from CharacterSummary (short_backstory/full_backstory merged)
  likes: string[];
  dislikes: string[];
  gallery: AvatarGalleryItem[];
  primary_avatar_url: string | null;
  content_rating?: string;
  // NOTE: starter_prompts moved to episode_templates (EP-01 Episode-First Pivot)
}

export interface Character extends CharacterSummary {
  world_id: string | null;
  genre: Genre;
  baseline_personality: Record<string, unknown>;
  tone_style: Record<string, unknown>;
  speech_patterns: Record<string, unknown>;
  // NOTE: backstory inherited from CharacterSummary (short_backstory/full_backstory merged)
  // NOTE: current_stressor removed - episode situation conveys emotional state
  likes: string[];
  dislikes: string[];
  system_prompt: string;
  boundaries: Record<string, unknown>;
  relationship_stage_thresholds: Record<string, number>;
  is_active: boolean;
  sort_order: number;
  // NOTE: opening_situation, opening_line, starter_prompts, example_messages
  // are now in episode_templates only (EP-01 Episode-First Pivot)
  status: "draft" | "active";
  categories: string[];
  content_rating: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Engagement types (formerly Relationship - EP-01 pivot)
// Stage progression is sunset - no longer tracked
export interface Engagement {
  id: string;
  user_id: string;
  character_id: string;
  // Stage removed (EP-01 pivot)
  total_sessions: number;  // was total_episodes
  total_messages: number;
  first_met_at: string;
  last_interaction_at: string | null;
  nickname: string | null;
  inside_jokes: string[];
  engagement_notes: string | null;  // was relationship_notes
  metadata: Record<string, unknown>;
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface EngagementWithCharacter extends Engagement {
  character_name: string;
  character_slug: string;
  character_archetype: string;
  character_avatar_url: string | null;
}

// Legacy aliases for backwards compatibility
/** @deprecated Use Engagement instead */
export type RelationshipStage =
  | "acquaintance"
  | "friendly"
  | "close"
  | "intimate";

/** @deprecated Use Engagement instead */
export interface Relationship {
  id: string;
  user_id: string;
  character_id: string;
  stage?: RelationshipStage;
  stage_progress?: number;
  total_episodes?: number;
  total_sessions?: number;  // New name
  total_messages: number;
  first_met_at: string;
  last_interaction_at: string | null;
  nickname: string | null;
  inside_jokes: string[];
  relationship_notes?: string | null;
  engagement_notes?: string | null;  // New name
  metadata: Record<string, unknown>;
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use EngagementWithCharacter instead */
export interface RelationshipWithCharacter extends Relationship {
  character_name: string;
  character_slug: string;
  character_archetype: string;
  character_avatar_url: string | null;
}

// Session types (formerly Episode runtime - EP-01 pivot)
export interface SessionSummary {
  id: string;
  character_id: string;
  episode_number: number;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  is_active: boolean;
}

export interface Session extends SessionSummary {
  user_id: string;
  engagement_id: string | null;  // was relationship_id
  episode_template_id: string | null;
  scene: string | null;
  summary: string | null;
  emotional_tags: string[];
  key_events: string[];
  user_message_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Legacy aliases for backwards compatibility
/** @deprecated Use SessionSummary instead */
export interface EpisodeSummary {
  id: string;
  character_id: string;
  episode_number: number;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  is_active: boolean;
}

/** @deprecated Use Session instead */
export interface Episode extends EpisodeSummary {
  user_id: string;
  relationship_id?: string | null;
  engagement_id?: string | null;  // New name
  episode_template_id: string | null;
  scene: string | null;
  summary: string | null;
  emotional_tags: string[];
  key_events: string[];
  user_message_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Episode Template Types (Pre-defined Scenarios)
// ============================================================================

/**
 * Episode type per EPISODES_CANON_PHILOSOPHY.md Section 5
 */
export type EpisodeType = "entry" | "core" | "expansion" | "special";

/**
 * Episode Template Summary - for episode selection UI
 */
export interface EpisodeTemplateSummary {
  id: string;
  character_id: string | null;  // Anchor character (nullable for drafts)
  episode_number: number;
  episode_type: EpisodeType;
  title: string;
  slug: string;
  background_image_url: string | null;
  is_default: boolean;
}

/**
 * Episode Discovery Item - for episode-first discovery UI
 * Includes character and series context for display
 */
export interface EpisodeDiscoveryItem extends EpisodeTemplateSummary {
  situation: string;
  character_id: string;
  character_name: string;
  character_slug: string;
  character_archetype: string;
  character_avatar_url: string | null;
  // Series context (for Series-First discovery)
  series_id: string | null;
  series_title: string | null;
  series_slug: string | null;
  world_id: string | null;
  world_name: string | null;
}

/**
 * Episode Template - full details for starting a conversation
 * Extended with Director V2 configuration per DIRECTOR_ARCHITECTURE.md
 */
export interface EpisodeTemplate extends EpisodeTemplateSummary {
  character_id: string | null;  // Anchor character (nullable for drafts)
  series_id: string | null;  // Series container
  // featured_characters deferred until crossover content (Genesis Stage = single anchor)
  situation: string;
  opening_line: string;
  starter_prompts: string[];  // Alternative opening suggestions for UI (EP-01 refactor)
  episode_frame: string | null;
  arc_hints: Record<string, unknown>[];
  sort_order: number;
  status: string;
  // Episode Dynamics
  dramatic_question: string | null;  // Narrative tension to explore
  resolution_types: string[];  // Valid endings: positive, neutral, negative, surprise
  // Scene Motivation (ADR-002: Theatrical Model)
  scene_objective: string | null;  // What character wants from user this scene
  scene_obstacle: string | null;   // What's stopping them from just asking
  scene_tactic: string | null;     // How they're trying to get what they want
  // Director V2 configuration
  genre: string;  // Story genre for semantic evaluation
  auto_scene_mode: AutoSceneMode;  // off, peaks, rhythmic
  scene_interval: number | null;  // For rhythmic mode
  spark_cost_per_scene: number;  // Cost per auto-generated visual
  series_finale: boolean;  // Is this the last episode in series
  turn_budget: number | null;  // Optional turn limit
}

// Message types
export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  episode_id: string;
  role: MessageRole;
  content: string;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MessageCreate {
  content: string;
}

// Memory types
export type MemoryType =
  | "fact"
  | "preference"
  | "event"
  | "goal"
  | "relationship"
  | "emotion"
  | "meta";

export interface MemoryEvent {
  id: string;
  user_id: string;
  character_id: string | null;
  episode_id: string | null;
  type: MemoryType;
  category: string | null;
  content: Record<string, unknown>;
  summary: string;
  emotional_valence: number;
  importance_score: number;
  last_referenced_at: string | null;
  reference_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// Hook types
export type HookType =
  | "reminder"
  | "follow_up"
  | "milestone"
  | "scheduled"
  | "anniversary";

export interface Hook {
  id: string;
  user_id: string;
  character_id: string;
  episode_id: string | null;
  type: HookType;
  priority: number;
  content: string;
  context: string | null;
  suggested_opener: string | null;
  trigger_after: string | null;
  trigger_before: string | null;
  triggered_at: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Conversation context
export interface ConversationContext {
  relationship_stage: string;
  relationship_progress: number;
  message_count: number;
  memory_count: number;
  hook_count: number;
  memories: Array<{ type: string; summary: string }>;
  hooks: Array<{ type: string; content: string }>;
}

// World types
export interface World {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  default_scenes: string[];
  tone: string | null;
  ambient_details: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// Series Types (per CONTENT_ARCHITECTURE_CANON.md)
// ============================================================================

/**
 * Series type per GLOSSARY.md
 * - play: Viral/game content for /play route (anonymous-first)
 */
export type SeriesType = "standalone" | "serial" | "anthology" | "crossover" | "play";

// Genre settings types for series-level doctrine customization
export type TensionStyle = "subtle" | "playful" | "moderate" | "direct";
export type PacingCurve = "slow_burn" | "steady" | "fast_escalate";
export type ResolutionMode = "open" | "closed" | "cliffhanger";
export type VulnerabilityTiming = "early" | "middle" | "late" | "earned";

export interface GenreSettings {
  tension_style: TensionStyle;
  pacing_curve: PacingCurve;
  resolution_mode: ResolutionMode;
  vulnerability_timing: VulnerabilityTiming;
  genre_notes: string;
}

export interface GenreSettingsOptions {
  tension_styles: TensionStyle[];
  pacing_curves: PacingCurve[];
  resolution_modes: ResolutionMode[];
  vulnerability_timings: VulnerabilityTiming[];
  presets: Record<string, GenreSettings>;
}

export interface GenreSettingsResponse {
  genre: string | null;
  settings: GenreSettings;
  prompt_section: string;
}

/**
 * Series Summary - for lists and cards
 */
export interface SeriesSummary {
  id: string;
  title: string;
  slug: string;
  tagline: string | null;
  series_type: SeriesType;
  genre: string | null;  // For filtering (romantic_tension, psychological_thriller, etc.)
  world_id: string | null;  // For filtering by world
  total_episodes: number;
  cover_image_url: string | null;
  is_featured: boolean;
}

/**
 * Full Series model
 */
export interface Series extends SeriesSummary {
  description: string | null;
  world_id: string | null;
  featured_characters: string[];
  episode_order: string[];
  thumbnail_url: string | null;
  status: "draft" | "active" | "archived" | "featured";
  featured_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Episode Summary for drawer/navigation - includes situation for context
 * (Richer than EpisodeTemplateSummary, used by series.getWithEpisodes)
 */
export interface EpisodeDrawerItem extends EpisodeTemplateSummary {
  situation: string;
  opening_line?: string;
  episode_frame?: string | null;
  dramatic_question?: string | null;
  // Scene Motivation (ADR-002: Theatrical Model)
  scene_objective?: string | null;
  scene_obstacle?: string | null;
  scene_tactic?: string | null;
  sort_order: number;
  status: string;
}

/**
 * Series with embedded episode templates
 */
export interface SeriesWithEpisodes extends Series {
  episodes: EpisodeDrawerItem[];
}

/**
 * Series with embedded character summaries
 */
export interface SeriesWithCharacters extends Series {
  characters: CharacterSummary[];
}

/**
 * Episode progress for a user (derived from session states)
 */
export interface EpisodeProgressItem {
  episode_id: string;
  status: "not_started" | "in_progress" | "completed";
  last_played_at?: string | null;
}

/**
 * Series progress response - user's progress through all episodes
 */
export interface SeriesProgressResponse {
  series_id: string;
  progress: EpisodeProgressItem[];
}

/**
 * Continue Watching item - a series playthrough the user has interacted with.
 *
 * ADR-004: Each (series, character) pair is a distinct playthrough.
 * A user can have multiple entries for the same series with different characters.
 */
export interface ContinueWatchingItem {
  series_id: string;
  series_title: string;
  series_slug: string;
  series_cover_image_url: string | null;
  series_genre: string | null;
  total_episodes: number;
  current_episode_id: string;
  current_episode_title: string;
  current_episode_number: number;
  // Character info (ADR-004)
  character_id: string;
  character_name: string;
  character_avatar_url: string | null;
  character_is_user_created: boolean;
  // Progress
  last_played_at: string;
  session_state: string;
}

/**
 * Continue Watching response
 */
export interface ContinueWatchingResponse {
  items: ContinueWatchingItem[];
}

/**
 * Chat item - a session with character info for My Chats page
 */
export interface ChatItem {
  session_id: string;
  character_id: string;
  character_name: string;
  character_avatar_url: string | null;
  character_archetype: string | null;
  is_free_chat: boolean;
  episode_number: number | null;
  episode_title: string | null;
  series_id: string | null;
  series_title: string | null;
  message_count: number;
  last_message_at: string | null;
  session_state: string;
  is_active: boolean;
}

/**
 * User chats response
 */
export interface UserChatsResponse {
  items: ChatItem[];
}

/**
 * User engagement stats with a series
 */
export interface SeriesEngagementStats {
  total_sessions: number;
  total_messages: number;
  episodes_completed: number;
  episodes_in_progress: number;
  first_played_at: string | null;
  last_played_at: string | null;
}

/**
 * Current/next episode info for user
 */
export interface CurrentEpisodeInfo {
  episode_id: string;
  episode_number: number;
  title: string;
  situation: string | null;
  status: "not_started" | "in_progress" | "completed";
}

/**
 * Character info for display in series context (ADR-004)
 */
export interface CharacterInfo {
  id: string;
  name: string;
  avatar_url: string | null;
  is_user_created: boolean;
}

/**
 * Full user context for a series - stats, progress, current episode
 */
export interface SeriesUserContextResponse {
  series_id: string;
  has_started: boolean;
  engagement: SeriesEngagementStats;
  current_episode: CurrentEpisodeInfo | null;
  character_id: string | null;
  character: CharacterInfo | null;
}

// Scene types
export type SceneTriggerType = "milestone" | "user_request" | "stage_change" | "episode_start";
export type SceneGenerationMode = "t2i" | "kontext";

export interface SceneGenerateRequest {
  episode_id: string;
  prompt?: string;
  trigger_type?: SceneTriggerType;
  generation_mode?: SceneGenerationMode; // t2i = 1 spark, kontext = 3 sparks
}

export interface SceneGenerateResponse {
  image_id: string;
  episode_id: string;
  storage_path: string;
  image_url: string;
  caption: string | null;
  prompt: string;
  model_used: string;
  latency_ms: number | null;
  sequence_index: number;
  avatar_kit_id?: string | null;
}

/**
 * Scene image (scene card) - renamed from EpisodeImage.
 * Represents a user-generated scene output linked to an episode.
 */
export interface SceneImage {
  id: string;
  episode_id: string;
  image_id: string;
  sequence_index: number;
  caption: string | null;
  triggered_by_message_id: string | null;
  trigger_type: SceneTriggerType | null;
  is_memory: boolean;
  saved_at: string | null;
  created_at: string;
  storage_path: string;
  image_url: string;
  prompt: string | null;
  style_tags: string[];
  // Avatar kit tracking (new in v0.10)
  avatar_kit_id?: string | null;
  derived_from_asset_id?: string | null;
}

/** @deprecated Use SceneImage instead */
export type EpisodeImage = SceneImage;

export interface SceneMemory {
  image_id: string;
  episode_id: string;
  character_id: string;
  character_name: string;
  caption: string | null;
  storage_path: string;
  image_url: string;
  style_tags: string[];
  saved_at: string;
  episode_started_at: string;
}

/**
 * Scene gallery item - for viewing all generated scenes (not just memories)
 */
export interface SceneGalleryItem {
  image_id: string;
  episode_id: string;
  character_id: string;
  character_name: string;
  series_title: string | null;
  episode_title: string | null;
  prompt: string | null;
  storage_path: string;
  image_url: string;
  is_memory: boolean;
  trigger_type: string | null;
  created_at: string;
}

// ============================================================================
// Avatar Kit Types (Visual Identity Contracts)
// ============================================================================

export type AvatarKitStatus = "draft" | "active" | "archived";

export type AvatarAssetType =
  | "portrait"
  | "fullbody"
  | "scene";

export type AvatarAssetSource = "manual_upload" | "ai_generated" | "imported";

/**
 * Avatar Kit - Visual identity contract for a character.
 * Defines the canonical appearance prompts and anchor references.
 */
export interface AvatarKit {
  id: string;
  character_id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  appearance_prompt: string;
  style_prompt: string;
  negative_prompt: string | null;
  primary_anchor_id: string | null;
  status: AvatarKitStatus;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvatarKitWithAnchors extends AvatarKit {
  primary_anchor_url: string | null;
}

/**
 * Avatar Asset - Canonical character image (portrait, fullbody, scene).
 */
export interface AvatarAsset {
  id: string;
  avatar_kit_id: string;
  asset_type: AvatarAssetType;
  label: string | null;
  storage_bucket: string;
  storage_path: string;
  source_type: AvatarAssetSource;
  derived_from_id: string | null;
  generation_metadata: Record<string, unknown>;
  mime_type: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  is_canonical: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AvatarAssetWithUrl extends AvatarAsset {
  image_url: string;
}

// ============================================================================
// Subscription Types
// ============================================================================

export type SubscriptionStatusType = "free" | "premium";

export interface SubscriptionStatus {
  status: SubscriptionStatusType;
  expires_at: string | null;
  customer_id: string | null;
  subscription_id: string | null;
}

export interface CheckoutResponse {
  checkout_url: string;
}

export interface PortalResponse {
  portal_url: string;
}

// ============================================================================
// Usage Types
// ============================================================================

export interface FluxUsage {
  used: number;
  quota: number;
  remaining: number;
  resets_at: string;
}

export interface MessageUsage {
  sent: number;
  resets_at: string;
}

export interface UsageResponse {
  flux: FluxUsage;
  messages: MessageUsage;
  subscription_status: string;
}

export interface QuotaExceededError {
  error: "quota_exceeded";
  message: string;
  usage: {
    used: number;
    quota: number;
    remaining: number;
  };
}

// ============================================================================
// Sparks (Credits) Types
// ============================================================================

export interface SparkBalance {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  subscription_status: string;
}

export interface SparkCheck {
  allowed: boolean;
  balance: number;
  cost: number;
  balance_after: number;
  message?: string;
}

export interface SparkTransaction {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  description?: string;
  created_at: string;
}

export interface SparkTransactionHistory {
  transactions: SparkTransaction[];
  count: number;
}

export interface FeatureCost {
  feature_key: string;
  display_name: string;
  spark_cost: number;
  description?: string;
  premium_only: boolean;
}

export interface TopupPack {
  pack_name: string;
  sparks: number;
  price_cents: number;
  price_display: string;
  per_spark_cents: number;
  bonus_percent: number;
}

export interface TopupCheckoutResponse {
  checkout_url: string;
}

export interface InsufficientSparksError {
  error: "insufficient_sparks";
  message: string;
  balance: number;
  cost: number;
  upgrade_url: string;
}

export interface EpisodeAccessError {
  error: "insufficient_sparks";
  required: number;
  message: string;
}

export interface RateLimitError {
  error: "rate_limit_exceeded";
  message: string;
  reset_at?: string;
  cooldown_seconds?: number;
  remaining: number;
}

// ============================================================================
// Conversation Ignition Types
// ============================================================================

export interface OpeningBeatValidationError {
  field: string;
  code: string;
  message: string;
}

export interface OpeningBeatResponse {
  opening_situation: string;
  opening_line: string;
  starter_prompts: string[];
  is_valid: boolean;
  validation_errors: OpeningBeatValidationError[];
  model_used?: string;
  latency_ms?: number;
}

export interface ArchetypeRulesResponse {
  archetype: string;
  tone_range: string[];
  intimacy_ceiling: string;
  typical_scenes: string[];
  pacing: string;
  emotional_register: string;
}

// ============================================================================
// Avatar Generation Types (Phase 4.1 & 4.2)
// ============================================================================

export interface AvatarGenerationResponse {
  success: boolean;
  asset_id?: string;
  kit_id?: string;
  image_url?: string;
  error?: string;
  model_used?: string;
  latency_ms?: number;
}

/**
 * Gallery Status Response - Simple avatar gallery model
 */
export interface GalleryStatusResponse {
  has_gallery: boolean;
  kit_id?: string;
  primary_url?: string;
  gallery: AvatarGalleryItem[];
  can_activate: boolean;
  missing_requirements: string[];
}

// ============================================================================
// Director V2 Types (per DIRECTOR_ARCHITECTURE.md)
// ============================================================================

/**
 * Auto scene generation mode
 */
export type AutoSceneMode = "off" | "peaks" | "rhythmic";

/**
 * Visual type taxonomy for Director-triggered visuals
 */
export type VisualType = "character" | "object" | "atmosphere" | "instruction" | "none";

/**
 * Director semantic status
 */
export type DirectorStatus = "going" | "closing" | "done";

/**
 * Director state tracked per session
 */
export interface DirectorState {
  last_evaluation?: {
    status: DirectorStatus;
    visual_type: VisualType;
    turn: number;
  };
  spark_prompt_shown?: boolean;
}

/**
 * Extended Session with Director tracking
 */
export interface SessionWithDirector extends Session {
  turn_count: number;
  director_state: DirectorState;
  completion_trigger: string | null;
  series_id: string | null;
  session_state: "active" | "paused" | "faded" | "complete";
  resolution_type: string | null;
}

/**
 * Extended Episode Template with Director V2 configuration
 */
export interface EpisodeTemplateWithDirector extends EpisodeTemplate {
  genre: string;
  auto_scene_mode: AutoSceneMode;
  scene_interval: number | null;
  spark_cost_per_scene: number;
  series_finale: boolean;
  turn_budget: number | null;
}

// ============================================================================
// Session Evaluation Types (per FLIRT_TEST_IMPLEMENTATION_PLAN.md)
// ============================================================================

/**
 * Evaluation type constants
 */
export type EvaluationType =
  | "flirt_archetype"
  | "romantic_trope"  // Play Mode v2
  | "mystery_summary"
  | "compatibility"
  | "episode_summary";

/**
 * Flirt archetype constants
 */
export type FlirtArchetype =
  | "tension_builder"
  | "bold_mover"
  | "playful_tease"
  | "slow_burn"
  | "mysterious_allure";

/**
 * Flirt archetype metadata
 */
export interface FlirtArchetypeMetadata {
  title: string;
  description: string;
  signals: string[];
}

/**
 * Flirt archetype result (returned by evaluation)
 */
export interface FlirtArchetypeResult {
  archetype: FlirtArchetype;
  confidence: number;
  primary_signals: string[];
  title: string;
  description: string;
}

// ============================================================================
// Romantic Trope Types (Play Mode v2)
// ============================================================================

/**
 * Romantic trope constants for Play Mode v2
 */
export type RomanticTrope =
  | "slow_burn"
  | "second_chance"
  | "all_in"
  | "push_pull"
  | "slow_reveal";

/**
 * Romantic trope result (returned by evaluation)
 * UNHINGED EDITION - maximum virality, MBTI energy
 */
export interface RomanticTropeResult {
  trope: RomanticTrope;
  confidence: number;
  primary_signals: string[];
  title: string;  // e.g., "SLOW BURN"
  tagline: string;  // e.g., "the tension is the whole point and you know it"
  description: string;  // The viral description paragraph
  share_text: string;  // Pre-formatted share text
  callback_quote: string | null;  // Formatted with trope's callback template
  your_people: string[];  // e.g., ["darcy & elizabeth", "jim & pam"]
}

/**
 * Trope emoji and color for UI display
 */
export const TROPE_VISUALS: Record<RomanticTrope, { emoji: string; color: string }> = {
  slow_burn: { emoji: "🕯️", color: "text-amber-500" },
  second_chance: { emoji: "🌅", color: "text-rose-500" },
  all_in: { emoji: "💫", color: "text-yellow-500" },
  push_pull: { emoji: "⚡", color: "text-purple-500" },
  slow_reveal: { emoji: "🌙", color: "text-violet-500" },
};

/**
 * Session evaluation - shareable result
 */
export interface SessionEvaluation {
  id: string;
  session_id: string;
  evaluation_type: EvaluationType;
  result: Record<string, unknown>;
  share_id: string | null;
  share_count: number;
  model_used: string | null;
  created_at: string;
}

/**
 * Shareable result - public-facing evaluation for share pages
 */
export interface ShareableResult {
  evaluation_type: EvaluationType;
  result: Record<string, unknown>;
  share_id: string;
  share_count: number;
  created_at: string;
  // Optional: character info for "continue with character" CTA
  character_name?: string;
  character_id?: string;
  series_id?: string;
}

// ============================================================================
// Games API Types (per FLIRT_TEST_IMPLEMENTATION_PLAN.md)
// ============================================================================

/**
 * Game start response
 */
export interface GameStartResponse {
  session_id: string;
  anonymous_id: string | null;  // For anonymous users - pass in X-Anonymous-Id header
  character_id: string;
  character_name: string;
  character_avatar_url: string | null;
  opening_line: string;
  turn_budget: number;
  situation: string;
}

/**
 * Game message response - extends standard with Director data
 */
export interface GameMessageResponse {
  message_content: string;
  turn_count: number;
  turns_remaining: number;
  is_complete: boolean;
  mood?: string;
}

/**
 * Game result response - evaluation after completion
 */
export interface GameResultResponse {
  evaluation_type: EvaluationType;
  result: FlirtArchetypeEvaluation | RomanticTropeResult | Record<string, unknown>;
  share_id: string;
  share_url: string;
  character_id: string;
  character_name: string;
  series_id: string | null;
}

/**
 * Share page data (for /r/[share_id])
 */
export interface SharePageData {
  result: ShareableResult;
  og_image_url: string;
  // CTA data
  game_url: string;
  continue_url: string | null;  // If character_id present
}

/**
 * Shared result response from /games/r/{share_id}
 */
export interface SharedResultResponse {
  evaluation_type: EvaluationType;
  result: FlirtArchetypeEvaluation | RomanticTropeResult | Record<string, unknown>;
  share_id: string;
  share_count: number;
  created_at: string;
  character_id: string | null;
  character_name: string | null;
  series_id: string | null;
}

// ============================================================================
// Quiz Mode Types (per QUIZ_MODE_SPEC.md)
// ============================================================================

/**
 * Quiz question with answer options
 */
export interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
}

/**
 * Quiz answer option
 */
export interface QuizOption {
  text: string;
  trope: RomanticTrope;
}

/**
 * Quiz state tracking
 */
export interface QuizState {
  currentQuestion: number;
  answers: Record<number, RomanticTrope>;
  isComplete: boolean;
  resultTrope: RomanticTrope | null;
}

/**
 * Quiz answer for API submission
 */
export interface QuizAnswer {
  question_id: number;
  question_text: string;
  selected_answer: string;
  selected_trope: string;
}

/**
 * Quiz evaluation response from API
 */
export interface QuizEvaluateResponse {
  evaluation_type: string;
  result: {
    trope?: string;
    level?: string;
    confidence: number;
    title: string;
    tagline: string;
    description: string;
    share_text: string;
    evidence: string[];
    vibe_check: string | null;
    your_people?: string[];
    emoji?: string;
    color?: string;
  };
  share_id: string;
  share_url: string;
}

/**
 * Series info for Episode 0 CTA
 */
export interface SeriesCTAItem {
  id: string;
  title: string;
  slug: string;
  tagline: string | null;
  coverUrl: string | null;
}

/**
 * Flirt archetype evaluation result
 */
export interface FlirtArchetypeEvaluation {
  archetype: FlirtArchetype;
  confidence: number;
  primary_signals: string[];
  title: string;
  description: string;
}

// ============================================================================
// User Character Types (ADR-004: User Character Customization)
// ============================================================================

/**
 * User character archetypes (subset for user creation)
 */
export type UserArchetype =
  | "warm_supportive"
  | "playful_teasing"
  | "mysterious_reserved"
  | "intense_passionate"
  | "confident_assertive";

/**
 * Flirting level for user characters
 */
export type FlirtingLevel = "subtle" | "playful" | "bold" | "intense";

/**
 * Art style preset for avatar generation
 */
export type StylePreset = "manhwa" | "anime" | "cinematic";

/**
 * User character - a character created by the user
 */
export interface UserCharacter {
  id: string;
  name: string;
  slug: string;
  archetype: UserArchetype;
  avatar_url: string | null;
  appearance_prompt: string | null;
  flirting_level: FlirtingLevel;
  style_preset?: StylePreset;
  is_user_created: true;
  is_public: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a user character
 */
export interface UserCharacterCreate {
  name: string;
  appearance_prompt: string;  // Required (min 10 chars on backend)
  archetype: UserArchetype;
  flirting_level?: FlirtingLevel;
  style_preset?: StylePreset;
}

/**
 * Input for updating a user character
 */
export interface UserCharacterUpdate {
  name?: string;
  archetype?: UserArchetype;
  appearance_prompt?: string;
  flirting_level?: FlirtingLevel;
}

/**
 * Available characters for an episode (includes canonical + user's compatible)
 */
export interface AvailableCharactersResponse {
  canonical: CharacterSummary | null;
  user_characters: UserCharacter[];
}

// ============================================================================
// Stream Event Types (for conversation streaming with Director V2 integration)
// ============================================================================

/**
 * Stream chunk event - content being streamed
 */
export interface StreamChunkEvent {
  type: "chunk";
  content: string;
}

/**
 * Pacing phase for Director guidance (V2.0)
 */
export type DirectorPacing = "establish" | "develop" | "escalate" | "peak" | "resolve";

/**
 * Director state in stream events (V2)
 */
export interface StreamDirectorState {
  turn_count: number;
  turns_remaining: number | null;
  is_complete: boolean;
  status: DirectorStatus;  // V2: semantic status (going/closing/done)
  pacing: DirectorPacing;  // V2.0: narrative pacing phase
}

/**
 * Stream done event - message complete
 */
export interface StreamDoneEvent {
  type: "done";
  content: string;
  suggest_scene?: boolean;
  episode_id: string;
  director?: StreamDirectorState;
}

/**
 * Visual pending event - image generation started (V2)
 */
export interface StreamVisualPendingEvent {
  type: "visual_pending";
  visual_type: Exclude<VisualType, "none" | "instruction">;  // character/object/atmosphere
  visual_hint: string | null;
  sparks_deducted: number;
}

/**
 * Visual ready event - image generation complete (V2)
 */
export interface StreamVisualReadyEvent {
  type: "visual_ready";
  image_url: string;
  caption?: string;
}

/**
 * Instruction card event - game-like information card (V2)
 */
export interface StreamInstructionCardEvent {
  type: "instruction_card";
  content: string;
}

/**
 * Needs sparks event - user needs more sparks for visuals (V2)
 */
export interface StreamNeedsSparksEvent {
  type: "needs_sparks";
  message: string;
}

/**
 * Next episode suggestion event - Director reached turn budget
 * v2.6: Renamed from episode_complete - this is a suggestion, not a status change.
 * User can dismiss and keep chatting. See EPISODE_STATUS_MODEL.md
 *
 * NOTE: Games still use "episode_complete" type with evaluation field.
 * Frontend handles both via: event.type === "episode_complete" || event.type === "next_episode_suggestion"
 */
export interface StreamEpisodeCompleteEvent {
  type: "episode_complete" | "next_episode_suggestion";
  turn_count: number;
  trigger?: string;  // V2: "turn_limit" | "unknown" (only on chat flow, not games)
  next_suggestion?: {
    episode_id: string;
    title: string;
    slug: string;
    episode_number: number;
    situation: string;
    character_id: string | null;
  } | null;
  // Optional evaluation for Games (Flirt Test, etc.)
  evaluation?: {
    evaluation_type: string;
    result: FlirtArchetypeEvaluation | Record<string, unknown>;
    share_id?: string;
  };
}

/**
 * Union of all stream event types
 */
export type StreamEvent =
  | StreamChunkEvent
  | StreamDoneEvent
  | StreamVisualPendingEvent
  | StreamVisualReadyEvent
  | StreamInstructionCardEvent
  | StreamNeedsSparksEvent
  | StreamEpisodeCompleteEvent;

// =============================================================================
// Role types (ADR-004: User Character & Role Abstraction)
// =============================================================================

/**
 * Role represents a "part" in an episode that a character plays.
 *
 * ADR-004: Any character can play any role. No compatibility gating.
 * Role provides scene motivation that can be reused across episodes.
 */
export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  scene_objective: string | null;
  scene_obstacle: string | null;
  scene_tactic: string | null;
}

/**
 * A character that can play a role.
 *
 * ADR-004: ALL characters can play ALL roles. No filtering is applied.
 */
export interface CompatibleCharacter {
  id: string;
  name: string;
  slug: string;
  archetype: string;
  avatar_url: string | null;
  is_user_created: boolean;
  is_canonical: boolean;
}

/**
 * Context for character selection before starting an episode.
 *
 * ADR-004: Returns ALL user characters. Any character can play any role.
 */
export interface CharacterSelectionContext {
  series_id: string;
  series_title: string;
  role: Role;
  canonical_character: CompatibleCharacter | null;
  user_characters: CompatibleCharacter[];  // ALL user characters (no filtering)
  can_use_canonical: boolean;
}
