/**
 * Unified basket events hook with single timer and cursor-based pagination
 * Replaces all scattered polling with one centralized event stream
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/http';
import { EventsPageSchema, type EventsPage } from '@/lib/api/contracts';
import { invalidateBasketScopes } from '@/lib/query/invalidate';
import { dlog } from '@/lib/dev/log';

interface EventCursor {
  created_at: string;
  id: string;
}

interface BasketEventsState {
  lastEvent: { type: string; payload: any } | null;
  status: 'connecting' | 'connected' | 'error';
  cursor: EventCursor | null;
}

// Global registry to prevent duplicate timers per basket
const activeBasketPollers = new Map<string, { count: number; cleanup: () => void }>();

/**
 * Single event stream for a basket with unified invalidation
 */
export function useBasketEvents(basketId: string, pollInterval = 12000) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<BasketEventsState>({
    lastEvent: null,
    status: 'connecting',
    cursor: null,
  });
  
  const stateRef = useRef(state);
  stateRef.current = state;
  
  // StrictMode protection - track if this hook instance has already set up polling
  const hasSetupPolling = useRef(false);

  // Emit invalidation for specific scopes
  const emitInvalidate = useCallback((
    targetBasketId: string, 
    scopes: Array<'basket' | 'blocks' | 'documents' | 'deltas'>
  ) => {
    dlog('events/invalidate', { targetBasketId, scopes });
    invalidateBasketScopes(queryClient, targetBasketId, scopes);
  }, [queryClient]);

  useEffect(() => {
    if (!basketId) {
      setState(prev => ({ ...prev, status: 'error' }));
      return;
    }
    
    // StrictMode protection - prevent double setup
    if (hasSetupPolling.current) {
      dlog('events/strictmode-skip', { basketId, reason: 'already-setup' });
      return;
    }
    
    hasSetupPolling.current = true;

    // Check if we already have a poller for this basket
    const existing = activeBasketPollers.get(basketId);
    if (existing) {
      existing.count++;
      dlog('events/reuse', { basketId, count: existing.count });
      
      // Cleanup function for this hook instance
      return () => {
        const current = activeBasketPollers.get(basketId);
        if (current) {
          current.count--;
          if (current.count <= 0) {
            current.cleanup();
            activeBasketPollers.delete(basketId);
            dlog('events/stop', { basketId, stoppedAt: Date.now() });
          }
        }
      };
    }

    // Create new poller for this basket
    dlog('events/start', { basketId, pollInterval, startedAt: Date.now() });

    let isActive = true;
    
    const pollEvents = async () => {
      if (!isActive) return;
      
      try {
        const params = new URLSearchParams();
        params.set('basket_id', basketId);
        params.set('limit', '10');
        
        // Use cursor for pagination
        const currentCursor = stateRef.current.cursor;
        if (currentCursor) {
          params.set('after_created_at', currentCursor.created_at);
          params.set('after_id', currentCursor.id);
        }

        const response = await apiClient({
          url: `/api/baskets/${basketId}/events?${params}`,
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (!isActive) return;

        const eventsPage = EventsPageSchema.parse(response);
        
        // Update connection status
        setState(prev => {
          if (prev.status !== 'connected') {
            dlog('events/connected', { basketId });
            return { ...prev, status: 'connected' };
          }
          return prev;
        });

        // Process new events
        if (eventsPage.events.length > 0) {
          const latestEvent = eventsPage.events[0];
          
          setState(prev => ({
            ...prev,
            lastEvent: {
              type: latestEvent.event_type,
              payload: latestEvent.event_data,
            },
            cursor: eventsPage.last_cursor,
          }));

          // Fan out invalidations based on event type
          const scopes: Array<'basket' | 'blocks' | 'documents' | 'deltas'> = [];
          
          switch (latestEvent.event_type) {
            case 'block_accepted':
            case 'block_rejected':
            case 'block_created':
              scopes.push('blocks', 'basket');
              break;
            case 'document_created':
            case 'document_updated':
              scopes.push('documents', 'basket');
              break;
            case 'delta_applied':
            case 'delta_created':
              scopes.push('deltas', 'basket');
              break;
            case 'basket_updated':
              scopes.push('basket');
              break;
            default:
              // Generic invalidation for unknown events
              scopes.push('basket', 'blocks', 'documents', 'deltas');
          }

          emitInvalidate(basketId, scopes);

          dlog('events/new', {
            basketId,
            type: latestEvent.event_type,
            scopes,
          });
        } else if (eventsPage.last_cursor) {
          // Update cursor even if no new events
          setState(prev => ({ ...prev, cursor: eventsPage.last_cursor }));
        }

      } catch (error) {
        if (!isActive) return;
        
        dlog('events/error', { basketId, error });
        setState(prev => ({ ...prev, status: 'error' }));
      }
    };

    // Initial poll
    pollEvents();

    // Set up interval
    const intervalId = setInterval(pollEvents, pollInterval);
    
    // Track global interval count
    if (typeof window !== 'undefined') {
      // @ts-expect-error
      window.__basketIntervals = (window.__basketIntervals || 0) + 1;
    }

    // Register this poller
    const cleanup = () => {
      isActive = false;
      clearInterval(intervalId);
      
      // Decrement global interval count
      if (typeof window !== 'undefined') {
        // @ts-expect-error
        window.__basketIntervals = Math.max(0, (window.__basketIntervals || 1) - 1);
      }
    };

    activeBasketPollers.set(basketId, { count: 1, cleanup });

    // Cleanup function for this hook instance
    return () => {
      const current = activeBasketPollers.get(basketId);
      if (current) {
        current.count--;
        if (current.count <= 0) {
          current.cleanup();
          activeBasketPollers.delete(basketId);
          dlog('events/stop', { basketId, stoppedAt: Date.now() });
        }
      }
    };

  }, [basketId, pollInterval, emitInvalidate]);

  return {
    lastEvent: state.lastEvent,
    status: state.status,
    emitInvalidate,
    // Debug info
    _debug: {
      basketId,
      pollInterval,
      cursor: state.cursor,
      activePollers: activeBasketPollers.size,
    },
  };
}