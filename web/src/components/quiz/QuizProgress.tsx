"use client";

import { cn } from "@/lib/utils";

interface QuizProgressProps {
  current: number;
  total: number;
}

export function QuizProgress({ current, total }: QuizProgressProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 flex-1 rounded-full transition-all duration-300",
            i < current
              ? "bg-primary"
              : i === current
              ? "bg-primary/50"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
