"use client";

import type { PageContext } from './pageContextDetection';
import type { BehavioralContext, BehaviorTrigger } from './behavioralTriggers';
import type { SynthesisContext, CrossPageInsight } from './crossPageSynthesis';
import type { ConversationThread, ConversationMemory } from './conversationThreading';
import type { ConversationIntent } from './conversationAnalyzer';

// Adaptive routing types
export interface RoutingDecision {
  route: ConversationRoute;
  confidence: number;
  reasoning: string;
  enhancements: RouteEnhancement[];
  expectedOutcome: ExpectedOutcome;
}

export type ConversationRoute = 
  | 'direct_intelligence' 
  | 'contextual_analysis'
  | 'synthesis_generation'
  | 'behavioral_response'
  | 'memory_assisted'
  | 'workflow_guidance'
  | 'simple_context_add';

export interface RouteEnhancement {
  type: 'cross_page_context' | 'behavioral_timing' | 'conversation_history' | 'synthesis_opportunity' | 'workflow_pattern';
  value: any;
  impact: number; // 0-1 how much this enhances the response
}

export interface ExpectedOutcome {
  type: 'intelligence_modal' | 'toast_notification' | 'ambient_update' | 'workflow_transition';
  confidence: number;
  estimatedValue: number; // 0-1 expected user satisfaction
  followUpLikelihood: number; // 0-1 probability of follow-up interaction
}

export interface RoutingContext {
  userQuery: string;
  intent: ConversationIntent;
  pageContext: PageContext;
  behavioralContext: BehavioralContext;
  synthesisContext: SynthesisContext;
  conversationMemory: ConversationMemory;
  activeThread?: ConversationThread | null;
  activeTriggers: BehaviorTrigger[];
}

export interface RoutingRule {
  id: string;
  priority: number;
  condition: (context: RoutingContext) => boolean;
  route: ConversationRoute;
  enhancements: (context: RoutingContext) => RouteEnhancement[];
  confidence: (context: RoutingContext) => number;
  description: string;
}

/**
 * Adaptive conversation routing system
 * Intelligently determines the best way to handle user conversations
 * based on context, behavior, and conversation timeline
 */
export class AdaptiveConversationRouter {
  private routingRules: RoutingRule[];

  constructor() {
    this.routingRules = this.initializeRoutingRules();
  }

  /**
   * Main routing decision function
   */
  routeConversation(context: RoutingContext): RoutingDecision {
    // Evaluate all applicable routing rules
    const applicableRules = this.routingRules
      .filter(rule => rule.condition(context))
      .map(rule => ({
        rule,
        confidence: rule.confidence(context),
        enhancements: rule.enhancements(context)
      }))
      .sort((a, b) => (b.rule.priority * b.confidence) - (a.rule.priority * a.confidence));

    // Get the best matching rule
    const bestMatch = applicableRules[0];
    
    if (!bestMatch) {
      // Fallback to simple context addition
      return {
        route: 'simple_context_add',
        confidence: 0.3,
        reasoning: 'No specific routing rules matched - defaulting to context addition',
        enhancements: [],
        expectedOutcome: {
          type: 'toast_notification',
          confidence: 0.5,
          estimatedValue: 0.3,
          followUpLikelihood: 0.2
        }
      };
    }

    const expectedOutcome = this.predictOutcome(bestMatch.rule.route, context, bestMatch.confidence);

    return {
      route: bestMatch.rule.route,
      confidence: bestMatch.confidence,
      reasoning: bestMatch.rule.description,
      enhancements: bestMatch.enhancements,
      expectedOutcome
    };
  }

  /**
   * Initialize routing rules with intelligent decision logic
   */
  private initializeRoutingRules(): RoutingRule[] {
    return [
      // High-priority synthesis routing
      {
        id: 'synthesis_opportunity',
        priority: 10,
        condition: (ctx: RoutingContext) => {
          const hasHighValueInsights = ctx.synthesisContext.activeInsights.some(
            insight => insight.priority === 'high' && insight.confidence > 0.7
          );
          const intentMatchesSynthesis = ctx.intent.type === 'intelligence_generation' &&
            (ctx.userQuery.toLowerCase().includes('pattern') || 
             ctx.userQuery.toLowerCase().includes('connection') ||
             ctx.userQuery.toLowerCase().includes('synthesize'));
          
          return !!(hasHighValueInsights && intentMatchesSynthesis);
        },
        route: 'synthesis_generation' as ConversationRoute,
        confidence: (ctx: RoutingContext) => {
          const insightConfidence = Math.max(...ctx.synthesisContext.activeInsights.map(i => i.confidence));
          return Math.min(0.95, ctx.intent.confidence * insightConfidence);
        },
        enhancements: (ctx: RoutingContext) => [
          {
            type: 'synthesis_opportunity' as const,
            value: ctx.synthesisContext.activeInsights.filter(i => i.priority === 'high'),
            impact: 0.9
          },
          {
            type: 'cross_page_context' as const,
            value: ctx.synthesisContext.recentSessions,
            impact: 0.7
          }
        ],
        description: 'High-value synthesis opportunity detected with strong cross-page insights'
      },

      // Behavioral trigger response
      {
        id: 'behavioral_trigger_response',
        priority: 9,
        condition: (ctx: RoutingContext) => {
          return !!(ctx.activeTriggers.length > 0 && 
                 ctx.behavioralContext.preferredAssistanceType === 'proactive' &&
                 ctx.activeTriggers.some(t => t.confidence > 0.7));
        },
        route: 'behavioral_response' as ConversationRoute,
        confidence: (ctx: RoutingContext) => {
          const maxTriggerConfidence = Math.max(...ctx.activeTriggers.map(t => t.confidence));
          return maxTriggerConfidence * 0.9;
        },
        enhancements: (ctx: RoutingContext) => [
          {
            type: 'behavioral_timing' as const,
            value: {
              writingFlow: ctx.behavioralContext.writingFlow,
              optimalTiming: ctx.behavioralContext.optimalInteractionTiming,
              triggers: ctx.activeTriggers
            },
            impact: 0.8
          }
        ],
        description: 'User behavior indicates optimal moment for proactive assistance'
      },

      // Memory-assisted conversation continuation
      {
        id: 'conversation_continuation',
        priority: 8,
        condition: (ctx: RoutingContext) => {
          const hasActiveThread = !!ctx.activeThread && ctx.activeThread.messages.length > 0;
          const hasRelevantHistory = ctx.conversationMemory.threads.some(
            thread => thread.pageContext.page === ctx.pageContext.page &&
                     thread.intelligenceRequests.length > 0
          );
          
          return !!(hasActiveThread || (hasRelevantHistory && ctx.intent.confidence > 0.6));
        },
        route: 'memory_assisted' as ConversationRoute,
        confidence: (ctx: RoutingContext) => {
          const threadContinuity = ctx.activeThread ? 0.8 : 0.6;
          const historyRelevance = ctx.conversationMemory.threads
            .filter(t => t.pageContext.page === ctx.pageContext.page)
            .length > 0 ? 0.7 : 0.3;
          
          return Math.max(threadContinuity, historyRelevance) * ctx.intent.confidence;
        },
        enhancements: (ctx: RoutingContext) => [
          {
            type: 'conversation_history' as const,
            value: {
              activeThread: ctx.activeThread,
              relevantThreads: ctx.conversationMemory.threads
                .filter(t => t.pageContext.page === ctx.pageContext.page)
                .slice(-3)
            },
            impact: 0.8
          }
        ],
        description: 'Conversation timeline suggests this is part of ongoing discussion'
      },

      // Workflow pattern guidance
      {
        id: 'workflow_guidance',
        priority: 7,
        condition: (ctx: RoutingContext) => {
          const hasWorkflowPatterns = ctx.synthesisContext.workflowPatterns.length > 0;
          const isAtTransitionPoint = ctx.behavioralContext.writingFlow === 'planning' ||
                                     ctx.pageContext.userActivity.timeOnPage > 300000; // > 5 minutes
          
          return !!(hasWorkflowPatterns && isAtTransitionPoint &&
                 (ctx.userQuery.toLowerCase().includes('next') || 
                  ctx.userQuery.toLowerCase().includes('should') ||
                  ctx.userQuery.toLowerCase().includes('recommend')));
        },
        route: 'workflow_guidance' as ConversationRoute,
        confidence: (ctx: RoutingContext) => {
          const patternStrength = ctx.synthesisContext.workflowPatterns[0]?.successRate || 0;
          return patternStrength * ctx.intent.confidence * 0.85;
        },
        enhancements: (ctx: RoutingContext) => [
          {
            type: 'workflow_pattern' as const,
            value: ctx.synthesisContext.workflowPatterns.slice(0, 3),
            impact: 0.7
          }
        ],
        description: 'User appears to be seeking workflow guidance based on their patterns'
      },

      // Contextual page-specific analysis
      {
        id: 'contextual_page_analysis',
        priority: 6,
        condition: (ctx: RoutingContext) => {
          const isIntelligenceRequest = ctx.intent.type === 'intelligence_generation';
          const hasPageSpecificContent = ctx.pageContext.content.currentDocument ||
                                        ctx.pageContext.content.basketOverview;
          const isEngaged = ctx.pageContext.userActivity.isActivelyEngaged;
          
          return !!(isIntelligenceRequest && hasPageSpecificContent && isEngaged);
        },
        route: 'contextual_analysis' as ConversationRoute,
        confidence: (ctx: RoutingContext) => ctx.intent.confidence * 0.8,
        enhancements: (ctx: RoutingContext) => [
          {
            type: 'cross_page_context' as const,
            value: {
              currentPage: ctx.pageContext,
              recentActivity: ctx.pageContext.userActivity,
              selectedText: ctx.pageContext.userActivity.selectedText
            },
            impact: 0.6
          }
        ],
        description: 'Page-specific intelligence request with rich contextual content'
      },

      // Direct intelligence generation (high confidence)
      {
        id: 'direct_intelligence_high_confidence',
        priority: 5,
        condition: (ctx: RoutingContext) => {
          return !!(ctx.intent.type === 'intelligence_generation' && 
                 ctx.intent.confidence > 0.8 &&
                 ctx.intent.shouldGenerateIntelligence);
        },
        route: 'direct_intelligence' as ConversationRoute,
        confidence: (ctx: RoutingContext) => ctx.intent.confidence,
        enhancements: (ctx: RoutingContext) => [],
        description: 'High-confidence intelligence generation request'
      },

      // Fallback for medium confidence intelligence requests
      {
        id: 'contextual_intelligence_medium',
        priority: 4,
        condition: (ctx: RoutingContext) => {
          return !!(ctx.intent.type === 'intelligence_generation' && 
                 ctx.intent.confidence > 0.5 &&
                 ctx.intent.shouldGenerateIntelligence);
        },
        route: 'contextual_analysis' as ConversationRoute,
        confidence: (ctx: RoutingContext) => ctx.intent.confidence * 0.7,
        enhancements: (ctx: RoutingContext) => [
          {
            type: 'cross_page_context' as const,
            value: { pageContext: ctx.pageContext },
            impact: 0.4
          }
        ],
        description: 'Medium-confidence intelligence request enhanced with context'
      }
    ].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Predict the expected outcome of a routing decision
   */
  private predictOutcome(
    route: ConversationRoute, 
    context: RoutingContext, 
    confidence: number
  ): ExpectedOutcome {
    switch (route) {
      case 'synthesis_generation':
        return {
          type: 'intelligence_modal',
          confidence: confidence * 0.9,
          estimatedValue: 0.9, // High value synthesis
          followUpLikelihood: 0.7 // Likely to generate follow-up questions
        };

      case 'behavioral_response':
        return {
          type: 'ambient_update',
          confidence: confidence * 0.8,
          estimatedValue: 0.7, // Good behavioral match
          followUpLikelihood: 0.5
        };

      case 'memory_assisted':
        return {
          type: 'intelligence_modal',
          confidence: confidence * 0.85,
          estimatedValue: 0.8, // Benefits from context
          followUpLikelihood: 0.8 // Conversation continuation likely
        };

      case 'workflow_guidance':
        return {
          type: 'workflow_transition',
          confidence: confidence * 0.8,
          estimatedValue: 0.75, // Helpful for productivity
          followUpLikelihood: 0.3 // Usually ends workflow questions
        };

      case 'contextual_analysis':
        return {
          type: 'intelligence_modal',
          confidence: confidence * 0.75,
          estimatedValue: 0.7, // Good contextual match
          followUpLikelihood: 0.6
        };

      case 'direct_intelligence':
        return {
          type: 'intelligence_modal',
          confidence: confidence * 0.7,
          estimatedValue: 0.6, // Standard intelligence
          followUpLikelihood: 0.4
        };

      case 'simple_context_add':
      default:
        return {
          type: 'toast_notification',
          confidence: 0.5,
          estimatedValue: 0.3, // Low value fallback
          followUpLikelihood: 0.2
        };
    }
  }

  /**
   * Get routing analytics for optimization
   */
  getRoutingAnalytics(decisions: RoutingDecision[]): {
    routeDistribution: Record<ConversationRoute, number>;
    averageConfidence: number;
    enhancementUtilization: Record<string, number>;
  } {
    const routeDistribution = decisions.reduce((acc, decision) => {
      acc[decision.route] = (acc[decision.route] || 0) + 1;
      return acc;
    }, {} as Record<ConversationRoute, number>);

    const averageConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;

    const enhancementUtilization = decisions.flatMap(d => d.enhancements).reduce((acc, enhancement) => {
      acc[enhancement.type] = (acc[enhancement.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      routeDistribution,
      averageConfidence,
      enhancementUtilization
    };
  }
}

/**
 * Route-specific enhancement processors
 */
export class RouteEnhancementProcessor {
  
  /**
   * Process synthesis enhancements
   */
  static processSynthesisEnhancements(
    enhancements: RouteEnhancement[],
    originalQuery: string
  ): string {
    let enhancedQuery = originalQuery;

    const synthesisEnhancement = enhancements.find(e => e.type === 'synthesis_opportunity');
    if (synthesisEnhancement) {
      const insights = synthesisEnhancement.value as CrossPageInsight[];
      const highValueInsights = insights.filter(i => i.priority === 'high');
      
      if (highValueInsights.length > 0) {
        enhancedQuery += `\n\nSynthesis Context: Active high-priority insights detected: ${
          highValueInsights.map(i => i.description).join('; ')
        }. Please synthesize these patterns in your response.`;
      }
    }

    const crossPageEnhancement = enhancements.find(e => e.type === 'cross_page_context');
    if (crossPageEnhancement) {
      enhancedQuery += `\n\nCross-page context: User has been working across multiple pages with related content.`;
    }

    return enhancedQuery;
  }

  /**
   * Process behavioral enhancements
   */
  static processBehavioralEnhancements(
    enhancements: RouteEnhancement[],
    originalQuery: string
  ): string {
    let enhancedQuery = originalQuery;

    const behavioralEnhancement = enhancements.find(e => e.type === 'behavioral_timing');
    if (behavioralEnhancement) {
      const { writingFlow, triggers } = behavioralEnhancement.value;
      
      enhancedQuery += `\n\nBehavioral Context: User is in ${writingFlow} flow state. Active triggers: ${
        triggers.map((t: BehaviorTrigger) => t.type).join(', ')
      }. Tailor response to current behavioral state.`;
    }

    return enhancedQuery;
  }

  /**
   * Process memory enhancements
   */
  static processMemoryEnhancements(
    enhancements: RouteEnhancement[],
    originalQuery: string
  ): string {
    let enhancedQuery = originalQuery;

    const memoryEnhancement = enhancements.find(e => e.type === 'conversation_history');
    if (memoryEnhancement) {
      const { activeThread, relevantThreads } = memoryEnhancement.value;
      
      if (activeThread) {
        enhancedQuery += `\n\nConversation Context: This is part of an ongoing conversation. Recent messages: ${
          activeThread.messages.slice(-2).map((m: any) => `${m.type}: ${m.content.substring(0, 50)}`).join('; ')
        }.`;
      }

      if (relevantThreads && relevantThreads.length > 0) {
        enhancedQuery += `\n\nRelated Conversations: User has had ${relevantThreads.length} related conversations on this page.`;
      }
    }

    return enhancedQuery;
  }

  /**
   * Process workflow enhancements
   */
  static processWorkflowEnhancements(
    enhancements: RouteEnhancement[],
    originalQuery: string
  ): string {
    let enhancedQuery = originalQuery;

    const workflowEnhancement = enhancements.find(e => e.type === 'workflow_pattern');
    if (workflowEnhancement) {
      const patterns = workflowEnhancement.value;
      const bestPattern = patterns[0];
      
      if (bestPattern) {
        enhancedQuery += `\n\nWorkflow Context: User frequently follows ${bestPattern.sequence.join(' → ')} pattern with ${Math.round(bestPattern.successRate * 100)}% success rate. Consider this workflow in recommendations.`;
      }
    }

    return enhancedQuery;
  }
}