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
}

// Character types
export type Genre = "romantic_tension" | "psychological_thriller";

export interface CharacterSummary {
  id: string;
  name: string;
  slug: string;
  archetype: string;
  avatar_url: string | null;
  short_backstory: string | null;
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
  full_backstory: string | null;
  likes: string[];
  dislikes: string[];
  starter_prompts: string[];
  gallery: AvatarGalleryItem[];
  primary_avatar_url: string | null;
  content_rating?: string;
}

export interface Character extends CharacterSummary {
  world_id: string | null;
  genre: Genre;
  baseline_personality: Record<string, unknown>;
  tone_style: Record<string, unknown>;
  speech_patterns: Record<string, unknown>;
  full_backstory: string | null;
  current_stressor: string | null;
  likes: string[];
  dislikes: string[];
  system_prompt: string;
  starter_prompts: string[];
  example_messages: Array<{ role: string; content: string }>;
  boundaries: Record<string, unknown>;
  relationship_stage_thresholds: Record<string, number>;
  is_active: boolean;
  sort_order: number;
  // NOTE: opening_situation and opening_line are now in episode_templates only
  // (EP-01 Episode-First Pivot - single source of truth)
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
  episode_frame: string | null;
  arc_hints: Record<string, unknown>[];
  starter_prompts?: string[];  // Optional - falls back to character's prompts
  sort_order: number;
  status: string;
  // Episode Dynamics
  dramatic_question: string | null;  // Narrative tension to explore
  resolution_types: string[];  // Valid endings: positive, neutral, negative, surprise
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
 * Continue Watching item - a series the user has interacted with
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
  character_id: string;
  character_name: string;
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
 * Full user context for a series - stats, progress, current episode
 */
export interface SeriesUserContextResponse {
  series_id: string;
  has_started: boolean;
  engagement: SeriesEngagementStats;
  current_episode: CurrentEpisodeInfo | null;
  character_id: string | null;
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
 * Cultural reference for a romantic trope
 */
export interface CulturalReference {
  title: string;
  characters: string;
}

/**
 * Romantic trope metadata
 */
export interface RomanticTropeMetadata {
  title: string;
  tagline: string;
  description: string;
  signals: string[];
  cultural_refs: CulturalReference[];
}

/**
 * Romantic trope result (returned by evaluation)
 * Enhanced with personalization fields for shareable results
 */
export interface RomanticTropeResult {
  trope: RomanticTrope;
  confidence: number;
  primary_signals: string[];
  title: string;
  tagline: string;
  description: string;
  // Personalization fields (LLM-generated)
  evidence: string[];  // 3 specific observations
  callback_quote: string | null;  // User's defining moment
  // Static cultural references
  cultural_refs: CulturalReference[];
}

/**
 * Static trope data for display (matches ROMANTIC_TROPES in backend)
 */
export const ROMANTIC_TROPES: Record<RomanticTrope, RomanticTropeMetadata> = {
  slow_burn: {
    title: "The Slow Burn",
    tagline: "You know the best things take time",
    description: "Patient and deliberate. You let tension build naturally, savoring each layer of connection before moving forward. Depth over speed, always.",
    signals: ["comfortable_silence", "deep_questions", "patient_pacing", "layered_revelation"],
    cultural_refs: [
      { title: "Pride & Prejudice", characters: "Darcy & Elizabeth" },
      { title: "The Office", characters: "Jim & Pam" },
      { title: "Normal People", characters: "Connell & Marianne" },
      { title: "When Harry Met Sally", characters: "Harry & Sally" },
    ],
  },
  second_chance: {
    title: "The Second Chance",
    tagline: "Some stories aren't over just because they paused",
    description: "You believe in unfinished stories. When something real was interrupted by timing or circumstance, you're willing to see if it can be different now.",
    signals: ["past_callbacks", "growth_acknowledgment", "timing_awareness", "hopeful_realism"],
    cultural_refs: [
      { title: "La La Land", characters: "Mia & Sebastian" },
      { title: "The Notebook", characters: "Noah & Allie" },
      { title: "Eternal Sunshine of the Spotless Mind", characters: "Joel & Clementine" },
      { title: "Before Sunset", characters: "Jesse & Celine" },
    ],
  },
  all_in: {
    title: "The All In",
    tagline: "When you know, you know",
    description: "Direct and decisive. You don't play games when you feel something real. Your clarity is magnetic—you say what you mean and mean what you say.",
    signals: ["direct_expression", "confident_moves", "emotional_clarity", "bold_honesty"],
    cultural_refs: [
      { title: "Crazy Rich Asians", characters: "Rachel & Nick" },
      { title: "The Proposal", characters: "Margaret & Andrew" },
      { title: "To All the Boys I've Loved Before", characters: "Lara Jean & Peter" },
      { title: "Brooklyn Nine-Nine", characters: "Jake & Amy" },
    ],
  },
  push_pull: {
    title: "The Push & Pull",
    tagline: "The tension is the point",
    description: "You thrive in the dance—the advance, the retreat, the electricity of uncertainty. Banter is foreplay, and you never make it too easy.",
    signals: ["playful_resistance", "witty_deflection", "tension_maintenance", "strategic_vulnerability"],
    cultural_refs: [
      { title: "10 Things I Hate About You", characters: "Kat & Patrick" },
      { title: "New Girl", characters: "Jess & Nick" },
      { title: "Gilmore Girls", characters: "Lorelai & Luke" },
      { title: "How to Lose a Guy in 10 Days", characters: "Andie & Ben" },
    ],
  },
  slow_reveal: {
    title: "The Slow Reveal",
    tagline: "Mystery is magnetic",
    description: "Intriguing and deliberate. You reveal yourself in layers, rewarding attention with depth. What you hold back is as powerful as what you share.",
    signals: ["selective_sharing", "intriguing_deflection", "earned_intimacy", "mysterious_allure"],
    cultural_refs: [
      { title: "Jane Eyre", characters: "Jane & Rochester" },
      { title: "Fleabag", characters: "Fleabag & The Priest" },
      { title: "Twilight", characters: "Bella & Edward" },
      { title: "Mr. & Mrs. Smith", characters: "John & Jane" },
    ],
  },
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
 * Episode complete event - Director detected completion
 */
export interface StreamEpisodeCompleteEvent {
  type: "episode_complete";
  turn_count: number;
  trigger: string;  // V2: "semantic" | "turn_limit" | "unknown"
  next_suggestion: {
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
