import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/dbTypes'
import { ensureSingleWorkspace } from '@/lib/canon/WorkspaceResolver'

/**
 * @deprecated Use ensureSingleWorkspace from WorkspaceResolver for canon compliance
 */
export async function ensureWorkspaceForUser(userId: string, supabase: SupabaseClient<Database>) {
  // Use canonical workspace resolver for single workspace guarantee
  return ensureSingleWorkspace(userId, supabase);
}
