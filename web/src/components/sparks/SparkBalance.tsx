"use client";

import { Sparkles, Plus } from "lucide-react";
import { useSparks } from "@/hooks/useSparks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SparkBalanceProps {
  compact?: boolean;
  showBuyButton?: boolean;
  className?: string;
}

export function SparkBalance({
  compact = false,
  showBuyButton = true,
  className,
}: SparkBalanceProps) {
  const { sparkBalance, isLow, isEmpty, isLoading } = useSparks();

  if (isLoading) {
    return <div className="animate-pulse h-8 w-20 bg-muted rounded-full" />;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium",
          isEmpty
            ? "bg-red-500/10 text-red-500"
            : isLow
            ? "bg-amber-500/10 text-amber-500"
            : "bg-purple-500/10 text-purple-500",
          compact ? "text-sm" : "text-base"
        )}
      >
        <Sparkles className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <span className="font-semibold">{sparkBalance}</span>
        {!compact && (
          <span className="text-muted-foreground font-normal">Sparks</span>
        )}
      </div>

      {showBuyButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => (window.location.href = "/settings?tab=sparks")}
          title="Get more Sparks"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
