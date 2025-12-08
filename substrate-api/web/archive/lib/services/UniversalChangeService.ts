import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubstrateIntelligence } from '@/lib/substrate/types';
import { getConflictDetectionEngine, type ChangeVector } from '@/lib/collaboration/ConflictDetectionEngine';
import { getOperationalTransform } from '@/lib/collaboration/OperationalTransform';
import { getWorkspaceFromBasket } from '@/lib/utils/workspace';
import { apiClient } from '@/lib/api/client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ChangeType = 
  | 'basket_update' 
  | 'document_create' 
  | 'document_update' 
  | 'document_delete'
  | 'intelligence_approve' 
  | 'intelligence_reject'
  | 'intelligence_generate'
  | 'context_add'
  | 'block_create'
  | 'block_update'
  | 'block_delete';

export type ChangeStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'conflicted';

export type ConflictType = 'concurrent_edit' | 'version_mismatch' | 'permission_denied' | 'data_integrity';

export interface ChangeRequest {
  id: string;
  type: ChangeType;
  basketId: string;
  workspaceId: string;
  actorId: string;
  data: ChangeData;
  metadata?: Record<string, any>;
  timestamp: string;
  origin: 'user' | 'agent' | 'system' | 'sync';
}

export type ChangeData = 
  | BasketUpdateData
  | DocumentCreateData
  | DocumentUpdateData
  | DocumentDeleteData
  | IntelligenceApprovalData
  | IntelligenceRejectionData
  | IntelligenceGenerateData
  | ContextAddData
  | BlockCreateData
  | BlockUpdateData
  | BlockDeleteData;

// Specific change data types
export interface BasketUpdateData {
  name?: string;
  description?: string;
  status?: string;
  metadata?: Record<string, any>;
}

export interface DocumentCreateData {
  title: string;
  content: string;
  documentType?: string;
  metadata?: Record<string, any>;
}

export interface DocumentUpdateData {
  documentId: string;
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
  version?: number;
}

export interface DocumentDeleteData {
  documentId: string;
}

export interface IntelligenceApprovalData {
  eventId: string;
  approvedSections: string[];
  partialApproval: boolean;
  intelligence: SubstrateIntelligence;
}

export interface IntelligenceRejectionData {
  eventId: string;
  reason?: string;
}

export interface IntelligenceGenerateData {
  origin: string;
  conversationContext?: any;
  checkPending?: boolean;
}

export interface ContextAddData {
  content: Array<{
    type: 'text' | 'file' | 'pdf' | 'image';
    content: string;
    metadata?: Record<string, any>;
  }>;
  triggerIntelligenceRefresh?: boolean;
}

export interface BlockCreateData {
  semanticType: string;
  content: string;
  parentBlockId?: string;
  canonicalValue?: string;
  scope?: string;
}

export interface BlockUpdateData {
  blockId: string;
  content?: string;
  semanticType?: string;
  canonicalValue?: string;
  state?: string;
  version: number;
}

export interface BlockDeleteData {
  blockId: string;
}

// Result types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  conflicts: Conflict[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Conflict {
  id: string;
  type: ConflictType;
  description: string;
  affectedFields: string[];
  currentValue: any;
  incomingValue: any;
  suggestions: ConflictResolution[];
}

export interface ConflictResolution {
  strategy: 'accept_incoming' | 'keep_current' | 'merge' | 'manual';
  description: string;
  autoApplicable: boolean;
}

export interface ChangeResult {
  success: boolean;
  changeId: string;
  status: ChangeStatus;
  appliedData?: any;
  errors?: string[];
  warnings?: string[];
  conflicts?: Conflict[];
  rollbackInfo?: RollbackInfo;
}

export interface RollbackInfo {
  rollbackId: string;
  previousState: any;
  rollbackSteps: string[];
}

export interface ValidatedChange extends ChangeRequest {
  validationResult: ValidationResult;
  resolvedConflicts: Conflict[];
}

export interface AppliedChange extends ValidatedChange {
  result: ChangeResult;
  databaseChanges: DatabaseChange[];
  eventId: string;
}

export interface DatabaseChange {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  recordId: string;
  oldData?: any;
  newData: any;
}

export interface ChangeEvent {
  id: string;
  basketId: string;
  changeId: string;
  type: ChangeType;
  status: ChangeStatus;
  actorId: string;
  data: ChangeData;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface Revision {
  id: string;
  basketId: string;
  changeId: string;
  entityType: string;
  entityId: string;
  previousState: any;
  newState: any;
  timestamp: string;
}

export interface WebSocketPayload {
  event: 'change_applied' | 'change_failed' | 'conflict_detected' | 'user_activity' | 'user_joined' | 'user_left' | 'user_editing';
  basketId: string;
  changeId?: string;
  data: any;
  timestamp: string;
}

// ============================================================================
// UNIVERSAL CHANGE SERVICE IMPLEMENTATION
// ============================================================================

export class UniversalChangeService {
  private supabase: SupabaseClient;
  private request?: Request;
  
  constructor(supabase: SupabaseClient, request?: Request) {
    this.supabase = supabase;
    this.request = request;
  }

  // ========================================================================
  // CORE CHANGE PROCESSING
  // ========================================================================

  async processChange(changeRequest: ChangeRequest): Promise<ChangeResult> {
    try {
      console.log(`🔄 Processing change: ${changeRequest.type} for basket ${changeRequest.basketId}`);
      
      // Step 1: Validate the change
      const validation = await this.validateChange(changeRequest);
      
      if (!validation.isValid) {
        return {
          success: false,
          changeId: changeRequest.id,
          status: 'failed',
          errors: validation.errors.map(e => e.message)
        };
      }

      if (validation.conflicts.length > 0) {
        return {
          success: false,
          changeId: changeRequest.id,
          status: 'conflicted',
          conflicts: validation.conflicts
        };
      }

      // Step 2: Apply the change
      const validatedChange: ValidatedChange = {
        ...changeRequest,
        validationResult: validation,
        resolvedConflicts: []
      };

      const appliedChange = await this.applyChange(validatedChange);

      // Step 3: Create event and revision tracking
      await Promise.all([
        this.createChangeEvent(appliedChange),
        this.trackRevision(appliedChange)
      ]);

      // Step 4: Notify real-time subscribers
      await this.notifyChange(appliedChange);

      return appliedChange.result;

    } catch (error) {
      console.error('❌ Change processing failed:', error);
      return {
        success: false,
        changeId: changeRequest.id,
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // ========================================================================
  // VALIDATION LAYER
  // ========================================================================

  async validateChange(change: ChangeRequest): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const conflicts: Conflict[] = [];

    // Basic validation
    if (!change.basketId) {
      errors.push({
        field: 'basketId',
        message: 'Basket ID is required',
        code: 'MISSING_BASKET_ID'
      });
    }

    if (!change.workspaceId) {
      errors.push({
        field: 'workspaceId',
        message: 'Workspace ID is required',
        code: 'MISSING_WORKSPACE_ID'
      });
    }

    // Verify basket access
    if (change.basketId && change.workspaceId) {
      const hasAccess = await this.verifyBasketAccess(change.basketId, change.workspaceId);
      if (!hasAccess) {
        errors.push({
          field: 'basketId',
          message: 'Basket not found or access denied',
          code: 'BASKET_ACCESS_DENIED'
        });
      }
    }

    // Type-specific validation
    const typeValidation = await this.validateChangeType(change);
    errors.push(...typeValidation.errors);
    warnings.push(...typeValidation.warnings);

    // Conflict detection
    const detectedConflicts = await this.detectConflicts(change);
    conflicts.push(...detectedConflicts);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      conflicts
    };
  }

  private async validateChangeType(change: ChangeRequest): Promise<{ errors: ValidationError[], warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    switch (change.type) {
      case 'basket_update':
        const basketData = change.data as BasketUpdateData;
        if (basketData.name !== undefined && (!basketData.name || basketData.name.trim().length === 0)) {
          errors.push({
            field: 'name',
            message: 'Basket name cannot be empty',
            code: 'INVALID_BASKET_NAME'
          });
        }
        break;

      case 'document_create':
        const docCreateData = change.data as DocumentCreateData;
        if (!docCreateData.title || docCreateData.title.trim().length === 0) {
          warnings.push({
            field: 'title',
            message: 'Document title is empty, will use "Untitled"',
            severity: 'low'
          });
        }
        break;

      case 'document_update':
        const docUpdateData = change.data as DocumentUpdateData;
        if (!docUpdateData.documentId) {
          errors.push({
            field: 'documentId',
            message: 'Document ID is required for updates',
            code: 'MISSING_DOCUMENT_ID'
          });
        }
        break;

      case 'intelligence_approve':
        const approvalData = change.data as IntelligenceApprovalData;
        if (!approvalData.eventId) {
          errors.push({
            field: 'eventId',
            message: 'Event ID is required for intelligence approval',
            code: 'MISSING_EVENT_ID'
          });
        }
        break;

      // Add other type validations as needed
    }

    return { errors, warnings };
  }

  private async verifyBasketAccess(basketId: string, workspaceId: string): Promise<boolean> {
    try {
      const result = await getWorkspaceFromBasket(this.supabase, basketId);
      if ('error' in result) {
        return false;
      }
      
      return result.workspaceId === workspaceId;
    } catch {
      return false;
    }
  }

  // ========================================================================
  // CHANGE APPLICATION
  // ========================================================================

  async applyChange(validatedChange: ValidatedChange): Promise<AppliedChange> {
    const databaseChanges: DatabaseChange[] = [];
    let appliedData: any = null;

    try {
      switch (validatedChange.type) {
        case 'basket_update':
          const basketResult = await this.applyBasketUpdate(validatedChange);
          databaseChanges.push(...basketResult.changes);
          appliedData = basketResult.data;
          break;

        case 'document_create':
          const docCreateResult = await this.applyDocumentCreate(validatedChange);
          databaseChanges.push(...docCreateResult.changes);
          appliedData = docCreateResult.data;
          break;

        case 'document_update':
          const docUpdateResult = await this.applyDocumentUpdate(validatedChange);
          databaseChanges.push(...docUpdateResult.changes);
          appliedData = docUpdateResult.data;
          break;

        case 'intelligence_approve':
          const intelligenceResult = await this.applyIntelligenceApproval(validatedChange);
          databaseChanges.push(...intelligenceResult.changes);
          appliedData = intelligenceResult.data;
          break;

        case 'intelligence_generate':
          const generateResult = await this.applyIntelligenceGenerate(validatedChange);
          databaseChanges.push(...generateResult.changes);
          appliedData = generateResult.data;
          break;

        case 'context_add':
          const contextResult = await this.applyContextAdd(validatedChange);
          databaseChanges.push(...contextResult.changes);
          appliedData = contextResult.data;
          break;

        // Add other change type implementations
      }

      const appliedChange: AppliedChange = {
        ...validatedChange,
        result: {
          success: true,
          changeId: validatedChange.id,
          status: 'completed',
          appliedData
        },
        databaseChanges,
        eventId: crypto.randomUUID()
      };

      return appliedChange;

    } catch (error) {
      console.error('❌ Failed to apply change:', error);
      
      // Attempt rollback if any changes were made
      if (databaseChanges.length > 0) {
        await this.rollbackChanges(databaseChanges);
      }

      const failedChange: AppliedChange = {
        ...validatedChange,
        result: {
          success: false,
          changeId: validatedChange.id,
          status: 'failed',
          errors: [error instanceof Error ? error.message : 'Unknown error']
        },
        databaseChanges: [],
        eventId: crypto.randomUUID()
      };

      return failedChange;
    }
  }

  private async applyBasketUpdate(change: ValidatedChange): Promise<{ changes: DatabaseChange[], data: any }> {
    const data = change.data as BasketUpdateData;
    const updates: Record<string, any> = {};
    
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description;
    if (data.status !== undefined) updates.status = data.status;
    if (data.metadata !== undefined) updates.metadata = data.metadata;
    
    updates.updated_at = new Date().toISOString();

    const { data: result, error } = await this.supabase
      .from('baskets')
      .update(updates)
      .eq('id', change.basketId)
      .eq('workspace_id', change.workspaceId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update basket: ${error.message}`);

    return {
      changes: [{
        table: 'baskets',
        operation: 'update',
        recordId: change.basketId,
        newData: result
      }],
      data: result
    };
  }

  private async applyDocumentCreate(change: ValidatedChange): Promise<{ changes: DatabaseChange[], data: any }> {
    const data = change.data as DocumentCreateData;
    
    const { data: result, error } = await this.supabase
      .from('documents')
      .insert({
        title: data.title || 'Untitled Document',
        content_raw: data.content,
        document_type: data.documentType || 'general',
        basket_id: change.basketId,
        workspace_id: change.workspaceId,
        metadata: {
          ...data.metadata,
          createdBy: change.actorId,
          createdVia: 'universal_change_service'
        }
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create document: ${error.message}`);

    return {
      changes: [{
        table: 'documents',
        operation: 'insert',
        recordId: result.id,
        newData: result
      }],
      data: result
    };
  }

  private async applyDocumentUpdate(change: ValidatedChange): Promise<{ changes: DatabaseChange[], data: any }> {
    const data = change.data as DocumentUpdateData;
    const updates: Record<string, any> = {};
    
    if (data.title !== undefined) updates.title = data.title;
    if (data.content !== undefined) updates.content_raw = data.content;
    if (data.metadata !== undefined) updates.metadata = data.metadata;
    
    updates.updated_at = new Date().toISOString();

    const { data: result, error } = await this.supabase
      .from('documents')
      .update(updates)
      .eq('id', data.documentId)
      .eq('basket_id', change.basketId)
      .eq('workspace_id', change.workspaceId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update document: ${error.message}`);

    return {
      changes: [{
        table: 'documents',
        operation: 'update',
        recordId: data.documentId,
        newData: result
      }],
      data: result
    };
  }

  private async applyIntelligenceApproval(change: ValidatedChange): Promise<{ changes: DatabaseChange[], data: any }> {
    const data = change.data as IntelligenceApprovalData;
    
    // Create approval event
    const eventData = {
      basket_id: change.basketId,
      kind: 'intelligence_approval',
      payload: {
        eventId: data.eventId,
        approvedSections: data.approvedSections,
        partialApproval: data.partialApproval,
        actorId: change.actorId,
        intelligence: data.intelligence,
        timestamp: change.timestamp
      },
      ts: change.timestamp
    };

    const { data: result, error } = await this.supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create approval event: ${error.message}`);

    return {
      changes: [{
        table: 'events',
        operation: 'insert',
        recordId: result.id,
        newData: result
      }],
      data: result
    };
  }

  private async applyIntelligenceGenerate(change: ValidatedChange): Promise<{ changes: DatabaseChange[], data: any }> {
    const data = change.data as IntelligenceGenerateData;
    
    console.log('🧠 Processing intelligence generation through Universal Change Service');
    
    try {
      // Construct absolute URL for server-side fetch
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace('yarnnn.com', 'www.yarnnn.com') || 
                      'https://www.yarnnn.com';
      
      const url = `${baseUrl}/api/intelligence/generate/${change.basketId}`;
      
      console.log('📡 Fetching intelligence from:', url);
      
      // Get the authorization header from the original request
      const authHeader = this.request?.headers?.get('authorization') || '';
      
      // Make API call to legacy intelligence generation endpoint for now
      // This maintains compatibility while moving through the unified pipeline
      const response = await apiClient.request(url.replace(baseUrl, ''), {
        method: 'POST',
        headers: { 
          'Authorization': authHeader,
          'Cookie': this.request?.headers?.get('cookie') || ''
        },
        body: JSON.stringify({
          basketId: change.basketId,
          origin: data.origin,
          conversationContext: data.conversationContext,
          checkPending: data.checkPending,
          userId: change.actorId
        })
      });

      const result = response;
      
      console.log('✅ Intelligence generation completed through Universal Change Service');
      
      // For now, we don't create database changes since intelligence generation
      // triggers background processes that create their own events
      return {
        changes: [],
        data: {
          success: true,
          hasPendingChanges: (result as any)?.hasPendingChanges,
          message: 'Intelligence generation initiated'
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Intelligence generation failed in Universal Change Service:', errorMessage);
      throw error;
    }
  }

  private async applyContextAdd(change: ValidatedChange): Promise<{ changes: DatabaseChange[], data: any }> {
    const data = change.data as ContextAddData;
    
    console.log('🎯 Step 9: UniversalChangeService.applyContextAdd called with:', { basketId: change.basketId, content: data.content });
    
    // Create consolidated raw dump
    const consolidatedContent = data.content.map(item => {
      if (item.type === 'text') return item.content;
      if (item.type === 'file') return `[File: ${item.metadata?.filename}]\n${item.content}`;
      return `[${item.type}]: ${item.content}`;
    }).join('\n\n');

    console.log('🎯 Step 10: Consolidated content for raw_dumps:', { content: consolidatedContent, length: consolidatedContent.length });

    const { data: dumpResult, error: dumpError } = await this.supabase
      .from('raw_dumps')
      .insert({
        basket_id: change.basketId,
        body_md: consolidatedContent,
        file_url: null,
        workspace_id: change.workspaceId
      })
      .select()
      .single();

    if (dumpError) {
      console.error('🎯 CRITICAL ERROR: Failed to create raw dump:', dumpError);
      throw new Error(`Failed to create raw dump: ${dumpError.message}`);
    }

    console.log('🎯 Step 11: Raw dump created successfully:', { id: dumpResult.id, content_length: consolidatedContent.length });

    return {
      changes: [{
        table: 'raw_dumps',
        operation: 'insert',
        recordId: dumpResult.id,
        newData: dumpResult
      }],
      data: dumpResult
    };
  }

  private async rollbackChanges(changes: DatabaseChange[]): Promise<void> {
    console.log('🔄 Rolling back changes...');
    
    // Implement rollback logic based on change type
    for (const change of changes.reverse()) {
      try {
        switch (change.operation) {
          case 'insert':
            await this.supabase
              .from(change.table)
              .delete()
              .eq('id', change.recordId);
            break;
          
          case 'update':
            if (change.oldData) {
              await this.supabase
                .from(change.table)
                .update(change.oldData)
                .eq('id', change.recordId);
            }
            break;
          
          case 'delete':
            if (change.oldData) {
              await this.supabase
                .from(change.table)
                .insert(change.oldData);
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to rollback ${change.operation} on ${change.table}:`, error);
      }
    }
  }

  // ========================================================================
  // CHANGE TRACKING
  // ========================================================================

  async createChangeEvent(change: AppliedChange): Promise<ChangeEvent> {
    const event: ChangeEvent = {
      id: change.eventId,
      basketId: change.basketId,
      changeId: change.id,
      type: change.type,
      status: change.result.status,
      actorId: change.actorId,
      data: change.data,
      metadata: {
        ...change.metadata,
        databaseChanges: change.databaseChanges.length,
        origin: change.origin
      },
      timestamp: change.timestamp
    };

    // Store event in events table
    const { error } = await this.supabase
      .from('events')
      .insert({
        id: event.id,
        basket_id: event.basketId,
        workspace_id: change.workspaceId, // CRITICAL: Store workspace_id as direct column for RLS
        kind: `change_${event.type}`,
        payload: {
          changeId: event.changeId,
          type: event.type,
          status: event.status,
          actorId: event.actorId,
          data: event.data,
          metadata: event.metadata,
          workspaceId: change.workspaceId // Also keep in payload for backwards compatibility
        },
        ts: event.timestamp
      });

    if (error) {
      console.error('Failed to store change event:', error);
    }

    return event;
  }

  async trackRevision(change: AppliedChange): Promise<Revision[]> {
    const revisions: Revision[] = [];

    for (const dbChange of change.databaseChanges) {
      const revision: Revision = {
        id: crypto.randomUUID(),
        basketId: change.basketId,
        changeId: change.id,
        entityType: dbChange.table,
        entityId: dbChange.recordId,
        previousState: dbChange.oldData || null,
        newState: dbChange.newData,
        timestamp: change.timestamp
      };

      revisions.push(revision);

      // Store revision (assuming we have a revisions table)
      // This would be implemented based on your revision tracking needs
    }

    return revisions;
  }

  // ========================================================================
  // REAL-TIME NOTIFICATIONS
  // ========================================================================

  async notifyChange(change: AppliedChange): Promise<void> {
    const payload: any = { // WebSocketPayload type for compatibility
      event: change.result.success ? 'change_applied' : 'change_failed',
      basketId: change.basketId,
      changeId: change.id,
      data: {
        type: change.type,
        status: change.result.status,
        appliedData: change.result.appliedData,
        errors: change.result.errors,
        timestamp: change.timestamp
      },
      timestamp: change.timestamp
    };

    // Broadcast change to all connected clients in the basket
    // await WebSocketServer.broadcastToBasket(change.basketId, payload); // DISABLED - Using Supabase Realtime
    
    console.log('📡 Change notification (would be broadcasted via Supabase Realtime):', payload.event);
  }

  // ========================================================================
  // CONFLICT RESOLUTION
  // ========================================================================

  async detectConflicts(change: ChangeRequest): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const conflictEngine = getConflictDetectionEngine();

    // Convert change to ChangeVector for conflict detection
    const changeVector: ChangeVector = {
      id: change.id,
      userId: change.actorId,
      timestamp: change.timestamp,
      type: this.getOperationType(change),
      position: this.getChangePosition(change),
      content: this.getChangeContent(change),
      previousContent: await this.getPreviousContent(change),
      metadata: change.metadata
    };

    // Use advanced conflict detection
    const detectionResult = await conflictEngine.detectConflicts(
      changeVector,
      this.getDocumentId(change),
      await this.getCurrentState(change)
    );

    // Convert detected conflicts to our format
    for (const detectedConflict of detectionResult.conflicts) {
      conflicts.push({
        id: detectedConflict.id,
        type: this.mapConflictType(detectedConflict.type),
        description: detectedConflict.description,
        affectedFields: detectedConflict.affectedRanges.map(r => `range_${r.start}_${r.end}`),
        currentValue: detectedConflict.conflictData.currentValue,
        incomingValue: detectedConflict.conflictData.incomingValues[0]?.value,
        suggestions: detectedConflict.autoResolvable
          ? [{ strategy: 'merge', description: 'Automatically merge changes', autoApplicable: true }]
          : [{ strategy: 'manual', description: 'Manual resolution required', autoApplicable: false }]
      });
    }

    return conflicts;
  }

  // Helper methods for conflict detection integration
  private getOperationType(change: ChangeRequest): 'insert' | 'delete' | 'replace' | 'move' {
    switch (change.type) {
      case 'document_create': return 'insert';
      case 'document_update': return 'replace';
      case 'document_delete': return 'delete';
      default: return 'replace';
    }
  }

  private getChangePosition(change: ChangeRequest): { start: number; end: number } {
    // Extract position information from change data
    const data = change.data as any;
    return {
      start: data.position?.start || 0,
      end: data.position?.end || 0
    };
  }

  private getChangeContent(change: ChangeRequest): string | undefined {
    const data = change.data as any;
    return data.content || data.title || data.name;
  }

  private async getPreviousContent(change: ChangeRequest): Promise<string | undefined> {
    // Fetch previous content for diff analysis
    if (change.type === 'document_update') {
      const data = change.data as DocumentUpdateData;
      const { data: doc } = await this.supabase
        .from('documents')
        .select('content_raw')
        .eq('id', data.documentId)
        .single();
      return doc?.content_raw;
    }
    return undefined;
  }

  private getDocumentId(change: ChangeRequest): string {
    const data = change.data as any;
    return data.documentId || data.id || change.basketId;
  }

  private async getCurrentState(change: ChangeRequest): Promise<any> {
    // Get current state for conflict analysis
    if (change.type === 'document_update') {
      const data = change.data as DocumentUpdateData;
      const { data: doc } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', data.documentId)
        .single();
      return doc;
    }
    return {};
  }

  private mapConflictType(detectedType: string): ConflictType {
    switch (detectedType) {
      case 'text_concurrent_edit': return 'concurrent_edit';
      case 'version_divergence': return 'version_mismatch';
      case 'permission_conflict': return 'permission_denied';
      case 'structural_modification': return 'data_integrity';
      default: return 'concurrent_edit';
    }
  }

  async resolveConflict(conflict: Conflict, strategy: string = 'auto_merge'): Promise<any> {
    console.log('🔧 Resolving conflict:', conflict.id, 'with strategy:', strategy);
    
    const transformEngine = getOperationalTransform();
    
    try {
      switch (strategy) {
        case 'auto_merge':
          // Use operational transform for automatic merging
          return await this.autoMergeConflict(conflict, transformEngine);
          
        case 'accept_incoming':
          // Accept the incoming change
          return { resolved: true, value: conflict.incomingValue, strategy: 'accept_incoming' };
          
        case 'keep_current':
          // Keep the current value
          return { resolved: true, value: conflict.currentValue, strategy: 'keep_current' };
          
        case 'operational_transform':
          // Apply operational transform
          return await this.operationalTransformResolve(conflict, transformEngine);
          
        default:
          throw new Error(`Unsupported resolution strategy: ${strategy}`);
      }
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      return { resolved: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async autoMergeConflict(conflict: Conflict, transformEngine: any): Promise<any> {
    // Implement automatic merge logic
    const current = conflict.currentValue || '';
    const incoming = conflict.incomingValue || '';
    
    // Simple merge strategy - in production this would be more sophisticated
    if (typeof current === 'string' && typeof incoming === 'string') {
      // Find common base and merge
      const merged = this.simpleTextMerge(current, incoming);
      return { resolved: true, value: merged, strategy: 'auto_merge', conflicts: [] };
    }
    
    return { resolved: false, error: 'Cannot auto-merge non-text content' };
  }

  private async operationalTransformResolve(conflict: Conflict, transformEngine: any): Promise<any> {
    // Use operational transform for sophisticated merging
    // This would integrate with the actual operational transform system
    return { resolved: true, value: conflict.incomingValue, strategy: 'operational_transform' };
  }

  private simpleTextMerge(current: string, incoming: string): string {
    // Simple line-based merge - production would use sophisticated diff/merge
    const currentLines = current.split('\n');
    const incomingLines = incoming.split('\n');
    
    // Find common prefix and suffix
    let commonPrefix = 0;
    while (commonPrefix < Math.min(currentLines.length, incomingLines.length) &&
           currentLines[commonPrefix] === incomingLines[commonPrefix]) {
      commonPrefix++;
    }
    
    let commonSuffix = 0;
    while (commonSuffix < Math.min(currentLines.length - commonPrefix, incomingLines.length - commonPrefix) &&
           currentLines[currentLines.length - 1 - commonSuffix] === incomingLines[incomingLines.length - 1 - commonSuffix]) {
      commonSuffix++;
    }
    
    // Merge the middle parts
    const prefix = currentLines.slice(0, commonPrefix);
    const suffix = currentLines.slice(currentLines.length - commonSuffix);
    const currentMiddle = currentLines.slice(commonPrefix, currentLines.length - commonSuffix);
    const incomingMiddle = incomingLines.slice(commonPrefix, incomingLines.length - commonSuffix);
    
    // Simple strategy: include both changes
    const merged = [...prefix, ...currentMiddle, ...incomingMiddle, ...suffix];
    
    return merged.join('\n');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createUniversalChangeService(supabase: SupabaseClient, request?: Request): UniversalChangeService {
  return new UniversalChangeService(supabase, request);
}