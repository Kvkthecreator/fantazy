/**
 * Smart Polling Hook - Optimizes polling behavior
 * 
 * Features:
 * - Pauses polling when tab is inactive (Page Visibility API)
 * - Reduces polling frequency when user is idle
 * - Immediate refresh when user returns to tab
 * - Configurable intervals for active/inactive states
 */

import { useState, useEffect, useRef } from 'react';

interface UseSmartPollingOptions {
  /** Polling interval when tab is active (ms) */
  activeInterval: number;
  /** Polling interval when tab is inactive (ms) - set to 0 to pause completely */
  inactiveInterval?: number;
  /** Enable immediate refresh when tab becomes active */
  refreshOnFocus?: boolean;
  /** Enable immediate refresh when window regains focus */
  refreshOnWindowFocus?: boolean;
}

export function useSmartPolling(options: UseSmartPollingOptions) {
  const {
    activeInterval,
    inactiveInterval = 0, // Pause by default when inactive
    refreshOnFocus = true,
    refreshOnWindowFocus = true,
  } = options;

  const [isTabActive, setIsTabActive] = useState(true);
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const lastActiveTime = useRef(Date.now());

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isActive = !document.hidden;
      setIsTabActive(isActive);
      
      if (isActive) {
        lastActiveTime.current = Date.now();
        if (refreshOnFocus) {
          setShouldRefresh(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle window focus events
    const handleWindowFocus = () => {
      if (refreshOnWindowFocus) {
        setShouldRefresh(true);
      }
    };

    const handleWindowBlur = () => {
      // Optional: Could reduce interval further when window loses focus
    };

    if (refreshOnWindowFocus) {
      window.addEventListener('focus', handleWindowFocus);
      window.addEventListener('blur', handleWindowBlur);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshOnWindowFocus) {
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('blur', handleWindowBlur);
      }
    };
  }, [refreshOnFocus, refreshOnWindowFocus]);

  // Calculate current polling interval
  const getCurrentInterval = () => {
    if (!isTabActive) {
      return inactiveInterval;
    }
    return activeInterval;
  };

  // For SWR integration
  const swrConfig = {
    refreshInterval: getCurrentInterval(),
    revalidateOnFocus: refreshOnFocus,
    revalidateOnReconnect: true,
    shouldRetryOnError: true,
  };

  // Trigger refresh mechanism
  const triggerRefresh = () => setShouldRefresh(true);
  const clearRefresh = () => setShouldRefresh(false);

  return {
    isTabActive,
    currentInterval: getCurrentInterval(),
    shouldRefresh,
    triggerRefresh,
    clearRefresh,
    swrConfig,
    isInactive: !isTabActive,
    // Debugging info
    _debug: {
      activeInterval,
      inactiveInterval,
      currentInterval: getCurrentInterval(),
      lastActiveTime: lastActiveTime.current,
      timeSinceActive: Date.now() - lastActiveTime.current,
    },
  };
}