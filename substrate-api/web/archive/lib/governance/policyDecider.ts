/**
 * PolicyDecider: Central routing logic for governance decisions
 * 
 * Takes workspace flags and change descriptor, returns routing decision.
 * Implements per-entry-point policies with risk-based hybrid routing.
 */

import type { WorkspaceFlags, EntryPoint } from './flagsServer';
import type { ChangeDescriptor } from './changeDescriptor';
import { computeOperationRisk } from './changeDescriptor';

export type Decision = {
  route: 'proposal' | 'direct';
  require_validator: boolean;
  validator_mode: 'strict' | 'lenient';
  effective_blast_radius: 'Local' | 'Scoped' | 'Global';
  reason: string; // For debugging/audit
};

export interface RiskHints {
  confidence?: number;
  conflicts?: number;
  duplicate_count?: number;
  complexity_score?: number;
}

/**
 * Main policy decision function.
 * Determines how to route a change based on workspace flags and risk assessment.
 */
export function decide(
  flags: WorkspaceFlags,
  cd: ChangeDescriptor,
  riskHints?: RiskHints
): Decision {
  // Step 1: Check if governance is enabled at all
  if (!flags.governance_enabled) {
    return {
      route: flags.direct_substrate_writes ? 'direct' : 'proposal',
      require_validator: false,
      validator_mode: 'lenient',
      effective_blast_radius: cd.blast_radius || flags.default_blast_radius,
      reason: 'governance_disabled'
    };
  }

  // Step 2: Get entry-point specific policy
  const entryPointPolicy = flags.ep[cd.entry_point];
  
  // Step 3: Apply policy-based routing
  let route: 'proposal' | 'direct';
  let reason: string;
  
  switch (entryPointPolicy) {
    case 'direct':
      route = 'direct';
      reason = `ep_policy_direct:${cd.entry_point}`;
      break;
      
    case 'proposal':
      route = 'proposal';
      reason = `ep_policy_proposal:${cd.entry_point}`;
      break;
      
    case 'hybrid':
      // Risk-based decision for hybrid mode
      const riskAssessment = assessHybridRouting(cd, riskHints);
      route = riskAssessment.route;
      reason = `ep_policy_hybrid:${cd.entry_point}:${riskAssessment.reason}`;
      break;
      
    default:
      // Fallback to proposal for safety
      route = 'proposal';
      reason = `ep_policy_unknown:${cd.entry_point}:fallback_proposal`;
  }

  // Step 4: Override route if direct writes are disabled, except for P0 capture
  // Canon: P0 (onboarding_dump) is always direct insert of raw memory
  if (route === 'direct' && !flags.direct_substrate_writes && cd.entry_point !== 'onboarding_dump') {
    route = 'proposal';
    reason += ':forced_proposal_no_direct_writes';
  }

  // Step 5: Determine validator requirements
  const requireValidator = determineValidatorRequirement(flags, route, cd, riskHints);
  const validatorMode = flags.validator_required ? 'strict' : 'lenient';

  // Step 6: Compute effective blast radius
  const effectiveBlastRadius = computeEffectiveBlastRadius(cd, flags, riskHints);

  return {
    route,
    require_validator: requireValidator,
    validator_mode: validatorMode,
    effective_blast_radius: effectiveBlastRadius,
    reason
  };
}

/**
 * Risk-based routing for hybrid entry-point policies.
 */
function assessHybridRouting(
  cd: ChangeDescriptor,
  riskHints?: RiskHints
): { route: 'proposal' | 'direct'; reason: string } {
  const operationRisk = computeOperationRisk(cd.ops);
  
  // High-risk operations always go through proposals
  if (operationRisk.scope_impact === 'high') {
    return { route: 'proposal', reason: 'high_scope_impact' };
  }
  
  // Multiple operations increase complexity
  if (operationRisk.operation_count > 3) {
    return { route: 'proposal', reason: 'high_operation_count' };
  }
  
  // Use risk hints if available
  if (riskHints) {
    // Low confidence suggests need for review
    if (riskHints.confidence && riskHints.confidence < 0.6) {
      return { route: 'proposal', reason: 'low_confidence' };
    }
    
    // High conflict count suggests review needed
    if (riskHints.conflicts && riskHints.conflicts > 2) {
      return { route: 'proposal', reason: 'high_conflicts' };
    }
    
    // High complexity score suggests review
    if (riskHints.complexity_score && riskHints.complexity_score > 0.8) {
      return { route: 'proposal', reason: 'high_complexity' };
    }
  }
  
  // Global blast radius always requires review
  if (cd.blast_radius === 'Global') {
    return { route: 'proposal', reason: 'global_blast_radius' };
  }
  
  // Low risk changes can go direct
  return { route: 'direct', reason: 'low_risk_assessment' };
}

/**
 * Determine if validator is required for this change.
 */
function determineValidatorRequirement(
  flags: WorkspaceFlags,
  route: 'proposal' | 'direct',
  cd: ChangeDescriptor,
  riskHints?: RiskHints
): boolean {
  // If validator is globally required, it's always required
  if (flags.validator_required) {
    return true;
  }
  
  // For proposals, validator is recommended but not required unless strict mode
  if (route === 'proposal') {
    // High-risk proposals should get validation even if not required
    const operationRisk = computeOperationRisk(cd.ops);
    if (operationRisk.scope_impact === 'high') {
      return true;
    }
    
    // Global blast radius should get validation
    if (cd.blast_radius === 'Global') {
      return true;
    }
  }
  
  // For direct commits, no validation needed unless explicitly required
  return false;
}

/**
 * Compute effective blast radius considering all factors.
 */
function computeEffectiveBlastRadius(
  cd: ChangeDescriptor,
  flags: WorkspaceFlags,
  riskHints?: RiskHints
): 'Local' | 'Scoped' | 'Global' {
  // Explicit blast radius takes precedence
  if (cd.blast_radius) {
    return cd.blast_radius;
  }
  
  // Assess based on operation types
  const operationRisk = computeOperationRisk(cd.ops);
  
  if (operationRisk.scope_impact === 'high') {
    return 'Global';
  } else if (operationRisk.scope_impact === 'medium') {
    return 'Scoped';
  }
  
  // Default to workspace default
  return flags.default_blast_radius;
}

/**
 * Policy evaluation for specific scenarios (helper functions)
 */

export function shouldRequireApproval(
  flags: WorkspaceFlags,
  cd: ChangeDescriptor,
  riskHints?: RiskHints
): boolean {
  const decision = decide(flags, cd, riskHints);
  return decision.route === 'proposal';
}

export function canBypassGovernance(
  flags: WorkspaceFlags,
  entryPoint: EntryPoint
): boolean {
  // Governance can be bypassed if:
  // 1. Governance is disabled globally, OR
  // 2. Entry point policy is 'direct' and direct writes are allowed
  
  if (!flags.governance_enabled) {
    return true;
  }
  
  const policy = flags.ep[entryPoint];
  return policy === 'direct' && flags.direct_substrate_writes;
}

export function getValidatorRequirements(decision: Decision): {
  required: boolean;
  mode: 'strict' | 'lenient';
  timeout_ms: number;
} {
  return {
    required: decision.require_validator,
    mode: decision.validator_mode,
    timeout_ms: decision.validator_mode === 'strict' ? 10000 : 5000
  };
}

/**
 * Debugging and telemetry helpers
 */

export function explainDecision(
  flags: WorkspaceFlags,
  cd: ChangeDescriptor,
  decision: Decision,
  riskHints?: RiskHints
): string {
  const parts = [
    `Entry Point: ${cd.entry_point}`,
    `Policy: ${flags.ep[cd.entry_point]}`,
    `Route: ${decision.route}`,
    `Validator: ${decision.require_validator ? decision.validator_mode : 'none'}`,
    `Blast: ${decision.effective_blast_radius}`,
    `Reason: ${decision.reason}`
  ];
  
  if (riskHints) {
    parts.push(`Risk: conf=${riskHints.confidence || 'unknown'} conflicts=${riskHints.conflicts || 0}`);
  }
  
  return parts.join(' | ');
}

export function getDecisionMetrics(decision: Decision): Record<string, any> {
  return {
    route: decision.route,
    validator_required: decision.require_validator,
    validator_mode: decision.validator_mode,
    blast_radius: decision.effective_blast_radius,
    reason: decision.reason,
    timestamp: new Date().toISOString()
  };
}

/**
 * UNIVERSAL WORK ORCHESTRATION - Canon v2.2
 * 
 * New work-type based governance policy system.
 * Replaces entry-point based routing with universal work type policies.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getWorkspaceFlags } from './flagsServer';

export interface WorkTypePolicy {
  mode: 'auto' | 'proposal' | 'confidence';
  confidence_threshold: number;
  require_validation: boolean;
}

export const policyDecider = {
  /**
   * Get governance policy for a specific work type in a workspace.
   */
  async getWorkTypePolicy(
    supabase: SupabaseClient,
    workspace_id: string,
    work_type: string
  ): Promise<WorkTypePolicy> {
    // Canon: governance is workspace-scoped; confidence routing is allowed only if workspace policy says so.
    const flags = await getWorkspaceFlags(supabase, workspace_id);

    // Defaults: safe proposal unless policy explicitly allows otherwise.
    const safe: WorkTypePolicy = { mode: 'proposal', confidence_threshold: 0.8, require_validation: !!flags.validator_required };

    // Map entry-point policy to universal work mode
    const toMode = (policy: 'proposal' | 'direct' | 'hybrid' | undefined): WorkTypePolicy['mode'] => {
      switch (policy) {
        case 'direct':
          return 'auto';
        case 'hybrid':
          return 'confidence';
        case 'proposal':
        default:
          return 'proposal';
      }
    };

    switch (work_type) {
      case 'P0_CAPTURE':
        // P0 is capture-only; map entry policy to work mode (direct => auto)
        return { mode: toMode(flags.ep.onboarding_dump), confidence_threshold: 1.0, require_validation: false };

      case 'P1_SUBSTRATE':
        // Substrate evolution flows through proposals; use manual_edit policy as closest analogue for human/agent intents.
        return { mode: toMode(flags.ep.manual_edit), confidence_threshold: 0.8, require_validation: !!flags.validator_required };

      case 'P2_GRAPH':
        // Graph actions governed by ep_graph_action policy.
        return { mode: toMode(flags.ep.graph_action), confidence_threshold: 0.7, require_validation: false };

      case 'P3_REFLECTION':
      case 'P4_COMPOSE':
        // Artifacts are not substrate; do not force confidence routing unless a future workspace flag allows it.
        return safe;

      case 'PROPOSAL_REVIEW':
      case 'TIMELINE_RESTORE':
        return { mode: 'proposal', confidence_threshold: 1.0, require_validation: true };

      default:
        return safe;
    }
  }
};
