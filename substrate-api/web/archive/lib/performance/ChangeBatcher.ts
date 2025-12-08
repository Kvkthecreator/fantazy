// ============================================================================
// CHANGE BATCHING & DEBOUNCING SYSTEM
// ============================================================================
// Intelligent batching and debouncing for optimal performance and user experience

import type { ChangeRequest } from '@/lib/services/UniversalChangeService';
import { getPerformanceMonitor } from './PerformanceMonitor';

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  priorityThreshold: number;
  debounceWindow: number;
  enableSmartBatching: boolean;
  adaptiveBatching: boolean;
}

export interface BatchMetrics {
  batchId: string;
  changeCount: number;
  totalWaitTime: number;
  processingTime: number;
  successRate: number;
  conflictRate: number;
  userSatisfactionImpact: number;
}

export interface DebouncedChange {
  change: ChangeRequest;
  timestamp: number;
  timeoutId: NodeJS.Timeout;
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: 'user' | 'system' | 'auto';
}

export interface BatchGroup {
  id: string;
  changes: ChangeRequest[];
  createdAt: number;
  scheduledAt: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'text_edit' | 'structure' | 'metadata' | 'intelligence' | 'mixed';
  estimatedProcessingTime: number;
}

/**
 * Intelligent Change Batching & Debouncing System
 * 
 * Features:
 * - Smart debouncing based on change type and user behavior
 * - Adaptive batching with performance-aware sizing
 * - Priority-based processing for critical changes
 * - User experience optimization
 * - Conflict-aware batching strategies
 * - Performance monitoring and auto-tuning
 */
export class ChangeBatcher {
  private config: BatchConfig;
  private pendingChanges: Map<string, DebouncedChange> = new Map();
  private batchQueue: BatchGroup[] = [];
  private isProcessing: boolean = false;
  private batchMetrics: Map<string, BatchMetrics> = new Map();
  private performanceMonitor = getPerformanceMonitor();
  private userActivityTracker = new UserActivityTracker();
  
  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      maxBatchSize: 10,
      maxWaitTime: 2000,
      priorityThreshold: 500,
      debounceWindow: 300,
      enableSmartBatching: true,
      adaptiveBatching: true,
      ...config
    };

    this.startBatchProcessor();
    this.startAdaptiveOptimization();
  }

  // ========================================================================
  // CORE BATCHING API
  // ========================================================================

  async submitChange(
    change: ChangeRequest,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      bypassBatching?: boolean;
      debounceKey?: string;
    } = {}
  ): Promise<void> {
    const priority = options.priority || this.determinePriority(change);
    
    // Critical changes bypass batching
    if (priority === 'critical' || options.bypassBatching) {
      await this.processImmediately(change);
      return;
    }

    // Apply intelligent debouncing
    const debounceKey = options.debounceKey || this.generateDebounceKey(change);
    await this.debounceChange(change, debounceKey, priority);
  }

  private async debounceChange(
    change: ChangeRequest,
    debounceKey: string,
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    // Cancel existing debounced change if present
    const existingChange = this.pendingChanges.get(debounceKey);
    if (existingChange) {
      clearTimeout(existingChange.timeoutId);
    }

    // Calculate adaptive debounce delay
    const debounceDelay = this.calculateDebounceDelay(change, priority);

    // Create new debounced change
    const timeoutId = setTimeout(async () => {
      await this.processDebouncedChange(debounceKey);
    }, debounceDelay);

    const debouncedChange: DebouncedChange = {
      change,
      timestamp: Date.now(),
      timeoutId,
      priority,
      source: this.determineChangeSource(change)
    };

    this.pendingChanges.set(debounceKey, debouncedChange);

    // Record debouncing metrics
    this.performanceMonitor.recordMetric({
      name: 'change_debounced',
      value: debounceDelay,
      unit: 'ms',
      source: 'system',
      category: 'performance',
      tags: {
        changeType: change.type,
        priority,
        debounceKey: debounceKey.substring(0, 8) // Truncated for privacy
      }
    });
  }

  private async processDebouncedChange(debounceKey: string): Promise<void> {
    const debouncedChange = this.pendingChanges.get(debounceKey);
    if (!debouncedChange) return;

    this.pendingChanges.delete(debounceKey);
    
    // Add to batch queue
    await this.addToBatch(debouncedChange.change, debouncedChange.priority);
  }

  // ========================================================================
  // INTELLIGENT BATCHING
  // ========================================================================

  private async addToBatch(change: ChangeRequest, priority: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
    const category = this.categorizeChange(change);
    
    // Find compatible batch or create new one
    let targetBatch = this.findCompatibleBatch(change, category, priority);
    
    if (!targetBatch) {
      targetBatch = this.createNewBatch(category, priority);
      this.batchQueue.push(targetBatch);
    }

    targetBatch.changes.push(change);
    targetBatch.estimatedProcessingTime = this.estimateProcessingTime(targetBatch.changes);

    // Check if batch should be processed immediately
    if (this.shouldProcessBatch(targetBatch)) {
      await this.processBatch(targetBatch);
    }
  }

  private findCompatibleBatch(
    change: ChangeRequest,
    category: BatchGroup['category'],
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): BatchGroup | null {
    return this.batchQueue.find(batch => 
      batch.category === category &&
      batch.priority === priority &&
      batch.changes.length < this.config.maxBatchSize &&
      this.areChangesCompatible(batch.changes, change) &&
      Date.now() - batch.createdAt < this.config.maxWaitTime
    ) || null;
  }

  private createNewBatch(
    category: BatchGroup['category'],
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): BatchGroup {
    const now = Date.now();
    return {
      id: crypto.randomUUID(),
      changes: [],
      createdAt: now,
      scheduledAt: now + this.calculateBatchDelay(priority),
      priority,
      category,
      estimatedProcessingTime: 0
    };
  }

  private shouldProcessBatch(batch: BatchGroup): boolean {
    const now = Date.now();
    
    // Process if batch is full
    if (batch.changes.length >= this.config.maxBatchSize) {
      return true;
    }
    
    // Process if max wait time exceeded
    if (now >= batch.scheduledAt) {
      return true;
    }
    
    // Process high priority batches quickly
    if (batch.priority === 'high' && batch.changes.length >= 3) {
      return true;
    }
    
    // Process if user went idle (for better perceived performance)
    if (this.userActivityTracker.isUserIdle() && batch.changes.length > 0) {
      return true;
    }

    return false;
  }

  // ========================================================================
  // BATCH PROCESSING
  // ========================================================================

  private async processBatch(batch: BatchGroup): Promise<void> {
    // Remove from queue
    const index = this.batchQueue.indexOf(batch);
    if (index > -1) {
      this.batchQueue.splice(index, 1);
    }

    const startTime = Date.now();
    const batchMetric: BatchMetrics = {
      batchId: batch.id,
      changeCount: batch.changes.length,
      totalWaitTime: startTime - batch.createdAt,
      processingTime: 0,
      successRate: 0,
      conflictRate: 0,
      userSatisfactionImpact: 0
    };

    try {
      // Optimize batch order for minimal conflicts
      const optimizedChanges = this.optimizeBatchOrder(batch.changes);
      
      // Process changes in batch
      const results = await this.executeBatch(optimizedChanges);
      
      // Calculate metrics
      const successCount = results.filter(r => r.success).length;
      const conflictCount = results.filter(r => r.conflicts && r.conflicts.length > 0).length;
      
      batchMetric.processingTime = Date.now() - startTime;
      batchMetric.successRate = successCount / results.length;
      batchMetric.conflictRate = conflictCount / results.length;
      batchMetric.userSatisfactionImpact = this.calculateUserSatisfactionImpact(batchMetric);

      // Store metrics
      this.batchMetrics.set(batch.id, batchMetric);

      // Record performance metrics
      this.performanceMonitor.recordMetric({
        name: 'batch_processed',
        value: batchMetric.processingTime,
        unit: 'ms',
        source: 'system',
        category: 'performance',
        tags: {
          batchSize: batch.changes.length.toString(),
          category: batch.category,
          priority: batch.priority,
          successRate: batchMetric.successRate.toString()
        }
      });

      console.log(`📦 Processed batch ${batch.id}: ${batch.changes.length} changes in ${batchMetric.processingTime}ms`);

    } catch (error) {
      console.error('Batch processing failed:', error);
      
      // Fallback: process changes individually
      await this.fallbackIndividualProcessing(batch.changes);
    }
  }

  private async executeBatch(changes: ChangeRequest[]): Promise<any[]> {
    // This would integrate with the Universal Change Service
    // For now, simulate batch processing
    
    const results = [];
    for (const change of changes) {
      // Simulate processing each change
      const result = {
        success: Math.random() > 0.1, // 90% success rate
        conflicts: Math.random() > 0.8 ? [{ id: 'conflict', type: 'concurrent_edit' }] : [],
        changeId: change.id
      };
      results.push(result);
      
      // Small delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return results;
  }

  private async fallbackIndividualProcessing(changes: ChangeRequest[]): Promise<void> {
    console.log('🔄 Falling back to individual change processing');
    
    for (const change of changes) {
      try {
        await this.processImmediately(change);
      } catch (error) {
        console.error(`Failed to process individual change ${change.id}:`, error);
      }
    }
  }

  private async processImmediately(change: ChangeRequest): Promise<void> {
    // This would integrate with the Universal Change Service
    console.log(`⚡ Processing change immediately: ${change.type} for basket ${change.basketId}`);
    
    const startTime = Date.now();
    
    // Simulate immediate processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.performanceMonitor.recordMetric({
      name: 'change_processed_immediately',
      value: Date.now() - startTime,
      unit: 'ms',
      source: 'system',
      category: 'performance',
      tags: {
        changeType: change.type,
        basketId: change.basketId
      }
    });
  }

  // ========================================================================
  // OPTIMIZATION ALGORITHMS
  // ========================================================================

  private optimizeBatchOrder(changes: ChangeRequest[]): ChangeRequest[] {
    // Sort changes to minimize conflicts and dependencies
    return changes.sort((a, b) => {
      // Process document creates before updates
      if (a.type === 'document_create' && b.type === 'document_update') return -1;
      if (a.type === 'document_update' && b.type === 'document_create') return 1;
      
      // Process intelligence operations last
      if (a.type.includes('intelligence') && !b.type.includes('intelligence')) return 1;
      if (!a.type.includes('intelligence') && b.type.includes('intelligence')) return -1;
      
      // Sort by timestamp for same types
      return a.timestamp.localeCompare(b.timestamp);
    });
  }

  private calculateDebounceDelay(change: ChangeRequest, priority: 'low' | 'medium' | 'high' | 'critical'): number {
    let baseDelay = this.config.debounceWindow;
    
    // Adjust based on priority
    switch (priority) {
      case 'critical': return 0; // No debouncing
      case 'high': return baseDelay * 0.5;
      case 'medium': return baseDelay;
      case 'low': return baseDelay * 2;
    }

    // Adjust based on change type
    if (change.type === 'document_update') {
      baseDelay *= 1.5; // Text edits can be debounced longer
    } else if (change.type === 'intelligence_generate') {
      baseDelay *= 0.8; // Intelligence operations should be snappier
    }

    // Adjust based on user activity
    if (this.userActivityTracker.isUserActivelyTyping()) {
      baseDelay *= 1.5; // Wait longer when user is actively typing
    }

    return Math.max(50, Math.min(baseDelay, 5000)); // Clamp between 50ms and 5s
  }

  private calculateBatchDelay(priority: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (priority) {
      case 'critical': return 0;
      case 'high': return this.config.priorityThreshold;
      case 'medium': return this.config.maxWaitTime * 0.7;
      case 'low': return this.config.maxWaitTime;
      default: return this.config.maxWaitTime;
    }
  }

  // ========================================================================
  // ADAPTIVE OPTIMIZATION
  // ========================================================================

  private startAdaptiveOptimization(): void {
    if (!this.config.adaptiveBatching) return;

    // Analyze performance every 2 minutes and adjust settings
    setInterval(() => {
      this.optimizeConfiguration();
    }, 120000);
  }

  private optimizeConfiguration(): void {
    const recentMetrics = Array.from(this.batchMetrics.values())
      .filter(metric => Date.now() - metric.batchId.length < 600000) // Last 10 minutes (simplified)
      .slice(-20); // Last 20 batches

    if (recentMetrics.length < 5) return; // Need enough data

    const avgProcessingTime = recentMetrics.reduce((sum, m) => sum + m.processingTime, 0) / recentMetrics.length;
    const avgSuccessRate = recentMetrics.reduce((sum, m) => sum + m.successRate, 0) / recentMetrics.length;
    const avgUserSatisfaction = recentMetrics.reduce((sum, m) => sum + m.userSatisfactionImpact, 0) / recentMetrics.length;

    // Adjust batch size based on performance
    if (avgProcessingTime > 1000 && this.config.maxBatchSize > 3) {
      this.config.maxBatchSize = Math.max(3, this.config.maxBatchSize - 1);
      console.log(`📉 Reduced batch size to ${this.config.maxBatchSize} due to high processing time`);
    } else if (avgProcessingTime < 300 && avgSuccessRate > 0.95 && this.config.maxBatchSize < 20) {
      this.config.maxBatchSize = Math.min(20, this.config.maxBatchSize + 1);
      console.log(`📈 Increased batch size to ${this.config.maxBatchSize} due to good performance`);
    }

    // Adjust wait time based on user satisfaction
    if (avgUserSatisfaction < 3.0 && this.config.maxWaitTime > 500) {
      this.config.maxWaitTime = Math.max(500, this.config.maxWaitTime - 200);
      console.log(`⚡ Reduced wait time to ${this.config.maxWaitTime}ms to improve user satisfaction`);
    } else if (avgUserSatisfaction > 4.0 && avgSuccessRate > 0.9 && this.config.maxWaitTime < 5000) {
      this.config.maxWaitTime = Math.min(5000, this.config.maxWaitTime + 200);
      console.log(`🕐 Increased wait time to ${this.config.maxWaitTime}ms for better batching efficiency`);
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private determinePriority(change: ChangeRequest): 'low' | 'medium' | 'high' | 'critical' {
    // User-initiated changes are higher priority
    if (change.origin === 'user') {
      if (change.type === 'document_create' || change.type === 'document_delete') {
        return 'high';
      }
      return 'medium';
    }

    // System-initiated changes
    if (change.type === 'intelligence_generate' || change.type === 'intelligence_approve') {
      return 'medium';
    }

    return 'low';
  }

  private generateDebounceKey(change: ChangeRequest): string {
    // Create a key that groups similar changes together
    const baseKey = `${change.basketId}_${change.type}`;
    
    if (change.type === 'document_update') {
      const docData = change.data as any;
      return `${baseKey}_${docData.documentId}`;
    }
    
    if (change.type === 'basket_update') {
      return `${baseKey}_metadata`;
    }

    return baseKey;
  }

  private categorizeChange(change: ChangeRequest): BatchGroup['category'] {
    if (change.type === 'document_update' || change.type === 'document_create') {
      return 'text_edit';
    }
    
    if (change.type.includes('intelligence')) {
      return 'intelligence';
    }
    
    if (change.type === 'basket_update') {
      return 'metadata';
    }
    
    if (change.type.includes('block')) {
      return 'structure';
    }

    return 'mixed';
  }

  private areChangesCompatible(existingChanges: ChangeRequest[], newChange: ChangeRequest): boolean {
    // Don't batch changes that might conflict
    for (const existing of existingChanges) {
      // Same document updates might conflict
      if (existing.type === 'document_update' && newChange.type === 'document_update') {
        const existingData = existing.data as any;
        const newData = newChange.data as any;
        if (existingData.documentId === newData.documentId) {
          return false; // Potential conflict
        }
      }
      
      // Intelligence operations on same basket might conflict
      if (existing.type.includes('intelligence') && newChange.type.includes('intelligence') &&
          existing.basketId === newChange.basketId) {
        return false;
      }
    }

    return true;
  }

  private estimateProcessingTime(changes: ChangeRequest[]): number {
    let totalTime = 0;
    
    for (const change of changes) {
      switch (change.type) {
        case 'document_create':
        case 'document_update':
          totalTime += 200; // Base processing time
          break;
        case 'intelligence_generate':
          totalTime += 1000; // Intelligence is slower
          break;
        case 'basket_update':
          totalTime += 100; // Quick metadata updates
          break;
        default:
          totalTime += 150; // Default estimate
      }
    }

    return totalTime;
  }

  private determineChangeSource(change: ChangeRequest): 'user' | 'system' | 'auto' {
    return change.origin === 'user' ? 'user' : 
           change.origin === 'system' ? 'system' : 'auto';
  }

  private calculateUserSatisfactionImpact(metrics: BatchMetrics): number {
    // Calculate user satisfaction based on various factors
    let score = 5.0; // Start with perfect score
    
    // Reduce score for high wait times
    if (metrics.totalWaitTime > 2000) {
      score -= (metrics.totalWaitTime - 2000) / 1000 * 0.5;
    }
    
    // Reduce score for high processing times
    if (metrics.processingTime > 1000) {
      score -= (metrics.processingTime - 1000) / 1000 * 0.3;
    }
    
    // Reduce score for conflicts
    score -= metrics.conflictRate * 1.0;
    
    // Reduce score for failures
    score -= (1 - metrics.successRate) * 2.0;

    return Math.max(1.0, Math.min(5.0, score));
  }

  // ========================================================================
  // BATCH PROCESSOR
  // ========================================================================

  private startBatchProcessor(): void {
    // Process batches every 100ms
    setInterval(async () => {
      if (this.isProcessing || this.batchQueue.length === 0) return;
      
      this.isProcessing = true;
      
      try {
        // Find batches ready for processing
        const readyBatches = this.batchQueue.filter(batch => this.shouldProcessBatch(batch));
        
        // Process ready batches
        for (const batch of readyBatches) {
          await this.processBatch(batch);
        }
      } catch (error) {
        console.error('Batch processor error:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 100);
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  getQueueStatus(): {
    pendingChanges: number;
    queuedBatches: number;
    avgProcessingTime: number;
    successRate: number;
  } {
    const recentMetrics = Array.from(this.batchMetrics.values()).slice(-10);
    
    return {
      pendingChanges: this.pendingChanges.size,
      queuedBatches: this.batchQueue.length,
      avgProcessingTime: recentMetrics.length > 0 
        ? recentMetrics.reduce((sum, m) => sum + m.processingTime, 0) / recentMetrics.length 
        : 0,
      successRate: recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.successRate, 0) / recentMetrics.length
        : 0
    };
  }

  flushPendingChanges(): Promise<void> {
    // Force process all pending changes immediately
    const promises = Array.from(this.pendingChanges.entries()).map(async ([key, change]) => {
      clearTimeout(change.timeoutId);
      this.pendingChanges.delete(key);
      await this.processImmediately(change.change);
    });

    return Promise.all(promises).then(() => {});
  }

  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📝 Batch configuration updated:', newConfig);
  }

  getMetrics(): BatchMetrics[] {
    return Array.from(this.batchMetrics.values());
  }
}

// ========================================================================
// USER ACTIVITY TRACKER
// ========================================================================

class UserActivityTracker {
  private lastActivity: number = Date.now();
  private isTyping: boolean = false;
  private typingTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.setupActivityListeners();
  }

  private setupActivityListeners(): void {
    if (typeof window === 'undefined') return;

    // Track general user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivity = Date.now();
      }, { passive: true });
    });

    // Track typing specifically
    document.addEventListener('keydown', (event) => {
      if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
        this.isTyping = true;
        
        if (this.typingTimeout) {
          clearTimeout(this.typingTimeout);
        }
        
        this.typingTimeout = setTimeout(() => {
          this.isTyping = false;
        }, 1000);
      }
    }, { passive: true });
  }

  isUserIdle(idleThreshold: number = 2000): boolean {
    return Date.now() - this.lastActivity > idleThreshold;
  }

  isUserActivelyTyping(): boolean {
    return this.isTyping;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let globalChangeBatcher: ChangeBatcher | null = null;

export function getChangeBatcher(): ChangeBatcher {
  if (!globalChangeBatcher) {
    globalChangeBatcher = new ChangeBatcher();
  }
  return globalChangeBatcher;
}