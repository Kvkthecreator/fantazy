"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Play, Sparkles } from "lucide-react";
import { SparkCostConfirmModal } from "@/components/sparks/SparkCostConfirmModal";
import type { EpisodeTemplateSummary } from "@/types";

interface EpisodeSelectorProps {
  characterId: string;
  characterName: string;
  onSelectEpisode?: (templateId: string) => void;
  className?: string;
}

export function EpisodeSelector({
  characterId,
  characterName,
  onSelectEpisode,
  className,
}: EpisodeSelectorProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<EpisodeTemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Confirmation modal state
  const [pendingEpisode, setPendingEpisode] = useState<EpisodeTemplateSummary | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    api.episodeTemplates.listForCharacter(characterId)
      .then(setTemplates)
      .catch((err) => {
        console.error("Failed to load episode templates:", err);
        setTemplates([]);
      })
      .finally(() => setIsLoading(false));
  }, [characterId]);

  const handleSelect = (template: EpisodeTemplateSummary) => {
    if (isStarting) return;

    // If episode has a cost, show confirmation modal
    if (template.episode_cost > 0) {
      setPendingEpisode(template);
      setShowConfirmModal(true);
      return;
    }

    // Free episode - start directly
    startEpisode(template);
  };

  const startEpisode = async (template: EpisodeTemplateSummary) => {
    setSelectedId(template.id);
    setIsStarting(true);

    try {
      // Create relationship if needed, then navigate with episode template
      await api.relationships.create(characterId).catch(() => {
        // Relationship might already exist, that's fine
      });

      if (onSelectEpisode) {
        onSelectEpisode(template.id);
      } else {
        // Navigate to chat with episode template parameter
        router.push(`/chat/${characterId}?episode=${template.id}`);
      }
    } catch (err) {
      console.error("Failed to start episode:", err);
      setIsStarting(false);
      setSelectedId(null);
    }
  };

  const handleConfirmStart = () => {
    if (!pendingEpisode) return;
    setShowConfirmModal(false);
    startEpisode(pendingEpisode);
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setPendingEpisode(null);
  };

  if (isLoading) {
    return <EpisodeSelectorSkeleton />;
  }

  if (templates.length === 0) {
    return null; // No episodes available, hide selector
  }

  return (
    <>
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Choose your scene</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Pick where your story with {characterName} begins
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <EpisodeCard
              key={template.id}
              template={template}
              isSelected={selectedId === template.id}
              isLoading={isStarting && selectedId === template.id}
              onClick={() => handleSelect(template)}
            />
          ))}
        </div>
      </div>

      {/* Spark cost confirmation modal */}
      <SparkCostConfirmModal
        open={showConfirmModal}
        onClose={handleCancelConfirm}
        onConfirm={handleConfirmStart}
        cost={pendingEpisode?.episode_cost ?? 0}
        episodeTitle={pendingEpisode?.title ?? ""}
        isLoading={isStarting}
      />
    </>
  );
}

interface EpisodeCardProps {
  template: EpisodeTemplateSummary;
  isSelected?: boolean;
  isLoading?: boolean;
  onClick: () => void;
}

function EpisodeCard({ template, isSelected, isLoading, onClick }: EpisodeCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/40",
        "group",
        isSelected && "ring-2 ring-primary shadow-lg",
        isLoading && "pointer-events-none opacity-80"
      )}
      onClick={onClick}
    >
      {/* Background image */}
      <div className="aspect-[16/10] relative overflow-hidden">
        {template.background_image_url ? (
          <img
            src={template.background_image_url}
            alt={template.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-accent/20 to-muted flex items-center justify-center">
            <span className="text-4xl font-bold text-muted-foreground/30">
              {template.episode_number}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Play indicator on hover */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          isLoading && "opacity-100"
        )}>
          <div className={cn(
            "h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg",
            isLoading && "animate-pulse"
          )}>
            <Play className="h-5 w-5 text-primary ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Episode number badge */}
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 bg-black/50 text-white border-0 text-[10px]"
        >
          Episode {template.episode_number}
        </Badge>

        {/* Cost badge - show for paid episodes */}
        {template.episode_cost > 0 && (
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 bg-amber-500/90 text-white border-0 text-[10px] flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            {template.episode_cost}
          </Badge>
        )}

        {/* Default badge - only show if no cost badge */}
        {template.is_default && template.episode_cost === 0 && (
          <Badge
            className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px]"
          >
            Start Here
          </Badge>
        )}

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h4 className="font-semibold text-white text-sm line-clamp-2 drop-shadow-md">
            {template.title}
          </h4>
        </div>
      </div>
    </Card>
  );
}

function EpisodeSelectorSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[16/10] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export { EpisodeCard };
