"use client";

import type { PageContext } from './pageContextDetection';
import type { ConversationTriggeredGeneration } from './conversationAnalyzer';
import type { RoutingDecision } from './adaptiveRouting';

/**
 * Enhanced conversation context with page-specific information
 */
export interface ContextualConversationRequest extends ConversationTriggeredGeneration {
  pageContext: PageContext;
  contextualHints: string[];
  intelligenceType: 'dashboard' | 'document' | 'timeline' | 'detailed-view' | 'general';
  
  // Enhanced adaptive routing fields
  routingDecision?: RoutingDecision;
  threadContext?: {
    recentMessages: any[];
    relatedIntelligence: any[];
    conversationTopic?: string;
    threadContinuity: boolean;
  };
  synthesisContext?: any;
}

/**
 * Page-specific intelligence strategies
 */
export interface IntelligenceStrategy {
  focusAreas: string[];
  analysisDepth: 'surface' | 'moderate' | 'deep';
  responseStyle: 'conversational' | 'analytical' | 'technical';
  suggestedPrompts: string[];
}

/**
 * Generate page-specific intelligence strategy
 */
export function getIntelligenceStrategy(pageContext: PageContext): IntelligenceStrategy {
  const { page, content, userActivity } = pageContext;

  switch (page) {
    case 'dashboard':
      return {
        focusAreas: [
          'Cross-document patterns',
          'Strategic insights',
          'Content gaps',
          'Theme evolution',
          'Synthesis opportunities'
        ],
        analysisDepth: 'moderate',
        responseStyle: 'analytical',
        suggestedPrompts: [
          'What patterns emerge across my documents?',
          'What strategic insights can you provide?',
          'Where are the gaps in my thinking?',
          'How have my themes evolved?',
          'What should I focus on next?'
        ]
      };

    case 'document':
      const isActivelyWriting = userActivity.recentEdits.length > 0 && userActivity.isActivelyEngaged;
      const hasSelection = !!userActivity.selectedText;
      
      return {
        focusAreas: [
          'Writing flow analysis',
          'Content coherence',
          'Section development',
          hasSelection ? 'Selected text analysis' : 'Expansion opportunities',
          isActivelyWriting ? 'Real-time assistance' : 'Content review'
        ],
        analysisDepth: 'deep',
        responseStyle: 'conversational',
        suggestedPrompts: [
          hasSelection ? 'What do you think about this selection?' : 'How can I expand this section?',
          'Is my writing flow coherent?',
          'What connections am I missing?',
          'How can I strengthen this argument?',
          isActivelyWriting ? 'Am I on the right track?' : 'What needs work in this document?'
        ]
      };

    case 'timeline':
      return {
        focusAreas: [
          'Temporal patterns',
          'Progress tracking',
          'Evolution analysis',
          'Milestone identification',
          'Trend prediction'
        ],
        analysisDepth: 'moderate',
        responseStyle: 'analytical',
        suggestedPrompts: [
          'What patterns do you see over time?',
          'How has my thinking evolved?',
          'What are the key milestones?',
          'Where am I making progress?',
          'What trends should I be aware of?'
        ]
      };

    case 'detailed-view':
      return {
        focusAreas: [
          'Technical substrate analysis',
          'Data quality assessment',
          'Processing insights',
          'System health',
          'Optimization opportunities'
        ],
        analysisDepth: 'deep',
        responseStyle: 'technical',
        suggestedPrompts: [
          'What does the substrate data tell us?',
          'Are there any data quality issues?',
          'How is the processing performing?',
          'What optimizations are possible?',
          'What technical insights emerge?'
        ]
      };

    default:
      return {
        focusAreas: ['General assistance', 'Context analysis'],
        analysisDepth: 'moderate',
        responseStyle: 'conversational',
        suggestedPrompts: [
          'What can you help me with?',
          'Analyze my current context',
          'What insights do you have?'
        ]
      };
  }
}

/**
 * Generate contextual hints for enhanced intelligence generation
 */
export function generateContextualHints(pageContext: PageContext): string[] {
  const { page, content, userActivity } = pageContext;
  const hints: string[] = [];

  // Page-specific hints
  hints.push(`User is currently on ${page} page`);

  // Activity hints
  if (userActivity.isActivelyEngaged) {
    hints.push('User is actively engaged');
    hints.push(`Recent activity: ${userActivity.lastAction}`);
  }

  if (userActivity.timeOnPage > 60000) { // > 1 minute
    const minutes = Math.floor(userActivity.timeOnPage / 60000);
    hints.push(`User has been on this page for ${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }

  // Content-specific hints
  switch (page) {
    case 'dashboard':
      if (content.basketOverview) {
        const { documentCount, totalWords, dominantThemes } = content.basketOverview;
        hints.push(`Workspace contains ${documentCount} documents with ${totalWords} words`);
        if (dominantThemes.length > 0) {
          hints.push(`Dominant themes: ${dominantThemes.join(', ')}`);
        }
      }
      break;

    case 'document':
      if (content.currentDocument) {
        const { title, wordCount, activeSection } = content.currentDocument;
        hints.push(`Working on document: "${title}" (${wordCount} words)`);
        if (activeSection) {
          hints.push(`Focus on section: ${activeSection}`);
        }
      }

      if (userActivity.selectedText) {
        hints.push(`User has selected text: "${userActivity.selectedText.text.substring(0, 100)}..."`);
      }

      if (userActivity.recentEdits.length > 0) {
        hints.push(`User made ${userActivity.recentEdits.length} recent edit${userActivity.recentEdits.length !== 1 ? 's' : ''}`);
      }
      break;

    case 'timeline':
      hints.push('User is viewing temporal evolution of their work');
      if (content.activeSection) {
        hints.push(`Timeline shows: ${content.activeSection}`);
      }
      break;

    case 'detailed-view':
      hints.push('User is examining technical substrate details');
      if (content.activeSection) {
        hints.push(`Analyzing: ${content.activeSection}`);
      }
      break;
  }

  // Behavioral hints
  if (userActivity.keystrokeCount > 50) {
    hints.push('User has been actively typing');
  }

  if (userActivity.scrollPosition > 0) {
    hints.push('User has scrolled through content');
  }

  return hints;
}

/**
 * Create enhanced conversation request with page context
 */
export function createContextualConversationRequest(
  conversationRequest: ConversationTriggeredGeneration,
  pageContext: PageContext
): ContextualConversationRequest {
  const strategy = getIntelligenceStrategy(pageContext);
  const contextualHints = generateContextualHints(pageContext);

  return {
    ...conversationRequest,
    pageContext,
    contextualHints,
    intelligenceType: pageContext.page === 'unknown' ? 'general' : pageContext.page
  };
}

/**
 * Generate context-aware follow-up suggestions
 */
export function generateFollowUpSuggestions(
  pageContext: PageContext,
  lastUserQuery?: string
): string[] {
  const strategy = getIntelligenceStrategy(pageContext);
  const suggestions: string[] = [];

  // Add base suggestions from strategy
  suggestions.push(...strategy.suggestedPrompts.slice(0, 3));

  // Add context-specific suggestions based on user activity
  if (pageContext.userActivity.selectedText) {
    suggestions.unshift('Analyze this selected text');
  }

  if (pageContext.userActivity.recentEdits.length > 0) {
    suggestions.push('Review my recent changes');
  }

  // Add query-specific follow-ups
  if (lastUserQuery) {
    const query = lastUserQuery.toLowerCase();
    
    if (query.includes('pattern')) {
      suggestions.push('Show me related patterns');
      suggestions.push('How do these patterns connect?');
    }
    
    if (query.includes('recommend')) {
      suggestions.push('Explain these recommendations');
      suggestions.push('What are the next steps?');
    }
    
    if (query.includes('write') || query.includes('expand')) {
      suggestions.push('Help me structure this better');
      suggestions.push('What examples would work here?');
    }
  }

  // Remove duplicates and limit to 5
  return [...new Set(suggestions)].slice(0, 5);
}

/**
 * Determine if context suggests proactive intelligence generation
 */
export function shouldTriggerProactiveAnalysis(
  pageContext: PageContext,
  timeSinceLastAnalysis: number
): boolean {
  const { page, userActivity } = pageContext;

  // Don't trigger if user just arrived
  if (userActivity.timeOnPage < 30000) return false; // < 30 seconds

  // Don't trigger if recently analyzed
  if (timeSinceLastAnalysis < 300000) return false; // < 5 minutes

  // Page-specific triggers
  switch (page) {
    case 'dashboard':
      // Trigger if user has been reviewing for a while
      return userActivity.timeOnPage > 120000 && // > 2 minutes
             userActivity.scrollPosition > 0;

    case 'document':
      // Trigger after significant editing
      return userActivity.recentEdits.length > 10 ||
             (userActivity.recentEdits.length > 5 && userActivity.timeOnPage > 300000); // > 5 minutes

    case 'timeline':
      // Trigger if user is exploring for insights
      return userActivity.timeOnPage > 90000; // > 1.5 minutes

    case 'detailed-view':
      // Trigger if user is deep diving
      return userActivity.timeOnPage > 180000; // > 3 minutes

    default:
      return false;
  }
}

/**
 * Generate proactive insight message
 */
export function generateProactiveInsight(pageContext: PageContext): string {
  const { page, userActivity } = pageContext;

  switch (page) {
    case 'dashboard':
      return "I've noticed you've been reviewing your workspace. Would you like me to analyze patterns across your documents?";

    case 'document':
      if (userActivity.recentEdits.length > 0) {
        return "You've been actively writing! Would you like me to review your recent changes and suggest improvements?";
      }
      return "I can help analyze this document's flow and suggest areas for development. Interested?";

    case 'timeline':
      return "I see you're exploring your timeline. I can identify key patterns and evolution trends if you'd like.";

    case 'detailed-view':
      return "Want me to analyze the technical substrate and provide optimization insights?";

    default:
      return "I'm here and ready to help with analysis or insights whenever you need them.";
  }
}