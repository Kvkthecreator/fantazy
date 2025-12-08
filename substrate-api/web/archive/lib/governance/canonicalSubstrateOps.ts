import type { SupabaseClient } from '@supabase/supabase-js';

type AnySupabase = SupabaseClient<any, any, any>;

function coerceArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export interface OperationResult {
  created_id?: string;
  updated_id?: string;
  type: string;
}

export async function createBlockCanonical(
  supabase: AnySupabase,
  op: any,
  basketId: string,
  workspaceId: string
): Promise<OperationResult> {
  const metadata = op.metadata || {};
  const title = op.title || metadata.title || 'Untitled insight';
  const semanticType = op.semantic_type || metadata.semantic_type || 'insight';
  const confidence = op.confidence ?? metadata.confidence ?? 0.7;
  const bodySource = op.body_md ?? op.content ?? metadata.summary ?? '';
  const body = typeof bodySource === 'string' ? bodySource : JSON.stringify(bodySource);

  const { data, error } = await supabase.rpc('fn_block_create', {
    p_basket_id: basketId,
    p_workspace_id: workspaceId,
    p_title: title,
    p_body_md: body,
  });

  if (error) {
    throw new Error(`fn_block_create failed: ${error.message}`);
  }

  let blockId = Array.isArray(data) ? data[0] : data;
  if (blockId && typeof blockId === 'object') {
    const values = Object.values(blockId);
    blockId = values[0] as string | undefined;
  }
  if (!blockId) {
    throw new Error('fn_block_create returned no block id');
  }

  // V3.0: Include anchor fields
  const updates = {
    semantic_type: semanticType,
    metadata,
    confidence_score: confidence,
    anchor_role: op.anchor_role ?? null,
    anchor_status: op.anchor_status ?? 'proposed',
    anchor_confidence: op.anchor_confidence ?? null,
    state: 'ACCEPTED',
  };

  const { data: updateData, error: updateError } = await supabase
    .from('blocks')
    .update(updates)
    .eq('id', blockId)
    .select('*')
    .single();

  if (updateError) {
    throw new Error(`Failed to finalize block ${blockId}: ${updateError.message}`);
  }

  return { created_id: updateData.id, type: 'block' };
}

// V3.0: CreateContextItem now creates blocks with semantic_type
export async function createContextItemCanonical(
  supabase: AnySupabase,
  op: any,
  basketId: string,
  workspaceId: string
): Promise<OperationResult> {
  // Map legacy "kind" to v3.0 semantic_type
  const semanticTypeMap: Record<string, string> = {
    'concept': 'entity',
    'entity': 'entity',
    'intent': 'intent',
    'objective': 'objective',
    'rationale': 'rationale',
    'principle': 'principle',
    'constraint': 'constraint',
    'assumption': 'assumption',
    'context': 'context',
  };

  const metadata = { ...(op.metadata || {}) };
  const label = op.label || op.title || metadata.title || 'Untitled context';
  const synonyms = coerceArray(op.synonyms ?? metadata.synonyms);
  const confidence = op.confidence ?? metadata.confidence ?? 0.7;
  const contentSource = op.content ?? metadata.summary ?? '';
  const content = typeof contentSource === 'string' ? contentSource : JSON.stringify(contentSource);

  const kind = op.kind || metadata.kind || 'concept';
  const semanticType = semanticTypeMap[kind] || 'entity';

  metadata.synonyms = synonyms;
  metadata.legacy_kind = kind;  // Preserve original kind for reference

  // Create block via RPC
  const { data, error } = await supabase.rpc('fn_block_create', {
    p_basket_id: basketId,
    p_workspace_id: workspaceId,
    p_title: label,
    p_body_md: content,
  });

  if (error) {
    throw new Error(`fn_block_create failed: ${error.message}`);
  }

  let blockId = Array.isArray(data) ? data[0] : data;
  if (blockId && typeof blockId === 'object') {
    const values = Object.values(blockId);
    blockId = values[0] as string | undefined;
  }
  if (!blockId) {
    throw new Error('fn_block_create returned no block id');
  }

  // V3.0: Update with semantic_type and anchor fields
  const updates = {
    semantic_type: semanticType,
    metadata,
    confidence_score: confidence,
    anchor_role: op.anchor_role ?? null,
    anchor_status: op.anchor_status ?? 'proposed',
    anchor_confidence: op.anchor_confidence ?? confidence,
    state: 'ACCEPTED',
  };

  const { data: updateData, error: updateError } = await supabase
    .from('blocks')
    .update(updates)
    .eq('id', blockId)
    .select('*')
    .single();

  if (updateError) {
    throw new Error(`Failed to finalize block ${blockId}: ${updateError.message}`);
  }

  return { created_id: updateData.id, type: 'block' };
}

function sanitizeForJson<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeForJson) as unknown as T;
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString() as unknown as T;
    if (value instanceof Object && 'toString' in value && typeof value.toString === 'function' && value.toString() !== '[object Object]') {
      try {
        return (value as any).toString();
      } catch (_) {
        // fallthrough
      }
    }
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = sanitizeForJson(v);
    }
    return result as unknown as T;
  }
  return value;
}

export async function reviseBlockCanonical(
  supabase: AnySupabase,
  op: any,
  basketId: string,
  workspaceId: string
): Promise<OperationResult> {
  const blockId = op.block_id;
  if (!blockId) {
    throw new Error('reviseBlock requires block_id');
  }

  const { data: existing, error: fetchError } = await supabase
    .from('blocks')
    .select('id, body_md, content, semantic_type, metadata, confidence_score, title')
    .eq('id', blockId)
    .eq('workspace_id', workspaceId)
    .single();

  if (fetchError || !existing) {
    throw new Error(fetchError?.message || `Block ${blockId} not found`);
  }

  const newContentSource = op.content ?? op.body_md ?? existing.body_md ?? existing.content ?? '';
  const newContent = typeof newContentSource === 'string' ? newContentSource : JSON.stringify(newContentSource);
  const newSemanticType = op.semantic_type ?? existing.semantic_type;
  const newConfidence = op.confidence ?? existing.confidence_score ?? 0.7;
  const newMetadata = sanitizeForJson({ ...(existing.metadata || {}), ...(op.metadata || {}) });

  const diffJson = {
    before: {
      content: existing.body_md ?? existing.content,
      semantic_type: existing.semantic_type,
    },
    after: {
      content: newContent,
      semantic_type: newSemanticType,
    },
  };

  try {
    await supabase.rpc('fn_block_revision_create', {
      p_basket_id: basketId,
      p_block_id: blockId,
      p_workspace_id: workspaceId,
      p_summary: op.revision_reason || 'Governed block revision',
      p_diff_json: sanitizeForJson(diffJson),
    });
  } catch (e: any) {
    throw new Error(`fn_block_revision_create failed: ${e?.message || e}`);
  }

  const { data: updated, error: updateError } = await supabase
    .from('blocks')
    .update({
      body_md: newContent,
      content: newContent,
      semantic_type: newSemanticType,
      confidence_score: newConfidence,
      metadata: newMetadata,
      title: op.title ?? existing.title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', blockId)
    .select('*')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || `Failed to update block ${blockId}`);
  }

  return { updated_id: updated.id, type: 'block' };
}

// V3.0: UpdateContextItem now updates blocks with semantic_type
export async function updateContextItemCanonical(
  supabase: AnySupabase,
  op: any,
  basketId: string,
  workspaceId: string
): Promise<OperationResult> {
  const blockId = op.context_item_id || op.block_id;
  if (!blockId) {
    throw new Error('updateContextItem requires context_item_id or block_id');
  }

  // Map legacy "kind" to v3.0 semantic_type
  const semanticTypeMap: Record<string, string> = {
    'concept': 'entity',
    'entity': 'entity',
    'intent': 'intent',
    'objective': 'objective',
    'rationale': 'rationale',
    'principle': 'principle',
    'constraint': 'constraint',
    'assumption': 'assumption',
    'context': 'context',
  };

  const { data: existing, error: fetchError } = await supabase
    .from('blocks')
    .select('id, title, content, body_md, metadata, confidence_score, semantic_type')
    .eq('id', blockId)
    .eq('workspace_id', workspaceId)
    .single();

  if (fetchError || !existing) {
    throw new Error(fetchError?.message || `Block ${blockId} not found`);
  }

  const label = op.label ?? op.title ?? existing.title ?? '';
  const contentSource = op.content ?? existing.body_md ?? existing.content ?? '';
  const content = typeof contentSource === 'string' ? contentSource : JSON.stringify(contentSource);

  const synonymsInput = op.synonyms ?? op.additional_synonyms ?? existing.metadata?.synonyms ?? [];
  const synonyms = Array.isArray(synonymsInput)
    ? synonymsInput
    : String(synonymsInput)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  const metadata = sanitizeForJson({
    ...(existing.metadata || {}),
    ...(op.metadata || {}),
    synonyms,
  });

  const kind = op.kind ?? existing.metadata?.legacy_kind;
  const semanticType = kind ? (semanticTypeMap[kind] || existing.semantic_type) : existing.semantic_type;

  const { data: updated, error: updateError } = await supabase
    .from('blocks')
    .update({
      title: label || existing.title,
      body_md: content,
      content: content,
      semantic_type: semanticType,
      confidence_score: op.confidence ?? existing.confidence_score ?? 0.7,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', blockId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || `Failed to update block ${blockId}`);
  }

  return { updated_id: updated.id, type: 'block' };
}
