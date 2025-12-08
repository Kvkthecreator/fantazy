export type TimelineEventKind =
  | 'capture'
  | 'proposal'
  | 'proposal_resolved'
  | 'document'
  | 'document_deleted'
  | 'insight'
  | 'block'
  | 'automation'
  | 'system';

export type TimelineEventSignificance = 'high' | 'medium' | 'low';

export interface TimelineEventDTO {
  id: string;
  kind: TimelineEventKind;
  title: string;
  description?: string;
  timestamp: string;
  significance: TimelineEventSignificance;
  host?: string | null;
  tags?: { label: string; tone?: 'info' | 'warn' | 'danger' }[];
  linkHref?: string;
  linkLabel?: string;
}
