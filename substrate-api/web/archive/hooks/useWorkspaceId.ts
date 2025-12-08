'use client';

import { useBasket as useBasketContext } from '@/contexts/BasketContext';
import { useBasket as useBasketQuery } from '@/hooks/useBasket';

/**
 * Hook to get the workspace ID from the current basket
 * Falls back to basket query if context is not available
 */
export function useWorkspaceId(basketId: string): string | null {
  // Try to get from context first (faster if available)
  try {
    const contextBasket = useBasketContext();
    if (contextBasket?.basket?.workspace_id) {
      return contextBasket.basket.workspace_id;
    }
  } catch {
    // Context not available, fall through to query
  }

  // Fall back to query
  const { data: basket } = useBasketQuery(basketId);
  return basket?.workspace_id || null;
}