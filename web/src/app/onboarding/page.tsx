"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CharacterSummary } from "@/types";

type Step = "welcome" | "profile" | "vibe" | "character" | "complete";

const VIBES = [
  {
    id: "comforting",
    label: "Comforting Friend",
    description: "Warm, supportive, always there for you",
    emoji: "🤗",
  },
  {
    id: "flirty",
    label: "Flirty Crush",
    description: "Playful, teasing, will make you blush",
    emoji: "😏",
  },
  {
    id: "chill",
    label: "Chill Coworker",
    description: "Relatable, easy-going, gets your struggles",
    emoji: "😌",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("welcome");
  const [isLoading, setIsLoading] = useState(false);

  // Form data
  const [displayName, setDisplayName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [vibe, setVibe] = useState<"comforting" | "flirty" | "chill" | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterSummary | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Load characters
      try {
        const chars = await api.characters.list();
        setCharacters(chars);
      } catch (error) {
        console.error("Failed to load characters:", error);
      }
    }
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get recommended character based on vibe
  const getRecommendedCharacter = () => {
    if (!vibe) return null;
    const archetypeMap: Record<string, string> = {
      comforting: "barista",
      flirty: "neighbor",
      chill: "coworker",
    };
    return characters.find((c) => c.archetype === archetypeMap[vibe]) || characters[0];
  };

  const handleComplete = async () => {
    if (!displayName || !vibe || !selectedCharacter) return;

    setIsLoading(true);
    try {
      await api.users.completeOnboarding({
        display_name: displayName,
        pronouns: pronouns || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        vibe_preference: vibe,
        first_character_id: selectedCharacter.id,
        age_confirmed: true,
      });

      setStep("complete");

      // Redirect to chat after a moment
      setTimeout(() => {
        router.push(`/chat/${selectedCharacter.id}`);
      }, 2000);
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-purple-950 dark:to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {["welcome", "profile", "vibe", "character"].map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-2 w-12 rounded-full transition-colors",
                ["welcome", "profile", "vibe", "character", "complete"].indexOf(step) >= i
                  ? "bg-primary"
                  : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Welcome Step */}
        {step === "welcome" && (
          <Card className="border-0 shadow-xl">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-4xl">
                ✨
              </div>
              <h1 className="text-2xl font-bold mb-2">Welcome to Fantazy</h1>
              <p className="text-muted-foreground mb-6">
                Step into a cozy world where AI characters remember every chapter
                of your story together.
              </p>
              <Button size="lg" onClick={() => setStep("profile")} className="w-full">
                Let&apos;s Get Started
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Profile Step */}
        {step === "profile" && (
          <Card className="border-0 shadow-xl">
            <CardContent className="pt-8 pb-8">
              <h2 className="text-xl font-bold mb-2 text-center">
                What should we call you?
              </h2>
              <p className="text-muted-foreground mb-6 text-center text-sm">
                Your characters will remember your name.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Name
                  </label>
                  <Input
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="h-12"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Pronouns <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    placeholder="e.g., she/her, he/him, they/them"
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setStep("welcome")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep("vibe")}
                  disabled={!displayName.trim()}
                  className="flex-1"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vibe Step */}
        {step === "vibe" && (
          <Card className="border-0 shadow-xl">
            <CardContent className="pt-8 pb-8">
              <h2 className="text-xl font-bold mb-2 text-center">
                Pick your starting vibe
              </h2>
              <p className="text-muted-foreground mb-6 text-center text-sm">
                What kind of connection are you looking for?
              </p>

              <div className="space-y-3">
                {VIBES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVibe(v.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 text-left transition-all",
                      vibe === v.id
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{v.emoji}</span>
                      <div>
                        <p className="font-semibold">{v.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {v.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setStep("profile")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    const recommended = getRecommendedCharacter();
                    if (recommended) setSelectedCharacter(recommended);
                    setStep("character");
                  }}
                  disabled={!vibe}
                  className="flex-1"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Character Step */}
        {step === "character" && (
          <Card className="border-0 shadow-xl">
            <CardContent className="pt-8 pb-8">
              <h2 className="text-xl font-bold mb-2 text-center">
                Meet your first character
              </h2>
              <p className="text-muted-foreground mb-6 text-center text-sm">
                Based on your vibe, we think you&apos;ll love them.
              </p>

              <div className="space-y-3">
                {characters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => setSelectedCharacter(char)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 text-left transition-all",
                      selectedCharacter?.id === char.id
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                        {char.avatar_url ? (
                          <img
                            src={char.avatar_url}
                            alt={char.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          char.name[0]
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{char.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {char.archetype}
                        </p>
                        {char.short_backstory && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {char.short_backstory}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setStep("vibe")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={!selectedCharacter || isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Setting up..." : "Start Your Story"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {step === "complete" && selectedCharacter && (
          <Card className="border-0 shadow-xl">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                {selectedCharacter.avatar_url ? (
                  <img
                    src={selectedCharacter.avatar_url}
                    alt={selectedCharacter.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  selectedCharacter.name[0]
                )}
              </div>
              <h2 className="text-xl font-bold mb-2">
                You&apos;re all set, {displayName}!
              </h2>
              <p className="text-muted-foreground mb-6">
                {selectedCharacter.name} is excited to meet you. Your story begins now...
              </p>
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <LoadingDots />
                <span className="text-sm">Preparing your first meeting</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
