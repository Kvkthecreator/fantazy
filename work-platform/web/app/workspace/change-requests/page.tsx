import { cookies } from 'next/headers';
import { createServerComponentClient } from '@/lib/supabase/clients';
import type { Database } from '@/lib/dbTypes';
import { ensureSingleWorkspace } from '@/lib/canon/WorkspaceResolver';
import { listBasketsByWorkspace } from '@/lib/substrate/baskets';
import WorkspaceChangeRequestsClient from '@/components/workspace/ChangeRequestsClient';
import {
  buildWorkspaceChangeRequests,
  type ProposalRow,
} from '@/lib/workspaces/changeRequests';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Workspace Change Requests Page
 *
 * Canon: YARNNN_GOVERNANCE_CANON_V5.md
 * Shows workspace-level change requests including:
 * - Type 1a: Basket assignment requests (unassigned captures)
 * - Type 1b: Cross-basket operations (future)
 * - Type 1c: Workspace mutations (future)
 */
export default async function WorkspaceChangeRequestsPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const workspace = await ensureSingleWorkspace(user.id, supabase);

  const { data: captures } = await supabase
    .from('mcp_unassigned_captures')
    .select('id, tool, summary, payload, fingerprint, candidates, status, assigned_basket_id, created_at, source_host, source_session')
    .eq('workspace_id', workspace.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'id, scope, status, proposal_kind, origin, basket_id, target_basket_id, affected_basket_ids, created_at, validator_report, ops, review_notes, metadata, source_host, source_session',
    )
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: baskets } = await listBasketsByWorkspace(workspace.id);

  const requests = buildWorkspaceChangeRequests(
    captures ?? [],
    (proposals ?? []) as ProposalRow[],
  );

  return (
    <WorkspaceChangeRequestsClient
      requests={requests}
      baskets={baskets ?? []}
    />
  );
}
