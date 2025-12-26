"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NextEpisodeSuggestion {
  episode_id: string;
  title: string;
  slug?: string;
  episode_number?: number;
  situation?: string;
  character_id?: string | null;
}

interface InlineSuggestionCardProps {
  suggestion: NextEpisodeSuggestion;
  characterId: string;
  characterName: string;
  hasBackground?: boolean;
  onDismiss?: () => void;
}

/**
 * Inline suggestion card - renders in chat flow to suggest next episode.
 * v2.6: Unified styling with EpisodeOpeningCard - left-aligned chat bubble aesthetic.
 * Blends into conversation flow while providing actionable next episode navigation.
 */
export function InlineSuggestionCard({
  suggestion,
  characterId,
  characterName,
  hasBackground = false,
  onDismiss,
}: InlineSuggestionCardProps) {
  const router = useRouter();

  const handleStart = () => {
    router.push(`/chat/${characterId}?episode=${suggestion.episode_id}`);
  };

  return (
    <div className="flex justify-start my-4">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          hasBackground
            ? "bg-black/40 backdrop-blur-sm"
            : "bg-muted"
        )}
      >
        {/* Label - matches EpisodeOpeningCard title style */}
        <p
          className={cn(
            "text-xs font-medium mb-1",
            hasBackground ? "text-white/60" : "text-muted-foreground"
          )}
        >
          Up next
        </p>

        {/* Episode title */}
        <p
          className={cn(
            "text-sm font-medium leading-relaxed",
            hasBackground ? "text-white/90" : "text-foreground"
          )}
        >
          {suggestion.title}
        </p>

        {/* Situation preview - optional */}
        {suggestion.situation && (
          <p
            className={cn(
              "text-xs mt-1 line-clamp-2 leading-relaxed",
              hasBackground ? "text-white/60" : "text-muted-foreground"
            )}
          >
            {suggestion.situation}
          </p>
        )}

        {/* Actions - compact inline buttons */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            onClick={handleStart}
            size="sm"
            className="h-7 px-3 text-xs"
          >
            Start
            <ArrowRightIcon className="ml-1.5 h-3 w-3" />
          </Button>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className={cn(
                "h-7 px-3 text-xs",
                hasBackground ? "text-white/60 hover:text-white hover:bg-white/10" : ""
              )}
            >
              Later
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Icons */
function ArrowRightIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
