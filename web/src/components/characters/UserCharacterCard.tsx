"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, UserCircle2 } from "lucide-react";
import type { UserCharacter, UserArchetype, FlirtingLevel } from "@/types";

interface UserCharacterCardProps {
  character: UserCharacter;
  onEdit?: (character: UserCharacter) => void;
  onDelete?: (character: UserCharacter) => void;
  className?: string;
}

const ARCHETYPE_LABELS: Record<UserArchetype, string> = {
  warm_supportive: "Warm & Supportive",
  playful_teasing: "Playful & Teasing",
  mysterious_reserved: "Mysterious & Reserved",
  intense_passionate: "Intense & Passionate",
  confident_assertive: "Confident & Assertive",
};

const FLIRTING_LABELS: Record<FlirtingLevel, string> = {
  subtle: "Subtle",
  playful: "Playful",
  bold: "Bold",
  intense: "Intense",
};

const FLIRTING_COLORS: Record<FlirtingLevel, string> = {
  subtle: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
  playful: "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200",
  bold: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  intense: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
};

export function UserCharacterCard({
  character,
  onEdit,
  onDelete,
  className,
}: UserCharacterCardProps) {
  const handleCardClick = () => {
    // Clicking the card opens edit modal
    if (onEdit) {
      onEdit(character);
    }
  };

  return (
    <Card
      className={cn(
        "overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group cursor-pointer",
        className
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        {/* Image section - full bleed */}
        <div className="aspect-[3/4] relative overflow-hidden bg-muted">
          {character.avatar_url ? (
            <img
              src={character.avatar_url}
              alt={character.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20 gap-2">
              <UserCircle2 className="w-16 h-16 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground/60">
                No avatar yet
              </span>
            </div>
          )}

          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Action buttons overlay (top right) */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(character);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 bg-black/60 hover:bg-red-600 text-white border-0 backdrop-blur-sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(character);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* "My Character" badge */}
          <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground border-0">
            My Character
          </Badge>

          {/* Name and archetype overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <h3 className="font-semibold text-lg drop-shadow-md mb-0.5">
              {character.name}
            </h3>
            <p className="text-sm text-white/80">
              {ARCHETYPE_LABELS[character.archetype] || character.archetype?.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        {/* Info section */}
        <div className="p-3">
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "border-0",
                FLIRTING_COLORS[character.flirting_level] || "bg-muted text-muted-foreground"
              )}
            >
              {FLIRTING_LABELS[character.flirting_level] || character.flirting_level} flirting
            </Badge>
          </div>

          {character.appearance_prompt && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
              {character.appearance_prompt}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
