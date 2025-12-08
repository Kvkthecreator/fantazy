/**
 * ChangeDescriptor: Canonical representation of any user/system change request
 * 
 * Provides unified abstraction for all substrate mutations regardless of origin.
 * Used by PolicyDecider to determine routing (proposal vs direct commit).
 */

import type { EntryPoint } from './flagsServer';

export type ChangeDescriptor = {
  // Context
  entry_point: EntryPoint;
  actor_id: string;
  workspace_id: string;
  basket_id?: string;
  basis_snapshot_id?: string;
  
  // Risk assessment
  blast_radius?: 'Local' | 'Scoped' | 'Global';
  
  // Operations to execute
  ops: OperationDescriptor[];
  
  // Provenance tracking
  provenance?: ProvenanceEntry[];
};

// Canon v2.0: Substrate-Only Operations
export type OperationDescriptor = 
  | CreateDumpOp
  | CreateBlockOp
  | ReviseBlockOp
  | CreateContextItemOp
  | AttachContextItemOp
  | MergeContextItemsOp
  | PromoteScopeOp
  | DetachOp
  | RenameOp
  | ContextAliasOp
  | EditContextItemOp
  | DeleteOp;

// Raw dump operations (P0 Capture)
export interface CreateDumpOp {
  type: 'CreateDump';
  data: {
    dump_request_id: string;
    text_dump?: string;
    file_url?: string;
    source_meta?: Record<string, any>;
  };
}

// Block operations
export interface CreateBlockOp {
  type: 'CreateBlock';
  data: {
    content: string;
    semantic_type: string;
    canonical_value?: string;
    confidence?: number;
    scope?: 'LOCAL' | 'WORKSPACE' | 'GLOBAL';
    title?: string;
    metadata?: Record<string, any>;
  };
}

export interface ReviseBlockOp {
  type: 'ReviseBlock';
  data: {
    block_id: string;
    content?: string;
    canonical_value?: string;
    confidence?: number;
    revision_reason?: string;
    title?: string;
    metadata?: Record<string, any>;
    semantic_type?: string;
  };
}

// Context item operations
export interface CreateContextItemOp {
  type: 'CreateContextItem';
  data: {
    label: string;
    content?: string;
    synonyms?: string[];
    kind?: 'concept' | 'entity' | 'topic' | 'theme';
    confidence?: number;
    metadata?: Record<string, any>;
  };
}

export interface AttachContextItemOp {
  type: 'AttachContextItem';
  data: {
    context_item_id: string;
    target_id: string;
    target_type: 'block' | 'document' | 'relationship';
    relationship_type?: string;
  };
}

export interface MergeContextItemsOp {
  type: 'MergeContextItems';
  data: {
    from_ids: string[];
    canonical_id: string;
    merge_strategy: 'absorb' | 'combine' | 'replace';
    merge_reason?: string;
  };
}

// Scope and organizational operations
export interface PromoteScopeOp {
  type: 'PromoteScope';
  data: {
    block_id: string;
    to_scope: 'WORKSPACE' | 'GLOBAL';
    promotion_reason?: string;
  };
}

export interface DetachOp {
  type: 'Detach';
  data: {
    relationship_id: string;
    detach_reason?: string;
  };
}

export interface RenameOp {
  type: 'Rename';
  data: {
    target_id: string;
    target_type: 'block' | 'context_item' | 'document';
    new_name: string;
    rename_reason?: string;
  };
}

export interface ContextAliasOp {
  type: 'ContextAlias';
  data: {
    context_item_id: string;
    alias: string;
    alias_reason?: string;
  };
}

// REMOVED: Document operations are artifacts, not substrates
// DocumentEditOp, DocumentComposeOp, DocumentAddReferenceOp moved to artifact layer
// These operations belong in P4 presentation pipeline, NOT governance

// Context item edit operations
export interface EditContextItemOp {
  type: 'EditContextItem';
  data: {
    context_item_id: string;
    label?: string;
    content?: string;
    synonyms?: string[];
    edit_reason?: string;
  };
}

// Generic delete operations
export interface DeleteOp {
  type: 'Delete';
  data: {
    target_id: string;
    target_type: 'block' | 'context_item';
    delete_reason?: string;
  };
}

// Provenance tracking
export interface ProvenanceEntry {
  type: 'dump' | 'doc' | 'user' | 'agent' | 'import' | 'migration' | 'pipeline';
  id: string;
  metadata?: Record<string, any>;
}

/**
 * Helper functions for creating common ChangeDescriptors
 */

export function createManualEditDescriptor(
  actorId: string,
  workspaceId: string,
  basketId: string,
  ops: OperationDescriptor[],
  options?: {
    blastRadius?: 'Local' | 'Scoped' | 'Global';
    provenance?: ProvenanceEntry[];
  }
): ChangeDescriptor {
  return {
    entry_point: 'manual_edit',
    actor_id: actorId,
    workspace_id: workspaceId,
    basket_id: basketId,
    blast_radius: options?.blastRadius || 'Local',
    ops,
    provenance: options?.provenance || [
      { type: 'user', id: actorId }
    ]
  };
}

export function createDumpExtractionDescriptor(
  actorId: string,
  workspaceId: string,
  basketId: string,
  dumpId: string,
  ops: OperationDescriptor[]
): ChangeDescriptor {
  return {
    entry_point: 'onboarding_dump',
    actor_id: actorId,
    workspace_id: workspaceId,
    basket_id: basketId,
    blast_radius: 'Scoped', // Dump extractions typically scoped
    ops,
    provenance: [
      { type: 'dump', id: dumpId },
      { type: 'agent', id: 'P1_SUBSTRATE' }
    ]
  };
}

// REMOVED: createDocumentEditDescriptor
// Document operations are artifacts and should use separate P4 pipeline

export function createReflectionSuggestionDescriptor(
  actorId: string,
  workspaceId: string,
  basketId: string,
  reflectionId: string,
  ops: OperationDescriptor[]
): ChangeDescriptor {
  return {
    entry_point: 'manual_edit',  // Reflections are now artifacts, treated as manual edits
    actor_id: actorId,
    workspace_id: workspaceId,
    basket_id: basketId,
    blast_radius: 'Local', // Reflection suggestions usually local
    ops,
    provenance: [
      { type: 'agent', id: 'P3_REFLECTION' },
      { type: 'user', id: actorId }
    ]
  };
}

/**
 * Validation helpers for ChangeDescriptor
 */

export function validateChangeDescriptor(cd: ChangeDescriptor): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  if (!cd.entry_point) errors.push('entry_point required');
  if (!cd.actor_id) errors.push('actor_id required');
  if (!cd.workspace_id) errors.push('workspace_id required');
  if (!cd.ops || cd.ops.length === 0) errors.push('ops array required and non-empty');
  
  // Validate operations
  if (cd.ops && Array.isArray(cd.ops)) {
    for (let i = 0; i < cd.ops.length; i++) {
    const op = cd.ops[i];
    if (!op.type) errors.push(`ops[${i}].type required`);
    if (!op.data) errors.push(`ops[${i}].data required`);
    
    // Type-specific validation
    switch (op.type) {
      case 'CreateDump':
        if (!op.data.dump_request_id) errors.push(`ops[${i}].data.dump_request_id required for CreateDump`);
        if (!op.data.text_dump && !op.data.file_url) errors.push(`ops[${i}] CreateDump requires text_dump or file_url`);
        break;
      case 'CreateBlock':
        if (!op.data.content) errors.push(`ops[${i}].data.content required for CreateBlock`);
        if (!op.data.semantic_type) errors.push(`ops[${i}].data.semantic_type required for CreateBlock`);
        break;
      case 'CreateContextItem':
        if (!op.data.label) errors.push(`ops[${i}].data.label required for CreateContextItem`);
        break;
      case 'ReviseBlock':
        if (!op.data.block_id) errors.push(`ops[${i}].data.block_id required for ReviseBlock`);
        break;
      case 'EditContextItem':
        if (!op.data.context_item_id) errors.push(`ops[${i}].data.context_item_id required for EditContextItem`);
        break;
      case 'Delete':
        if (!op.data.target_id) errors.push(`ops[${i}].data.target_id required for Delete`);
        if (!op.data.target_type) errors.push(`ops[${i}].data.target_type required for Delete`);
        break;
      // Add more validations as needed
    }
    }
  }
  
  // Validate blast_radius if provided
  if (cd.blast_radius && !['Local', 'Scoped', 'Global'].includes(cd.blast_radius)) {
    errors.push('blast_radius must be Local, Scoped, or Global');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Risk assessment helpers
 */

export function computeOperationRisk(ops: OperationDescriptor[]): {
  scope_impact: 'low' | 'medium' | 'high';
  operation_count: number;
  operation_types: string[];
} {
  const operationTypes = ops.map(op => op.type);
  const uniqueTypes = new Set(operationTypes);
  
  // Assess scope impact based on operation types
  let scopeImpact: 'low' | 'medium' | 'high' = 'low';
  
  if (ops.some(op => op.type === 'PromoteScope')) {
    scopeImpact = 'high';
  } else if (ops.some(op => op.type === 'MergeContextItems' || op.type === 'AttachContextItem' || op.type === 'CreateContextItem')) {
    // Canon: Context-items are semantic bridges that affect substrate relationships
    scopeImpact = 'medium';
  } else if (ops.some(op => op.type === 'CreateBlock' || op.type === 'ReviseBlock')) {
    // All substrate creation should be governed per Canon
    scopeImpact = 'medium';
  } else if (ops.some(op => op.type === 'CreateDump')) {
    // Dump creation is typically low risk but can contain sensitive data
    scopeImpact = 'low';
  }
  
  return {
    scope_impact: scopeImpact,
    operation_count: ops.length,
    operation_types: Array.from(uniqueTypes)
  };
}

/**
 * Debugging and introspection helpers
 */

export function summarizeChange(cd: ChangeDescriptor): string {
  const risk = computeOperationRisk(cd.ops);
  const opSummary = risk.operation_types.join(', ');
  
  return `${cd.entry_point}: ${risk.operation_count} ops (${opSummary}) [${cd.blast_radius || 'Unknown'}]`;
}
