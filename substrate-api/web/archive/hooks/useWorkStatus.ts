"use client";

import { useCallback, useEffect, useState } from "react";

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

interface CascadeFlowData {
  work_id: string;
  cascade_flow: {
    cascade_active: boolean;
    cascade_stage: string;
    work_type: string;
    processing_state: string;
    parent_work: any;
    children_work: any[];
    cascade_metadata: any;
    flow_completion: number;
    estimated_total_time: number;
  };
}

interface WorkspaceSummary {
  workspace_id: string;
  summary: {
    total_work_items: number;
    status_breakdown: Record<string, number>;
    active_cascade_flows: number;
    cascade_details: any[];
    timing_metrics: {
      avg_processing_time: number;
      oldest_pending_age: number;
      completed_count: number;
      pending_count: number;
    };
    last_activity?: string;
  };
}

export interface UseWorkStatusOptions {
  /** Poll interval in milliseconds */
  pollInterval?: number;
  /** Whether to automatically start polling */
  autoStart?: boolean;
}

/**
 * Hook for managing work status with automatic polling and caching
 * 
 * Provides Canon v2.1 compliant work status tracking with:
 * - Automatic polling for non-terminal states
 * - Cascade flow visualization data
 * - Substrate impact metrics
 * - Error handling with recovery actions
 */
export function useWorkStatus(workId: string, options: UseWorkStatusOptions = {}) {
  const { pollInterval = 2000, autoStart = true } = options;
  
  const [status, setStatus] = useState<WorkStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Fetch work status
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

  // Start polling
  const startPolling = useCallback(() => {
    setPolling(true);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    setPolling(false);
  }, []);

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

  // Set up polling effect
  useEffect(() => {
    if (!autoStart) return;

    let intervalId: NodeJS.Timeout | null = null;

    const poll = () => {
      fetchStatus().catch(() => {
        // Error handling is done in fetchStatus
      });
    };

    if (polling) {
      // Start with immediate fetch
      poll();
      
      // Only continue polling if work is not in terminal state
      if (status && !['completed', 'failed'].includes(status.status)) {
        intervalId = setInterval(poll, pollInterval);
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [workId, polling, pollInterval, status?.status, autoStart, fetchStatus]);

  // Auto-start polling on mount
  useEffect(() => {
    if (autoStart) {
      startPolling();
    }
  }, [autoStart, startPolling]);

  // Auto-stop polling for terminal states
  useEffect(() => {
    if (status && ['completed', 'failed'].includes(status.status)) {
      stopPolling();
    }
  }, [status?.status, stopPolling]);

  return {
    status,
    loading,
    error,
    polling,
    
    // Actions
    fetchStatus,
    startPolling,
    stopPolling,
    retryWork,
    
    // Computed values
    isTerminal: status ? ['completed', 'failed'].includes(status.status) : false,
    canRetry: status?.status === 'failed',
    hasError: !!status?.error,
  };
}

/**
 * Hook for fetching cascade flow details for a work item
 */
export function useCascadeFlow(workId: string) {
  const [cascadeFlow, setCascadeFlow] = useState<CascadeFlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCascadeFlow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/work/${workId}/cascade`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cascade flow: ${response.statusText}`);
      }

      const data: CascadeFlowData = await response.json();
      setCascadeFlow(data);
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workId]);

  return {
    cascadeFlow,
    loading,
    error,
    fetchCascadeFlow
  };
}

/**
 * Hook for fetching workspace work summary
 */
export function useWorkspaceSummary(workspaceId: string) {
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/work/workspace/${workspaceId}/summary`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workspace summary: ${response.statusText}`);
      }

      const data: WorkspaceSummary = await response.json();
      setSummary(data);
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  return {
    summary,
    loading,
    error,
    fetchSummary
  };
}
