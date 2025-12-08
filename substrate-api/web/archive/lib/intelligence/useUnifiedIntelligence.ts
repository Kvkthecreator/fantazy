"use client";

import { useState, useEffect, useCallback, useReducer, useMemo } from 'react';
import { apiClient } from '@/lib/api/client';
import type { SubstrateIntelligence } from '@/lib/substrate/types';
import type { IntelligenceEvent } from './changeDetection';
import type { ConversationTriggeredGeneration } from './conversationAnalyzer';
import type { ContextualConversationRequest } from './contextualIntelligence';
import { changeFatigueManager, type BatchedChange } from './changeFatiguePrevention';
import { usePageContext } from './pageContextDetection';

// Unified State Machine for Intelligence Management
export enum ChangeState {
  IDLE = 'idle',
  GENERATING = 'generating',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ERROR = 'error'
}

export interface IntelligenceState {
  // Current intelligence data (single source of truth)
  currentIntelligence: SubstrateIntelligence | null;
  
  // Change management state
  changeState: ChangeState;
  pendingChanges: IntelligenceEvent[];
  batchedChanges: BatchedChange[];
  
  // Conversation context
  conversationContext: ConversationTriggeredGeneration | null;
  
  // Loading and error states
  isInitialLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  processingMessage: string;
  
  // Activity tracking
  hasActiveSessions: boolean;
  lastUpdateTime: string | null;
  
  // Fatigue prevention
  autoApprovedCount: number;
  filteredCount: number;
}

// Action types for state reducer
type IntelligenceAction =
  | { type: 'SET_INITIAL_LOADING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: { isProcessing: boolean; message?: string } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_INTELLIGENCE'; payload: SubstrateIntelligence | null }
  | { type: 'SET_PENDING_CHANGES'; payload: IntelligenceEvent[] }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }
  | { type: 'SET_BATCHED_CHANGES'; payload: BatchedChange[] }
  | { type: 'SET_CONVERSATION_CONTEXT'; payload: ConversationTriggeredGeneration | null }
  | { type: 'SET_CHANGE_STATE'; payload: ChangeState }
  | { type: 'SET_ACTIVE_SESSIONS'; payload: boolean }
  | { type: 'SET_LAST_UPDATE_TIME'; payload: string | null }
  | { type: 'INCREMENT_AUTO_APPROVED' }
  | { type: 'INCREMENT_FILTERED' }
  | { type: 'RESET_STATE' };

// State reducer for predictable state management
function intelligenceReducer(state: IntelligenceState, action: IntelligenceAction): IntelligenceState {
  switch (action.type) {
    case 'SET_INITIAL_LOADING':
      return { ...state, isInitialLoading: action.payload };
    
    case 'SET_PROCESSING':
      return { 
        ...state, 
        isProcessing: action.payload.isProcessing,
        processingMessage: action.payload.message || '',
        changeState: action.payload.isProcessing 
          ? (state.changeState === ChangeState.IDLE ? ChangeState.GENERATING : state.changeState)
          : state.changeState
      };
    
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload,
        changeState: action.payload ? ChangeState.ERROR : state.changeState,
        isProcessing: false,
        processingMessage: ''
      };
    
    case 'SET_CURRENT_INTELLIGENCE':
      return { 
        ...state, 
        currentIntelligence: action.payload,
        lastUpdateTime: action.payload?.basketInfo?.lastUpdated || new Date().toISOString(),
        changeState: state.changeState === ChangeState.GENERATING ? ChangeState.IDLE : state.changeState
      };
    
    case 'SET_PENDING_CHANGES':
      return { 
        ...state, 
        pendingChanges: action.payload,
        changeState: action.payload.length > 0 ? ChangeState.PENDING_REVIEW : ChangeState.IDLE
      };
    
    case 'REMOVE_PENDING_CHANGE':
      const filteredChanges = state.pendingChanges.filter(change => change.id !== action.payload);
      return { 
        ...state, 
        pendingChanges: filteredChanges,
        changeState: filteredChanges.length > 0 ? ChangeState.PENDING_REVIEW : ChangeState.IDLE
      };
    
    case 'SET_CONVERSATION_CONTEXT':
      return { ...state, conversationContext: action.payload };
    
    case 'SET_CHANGE_STATE':
      return { ...state, changeState: action.payload };
    
    case 'SET_ACTIVE_SESSIONS':
      return { ...state, hasActiveSessions: action.payload };
    
    case 'SET_LAST_UPDATE_TIME':
      return { ...state, lastUpdateTime: action.payload };
    
    case 'SET_BATCHED_CHANGES':
      return { 
        ...state, 
        batchedChanges: action.payload,
        changeState: action.payload.length > 0 ? ChangeState.PENDING_REVIEW : state.changeState
      };
    
    case 'INCREMENT_AUTO_APPROVED':
      return { ...state, autoApprovedCount: state.autoApprovedCount + 1 };
    
    case 'INCREMENT_FILTERED':
      return { ...state, filteredCount: state.filteredCount + 1 };
    
    case 'RESET_STATE':
      return {
        currentIntelligence: null,
        changeState: ChangeState.IDLE,
        pendingChanges: [],
        batchedChanges: [],
        conversationContext: null,
        isInitialLoading: true,
        isProcessing: false,
        error: null,
        processingMessage: '',
        hasActiveSessions: false,
        lastUpdateTime: null,
        autoApprovedCount: 0,
        filteredCount: 0
      };
    
    default:
      return state;
  }
}

// Initial state
const initialState: IntelligenceState = {
  currentIntelligence: null,
  changeState: ChangeState.IDLE,
  pendingChanges: [],
  batchedChanges: [],
  conversationContext: null,
  isInitialLoading: true,
  isProcessing: false,
  error: null,
  processingMessage: '',
  hasActiveSessions: false,
  lastUpdateTime: null,
  autoApprovedCount: 0,
  filteredCount: 0
};

export interface UseUnifiedIntelligenceReturn extends IntelligenceState {
  // Core actions
  generateIntelligence: (conversationContext?: ConversationTriggeredGeneration | ContextualConversationRequest) => Promise<void>;
  approveChanges: (eventId: string, sections: string[]) => Promise<void>;
  rejectChanges: (eventId: string, reason?: string) => Promise<void>;
  refreshIntelligence: () => Promise<void>;
  
  // Context management
  addContext: (content: any[], metadata?: Record<string, any>) => Promise<void>;
  setConversationContext: (context: ConversationTriggeredGeneration | null) => void;
  
  // Utility actions
  checkForUpdates: () => Promise<void>;
  markAsReviewed: (eventId: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Unified Intelligence Hook - Single source of truth for all intelligence state
 * Replaces useThinkingPartner, useBasketIntelligence, useSubstrateIntelligence
 */
export function useUnifiedIntelligence(basketId: string): UseUnifiedIntelligenceReturn {
  const [state, dispatch] = useReducer(intelligenceReducer, initialState);
  const pageContext = usePageContext(basketId);

  // Activity detection for pausing background generation
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

  // Fetch current intelligence from substrate API (single source)
  const fetchCurrentIntelligence = useCallback(async () => {
    try {
      const timestamp = Date.now();
      const data = await apiClient.request(`/api/substrate/basket/${basketId}?t=${timestamp}`);
      
      console.log('🔍 Unified intelligence fetch:', {
        hasData: !!data,
        contextIntent: (data as any)?.contextUnderstanding?.intent?.substring(0, 100)
      });
      dispatch({ type: 'SET_CURRENT_INTELLIGENCE', payload: data as any });
    } catch (err) {
      console.error('Failed to fetch current intelligence:', err);
      dispatch({ type: 'SET_CURRENT_INTELLIGENCE', payload: null });
    }
  }, [basketId]);

  // Fetch pending changes from events table with fatigue prevention
  const fetchPendingChanges = useCallback(async () => {
    try {
      const data = await apiClient.request(`/api/intelligence/pending/${basketId}`);
      
      const rawEvents = (data as any)?.events || [];
      
      // Process events through fatigue prevention system
      const batchedChanges: BatchedChange[] = [];
      
      // Handle batch ready callback
      const handleBatchReady = (batch: BatchedChange) => {
        batchedChanges.push(batch);
      };
      
      // Handle auto-approved callback
      const handleAutoApproved = (events: IntelligenceEvent[]) => {
        console.log(`Auto-approved ${events.length} minor changes`);
        dispatch({ type: 'INCREMENT_AUTO_APPROVED' });
      };
      
      // Process each event through fatigue prevention - get current pageContext
      const currentPageContext = pageContext;
      for (const event of rawEvents) {
        const result = changeFatigueManager.processIntelligenceEvent(
          event,
          currentPageContext,
          handleBatchReady,
          handleAutoApproved
        );
        
        if (result === 'filtered') {
          dispatch({ type: 'INCREMENT_FILTERED' });
        }
      }
      
      // Update state with processed batches
      dispatch({ type: 'SET_BATCHED_CHANGES', payload: batchedChanges });
      
      // Convert batched changes back to individual events for backward compatibility
      const pendingEvents = batchedChanges.flatMap(batch => batch.events);
      dispatch({ type: 'SET_PENDING_CHANGES', payload: pendingEvents });
      
    } catch (err) {
      console.error('Failed to fetch pending changes:', err);
      dispatch({ type: 'SET_PENDING_CHANGES', payload: [] });
      dispatch({ type: 'SET_BATCHED_CHANGES', payload: [] });
    }
  }, [basketId, pageContext]);

  // Initial data load
  useEffect(() => {
    if (basketId) {
      dispatch({ type: 'SET_INITIAL_LOADING', payload: true });
      Promise.all([
        fetchCurrentIntelligence(),
        fetchPendingChanges()
      ]).then(() => {
        dispatch({ type: 'SET_INITIAL_LOADING', payload: false });
      }).catch(err => {
        console.error('Failed to load initial data:', err);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load intelligence data' });
        dispatch({ type: 'SET_INITIAL_LOADING', payload: false });
      });
    }
  }, [basketId, fetchCurrentIntelligence, fetchPendingChanges]);

  // NOTE: Periodic polling REMOVED - WebSocket provides real-time updates!
  // This legacy intelligence hook is deprecated in favor of useUniversalChanges
  // which provides WebSocket-based real-time updates without polling

  // Generate new intelligence with enhanced context support
  const generateIntelligence = useCallback(async (conversationContext?: ConversationTriggeredGeneration | ContextualConversationRequest) => {
    if (state.isProcessing) return;

    // Determine message based on context type
    let loadingMessage = 'Generating insights...';
    let origin = 'manual';

    if (conversationContext) {
      // Handle both regular and contextual conversation requests
      if ('pageContext' in conversationContext) {
        // Contextual request with page information
        const contextualRequest = conversationContext as ContextualConversationRequest;
        loadingMessage = getContextualLoadingMessage(contextualRequest);
        origin = 'contextual_conversation';
      } else {
        // Regular conversation request
        loadingMessage = getLoadingMessage(conversationContext.intent);
        origin = 'conversation';
      }

      dispatch({ type: 'SET_CONVERSATION_CONTEXT', payload: conversationContext });
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: true, message: loadingMessage }});
    } else {
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: true, message: loadingMessage }});
    }

    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const result = await apiClient.request(`/api/intelligence/generate/${basketId}`, {
        method: 'POST',
        body: JSON.stringify({
          origin,
          conversationContext,
          checkPending: true
        })
      });
      
      if ((result as any).hasPendingChanges) {
        await fetchPendingChanges();
      } else {
        await fetchPendingChanges();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate intelligence';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Intelligence generation failed:', err);
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: false } });
    }
  }, [basketId, state.isProcessing, fetchPendingChanges]);

  // Approve changes with optimistic updates
  const approveChanges = useCallback(async (eventId: string, sections: string[]) => {
    dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: true, message: 'Applying changes...' } });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      await apiClient.request(`/api/intelligence/approve/${basketId}`, {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          sections,
          partialApproval: sections.length > 0
        })
      });

      // Optimistic update: remove from pending
      dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: eventId });
      
      // Clear conversation context
      dispatch({ type: 'SET_CONVERSATION_CONTEXT', payload: null });

      // Refresh intelligence
      await Promise.all([
        fetchCurrentIntelligence(),
        fetchPendingChanges()
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve changes';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Failed to approve changes:', err);
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: false } });
    }
  }, [basketId, fetchCurrentIntelligence, fetchPendingChanges]);

  // Reject changes
  const rejectChanges = useCallback(async (eventId: string, reason?: string) => {
    dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: true, message: 'Rejecting changes...' } });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      await apiClient.request(`/api/intelligence/reject/${basketId}`, {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          reason
        })
      });

      // Optimistic update: remove from pending
      dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: eventId });
      
      // Clear conversation context
      dispatch({ type: 'SET_CONVERSATION_CONTEXT', payload: null });

      // Refresh pending changes
      await fetchPendingChanges();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject changes';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Failed to reject changes:', err);
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: false } });
    }
  }, [basketId, fetchPendingChanges]);

  // Add context through unified endpoint
  const addContext = useCallback(async (content: any[], metadata?: Record<string, any>) => {
    dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: true, message: 'Adding context...' } });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      await apiClient.request('/api/substrate/add-context', {
        method: 'POST',
        body: JSON.stringify({
          basketId,
          content,
          metadata
        })
      });

      // Smart refresh after context addition
      setTimeout(async () => {
        await fetchCurrentIntelligence();
      }, 1000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add context';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Failed to add context:', err);
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: false } });
    }
  }, [basketId, fetchCurrentIntelligence]);

  // Utility functions
  const refreshIntelligence = useCallback(async () => {
    await fetchCurrentIntelligence();
  }, [fetchCurrentIntelligence]);

  const checkForUpdates = useCallback(async () => {
    await fetchPendingChanges();
  }, [fetchPendingChanges]);

  const markAsReviewed = useCallback(async (eventId: string) => {
    try {
      await apiClient.request(`/api/intelligence/mark-reviewed/${basketId}`, {
        method: 'POST',
        body: JSON.stringify({ eventId })
      });
    } catch (err) {
      console.error('Failed to mark as reviewed:', err);
    }
  }, [basketId]);

  const setConversationContext = useCallback((context: ConversationTriggeredGeneration | null) => {
    dispatch({ type: 'SET_CONVERSATION_CONTEXT', payload: context });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Memoized return value to prevent unnecessary re-renders
  return useMemo(() => ({
    // State
    ...state,
    
    // Actions
    generateIntelligence,
    approveChanges,
    rejectChanges,
    refreshIntelligence,
    addContext,
    setConversationContext,
    checkForUpdates,
    markAsReviewed,
    clearError
  }), [
    state,
    generateIntelligence,
    approveChanges,
    rejectChanges,
    refreshIntelligence,
    addContext,
    setConversationContext,
    checkForUpdates,
    markAsReviewed,
    clearError
  ]);
}

// Helper function for loading messages
function getLoadingMessage(intent: any): string {
  if (intent.triggerPhrase?.toLowerCase().includes('pattern')) {
    return 'Analyzing patterns in your content...';
  }
  if (intent.triggerPhrase?.toLowerCase().includes('recommend')) {
    return 'Generating strategic recommendations...';
  }
  if (intent.triggerPhrase?.toLowerCase().includes('summary')) {
    return 'Creating comprehensive summary...';
  }
  return 'Generating insights from your content...';
}

// Helper function for contextual loading messages
function getContextualLoadingMessage(contextualRequest: ContextualConversationRequest): string {
  const { pageContext, intent } = contextualRequest;
  const page = pageContext.page;

  // Base message from intent
  let baseMessage = getLoadingMessage(intent);

  // Enhance with page context
  switch (page) {
    case 'dashboard':
      if (intent.triggerPhrase?.toLowerCase().includes('pattern')) {
        return 'Analyzing patterns across your workspace...';
      }
      return 'Synthesizing insights from your dashboard...';
      
    case 'document':
      if (pageContext.userActivity.selectedText) {
        return 'Analyzing your selected text...';
      }
      if (pageContext.userActivity.recentEdits.length > 0) {
        return 'Reviewing your recent edits...';
      }
      return 'Analyzing your document content...';
      
    case 'timeline':
      return 'Examining patterns over time...';
      
    case 'detailed-view':
      return 'Performing deep substrate analysis...';
      
    default:
      return baseMessage;
  }
}