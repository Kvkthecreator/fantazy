"use client";

import { cn } from "@/lib/utils";
import { Target, CheckCircle, XCircle } from "lucide-react";

export type ObjectiveStatus = "active" | "completed" | "failed";

interface ObjectiveCardProps {
  objective: string;
  hint?: string;
  status: ObjectiveStatus;
}

/**
 * ObjectiveCard - Displays user's objective for the current episode (ADR-008)
 *
 * Design philosophy:
 * - Clear visual hierarchy: status icon + objective + optional hint
 * - Game UI feel consistent with InstructionCard styling
 * - Status-based coloring: amber (active), green (completed), red (failed)
 * - Compact but readable - should feel like a mission briefing
 */
export function ObjectiveCard({ objective, hint, status }: ObjectiveCardProps) {
  return (
    <div className="my-6 w-full">
      <div className={cn(
        "relative overflow-hidden rounded-2xl shadow-2xl",
        "ring-1",
        status === "active" && "ring-amber-500/30 bg-gradient-to-br from-amber-950/80 via-black/80 to-amber-950/60",
        status === "completed" && "ring-green-500/30 bg-gradient-to-br from-green-950/80 via-black/80 to-green-950/60",
        status === "failed" && "ring-red-500/30 bg-gradient-to-br from-red-950/80 via-black/80 to-red-950/60",
      )}>
        {/* Decorative corner accents */}
        <div className={cn(
          "absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 rounded-tl-2xl",
          status === "active" && "border-amber-500/30",
          status === "completed" && "border-green-500/30",
          status === "failed" && "border-red-500/30",
        )} />
        <div className={cn(
          "absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 rounded-br-2xl",
          status === "active" && "border-amber-500/30",
          status === "completed" && "border-green-500/30",
          status === "failed" && "border-red-500/30",
        )} />

        {/* Content */}
        <div className="relative px-5 py-6">
          <div className="flex items-start gap-4">
            {/* Status icon */}
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border",
              status === "active" && "bg-amber-500/20 border-amber-500/30",
              status === "completed" && "bg-green-500/20 border-green-500/30",
              status === "failed" && "bg-red-500/20 border-red-500/30",
            )}>
              {status === "active" && <Target className="w-5 h-5 text-amber-400" />}
              {status === "completed" && <CheckCircle className="w-5 h-5 text-green-400" />}
              {status === "failed" && <XCircle className="w-5 h-5 text-red-400" />}
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              {/* Status label */}
              <p className={cn(
                "text-xs uppercase tracking-widest font-medium mb-1",
                status === "active" && "text-amber-500/70",
                status === "completed" && "text-green-500/70",
                status === "failed" && "text-red-500/70",
              )}>
                {status === "active" && "Your objective"}
                {status === "completed" && "Objective completed"}
                {status === "failed" && "Objective incomplete"}
              </p>

              {/* Main objective text */}
              <p className="text-sm font-medium text-white leading-relaxed">
                {objective}
              </p>

              {/* Hint (only shown when active) */}
              {hint && status === "active" && (
                <p className="text-xs text-white/50 mt-2 italic">
                  💡 {hint}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
