"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PageContext } from './pageContextDetection';
import type { ConversationThread } from './conversationThreading';
import type { BehavioralContext } from './behavioralTriggers';
import type { SynthesisContext } from './crossPageSynthesis';

// Cross-page experience types
export interface CrossPageExperience {
  conversationContinuity: {
    activeThread?: ConversationThread;
    contextTransition: PageTransitionContext;
    conversationBridge: string; // "Continuing from dashboard analysis..."
    threadHistory: ConversationThread[];
  };
  visualContinuity: {
    companionState: 'collapsed' | 'ambient' | 'expanded' | 'minimized';
    positionMemory: CompanionPosition;
    animationTransition: TransitionType;
    expandedContentHeight?: number;
  };
  behavioralContinuity: {
    engagementFlow: EngagementTransition;
    workflowContext: WorkflowContinuation;
    adaptationState: AdaptationMemory;
  };
}

export interface PageTransitionContext {
  from: string;
  to: string;
  timestamp: number;
  reason: 'navigation' | 'link_click' | 'browser_action' | 'programmatic';
  preserveContext: boolean;
  transitionIntent?: 'workflow_continuation' | 'context_switch' | 'exploration';
}

export interface CompanionPosition {
  x: number;
  y: number;
  page: string;
  timestamp: number;
  userPositioned: boolean; // true if user manually positioned
  adaptiveReason?: string; // reason for automatic positioning
}

export type TransitionType = 'fade' | 'slide' | 'morph' | 'instant' | 'context_bridge';

export interface EngagementTransition {
  previousEngagement: number;
  currentEngagement: number;
  flowMaintained: boolean;
  interruptionRisk: number; // 0-1, risk of interrupting user flow
  optimalTransitionTiming: number;
}

export interface WorkflowContinuation {
  workflowPhase: 'discovery' | 'analysis' | 'synthesis' | 'creation' | 'review';
  expectedNextPage: string[];
  workflowProgress: number; // 0-1
  contextualGoal?: string;
  anticipatedActions: string[];
}

export interface AdaptationMemory {
  learningContinuity: Map<string, any>; // Behavioral learning state
  preferencePersistence: UserPreferenceSnapshot;
  contextualAdaptations: ContextualAdaptation[];
  crossPageInsights: CrossPageInsightMemory[];
}

export interface UserPreferenceSnapshot {
  assistanceLevel: 'minimal' | 'moderate' | 'proactive';
  preferredInteractionStyle: 'ambient' | 'modal' | 'hybrid';
  optimizedForWorkflow: string[];
  adaptationConfidence: number;
}

export interface ContextualAdaptation {
  pageType: string;
  adaptation: any;
  confidence: number;
  lastUsed: number;
  effectiveness: number; // 0-1 based on user feedback
}

export interface CrossPageInsightMemory {
  insight: any;
  relevantPages: string[];
  strength: number;
  lastAccessed: number;
  userEngagement: number;
}

/**
 * Cross-page experience manager for unified ambient companion
 */
export class CrossPageExperienceManager {
  private experience: CrossPageExperience;
  private transitionCallbacks: Map<string, Function[]> = new Map();
  private persistenceTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.experience = this.initializeExperience();
    this.loadPersistedState();
  }

  private initializeExperience(): CrossPageExperience {
    return {
      conversationContinuity: {
        contextTransition: {
          from: 'unknown',
          to: 'unknown',
          timestamp: Date.now(),
          reason: 'programmatic',
          preserveContext: true
        },
        conversationBridge: '',
        threadHistory: []
      },
      visualContinuity: {
        companionState: 'collapsed',
        positionMemory: {
          x: 0,
          y: 0,
          page: 'unknown',
          timestamp: Date.now(),
          userPositioned: false
        },
        animationTransition: 'fade'
      },
      behavioralContinuity: {
        engagementFlow: {
          previousEngagement: 0,
          currentEngagement: 0,
          flowMaintained: false,
          interruptionRisk: 0,
          optimalTransitionTiming: 0
        },
        workflowContext: {
          workflowPhase: 'discovery',
          expectedNextPage: [],
          workflowProgress: 0,
          anticipatedActions: []
        },
        adaptationState: {
          learningContinuity: new Map(),
          preferencePersistence: {
            assistanceLevel: 'moderate',
            preferredInteractionStyle: 'hybrid',
            optimizedForWorkflow: [],
            adaptationConfidence: 0.5
          },
          contextualAdaptations: [],
          crossPageInsights: []
        }
      }
    };
  }

  /**
   * Handle page transition with context preservation
   */
  transitionToPage(
    fromPage: string,
    toPage: string,
    context: {
      reason?: PageTransitionContext['reason'];
      preserveContext?: boolean;
      activeThread?: ConversationThread;
      behavioralContext?: BehavioralContext;
      synthesisContext?: SynthesisContext;
    } = {}
  ): {
    transitionConfig: PageTransitionConfig;
    conversationBridge: string;
    visualTransition: VisualTransitionConfig;
  } {
    const transition: PageTransitionContext = {
      from: fromPage,
      to: toPage,
      timestamp: Date.now(),
      reason: context.reason || 'navigation',
      preserveContext: context.preserveContext !== false,
      transitionIntent: this.detectTransitionIntent(fromPage, toPage, context.activeThread)
    };

    // Update experience state
    this.experience.conversationContinuity.contextTransition = transition;

    // Generate conversation bridge
    const conversationBridge = this.generateConversationBridge(transition, context.activeThread);
    this.experience.conversationContinuity.conversationBridge = conversationBridge;

    // Calculate optimal transition timing
    const engagementTransition = this.calculateEngagementTransition(
      context.behavioralContext,
      transition
    );
    this.experience.behavioralContinuity.engagementFlow = engagementTransition;

    // Determine visual transition
    const visualTransition = this.planVisualTransition(transition, engagementTransition);

    // Persist state
    this.persistState();

    // Emit transition event
    this.emitTransition('page_transition', {
      transition,
      conversationBridge,
      visualTransition,
      engagementTransition
    });

    return {
      transitionConfig: {
        preserveContext: transition.preserveContext,
        timing: engagementTransition.optimalTransitionTiming,
        priority: this.calculateTransitionPriority(transition, context.activeThread)
      },
      conversationBridge,
      visualTransition
    };
  }

  /**
   * Update companion position with memory
   */
  updateCompanionPosition(
    position: { x: number; y: number },
    page: string,
    userPositioned: boolean = false,
    reason?: string
  ) {
    this.experience.visualContinuity.positionMemory = {
      x: position.x,
      y: position.y,
      page,
      timestamp: Date.now(),
      userPositioned,
      adaptiveReason: reason
    };

    this.persistState();
  }

  /**
   * Update companion state with continuity
   */
  updateCompanionState(
    state: CrossPageExperience['visualContinuity']['companionState'],
    expandedHeight?: number
  ) {
    this.experience.visualContinuity.companionState = state;
    if (expandedHeight) {
      this.experience.visualContinuity.expandedContentHeight = expandedHeight;
    }

    this.persistState();
  }

  /**
   * Get optimal position for current page
   */
  getOptimalPosition(
    pageContext: PageContext,
    windowDimensions: { width: number; height: number }
  ): CompanionPosition {
    const { width, height } = windowDimensions;
    const lastPosition = this.experience.visualContinuity.positionMemory;

    // If user positioned it recently on same page, use that
    if (lastPosition.userPositioned && 
        lastPosition.page === pageContext.page && 
        Date.now() - lastPosition.timestamp < 600000) { // 10 minutes
      return lastPosition;
    }

    // Calculate page-specific optimal position
    const margin = 20;
    let x = width - 300 - margin;
    let y = 120;

    switch (pageContext.page) {
      case 'dashboard':
        x = width - 280 - margin;
        y = 120;
        break;
        
      case 'document':
        x = width - 300 - margin;
        y = height / 3; // Avoid writing area
        break;
        
      case 'timeline':
        x = margin; // Left side to avoid timeline
        y = height / 2;
        break;
        
      case 'detailed-view':
        x = width - 320 - margin;
        y = 100;
        break;
    }

    // Ensure within bounds
    x = Math.max(margin, Math.min(x, width - 320 - margin));
    y = Math.max(margin, Math.min(y, height - 200 - margin));

    return {
      x,
      y,
      page: pageContext.page,
      timestamp: Date.now(),
      userPositioned: false,
      adaptiveReason: `Optimized for ${pageContext.page} page layout`
    };
  }

  /**
   * Get conversation continuity context
   */
  getConversationContinuity(): {
    hasActiveThread: boolean;
    conversationBridge: string;
    contextualPrompt?: string;
    threadHistory: ConversationThread[];
  } {
    const { conversationContinuity } = this.experience;
    
    return {
      hasActiveThread: !!conversationContinuity.activeThread,
      conversationBridge: conversationContinuity.conversationBridge,
      contextualPrompt: this.generateContextualPrompt(conversationContinuity.activeThread),
      threadHistory: conversationContinuity.threadHistory
    };
  }

  /**
   * Register transition callback
   */
  onTransition(event: string, callback: Function) {
    if (!this.transitionCallbacks.has(event)) {
      this.transitionCallbacks.set(event, []);
    }
    this.transitionCallbacks.get(event)!.push(callback);
  }

  /**
   * Update behavioral continuity
   */
  updateBehavioralContinuity(
    behavioralContext: BehavioralContext,
    synthesisContext: SynthesisContext
  ) {
    const adaptationState = this.experience.behavioralContinuity.adaptationState;

    // Update learning continuity
    adaptationState.learningContinuity.set('engagement', behavioralContext.engagementLevel);
    adaptationState.learningContinuity.set('assistanceType', behavioralContext.preferredAssistanceType);
    adaptationState.learningContinuity.set('writingFlow', behavioralContext.writingFlow);

    // Update preference persistence
    adaptationState.preferencePersistence = {
      assistanceLevel: this.mapAssistanceType(behavioralContext.preferredAssistanceType),
      preferredInteractionStyle: this.inferInteractionStyle(behavioralContext),
      optimizedForWorkflow: this.extractWorkflowOptimizations(synthesisContext),
      adaptationConfidence: behavioralContext.confidenceInTiming
    };

    // Update cross-page insights
    adaptationState.crossPageInsights = synthesisContext.activeInsights.map(insight => ({
      insight,
      relevantPages: insight.involvedPages,
      strength: insight.confidence,
      lastAccessed: Date.now(),
      userEngagement: 0.5 // Will be updated based on user interaction
    }));

    this.persistState();
  }

  /**
   * Get current experience state
   */
  getExperience(): CrossPageExperience {
    return { ...this.experience };
  }

  private detectTransitionIntent(
    fromPage: string,
    toPage: string,
    activeThread?: ConversationThread
  ): PageTransitionContext['transitionIntent'] {
    // Common workflow patterns
    const workflowTransitions: Record<string, PageTransitionContext['transitionIntent']> = {
      'dashboard→document': 'workflow_continuation',
      'document→timeline': 'workflow_continuation', 
      'timeline→detailed-view': 'workflow_continuation',
      'dashboard→timeline': 'context_switch',
      'document→dashboard': 'context_switch'
    };

    const transitionKey = `${fromPage}→${toPage}`;
    
    if (activeThread && activeThread.intelligenceRequests.length > 0) {
      return 'workflow_continuation';
    }

    return workflowTransitions[transitionKey] || 'exploration';
  }

  private generateConversationBridge(
    transition: PageTransitionContext,
    activeThread?: ConversationThread
  ): string {
    if (!activeThread || activeThread.messages.length === 0) {
      return '';
    }

    const lastMessage = activeThread.messages[activeThread.messages.length - 1];
    const fromPageName = this.getPageDisplayName(transition.from);
    const toPageName = this.getPageDisplayName(transition.to);

    if (transition.transitionIntent === 'workflow_continuation') {
      return `Continuing our ${fromPageName} discussion in ${toPageName} context...`;
    }

    if (lastMessage.type === 'user_input') {
      return `Following up on "${lastMessage.content.substring(0, 40)}..." from ${fromPageName}`;
    }

    return `Context from ${fromPageName} conversation available`;
  }

  private calculateEngagementTransition(
    behavioralContext?: BehavioralContext,
    transition?: PageTransitionContext
  ): EngagementTransition {
    if (!behavioralContext) {
      return {
        previousEngagement: 0,
        currentEngagement: 0,
        flowMaintained: false,
        interruptionRisk: 0.5,
        optimalTransitionTiming: 1000
      };
    }

    const previousEngagement = this.experience.behavioralContinuity.engagementFlow.currentEngagement;
    const currentEngagement = behavioralContext.engagementLevel;
    const flowMaintained = Math.abs(currentEngagement - previousEngagement) < 0.3;

    // Calculate interruption risk
    let interruptionRisk = 0.3;
    if (behavioralContext.writingFlow === 'active') {
      interruptionRisk = 0.8; // High risk of interrupting active flow
    } else if (behavioralContext.writingFlow === 'paused') {
      interruptionRisk = 0.1; // Low risk during pause
    }

    // Optimal timing based on current state
    let optimalTiming = 500; // Default 500ms
    if (flowMaintained && interruptionRisk < 0.5) {
      optimalTiming = 200; // Quick transition
    } else if (interruptionRisk > 0.7) {
      optimalTiming = 2000; // Delayed transition
    }

    return {
      previousEngagement,
      currentEngagement,
      flowMaintained,
      interruptionRisk,
      optimalTransitionTiming: optimalTiming
    };
  }

  private planVisualTransition(
    transition: PageTransitionContext,
    engagementTransition: EngagementTransition
  ): VisualTransitionConfig {
    let transitionType: TransitionType = 'fade';
    let duration = 300;

    if (transition.preserveContext && engagementTransition.flowMaintained) {
      transitionType = 'morph';
      duration = 400;
    } else if (engagementTransition.interruptionRisk > 0.7) {
      transitionType = 'instant';
      duration = 0;
    } else if (transition.transitionIntent === 'workflow_continuation') {
      transitionType = 'context_bridge';
      duration = 600;
    }

    return {
      type: transitionType,
      duration,
      delay: engagementTransition.optimalTransitionTiming,
      easing: 'ease-out',
      preserveExpandedState: transition.preserveContext
    };
  }

  private calculateTransitionPriority(
    transition: PageTransitionContext,
    activeThread?: ConversationThread
  ): 'high' | 'medium' | 'low' {
    if (activeThread && activeThread.intelligenceRequests.length > 0) {
      return 'high';
    }
    
    if (transition.transitionIntent === 'workflow_continuation') {
      return 'medium';
    }
    
    return 'low';
  }

  private generateContextualPrompt(activeThread?: ConversationThread): string | undefined {
    if (!activeThread || activeThread.messages.length === 0) {
      return undefined;
    }

    const recentMessages = activeThread.messages.slice(-3);
    const context = recentMessages
      .filter(m => m.type === 'user_input')
      .map(m => m.content.substring(0, 50))
      .join('; ');

    return context ? `Previous context: ${context}` : undefined;
  }

  private getPageDisplayName(page: string): string {
    const pageNames: Record<string, string> = {
      'dashboard': 'dashboard',
      'document': 'document',
      'timeline': 'timeline',
      'detailed-view': 'analysis'
    };
    return pageNames[page] || page;
  }

  private mapAssistanceType(type: string): UserPreferenceSnapshot['assistanceLevel'] {
    switch (type) {
      case 'minimal': return 'minimal';
      case 'proactive': return 'proactive';
      default: return 'moderate';
    }
  }

  private inferInteractionStyle(behavioralContext: BehavioralContext): UserPreferenceSnapshot['preferredInteractionStyle'] {
    if (behavioralContext.recentInteractions.length === 0) {
      return 'hybrid';
    }

    const modalInteractions = behavioralContext.recentInteractions.filter(
      i => i.type === 'modal_interaction'
    ).length;
    
    const totalInteractions = behavioralContext.recentInteractions.length;
    const modalRatio = modalInteractions / totalInteractions;

    if (modalRatio > 0.7) return 'modal';
    if (modalRatio < 0.3) return 'ambient';
    return 'hybrid';
  }

  private extractWorkflowOptimizations(synthesisContext: SynthesisContext): string[] {
    return synthesisContext.workflowPatterns
      .filter(pattern => pattern.successRate > 0.7)
      .map(pattern => pattern.sequence.join('→'))
      .slice(0, 3);
  }

  private emitTransition(event: string, data: any) {
    const callbacks = this.transitionCallbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Transition callback error:', error);
      }
    });
  }

  private persistState() {
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }

    this.persistenceTimeout = setTimeout(() => {
      try {
        const serializable = {
          ...this.experience,
          behavioralContinuity: {
            ...this.experience.behavioralContinuity,
            adaptationState: {
              ...this.experience.behavioralContinuity.adaptationState,
              learningContinuity: Object.fromEntries(
                this.experience.behavioralContinuity.adaptationState.learningContinuity
              )
            }
          }
        };
        
        localStorage.setItem('crossPageExperience', JSON.stringify(serializable));
      } catch (error) {
        console.warn('Failed to persist cross-page experience:', error);
      }
    }, 1000);
  }

  private loadPersistedState() {
    try {
      const stored = localStorage.getItem('crossPageExperience');
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Restore with proper Map conversion
        this.experience = {
          ...parsed,
          behavioralContinuity: {
            ...parsed.behavioralContinuity,
            adaptationState: {
              ...parsed.behavioralContinuity.adaptationState,
              learningContinuity: new Map(
                Object.entries(parsed.behavioralContinuity.adaptationState.learningContinuity || {})
              )
            }
          }
        };
      }
    } catch (error) {
      console.warn('Failed to load persisted cross-page experience:', error);
    }
  }
}

// Supporting interfaces
export interface PageTransitionConfig {
  preserveContext: boolean;
  timing: number;
  priority: 'high' | 'medium' | 'low';
}

export interface VisualTransitionConfig {
  type: TransitionType;
  duration: number;
  delay: number;
  easing: string;
  preserveExpandedState: boolean;
}

// Global instance
export const crossPageExperienceManager = new CrossPageExperienceManager();