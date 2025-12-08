/**
 * Conversation Analyzer for Thinking Partner Integration
 * Determines whether user input should trigger intelligence generation or provide direct response
 */

export interface ConversationIntent {
  type: 'intelligence_generation' | 'direct_response' | 'clarification' | 'context_addition';
  confidence: number;
  triggerPhrase?: string;
  responseHint?: string;
  shouldGenerateIntelligence: boolean;
}

export interface ConversationContext {
  userInput: string;
  timestamp: string;
  conversationHistory?: string[];
}

// Patterns that indicate user wants intelligence generation/analysis
const INTELLIGENCE_GENERATION_PATTERNS = [
  // Analysis requests
  /what (patterns?|themes?|insights?) (do you see|emerge|are there)/i,
  /analyze (this|my|the)/i,
  /generate (analysis|insights?|intelligence|summary)/i,
  /what does (this|the data|my work) (tell|suggest|indicate|mean)/i,
  /summarize (what|my|the)/i,
  
  // Pattern detection
  /are there any (patterns?|themes?|connections?)/i,
  /what connections (do you see|are there)/i,
  /how does? (this|everything) (connect|relate|fit together)/i,
  
  // Strategic questions
  /what should I (focus on|prioritize|do next)/i,
  /what (are my|would be the) next steps?/i,
  /what (recommendations?|suggestions?) do you have/i,
  /help me (understand|make sense of)/i,
  
  // Synthesis requests
  /pull (this|everything) together/i,
  /make sense of (this|my work|everything)/i,
  /what story does (this|the data) tell/i,
  
  // Intelligence queries
  /what (do you think|would you recommend|insights emerge)/i,
  /how would you (analyze|interpret|summarize) this/i,
  /what stands out to you/i,
  
  // Framework/structure requests
  /create (a framework|structure|plan)/i,
  /organize (this|my thoughts|these ideas)/i,
  /structure (this|my thinking)/i
];

// Patterns that indicate direct response (no intelligence generation needed)
const DIRECT_RESPONSE_PATTERNS = [
  // Simple questions
  /^(what|who|when|where|how) (is|are|do|does|can|will)/i,
  /^(can you|will you|are you) (explain|tell me|help)/i,
  
  // Clarifications
  /what (do you mean|does that mean|is that)/i,
  /can you (clarify|explain)/i,
  /i don't understand/i,
  
  // Greetings and small talk
  /^(hi|hello|hey|thanks|thank you)/i,
  /how are you/i,
  
  // Simple confirmations
  /^(yes|no|ok|okay|sure|got it)/i,
  
  // Technical questions about the system
  /how (does this work|do I)/i,
  /what (can you do|are your capabilities)/i,
  /how do I (use|access|create)/i
];

// Context addition patterns (add to substrate but don't generate intelligence immediately)
const CONTEXT_ADDITION_PATTERNS = [
  /^(here is|here's|this is|i have)/i,
  /^(note|remember|keep in mind)/i,
  /^(add this|include this|consider this)/i,
  /^(context|background|fyi)/i
];

/**
 * Analyze user input to determine conversation intent
 */
export function analyzeConversationIntent(context: ConversationContext): ConversationIntent {
  const input = context.userInput.trim();
  
  // Check for intelligence generation patterns
  for (const pattern of INTELLIGENCE_GENERATION_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      return {
        type: 'intelligence_generation',
        confidence: 0.85,
        triggerPhrase: match[0],
        shouldGenerateIntelligence: true,
        responseHint: getIntelligenceGenerationHint(match[0])
      };
    }
  }
  
  // Check for context addition patterns
  for (const pattern of CONTEXT_ADDITION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        type: 'context_addition',
        confidence: 0.9,
        shouldGenerateIntelligence: false,
        responseHint: 'Add to context and provide acknowledgment'
      };
    }
  }
  
  // Check for direct response patterns
  for (const pattern of DIRECT_RESPONSE_PATTERNS) {
    if (pattern.test(input)) {
      return {
        type: 'direct_response',
        confidence: 0.8,
        shouldGenerateIntelligence: false,
        responseHint: 'Provide direct answer without intelligence generation'
      };
    }
  }
  
  // Fallback: if input is longer and doesn't match direct patterns, assume intelligence generation
  if (input.length > 50 && containsAnalyticalLanguage(input)) {
    return {
      type: 'intelligence_generation',
      confidence: 0.7,
      shouldGenerateIntelligence: true,
      responseHint: 'Complex request that likely needs intelligence analysis'
    };
  }
  
  // Default to clarification for ambiguous inputs
  return {
    type: 'clarification',
    confidence: 0.6,
    shouldGenerateIntelligence: false,
    responseHint: 'Ask for clarification or provide general help'
  };
}

/**
 * Get appropriate response hint for intelligence generation requests
 */
function getIntelligenceGenerationHint(triggerPhrase: string): string {
  if (!triggerPhrase || typeof triggerPhrase !== 'string') {
    return 'Generate insights from available content';
  }
  
  const phrase = triggerPhrase.toLowerCase();
  
  if (phrase.includes('pattern') || phrase.includes('theme')) {
    return 'Analyze content for patterns and themes';
  }
  
  if (phrase.includes('recommend') || phrase.includes('suggest') || phrase.includes('next step')) {
    return 'Generate strategic recommendations';
  }
  
  if (phrase.includes('analyze') || phrase.includes('summary') || phrase.includes('summarize')) {
    return 'Provide comprehensive analysis and summary';
  }
  
  if (phrase.includes('connect') || phrase.includes('relate') || phrase.includes('together')) {
    return 'Find connections and synthesize insights';
  }
  
  return 'Generate comprehensive intelligence analysis';
}

/**
 * Check if input contains analytical language suggesting intelligence generation
 */
function containsAnalyticalLanguage(input: string): boolean {
  const analyticalTerms = [
    'understand', 'insight', 'pattern', 'trend', 'analysis', 'strategy',
    'approach', 'framework', 'method', 'process', 'solution', 'option',
    'consider', 'evaluate', 'assess', 'determine', 'identify', 'develop'
  ];
  
  const lowerInput = input.toLowerCase();
  return analyticalTerms.some(term => lowerInput.includes(term));
}

/**
 * Generate conversation-triggered intelligence with context
 */
export interface ConversationTriggeredGeneration {
  userQuery: string;
  intent: ConversationIntent;
  timestamp: string;
  context: 'conversation';
}

/**
 * Create proper metadata for conversation-triggered intelligence generation
 */
export function createConversationGenerationRequest(
  context: ConversationContext,
  intent: ConversationIntent
): ConversationTriggeredGeneration {
  return {
    userQuery: context.userInput,
    intent,
    timestamp: context.timestamp,
    context: 'conversation'
  };
}

/**
 * Get appropriate loading message based on intent
 */
export function getLoadingMessage(intent: ConversationIntent): string {
  switch (intent.type) {
    case 'intelligence_generation':
      if (intent.triggerPhrase?.toLowerCase().includes('pattern')) {
        return 'Analyzing patterns in your content...';
      }
      if (intent.triggerPhrase?.toLowerCase().includes('recommend')) {
        return 'Generating strategic recommendations...';
      }
      if (intent.triggerPhrase?.toLowerCase().includes('summary')) {
        return 'Creating comprehensive summary...';
      }
      return 'Generating insights from your content...';
    
    case 'context_addition':
      return 'Adding to your workspace context...';
    
    default:
      return 'Processing your request...';
  }
}

/**
 * Generate modal title based on conversation intent
 */
export function getModalTitle(intent: ConversationIntent): string {
  if (intent.triggerPhrase?.toLowerCase().includes('pattern')) {
    return 'Pattern Analysis Results';
  }
  if (intent.triggerPhrase?.toLowerCase().includes('recommend')) {
    return 'Strategic Recommendations';
  }
  if (intent.triggerPhrase?.toLowerCase().includes('summary')) {
    return 'Content Summary';
  }
  return 'Intelligence Analysis Results';
}

/**
 * Generate modal description based on conversation context
 */
export function getModalDescription(userQuery: string, intent: ConversationIntent): string {
  const baseDescription = `Based on your question: "${userQuery}"`;
  
  switch (intent.type) {
    case 'intelligence_generation':
      return `${baseDescription} - Review the generated insights and analysis.`;
    default:
      return baseDescription;
  }
}