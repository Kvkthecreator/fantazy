import { z } from "zod";

/**
 * Document Versioning Contracts (Git-inspired)
 * 
 * Independent versioning system for document artifacts.
 * Reflections can reference specific document versions for stability.
 */

// Document version (immutable snapshot)
export const DocumentVersionSchema = z.object({
  version_hash: z.string().regex(/^doc_v[a-f0-9]{64}$/, "Invalid version hash format"),
  document_id: z.string().uuid(),
  content: z.string(),
  content_delta: z.string().nullable(),
  metadata_snapshot: z.record(z.any()),
  substrate_refs_snapshot: z.array(z.any()),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
  version_message: z.string().nullable(),
  parent_version_hash: z.string().nullable(),
});
export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;

// Request to create new document version
export const CreateDocumentVersionRequestSchema = z.object({
  document_id: z.string().uuid(),
  content: z.string().min(1, "Content cannot be empty"),
  version_message: z.string().optional(),
});
export type CreateDocumentVersionRequest = z.infer<typeof CreateDocumentVersionRequestSchema>;

// Response from creating document version
export const CreateDocumentVersionResponseSchema = z.object({
  version_hash: z.string(),
  is_new_version: z.boolean(), // false if content unchanged
});
export type CreateDocumentVersionResponse = z.infer<typeof CreateDocumentVersionResponseSchema>;

// Document version history
export const DocumentVersionHistorySchema = z.object({
  document_id: z.string().uuid(),
  current_version_hash: z.string(),
  versions: z.array(DocumentVersionSchema),
  total_versions: z.number(),
});
export type DocumentVersionHistory = z.infer<typeof DocumentVersionHistorySchema>;

// Version comparison (git diff-like)
export const VersionComparisonSchema = z.object({
  from_version: z.string(),
  to_version: z.string(),
  content_diff: z.string(),
  metadata_changes: z.record(z.any()),
  substrate_changes: z.object({
    added: z.array(z.string()),
    removed: z.array(z.string()),
    modified: z.array(z.string()),
  }),
});
export type VersionComparison = z.infer<typeof VersionComparisonSchema>;

// Document with version info
export const VersionedDocumentSchema = z.object({
  id: z.string().uuid(),
  basket_id: z.string().uuid(),
  title: z.string(),
  current_version_hash: z.string(),
  current_content: z.string(),
  metadata: z.record(z.any()),
  version_count: z.number(),
  last_versioned_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type VersionedDocument = z.infer<typeof VersionedDocumentSchema>;