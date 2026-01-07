"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { Share2, Check, Quote, Sparkles, Play, MessageCircle, Lightbulb } from "lucide-react";
import type {
  FlirtArchetype,
  RomanticTrope,
  SharedResultResponse,
} from "@/types";

// Shared header component (matches PlayHeader from play pages)
function ShareHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/60 shadow-sm shrink-0 overflow-hidden p-1.5">
            <Logo variant="icon" size="full" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight text-foreground">
              episode-0
            </h1>
            <p className="text-xs text-muted-foreground">Your story awaits</p>
          </div>
        </Link>

        <Link
          href="/login?next=/discover"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

// Series type for featured series
interface Series {
  id: string;
  title: string;
  slug: string;
  tagline?: string;
  cover_image_url?: string;
}

// Freak Level type
type FreakLevel = "vanilla" | "spicy" | "unhinged" | "feral" | "menace";

// Freak Level metadata for display (light theme colors)
const FREAK_LEVEL_META: Record<FreakLevel, { emoji: string; color: string }> = {
  vanilla: { emoji: "🍦", color: "text-amber-600" },
  spicy: { emoji: "🌶️", color: "text-orange-500" },
  unhinged: { emoji: "🔥", color: "text-red-500" },
  feral: { emoji: "👹", color: "text-purple-600" },
  menace: { emoji: "😈", color: "text-fuchsia-600" },
};

// Romantic Trope metadata for display (light theme colors)
const TROPE_META: Record<RomanticTrope, { emoji: string; color: string }> = {
  slow_burn: { emoji: "🕯️", color: "text-amber-600" },
  second_chance: { emoji: "🌅", color: "text-rose-500" },
  all_in: { emoji: "💫", color: "text-yellow-600" },
  push_pull: { emoji: "⚡", color: "text-purple-600" },
  slow_reveal: { emoji: "🌙", color: "text-violet-600" },
};

// Flirt Archetype metadata for display (light theme colors)
const ARCHETYPE_META: Record<FlirtArchetype, { emoji: string; color: string }> = {
  tension_builder: { emoji: "🔥", color: "text-orange-500" },
  bold_mover: { emoji: "💪", color: "text-rose-500" },
  playful_tease: { emoji: "😏", color: "text-yellow-600" },
  slow_burn: { emoji: "🌙", color: "text-purple-600" },
  mysterious_allure: { emoji: "✨", color: "text-violet-600" },
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
  const [featuredSeries, setFeaturedSeries] = useState<Series[]>([]);

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

  // Fetch featured series
  useEffect(() => {
    async function fetchSeries() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "https://api.ep-0.com"}/series?featured=true&limit=2`
        );
        if (res.ok) {
          const data = await res.json();
          setFeaturedSeries(data);
        }
      } catch {
        // Ignore errors
      }
    }
    fetchSeries();
  }, []);

  const isRomanticTrope = result?.evaluation_type === "romantic_trope";
  const isFreakLevel = result?.evaluation_type === "freak_level";
  const testName = isFreakLevel ? "Unhinged Test" : isRomanticTrope ? "Dating Personality Test" : "Flirt Test";
  const testUrl = isFreakLevel ? "/play/freak" : isRomanticTrope ? "/play" : "/play";

  const handleTakeTest = () => {
    router.push(testUrl);
  };

  const handleShare = async () => {
    const shareUrl = `https://ep-0.com/r/${shareId}`;
    const evaluation = result?.result;
    const title = evaluation?.title || "a type";
    const shareText = isFreakLevel
      ? `I'm ${title}! How freaky are you?`
      : isRomanticTrope
      ? `I'm ${title}! What's your romantic trope?`
      : `I'm ${title}! What's your flirt style?`;
    const fullText = `${shareText}\n\n${shareUrl}`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: `${testName} Result`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <ShareHeader />
        <div className="flex items-center justify-center min-h-[calc(100vh-73px)]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4" />
            <p className="text-muted-foreground">Loading result...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !result) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <ShareHeader />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] px-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-4">Result Not Found</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button
              onClick={() => router.push("/play")}
              size="lg"
              className="px-8 py-6 text-lg font-semibold rounded-full"
            >
              Take a Quiz
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Get evaluation data based on type
  const evaluation = result.result;
  const getVisuals = () => {
    if (isFreakLevel) {
      const level = evaluation.level as FreakLevel;
      return FREAK_LEVEL_META[level] || FREAK_LEVEL_META.spicy;
    } else if (isRomanticTrope) {
      const trope = evaluation.trope as RomanticTrope;
      return TROPE_META[trope] || TROPE_META.slow_burn;
    } else {
      const archetype = evaluation.archetype as FlirtArchetype;
      return ARCHETYPE_META[archetype] || ARCHETYPE_META.playful_tease;
    }
  };

  const visuals = getVisuals();
  const title = evaluation.title || "Your Result";
  const tagline = evaluation.tagline;

  // v3.0 Dating Personality Test fields
  const pattern = evaluation.pattern;
  const theTruth = evaluation.the_truth;
  const youTellYourself = evaluation.you_tell_yourself;
  const butActually = evaluation.but_actually;
  const whatYouNeed = evaluation.what_you_need;

  // v3.0 Unhinged Test fields
  const description = evaluation.description;
  const vibeCheck = evaluation.vibe_check;
  const evidence = evaluation.evidence || [];
  const levelNumber = evaluation.level_number || 3;

  // Gradient classes based on quiz type
  const gradientClass = isFreakLevel
    ? "from-purple-600/10 via-fuchsia-500/5 to-red-500/10"
    : isRomanticTrope
    ? "from-amber-500/10 via-rose-500/5 to-pink-500/10"
    : "from-rose-500/10 via-purple-500/5 to-indigo-500/10";

  const buttonGradient = isFreakLevel
    ? "from-fuchsia-500 to-red-500 hover:from-fuchsia-400 hover:to-red-400"
    : isRomanticTrope
    ? "from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400"
    : "from-rose-500 to-purple-500 hover:from-rose-400 hover:to-purple-400";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShareHeader />

      {/* Subtle background gradient */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className={cn("absolute inset-0 bg-gradient-to-br", gradientClass)} />
      </div>

      {/* Content */}
      <main className="flex flex-col items-center px-4 py-8 pb-16">
        {/* "Someone shared" badge */}
        <div className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs mb-6",
          isFreakLevel ? "bg-fuchsia-500/10 text-fuchsia-600" :
          isRomanticTrope ? "bg-amber-500/10 text-amber-600" :
          "bg-rose-500/10 text-rose-600"
        )}>
          <span className={cn(
            "inline-block w-2 h-2 rounded-full animate-pulse",
            isFreakLevel ? "bg-fuchsia-500" :
            isRomanticTrope ? "bg-amber-500" :
            "bg-rose-500"
          )} />
          Someone shared their {testName} result
        </div>

        {/* Hero Section */}
        <div className="w-full max-w-lg text-center mb-8">
          {/* Emoji */}
          <div className="text-7xl mb-4">{visuals.emoji}</div>

          {/* Pre-title */}
          <p className="text-muted-foreground text-sm mb-2 uppercase tracking-wider">
            {isFreakLevel ? "their unhinged level is" : isRomanticTrope ? "their dating pattern is" : "their flirt style is"}
          </p>

          {/* Title */}
          <h1 className={cn("text-4xl md:text-5xl font-black mb-3 tracking-tight", visuals.color)}>
            {title}
          </h1>

          {/* Tagline */}
          {tagline && (
            <p className="text-lg text-muted-foreground italic">
              &ldquo;{tagline}&rdquo;
            </p>
          )}
        </div>

        {/* === Dating Personality Test v3.0 Content === */}
        {isRomanticTrope && (
          <>
            {/* Pattern - The one-liner truth */}
            {pattern && (
              <Card className="w-full max-w-lg p-6 mb-4 bg-amber-500/5 border-amber-500/20">
                <p className="text-base font-medium text-center leading-relaxed">
                  {pattern}
                </p>
              </Card>
            )}

            {/* The Truth - The insight that makes them feel seen */}
            {theTruth && (
              <Card className="w-full max-w-lg p-6 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Quote className="h-5 w-5 text-amber-500 shrink-0" />
                  <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">the truth is...</h2>
                </div>
                <p className="text-base leading-relaxed">
                  {theTruth}
                </p>
              </Card>
            )}

            {/* You Tell Yourself / But Actually - The reveal */}
            {(youTellYourself || butActually) && (
              <Card className="w-full max-w-lg p-6 mb-4">
                {youTellYourself && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h2 className="font-semibold text-sm text-muted-foreground">they tell themselves</h2>
                    </div>
                    <p className="text-base italic text-muted-foreground pl-6">
                      &ldquo;{youTellYourself}&rdquo;
                    </p>
                  </div>
                )}

                {butActually && (
                  <div className={youTellYourself ? "pt-4 border-t" : ""}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-amber-500 font-bold">but actually...</span>
                    </div>
                    <p className="text-base leading-relaxed">
                      {butActually}
                    </p>
                  </div>
                )}
              </Card>
            )}

            {/* What You Need - The advice */}
            {whatYouNeed && (
              <Card className="w-full max-w-lg p-6 mb-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-semibold text-sm mb-2">what they actually need</h2>
                    <p className="text-sm leading-relaxed">
                      {whatYouNeed}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* === Unhinged Test v3.0 Content === */}
        {isFreakLevel && (
          <>
            {/* Spectrum visualization */}
            <Card className="w-full max-w-lg p-6 mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-3">
                <span>🍦 vanilla</span>
                <span>😈 menace</span>
              </div>
              <div className="relative h-3 bg-gradient-to-r from-amber-200 via-orange-400 via-red-500 via-purple-500 to-fuchsia-500 rounded-full">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-2 border-fuchsia-500 shadow-md"
                  style={{ left: `${((levelNumber - 1) / 4) * 100}%`, transform: 'translate(-50%, -50%)' }}
                />
              </div>
              <div className="text-center mt-3 text-sm text-muted-foreground">
                level {levelNumber}/5
              </div>
            </Card>

            {/* Vibe Check - The devastating one-liner */}
            {vibeCheck && (
              <Card className="w-full max-w-lg p-6 mb-4 border-2 bg-fuchsia-500/5 border-fuchsia-500/20">
                <div className="flex items-start gap-3">
                  <Quote className="h-5 w-5 shrink-0 mt-0.5 text-fuchsia-500" />
                  <p className="text-base font-medium italic leading-relaxed">
                    {vibeCheck}
                  </p>
                </div>
              </Card>
            )}

            {/* Main Description */}
            {description && (
              <Card className="w-full max-w-lg p-6 mb-4">
                <p className="text-base leading-relaxed">
                  {description}
                </p>
              </Card>
            )}

            {/* Evidence - The callouts */}
            {evidence.length > 0 && (
              <Card className="w-full max-w-lg p-6 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-fuchsia-500" />
                  <h2 className="font-semibold">we noticed...</h2>
                </div>
                <ul className="space-y-3">
                  {evidence.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                      <span className="font-bold shrink-0 text-fuchsia-500">{i + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        {/* === Legacy Flirt Test Content (fallback) === */}
        {!isRomanticTrope && !isFreakLevel && (
          <>
            {vibeCheck && (
              <Card className="w-full max-w-lg p-6 mb-4 border-2 bg-rose-500/5 border-rose-500/20">
                <div className="flex items-start gap-3">
                  <Quote className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
                  <p className="text-base font-medium italic leading-relaxed">
                    {vibeCheck}
                  </p>
                </div>
              </Card>
            )}

            {description && (
              <Card className="w-full max-w-lg p-6 mb-4">
                <p className="text-base leading-relaxed">
                  {description}
                </p>
              </Card>
            )}
          </>
        )}

        {/* Primary CTA - Take the Quiz */}
        <div className="w-full max-w-lg mb-3">
          <Button
            onClick={handleTakeTest}
            size="lg"
            className={cn(
              "w-full py-6 text-lg font-semibold rounded-full shadow-lg bg-gradient-to-r",
              buttonGradient
            )}
          >
            {isFreakLevel ? "How Unhinged Are You?" : isRomanticTrope ? "What's Your Dating Pattern?" : "Take the Test"}
          </Button>
        </div>

        {/* Secondary: Share */}
        <div className="w-full max-w-lg mb-8">
          <Button
            onClick={handleShare}
            variant="outline"
            className="w-full py-3 rounded-full"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                Share This Result
              </>
            )}
          </Button>
        </div>

        {/* Try other quizzes */}
        <div className="w-full max-w-lg mb-8 text-center">
          <Link
            href={isFreakLevel ? "/play" : "/play/freak"}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isFreakLevel ? "Try the Dating Personality Test instead" : "Try the Unhinged Test instead"}
          </Link>
        </div>

        {/* Episode 0 CTA Section */}
        {featuredSeries.length > 0 && (
          <div className="w-full max-w-lg">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">ready for the real thing?</h3>
              <p className="text-sm text-muted-foreground">
                try episode 0 — free interactive romance stories
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {featuredSeries.map((series) => (
                <Link
                  key={series.id}
                  href={`/series/${series.slug}`}
                  className="group"
                >
                  <Card className={cn(
                    "overflow-hidden border-2 border-transparent transition-all duration-200 hover:shadow-lg hover:-translate-y-1",
                    isFreakLevel ? "hover:border-fuchsia-500/30" :
                    isRomanticTrope ? "hover:border-amber-500/30" :
                    "hover:border-rose-500/30"
                  )}>
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                      {series.cover_image_url && (
                        <img
                          src={series.cover_image_url}
                          alt={series.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Play className={cn(
                            "h-5 w-5 ml-0.5",
                            isFreakLevel ? "text-fuchsia-500 fill-fuchsia-500" :
                            isRomanticTrope ? "text-amber-500 fill-amber-500" :
                            "text-rose-500 fill-rose-500"
                          )} />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h4 className="font-semibold text-sm text-white drop-shadow-md line-clamp-1">
                          {series.title}
                        </h4>
                        {series.tagline && (
                          <p className="text-xs text-white/80 line-clamp-1 mt-0.5 drop-shadow-md">
                            {series.tagline}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 text-muted-foreground/60 text-xs">
          <Link href="/" className="hover:text-foreground transition-colors">
            ep-0.com
          </Link>
        </div>
      </main>
    </div>
  );
}
