"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TaskProgressList } from "@/components/TaskProgressList";

interface WorkTicketCardProps {
  ticket: {
    id: string;
    status: string;
    agent_type: string;
    created_at: string;
    completed_at?: string;
    metadata?: {
      task_description?: string;
      recipe_slug?: string;
      [key: string]: any;
    };
    work_outputs?: any[];
  };
  projectId: string;
}

export function WorkTicketCard({ ticket, projectId }: WorkTicketCardProps) {
  const outputCount = Array.isArray(ticket.work_outputs)
    ? ticket.work_outputs.length
    : 0;
  const taskDesc =
    ticket.metadata?.task_description ||
    ticket.metadata?.recipe_slug ||
    "Work Ticket";
  const isRunning = ticket.status === "running";

  return (
    <Link key={ticket.id} href={`/projects/${projectId}/outputs`}>
      <Card className="p-4 cursor-pointer transition hover:border-ring">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <Badge
                variant={getStatusVariant(ticket.status)}
                className="capitalize"
              >
                {ticket.status}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {ticket.agent_type}
              </Badge>
              {outputCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {outputCount} {outputCount === 1 ? "output" : "outputs"}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(ticket.created_at).toLocaleString()}
              </span>
            </div>
            <p className="text-foreground font-medium mb-2">{taskDesc}</p>

            {/* Real-time task progress (only for running tickets) */}
            {isRunning && (
              <div className="mt-3 pt-3 border-t border-border">
                <TaskProgressList workTicketId={ticket.id} enabled={isRunning} />
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "running":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}
