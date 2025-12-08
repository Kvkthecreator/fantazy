'use client';

import { useQuery } from '@tanstack/react-query';
import { getBasket } from '@/lib/api/baskets';
import { listDeltas as getDeltasApi } from '@/lib/api/deltas';

export function useBasket(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['basket', id],
    queryFn: () => getBasket(id),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });
}

export function useBasketDeltas(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['basket', id, 'deltas'],
    queryFn: () => getDeltasApi(id),
    select: (data) => {
      const items = Array.isArray(data) ? data : data.items;
      return items?.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) ?? [];
    },
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });
}
