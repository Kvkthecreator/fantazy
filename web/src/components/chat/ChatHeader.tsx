"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Character } from "@/types";

interface ChatHeaderProps {
  character: Character;
  hasBackground?: boolean;
}

export function ChatHeader({
  character,
  hasBackground = false,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Back button */}
        <Link href="/dashboard">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8",
              hasBackground && "text-white hover:bg-white/10"
            )}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
        </Link>

        {/* Avatar */}
        <Link href={`/characters/${character.slug}`} className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-medium shadow-sm">
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
          <span className={cn(
            "absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 rounded-full",
            hasBackground ? "border-black/30" : "border-background"
          )} />
        </Link>

        {/* Character name */}
        <h1 className={cn(
          "font-semibold text-sm",
          hasBackground && "text-white"
        )}>{character.name}</h1>
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
