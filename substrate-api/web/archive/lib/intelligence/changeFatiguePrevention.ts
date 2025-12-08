"use client";

import type { IntelligenceEvent } from './changeDetection';
import type { PageContext } from './pageContextDetection';

// Core interfaces for change fatigue prevention
export interface ChangeSignificanceFilter {
  significanceThreshold: 'minor' | 'moderate' | 'major';
  batchingRules: {
    groupRelatedChanges: boolean;
    timeWindow: number; // milliseconds
    maxBatchSize: number;
  };
  autoApprovalRules: {
    minorChangesTimeout: number; // milliseconds
    userInactivityThreshold: number; // milliseconds
    confidenceThreshold: number; // 0-1
  };
}

export interface BatchedChange {
  id: string;
  events: IntelligenceEvent[];
  significance: 'minor' | 'moderate' | 'major';
  createdAt: number;
  scheduledApproval?: number;
  relatedTopic?: string;
  aggregatedConfidence: number;
}

export interface UserActivityState {
  isActive: boolean;
  lastActivity: number;
  currentPage: string;
  engagementLevel: 'low' | 'medium' | 'high';
  recentActions: string[];
}

export interface ChangeSignificanceScore {
  significance: 'minor' | 'moderate' | 'major';
  confidence: number;
  factors: {
    contentScale: number; // How much content is being changed
    userImportance: number; // How important this seems to the user
    workflowImpact: number; // How much this affects user workflow
    novelty: number; // How new/unexpected this change is
  };
  reasoning: string;
}

/**
 * Advanced change fatigue prevention system
 * Intelligently batches and filters changes to prevent modal overload
 */
export class ChangeFatiguePreventionManager {
  private pendingBatches: Map<string, BatchedChange> = new Map();
  private userActivity: UserActivityState;
  private config: ChangeSignificanceFilter;
  private autoApprovalTimers: Map<string, NodeJS.Timeout> = new Map();
  private changeHistory: Map<string, number> = new Map(); // topic -> frequency
  
  constructor(config: ChangeSignificanceFilter) {
    this.config = config;
    this.userActivity = {
      isActive: false,
      lastActivity: Date.now(),
      currentPage: 'unknown',
      engagementLevel: 'low',
      recentActions: []
    };
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Process incoming intelligence event with fatigue prevention
   */
  processIntelligenceEvent(
    event: IntelligenceEvent,
    pageContext: PageContext,
    onBatchReady: (batch: BatchedChange) => void,
    onAutoApproved: (events: IntelligenceEvent[]) => void
  ): 'batched' | 'queued' | 'auto_approved' | 'filtered' {
    
    // Update user activity
    this.updateUserActivity(pageContext);
    
    // Score change significance
    const significanceScore = this.scoreChangeSignificance(event, pageContext);
    
    // Filter out insignificant changes if user is highly active
    if (this.shouldFilterChange(significanceScore)) {
      return 'filtered';
    }
    
    // Check for auto-approval
    if (this.shouldAutoApprove(significanceScore)) {
      setTimeout(() => onAutoApproved([event]), this.config.autoApprovalRules.minorChangesTimeout);
      return 'auto_approved';
    }
    
    // Find or create batch
    const batchKey = this.determineBatchKey(event, significanceScore);
    let batch = this.pendingBatches.get(batchKey);
    
    if (!batch) {
      // Create new batch
      batch = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        events: [event],
        significance: significanceScore.significance,
        createdAt: Date.now(),
        relatedTopic: this.extractTopic(event),
        aggregatedConfidence: significanceScore.confidence
      };
      
      this.pendingBatches.set(batchKey, batch);
      
      // Set timer for batch release
      this.scheduleBatchRelease(batchKey, batch, onBatchReady);
      
      return 'queued';
    } else {
      // Add to existing batch
      batch.events.push(event);
      batch.aggregatedConfidence = this.calculateAggregatedConfidence(batch.events);
      
      // Check if batch is ready (max size reached or significance upgraded)
      if (this.isBatchReady(batch)) {
        this.releaseBatch(batchKey, batch, onBatchReady);
        return 'batched';
      }
      
      return 'queued';
    }
  }

  /**
   * Update user activity state
   */
  updateUserActivity(pageContext: PageContext): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.userActivity.lastActivity;
    
    this.userActivity = {
      isActive: pageContext.userActivity.isActivelyEngaged,
      lastActivity: now,
      currentPage: pageContext.page,
      engagementLevel: this.calculateEngagementLevel(pageContext, timeSinceLastActivity),
      recentActions: [
        pageContext.userActivity.lastAction,
        ...this.userActivity.recentActions.slice(0, 4)
      ]
    };
  }

  /**
   * Score the significance of a change
   */
  private scoreChangeSignificance(
    event: IntelligenceEvent,
    pageContext: PageContext
  ): ChangeSignificanceScore {
    
    // Analyze content scale
    const contentScale = this.analyzeContentScale(event);
    
    // Assess user importance based on current context
    const userImportance = this.assessUserImportance(event, pageContext);
    
    // Evaluate workflow impact
    const workflowImpact = this.evaluateWorkflowImpact(event, pageContext);
    
    // Calculate novelty
    const novelty = this.calculateNovelty(event);
    
    // Weighted significance score
    const overallScore = (
      contentScale * 0.25 +
      userImportance * 0.35 +
      workflowImpact * 0.3 +
      novelty * 0.1
    );
    
    const significance: 'minor' | 'moderate' | 'major' = 
      overallScore >= 0.8 ? 'major' :
      overallScore >= 0.5 ? 'moderate' : 'minor';
    
    const reasoning = this.generateSignificanceReasoning({
      contentScale,
      userImportance,
      workflowImpact,
      novelty
    }, significance);

    return {
      significance,
      confidence: overallScore,
      factors: {
        contentScale,
        userImportance,
        workflowImpact,
        novelty
      },
      reasoning
    };
  }

  private analyzeContentScale(event: IntelligenceEvent): number {
    const changes = event.changes || [];
    
    // Calculate content scale based on current content and number of changes
    const totalCharacters = changes.reduce((sum, change) => {
      const currentContent = typeof change.current === 'string' ? change.current : JSON.stringify(change.current || '');
      return sum + currentContent.length;
    }, 0);
    
    // Scale based on number of changes and content size
    const changeCount = changes.length;
    const baseScale = changeCount * 0.1; // 0.1 per change
    const contentScale = totalCharacters / 1000; // Normalize content size
    
    // Combine factors with weights
    const finalScale = Math.min(1.0, baseScale * 0.6 + contentScale * 0.4);
    
    // Ensure minimum scale for any changes
    return Math.max(0.2, finalScale);
  }

  private assessUserImportance(event: IntelligenceEvent, pageContext: PageContext): number {
    let importance = 0.5; // baseline
    
    // Higher importance if user recently interacted with related content
    if (pageContext.userActivity.selectedText || pageContext.userActivity.recentEdits.length > 0) {
      importance += 0.3;
    }
    
    // Higher importance for current page context
    if (pageContext.content.currentDocument?.id && event.basketId) {
      importance += 0.2;
    }
    
    // Higher importance based on change confidence (average of all changes)
    const avgConfidence = event.changes && event.changes.length > 0
      ? event.changes.reduce((sum, change) => sum + change.confidence, 0) / event.changes.length
      : 0.5;
    importance += (avgConfidence - 0.5) * 0.4;
    
    return Math.min(1.0, Math.max(0.0, importance));
  }

  private evaluateWorkflowImpact(event: IntelligenceEvent, pageContext: PageContext): number {
    let impact = 0.3; // baseline
    
    // Higher impact if it affects active workflow
    if (pageContext.userActivity.isActivelyEngaged) {
      impact += 0.4;
    }
    
    // Higher impact for structural changes  
    if (event.changes?.some(change => change.changeType === 'modified' || change.significance === 'major')) {
      impact += 0.3;
    }
    
    return Math.min(1.0, impact);
  }

  private calculateNovelty(event: IntelligenceEvent): number {
    const topic = this.extractTopic(event);
    const frequency = this.changeHistory.get(topic) || 0;
    
    // More frequent topics have lower novelty
    const noveltyScore = Math.max(0.1, 1.0 - (frequency * 0.1));
    
    // Update frequency
    this.changeHistory.set(topic, frequency + 1);
    
    return noveltyScore;
  }

  private generateSignificanceReasoning(
    factors: ChangeSignificanceScore['factors'],
    significance: 'minor' | 'moderate' | 'major'
  ): string {
    const reasons: string[] = [];
    
    if (factors.contentScale > 0.7) reasons.push('substantial content changes');
    if (factors.userImportance > 0.7) reasons.push('high user relevance');
    if (factors.workflowImpact > 0.7) reasons.push('workflow disruption potential');
    if (factors.novelty > 0.8) reasons.push('novel insights');
    
    const reasonText = reasons.length > 0 ? reasons.join(', ') : 'standard intelligence update';
    
    return `Classified as ${significance} due to ${reasonText}`;
  }

  /**
   * Determine if change should be filtered out
   */
  private shouldFilterChange(significanceScore: ChangeSignificanceScore): boolean {
    // Don't filter major changes
    if (significanceScore.significance === 'major') return false;
    
    // Filter minor changes when user is highly active
    if (significanceScore.significance === 'minor' && 
        this.userActivity.engagementLevel === 'high' &&
        significanceScore.confidence < 0.6) {
      return true;
    }
    
    return false;
  }

  /**
   * Determine if change should be auto-approved
   */
  private shouldAutoApprove(significanceScore: ChangeSignificanceScore): boolean {
    const rules = this.config.autoApprovalRules;
    
    // Only auto-approve minor changes
    if (significanceScore.significance !== 'minor') return false;
    
    // Don't auto-approve if user is actively working
    if (this.userActivity.isActive && 
        Date.now() - this.userActivity.lastActivity < rules.userInactivityThreshold) {
      return false;
    }
    
    // Auto-approve high-confidence minor changes
    return significanceScore.confidence >= rules.confidenceThreshold;
  }

  /**
   * Determine batch key for grouping related changes
   */
  private determineBatchKey(event: IntelligenceEvent, significanceScore: ChangeSignificanceScore): string {
    if (!this.config.batchingRules.groupRelatedChanges) {
      return `single_${event.id}`;
    }
    
    const topic = this.extractTopic(event);
    const timeWindow = Math.floor(Date.now() / this.config.batchingRules.timeWindow);
    
    return `${topic}_${significanceScore.significance}_${timeWindow}`;
  }

  /**
   * Extract topic from intelligence event for grouping
   */
  private extractTopic(event: IntelligenceEvent): string {
    // Try to extract topic from first change field
    const firstField = event.changes?.[0]?.field;
    if (firstField) return firstField;
    
    // Fallback to event kind or generic
    return event.kind || 'general';
  }

  /**
   * Calculate aggregated confidence for a batch
   */
  private calculateAggregatedConfidence(events: IntelligenceEvent[]): number {
    if (events.length === 0) return 0;
    
    // Calculate average confidence from all changes in all events
    let totalConfidence = 0;
    let changeCount = 0;
    
    events.forEach(event => {
      if (event.changes && event.changes.length > 0) {
        event.changes.forEach(change => {
          totalConfidence += change.confidence;
          changeCount++;
        });
      }
    });
    
    return changeCount > 0 ? totalConfidence / changeCount : 0.5;
  }

  /**
   * Check if batch is ready to be released
   */
  private isBatchReady(batch: BatchedChange): boolean {
    // Release if max batch size reached
    if (batch.events.length >= this.config.batchingRules.maxBatchSize) {
      return true;
    }
    
    // Release if significance has been upgraded to major
    if (batch.significance === 'major') {
      return true;
    }
    
    return false;
  }

  /**
   * Schedule batch release after time window
   */
  private scheduleBatchRelease(
    batchKey: string,
    batch: BatchedChange,
    onBatchReady: (batch: BatchedChange) => void
  ): void {
    
    const releaseTimeout = setTimeout(() => {
      this.releaseBatch(batchKey, batch, onBatchReady);
    }, this.config.batchingRules.timeWindow);
    
    // Store timeout for potential cancellation
    this.autoApprovalTimers.set(batchKey, releaseTimeout);
  }

  /**
   * Release a batch for user review
   */
  private releaseBatch(
    batchKey: string,
    batch: BatchedChange,
    onBatchReady: (batch: BatchedChange) => void
  ): void {
    
    // Clear any scheduled timers
    const timer = this.autoApprovalTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.autoApprovalTimers.delete(batchKey);
    }
    
    // Remove from pending
    this.pendingBatches.delete(batchKey);
    
    // Notify callback
    onBatchReady(batch);
  }

  /**
   * Calculate user engagement level
   */
  private calculateEngagementLevel(
    pageContext: PageContext,
    timeSinceLastActivity: number
  ): 'low' | 'medium' | 'high' {
    
    if (!pageContext.userActivity.isActivelyEngaged) return 'low';
    
    const hasRecentActivity = timeSinceLastActivity < 30000; // 30 seconds
    const hasTextSelection = !!pageContext.userActivity.selectedText;
    const hasRecentEdits = pageContext.userActivity.recentEdits.length > 0;
    const highMouseActivity = pageContext.userActivity.mouseMovements > 10;
    
    const engagementScore = 
      (hasRecentActivity ? 1 : 0) +
      (hasTextSelection ? 1 : 0) +
      (hasRecentEdits ? 1 : 0) +
      (highMouseActivity ? 1 : 0);
    
    if (engagementScore >= 3) return 'high';
    if (engagementScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Start cleanup interval for old data
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, 300000); // 5 minutes
  }

  /**
   * Clean up old tracking data
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    // Clean up old change history
    for (const [topic, frequency] of this.changeHistory.entries()) {
      if (frequency < 1) { // Remove unused topics
        this.changeHistory.delete(topic);
      } else {
        // Decay frequency over time
        this.changeHistory.set(topic, Math.max(0, frequency - 0.1));
      }
    }
    
    // Clean up expired batches (shouldn't happen in normal operation)
    for (const [batchKey, batch] of this.pendingBatches.entries()) {
      if (now - batch.createdAt > maxAge) {
        this.pendingBatches.delete(batchKey);
        
        const timer = this.autoApprovalTimers.get(batchKey);
        if (timer) {
          clearTimeout(timer);
          this.autoApprovalTimers.delete(batchKey);
        }
      }
    }
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      pendingBatches: Array.from(this.pendingBatches.values()),
      userActivity: this.userActivity,
      changeHistory: Object.fromEntries(this.changeHistory.entries()),
      config: this.config
    };
  }

  /**
   * Force release all pending batches (for testing)
   */
  forceReleaseAll(onBatchReady: (batch: BatchedChange) => void): void {
    for (const [batchKey, batch] of this.pendingBatches.entries()) {
      this.releaseBatch(batchKey, batch, onBatchReady);
    }
  }
}

// Default configuration optimized for production
export const defaultChangeFatigueConfig: ChangeSignificanceFilter = {
  significanceThreshold: 'moderate',
  batchingRules: {
    groupRelatedChanges: true,
    timeWindow: 60000, // 1 minute
    maxBatchSize: 3
  },
  autoApprovalRules: {
    minorChangesTimeout: 45000, // 45 seconds
    userInactivityThreshold: 120000, // 2 minutes
    confidenceThreshold: 0.8
  }
};

// Export singleton instance
export const changeFatigueManager = new ChangeFatiguePreventionManager(defaultChangeFatigueConfig);