import { z } from "zod";

// Re-export substrate reference types for documents
export { 
  SubstrateTypeSchema,
  SubstrateReferenceSchema,
  AttachSubstrateRequestSchema,
  AttachSubstrateResponseSchema,
  GetDocumentReferencesRequestSchema,
  GetDocumentReferencesResponseSchema,
  DocumentCompositionSchema,
  type SubstrateType,
  type SubstrateReferenceDTO,
  type AttachSubstrateRequest,
  type AttachSubstrateResponse,
  type GetDocumentReferencesRequest,
  type GetDocumentReferencesResponse,
  type DocumentComposition,
  type SubstrateSummary,
} from './substrate_references';

export const DocumentHeadSchema = z.object({
  id: z.string().uuid(),
  basket_id: z.string().uuid(),
  title: z.string(),
  doc_type: z.string(),
  current_version_hash: z.string().nullable(),
  latest_version_created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  metadata: z.record(z.any()).default({}),
});
export type DocumentDTO = z.infer<typeof DocumentHeadSchema>;

export const BlockSchema = z.object({
  id: z.string().uuid(),
  basket_id: z.string().uuid(),
  title: z.string().nullable(),
  body_md: z.string().nullable(),
  state: z.string(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.any()).default({}),
});
export type BlockDTO = z.infer<typeof BlockSchema>;


// API Request Schemas
export const CreateDocumentRequestSchema = z.object({
  basket_id: z.string().uuid(),
  title: z.string().min(1).optional(),
  intent: z.string().min(1),
  template_id: z.string().optional(),
  target_audience: z.string().optional(),
  tone: z.string().optional(),
  pinned_ids: z.array(z.string().uuid()).optional(),
  window_days: z.number().int().optional(),
  metadata: z.record(z.any()).optional(),
});
export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>;

export const CreateDocumentResponseSchema = z.object({
  document_id: z.string().uuid(),
});
export type CreateDocumentResponse = z.infer<typeof CreateDocumentResponseSchema>;

// Canon v3.0: Documents are composition definitions, not editable content
export const UpdateDocumentRequestSchema = z.object({
  title: z.string().optional(),
  composition_instructions: z.record(z.any()).optional(),
  substrate_filter: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});
export type UpdateDocumentRequest = z.infer<typeof UpdateDocumentRequestSchema>;


// API Response Schemas
export const GetDocumentsResponseSchema = z.object({
  documents: z.array(DocumentHeadSchema),
  last_cursor: z.string().optional(),
});
export type GetDocumentsResponse = z.infer<typeof GetDocumentsResponseSchema>;

export const GetBlocksResponseSchema = z.object({
  blocks: z.array(BlockSchema),
  last_cursor: z.string().optional(),
});
export type GetBlocksResponse = z.infer<typeof GetBlocksResponseSchema>;

// Graph/Relationship Schemas for Task E.7
export const RelationshipSchema = z.object({
  from_type: z.string(),
  from_id: z.string().uuid(),
  to_type: z.string(),
  to_id: z.string().uuid(),
  relationship_type: z.string(),
  strength: z.number().min(0).max(1),
});
export type RelationshipDTO = z.infer<typeof RelationshipSchema>;

export const GetGraphResponseSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().uuid(),
    type: z.string(),
    title: z.string(),
    metadata: z.record(z.any()).default({}),
  })),
  edges: z.array(RelationshipSchema),
});
export type GetGraphResponse = z.infer<typeof GetGraphResponseSchema>;

// Canon v3.0: Document type reflects composition model
export type Document = {
  id: string;
  title: string;
  basket_id: string;
  content?: string; // Read-only content from current version
  composition_instructions?: Record<string, any>;
  substrate_filter?: Record<string, any>;
  document_type?: string;
  workspace_id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
};
