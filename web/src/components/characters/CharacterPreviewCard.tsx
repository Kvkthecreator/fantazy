"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CharacterPreviewCardProps {
  name: string;
  archetype: string;
  description: string;
  className?: string;
}

export function CharacterPreviewCard({
  name,
  archetype,
  description,
  className,
}: CharacterPreviewCardProps) {
  return (
    <Card className={cn("h-full border border-border/70 bg-card shadow-sm", className)}>
      <CardContent className="flex h-full flex-col gap-2 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{name}</h3>
          <Badge variant="secondary" className="capitalize">
            {archetype}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
