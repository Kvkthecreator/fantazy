import { apiClient, timeoutSignal } from './http';
import {
  DeltaSchema,
  PaginatedSchema,
  type Delta,
  type Paginated,
} from './contracts';

/**
 * Delta API functions with Zod validation
 */

// Get single delta
export async function getDelta(deltaId: string): Promise<Delta> {
  const response = await apiClient({
    url: `/api/deltas/${deltaId}`,
    method: 'GET',
    signal: timeoutSignal(10000),
  });
  
  return DeltaSchema.parse(response);
}

// List deltas for a basket with cursor pagination
export async function listDeltas(basketId: string, options?: {
  after_created_at?: string;
  after_id?: string;
  limit?: number;
}): Promise<Paginated<Delta>> {
  const params = new URLSearchParams();
  
  if (options?.after_created_at) {
    params.set('after_created_at', options.after_created_at);
  }
  if (options?.after_id) {
    params.set('after_id', options.after_id);
  }
  if (options?.limit) {
    params.set('limit', options.limit.toString());
  }
  
  const url = `/api/baskets/${basketId}/deltas${params.toString() ? `?${params}` : ''}`;
  
  const response = await apiClient({
    url,
    method: 'GET',
    signal: timeoutSignal(10000),
  });
  
  // Handle direct array response (for compatibility with existing API)
  if (Array.isArray(response)) {
    return {
      items: response.map(item => DeltaSchema.parse(item)),
      has_more: false,
    };
  }
  
  return PaginatedSchema(DeltaSchema).parse(response);
}

// Apply delta to basket
export async function applyDelta(basketId: string, deltaId: string): Promise<{
  status: string;
  basket_id: string;
  delta_id: string;
}> {
  const response = await apiClient({
    url: `/api/baskets/${basketId}/apply/${deltaId}`,
    method: 'POST',
    signal: timeoutSignal(15000),
  });
  
  return response as {
    status: string;
    basket_id: string;
    delta_id: string;
  };
}