"use client";

import { CharacterCard } from "./CharacterCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { CharacterSummary, RelationshipWithCharacter } from "@/types";

interface CharacterGridProps {
  characters: CharacterSummary[];
  relationships?: RelationshipWithCharacter[];
  isLoading?: boolean;
}

export function CharacterGrid({
  characters,
  relationships = [],
  isLoading = false,
}: CharacterGridProps) {
  if (isLoading) {
    return <CharacterGridSkeleton />;
  }

  if (characters.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No characters found</p>
      </div>
    );
  }

  // Create a map for quick relationship lookup
  const relationshipMap = new Map(
    relationships.map((r) => [r.character_id, r])
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          relationship={relationshipMap.get(character.id)}
        />
      ))}
    </div>
  );
}

function CharacterGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg overflow-hidden border">
          <Skeleton className="h-32 w-full" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
