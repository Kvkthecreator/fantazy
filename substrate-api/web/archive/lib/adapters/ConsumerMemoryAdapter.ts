/**
 * B2C Consumer Memory Adapter - Canon v1.4.0 Compliant
 * 
 * PURE TRANSFORMATION LAYER for consumer presentation
 * - Simplifies canonical agent-processed data for consumer UX
 * - NEVER creates intelligence client-side  
 * - Uses Sacred Write Paths only
 * - Respects substrate equality
 * - Maintains workspace isolation
 */

import { BaseLensAdapter } from './base/LensAdapter';
import { fetchWithToken } from '@/lib/fetchWithToken';
import type {
  CanonicalTimelineEvent,
  CanonicalReflection,
  CanonicalBlock,
  CanonicalMemoryProjection,
  CanonicalDataAccess
} from './types/canonical';

/**
 * Consumer-friendly presentation types
 * Canon Compliance: Transformed from canonical data, never synthesized
 */
export interface ConsumerInsight {
  id: string;
  title: string;
  description: string;
  tags: string[];
  readingTime: number; // Agent-computed estimate
  personalRelevance: number; // Agent confidence score
  createdAt: string;
  agentAttribution?: string;
}

export interface ConsumerEvent {
  id: string;
  title: string;
  time: string;
  icon: string;
  category: string;
  agentAttribution?: string;
  confidence?: number;
}

export interface ConsumerMemory {
  id: string;
  type: 'thought' | 'insight' | 'connection' | 'reflection';
  content: string;
  summary: string; // Agent-generated summary
  createdAt: string;
  confidence: number;
  tags: string[];
  relatedCount: number;
}

/**
 * B2C Consumer Memory Adapter
 * Canon v1.4.0: Pure transformation of agent-processed canonical data
 */
export class ConsumerMemoryAdapter extends BaseLensAdapter<ConsumerMemory, CanonicalMemoryProjection> 
  implements CanonicalDataAccess {
  
  // CanonicalDataAccess interface properties
  readonly workspace_id: string;
  readonly user_id: string;
  
  constructor(workspaceId: string, userId: string) {
    super(workspaceId, userId);
    this.workspace_id = workspaceId;
    this.user_id = userId;
  }

  /**
   * Transform canonical memory projection for consumer presentation  
   * Canon Compliance: Only reshape agent-processed data, never create intelligence
   */
  transform(canonical: CanonicalMemoryProjection): ConsumerMemory {
    // For base class compatibility, return first memory or default
    const firstMemory = canonical.memories[0];
    if (!firstMemory) {
      return {
        id: canonical.basket_id,
        type: 'thought',
        content: 'No memories found',
        summary: 'Empty basket',
        createdAt: new Date().toISOString(),
        confidence: 0,
        tags: [],
        relatedCount: 0
      };
    }
    
    return {
      id: firstMemory.id,
      type: this.mapSubstrateTypeToConsumerType(firstMemory.substrate_type),
      content: firstMemory.content,
      summary: this.extractAgentSummary(firstMemory.metadata),
      createdAt: firstMemory.created_at,
      confidence: firstMemory.confidence_score || 0,
      tags: this.extractAgentTags(firstMemory.metadata),
      relatedCount: firstMemory.relationships?.length || 0
    };
  }

  /**
   * Transform all memories in projection for consumer presentation
   * Canon Compliance: Only reshape agent-processed data, never create intelligence
   */
  transformAll(canonical: CanonicalMemoryProjection): ConsumerMemory[] {
    return canonical.memories.map(memory => ({
      id: memory.id,
      type: this.mapSubstrateTypeToConsumerType(memory.substrate_type),
      content: memory.content,
      summary: this.extractAgentSummary(memory.metadata), // Use agent-generated summary
      createdAt: memory.created_at,
      confidence: memory.confidence_score || 0,
      tags: this.extractAgentTags(memory.metadata), // Use agent-processed tags
      relatedCount: memory.relationships?.length || 0
    }));
  }

  /**
   * Get personal insights from P3 Agent reflections
   * Canon Compliance: Transform P3 agent insights for consumer presentation
   */
  async getPersonalInsights(): Promise<ConsumerInsight[]> {
    const reflections = await this.getReflections();
    
    // Canon Compliant: Transform agent-computed reflections for consumer UX
    return reflections.map(r => ({
      id: r.id,
      title: this.extractFirstSentence(r.reflection_text), // Extract title from reflection text
      description: r.reflection_text,
      tags: [], // No reflection_tags in v2.0 model
      readingTime: this.estimateFromLength(r.reflection_text), // Calculate reading time from length
      personalRelevance: 0.8, // Default relevance for reflections
      createdAt: r.computation_timestamp,
      agentAttribution: r.meta?.processing_agent || 'P3 Agent'
    }));
  }

  /**
   * Get personal timeline in consumer-friendly format
   * Canon Compliance: Transform agent-computed timeline events
   */
  async getPersonalTimeline(basketId: string): Promise<ConsumerEvent[]> {
    const events = await this.getTimeline(basketId);
    
    // Canon Compliant: Transform agent-computed events for consumer presentation
    return events.map(e => ({
      id: e.id,
      title: e.display_title || e.description || this.getFallbackTitle(e.event_type), // Agent-computed title
      time: e.relative_time || e.created_at, // Agent-formatted or ISO fallback
      icon: e.canonical_icon || this.getFallbackIcon(e.event_type), // Agent-determined or fallback
      category: e.canonical_category || 'activity', // Agent-classified or default
      agentAttribution: e.processing_agent,
      confidence: e.agent_confidence
    }));
  }

  /**
   * Capture personal thought using Sacred Write Path
   * Canon Compliance: Use /api/dumps/new only, agent processing async
   */
  async capturePersonalThought(thought: string): Promise<{captureId: string; timelineUrl: string}> {
    const response = await fetchWithToken('/api/dumps/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: thought,
        workspace_id: this.workspaceId,
        source_context: 'consumer_personal_thought'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to capture thought via sacred write path');
    }

    const result = await response.json();
    
    // Canon Compliant: Return canonical result with timeline reference
    return {
      captureId: result.id,
      timelineUrl: `/api/baskets/${result.basket_id}/timeline`
      // Agent processing happens asynchronously via queue
    };
  }

  // Canonical Data Access Implementation - Workspace-scoped

  async getTimeline(basketId: string): Promise<CanonicalTimelineEvent[]> {
    const response = await fetchWithToken(`/api/baskets/${basketId}/timeline`);
    if (!response.ok) throw new Error('Failed to fetch timeline');
    
    const data = await response.json();
    return data.events || [];
  }

  async getReflections(basketId?: string): Promise<CanonicalReflection[]> {
    // For consumer adapter, get reflections from current user's baskets
    const endpoint = basketId 
      ? `/api/baskets/${basketId}/reflections`
      : `/api/reflections/user/${this.userId}`;
    
    const response = await fetchWithToken(endpoint);
    if (!response.ok) throw new Error('Failed to fetch reflections');
    
    const data = await response.json();
    return data.reflections || [];
  }

  async getBlocks(basketId: string): Promise<CanonicalBlock[]> {
    const response = await fetchWithToken(`/api/baskets/${basketId}/building-blocks`);
    if (!response.ok) throw new Error('Failed to fetch blocks');
    
    const buildingBlocksData = await response.json();
    const data = buildingBlocksData.substrates.filter((s: any) => s.type === 'block');
    return data.blocks || [];
  }

  async getProjection(basketId: string): Promise<CanonicalMemoryProjection> {
    const response = await fetchWithToken(`/api/baskets/${basketId}/projection`);
    if (!response.ok) throw new Error('Failed to fetch projection');
    
    return await response.json();
  }

  // Private Helper Methods - Pure transformation utilities

  private mapSubstrateTypeToConsumerType(substrateType: string): ConsumerMemory['type'] {
    // Canon Compliant: Map canonical substrate types to consumer-friendly types
    switch (substrateType) {
      case 'raw_dump': return 'thought';
      case 'block': return 'insight';
      case 'context_relationship': return 'connection';
      case 'reflection': return 'reflection';
      default: return 'thought';
    }
  }

  private extractAgentSummary(metadata: Record<string, unknown>): string {
    // Canon Compliant: Use agent-generated summary from metadata
    return (metadata.agent_summary as string) || 
           (metadata.summary as string) || 
           'Summary unavailable';
  }

  private extractAgentTags(metadata: Record<string, unknown>): string[] {
    // Canon Compliant: Use agent-processed tags from metadata
    return (metadata.agent_tags as string[]) || 
           (metadata.tags as string[]) || 
           [];
  }

  private extractFirstSentence(text: string): string {
    // Simple text extraction for fallback title (not intelligence generation)
    const match = text.match(/^[^.!?]*[.!?]/);
    return match ? match[0].trim() : text.substring(0, 50) + '...';
  }

  private estimateFromLength(text: string): number {
    // Simple reading time estimate (not intelligence, just math)
    return Math.max(1, Math.ceil(text.length / 200)); // ~200 chars per minute
  }

  private getFallbackTitle(eventType: string): string {
    // Simple fallback formatting (not intelligence generation)
    return eventType.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getFallbackIcon(eventType: string): string {
    // Simple icon mapping (not intelligence, just UI mapping)
    const iconMap: Record<string, string> = {
      'dump.created': '📄',
      'block.created': '🧱',
      'reflection.computed': '🤔',
      'relationship.created': '🔗'
    };
    return iconMap[eventType] || '📋';
  }
}