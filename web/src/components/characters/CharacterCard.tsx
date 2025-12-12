"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CharacterSummary, RelationshipWithCharacter } from "@/types";

interface CharacterCardProps {
  character: CharacterSummary;
  relationship?: RelationshipWithCharacter | null;
  className?: string;
}

export function CharacterCard({
  character,
  relationship,
  className,
}: CharacterCardProps) {
  const stageLabels: Record<string, string> = {
    acquaintance: "Just Met",
    friendly: "Friendly",
    close: "Close",
    intimate: "Special",
  };

  return (
    <Link href={`/characters/${character.slug}`}>
      <Card
        className={cn(
          "overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer group",
          className
        )}
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
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                <span className="text-4xl font-bold text-muted-foreground/50">
                  {character.name[0]}
                </span>
              </div>
            )}

            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Premium badge */}
            {character.is_premium && (
              <Badge className="absolute top-2 right-2 bg-yellow-500 text-yellow-950">
                Premium
              </Badge>
            )}

            {/* Name and archetype overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className="font-semibold text-lg drop-shadow-md">
                  {character.name}
                </h3>
                {relationship && (
                  <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
                    {stageLabels[relationship.stage] || relationship.stage}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-white/80 capitalize">
                {character.archetype}
              </p>
            </div>
          </div>

          {/* Info section */}
          <div className="p-3">
            {character.short_backstory && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {character.short_backstory}
              </p>
            )}

            {/* Stats */}
            {relationship && (
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                <span>{relationship.total_episodes} episodes</span>
                <span>•</span>
                <span>
                  {relationship.last_interaction_at
                    ? `Last talked ${formatRelativeTime(relationship.last_interaction_at)}`
                    : "Start your story"}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
