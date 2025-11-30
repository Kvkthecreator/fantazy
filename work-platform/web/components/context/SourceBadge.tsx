"use client";

import { Badge } from "@/components/ui/Badge";
import { Bot, User, Cog } from "lucide-react";
import type { SubstrateSource } from "@/lib/types/substrate";
import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  source: SubstrateSource;
  agentType?: string;
  className?: string;
  showLabel?: boolean;
}

const AGENT_TYPE_LABELS: Record<string, string> = {
  research: "Research",
  content: "Content",
  reporting: "Reporting",
};

/**
 * Badge indicating the source of a substrate item (user, agent, or system).
 */
export function SourceBadge({
  source,
  agentType,
  className,
  showLabel = true,
}: SourceBadgeProps) {
  if (source === "agent") {
    const label = agentType
      ? AGENT_TYPE_LABELS[agentType] || agentType
      : "Agent";

    return (
      <Badge
        variant="secondary"
        className={cn("text-xs gap-1", className)}
      >
        <Bot className="h-3 w-3" />
        {showLabel && label}
      </Badge>
    );
  }

  if (source === "user") {
    return (
      <Badge
        variant="outline"
        className={cn("text-xs gap-1", className)}
      >
        <User className="h-3 w-3" />
        {showLabel && "User"}
      </Badge>
    );
  }

  // System source
  return (
    <Badge
      variant="outline"
      className={cn("text-xs gap-1 text-muted-foreground", className)}
    >
      <Cog className="h-3 w-3" />
      {showLabel && "System"}
    </Badge>
  );
}

/**
 * Compact version showing only icon, with tooltip for label.
 */
export function SourceIcon({
  source,
  agentType,
  className,
}: Omit<SourceBadgeProps, "showLabel">) {
  const Icon = source === "agent" ? Bot : source === "user" ? User : Cog;
  const title =
    source === "agent"
      ? agentType
        ? AGENT_TYPE_LABELS[agentType] || agentType
        : "Agent"
      : source === "user"
      ? "User"
      : "System";

  return (
    <span title={title} className={cn("inline-flex", className)}>
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          source === "agent"
            ? "text-primary"
            : source === "user"
            ? "text-muted-foreground"
            : "text-muted-foreground/50"
        )}
      />
    </span>
  );
}
