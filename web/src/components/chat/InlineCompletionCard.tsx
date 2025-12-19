"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { StreamEpisodeCompleteEvent, FlirtArchetypeEvaluation } from "@/types";

interface InlineCompletionCardProps {
  evaluation: StreamEpisodeCompleteEvent["evaluation"];
  nextSuggestion: StreamEpisodeCompleteEvent["next_suggestion"];
  characterId: string;
  characterName: string;
  hasBackground?: boolean;
  onDismiss?: () => void;
}

/**
 * Inline completion card - renders in chat flow when episode completes.
 * Replaces EpisodeCompleteModal for a less intrusive experience.
 */
export function InlineCompletionCard({
  evaluation,
  nextSuggestion,
  characterId,
  characterName,
  hasBackground = false,
  onDismiss,
}: InlineCompletionCardProps) {
  const router = useRouter();

  // Parse evaluation result based on type
  const isFlirtArchetype = evaluation?.evaluation_type === "flirt_archetype";
  const flirtResult = isFlirtArchetype
    ? (evaluation?.result as FlirtArchetypeEvaluation)
    : null;

  const handleContinue = () => {
    if (nextSuggestion) {
      router.push(`/chat/${characterId}?episode=${nextSuggestion.episode_id}`);
    }
  };

  const handleShare = async () => {
    if (evaluation?.share_id) {
      const shareUrl = `${window.location.origin}/r/${evaluation.share_id}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        // Could add toast notification here
      } catch (err) {
        console.error("Failed to copy share URL:", err);
      }
    }
  };

  return (
    <div className="flex justify-center my-6 px-4">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl overflow-hidden",
          "border shadow-lg",
          hasBackground
            ? "bg-black/60 backdrop-blur-xl border-white/20"
            : "bg-card border-border"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "px-5 py-4 border-b flex items-center gap-3",
            hasBackground ? "border-white/10" : "border-border"
          )}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              hasBackground
                ? "bg-gradient-to-br from-amber-400/30 to-pink-500/30"
                : "bg-gradient-to-br from-amber-400/20 to-pink-500/20"
            )}
          >
            <SparklesIcon
              className={cn(
                "h-5 w-5",
                hasBackground ? "text-amber-300" : "text-amber-500"
              )}
            />
          </div>
          <div>
            <h3
              className={cn(
                "font-semibold text-sm",
                hasBackground && "text-white"
              )}
            >
              Episode Complete
            </h3>
            {flirtResult && (
              <p
                className={cn(
                  "text-xs",
                  hasBackground ? "text-white/70" : "text-muted-foreground"
                )}
              >
                Your result is in
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          {flirtResult ? (
            <div className="space-y-4">
              {/* Archetype title */}
              <div className="text-center">
                <p
                  className={cn(
                    "text-xs uppercase tracking-wider mb-1",
                    hasBackground ? "text-white/50" : "text-muted-foreground"
                  )}
                >
                  Your Flirt Style
                </p>
                <h4
                  className={cn(
                    "text-xl font-bold",
                    hasBackground
                      ? "text-white"
                      : "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500"
                  )}
                >
                  {flirtResult.title}
                </h4>
              </div>

              {/* Description */}
              <p
                className={cn(
                  "text-sm text-center leading-relaxed",
                  hasBackground ? "text-white/80" : "text-muted-foreground"
                )}
              >
                {flirtResult.description}
              </p>

              {/* Confidence bar */}
              <div className="flex items-center justify-center gap-3">
                <span
                  className={cn(
                    "text-xs",
                    hasBackground ? "text-white/50" : "text-muted-foreground"
                  )}
                >
                  Confidence
                </span>
                <div
                  className={cn(
                    "h-1.5 w-20 rounded-full overflow-hidden",
                    hasBackground ? "bg-white/20" : "bg-muted"
                  )}
                >
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-violet-500 rounded-full transition-all"
                    style={{ width: `${(flirtResult.confidence || 0) * 100}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    hasBackground ? "text-white/70" : "text-foreground"
                  )}
                >
                  {Math.round((flirtResult.confidence || 0) * 100)}%
                </span>
              </div>

              {/* Signals */}
              {flirtResult.primary_signals &&
                flirtResult.primary_signals.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {flirtResult.primary_signals.slice(0, 3).map((signal, i) => (
                      <span
                        key={i}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-full",
                          hasBackground
                            ? "bg-white/10 text-white/80"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {signal.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          ) : (
            <p
              className={cn(
                "text-sm text-center",
                hasBackground ? "text-white/80" : "text-muted-foreground"
              )}
            >
              You&apos;ve completed this episode with {characterName}.
            </p>
          )}
        </div>

        {/* Actions */}
        <div
          className={cn(
            "px-5 py-4 border-t flex flex-col gap-2",
            hasBackground ? "border-white/10" : "border-border"
          )}
        >
          {/* Primary CTA */}
          {nextSuggestion && (
            <Button
              onClick={handleContinue}
              className="w-full"
              size="sm"
            >
              Continue: {nextSuggestion.title}
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
          )}

          {/* Secondary actions */}
          <div className="flex gap-2">
            {evaluation?.share_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className={cn(
                  "flex-1",
                  hasBackground &&
                    "border-white/20 text-white hover:bg-white/10"
                )}
              >
                <ShareIcon className="mr-2 h-3.5 w-3.5" />
                Share
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className={cn(
                  "flex-1",
                  hasBackground && "text-white/70 hover:text-white hover:bg-white/10"
                )}
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Icons */
function SparklesIcon({ className }: { className?: string }) {
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
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
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

function ShareIcon({ className }: { className?: string }) {
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
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}
