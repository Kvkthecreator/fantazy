"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PageContext } from './pageContextDetection';
import type { BehavioralContext } from './behavioralTriggers';
import type { SubstrateIntelligence } from '@/lib/substrate/types';
import { performanceManager, useOptimizedComputation, useThrottledCallback } from './performanceOptimizations';

// Cross-page synthesis types
export interface PageSession {
  page: string;
  startTime: number;
  endTime?: number;
  interactions: PageInteraction[];
  keyInsights: string[];
  activitySummary: {
    timeSpent: number;
    keystrokeCount: number;
    scrollDistance: number;
    focusAreas: string[];
  };
}

export interface PageInteraction {
  type: 'intelligence_request' | 'text_selection' | 'document_edit' | 'navigation' | 'search';
  timestamp: number;
  content?: string;
  context?: Record<string, any>;
  outcome?: 'successful' | 'abandoned' | 'rejected';
}

export interface CrossPageInsight {
  id: string;
  type: 'pattern_connection' | 'workflow_optimization' | 'content_gap' | 'strategic_synthesis';
  confidence: number;
  description: string;
  involvedPages: string[];
  evidence: {
    sessions: PageSession[];
    interactions: PageInteraction[];
    timingPatterns: number[];
  };
  actionableRecommendation?: string;
  priority: 'high' | 'medium' | 'low';
  expiresAt: number;
}

export interface SynthesisContext {
  currentSession: PageSession | null;
  recentSessions: PageSession[];
  activeInsights: CrossPageInsight[];
  workflowPatterns: WorkflowPattern[];
  memoryConnections: MemoryConnection[];
}

export interface WorkflowPattern {
  sequence: string[]; // Array of page types in order
  frequency: number;
  avgDuration: number;
  successRate: number;
  commonOutcomes: string[];
}

export interface MemoryConnection {
  fromPage: string;
  toPage: string;
  connectionType: 'content_reference' | 'insight_building' | 'workflow_continuation';
  strength: number; // 0-1
  lastUsed: number;
  contexts: string[];
}

/**
 * Hook for cross-page intelligence synthesis and memory
 */
export function useCrossPageSynthesis(
  pageContext: PageContext,
  behavioralContext: BehavioralContext | null,
  currentIntelligence?: SubstrateIntelligence | null
) {
  const [synthesisContext, setSynthesisContext] = useState<SynthesisContext>({
    currentSession: null,
    recentSessions: [],
    activeInsights: [],
    workflowPatterns: [],
    memoryConnections: []
  });

  const sessionsHistory = useRef<PageSession[]>([]);
  const insightGeneration = useRef<NodeJS.Timeout | null>(null);

  // Throttled synthesis context updates for performance
  const throttledUpdateSynthesis = useThrottledCallback(
    (updater: (context: SynthesisContext) => SynthesisContext) => {
      setSynthesisContext(updater);
    },
    1000, // 1 second throttle for synthesis updates
    []
  );

  // Build workflow patterns from session history - defined early to avoid temporal dead zone
  const analyzeWorkflowPatterns = useCallback((): WorkflowPattern[] => {
    const patterns: Map<string, { count: number; durations: number[]; outcomes: string[] }> = new Map();
    
    // Look for sequences of 2-4 pages
    for (let seqLength = 2; seqLength <= 4; seqLength++) {
      for (let i = 0; i <= sessionsHistory.current.length - seqLength; i++) {
        const sequence = sessionsHistory.current
          .slice(i, i + seqLength)
          .map(s => s.page);
        
        const key = sequence.join(' → ');
        const existing = patterns.get(key) || { count: 0, durations: [], outcomes: [] };
        
        existing.count++;
        existing.durations.push(
          sessionsHistory.current.slice(i, i + seqLength)
            .reduce((sum, s) => sum + s.activitySummary.timeSpent, 0)
        );
        
        // Determine outcome based on final session interactions
        const finalSession = sessionsHistory.current[i + seqLength - 1];
        const hasSuccessfulInteraction = finalSession.interactions.some(
          interaction => interaction.outcome === 'successful'
        );
        existing.outcomes.push(hasSuccessfulInteraction ? 'successful' : 'incomplete');
        
        patterns.set(key, existing);
      }
    }

    return Array.from(patterns.entries())
      .filter(([_, data]) => data.count >= 2) // Only patterns that occurred at least twice
      .map(([sequence, data]) => ({
        sequence: sequence.split(' → '),
        frequency: data.count,
        avgDuration: data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length,
        successRate: data.outcomes.filter(o => o === 'successful').length / data.outcomes.length,
        commonOutcomes: [...new Set(data.outcomes)]
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }, []);

  // Optimized cross-page insight generation with caching
  const optimizedInsightGeneration = useOptimizedComputation(
    () => {
      if (!behavioralContext || sessionsHistory.current.length < 2) {
        return [];
      }
      // Return current active insights from synthesis context
      return synthesisContext.activeInsights;
    },
    [behavioralContext, currentIntelligence, sessionsHistory.current.length, synthesisContext.activeInsights],
    `cross_page_insights_${pageContext.page}`
  );

  // Optimized workflow pattern detection with caching
  const optimizedWorkflowPatterns = useOptimizedComputation(
    () => {
      return analyzeWorkflowPatterns();
    },
    [sessionsHistory.current.length],
    `workflow_patterns_${pageContext.page}`
  );

  // Track page sessions
  useEffect(() => {
    if (pageContext.page === 'unknown') return;

    // End current session if page changed
    if (synthesisContext.currentSession && 
        synthesisContext.currentSession.page !== pageContext.page) {
      
      const completedSession: PageSession = {
        ...synthesisContext.currentSession,
        endTime: Date.now(),
        activitySummary: {
          ...synthesisContext.currentSession.activitySummary,
          timeSpent: Date.now() - synthesisContext.currentSession.startTime
        }
      };

      sessionsHistory.current.push(completedSession);
      
      // Keep only last 20 sessions
      if (sessionsHistory.current.length > 20) {
        sessionsHistory.current.shift();
      }
    }

    // Start new session
    const newSession: PageSession = {
      page: pageContext.page,
      startTime: Date.now(),
      interactions: [],
      keyInsights: [],
      activitySummary: {
        timeSpent: 0,
        keystrokeCount: pageContext.userActivity.keystrokeCount,
        scrollDistance: pageContext.userActivity.scrollPosition,
        focusAreas: []
      }
    };

    setSynthesisContext(prev => ({
      ...prev,
      currentSession: newSession,
      recentSessions: sessionsHistory.current.slice(-10)
    }));
  }, [pageContext.page]);

  // Track interactions within current session
  const recordInteraction = useCallback((interaction: Omit<PageInteraction, 'timestamp'>) => {
    if (!synthesisContext.currentSession) return;

    const fullInteraction: PageInteraction = {
      ...interaction,
      timestamp: Date.now()
    };

    setSynthesisContext(prev => {
      if (!prev.currentSession) return prev;

      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          interactions: [...prev.currentSession.interactions, fullInteraction],
          activitySummary: {
            ...prev.currentSession.activitySummary,
            keystrokeCount: pageContext.userActivity.keystrokeCount,
            scrollDistance: Math.max(
              prev.currentSession.activitySummary.scrollDistance,
              pageContext.userActivity.scrollPosition
            )
          }
        }
      };
    });
  }, [synthesisContext.currentSession, pageContext.userActivity]);

  // Auto-record significant user activities
  useEffect(() => {
    if (pageContext.userActivity.selectedText) {
      recordInteraction({
        type: 'text_selection',
        content: pageContext.userActivity.selectedText.text.substring(0, 200)
      });
    }
  }, [pageContext.userActivity.selectedText, recordInteraction]);

  useEffect(() => {
    if (pageContext.userActivity.recentEdits.length > 0) {
      const latestEdit = pageContext.userActivity.recentEdits[pageContext.userActivity.recentEdits.length - 1];
      recordInteraction({
        type: 'document_edit',
        content: latestEdit.content,
        context: { action: latestEdit.action, position: latestEdit.position }
      });
    }
  }, [pageContext.userActivity.recentEdits, recordInteraction]);

  // Generate cross-page insights periodically
  const generateCrossPageInsights = useCallback(() => {
    const allSessions = [...sessionsHistory.current, synthesisContext.currentSession].filter(Boolean) as PageSession[];
    if (allSessions.length < 2) return;

    const insights: CrossPageInsight[] = [];
    const now = Date.now();

    // Pattern: Frequent dashboard → document workflow
    const dashboardToDocumentSessions = allSessions.filter((session, index) => {
      const nextSession = allSessions[index + 1];
      return session.page === 'dashboard' && nextSession?.page === 'document' &&
             nextSession.startTime - (session.endTime || session.startTime) < 300000; // Within 5 minutes
    });

    if (dashboardToDocumentSessions.length >= 3) {
      insights.push({
        id: `workflow_pattern_${now}`,
        type: 'workflow_optimization',
        confidence: 0.8,
        description: 'Strong pattern detected: Dashboard review → Document editing workflow',
        involvedPages: ['dashboard', 'document'],
        evidence: {
          sessions: dashboardToDocumentSessions.slice(-5),
          interactions: [],
          timingPatterns: dashboardToDocumentSessions.map(s => s.activitySummary.timeSpent)
        },
        actionableRecommendation: 'Consider dashboard insights when starting document work',
        priority: 'medium',
        expiresAt: now + 3600000 // 1 hour
      });
    }

    // Pattern: Content gaps between pages
    const documentSessions = allSessions.filter(s => s.page === 'document');
    const timelineSessions = allSessions.filter(s => s.page === 'timeline');
    
    if (documentSessions.length > 0 && timelineSessions.length > 0) {
      const hasTimelineAfterDocument = allSessions.some((session, index) => {
        const nextSession = allSessions[index + 1];
        return session.page === 'document' && nextSession?.page === 'timeline';
      });

      if (!hasTimelineAfterDocument && documentSessions.length > 3) {
        insights.push({
          id: `content_gap_${now}`,
          type: 'content_gap',
          confidence: 0.7,
          description: 'Heavy document editing without timeline review - missing temporal perspective',
          involvedPages: ['document', 'timeline'],
          evidence: {
            sessions: [...documentSessions.slice(-3), ...timelineSessions.slice(-2)],
            interactions: [],
            timingPatterns: []
          },
          actionableRecommendation: 'Review timeline to see how current work fits evolution',
          priority: 'high',
          expiresAt: now + 7200000 // 2 hours
        });
      }
    }

    // Pattern: Cross-page intelligence connections
    const intelligenceInteractions = allSessions.flatMap(s => 
      s.interactions.filter(i => i.type === 'intelligence_request')
    );

    if (intelligenceInteractions.length > 2) {
      const pageGroups = intelligenceInteractions.reduce((acc, interaction) => {
        const sessionPage = allSessions.find(s => 
          s.interactions.includes(interaction)
        )?.page;
        if (sessionPage) {
          acc[sessionPage] = (acc[sessionPage] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const multiPageIntelligence = Object.keys(pageGroups).length > 1;
      
      if (multiPageIntelligence) {
        insights.push({
          id: `synthesis_opportunity_${now}`,
          type: 'strategic_synthesis',
          confidence: 0.9,
          description: `Intelligence requests across ${Object.keys(pageGroups).join(', ')} - synthesis opportunity`,
          involvedPages: Object.keys(pageGroups),
          evidence: {
            sessions: allSessions.filter(s => s.interactions.some(i => i.type === 'intelligence_request')),
            interactions: intelligenceInteractions,
            timingPatterns: []
          },
          actionableRecommendation: 'Connect insights across different views for deeper understanding',
          priority: 'high',
          expiresAt: now + 3600000 // 1 hour
        });
      }
    }

    // Update synthesis context with new insights
    setSynthesisContext(prev => ({
      ...prev,
      activeInsights: [
        ...prev.activeInsights.filter(insight => insight.expiresAt > now),
        ...insights
      ]
    }));

  }, [synthesisContext.currentSession]);

  // Generate insights periodically
  useEffect(() => {
    if (insightGeneration.current) {
      clearInterval(insightGeneration.current);
    }

    insightGeneration.current = setInterval(() => {
      generateCrossPageInsights();
    }, 60000); // Every minute

    return () => {
      if (insightGeneration.current) {
        clearInterval(insightGeneration.current);
      }
    };
  }, [generateCrossPageInsights]);

  // Build memory connections between pages
  const buildMemoryConnections = useCallback((): MemoryConnection[] => {
    const connections: Map<string, MemoryConnection> = new Map();
    
    // Analyze session transitions
    for (let i = 0; i < sessionsHistory.current.length - 1; i++) {
      const fromSession = sessionsHistory.current[i];
      const toSession = sessionsHistory.current[i + 1];
      
      if (!fromSession.endTime || !toSession.startTime) continue;
      
      const transitionTime = toSession.startTime - fromSession.endTime;
      const key = `${fromSession.page} → ${toSession.page}`;
      
      let connectionType: MemoryConnection['connectionType'] = 'workflow_continuation';
      
      // Determine connection type based on transition patterns
      if (transitionTime < 30000) { // Quick transition < 30 seconds
        connectionType = 'content_reference';
      } else if (fromSession.interactions.some(i => i.type === 'intelligence_request')) {
        connectionType = 'insight_building';
      }
      
      const existing = connections.get(key);
      if (existing) {
        existing.strength = Math.min(1, existing.strength + 0.1);
        existing.lastUsed = toSession.startTime;
      } else {
        connections.set(key, {
          fromPage: fromSession.page,
          toPage: toSession.page,
          connectionType,
          strength: 0.3,
          lastUsed: toSession.startTime,
          contexts: [fromSession.page, toSession.page]
        });
      }
    }
    
    return Array.from(connections.values())
      .filter(conn => conn.strength > 0.2)
      .sort((a, b) => b.strength - a.strength);
  }, []);

  // Update workflow patterns and memory connections periodically
  useEffect(() => {
    const updatePatterns = () => {
      setSynthesisContext(prev => ({
        ...prev,
        workflowPatterns: analyzeWorkflowPatterns(),
        memoryConnections: buildMemoryConnections()
      }));
    };

    updatePatterns();
    const interval = setInterval(updatePatterns, 300000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [analyzeWorkflowPatterns, buildMemoryConnections]);

  // Get contextual recommendations based on current state
  const getContextualRecommendations = useCallback((): string[] => {
    const recommendations: string[] = [];
    const currentPage = pageContext.page;
    
    // Check for relevant workflow patterns
    const relevantPatterns = synthesisContext.workflowPatterns.filter(
      pattern => pattern.sequence[0] === currentPage && pattern.successRate > 0.6
    );
    
    if (relevantPatterns.length > 0) {
      const bestPattern = relevantPatterns[0];
      const nextPage = bestPattern.sequence[1];
      recommendations.push(`Consider moving to ${nextPage} next - this workflow has ${Math.round(bestPattern.successRate * 100)}% success rate`);
    }

    // Check for memory connections
    const strongConnections = synthesisContext.memoryConnections.filter(
      conn => conn.fromPage === currentPage && conn.strength > 0.7
    );

    if (strongConnections.length > 0) {
      const connection = strongConnections[0];
      recommendations.push(`Strong connection to ${connection.toPage} - consider cross-referencing insights`);
    }

    // Check active insights
    const relevantInsights = synthesisContext.activeInsights.filter(
      insight => insight.involvedPages.includes(currentPage) && insight.priority === 'high'
    );

    relevantInsights.forEach(insight => {
      if (insight.actionableRecommendation) {
        recommendations.push(insight.actionableRecommendation);
      }
    });

    return recommendations.slice(0, 3); // Limit to top 3 recommendations
  }, [pageContext.page, synthesisContext]);

  // Check if synthesis opportunities exist
  const hasSynthesisOpportunities = useCallback((): boolean => {
    return synthesisContext.activeInsights.some(
      insight => insight.type === 'strategic_synthesis' || insight.type === 'pattern_connection'
    );
  }, [synthesisContext.activeInsights]);

  return {
    synthesisContext,
    recordInteraction,
    generateCrossPageInsights,
    getContextualRecommendations,
    hasSynthesisOpportunities
  };
}

/**
 * Generate synthesis trigger message based on cross-page context
 */
export function generateSynthesisMessage(
  synthesisContext: SynthesisContext,
  pageContext: PageContext
): string | null {
  const relevantInsights = synthesisContext.activeInsights.filter(
    insight => insight.involvedPages.includes(pageContext.page)
  );

  if (relevantInsights.length === 0) return null;

  const highPriorityInsight = relevantInsights.find(insight => insight.priority === 'high');
  
  if (highPriorityInsight) {
    switch (highPriorityInsight.type) {
      case 'strategic_synthesis':
        return "I'm seeing connections across your work that could unlock deeper insights. Ready to synthesize?";
      
      case 'content_gap':
        return "I notice you might be missing a perspective that could strengthen this work. Explore?";
        
      case 'pattern_connection':
        return "Strong patterns are emerging across your pages. Want to connect the dots?";
        
      case 'workflow_optimization':
        return "I've identified ways to optimize your workflow based on your patterns. Interested?";
    }
  }

  return "Cross-page insights are ready for synthesis.";
}

/**
 * Get synthesis-enhanced intelligence prompt
 */
export function enhancePromptWithSynthesis(
  originalPrompt: string,
  synthesisContext: SynthesisContext,
  pageContext: PageContext
): string {
  const relevantSessions = synthesisContext.recentSessions.filter(
    session => session.page !== pageContext.page
  ).slice(-3);

  const workflowContext = synthesisContext.workflowPatterns
    .filter(pattern => pattern.sequence.includes(pageContext.page))
    .slice(0, 2);

  const memoryConnections = synthesisContext.memoryConnections
    .filter(conn => conn.fromPage === pageContext.page || conn.toPage === pageContext.page)
    .slice(0, 3);

  let enhancedPrompt = originalPrompt;

  if (relevantSessions.length > 0) {
    enhancedPrompt += `\n\nCross-page context: User recently worked on ${relevantSessions.map(s => s.page).join(', ')} with ${relevantSessions.reduce((sum, s) => sum + s.interactions.length, 0)} interactions.`;
  }

  if (workflowContext.length > 0) {
    enhancedPrompt += `\n\nWorkflow patterns: User frequently follows ${workflowContext[0].sequence.join(' → ')} pattern (${Math.round(workflowContext[0].successRate * 100)}% success rate).`;
  }

  if (memoryConnections.length > 0) {
    const strongConnection = memoryConnections[0];
    enhancedPrompt += `\n\nMemory connections: Strong link between ${strongConnection.fromPage} and ${strongConnection.toPage} (${strongConnection.connectionType}).`;
  }

  return enhancedPrompt;
}