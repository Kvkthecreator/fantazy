"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HometownCrushPage() {
  const router = useRouter();
  const [selectedCharacter, setSelectedCharacter] = useState<"m" | "f" | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!selectedCharacter) return;

    setIsStarting(true);
    setError(null);

    try {
      const result = await api.games.start("hometown-crush", selectedCharacter);
      // Store game state for chat page (including anonymous_id for subsequent calls)
      sessionStorage.setItem(`hometown-crush-${result.session_id}`, JSON.stringify({
        sessionId: result.session_id,
        anonymousId: result.anonymous_id,  // For anonymous users
        characterName: result.character_name,
        characterAvatarUrl: result.character_avatar_url,
        turnBudget: result.turn_budget,
        situation: result.situation,
        openingLine: result.opening_line,
      }));
      // Navigate to chat with session ID
      router.push(`/play/hometown-crush/chat?session=${result.session_id}`);
    } catch (err) {
      console.error("Failed to start game:", err);
      setError("Something went wrong. Please try again.");
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 via-rose-950 to-slate-950 text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-amber-400 via-rose-400 to-pink-400 bg-clip-text text-transparent mb-3">
            Hometown Crush
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-md mx-auto">
            You&apos;re back in your hometown. You didn&apos;t expect to see them here.
          </p>
        </div>

        {/* Situation teaser */}
        <div className="text-center text-white/50 text-sm max-w-md mx-auto mb-8 italic">
          A quick conversation that reveals your romantic trope. Are you a slow burn? All in? Something else?
        </div>

        {/* Character Selection */}
        <div className="w-full max-w-2xl mb-8">
          <p className="text-center text-white/60 text-sm mb-4">
            Who do you run into at the coffee shop?
          </p>
          <div className="grid grid-cols-2 gap-4">
            <CharacterCard
              name="Jack"
              description="Your high school almost-something. You never quite figured out what you were."
              selected={selectedCharacter === "m"}
              onClick={() => setSelectedCharacter("m")}
              gradient="from-slate-500/20 to-blue-500/20"
              borderColor="blue"
            />
            <CharacterCard
              name="Emma"
              description="The one who got away. She still has that look in her eyes."
              selected={selectedCharacter === "f"}
              onClick={() => setSelectedCharacter("f")}
              gradient="from-rose-500/20 to-pink-500/20"
              borderColor="rose"
            />
          </div>
        </div>

        {/* Start Button */}
        <Button
          size="lg"
          onClick={handleStart}
          disabled={!selectedCharacter || isStarting}
          className={cn(
            "px-12 py-6 text-lg font-semibold rounded-full transition-all",
            "bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400",
            "shadow-xl shadow-rose-500/20",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isStarting ? "Starting..." : "Start the Conversation"}
        </Button>

        {error && (
          <p className="mt-4 text-red-400 text-sm">{error}</p>
        )}

        {/* Info */}
        <div className="mt-12 text-center text-white/50 text-sm max-w-md">
          <p>
            Discover your romantic trope through a conversation with someone from your past.
          </p>
          <p className="mt-2">
            Takes about 2 minutes. Share your result with friends!
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-white/30 text-xs">
          <a href="/" className="hover:text-white/50 transition-colors">
            ep-0.com
          </a>
        </div>
      </div>
    </div>
  );
}

interface CharacterCardProps {
  name: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  gradient: string;
  borderColor: "rose" | "blue";
}

function CharacterCard({
  name,
  description,
  selected,
  onClick,
  gradient,
  borderColor,
}: CharacterCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-6 rounded-2xl text-left transition-all",
        "bg-gradient-to-br backdrop-blur-xl",
        gradient,
        "border-2",
        selected
          ? borderColor === "rose"
            ? "border-rose-400 shadow-lg shadow-rose-500/20"
            : "border-blue-400 shadow-lg shadow-blue-500/20"
          : "border-white/10 hover:border-white/20",
        "group"
      )}
    >
      {/* Selection indicator */}
      {selected && (
        <div
          className={cn(
            "absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center",
            borderColor === "rose" ? "bg-rose-400" : "bg-blue-400"
          )}
        >
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Avatar placeholder */}
      <div
        className={cn(
          "w-16 h-16 rounded-full mb-4 flex items-center justify-center text-2xl font-bold",
          borderColor === "rose"
            ? "bg-gradient-to-br from-rose-400 to-pink-400"
            : "bg-gradient-to-br from-slate-400 to-blue-400"
        )}
      >
        {name[0]}
      </div>

      <h3 className="text-xl font-semibold mb-1">{name}</h3>
      <p className="text-sm text-white/60">{description}</p>
    </button>
  );
}
