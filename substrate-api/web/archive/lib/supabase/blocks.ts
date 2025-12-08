
import { createBrowserClient } from "@/lib/supabase/clients";
import { apiClient } from "@/lib/api/client";

export interface BlockInsert {
  user_id?: string;
  basket_id?: string;
  /**
   * TODO: rename to semantic_type across callers.
   * Accept either `type` or `semantic_type` to satisfy legacy usage.
   */
  type?: string;
  semantic_type?: string;
  label: string;
  content: string;
  state?: string;
  meta_tags?: string[];
  update_policy?: "manual" | "auto";
  is_core_block?: boolean;
  file_ids?: string[];
}

export async function fetchBlocks(
  workspaceId: string,
  coreOnly = false,
  scopes: string[] = ["basket", "profile"]
) {
  const supabase = createBrowserClient();
  let query = supabase
    .from("blocks")
    .select("*")
    .eq("workspace_id", workspaceId);
  if (scopes.length > 0) {
    query = query.in("meta_scope", scopes);
  }
  if (coreOnly) {
    query = query.eq("is_core_block", true);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  return { data, error };
}


export async function toggleAuto(id: string, enable: boolean, basketId: string) {
  return apiClient.request("/api/work", {
    method: "POST",
    body: JSON.stringify({
      work_type: "MANUAL_EDIT",
      work_payload: {
        operations: [{
          type: "update_block",
          data: {
            id,
            update_policy: enable ? "auto" : "manual"
          }
        }],
        basket_id: basketId,
        confidence_score: 1.0,
        user_override: "allow_auto"
      },
      priority: "normal"
    })
  });
}

export async function fetchBlock(id: string, workspaceId: string) {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("blocks")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  return { data, error };
}

export async function updateBlock(id: string, updates: Record<string, any>, basketId: string) {
  return apiClient.request("/api/work", {
    method: "POST",
    body: JSON.stringify({
      work_type: "MANUAL_EDIT",
      work_payload: {
        operations: [{
          type: "update_block",
          data: { id, ...updates }
        }],
        basket_id: basketId,
        confidence_score: 0.9,
        user_override: updates.user_override || undefined
      },
      priority: "normal"
    })
  });
}

export async function deleteBlock(id: string, basketId: string) {
  return apiClient.request("/api/work", {
    method: "POST",
    body: JSON.stringify({
      work_type: "MANUAL_EDIT",
      work_payload: {
        operations: [{
          type: "delete_block",
          data: { id }
        }],
        basket_id: basketId,
        confidence_score: 1.0,
        user_override: "require_review" // Deletions should be reviewed
      },
      priority: "normal"
    })
  });
}
