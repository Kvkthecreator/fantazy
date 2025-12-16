"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EpisodeCard } from "@/components/episodes/EpisodeCard";
import type { CharacterSummary, RelationshipWithCharacter, User } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [relationships, setRelationships] = useState<RelationshipWithCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        // Load data in parallel
        const [userData, charactersData, relationshipsData] = await Promise.all([
          api.users.me().catch(() => null),
          api.characters.list(),
          api.relationships.list().catch(() => []),
        ]);

        setUser(userData);
        setCharacters(charactersData);
        setRelationships(relationshipsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const relationshipCharacterIds = new Set(relationships.map((r) => r.character_id));
  const myCharacters = characters.filter((c) => relationshipCharacterIds.has(c.id));
  const newCharacters = characters.filter((c) => !relationshipCharacterIds.has(c.id));
  const sortedRelationships = [...relationships].sort((a, b) => {
    const timeA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
    const timeB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
    return timeB - timeA;
  });
  const heroRelationship = sortedRelationships[0];
  const heroCharacter = heroRelationship
    ? characters.find((c) => c.id === heroRelationship.character_id)
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {user?.display_name ? `Hey, ${user.display_name}` : "Welcome back"}
          </h1>
          <p className="text-muted-foreground">
            Your cozy companions are waiting for you.
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load data</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Continue / Hero */}
      {heroRelationship && heroCharacter ? (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Continue</h2>
          <EpisodeCard
            title={heroCharacter.name}
            subtitle={`${heroCharacter.archetype}`}
            hook={
              heroCharacter.short_backstory ||
              "Pick up where you left off—your episode is still unfolding."
            }
            badge={heroRelationship.stage === "acquaintance" ? "Episode 0" : "Episode in progress"}
            href={`/chat/${heroRelationship.character_id}`}
            imageUrl={heroCharacter.avatar_url}
            meta={
              heroRelationship.last_interaction_at
                ? `Last chat ${formatRelativeTime(heroRelationship.last_interaction_at)}`
                : undefined
            }
            ctaText="Resume Episode"
            tone="primary"
          />
        </section>
      ) : null}

      {/* Next Episodes */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Next Episodes</h2>
        <p className="text-sm text-muted-foreground">
          Start Episode 0 or move to the next beat with characters you’ve met.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {sortedRelationships.slice(heroRelationship ? 1 : 0, (heroRelationship ? 1 : 0) + 4).map((rel) => {
            const character = characters.find((c) => c.id === rel.character_id);
            if (!character) return null;
            return (
              <EpisodeCard
                key={rel.id}
                title={character.name}
                subtitle={`${character.archetype}`}
                hook={
                  character.short_backstory ||
                  "A new episode is ready. Step back into the moment."
                }
                badge={rel.stage === "acquaintance" ? "Episode 0" : `Stage: ${rel.stage}`}
                href={`/chat/${rel.character_id}`}
                imageUrl={character.avatar_url}
                meta={
                  rel.last_interaction_at
                    ? `Last chat ${formatRelativeTime(rel.last_interaction_at)}`
                    : `${rel.total_messages} messages • ${rel.total_episodes} episodes`
                }
                ctaText="Resume"
              />
            );
          })}

          {/* New characters as Episode 0 */}
          {newCharacters.slice(0, 4).map((character) => (
            <EpisodeCard
              key={character.id}
              title={character.name}
              subtitle={`${character.archetype}`}
              hook={character.short_backstory || "Episode 0: meet for the first time."}
              badge="Episode 0"
              href={`/chat/${character.id}`}
              imageUrl={character.avatar_url}
              meta="New story"
              ctaText="Start Episode 0"
            />
          ))}
        </div>
      </section>

      {/* Empty state */}
      {characters.length === 0 && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-2xl mb-4">
              ✨
            </div>
            <h3 className="text-lg font-semibold mb-2">No characters available</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Characters are being prepared. Check back soon to meet your cozy companions!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
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
