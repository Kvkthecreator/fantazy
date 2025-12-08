// web/lib/baskets/getSnapshot.ts
import { apiClient } from "@/lib/api/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/dbTypes";
import type { BlockWithHistory } from "@/shared/contracts/blocks";

/** Shape returned by /api/baskets/{id}/snapshot */
export interface BasketSnapshot {
  basket: {
    id: string;
    name: string | null;
    created_at: string;
  };
  raw_dump_body: string;
  file_url: string | null;
  blocks: BlockWithHistory[];
  proposed_blocks: BlockWithHistory[];
}

const SNAPSHOT_PREFIX = "/baskets/snapshot";

export async function getSnapshot(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<BasketSnapshot> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("No authenticated user found");
  }
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token ?? "";
  const res = await apiClient.request<any>(`${SNAPSHOT_PREFIX}/${id}`);
  const payload = res as any;
  const flatBlocks = [
    ...(payload.accepted_blocks ?? []),
    ...(payload.locked_blocks ?? []),
    ...(payload.constants ?? []),
    ...(payload.proposed_blocks ?? []),
  ].map((b: any) => ({
    ...b,
    prev_rev_id: b.prev_rev_id ?? null,
    prev_content: b.prev_content ?? null,
  }));
  return {
    basket: payload.basket,
    raw_dump_body: payload.raw_dump,
    file_url: payload.file_url ?? null,
    blocks: flatBlocks,
    proposed_blocks: (payload.proposed_blocks ?? []).map((b: any) => ({
      ...b,
      prev_rev_id: b.prev_rev_id ?? null,
      prev_content: b.prev_content ?? null,
    })),
  };
}
