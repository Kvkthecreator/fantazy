import useSWR from "swr";
import { apiClient } from "@/lib/api/client";

const fetcher = (url: string) => apiClient.request<{ count: number }>(url);

export function usePendingChanges(basketId: string) {
  const { data } = useSWR(
    () => (basketId ? `/api/baskets/${basketId}/change-queue` : null),
    fetcher,
    { refreshInterval: 15_000 },
  );
  return data?.count ?? 0;
}
