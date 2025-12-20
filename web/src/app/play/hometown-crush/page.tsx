"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkles, Heart, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Character metadata with avatar URLs
interface CharacterInfo {
  id: string;
  name: string;
  description: string;
  avatarUrl: string | null;
}

// Default character info (will be replaced with API data if available)
const DEFAULT_CHARACTERS: Record<"m" | "f", CharacterInfo> = {
  m: {
    id: "jack",
    name: "Jack",
    description: "The one you can't read. He's already watching you.",
    avatarUrl: null,
  },
  f: {
    id: "emma",
    name: "Emma",
    description: "The one who sees right through you. Good luck.",
    avatarUrl: null,
  },
};

export default function HometownCrushPage() {
  const router = useRouter();
  const [selectedCharacter, setSelectedCharacter] = useState<"m" | "f" | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characters, setCharacters] = useState(DEFAULT_CHARACTERS);

  // Fetch character data to get avatar URLs
  useEffect(() => {
    async function loadCharacters() {
      try {
        const [jackData, emmaData] = await Promise.all([
          api.characters.getBySlug("jack-hometown").catch(() => null),
          api.characters.getBySlug("emma-hometown").catch(() => null),
        ]);

        setCharacters({
          m: {
            id: jackData?.id || "jack",
            name: jackData?.name || "Jack",
            description: jackData?.personality_summary || DEFAULT_CHARACTERS.m.description,
            avatarUrl: jackData?.avatar_url || null,
          },
          f: {
            id: emmaData?.id || "emma",
            name: emmaData?.name || "Emma",
            description: emmaData?.personality_summary || DEFAULT_CHARACTERS.f.description,
            avatarUrl: emmaData?.avatar_url || null,
          },
        });
      } catch (err) {
        console.error("Failed to load character data:", err);
      }
    }
    loadCharacters();
  }, []);

  const handleStart = async () => {
    if (!selectedCharacter) return;

    setIsStarting(true);
    setError(null);

    try {
      const result = await api.games.start("hometown-crush", selectedCharacter);
      sessionStorage.setItem(`hometown-crush-${result.session_id}`, JSON.stringify({
        sessionId: result.session_id,
        anonymousId: result.anonymous_id,
        characterName: result.character_name,
        characterAvatarUrl: result.character_avatar_url,
        turnBudget: result.turn_budget,
        situation: result.situation,
        openingLine: result.opening_line,
      }));
      router.push(`/play/hometown-crush/chat?session=${result.session_id}`);
    } catch (err) {
      console.error("Failed to start game:", err);
      setError("Something went wrong. Please try again.");
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-500/5 to-pink-500/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center min-h-screen px-4 py-8">
        {/* Back button */}
        <div className="w-full max-w-2xl mb-6">
          <Link
            href="/play"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Play
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Heart className="h-4 w-4" />
            4 turns. 1 trope.
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            The Flirt Test
          </h1>
          <p className="text-muted-foreground">
            Flirt with an AI. Find out what kind of romantic you really are.
          </p>
        </div>

        {/* Situation teaser */}
        <div className="text-center text-muted-foreground text-sm max-w-md mx-auto mb-8 italic">
          Coffee shop. Stranger. Four exchanges to reveal your trope.
        </div>

        {/* Character Selection */}
        <div className="w-full max-w-2xl mb-8">
          <p className="text-center text-muted-foreground text-sm mb-4">
            Who catches your eye?
          </p>
          <div className="grid grid-cols-2 gap-4">
            <CharacterCard
              name={characters.m.name}
              description={characters.m.description}
              avatarUrl={characters.m.avatarUrl}
              selected={selectedCharacter === "m"}
              onClick={() => setSelectedCharacter("m")}
            />
            <CharacterCard
              name={characters.f.name}
              description={characters.f.description}
              avatarUrl={characters.f.avatarUrl}
              selected={selectedCharacter === "f"}
              onClick={() => setSelectedCharacter("f")}
            />
          </div>
        </div>

        {/* Start Button */}
        <Button
          size="lg"
          onClick={handleStart}
          disabled={!selectedCharacter || isStarting}
          className="px-12 py-6 text-lg font-semibold rounded-full"
        >
          {isStarting ? (
            <>
              <Sparkles className="h-5 w-5 mr-2 animate-pulse" />
              Starting...
            </>
          ) : (
            "Start the Conversation"
          )}
        </Button>

        {error && (
          <p className="mt-4 text-destructive text-sm">{error}</p>
        )}

        {/* Info */}
        <div className="mt-12 text-center text-muted-foreground text-sm max-w-md">
          <p>
            Discover your romantic trope through a conversation with someone from your past.
          </p>
          <p className="mt-2">
            Takes about 2 minutes. Share your result with friends!
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-muted-foreground/60 text-xs">
          <a href="/" className="hover:text-foreground transition-colors">
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
  avatarUrl: string | null;
  selected: boolean;
  onClick: () => void;
}

function CharacterCard({
  name,
  description,
  avatarUrl,
  selected,
  onClick,
}: CharacterCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative p-5 cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5",
        selected
          ? "ring-2 ring-primary shadow-lg"
          : "hover:ring-1 hover:ring-primary/30",
        "group"
      )}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Avatar */}
      <div className="w-16 h-16 rounded-full mb-4 overflow-hidden bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xl font-bold text-primary-foreground">
            {name[0]}
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold mb-1">{name}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
    </Card>
  );
}
