"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { QuizQuestion as QuizQuestionType, RomanticTrope } from "@/types";

interface QuizQuestionProps {
  question: QuizQuestionType;
  onAnswer: (trope: RomanticTrope) => void;
}

export function QuizQuestion({ question, onAnswer }: QuizQuestionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSelect = (index: number, trope: RomanticTrope) => {
    if (isAnimating) return;

    setSelectedIndex(index);
    setIsAnimating(true);

    // Brief delay before transitioning to next question
    setTimeout(() => {
      onAnswer(trope);
      setSelectedIndex(null);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-semibold text-center leading-snug">
        {question.question}
      </h2>

      <div className="space-y-3">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index, option.trope)}
            disabled={isAnimating}
            className={cn(
              "w-full p-4 text-left rounded-xl border-2 transition-all duration-200",
              "hover:border-primary/50 hover:bg-primary/5",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              selectedIndex === index
                ? "border-primary bg-primary/10 scale-[0.98]"
                : "border-border bg-card",
              isAnimating && selectedIndex !== index && "opacity-50"
            )}
          >
            <span className="text-sm md:text-base">{option.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
