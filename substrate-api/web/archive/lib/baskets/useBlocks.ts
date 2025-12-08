import useSWR from "swr";
import { apiClient } from "@/lib/api/client";

export interface BlockRow {
  id: string;
  label: string;
  type: string | null;
  updated_at: string;
  commit_id: string | null;
}

interface BuildingBlocksResponse {
  captures: Array<{ derived_blocks: Array<{ id: string; title: string | null; semantic_type: string | null; updated_at?: string | null; created_at: string; metadata?: Record<string, any> | null; }> }>;
  orphans: {
    blocks: Array<{ id: string; title: string | null; semantic_type: string | null; updated_at?: string | null; created_at: string; metadata?: Record<string, any> | null; }>;
  };
}

const fetcher = async (url: string) => {
  const payload = await apiClient.request<BuildingBlocksResponse>(url);
  const rows: BlockRow[] = [];

  const pushBlock = (block: { id: string; title: string | null; semantic_type: string | null; updated_at?: string | null; created_at: string; metadata?: Record<string, any> | null; }) => {
    rows.push({
      id: block.id,
      label: block.title || block.semantic_type || 'Untitled block',
      type: block.semantic_type || null,
      updated_at: block.updated_at || block.created_at,
      commit_id: (block.metadata as any)?.commit_id ?? null,
    });
  };

  payload.captures.forEach(capture => {
    capture.derived_blocks.forEach(pushBlock);
  });

  payload.orphans.blocks.forEach(pushBlock);

  return rows;
};

export function useBlocks(basketId: string) {
  const { data, isLoading, error } = useSWR(
    `/api/baskets/${basketId}/building-blocks`,
    fetcher,
    {
      refreshInterval: 20_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  return { blocks: data ?? [], isLoading, error };
}
