"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ChoiceOption {
  id: string;
  label: string;
}

interface ChoiceCardProps {
  prompt: string;
  choices: ChoiceOption[];
  onChoiceSelect: (choiceId: string) => void | Promise<void>;
  disabled?: boolean;
}

/**
 * ChoiceCard - Interactive decision moment within an episode (ADR-008)
 *
 * Design philosophy:
 * - Clear call-to-action: this is a moment where the user must decide
 * - Visual weight to pause the conversation flow
 * - Consistent styling with InstructionCard and ObjectiveCard
 * - Interactive buttons with hover states
 * - Loading state while choice is being processed
 */
export function ChoiceCard({ prompt, choices, onChoiceSelect, disabled }: ChoiceCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = async (choiceId: string) => {
    if (disabled || isSubmitting) return;

    setSelectedId(choiceId);
    setIsSubmitting(true);

    try {
      await onChoiceSelect(choiceId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="my-6 w-full">
      <div className={cn(
        "relative overflow-hidden rounded-2xl shadow-2xl",
        "ring-1 ring-amber-500/30 bg-gradient-to-br from-amber-950/80 via-black/80 to-amber-950/60"
      )}>
        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-amber-500/30 rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-amber-500/30 rounded-br-2xl" />

        {/* Subtle grid pattern for game UI feel */}
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />

        {/* Content */}
        <div className="relative px-5 py-6">
          {/* Header */}
          <p className="text-xs uppercase tracking-widest text-amber-500/70 text-center font-medium mb-4">
            Choose your path
          </p>

          {/* Prompt */}
          <p className="text-sm font-medium text-white text-center mb-5 leading-relaxed">
            {prompt}
          </p>

          {/* Choice buttons */}
          <div className="space-y-3">
            {choices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => handleSelect(choice.id)}
                disabled={disabled || isSubmitting}
                className={cn(
                  "w-full text-left py-3 px-4 rounded-xl border transition-all",
                  "text-sm font-medium",
                  // Default state
                  "bg-black/30 border-amber-500/20 text-white/90",
                  // Hover state (when not disabled)
                  !disabled && !isSubmitting && "hover:border-amber-500/50 hover:bg-amber-500/10",
                  // Selected state
                  selectedId === choice.id && isSubmitting && "border-amber-500/60 bg-amber-500/20",
                  // Disabled state
                  (disabled || isSubmitting) && "opacity-60 cursor-not-allowed"
                )}
              >
                <div className="flex items-center justify-between">
                  <span>{choice.label}</span>
                  {selectedId === choice.id && isSubmitting && (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ChoiceMadeCard - Shows after a choice has been made (non-interactive)
 * Displays which choice the user selected
 */
interface ChoiceMadeCardProps {
  prompt: string;
  selectedLabel: string;
}

export function ChoiceMadeCard({ prompt, selectedLabel }: ChoiceMadeCardProps) {
  return (
    <div className="my-6 w-full">
      <div className={cn(
        "relative overflow-hidden rounded-2xl shadow-lg",
        "ring-1 ring-white/10 bg-gradient-to-br from-gray-900/60 via-black/60 to-gray-900/40"
      )}>
        {/* Content */}
        <div className="relative px-5 py-5">
          <p className="text-xs uppercase tracking-widest text-white/40 text-center font-medium mb-2">
            You chose
          </p>
          <p className="text-sm font-medium text-white/80 text-center">
            {selectedLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
