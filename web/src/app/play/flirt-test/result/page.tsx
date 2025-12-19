"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlirtArchetype, FlirtArchetypeEvaluation } from "@/types";

// Archetype metadata for display
const ARCHETYPE_META: Record<FlirtArchetype, { emoji: string; color: string; gradient: string }> = {
  tension_builder: {
    emoji: "🔥",
    color: "text-orange-400",
    gradient: "from-orange-500/20 to-red-500/20",
  },
  bold_mover: {
    emoji: "💪",
    color: "text-rose-400",
    gradient: "from-rose-500/20 to-pink-500/20",
  },
  playful_tease: {
    emoji: "😏",
    color: "text-yellow-400",
    gradient: "from-yellow-500/20 to-orange-500/20",
  },
  slow_burn: {
    emoji: "🌙",
    color: "text-purple-400",
    gradient: "from-purple-500/20 to-indigo-500/20",
  },
  mysterious_allure: {
    emoji: "✨",
    color: "text-violet-400",
    gradient: "from-violet-500/20 to-purple-500/20",
  },
};

interface ResultData {
  evaluation: FlirtArchetypeEvaluation;
  shareUrl: string;
  characterName: string;
}

function FlirtTestResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [result, setResult] = useState<ResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/play/flirt-test");
      return;
    }

    const fetchResult = async () => {
      try {
        const response = await api.games.getResult("flirt-test", sessionId);
        setResult({
          evaluation: response.result as FlirtArchetypeEvaluation,
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
    const shareText = `I'm ${result.evaluation.title}! What's your flirt style? Take the test:`;

    // Try native share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Flirt Test Result",
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
    router.push("/play/flirt-test");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
          <p className="text-white/60">Analyzing your flirt style...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Something went wrong"}</p>
          <Button onClick={handlePlayAgain} variant="outline" className="text-white border-white/20">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const archetype = result.evaluation.archetype;
  const meta = ARCHETYPE_META[archetype] || ARCHETYPE_META.playful_tease;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Result Card */}
        <div className={cn(
          "w-full max-w-md p-8 rounded-3xl backdrop-blur-xl border border-white/10",
          "bg-gradient-to-br",
          meta.gradient
        )}>
          {/* Emoji */}
          <div className="text-6xl text-center mb-4">{meta.emoji}</div>

          {/* Title */}
          <h1 className={cn("text-3xl font-bold text-center mb-2", meta.color)}>
            {result.evaluation.title}
          </h1>

          {/* Archetype key */}
          <p className="text-center text-white/50 text-sm mb-6">
            {archetype.replace(/_/g, " ")}
          </p>

          {/* Description */}
          <p className="text-center text-white/80 leading-relaxed mb-6">
            {result.evaluation.description}
          </p>

          {/* Confidence indicator */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Match strength</span>
              <span>{Math.round(result.evaluation.confidence * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r", "from-rose-400 to-purple-400")}
                style={{ width: `${result.evaluation.confidence * 100}%` }}
              />
            </div>
          </div>

          {/* Primary signals */}
          {result.evaluation.primary_signals.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-white/50 mb-2">Key signals:</p>
              <div className="flex flex-wrap gap-2">
                {result.evaluation.primary_signals.map((signal, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 w-full max-w-md">
          <Button
            onClick={handleShare}
            size="lg"
            className={cn(
              "w-full py-6 text-lg font-semibold rounded-full",
              "bg-gradient-to-r from-rose-500 to-purple-500 hover:from-rose-400 hover:to-purple-400",
              "shadow-xl shadow-purple-500/20"
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
            className="text-rose-400 hover:text-rose-300 transition-colors font-medium"
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

export default function FlirtTestResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
          <p className="text-white/60">Loading result...</p>
        </div>
      </div>
    }>
      <FlirtTestResultContent />
    </Suspense>
  );
}
