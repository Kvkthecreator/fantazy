import { cookies } from "next/headers";
import { createServerComponentClient } from "@/lib/supabase/clients";
import type { BlockDTO } from "@/shared/contracts/documents";

export async function getBlocksServer(basketId: string): Promise<BlockDTO[]> {
  const supabase = createServerComponentClient({ cookies });
  const { data, error } = await supabase
    .from("blocks")
    .select("id, basket_id, title, body_md, state, version, created_at, updated_at, metadata")
    .eq("basket_id", basketId)
    .order("created_at");

  if (error) {
    console.error("[getBlocksServer]", error.message);
    return [];
  }

  return data ?? [];
}
