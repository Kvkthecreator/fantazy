"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import { api } from "@/lib/api/client";
import type { EpisodeDiscoveryItem } from "@/types";

interface EpisodeDiscoveryCardProps {
  episode: EpisodeDiscoveryItem;
  className?: string;
}

/**
 * Episode card for discovery/browse UI.
 * Shows situation teaser + character context.
 * Click navigates directly to chat with this episode.
 */
export function EpisodeDiscoveryCard({ episode, className }: EpisodeDiscoveryCardProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const handleClick = async () => {
    if (isStarting) return;
    setIsStarting(true);

    try {
      // Ensure relationship exists
      await api.relationships.create(episode.character_id).catch(() => {
        // May already exist
      });
      router.push(`/chat/${episode.character_id}?episode=${episode.id}`);
    } catch (err) {
      console.error("Failed to start episode:", err);
      setIsStarting(false);
    }
  };

  // Truncate situation for teaser
  const situationTeaser = episode.situation.length > 80
    ? episode.situation.slice(0, 80).trim() + "..."
    : episode.situation;

  return (
    <Card
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-xl hover:-translate-y-1 hover:ring-2 hover:ring-primary/50",
        "group",
        isStarting && "pointer-events-none opacity-80",
        className
      )}
      onClick={handleClick}
    >
      {/* Background image */}
      <div className="aspect-[16/10] relative overflow-hidden">
        {episode.background_image_url ? (
          <img
            src={episode.background_image_url}
            alt={episode.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 via-accent/20 to-muted" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Play indicator */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          isStarting && "opacity-100"
        )}>
          <div className={cn(
            "h-14 w-14 rounded-full bg-white/95 flex items-center justify-center shadow-xl",
            isStarting && "animate-pulse"
          )}>
            <Play className="h-6 w-6 text-primary ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Archetype badge */}
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 bg-black/60 text-white border-0 text-[10px] capitalize"
        >
          {episode.character_archetype}
        </Badge>

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Situation teaser */}
          <p className="text-white/90 text-xs italic line-clamp-2 drop-shadow-md">
            &ldquo;{situationTeaser}&rdquo;
          </p>

          {/* Title */}
          <h4 className="font-semibold text-white text-sm line-clamp-1 drop-shadow-md">
            {episode.title}
          </h4>

          {/* Character info */}
          <div className="flex items-center gap-2">
            {episode.character_avatar_url ? (
              <img
                src={episode.character_avatar_url}
                alt={episode.character_name}
                className="h-6 w-6 rounded-full border border-white/30 object-cover"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-primary/50 flex items-center justify-center text-[10px] font-semibold text-white">
                {episode.character_name[0]}
              </div>
            )}
            <Link
              href={`/characters/${episode.character_slug}`}
              className="text-xs text-white/80 hover:text-white hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {episode.character_name}
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
