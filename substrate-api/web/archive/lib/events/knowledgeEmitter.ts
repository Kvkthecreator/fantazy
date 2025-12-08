/**
 * Knowledge Event Emitter - Canon v3.0
 * 
 * Helper functions to emit knowledge timeline events
 * For user-meaningful milestones in their knowledge journey
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';

export type KnowledgeEventType = 
  | 'memory.captured'
  | 'knowledge.evolved'
  | 'insights.discovered'
  | 'document.created'
  | 'document.updated'
  | 'relationships.mapped'
  | 'governance.decided'
  | 'milestone.achieved';

export type EventSignificance = 'low' | 'medium' | 'high';

interface EmitKnowledgeEventParams {
  basketId: string;
  workspaceId: string;
  eventType: KnowledgeEventType;
  title: string;
  description?: string;
  significance?: EventSignificance;
  metadata?: Record<string, any>;
  relatedIds?: Record<string, any>;
}

/**
 * Emit a knowledge timeline event
 */
export async function emitKnowledgeEvent({
  basketId,
  workspaceId,
  eventType,
  title,
  description,
  significance = 'medium',
  metadata = {},
  relatedIds = {}
}: EmitKnowledgeEventParams): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient() as any;
    
    const { data, error } = await supabase.rpc('emit_knowledge_event', {
      p_basket_id: basketId,
      p_workspace_id: workspaceId,
      p_event_type: eventType,
      p_title: title,
      p_description: description,
      p_significance: significance,
      p_metadata: metadata,
      p_related_ids: relatedIds
    });

    if (error) {
      console.error('Knowledge event emission failed:', error);
      return null;
    }

    return data; // Returns the event ID
  } catch (error) {
    console.error('Knowledge event emission error:', error);
    return null;
  }
}

/**
 * Convenience functions for common knowledge events
 */

export async function emitMemoryCaptured(
  basketId: string,
  workspaceId: string,
  options: {
    source: string;
    itemCount?: number;
    rawDumpId?: string;
  }
) {
  return emitKnowledgeEvent({
    basketId,
    workspaceId,
    eventType: 'memory.captured',
    title: `Memory captured from ${options.source}`,
    description: options.itemCount ? `${options.itemCount} new items added to your memory` : undefined,
    significance: 'medium',
    metadata: { source: options.source },
    relatedIds: options.rawDumpId ? { raw_dump_id: options.rawDumpId } : {}
  });
}

export async function emitKnowledgeEvolved(
  basketId: string,
  workspaceId: string,
  options: {
    blockCount: number;
    contextItemId?: string;
  }
) {
  return emitKnowledgeEvent({
    basketId,
    workspaceId,
    eventType: 'knowledge.evolved',
    title: `Knowledge structure evolved`,
    description: `${options.blockCount} new building blocks created`,
    significance: 'high',
    relatedIds: options.contextItemId ? { context_item_id: options.contextItemId } : {}
  });
}

export async function emitInsightsDiscovered(
  basketId: string,
  workspaceId: string,
  options: {
    reflectionId: string;
    insightCount?: number;
  }
) {
  return emitKnowledgeEvent({
    basketId,
    workspaceId,
    eventType: 'insights.discovered',
    title: 'New insights discovered',
    description: options.insightCount ? `${options.insightCount} insights found in your knowledge` : 'Fresh perspectives on your knowledge',
    significance: 'medium',
    relatedIds: { reflection_id: options.reflectionId }
  });
}

export async function emitDocumentCreated(
  basketId: string,
  workspaceId: string,
  options: {
    documentId: string;
    title: string;
    source: 'compose_new' | 'recompose';
  }
) {
  return emitKnowledgeEvent({
    basketId,
    workspaceId,
    eventType: 'document.created',
    title: `Document created: ${options.title}`,
    significance: 'high',
    metadata: { creation_method: options.source },
    relatedIds: { document_id: options.documentId }
  });
}

export async function emitDocumentUpdated(
  basketId: string,
  workspaceId: string,
  options: {
    documentId: string;
    title: string;
    updateType: 'recomposed' | 'edited';
  }
) {
  return emitKnowledgeEvent({
    basketId,
    workspaceId,
    eventType: 'document.updated',
    title: `Document updated: ${options.title}`,
    significance: 'medium',
    metadata: { update_type: options.updateType },
    relatedIds: { document_id: options.documentId }
  });
}

export async function emitRelationshipsMapped(
  basketId: string,
  workspaceId: string,
  options: {
    connectionCount: number;
    entityIds?: string[];
  }
) {
  return emitKnowledgeEvent({
    basketId,
    workspaceId,
    eventType: 'relationships.mapped',
    title: 'New connections discovered',
    description: `${options.connectionCount} new relationships mapped in your knowledge`,
    significance: 'medium',
    metadata: { connection_count: options.connectionCount },
    relatedIds: options.entityIds ? { entity_ids: options.entityIds } : {}
  });
}

export async function emitGovernanceDecided(
  basketId: string,
  workspaceId: string,
  options: {
    decision: 'approved' | 'rejected';
    proposalId?: string;
    description: string;
  }
) {
  return emitKnowledgeEvent({
    basketId,
    workspaceId,
    eventType: 'governance.decided',
    title: `Governance decision: ${options.decision}`,
    description: options.description,
    significance: 'high',
    metadata: { decision: options.decision },
    relatedIds: options.proposalId ? { proposal_id: options.proposalId } : {}
  });
}

export async function emitMilestoneAchieved(
  basketId: string,
  workspaceId: string,
  options: {
    milestone: string;
    description: string;
    metadata?: Record<string, any>;
  }
) {
  return emitKnowledgeEvent({
    basketId,
    workspaceId,
    eventType: 'milestone.achieved',
    title: options.milestone,
    description: options.description,
    significance: 'high',
    metadata: options.metadata || {}
  });
}