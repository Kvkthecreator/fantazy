"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Play, Sparkles, User, Crown } from "lucide-react";
import type { CharacterSelectionContext, CompatibleCharacter } from "@/types";

interface CharacterSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  episodeId: string;
  episodeTitle: string;
  onSelect: (characterId: string) => void;
}

export function CharacterSelectionModal({
  open,
  onOpenChange,
  seriesId,
  episodeId,
  episodeTitle,
  onSelect,
}: CharacterSelectionModalProps) {
  const [context, setContext] = useState<CharacterSelectionContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (open && seriesId) {
      loadCharacterSelection();
    }
  }, [open, seriesId]);

  async function loadCharacterSelection() {
    setIsLoading(true);
    try {
      const data = await api.roles.getCharacterSelectionForSeries(seriesId);
      setContext(data);
      // Default to canonical character if available
      if (data.canonical_character) {
        setSelectedId(data.canonical_character.id);
      } else if (data.user_characters.length > 0) {
        setSelectedId(data.user_characters[0].id);
      }
    } catch (err) {
      console.error("Failed to load character selection:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleStart() {
    if (!selectedId) return;
    setIsStarting(true);
    onSelect(selectedId);
  }

  const hasUserCharacters = context && context.user_characters.length > 0;
  const hasCanonical = context?.canonical_character != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Your Character</DialogTitle>
          <DialogDescription>
            Select who you want to play as in &ldquo;{episodeTitle}&rdquo;
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !context ? (
          <div className="py-8 text-center text-muted-foreground">
            Unable to load character options
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Canonical Character */}
            {hasCanonical && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Crown className="h-4 w-4" />
                  <span>Original Character</span>
                </div>
                <CharacterOption
                  character={context.canonical_character!}
                  isSelected={selectedId === context.canonical_character!.id}
                  onSelect={() => setSelectedId(context.canonical_character!.id)}
                />
              </div>
            )}

            {/* User Characters */}
            {hasUserCharacters && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Your Characters</span>
                </div>
                <div className="space-y-2">
                  {context.user_characters.map((char) => (
                    <CharacterOption
                      key={char.id}
                      character={char}
                      isSelected={selectedId === char.id}
                      onSelect={() => setSelectedId(char.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No compatible characters message */}
            {!hasCanonical && !hasUserCharacters && (
              <div className="py-4 text-center text-muted-foreground">
                <p>No compatible characters found.</p>
                <p className="text-sm mt-1">
                  Create a character with a matching archetype to play this episode.
                </p>
              </div>
            )}

            {/* Start Button */}
            <div className="pt-2">
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleStart}
                disabled={!selectedId || isStarting}
              >
                {isStarting ? (
                  <>Starting...</>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Start Episode
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface CharacterOptionProps {
  character: CompatibleCharacter;
  isSelected: boolean;
  onSelect: () => void;
}

function CharacterOption({ character, isSelected, onSelect }: CharacterOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
        "hover:bg-accent/50",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border"
      )}
    >
      {/* Character Avatar */}
      <div className="h-12 w-12 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
        {character.avatar_url ? (
          <img
            src={character.avatar_url}
            alt={character.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm font-medium text-muted-foreground">
            {character.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium">{character.name}</span>
          {character.is_user_created && (
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Custom
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground capitalize">
          {formatArchetype(character.mapped_archetype || character.archetype)}
        </div>
      </div>

      <div
        className={cn(
          "h-5 w-5 rounded-full border-2 flex items-center justify-center",
          isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
        )}
      >
        {isSelected && (
          <div className="h-2 w-2 rounded-full bg-white" />
        )}
      </div>
    </button>
  );
}

function formatArchetype(archetype: string): string {
  return archetype
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
