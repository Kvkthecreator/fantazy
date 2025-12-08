import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/dbTypes";
import { ensureWorkspaceServer } from "@/lib/workspaces/ensureWorkspaceServer";

export interface BasketAccessResult {
  basket: {
    id: string;
    name: string | null;
    workspace_id: string;
  };
  workspace: {
    id: string;
    name: string;
    owner_id: string;
  };
}

/**
 * Consolidated basket access checker
 * 
 * Ensures:
 * 1. User is authenticated
 * 2. User has workspace membership
 * 3. Basket exists and belongs to user's workspace
 * 
 * Throws notFound() if any check fails - following Next.js conventions
 * 
 * @param supabase - Supabase client with server component context
 * @param basketId - The basket ID to check access for
 * @returns Promise<BasketAccessResult> - Basket and workspace data if authorized
 * @throws notFound() - If user unauthorized or basket doesn't exist
 */
export async function checkBasketAccess(
  supabase: SupabaseClient<Database>,
  basketId: string
): Promise<BasketAccessResult> {
  const workspace = await ensureWorkspaceServer(supabase)
  if (!workspace) redirect('/baskets')

  const { data: basket, error: basketError } = await supabase
    .from('baskets')
    .select('id, name, workspace_id')
    .eq('id', basketId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (basketError) throw basketError
  if (!basket) redirect('/baskets')

  return { basket, workspace }
}

/**
 * Lightweight basket access check that returns null instead of throwing
 * 
 * Use this when you want to handle authorization failures gracefully
 * instead of showing a 404 page.
 * 
 * @param supabase - Supabase client 
 * @param basketId - The basket ID to check
 * @returns Promise<BasketAccessResult | null> - Access result or null if unauthorized
 */
export async function tryCheckBasketAccess(
  supabase: SupabaseClient<Database>, 
  basketId: string
): Promise<BasketAccessResult | null> {
  try {
    const workspace = await ensureWorkspaceServer(supabase);
    if (!workspace) return null;

    const { data: basket } = await supabase
      .from('baskets')
      .select('id, name, workspace_id')
      .eq('id', basketId)
      .eq('workspace_id', workspace.id)
      .maybeSingle()

    if (!basket) return null

    return { basket, workspace };
  } catch (error) {
    console.warn(`🔒 Basket access check failed: ${basketId}`, error);
    return null;
  }
}
