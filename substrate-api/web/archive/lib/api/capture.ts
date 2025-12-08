/**
 * Governance-Compliant Capture API
 * 
 * Replaces direct dump creation with Decision Gateway routing.
 * Respects Sacred Principles and workspace governance settings.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { routeChange } from '@/lib/governance/decisionGateway';
import type { ChangeDescriptor, CreateDumpOp } from '@/lib/governance/changeDescriptor';

export interface CaptureRequest {
  basket_id: string;
  text_dump?: string;
  file_url?: string;
  source_meta?: Record<string, any>;
}

export interface CaptureResult {
  success: boolean;
  route: 'direct' | 'proposal';
  dump_id?: string;
  proposal_id?: string;
  message: string;
  decision_reason?: string;
}

/**
 * Create dump through governance-compliant workflow.
 * Routes via Decision Gateway respecting workspace ep_onboarding_dump policy.
 */
export async function createGovernedDump(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  request: CaptureRequest
): Promise<CaptureResult> {
  
  // Validate required content
  if (!request.text_dump?.trim() && !request.file_url) {
    throw new Error('Either text_dump or file_url is required');
  }

  // Create ChangeDescriptor for dump creation
  const changeDescriptor: ChangeDescriptor = {
    entry_point: 'onboarding_dump',
    actor_id: userId,
    workspace_id: workspaceId,
    basket_id: request.basket_id,
    blast_radius: 'Local', // Dumps start as local scope
    ops: [{
      type: 'CreateDump',
      data: {
        dump_request_id: crypto.randomUUID(),
        text_dump: request.text_dump,
        file_url: request.file_url,
        source_meta: request.source_meta
      }
    } as CreateDumpOp],
    provenance: [
      { type: 'user', id: userId },
      { type: 'dump', id: crypto.randomUUID() }
    ]
  };

  try {
    // Route through Decision Gateway (respects governance settings)
    const result = await routeChange(supabase, changeDescriptor);

    if (result.committed) {
      // Direct commit path
      return {
        success: true,
        route: 'direct',
        dump_id: result.execution_summary?.operations_executed ? 'created' : undefined,
        message: 'Dump saved directly to substrate',
        decision_reason: result.decision.reason
      };
    } else {
      // Proposal creation path
      return {
        success: true,
        route: 'proposal',
        proposal_id: result.proposal_id,
        message: 'Dump proposed for governance review',
        decision_reason: result.decision.reason
      };
    }

  } catch (error) {
    console.error('Governed dump creation failed:', error);
    throw new Error(`Capture workflow failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Legacy dump creation for backward compatibility.
 * Should be phased out in favor of createGovernedDump.
 */
export async function createDumpLegacy(
  supabase: SupabaseClient,
  request: CaptureRequest & { dump_request_id: string }
): Promise<{ dump_id: string }> {
  console.warn('Using legacy dump creation - should migrate to governance routing');

  const { data, error } = await supabase.rpc("fn_ingest_dumps", {
    p_workspace_id: request.basket_id, // Legacy uses basket_id as workspace
    p_basket_id: request.basket_id,
    p_dumps: [{
      dump_request_id: request.dump_request_id,
      text_dump: request.text_dump || null,
      file_url: request.file_url || null,
      source_meta: request.source_meta || null,
      ingest_trace_id: request.source_meta?.ingest_trace_id || null,
    }],
  });

  if (error) {
    throw new Error(`Legacy dump creation failed: ${error.message}`);
  }

  const dump_id = Array.isArray(data) && data[0]?.dump_id;
  if (!dump_id) {
    throw new Error("Legacy dump ingestion returned no dump_id");
  }

  return { dump_id };
}

/**
 * Helper to create dump ChangeDescriptor from raw request.
 */
export function createDumpChangeDescriptor(
  userId: string,
  workspaceId: string,
  basketId: string,
  dumpRequest: CaptureRequest
): ChangeDescriptor {
  return {
    entry_point: 'onboarding_dump',
    actor_id: userId,
    workspace_id: workspaceId,
    basket_id: basketId,
    blast_radius: 'Local',
    ops: [{
      type: 'CreateDump',
      data: {
        dump_request_id: crypto.randomUUID(),
        text_dump: dumpRequest.text_dump,
        file_url: dumpRequest.file_url,
        source_meta: dumpRequest.source_meta
      }
    }],
    provenance: [
      { type: 'user', id: userId }
    ]
  };
}