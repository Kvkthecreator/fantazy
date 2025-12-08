/**
 * Canon v1.4.0 Compliant Adapter Base Classes
 * 
 * CRITICAL: Adapters are PURE TRANSFORMATION LAYERS
 * - Never generate intelligence client-side
 * - Never synthesize data from multiple sources
 * - Never bypass agent processing  
 * - Always use Sacred Write Paths
 * - Respect workspace isolation
 * - Maintain substrate equality
 */

import type { CanonicalError, CanonicalOperation, WorkflowDefinition, WorkflowResult } from '../types/canonical';

/**
 * Base interface for all presentation lens adapters
 * Canon v1.4.0: Pure transformation responsibility only
 */
export interface LensAdapter<TPresentation, TCanonical> {
  /**
   * Transform canonical agent-processed data for presentation
   * Canon Compliance: NEVER create intelligence, only reshape existing data
   */
  transform(canonical: TCanonical): TPresentation;
  
  /**
   * Handle presentation-specific workflows by orchestrating canonical operations
   * Canon Compliance: Use Sacred Write Paths only, emit timeline events
   */
  orchestrate(workflow: WorkflowDefinition): Promise<WorkflowResult>;
  
  /**
   * Map user actions to canonical operations (P0→P1→P2→P3 pipeline)
   * Canon Compliance: All intelligence happens in agent processing
   */
  mapUserAction(action: UserAction): CanonicalOperation[];
  
  /**
   * Handle presentation-specific error states
   * Canon Compliance: Preserve canonical error information
   */
  handleError(error: CanonicalError): PresentationError;
}

/**
 * User action types from presentation layer
 */
export interface UserAction {
  type: string;
  payload: Record<string, unknown>;
  workspace_id: string;
  user_id: string;
  source_context: string; // 'consumer_interface' | 'enterprise_interface'
}

/**
 * Presentation-specific error wrapper
 * Canon Compliance: Never lose canonical error details
 */
export interface PresentationError {
  message: string;
  code: string;
  canonical_error: CanonicalError;
  user_friendly_message: string;
  retry_possible: boolean;
}

/**
 * Abstract base class for all lens adapters
 * Canon v1.4.0: Enforces pure transformation constraints
 */
export abstract class BaseLensAdapter<TPresentation, TCanonical> implements LensAdapter<TPresentation, TCanonical> {
  
  constructor(
    protected readonly workspaceId: string,
    protected readonly userId: string
  ) {
    // Canon Compliance: All adapters are workspace-scoped
    if (!workspaceId || !userId) {
      throw new Error('Canon v1.4.0 violation: Adapters must be workspace-scoped');
    }
  }

  /**
   * Transform canonical data for presentation
   * CRITICAL: Subclasses must only reshape, never create intelligence
   */
  abstract transform(canonical: TCanonical): TPresentation;

  /**
   * Orchestrate workflows using Sacred Write Paths only
   * Canon Compliance: All writes go through /api/dumps/new or /api/baskets/ingest
   */
  async orchestrate(workflow: WorkflowDefinition): Promise<WorkflowResult> {
    // Validate workflow uses Sacred Write Paths
    this.validateSacredWritePaths(workflow);
    
    // Execute workflow operations in sequence
    const results: CanonicalOperation[] = [];
    for (const operation of workflow.operations) {
      const result = await this.executeCanonicalOperation(operation);
      results.push(result);
    }
    
    return {
      workflow_id: workflow.id,
      operations_completed: results.length,
      operations: results,
      timeline_events: results.map(r => r.timeline_event_id).filter((id): id is string => Boolean(id)),
      completed_at: new Date().toISOString()
    };
  }

  /**
   * Map user actions to canonical operations
   * Canon Compliance: All processing happens in P0→P1→P2→P3 pipeline
   */
  mapUserAction(action: UserAction): CanonicalOperation[] {
    switch (action.type) {
      case 'capture_memory':
        return [{
          type: 'canonical_capture',
          endpoint: '/api/dumps/new', // Sacred Write Path
          method: 'POST',
          payload: {
            content: action.payload.content as string,
            workspace_id: this.workspaceId,
            source_context: action.source_context
          }
        }];
      
      case 'create_basket':
        return [{
          type: 'canonical_ingest',
          endpoint: '/api/baskets/ingest', // Sacred Write Path 
          method: 'POST',
          payload: {
            name: action.payload.name as string,
            workspace_id: this.workspaceId,
            dumps: action.payload.dumps as Array<{content: string}>
          }
        }];
        
      default:
        throw new Error(`Canon v1.4.0 violation: Unknown user action type ${action.type}`);
    }
  }

  /**
   * Handle errors while preserving canonical information
   * Canon Compliance: Never lose agent processing details
   */
  handleError(error: CanonicalError): PresentationError {
    return {
      message: error.message,
      code: error.code || 'ADAPTER_ERROR',
      canonical_error: error,
      user_friendly_message: this.getUserFriendlyMessage(error),
      retry_possible: this.isRetryPossible(error)
    };
  }

  /**
   * Protected helper: Validate Sacred Write Paths only
   * Canon Compliance: Prevent bypass of agent processing
   */
  protected validateSacredWritePaths(workflow: WorkflowDefinition): void {
    const sacredPaths = ['/api/dumps/new', '/api/baskets/ingest'];
    
    for (const operation of workflow.operations) {
      if (operation.method !== 'GET' && !sacredPaths.includes(operation.endpoint)) {
        throw new Error(`Canon v1.4.0 violation: Non-sacred write path ${operation.endpoint}`);
      }
    }
  }

  /**
   * Protected helper: Execute canonical operation
   * Canon Compliance: Use authenticated canonical service calls
   */
  protected async executeCanonicalOperation(operation: CanonicalOperation): Promise<CanonicalOperation> {
    const response = await fetch(operation.endpoint, {
      method: operation.method,
      headers: {
        'Content-Type': 'application/json',
        // Workspace isolation enforced by RLS
      },
      body: operation.method !== 'GET' ? JSON.stringify(operation.payload) : undefined
    });

    if (!response.ok) {
      throw new Error(`Canonical operation failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      ...operation,
      result,
      timeline_event_id: result.timeline_event_id,
      completed_at: new Date().toISOString()
    };
  }

  /**
   * Protected helper: Generate user-friendly error messages
   */
  protected getUserFriendlyMessage(error: CanonicalError): string {
    switch (error.code) {
      case 'WORKSPACE_ACCESS_DENIED':
        return 'You do not have access to this workspace';
      case 'AGENT_PROCESSING_FAILED':
        return 'AI processing is temporarily unavailable';
      case 'SACRED_WRITE_PATH_VIOLATION':
        return 'Data capture failed - please try again';
      default:
        return 'An unexpected error occurred';
    }
  }

  /**
   * Protected helper: Determine if operation can be retried
   */
  protected isRetryPossible(error: CanonicalError): boolean {
    const retryableCodes = [
      'NETWORK_ERROR',
      'AGENT_PROCESSING_TIMEOUT',
      'TEMPORARY_SERVICE_UNAVAILABLE'
    ];
    
    return retryableCodes.includes(error.code || '');
  }
}