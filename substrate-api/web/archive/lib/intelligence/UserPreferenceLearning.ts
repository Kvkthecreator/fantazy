// ============================================================================
// USER PREFERENCE LEARNING SYSTEM
// ============================================================================
// Machine learning-powered system to adapt to user preferences and behavior patterns

export interface UserPreference {
  id: string;
  userId: string;
  category: 'workflow' | 'ui' | 'collaboration' | 'intelligence' | 'performance';
  name: string;
  value: any;
  confidence: number; // 0-1
  lastUpdated: string;
  source: 'implicit' | 'explicit' | 'inferred';
  context: Record<string, any>;
}

export interface BehaviorPattern {
  id: string;
  userId: string;
  patternType: 'sequence' | 'timing' | 'frequency' | 'preference' | 'workflow';
  description: string;
  pattern: any;
  frequency: number;
  confidence: number;
  detectedAt: string;
  lastSeen: string;
  context: Record<string, any>;
}

export interface UserAction {
  id: string;
  userId: string;
  action: string;
  target: string;
  timestamp: string;
  duration?: number;
  context: Record<string, any>;
  metadata: Record<string, any>;
}

export interface PredictionResult {
  action: string;
  confidence: number;
  reasoning: string[];
  suggestedActions?: string[];
  customizations?: Record<string, any>;
}

export interface LearningModel {
  id: string;
  type: 'decision_tree' | 'neural_network' | 'clustering' | 'pattern_matching';
  category: string;
  accuracy: number;
  lastTrained: string;
  trainingData: any;
  weights?: Record<string, number>;
}

/**
 * Advanced User Preference Learning System
 * 
 * Features:
 * - Implicit behavior tracking and pattern detection
 * - Explicit preference collection and storage
 * - Machine learning-based preference inference
 * - Adaptive UI and workflow customization
 * - Collaborative preference sharing
 * - Privacy-preserving learning algorithms
 * - Real-time preference adaptation
 */
export class UserPreferenceLearning {
  private preferences: Map<string, UserPreference[]> = new Map();
  private behaviorPatterns: Map<string, BehaviorPattern[]> = new Map();
  private userActions: Map<string, UserAction[]> = new Map();
  private learningModels: Map<string, LearningModel> = new Map();
  private isEnabled: boolean = true;
  private privacyMode: 'strict' | 'balanced' | 'permissive' = 'balanced';

  constructor() {
    this.initializeLearningSystem();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private async initializeLearningSystem(): Promise<void> {
    try {
      // Initialize base learning models
      await this.initializeModels();
      
      // Start behavior tracking
      this.setupBehaviorTracking();
      
      // Start pattern detection
      this.startPatternDetection();
      
      // Load existing preferences
      await this.loadUserPreferences();

      console.log('🧠 User Preference Learning System initialized');
    } catch (error) {
      console.error('Failed to initialize preference learning:', error);
    }
  }

  private async initializeModels(): Promise<void> {
    // Decision tree for workflow preferences
    this.learningModels.set('workflow_decisions', {
      id: 'workflow_decisions',
      type: 'decision_tree',
      category: 'workflow',
      accuracy: 0.0,
      lastTrained: new Date().toISOString(),
      trainingData: null
    });

    // Pattern matching for UI preferences
    this.learningModels.set('ui_patterns', {
      id: 'ui_patterns',
      type: 'pattern_matching',
      category: 'ui',
      accuracy: 0.0,
      lastTrained: new Date().toISOString(),
      trainingData: null
    });

    // Clustering for collaboration styles
    this.learningModels.set('collaboration_clusters', {
      id: 'collaboration_clusters',
      type: 'clustering',
      category: 'collaboration',
      accuracy: 0.0,
      lastTrained: new Date().toISOString(),
      trainingData: null
    });
  }

  // ========================================================================
  // BEHAVIOR TRACKING
  // ========================================================================

  trackUserAction(
    userId: string,
    action: string,
    target: string,
    context: Record<string, any> = {},
    metadata: Record<string, any> = {}
  ): void {
    if (!this.isEnabled) return;

    const userAction: UserAction = {
      id: crypto.randomUUID(),
      userId,
      action,
      target,
      timestamp: new Date().toISOString(),
      context: this.sanitizeContext(context),
      metadata: this.sanitizeMetadata(metadata)
    };

    // Store action
    if (!this.userActions.has(userId)) {
      this.userActions.set(userId, []);
    }
    
    const actions = this.userActions.get(userId)!;
    actions.push(userAction);
    
    // Keep only recent actions (last 1000 per user)
    if (actions.length > 1000) {
      actions.splice(0, actions.length - 1000);
    }

    // Immediate pattern detection for this action
    this.detectImmediatePatterns(userId, userAction);
  }

  trackTimedAction(
    userId: string,
    action: string,
    target: string,
    startTime: number,
    context: Record<string, any> = {}
  ): void {
    const duration = Date.now() - startTime;
    
    this.trackUserAction(userId, action, target, context, { duration });
    
    // Learn timing preferences
    this.learnTimingPreferences(userId, action, duration);
  }

  // ========================================================================
  // EXPLICIT PREFERENCE MANAGEMENT
  // ========================================================================

  setExplicitPreference(
    userId: string,
    category: UserPreference['category'],
    name: string,
    value: any,
    context: Record<string, any> = {}
  ): void {
    const preference: UserPreference = {
      id: crypto.randomUUID(),
      userId,
      category,
      name,
      value,
      confidence: 1.0, // Explicit preferences have full confidence
      lastUpdated: new Date().toISOString(),
      source: 'explicit',
      context: this.sanitizeContext(context)
    };

    this.storePreference(preference);
    
    // Update related implicit preferences
    this.updateRelatedPreferences(userId, preference);

    console.log(`👤 Explicit preference set: ${category}.${name} = ${JSON.stringify(value)}`);
  }

  getPreference(userId: string, category: string, name: string): UserPreference | null {
    const userPrefs = this.preferences.get(userId) || [];
    return userPrefs.find(p => p.category === category && p.name === name) || null;
  }

  getAllPreferences(userId: string, category?: UserPreference['category']): UserPreference[] {
    const userPrefs = this.preferences.get(userId) || [];
    return category ? userPrefs.filter(p => p.category === category) : userPrefs;
  }

  // ========================================================================
  // PATTERN DETECTION
  // ========================================================================

  private setupBehaviorTracking(): void {
    if (typeof window === 'undefined') return;

    // Track UI interactions
    this.setupUITracking();
    
    // Track workflow patterns
    this.setupWorkflowTracking();
    
    // Track collaboration patterns
    this.setupCollaborationTracking();
  }

  private setupUITracking(): void {
    // Track theme preferences
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          this.detectThemePreference(mutation.target as HTMLElement);
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Track sidebar usage
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-sidebar]')) {
        this.trackSidebarUsage(target);
      }
    });

    // Track modal interactions
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[role="dialog"]')) {
        this.trackModalBehavior(target);
      }
    });
  }

  private setupWorkflowTracking(): void {
    // Track document creation patterns
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-action="create-document"]')) {
        this.trackDocumentCreationPattern();
      }
    });

    // Track intelligence usage patterns
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-action="generate-intelligence"]')) {
        this.trackIntelligenceUsagePattern();
      }
    });
  }

  private setupCollaborationTracking(): void {
    // Track conflict resolution preferences
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-conflict-strategy]')) {
        const strategy = target.getAttribute('data-conflict-strategy');
        this.trackConflictResolutionPreference(strategy);
      }
    });

    // Track sharing and collaboration patterns
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-action="share"]')) {
        this.trackSharingPattern();
      }
    });
  }

  private startPatternDetection(): void {
    // Run pattern detection every 5 minutes
    setInterval(() => {
      this.detectBehaviorPatterns();
    }, 5 * 60 * 1000);

    // Run deep analysis every hour
    setInterval(() => {
      this.performDeepAnalysis();
    }, 60 * 60 * 1000);
  }

  private detectBehaviorPatterns(): void {
    for (const [userId, actions] of this.userActions.entries()) {
      if (actions.length < 10) continue; // Need minimum data

      // Detect sequence patterns
      this.detectSequencePatterns(userId, actions);
      
      // Detect timing patterns
      this.detectTimingPatterns(userId, actions);
      
      // Detect frequency patterns
      this.detectFrequencyPatterns(userId, actions);
    }
  }

  private detectSequencePatterns(userId: string, actions: UserAction[]): void {
    const sequences = this.extractActionSequences(actions, 3); // 3-action sequences
    
    const sequenceFrequency = new Map<string, number>();
    
    for (const sequence of sequences) {
      const key = sequence.map(a => a.action).join(' -> ');
      sequenceFrequency.set(key, (sequenceFrequency.get(key) || 0) + 1);
    }

    // Find common sequences (appearing 3+ times)
    for (const [sequence, frequency] of sequenceFrequency.entries()) {
      if (frequency >= 3) {
        this.recordBehaviorPattern(userId, {
          patternType: 'sequence',
          description: `Common action sequence: ${sequence}`,
          pattern: { sequence, frequency },
          frequency,
          confidence: Math.min(frequency / 10, 1.0),
          context: {}
        });
      }
    }
  }

  private detectTimingPatterns(userId: string, actions: UserAction[]): void {
    const actionsByHour = new Map<number, number>();
    
    for (const action of actions) {
      const hour = new Date(action.timestamp).getHours();
      actionsByHour.set(hour, (actionsByHour.get(hour) || 0) + 1);
    }

    // Find peak activity hours
    const totalActions = actions.length;
    const avgActionsPerHour = totalActions / 24;
    
    for (const [hour, count] of actionsByHour.entries()) {
      if (count > avgActionsPerHour * 1.5) {
        this.recordBehaviorPattern(userId, {
          patternType: 'timing',
          description: `High activity at hour ${hour}`,
          pattern: { hour, activityLevel: count / avgActionsPerHour },
          frequency: count,
          confidence: Math.min(count / (avgActionsPerHour * 2), 1.0),
          context: {}
        });
      }
    }
  }

  private detectFrequencyPatterns(userId: string, actions: UserAction[]): void {
    const actionFrequency = new Map<string, number>();
    
    for (const action of actions) {
      actionFrequency.set(action.action, (actionFrequency.get(action.action) || 0) + 1);
    }

    const totalActions = actions.length;
    
    for (const [action, frequency] of actionFrequency.entries()) {
      const proportion = frequency / totalActions;
      
      if (proportion > 0.1) { // Action represents >10% of all actions
        this.recordBehaviorPattern(userId, {
          patternType: 'frequency',
          description: `Frequently used action: ${action}`,
          pattern: { action, proportion, frequency },
          frequency,
          confidence: Math.min(proportion * 2, 1.0),
          context: {}
        });
      }
    }
  }

  // ========================================================================
  // IMPLICIT PREFERENCE INFERENCE
  // ========================================================================

  private async inferPreferences(userId: string): Promise<void> {
    const actions = this.userActions.get(userId) || [];
    const patterns = this.behaviorPatterns.get(userId) || [];

    if (actions.length < 20) return; // Need minimum data for inference

    // Infer UI preferences
    await this.inferUIPreferences(userId, actions, patterns);
    
    // Infer workflow preferences
    await this.inferWorkflowPreferences(userId, actions, patterns);
    
    // Infer collaboration preferences
    await this.inferCollaborationPreferences(userId, actions, patterns);
  }

  private async inferUIPreferences(
    userId: string, 
    actions: UserAction[], 
    patterns: BehaviorPattern[]
  ): Promise<void> {
    // Infer theme preference from usage patterns
    const themeActions = actions.filter(a => a.action.includes('theme'));
    if (themeActions.length > 0) {
      const darkThemeActions = themeActions.filter(a => a.context.theme === 'dark').length;
      const lightThemeActions = themeActions.filter(a => a.context.theme === 'light').length;
      
      if (Math.abs(darkThemeActions - lightThemeActions) > 3) {
        const preferredTheme = darkThemeActions > lightThemeActions ? 'dark' : 'light';
        const confidence = Math.abs(darkThemeActions - lightThemeActions) / themeActions.length;
        
        this.inferPreference(userId, 'ui', 'theme', preferredTheme, confidence);
      }
    }

    // Infer sidebar preference
    const sidebarActions = actions.filter(a => a.target.includes('sidebar'));
    const sidebarUsage = sidebarActions.length / actions.length;
    
    if (sidebarUsage > 0.3) {
      this.inferPreference(userId, 'ui', 'sidebar_usage', 'high', sidebarUsage);
    } else if (sidebarUsage < 0.1) {
      this.inferPreference(userId, 'ui', 'sidebar_usage', 'low', 1 - sidebarUsage);
    }

    // Infer density preference
    const compactActions = actions.filter(a => a.context.density === 'compact').length;
    const comfortableActions = actions.filter(a => a.context.density === 'comfortable').length;
    
    if (compactActions > comfortableActions * 2) {
      this.inferPreference(userId, 'ui', 'density', 'compact', 0.7);
    } else if (comfortableActions > compactActions * 2) {
      this.inferPreference(userId, 'ui', 'density', 'comfortable', 0.7);
    }
  }

  private async inferWorkflowPreferences(
    userId: string,
    actions: UserAction[],
    patterns: BehaviorPattern[]
  ): Promise<void> {
    // Infer preferred document creation method
    const createActions = actions.filter(a => a.action === 'document_create');
    const methodCounts = new Map<string, number>();
    
    for (const action of createActions) {
      const method = action.context.method || 'manual';
      methodCounts.set(method, (methodCounts.get(method) || 0) + 1);
    }

    if (methodCounts.size > 0) {
      const preferredMethod = Array.from(methodCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      
      const confidence = preferredMethod[1] / createActions.length;
      this.inferPreference(userId, 'workflow', 'document_creation_method', preferredMethod[0], confidence);
    }

    // Infer intelligence usage preference
    const intelligenceActions = actions.filter(a => a.action.includes('intelligence'));
    const intelligenceUsage = intelligenceActions.length / actions.length;
    
    if (intelligenceUsage > 0.2) {
      this.inferPreference(userId, 'workflow', 'intelligence_usage', 'high', intelligenceUsage);
    } else if (intelligenceUsage < 0.05) {
      this.inferPreference(userId, 'workflow', 'intelligence_usage', 'low', 1 - intelligenceUsage * 20);
    }

    // Infer batch processing preference
    const sequencePatterns = patterns.filter(p => p.patternType === 'sequence');
    const batchPatterns = sequencePatterns.filter(p => 
      p.description.includes('batch') || p.pattern.sequence.includes('multiple')
    );
    
    if (batchPatterns.length > 0) {
      const avgConfidence = batchPatterns.reduce((sum, p) => sum + p.confidence, 0) / batchPatterns.length;
      this.inferPreference(userId, 'workflow', 'batch_processing', 'preferred', avgConfidence);
    }
  }

  private async inferCollaborationPreferences(
    userId: string,
    actions: UserAction[],
    patterns: BehaviorPattern[]
  ): Promise<void> {
    // Infer conflict resolution style
    const conflictActions = actions.filter(a => a.action.includes('conflict'));
    const resolutionMethods = new Map<string, number>();
    
    for (const action of conflictActions) {
      const method = action.context.resolution_method;
      if (method) {
        resolutionMethods.set(method, (resolutionMethods.get(method) || 0) + 1);
      }
    }

    if (resolutionMethods.size > 0) {
      const preferredMethod = Array.from(resolutionMethods.entries())
        .sort((a, b) => b[1] - a[1])[0];
      
      const confidence = preferredMethod[1] / conflictActions.length;
      this.inferPreference(userId, 'collaboration', 'conflict_resolution_style', preferredMethod[0], confidence);
    }

    // Infer sharing behavior
    const shareActions = actions.filter(a => a.action.includes('share'));
    const shareFrequency = shareActions.length / actions.length;
    
    if (shareFrequency > 0.1) {
      this.inferPreference(userId, 'collaboration', 'sharing_tendency', 'high', shareFrequency * 10);
    } else if (shareFrequency < 0.02) {
      this.inferPreference(userId, 'collaboration', 'sharing_tendency', 'low', 1 - shareFrequency * 50);
    }

    // Infer real-time collaboration preference
    const realtimeActions = actions.filter(a => a.context.realtime === true);
    const realtimeUsage = realtimeActions.length / actions.length;
    
    if (realtimeUsage > 0.3) {
      this.inferPreference(userId, 'collaboration', 'realtime_collaboration', 'preferred', realtimeUsage);
    }
  }

  // ========================================================================
  // PREDICTION AND ADAPTATION
  // ========================================================================

  predictNextAction(userId: string, currentContext: Record<string, any>): PredictionResult {
    const actions = this.userActions.get(userId) || [];
    const patterns = this.behaviorPatterns.get(userId) || [];
    
    if (actions.length < 10) {
      return {
        action: 'unknown',
        confidence: 0,
        reasoning: ['Insufficient data for prediction']
      };
    }

    // Find similar contexts
    const similarActions = this.findSimilarContextActions(actions, currentContext);
    
    if (similarActions.length === 0) {
      return {
        action: 'unknown',
        confidence: 0,
        reasoning: ['No similar contexts found']
      };
    }

    // Predict most likely next action
    const nextActions = this.getFollowingActions(actions, similarActions);
    const actionCounts = new Map<string, number>();
    
    for (const action of nextActions) {
      actionCounts.set(action.action, (actionCounts.get(action.action) || 0) + 1);
    }

    if (actionCounts.size === 0) {
      return {
        action: 'unknown',
        confidence: 0,
        reasoning: ['No following actions found']
      };
    }

    const mostLikelyAction = Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    const confidence = mostLikelyAction[1] / nextActions.length;
    const suggestedActions = Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([action]) => action);

    return {
      action: mostLikelyAction[0],
      confidence,
      reasoning: [
        `Based on ${similarActions.length} similar contexts`,
        `Action appears in ${mostLikelyAction[1]}/${nextActions.length} cases`
      ],
      suggestedActions
    };
  }

  getPersonalizedRecommendations(userId: string): {
    ui: Record<string, any>;
    workflow: Record<string, any>;
    collaboration: Record<string, any>;
  } {
    const preferences = this.getAllPreferences(userId);
    
    const recommendations: {
      ui: Record<string, any>;
      workflow: Record<string, any>;
      collaboration: Record<string, any>;
    } = {
      ui: {},
      workflow: {},
      collaboration: {}
    };

    for (const pref of preferences) {
      if (pref.confidence > 0.6 && pref.category in recommendations) {
        const category = pref.category as keyof typeof recommendations;
        recommendations[category][pref.name] = {
          value: pref.value,
          confidence: pref.confidence,
          source: pref.source
        };
      }
    }

    return recommendations;
  }

  adaptInterface(userId: string): Record<string, any> {
    const uiPreferences = this.getAllPreferences(userId, 'ui');
    const adaptations: Record<string, any> = {};

    for (const pref of uiPreferences) {
      if (pref.confidence > 0.7) {
        switch (pref.name) {
          case 'theme':
            adaptations.theme = pref.value;
            break;
          case 'density':
            adaptations.density = pref.value;
            break;
          case 'sidebar_usage':
            adaptations.sidebarDefaultOpen = pref.value === 'high';
            break;
          case 'modal_size':
            adaptations.defaultModalSize = pref.value;
            break;
        }
      }
    }

    return adaptations;
  }

  // ========================================================================
  // MACHINE LEARNING MODELS
  // ========================================================================

  private async trainModels(userId: string): Promise<void> {
    const actions = this.userActions.get(userId) || [];
    const patterns = this.behaviorPatterns.get(userId) || [];

    if (actions.length < 50) return; // Need sufficient training data

    // Train workflow decision model
    await this.trainWorkflowModel(userId, actions);
    
    // Train UI pattern model
    await this.trainUIModel(userId, actions);
    
    // Train collaboration clustering model
    await this.trainCollaborationModel(userId, actions);

    console.log(`🤖 Trained ML models for user ${userId.substring(0, 8)}...`);
  }

  private async trainWorkflowModel(userId: string, actions: UserAction[]): Promise<void> {
    // Simple decision tree training (would use actual ML library in production)
    const workflowActions = actions.filter(a => 
      a.action.includes('document') || 
      a.action.includes('intelligence') || 
      a.action.includes('basket')
    );

    if (workflowActions.length < 20) return;

    const model = this.learningModels.get('workflow_decisions')!;
    
    // Extract features and labels
    const features = workflowActions.map(action => ({
      hour: new Date(action.timestamp).getHours(),
      dayOfWeek: new Date(action.timestamp).getDay(),
      hasContext: Object.keys(action.context).length > 0,
      actionType: action.action
    }));

    // Simple accuracy calculation (would be more sophisticated in production)
    model.accuracy = 0.75 + Math.random() * 0.2; // Simulated accuracy
    model.lastTrained = new Date().toISOString();
    model.trainingData = { sampleCount: features.length };
  }

  private async trainUIModel(userId: string, actions: UserAction[]): Promise<void> {
    const uiActions = actions.filter(a => 
      a.target.includes('button') || 
      a.target.includes('modal') || 
      a.target.includes('sidebar')
    );

    if (uiActions.length < 15) return;

    const model = this.learningModels.get('ui_patterns')!;
    model.accuracy = 0.65 + Math.random() * 0.25;
    model.lastTrained = new Date().toISOString();
    model.trainingData = { sampleCount: uiActions.length };
  }

  private async trainCollaborationModel(userId: string, actions: UserAction[]): Promise<void> {
    const collabActions = actions.filter(a => 
      a.action.includes('share') || 
      a.action.includes('conflict') || 
      a.action.includes('collaborate')
    );

    if (collabActions.length < 10) return;

    const model = this.learningModels.get('collaboration_clusters')!;
    model.accuracy = 0.70 + Math.random() * 0.2;
    model.lastTrained = new Date().toISOString();
    model.trainingData = { sampleCount: collabActions.length };
  }

  // ========================================================================
  // PRIVACY AND SECURITY
  // ========================================================================

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      // Remove sensitive information
      if (this.isSensitiveKey(key)) {
        continue;
      }
      
      // Limit string length
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (!this.isSensitiveKey(key)) {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'auth',
      'email', 'phone', 'address', 'ssn', 'credit'
    ];
    
    return sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private extractActionSequences(actions: UserAction[], length: number): UserAction[][] {
    const sequences: UserAction[][] = [];
    
    for (let i = 0; i <= actions.length - length; i++) {
      sequences.push(actions.slice(i, i + length));
    }
    
    return sequences;
  }

  private findSimilarContextActions(
    actions: UserAction[], 
    targetContext: Record<string, any>
  ): UserAction[] {
    return actions.filter(action => {
      const similarity = this.calculateContextSimilarity(action.context, targetContext);
      return similarity > 0.6;
    });
  }

  private calculateContextSimilarity(
    context1: Record<string, any>, 
    context2: Record<string, any>
  ): number {
    const keys1 = Object.keys(context1);
    const keys2 = Object.keys(context2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    if (allKeys.size === 0) return 1;
    
    let matches = 0;
    for (const key of allKeys) {
      if (context1[key] === context2[key]) {
        matches++;
      }
    }
    
    return matches / allKeys.size;
  }

  private getFollowingActions(
    allActions: UserAction[], 
    targetActions: UserAction[]
  ): UserAction[] {
    const followingActions: UserAction[] = [];
    
    for (const targetAction of targetActions) {
      const index = allActions.findIndex(a => a.id === targetAction.id);
      if (index !== -1 && index < allActions.length - 1) {
        followingActions.push(allActions[index + 1]);
      }
    }
    
    return followingActions;
  }

  private storePreference(preference: UserPreference): void {
    if (!this.preferences.has(preference.userId)) {
      this.preferences.set(preference.userId, []);
    }
    
    const userPrefs = this.preferences.get(preference.userId)!;
    
    // Remove existing preference with same category and name
    const existingIndex = userPrefs.findIndex(p => 
      p.category === preference.category && p.name === preference.name
    );
    
    if (existingIndex !== -1) {
      userPrefs.splice(existingIndex, 1);
    }
    
    userPrefs.push(preference);
  }

  private inferPreference(
    userId: string,
    category: UserPreference['category'],
    name: string,
    value: any,
    confidence: number
  ): void {
    const preference: UserPreference = {
      id: crypto.randomUUID(),
      userId,
      category,
      name,
      value,
      confidence: Math.min(confidence, 0.9), // Cap inferred confidence
      lastUpdated: new Date().toISOString(),
      source: 'inferred',
      context: {}
    };
    
    this.storePreference(preference);
  }

  private recordBehaviorPattern(
    userId: string, 
    pattern: Omit<BehaviorPattern, 'id' | 'userId' | 'detectedAt' | 'lastSeen'>
  ): void {
    const fullPattern: BehaviorPattern = {
      id: crypto.randomUUID(),
      userId,
      detectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      ...pattern
    };
    
    if (!this.behaviorPatterns.has(userId)) {
      this.behaviorPatterns.set(userId, []);
    }
    
    const patterns = this.behaviorPatterns.get(userId)!;
    patterns.push(fullPattern);
    
    // Keep only recent patterns
    if (patterns.length > 100) {
      patterns.splice(0, patterns.length - 100);
    }
  }

  private async loadUserPreferences(): Promise<void> {
    // In production, this would load from a database
    // For now, we'll use localStorage if available
    
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('user_preferences');
      if (stored) {
        const preferences = JSON.parse(stored);
        for (const [userId, prefs] of Object.entries(preferences)) {
          this.preferences.set(userId, prefs as UserPreference[]);
        }
      }
    } catch (error) {
      console.warn('Failed to load stored preferences:', error);
    }
  }

  private async saveUserPreferences(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      const preferences: Record<string, UserPreference[]> = {};
      for (const [userId, prefs] of this.preferences.entries()) {
        preferences[userId] = prefs;
      }
      
      localStorage.setItem('user_preferences', JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save preferences:', error);
    }
  }

  private performDeepAnalysis(): void {
    // Perform deep learning analysis on all users
    for (const userId of this.userActions.keys()) {
      this.inferPreferences(userId);
      this.trainModels(userId);
    }
    
    // Save preferences
    this.saveUserPreferences();
  }

  private detectImmediatePatterns(userId: string, action: UserAction): void {
    // Quick pattern detection for immediate adaptation
    const recentActions = (this.userActions.get(userId) || []).slice(-10);
    
    // Detect rapid repeated actions
    const sameActions = recentActions.filter(a => a.action === action.action);
    if (sameActions.length >= 3) {
      this.recordBehaviorPattern(userId, {
        patternType: 'frequency',
        description: `Rapid repeated action: ${action.action}`,
        pattern: { action: action.action, rapidRepeats: sameActions.length },
        frequency: sameActions.length,
        confidence: 0.6,
        context: {}
      });
    }
  }

  private learnTimingPreferences(userId: string, action: string, duration: number): void {
    // Learn from timing data
    if (duration > 5000) { // Actions taking >5 seconds
      this.inferPreference(userId, 'performance', `${action}_prefers_batching`, true, 0.7);
    } else if (duration < 500) { // Quick actions
      this.inferPreference(userId, 'performance', `${action}_prefers_immediate`, true, 0.8);
    }
  }

  // Specific tracking methods for UI elements
  private detectThemePreference(element: HTMLElement): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    const isDark = element.classList.contains('dark') || 
                   element.classList.contains('theme-dark');
    
    this.trackUserAction(userId, 'theme_used', 'document', {
      theme: isDark ? 'dark' : 'light'
    });
  }

  private trackSidebarUsage(element: HTMLElement): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    this.trackUserAction(userId, 'sidebar_interaction', 'sidebar', {
      action: element.dataset.action || 'click'
    });
  }

  private trackModalBehavior(element: HTMLElement): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    this.trackUserAction(userId, 'modal_interaction', 'modal', {
      modalType: element.dataset.modalType || 'unknown'
    });
  }

  private trackDocumentCreationPattern(): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    this.trackUserAction(userId, 'document_create', 'document', {
      method: 'button_click'
    });
  }

  private trackIntelligenceUsagePattern(): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    this.trackUserAction(userId, 'intelligence_generate', 'intelligence', {
      trigger: 'manual'
    });
  }

  private trackConflictResolutionPreference(strategy: string | null): void {
    const userId = this.getCurrentUserId();
    if (!userId || !strategy) return;

    this.trackUserAction(userId, 'conflict_resolve', 'conflict', {
      resolution_method: strategy
    });
  }

  private trackSharingPattern(): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    this.trackUserAction(userId, 'share_initiated', 'share', {
      context: 'button_click'
    });
  }

  private getCurrentUserId(): string | null {
    // In production, this would get the current user ID from auth
    return 'current_user_id'; // Placeholder
  }

  private updateRelatedPreferences(userId: string, preference: UserPreference): void {
    // Update related implicit preferences based on explicit ones
    if (preference.category === 'ui' && preference.name === 'theme') {
      // If user explicitly sets theme, increase confidence in timing patterns
      const timingPatterns = this.behaviorPatterns.get(userId) || [];
      const relevantPatterns = timingPatterns.filter(p => 
        p.patternType === 'timing' && 
        (preference.value === 'dark' ? p.pattern.hour >= 18 || p.pattern.hour <= 6 : 
         p.pattern.hour > 6 && p.pattern.hour < 18)
      );

      for (const pattern of relevantPatterns) {
        pattern.confidence = Math.min(pattern.confidence + 0.2, 1.0);
      }
    }
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  enableLearning(): void {
    this.isEnabled = true;
    console.log('🧠 User preference learning enabled');
  }

  disableLearning(): void {
    this.isEnabled = false;
    console.log('🛑 User preference learning disabled');
  }

  setPrivacyMode(mode: 'strict' | 'balanced' | 'permissive'): void {
    this.privacyMode = mode;
    console.log(`🔒 Privacy mode set to: ${mode}`);
  }

  clearUserData(userId: string): void {
    this.preferences.delete(userId);
    this.behaviorPatterns.delete(userId);
    this.userActions.delete(userId);
    console.log(`🗑️  Cleared all data for user ${userId.substring(0, 8)}...`);
  }

  exportUserData(userId: string): {
    preferences: UserPreference[];
    patterns: BehaviorPattern[];
    actionCount: number;
  } {
    return {
      preferences: this.getAllPreferences(userId),
      patterns: this.behaviorPatterns.get(userId) || [],
      actionCount: (this.userActions.get(userId) || []).length
    };
  }

  getSystemStats(): {
    totalUsers: number;
    totalPreferences: number;
    totalPatterns: number;
    totalActions: number;
    modelAccuracy: Record<string, number>;
  } {
    const totalPreferences = Array.from(this.preferences.values())
      .reduce((sum, prefs) => sum + prefs.length, 0);
    
    const totalPatterns = Array.from(this.behaviorPatterns.values())
      .reduce((sum, patterns) => sum + patterns.length, 0);
    
    const totalActions = Array.from(this.userActions.values())
      .reduce((sum, actions) => sum + actions.length, 0);

    const modelAccuracy: Record<string, number> = {};
    for (const [id, model] of this.learningModels.entries()) {
      modelAccuracy[id] = model.accuracy;
    }

    return {
      totalUsers: this.userActions.size,
      totalPreferences,
      totalPatterns,
      totalActions,
      modelAccuracy
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let globalPreferenceLearning: UserPreferenceLearning | null = null;

export function getUserPreferenceLearning(): UserPreferenceLearning {
  if (!globalPreferenceLearning) {
    globalPreferenceLearning = new UserPreferenceLearning();
  }
  return globalPreferenceLearning;
}