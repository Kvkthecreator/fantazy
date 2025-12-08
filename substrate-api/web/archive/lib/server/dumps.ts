import { cookies } from "next/headers";
import { createServerComponentClient } from "@/lib/supabase/clients";
import type { Dump } from "@/shared/contracts/dumps";

export async function getLatestDumpServer(basketId: string): Promise<Dump | null> {
  const supabase = createServerComponentClient({ cookies });
  const { data, error } = await supabase
    .from("dumps")
    .select("id,basket_id,body_md,created_at")
    .eq("basket_id", basketId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) {
    console.error("[getLatestDumpServer]", error.message);
    return null;
  }
  return data ?? null;
}
