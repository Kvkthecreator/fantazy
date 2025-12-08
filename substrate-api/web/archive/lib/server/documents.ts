import { cookies } from "next/headers";
import { createServerComponentClient } from "@/lib/supabase/clients";
import type { DocumentDTO } from "@/shared/contracts/documents";

export async function getDocumentsServer(workspaceId: string): Promise<DocumentDTO[]> {
  const supabase = createServerComponentClient({ cookies });

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, basket_id, doc_type, current_version_hash, metadata, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: true });

  if (error) {
    console.error("[getDocumentsServer]", error.message);
    return [];
  }

  return (data || []).map((doc: any) => ({
    id: doc.id,
    basket_id: doc.basket_id,
    title: doc.title,
    doc_type: doc.doc_type || 'artifact_other',
    current_version_hash: doc.current_version_hash,
    latest_version_created_at: doc.updated_at,
    updated_at: doc.updated_at,
    metadata: doc.metadata || {},
  }));
}
