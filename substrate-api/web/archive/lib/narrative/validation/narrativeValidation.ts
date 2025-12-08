/**
 * Narrative Language Validation Utilities
 * Tools for validating narrative transformation completeness
 */

interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  score: number;
  suggestions: string[];
}

interface ValidationViolation {
  type: 'substrate_vocabulary' | 'technical_language' | 'ai_voice' | 'progressive_disclosure';
  message: string;
  location?: string;
  severity: 'error' | 'warning' | 'info';
}

// Substrate vocabulary that should be completely eliminated
const PROHIBITED_SUBSTRATE_TERMS = [
  // Technical infrastructure terms
  'blocks?', 'block\\s+type', 'semantic.*type', 'crud', 'api\\s+endpoint',
  'database', 'schema', 'metadata', 'payload', 'query', 'transaction',
  
  // System/process terms  
  'algorithm', 'process', 'execute', 'operation', 'function', 'method',
  'system', 'platform', 'service', 'application', 'implementation',
  
  // Data/analysis terms
  'confidence.*score', 'accuracy', 'precision', 'dataset', 'data.*point',
  'metrics', 'analytics', 'statistics', 'computation', 'calculation',
  
  // UI/UX technical terms
  'component', 'widget', 'interface', 'form.*field', 'input.*field',
  'dropdown', 'checkbox', 'modal.*dialog', 'popup', 'workflow',
  
  // Storage/memory terms
  'context.*items', 'memory.*items', 'storage', 'cache', 'buffer',
  'persistence', 'serialization', 'state.*management'
];

// Required narrative patterns that should be present
const REQUIRED_NARRATIVE_PATTERNS = [
  // First-person AI voice
  { pattern: /\bI\s+(can\s+see|understand|know|think|believe)/i, description: 'First-person AI perspective' },
  { pattern: /\bI('m|am)\s+(seeing|learning|discovering|working)/i, description: 'Active AI engagement' },
  
  // Collaborative language
  { pattern: /\b(we|us|our)\s+(can|will|should|might)/i, description: 'Collaborative partnership' },
  { pattern: /\b(let('s|us)|together)\s+/i, description: 'Collaborative action language' },
  
  // Human-centered language
  { pattern: /\b(your\s+(project|work|ideas|goals))/i, description: 'Human-centered focus' },
  { pattern: /\b(help|assist|support|guide)\s+you/i, description: 'Supportive assistance' }
];

// Conversational action patterns (vs technical actions)
const NARRATIVE_ACTION_PATTERNS = [
  { pattern: /\b(capture|share|explore|discover|review)\s+/i, description: 'Narrative action verbs' },
  { pattern: /\b(insight|understanding|knowledge|ideas)\b/i, description: 'Knowledge-focused terms' },
  { pattern: /\b(what\s+I\s+(know|understand|see))/i, description: 'AI knowledge expression' }
];

// Anti-patterns that indicate technical leakage
const TECHNICAL_ANTIPATTERNS = [
  { pattern: /\b(create|add|edit|delete|update)\s+(block|item|record)/i, description: 'CRUD language' },
  { pattern: /\b(data|information)\s+(processing|analysis|extraction)/i, description: 'Technical data language' },
  { pattern: /\b(the\s+system|the\s+algorithm|the\s+AI)\b/i, description: 'Third-person system language' },
  { pattern: /\b(execute|perform|run|process)\s+(operation|task|function)/i, description: 'Process execution language' }
];

export class NarrativeValidator {
  
  /**
   * Validate text content for narrative compliance
   */
  validateText(text: string, context?: string): ValidationResult {
    const violations: ValidationViolation[] = [];
    let score = 100;

    // Check for prohibited substrate vocabulary
    for (const term of PROHIBITED_SUBSTRATE_TERMS) {
      const regex = new RegExp(term, 'gi');
      const matches = text.match(regex);
      
      if (matches) {
        violations.push({
          type: 'substrate_vocabulary',
          message: `Found prohibited substrate term: "${matches[0]}"`,
          location: context,
          severity: 'error'
        });
        score -= 10;
      }
    }

    // Check for required narrative patterns
    let narrativePatternsFound = 0;
    for (const { pattern, description } of REQUIRED_NARRATIVE_PATTERNS) {
      if (pattern.test(text)) {
        narrativePatternsFound++;
      }
    }

    if (narrativePatternsFound === 0) {
      violations.push({
        type: 'ai_voice',
        message: 'No first-person AI voice patterns found',
        location: context,
        severity: 'error'
      });
      score -= 20;
    } else if (narrativePatternsFound === 1) {
      violations.push({
        type: 'ai_voice',
        message: 'Limited AI voice patterns - consider more conversational language',
        location: context,
        severity: 'warning'
      });
      score -= 10;
    }

    // Check for technical anti-patterns
    for (const { pattern, description } of TECHNICAL_ANTIPATTERNS) {
      if (pattern.test(text)) {
        violations.push({
          type: 'technical_language',
          message: `Found technical anti-pattern: ${description}`,
          location: context,
          severity: 'warning'
        });
        score -= 5;
      }
    }

    const suggestions = this.generateSuggestions(violations, text);

    return {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      score: Math.max(0, score),
      suggestions
    };
  }

  /**
   * Validate React component props for narrative compliance
   */
  validateComponentProps(props: Record<string, any>, componentName: string): ValidationResult {
    const violations: ValidationViolation[] = [];
    let score = 100;

    // Check labels and text props
    const textProps = ['label', 'title', 'description', 'placeholder', 'children'];
    
    for (const propName of textProps) {
      const propValue = props[propName];
      
      if (typeof propValue === 'string') {
        const textValidation = this.validateText(propValue, `${componentName}.${propName}`);
        violations.push(...textValidation.violations);
        score = Math.min(score, textValidation.score);
      }
    }

    // Check for narrative action types
    if (props.actions && Array.isArray(props.actions)) {
      for (const action of props.actions) {
        if (action.type && action.label) {
          const actionValidation = this.validateActionLanguage(action.type, action.label);
          violations.push(...actionValidation.violations.map(v => ({
            ...v,
            location: `${componentName}.actions[${action.type}]`
          })));
        }
      }
    }

    const suggestions = this.generateSuggestions(violations);

    return {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      score,
      suggestions
    };
  }

  /**
   * Validate action language for narrative compliance
   */
  validateActionLanguage(actionType: string, actionLabel: string): ValidationResult {
    const violations: ValidationViolation[] = [];
    let score = 100;

    // Check if action type uses narrative naming
    const technicalActionPatterns = [
      /^(create|add|edit|delete|update)_/i,
      /_(crud|api|db|sys)_?/i,
      /^(get|set|post|put|patch)_/i
    ];

    for (const pattern of technicalActionPatterns) {
      if (pattern.test(actionType)) {
        violations.push({
          type: 'substrate_vocabulary',
          message: `Action type "${actionType}" uses technical naming pattern`,
          severity: 'warning'
        });
        score -= 10;
      }
    }

    // Validate action label
    const labelValidation = this.validateText(actionLabel, `action.${actionType}`);
    violations.push(...labelValidation.violations);

    // Check for narrative action verbs
    const hasNarrativeVerb = NARRATIVE_ACTION_PATTERNS.some(({ pattern }) => 
      pattern.test(actionLabel)
    );

    if (!hasNarrativeVerb) {
      violations.push({
        type: 'technical_language',
        message: `Action label "${actionLabel}" lacks narrative action verbs`,
        severity: 'info'
      });
      score -= 5;
    }

    return {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      score: Math.min(score, labelValidation.score),
      suggestions: this.generateSuggestions(violations)
    };
  }

  /**
   * Validate progressive disclosure implementation
   */
  validateProgressiveDisclosure(component: any): ValidationResult {
    const violations: ValidationViolation[] = [];
    let score = 100;

    // Check for required progressive disclosure props
    const requiredProps = ['story'];
    const optionalProps = ['reasoning', 'substrate'];

    for (const prop of requiredProps) {
      if (!component.props || !component.props[prop]) {
        violations.push({
          type: 'progressive_disclosure',
          message: `Missing required progressive disclosure prop: ${prop}`,
          severity: 'error'
        });
        score -= 20;
      }
    }

    // Check story level language
    if (component.props?.story) {
      const storyValidation = this.validateText(component.props.story, 'progressive_disclosure.story');
      violations.push(...storyValidation.violations);
    }

    // Check reasoning level language
    if (component.props?.reasoning) {
      const reasoningValidation = this.validateText(component.props.reasoning, 'progressive_disclosure.reasoning');
      violations.push(...reasoningValidation.violations);
    }

    // Validate substrate data doesn't leak to story level
    if (component.props?.substrate && component.props?.story) {
      const story = component.props.story;
      
      // Check if technical substrate terms appear in story
      const technicalLeakPatterns = [
        /\d+\.\d+/, // Decimal numbers (confidence scores)
        /\b(id|uuid|timestamp)\b/i, // Technical identifiers
        /\b(json|object|array)\b/i, // Data structure terms
      ];

      for (const pattern of technicalLeakPatterns) {
        if (pattern.test(story)) {
          violations.push({
            type: 'progressive_disclosure',
            message: 'Technical substrate data leaked into story level',
            severity: 'warning'
          });
          score -= 10;
        }
      }
    }

    return {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      score,
      suggestions: this.generateSuggestions(violations)
    };
  }

  /**
   * Generate improvement suggestions based on violations
   */
  private generateSuggestions(violations: ValidationViolation[], text?: string): string[] {
    const suggestions: string[] = [];

    const hasSubstrateViolations = violations.some(v => v.type === 'substrate_vocabulary');
    const hasVoiceViolations = violations.some(v => v.type === 'ai_voice');
    const hasTechnicalViolations = violations.some(v => v.type === 'technical_language');

    if (hasSubstrateViolations) {
      suggestions.push('Replace technical substrate terms with conversational language');
      suggestions.push('Use human-centered language focused on goals and outcomes');
    }

    if (hasVoiceViolations) {
      suggestions.push('Add first-person AI voice ("I can see...", "I understand...")');
      suggestions.push('Use collaborative language ("we can...", "let\'s...")');
    }

    if (hasTechnicalViolations) {
      suggestions.push('Replace CRUD language with narrative actions (capture, explore, share)');
      suggestions.push('Focus on knowledge and insights rather than data processing');
    }

    if (text && text.length < 50) {
      suggestions.push('Consider adding more descriptive, conversational language');
    }

    return suggestions;
  }

  /**
   * Batch validate multiple components or text elements
   */
  validateBatch(items: Array<{ type: 'text' | 'component' | 'action', data: any, context?: string }>): ValidationResult {
    const allViolations: ValidationViolation[] = [];
    let totalScore = 0;
    let validItems = 0;

    for (const item of items) {
      let result: ValidationResult;

      switch (item.type) {
        case 'text':
          result = this.validateText(item.data, item.context);
          break;
        case 'component':
          result = this.validateComponentProps(item.data.props, item.data.name);
          break;
        case 'action':
          result = this.validateActionLanguage(item.data.type, item.data.label);
          break;
        default:
          continue;
      }

      allViolations.push(...result.violations);
      totalScore += result.score;
      if (result.isValid) validItems++;
    }

    const averageScore = items.length > 0 ? totalScore / items.length : 0;
    const suggestions = this.generateSuggestions(allViolations);

    return {
      isValid: allViolations.filter(v => v.severity === 'error').length === 0,
      violations: allViolations,
      score: averageScore,
      suggestions: [...new Set(suggestions)] // Remove duplicates
    };
  }
}

// Export singleton instance
export const narrativeValidator = new NarrativeValidator();

// Utility functions for common validation scenarios
export function validateNarrativeComponent(component: React.ReactElement): ValidationResult {
  return narrativeValidator.validateComponentProps(component.props || {}, component.type as string);
}

export function validateNarrativeText(text: string, context?: string): ValidationResult {
  return narrativeValidator.validateText(text, context);
}

export function isNarrativeCompliant(text: string): boolean {
  return narrativeValidator.validateText(text).isValid;
}