"use client";

import useSWR from 'swr';
import { fetchWithToken } from '@/lib/fetchWithToken';

export function useDetailedAnalysis(basketId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    basketId ? `/api/substrate/basket/${basketId}/detailed-analysis` : null,
    async (url: string) => {
      const response = await fetchWithToken(url);
      if (!response.ok) {
        throw new Error('Failed to fetch detailed analysis');
      }
      return response.json();
    },
    {
      refreshInterval: 0, // No auto-refresh for detailed analysis
      revalidateOnFocus: false,
    }
  );

  return {
    data,
    loading: isLoading,
    error: error?.message || null,
    refresh: () => mutate()
  };
}