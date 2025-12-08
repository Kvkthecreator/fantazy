/**
 * Revelation Choreographer
 * Orchestrates the timing and presentation of AI insights
 */

import { useCallback, useEffect, useState } from 'react';

interface RevelationTiming {
  delay: number;
  strategy: 'immediate' | 'gentle_notification' | 'ambient_update' | 'wait';
  priority: 'high' | 'medium' | 'low';
}

interface InsightContext {
  confidence: number;
  relevance: number;
  urgency: number;
  type: 'insight' | 'connection' | 'suggestion' | 'progress';
}

const TIMING_STRATEGIES = {
  immediate: { baseDelay: 0, variance: 0 },
  gentle_notification: { baseDelay: 2000, variance: 1000 },
  ambient_update: { baseDelay: 5000, variance: 3000 },
  wait: { baseDelay: -1, variance: 0 } // -1 means don't reveal
} as const;

export function useRevelationTiming(userActivity: string) {
  const [queuedRevelations, setQueuedRevelations] = useState<Map<string, NodeJS.Timeout>>(new Map());

  const calculateTiming = useCallback((
    insight: InsightContext,
    activity: string
  ): number => {
    const strategy = determineRevealStrategy(insight, activity);
    
    if (strategy === 'wait') {
      return -1; // Don't reveal now
    }

    const timingConfig = TIMING_STRATEGIES[strategy];
    const variance = Math.random() * timingConfig.variance;
    
    return timingConfig.baseDelay + variance;
  }, []);

  const scheduleRevelation = useCallback((
    insightId: string,
    insight: InsightContext,
    activity: string,
    onReveal: () => void
  ): boolean => {
    const timing = calculateTiming(insight, activity);
    
    if (timing < 0) {
      return false; // Don't schedule
    }

    // Clear any existing timer for this insight
    const existingTimer = queuedRevelations.get(insightId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new revelation
    const timer = setTimeout(() => {
      onReveal();
      setQueuedRevelations(prev => {
        const newMap = new Map(prev);
        newMap.delete(insightId);
        return newMap;
      });
    }, timing);

    setQueuedRevelations(prev => new Map(prev).set(insightId, timer));
    
    return true;
  }, [queuedRevelations, calculateTiming]);

  const cancelRevelation = useCallback((insightId: string) => {
    const timer = queuedRevelations.get(insightId);
    if (timer) {
      clearTimeout(timer);
      setQueuedRevelations(prev => {
        const newMap = new Map(prev);
        newMap.delete(insightId);
        return newMap;
      });
    }
  }, [queuedRevelations]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      queuedRevelations.forEach(timer => clearTimeout(timer));
    };
  }, [queuedRevelations]);

  return {
    calculateTiming,
    scheduleRevelation,
    cancelRevelation,
    queuedCount: queuedRevelations.size
  };
}

function determineRevealStrategy(
  insight: InsightContext,
  activity: string
): keyof typeof TIMING_STRATEGIES {
  
  // High urgency always gets immediate attention
  if (insight.urgency > 0.9) {
    return 'immediate';
  }

  // Respect user activity patterns
  switch (activity) {
    case 'active_work':
      // Only urgent, high-confidence insights during active work
      if (insight.confidence > 0.9 && insight.urgency > 0.7) {
        return 'gentle_notification';
      }
      return 'wait';

    case 'exploring':
      // Moderate relevance insights work well during exploration
      if (insight.relevance > 0.7) {
        return 'gentle_notification';
      } else if (insight.relevance > 0.4) {
        return 'ambient_update';
      }
      return 'wait';

    case 'paused':
      // Good time for any meaningful insights
      if (insight.confidence > 0.6) {
        return 'immediate';
      } else if (insight.confidence > 0.4) {
        return 'gentle_notification';
      }
      return 'ambient_update';

    case 'idle':
      // Only ambient updates when user is away
      if (insight.confidence > 0.8) {
        return 'ambient_update';
      }
      return 'wait';

    default:
      return 'gentle_notification';
  }
}

// Natural timing patterns to avoid mechanical feel
export function addNaturalVariance(baseDelay: number, type: 'thinking' | 'discovering' | 'connecting'): number {
  const patterns = {
    thinking: { variance: 0.3, rhythm: 'steady' },
    discovering: { variance: 0.5, rhythm: 'burst' },
    connecting: { variance: 0.2, rhythm: 'gentle' }
  };

  const pattern = patterns[type];
  const variance = baseDelay * pattern.variance;
  
  // Add natural timing variation
  const naturalDelay = baseDelay + (Math.random() - 0.5) * variance;
  
  // Ensure minimum delay feels natural
  return Math.max(naturalDelay, 500);
}

// Context-aware revelation choreography
export function orchestrateRevelations(
  insights: InsightContext[],
  userActivity: string,
  currentFocus: string
): RevelationTiming[] {
  
  return insights
    .map(insight => ({
      insight,
      timing: calculateRevealTiming(insight, userActivity, currentFocus)
    }))
    .sort((a, b) => a.timing.delay - b.timing.delay)
    .map(({ timing }) => timing);
}

function calculateRevealTiming(
  insight: InsightContext,
  activity: string,
  focus: string
): RevelationTiming {
  
  const strategy = determineRevealStrategy(insight, activity);
  const baseDelay = TIMING_STRATEGIES[strategy].baseDelay;
  
  // Adjust timing based on current focus
  let delayMultiplier = 1;
  if (focus === 'writing' && insight.type === 'suggestion') {
    delayMultiplier = 0.5; // Faster suggestions during writing
  } else if (focus === 'exploration' && insight.type === 'connection') {
    delayMultiplier = 0.7; // Faster connections during exploration
  }

  const finalDelay = baseDelay === -1 ? -1 : baseDelay * delayMultiplier;
  
  return {
    delay: finalDelay,
    strategy,
    priority: insight.urgency > 0.8 ? 'high' : insight.urgency > 0.5 ? 'medium' : 'low'
  };
}

// Revelation flow state management
export class RevelationFlowManager {
  private static instance: RevelationFlowManager;
  private activeRevelations = new Set<string>();
  private revelationHistory = new Map<string, number>();
  
  static getInstance(): RevelationFlowManager {
    if (!RevelationFlowManager.instance) {
      RevelationFlowManager.instance = new RevelationFlowManager();
    }
    return RevelationFlowManager.instance;
  }

  canReveal(insightId: string, maxConcurrent: number = 2): boolean {
    // Limit concurrent revelations to avoid overwhelming
    if (this.activeRevelations.size >= maxConcurrent) {
      return false;
    }

    // Don't repeat revelations too frequently
    const lastRevealed = this.revelationHistory.get(insightId);
    if (lastRevealed && Date.now() - lastRevealed < 300000) { // 5 minutes
      return false;
    }

    return true;
  }

  startRevelation(insightId: string): void {
    this.activeRevelations.add(insightId);
    this.revelationHistory.set(insightId, Date.now());
  }

  completeRevelation(insightId: string): void {
    this.activeRevelations.delete(insightId);
  }

  getActiveCount(): number {
    return this.activeRevelations.size;
  }
}