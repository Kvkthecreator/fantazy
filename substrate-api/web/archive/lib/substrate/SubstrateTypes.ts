// TRUE CONTEXT OS - Unified Substrate Type Definitions
// All substrate types as peers, not hierarchical

export interface SubstrateElement {
  id: string;
  type: SubstrateType;
  basketId: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SubstrateType = 'dump' | 'block' | 'context_item' | 'timeline_event';

export interface RawDump extends SubstrateElement {
  type: 'dump';
  content: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface Block extends SubstrateElement {
  type: 'block';
  title: string;
  content: string;
  status: 'proposed' | 'accepted' | 'rejected';
  rawDumpId?: string;
  metadata?: Record<string, any>;
}

import type { ContextItem as ContractContextItem } from '@/shared/contracts/context';

export interface ContextElement extends SubstrateElement, ContractContextItem {
  type: 'context_item';
  semanticType: 'entity' | 'topic' | 'intent' | 'source_ref' | 'cue' | 'task';
  references: SubstrateRef[];
}

// Note: Document and Narrative are now artifacts, not substrates
// They are handled separately in the artifact layer

export interface TimelineEvent extends SubstrateElement {
  type: 'timeline_event';
  kind: string;
  payload: Record<string, any>;
  actor_id?: string;
  metadata?: Record<string, any>;
}

export interface CompositionElement {
  id: string;
  type: SubstrateType;
  substrateId: string;
  order: number;
  excerpt?: string;
  displayMode?: 'full' | 'excerpt' | 'reference';
}

export interface SubstrateRef {
  id: string;
  type: SubstrateType;
  basketId: string;
}

export interface Relationship {
  id: string;
  from: SubstrateRef;
  to: SubstrateRef;
  type: RelationshipType;
  strength?: number;
  metadata?: Record<string, any>;
}

export type RelationshipType = 
  | 'derives_from'    // block derives from dump
  | 'contextualizes'  // context_item contextualizes substrate
  | 'contradicts'     // semantic opposition
  | 'supports'        // semantic agreement
  | 'extends'         // builds upon
  | 'synthesizes';    // combines multiple sources

export interface SubstrateOperation {
  type: 'add' | 'update' | 'delete' | 'compose' | 'link' | 'process';
  substrate: Partial<SubstrateElement>;
  agentType?: string;
  relationships?: Relationship[];
}

export interface SubstrateResponse {
  success: boolean;
  data?: SubstrateElement | SubstrateElement[];
  relationships?: Relationship[];
  error?: string;
}

export interface AgentRequest {
  agentType: string;
  operation: string;
  data: any;
  basketId: string;
  workspaceId: string;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}