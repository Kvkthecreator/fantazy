/**
 * Component: useBasketTimeline
 * Hook for fetching basket timeline
 * @contract output : TimelinePage
 */
import useSWR from "swr";
import { fetchTimeline } from "@/lib/api/timeline";
import type { TimelinePage } from "@/shared/contracts/memory";

export function useBasketTimeline(basketId: string) {
  return useSWR<TimelinePage>(
    `/api/baskets/${basketId}/timeline`,
    () => fetchTimeline(basketId)
  );
}