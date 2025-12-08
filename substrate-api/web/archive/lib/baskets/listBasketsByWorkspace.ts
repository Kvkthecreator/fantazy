import { createServerSupabaseClient } from '@/lib/supabase/server'

export type BasketRow = {
  id: string;
  name: string | null;
  status: string | null;
  created_at: string | null;
}

export async function listBasketsByWorkspace(workspaceId: string) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('baskets')
    .select('id,name,status,created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  return { data: (data as BasketRow[]) ?? [], error }
}
