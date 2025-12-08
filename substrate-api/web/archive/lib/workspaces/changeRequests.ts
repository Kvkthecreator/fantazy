import type { Database, Json } from '@/lib/dbTypes';

type MCPUnassignedRow = Database['public']['Tables']['mcp_unassigned_captures']['Row'];
type CaptureRow = Pick<
  MCPUnassignedRow,
  | 'id'
  | 'tool'
  | 'summary'
  | 'payload'
  | 'fingerprint'
  | 'candidates'
  | 'status'
  | 'assigned_basket_id'
  | 'created_at'
> &
  Partial<Pick<MCPUnassignedRow, 'source_host' | 'source_session'>>;

type ProposalState =
  | 'PROPOSED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'MERGED'
  | 'EXECUTED'
  | 'DRAFT'
  | (string & {});

interface ProposalRow {
  id: string;
  scope: 'basket' | 'workspace' | 'cross-basket' | null;
  status: ProposalState | null;
  proposal_kind: string;
  origin: 'agent' | 'human';
  basket_id: string | null;
  target_basket_id: string | null;
  affected_basket_ids: string[] | null;
  created_at: string | null;
  validator_report: Record<string, unknown> | null;
  ops: Array<{ type?: string; data?: Record<string, unknown> }> | null;
  review_notes: string | null;
  metadata: Record<string, unknown> | null;
  source_host: string | null;
  source_session: string | null;
}

export interface CandidateSuggestion {
  id?: string;
  name?: string;
  score?: number;
  [key: string]: unknown;
}

export interface AssignmentChangeRequest {
  type: 'assignment';
  id: string;
  tool: string;
  summary: string | null;
  payload: Record<string, unknown> | null;
  fingerprint: Record<string, unknown> | null;
  candidates: CandidateSuggestion[];
  status: 'pending' | 'assigned' | 'dismissed';
  assignedBasketId: string | null;
  createdAt: string | null;
  sourceHost?: string | null;
  sourceSession?: string | null;
}

export interface ProposalChangeRequest {
  type: 'proposal';
  id: string;
  scope: 'basket' | 'workspace' | 'cross-basket';
  status: ProposalState;
  proposalKind: string;
  origin: 'agent' | 'human';
  createdAt: string | null;
  basketId: string | null;
  targetBasketId: string | null;
  affectedBasketIds: string[];
  validatorReport: Record<string, unknown> | null;
  ops: Array<{ type?: string; data?: Record<string, unknown> }>;
  reviewNotes: string | null;
  metadata: Record<string, unknown> | null;
  sourceHost?: string | null;
  sourceSession?: string | null;
  autoApproved: boolean;
}

export interface WorkspaceChangeRequestsPayload {
  assignments: AssignmentChangeRequest[];
  proposals: ProposalChangeRequest[];
}

function asRecord(value: Json | null): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseCandidates(value: Json | null): CandidateSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((candidate) => candidate && typeof candidate === 'object') as CandidateSuggestion[];
}

function parseUuidArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function parseOps(
  value: ProposalRow['ops'],
): Array<{ type?: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((op) => {
    if (!op || typeof op !== 'object') {
      return {};
    }
    const data = 'data' in op && op.data && typeof op.data === 'object' ? (op.data as Record<string, unknown>) : undefined;
    return { type: op.type, data };
  });
}

export function mapAssignments(rows: CaptureRow[]): AssignmentChangeRequest[] {
  return rows.map((row) => ({
    type: 'assignment' as const,
    id: row.id,
    tool: row.tool,
    summary: row.summary,
    payload: asRecord(row.payload),
    fingerprint: asRecord(row.fingerprint),
    candidates: parseCandidates(row.candidates),
    status: (row.status as AssignmentChangeRequest['status']) ?? 'pending',
    assignedBasketId: row.assigned_basket_id,
    createdAt: row.created_at,
    sourceHost: row.source_host ?? null,
    sourceSession: row.source_session ?? null,
  }));
}

export function mapProposals(rows: ProposalRow[]): ProposalChangeRequest[] {
  return rows
    .filter((row) => row.id && row.status)
    .map((row) => {
      const status = (row.status ?? 'PROPOSED') as ProposalState;
      const reviewNotes = typeof row.review_notes === 'string' ? row.review_notes : null;
      const autoApproved =
        status === 'APPROVED' &&
        Boolean(reviewNotes?.toLowerCase().includes('auto-approved'));

      return {
        type: 'proposal' as const,
        id: row.id,
        scope: (row.scope ?? 'basket') as ProposalChangeRequest['scope'],
        status,
        proposalKind: row.proposal_kind,
        origin: row.origin,
        createdAt: row.created_at,
        basketId: row.basket_id,
        targetBasketId: row.target_basket_id,
        affectedBasketIds: parseUuidArray(row.affected_basket_ids),
        validatorReport: row.validator_report,
        ops: parseOps(row.ops),
        reviewNotes,
        metadata: row.metadata,
        sourceHost: row.source_host,
        sourceSession: row.source_session,
        autoApproved,
      };
    });
}

export function buildWorkspaceChangeRequests(
  captures: CaptureRow[] = [],
  proposals: ProposalRow[] = [],
): WorkspaceChangeRequestsPayload {
  return {
    assignments: mapAssignments(captures),
    proposals: mapProposals(proposals),
  };
}

export type { ProposalRow };
