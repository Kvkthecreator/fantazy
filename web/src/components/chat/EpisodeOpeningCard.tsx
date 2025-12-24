"use client";

import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface EpisodeOpeningCardProps {
  title: string;
  situation: string;
  dramaticQuestion?: string | null;
  characterName: string;
  hasBackground?: boolean;
}

/**
 * EpisodeOpeningCard - Renders episode setup at conversation start
 *
 * Design philosophy (DIRECTOR_UI_TOOLKIT.md v2.2):
 * - UPSTREAM-DRIVEN interjection (displays Episode-authored metadata)
 * - Shown once per episode before first user message (empty chat state)
 * - "Program notes" before the show begins - sets the stage
 * - Matches Director UI design language (SceneCard, InstructionCard)
 *
 * Theatrical Model Analogy:
 * - Like theater program notes or "Previously on..." recap
 * - Episode owns the content, Director formats for display
 * - Establishes situation (where we are) and dramatic question (what's at stake)
 *
 * Content Source:
 * - episode.title - Episode name
 * - episode.situation - Scene-setting paragraph (physical details, mood)
 * - episode.dramatic_question - What tension drives this scene (optional)
 */
export function EpisodeOpeningCard({
  title,
  situation,
  dramaticQuestion,
  characterName,
  hasBackground = false,
}: EpisodeOpeningCardProps) {
  return (
    <div className="my-6 w-full">
      <div className={cn(
        "relative overflow-hidden rounded-2xl shadow-2xl",
        "ring-1",
        hasBackground
          ? "ring-purple-500/30 bg-gradient-to-br from-purple-950/80 via-black/80 to-purple-950/60"
          : "ring-purple-500/20 bg-gradient-to-br from-purple-950/90 via-gray-900 to-purple-950/70"
      )}>
        {/* Decorative pattern overlay */}
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.4)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.3)_0%,transparent_50%)]" />

        {/* Content */}
        <div className="relative px-6 py-8">
          {/* Icon badge - Book/Script representing "authored scene" */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-purple-400" />
            </div>
          </div>

          {/* Episode title */}
          <h2 className="text-2xl font-bold text-white text-center mb-4 leading-tight">
            {title}
          </h2>

          {/* Situation - Scene-setting paragraph */}
          <p className="text-base text-white/80 text-center leading-relaxed mb-4 max-w-2xl mx-auto">
            {situation}
          </p>

          {/* Dramatic question - What's at stake (if provided) */}
          {dramaticQuestion && (
            <div className="mt-6 pt-4 border-t border-purple-500/20">
              <p className="text-sm italic text-purple-300/90 text-center leading-relaxed max-w-xl mx-auto">
                {dramaticQuestion}
              </p>
            </div>
          )}

          {/* Subtle label */}
          <p className="text-[10px] uppercase tracking-widest text-purple-500/50 text-center mt-6">
            Episode Opening
          </p>
        </div>
      </div>
    </div>
  );
}
