import useSWR from "swr";
import type { DocumentDTO } from "@/shared/contracts/documents";
import { createBrowserClient } from "@/lib/supabase/clients";

export type DocumentRow = DocumentDTO & { updated_at: string | null };

const fetcher = async (basketId: string) => {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, basket_id, title, doc_type, current_version_hash, metadata, updated_at")
    .eq("basket_id", basketId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!data) return [];
  return data.map((doc: any) => ({
    id: doc.id,
    basket_id: doc.basket_id,
    title: doc.title,
    doc_type: doc.doc_type || 'artifact_other',
    current_version_hash: doc.current_version_hash,
    metadata: doc.metadata || {},
    latest_version_created_at: doc.updated_at,
    updated_at: doc.updated_at ?? null,
  })) as DocumentRow[];
};

export function useDocuments(basketId: string) {
  const { data, error, isLoading } = useSWR(
    () => (basketId ? basketId : null),
    fetcher,
    { 
      refreshInterval: 20_000,  // Reduced from 10s to 20s  
      revalidateOnFocus: true,  // Refresh when user returns to tab
      revalidateOnReconnect: true,
    },
  );
  return { docs: data ?? [], isLoading, error };
}
