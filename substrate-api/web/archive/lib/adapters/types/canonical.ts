/**
 * Canon v2.0 Canonical Types for Adapter Layer
 * 
 * Pure substrate types with separate artifact handling.
 * Reflections are artifacts, not substrates.
 */

/**
 * Canonical error structure from agent processing
 */
export interface CanonicalError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  timeline_event_id?: string;
  processing_agent?: string;
  workspace_id: string;
}

/**
 * Canonical operation for Sacred Write Paths
 */
export interface CanonicalOperation {
  type: 'canonical_capture' | 'canonical_ingest';
  endpoint: '/api/dumps/new' | '/api/baskets/ingest';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: Record<string, unknown>;
  result?: unknown;
  timeline_event_id?: string;
  completed_at?: string;
}

/**
 * Workflow definition for orchestrating canonical operations
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  operations: CanonicalOperation[];
  workspace_id: string;
  created_by: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  workflow_id: string;
  operations_completed: number;
  operations: CanonicalOperation[];
  timeline_events: string[];
  completed_at: string;
}

/**
 * Canonical timeline event from agent processing
 * Canon v1.4.0: All descriptions come from agents
 */
export interface CanonicalTimelineEvent {
  id: string;
  basket_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
  created_by?: string;
  
  // Canon v1.4.0: Agent Intelligence Mandatory
  processing_agent?: string; // P0/P1/P2/P3 agent
  agent_confidence?: number; // Agent confidence in processing
  description?: string; // Agent-computed description
  display_title?: string; // Agent-computed display title
  canonical_icon?: string; // Agent-determined icon
  canonical_category?: string; // Agent-classified category
  relative_time?: string; // Agent-formatted time
}

/**
 * Canonical reflection artifact from P3 Agent
 * Canon v2.0: Artifacts targeting substrate or document versions
 */
export interface CanonicalReflection {
  id: string;
  basket_id: string;
  workspace_id: string;
  reflection_text: string;
  computation_timestamp: string;
  
  // New flexible targeting
  reflection_target_type: 'substrate' | 'document' | 'legacy';
  reflection_target_id?: string;
  reflection_target_version?: string;
  
  // Legacy fields (backward compatibility)
  substrate_window_start?: string;
  substrate_window_end?: string;
  substrate_hash?: string;
  
  // Agent-computed metadata
  reflection_title?: string;
  reflection_tags?: string[];
  confidence_score?: number;
  
  meta?: {
    trace_id?: string;
    substrate_count?: number;
    token_usage?: number;
    processing_agent?: string;
  };
}

/**
 * Canonical block from P1 Substrate Agent  
 * Canon v1.4.0: All structure from agent processing
 */
export interface CanonicalBlock {
  id: string;
  basket_id: string;
  title?: string;
  body_md?: string;
  semantic_type?: string; // P1 Agent classification
  confidence_score?: number; // P1 Agent confidence
  created_at: string;
  updated_at: string;
  
  // Canon v1.4.0: Agent processing metadata
  processing_agent?: string; // Which agent created this
  timeline_trace_id?: string; // Link to timeline events
  compliance_metadata?: Record<string, unknown>; // Agent-computed compliance
}

/**
 * Canonical memory projection from all agents
 * Canon v1.4.0: Unified view of P0→P1→P2→P3 processing  
 */
export interface CanonicalMemoryProjection {
  basket_id: string;
  memories: Array<{
    id: string;
    substrate_type: 'dump' | 'block' | 'context_item' | 'timeline_event';
    content: string;
    created_at: string;
    confidence_score?: number;
    processing_agent?: string;
    relationships?: Array<{id: string; strength: number}>;
    metadata: Record<string, unknown>;
  }>;
  
  // Canon v1.4.0: Agent-computed analytics
  analytics_summary?: {
    total_substrate: number;
    agent_processing_stats: Record<string, number>;
    confidence_distribution: Record<string, number>;
  };
  
  pagination: {
    next_cursor?: string;
    has_more: boolean;
    total_count?: number;
  };
  
  processing_time_ms?: number;
}

/**
 * Workspace-scoped canonical data access
 * Canon v1.4.0: All data operations workspace-isolated
 */
export interface CanonicalDataAccess {
  workspace_id: string;
  user_id: string;
  
  // Sacred Read Paths - workspace-scoped canonical service access
  getTimeline(basket_id: string): Promise<CanonicalTimelineEvent[]>;
  getReflections(basket_id: string): Promise<CanonicalReflection[]>;  
  getBlocks(basket_id: string): Promise<CanonicalBlock[]>;
  getProjection(basket_id: string): Promise<CanonicalMemoryProjection>;
}