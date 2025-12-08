import type { SupabaseClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/dbTypes";
import { ensureSingleWorkspace } from "@/lib/canon/WorkspaceResolver";

export async function ensureWorkspaceServer(supabase: SupabaseClient<Database>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  try {
    const { id: workspaceId } = await ensureSingleWorkspace(user.id, supabase);

    const { data: workspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();

    if (fetchError || !workspace) {
      console.error('[Workspace Fetch Error]', fetchError);
      return null;
    }

    return workspace;
  } catch (error) {
    console.error('[ensureWorkspaceServer] Failed to resolve workspace', error);
    return null;
  }
}
