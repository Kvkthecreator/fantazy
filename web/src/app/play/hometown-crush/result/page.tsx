"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Share2, RefreshCw, Check } from "lucide-react";
import type { RomanticTrope, RomanticTropeResult } from "@/types";
import { TROPE_VISUALS } from "@/types";

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

    const shareUrl = `${window.location.origin}/play`;
    const shareText = result.evaluation.share_text ||
      `I'm a ${result.evaluation.title} — ${result.evaluation.tagline}. what's yours?`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `I'm a ${result.evaluation.title}!`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">reading you for filth...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || "Something went wrong"}</p>
          <Button onClick={handlePlayAgain} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const trope = result.evaluation.trope;
  const visuals = TROPE_VISUALS[trope] || TROPE_VISUALS.slow_burn;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-500/5 to-pink-500/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center min-h-screen px-4 py-8">
        {/* Result Card */}
        <Card className="w-full max-w-md p-6 shadow-xl">
          {/* Emoji */}
          <div className="text-6xl text-center mb-3">{visuals.emoji}</div>

          {/* Title */}
          <h1 className={cn("text-3xl font-black text-center mb-2 tracking-tight", visuals.color)}>
            {result.evaluation.title}
          </h1>

          {/* Tagline */}
          <p className="text-center text-muted-foreground text-sm mb-6">
            {result.evaluation.tagline}
          </p>

          {/* Description - The main viral text */}
          <div className="mb-6 text-sm leading-relaxed text-center">
            {result.evaluation.description}
          </div>

          {/* Callback Quote */}
          {result.evaluation.callback_quote && (
            <div className="mb-6 p-4 bg-muted/50 rounded-xl">
              <p className="text-sm italic text-center">
                {result.evaluation.callback_quote}
              </p>
            </div>
          )}

          {/* Your People */}
          {result.evaluation.your_people && result.evaluation.your_people.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 text-center uppercase tracking-wider">
                your people
              </p>
              <p className="text-sm text-center text-muted-foreground">
                {result.evaluation.your_people.join(" • ")}
              </p>
            </div>
          )}

          {/* Match bar (subtle) */}
          <div className="pt-4 border-t">
            <div className="flex justify-between text-xs text-muted-foreground/60 mb-1">
              <span>match</span>
              <span>{Math.round(result.evaluation.confidence * 100)}%</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", visuals.color.replace("text-", "bg-"))}
                style={{ width: `${result.evaluation.confidence * 100}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Primary CTA - Share */}
        <div className="mt-6 w-full max-w-md">
          <Button
            onClick={handleShare}
            size="lg"
            className="w-full py-6 text-lg font-semibold rounded-full"
          >
            {copied ? (
              <>
                <Check className="h-5 w-5 mr-2" />
                copied!
              </>
            ) : (
              <>
                <Share2 className="h-5 w-5 mr-2" />
                share result
              </>
            )}
          </Button>
        </div>

        {/* Secondary: Play Again */}
        <div className="mt-4 w-full max-w-md">
          <Button
            onClick={handlePlayAgain}
            variant="outline"
            className="w-full py-3 rounded-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            try again
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-muted-foreground/60 text-xs">
          <a href="/play" className="hover:text-foreground transition-colors">
            ep-0.com/play
          </a>
        </div>
      </div>
    </div>
  );
}

export default function HometownCrushResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">reading you for filth...</p>
        </div>
      </div>
    }>
      <HometownCrushResultContent />
    </Suspense>
  );
}
