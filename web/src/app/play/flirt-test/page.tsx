"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function FlirtTestPage() {
  const router = useRouter();
  const [selectedCharacter, setSelectedCharacter] = useState<"m" | "f" | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!selectedCharacter) return;

    setIsStarting(true);
    setError(null);

    try {
      const result = await api.games.start("flirt-test", selectedCharacter);
      // Store game state for chat page
      sessionStorage.setItem(`flirt-test-${result.session_id}`, JSON.stringify({
        sessionId: result.session_id,
        characterName: result.character_name,
        characterAvatarUrl: result.character_avatar_url,
        turnBudget: result.turn_budget,
        situation: result.situation,
        openingLine: result.opening_line,
      }));
      // Navigate to chat with session ID
      router.push(`/play/flirt-test/chat?session=${result.session_id}`);
    } catch (err) {
      console.error("Failed to start game:", err);
      setError("Something went wrong. Please try again.");
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-rose-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-3">
            Flirt Test
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-md mx-auto">
            How do you flirt? A 7-turn conversation that reveals your flirt archetype.
          </p>
        </div>

        {/* Character Selection */}
        <div className="w-full max-w-2xl mb-8">
          <p className="text-center text-white/60 text-sm mb-4">
            Choose who you want to chat with
          </p>
          <div className="grid grid-cols-2 gap-4">
            <CharacterCard
              name="Mina"
              description="A captivating presence with an easy smile"
              selected={selectedCharacter === "f"}
              onClick={() => setSelectedCharacter("f")}
              gradient="from-rose-500/20 to-pink-500/20"
              borderColor="rose"
            />
            <CharacterCard
              name="Alex"
              description="The kind of guy who makes you forget what you were about to say"
              selected={selectedCharacter === "m"}
              onClick={() => setSelectedCharacter("m")}
              gradient="from-purple-500/20 to-indigo-500/20"
              borderColor="purple"
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
            "bg-gradient-to-r from-rose-500 to-purple-500 hover:from-rose-400 hover:to-purple-400",
            "shadow-xl shadow-purple-500/20",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isStarting ? "Starting..." : "Start the Test"}
        </Button>

        {error && (
          <p className="mt-4 text-red-400 text-sm">{error}</p>
        )}

        {/* Info */}
        <div className="mt-12 text-center text-white/50 text-sm max-w-md">
          <p>
            This is a fun personality test based on a short flirty conversation.
            Your result reveals your natural flirting style.
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
  borderColor: "rose" | "purple";
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
            : "border-purple-400 shadow-lg shadow-purple-500/20"
          : "border-white/10 hover:border-white/20",
        "group"
      )}
    >
      {/* Selection indicator */}
      {selected && (
        <div
          className={cn(
            "absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center",
            borderColor === "rose" ? "bg-rose-400" : "bg-purple-400"
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
            : "bg-gradient-to-br from-purple-400 to-indigo-400"
        )}
      >
        {name[0]}
      </div>

      <h3 className="text-xl font-semibold mb-1">{name}</h3>
      <p className="text-sm text-white/60">{description}</p>
    </button>
  );
}
