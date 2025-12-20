"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Play, Sparkles, Heart } from "lucide-react";

export default function PlayPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background gradient - matches series design */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-500/5 to-pink-500/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center min-h-screen px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Play Mode
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Quick, Shareable Experiences
          </h1>
          <p className="text-muted-foreground">
            Discover something about yourself through a short conversation.
            Share your results with friends.
          </p>
        </div>

        {/* Game Cards */}
        <div className="w-full max-w-2xl space-y-4">
          {/* The Flirt Test - Featured */}
          <GameCard
            title="The Flirt Test"
            tagline="4 turns. 1 trope. No hiding."
            description="Flirt with an AI stranger. Find out if you're a Slow Burn, All In, Chaos Agent, or something else entirely."
            featured
            onClick={() => router.push("/play/hometown-crush")}
          />
        </div>

        {/* Info */}
        <div className="mt-12 text-center text-muted-foreground text-sm max-w-md">
          <p>
            Each experience takes about 2 minutes. Share your results and compare with friends.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-muted-foreground/60 text-xs">
          <a href="/" className="hover:text-foreground transition-colors">
            ep-0.com
          </a>
        </div>
      </div>
    </div>
  );
}

interface GameCardProps {
  title: string;
  tagline: string;
  description: string;
  featured?: boolean;
  onClick: () => void;
}

function GameCard({
  title,
  tagline,
  description,
  featured,
  onClick,
}: GameCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-xl hover:-translate-y-1 hover:ring-2 hover:ring-primary/50",
        "group",
        featured && "ring-2 ring-primary/30"
      )}
    >
      {/* Background gradient */}
      <div className="relative overflow-hidden aspect-[21/9]">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 via-purple-500/30 to-pink-500/20" />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Play indicator on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="h-14 w-14 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
            <Play className="h-6 w-6 text-primary ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Featured badge */}
        {featured && (
          <Badge
            variant="secondary"
            className="absolute top-3 left-3 bg-primary text-primary-foreground border-0"
          >
            <Heart className="h-3 w-3 mr-1" />
            New
          </Badge>
        )}

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h2 className="text-xl font-bold text-white drop-shadow-md mb-1">
            {title}
          </h2>
          <p className="text-white/80 text-sm italic mb-2">
            {tagline}
          </p>
          <p className="text-white/70 text-sm leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}
