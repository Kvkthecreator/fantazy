"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/clients";
import { useAuth } from "@/lib/useAuth";

interface WorkStatusData {
  work_id: string;
  work_type: string;
  status: string;
  processing_stage?: string;
  progress_percentage: number;
  basket_id?: string;
  workspace_id: string;
  user_id: string;
  started_at: string;
  last_activity: string;
  estimated_completion?: string;
  substrate_impact: {
    proposals_created: number;
    substrate_created: {
      blocks: number;
      context_items: number;
    };
    relationships_mapped: number;
    artifacts_generated: number;
  };
  cascade_flow: {
    active: boolean;
    current_stage?: string;
    completed_stages: string[];
    next_stage?: string;
  };
  error?: {
    code: string;
    message: string;
    recovery_actions: string[];
  };
}

export interface UseWorkStatusRealtimeOptions {
  /** Whether to use WebSocket for real-time updates */
  enableRealtime?: boolean;
  /** Fallback poll interval in milliseconds when WebSocket not available */
  pollInterval?: number;
  /** Whether to automatically start tracking */
  autoStart?: boolean;
}

/**
 * Real-time Work Status Hook - Canon v2.1 Compliant
 * 
 * Provides real-time work status tracking using Supabase WebSocket subscriptions
 * with intelligent fallback to polling. Optimized for minimal resource usage
 * with automatic connection management.
 * 
 * Real-time Features:
 * - Instant status updates via Supabase real-time subscriptions
 * - Cascade flow event notifications
 * - Timeline event integration for Canon compliance
 * - Automatic fallback to polling if WebSocket fails
 * - Smart connection management (no polling for terminal states)
 */
export function useWorkStatusRealtime(
  workId: string, 
  options: UseWorkStatusRealtimeOptions = {}
) {
  const { user } = useAuth();
  const { 
    enableRealtime = true, 
    pollInterval = 5000, 
    autoStart = true 
  } = options;

  const [status, setStatus] = useState<WorkStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');
  
  // Track if we should use real-time vs polling
  const [useRealtime, setUseRealtime] = useState(enableRealtime && !!user);

  // Fetch work status from API
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      if (!loading) setLoading(true);

      const response = await fetch(`/api/work/status/${workId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Work not found');
        } else if (response.status === 403) {
          throw new Error('Access denied');
        } else {
          throw new Error(`Failed to fetch status: ${response.statusText}`);
        }
      }

      const data: WorkStatusData = await response.json();
      setStatus(data);
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workId, loading]);

  // Set up real-time subscription
  useEffect(() => {
    if (!useRealtime || !autoStart || !user) return;

    const supabase = createBrowserClient();
    let channel: any = null;

    const setupRealtimeSubscription = async () => {
      try {
        setConnectionStatus('connecting');
        
        // Subscribe to agent_processing_queue changes for this work_id
        channel = supabase
          .channel(`work-${workId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'agent_processing_queue',
              filter: `work_id=eq.${workId}`
            },
            (payload) => {
              // Handle work status updates
              fetchStatus().catch(() => {
                // If fetch fails, the error is handled in fetchStatus
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'timeline_events',
              filter: `kind=eq.work_completed`
            },
            (payload) => {
              // Handle timeline events that might affect this work
              const eventPayload = payload.new as any;
              if (eventPayload.metadata?.work_id === workId) {
                fetchStatus().catch(() => {
                  // Error handled in fetchStatus
                });
              }
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              setConnectionStatus('connected');
            } else if (status === 'CHANNEL_ERROR' || err) {
              setConnectionStatus('error');
              // Fallback to polling on WebSocket error
              setUseRealtime(false);
            }
          });

        // Initial fetch
        await fetchStatus();
        
      } catch (err) {
        setConnectionStatus('error');
        setUseRealtime(false);
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      setConnectionStatus('disconnected');
    };
  }, [workId, useRealtime, autoStart, fetchStatus]);

  // Set up polling fallback
  useEffect(() => {
    if (useRealtime || !autoStart) return;

    let intervalId: NodeJS.Timeout | null = null;

    const poll = () => {
      fetchStatus().catch(() => {
        // Error handling is done in fetchStatus
      });
    };

    // Start with immediate fetch
    poll();
    
    // Only continue polling if work is not in terminal state
    if (status && !['completed', 'failed'].includes(status.status)) {
      intervalId = setInterval(poll, pollInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [useRealtime, workId, pollInterval, status?.status, autoStart, fetchStatus]);

  // Retry failed work
  const retryWork = useCallback(async () => {
    try {
      const response = await fetch(`/api/work/${workId}/retry`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to retry work: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Refetch status after retry
      await fetchStatus();
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, [workId, fetchStatus]);

  // Force refresh
  const refresh = useCallback(() => {
    return fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    connectionStatus,
    
    // Actions
    fetchStatus,
    refresh,
    retryWork,
    
    // Computed values
    isTerminal: status ? ['completed', 'failed'].includes(status.status) : false,
    canRetry: status?.status === 'failed',
    hasError: !!status?.error,
    isConnected: connectionStatus === 'connected',
    isUsingRealtime: useRealtime && connectionStatus === 'connected',
  };
}

/**
 * Real-time Work Queue Monitor Hook
 * 
 * Monitors work queue changes in real-time for a workspace.
 * Useful for dashboard views showing overall work activity.
 */
export function useWorkQueueRealtime(workspaceId: string) {
  const realtimeEnabled = process.env.NEXT_PUBLIC_ENABLE_WORK_STATUS_REALTIME === 'true';
  const [queueStats, setQueueStats] = useState<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cascading: number;
  } | null>(null);
  const [recentActivity, setRecentActivity] = useState<Array<{
    work_id: string;
    work_type: string;
    status: string;
    timestamp: string;
  }>>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');

  const fetchQueueStats = useCallback(async () => {
    try {
      if (!workspaceId) return;
      const response = await fetch(`/api/work/workspace/${workspaceId}/summary`);
      if (response.ok) {
        const data = await response.json();
        setQueueStats(data.summary.status_breakdown);
      }
    } catch (err) {
      // Silent fail for stats
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !realtimeEnabled) {
      setConnectionStatus('disconnected');
      return;
    }
    const supabase = createBrowserClient();
    let channel: any = null;

    const setupSubscription = async () => {
      setConnectionStatus('connecting');
      
      // Subscribe to all work changes in this workspace
      channel = supabase
        .channel(`workspace-queue-${workspaceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'agent_processing_queue',
            filter: `workspace_id=eq.${workspaceId}`
          },
          (payload) => {
            const workData = payload.new || payload.old;
            
            // Type guard to ensure workData has required properties
            if (workData && typeof workData === 'object' && 
                'work_id' in workData && 'work_type' in workData && 'processing_state' in workData) {
              // Update recent activity
              setRecentActivity(prev => [
                {
                  work_id: workData.work_id as string,
                  work_type: workData.work_type as string,
                  status: workData.processing_state as string,
                  timestamp: new Date().toISOString()
                },
                ...prev.slice(0, 9) // Keep last 10 activities
              ]);
            }
            
            // Refresh stats
            fetchQueueStats();
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
          } else if (status === 'CHANNEL_ERROR' || err) {
            setConnectionStatus('error');
          }
        });

      // Initial fetch
      await fetchQueueStats();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      setConnectionStatus('disconnected');
    };
  }, [workspaceId, fetchQueueStats, realtimeEnabled]);

  return {
    queueStats,
    recentActivity,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    refresh: fetchQueueStats
  };
}
