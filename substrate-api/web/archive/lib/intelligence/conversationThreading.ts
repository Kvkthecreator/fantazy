"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PageContext } from './pageContextDetection';
import type { SynthesisContext } from './crossPageSynthesis';
import type { ConversationTriggeredGeneration } from './conversationAnalyzer';

// Conversation threading types
export interface ConversationThread {
  id: string;
  startedAt: number;
  lastActivity: number;
  pageContext: PageContext;
  messages: ThreadMessage[];
  intelligenceRequests: IntelligenceRequest[];
  outcomes: ThreadOutcome[];
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  topic?: string;
  relatedThreads: string[];
}

export interface ThreadMessage {
  id: string;
  timestamp: number;
  type: 'user_input' | 'system_response' | 'intelligence_result' | 'context_note';
  content: string;
  metadata?: {
    pageContext?: PageContext;
    confidence?: number;
    responseTime?: number;
    userSatisfaction?: number;
  };
}

export interface IntelligenceRequest {
  id: string;
  timestamp: number;
  userQuery: string;
  pageContext: PageContext;
  response?: any;
  processingTime?: number;
  userFeedback?: 'helpful' | 'not_helpful' | 'partially_helpful';
  followUpGenerated?: boolean;
}

export interface ThreadOutcome {
  type: 'intelligence_approved' | 'intelligence_rejected' | 'context_added' | 'workflow_completed' | 'session_ended';
  timestamp: number;
  value?: any;
  impact?: 'high' | 'medium' | 'low';
}

export interface ConversationMemory {
  threads: ConversationThread[];
  patterns: ConversationPattern[];
  preferences: UserPreferences;
  contextConnections: ContextConnection[];
}

export interface ConversationPattern {
  pattern: string;
  frequency: number;
  averageOutcome: number; // 0-1 success rate
  commonFollowUps: string[];
  pageContexts: string[];
  timingPatterns: number[]; // Time between messages in pattern
}

interface UserPreferences {
  preferredResponseStyle: 'concise' | 'detailed' | 'analytical';
  frequentTopics: string[];
  optimalInteractionTiming: number;
  pagePreferences: Record<string, { 
    assistanceLevel: 'high' | 'medium' | 'low';
    preferredCapabilities: string[];
  }>;
}

interface ContextConnection {
  fromThread: string;
  toThread: string;
  connectionType: 'topic_continuation' | 'page_transition' | 'insight_building' | 'workflow_sequence';
  strength: number;
  sharedConcepts: string[];
  timeDelta: number;
}

/**
 * Hook for conversation threading and memory integration
 */
export function useConversationThreading(
  pageContext: PageContext,
  synthesisContext: SynthesisContext
) {
  const [conversationMemory, setConversationMemory] = useState<ConversationMemory>({
    threads: [],
    patterns: [],
    preferences: {
      preferredResponseStyle: 'detailed',
      frequentTopics: [],
      optimalInteractionTiming: 30000,
      pagePreferences: {}
    },
    contextConnections: []
  });

  const [activeThread, setActiveThread] = useState<ConversationThread | null>(null);
  const threadTimeout = useRef<NodeJS.Timeout | null>(null);
  const memoryPersistence = useRef<NodeJS.Timeout | null>(null);

  // Create or resume thread based on context
  const getOrCreateThread = useCallback((pageContext: PageContext): ConversationThread => {
    const now = Date.now();
    
    // Look for existing active thread on same page
    const existingThread = conversationMemory.threads.find(
      thread => thread.status === 'active' && 
                thread.pageContext.page === pageContext.page &&
                now - thread.lastActivity < 300000 // Within 5 minutes
    );

    if (existingThread) {
      return existingThread;
    }

    // Look for related threads that could be continued
    const relatedThread = conversationMemory.threads.find(
      thread => thread.status === 'paused' &&
                thread.pageContext.page === pageContext.page &&
                now - thread.lastActivity < 1800000 // Within 30 minutes
    );

    if (relatedThread) {
      return {
        ...relatedThread,
        status: 'active',
        lastActivity: now
      };
    }

    // Create new thread
    const newThread: ConversationThread = {
      id: `thread_${now}_${Math.random().toString(36).substr(2, 9)}`,
      startedAt: now,
      lastActivity: now,
      pageContext: { ...pageContext },
      messages: [],
      intelligenceRequests: [],
      outcomes: [],
      status: 'active',
      relatedThreads: findRelatedThreadIds(pageContext, conversationMemory.threads)
    };

    return newThread;
  }, [conversationMemory.threads]);

  // Add message to current thread
  const addMessage = useCallback((
    type: ThreadMessage['type'],
    content: string,
    metadata?: ThreadMessage['metadata']
  ) => {
    if (!activeThread) return;

    const message: ThreadMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      type,
      content,
      metadata: {
        ...metadata,
        pageContext: pageContext
      }
    };

    const updatedThread = {
      ...activeThread,
      messages: [...activeThread.messages, message],
      lastActivity: Date.now()
    };

    setActiveThread(updatedThread);
    updateThreadInMemory(updatedThread);
  }, [activeThread, pageContext]);

  // Record intelligence request
  const recordIntelligenceRequest = useCallback((
    userQuery: string,
    response?: any,
    processingTime?: number
  ): string => {
    if (!activeThread) return '';

    const request: IntelligenceRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      userQuery,
      pageContext: { ...pageContext },
      response,
      processingTime
    };

    const updatedThread = {
      ...activeThread,
      intelligenceRequests: [...activeThread.intelligenceRequests, request],
      lastActivity: Date.now()
    };

    setActiveThread(updatedThread);
    updateThreadInMemory(updatedThread);

    return request.id;
  }, [activeThread, pageContext]);

  // Record thread outcome
  const recordOutcome = useCallback((
    type: ThreadOutcome['type'],
    value?: any,
    impact?: ThreadOutcome['impact']
  ) => {
    if (!activeThread) return;

    const outcome: ThreadOutcome = {
      type,
      timestamp: Date.now(),
      value,
      impact: impact || 'medium'
    };

    const updatedThread = {
      ...activeThread,
      outcomes: [...activeThread.outcomes, outcome],
      lastActivity: Date.now()
    };

    setActiveThread(updatedThread);
    updateThreadInMemory(updatedThread);
  }, [activeThread]);

  // Update thread in memory
  const updateThreadInMemory = useCallback((thread: ConversationThread) => {
    setConversationMemory(prev => ({
      ...prev,
      threads: prev.threads.map(t => t.id === thread.id ? thread : t)
        .concat(prev.threads.find(t => t.id === thread.id) ? [] : [thread])
    }));
  }, []);

  // Analyze conversation patterns
  const analyzePatterns = useCallback(() => {
    const patterns: Map<string, ConversationPattern> = new Map();
    
    conversationMemory.threads.forEach(thread => {
      if (thread.messages.length < 2) return;

      // Extract conversation sequences
      for (let i = 0; i < thread.messages.length - 1; i++) {
        const current = thread.messages[i];
        const next = thread.messages[i + 1];
        
        if (current.type === 'user_input' && next.type === 'system_response') {
          const pattern = extractConversationPattern(current.content, next.content);
          const key = pattern.toLowerCase();
          
          const existing = patterns.get(key);
          if (existing) {
            existing.frequency++;
            existing.timingPatterns.push(next.timestamp - current.timestamp);
          } else {
            patterns.set(key, {
              pattern: pattern,
              frequency: 1,
              averageOutcome: calculateOutcomeScore(thread),
              commonFollowUps: extractFollowUps(thread, i),
              pageContexts: [thread.pageContext.page],
              timingPatterns: [next.timestamp - current.timestamp]
            });
          }
        }
      }
    });

    return Array.from(patterns.values())
      .filter(p => p.frequency >= 2)
      .sort((a, b) => b.frequency - a.frequency);
  }, [conversationMemory.threads]);

  // Build context connections between threads
  const buildContextConnections = useCallback((): ContextConnection[] => {
    const connections: ContextConnection[] = [];
    
    for (let i = 0; i < conversationMemory.threads.length; i++) {
      for (let j = i + 1; j < conversationMemory.threads.length; j++) {
        const thread1 = conversationMemory.threads[i];
        const thread2 = conversationMemory.threads[j];
        
        const connection = analyzeThreadConnection(thread1, thread2);
        if (connection.strength > 0.3) {
          connections.push(connection);
        }
      }
    }
    
    return connections.sort((a, b) => b.strength - a.strength);
  }, [conversationMemory.threads]);

  // Get thread context for current conversation
  const getThreadContext = useCallback((): {
    recentMessages: ThreadMessage[];
    relatedIntelligence: IntelligenceRequest[];
    conversationTopic?: string;
    threadContinuity: boolean;
  } => {
    if (!activeThread) {
      return {
        recentMessages: [],
        relatedIntelligence: [],
        threadContinuity: false
      };
    }

    const recentMessages = activeThread.messages.slice(-5); // Last 5 messages
    const relatedIntelligence = activeThread.intelligenceRequests.slice(-3); // Last 3 requests
    const threadContinuity = activeThread.relatedThreads.length > 0;
    
    // Extract conversation topic from messages
    const conversationTopic = extractConversationTopic(activeThread.messages);

    return {
      recentMessages,
      relatedIntelligence,
      conversationTopic,
      threadContinuity
    };
  }, [activeThread]);

  // Get contextual conversation history
  const getContextualHistory = useCallback((pageType?: string): ConversationThread[] => {
    return conversationMemory.threads
      .filter(thread => 
        !pageType || thread.pageContext.page === pageType
      )
      .filter(thread => 
        thread.intelligenceRequests.length > 0 || thread.outcomes.length > 0
      )
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, 10);
  }, [conversationMemory.threads]);

  // Start new conversation thread
  const startThread = useCallback((pageContext: PageContext) => {
    const thread = getOrCreateThread(pageContext);
    setActiveThread(thread);

    // Clear thread timeout
    if (threadTimeout.current) {
      clearTimeout(threadTimeout.current);
    }

    // Set timeout to pause thread after inactivity
    threadTimeout.current = setTimeout(() => {
      if (activeThread && activeThread.id === thread.id) {
        const pausedThread = { ...activeThread, status: 'paused' as const };
        setActiveThread(null);
        updateThreadInMemory(pausedThread);
      }
    }, 300000); // 5 minutes of inactivity

    return thread;
  }, [getOrCreateThread, activeThread, updateThreadInMemory]);

  // End current thread
  const endThread = useCallback((status: 'completed' | 'abandoned' = 'completed') => {
    if (!activeThread) return;

    const completedThread = {
      ...activeThread,
      status,
      lastActivity: Date.now()
    };

    updateThreadInMemory(completedThread);
    setActiveThread(null);

    if (threadTimeout.current) {
      clearTimeout(threadTimeout.current);
    }
  }, [activeThread, updateThreadInMemory]);

  // Initialize thread when page context changes
  useEffect(() => {
    if (pageContext.page !== 'unknown') {
      startThread(pageContext);
    }
  }, [pageContext.page, startThread]);

  // Update conversation patterns and connections periodically
  useEffect(() => {
    const updateAnalysis = () => {
      setConversationMemory(prev => ({
        ...prev,
        patterns: analyzePatterns(),
        contextConnections: buildContextConnections()
      }));
    };

    updateAnalysis();
    const interval = setInterval(updateAnalysis, 120000); // Every 2 minutes

    return () => clearInterval(interval);
  }, [analyzePatterns, buildContextConnections]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (threadTimeout.current) clearTimeout(threadTimeout.current);
      if (memoryPersistence.current) clearTimeout(memoryPersistence.current);
    };
  }, []);

  return {
    activeThread,
    conversationMemory,
    addMessage,
    recordIntelligenceRequest,
    recordOutcome,
    getThreadContext,
    getContextualHistory,
    startThread,
    endThread
  };
}

// Helper functions
function findRelatedThreadIds(pageContext: PageContext, threads: ConversationThread[]): string[] {
  return threads
    .filter(thread => 
      thread.pageContext.page === pageContext.page ||
      (thread.pageContext.page === 'dashboard' && pageContext.page !== 'dashboard') ||
      (pageContext.page === 'dashboard' && thread.pageContext.page !== 'dashboard')
    )
    .slice(-3)
    .map(thread => thread.id);
}

function extractConversationPattern(userInput: string, systemResponse: string): string {
  // Simple pattern extraction based on key phrases
  const userLower = userInput.toLowerCase();
  const systemLower = systemResponse.toLowerCase();

  if (userLower.includes('pattern') || userLower.includes('trend')) {
    return 'pattern_analysis';
  }
  if (userLower.includes('recommend') || userLower.includes('suggest')) {
    return 'recommendation_request';
  }
  if (userLower.includes('summary') || userLower.includes('overview')) {
    return 'summary_request';
  }
  if (userLower.includes('help') || userLower.includes('assist')) {
    return 'assistance_request';
  }
  if (systemLower.includes('insight') || systemLower.includes('analysis')) {
    return 'insight_generation';
  }

  return 'general_conversation';
}

function calculateOutcomeScore(thread: ConversationThread): number {
  if (thread.outcomes.length === 0) return 0.5;

  const positiveOutcomes = thread.outcomes.filter(
    outcome => outcome.type === 'intelligence_approved' || outcome.type === 'workflow_completed'
  ).length;

  return positiveOutcomes / thread.outcomes.length;
}

function extractFollowUps(thread: ConversationThread, messageIndex: number): string[] {
  const followUps: string[] = [];
  
  // Look for messages after the current one
  for (let i = messageIndex + 2; i < Math.min(messageIndex + 5, thread.messages.length); i++) {
    const message = thread.messages[i];
    if (message.type === 'user_input') {
      followUps.push(message.content.substring(0, 50));
    }
  }

  return followUps;
}

function analyzeThreadConnection(thread1: ConversationThread, thread2: ConversationThread): ContextConnection {
  let connectionType: ContextConnection['connectionType'] = 'workflow_sequence';
  let strength = 0;
  let sharedConcepts: string[] = [];

  // Analyze page relationship
  if (thread1.pageContext.page === thread2.pageContext.page) {
    strength += 0.3;
    connectionType = 'topic_continuation';
  } else {
    strength += 0.1;
    connectionType = 'page_transition';
  }

  // Analyze temporal relationship
  const timeDelta = Math.abs(thread1.lastActivity - thread2.lastActivity);
  if (timeDelta < 300000) { // Within 5 minutes
    strength += 0.3;
  } else if (timeDelta < 3600000) { // Within 1 hour
    strength += 0.2;
  }

  // Analyze content similarity
  const thread1Content = thread1.messages.map(m => m.content).join(' ').toLowerCase();
  const thread2Content = thread2.messages.map(m => m.content).join(' ').toLowerCase();
  
  const commonWords = findCommonWords(thread1Content, thread2Content);
  if (commonWords.length > 0) {
    strength += Math.min(0.4, commonWords.length * 0.1);
    sharedConcepts = commonWords.slice(0, 5);
    connectionType = 'insight_building';
  }

  return {
    fromThread: thread1.id,
    toThread: thread2.id,
    connectionType,
    strength: Math.min(1, strength),
    sharedConcepts,
    timeDelta
  };
}

function extractConversationTopic(messages: ThreadMessage[]): string | undefined {
  const userMessages = messages
    .filter(m => m.type === 'user_input')
    .map(m => m.content)
    .join(' ');

  if (!userMessages) return undefined;

  // Simple topic extraction based on frequent words
  const words = userMessages.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['what', 'how', 'when', 'where', 'why', 'that', 'this', 'with', 'from'].includes(word));

  const wordCount = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topWords = Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([word]) => word);

  return topWords.length > 0 ? topWords.join(' ') : undefined;
}

function findCommonWords(text1: string, text2: string): string[] {
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
  
  return Array.from(words1).filter(word => words2.has(word));
}