/**
 * Proposal Batching System - Priority 1 Optimization
 * 
 * Reduces proposal volume by intelligently batching related operations
 * within time windows and contextual groupings, while maintaining 
 * Canon compliance and governance integrity.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ChangeDescriptor } from './changeDescriptor';

export interface ProposalBatch {
  id: string;
  operations: any[];
  context: BatchContext;
  timeWindow: BatchTimeWindow;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
}

interface BatchContext {
  basket_id: string;
  workspace_id: string;
  actor_id: string;
  entry_point: string;
  theme: string; // e.g., "extraction", "cleanup", "composition"
}

interface BatchTimeWindow {
  start: Date;
  end: Date;
  maxOperations: number;
  completed: boolean;
}

interface BatchingRules {
  maxBatchSize: number;
  timeWindowMs: number;
  similarityThreshold: number;
  batchableOperations: Set<string>;
}

export class ProposalBatcher {
  private activeBatches: Map<string, ProposalBatch> = new Map();
  private rules: BatchingRules;
  
  constructor(rules?: Partial<BatchingRules>) {
    this.rules = {
      maxBatchSize: 10,
      timeWindowMs: 30000, // 30 seconds
      similarityThreshold: 0.7,
      batchableOperations: new Set([
        'CreateBlock',
        'CreateContextItem', 
        'ReviseBlock',
        'UpdateContextItem',
        'AttachContextItem',
        'DetachOp'
      ]),
      ...rules
    };
  }

  /**
   * Canon-compliant batching: Group related operations without losing semantic meaning
   */
  async processBatchableChange(
    supabase: SupabaseClient,
    cd: ChangeDescriptor
  ): Promise<{ batched: boolean; batchId?: string; shouldProcess: boolean }> {
    
    // Check if operations are batchable
    const batchableOps = cd.ops.filter(op => this.rules.batchableOperations.has(op.type));
    if (batchableOps.length === 0) {
      return { batched: false, shouldProcess: true };
    }

    // Generate batch key for contextual grouping
    const batchKey = this.generateBatchKey(cd);
    const existingBatch = this.activeBatches.get(batchKey);

    if (existingBatch) {
      // Add to existing batch if within limits and time window
      if (this.canAddToBatch(existingBatch, cd)) {
        existingBatch.operations.push(...cd.ops);
        existingBatch.confidence = this.calculateBatchConfidence(existingBatch);
        
        // Check if batch should be processed now
        if (this.shouldProcessBatch(existingBatch)) {
          this.activeBatches.delete(batchKey);
          return { batched: true, batchId: existingBatch.id, shouldProcess: true };
        }
        
        return { batched: true, batchId: existingBatch.id, shouldProcess: false };
      }
    }

    // Create new batch
    const newBatch = this.createBatch(cd, batchKey);
    this.activeBatches.set(batchKey, newBatch);
    
    // Start timer for batch processing
    setTimeout(() => {
      this.processBatchTimeout(batchKey);
    }, this.rules.timeWindowMs);

    return { batched: true, batchId: newBatch.id, shouldProcess: false };
  }

  /**
   * Generate contextual batch key for grouping related operations
   */
  private generateBatchKey(cd: ChangeDescriptor): string {
    const theme = this.inferBatchTheme(cd.ops);
    return `${cd.basket_id || 'no-basket'}:${cd.actor_id}:${theme}:${cd.entry_point}`;
  }

  /**
   * Infer semantic theme for batch grouping
   */
  private inferBatchTheme(ops: any[]): string {
    const types = new Set(ops.map(op => op.type));
    
    // Canon-aligned theme detection
    if (types.has('CreateBlock') && types.has('CreateContextItem')) return 'extraction';
    if (types.has('ReviseBlock') || types.has('UpdateContextItem')) return 'refinement';
    if (types.has('AttachContextItem') || types.has('DetachOp')) return 'relationships';
    if (types.has('CreateDump')) return 'capture';
    
    return 'mixed';
  }

  /**
   * Check if operation can be added to existing batch
   */
  private canAddToBatch(batch: ProposalBatch, cd: ChangeDescriptor): boolean {
    const now = new Date();
    
    // Time window check
    if (now > batch.timeWindow.end) return false;
    
    // Size limit check
    if (batch.operations.length + cd.ops.length > this.rules.maxBatchSize) return false;
    
    // Context similarity check
    if (batch.context.basket_id !== (cd.basket_id || '')) return false;
    if (batch.context.actor_id !== cd.actor_id) return false;
    if (batch.context.entry_point !== cd.entry_point) return false;
    
    // Theme compatibility
    const newTheme = this.inferBatchTheme(cd.ops);
    if (batch.context.theme !== newTheme && batch.context.theme !== 'mixed') {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate batch confidence based on individual operation confidence
   */
  private calculateBatchConfidence(batch: ProposalBatch): number {
    if (batch.operations.length === 0) return 0.5;
    
    // Use minimum confidence to maintain Canon governance integrity
    const confidences = batch.operations
      .map(op => op.confidence_score || 0.7)
      .filter(conf => conf > 0);
    
    if (confidences.length === 0) return 0.7;
    
    // Weighted average with penalty for batch complexity
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    const complexityPenalty = Math.min(0.1, batch.operations.length * 0.01);
    
    return Math.max(0.1, avgConfidence - complexityPenalty);
  }

  /**
   * Determine if batch should be processed immediately
   */
  private shouldProcessBatch(batch: ProposalBatch): boolean {
    const now = new Date();
    
    // Process if time window expired
    if (now >= batch.timeWindow.end) return true;
    
    // Process if max size reached
    if (batch.operations.length >= this.rules.maxBatchSize) return true;
    
    // Process high priority batches more aggressively
    if (batch.priority === 'high' && batch.operations.length >= 3) return true;
    
    return false;
  }

  /**
   * Create new batch from change descriptor
   */
  private createBatch(cd: ChangeDescriptor, batchKey: string): ProposalBatch {
    const now = new Date();
    const theme = this.inferBatchTheme(cd.ops);
    
    return {
      id: crypto.randomUUID(),
      operations: [...cd.ops],
      context: {
        basket_id: cd.basket_id || '',
        workspace_id: cd.workspace_id,
        actor_id: cd.actor_id,
        entry_point: cd.entry_point,
        theme
      },
      timeWindow: {
        start: now,
        end: new Date(now.getTime() + this.rules.timeWindowMs),
        maxOperations: this.rules.maxBatchSize,
        completed: false
      },
      priority: this.calculateBatchPriority(cd, theme),
      confidence: this.calculateInitialConfidence(cd)
    };
  }

  /**
   * Calculate batch priority based on operation types and context
   */
  private calculateBatchPriority(cd: ChangeDescriptor, theme: string): 'high' | 'medium' | 'low' {
    // High priority for user-initiated operations
    if (cd.entry_point !== 'onboarding_dump') return 'high';
    
    // Medium priority for extraction and refinement
    if (theme === 'extraction' || theme === 'refinement') return 'medium';
    
    // Low priority for capture and mixed operations
    return 'low';
  }

  /**
   * Calculate initial confidence for new batch
   */
  private calculateInitialConfidence(cd: ChangeDescriptor): number {
    if (cd.ops.length === 0) return 0.5;
    
    const confidences = cd.ops
      .map(op => (op as any).confidence_score || 0.7)
      .filter(conf => conf > 0);
    
    if (confidences.length === 0) return 0.7;
    
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  /**
   * Handle batch timeout processing
   */
  private processBatchTimeout(batchKey: string): void {
    const batch = this.activeBatches.get(batchKey);
    if (batch && !batch.timeWindow.completed) {
      batch.timeWindow.completed = true;
      this.activeBatches.delete(batchKey);
      
      // Emit batch ready event for processing
      this.emitBatchReady(batch);
    }
  }

  /**
   * Emit batch ready event for downstream processing
   */
  private emitBatchReady(batch: ProposalBatch): void {
    // This would integrate with the existing governance pipeline
    console.log(`Batch ${batch.id} ready for processing with ${batch.operations.length} operations`);
  }

  /**
   * Create unified ChangeDescriptor from batch
   */
  createBatchedChangeDescriptor(batch: ProposalBatch): ChangeDescriptor {
    return {
      entry_point: batch.context.entry_point as any,
      actor_id: batch.context.actor_id,
      workspace_id: batch.context.workspace_id,
      basket_id: batch.context.basket_id,
      blast_radius: 'Local', // Batches start as local
      ops: batch.operations,
      provenance: [
        { type: 'agent' as any, id: batch.id },
        { type: 'user' as any, id: batch.context.actor_id }
      ]
    };
  }

  /**
   * Get batch statistics for monitoring
   */
  getBatchStatistics(): {
    activeBatches: number;
    totalOperations: number;
    averageConfidence: number;
    batchesByTheme: Record<string, number>;
  } {
    const batches = Array.from(this.activeBatches.values());
    
    const batchesByTheme = batches.reduce((acc, batch) => {
      acc[batch.context.theme] = (acc[batch.context.theme] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalOperations = batches.reduce((sum, batch) => sum + batch.operations.length, 0);
    const avgConfidence = batches.length > 0 
      ? batches.reduce((sum, batch) => sum + batch.confidence, 0) / batches.length 
      : 0;

    return {
      activeBatches: batches.length,
      totalOperations,
      averageConfidence: avgConfidence,
      batchesByTheme
    };
  }
}

// Global batcher instance
export const globalProposalBatcher = new ProposalBatcher();