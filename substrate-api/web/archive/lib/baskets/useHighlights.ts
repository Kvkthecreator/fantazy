import useSWR from "swr";
import { apiClient } from "@/lib/api/client";

export interface HighlightSuggestion {
  dump_input_id: string;
  conflicting_block_id: string;
  reason: string;
}

const fetcher = (url: string) => apiClient.request<HighlightSuggestion[]>(url);

export function useHighlights(basketId: string) {
  const { data, isLoading, error } = useSWR(
    () => (basketId ? `/api/baskets/${basketId}/input-highlights` : null),
    fetcher,
  );
  return { highlights: data ?? [], isLoading, error };
}
