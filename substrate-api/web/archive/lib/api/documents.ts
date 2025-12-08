import { apiClient, timeoutSignal } from './http';
import {
  PaginatedSchema,
  type Document as LegacyDocument,
  type Paginated,
} from './contracts';
import { DocumentHeadSchema, type DocumentDTO } from '@/shared/contracts/documents';

/**
 * Document API functions with Zod validation
 */

// Get single document
export async function getDocument(documentId: string): Promise<DocumentDTO> {
  const response = await apiClient({
    url: `/api/documents/${documentId}`,
    method: 'GET',
    signal: timeoutSignal(10000),
  });
  
  return DocumentHeadSchema.parse(response);
}

// List documents for a basket with cursor pagination
export async function listDocuments(basketId: string, options?: {
  after_created_at?: string;
  after_id?: string;
  limit?: number;
  document_type?: string;
}): Promise<Paginated<DocumentDTO>> {
  const params = new URLSearchParams();
  params.set('basketId', basketId);
  
  if (options?.after_created_at) {
    params.set('after_created_at', options.after_created_at);
  }
  if (options?.after_id) {
    params.set('after_id', options.after_id);
  }
  if (options?.limit) {
    params.set('limit', options.limit.toString());
  }
  if (options?.document_type) {
    params.set('document_type', options.document_type);
  }
  
  const response = await apiClient({
    url: `/api/documents?${params}`,
    method: 'GET',
    signal: timeoutSignal(10000),
  });
  
  return PaginatedSchema(DocumentHeadSchema).parse(response);
}

// Update document
export async function updateDocument(
  documentId: string,
  updates: Partial<Pick<LegacyDocument, 'title' | 'content_raw' | 'document_type' | 'metadata'>>
): Promise<DocumentDTO> {
  const response = await apiClient({
    url: `/api/documents/${documentId}`,
    method: 'PATCH',
    body: updates,
    signal: timeoutSignal(15000),
  });
  
  return DocumentHeadSchema.parse(response);
}

// Delete document
export async function deleteDocument(documentId: string): Promise<void> {
  await apiClient({
    url: `/api/documents/${documentId}`,
    method: 'DELETE',
    signal: timeoutSignal(10000),
  });
}
