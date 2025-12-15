"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Clock } from "lucide-react";
import type { RelationshipWithCharacter } from "@/types";

export default function MyChatsPage() {
  const [relationships, setRelationships] = useState<RelationshipWithCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.relationships.list();
        setRelationships(data);
      } catch (err) {
        console.error("Failed to load relationships:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const sortedRelationships = useMemo(() => {
    return [...relationships].sort((a, b) => {
      const timeA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
      const timeB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [relationships]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Chats</h1>
        <p className="text-muted-foreground">
          Continue your conversations
        </p>
      </div>

      {sortedRelationships.length === 0 ? (
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
          {sortedRelationships.map((rel) => (
            <Link key={rel.id} href={`/chat/${rel.character_id}`}>
              <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted">
                      {rel.character_avatar_url ? (
                        <img
                          src={rel.character_avatar_url}
                          alt={rel.character_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl font-bold text-muted-foreground">
                          {rel.character_name[0]}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold">{rel.character_name}</h3>
                        <Badge variant="secondary" className="text-[11px]">
                          {stageLabels[rel.stage] || rel.stage}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {rel.character_archetype}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{rel.total_messages} messages</span>
                        <span>•</span>
                        <span>{rel.total_episodes} episodes</span>
                        <span>•</span>
                        <span>
                          {rel.last_interaction_at
                            ? formatRelativeTime(rel.last_interaction_at)
                            : "No chats yet"}
                        </span>
                      </div>
                    </div>

                    <div className="text-muted-foreground">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
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
