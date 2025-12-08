/**
 * Document Impact Preview for Governance Modal
 * 
 * Provides read-only preview of potential document impacts during substrate review.
 * Maintains canon purity - shows impacts but doesn't allow decisions.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface DocumentImpactPreview {
  document_id: string;
  document_title: string;
  impact_type: 'content_drift' | 'new_references' | 'reference_removed' | 'structural_change';
  affected_references_count: number;
  confidence_score: number;
  impact_summary: string;
  preview_description: string;
}

/**
 * Previews potential document impacts from proposed substrate operations.
 * This is a read-only preview - no impacts are created or stored.
 */
export async function previewDocumentImpacts(
  supabase: SupabaseClient,
  proposalOps: any[],
  workspaceId: string,
  basketId?: string
): Promise<DocumentImpactPreview[]> {
  try {
    // Step 1: Extract substrate IDs that would be affected by these operations
    const affectedSubstrateIds = extractAffectedSubstrateIds(proposalOps);
    
    if (affectedSubstrateIds.length === 0) {
      return [];
    }

    // Step 2: Find documents that currently reference these substrates
    const { data: currentReferences, error: refsError } = await supabase
      .from('substrate_references')
      .select(`
        document_id,
        substrate_id,
        substrate_type,
        role,
        documents!inner(id, title, workspace_id)
      `)
      .in('substrate_id', affectedSubstrateIds)
      .eq('documents.workspace_id', workspaceId);

    if (refsError) {
      console.error('Failed to get current substrate references:', refsError);
      return [];
    }

    // Step 3: Group by document and analyze potential impact
    const documentGroups = new Map<string, any[]>();
    currentReferences?.forEach(ref => {
      const docId = ref.document_id;
      if (!documentGroups.has(docId)) {
        documentGroups.set(docId, []);
      }
      documentGroups.get(docId)!.push(ref);
    });

    // Step 4: Create preview for each affected document
    const previews: DocumentImpactPreview[] = [];
    
    for (const [docId, references] of documentGroups) {
      const document = references[0].documents;
      const preview = createImpactPreview(document, references, proposalOps);
      previews.push(preview);
    }

    // Step 5: Sort by impact severity (high confidence first)
    return previews.sort((a, b) => b.confidence_score - a.confidence_score);

  } catch (error) {
    console.error('Document impact preview failed:', error);
    return [];
  }
}

/**
 * Extracts substrate IDs that would be affected by proposal operations
 */
function extractAffectedSubstrateIds(proposalOps: any[]): string[] {
  const substrateIds: string[] = [];
  
  for (const op of proposalOps) {
    switch (op.type) {
      case 'ReviseBlock':
        if (op.data.block_id) {
          substrateIds.push(op.data.block_id);
        }
        break;
      case 'EditContextItem':
        if (op.data.context_item_id) {
          substrateIds.push(op.data.context_item_id);
        }
        break;
      case 'Delete':
        if (op.data.target_id) {
          substrateIds.push(op.data.target_id);
        }
        break;
      case 'MergeContextItems':
        if (op.data.from_ids) {
          substrateIds.push(...op.data.from_ids);
        }
        if (op.data.canonical_id) {
          substrateIds.push(op.data.canonical_id);
        }
        break;
      case 'PromoteScope':
        if (op.data.block_id) {
          substrateIds.push(op.data.block_id);
        }
        break;
      // Note: CreateDump, CreateBlock, CreateContextItem don't affect existing documents
      // until the new substrates are manually added to document references
    }
  }
  
  return [...new Set(substrateIds)]; // Remove duplicates
}

/**
 * Creates impact preview for a single document
 */
function createImpactPreview(
  document: any,
  references: any[],
  proposalOps: any[]
): DocumentImpactPreview {
  // Determine impact type based on operations affecting this document's references
  const impactType = determinePreviewImpactType(proposalOps, references);
  
  // Calculate confidence based on operation complexity
  const confidenceScore = calculatePreviewConfidence(proposalOps, references);
  
  // Create human-readable descriptions
  const impactSummary = createPreviewSummary(impactType, references.length);
  const previewDescription = createPreviewDescription(impactType, proposalOps, references);

  return {
    document_id: document.id,
    document_title: document.title,
    impact_type: impactType,
    affected_references_count: references.length,
    confidence_score: confidenceScore,
    impact_summary: impactSummary,
    preview_description: previewDescription
  };
}

/**
 * Determines impact type for preview based on operations
 */
function determinePreviewImpactType(
  proposalOps: any[],
  references: any[]
): 'content_drift' | 'new_references' | 'reference_removed' | 'structural_change' {
  // Check for deletions
  if (proposalOps.some(op => op.type === 'Delete')) {
    return 'reference_removed';
  }
  
  // Check for content updates
  if (proposalOps.some(op => op.type === 'ReviseBlock' || op.type === 'EditContextItem')) {
    return 'content_drift';
  }
  
  // Check for structural changes
  if (proposalOps.some(op => op.type === 'MergeContextItems' || op.type === 'PromoteScope')) {
    return 'structural_change';
  }
  
  // Default to content drift
  return 'content_drift';
}

/**
 * Calculates confidence score for preview
 */
function calculatePreviewConfidence(
  proposalOps: any[],
  references: any[]
): number {
  let confidence = 0.7; // Base confidence
  
  // Lower confidence for complex operations
  if (proposalOps.some(op => op.type === 'MergeContextItems' || op.type === 'Delete')) {
    confidence -= 0.2;
  }
  
  // Lower confidence for many affected references
  if (references.length > 5) {
    confidence -= 0.1;
  }
  
  // Higher confidence for simple operations
  if (proposalOps.length === 1 && proposalOps[0].type === 'ReviseBlock') {
    confidence += 0.2;
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Creates human-readable impact summary
 */
function createPreviewSummary(
  impactType: 'content_drift' | 'new_references' | 'reference_removed' | 'structural_change',
  referenceCount: number
): string {
  const refText = `${referenceCount} reference${referenceCount === 1 ? '' : 's'}`;
  
  switch (impactType) {
    case 'content_drift':
      return `${refText} will have updated content`;
    case 'new_references':
      return `${refText} could be added`;
    case 'reference_removed':
      return `${refText} will be removed`;
    case 'structural_change':
      return `${refText} affected by structural changes`;
    default:
      return `${refText} may be affected`;
  }
}

/**
 * Creates detailed preview description
 */
function createPreviewDescription(
  impactType: 'content_drift' | 'new_references' | 'reference_removed' | 'structural_change',
  proposalOps: any[],
  references: any[]
): string {
  const opSummary = proposalOps.map(op => `${op.type}`).join(', ');
  
  switch (impactType) {
    case 'content_drift':
      return `Substrate content updates (${opSummary}) will affect referenced material in this document.`;
    case 'new_references':
      return `New substrate content (${opSummary}) could be added to this document.`;
    case 'reference_removed':
      return `Referenced substrate will be deleted (${opSummary}), requiring document cleanup.`;
    case 'structural_change':
      return `Major substrate changes (${opSummary}) may require document restructuring.`;
    default:
      return `Substrate operations (${opSummary}) may affect this document.`;
  }
}

/**
 * Gets confidence level for UI display
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score > 0.8) return 'high';
  if (score > 0.6) return 'medium';
  return 'low';
}

/**
 * Gets confidence color for UI
 */
export function getConfidenceColor(level: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high': return 'text-green-600 bg-green-50';
    case 'medium': return 'text-yellow-600 bg-yellow-50';
    case 'low': return 'text-red-600 bg-red-50';
  }
}

/**
 * Gets impact type icon for UI
 */
export function getImpactTypeIcon(impactType: string): string {
  switch (impactType) {
    case 'content_drift': return '📝';
    case 'new_references': return '➕';
    case 'reference_removed': return '❌';
    case 'structural_change': return '🔄';
    default: return '📄';
  }
}