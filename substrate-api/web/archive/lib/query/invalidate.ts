/**
 * Centralized query invalidation for basket-scoped data
 * All mutations should use this helper to ensure consistent cache updates
 */

import { QueryClient } from '@tanstack/react-query';

export type BasketScope = 'basket' | 'blocks' | 'documents' | 'deltas' | 'suggestions';

/**
 * Invalidate specific scopes for a basket
 * This is the single source of truth for cache invalidation
 */
export function invalidateBasketScopes(
  queryClient: QueryClient,
  basketId: string,
  scopes: BasketScope[]
) {
  const promises: Promise<void>[] = [];

  for (const scope of scopes) {
    switch (scope) {
      case 'basket':
        promises.push(
          queryClient.invalidateQueries({
            queryKey: ['basket', basketId],
          })
        );
        break;
        
      case 'blocks':
        promises.push(
          queryClient.invalidateQueries({
            queryKey: ['blocks', basketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['basket', basketId, 'blocks'],
          })
        );
        break;
        
      case 'documents':
        promises.push(
          queryClient.invalidateQueries({
            queryKey: ['documents', basketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['basket', basketId, 'documents'],
          })
        );
        break;
        
      case 'deltas':
        promises.push(
          queryClient.invalidateQueries({
            queryKey: ['deltas', basketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['basket', basketId, 'deltas'],
          })
        );
        break;
        
      case 'suggestions':
        promises.push(
          queryClient.invalidateQueries({
            queryKey: ['suggestions', basketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['basket', basketId, 'suggestions'],
          })
        );
        break;
    }
  }

  // Execute all invalidations in parallel
  return Promise.all(promises);
}

/**
 * Invalidate all basket-related queries (nuclear option)
 */
export function invalidateAllBasketData(
  queryClient: QueryClient,
  basketId: string
) {
  return invalidateBasketScopes(queryClient, basketId, [
    'basket',
    'blocks', 
    'documents',
    'deltas',
    'suggestions'
  ]);
}

/**
 * Invalidate basket list queries (for when baskets are created/deleted)
 */
export function invalidateBasketList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: ['baskets'],
  });
}

/**
 * Helper for mutations - standardized pattern
 */
export function createMutationInvalidator(
  queryClient: QueryClient,
  basketId: string,
  scopes: BasketScope[]
) {
  return () => invalidateBasketScopes(queryClient, basketId, scopes);
}

/**
 * Optimistic update helper for basket mutations
 */
export function updateBasketCache<T>(
  queryClient: QueryClient,
  basketId: string,
  updater: (old: T | undefined) => T
) {
  queryClient.setQueryData(['basket', basketId], updater);
}

/**
 * Optimistic update helper for list caches
 */
export function updateListCache<T>(
  queryClient: QueryClient,
  queryKey: string[],
  itemId: string,
  updater: (old: T | undefined) => T
) {
  queryClient.setQueriesData(
    { queryKey },
    (oldData: any) => {
      if (!oldData) return oldData;
      
      // Handle paginated responses
      if (oldData.items && Array.isArray(oldData.items)) {
        return {
          ...oldData,
          items: oldData.items.map((item: any) =>
            item.id === itemId ? updater(item) : item
          ),
        };
      }
      
      // Handle direct arrays
      if (Array.isArray(oldData)) {
        return oldData.map((item: any) =>
          item.id === itemId ? updater(item) : item
        );
      }
      
      return oldData;
    }
  );
}