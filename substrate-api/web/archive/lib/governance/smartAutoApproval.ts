/**
 * Smart Auto-Approval System - Priority 2 Enhancement
 *
 * Intelligent auto-approval rules based on confidence thresholds,
 * operation types, and user roles. Maintains Canon governance integrity
 * while reducing manual review overhead.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ChangeDescriptor } from './changeDescriptor';
import type { Decision } from './policyDecider';

export interface AutoApprovalRule {
  id: string;
  name: string;
  condition: 'confidence_threshold' | 'operation_type' | 'user_role' | 'composite';
  threshold?: number;
  allowedOperations?: string[];
  requiredRoles?: string[];
  exceptions?: string[];
  enabled: boolean;
  priority: number; // Higher number = higher priority
}

export interface AutoApprovalContext {
  workspace_id: string;
  basket_id: string;
  actor_id: string;
  userRole?: string;
  recentFailures: number;
}

export interface AutoApprovalResult {
  approved: boolean;
  rule?: AutoApprovalRule;
  reason: string;
  confidence: number;
  requiresTracking: boolean;
}

export class SmartAutoApprovalEngine {
  private defaultRules: AutoApprovalRule[];

  constructor() {
    this.defaultRules = [
      // High-confidence single operations
      {
        id: 'high-confidence-single',
        name: 'High Confidence Single Operation',
        condition: 'confidence_threshold',
        threshold: 0.9,
        allowedOperations: ['CreateBlock', 'CreateContextItem'],
        enabled: true,
        priority: 100
      },
      
      // Trusted agent operations
      {
        id: 'trusted-agent-extraction', 
        name: 'Trusted Agent Extraction',
        condition: 'composite',
        threshold: 0.8,
        allowedOperations: ['CreateBlock', 'CreateContextItem'],
        exceptions: ['bulk_operations'],
        enabled: true,
        priority: 90
      },

      // Low-risk refinements
      {
        id: 'low-risk-refinements',
        name: 'Low Risk Content Refinements', 
        condition: 'operation_type',
        allowedOperations: ['ReviseBlock'],
        threshold: 0.75,
        enabled: true,
        priority: 70
      },

      // Context item management
      {
        id: 'context-management',
        name: 'Context Item Management',
        condition: 'operation_type',
        allowedOperations: ['CreateContextItem', 'UpdateContextItem'],
        threshold: 0.8,
        enabled: true,
        priority: 60
      }
    ];
  }

  /**
   * Evaluate if a change descriptor qualifies for auto-approval
   */
  async evaluateAutoApproval(
    supabase: SupabaseClient,
    cd: ChangeDescriptor,
    context: AutoApprovalContext,
    validatorReport?: any
  ): Promise<AutoApprovalResult> {
    
    // Load workspace-specific rules
    const rules = await this.loadWorkspaceRules(supabase, context.workspace_id);
    
    // Sort by priority (highest first)
    const sortedRules = [...this.defaultRules, ...rules]
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    // Evaluate each rule
    for (const rule of sortedRules) {
      const result = await this.evaluateRule(rule, cd, context, validatorReport);
      if (result.approved) {
        return {
          ...result,
          rule,
          requiresTracking: this.shouldTrackApproval(rule, cd, context)
        };
      }
    }

    return {
      approved: false,
      reason: 'No auto-approval rules matched',
      confidence: 0,
      requiresTracking: false
    };
  }

  /**
   * Evaluate individual auto-approval rule
   */
  private async evaluateRule(
    rule: AutoApprovalRule,
    cd: ChangeDescriptor,
    context: AutoApprovalContext,
    validatorReport?: any
  ): Promise<AutoApprovalResult> {
    
    // Check exceptions first
    if (rule.exceptions && this.hasExceptions(cd, rule.exceptions)) {
      return {
        approved: false,
        reason: `Blocked by exception: ${rule.exceptions.join(', ')}`,
        confidence: 0,
        requiresTracking: false
      };
    }

    // Evaluate based on condition type
    switch (rule.condition) {
      case 'confidence_threshold':
        return this.evaluateConfidenceThreshold(rule, cd, validatorReport);

      case 'operation_type':
        return this.evaluateOperationType(rule, cd, validatorReport);

      case 'user_role':
        return this.evaluateUserRole(rule, cd, context);

      case 'composite':
        return this.evaluateComposite(rule, cd, context, validatorReport);

      default:
        return {
          approved: false,
          reason: `Unknown rule condition: ${rule.condition}`,
          confidence: 0,
          requiresTracking: false
        };
    }
  }

  /**
   * Evaluate confidence threshold rule
   */
  private evaluateConfidenceThreshold(
    rule: AutoApprovalRule,
    cd: ChangeDescriptor,
    validatorReport?: any
  ): AutoApprovalResult {
    const confidence = validatorReport?.confidence || this.calculateOperationConfidence(cd.ops);
    const threshold = rule.threshold || 0.8;

    if (confidence >= threshold) {
      // Check operation type restrictions
      if (rule.allowedOperations) {
        const opTypes = new Set(cd.ops.map(op => op.type));
        const hasDisallowedOps = Array.from(opTypes).some(type => !rule.allowedOperations!.includes(type));
        
        if (hasDisallowedOps) {
          return {
            approved: false,
            reason: `Operation types not in allowed list: ${Array.from(opTypes).join(', ')}`,
            confidence: confidence,
            requiresTracking: false
          };
        }
      }

      return {
        approved: true,
        reason: `High confidence (${(confidence * 100).toFixed(1)}%) exceeds threshold (${(threshold * 100).toFixed(1)}%)`,
        confidence: confidence,
        requiresTracking: false
      };
    }

    return {
      approved: false,
      reason: `Confidence ${(confidence * 100).toFixed(1)}% below threshold ${(threshold * 100).toFixed(1)}%`,
      confidence: confidence,
      requiresTracking: false
    };
  }

  /**
   * Evaluate operation type rule
   */
  private evaluateOperationType(
    rule: AutoApprovalRule,
    cd: ChangeDescriptor,
    validatorReport?: any
  ): AutoApprovalResult {
    if (!rule.allowedOperations || rule.allowedOperations.length === 0) {
      return {
        approved: false,
        reason: 'No allowed operations defined',
        confidence: 0,
        requiresTracking: false
      };
    }

    const opTypes = new Set(cd.ops.map(op => op.type));
    const hasOnlyAllowedOps = Array.from(opTypes).every(type => rule.allowedOperations!.includes(type));

    if (!hasOnlyAllowedOps) {
      return {
        approved: false,
        reason: `Contains disallowed operations: ${Array.from(opTypes).join(', ')}`,
        confidence: 0,
        requiresTracking: false
      };
    }

    const confidence = validatorReport?.confidence || this.calculateOperationConfidence(cd.ops);
    const threshold = rule.threshold || 0.7;

    if (confidence >= threshold) {
      return {
        approved: true,
        reason: `Allowed operations (${Array.from(opTypes).join(', ')}) with sufficient confidence`,
        confidence: confidence,
        requiresTracking: false
      };
    }

    return {
      approved: false,
      reason: `Confidence ${(confidence * 100).toFixed(1)}% below threshold for operation type`,
      confidence: confidence,
      requiresTracking: false
    };
  }

  /**
   * Evaluate user role rule
   */
  private evaluateUserRole(
    rule: AutoApprovalRule,
    cd: ChangeDescriptor,
    context: AutoApprovalContext
  ): AutoApprovalResult {
    if (!rule.requiredRoles || rule.requiredRoles.length === 0) {
      return {
        approved: false,
        reason: 'No required roles defined',
        confidence: 0,
        requiresTracking: false
      };
    }

    const userRole = context.userRole || 'user';
    
    if (!rule.requiredRoles.includes(userRole)) {
      return {
        approved: false,
        reason: `User role '${userRole}' not in required roles: ${rule.requiredRoles.join(', ')}`,
        confidence: 0,
        requiresTracking: false
      };
    }

    const confidence = this.calculateOperationConfidence(cd.ops);
    const threshold = rule.threshold || 0.6; // Lower threshold for trusted roles

    if (confidence >= threshold) {
      return {
        approved: true,
        reason: `Trusted role '${userRole}' with sufficient confidence`,
        confidence: confidence,
        requiresTracking: true // Track role-based approvals
      };
    }

    return {
      approved: false,
      reason: `Confidence below threshold for role-based rule`,
      confidence: confidence,
      requiresTracking: false
    };
  }

  /**
   * Evaluate composite rule (multiple conditions)
   */
  private evaluateComposite(
    rule: AutoApprovalRule,
    cd: ChangeDescriptor,
    context: AutoApprovalContext,
    validatorReport?: any
  ): AutoApprovalResult {
    const confidence = validatorReport?.confidence || this.calculateOperationConfidence(cd.ops);
    const threshold = rule.threshold || 0.8;
    
    // Multiple condition checks
    let passedChecks = 0;
    let totalChecks = 0;
    const reasons: string[] = [];

    // Check confidence
    totalChecks++;
    if (confidence >= threshold) {
      passedChecks++;
      reasons.push(`confidence: ${(confidence * 100).toFixed(1)}%`);
    }

    // Check operations
    if (rule.allowedOperations) {
      totalChecks++;
      const opTypes = new Set(cd.ops.map(op => op.type));
      const hasOnlyAllowedOps = Array.from(opTypes).every(type => rule.allowedOperations!.includes(type));

      if (hasOnlyAllowedOps) {
        passedChecks++;
        reasons.push(`operations: ${Array.from(opTypes).join(', ')}`);
      }
    }

    // Check recent failures
    totalChecks++;
    if (context.recentFailures <= 2) {
      passedChecks++;
      reasons.push(`recent failures: ${context.recentFailures}`);
    }

    // Require all checks to pass for composite rule
    if (passedChecks === totalChecks) {
      return {
        approved: true,
        reason: `Composite rule passed: ${reasons.join(', ')}`,
        confidence: confidence,
        requiresTracking: true
      };
    }

    return {
      approved: false,
      reason: `Composite rule failed: ${passedChecks}/${totalChecks} checks passed`,
      confidence: confidence,
      requiresTracking: false
    };
  }

  /**
   * Check for rule exceptions
   */
  private hasExceptions(cd: ChangeDescriptor, exceptions: string[]): boolean {
    // Check for bulk operations
    if (exceptions.includes('bulk_operations') && cd.ops.length > 5) {
      return true;
    }

    // Check for mixed operation types
    if (exceptions.includes('mixed_operations')) {
      const opTypes = new Set(cd.ops.map(op => op.type));
      if (opTypes.size > 2) {
        return true;
      }
    }

    // Check for high-risk operations
    if (exceptions.includes('high_risk_operations')) {
      const highRiskOps = ['DeleteBlock', 'MergeBlocks', 'PromoteScope', 'BulkDelete'];
      const hasHighRisk = cd.ops.some(op => highRiskOps.includes(op.type));
      if (hasHighRisk) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate confidence for operations without validator report
   */
  private calculateOperationConfidence(ops: any[]): number {
    if (ops.length === 0) return 0.5;

    // Use individual operation confidence scores if available
    const confidences = ops
      .map(op => op.confidence_score || 0.7)
      .filter(conf => conf > 0);

    if (confidences.length === 0) return 0.7;

    // Average with slight penalty for complexity
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    const complexityPenalty = Math.min(0.1, (ops.length - 1) * 0.02);

    return Math.max(0.1, avgConfidence - complexityPenalty);
  }

  /**
   * Determine if approval should be tracked for analysis
   */
  private shouldTrackApproval(
    rule: AutoApprovalRule,
    cd: ChangeDescriptor,
    context: AutoApprovalContext
  ): boolean {
    // Always track high-priority or role-based rules
    if (rule.priority >= 90) return true;
    if (rule.condition === 'user_role') return true;

    // Track if operations count is significant
    if (cd.ops.length >= 3) return true;

    return false;
  }

  /**
   * Load workspace-specific auto-approval rules
   */
  private async loadWorkspaceRules(
    supabase: SupabaseClient, 
    workspace_id: string
  ): Promise<AutoApprovalRule[]> {
    try {
      const { data, error } = await supabase
        .from('governance_auto_approval_rules')
        .select('*')
        .eq('workspace_id', workspace_id)
        .eq('enabled', true);

      if (error) {
        console.error('Failed to load workspace auto-approval rules:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error loading workspace rules:', error);
      return [];
    }
  }

  /**
   * Get auto-approval statistics for monitoring
   */
  async getAutoApprovalStats(
    supabase: SupabaseClient,
    workspace_id: string,
    days: number = 7
  ): Promise<{
    totalAutoApprovals: number;
    approvalsByRule: Record<string, number>;
    averageConfidence: number;
    failureRate: number;
  }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const { data, error } = await supabase
        .from('proposals')
        .select('review_notes, validator_report, status, created_at')
        .eq('workspace_id', workspace_id)
        .gte('created_at', cutoff.toISOString())
        .contains('review_notes', 'auto-approved');

      if (error || !data) {
        return {
          totalAutoApprovals: 0,
          approvalsByRule: {},
          averageConfidence: 0,
          failureRate: 0
        };
      }

      const autoApprovals = data.filter(p => p.review_notes?.includes('auto-approved'));
      const approvalsByRule: Record<string, number> = {};
      let totalConfidence = 0;
      let failures = 0;

      autoApprovals.forEach(proposal => {
        const confidence = proposal.validator_report?.confidence || 0.7;
        totalConfidence += confidence;
        
        if (proposal.status === 'REJECTED' || proposal.status === 'FAILED') {
          failures++;
        }

        // Extract rule name from review notes if available
        const ruleMatch = proposal.review_notes?.match(/rule: ([^,]+)/);
        if (ruleMatch) {
          const ruleName = ruleMatch[1];
          approvalsByRule[ruleName] = (approvalsByRule[ruleName] || 0) + 1;
        }
      });

      return {
        totalAutoApprovals: autoApprovals.length,
        approvalsByRule,
        averageConfidence: autoApprovals.length > 0 ? totalConfidence / autoApprovals.length : 0,
        failureRate: autoApprovals.length > 0 ? failures / autoApprovals.length : 0
      };
    } catch (error) {
      console.error('Error getting auto-approval stats:', error);
      return {
        totalAutoApprovals: 0,
        approvalsByRule: {},
        averageConfidence: 0,
        failureRate: 0
      };
    }
  }
}

// Global auto-approval engine instance
export const globalAutoApprovalEngine = new SmartAutoApprovalEngine();