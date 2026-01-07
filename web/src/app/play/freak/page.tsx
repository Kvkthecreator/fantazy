"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Share2, Check, RefreshCw, Sparkles, Quote, Play } from "lucide-react";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import { FREAK_QUIZ_QUESTIONS, FREAK_CONTENT, FREAK_VISUALS, type FreakLevel } from "@/lib/quiz-data";
import { api } from "@/lib/api/client";
import type { QuizAnswer, QuizEvaluateResponse } from "@/types";

type QuizStage = "landing" | "questions" | "evaluating" | "result";

const STORAGE_KEY = "freak_quiz_state";

function PlayHeader() {
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

// Store selected answer text for each question
interface AnswerRecord {
  level: FreakLevel;
  answerText: string;
}

export default function FreakQuizPage() {
  const [stage, setStage] = useState<QuizStage>("landing");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerRecord>>({});
  const [evaluationResult, setEvaluationResult] = useState<QuizEvaluateResponse | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore to "result" stage if we have valid evaluation result
        if (parsed.stage === "result" && !parsed.evaluationResult) {
          // Invalid state - reset to landing
          sessionStorage.removeItem(STORAGE_KEY);
        } else {
          if (parsed.stage && parsed.stage !== "evaluating") setStage(parsed.stage);
          if (typeof parsed.currentQuestion === "number") setCurrentQuestion(parsed.currentQuestion);
          if (parsed.answers) setAnswers(parsed.answers);
          if (parsed.evaluationResult) setEvaluationResult(parsed.evaluationResult);
        }
      }
    } catch {
      // Ignore parsing errors - clear bad state
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setIsHydrated(true);
  }, []);

  // Save state to sessionStorage on changes
  useEffect(() => {
    if (!isHydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        stage,
        currentQuestion,
        answers,
        evaluationResult,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [stage, currentQuestion, answers, evaluationResult, isHydrated]);

  const handleStart = () => {
    setStage("questions");
  };

  const handleAnswer = async (level: FreakLevel, answerText: string, index: number) => {
    if (isAnimating) return;

    setSelectedIndex(index);
    setIsAnimating(true);

    const newAnswers = { ...answers, [currentQuestion]: { level, answerText } };
    setAnswers(newAnswers);

    // Brief delay for animation
    setTimeout(async () => {
      setSelectedIndex(null);
      setIsAnimating(false);

      if (currentQuestion < FREAK_QUIZ_QUESTIONS.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      } else {
        // Quiz complete - call API for LLM evaluation
        setStage("evaluating");

        try {
          // Build quiz answers for API
          const quizAnswers: QuizAnswer[] = Object.entries(newAnswers).map(([qIndex, record]) => {
            const q = FREAK_QUIZ_QUESTIONS[parseInt(qIndex)];
            return {
              question_id: q.id,
              question_text: q.question,
              selected_answer: record.answerText,
              selected_trope: record.level, // reusing 'trope' field for 'level'
            };
          });

          const result = await api.games.evaluateQuiz("freak_level", quizAnswers);
          setEvaluationResult(result);
          setStage("result");
        } catch (error) {
          console.error("Quiz evaluation failed:", error);
          setEvaluationResult(null);
          setStage("result");
        }
      }
    }, 300);
  };

  const handlePlayAgain = () => {
    setStage("landing");
    setCurrentQuestion(0);
    setAnswers({});
    setEvaluationResult(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  };

  const question = FREAK_QUIZ_QUESTIONS[currentQuestion];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PlayHeader />

      {/* Subtle background gradient - darker/edgier for freak quiz */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-fuchsia-500/5 to-red-500/10" />
      </div>

      {/* Content */}
      <main className="relative">
        {stage === "landing" && (
          <LandingStage onStart={handleStart} />
        )}

        {stage === "questions" && question && (
          <div className="flex flex-col items-center min-h-[calc(100vh-73px)] px-4 py-12">
            <div className="w-full max-w-md">
              {/* Progress */}
              <div className="mb-8">
                <QuizProgress
                  current={currentQuestion}
                  total={FREAK_QUIZ_QUESTIONS.length}
                />
                <p className="text-center text-xs text-muted-foreground mt-2">
                  {currentQuestion + 1} of {FREAK_QUIZ_QUESTIONS.length}
                </p>
              </div>

              {/* Question */}
              <div className="space-y-6">
                <h2 className="text-xl md:text-2xl font-semibold text-center leading-snug">
                  {question.question}
                </h2>

                <div className="space-y-3">
                  {question.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswer(option.level, option.text, index)}
                      disabled={isAnimating}
                      className={cn(
                        "w-full p-4 text-left rounded-xl border-2 transition-all duration-200",
                        "hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5",
                        "focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50",
                        selectedIndex === index
                          ? "border-fuchsia-500 bg-fuchsia-500/10 scale-[0.98]"
                          : "border-border bg-card",
                        isAnimating && selectedIndex !== index && "opacity-50"
                      )}
                    >
                      <span className="text-sm md:text-base">{option.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === "evaluating" && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] px-4 py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-fuchsia-500 border-t-transparent mb-4" />
              <p className="text-muted-foreground">calculating your freak level...</p>
            </div>
          </div>
        )}

        {stage === "result" && evaluationResult && (
          <FreakResult result={evaluationResult} onPlayAgain={handlePlayAgain} />
        )}
      </main>
    </div>
  );
}

function LandingStage({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] px-4 py-12">
      <div className="text-center max-w-lg">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-400 mb-6">
          <span className="inline-block w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
          Free • 60 seconds • No judgment
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
          How Freaky
          <br />
          <span className="bg-gradient-to-r from-fuchsia-500 to-red-500 bg-clip-text text-transparent">
            Are You?
          </span>
        </h1>

        {/* Value Proposition */}
        <p className="text-muted-foreground mb-8 text-base md:text-lg max-w-md mx-auto">
          Find out where you fall on the freak spectrum. We won't tell anyone. Probably.
        </p>

        {/* CTA */}
        <Button
          onClick={onStart}
          size="lg"
          className="px-12 py-6 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-r from-fuchsia-500 to-red-500 hover:from-fuchsia-400 hover:to-red-400"
        >
          Find Out
        </Button>

        {/* The levels preview */}
        <div className="mt-10 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span>🍦</span>
            Vanilla
          </span>
          <span className="flex items-center gap-1.5">
            <span>🌶️</span>
            Spicy
          </span>
          <span className="flex items-center gap-1.5">
            <span>🔥</span>
            Unhinged
          </span>
          <span className="flex items-center gap-1.5">
            <span>👹</span>
            Feral
          </span>
          <span className="flex items-center gap-1.5">
            <span>😈</span>
            Menace
          </span>
        </div>

        {/* Back to hub */}
        <div className="mt-8">
          <Link
            href="/play"
            className="text-sm text-muted-foreground hover:text-fuchsia-400 transition-colors"
          >
            ← Back to all quizzes
          </Link>
        </div>
      </div>
    </div>
  );
}

interface Series {
  id: string;
  title: string;
  slug: string;
  tagline?: string;
  cover_image_url?: string;
}

function FreakResult({ result, onPlayAgain }: { result: QuizEvaluateResponse; onPlayAgain: () => void }) {
  const [copied, setCopied] = useState(false);
  const [featuredSeries, setFeaturedSeries] = useState<Series[]>([]);

  // Fetch featured series on mount
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

  const level = result.result.level as FreakLevel;
  const visuals = FREAK_VISUALS[level];
  const staticContent = FREAK_CONTENT[level];

  // Use API result for personalized content, fallback to static
  const title = result.result.title || staticContent.title;
  const tagline = result.result.tagline || staticContent.tagline;
  const description = result.result.description || staticContent.description;
  const shareText = result.result.share_text || staticContent.shareText;
  const evidence = result.result.evidence || [];
  const vibeCheck = result.result.vibe_check;
  const levelNumber = result.result.level_number || staticContent.levelNumber;

  const handleShare = async () => {
    // Use clean URL format (no www., consistent branding)
    const shareUrl = `https://ep-0.com/r/${result.share_id}`;
    const fullText = `${shareText}\n\n${shareUrl}`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: `I'm ${title}!`,
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

  return (
    <div className="flex flex-col items-center px-4 py-8 pb-16">
      {/* Hero Section */}
      <div className="w-full max-w-lg text-center mb-8">
        {/* Emoji */}
        <div className="text-7xl mb-4">{visuals.emoji}</div>

        {/* Pre-title */}
        <p className="text-muted-foreground text-sm mb-2 uppercase tracking-wider">
          your freak level is
        </p>

        {/* Title */}
        <h1 className={cn("text-4xl md:text-5xl font-black mb-3 tracking-tight", visuals.color)}>
          {title}
        </h1>

        {/* Tagline */}
        <p className="text-lg text-muted-foreground italic">
          {tagline}
        </p>
      </div>

      {/* Vibe Check - The devastating one-liner */}
      {vibeCheck && (
        <Card className="w-full max-w-lg p-6 mb-4 bg-fuchsia-500/5 border-fuchsia-500/20">
          <div className="flex items-start gap-3">
            <Quote className="h-5 w-5 text-fuchsia-500 shrink-0 mt-0.5" />
            <p className="text-base font-medium italic leading-relaxed">
              {vibeCheck}
            </p>
          </div>
        </Card>
      )}

      {/* Main Description */}
      <Card className="w-full max-w-lg p-6 mb-4">
        <p className="text-base leading-relaxed">
          {description}
        </p>
      </Card>

      {/* LLM-Generated Evidence - The callouts */}
      {evidence.length > 0 && (
        <Card className="w-full max-w-lg p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-fuchsia-500" />
            <h2 className="font-semibold">we noticed...</h2>
          </div>
          <ul className="space-y-3">
            {evidence.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                <span className="text-fuchsia-500 font-bold shrink-0">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Unhinged Spectrum */}
      <Card className="w-full max-w-lg p-6 mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-3">
          <span>vanilla</span>
          <span>menace</span>
        </div>
        <div className="relative h-3 bg-gradient-to-r from-amber-200 via-orange-400 via-red-500 via-purple-500 to-fuchsia-500 rounded-full">
          {/* Position indicator based on level */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-2 border-fuchsia-500 shadow-md flex items-center justify-center"
            style={{ left: `${((levelNumber - 1) / 4) * 100}%`, transform: 'translate(-50%, -50%)' }}
          >
            <span className="text-xs">{visuals.emoji}</span>
          </div>
        </div>
        <div className="text-center mt-3 text-sm text-muted-foreground">
          level {levelNumber}/5
        </div>
      </Card>

      {/* Primary CTA - Share */}
      <div className="w-full max-w-lg mb-3">
        <Button
          onClick={handleShare}
          size="lg"
          className="w-full py-6 text-lg font-semibold rounded-full shadow-lg bg-gradient-to-r from-fuchsia-500 to-red-500 hover:from-fuchsia-400 hover:to-red-400"
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
      <div className="w-full max-w-lg mb-8">
        <Button
          onClick={onPlayAgain}
          variant="outline"
          className="w-full py-3 rounded-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          try again
        </Button>
      </div>

      {/* Try the other quiz */}
      <div className="w-full max-w-lg mb-8 text-center">
        <Link
          href="/play"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Try the Romance Quiz instead
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
                <Card className="overflow-hidden border-2 border-transparent hover:border-fuchsia-500/30 transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
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
                        <Play className="h-5 w-5 text-fuchsia-500 fill-fuchsia-500 ml-0.5" />
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
    </div>
  );
}
