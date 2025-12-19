"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Character, EpisodeTemplate, StreamDirectorState } from "@/types";

interface ChatHeaderProps {
  character: Character;
  episodeTemplate?: EpisodeTemplate | null;
  directorState?: StreamDirectorState | null;
  seriesProgress?: {
    current: number;
    total: number;
    episodes: Array<{
      id: string;
      title: string;
      episode_number: number;
      status: "not_started" | "in_progress" | "completed";
    }>;
  } | null;
  hasBackground?: boolean;
}

export function ChatHeader({
  character,
  episodeTemplate: _episodeTemplate,
  directorState,
  seriesProgress,
  hasBackground = false,
}: ChatHeaderProps) {
  // episodeTemplate reserved for future use (episode title display, etc.)
  void _episodeTemplate;
  const [showEpisodePicker, setShowEpisodePicker] = useState(false);
  const router = useRouter();

  // Format turn display
  const turnDisplay = directorState
    ? directorState.turns_remaining !== null
      ? `${directorState.turn_count}/${directorState.turn_count + directorState.turns_remaining}`
      : `${directorState.turn_count}`
    : null;

  // Is approaching completion?
  const isApproachingEnd =
    directorState?.turns_remaining !== null &&
    directorState?.turns_remaining !== undefined &&
    directorState.turns_remaining <= 2;

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3">
        {/* Left: Back + Avatar + Name */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                hasBackground && "text-white hover:bg-white/10"
              )}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
          </Link>

          <Link href={`/characters/${character.slug}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-medium shadow-sm overflow-hidden">
              {character.avatar_url ? (
                <img
                  src={character.avatar_url}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                character.name[0]
              )}
            </div>
          </Link>

          <h1
            className={cn(
              "font-semibold text-sm",
              hasBackground && "text-white"
            )}
          >
            {character.name}
          </h1>
        </div>

        {/* Right: Series Progress + Turn Counter */}
        <div className="flex items-center gap-2">
          {/* Series Progress (tappable for episode picker) */}
          {seriesProgress && seriesProgress.total > 1 && (
            <button
              onClick={() => setShowEpisodePicker(true)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors",
                hasBackground
                  ? "bg-white/10 text-white/90 hover:bg-white/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <span>Ep {seriesProgress.current}/{seriesProgress.total}</span>
              <ChevronDownIcon className="h-3 w-3 opacity-60" />
            </button>
          )}

          {/* Turn Counter */}
          {turnDisplay && (
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium",
                hasBackground
                  ? isApproachingEnd
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-white/10 text-white/90"
                  : isApproachingEnd
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-muted text-muted-foreground"
              )}
            >
              <TurnIcon className="h-3 w-3" />
              <span>Turn {turnDisplay}</span>
            </div>
          )}

        </div>
      </header>

      {/* Episode Picker Overlay */}
      {showEpisodePicker && seriesProgress && (
        <EpisodePickerOverlay
          characterId={character.id}
          episodes={seriesProgress.episodes}
          currentEpisodeIndex={seriesProgress.current - 1}
          hasBackground={hasBackground}
          onSelect={(episodeId) => {
            router.push(`/chat/${character.id}?episode=${episodeId}`);
            setShowEpisodePicker(false);
          }}
          onClose={() => setShowEpisodePicker(false)}
        />
      )}
    </>
  );
}

/* Episode Picker Overlay */
interface EpisodePickerOverlayProps {
  characterId: string;
  episodes: Array<{
    id: string;
    title: string;
    episode_number: number;
    status: "not_started" | "in_progress" | "completed";
  }>;
  currentEpisodeIndex: number;
  hasBackground: boolean;
  onSelect: (episodeId: string) => void;
  onClose: () => void;
}

function EpisodePickerOverlay({
  episodes,
  currentEpisodeIndex,
  hasBackground,
  onSelect,
  onClose,
}: EpisodePickerOverlayProps) {
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Picker - positioned top-right */}
      <div
        className={cn(
          "absolute top-16 right-4 w-72 rounded-2xl shadow-2xl overflow-hidden",
          hasBackground
            ? "bg-black/95 backdrop-blur-xl border border-white/20"
            : "bg-card border border-border"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b",
            hasBackground ? "border-white/10" : "border-border"
          )}
        >
          <h3
            className={cn(
              "font-semibold text-sm",
              hasBackground && "text-white"
            )}
          >
            Episodes
          </h3>
          <button
            onClick={onClose}
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
        <div className="max-h-[50vh] overflow-y-auto p-2 space-y-1">
          {episodes.map((episode, index) => {
            const isCurrent = index === currentEpisodeIndex;

            return (
              <button
                key={episode.id}
                onClick={() => onSelect(episode.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl transition-all flex items-center gap-3",
                  hasBackground
                    ? isCurrent
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:bg-white/10"
                    : isCurrent
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted"
                )}
              >
                {/* Status indicator */}
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                    episode.status === "completed"
                      ? "bg-green-500/20 text-green-500"
                      : episode.status === "in_progress"
                        ? "bg-amber-500/20 text-amber-500"
                        : hasBackground
                          ? "bg-white/10 text-white/60"
                          : "bg-muted text-muted-foreground"
                  )}
                >
                  {episode.status === "completed" ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : episode.status === "in_progress" ? (
                    <PlayIcon className="h-3 w-3" />
                  ) : (
                    <span>{episode.episode_number + 1}</span>
                  )}
                </div>

                {/* Episode info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-medium text-sm truncate",
                        hasBackground && "text-white"
                      )}
                    >
                      {episode.title}
                    </span>
                    {isCurrent && (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0",
                          hasBackground
                            ? "bg-white/20 text-white"
                            : "bg-primary/20 text-primary"
                        )}
                      >
                        Now
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Icons */
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TurnIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}


function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
