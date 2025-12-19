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
  variant?: "default" | "compact";
  onDismiss?: () => void;
}

/**
 * Inline suggestion card - renders in chat flow to suggest next episode.
 * Used for both post-completion suggestions and natural pause suggestions.
 */
export function InlineSuggestionCard({
  suggestion,
  characterId,
  characterName,
  hasBackground = false,
  variant = "default",
  onDismiss,
}: InlineSuggestionCardProps) {
  const router = useRouter();

  const handleStart = () => {
    router.push(`/chat/${characterId}?episode=${suggestion.episode_id}`);
  };

  if (variant === "compact") {
    return (
      <div className="flex justify-center my-4 px-4">
        <div
          className={cn(
            "w-full max-w-md rounded-xl px-4 py-3",
            "border",
            hasBackground
              ? "bg-black/40 backdrop-blur-xl border-white/10"
              : "bg-muted/50 border-border"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <PlayCircleIcon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  hasBackground ? "text-white/60" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-sm truncate",
                  hasBackground ? "text-white/80" : "text-foreground"
                )}
              >
                Continue: <span className="font-medium">{suggestion.title}</span>
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleStart}
              className={cn(
                "flex-shrink-0 h-7 px-3",
                hasBackground && "text-white hover:bg-white/10"
              )}
            >
              Start
              <ArrowRightIcon className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center my-6 px-4">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl overflow-hidden",
          "border shadow-md",
          hasBackground
            ? "bg-black/50 backdrop-blur-xl border-white/15"
            : "bg-card border-border"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "px-4 py-3 border-b flex items-center gap-3",
            hasBackground ? "border-white/10" : "border-border"
          )}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              hasBackground ? "bg-white/10" : "bg-primary/10"
            )}
          >
            <BookOpenIcon
              className={cn(
                "h-4 w-4",
                hasBackground ? "text-white/80" : "text-primary"
              )}
            />
          </div>
          <div>
            <h3
              className={cn(
                "font-medium text-sm",
                hasBackground && "text-white"
              )}
            >
              Continue the story
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <div className="flex items-start gap-3">
            {/* Episode number badge */}
            {suggestion.episode_number !== undefined && (
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                  hasBackground
                    ? "bg-white/10 text-white/80"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {suggestion.episode_number + 1}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h4
                className={cn(
                  "font-semibold text-sm mb-1",
                  hasBackground && "text-white"
                )}
              >
                {suggestion.title}
              </h4>
              {suggestion.situation && (
                <p
                  className={cn(
                    "text-xs line-clamp-2 leading-relaxed",
                    hasBackground ? "text-white/60" : "text-muted-foreground"
                  )}
                >
                  {suggestion.situation}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className={cn(
            "px-4 py-3 border-t flex gap-2",
            hasBackground ? "border-white/10" : "border-border"
          )}
        >
          <Button
            onClick={handleStart}
            size="sm"
            className="flex-1"
          >
            Start Episode
            <ArrowRightIcon className="ml-2 h-3.5 w-3.5" />
          </Button>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className={cn(
                hasBackground && "text-white/70 hover:text-white hover:bg-white/10"
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
function PlayCircleIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
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
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

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
