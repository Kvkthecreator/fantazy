"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PageContext } from './pageContextDetection';
import type { SynthesisContext, CrossPageInsight } from './crossPageSynthesis';
import { performanceManager, useThrottledCallback, useDebouncedCallback } from './performanceOptimizations';

// Behavioral states and patterns
export type WritingFlow = 'active' | 'paused' | 'reviewing' | 'planning' | 'idle';
export type AssistanceType = 'proactive' | 'reactive' | 'minimal';
export type InteractionMoment = 'typing_pause' | 'section_complete' | 'extended_review' | 'page_switch' | 'optimal_break';

export interface TypingPattern {
  wpm: number;                    // Words per minute
  avgPauseDuration: number;       // Average pause between keystrokes
  pauseFrequency: number;         // Pauses per minute
  burstLength: number;           // Average typing burst length
  consistency: number;           // 0-1, consistency of typing rhythm
  flowState: WritingFlow;
  lastKeystroke: number;
  recentPauses: number[];
}

export interface BehavioralContext {
  writingFlow: WritingFlow;
  engagementLevel: number;        // 0-1 based on interaction history
  preferredAssistanceType: AssistanceType;
  optimalInteractionTiming: number; // milliseconds since last interaction
  confidenceInTiming: number;     // 0-1 confidence in timing prediction
  recentInteractions: InteractionEvent[];
  typingPattern: TypingPattern;
  attentionState: 'focused' | 'scattered' | 'transitioning';
}

export interface InteractionEvent {
  type: 'proactive_suggestion' | 'user_question' | 'modal_interaction' | 'page_switch';
  timestamp: number;
  userResponse: 'accepted' | 'dismissed' | 'ignored' | 'engaged';
  contextualRelevance: number;    // 0-1 how contextually relevant the interaction was
  timingScore: number;           // 0-1 how well-timed the interaction was
}

export interface BehaviorTrigger {
  id: string;
  type: InteractionMoment;
  condition: (context: BehavioralContext, pageContext: PageContext) => boolean;
  message: (context: BehavioralContext, pageContext: PageContext) => string;
  confidence: number;
  cooldownMs: number;
  lastTriggered?: number;
}

/**
 * Hook for analyzing user behavioral patterns and generating intelligent triggers
 */
export function useBehavioralTriggers(
  pageContext: PageContext,
  synthesisContext?: SynthesisContext
) {
  const [behavioralContext, setBehavioralContext] = useState<BehavioralContext>({
    writingFlow: 'idle',
    engagementLevel: 0.5,
    preferredAssistanceType: 'reactive',
    optimalInteractionTiming: 30000, // 30 seconds default
    confidenceInTiming: 0.3,
    recentInteractions: [],
    typingPattern: {
      wpm: 0,
      avgPauseDuration: 0,
      pauseFrequency: 0,
      burstLength: 0,
      consistency: 0,
      flowState: 'idle',
      lastKeystroke: 0,
      recentPauses: []
    },
    attentionState: 'focused'
  });

  const [activeTriggers, setActiveTriggers] = useState<BehaviorTrigger[]>([]);
  const typingBuffer = useRef<number[]>([]);
  const pauseBuffer = useRef<number[]>([]);
  const interactionHistory = useRef<InteractionEvent[]>([]);

  // Throttled behavioral context update for performance
  const throttledUpdateBehavior = useThrottledCallback(
    (updater: (context: BehavioralContext) => BehavioralContext) => {
      setBehavioralContext(updater);
    },
    500, // 500ms throttle
    []
  );

  // Debounced typing pattern analysis for performance
  const debouncedPatternAnalysis = useDebouncedCallback(
    (keystrokeTimestamp: number) => {
      performTypingAnalysis(keystrokeTimestamp);
    },
    300, // 300ms debounce
    []
  );

  // Analyze typing patterns in real-time with performance optimization
  const analyzeTypingPattern = useCallback((keystrokeTimestamp: number) => {
    // Use debounced analysis to avoid excessive computations
    debouncedPatternAnalysis(keystrokeTimestamp);
  }, [debouncedPatternAnalysis]);

  // Core typing analysis function
  const performTypingAnalysis = useCallback((keystrokeTimestamp: number) => {
    const now = keystrokeTimestamp;
    typingBuffer.current.push(now);
    
    // Keep only last 50 keystrokes for analysis
    if (typingBuffer.current.length > 50) {
      typingBuffer.current.shift();
    }

    if (typingBuffer.current.length < 5) return;

    const recentKeystrokes = typingBuffer.current;
    const intervals = recentKeystrokes.slice(1).map((time, i) => time - recentKeystrokes[i]);
    
    // Calculate typing metrics
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const wpm = intervals.length > 0 ? Math.round(60000 / (avgInterval * 5)) : 0; // Rough WPM estimate
    
    // Detect pauses (intervals > 2 seconds)
    const pauses = intervals.filter(interval => interval > 2000);
    const avgPauseDuration = pauses.length > 0 ? pauses.reduce((sum, pause) => sum + pause, 0) / pauses.length : 0;
    const pauseFrequency = (pauses.length / (intervals.length || 1)) * 60; // Pauses per minute
    
    // Calculate consistency (lower standard deviation = more consistent)
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const consistency = Math.max(0, 1 - (Math.sqrt(variance) / avgInterval));
    
    // Determine flow state
    let flowState: WritingFlow = 'idle';
    if (wpm > 30 && consistency > 0.6 && pauseFrequency < 10) {
      flowState = 'active';
    } else if (wpm < 10 && pauseFrequency > 20) {
      flowState = 'paused';
    } else if (wpm > 15 && pauseFrequency > 15) {
      flowState = 'reviewing';
    } else if (wpm < 20 && consistency < 0.4) {
      flowState = 'planning';
    }

    // Update behavioral context
    setBehavioralContext(prev => ({
      ...prev,
      typingPattern: {
        wpm,
        avgPauseDuration,
        pauseFrequency,
        burstLength: Math.round(60000 / avgInterval), // Characters per minute roughly
        consistency,
        flowState,
        lastKeystroke: now,
        recentPauses: pauses.slice(-10) // Keep last 10 pauses
      },
      writingFlow: flowState
    }));
  }, []);

  // Track interaction outcomes to learn user preferences
  const recordInteraction = useCallback((event: InteractionEvent) => {
    interactionHistory.current.push(event);
    
    // Keep only last 50 interactions
    if (interactionHistory.current.length > 50) {
      interactionHistory.current.shift();
    }

    // Analyze interaction patterns to update preferences
    const recentInteractions = interactionHistory.current.slice(-20);
    const acceptanceRate = recentInteractions.filter(e => e.userResponse === 'accepted').length / recentInteractions.length;
    const avgTimingScore = recentInteractions.reduce((sum, e) => sum + e.timingScore, 0) / recentInteractions.length;
    
    // Update behavioral context based on interaction patterns
    setBehavioralContext(prev => {
      let preferredAssistanceType: AssistanceType = 'reactive';
      
      if (acceptanceRate > 0.7 && avgTimingScore > 0.6) {
        preferredAssistanceType = 'proactive';
      } else if (acceptanceRate < 0.3 || avgTimingScore < 0.4) {
        preferredAssistanceType = 'minimal';
      }

      return {
        ...prev,
        engagementLevel: Math.min(1, Math.max(0, acceptanceRate)),
        preferredAssistanceType,
        confidenceInTiming: avgTimingScore,
        recentInteractions: recentInteractions,
        optimalInteractionTiming: calculateOptimalTiming(recentInteractions)
      };
    });
  }, []);

  // Monitor user activity to update engagement and attention
  useEffect(() => {
    const updateEngagement = () => {
      const { userActivity } = pageContext;
      const timeSinceLastAction = Date.now() - (userActivity.cursorPosition?.timestamp || 0);
      
      // Update attention state based on activity patterns
      let attentionState: 'focused' | 'scattered' | 'transitioning' = 'focused';
      
      if (userActivity.mouseMovements > 50 && userActivity.keystrokeCount < 10) {
        attentionState = 'scattered'; // Lots of mouse movement, little typing
      } else if (userActivity.scrollPosition !== 0 && timeSinceLastAction < 5000) {
        attentionState = 'transitioning'; // Recently scrolled or moved
      }

      setBehavioralContext(prev => ({
        ...prev,
        attentionState,
        engagementLevel: userActivity.isActivelyEngaged 
          ? Math.min(1, prev.engagementLevel + 0.1)
          : Math.max(0, prev.engagementLevel - 0.05)
      }));
    };

    const interval = setInterval(updateEngagement, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [pageContext]);

  // Monitor for typing events from page context
  useEffect(() => {
    if (pageContext.userActivity.lastAction === 'typing' && pageContext.userActivity.recentEdits.length > 0) {
      const lastEdit = pageContext.userActivity.recentEdits[pageContext.userActivity.recentEdits.length - 1];
      analyzeTypingPattern(lastEdit.timestamp);
    }
  }, [pageContext.userActivity.recentEdits, analyzeTypingPattern]);

  // Generate behavioral triggers
  const generateTriggers = useCallback((): BehaviorTrigger[] => {
    const triggers: BehaviorTrigger[] = [];
    const now = Date.now();

    // Typing pause trigger
    if (behavioralContext.writingFlow === 'paused' && 
        behavioralContext.preferredAssistanceType !== 'minimal') {
      triggers.push({
        id: 'typing_pause',
        type: 'typing_pause',
        condition: (ctx, pageCtx) => 
          !!(ctx.typingPattern.avgPauseDuration > 5000 && 
          pageCtx.userActivity.isActivelyEngaged &&
          pageCtx.page === 'document'),
        message: (ctx, pageCtx) => {
          const doc = pageCtx.content.currentDocument;
          if (pageCtx.userActivity.selectedText) {
            return "Sensing a pause here. This section connects well to your earlier work. Continue or explore the connection?";
          } else if (doc && doc.wordCount > 200) {
            return "I notice you're developing this section. The flow is strong - want help expanding the approach?";
          }
          return "Taking a moment to think? I can help with direction or connections if needed.";
        },
        confidence: behavioralContext.typingPattern.consistency > 0.5 ? 0.8 : 0.6,
        cooldownMs: 300000, // 5 minutes
      });
    }

    // Section completion trigger
    if (behavioralContext.writingFlow === 'reviewing' && 
        pageContext.userActivity.scrollPosition > 0) {
      triggers.push({
        id: 'section_complete',
        type: 'section_complete',  
        condition: (ctx, pageCtx) =>
          !!(pageCtx.userActivity.timeOnPage > 120000 && // > 2 minutes
          ctx.typingPattern.wpm < 15 &&
          pageCtx.page === 'document'),
        message: (ctx, pageCtx) => 
          "You're reviewing this section carefully. I see potential connections to strengthen based on your other work.",
        confidence: 0.7,
        cooldownMs: 600000, // 10 minutes
      });
    }

    // Cross-page synthesis trigger (enhanced with synthesis context)
    if (pageContext.page === 'dashboard' && 
        behavioralContext.engagementLevel > 0.6 &&
        pageContext.userActivity.timeOnPage > 90000) { // > 1.5 minutes
      
      const hasSynthesisOpportunity = synthesisContext?.activeInsights.some(
        insight => insight.type === 'strategic_synthesis' || insight.type === 'pattern_connection'
      );

      triggers.push({
        id: 'cross_page_synthesis',
        type: 'optimal_break',
        condition: (ctx, pageCtx) => 
          !!(ctx.preferredAssistanceType === 'proactive' &&
          ((pageCtx.content.basketOverview?.dominantThemes?.length || 0) > 1 || hasSynthesisOpportunity)),
        message: (ctx, pageCtx) => {
          if (hasSynthesisOpportunity) {
            const insight = synthesisContext?.activeInsights.find(
              i => i.type === 'strategic_synthesis' || i.type === 'pattern_connection'
            );
            return insight?.description || "Cross-page patterns detected. Ready to connect insights?";
          }
          const themes = pageCtx.content.basketOverview?.dominantThemes || [];
          return `I'm seeing strong patterns across your ${themes.join(' and ')} work. Ready to synthesize the connections?`;
        },
        confidence: hasSynthesisOpportunity ? 0.9 : behavioralContext.confidenceInTiming,
        cooldownMs: 900000, // 15 minutes
      });
    }

    // Memory-based workflow trigger
    if (synthesisContext?.workflowPatterns && behavioralContext.writingFlow === 'planning') {
      const relevantPattern = synthesisContext.workflowPatterns.find(
        pattern => pattern.sequence[0] === pageContext.page && pattern.successRate > 0.7
      );

      if (relevantPattern) {
        triggers.push({
          id: 'workflow_optimization',
          type: 'optimal_break',
          condition: (ctx, pageCtx) => 
            !!(ctx.preferredAssistanceType !== 'minimal' &&
            pageCtx.userActivity.timeOnPage > 120000), // > 2 minutes
          message: (ctx, pageCtx) => {
            const nextPage = relevantPattern.sequence[1];
            return `Based on your patterns, moving to ${nextPage} next has ${Math.round(relevantPattern.successRate * 100)}% success rate. Continue workflow?`;
          },
          confidence: 0.8,
          cooldownMs: 600000, // 10 minutes
        });
      }
    }

    // Content gap detection trigger
    const contentGapInsight = synthesisContext?.activeInsights.find(
      insight => insight.type === 'content_gap' && insight.involvedPages.includes(pageContext.page)
    );

    if (contentGapInsight && behavioralContext.writingFlow === 'reviewing') {
      triggers.push({
        id: 'content_gap_alert',
        type: 'extended_review',
        condition: (ctx, pageCtx) => 
          !!(ctx.preferredAssistanceType === 'proactive' &&
          pageCtx.userActivity.timeOnPage > 180000), // > 3 minutes
        message: () => contentGapInsight.actionableRecommendation || contentGapInsight.description,
        confidence: contentGapInsight.confidence,
        cooldownMs: 1200000, // 20 minutes
      });
    }

    // Filter triggers by cooldown and confidence
    return triggers.filter(trigger => {
      const timeSinceLastTrigger = trigger.lastTriggered ? now - trigger.lastTriggered : Infinity;
      return timeSinceLastTrigger > trigger.cooldownMs && 
             trigger.confidence > 0.5 &&
             trigger.condition(behavioralContext, pageContext);
    });
  }, [behavioralContext, pageContext]);

  // Update active triggers
  useEffect(() => {
    if (behavioralContext.preferredAssistanceType !== 'minimal') {
      const newTriggers = generateTriggers();
      setActiveTriggers(newTriggers);
    } else {
      setActiveTriggers([]);
    }
  }, [generateTriggers, behavioralContext.preferredAssistanceType]);

  // Trigger activation handler
  const activateTrigger = useCallback((triggerId: string) => {
    setActiveTriggers(prev => 
      prev.map(trigger => 
        trigger.id === triggerId 
          ? { ...trigger, lastTriggered: Date.now() }
          : trigger
      )
    );
  }, []);

  return {
    behavioralContext,
    activeTriggers,
    recordInteraction,
    activateTrigger,
    analyzeTypingPattern
  };
}

/**
 * Calculate optimal timing for interactions based on user history
 */
function calculateOptimalTiming(interactions: InteractionEvent[]): number {
  if (interactions.length < 3) return 30000; // Default 30 seconds

  // Find interactions with high timing scores
  const wellTimedInteractions = interactions.filter(i => i.timingScore > 0.6);
  
  if (wellTimedInteractions.length === 0) return 60000; // If no well-timed interactions, be more conservative

  // Look for patterns in timing of successful interactions
  const timingPatterns = wellTimedInteractions.map(interaction => {
    const previousInteraction = interactions.find(i => 
      i.timestamp < interaction.timestamp && 
      Math.abs(i.timestamp - interaction.timestamp) < 300000 // Within 5 minutes
    );
    
    return previousInteraction 
      ? interaction.timestamp - previousInteraction.timestamp 
      : 30000; // Default if no previous interaction
  });

  // Return average of successful timing patterns
  const avgTiming = timingPatterns.reduce((sum, timing) => sum + timing, 0) / timingPatterns.length;
  return Math.max(15000, Math.min(300000, avgTiming)); // Between 15 seconds and 5 minutes
}

/**
 * Generate contextual assistance message based on behavioral state
 */
export function generateBehavioralMessage(
  behavioralContext: BehavioralContext, 
  pageContext: PageContext,
  trigger: BehaviorTrigger
): string {
  const { writingFlow, typingPattern, attentionState } = behavioralContext;
  const { page, content, userActivity } = pageContext;

  // Base message from trigger
  let message = trigger.message(behavioralContext, pageContext);

  // Enhance based on attention state
  if (attentionState === 'scattered') {
    message = message.replace(/^/, "I notice you're exploring different areas. ");
  } else if (attentionState === 'focused' && writingFlow === 'active') {
    message = message.replace(/^/, "You're in a good flow - ");
  }

  return message;
}

/**
 * Determine if it's an optimal moment for proactive assistance
 */
export function isOptimalInteractionMoment(
  behavioralContext: BehavioralContext,
  pageContext: PageContext
): boolean {
  const { writingFlow, preferredAssistanceType, engagementLevel, confidenceInTiming } = behavioralContext;
  const { userActivity } = pageContext;

  // Never interrupt active flow
  if (writingFlow === 'active' && behavioralContext.typingPattern.consistency > 0.7) {
    return false;
  }

  // Respect user preference
  if (preferredAssistanceType === 'minimal') {
    return false;
  }

  // Must be confident in timing
  if (confidenceInTiming < 0.4) {
    return false;
  }

  // Must be engaged
  if (!userActivity.isActivelyEngaged || engagementLevel < 0.3) {
    return false;
  }

  // Good moments: natural pauses, section transitions, review states
  return writingFlow === 'paused' || 
         writingFlow === 'reviewing' ||
         writingFlow === 'planning';
}