"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import { QuizQuestion } from "@/components/quiz/QuizQuestion";
import { QuizResult } from "@/components/quiz/QuizResult";
import { QUIZ_QUESTIONS } from "@/lib/quiz-data";
import { api } from "@/lib/api/client";
import type { RomanticTrope, QuizAnswer, QuizEvaluateResponse } from "@/types";

type QuizStage = "landing" | "questions" | "evaluating" | "result";

const STORAGE_KEY = "romance_quiz_state";

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

// Store selected answer text for each question
interface AnswerRecord {
  trope: RomanticTrope;
  answerText: string;
}

export default function RomanceQuizPage() {
  const [stage, setStage] = useState<QuizStage>("landing");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerRecord>>({});
  const [evaluationResult, setEvaluationResult] = useState<QuizEvaluateResponse | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

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

  const handleAnswer = async (trope: RomanticTrope, answerText: string) => {
    const newAnswers = { ...answers, [currentQuestion]: { trope, answerText } };
    setAnswers(newAnswers);

    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Quiz complete - call API for LLM evaluation
      setStage("evaluating");

      try {
        // Build quiz answers for API
        const quizAnswers: QuizAnswer[] = Object.entries(newAnswers).map(([qIndex, record]) => {
          const q = QUIZ_QUESTIONS[parseInt(qIndex)];
          return {
            question_id: q.id,
            question_text: q.question,
            selected_answer: record.answerText,
            selected_trope: record.trope,
          };
        });

        const result = await api.games.evaluateQuiz("romantic_trope", quizAnswers);
        setEvaluationResult(result);
        setStage("result");
      } catch (error) {
        console.error("Quiz evaluation failed:", error);
        // Fallback: show result with basic data
        setEvaluationResult(null);
        setStage("result");
      }
    }
  };

  const handlePlayAgain = () => {
    setStage("landing");
    setCurrentQuestion(0);
    setAnswers({});
    setEvaluationResult(null);
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

        {stage === "evaluating" && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] px-4 py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4" />
              <p className="text-muted-foreground">analyzing your romantic energy...</p>
            </div>
          </div>
        )}

        {stage === "result" && evaluationResult && (
          <QuizResult
            result={evaluationResult}
            onPlayAgain={handlePlayAgain}
          />
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
          Take the Quiz
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

        {/* Back to hub */}
        <div className="mt-8">
          <Link
            href="/play"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to all quizzes
          </Link>
        </div>
      </div>
    </div>
  );
}
