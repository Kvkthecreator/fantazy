"use client";

import { useUsage } from "@/hooks/useUsage";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageMeterProps {
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export function UsageMeter({
  showLabel = true,
  compact = false,
  className,
}: UsageMeterProps) {
  const {
    fluxUsed,
    fluxQuota,
    fluxRemaining,
    fluxPercentage,
    fluxResetsAt,
    isLowFlux,
    isOutOfFlux,
    isLoading,
  } = useUsage();

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  // Format reset date
  const resetDateStr = fluxResetsAt
    ? fluxResetsAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <span
          className={cn(
            "font-medium",
            isOutOfFlux && "text-destructive",
            isLowFlux && !isOutOfFlux && "text-amber-500"
          )}
        >
          {fluxRemaining}
        </span>
        <span className="text-muted-foreground">/ {fluxQuota}</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Image generations</span>
          </div>
          <span
            className={cn(
              "tabular-nums",
              isOutOfFlux && "text-destructive font-medium",
              isLowFlux && !isOutOfFlux && "text-amber-500"
            )}
          >
            {fluxRemaining} remaining
          </span>
        </div>
      )}

      <Progress
        value={fluxPercentage}
        max={100}
        className={cn(
          isOutOfFlux && "[&>div]:bg-destructive",
          isLowFlux && !isOutOfFlux && "[&>div]:bg-amber-500"
        )}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {fluxUsed} of {fluxQuota} used
        </span>
        {resetDateStr && <span>Resets {resetDateStr}</span>}
      </div>

      {isOutOfFlux && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>No generations remaining this month</span>
        </div>
      )}
    </div>
  );
}
