"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";
import type { RelationshipWithCharacter } from "@/types";

export default function MyChatsPage() {
  const [relationships, setRelationships] = useState<RelationshipWithCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.relationships.list();
        // Sort by last interaction (most recent first)
        data.sort((a, b) => {
          const dateA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
          const dateB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
          return dateB - dateA;
        });
        setRelationships(data);
      } catch (err) {
        console.error("Failed to load relationships:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Chats</h1>
        <p className="text-muted-foreground">
          Continue your conversations
        </p>
      </div>

      {relationships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">No chats yet</p>
          <Link
            href="/discover"
            className="text-primary hover:underline"
          >
            Discover characters to chat with
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {relationships.map((rel) => {
            const gradientClass = archetypeColors[rel.character_archetype] || archetypeColors.default;

            return (
              <Link key={rel.id} href={`/chat/${rel.character_id}`}>
                <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div
                        className={cn(
                          "w-14 h-14 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-br",
                          gradientClass
                        )}
                      >
                        {rel.character_avatar_url ? (
                          <img
                            src={rel.character_avatar_url}
                            alt={rel.character_name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-white"
                          />
                        ) : (
                          <span className="text-white text-xl font-bold">
                            {rel.character_name[0]}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold truncate">{rel.character_name}</h3>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {stageLabels[rel.stage] || rel.stage}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                          {rel.character_archetype}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{rel.total_episodes} episodes</span>
                          <span>&bull;</span>
                          <span>{rel.total_messages} messages</span>
                          {rel.last_interaction_at && (
                            <>
                              <span>&bull;</span>
                              <span>{formatRelativeTime(rel.last_interaction_at)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="text-muted-foreground">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
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
