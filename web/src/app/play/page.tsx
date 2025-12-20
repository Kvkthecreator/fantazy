"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import { QuizQuestion } from "@/components/quiz/QuizQuestion";
import { QuizResult } from "@/components/quiz/QuizResult";
import { QUIZ_QUESTIONS, calculateTrope } from "@/lib/quiz-data";
import type { RomanticTrope } from "@/types";

type QuizStage = "landing" | "questions" | "result";

export default function PlayPage() {
  const [stage, setStage] = useState<QuizStage>("landing");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, RomanticTrope>>({});
  const [resultTrope, setResultTrope] = useState<RomanticTrope | null>(null);

  const handleStart = () => {
    setStage("questions");
  };

  const handleAnswer = (trope: RomanticTrope) => {
    const newAnswers = { ...answers, [currentQuestion]: trope };
    setAnswers(newAnswers);

    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Quiz complete - calculate result
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
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-500/5 to-pink-500/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {stage === "landing" && (
          <LandingStage onStart={handleStart} />
        )}

        {stage === "questions" && (
          <div className="flex flex-col items-center min-h-screen px-4 py-12">
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
      </div>
    </div>
  );
}

function LandingStage({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="text-center max-w-md">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
          What's Your
          <br />
          <span className="text-primary">Red Flag?</span>
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground mb-8">
          5 questions. brutal honesty.
          <br />
          no judgment (ok maybe a little)
        </p>

        {/* CTA */}
        <Button
          onClick={onStart}
          size="lg"
          className="px-12 py-6 text-lg font-semibold rounded-full"
        >
          Find Out
        </Button>

        {/* Footer */}
        <div className="mt-12 text-muted-foreground/60 text-xs">
          <a href="/" className="hover:text-foreground transition-colors">
            ep-0.com
          </a>
        </div>
      </div>
    </div>
  );
}
