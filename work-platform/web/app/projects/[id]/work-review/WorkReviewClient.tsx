"use client";

/**
 * WorkReviewClient - Client component for work output supervision
 *
 * Handles:
 * - Approve/reject/revision actions
 * - Manual promotion triggers
 * - Real-time status updates
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Upload,
  SkipForward,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  Target,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithToken } from "@/lib/api/http";

interface WorkOutput {
  id: string;
  output_type: string;
  agent_type: string;
  title: string;
  body: any;
  confidence: number;
  supervision_status: string;
  substrate_proposal_id?: string;
  promotion_method?: string;
  created_at: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  work_tickets?: {
    id: string;
    status: string;
    metadata: any;
  };
}

interface SupervisionSettings {
  promotion_mode: string;
  auto_promote_types: string[];
}

interface Props {
  initialOutputs: WorkOutput[];
  basketId: string;
  projectId: string;
  supervisionSettings: SupervisionSettings;
}

const OUTPUT_TYPE_ICONS: Record<string, React.ReactNode> = {
  finding: <Target className="h-4 w-4" />,
  recommendation: <Lightbulb className="h-4 w-4" />,
  insight: <BookOpen className="h-4 w-4" />,
  report_section: <FileText className="h-4 w-4" />,
  social_post: <MessageSquare className="h-4 w-4" />,
};

const STATUS_BADGES: Record<string, { variant: "default" | "success" | "destructive" | "warning" | "secondary"; label: string }> = {
  pending_review: { variant: "warning", label: "Pending Review" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
  revision_requested: { variant: "secondary", label: "Revision Requested" },
};

export function WorkReviewClient({
  initialOutputs,
  basketId,
  projectId,
  supervisionSettings,
}: Props) {
  const router = useRouter();
  const [outputs, setOutputs] = useState<WorkOutput[]>(initialOutputs);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"reject" | "revision" | null>(null);
  const [dialogOutputId, setDialogOutputId] = useState<string | null>(null);
  const [dialogNotes, setDialogNotes] = useState("");

  const handleAction = useCallback(
    async (outputId: string, action: "approve" | "reject" | "revision" | "promote" | "skip") => {
      if (action === "reject" || action === "revision") {
        setDialogAction(action);
        setDialogOutputId(outputId);
        setDialogNotes("");
        setDialogOpen(true);
        return;
      }

      setActionLoading(outputId);

      try {
        const baseUrl = process.env.NEXT_PUBLIC_WORK_PLATFORM_API_URL || "";
        let endpoint = "";
        let body: any = {};

        switch (action) {
          case "approve":
            endpoint = `${baseUrl}/api/supervision/baskets/${basketId}/outputs/${outputId}/approve`;
            body = { notes: null };
            break;
          case "promote":
            endpoint = `${baseUrl}/api/supervision/baskets/${basketId}/outputs/${outputId}/promote`;
            body = {};
            break;
          case "skip":
            endpoint = `${baseUrl}/api/supervision/baskets/${basketId}/outputs/${outputId}/skip-promotion`;
            body = { reason: "User chose to skip promotion" };
            break;
        }

        const response = await fetchWithToken(endpoint, {
          method: "POST",
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Action failed");
        }

        // Refresh data
        router.refresh();
      } catch (error) {
        console.error(`[WorkReview] Action ${action} failed:`, error);
        alert(`Failed to ${action}: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setActionLoading(null);
      }
    },
    [basketId, router]
  );

  const handleDialogConfirm = useCallback(async () => {
    if (!dialogOutputId || !dialogAction) return;

    setActionLoading(dialogOutputId);
    setDialogOpen(false);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_WORK_PLATFORM_API_URL || "";
      let endpoint = "";
      let body: any = {};

      if (dialogAction === "reject") {
        endpoint = `${baseUrl}/api/supervision/baskets/${basketId}/outputs/${dialogOutputId}/reject`;
        body = { notes: dialogNotes };
      } else if (dialogAction === "revision") {
        endpoint = `${baseUrl}/api/supervision/baskets/${basketId}/outputs/${dialogOutputId}/request-revision`;
        body = { feedback: dialogNotes };
      }

      const response = await fetchWithToken(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Action failed");
      }

      router.refresh();
    } catch (error) {
      console.error(`[WorkReview] ${dialogAction} failed:`, error);
      alert(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
      setDialogAction(null);
      setDialogOutputId(null);
      setDialogNotes("");
    }
  }, [basketId, dialogAction, dialogOutputId, dialogNotes, router]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {outputs.map((output) => {
        const isExpanded = expandedId === output.id;
        const statusBadge = STATUS_BADGES[output.supervision_status] || STATUS_BADGES.pending_review;
        const isPromoted = !!output.substrate_proposal_id || output.promotion_method === "skipped";
        const canPromote = output.supervision_status === "approved" && !isPromoted;
        const canSkip = output.supervision_status === "approved" && !isPromoted;
        const isPendingReview = output.supervision_status === "pending_review";

        return (
          <Card key={output.id} className="overflow-hidden">
            {/* Header Row */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
              onClick={() => toggleExpand(output.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {OUTPUT_TYPE_ICONS[output.output_type] || <FileText className="h-4 w-4" />}
                </span>
                <div>
                  <h3 className="font-medium text-foreground">{output.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground capitalize">
                      {output.output_type.replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {output.agent_type} agent
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(output.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                {isPromoted && (
                  <Badge variant="outline" className="text-xs">
                    {output.promotion_method === "skipped" ? "Skipped" : "Promoted"}
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t p-4 space-y-4">
                {/* Body Preview */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Content</h4>
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {typeof output.body === "string"
                      ? output.body
                      : output.body?.summary || output.body?.content || JSON.stringify(output.body, null, 2)}
                  </div>
                </div>

                {/* Reviewer Notes (if any) */}
                {output.reviewer_notes && (
                  <div className="bg-surface-warning/30 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-warning-foreground mb-2">Reviewer Notes</h4>
                    <p className="text-sm text-foreground">{output.reviewer_notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(output.created_at).toLocaleDateString()}
                    {output.reviewed_at && (
                      <> • Reviewed {new Date(output.reviewed_at).toLocaleDateString()}</>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isPendingReview && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(output.id, "revision");
                          }}
                          disabled={!!actionLoading}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Request Revision
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(output.id, "reject");
                          }}
                          disabled={!!actionLoading}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="bg-success text-success-foreground hover:bg-success/90"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(output.id, "approve");
                          }}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === output.id ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Approve
                        </Button>
                      </>
                    )}

                    {canPromote && supervisionSettings.promotion_mode === "manual" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(output.id, "skip");
                          }}
                          disabled={!!actionLoading}
                        >
                          <SkipForward className="h-4 w-4 mr-1" />
                          Skip Promotion
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(output.id, "promote");
                          }}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === output.id ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-1" />
                          )}
                          Promote to Substrate
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* Reject/Revision Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogAction === "reject" ? "Reject Output" : "Request Revision"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === "reject"
                ? "Please provide a reason for rejecting this output."
                : "Please provide feedback for the revision request."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={
              dialogAction === "reject"
                ? "Reason for rejection..."
                : "What should be revised..."
            }
            value={dialogNotes}
            onChange={(e) => setDialogNotes(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDialogConfirm}
              disabled={!dialogNotes.trim()}
              className={cn(
                dialogAction === "reject" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {dialogAction === "reject" ? "Reject" : "Request Revision"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
