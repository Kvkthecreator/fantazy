/**
 * Document Impact Detection System
 * 
 * Analyzes substrate changes to detect document impacts.
 * Maintains strict substrate→artifact separation per Canon v2.0.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface DocumentImpact {
  id: string;
  document_id: string;
  document_title: string;
  substrate_commit_id: string; // Links to the substrate change that caused this
  impact_type: DocumentImpactType;
  affected_references: SubstrateReference[];
  proposed_action: ProposedDocumentAction;
  confidence_score: number; // 0.0-1.0 for smart defaults
  impact_summary: string;
  created_at: string;
  status: DocumentImpactStatus;
}

export type DocumentImpactType = 
  | 'content_drift'      // Referenced substrate content changed
  | 'new_references'     // New substrates available for inclusion
  | 'reference_removed'  // Referenced substrate was deleted
  | 'structural_change'; // Major substrate reorganization

export type DocumentImpactStatus = 
  | 'pending'           // Awaiting user decision
  | 'auto_applied'      // Automatically updated (high confidence)
  | 'user_approved'     // User chose to update
  | 'user_deferred'     // User chose to handle later
  | 'user_skipped'      // User chose to skip permanently
  | 'resolved';         // Action completed

export interface SubstrateReference {
  id: string;
  type: 'dump' | 'block' | 'context_item' | 'timeline_event';
  title: string;
  current_content?: string;
  previous_content?: string; // For change detection
  relationship_to_document: 'primary' | 'supporting' | 'example' | 'reference';
}

export interface ProposedDocumentAction {
  action_type: 'recompose' | 'add_references' | 'update_references' | 'version_snapshot';
  description: string;
  estimated_impact: 'minor' | 'moderate' | 'major';
  substrate_changes: Array<{
    reference_id: string;
    change_type: 'content_update' | 'new_addition' | 'removal';
    preview_text?: string;
  }>;
}

/**
 * Detects document impacts from substrate timeline events.
 * Called after substrate.committed events.
 */
export async function detectDocumentImpacts(
  supabase: SupabaseClient,
  substrateCommitId: string,
  workspaceId: string
): Promise<DocumentImpact[]> {
  try {
    // Step 1: Get the substrate changes from the commit
    const { data: commitData, error: commitError } = await supabase
      .from('proposal_executions')
      .select('operations_summary, substrate_ids')
      .eq('proposal_id', substrateCommitId)
      .single();

    if (commitError) {
      console.error('Failed to get substrate commit data:', commitError);
      return [];
    }

    const changedSubstrateIds = commitData.substrate_ids || [];
    if (changedSubstrateIds.length === 0) {
      return [];
    }

    // Step 2: Find documents that reference these substrates
    const { data: affectedDocs, error: docsError } = await supabase
      .from('substrate_references')
      .select(`
        document_id,
        substrate_id,
        substrate_type,
        role,
        documents!inner(id, title, workspace_id)
      `)
      .in('substrate_id', changedSubstrateIds)
      .eq('documents.workspace_id', workspaceId);

    if (docsError) {
      console.error('Failed to find affected documents:', docsError);
      return [];
    }

    // Step 3: Group by document and analyze impact
    const documentGroups = new Map<string, any[]>();
    affectedDocs?.forEach(ref => {
      const docId = ref.document_id;
      if (!documentGroups.has(docId)) {
        documentGroups.set(docId, []);
      }
      documentGroups.get(docId)!.push(ref);
    });

    // Step 4: Create impact analysis for each document
    const impacts: DocumentImpact[] = [];
    
    for (const [docId, references] of documentGroups) {
      const document = references[0].documents;
      const impact = await analyzeDocumentImpact(
        supabase,
        substrateCommitId,
        document,
        references,
        commitData.operations_summary
      );
      
      if (impact) {
        impacts.push(impact);
      }
    }

    return impacts;

  } catch (error) {
    console.error('Document impact detection failed:', error);
    return [];
  }
}

/**
 * Analyzes impact for a single document
 */
async function analyzeDocumentImpact(
  supabase: SupabaseClient,
  substrateCommitId: string,
  document: any,
  references: any[],
  operationsSummary: any
): Promise<DocumentImpact | null> {
  try {
    // Determine impact type based on operation types
    const impactType = determineImpactType(operationsSummary, references);
    
    // Calculate confidence score for smart defaults
    const confidenceScore = calculateConfidenceScore(operationsSummary, references);
    
    // Generate proposed action
    const proposedAction = generateProposedAction(impactType, references, operationsSummary);
    
    // Create impact summary
    const impactSummary = createImpactSummary(impactType, references.length, proposedAction);
    
    const impact: DocumentImpact = {
      id: crypto.randomUUID(),
      document_id: document.id,
      document_title: document.title,
      substrate_commit_id: substrateCommitId,
      impact_type: impactType,
      affected_references: references.map(ref => ({
        id: ref.substrate_id,
        type: ref.substrate_type,
        title: `${ref.substrate_type}:${ref.substrate_id.slice(0, 8)}`,
        relationship_to_document: ref.role
      })),
      proposed_action: proposedAction,
      confidence_score: confidenceScore,
      impact_summary: impactSummary,
      created_at: new Date().toISOString(),
      status: confidenceScore > 0.8 ? 'auto_applied' : 'pending'
    };

    return impact;

  } catch (error) {
    console.error('Failed to analyze document impact:', error);
    return null;
  }
}

/**
 * Determines the type of impact based on substrate operations
 */
function determineImpactType(
  operationsSummary: any,
  references: any[]
): DocumentImpactType {
  const operations = operationsSummary?.operations || [];
  
  // Check for deletions
  if (operations.some((op: any) => op.operation_type === 'Delete')) {
    return 'reference_removed';
  }
  
  // Check for content updates
  if (operations.some((op: any) => op.operation_type === 'ReviseBlock')) {
    return 'content_drift';
  }
  
  // Check for new additions
  if (operations.some((op: any) => 
    op.operation_type === 'CreateBlock' || 
    op.operation_type === 'CreateContextItem'
  )) {
    return 'new_references';
  }
  
  // Check for structural changes
  if (operations.some((op: any) => 
    op.operation_type === 'MergeContextItems' ||
    op.operation_type === 'PromoteScope'
  )) {
    return 'structural_change';
  }
  
  return 'content_drift'; // Default
}

/**
 * Calculates confidence score for smart defaults
 */
function calculateConfidenceScore(
  operationsSummary: any,
  references: any[]
): number {
  let confidence = 0.7; // Base confidence
  
  const operations = operationsSummary?.operations || [];
  
  // Lower confidence for complex operations
  if (operations.some((op: any) => 
    op.operation_type === 'MergeContextItems' ||
    op.operation_type === 'Delete'
  )) {
    confidence -= 0.3;
  }
  
  // Lower confidence for many affected references
  if (references.length > 5) {
    confidence -= 0.2;
  }
  
  // Higher confidence for simple content updates
  if (operations.length === 1 && operations[0].operation_type === 'ReviseBlock') {
    confidence += 0.2;
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Generates proposed action for document update
 */
function generateProposedAction(
  impactType: DocumentImpactType,
  references: any[],
  operationsSummary: any
): ProposedDocumentAction {
  switch (impactType) {
    case 'content_drift':
      return {
        action_type: 'recompose',
        description: `Recompose document with updated substrate content`,
        estimated_impact: references.length > 3 ? 'major' : 'moderate',
        substrate_changes: references.map(ref => ({
          reference_id: ref.substrate_id,
          change_type: 'content_update' as const,
          preview_text: 'Content updated - review changes'
        }))
      };
      
    case 'new_references':
      return {
        action_type: 'add_references',
        description: `Add ${references.length} new substrate references`,
        estimated_impact: 'minor',
        substrate_changes: references.map(ref => ({
          reference_id: ref.substrate_id,
          change_type: 'new_addition' as const,
          preview_text: 'New content available for inclusion'
        }))
      };
      
    case 'reference_removed':
      return {
        action_type: 'update_references',
        description: `Remove deleted substrate references`,
        estimated_impact: 'moderate',
        substrate_changes: references.map(ref => ({
          reference_id: ref.substrate_id,
          change_type: 'removal' as const,
          preview_text: 'Referenced content no longer available'
        }))
      };
      
    case 'structural_change':
      return {
        action_type: 'version_snapshot',
        description: `Create version snapshot before structural changes`,
        estimated_impact: 'major',
        substrate_changes: references.map(ref => ({
          reference_id: ref.substrate_id,
          change_type: 'content_update' as const,
          preview_text: 'Substrate structure changed significantly'
        }))
      };
      
    default:
      return {
        action_type: 'recompose',
        description: 'Review and update document',
        estimated_impact: 'moderate',
        substrate_changes: []
      };
  }
}

/**
 * Creates human-readable impact summary
 */
function createImpactSummary(
  impactType: DocumentImpactType,
  referenceCount: number,
  proposedAction: ProposedDocumentAction
): string {
  const actionMap = {
    'content_drift': 'content has changed',
    'new_references': 'new content is available',
    'reference_removed': 'referenced content was removed',
    'structural_change': 'substrate structure changed'
  };
  
  const baseMessage = actionMap[impactType] || 'substrate changed';
  
  return `${referenceCount} reference${referenceCount === 1 ? '' : 's'} affected - ${baseMessage}`;
}

/**
 * Gets pending document impacts for a workspace
 */
export async function getPendingDocumentImpacts(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<DocumentImpact[]> {
  try {
    const { data, error } = await supabase
      .from('document_impacts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'user_deferred'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get pending document impacts:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('Error fetching pending document impacts:', error);
    return [];
  }
}