import 'server-only';

import { createRouteHandlerClient } from '@/lib/supabase/clients';
import { cookies } from 'next/headers';
import * as crypto from 'crypto';

export interface BasketHealthMetrics {
  dump_count: number;
  reflection_count: number;
  latest_dump_at: string | null;
  latest_reflection_at: string | null;
  total_chars: number;
  activity_score: number;
}

export interface RecentDumpSummary {
  id: string;
  created_at: string;
  text_dump: string | null;
  file_url: string | null;
  char_count: number;
  is_processed: boolean;
}

export interface RecentReflectionSummary {
  id: string;
  reflection_text: string;
  computation_timestamp: string;
  substrate_window_start: string;
  substrate_window_end: string;
  meta: any;
}

export interface RecentTimelineEvent {
  id: string;
  event_type: string;
  created_at: string;
  preview: string;
  event_data: any;
}

export class DashboardQueries {
  private supabase;

  constructor() {
    this.supabase = createRouteHandlerClient({ cookies });
  }

  async getBasketHealth(basket_id: string): Promise<BasketHealthMetrics> {
    // Get dump metrics
    const { data: dumpStats } = await this.supabase
      .from('raw_dumps')
      .select('created_at, text_dump, file_url')
      .eq('basket_id', basket_id)
      .order('created_at', { ascending: false });

    // Get reflection artifact metrics
    const { data: reflectionStats } = await this.supabase
      .from('reflections_artifact')
      .select('computation_timestamp')
      .eq('basket_id', basket_id)
      .order('computation_timestamp', { ascending: false });

    // Calculate health metrics
    const dump_count = dumpStats?.length || 0;
    const reflection_count = reflectionStats?.length || 0;
    const latest_dump_at = dumpStats?.[0]?.created_at || null;
    const latest_reflection_at = reflectionStats?.[0]?.computation_timestamp || null;

    // Calculate total character count
    const total_chars = dumpStats?.reduce((sum, dump) => {
      const dumpChars = dump.text_dump?.length || 0;
      const urlChars = dump.file_url?.length || 0;
      return sum + dumpChars + urlChars;
    }, 0) || 0;

    // Simple activity score based on recency and volume
    const now = Date.now();
    const daysSinceLastDump = latest_dump_at 
      ? Math.ceil((now - new Date(latest_dump_at).getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    const daysSinceLastReflection = latest_reflection_at
      ? Math.ceil((now - new Date(latest_reflection_at).getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    const recency_score = Math.max(0, 100 - (daysSinceLastDump * 3 + daysSinceLastReflection * 2));
    const volume_score = Math.min(100, (dump_count * 10) + (reflection_count * 15) + (total_chars / 1000));
    const activity_score = Math.round((recency_score + volume_score) / 2);

    return {
      dump_count,
      reflection_count,
      latest_dump_at,
      latest_reflection_at,
      total_chars,
      activity_score: Math.max(0, Math.min(100, activity_score))
    };
  }

  async getRecentDumps(basket_id: string, limit: number = 3): Promise<RecentDumpSummary[]> {
    const { data, error } = await this.supabase
      .from('raw_dumps')
      .select('id, created_at, text_dump, file_url')
      .eq('basket_id', basket_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch recent dumps: ${error.message}`);
    }

    return (data || []).map(dump => ({
      id: dump.id,
      created_at: dump.created_at,
      text_dump: dump.text_dump,
      file_url: dump.file_url,
      char_count: (dump.text_dump?.length || 0) + (dump.file_url?.length || 0),
      is_processed: true // For Canon v1.3.1, all ingested dumps are processed
    }));
  }

  async getMostRecentReflection(basket_id: string): Promise<RecentReflectionSummary | null> {
    const { data, error } = await this.supabase
      .from('reflections_artifact')
      .select('*')
      .eq('basket_id', basket_id)
      .order('computation_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch recent reflection: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      reflection_text: data.reflection_text,
      computation_timestamp: data.computation_timestamp,
      substrate_window_start: data.substrate_window_start,
      substrate_window_end: data.substrate_window_end,
      meta: data.meta
    };
  }

  async getRecentTimelineEvents(basket_id: string, limit: number = 5): Promise<RecentTimelineEvent[]> {
    // Query timeline_events table directly (Canon v1.3.1 unified timeline)
    const { data, error } = await this.supabase
      .from('timeline_events')
      .select('id, kind, ts, payload, ref_id, preview')
      .eq('basket_id', basket_id)
      .order('ts', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch recent timeline events: ${error.message}`);
    }

    return (data || []).map(event => ({
      id: event.id.toString(),
      event_type: event.kind,
      created_at: event.ts,
      preview: event.preview || this.generateEventPreview(event.kind, event.payload),
      event_data: event.payload || {}
    }));
  }

  private generateEventPreview(kind: string, payload: any): string {
    switch (kind) {
      case 'dump':
      case 'dump.created':
        const charCount = payload?.char_count || 0;
        return `Added ${charCount} characters of content`;
      
      case 'reflection.computed':
        return 'New reflection computed from recent substrate';
      
      case 'delta.applied':
        return payload?.description || 'Applied substrate delta';
      
      case 'document.created':
        return payload?.title ? `Created document "${payload.title}"` : 'Created new document';
        
      case 'document.updated':
        return payload?.title ? `Updated document "${payload.title}"` : 'Updated document';
        
      case 'block.linked':
        return 'Linked block to document';
        
      case 'block.unlinked':
        return 'Unlinked block from document';
      
      default:
        return `${kind.replace('.', ' ')} event occurred`;
    }
  }
}