"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EpisodeCardProps {
  title: string;
  subtitle?: string;
  hook: string;
  badge?: string;
  href: string;
  imageUrl?: string | null;
  meta?: string;
  ctaText?: string;
  tone?: "default" | "primary";
}

export function EpisodeCard({
  title,
  subtitle,
  hook,
  badge,
  href,
  imageUrl,
  meta,
  ctaText = "Start Episode",
  tone = "default",
}: EpisodeCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border border-border/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        tone === "primary" && "ring-2 ring-primary/25"
      )}
    >
      <Link href={href}>
        <div className="relative h-40 w-full overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-muted-foreground/60">
              {title[0]}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
          <div className="absolute left-3 bottom-3 space-y-1 text-white drop-shadow">
            {badge && (
              <Badge className="w-fit bg-white/90 text-foreground shadow-sm">{badge}</Badge>
            )}
            <div className="text-lg font-semibold">{title}</div>
            {subtitle && <div className="text-xs text-white/80">{subtitle}</div>}
          </div>
        </div>
      </Link>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm text-foreground">{hook}</p>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        <Button asChild className="w-full">
          <Link href={href}>{ctaText}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
