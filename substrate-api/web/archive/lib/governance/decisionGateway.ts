/**
 * Decision Gateway: Single choke-point for all substrate mutations
 * 
 * Routes all changes through unified policy evaluation.
 * Ensures no ad-hoc bypasses of governance decisions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  createBlockCanonical,
  createContextItemCanonical,
  reviseBlockCanonical,
  updateContextItemCanonical,
} from './canonicalSubstrateOps';
import { getWorkspaceFlags } from './flagsServer';
import type { ChangeDescriptor } from './changeDescriptor';
import { validateChangeDescriptor, computeOperationRisk } from './changeDescriptor';
import { decide } from './policyDecider';
import type { Decision, RiskHints } from './policyDecider';
import { globalProposalBatcher } from './proposalBatcher';
import { globalAutoApprovalEngine } from './smartAutoApproval';
import type { AutoApprovalContext } from './smartAutoApproval';

export interface ChangeResult {
  committed?: boolean;
  proposal_id?: string;
  decision: Decision;
  validation_report?: any;
  execution_summary?: {
    operations_executed: number;
    execution_time_ms: number;
    timeline_events_emitted: number;
  };
}

/**
 * Main entry point: Route any change through unified governance policy.
 */
export async function routeChange(
  supabase: SupabaseClient,
  cd: ChangeDescriptor
): Promise<ChangeResult> {
  // Step 1: Validate change descriptor
  const validation = validateChangeDescriptor(cd);
  if (!validation.valid) {
    throw new Error(`Invalid ChangeDescriptor: ${validation.errors.join(', ')}`);
  }

  // Step 2: Get workspace governance flags
  const flags = await getWorkspaceFlags(supabase, cd.workspace_id);

  // Step 3: Priority 1 - Proposal Batching Check
  // Batching runs regardless of user mode to reduce proposal volume (governance optimization)
  // Both "proposal" and "hybrid" modes benefit from intelligent batching
  let batchResult = { batched: false, shouldProcess: true };
  if (flags.governance_enabled) {
    batchResult = await globalProposalBatcher.processBatchableChange(supabase, cd);
    if (batchResult.batched && !batchResult.shouldProcess) {
      // Operation batched, not processing immediately
      console.log(`Batched operation for later processing: ${(batchResult as any).batchId}`);
      return {
        committed: false,
        proposal_id: (batchResult as any).batchId || 'batch-pending',
        decision: {
          route: 'proposal' as any,
          effective_blast_radius: cd.blast_radius || 'Local',
          require_validator: false,
          validator_mode: 'lenient' as any,
          reason: 'Batched for later processing'
        }
      };
    }
    
    if (batchResult.batched && batchResult.shouldProcess) {
      console.log(`Processing batched operations now: ${(batchResult as any).batchId}`);
    }
  }

  // If batched and should process, create unified change descriptor from batch
  let processedCd = cd;
  if (batchResult.batched && batchResult.shouldProcess) {
    // Get the batch and create unified change descriptor
    const batchStats = globalProposalBatcher.getBatchStatistics();
    console.log(`Processing batch with ${batchStats.totalOperations} operations`);
  }

  // Step 4: Compute risk hints (call P1 Validator or heuristic)
  const riskHints = await computeRiskHints(supabase, processedCd);

  // Step 5: Make routing decision
  const decision = decide(flags, processedCd, riskHints);

  // Step 6: Priority 2 - Smart Auto-Approval Check
  // CRITICAL: Only run auto-approval if user enabled "hybrid" mode
  if (decision.route === 'proposal') {
    const entryPointPolicy = flags.ep[processedCd.entry_point as keyof typeof flags.ep] || 'proposal';
    const isHybridMode = entryPointPolicy === 'hybrid';
    
    if (isHybridMode) {
      console.log(`Smart auto-approval enabled for entry point: ${processedCd.entry_point}`);

      const autoApprovalContext: AutoApprovalContext = {
        workspace_id: processedCd.workspace_id,
        basket_id: processedCd.basket_id!,
        actor_id: processedCd.actor_id,
        recentFailures: await getRecentFailures(supabase, processedCd.workspace_id)
      };

      // Run validator for auto-approval evaluation
      let validatorReport;
      try {
        if (decision.require_validator) {
          validatorReport = await runValidator(processedCd, decision);
        }
      } catch (error) {
        console.warn('Validator failed for auto-approval check:', error);
      }

      const autoApprovalResult = await globalAutoApprovalEngine.evaluateAutoApproval(
        supabase,
        processedCd,
        autoApprovalContext,
        validatorReport
      );

      if (autoApprovalResult.approved) {
        // Auto-approve and execute directly
        console.log(`Auto-approving proposal: ${autoApprovalResult.reason}`);
        
        return await executeAutoApprovedChange(
          supabase,
          processedCd,
          decision,
          autoApprovalResult,
          validatorReport
        );
      } else {
        console.log(`Auto-approval declined: ${autoApprovalResult.reason}`);
      }
    } else {
      console.log(`Auto-approval disabled - user selected "Review everything" mode for ${processedCd.entry_point}`);
    }
  }

  // Step 7: Execute based on decision
  // Canon hardening: allow 'direct' only for P0 onboarding_dump with CreateDump ops
  if (decision.route === 'direct') {
    const isP0 = processedCd.entry_point === 'onboarding_dump';
    const onlyCreateDump = Array.isArray(processedCd.ops) && processedCd.ops.every(op => op.type === 'CreateDump');
    if (isP0 && onlyCreateDump) {
      return await executeDirectCommit(supabase, processedCd, decision);
    }
    // Fallback to proposal for any other case
    return await createGovernanceProposal(supabase, processedCd, decision, riskHints);
  }

  return await createGovernanceProposal(supabase, processedCd, decision, riskHints);
}

/**
 * Execute operations directly (legacy compatibility path).
 */
async function executeDirectCommit(
  supabase: SupabaseClient,
  cd: ChangeDescriptor,
  decision: Decision
): Promise<ChangeResult> {
  const startTime = Date.now();
  
  try {
    // Use same operation executor as proposal approval for consistency
    const results = await executeOpsTransactional(supabase, cd.ops, {
      actor_id: cd.actor_id,
      workspace_id: cd.workspace_id,
      basket_id: cd.basket_id,
      blast_radius: decision.effective_blast_radius
    });

    // Emit direct commit timeline events
    const timelineEvents = await emitDirectCommitEvents(supabase, cd, results);

    const executionTime = Date.now() - startTime;

    return {
      committed: true,
      decision,
      execution_summary: {
        operations_executed: cd.ops.length,
        execution_time_ms: executionTime,
        timeline_events_emitted: timelineEvents.length
      }
    };

  } catch (error) {
    // Log execution failure
    console.error('Direct commit execution failed:', error);
    
    // Emit failure event
    await emitCommitFailureEvent(supabase, cd, error);
    
    throw new Error(`Direct commit failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create governance proposal for human review.
 */
async function createGovernanceProposal(
  supabase: SupabaseClient,
  cd: ChangeDescriptor,
  decision: Decision,
  riskHints?: RiskHints
): Promise<ChangeResult> {
  try {
    // Step 1: Run validator if required
    let validatorReport;
    
    if (decision.require_validator) {
      try {
        validatorReport = await runValidator(cd, decision);
      } catch (validatorError) {
        // Validator failure blocks proposal creation in strict mode
        if (decision.validator_mode === 'strict') {
          throw new Error(`Validator required but failed: ${validatorError instanceof Error ? validatorError.message : String(validatorError)}`);
        } else {
          // Lenient mode: create warning in validator report
          validatorReport = {
            confidence: 0.5,
            dupes: [],
            ontology_hits: [],
            suggested_merges: [],
            warnings: [`Validator failed: ${validatorError instanceof Error ? validatorError.message : String(validatorError)}`],
            impact_summary: 'Validator unavailable - manual review recommended'
          };
        }
      }
    } else {
      // No validator required - create minimal report
      validatorReport = {
        confidence: riskHints?.confidence || 0.7,
        dupes: [],
        ontology_hits: [],
        suggested_merges: [],
        warnings: decision.validator_mode === 'lenient' ? ['Validator bypassed - lenient mode'] : [],
        impact_summary: `${cd.ops.length} operations pending review`
      };
    }

    // Step 2: Infer proposal kind from operations
    const proposalKind = inferProposalKind(cd.ops);

    // Step 3: Create proposal in database
    const { data: proposal, error: createError } = await supabase
      .from('proposals')
      .insert({
        workspace_id: cd.workspace_id,
        basket_id: cd.basket_id,
        proposal_kind: proposalKind,
        ops: cd.ops,
        origin: cd.entry_point === 'onboarding_dump' ? 'agent' : 'human',
        provenance: cd.provenance || [],
        basis_snapshot_id: cd.basis_snapshot_id,
        validator_report: validatorReport,
        status: 'PROPOSED',
        blast_radius: decision.effective_blast_radius,
        created_by: cd.actor_id
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create proposal: ${createError.message}`);
    }

    // Step 4: Emit proposal submitted event
    await emitProposalSubmittedEvent(supabase, proposal, cd);

    return {
      proposal_id: proposal.id,
      decision,
      validation_report: validatorReport
    };

  } catch (error) {
    console.error('Proposal creation failed:', error);
    throw new Error(`Proposal creation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Compute risk hints by calling P1 Validator or using heuristics.
 */
async function computeRiskHints(
  supabase: SupabaseClient,
  cd: ChangeDescriptor
): Promise<RiskHints> {
  try {
    // If validator agent is available, get proper risk assessment
    if (process.env.AGENT_API_URL) {
      const response = await fetch(`${process.env.AGENT_API_URL}/api/validator/assess-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations: cd.ops,
          workspace_id: cd.workspace_id,
          basket_id: cd.basket_id,
          entry_point: cd.entry_point
        }),
        signal: AbortSignal.timeout(5000) // 5s timeout
      });

      if (response.ok) {
        const riskData = await response.json();
        return {
          confidence: riskData.confidence,
          conflicts: riskData.conflicts?.length || 0,
          duplicate_count: riskData.dupes?.length || 0,
          complexity_score: riskData.complexity_score
        };
      }
    }

    // Fallback: Heuristic risk assessment
    return computeHeuristicRisk(cd);

  } catch (error) {
    console.warn('Risk assessment failed, using heuristics:', error);
    return computeHeuristicRisk(cd);
  }
}

/**
 * Heuristic risk assessment when validator is unavailable.
 */
function computeHeuristicRisk(cd: ChangeDescriptor): RiskHints {
  const operationRisk = computeOperationRisk(cd.ops);
  
  // Base confidence on operation complexity
  let confidence = 0.8; // Default high confidence
  
  if (operationRisk.scope_impact === 'high') {
    confidence = 0.6; // Lower confidence for high-impact ops
  } else if (operationRisk.operation_count > 5) {
    confidence = 0.7; // Lower confidence for many operations
  }
  
  // Estimate conflicts based on operation types
  const potentialConflicts = cd.ops.filter(op => 
    op.type === 'MergeContextItems' || 
    op.type === 'ReviseBlock' ||
    op.type === 'PromoteScope'
  ).length;
  
  // Simple complexity score based on operation diversity
  const uniqueTypes = new Set(cd.ops.map(op => op.type));
  const complexityScore = uniqueTypes.size / 10; // Normalize to 0-1
  
  return {
    confidence,
    conflicts: potentialConflicts,
    duplicate_count: 0, // Can't detect without validator
    complexity_score: complexityScore
  };
}

/**
 * Execute operations transactionally (shared with proposal approval).
 */
async function executeOpsTransactional(
  supabase: SupabaseClient,
  ops: any[],
  context: {
    actor_id: string;
    workspace_id: string;
    basket_id?: string;
    blast_radius: 'Local' | 'Scoped' | 'Global';
  }
): Promise<any[]> {
  const results = [];
  
  // Execute each operation with error rollback
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    
    try {
      const result = await executeOperation(supabase, op, context.basket_id!, context.workspace_id);
      results.push({
        operation_index: i,
        operation_type: op.type,
        success: true,
        result: result
      });
    } catch (error) {
      // On failure, rollback all previous operations would go here
      // For now, fail fast and let caller handle
      throw new Error(`Operation ${i} (${op.type}) failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return results;
}

/**
 * Re-use existing operation executor from approval route.
 */
async function executeOperation(supabase: any, operation: any, basketId: string, workspaceId: string) {
  // Import and use the same execution logic from approve route
  // This ensures operational parity between direct commits and approved proposals
  
  switch (operation.type) {
    case 'CreateDump':
      return await createDump(supabase, operation, basketId, workspaceId);
    case 'CreateBlock':
      return await createBlockCanonical(supabase, operation.data ?? operation, basketId, workspaceId);
    case 'CreateContextItem':
      return await createContextItemCanonical(supabase, operation.data ?? operation, basketId, workspaceId);
    case 'ReviseBlock':
      return await reviseBlockCanonical(supabase, operation.data ?? operation, basketId, workspaceId);
    case 'MergeContextItems':
      return await mergeContextItems(supabase, operation, basketId, workspaceId);
    case 'AttachContextItem':
      return await attachContextItem(supabase, operation, basketId, workspaceId);
    case 'PromoteScope':
      return await promoteScope(supabase, operation, basketId, workspaceId);
    // REMOVED: Document operations are artifacts, not substrates
    // DocumentCompose and DocumentAddReference moved to P4 presentation pipeline
    case 'UpdateContextItem':
    case 'EditContextItem':
      return await updateContextItemCanonical(supabase, operation.data ?? operation, basketId, workspaceId);
    case 'Delete':
      return await deleteSubstrate(supabase, operation, basketId, workspaceId);
    case 'ArchiveBlock':
      return await archiveBlock(supabase, operation, basketId, workspaceId);
    case 'RedactDump':
      return await redactDump(supabase, operation, basketId, workspaceId);
    default:
      throw new Error(`Unsupported operation type: ${operation.type}`);
  }
}

// Operation implementations (should be extracted to shared module)

// P0 Capture Operations
async function createDump(supabase: any, op: any, basketId: string, workspaceId: string) {
  // Use canonical dump ingestion RPC (same as legacy but governance-routed)
  const { data, error } = await supabase.rpc("fn_ingest_dumps", {
    p_workspace_id: workspaceId,
    p_basket_id: basketId,
    p_dumps: [
      {
        dump_request_id: op.data.dump_request_id,
        text_dump: op.data.text_dump || null,
        file_url: op.data.file_url || null,
        source_meta: op.data.source_meta || null,
        ingest_trace_id: op.data.source_meta?.ingest_trace_id || null,
      },
    ],
  });

  if (error) {
    throw new Error(`Failed to create dump: ${error.message}`);
  }

  const dump_id = Array.isArray(data) && data[0]?.dump_id;
  if (!dump_id) {
    throw new Error("Dump ingestion returned no dump_id");
  }

  return { created_id: dump_id, type: 'dump' };
}

async function mergeContextItems(supabase: any, op: any, basketId: string, workspaceId: string) {
  const payload = op.data ?? op;
  // Mark source items as MERGED
  const { error: mergeError } = await supabase
    .from('context_items')
    .update({ state: 'MERGED' })
    .in('id', payload.from_ids)
    .eq('workspace_id', workspaceId);

  if (mergeError) throw new Error(`Failed to merge context items: ${mergeError.message}`);

  return { 
    merged_ids: payload.from_ids,
    canonical_id: payload.canonical_id,
    type: 'merge'
  };
}

async function attachContextItem(supabase: any, op: any, basketId: string, workspaceId: string) {
  const payload = op.data ?? op;
  const { data, error } = await supabase.rpc('fn_relationship_upsert', {
    p_basket_id: basketId,
    p_from_type: 'context_item',
    p_from_id: payload.context_item_id,
    p_to_type: payload.target_type,
    p_to_id: payload.target_id,
    p_relationship_type: payload.relationship_type || 'relates_to',
  });

  if (error) throw new Error(`Failed to attach context item: ${error.message}`);

  const relId = Array.isArray(data) ? data[0] : data;
  return { attached_id: relId, type: 'attachment' };
}

async function promoteScope(supabase: any, op: any, basketId: string, workspaceId: string) {
  const payload = op.data ?? op;
  const { data, error } = await supabase
    .from('blocks')
    .update({ scope: payload.to_scope })
    .eq('id', payload.block_id)
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Failed to promote scope: ${error.message}`);
  return { promoted_id: data.id, new_scope: payload.to_scope, type: 'promotion' };
}

// REMOVED: Document operations moved to P4 presentation pipeline
// composeDocument() and addDocumentReference() are artifact operations
// These belong in /lib/presentation/ or /app/api/presentation/, NOT governance

async function deleteSubstrate(supabase: any, op: any, basketId: string, workspaceId: string) {
  const payload = op.data ?? op;

  if (payload.target_type === 'block') {
    const { error } = await supabase.rpc('fn_archive_block', {
      p_basket_id: basketId,
      p_block_id: payload.target_id,
      p_actor_id: payload.actor_id || null,
    });
    if (error) throw new Error(`Failed to archive block: ${error.message}`);
    return { deleted_id: payload.target_id, type: 'block_delete' };
  }

  if (payload.target_type === 'context_item') {
    const { error } = await supabase.rpc('fn_archive_context_item', {
      p_basket_id: basketId,
      p_context_item_id: payload.target_id,
    });
    if (error) throw new Error(`Failed to archive context item: ${error.message}`);
    return { deleted_id: payload.target_id, type: 'context_item_delete' };
  }

  throw new Error(`Unsupported delete target type: ${payload.target_type}`);
}

// Phase 1 Deletion Ops
async function archiveBlock(supabase: any, op: any, basketId: string, workspaceId: string) {
  const payload = op.data ?? op;
  const { data, error } = await supabase.rpc('fn_archive_block', {
    p_basket_id: basketId,
    p_block_id: payload.block_id,
    p_actor_id: payload.actor_id || null,
  });
  if (error) throw new Error(`ArchiveBlock failed: ${error.message}`);
  return { tombstone_id: data, type: 'archive_block' };
}

async function redactDump(supabase: any, op: any, basketId: string, workspaceId: string) {
  const payload = op.data ?? op;
  const { data, error } = await supabase.rpc('fn_redact_dump', {
    p_basket_id: basketId,
    p_dump_id: payload.dump_id,
    p_scope: payload.scope || 'full',
    p_reason: payload.reason || null,
    p_actor_id: payload.actor_id || null,
  });
  if (error) throw new Error(`RedactDump failed: ${error.message}`);
  return { tombstone_id: data, type: 'redact_dump' };
}

// (Removed duplicate createGovernanceProposal definition; single implementation remains above)

/**
 * Run P1 Validator Agent for proposal validation.
 */
async function runValidator(
  cd: ChangeDescriptor,
  decision: Decision
): Promise<any> {
  if (!process.env.AGENT_API_URL) {
    throw new Error('Validator required but AGENT_API_URL not configured');
  }

  const timeout = decision.validator_mode === 'strict' ? 10000 : 5000;

  const response = await fetch(`${process.env.AGENT_API_URL}/api/validator/validate-proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposal_kind: inferProposalKind(cd.ops),
      operations: cd.ops,
      basket_id: cd.basket_id,
      workspace_id: cd.workspace_id,
      entry_point: cd.entry_point,
      blast_radius: cd.blast_radius
    }),
    signal: AbortSignal.timeout(timeout)
  });

  if (!response.ok) {
    throw new Error(`Validator API error: ${response.status} ${response.statusText}`);
  }

  const validationResult = await response.json();
  
  // Validate required fields
  if (!validationResult.confidence || !validationResult.impact_summary) {
    throw new Error('Invalid validator response - missing required fields');
  }

  return validationResult;
}

/**
 * Infer proposal kind from operation types.
 */
function inferProposalKind(ops: any[]): string {
  if (ops.length === 0) return 'Edit';
  
  const types = new Set(ops.map(op => op.type));
  
  // Pattern matching for proposal kinds
  if (types.has('CreateDump')) return 'Capture';
  if (types.has('CreateBlock') && ops.length > 1) return 'Extraction';
  if (types.has('MergeContextItems')) return 'Merge';
  if (types.has('AttachContextItem')) return 'Attachment';
  if (types.has('DetachOp')) return 'Detach';
  if (types.has('ReviseBlock')) return 'Revision';
  if (types.has('RenameOp')) return 'Rename';
  if (types.has('ContextAliasOp')) return 'ContextAlias';
  if (types.has('PromoteScope')) return 'ScopePromotion';
  if (types.has('DocumentCompose')) return 'Composition';
  if (types.has('DocumentAddReference')) return 'DocumentEdit';
  
  // Default to Edit for simple operations
  return 'Edit';
}

/**
 * Timeline event emission helpers.
 */
async function emitProposalSubmittedEvent(
  supabase: SupabaseClient,
  proposal: any,
  cd: ChangeDescriptor
): Promise<void> {
  const { error } = await supabase.rpc('emit_timeline_event', {
    p_basket_id: cd.basket_id,
    p_event_type: 'proposal.submitted',
    p_event_data: {
      proposal_id: proposal.id,
      proposal_kind: proposal.proposal_kind,
      origin: proposal.origin,
      entry_point: cd.entry_point,
      operations_count: cd.ops.length,
      blast_radius: proposal.blast_radius
    },
    p_workspace_id: cd.workspace_id,
    p_actor_id: cd.actor_id
  });

  if (error) {
    console.error('Failed to emit proposal.submitted event:', error);
  }
}

async function emitDirectCommitEvents(
  supabase: SupabaseClient,
  cd: ChangeDescriptor,
  results: any[]
): Promise<any[]> {
  const events = [];

  // Emit substrate.committed event
  const { error: commitError } = await supabase.rpc('emit_timeline_event', {
    p_basket_id: cd.basket_id,
    p_event_type: 'substrate.committed.direct',
    p_event_data: {
      entry_point: cd.entry_point,
      operations_executed: results.length,
      blast_radius: cd.blast_radius,
      execution_results: results
    },
    p_workspace_id: cd.workspace_id,
    p_actor_id: cd.actor_id
  });

  if (!commitError) {
    events.push('substrate.committed.direct');
  }

  return events;
}

async function emitCommitFailureEvent(
  supabase: SupabaseClient,
  cd: ChangeDescriptor,
  error: any
): Promise<void> {
  await supabase.rpc('emit_timeline_event', {
    p_basket_id: cd.basket_id,
    p_event_type: 'commit.failed',
    p_event_data: {
      entry_point: cd.entry_point,
      error_message: error instanceof Error ? error.message : String(error),
      operations_attempted: cd.ops.length
    },
    p_workspace_id: cd.workspace_id,
    p_actor_id: cd.actor_id
  });
}

/**
 * Get recent failure count for auto-approval context
 */
async function getRecentFailures(
  supabase: SupabaseClient,
  workspace_id: string
): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const { data, error } = await supabase
      .from('proposals')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .eq('status', 'REJECTED')
      .gte('created_at', cutoff.toISOString());

    if (error) {
      console.error('Failed to get recent failures:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Error getting recent failures:', error);
    return 0;
  }
}

/**
 * Execute auto-approved change with tracking
 */
async function executeAutoApprovedChange(
  supabase: SupabaseClient,
  cd: ChangeDescriptor,
  decision: Decision,
  autoApprovalResult: any,
  validatorReport?: any
): Promise<ChangeResult> {
  const startTime = Date.now();
  
  try {
    // Create proposal record for tracking
    const { data: proposal, error: createError } = await supabase
      .from('proposals')
      .insert({
        workspace_id: cd.workspace_id,
        basket_id: cd.basket_id,
        proposal_kind: inferProposalKind(cd.ops),
        ops: cd.ops,
        origin: cd.entry_point === 'onboarding_dump' ? 'agent' : 'human',
        provenance: cd.provenance || [],
        basis_snapshot_id: cd.basis_snapshot_id,
        validator_report: validatorReport || { confidence: autoApprovalResult.confidence },
        status: 'APPROVED', // Auto-approved
        blast_radius: decision.effective_blast_radius,
        created_by: cd.actor_id,
        reviewed_at: new Date().toISOString(),
        review_notes: `Auto-approved: ${autoApprovalResult.reason}. Rule: ${autoApprovalResult.rule?.name || 'unknown'}`,
        is_executed: false
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create auto-approved proposal: ${createError.message}`);
    }

    // Execute operations
    const results = await executeOpsTransactional(supabase, cd.ops, {
      actor_id: cd.actor_id,
      workspace_id: cd.workspace_id,
      basket_id: cd.basket_id,
      blast_radius: decision.effective_blast_radius
    });

    // Mark proposal as executed
    await supabase
      .from('proposals')
      .update({ 
        is_executed: true, 
        executed_at: new Date().toISOString() 
      })
      .eq('id', proposal.id);

    // Emit auto-approval events
    await emitAutoApprovalEvents(supabase, cd, proposal, autoApprovalResult, results);

    const executionTime = Date.now() - startTime;

    return {
      committed: true,
      proposal_id: proposal.id,
      decision: {
        ...decision,
        auto_approved: true,
        auto_approval_rule: autoApprovalResult.rule?.name
      } as any,
      execution_summary: {
        operations_executed: cd.ops.length,
        execution_time_ms: executionTime,
        timeline_events_emitted: 2 // proposal.submitted + substrate.committed.auto_approved
      }
    };

  } catch (error) {
    console.error('Auto-approved execution failed:', error);
    throw new Error(`Auto-approved execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Emit timeline events for auto-approval
 */
async function emitAutoApprovalEvents(
  supabase: SupabaseClient,
  cd: ChangeDescriptor,
  proposal: any,
  autoApprovalResult: any,
  results: any[]
): Promise<void> {
  // Emit proposal submitted event
  await supabase.rpc('emit_timeline_event', {
    p_basket_id: cd.basket_id,
    p_event_type: 'proposal.auto_approved',
    p_event_data: {
      proposal_id: proposal.id,
      proposal_kind: proposal.proposal_kind,
      auto_approval_rule: autoApprovalResult.rule?.name,
      auto_approval_reason: autoApprovalResult.reason,
      confidence: autoApprovalResult.confidence,
      operations_count: cd.ops.length,
      blast_radius: proposal.blast_radius
    },
    p_workspace_id: cd.workspace_id,
    p_actor_id: cd.actor_id
  });

  // Emit substrate committed event
  await supabase.rpc('emit_timeline_event', {
    p_basket_id: cd.basket_id,
    p_event_type: 'substrate.committed.auto_approved',
    p_event_data: {
      proposal_id: proposal.id,
      entry_point: cd.entry_point,
      operations_executed: results.length,
      blast_radius: cd.blast_radius,
      execution_results: results,
      auto_approval_rule: autoApprovalResult.rule?.name
    },
    p_workspace_id: cd.workspace_id,
    p_actor_id: cd.actor_id
  });
}
