"use client";

import { cn } from "@/lib/utils";

interface EpisodeOpeningCardProps {
  title: string;
  situation: string;
  characterName: string;
  hasBackground?: boolean;
}

/**
 * EpisodeOpeningCard - Scene-setting card at conversation start
 *
 * v2.6: Centered, prominent design with clean background styling
 * - Shows episode title and situation
 * - Centered for visibility, clean aesthetic
 */
export function EpisodeOpeningCard({
  title,
  situation,
  characterName,
  hasBackground = false,
}: EpisodeOpeningCardProps) {
  return (
    <div className="flex justify-center my-6">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl px-5 py-4 text-center",
          hasBackground
            ? "bg-black/40 backdrop-blur-sm"
            : "bg-muted"
        )}
      >
        {/* Episode title */}
        <p
          className={cn(
            "text-xs font-medium uppercase tracking-wide mb-2",
            hasBackground ? "text-white/50" : "text-muted-foreground"
          )}
        >
          {title}
        </p>

        {/* Situation - the main content */}
        <p
          className={cn(
            "text-sm leading-relaxed",
            hasBackground ? "text-white/90" : "text-foreground"
          )}
        >
          {situation}
        </p>
      </div>
    </div>
  );
}
