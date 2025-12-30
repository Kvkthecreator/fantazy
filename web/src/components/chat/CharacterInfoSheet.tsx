"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Heart, ThumbsDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Character } from "@/types";

interface CharacterInfoSheetProps {
  character: Character;
  isOpen: boolean;
  onClose: () => void;
  hasBackground?: boolean;
}

export function CharacterInfoSheet({
  character,
  isOpen,
  onClose,
  hasBackground = false,
}: CharacterInfoSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet - bottom on mobile, right side on desktop */}
      <div
        className={cn(
          "absolute animate-in duration-300",
          // Mobile: bottom sheet
          "bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl",
          // Desktop: side panel
          "sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:w-96 sm:max-h-full sm:rounded-t-none sm:rounded-l-2xl",
          "slide-in-from-bottom sm:slide-in-from-right",
          hasBackground
            ? "bg-gray-900/95 backdrop-blur-xl"
            : "bg-card"
        )}
      >
        {/* Handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className={cn(
            "w-10 h-1 rounded-full",
            hasBackground ? "bg-white/30" : "bg-muted-foreground/30"
          )} />
        </div>

        {/* Header */}
        <div className={cn(
          "flex items-start justify-between px-4 py-3 border-b",
          hasBackground ? "border-white/10" : "border-border"
        )}>
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="h-14 w-14 rounded-full overflow-hidden bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0">
              {character.avatar_url ? (
                <img
                  src={character.avatar_url}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
                  {character.name[0]}
                </div>
              )}
            </div>
            <div>
              <h2 className={cn(
                "font-semibold text-lg",
                hasBackground && "text-white"
              )}>
                {character.name}
              </h2>
              <p className={cn(
                "text-sm capitalize",
                hasBackground ? "text-white/70" : "text-muted-foreground"
              )}>
                {character.archetype}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={cn(
              "h-8 w-8 rounded-full",
              hasBackground
                ? "text-white/70 hover:text-white hover:bg-white/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-120px)] sm:max-h-[calc(100vh-120px)] p-4 space-y-4">
          {/* Large Avatar Image */}
          {character.avatar_url && (
            <div className="flex justify-center -mt-2 mb-2">
              <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/10">
                <img
                  src={character.avatar_url}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Backstory */}
          {character.backstory && (
            <div>
              <h3 className={cn(
                "text-sm font-medium mb-2",
                hasBackground ? "text-white/90" : "text-foreground"
              )}>
                About
              </h3>
              <p className={cn(
                "text-sm leading-relaxed whitespace-pre-line",
                hasBackground ? "text-white/70" : "text-muted-foreground"
              )}>
                {character.backstory}
              </p>
            </div>
          )}

          {/* Likes */}
          {character.likes && character.likes.length > 0 && (
            <div>
              <h3 className={cn(
                "text-sm font-medium mb-2 flex items-center gap-1.5",
                hasBackground ? "text-white/90" : "text-foreground"
              )}>
                <Heart className="h-3.5 w-3.5 text-pink-500" />
                Likes
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {character.likes.map((like, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      hasBackground && "bg-white/10 text-white/80 hover:bg-white/15"
                    )}
                  >
                    {like}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Dislikes */}
          {character.dislikes && character.dislikes.length > 0 && (
            <div>
              <h3 className={cn(
                "text-sm font-medium mb-2 flex items-center gap-1.5",
                hasBackground ? "text-white/90" : "text-foreground"
              )}>
                <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />
                Dislikes
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {character.dislikes.map((dislike, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={cn(
                      "text-xs",
                      hasBackground && "border-white/20 text-white/70"
                    )}
                  >
                    {dislike}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          "p-4 border-t pb-[calc(1rem+env(safe-area-inset-bottom))]",
          hasBackground ? "border-white/10" : "border-border"
        )}>
          <Link href={`/characters/${character.slug}`}>
            <Button
              variant="outline"
              className={cn(
                "w-full gap-2",
                hasBackground && "border-white/20 text-white hover:bg-white/10"
              )}
            >
              <ExternalLink className="h-4 w-4" />
              View Full Profile
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
