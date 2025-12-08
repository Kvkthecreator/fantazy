import { cookies } from "next/headers";
import { createServerComponentClient } from "@/lib/supabase/clients";
import type { Basket } from "@/shared/contracts/baskets";

export async function getBasketServer(
  id: string,
  workspaceId: string
): Promise<Basket | null> {
  const supabase = createServerComponentClient({ cookies });
  const { data, error } = await supabase
    .from("baskets")
    .select("id, name, status, created_at")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    console.error("[getBasketServer]", error.message);
    return null;
  }

  return data ?? null;
}
