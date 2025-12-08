"use client";

import type { PageContext } from './pageContextDetection';
import type { SynthesisContext, CrossPageInsight } from './crossPageSynthesis';
import type { ConversationThread, ConversationMemory } from './conversationThreading';
import type { BehavioralContext } from './behavioralTriggers';
import type { CrossPageExperience } from './crossPageExperience';

// Enhanced page-specific intelligence types
export interface EnhancedPageIntelligence {
  pageType: string;
  primaryCapabilities: string[];
  contextualInsights: ContextualInsight[];
  crossPageConnections: CrossPageConnection[];
  proactiveRecommendations: ProactiveRecommendation[];
  workflowOptimizations: WorkflowOptimization[];
  intelligencePrompts: IntelligencePrompt[];
}

export interface ContextualInsight {
  id: string;
  type: 'behavioral' | 'synthesis' | 'workflow' | 'content';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  relevantPages: string[];
  suggestedAction?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CrossPageConnection {
  fromPage: string;
  toPage: string;
  connectionType: 'content_flow' | 'workflow_sequence' | 'insight_building' | 'reference';
  strength: number;
  description: string;
  lastUsed: number;
  userEngagement: number;
}

export interface ProactiveRecommendation {
  id: string;
  title: string;
  description: string;
  trigger: RecommendationTrigger;
  action: RecommendedAction;
  confidence: number;
  timing: 'immediate' | 'opportunistic' | 'scheduled';
  context: Record<string, any>;
}

export interface RecommendationTrigger {
  type: 'time_based' | 'activity_based' | 'content_based' | 'behavioral';
  condition: string;
  threshold?: number;
  window?: number; // Time window in milliseconds
}

export interface RecommendedAction {
  type: 'navigate' | 'generate_intelligence' | 'add_context' | 'review_content' | 'optimize_workflow';
  target?: string;
  parameters?: Record<string, any>;
  description: string;
}

export interface WorkflowOptimization {
  pattern: string[];
  currentEfficiency: number;
  optimizedEfficiency: number;
  suggestion: string;
  reasoning: string;
  implementation: OptimizationImplementation;
}

export interface OptimizationImplementation {
  steps: string[];
  estimatedImpact: number;
  effort: 'low' | 'medium' | 'high';
  userBenefit: string;
}

export interface IntelligencePrompt {
  id: string;
  prompt: string;
  category: 'strategic' | 'tactical' | 'analytical' | 'creative';
  pageOptimized: boolean;
  crossPageAware: boolean;
  contextualHints: string[];
  expectedInsights: string[];
}

/**
 * Enhanced page intelligence analyzer with cross-page synthesis
 */
export class EnhancedPageIntelligenceAnalyzer {
  
  /**
   * Generate enhanced intelligence for current page context
   */
  generatePageIntelligence(
    pageContext: PageContext,
    behavioralContext: BehavioralContext,
    synthesisContext: SynthesisContext,
    conversationMemory: ConversationMemory,
    crossPageExperience: CrossPageExperience
  ): EnhancedPageIntelligence {
    
    const baseCapabilities = this.getBaseCapabilities(pageContext.page);
    const contextualInsights = this.analyzeContextualInsights(
      pageContext, 
      behavioralContext, 
      synthesisContext
    );
    const crossPageConnections = this.identifyCrossPageConnections(
      pageContext, 
      synthesisContext, 
      conversationMemory
    );
    const proactiveRecommendations = this.generateProactiveRecommendations(
      pageContext,
      behavioralContext,
      synthesisContext,
      crossPageExperience
    );
    const workflowOptimizations = this.analyzeWorkflowOptimizations(
      pageContext,
      synthesisContext,
      behavioralContext
    );
    const intelligencePrompts = this.generateIntelligencePrompts(
      pageContext,
      contextualInsights,
      crossPageConnections
    );

    return {
      pageType: pageContext.page,
      primaryCapabilities: baseCapabilities,
      contextualInsights,
      crossPageConnections,
      proactiveRecommendations,
      workflowOptimizations,
      intelligencePrompts
    };
  }

  private getBaseCapabilities(pageType: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      dashboard: [
        'Strategic synthesis across documents',
        'Cross-document pattern recognition',
        'Workflow optimization insights',
        'Content gap identification',
        'Theme evolution tracking',
        'Project health assessment'
      ],
      document: [
        'Real-time writing assistance',
        'Section development guidance',
        'Content coherence analysis',
        'Cross-reference suggestions',
        'Writing flow optimization',
        'Research integration'
      ],
      timeline: [
        'Evolution pattern analysis',
        'Progress milestone tracking',
        'Temporal trend identification',
        'Development velocity insights',
        'Historical context synthesis',
        'Future projection modeling'
      ],
      'detailed-view': [
        'Technical substrate analysis',
        'Data quality assessment',
        'Processing pipeline insights',
        'Performance optimization',
        'Debugging assistance',
        'System health monitoring'
      ]
    };

    return capabilityMap[pageType] || ['General intelligence assistance'];
  }

  private analyzeContextualInsights(
    pageContext: PageContext,
    behavioralContext: BehavioralContext,
    synthesisContext: SynthesisContext
  ): ContextualInsight[] {
    const insights: ContextualInsight[] = [];

    // Behavioral insights
    if (behavioralContext.writingFlow === 'active' && pageContext.page === 'document') {
      insights.push({
        id: 'active_writing_flow',
        type: 'behavioral',
        title: 'Active Writing Flow Detected',
        description: `You're in a productive writing state with ${behavioralContext.typingPattern.wpm} WPM. Consider leveraging this momentum.`,
        confidence: behavioralContext.typingPattern.consistency,
        actionable: true,
        relevantPages: ['document'],
        suggestedAction: 'Continue writing while in flow state, or generate expansion ideas',
        priority: 'high'
      });
    }

    // Synthesis insights
    synthesisContext.activeInsights.forEach(insight => {
      if (insight.involvedPages.includes(pageContext.page)) {
        insights.push({
          id: `synthesis_${insight.id}`,
          type: 'synthesis',
          title: insight.description.substring(0, 50) + '...',
          description: insight.description,
          confidence: insight.confidence,
          actionable: !!insight.actionableRecommendation,
          relevantPages: insight.involvedPages,
          suggestedAction: insight.actionableRecommendation,
          priority: insight.priority
        });
      }
    });

    // Page-specific content insights
    if (pageContext.page === 'dashboard' && pageContext.content.basketOverview) {
      const overview = pageContext.content.basketOverview;
      if (overview.dominantThemes.length > 2) {
        insights.push({
          id: 'multiple_themes',
          type: 'content',
          title: 'Multiple Themes Detected',
          description: `Your work spans ${overview.dominantThemes.length} themes: ${overview.dominantThemes.join(', ')}. Consider synthesis opportunities.`,
          confidence: 0.8,
          actionable: true,
          relevantPages: ['dashboard'],
          suggestedAction: 'Generate strategic synthesis across themes',
          priority: 'medium'
        });
      }
    }

    if (pageContext.page === 'document' && pageContext.userActivity.selectedText) {
      insights.push({
        id: 'text_selection',
        type: 'content',
        title: 'Text Selection Active',
        description: `You've selected "${pageContext.userActivity.selectedText.text.substring(0, 30)}...". Consider analysis or expansion.`,
        confidence: 0.9,
        actionable: true,
        relevantPages: ['document'],
        suggestedAction: 'Analyze selected text or generate expansions',
        priority: 'high'
      });
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private identifyCrossPageConnections(
    pageContext: PageContext,
    synthesisContext: SynthesisContext,
    conversationMemory: ConversationMemory
  ): CrossPageConnection[] {
    const connections: CrossPageConnection[] = [];

    // Memory-based connections
    conversationMemory.contextConnections.forEach(conn => {
      // Note: ContextConnection has fromThread/toThread, we'd need to look up the actual threads
      // to get page information. For now, we'll create generic connections.
      const connectionType = this.mapConnectionType(conn.connectionType);
      connections.push({
        fromPage: 'unknown', // Would need thread lookup
        toPage: pageContext.page,
        connectionType,
        strength: conn.strength,
        description: `${conn.connectionType} connection with ${conn.sharedConcepts.join(', ')}`,
        lastUsed: Date.now() - conn.timeDelta,
        userEngagement: 0.7 // Default engagement score
      });
    });

    // Synthesis-based connections
    synthesisContext.workflowPatterns.forEach(pattern => {
      const currentIndex = pattern.sequence.indexOf(pageContext.page);
      if (currentIndex !== -1 && currentIndex < pattern.sequence.length - 1) {
        const nextPage = pattern.sequence[currentIndex + 1];
        connections.push({
          fromPage: pageContext.page,
          toPage: nextPage,
          connectionType: 'workflow_sequence',
          strength: pattern.successRate,
          description: `Workflow pattern: ${pattern.sequence.join(' → ')} (${Math.round(pattern.successRate * 100)}% success rate)`,
          lastUsed: Date.now(),
          userEngagement: pattern.successRate
        });
      }
    });

    return connections.sort((a, b) => b.strength - a.strength);
  }

  private generateProactiveRecommendations(
    pageContext: PageContext,
    behavioralContext: BehavioralContext,
    synthesisContext: SynthesisContext,
    crossPageExperience: CrossPageExperience
  ): ProactiveRecommendation[] {
    const recommendations: ProactiveRecommendation[] = [];

    // Time-based recommendations
    if (pageContext.userActivity.timeOnPage > 300000 && pageContext.page === 'dashboard') {
      recommendations.push({
        id: 'dashboard_deep_dive',
        title: 'Deep Analysis Opportunity',
        description: 'You\'ve been reviewing the dashboard for 5+ minutes. Consider generating comprehensive insights.',
        trigger: {
          type: 'time_based',
          condition: 'timeOnPage > 300000',
          threshold: 300000
        },
        action: {
          type: 'generate_intelligence',
          description: 'Generate comprehensive dashboard analysis',
          parameters: { focus: 'strategic_synthesis' }
        },
        confidence: 0.7,
        timing: 'opportunistic',
        context: { timeSpent: pageContext.userActivity.timeOnPage }
      });
    }

    // Behavioral recommendations
    if (behavioralContext.writingFlow === 'paused' && pageContext.page === 'document') {
      recommendations.push({
        id: 'writing_assistance',
        title: 'Writing Flow Support',
        description: 'You\'ve paused in your writing. Consider getting expansion ideas or section development help.',
        trigger: {
          type: 'behavioral',
          condition: 'writingFlow === paused',
          window: 60000
        },
        action: {
          type: 'generate_intelligence',
          description: 'Generate writing assistance',
          parameters: { focus: 'section_development' }
        },
        confidence: 0.8,
        timing: 'immediate',
        context: { writingFlow: behavioralContext.writingFlow }
      });
    }

    // Cross-page workflow recommendations
    const workflowPatterns = synthesisContext.workflowPatterns.filter(
      pattern => pattern.sequence[0] === pageContext.page && pattern.successRate > 0.7
    );

    if (workflowPatterns.length > 0) {
      const bestPattern = workflowPatterns[0];
      const nextPage = bestPattern.sequence[1];
      
      recommendations.push({
        id: 'workflow_continuation',
        title: 'Workflow Continuation',
        description: `Based on your patterns, moving to ${nextPage} next has ${Math.round(bestPattern.successRate * 100)}% success rate.`,
        trigger: {
          type: 'activity_based',
          condition: 'workflow_pattern_match',
          threshold: 0.7
        },
        action: {
          type: 'navigate',
          target: nextPage,
          description: `Navigate to ${nextPage} to continue workflow`,
        },
        confidence: bestPattern.successRate,
        timing: 'opportunistic',
        context: { pattern: bestPattern.sequence }
      });
    }

    return recommendations.filter(rec => rec.confidence > 0.6);
  }

  private analyzeWorkflowOptimizations(
    pageContext: PageContext,
    synthesisContext: SynthesisContext,
    behavioralContext: BehavioralContext
  ): WorkflowOptimization[] {
    const optimizations: WorkflowOptimization[] = [];

    synthesisContext.workflowPatterns.forEach(pattern => {
      if (pattern.successRate < 0.8 && pattern.frequency > 2) {
        const currentIndex = pattern.sequence.indexOf(pageContext.page);
        if (currentIndex !== -1) {
          optimizations.push({
            pattern: pattern.sequence,
            currentEfficiency: pattern.successRate,
            optimizedEfficiency: Math.min(0.95, pattern.successRate + 0.2),
            suggestion: this.generateOptimizationSuggestion(pattern, currentIndex),
            reasoning: `Pattern occurs ${pattern.frequency} times with ${Math.round(pattern.successRate * 100)}% success rate`,
            implementation: {
              steps: this.generateOptimizationSteps(pattern, currentIndex),
              estimatedImpact: 0.2,
              effort: 'medium',
              userBenefit: 'Improved workflow efficiency and reduced context switching'
            }
          });
        }
      }
    });

    return optimizations;
  }

  private generateIntelligencePrompts(
    pageContext: PageContext,
    contextualInsights: ContextualInsight[],
    crossPageConnections: CrossPageConnection[]
  ): IntelligencePrompt[] {
    const prompts: IntelligencePrompt[] = [];

    // Page-specific prompts
    switch (pageContext.page) {
      case 'dashboard':
        prompts.push({
          id: 'strategic_synthesis',
          prompt: 'What are the key strategic patterns and insights across all my work?',
          category: 'strategic',
          pageOptimized: true,
          crossPageAware: true,
          contextualHints: [
            'Analyze cross-document themes',
            'Identify strategic opportunities',
            'Synthesize overarching patterns'
          ],
          expectedInsights: ['Strategic themes', 'Content gaps', 'Optimization opportunities']
        });
        break;

      case 'document':
        prompts.push({
          id: 'content_development',
          prompt: 'How can I strengthen and expand this section?',
          category: 'tactical',
          pageOptimized: true,
          crossPageAware: true,
          contextualHints: [
            'Consider document context',
            'Reference related work',
            'Suggest expansions'
          ],
          expectedInsights: ['Content improvements', 'Research suggestions', 'Structure optimizations']
        });
        break;

      case 'timeline':
        prompts.push({
          id: 'evolution_analysis',
          prompt: 'What patterns do you see in how my thinking has evolved?',
          category: 'analytical',
          pageOptimized: true,
          crossPageAware: true,
          contextualHints: [
            'Track temporal changes',
            'Identify development patterns',
            'Analyze progress trends'
          ],
          expectedInsights: ['Evolution patterns', 'Development trends', 'Future projections']
        });
        break;

      case 'detailed-view':
        prompts.push({
          id: 'technical_analysis',
          prompt: 'What technical insights and optimizations do you recommend?',
          category: 'analytical',
          pageOptimized: true,
          crossPageAware: false,
          contextualHints: [
            'Analyze technical substrate',
            'Identify performance issues',
            'Suggest optimizations'
          ],
          expectedInsights: ['Technical improvements', 'Performance optimizations', 'System insights']
        });
        break;
    }

    // Cross-page aware prompts
    if (crossPageConnections.length > 0) {
      prompts.push({
        id: 'cross_page_synthesis',
        prompt: 'How does my work on this page connect to insights from other areas?',
        category: 'analytical',
        pageOptimized: false,
        crossPageAware: true,
        contextualHints: [
          'Reference cross-page connections',
          'Synthesize insights across pages',
          'Identify relationship patterns'
        ],
        expectedInsights: ['Cross-page connections', 'Synthesis opportunities', 'Workflow insights']
      });
    }

    return prompts;
  }

  private mapConnectionType(type: string): CrossPageConnection['connectionType'] {
    const typeMap: Record<string, CrossPageConnection['connectionType']> = {
      'topic_continuation': 'content_flow',
      'page_transition': 'workflow_sequence',
      'insight_building': 'insight_building',
      'workflow_sequence': 'workflow_sequence'
    };
    return typeMap[type] || 'reference';
  }

  private generateOptimizationSuggestion(pattern: any, currentIndex: number): string {
    const suggestions = [
      `Consider consolidating ${pattern.sequence[currentIndex]} and ${pattern.sequence[currentIndex + 1]} workflows`,
      `Add transitional context when moving from ${pattern.sequence[currentIndex]} to next step`,
      `Optimize timing for ${pattern.sequence.join(' → ')} workflow`,
      'Consider breaking this workflow into smaller, more focused sessions'
    ];
    return suggestions[currentIndex % suggestions.length];
  }

  private generateOptimizationSteps(pattern: any, currentIndex: number): string[] {
    return [
      `Review current ${pattern.sequence[currentIndex]} workflow`,
      'Identify common friction points',
      'Implement transitional improvements',
      'Test optimized workflow',
      'Measure success rate improvement'
    ];
  }
}

// Global analyzer instance
export const enhancedPageIntelligenceAnalyzer = new EnhancedPageIntelligenceAnalyzer();