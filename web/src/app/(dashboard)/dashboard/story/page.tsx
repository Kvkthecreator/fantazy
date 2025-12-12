"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Star, ImageOff, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneMemory, RelationshipWithCharacter } from "@/types";

export default function OurStoryPage() {
  const [memories, setMemories] = useState<SceneMemory[]>([]);
  const [relationships, setRelationships] = useState<RelationshipWithCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // Load relationships for filter
  useEffect(() => {
    api.relationships.list()
      .then(setRelationships)
      .catch(console.error);
  }, []);

  // Load memories
  useEffect(() => {
    async function loadMemories() {
      setIsLoading(true);
      try {
        const params: { character_id?: string; limit?: number } = { limit: 50 };
        if (selectedCharacter !== "all") {
          params.character_id = selectedCharacter;
        }
        const data = await api.scenes.listMemories(params);
        setMemories(data);
      } catch (err) {
        console.error("Failed to load memories:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMemories();
  }, [selectedCharacter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Our Story</h1>
        <p className="text-muted-foreground">
          Moments you&apos;ve saved from your conversations
        </p>
      </div>

      {/* Character filter tabs */}
      {relationships.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCharacter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedCharacter("all")}
            className="rounded-full"
          >
            All
          </Button>
          {relationships.map((rel) => (
            <Button
              key={rel.character_id}
              variant={selectedCharacter === rel.character_id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedCharacter(rel.character_id)}
              className="rounded-full"
            >
              {rel.character_name}
            </Button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <MemoriesGridSkeleton />
      ) : memories.length === 0 ? (
        <EmptyState hasRelationships={relationships.length > 0} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memories.map((memory) => (
            <MemoryCard key={memory.image_id} memory={memory} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryCard({ memory }: { memory: SceneMemory }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      <div className="relative aspect-square bg-muted">
        {/* Star indicator */}
        <div className="absolute top-2 right-2 z-10">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 drop-shadow-md" />
        </div>

        {imageError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageOff className="h-12 w-12 text-muted-foreground/50" />
          </div>
        ) : (
          <>
            {!imageLoaded && (
              <Skeleton className="absolute inset-0" />
            )}
            <img
              src={memory.image_url}
              alt={memory.caption || "A saved moment"}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <CardContent className="p-4">
        {/* Caption */}
        <p className="text-sm italic text-foreground/80 line-clamp-2 mb-2">
          {memory.caption || "A moment captured..."}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">
            {memory.character_name}
          </span>
          <span>
            {new Date(memory.saved_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {/* Style tags */}
        {memory.style_tags && memory.style_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {memory.style_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ hasRelationships }: { hasRelationships: boolean }) {
  return (
    <Card className="py-16">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-3xl mb-6">
          <Star className="h-10 w-10" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No memories saved yet</h3>
        <p className="text-muted-foreground max-w-sm mb-6">
          {hasRelationships
            ? "During your conversations, tap the star icon on scene cards to save them as memories."
            : "Start chatting with a character and save special moments to your story."}
        </p>
        {hasRelationships ? (
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Continue a conversation
            </Button>
          </Link>
        ) : (
          <Link href="/dashboard/characters">
            <Button className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Meet someone new
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function MemoriesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-square" />
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
