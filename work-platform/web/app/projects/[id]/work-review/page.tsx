/**
 * Page: /projects/[id]/work-review - Work Output Supervision
 *
 * Shows all work outputs for a project pending user review.
 * Allows approve/reject/revision actions before promotion to substrate.
 */
import { cookies } from "next/headers";
import { createServerComponentClient } from "@/lib/supabase/clients";
import { getAuthenticatedUser } from "@/lib/auth/getAuthenticatedUser";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Clock, CheckCircle, XCircle, Loader2, FileCheck, Upload } from 'lucide-react';
import { cn } from "@/lib/utils";
import { WorkReviewClient } from "./WorkReviewClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; type?: string }>;
}

export default async function WorkReviewPage({ params, searchParams }: PageProps) {
  const { id: projectId } = await params;
  const { status: statusFilter, type: typeFilter } = await searchParams;

  const supabase = createServerComponentClient({ cookies });
  const { userId } = await getAuthenticatedUser(supabase);

  // Fetch project
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, basket_id, metadata')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Project not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
      </div>
    );
  }

  // Get supervision settings from project metadata
  const supervisionSettings = project.metadata?.work_supervision || {
    promotion_mode: 'auto',
    auto_promote_types: ['finding', 'recommendation'],
  };

  // Fetch work outputs with supervision status counts
  let outputs: any[] = [];
  let statusCounts: Record<string, number> = {
    pending_review: 0,
    approved: 0,
    rejected: 0,
    revision_requested: 0
  };
  let totalCount = 0;

  try {
    // Build query for work_outputs
    let query = supabase
      .from('work_outputs')
      .select(`
        id,
        output_type,
        agent_type,
        title,
        body,
        confidence,
        supervision_status,
        substrate_proposal_id,
        promotion_method,
        created_at,
        reviewed_at,
        reviewer_notes,
        work_tickets (
          id,
          status,
          metadata
        )
      `)
      .eq('basket_id', project.basket_id || '')
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('supervision_status', statusFilter);
    }
    if (typeFilter) {
      query = query.eq('output_type', typeFilter);
    }

    const { data: outputsData, error } = await query;
    if (error) {
      console.error('[Work Review] Query error:', error);
    }
    outputs = outputsData || [];

    // Calculate status counts
    const countQuery = supabase
      .from('work_outputs')
      .select('supervision_status')
      .eq('basket_id', project.basket_id || '');

    const { data: allOutputs } = await countQuery;
    if (allOutputs) {
      totalCount = allOutputs.length;
      allOutputs.forEach((o: any) => {
        const status = o.supervision_status || 'pending_review';
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        }
      });
    }
  } catch (error) {
    console.error(`[Work Review] Error fetching outputs:`, error);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/projects/${projectId}/overview`} className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Project
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Work Review</h1>
          <p className="text-muted-foreground mt-1">
            {project.name} • {supervisionSettings.promotion_mode === 'auto' ? 'Auto-promotion enabled' : 'Manual promotion'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${projectId}/work-tickets-view`}>
            <Button variant="outline">View Tickets</Button>
          </Link>
        </div>
      </div>

      {/* Status Filter Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatusFilterCard
          label="All"
          count={totalCount}
          projectId={projectId}
          active={!statusFilter}
          typeFilter={typeFilter}
        />
        <StatusFilterCard
          label="Pending Review"
          count={statusCounts.pending_review || 0}
          projectId={projectId}
          statusFilter="pending_review"
          active={statusFilter === 'pending_review'}
          typeFilter={typeFilter}
          icon={<Clock className="h-4 w-4" />}
          accent="warning"
        />
        <StatusFilterCard
          label="Approved"
          count={statusCounts.approved || 0}
          projectId={projectId}
          statusFilter="approved"
          active={statusFilter === 'approved'}
          typeFilter={typeFilter}
          icon={<CheckCircle className="h-4 w-4" />}
          accent="success"
        />
        <StatusFilterCard
          label="Rejected"
          count={statusCounts.rejected || 0}
          projectId={projectId}
          statusFilter="rejected"
          active={statusFilter === 'rejected'}
          typeFilter={typeFilter}
          icon={<XCircle className="h-4 w-4" />}
          accent="danger"
        />
        <StatusFilterCard
          label="Revision Requested"
          count={statusCounts.revision_requested || 0}
          projectId={projectId}
          statusFilter="revision_requested"
          active={statusFilter === 'revision_requested'}
          typeFilter={typeFilter}
          icon={<Loader2 className="h-4 w-4" />}
          accent="primary"
        />
      </div>

      {/* Output Type Filter Pills */}
      <OutputTypeFilterBar
        projectId={projectId}
        activeType={typeFilter}
        statusFilter={statusFilter}
      />

      {/* Outputs List */}
      {outputs.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {statusFilter || typeFilter ? 'No outputs found' : 'No work outputs yet'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {statusFilter
              ? `No ${statusFilter.replace('_', ' ')} outputs for this project.`
              : 'Work outputs will appear here after agents complete their tasks.'}
          </p>
          {!statusFilter && (
            <Link href={`/projects/${projectId}/work-tickets/new`}>
              <Button>Create Work Request</Button>
            </Link>
          )}
        </Card>
      ) : (
        <WorkReviewClient
          initialOutputs={outputs}
          basketId={project.basket_id || ''}
          projectId={projectId}
          supervisionSettings={supervisionSettings}
        />
      )}
    </div>
  );
}

const ACCENT_STYLES = {
  primary: {
    surface: "border border-surface-primary-border bg-surface-primary",
    text: "text-primary",
  },
  success: {
    surface: "border border-surface-success-border bg-surface-success",
    text: "text-success-foreground",
  },
  warning: {
    surface: "border border-surface-warning-border bg-surface-warning",
    text: "text-warning-foreground",
  },
  danger: {
    surface: "border border-surface-danger-border bg-surface-danger",
    text: "text-destructive",
  },
} as const;

type AccentKey = keyof typeof ACCENT_STYLES;

function StatusFilterCard({
  label,
  count,
  projectId,
  statusFilter,
  active,
  icon,
  accent,
  typeFilter,
}: {
  label: string;
  count: number;
  projectId: string;
  statusFilter?: string;
  active?: boolean;
  icon?: ReactNode;
  accent?: AccentKey;
  typeFilter?: string | null;
}) {
  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (typeFilter) params.set('type', typeFilter);
  const query = params.toString();
  const href = query
    ? `/projects/${projectId}/work-review?${query}`
    : `/projects/${projectId}/work-review`;
  const accentConfig = accent ? ACCENT_STYLES[accent] : null;
  const textClass = accentConfig ? accentConfig.text : "text-muted-foreground";

  return (
    <Link href={href}>
      <Card
        className={cn(
          "p-4 cursor-pointer transition",
          active && accentConfig ? accentConfig.surface : undefined,
          !active && "hover:border-ring",
        )}
      >
        <div className="flex items-center gap-2">
          {icon && <span className={textClass}>{icon}</span>}
          <div>
            <div className={cn("text-2xl font-bold", textClass)}>{count}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

const OUTPUT_TYPES = [
  { value: 'finding', label: 'Findings' },
  { value: 'recommendation', label: 'Recommendations' },
  { value: 'insight', label: 'Insights' },
  { value: 'report_section', label: 'Report Sections' },
  { value: 'social_post', label: 'Social Posts' },
];

function OutputTypeFilterBar({
  projectId,
  activeType,
  statusFilter,
}: {
  projectId: string;
  activeType?: string | null;
  statusFilter?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <OutputTypeFilterPill
        label="All Types"
        projectId={projectId}
        statusFilter={statusFilter}
        active={!activeType}
      />
      {OUTPUT_TYPES.map((type) => (
        <OutputTypeFilterPill
          key={type.value}
          label={type.label}
          projectId={projectId}
          statusFilter={statusFilter}
          typeValue={type.value}
          active={activeType === type.value}
        />
      ))}
    </div>
  );
}

function OutputTypeFilterPill({
  label,
  projectId,
  statusFilter,
  typeValue,
  active,
}: {
  label: string;
  projectId: string;
  statusFilter?: string;
  typeValue?: string;
  active?: boolean;
}) {
  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (typeValue) params.set('type', typeValue);
  const query = params.toString();
  const href = query
    ? `/projects/${projectId}/work-review?${query}`
    : `/projects/${projectId}/work-review`;

  return (
    <Link href={href}>
      <div
        className={cn(
          'rounded-full border px-4 py-2 text-sm transition',
          active ? 'border-ring bg-surface-primary/20 text-foreground' : 'text-muted-foreground hover:border-ring'
        )}
      >
        {label}
      </div>
    </Link>
  );
}
