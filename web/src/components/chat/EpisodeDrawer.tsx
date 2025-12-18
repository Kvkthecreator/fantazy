"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Check, Star, Play } from "lucide-react";
import type { EpisodeDrawerItem } from "@/types";

export interface EpisodeProgress {
  episodeId: string;
  status: "not_started" | "in_progress" | "completed";
  lastPlayedAt?: string;
}

interface EpisodeDrawerProps {
  characterId: string;
  currentEpisodeId?: string;
  episodes: EpisodeDrawerItem[];
  progress?: EpisodeProgress[];
  suggestedNextId?: string;
  hasBackground?: boolean;
  onSelectEpisode?: (episodeId: string) => void;
}

export function EpisodeDrawer({
  characterId,
  currentEpisodeId,
  episodes,
  progress = [],
  suggestedNextId,
  hasBackground = false,
  onSelectEpisode,
}: EpisodeDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  // Find current episode index
  const currentIndex = episodes.findIndex((ep) => ep.id === currentEpisodeId);
  const totalEpisodes = episodes.length;

  // Get progress status for an episode
  const getProgress = (episodeId: string): EpisodeProgress["status"] => {
    const p = progress.find((p) => p.episodeId === episodeId);
    return p?.status ?? "not_started";
  };

  // Handle episode selection
  const handleSelect = (episode: EpisodeDrawerItem) => {
    if (onSelectEpisode) {
      onSelectEpisode(episode.id);
    } else {
      // Navigate to episode
      router.push(`/chat/${characterId}?episode=${episode.id}`);
    }
    setIsExpanded(false);
  };

  // Determine suggested next episode
  const suggestedEpisode = suggestedNextId
    ? episodes.find((ep) => ep.id === suggestedNextId)
    : currentIndex < totalEpisodes - 1
      ? episodes[currentIndex + 1]
      : null;

  if (episodes.length === 0) return null;

  return (
    <div className={cn(
      "relative z-20",
      hasBackground ? "mx-3 mb-1" : ""
    )}>
      {/* Collapsed State - Minimal Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2 text-xs transition-all",
          hasBackground
            ? "rounded-xl backdrop-blur-xl backdrop-saturate-150 bg-black/20 text-white/80 hover:bg-black/30"
            : "border-t border-border bg-card text-muted-foreground hover:bg-muted/50"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">Episodes</span>
          {currentIndex >= 0 && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full",
              hasBackground ? "bg-white/10" : "bg-muted"
            )}>
              {currentIndex + 1} of {totalEpisodes}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {suggestedEpisode && !isExpanded && (
            <span className={cn(
              "text-[10px] hidden sm:inline",
              hasBackground ? "text-white/60" : "text-muted-foreground"
            )}>
              Next: {suggestedEpisode.title}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded State - Episode List */}
      {isExpanded && (
        <div className={cn(
          "absolute bottom-full left-0 right-0 mb-1 max-h-[60vh] overflow-y-auto",
          "rounded-xl shadow-xl border",
          hasBackground
            ? "backdrop-blur-xl backdrop-saturate-150 bg-black/80 border-white/10"
            : "bg-card border-border"
        )}>
          {/* Header */}
          <div className={cn(
            "sticky top-0 flex items-center justify-between px-4 py-3 border-b",
            hasBackground
              ? "bg-black/60 border-white/10"
              : "bg-card border-border"
          )}>
            <h3 className={cn(
              "font-semibold text-sm",
              hasBackground && "text-white"
            )}>
              Episodes
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className={cn(
                "text-xs px-2 py-1 rounded-md transition-colors",
                hasBackground
                  ? "text-white/60 hover:text-white hover:bg-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Close
            </button>
          </div>

          {/* Episode List */}
          <div className="p-2 space-y-1">
            {episodes.map((episode, index) => {
              const status = getProgress(episode.id);
              const isCurrent = episode.id === currentEpisodeId;
              const isSuggested = episode.id === suggestedEpisode?.id;

              return (
                <button
                  key={episode.id}
                  onClick={() => handleSelect(episode)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-all",
                    hasBackground
                      ? isCurrent
                        ? "bg-white/20 text-white"
                        : isSuggested
                          ? "bg-primary/30 text-white hover:bg-primary/40"
                          : "text-white/80 hover:bg-white/10"
                      : isCurrent
                        ? "bg-primary/10 border border-primary/30"
                        : isSuggested
                          ? "bg-primary/5 border border-primary/20 hover:bg-primary/10"
                          : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className={cn(
                      "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs",
                      status === "completed"
                        ? "bg-green-500/20 text-green-500"
                        : status === "in_progress"
                          ? "bg-amber-500/20 text-amber-500"
                          : isSuggested
                            ? hasBackground
                              ? "bg-primary/40 text-white"
                              : "bg-primary/20 text-primary"
                            : hasBackground
                              ? "bg-white/10 text-white/60"
                              : "bg-muted text-muted-foreground"
                    )}>
                      {status === "completed" ? (
                        <Check className="h-3 w-3" />
                      ) : status === "in_progress" ? (
                        <Play className="h-3 w-3" />
                      ) : isSuggested ? (
                        <Star className="h-3 w-3" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>

                    {/* Episode Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium text-sm truncate",
                          hasBackground && "text-white"
                        )}>
                          {episode.title}
                        </span>
                        {isCurrent && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0",
                            hasBackground
                              ? "bg-white/20 text-white"
                              : "bg-primary/20 text-primary"
                          )}>
                            Current
                          </span>
                        )}
                        {isSuggested && !isCurrent && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0",
                            hasBackground
                              ? "bg-primary/40 text-white"
                              : "bg-primary/20 text-primary"
                          )}>
                            Suggested
                          </span>
                        )}
                      </div>
                      {episode.situation && (
                        <p className={cn(
                          "text-xs mt-0.5 line-clamp-2",
                          hasBackground ? "text-white/60" : "text-muted-foreground"
                        )}>
                          {episode.situation}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
