/**
 * Substrate Data Types
 *
 * Core types for the four substrate data categories:
 * - Blocks: Semantic knowledge units
 * - Entries: Raw text content (user + agent)
 * - Documents: File-based content (PDFs, spreadsheets)
 * - Images: Visual media
 *
 * @see docs/canon/SUBSTRATE_DATA_TYPES.md
 */

// =============================================================================
// Source Types
// =============================================================================

export type SubstrateSource = 'user' | 'agent' | 'system';

export interface SubstrateItem {
  id: string;
  basket_id: string;
  source: SubstrateSource;
  created_at: string;
}

// =============================================================================
// Entries (raw_dumps + work_outputs text types)
// =============================================================================

/**
 * Text output types from work_outputs that should appear in Entries tab.
 * These are agent-generated text content, not file outputs.
 */
export const TEXT_OUTPUT_TYPES = [
  'finding',
  'recommendation',
  'insight',
  'draft_content',
  'report_section',
  'data_analysis',
] as const;

export type TextOutputType = typeof TEXT_OUTPUT_TYPES[number];

/**
 * Unified entry from either raw_dumps (user) or work_outputs (agent).
 */
export interface Entry extends SubstrateItem {
  // Common fields
  title?: string;
  body: string;

  // Source-specific metadata
  source_table: 'raw_dumps' | 'work_outputs';

  // raw_dumps specific
  processing_status?: 'unprocessed' | 'processing' | 'processed' | 'failed';

  // work_outputs specific
  output_type?: TextOutputType;
  agent_type?: string;
  supervision_status?: 'pending_review' | 'approved' | 'rejected' | 'revision_requested';
  confidence?: number;
  work_ticket_id?: string;
}

/**
 * API response for entries list.
 */
export interface EntriesListResponse {
  entries: Entry[];
  total: number;
  raw_dumps_count: number;
  work_outputs_count: number;
}

// =============================================================================
// Assets (reference_assets split into Documents + Images)
// =============================================================================

/**
 * Document MIME types for the Documents tab.
 */
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.ms-excel', // xls
  'application/vnd.ms-word', // doc
  'application/vnd.ms-powerpoint', // ppt
  'text/csv',
  'application/json',
  'text/plain',
  'application/xml',
  'text/xml',
] as const;

/**
 * Image MIME types for the Images tab.
 */
export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
] as const;

export type MimeCategory = 'document' | 'image' | 'other';

/**
 * Determine mime category for an asset.
 */
export function getMimeCategory(mimeType: string): MimeCategory {
  if (IMAGE_MIME_TYPES.some(t => mimeType.startsWith(t.replace('image/', 'image/')))) {
    return 'image';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (DOCUMENT_MIME_TYPES.includes(mimeType as any)) {
    return 'document';
  }
  return 'other';
}

/**
 * Reference asset from reference_assets table.
 */
export interface Asset extends SubstrateItem {
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;

  // Classification
  asset_type: string;
  asset_category: string;
  classification_status?: 'unclassified' | 'classifying' | 'classified' | 'failed';
  classification_confidence?: number;
  description?: string;

  // Source identification
  created_by_user_id?: string;
  work_session_id?: string;

  // Metadata
  agent_scope?: string[];
  tags?: string[];
  permanence: 'permanent' | 'temporary';
}

// Semantic aliases for clarity
export type Document = Asset;
export type Image = Asset;

/**
 * API response for assets list with filtering.
 */
export interface AssetsListResponse {
  assets: Asset[];
  total: number;
}

// =============================================================================
// Blocks (existing type, included for completeness)
// =============================================================================

export type BlockState = 'PROPOSED' | 'ACCEPTED' | 'LOCKED' | 'CONSTANT' | 'DEPRECATED';

export interface Block extends SubstrateItem {
  body: string;
  semantic_type: string;
  state: BlockState;
  confidence?: number;
  derived_from_asset_id?: string;
  proposal_id?: string;
}

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Determine source from item metadata.
 */
export function getItemSource(item: {
  work_session_id?: string | null;
  agent_type?: string | null;
  created_by_user_id?: string | null;
  source_table?: string;
}): SubstrateSource {
  if (item.source_table === 'work_outputs' || item.work_session_id || item.agent_type) {
    return 'agent';
  }
  if (item.created_by_user_id || item.source_table === 'raw_dumps') {
    return 'user';
  }
  return 'system';
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get display name for output type.
 */
export function getOutputTypeLabel(outputType: string): string {
  const labels: Record<string, string> = {
    finding: 'Finding',
    recommendation: 'Recommendation',
    insight: 'Insight',
    draft_content: 'Draft Content',
    report_section: 'Report Section',
    data_analysis: 'Data Analysis',
  };
  return labels[outputType] || outputType;
}

/**
 * Get display name for supervision status.
 */
export function getSupervisionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_review: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    revision_requested: 'Revision Requested',
  };
  return labels[status] || status;
}
