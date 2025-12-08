/**
 * Universal Intelligence Router - Canon v2.2 Compliance
 * 
 * Routes intelligence operations through universal work orchestration.
 * Converts legacy direct substrate writes to governance-compliant work requests.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { apiClient } from '@/lib/api/client';

export interface IntelligenceOperation {
  type: 'create_raw_dumps' | 'create_context_items' | 'create_blocks' | 'create_timeline_event';
  data: Record<string, any>;
  confidence?: number;
}

export interface IntelligenceWorkRequest {
  operations: IntelligenceOperation[];
  basket_id: string;
  confidence_score?: number;
  user_override?: 'require_review' | 'allow_auto';
  trace_id?: string;
  provenance?: string[];
}

/**
 * Route intelligence substrate operations through universal work orchestration
 */
export async function routeIntelligenceWork(
  request: IntelligenceWorkRequest
): Promise<{
  work_id: string;
  routing_decision: string;
  execution_mode: string;
  proposal_id?: string;
  status_url: string;
}> {
  
  // Convert intelligence operations to universal work format
  const workOperations = request.operations.map(op => ({
    type: mapIntelligenceOperationToWorkType(op.type),
    data: op.data
  }));

  // Determine work type based on operations
  const work_type = determineWorkType(request.operations);
  
  // Route through universal work API
  const response = await apiClient.request('/api/work', {
    method: 'POST',
    body: JSON.stringify({
      work_type,
      work_payload: {
        operations: workOperations,
        basket_id: request.basket_id,
        confidence_score: request.confidence_score || 0.8,
        user_override: request.user_override,
        trace_id: request.trace_id,
        provenance: request.provenance
      },
      priority: 'normal'
    })
  });

  // apiClient.request already handles error checking and returns parsed JSON
  return response as {
    work_id: string;
    routing_decision: string;
    execution_mode: string;
    proposal_id?: string;
    status_url: string;
  };
}

/**
 * Map intelligence operations to universal work operation types
 */
function mapIntelligenceOperationToWorkType(intelligenceOpType: string): string {
  switch (intelligenceOpType) {
    case 'create_raw_dumps':
      return 'create_raw_dump';
    case 'create_context_items':
      return 'create_context_items';
    case 'create_blocks':
      return 'create_blocks';
    case 'create_timeline_event':
      return 'create_timeline_event';
    default:
      throw new Error(`Unknown intelligence operation type: ${intelligenceOpType}`);
  }
}

/**
 * Determine appropriate work type for intelligence operations
 */
function determineWorkType(operations: IntelligenceOperation[]): string {
  // Check operation types to determine pipeline stage
  const hasRawDumps = operations.some(op => op.type === 'create_raw_dumps');
  const hasBlocks = operations.some(op => op.type === 'create_blocks');
  const hasContextItems = operations.some(op => op.type === 'create_context_items');
  const hasTimelineEvents = operations.some(op => op.type === 'create_timeline_event');

  // P0_CAPTURE for raw dump creation
  if (hasRawDumps && !hasBlocks && !hasContextItems) {
    return 'P0_CAPTURE';
  }
  
  // P1_SUBSTRATE for block/context item creation 
  if (hasBlocks || hasContextItems) {
    return 'P1_SUBSTRATE';
  }
  
  // Timeline events are system operations
  if (hasTimelineEvents) {
    return 'P1_SUBSTRATE'; // Timeline events are substrate
  }
  
  // Default to P1_SUBSTRATE for intelligence operations
  return 'P1_SUBSTRATE';
}

/**
 * Helper to create intelligence work request for substrate operations
 */
export function createIntelligenceWorkRequest(
  operations: IntelligenceOperation[],
  basketId: string,
  options?: {
    confidence_score?: number;
    user_override?: 'require_review' | 'allow_auto';
    trace_id?: string;
    provenance?: string[];
  }
): IntelligenceWorkRequest {
  return {
    operations,
    basket_id: basketId,
    confidence_score: options?.confidence_score || 0.8,
    user_override: options?.user_override,
    trace_id: options?.trace_id,
    provenance: options?.provenance
  };
}

/**
 * Route timeline event creation through governance
 */
export async function createTimelineEventViaGovernance(
  basketId: string,
  timelineData: {
    kind: string;
    payload: Record<string, any>;
    workspace_id: string;
  },
  options?: {
    confidence_score?: number;
    user_override?: 'require_review' | 'allow_auto';
  }
): Promise<{
  work_id: string;
  routing_decision: string;
  execution_mode: string;
}> {
  
  const workRequest = createIntelligenceWorkRequest(
    [{
      type: 'create_timeline_event',
      data: timelineData,
      confidence: options?.confidence_score || 0.9
    }],
    basketId,
    {
      confidence_score: options?.confidence_score || 0.9,
      user_override: options?.user_override,
      trace_id: `intelligence-timeline-${Date.now()}`
    }
  );

  return routeIntelligenceWork(workRequest);
}

export default {
  routeIntelligenceWork,
  createIntelligenceWorkRequest,
  createTimelineEventViaGovernance
};