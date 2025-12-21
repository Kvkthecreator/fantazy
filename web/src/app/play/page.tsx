"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import { QuizQuestion } from "@/components/quiz/QuizQuestion";
import { QuizResult } from "@/components/quiz/QuizResult";
import { QUIZ_QUESTIONS, calculateTrope } from "@/lib/quiz-data";
import type { RomanticTrope } from "@/types";

type QuizStage = "landing" | "questions" | "result";

const STORAGE_KEY = "quiz_state";

function PlayHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/60 shadow-sm shrink-0 overflow-hidden">
            <img
              src="/branding/ep0-mark.svg"
              alt="ep-0"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight text-foreground">
              episode-0
            </h1>
            <p className="text-xs text-muted-foreground">3, 2, 1... action</p>
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

export default function PlayPage() {
  const [stage, setStage] = useState<QuizStage>("landing");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, RomanticTrope>>({});
  const [resultTrope, setResultTrope] = useState<RomanticTrope | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.stage) setStage(parsed.stage);
        if (typeof parsed.currentQuestion === "number") setCurrentQuestion(parsed.currentQuestion);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.resultTrope) setResultTrope(parsed.resultTrope);
      }
    } catch {
      // Ignore parsing errors
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
        resultTrope,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [stage, currentQuestion, answers, resultTrope, isHydrated]);

  const handleStart = () => {
    setStage("questions");
  };

  const handleAnswer = (trope: RomanticTrope) => {
    const newAnswers = { ...answers, [currentQuestion]: trope };
    setAnswers(newAnswers);

    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      const result = calculateTrope(newAnswers);
      setResultTrope(result);
      setStage("result");
    }
  };

  const handlePlayAgain = () => {
    setStage("landing");
    setCurrentQuestion(0);
    setAnswers({});
    setResultTrope(null);
    // Clear storage when starting over
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PlayHeader />

      {/* Subtle background gradient */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-500/3 to-pink-500/5" />
      </div>

      {/* Content */}
      <main className="relative">
        {stage === "landing" && (
          <LandingStage onStart={handleStart} />
        )}

        {stage === "questions" && (
          <div className="flex flex-col items-center min-h-[calc(100vh-73px)] px-4 py-12">
            <div className="w-full max-w-md">
              {/* Progress */}
              <div className="mb-8">
                <QuizProgress
                  current={currentQuestion}
                  total={QUIZ_QUESTIONS.length}
                />
                <p className="text-center text-xs text-muted-foreground mt-2">
                  {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
                </p>
              </div>

              {/* Question */}
              <QuizQuestion
                key={currentQuestion}
                question={QUIZ_QUESTIONS[currentQuestion]}
                onAnswer={handleAnswer}
              />
            </div>
          </div>
        )}

        {stage === "result" && resultTrope && (
          <QuizResult trope={resultTrope} onPlayAgain={handlePlayAgain} />
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
        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Free • 60 seconds • No signup
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
          5 Romance Types.
          <br />
          <span className="text-primary">Which One Are You?</span>
        </h1>

        {/* Value Proposition */}
        <p className="text-muted-foreground mb-8 text-base md:text-lg max-w-md mx-auto">
          Discover your dating personality and get personalized insights on your romantic strengths, challenges, and compatibility.
        </p>

        {/* CTA */}
        <Button
          onClick={onStart}
          size="lg"
          className="px-12 py-6 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-shadow"
        >
          Take the Quiz →
        </Button>

        {/* What you'll learn */}
        <div className="mt-10 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
            Your romance type
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Relationship strengths
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Who you're compatible with
          </span>
        </div>
      </div>
    </div>
  );
}
