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

export interface OnboardingData {
  display_name: string;
  pronouns?: string;
  timezone: string;
  vibe_preference: "comforting" | "flirty" | "chill";
  first_character_id: string;
  age_confirmed: boolean;
}

// Character types
export interface CharacterSummary {
  id: string;
  name: string;
  slug: string;
  archetype: string;
  avatar_url: string | null;
  short_backstory: string | null;
  is_premium: boolean;
}

export interface Character extends CharacterSummary {
  world_id: string | null;
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
  created_at: string;
  updated_at: string;
}

// Relationship types
export type RelationshipStage =
  | "acquaintance"
  | "friendly"
  | "close"
  | "intimate";

export interface Relationship {
  id: string;
  user_id: string;
  character_id: string;
  stage: RelationshipStage;
  stage_progress: number;
  total_episodes: number;
  total_messages: number;
  first_met_at: string;
  last_interaction_at: string | null;
  nickname: string | null;
  inside_jokes: string[];
  relationship_notes: string | null;
  metadata: Record<string, unknown>;
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface RelationshipWithCharacter extends Relationship {
  character_name: string;
  character_slug: string;
  character_archetype: string;
  character_avatar_url: string | null;
}

// Episode types
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

export interface Episode extends EpisodeSummary {
  user_id: string;
  relationship_id: string | null;
  scene: string | null;
  summary: string | null;
  emotional_tags: string[];
  key_events: string[];
  user_message_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
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

// Scene types
export type SceneTriggerType = "milestone" | "user_request" | "stage_change" | "episode_start";

export interface SceneGenerateRequest {
  episode_id: string;
  prompt?: string;
  trigger_type?: SceneTriggerType;
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

// ============================================================================
// Avatar Kit Types (Visual Identity Contracts)
// ============================================================================

export type AvatarKitStatus = "draft" | "active" | "archived";

export type AvatarAssetType =
  | "anchor_portrait"
  | "anchor_fullbody"
  | "expression"
  | "pose"
  | "outfit";

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
  secondary_anchor_id: string | null;
  status: AvatarKitStatus;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvatarKitWithAnchors extends AvatarKit {
  primary_anchor_url: string | null;
  secondary_anchor_url: string | null;
}

/**
 * Avatar Asset - Canonical character image (anchor, expression, pose).
 */
export interface AvatarAsset {
  id: string;
  avatar_kit_id: string;
  asset_type: AvatarAssetType;
  expression: string | null;
  emotion_tags: string[];
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
