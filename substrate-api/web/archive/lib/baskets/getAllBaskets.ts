// web/lib/baskets/getAllBaskets.ts
import { createBrowserClient } from "@/lib/supabase/clients";
import type { Database } from "@/lib/dbTypes";

export type BasketOverview = Pick<
  Database["public"]["Tables"]["baskets"]["Row"],
  "id" | "name" | "created_at" | "status"
>;

export async function getAllBaskets(): Promise<BasketOverview[]> {
  const supabase = createBrowserClient();
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return [];

    // Resolve user's current workspace (first membership)
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    let query = supabase
      .from('baskets')
      .select('id, name, created_at, status')
      .order('created_at', { ascending: false });

    if (membership?.workspace_id) {
      query = query.eq('workspace_id', membership.workspace_id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('❌ Supabase error while fetching baskets:', error.message);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error('❌ getAllBaskets failed:', e);
    return [];
  }
}
