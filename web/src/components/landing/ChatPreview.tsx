"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ChatPreviewProps {
  characterName?: string;
  characterAvatarUrl?: string;
  className?: string;
}

export function ChatPreview({
  characterName = "Min Soo",
  characterAvatarUrl,
  className,
}: ChatPreviewProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(characterAvatarUrl || null);
  const [sceneUrl, setSceneUrl] = useState<string | null>(null);

  // Fetch Min Soo's avatar and K-pop series cover from API
  useEffect(() => {
    if (characterAvatarUrl) return;

    // Fetch character avatar
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://api.ep-0.com"}/characters?limit=50`)
      .then((res) => res.json())
      .then((characters) => {
        const minSoo = characters.find((c: { slug: string }) => c.slug === "min-soo");
        if (minSoo?.avatar_url) {
          setAvatarUrl(minSoo.avatar_url);
        }
      })
      .catch(() => {});

    // Fetch series cover for scene image
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://api.ep-0.com"}/series?featured=true&limit=6`)
      .then((res) => res.json())
      .then((series) => {
        const kpopSeries = series.find((s: { slug: string }) => s.slug === "k-pop-boy-idol");
        if (kpopSeries?.cover_image_url) {
          setSceneUrl(kpopSeries.cover_image_url);
        }
      })
      .catch(() => {});
  }, [characterAvatarUrl]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card/50 backdrop-blur-sm shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card/80 px-4 py-3">
        <div className="relative h-9 w-9 overflow-hidden rounded-full shadow-lg ring-2 ring-white/20">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={characterName}
              className="h-full w-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.parentElement!.innerHTML = `<div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-400 to-purple-500 text-sm font-medium text-white">${characterName[0]}</div>`;
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-400 to-purple-500 text-sm font-medium text-white">
              {characterName[0]}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{characterName}</p>
          <p className="text-xs text-muted-foreground">typing...</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3 p-4">
        {/* Character message */}
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm text-foreground">
            You&apos;re not supposed to be back here.
          </div>
        </div>

        {/* User message */}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            Neither are you.
          </div>
        </div>

        {/* Scene image - replaces the "..." */}
        <div className="flex justify-start">
          <div className="max-w-[85%] overflow-hidden rounded-2xl rounded-tl-md">
            {sceneUrl ? (
              <img
                src={sceneUrl}
                alt="Scene"
                className="h-24 w-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.parentElement!.innerHTML = `
                    <div class="h-24 w-full bg-gradient-to-br from-purple-900 via-pink-900 to-slate-900 flex items-center justify-center">
                      <span class="text-white/60 text-xs italic">The neon lights flicker overhead...</span>
                    </div>
                  `;
                }}
              />
            ) : (
              <div className="h-24 w-48 bg-gradient-to-br from-purple-900 via-pink-900 to-slate-900 flex items-center justify-center">
                <span className="text-white/60 text-xs italic px-3 text-center">The neon lights flicker overhead...</span>
              </div>
            )}
          </div>
        </div>

        {/* Character follow-up */}
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm text-foreground">
            Fair point. You&apos;re not going to post about this, are you?
          </div>
        </div>

        {/* Typing indicator */}
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-3">
            <div className="flex items-center gap-1">
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Input mock */}
      <div className="border-t bg-card/80 px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground">
          <span>What do you say?</span>
          <span className="ml-auto text-xs opacity-50">Press enter</span>
        </div>
      </div>
    </div>
  );
}
