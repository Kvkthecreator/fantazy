/**
 * Language Transformation Utilities
 * 
 * Transforms technical substrate vocabulary into narrative intelligence language
 * for user-facing components.
 */

export const NARRATIVE_VOCABULARY = {
  // Entity transformations
  'block': 'insight',
  'blocks': 'insights',
  'context_item': 'key information', 
  'context_items': 'background knowledge',
  'raw_dump': 'initial thoughts',
  'raw_dumps': 'initial content',
  
  // Technical metrics → Human understanding
  'confidence_score': 'understanding strength',
  'confidence': 'understanding level',
  'analysis_results': 'discoveries',
  'semantic_analysis': 'pattern recognition',
  'thematic_analysis': 'theme exploration',
  'pattern_insights': 'discovered patterns',
  
  // Actions → Natural language
  'create_block': 'capture insight',
  'edit_block': 'refine understanding',
  'delete_block': 'remove insight',
  'view_analysis': 'explore discoveries',
  'analyze_basket': 'understand project',
  'process_dump': 'explore content',
  
  // States → Progress language
  'PROPOSED': 'discovered',
  'ACCEPTED': 'valuable', 
  'LOCKED': 'important',
  'CONSTANT': 'foundational',
  'DRAFT': 'developing',
  'PUBLISHED': 'ready',
  
  // Technical terms → Conversational
  'substrate': 'foundation',
  'coordination': 'working together',
  'infrastructure': 'behind the scenes',
  'orchestration': 'coordination',
  'agent_id': 'AI assistant',
  'workspace_id': 'project space'
};

export const CONFIDENCE_NARRATIVES = {
  'just_getting_started': {
    level: 'Getting to know your project',
    description: 'I\'m beginning to understand what you\'re working on',
    strength: 0.2,
    color: 'orange'
  },
  'building_understanding': {
    level: 'Building understanding',
    description: 'I\'m starting to see patterns and themes in your work',
    strength: 0.5,
    color: 'blue'
  },
  'solid_grasp': {
    level: 'Strong understanding',
    description: 'I have a solid grasp of your project and can offer meaningful insights',
    strength: 0.7,
    color: 'green'
  },
  'comprehensive_knowledge': {
    level: 'Deep understanding',
    description: 'I have comprehensive knowledge of your project and its nuances',
    strength: 0.9,
    color: 'emerald'
  }
};

export const HEALTH_NARRATIVES = {
  'excellent': {
    level: 'Thriving',
    description: 'Your project is well-developed with clear direction',
    color: 'emerald'
  },
  'good': {
    level: 'Healthy',
    description: 'Your project is developing well with good momentum',
    color: 'green'
  },
  'developing': {
    level: 'Growing',
    description: 'Your project is building foundation and finding direction',
    color: 'blue'
  },
  'needs_attention': {
    level: 'Starting',
    description: 'Your project is ready for more development and content',
    color: 'orange'
  }
};

export function transformToNarrativeLanguage(text: string): string {
  if (!text) return text;
  
  let transformed = text;
  
  // Apply vocabulary transformations
  Object.entries(NARRATIVE_VOCABULARY).forEach(([technical, narrative]) => {
    const regex = new RegExp(`\\b${technical}\\b`, 'gi');
    transformed = transformed.replace(regex, narrative);
  });
  
  return transformed;
}

export function transformConfidenceToNarrative(confidence: string | number): {
  level: string;
  description: string;
  strength: number;
  color: string;
} {
  // Handle numeric confidence scores
  if (typeof confidence === 'number') {
    if (confidence >= 0.9) return CONFIDENCE_NARRATIVES.comprehensive_knowledge;
    if (confidence >= 0.7) return CONFIDENCE_NARRATIVES.solid_grasp;
    if (confidence >= 0.4) return CONFIDENCE_NARRATIVES.building_understanding;
    return CONFIDENCE_NARRATIVES.just_getting_started;
  }
  
  // Handle string confidence levels
  const confidenceKey = confidence as keyof typeof CONFIDENCE_NARRATIVES;
  return CONFIDENCE_NARRATIVES[confidenceKey] || CONFIDENCE_NARRATIVES.just_getting_started;
}

export function transformHealthToNarrative(health: string): {
  level: string;
  description: string;
  color: string;
} {
  const healthKey = health as keyof typeof HEALTH_NARRATIVES;
  return HEALTH_NARRATIVES[healthKey] || HEALTH_NARRATIVES.needs_attention;
}

export function transformTimeframe(timeframe: string): string {
  const timeframeMap: Record<string, string> = {
    'immediate': 'right now',
    'short_term': 'in the next few days',
    'medium_term': 'over the coming weeks',
    'long_term': 'as your project evolves'
  };
  
  return timeframeMap[timeframe] || timeframe;
}

export function transformDifficulty(difficulty: string): {
  label: string;
  description: string;
  color: string;
} {
  const difficultyMap: Record<string, any> = {
    'beginner_friendly': {
      label: 'Easy start',
      description: 'Perfect for getting started',
      color: 'green'
    },
    'moderate_effort': {
      label: 'Some focus needed',
      description: 'Worth the investment',
      color: 'blue'
    },
    'advanced_focus': {
      label: 'Deep work',
      description: 'Requires concentrated effort',
      color: 'purple'
    }
  };
  
  return difficultyMap[difficulty] || {
    label: 'Standard effort',
    description: 'Regular development work',
    color: 'gray'
  };
}

export function formatActionAsNarrative(action: string): string {
  const actionMap: Record<string, string> = {
    'create': 'capture',
    'edit': 'refine',
    'delete': 'remove',
    'analyze': 'explore',
    'process': 'understand',
    'review': 'examine',
    'update': 'improve',
    'save': 'keep',
    'cancel': 'nevermind'
  };
  
  let transformed = action.toLowerCase();
  Object.entries(actionMap).forEach(([technical, narrative]) => {
    transformed = transformed.replace(technical, narrative);
  });
  
  return transformed.charAt(0).toUpperCase() + transformed.slice(1);
}

export function createProgressiveStory(
  mainInsight: string,
  reasoning?: string,
  technicalDetails?: any
): {
  story: string;
  reasoning?: string;
  substrate?: any;
} {
  return {
    story: transformToNarrativeLanguage(mainInsight),
    reasoning: reasoning ? transformToNarrativeLanguage(reasoning) : undefined,
    substrate: technicalDetails
  };
}