import { apiClient, timeoutSignal } from './http';
import {
  BlockSchema,
  PaginatedSchema,
  UpdateBlockRequestSchema,
  type Block,
  type Paginated,
  type UpdateBlockRequest,
} from './contracts';

/**
 * Block API functions with Zod validation
 * 
 * Canon v2.2 Compliance:
 * - Read operations (getBlock, listBlocks) use direct API calls
 * - Write operations (updateBlock) route through Universal Work Orchestration (/api/work)
 * - Create/Delete operations should use /api/work directly or specialized endpoints
 */

// Get single block
export async function getBlock(blockId: string): Promise<Block> {
  const response = await apiClient({
    url: `/api/blocks/${blockId}`,
    method: 'GET',
    signal: timeoutSignal(10000),
  });
  
  return BlockSchema.parse(response);
}

// List blocks for a basket with cursor pagination
export async function listBlocks(basketId: string, options?: {
  after_created_at?: string;
  after_id?: string;
  limit?: number;
  status?: 'proposed' | 'accepted' | 'rejected';
}): Promise<Paginated<Block>> {
  const params = new URLSearchParams();
  params.set('basket_id', basketId);
  
  if (options?.after_created_at) {
    params.set('after_created_at', options.after_created_at);
  }
  if (options?.after_id) {
    params.set('after_id', options.after_id);
  }
  if (options?.limit) {
    params.set('limit', options.limit.toString());
  }
  if (options?.status) {
    params.set('status', options.status);
  }
  
  const response = await apiClient({
    url: `/api/blocks?${params}`,
    method: 'GET',
    signal: timeoutSignal(10000),
  });
  
  return PaginatedSchema(BlockSchema).parse(response);
}


// Update block (title, content, etc.) via Universal Work Orchestration
export async function updateBlock(
  blockId: string,
  updates: UpdateBlockRequest,
  basketId: string
): Promise<{ work_id: string; routing_decision: string; execution_mode: string }> {
  // Validate request payload
  const validatedUpdates = UpdateBlockRequestSchema.parse(updates);
  
  // Route through Universal Work Orchestration (Canon v2.2 compliant)
  const response = await apiClient({
    url: `/api/work`,
    method: 'POST',
    body: {
      work_type: 'MANUAL_EDIT',
      work_payload: {
        operations: [{
          type: 'update_block',
          data: {
            id: blockId,
            ...validatedUpdates
          }
        }],
        basket_id: basketId,
        confidence_score: 0.9,
        user_override: undefined // Let governance decide
      },
      priority: 'normal'
    },
    signal: timeoutSignal(10000),
  });
  
  return response as { work_id: string; routing_decision: string; execution_mode: string };
}