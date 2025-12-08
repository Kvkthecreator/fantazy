import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/dbTypes';
import { createUserClient } from '@/lib/supabase/user';

export async function getAuthenticatedUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  const token = auth.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Missing Supabase env vars');
  }
  const supabase = createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  return { userId: user.id, token };
}

export async function ensureWorkspaceForUser(userId: string, token: string) {
  const supabase = createUserClient(token);
  const { data: membership } = await supabase
    .from('workspace_memberships')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .single();
  if (membership?.workspace_id) return membership.workspace_id;

  const { data: workspace, error: workspaceErr } = await supabase
    .from('workspaces')
    .insert({ owner_id: userId, name: 'Default Workspace' })
    .select('id')
    .single();
  if (workspaceErr || !workspace) {
    throw new Error('Failed to create workspace');
  }
  const { error: membershipErr } = await supabase
    .from('workspace_memberships')
    .insert({ user_id: userId, workspace_id: workspace.id, role: 'owner' });
  if (membershipErr) {
    throw new Error('Failed to create membership');
  }
  return workspace.id;
}
