import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubstrateIntelligence } from '@/lib/substrate/types';
import type { IntelligenceEvent, IntelligenceChange, ContentHash } from './changeDetection';
import { createTimelineEventViaGovernance } from './universalIntelligenceRouter';

/**
 * Store intelligence event via governance system (Canon v2.2 compliant)
 */
export async function storeIntelligenceEvent(
  supabase: SupabaseClient,
  event: Omit<IntelligenceEvent, 'id' | 'timestamp'>
): Promise<IntelligenceEvent> {
  const fullEvent: IntelligenceEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };

  // Route timeline event creation through universal work orchestration
  const timelineData = {
    kind: event.kind,
    payload: {
      intelligence: event.intelligence,
      contentHash: event.contentHash,
      changes: event.changes,
      approvalState: event.approvalState,
      approvedSections: event.approvedSections,
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      origin: event.origin,
      eventId: fullEvent.id,
      timestamp: fullEvent.timestamp
    },
    workspace_id: event.workspaceId
  };

  try {
    // Route through governance - high confidence for intelligence events
    const workResult = await createTimelineEventViaGovernance(
      event.basketId,
      timelineData,
      {
        confidence_score: 0.9,
        user_override: 'allow_auto' // Intelligence events are system-generated
      }
    );

    // Note: The actual timeline event will be created by the work system
    // We return the event data for backwards compatibility
    return fullEvent;
    
  } catch (error) {
    // Fallback: If governance system fails, log error but don't break intelligence
    console.error('Failed to route intelligence event through governance:', error);
    throw new Error(`Failed to store intelligence event via governance: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get intelligence events for a basket
 */
export async function getIntelligenceEvents(
  supabase: SupabaseClient,
  basketId: string,
  options?: {
    limit?: number;
    kind?: IntelligenceEvent['kind'];
    approvalState?: IntelligenceEvent['approvalState'];
  }
): Promise<IntelligenceEvent[]> {
  let query = supabase
    .from('timeline_events')
    .select('*')
    .eq('basket_id', basketId)
    .in('kind', ['intelligence_generation', 'intelligence_approval', 'intelligence_rejection'])
    .order('ts', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.kind) {
    query = query.eq('kind', options.kind);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch intelligence events: ${error.message}`);
  }

  return data.map(row => ({
    id: row.payload?.eventId || row.id,
    basketId: row.basket_id!,
    workspaceId: row.payload?.workspaceId || '',
    kind: row.kind as IntelligenceEvent['kind'],
    intelligence: row.payload?.intelligence,
    contentHash: row.payload?.contentHash,
    changes: row.payload?.changes || [],
    approvalState: row.payload?.approvalState || 'pending',
    approvedSections: row.payload?.approvedSections || [],
    actorId: row.payload?.actorId || '',
    origin: row.payload?.origin || 'manual',
    timestamp: row.ts
  })).filter(event => event.intelligence); // Filter out invalid events
}

/**
 * Get the last approved intelligence for a basket
 */
export async function getLastApprovedIntelligence(
  supabase: SupabaseClient,
  basketId: string
): Promise<SubstrateIntelligence | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('basket_id', basketId)
    .eq('kind', 'intelligence_approval')
    .order('ts', { ascending: false })
    .limit(1);

  if (error || !data.length) {
    return null;
  }

  return data[0].payload?.intelligence || null;
}

/**
 * Get pending intelligence changes for a basket
 */
export async function getPendingIntelligenceChanges(
  supabase: SupabaseClient,
  basketId: string
): Promise<IntelligenceEvent[]> {
  return getIntelligenceEvents(supabase, basketId, {
    kind: 'intelligence_generation',
    approvalState: 'pending'
  });
}

/**
 * Approve intelligence changes
 */
export async function approveIntelligenceChanges(
  supabase: SupabaseClient,
  basketId: string,
  workspaceId: string,
  eventId: string,
  approvedSections: string[],
  actorId: string,
  partialApproval = false
): Promise<IntelligenceEvent> {
  // Get the original generation event
  const { data: originalEvent, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('basket_id', basketId)
    .eq('kind', 'intelligence_generation')
    .eq('payload->eventId', eventId)
    .single();

  if (fetchError || !originalEvent) {
    throw new Error('Original intelligence event not found');
  }

  // Create approval event
  const approvalEvent = await storeIntelligenceEvent(supabase, {
    basketId,
    workspaceId,
    kind: 'intelligence_approval',
    intelligence: originalEvent.payload.intelligence,
    contentHash: originalEvent.payload.contentHash,
    changes: originalEvent.payload.changes,
    approvalState: partialApproval ? 'partial' : 'approved',
    approvedSections,
    actorId,
    origin: 'manual'
  });

  // Update original event approval state
  await supabase
    .from('events')
    .update({
      payload: {
        ...originalEvent.payload,
        approvalState: partialApproval ? 'partial' : 'approved'
      }
    })
    .eq('id', originalEvent.id);

  return approvalEvent;
}

/**
 * Reject intelligence changes
 */
export async function rejectIntelligenceChanges(
  supabase: SupabaseClient,
  basketId: string,
  workspaceId: string,
  eventId: string,
  actorId: string,
  reason?: string
): Promise<IntelligenceEvent> {
  // Get the original generation event
  const { data: originalEvent, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('basket_id', basketId)
    .eq('kind', 'intelligence_generation')
    .eq('payload->eventId', eventId)
    .single();

  if (fetchError || !originalEvent) {
    throw new Error('Original intelligence event not found');
  }

  // Create rejection event
  const rejectionEvent = await storeIntelligenceEvent(supabase, {
    basketId,
    workspaceId,
    kind: 'intelligence_rejection',
    intelligence: originalEvent.payload.intelligence,
    contentHash: originalEvent.payload.contentHash,
    changes: originalEvent.payload.changes,
    approvalState: 'rejected',
    approvedSections: [],
    actorId,
    origin: 'manual'
  });

  // Update original event approval state
  await supabase
    .from('events')
    .update({
      payload: {
        ...originalEvent.payload,
        approvalState: 'rejected',
        rejectionReason: reason
      }
    })
    .eq('id', originalEvent.id);

  return rejectionEvent;
}

/**
 * Clean up old intelligence events (keep last 10 per basket)
 */
export async function cleanupOldIntelligenceEvents(
  supabase: SupabaseClient,
  basketId: string
): Promise<void> {
  // Get all intelligence events for this basket
  const { data: events, error } = await supabase
    .from('events')
    .select('id, ts')
    .eq('basket_id', basketId)
    .in('kind', ['intelligence_generation', 'intelligence_approval', 'intelligence_rejection'])
    .order('ts', { ascending: false });

  if (error || !events.length) {
    return;
  }

  // Keep only the last 10 events
  if (events.length > 10) {
    const toDelete = events.slice(10);
    const idsToDelete = toDelete.map(e => e.id);

    await supabase
      .from('events')
      .delete()
      .in('id', idsToDelete);
  }
}

/**
 * Check if there are any pending intelligence changes
 */
export async function hasPendingIntelligenceChanges(
  supabase: SupabaseClient,
  basketId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('basket_id', basketId)
    .eq('kind', 'intelligence_generation')
    .eq('payload->approvalState', 'pending')
    .limit(1);

  return !error && data.length > 0;
}

/**
 * Get intelligence history summary for a basket
 */
export interface IntelligenceHistorySummary {
  totalEvents: number;
  pendingChanges: number;
  lastApprovalDate: string | null;
  lastGenerationDate: string | null;
  approvalRate: number;
}

export async function getIntelligenceHistorySummary(
  supabase: SupabaseClient,
  basketId: string
): Promise<IntelligenceHistorySummary> {
  const events = await getIntelligenceEvents(supabase, basketId);
  
  const generationEvents = events.filter(e => e.kind === 'intelligence_generation');
  const approvalEvents = events.filter(e => e.kind === 'intelligence_approval');
  const pendingEvents = events.filter(e => e.approvalState === 'pending');

  const lastApproval = approvalEvents[0]; // Already sorted by date desc
  const lastGeneration = generationEvents[0];

  return {
    totalEvents: events.length,
    pendingChanges: pendingEvents.length,
    lastApprovalDate: lastApproval?.timestamp || null,
    lastGenerationDate: lastGeneration?.timestamp || null,
    approvalRate: generationEvents.length > 0 ? approvalEvents.length / generationEvents.length : 0
  };
}