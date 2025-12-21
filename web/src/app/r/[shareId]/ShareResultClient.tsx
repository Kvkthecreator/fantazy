"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  FlirtArchetype,
  FlirtArchetypeEvaluation,
  RomanticTrope,
  RomanticTropeResult,
  SharedResultResponse,
} from "@/types";

// Flirt Archetype metadata for display
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

// Freak Level type
type FreakLevel = "vanilla" | "spicy" | "unhinged" | "feral" | "menace";

// Freak Level metadata for display
const FREAK_LEVEL_META: Record<FreakLevel, { emoji: string; color: string; gradient: string }> = {
  vanilla: {
    emoji: "🍦",
    color: "text-amber-100",
    gradient: "from-amber-500/20 to-yellow-500/20",
  },
  spicy: {
    emoji: "🌶️",
    color: "text-orange-400",
    gradient: "from-orange-500/20 to-red-500/20",
  },
  unhinged: {
    emoji: "🔥",
    color: "text-red-500",
    gradient: "from-red-500/20 to-rose-500/20",
  },
  feral: {
    emoji: "👹",
    color: "text-purple-500",
    gradient: "from-purple-500/20 to-violet-500/20",
  },
  menace: {
    emoji: "😈",
    color: "text-fuchsia-600",
    gradient: "from-fuchsia-500/20 to-pink-500/20",
  },
};

// Romantic Trope metadata for display
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

interface ShareResultClientProps {
  shareId: string;
}

export function ShareResultClient({ shareId }: ShareResultClientProps) {
  const router = useRouter();
  const [result, setResult] = useState<SharedResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await api.games.getSharedResult(shareId);
        setResult(response);
      } catch (err) {
        console.error("Failed to fetch shared result:", err);
        setError("This result couldn't be found.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [shareId]);

  const isRomanticTrope = result?.evaluation_type === "romantic_trope";
  const isFreakLevel = result?.evaluation_type === "freak_level";
  const testName = isFreakLevel ? "Freak Test" : isRomanticTrope ? "Romance Quiz" : "Flirt Test";
  const testUrl = isFreakLevel ? "/play/freak" : isRomanticTrope ? "/play/romance" : "/play";

  const handleTakeTest = () => {
    router.push(testUrl);
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const evaluation = result?.result as FlirtArchetypeEvaluation | RomanticTropeResult;
    const title = evaluation?.title || "a romantic type";
    const shareText = isRomanticTrope
      ? `I'm ${title}! What's your romantic trope? Take the test:`
      : `I'm ${title}! What's your flirt style? Take the test:`;

    // Try native share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${testName} Result`,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
          <p className="text-white/60">Loading result...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Result Not Found</h1>
          <p className="text-white/60 mb-6">{error}</p>
          <Button
            onClick={() => router.push("/play")}
            className={cn(
              "px-8 py-6 text-lg font-semibold rounded-full",
              "bg-gradient-to-r from-rose-500 to-purple-500 hover:from-rose-400 hover:to-purple-400"
            )}
          >
            Take a Test
          </Button>
        </div>
      </div>
    );
  }

  // Render based on evaluation type
  if (isRomanticTrope) {
    return <RomanticTropeResultCard result={result} onTakeTest={handleTakeTest} onShare={handleShare} copied={copied} />;
  }

  if (isFreakLevel) {
    return <FreakLevelResultCard result={result} onTakeTest={() => router.push("/play/freak")} onShare={handleShare} copied={copied} />;
  }

  return <FlirtArchetypeResultCard result={result} onTakeTest={handleTakeTest} onShare={handleShare} copied={copied} />;
}

// Component for Flirt Archetype results
function FlirtArchetypeResultCard({
  result,
  onTakeTest,
  onShare,
  copied,
}: {
  result: SharedResultResponse;
  onTakeTest: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  const evaluation = result.result as FlirtArchetypeEvaluation;
  const archetype = evaluation.archetype;
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
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-white/60 text-sm mb-1">Someone shared their result</p>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-purple-400 bg-clip-text text-transparent">
            Flirt Test
          </h1>
        </div>

        {/* Result Card */}
        <div className={cn(
          "w-full max-w-md p-8 rounded-3xl backdrop-blur-xl border border-white/10",
          "bg-gradient-to-br",
          meta.gradient
        )}>
          {/* Emoji */}
          <div className="text-6xl text-center mb-4">{meta.emoji}</div>

          {/* Title */}
          <h2 className={cn("text-3xl font-bold text-center mb-2", meta.color)}>
            {evaluation.title}
          </h2>

          {/* Archetype key */}
          <p className="text-center text-white/50 text-sm mb-6">
            {archetype.replace(/_/g, " ")}
          </p>

          {/* Description */}
          <p className="text-center text-white/80 leading-relaxed mb-6">
            {evaluation.description}
          </p>

          {/* Confidence indicator */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Match strength</span>
              <span>{Math.round(evaluation.confidence * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r", "from-rose-400 to-purple-400")}
                style={{ width: `${evaluation.confidence * 100}%` }}
              />
            </div>
          </div>

          {/* Primary signals */}
          {evaluation.primary_signals && evaluation.primary_signals.length > 0 && (
            <div>
              <p className="text-xs text-white/50 mb-2">Key signals:</p>
              <div className="flex flex-wrap gap-2">
                {evaluation.primary_signals.map((signal, i) => (
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

        {/* Share count */}
        {result.share_count > 0 && (
          <p className="mt-4 text-white/40 text-sm">
            Shared {result.share_count} {result.share_count === 1 ? "time" : "times"}
          </p>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 w-full max-w-md">
          <Button
            onClick={onTakeTest}
            size="lg"
            className={cn(
              "w-full py-6 text-lg font-semibold rounded-full",
              "bg-gradient-to-r from-rose-500 to-purple-500 hover:from-rose-400 hover:to-purple-400",
              "shadow-xl shadow-purple-500/20"
            )}
          >
            Take the Flirt Test
          </Button>

          <Button
            onClick={onShare}
            variant="outline"
            size="lg"
            className="w-full py-6 text-lg font-semibold rounded-full border-white/20 text-white hover:bg-white/10"
          >
            {copied ? "Copied!" : "Share This Result"}
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-white/40 hover:text-white/60 transition-colors text-sm"
          >
            ep-0.com — Interactive AI Episodes
          </a>
        </div>
      </div>
    </div>
  );
}

// Extended result type that includes quiz-specific fields
interface ExtendedRomanticTropeResult extends RomanticTropeResult {
  evidence?: string[];
  vibe_check?: string;
}

// Component for Romantic Trope results
function RomanticTropeResultCard({
  result,
  onTakeTest,
  onShare,
  copied,
}: {
  result: SharedResultResponse;
  onTakeTest: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  const evaluation = result.result as ExtendedRomanticTropeResult;
  const trope = evaluation.trope;
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
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-white/60 text-sm mb-1">Someone shared their result</p>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-rose-400 bg-clip-text text-transparent">
            Romance Quiz
          </h1>
        </div>

        {/* Result Card */}
        <div className={cn(
          "w-full max-w-md p-8 rounded-3xl backdrop-blur-xl border border-white/10",
          "bg-gradient-to-br",
          meta.gradient
        )}>
          {/* Header */}
          <p className="text-center text-white/50 text-xs uppercase tracking-wider mb-2">
            Their Romance Type
          </p>

          {/* Emoji */}
          <div className="text-6xl text-center mb-4">{meta.emoji}</div>

          {/* Title */}
          <h2 className={cn("text-3xl font-bold text-center mb-2", meta.color)}>
            {evaluation.title}
          </h2>

          {/* Tagline */}
          <p className="text-center text-white/70 italic mb-6">
            &ldquo;{evaluation.tagline}&rdquo;
          </p>

          {/* Vibe Check - The devastating one-liner */}
          {evaluation.vibe_check && (
            <div className="mb-6 p-4 bg-white/10 rounded-xl border border-white/10">
              <p className="text-sm font-medium italic text-center text-white/90">
                &ldquo;{evaluation.vibe_check}&rdquo;
              </p>
            </div>
          )}

          {/* Description */}
          <p className="text-center text-white/80 leading-relaxed mb-6">
            {evaluation.description}
          </p>

          {/* Evidence - LLM observations */}
          {evaluation.evidence && evaluation.evidence.length > 0 && (
            <div className="mb-6 p-4 bg-white/5 rounded-xl">
              <p className="text-xs text-white/50 mb-3 text-center uppercase tracking-wider">
                we noticed...
              </p>
              <ul className="space-y-2">
                {evaluation.evidence.map((item, i) => (
                  <li key={i} className="text-sm text-white/70 text-center">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Callback Quote (legacy) */}
          {evaluation.callback_quote && !evaluation.vibe_check && (
            <div className="mb-6 p-4 bg-white/10 rounded-xl">
              <p className="text-sm italic text-center text-white/80">
                {evaluation.callback_quote}
              </p>
            </div>
          )}

          {/* Your People */}
          {evaluation.your_people && evaluation.your_people.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-white/50 mb-2 text-center uppercase tracking-wider">
                your people
              </p>
              <p className="text-sm text-center text-white/70">
                {evaluation.your_people.join(" • ")}
              </p>
            </div>
          )}

          {/* Confidence indicator */}
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Match strength</span>
              <span>{Math.round(evaluation.confidence * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r", "from-amber-400 to-rose-400")}
                style={{ width: `${evaluation.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Share count */}
        {result.share_count > 0 && (
          <p className="mt-4 text-white/40 text-sm">
            Shared {result.share_count} {result.share_count === 1 ? "time" : "times"}
          </p>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 w-full max-w-md">
          <Button
            onClick={onTakeTest}
            size="lg"
            className={cn(
              "w-full py-6 text-lg font-semibold rounded-full",
              "bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400",
              "shadow-xl shadow-rose-500/20"
            )}
          >
            What&apos;s Your Romance Type?
          </Button>

          <Button
            onClick={onShare}
            variant="outline"
            size="lg"
            className="w-full py-6 text-lg font-semibold rounded-full border-white/20 text-white hover:bg-white/10"
          >
            {copied ? "Copied!" : "Share This Result"}
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-white/40 hover:text-white/60 transition-colors text-sm"
          >
            ep-0.com — Interactive AI Episodes
          </a>
        </div>
      </div>
    </div>
  );
}

// Extended result type for freak level
interface FreakLevelResult {
  level: FreakLevel;
  confidence: number;
  title: string;
  tagline: string;
  description: string;
  evidence?: string[];
  vibe_check?: string;
}

// Component for Freak Level results
function FreakLevelResultCard({
  result,
  onTakeTest,
  onShare,
  copied,
}: {
  result: SharedResultResponse;
  onTakeTest: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  const evaluation = result.result as FreakLevelResult;
  const level = evaluation.level;
  const meta = FREAK_LEVEL_META[level] || FREAK_LEVEL_META.spicy;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-fuchsia-950 to-slate-950 text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-white/60 text-sm mb-1">Someone shared their result</p>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-400 to-red-400 bg-clip-text text-transparent">
            Freak Test
          </h1>
        </div>

        {/* Result Card */}
        <div className={cn(
          "w-full max-w-md p-8 rounded-3xl backdrop-blur-xl border border-white/10",
          "bg-gradient-to-br",
          meta.gradient
        )}>
          {/* Header */}
          <p className="text-center text-white/50 text-xs uppercase tracking-wider mb-2">
            Their Freak Level
          </p>

          {/* Emoji */}
          <div className="text-6xl text-center mb-4">{meta.emoji}</div>

          {/* Title */}
          <h2 className={cn("text-3xl font-bold text-center mb-2", meta.color)}>
            {evaluation.title}
          </h2>

          {/* Tagline */}
          <p className="text-center text-white/70 italic mb-6">
            &ldquo;{evaluation.tagline}&rdquo;
          </p>

          {/* Vibe Check */}
          {evaluation.vibe_check && (
            <div className="mb-6 p-4 bg-white/10 rounded-xl border border-white/10">
              <p className="text-sm font-medium italic text-center text-white/90">
                &ldquo;{evaluation.vibe_check}&rdquo;
              </p>
            </div>
          )}

          {/* Description */}
          <p className="text-center text-white/80 leading-relaxed mb-6">
            {evaluation.description}
          </p>

          {/* Evidence */}
          {evaluation.evidence && evaluation.evidence.length > 0 && (
            <div className="mb-6 p-4 bg-white/5 rounded-xl">
              <p className="text-xs text-white/50 mb-3 text-center uppercase tracking-wider">
                we noticed...
              </p>
              <ul className="space-y-2">
                {evaluation.evidence.map((item, i) => (
                  <li key={i} className="text-sm text-white/70 text-center">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Confidence indicator */}
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Match strength</span>
              <span>{Math.round(evaluation.confidence * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r", "from-fuchsia-400 to-red-400")}
                style={{ width: `${evaluation.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Share count */}
        {result.share_count > 0 && (
          <p className="mt-4 text-white/40 text-sm">
            Shared {result.share_count} {result.share_count === 1 ? "time" : "times"}
          </p>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 w-full max-w-md">
          <Button
            onClick={onTakeTest}
            size="lg"
            className={cn(
              "w-full py-6 text-lg font-semibold rounded-full",
              "bg-gradient-to-r from-fuchsia-500 to-red-500 hover:from-fuchsia-400 hover:to-red-400",
              "shadow-xl shadow-fuchsia-500/20"
            )}
          >
            How Freaky Are You?
          </Button>

          <Button
            onClick={onShare}
            variant="outline"
            size="lg"
            className="w-full py-6 text-lg font-semibold rounded-full border-white/20 text-white hover:bg-white/10"
          >
            {copied ? "Copied!" : "Share This Result"}
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-white/40 hover:text-white/60 transition-colors text-sm"
          >
            ep-0.com — Interactive AI Episodes
          </a>
        </div>
      </div>
    </div>
  );
}
