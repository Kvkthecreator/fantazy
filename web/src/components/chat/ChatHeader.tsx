"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Character, Relationship, Episode } from "@/types";

interface ChatHeaderProps {
  character: Character;
  relationship?: Relationship | null;
  episode?: Episode | null;
  onEndEpisode?: () => void;
}

export function ChatHeader({
  character,
  relationship,
  episode,
  onEndEpisode,
}: ChatHeaderProps) {
  const stageLabels: Record<string, string> = {
    acquaintance: "Just Met",
    friendly: "Friendly",
    close: "Close",
    intimate: "Special",
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        {/* Back button */}
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeftIcon className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
        </Link>

        {/* Avatar */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-medium">
            {character.avatar_url ? (
              <img
                src={character.avatar_url}
                alt={character.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              character.name[0]
            )}
          </div>
          {/* Online indicator */}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
        </div>

        {/* Character info */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm">{character.name}</h1>
            {relationship && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {stageLabels[relationship.stage] || relationship.stage}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {character.archetype.charAt(0).toUpperCase() +
              character.archetype.slice(1)}
            {episode && ` • Episode ${episode.episode_number}`}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {episode?.is_active && onEndEpisode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEndEpisode}
            className="text-xs"
          >
            End Episode
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreIcon className="h-4 w-4" />
          <span className="sr-only">More options</span>
        </Button>
      </div>
    </header>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}
