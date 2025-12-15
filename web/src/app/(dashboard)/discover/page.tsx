"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { CharacterGrid } from "@/components/characters";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CharacterSummary } from "@/types";
import { SectionHeader } from "@/components/ui/section-header";

export default function DiscoverPage() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [archetypes, setArchetypes] = useState<string[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [charactersData, archetypesData] = await Promise.all([
          api.characters.list(),
          api.characters.archetypes(),
        ]);
        setCharacters(charactersData);
        setArchetypes(archetypesData);
      } catch (err) {
        console.error("Failed to load characters:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredCharacters = selectedArchetype
    ? characters.filter((c) => c.archetype === selectedArchetype)
    : characters;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Discover"
        description="Find your next cozy companion."
      />

      {/* Archetype filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedArchetype === null ? "default" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => setSelectedArchetype(null)}
        >
          All
        </Button>
        {archetypes.map((archetype) => (
          <Button
            key={archetype}
            variant={selectedArchetype === archetype ? "default" : "outline"}
            size="sm"
            className={cn(
              "rounded-full capitalize",
              selectedArchetype === archetype && "bg-primary"
            )}
            onClick={() => setSelectedArchetype(archetype)}
          >
            {archetype}
          </Button>
        ))}
      </div>

      {/* Character grid */}
      {filteredCharacters.length > 0 ? (
        <CharacterGrid characters={filteredCharacters} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">No characters found</p>
          {selectedArchetype && (
            <Button
              variant="link"
              onClick={() => setSelectedArchetype(null)}
              className="mt-2"
            >
              Clear filter
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
