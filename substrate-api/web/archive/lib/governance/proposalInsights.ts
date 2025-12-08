interface ProposalOperation {
  type: string;
  data: Record<string, unknown>;
}

export type GovernanceStatus = 'low' | 'medium' | 'high';
export type GovernanceRecommendation = 'approve' | 'review' | 'investigate';

export interface ProposalInsightInput {
  id: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  auto_approved: boolean;
  ops_summary: string;
  impact_summary: string;
  created_at: string;
  executed_at: string | null;
  reviewed_at: string | null;
  review_notes: string;
  provenance: Array<string | Record<string, unknown>>;
  validator_report: {
    confidence: number;
    warnings: Array<string | Record<string, unknown>>;
    impact_summary?: string;
    suggested_merges?: Array<unknown>;
    ontology_hits?: Array<unknown>;
  };
  ops: ProposalOperation[];
}

export interface ProposalInsight {
  narrative: string;
  keyPoints: string[];
  riskLevel: GovernanceStatus;
  recommendation: GovernanceRecommendation;
  confidenceLabel: string;
  operationsSummary: string;
}

function describeOperations(ops: ProposalOperation[]): string {
  if (!Array.isArray(ops) || ops.length === 0) {
    return 'No block changes detected.';
  }

  const counts = ops.reduce<Record<string, number>>((acc, op) => {
    const key = op.type || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const friendlyNames: Record<string, string> = {
    CreateBlock: 'add block',
    ReviseBlock: 'update block',
    ArchiveBlock: 'archive block',
    CreateContextItem: 'add context item',
    MergeContextItems: 'merge context item',
    PromoteScope: 'promote scope',
    RedactDump: 'redact capture',
  };

  const segments = Object.entries(counts).map(([type, count]) => {
    const name = friendlyNames[type] || type.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    const pluralised = count === 1 ? name : `${name}s`;
    return `${count} ${pluralised}`;
  });

  if (segments.length === 1) {
    return `Performs ${segments[0]}.`;
  }
  if (segments.length === 2) {
    return `Performs ${segments[0]} and ${segments[1]}.`;
  }
  const last = segments.pop();
  return `Performs ${segments.join(', ')}, and ${last}.`;
}

function formatWarning(warning: string | Record<string, unknown>): string {
  if (typeof warning === 'string') return warning;
  try {
    return JSON.stringify(warning);
  } catch {
    return 'Validator emitted a warning.';
  }
}

function assessRisk(confidence: number, warnings: Array<unknown>): GovernanceStatus {
  if (warnings.length > 0) return 'high';
  if (confidence < 0.65) return 'medium';
  return 'low';
}

function confidenceDescriptor(confidence: number): string {
  if (confidence >= 0.85) return 'High confidence';
  if (confidence >= 0.7) return 'Moderate confidence';
  return 'Low confidence';
}

function recommendationFrom(risk: GovernanceStatus, status: ProposalInsightInput['status']): GovernanceRecommendation {
  if (status === 'REJECTED') return 'investigate';
  if (risk === 'high') return 'investigate';
  if (risk === 'medium') return 'review';
  return 'approve';
}

export function generateProposalInsight(proposal: ProposalInsightInput): ProposalInsight {
  const {
    status,
    auto_approved,
    ops_summary,
    impact_summary,
    provenance,
    validator_report,
    ops,
    review_notes,
  } = proposal;

  const confidence = typeof validator_report?.confidence === 'number' ? validator_report.confidence : 0.5;
  const warnings = Array.isArray(validator_report?.warnings) ? validator_report.warnings : [];
  const operationsNarrative = describeOperations(ops);
  const riskLevel = assessRisk(confidence, warnings);
  const recommendation = recommendationFrom(riskLevel, status);
  const confidenceLabel = confidenceDescriptor(confidence);

  const narrativeParts: string[] = [];

  switch (status) {
    case 'APPROVED':
      narrativeParts.push(auto_approved ? 'Automatically approved after validation.' : 'Approved by a reviewer.');
      break;
    case 'REJECTED':
      narrativeParts.push('Proposal was rejected; review notes explain the decision.');
      break;
    default:
      narrativeParts.push('Awaiting governance decision.');
  }

  narrativeParts.push(operationsNarrative);

  const validatorSummary = validator_report?.impact_summary || impact_summary || ops_summary;
  if (validatorSummary) {
    narrativeParts.push(`Validator summary: ${validatorSummary}`);
  }

  if (warnings.length > 0) {
    const warningPreview = warnings.slice(0, 2).map(formatWarning).join(' • ');
    narrativeParts.push(`Warnings detected: ${warningPreview}${warnings.length > 2 ? '…' : ''}`);
  }

  if (review_notes) {
    narrativeParts.push(`Reviewer noted: ${review_notes}`);
  }

  if (provenance.length === 0) {
    narrativeParts.push('No memory references linked to this proposal.');
  } else {
    narrativeParts.push(`Linked to ${provenance.length} reference${provenance.length === 1 ? '' : 's'} for traceability.`);
  }

  const keyPoints: string[] = [];
  keyPoints.push(`${confidenceLabel} (${Math.round(confidence * 100)}%)`);

  if (warnings.length > 0) {
    keyPoints.push(`${warnings.length} validator warning${warnings.length === 1 ? '' : 's'}`);
  }

  if (auto_approved) {
    keyPoints.push('Auto-approved per policy settings');
  } else if (status === 'PROPOSED') {
    keyPoints.push('Requires manual review');
  }

  if (review_notes) {
    keyPoints.push('Reviewer left notes for follow-up');
  }

  return {
    narrative: narrativeParts.join(' '),
    keyPoints,
    riskLevel,
    recommendation,
    confidenceLabel,
    operationsSummary: operationsNarrative,
  };
}
