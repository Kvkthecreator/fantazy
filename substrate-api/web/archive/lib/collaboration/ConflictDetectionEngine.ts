// ============================================================================
// ADVANCED CONFLICT DETECTION ENGINE
// ============================================================================
// Intelligent conflict detection for real-time collaborative editing
// Supports text conflicts, structured data conflicts, and concurrent operations

export type ConflictType = 
  | 'text_concurrent_edit'
  | 'text_overlapping_range'
  | 'structural_modification'
  | 'data_field_collision'
  | 'version_divergence'
  | 'permission_conflict'
  | 'semantic_conflict';

export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface TextRange {
  start: number;
  end: number;
  line?: number;
  column?: number;
}

export interface ChangeVector {
  id: string;
  userId: string;
  timestamp: string;
  type: 'insert' | 'delete' | 'replace' | 'move';
  position: TextRange;
  content?: string;
  previousContent?: string;
  metadata?: Record<string, any>;
}

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflicts: DetectedConflict[];
  riskLevel: ConflictSeverity;
  preventable: boolean;
  recommendations: ConflictResolutionStrategy[];
}

export interface DetectedConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  description: string;
  affectedUsers: string[];
  affectedRanges: TextRange[];
  changeVectors: ChangeVector[];
  detectionTime: string;
  autoResolvable: boolean;
  conflictData: {
    currentValue: any;
    incomingValues: Array<{
      userId: string;
      value: any;
      timestamp: string;
    }>;
    commonAncestor?: any;
    divergencePoint?: string;
  };
}

export interface ConflictResolutionStrategy {
  id: string;
  strategy: 'auto_merge' | 'user_select' | 'three_way_merge' | 'operational_transform' | 'manual_resolution';
  confidence: number;
  description: string;
  previewResult?: any;
  requiresUserInput: boolean;
  estimatedTime: number; // seconds
}

/**
 * Advanced Conflict Detection Engine
 * 
 * Features:
 * - Real-time concurrent edit detection
 * - Smart text range overlap analysis
 * - Operational transform conflict prediction
 * - Semantic conflict detection
 * - Auto-resolution strategy recommendation
 * - Performance-optimized detection algorithms
 */
export class ConflictDetectionEngine {
  private activeEditSessions: Map<string, EditSession> = new Map();
  private changeHistory: Map<string, ChangeVector[]> = new Map();
  private conflictPatterns: ConflictPattern[] = [];
  private userPreferences: Map<string, UserConflictPreferences> = new Map();

  constructor() {
    this.initializeConflictPatterns();
  }

  // ========================================================================
  // MAIN CONFLICT DETECTION API
  // ========================================================================

  /**
   * Detect conflicts for incoming change
   */
  async detectConflicts(
    incomingChange: ChangeVector,
    documentId: string,
    currentState: any
  ): Promise<ConflictDetectionResult> {
    const conflicts: DetectedConflict[] = [];
    
    // Get active editing sessions for this document
    const activeSessions = this.getActiveEditSessions(documentId);
    
    // Check for text-based conflicts
    const textConflicts = await this.detectTextConflicts(
      incomingChange,
      activeSessions,
      currentState
    );
    conflicts.push(...textConflicts);

    // Check for structural conflicts
    const structuralConflicts = await this.detectStructuralConflicts(
      incomingChange,
      activeSessions,
      currentState
    );
    conflicts.push(...structuralConflicts);

    // Check for semantic conflicts
    const semanticConflicts = await this.detectSemanticConflicts(
      incomingChange,
      activeSessions,
      currentState
    );
    conflicts.push(...semanticConflicts);

    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(conflicts);
    
    // Generate resolution strategies
    const recommendations = await this.generateResolutionStrategies(
      conflicts,
      incomingChange,
      currentState
    );

    // Check if conflicts are preventable
    const preventable = this.areConflictsPreventable(conflicts, activeSessions);

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      riskLevel,
      preventable,
      recommendations
    };
  }

  /**
   * Track active editing session
   */
  trackEditSession(
    documentId: string,
    userId: string,
    position: TextRange,
    operation: 'start' | 'update' | 'end'
  ): void {
    const sessionKey = `${documentId}:${userId}`;
    
    if (operation === 'end') {
      this.activeEditSessions.delete(sessionKey);
      return;
    }

    const session: EditSession = {
      documentId,
      userId,
      currentPosition: position,
      startTime: operation === 'start' ? new Date().toISOString() : 
                  this.activeEditSessions.get(sessionKey)?.startTime || new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      intentedChanges: []
    };

    this.activeEditSessions.set(sessionKey, session);
  }

  /**
   * Add change to history for pattern analysis
   */
  addChangeToHistory(documentId: string, change: ChangeVector): void {
    if (!this.changeHistory.has(documentId)) {
      this.changeHistory.set(documentId, []);
    }
    
    const history = this.changeHistory.get(documentId)!;
    history.push(change);
    
    // Keep only recent changes (last 100)
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  // ========================================================================
  // TEXT CONFLICT DETECTION
  // ========================================================================

  private async detectTextConflicts(
    incomingChange: ChangeVector,
    activeSessions: EditSession[],
    currentState: any
  ): Promise<DetectedConflict[]> {
    const conflicts: DetectedConflict[] = [];

    for (const session of activeSessions) {
      if (session.userId === incomingChange.userId) continue;

      // Check for overlapping ranges
      const overlap = this.calculateRangeOverlap(
        incomingChange.position,
        session.currentPosition
      );

      if (overlap.hasOverlap) {
        const conflict: DetectedConflict = {
          id: crypto.randomUUID(),
          type: overlap.percentage > 0.8 ? 'text_concurrent_edit' : 'text_overlapping_range',
          severity: this.calculateOverlapSeverity(overlap.percentage),
          description: `${session.userId} is editing the same text area`,
          affectedUsers: [incomingChange.userId, session.userId],
          affectedRanges: [incomingChange.position, session.currentPosition],
          changeVectors: [incomingChange],
          detectionTime: new Date().toISOString(),
          autoResolvable: overlap.percentage < 0.3,
          conflictData: {
            currentValue: currentState.content?.substring(
              incomingChange.position.start,
              incomingChange.position.end
            ),
            incomingValues: [{
              userId: incomingChange.userId,
              value: incomingChange.content,
              timestamp: incomingChange.timestamp
            }],
            commonAncestor: this.findCommonAncestor(incomingChange, session)
          }
        };

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  // ========================================================================
  // STRUCTURAL CONFLICT DETECTION
  // ========================================================================

  private async detectStructuralConflicts(
    incomingChange: ChangeVector,
    activeSessions: EditSession[],
    currentState: any
  ): Promise<DetectedConflict[]> {
    const conflicts: DetectedConflict[] = [];

    // Check for document structure modifications
    if (this.isStructuralChange(incomingChange)) {
      for (const session of activeSessions) {
        if (session.userId === incomingChange.userId) continue;

        if (this.hasStructuralConflict(incomingChange, session)) {
          const conflict: DetectedConflict = {
            id: crypto.randomUUID(),
            type: 'structural_modification',
            severity: 'high',
            description: `Concurrent structural changes detected`,
            affectedUsers: [incomingChange.userId, session.userId],
            affectedRanges: [incomingChange.position],
            changeVectors: [incomingChange],
            detectionTime: new Date().toISOString(),
            autoResolvable: false,
            conflictData: {
              currentValue: currentState,
              incomingValues: [{
                userId: incomingChange.userId,
                value: incomingChange.content,
                timestamp: incomingChange.timestamp
              }]
            }
          };

          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  // ========================================================================
  // SEMANTIC CONFLICT DETECTION
  // ========================================================================

  private async detectSemanticConflicts(
    incomingChange: ChangeVector,
    activeSessions: EditSession[],
    currentState: any
  ): Promise<DetectedConflict[]> {
    const conflicts: DetectedConflict[] = [];

    // Analyze semantic meaning of changes
    const semanticAnalysis = await this.analyzeSemanticIntent(incomingChange);
    
    for (const session of activeSessions) {
      if (session.userId === incomingChange.userId) continue;

      // Check if changes have conflicting semantic intent
      const sessionIntent = await this.analyzeSessionIntent(session);
      
      if (this.hasSemanticConflict(semanticAnalysis, sessionIntent)) {
        const conflict: DetectedConflict = {
          id: crypto.randomUUID(),
          type: 'semantic_conflict',
          severity: 'medium',
          description: `Changes may have conflicting intentions`,
          affectedUsers: [incomingChange.userId, session.userId],
          affectedRanges: [incomingChange.position],
          changeVectors: [incomingChange],
          detectionTime: new Date().toISOString(),
          autoResolvable: false,
          conflictData: {
            currentValue: semanticAnalysis,
            incomingValues: [{
              userId: incomingChange.userId,
              value: incomingChange.content,
              timestamp: incomingChange.timestamp
            }]
          }
        };

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  // ========================================================================
  // RESOLUTION STRATEGY GENERATION
  // ========================================================================

  private async generateResolutionStrategies(
    conflicts: DetectedConflict[],
    incomingChange: ChangeVector,
    currentState: any
  ): Promise<ConflictResolutionStrategy[]> {
    const strategies: ConflictResolutionStrategy[] = [];

    for (const conflict of conflicts) {
      // Auto-merge strategy for low-severity conflicts
      if (conflict.severity === 'low' && conflict.autoResolvable) {
        strategies.push({
          id: crypto.randomUUID(),
          strategy: 'auto_merge',
          confidence: 0.9,
          description: 'Automatically merge non-overlapping changes',
          requiresUserInput: false,
          estimatedTime: 1
        });
      }

      // Operational transform for text conflicts
      if (conflict.type === 'text_concurrent_edit') {
        strategies.push({
          id: crypto.randomUUID(),
          strategy: 'operational_transform',
          confidence: 0.7,
          description: 'Apply operational transform to merge changes',
          requiresUserInput: false,
          estimatedTime: 2
        });
      }

      // Three-way merge for version conflicts
      if (conflict.type === 'version_divergence') {
        strategies.push({
          id: crypto.randomUUID(),
          strategy: 'three_way_merge',
          confidence: 0.8,
          description: 'Use common ancestor to merge changes',
          requiresUserInput: false,
          estimatedTime: 3
        });
      }

      // User selection for high-severity conflicts
      if (conflict.severity === 'high' || conflict.severity === 'critical') {
        strategies.push({
          id: crypto.randomUUID(),
          strategy: 'user_select',
          confidence: 1.0,
          description: 'Let user choose the preferred version',
          requiresUserInput: true,
          estimatedTime: 30
        });
      }

      // Manual resolution for complex conflicts
      if (conflict.type === 'semantic_conflict' || conflict.type === 'structural_modification') {
        strategies.push({
          id: crypto.randomUUID(),
          strategy: 'manual_resolution',
          confidence: 1.0,
          description: 'Requires manual review and resolution',
          requiresUserInput: true,
          estimatedTime: 120
        });
      }
    }

    // Sort by confidence and estimated time
    return strategies.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return a.estimatedTime - b.estimatedTime;
    });
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private getActiveEditSessions(documentId: string): EditSession[] {
    return Array.from(this.activeEditSessions.values())
      .filter(session => session.documentId === documentId);
  }

  private calculateRangeOverlap(range1: TextRange, range2: TextRange): {
    hasOverlap: boolean;
    percentage: number;
    overlapRange?: TextRange;
  } {
    const start = Math.max(range1.start, range2.start);
    const end = Math.min(range1.end, range2.end);

    if (start >= end) {
      return { hasOverlap: false, percentage: 0 };
    }

    const overlapLength = end - start;
    const totalLength = Math.max(range1.end - range1.start, range2.end - range2.start);
    const percentage = overlapLength / totalLength;

    return {
      hasOverlap: true,
      percentage,
      overlapRange: { start, end }
    };
  }

  private calculateOverlapSeverity(percentage: number): ConflictSeverity {
    if (percentage >= 0.8) return 'critical';
    if (percentage >= 0.5) return 'high';
    if (percentage >= 0.2) return 'medium';
    return 'low';
  }

  private calculateRiskLevel(conflicts: DetectedConflict[]): ConflictSeverity {
    if (conflicts.length === 0) return 'low';
    
    const maxSeverity = conflicts.reduce((max, conflict) => {
      const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      return severityLevels[conflict.severity] > severityLevels[max] ? conflict.severity : max;
    }, 'low' as ConflictSeverity);

    return maxSeverity;
  }

  private areConflictsPreventable(
    conflicts: DetectedConflict[],
    activeSessions: EditSession[]
  ): boolean {
    // Conflicts are preventable if users could be warned before they occur
    return conflicts.some(conflict => 
      conflict.type === 'text_overlapping_range' && 
      conflict.severity === 'low'
    );
  }

  private isStructuralChange(change: ChangeVector): boolean {
    // Detect if change affects document structure
    return Boolean(change.metadata?.isStructural) ||
           change.type === 'move' ||
           (change.content ? this.containsStructuralElements(change.content) : false);
  }

  private containsStructuralElements(content: string): boolean {
    // Check for HTML tags, markdown headers, etc.
    return /<\/?[a-z][\s\S]*>/i.test(content) ||
           /^#{1,6}\s/.test(content) ||
           /^\s*[-*+]\s/.test(content);
  }

  private hasStructuralConflict(change: ChangeVector, session: EditSession): boolean {
    // Check if change conflicts with session's structural intent
    return this.isStructuralChange(change) && 
           session.intentedChanges.some(intent => intent.type === 'structural');
  }

  private async analyzeSemanticIntent(change: ChangeVector): Promise<any> {
    // 🚨 CRITICAL FIX: Check if content is an array (from context_add) to prevent toLowerCase() crash
    const content = change.content || '';
    
    // If content is an array, convert to string or skip analysis
    let safeContent = '';
    if (Array.isArray(content)) {
      console.log('⚠️ CONFLICT DETECTION: Received array content, converting to string');
      safeContent = JSON.stringify(content);
    } else if (typeof content === 'string') {
      safeContent = content;
    } else {
      console.log('⚠️ CONFLICT DETECTION: Unknown content type, converting to string');
      safeContent = String(content);
    }
    
    // Simplified semantic analysis - in production this would use NLP
    return {
      intent: this.classifyChangeIntent(change),
      confidence: 0.7,
      keywords: this.extractKeywords(safeContent)
    };
  }

  private async analyzeSessionIntent(session: EditSession): Promise<any> {
    // Analyze user's editing patterns to understand intent
    return {
      intent: 'unknown',
      confidence: 0.5,
      patterns: []
    };
  }

  private hasSemanticConflict(analysis1: any, analysis2: any): boolean {
    // Check if semantic intents conflict
    return analysis1.intent === 'delete' && analysis2.intent === 'edit' ||
           analysis1.intent === 'restructure' && analysis2.intent === 'format';
  }

  private classifyChangeIntent(change: ChangeVector): string {
    if (change.type === 'delete') return 'delete';
    if (change.type === 'insert') return 'add';
    if (change.content && change.content.length > (change.previousContent?.length || 0)) return 'expand';
    return 'edit';
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction
    return content.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }

  private findCommonAncestor(change: ChangeVector, session: EditSession): any {
    // Find common ancestor version for three-way merge
    // This would access version history in production
    return null;
  }

  private initializeConflictPatterns(): void {
    // Initialize common conflict patterns for learning
    this.conflictPatterns = [
      {
        pattern: 'concurrent_paragraph_edit',
        frequency: 0.3,
        autoResolvable: true,
        preferredStrategy: 'operational_transform'
      },
      {
        pattern: 'title_collision',
        frequency: 0.1,
        autoResolvable: false,
        preferredStrategy: 'user_select'
      }
    ];
  }
}

// ============================================================================
// SUPPORTING INTERFACES
// ============================================================================

interface EditSession {
  documentId: string;
  userId: string;
  currentPosition: TextRange;
  startTime: string;
  lastActivity: string;
  intentedChanges: Array<{
    type: string;
    description: string;
  }>;
}

interface ConflictPattern {
  pattern: string;
  frequency: number;
  autoResolvable: boolean;
  preferredStrategy: string;
}

interface UserConflictPreferences {
  userId: string;
  preferredStrategies: string[];
  autoResolveThreshold: number;
  notificationPreferences: {
    immediate: boolean;
    summary: boolean;
  };
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let globalConflictEngine: ConflictDetectionEngine | null = null;

export function getConflictDetectionEngine(): ConflictDetectionEngine {
  if (!globalConflictEngine) {
    globalConflictEngine = new ConflictDetectionEngine();
  }
  return globalConflictEngine;
}