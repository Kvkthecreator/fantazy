import useSWR from "swr";
import { apiClient } from "@/lib/api/client";

export interface CommitRow {
  id: string;
  created_at: string;
  summary: string | null;
  new_blocks: number;
  edited_blocks: number;
  supersedes: number;
}

async function fetchCommits(url: string): Promise<CommitRow[]> {
  return apiClient.request<CommitRow[]>(url);
}

export function useCommits(basketId: string) {
  const { data, error, isLoading } = useSWR(
    () => (basketId ? `/api/baskets/${basketId}/commits` : null),
    fetchCommits,
    { refreshInterval: 30_000 },
  );
  return {
    commits: data ?? [],
    isLoading,
    error,
  };
}
