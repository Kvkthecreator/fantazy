/**
 * React Hook for Consumer Memory Adapter
 * Canon v1.4.0 Compliant - Pure transformation layer access
 * 
 * Provides React components with adapter-mediated canonical data
 * - All data comes from agent processing via adapter transformation
 * - No client-side intelligence generation
 * - Workspace-scoped access only
 * - Sacred Write Paths enforced
 */

'use client';

import { useMemo, useState, useCallback } from 'react';
import { ConsumerMemoryAdapter, type ConsumerInsight, type ConsumerEvent, type ConsumerMemory } from '../ConsumerMemoryAdapter';
import { useAuth } from '@/lib/useAuth';
import { useWorkspace } from '@/lib/hooks/useWorkspace';

/**
 * Consumer adapter hook state
 */
interface ConsumerAdapterState {
  loading: boolean;
  error: string | null;
  insights: ConsumerInsight[];
  timeline: ConsumerEvent[];
  memories: ConsumerMemory[];
}

/**
 * Consumer adapter hook for React components
 * Canon Compliance: Adapter-mediated canonical data access only
 */
export function useConsumerAdapter(basketId?: string) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  
  const [state, setState] = useState<ConsumerAdapterState>({
    loading: false,
    error: null,
    insights: [],
    timeline: [],
    memories: []
  });

  // Canon Compliant: Create workspace-scoped adapter instance
  const adapter = useMemo(() => {
    if (!workspace?.id || !user?.id) return null;
    
    return new ConsumerMemoryAdapter(workspace.id, user.id);
  }, [workspace?.id, user?.id]);

  /**
   * Load personal insights from P3 Agent via adapter
   * Canon Compliance: All insights from agent processing, adapter transforms for presentation
   */
  const loadInsights = useCallback(async () => {
    if (!adapter) return;

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const insights = await adapter.getPersonalInsights();
      setState(prev => ({ 
        ...prev, 
        insights, 
        loading: false 
      }));
    } catch (error) {
      const presentationError = adapter.handleError(error as any);
      setState(prev => ({
        ...prev,
        error: presentationError.user_friendly_message,
        loading: false
      }));
    }
  }, [adapter]);

  /**
   * Load personal timeline from canonical events via adapter
   * Canon Compliance: All timeline data from agent processing, adapter transforms
   */
  const loadTimeline = useCallback(async (targetBasketId?: string) => {
    if (!adapter) return;
    const useBasketId = targetBasketId || basketId;
    if (!useBasketId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const timeline = await adapter.getPersonalTimeline(useBasketId);
      setState(prev => ({ 
        ...prev, 
        timeline, 
        loading: false 
      }));
    } catch (error) {
      const presentationError = adapter.handleError(error as any);
      setState(prev => ({
        ...prev,
        error: presentationError.user_friendly_message,
        loading: false
      }));
    }
  }, [adapter, basketId]);

  /**
   * Load memory projection via adapter
   * Canon Compliance: All memory data from canonical projection, adapter transforms
   */
  const loadMemories = useCallback(async (targetBasketId?: string) => {
    if (!adapter) return;
    const useBasketId = targetBasketId || basketId;
    if (!useBasketId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const projection = await adapter.getProjection(useBasketId);
      const memories = adapter.transformAll(projection);
      setState(prev => ({ 
        ...prev, 
        memories, 
        loading: false 
      }));
    } catch (error) {
      const presentationError = adapter.handleError(error as any);
      setState(prev => ({
        ...prev,
        error: presentationError.user_friendly_message,
        loading: false
      }));
    }
  }, [adapter, basketId]);

  /**
   * Capture personal thought using Sacred Write Path
   * Canon Compliance: Uses /api/dumps/new only, agent processing happens async
   */
  const captureThought = useCallback(async (thought: string) => {
    if (!adapter) throw new Error('Adapter not initialized');

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await adapter.capturePersonalThought(thought);
      setState(prev => ({ ...prev, loading: false }));
      
      // Refresh timeline to show new capture event
      if (basketId) {
        await loadTimeline(basketId);
      }
      
      return result;
    } catch (error) {
      const presentationError = adapter.handleError(error as any);
      setState(prev => ({
        ...prev,
        error: presentationError.user_friendly_message,
        loading: false
      }));
      throw presentationError;
    }
  }, [adapter, basketId, loadTimeline]);

  /**
   * Refresh all adapter data
   */
  const refreshAll = useCallback(async () => {
    if (!basketId) return;
    
    await Promise.all([
      loadInsights(),
      loadTimeline(basketId),
      loadMemories(basketId)
    ]);
  }, [basketId, loadInsights, loadTimeline, loadMemories]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    loading: state.loading,
    error: state.error,
    insights: state.insights,
    timeline: state.timeline,
    memories: state.memories,
    
    // Actions - Canon compliant adapter-mediated operations
    loadInsights,
    loadTimeline,
    loadMemories,
    captureThought,
    refreshAll,
    clearError,
    
    // Adapter instance (for advanced usage)
    adapter,
    
    // Helper flags
    isReady: !!adapter,
    hasBasket: !!basketId
  };
}