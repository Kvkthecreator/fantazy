"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RomanticTrope, RomanticTropeResult, ROMANTIC_TROPES } from "@/types";

// Trope visual metadata for display
const TROPE_META: Record<RomanticTrope, { emoji: string; color: string; gradient: string }> = {
  slow_burn: {
    emoji: "🕯️",
    color: "text-amber-400",
    gradient: "from-amber-500/20 to-orange-500/20",
  },
  second_chance: {
    emoji: "🌅",
    color: "text-rose-400",
    gradient: "from-rose-500/20 to-pink-500/20",
  },
  all_in: {
    emoji: "💫",
    color: "text-yellow-400",
    gradient: "from-yellow-500/20 to-amber-500/20",
  },
  push_pull: {
    emoji: "⚡",
    color: "text-purple-400",
    gradient: "from-purple-500/20 to-indigo-500/20",
  },
  slow_reveal: {
    emoji: "🌙",
    color: "text-violet-400",
    gradient: "from-violet-500/20 to-purple-500/20",
  },
};

interface ResultData {
  evaluation: RomanticTropeResult;
  shareUrl: string;
  characterName: string;
}

function HometownCrushResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [result, setResult] = useState<ResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/play/hometown-crush");
      return;
    }

    const fetchResult = async () => {
      try {
        // Get anonymousId from session storage for anonymous users
        const storedState = sessionStorage.getItem(`hometown-crush-${sessionId}`);
        const anonymousId = storedState ? JSON.parse(storedState).anonymousId : undefined;

        const response = await api.games.getResult("hometown-crush", sessionId, anonymousId);
        setResult({
          evaluation: response.result as RomanticTropeResult,
          shareUrl: response.share_url,
          characterName: response.character_name,
        });
      } catch (err) {
        console.error("Failed to fetch result:", err);
        setError("Failed to load your result. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [sessionId, router]);

  const handleShare = async () => {
    if (!result) return;

    const shareUrl = `${window.location.origin}${result.shareUrl}`;
    const shareText = `I'm ${result.evaluation.title}! What's your romantic trope? Take the test:`;

    // Try native share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Hometown Crush Result",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall through to copy
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handlePlayAgain = () => {
    router.push("/play/hometown-crush");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-950 via-rose-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
          <p className="text-white/60">Discovering your romantic trope...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-950 via-rose-950 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Something went wrong"}</p>
          <Button onClick={handlePlayAgain} variant="outline" className="text-white border-white/20">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const trope = result.evaluation.trope;
  const meta = TROPE_META[trope] || TROPE_META.slow_burn;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 via-rose-950 to-slate-950 text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Result Card */}
        <div className={cn(
          "w-full max-w-md p-8 rounded-3xl backdrop-blur-xl border border-white/10",
          "bg-gradient-to-br",
          meta.gradient
        )}>
          {/* Header */}
          <p className="text-center text-white/50 text-xs uppercase tracking-wider mb-2">
            Your Romantic Trope
          </p>

          {/* Emoji */}
          <div className="text-6xl text-center mb-4">{meta.emoji}</div>

          {/* Title */}
          <h1 className={cn("text-3xl font-bold text-center mb-2", meta.color)}>
            {result.evaluation.title}
          </h1>

          {/* Tagline */}
          <p className="text-center text-white/70 italic mb-6">
            &ldquo;{result.evaluation.tagline}&rdquo;
          </p>

          {/* Description */}
          <p className="text-center text-white/80 leading-relaxed mb-6">
            {result.evaluation.description}
          </p>

          {/* Evidence - "Why This Fits You" */}
          {result.evaluation.evidence && result.evaluation.evidence.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-white/50 mb-3 uppercase tracking-wider">
                Based on your conversation with {result.characterName}
              </p>
              <ul className="space-y-2">
                {result.evaluation.evidence.map((observation, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="text-amber-400 mt-1">•</span>
                    <span>{observation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Callback quote - "Your Moment" */}
          {result.evaluation.callback_quote && (
            <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs text-white/50 mb-2 uppercase tracking-wider">
                Your Moment
              </p>
              <p className="text-sm text-white/90 italic">
                {result.evaluation.callback_quote}
              </p>
            </div>
          )}

          {/* Cultural references - "In The Wild" */}
          {result.evaluation.cultural_refs && result.evaluation.cultural_refs.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-white/50 mb-3 uppercase tracking-wider">
                {result.evaluation.title.replace("The ", "")} in the Wild
              </p>
              <div className="grid grid-cols-2 gap-2">
                {result.evaluation.cultural_refs.slice(0, 4).map((ref, i) => (
                  <div key={i} className="text-xs text-white/60">
                    <span className="text-white/80">{ref.title}</span>
                    <br />
                    <span className="text-white/40">({ref.characters})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence indicator */}
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Match strength</span>
              <span>{Math.round(result.evaluation.confidence * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r", "from-amber-400 to-rose-400")}
                style={{ width: `${result.evaluation.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 w-full max-w-md">
          <Button
            onClick={handleShare}
            size="lg"
            className={cn(
              "w-full py-6 text-lg font-semibold rounded-full",
              "bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400",
              "shadow-xl shadow-rose-500/20"
            )}
          >
            {copied ? "Copied!" : "Share Your Result"}
          </Button>

          <Button
            onClick={handlePlayAgain}
            variant="outline"
            size="lg"
            className="w-full py-6 text-lg font-semibold rounded-full border-white/20 text-white hover:bg-white/10"
          >
            Play Again
          </Button>
        </div>

        {/* CTA to main app */}
        <div className="mt-8 text-center">
          <p className="text-white/50 text-sm mb-2">
            Want more conversations with {result.characterName}?
          </p>
          <a
            href="/"
            className="text-amber-400 hover:text-amber-300 transition-colors font-medium"
          >
            Explore ep-0.com →
          </a>
        </div>

        {/* Footer */}
        <div className="mt-8 text-white/30 text-xs">
          <a href="/" className="hover:text-white/50 transition-colors">
            ep-0.com
          </a>
        </div>
      </div>
    </div>
  );
}

export default function HometownCrushResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-amber-950 via-rose-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
          <p className="text-white/60">Loading result...</p>
        </div>
      </div>
    }>
      <HometownCrushResultContent />
    </Suspense>
  );
}
