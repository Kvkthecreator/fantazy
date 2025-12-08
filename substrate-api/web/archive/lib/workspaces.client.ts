'use client';

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './dbTypes';

/**
 * Creates or fetches a workspace for the given user.
 * Requires a valid Supabase client with injected user access token.
 */
export async function getOrCreateWorkspaceId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  console.debug("[Workspace] Creating or retrieving workspace for user:", userId);

  const { data: existing, error: existingError } = await supabase
    .from('workspace_memberships')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) {
    console.error("[Workspace] Failed to fetch workspace membership", existingError.message);
    throw existingError;
  }

  if (existing?.workspace_id) return existing.workspace_id;

  const { data: created, error: createError } = await supabase
    .from('workspaces')
    .insert({ name: 'My Workspace', created_by: userId }) // adjust column name if needed
    .select('id')
    .single();

  if (createError || !created?.id) {
    console.error("[Workspace] Failed to create workspace", createError?.message);
    throw new Error('Failed to create workspace');
  }

  const { error: memberInsertError } = await supabase
    .from('workspace_memberships')
    .insert({
      workspace_id: created.id,
      user_id: userId,
      role: 'owner',
    });

  if (memberInsertError) {
    console.error("[Workspace] Failed to assign user to workspace", memberInsertError.message);
    throw memberInsertError;
  }

  return created.id;
}


/**
 * Fetches the active workspace for a given user.
 */
export async function getActiveWorkspaceId(
  supabase: SupabaseClient<Database>,
  userId: string | undefined,
): Promise<string | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error("[Workspace] Failed to fetch active workspace", error.message);
    return null;
  }

  return data?.workspace_id ?? null;
}
