"use client";

import { cn } from "@/lib/utils";
import { EpisodeDiscoveryCard } from "./EpisodeDiscoveryCard";
import type { EpisodeDiscoveryItem } from "@/types";

interface EpisodeGridProps {
  episodes: EpisodeDiscoveryItem[];
  className?: string;
}

/**
 * Grid layout for episode discovery cards.
 */
export function EpisodeGrid({ episodes, className }: EpisodeGridProps) {
  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">No episodes available</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
      className
    )}>
      {episodes.map((episode) => (
        <EpisodeDiscoveryCard key={episode.id} episode={episode} />
      ))}
    </div>
  );
}
