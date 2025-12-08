"use client";

import { useState, useEffect, useCallback, useReducer, useMemo, useRef } from 'react';
import type { 
  ChangeRequest, 
  ChangeResult, 
  ChangeType, 
  ChangeData,
  ChangeStatus,
  Conflict,
  ValidationError,
  // WebSocketPayload // DISABLED - Using Supabase Realtime
} from '@/lib/services/UniversalChangeService';
import { apiClient } from '@/lib/api/client';
// import { getWebSocketManager, destroyWebSocketManager, type WebSocketManager } from '@/lib/websocket/WebSocketManager'; // DISABLED - Using Supabase Realtime

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PendingChange {
  id: string;
  type: ChangeType;
  status: ChangeStatus;
  data: ChangeData;
  timestamp: string;
  actorId: string;
  errors?: string[];
  warnings?: string[];
  conflicts?: Conflict[];
}

export interface ProcessingState {
  [changeId: string]: {
    type: ChangeType;
    message: string;
    startTime: string;
  };
}

export interface ChangeError {
  id: string;
  changeId: string;
  message: string;
  code: string;
  timestamp: string;
  dismissible: boolean;
}

export interface UniversalChangesState {
  // Core state
  pendingChanges: PendingChange[];
  processing: ProcessingState;
  errors: ChangeError[];
  
  // WebSocket connection
  isConnected: boolean;
  connectionError: string | null;
  
  // UI state
  isInitialLoading: boolean;
  lastUpdateTime: string | null;
  
  // Conflict resolution
  unresolvedConflicts: Conflict[];
  
  // Activity tracking
  hasActiveSessions: boolean;
}

type UniversalChangesAction =
  | { type: 'SET_INITIAL_LOADING'; payload: boolean }
  | { type: 'SET_PENDING_CHANGES'; payload: PendingChange[] }
  | { type: 'ADD_PENDING_CHANGE'; payload: PendingChange }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }
  | { type: 'UPDATE_CHANGE_STATUS'; payload: { id: string; status: ChangeStatus; errors?: string[] } }
  | { type: 'START_PROCESSING'; payload: { changeId: string; type: ChangeType; message: string } }
  | { type: 'STOP_PROCESSING'; payload: string }
  | { type: 'ADD_ERROR'; payload: ChangeError }
  | { type: 'REMOVE_ERROR'; payload: string }
  | { type: 'SET_CONNECTION_STATUS'; payload: { isConnected: boolean; error?: string } }
  | { type: 'SET_CONFLICTS'; payload: Conflict[] }
  | { type: 'RESOLVE_CONFLICT'; payload: string }
  | { type: 'SET_ACTIVE_SESSIONS'; payload: boolean }
  | { type: 'SET_LAST_UPDATE'; payload: string }
  | { type: 'RESET_STATE' };

// ============================================================================
// STATE REDUCER
// ============================================================================

function universalChangesReducer(
  state: UniversalChangesState, 
  action: UniversalChangesAction
): UniversalChangesState {
  switch (action.type) {
    case 'SET_INITIAL_LOADING':
      return { ...state, isInitialLoading: action.payload };

    case 'SET_PENDING_CHANGES':
      return { 
        ...state, 
        pendingChanges: action.payload,
        lastUpdateTime: new Date().toISOString()
      };

    case 'ADD_PENDING_CHANGE':
      return {
        ...state,
        pendingChanges: [...state.pendingChanges, action.payload],
        lastUpdateTime: new Date().toISOString()
      };

    case 'REMOVE_PENDING_CHANGE':
      return {
        ...state,
        pendingChanges: state.pendingChanges.filter(change => change.id !== action.payload),
        lastUpdateTime: new Date().toISOString()
      };

    case 'UPDATE_CHANGE_STATUS':
      return {
        ...state,
        pendingChanges: state.pendingChanges.map(change =>
          change.id === action.payload.id
            ? { ...change, status: action.payload.status, errors: action.payload.errors }
            : change
        )
      };

    case 'START_PROCESSING':
      return {
        ...state,
        processing: {
          ...state.processing,
          [action.payload.changeId]: {
            type: action.payload.type,
            message: action.payload.message,
            startTime: new Date().toISOString()
          }
        }
      };

    case 'STOP_PROCESSING':
      const { [action.payload]: removed, ...remainingProcessing } = state.processing;
      return {
        ...state,
        processing: remainingProcessing
      };

    case 'ADD_ERROR':
      return {
        ...state,
        errors: [...state.errors, action.payload]
      };

    case 'REMOVE_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => error.id !== action.payload)
      };

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload.isConnected,
        connectionError: action.payload.error || null
      };

    case 'SET_CONFLICTS':
      return {
        ...state,
        unresolvedConflicts: action.payload
      };

    case 'RESOLVE_CONFLICT':
      return {
        ...state,
        unresolvedConflicts: state.unresolvedConflicts.filter(
          conflict => conflict.id !== action.payload
        )
      };

    case 'SET_ACTIVE_SESSIONS':
      return { ...state, hasActiveSessions: action.payload };

    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdateTime: action.payload };

    case 'RESET_STATE':
      return {
        pendingChanges: [],
        processing: {},
        errors: [],
        isConnected: false,
        connectionError: null,
        isInitialLoading: true,
        lastUpdateTime: null,
        unresolvedConflicts: [],
        hasActiveSessions: false
      };

    default:
      return state;
  }
}

// Initial state
const initialState: UniversalChangesState = {
  pendingChanges: [],
  processing: {},
  errors: [],
  isConnected: false,
  connectionError: null,
  isInitialLoading: true,
  lastUpdateTime: null,
  unresolvedConflicts: [],
  hasActiveSessions: false
};

// ============================================================================
// REAL-TIME WEBSOCKET INTEGRATION  
// ============================================================================
// Enhanced WebSocket integration with automatic reconnection and event handling

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export interface UseUniversalChangesReturn extends UniversalChangesState {
  // Core change operations
  submitChange: (type: ChangeType, data: ChangeData, metadata?: Record<string, any>) => Promise<ChangeResult>;
  approveChanges: (changeIds: string[], sections?: string[]) => Promise<void>;
  rejectChanges: (changeIds: string[], reason?: string) => Promise<void>;
  
  // Intelligence operations  
  generateIntelligence: (conversationContext?: any, origin?: string) => Promise<void>;
  
  // Convenience methods for specific change types
  updateBasket: (updates: { name?: string; description?: string; status?: string }) => Promise<ChangeResult>;
  createDocument: (title: string, content: string, documentType?: string) => Promise<ChangeResult>;
  updateDocument: (documentId: string, updates: { title?: string; content?: string }) => Promise<ChangeResult>;
  addContext: (content: any[], triggerIntelligence?: boolean) => Promise<ChangeResult>;
  
  // Conflict resolution
  resolveConflict: (conflictId: string, resolution: 'accept_incoming' | 'keep_current' | 'merge') => Promise<void>;
  
  // Utility methods
  refreshChanges: () => Promise<void>;
  dismissError: (errorId: string) => void;
  clearAllErrors: () => void;
  
  // Computed properties
  isProcessing: boolean;
  hasErrors: boolean;
  hasConflicts: boolean;
  processingCount: number;
}

/**
 * Universal Changes Hook - Single source of truth for ALL change management
 * 
 * This hook replaces:
 * - useUnifiedIntelligence
 * - BasketContext  
 * - useThinkingPartner
 * - All individual change hooks
 */
export function useUniversalChanges(basketId: string): UseUniversalChangesReturn {
  const [state, dispatch] = useReducer(universalChangesReducer, initialState);
  const wsManager = useRef<any>(null);

  // ========================================================================
  // WEBSOCKET INTEGRATION
  // ========================================================================

  const handleWebSocketMessage = useCallback((payload: any) => { // WebSocketPayload type disabled
    console.log('📨 WebSocket message received:', payload);
    
    switch (payload.event) {
      case 'change_applied':
        // Remove from pending changes or update status
        dispatch({ 
          type: 'UPDATE_CHANGE_STATUS', 
          payload: { 
            id: payload.changeId!, 
            status: 'completed' 
          } 
        });
        break;
        
      case 'change_failed':
        dispatch({ 
          type: 'UPDATE_CHANGE_STATUS', 
          payload: { 
            id: payload.changeId!, 
            status: 'failed',
            errors: [payload.data.error || 'Change failed']
          } 
        });
        break;
        
      case 'conflict_detected':
        dispatch({ 
          type: 'SET_CONFLICTS', 
          payload: payload.data.conflicts || [] 
        });
        break;
        
      case 'user_activity':
        // Handle collaborative user activity
        console.log('👥 User activity:', payload.data);
        break;
    }
  }, []);

  const handleConnectionStatusChange = useCallback((status: any) => {
    dispatch({ 
      type: 'SET_CONNECTION_STATUS', 
      payload: { 
        isConnected: status.isConnected, 
        error: status.error 
      } 
    });
  }, []);
  
  const handleJoinedMessage = useCallback((payload: any) => { // WebSocketPayload type disabled
    console.log('👋 User joined basket:', payload.data);
    // Could update user presence UI here
  }, []);
  
  const handleLeftMessage = useCallback((payload: any) => { // WebSocketPayload type disabled
    console.log('👋 User left basket:', payload.data);
    // Could update user presence UI here
  }, []);
  
  const handleEditingMessage = useCallback((payload: any) => { // WebSocketPayload type disabled
    console.log('✏️ User editing status:', payload.data);
    // Could update collaborative editing indicators here
  }, []);

  // WebSocket functionality disabled - using Supabase Realtime instead
  // useEffect(() => {
  //   if (basketId) {
  //     // Get or create WebSocket manager for this basket
  //     wsManager.current = getWebSocketManager(basketId, {
  //       userId: 'current_user', // TODO: Get from auth context
  //       token: 'auth_token' // TODO: Get from auth context
  //     });
  //     
  //     // Subscribe to WebSocket events
  //     const subscriptions = [
  //       wsManager.current.subscribe('change_applied', handleWebSocketMessage),
  //       wsManager.current.subscribe('change_failed', handleWebSocketMessage),
  //       wsManager.current.subscribe('conflict_detected', handleWebSocketMessage),
  //       wsManager.current.subscribe('user_joined', handleJoinedMessage),
  //       wsManager.current.subscribe('user_left', handleLeftMessage),
  //       wsManager.current.subscribe('user_editing', handleEditingMessage)
  //     ];
  //     
  //     // Subscribe to connection status changes
  //     const statusUnsubscribe = wsManager.current.onStatusChange(handleConnectionStatusChange);
  //     
  //     // Connect to WebSocket server
  //     wsManager.current.connect();
  //     
  //     return () => {
  //       // Clean up subscriptions
  //       subscriptions.forEach(id => wsManager.current?.unsubscribe(id));
  //       statusUnsubscribe();
  //       
  //       // Leave basket and cleanup
  //       wsManager.current?.leaveBasket();
  //       destroyWebSocketManager(basketId);
  //     };
  //   }
  // }, [basketId]);

  // ========================================================================
  // ACTIVITY DETECTION
  // ========================================================================

  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;
    
    const resetInactivityTimer = () => {
      dispatch({ type: 'SET_ACTIVE_SESSIONS', payload: true });
      clearTimeout(inactivityTimer);
      
      inactivityTimer = setTimeout(() => {
        dispatch({ type: 'SET_ACTIVE_SESSIONS', payload: false });
      }, 5 * 60 * 1000); // 5 minutes of inactivity
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });

    resetInactivityTimer(); // Initialize

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
      clearTimeout(inactivityTimer);
    };
  }, []);

  // ========================================================================
  // CHANGE OPERATIONS
  // ========================================================================

  const submitChange = useCallback(async (
    type: ChangeType, 
    data: ChangeData, 
    metadata: Record<string, any> = {}
  ): Promise<ChangeResult> => {
    const changeId = crypto.randomUUID();
    
    try {
      // Start processing state
      dispatch({ 
        type: 'START_PROCESSING', 
        payload: { 
          changeId, 
          type, 
          message: getProcessingMessage(type) 
        } 
      });

      // Map legacy change types to Universal Work (artifact-only fence)
      let work_type: 'P0_CAPTURE' | 'P1_SUBSTRATE' | 'P2_GRAPH' | 'P3_REFLECTION' | 'P4_COMPOSE' | 'MANUAL_EDIT' | 'PROPOSAL_REVIEW' | 'TIMELINE_RESTORE';
      let operations: Array<{ type: string; data: Record<string, any> }> = [];

      switch (type) {
        case 'document_create': {
          work_type = 'P4_COMPOSE';
          const d = data as any;
          operations = [{
            type: 'CreateDocument',
            data: { title: d.title, content: d.content, document_type: d.documentType || 'general' }
          }];
          break;
        }
        case 'document_update': {
          work_type = 'P4_COMPOSE';
          const d = data as any;
          operations = [{
            type: 'UpdateDocument',
            data: { document_id: d.documentId, title: d.title, content: d.content }
          }];
          break;
        }
        case 'document_delete': {
          work_type = 'P4_COMPOSE';
          const d = data as any;
          operations = [{ type: 'DeleteDocument', data: { document_id: d.documentId } }];
          break;
        }
        case 'block_create':
        case 'block_update':
        case 'context_add': {
          work_type = 'MANUAL_EDIT';
          const d = data as any;
          operations = [{
            type: type === 'block_create' ? 'CreateBlock' : 
                  type === 'block_update' ? 'UpdateBlock' : 'AddContext',
            data: d
          }];
          break;
        }
        case 'basket_update': {
          work_type = 'MANUAL_EDIT';
          const d = data as any;
          operations = [{
            type: 'UpdateBasket',
            data: d
          }];
          break;
        }
        default: {
          // Fence: legacy non‑artifact flows are not supported via this hook anymore
          const errorMessage = 'Legacy change type not supported here. Use Maintenance/Graph UI or /api/work directly.';
          dispatch({
            type: 'ADD_ERROR',
            payload: {
              id: crypto.randomUUID(),
              changeId,
              message: errorMessage,
              code: 'LEGACY_UNSUPPORTED',
              timestamp: new Date().toISOString(),
              dismissible: true
            }
          });
          return { success: false, changeId, status: 'failed', errors: [errorMessage] } as ChangeResult;
        }
      }

      console.log('🎯 Step 6: Sending POST /api/work with:', { work_type, basketId, operations });
      const workRes: any = await apiClient.request('/api/work', {
        method: 'POST',
        body: JSON.stringify({
          work_type,
          work_payload: { operations, basket_id: basketId },
          priority: 'normal'
        })
      });

      const success = !!(workRes && workRes.success !== false);
      const execution_mode = workRes?.execution_mode as string | undefined;
      const mapped: ChangeResult = {
        success,
        changeId: workRes?.work_id || changeId,
        status: execution_mode === 'auto_execute' ? 'completed' : 'pending',
        appliedData: workRes,
      };

      if (!success) {
        dispatch({
          type: 'ADD_ERROR',
          payload: {
            id: crypto.randomUUID(),
            changeId: mapped.changeId,
            message: workRes?.error || 'Change failed',
            code: 'CHANGE_FAILED',
            timestamp: new Date().toISOString(),
            dismissible: true
          }
        });
      } else {
        // Optimistic completion for artifact edits
        dispatch({
          type: 'ADD_PENDING_CHANGE',
          payload: {
            id: mapped.changeId,
            type,
            status: mapped.status,
            data,
            timestamp: new Date().toISOString(),
            actorId: 'current_user'
          }
        });
      }

      return mapped;

    } catch (error) {
      console.error('💥 Change submission error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      dispatch({
        type: 'ADD_ERROR',
        payload: {
          id: crypto.randomUUID(),
          changeId,
          message: errorMessage,
          code: 'NETWORK_ERROR',
          timestamp: new Date().toISOString(),
          dismissible: true
        }
      });

      return {
        success: false,
        changeId,
        status: 'failed',
        errors: [errorMessage]
      };
      
    } finally {
      // Stop processing state
      dispatch({ type: 'STOP_PROCESSING', payload: changeId });
    }
  }, [basketId]);

  // ========================================================================
  // CONVENIENCE METHODS
  // ========================================================================

  const updateBasket = useCallback(async (updates: { name?: string; description?: string; status?: string }) => {
    return submitChange('basket_update', updates);
  }, [submitChange]);

  const createDocument = useCallback(async (title: string, content: string, documentType = 'general') => {
    return submitChange('document_create', { title, content, documentType });
  }, [submitChange]);

  const updateDocument = useCallback(async (documentId: string, updates: { title?: string; content?: string }) => {
    return submitChange('document_update', { documentId, ...updates });
  }, [submitChange]);

  const addContext = useCallback(async (content: any[], triggerIntelligence = true) => {
    console.log('🎯 Step 4: changeManager.addContext called with:', { content, triggerIntelligence });
    const result = await submitChange('context_add', { content, triggerIntelligenceRefresh: triggerIntelligence });
    console.log('🎯 Step 5: submitChange completed with result:', result);
    return result;
  }, [submitChange]);

  const approveChanges = useCallback(async (changeIds: string[], sections: string[] = []) => {
    console.log('✅ APPROVING: Changes', changeIds);
    
    for (const changeId of changeIds) {
      await submitChange('intelligence_approve', {
        eventId: changeId,
        approvedSections: sections,
        partialApproval: sections.length > 0,
        intelligence: {} as any // Will be filled by server
      });
    }
    
    console.log('🔄 CHANGES APPROVED: Substrate should now evolve via WebSocket');
  }, [submitChange]);

  const rejectChanges = useCallback(async (changeIds: string[], reason = '') => {
    for (const changeId of changeIds) {
      await submitChange('intelligence_reject', {
        eventId: changeId,
        reason
      });
    }
  }, [submitChange]);

  // ========================================================================
  // INTELLIGENCE OPERATIONS
  // ========================================================================

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  // WebSocket-driven changes - no polling needed!
  const refreshChanges = useCallback(async () => {
    // This method is now deprecated since WebSocket provides real-time updates
    // Keeping for backward compatibility but it does nothing
    console.log('📡 refreshChanges called but WebSocket handles real-time updates');
  }, []);

  const generateIntelligence = useCallback(async (conversationContext?: any, origin = 'manual') => {
    const changeId = crypto.randomUUID();
    
    try {
      // Start processing state
      dispatch({ 
        type: 'START_PROCESSING', 
        payload: { 
          changeId, 
          type: 'intelligence_generate', 
          message: 'Generating intelligence insights...' 
        } 
      });

      console.log('🧠 Generating intelligence (fenced: using dedicated endpoint):', { basketId, origin });

      // Fence: use dedicated intelligence endpoint rather than legacy universal changes
      const result = await apiClient.request(`/api/intelligence/generate/${basketId}`, {
        method: 'POST',
        body: JSON.stringify({ origin, conversationContext })
      });

      if (!result || (result as any)?.error) {
        throw new Error((result as any)?.error || 'Failed to generate intelligence');
      }

      if ((result as any).requiresReview || (result as any).changesDetected > 0) {
        console.log('🔔 Intelligence generated insights that may require approval');
        
        // Check if intelligence was generated and create pending changes for approval
        if ((result as any).data?.requiresReview || (result as any).data?.changesDetected > 0) {
          console.log('🔔 Intelligence generated insights that require approval - creating pending changes');
          
          try {
            // Fetch the generated intelligence data for approval
            const intelligence = await apiClient.request(`/api/substrate/basket/${basketId}`);
              
            // Transform intelligence generation result into pending changes
            const intelligencePendingChange: PendingChange = {
              id: crypto.randomUUID(),
              type: 'intelligence_approve',
              data: {
                eventId: (result as any).data.eventId,
                approvedSections: ['all'], // Default to all sections approved
                partialApproval: false,
                intelligence: intelligence as any
              },
              timestamp: new Date().toISOString(),
              status: 'pending',
              actorId: '' // Will be set by the reducer
            };
            
            // Add to pending changes
            dispatch({
              type: 'ADD_PENDING_CHANGE',
              payload: intelligencePendingChange
            });
            
            console.log('✨ Created pending change for intelligence approval:', intelligencePendingChange.id);
          } catch (fetchError) {
            console.error('❌ Failed to fetch intelligence for approval:', fetchError);
          }
        }
      } else {
          console.log('📡 Intelligence generation completed - no new insights to review');
        }

    } catch (error) {
      console.error('❌ Intelligence generation failed via Universal Changes:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      dispatch({
        type: 'ADD_ERROR',
        payload: {
          id: crypto.randomUUID(),
          changeId,
          message: errorMessage,
          code: 'INTELLIGENCE_GENERATION_FAILED',
          timestamp: new Date().toISOString(),
          dismissible: true
        }
      });
      
    } finally {
      // Stop processing state
      dispatch({ type: 'STOP_PROCESSING', payload: changeId });
    }
  }, [basketId]);

  // ========================================================================
  // CONFLICT RESOLUTION
  // ========================================================================

  const resolveConflict = useCallback(async (
    conflictId: string, 
    resolution: 'accept_incoming' | 'keep_current' | 'merge'
  ) => {
    try {
      // TODO: Implement conflict resolution API call
      console.log(`🔧 Resolving conflict ${conflictId} with strategy: ${resolution}`);
      
      // For now, just remove from local state
      dispatch({ type: 'RESOLVE_CONFLICT', payload: conflictId });
      
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    }
  }, []);

  const dismissError = useCallback((errorId: string) => {
    dispatch({ type: 'REMOVE_ERROR', payload: errorId });
  }, []);

  const clearAllErrors = useCallback(() => {
    state.errors.forEach(error => {
      dispatch({ type: 'REMOVE_ERROR', payload: error.id });
    });
  }, [state.errors]);

  // ========================================================================
  // COMPUTED PROPERTIES
  // ========================================================================

  const computedValues = useMemo(() => ({
    isProcessing: Object.keys(state.processing).length > 0,
    hasErrors: state.errors.length > 0,
    hasConflicts: state.unresolvedConflicts.length > 0,
    processingCount: Object.keys(state.processing).length
  }), [state.processing, state.errors, state.unresolvedConflicts]);

  // ========================================================================
  // WEBSOCKET INITIALIZATION - NO POLLING NEEDED!
  // ========================================================================

  useEffect(() => {
    if (basketId) {
      dispatch({ type: 'SET_INITIAL_LOADING', payload: true });
      
      // WebSocket connection handles all real-time updates
      // Initial loading completes when WebSocket connects
      setTimeout(() => {
        dispatch({ type: 'SET_INITIAL_LOADING', payload: false });
      }, 1500); // Allow time for WebSocket connection
    }
  }, [basketId]);

  // ========================================================================
  // RETURN HOOK INTERFACE
  // ========================================================================

  return {
    // State
    ...state,
    ...computedValues,
    
    // Core operations
    submitChange,
    approveChanges,
    rejectChanges,
    
    // Intelligence operations
    generateIntelligence,
    
    // Convenience methods
    updateBasket,
    createDocument,
    updateDocument,
    addContext,
    
    // Conflict resolution
    resolveConflict,
    
    // Utility methods
    refreshChanges,
    dismissError,
    clearAllErrors
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getProcessingMessage(type: ChangeType): string {
  switch (type) {
    case 'basket_update':
      return 'Updating basket...';
    case 'document_create':
      return 'Creating document...';
    case 'document_update':
      return 'Saving document...';
    case 'intelligence_approve':
      return 'Applying intelligence changes...';
    case 'intelligence_reject':
      return 'Rejecting changes...';
    case 'intelligence_generate':
      return 'Generating intelligence insights...';
    case 'context_add':
      return 'Adding context...';
    case 'block_create':
      return 'Creating block...';
    case 'block_update':
      return 'Updating block...';
    default:
      return 'Processing change...';
  }
}
