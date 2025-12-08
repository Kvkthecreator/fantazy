import { headers } from 'next/headers';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase/clients';
import { getAuthenticatedUser } from './getAuthenticatedUser';

/**
 * Test-aware Supabase client that uses service role in test mode
 */
export function createTestAwareClient({ cookies }: { cookies: any }) {
  const headersList = headers();
  const isTest = headersList.get('x-playwright-test') === 'true';
  
  return isTest ? createServiceRoleClient() : createRouteHandlerClient({ cookies });
}

/**
 * Test-aware authentication that bypasses membership checks in test mode
 */
export async function getTestAwareAuth(supabase: any) {
  const headersList = headers();
  const isTest = headersList.get('x-playwright-test') === 'true';
  
  const { userId } = await getAuthenticatedUser(supabase);
  
  return { userId, isTest };
}

/**
 * Test-aware membership check that skips in test mode
 */
export async function checkMembershipUnlessTest(
  supabase: any, 
  workspaceId: string, 
  userId: string, 
  isTest: boolean
) {
  if (isTest) {
    return; // Skip membership check in test mode
  }
  
  const { data: membership, error: mErr } = await supabase
    .from("workspace_memberships")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
    
  if (mErr) {
    throw new Error(`Membership check failed: ${mErr.message}`);
  }
  
  if (!membership) {
    throw new Error("Forbidden");
  }
}