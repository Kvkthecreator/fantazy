/**
 * Activity Detection System
 * Monitors user activity patterns to inform revelation timing
 */

import { useState, useEffect, useCallback } from 'react';

type UserActivity = 'active_work' | 'exploring' | 'paused' | 'idle';

interface ActivityState {
  current: UserActivity;
  lastInteraction: number;
  interactionCount: number;
  scrollVelocity: number;
  focusedElement: string | null;
}

const ACTIVITY_THRESHOLDS = {
  IDLE_TIMEOUT: 60000,        // 1 minute of no activity = idle
  PAUSE_TIMEOUT: 10000,       // 10 seconds of no activity = paused
  ACTIVE_THRESHOLD: 3000,     // 3 seconds between actions = active work
  SCROLL_VELOCITY_HIGH: 50,   // px/s - fast scrolling = exploring
  INTERACTION_BURST: 5        // 5+ interactions in 10s = active work
};

export function useActivityDetection(): UserActivity {
  const [activityState, setActivityState] = useState<ActivityState>({
    current: 'exploring',
    lastInteraction: Date.now(),
    interactionCount: 0,
    scrollVelocity: 0,
    focusedElement: null
  });

  // Track mouse movement
  const handleMouseMove = useCallback(() => {
    const now = Date.now();
    const timeSinceLastInteraction = now - activityState.lastInteraction;

    setActivityState(prev => ({
      ...prev,
      lastInteraction: now,
      interactionCount: timeSinceLastInteraction < 10000 ? prev.interactionCount + 1 : 1
    }));
  }, [activityState.lastInteraction]);

  // Track keyboard activity
  const handleKeyPress = useCallback(() => {
    const now = Date.now();
    const focusedElement = document.activeElement?.tagName || null;

    setActivityState(prev => ({
      ...prev,
      lastInteraction: now,
      interactionCount: prev.interactionCount + 1,
      focusedElement,
      current: focusedElement === 'TEXTAREA' || focusedElement === 'INPUT' ? 'active_work' : prev.current
    }));
  }, []);

  // Track scroll behavior
  const handleScroll = useCallback(() => {
    const now = Date.now();
    const scrollY = window.scrollY;

    setActivityState(prev => {
      const timeDelta = now - prev.lastInteraction;
      const scrollDelta = Math.abs(scrollY - (window as any).lastScrollY || 0);
      const velocity = timeDelta > 0 ? (scrollDelta / timeDelta) * 1000 : 0;

      (window as any).lastScrollY = scrollY;

      return {
        ...prev,
        lastInteraction: now,
        scrollVelocity: velocity,
        current: velocity > ACTIVITY_THRESHOLDS.SCROLL_VELOCITY_HIGH ? 'exploring' : prev.current
      };
    });
  }, []);

  // Track click events
  const handleClick = useCallback(() => {
    setActivityState(prev => ({
      ...prev,
      lastInteraction: Date.now(),
      interactionCount: prev.interactionCount + 1
    }));
  }, []);

  // Determine activity state based on patterns
  useEffect(() => {
    const determineActivity = () => {
      const now = Date.now();
      const timeSinceLastInteraction = now - activityState.lastInteraction;

      let newActivity: UserActivity = activityState.current;

      // Check for idle state
      if (timeSinceLastInteraction > ACTIVITY_THRESHOLDS.IDLE_TIMEOUT) {
        newActivity = 'idle';
      }
      // Check for paused state
      else if (timeSinceLastInteraction > ACTIVITY_THRESHOLDS.PAUSE_TIMEOUT) {
        newActivity = 'paused';
      }
      // Check for active work (focused input or high interaction rate)
      else if (
        activityState.focusedElement === 'TEXTAREA' ||
        activityState.focusedElement === 'INPUT' ||
        activityState.interactionCount > ACTIVITY_THRESHOLDS.INTERACTION_BURST
      ) {
        newActivity = 'active_work';
      }
      // Check for exploring (scrolling or moderate interaction)
      else if (
        activityState.scrollVelocity > 0 ||
        activityState.interactionCount > 0
      ) {
        newActivity = 'exploring';
      }

      if (newActivity !== activityState.current) {
        setActivityState(prev => ({ ...prev, current: newActivity }));
      }
    };

    const interval = setInterval(determineActivity, 1000);
    return () => clearInterval(interval);
  }, [activityState]);

  // Set up event listeners
  useEffect(() => {
    // Throttle event handlers for performance
    let mouseMoveTimeout: NodeJS.Timeout;
    let scrollTimeout: NodeJS.Timeout;

    const throttledMouseMove = () => {
      clearTimeout(mouseMoveTimeout);
      mouseMoveTimeout = setTimeout(handleMouseMove, 100);
    };

    const throttledScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 50);
    };

    window.addEventListener('mousemove', throttledMouseMove);
    window.addEventListener('keypress', handleKeyPress);
    window.addEventListener('scroll', throttledScroll);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('mousemove', throttledMouseMove);
      window.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('scroll', throttledScroll);
      window.removeEventListener('click', handleClick);
      clearTimeout(mouseMoveTimeout);
      clearTimeout(scrollTimeout);
    };
  }, [handleMouseMove, handleKeyPress, handleScroll, handleClick]);

  return activityState.current;
}

// Helper to get activity description
export function getActivityDescription(activity: UserActivity): string {
  switch (activity) {
    case 'active_work':
      return 'Actively working - minimal interruptions';
    case 'exploring':
      return 'Exploring content - open to discoveries';
    case 'paused':
      return 'Taking a break - good time for insights';
    case 'idle':
      return 'Away from screen - ambient updates only';
    default:
      return 'Unknown activity state';
  }
}

// Helper to determine if it's a good time for notifications
export function isGoodTimeForNotification(activity: UserActivity, priority: 'high' | 'medium' | 'low'): boolean {
  switch (activity) {
    case 'active_work':
      return priority === 'high';
    case 'exploring':
      return priority !== 'low';
    case 'paused':
      return true;
    case 'idle':
      return priority === 'high';
    default:
      return false;
  }
}