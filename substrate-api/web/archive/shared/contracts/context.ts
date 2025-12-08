// Context items and related types
// V3.0 DEPRECATED: context_items merged into blocks table
// Use Block type from blocks.ts with semantic_type instead

export type ContextItem = {
  id: string;
  basket_id: string;
  document_id?: string;
  type: string;                    // DEPRECATED: Use semantic_type on Block instead
  content?: string;
  title?: string;
  description?: string;
  confidence_score?: number;
  status: 'active' | 'archived';
  metadata?: Record<string, any>;
  normalized_label?: string;
  raw_dump_id?: string;
  created_at?: string;
  updated_at?: string;
};

// For creating context items
// V3.0 DEPRECATED: Use CreateBlock operations with semantic_type instead
export type CreateContextItemPayload = {
  basket_id: string;
  type: string;
  content?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
};