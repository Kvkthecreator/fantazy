/**
 * Substrate Commit Handler
 * 
 * Handles the bridge between substrate governance and artifact impact management.
 * Triggered after substrate.committed events to detect and create document impacts.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { detectDocumentImpacts } from './documentImpactDetector';

export interface SubstrateCommitEvent {
  proposal_id: string;
  commit_id: string;
  operations: Array<{
    operation_index: number;
    operation_type: string;
    success: boolean;
    result_data?: any;
    substrate_id?: string;
  }>;
  workspace_id: string;
  basket_id?: string;
  actor_id: string;
}

/**
 * Process substrate commit and create document impacts
 */
export async function handleSubstrateCommit(
  supabase: SupabaseClient,
  commitEvent: SubstrateCommitEvent
): Promise<{
  impacts_created: number;
  batch_id?: string;
  auto_applied: number;
}> {
  try {
    console.log(`Processing substrate commit ${commitEvent.commit_id} for document impacts...`);

    // Step 1: Detect document impacts from this commit
    const impacts = await detectDocumentImpacts(
      supabase,
      commitEvent.proposal_id,
      commitEvent.workspace_id
    );

    if (impacts.length === 0) {
      console.log('No document impacts detected from substrate commit');
      return { impacts_created: 0, auto_applied: 0 };
    }

    // Step 2: Create impact batch for grouping
    const { data: batch, error: batchError } = await supabase
      .rpc('create_document_impact_batch', {
        p_workspace_id: commitEvent.workspace_id,
        p_substrate_commit_id: commitEvent.proposal_id,
        p_batch_name: `Proposal ${commitEvent.proposal_id.slice(0, 8)} impacts`,
        p_created_by: commitEvent.actor_id
      });

    if (batchError) {
      console.error('Failed to create impact batch:', batchError);
      // Continue without batch grouping
    }

    const batchId = batch || null;
    let autoAppliedCount = 0;

    // Step 3: Create impact records in database
    for (const impact of impacts) {
      try {
        const { error: insertError } = await supabase
          .from('document_impacts')
          .insert({
            id: impact.id,
            substrate_commit_id: commitEvent.proposal_id,
            document_id: impact.document_id,
            workspace_id: commitEvent.workspace_id,
            impact_type: impact.impact_type,
            affected_references: impact.affected_references,
            confidence_score: impact.confidence_score,
            impact_summary: impact.impact_summary,
            proposed_action_type: impact.proposed_action.action_type,
            proposed_action_details: impact.proposed_action,
            status: impact.status,
            batch_id: batchId,
            created_at: impact.created_at
          });

        if (insertError) {
          console.error(`Failed to insert impact ${impact.id}:`, insertError);
          continue;
        }

        // Step 4: Auto-apply high confidence impacts
        if (impact.status === 'auto_applied') {
          try {
            await executeAutoApply(supabase, impact, commitEvent.actor_id);
            autoAppliedCount++;
          } catch (autoApplyError) {
            console.error(`Auto-apply failed for impact ${impact.id}:`, autoApplyError);
            
            // Revert to pending status
            await supabase
              .from('document_impacts')
              .update({ 
                status: 'pending',
                user_notes: `Auto-apply failed: ${autoApplyError instanceof Error ? autoApplyError.message : String(autoApplyError)}`
              })
              .eq('id', impact.id);
          }
        }

      } catch (error) {
        console.error(`Error processing impact for document ${impact.document_id}:`, error);
      }
    }

    // Step 5: Update batch statistics
    if (batchId) {
      await supabase.rpc('update_batch_stats', { p_batch_id: batchId });
    }

    // Step 6: Emit notification events for pending impacts
    const pendingImpacts = impacts.filter(i => i.status === 'pending');
    if (pendingImpacts.length > 0) {
      await supabase.rpc('emit_timeline_event', {
        p_basket_id: commitEvent.basket_id || null,
        p_event_type: 'document_impacts.created',
        p_event_data: {
          substrate_commit_id: commitEvent.proposal_id,
          batch_id: batchId,
          total_impacts: impacts.length,
          pending_impacts: pendingImpacts.length,
          auto_applied: autoAppliedCount,
          affected_documents: [...new Set(impacts.map(i => i.document_id))]
        },
        p_workspace_id: commitEvent.workspace_id,
        p_actor_id: commitEvent.actor_id
      });
    }

    console.log(`Substrate commit processed: ${impacts.length} impacts created, ${autoAppliedCount} auto-applied`);

    return {
      impacts_created: impacts.length,
      batch_id: batchId,
      auto_applied: autoAppliedCount
    };

  } catch (error) {
    console.error('Substrate commit handler error:', error);
    throw error;
  }
}

/**
 * Execute auto-apply for high confidence impacts
 */
async function executeAutoApply(
  supabase: SupabaseClient,
  impact: any,
  userId: string
): Promise<void> {
  switch (impact.proposed_action.action_type) {
    case 'recompose':
      await executeRecomposition(supabase, impact, userId);
      break;
    case 'add_references':
      await executeAddReferences(supabase, impact, userId);
      break;
    case 'update_references':
      await executeUpdateReferences(supabase, impact, userId);
      break;
    case 'version_snapshot':
      await executeVersionSnapshot(supabase, impact, userId);
      break;
    default:
      throw new Error(`Unknown action type: ${impact.proposed_action.action_type}`);
  }

  // Mark as resolved
  await supabase
    .from('document_impacts')
    .update({
      status: 'resolved',
      resolved_by: userId,
      resolved_at: new Date().toISOString()
    })
    .eq('id', impact.id);
}

// Document update execution functions (shared with API endpoints)
async function executeRecomposition(supabase: any, impact: any, userId: string): Promise<void> {
  // For now, we'll use a simple substrate reference update
  // In production, this would call the P4 composition pipeline
  console.log(`Recomposing document ${impact.document_id} after substrate changes`);
  
  // Placeholder: Mark document as needing recomposition
  const { error } = await supabase
    .from('documents')
    .update({
      needs_recomposition: true,
      last_substrate_change: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', impact.document_id);

  if (error) {
    throw new Error(`Failed to mark document for recomposition: ${error.message}`);
  }
}

async function executeAddReferences(supabase: any, impact: any, userId: string): Promise<void> {
  const references = impact.affected_references || [];
  
  for (const ref of references) {
    // Check if reference already exists
    const { data: existing } = await supabase
      .from('substrate_references')
      .select('id')
      .eq('document_id', impact.document_id)
      .eq('substrate_id', ref.id)
      .single();

    if (!existing) {
      const { error } = await supabase
        .from('substrate_references')
        .insert({
          document_id: impact.document_id,
          substrate_id: ref.id,
          substrate_type: ref.type,
          role: ref.relationship_to_document || 'reference',
          weight: 0.7, // Higher weight for auto-added references
          metadata: {
            auto_added: true,
            source_impact: impact.id,
            added_reason: 'Auto-added after substrate commit'
          },
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error(`Failed to add reference ${ref.id}:`, error);
      }
    }
  }
}

async function executeUpdateReferences(supabase: any, impact: any, userId: string): Promise<void> {
  const references = impact.affected_references || [];
  
  for (const ref of references) {
    const { error } = await supabase
      .from('substrate_references')
      .update({
        metadata: supabase.raw(`metadata || '{"updated_by_impact": "${impact.id}", "last_updated": "${new Date().toISOString()}"}'::jsonb`),
        updated_at: new Date().toISOString()
      })
      .eq('document_id', impact.document_id)
      .eq('substrate_id', ref.id);

    if (error) {
      console.error(`Failed to update reference ${ref.id}:`, error);
    }
  }
}

async function executeVersionSnapshot(supabase: any, impact: any, userId: string): Promise<void> {
  // Create version snapshot record
  const { error } = await supabase
    .from('document_versions')
    .insert({
      document_id: impact.document_id,
      version_type: 'substrate_change_snapshot',
      snapshot_reason: `Snapshot before substrate changes (impact: ${impact.id})`,
      metadata: {
        impact_id: impact.id,
        substrate_commit_id: impact.substrate_commit_id,
        snapshot_timestamp: new Date().toISOString()
      },
      created_by: userId,
      created_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Version snapshot creation failed: ${error.message}`);
  }

  // After snapshot, proceed with recomposition
  await executeRecomposition(supabase, impact, userId);
}

/**
 * Check if user should be notified about pending document impacts
 */
export async function shouldNotifyUser(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<{
  should_notify: boolean;
  pending_count: number;
  high_confidence_count: number;
}> {
  try {
    const { data: pendingImpacts, error } = await supabase
      .from('document_impacts')
      .select('confidence_score')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending');

    if (error) {
      console.error('Failed to check pending impacts:', error);
      return { should_notify: false, pending_count: 0, high_confidence_count: 0 };
    }

    const pendingCount = pendingImpacts?.length || 0;
    const highConfidenceCount = pendingImpacts?.filter(i => i.confidence_score > 0.8).length || 0;

    // Notify if there are any pending impacts
    return {
      should_notify: pendingCount > 0,
      pending_count: pendingCount,
      high_confidence_count: highConfidenceCount
    };

  } catch (error) {
    console.error('Error checking notification status:', error);
    return { should_notify: false, pending_count: 0, high_confidence_count: 0 };
  }
}