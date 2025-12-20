"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Share2, Check, RefreshCw } from "lucide-react";
import { TROPE_CONTENT } from "@/lib/quiz-data";
import type { RomanticTrope } from "@/types";
import { TROPE_VISUALS } from "@/types";

interface QuizResultProps {
  trope: RomanticTrope;
  onPlayAgain: () => void;
}

// Episode 0 series data - static for now
const EPISODE_0_SERIES = [
  {
    id: "hometown-crush",
    title: "Hometown Crush",
    slug: "hometown-crush",
    tagline: "Running into your ex at a friend's wedding",
    coverUrl: null, // Will use gradient fallback
  },
  {
    id: "coffee-shop-crush",
    title: "Coffee Shop Crush",
    slug: "coffee-shop-crush",
    tagline: "The barista who remembers your order",
    coverUrl: null,
  },
];

export function QuizResult({ trope, onPlayAgain }: QuizResultProps) {
  const [copied, setCopied] = useState(false);
  const content = TROPE_CONTENT[trope];
  const visuals = TROPE_VISUALS[trope];

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/play`;
    const shareText = content.shareText;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `I'm a ${content.title}!`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8">
      {/* Result Card */}
      <Card className="w-full max-w-md p-6 shadow-xl">
        {/* Emoji */}
        <div className="text-6xl text-center mb-3">{visuals.emoji}</div>

        {/* Pre-title */}
        <p className="text-center text-muted-foreground text-sm mb-2">
          your red flag is...
        </p>

        {/* Title */}
        <h1
          className={cn(
            "text-3xl font-black text-center mb-2 tracking-tight",
            visuals.color
          )}
        >
          {content.title}
        </h1>

        {/* Tagline */}
        <p className="text-center text-muted-foreground text-sm mb-6">
          {content.tagline}
        </p>

        {/* Description */}
        <div className="mb-6 text-sm leading-relaxed text-center">
          {content.description}
        </div>

        {/* Your People */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2 text-center uppercase tracking-wider">
            your people
          </p>
          <p className="text-sm text-center text-muted-foreground">
            {content.yourPeople.join(" • ")}
          </p>
        </div>
      </Card>

      {/* Primary CTA - Share */}
      <div className="mt-6 w-full max-w-md">
        <Button
          onClick={handleShare}
          size="lg"
          className="w-full py-6 text-lg font-semibold rounded-full"
        >
          {copied ? (
            <>
              <Check className="h-5 w-5 mr-2" />
              copied!
            </>
          ) : (
            <>
              <Share2 className="h-5 w-5 mr-2" />
              share result
            </>
          )}
        </Button>
      </div>

      {/* Secondary: Play Again */}
      <div className="mt-4 w-full max-w-md">
        <Button
          onClick={onPlayAgain}
          variant="outline"
          className="w-full py-3 rounded-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          try again
        </Button>
      </div>

      {/* Episode 0 CTA Section */}
      <div className="mt-12 w-full max-w-md">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-1">ready for the real thing?</h3>
          <p className="text-sm text-muted-foreground">
            try episode 0 — free interactive romance stories
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {EPISODE_0_SERIES.map((series) => (
            <Link
              key={series.id}
              href={`/series/${series.slug}`}
              className="group"
            >
              <Card className="overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all">
                {/* Cover image placeholder */}
                <div className="aspect-[4/3] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary/30">
                    {series.title[0]}
                  </span>
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-1">
                    {series.title}
                  </h4>
                  {series.tagline && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {series.tagline}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-muted-foreground/60 text-xs">
        <a href="/" className="hover:text-foreground transition-colors">
          ep-0.com/play
        </a>
      </div>
    </div>
  );
}
