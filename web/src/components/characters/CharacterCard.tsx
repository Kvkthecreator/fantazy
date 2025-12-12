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

  const archetypeColors: Record<string, string> = {
    barista: "from-amber-400 to-orange-500",
    neighbor: "from-blue-400 to-indigo-500",
    coworker: "from-emerald-400 to-teal-500",
    default: "from-pink-400 to-purple-500",
  };

  const gradientClass =
    archetypeColors[character.archetype] || archetypeColors.default;

  return (
    <Link href={`/characters/${character.slug}`}>
      <Card
        className={cn(
          "overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer group",
          className
        )}
      >
        <CardContent className="p-0">
          {/* Avatar section */}
          <div
            className={cn(
              "h-32 bg-gradient-to-br flex items-center justify-center relative",
              gradientClass
            )}
          >
            {character.avatar_url ? (
              <img
                src={character.avatar_url}
                alt={character.name}
                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white text-3xl font-bold border-4 border-white/30">
                {character.name[0]}
              </div>
            )}

            {/* Premium badge */}
            {character.is_premium && (
              <Badge className="absolute top-2 right-2 bg-yellow-500 text-yellow-950">
                Premium
              </Badge>
            )}
          </div>

          {/* Info section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                {character.name}
              </h3>
              {relationship && (
                <Badge variant="secondary" className="text-xs">
                  {stageLabels[relationship.stage] || relationship.stage}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground capitalize mb-2">
              {character.archetype}
            </p>

            {character.short_backstory && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {character.short_backstory}
              </p>
            )}

            {/* Stats */}
            {relationship && (
              <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
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
