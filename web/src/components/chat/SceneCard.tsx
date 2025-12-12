"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import type { EpisodeImage, SceneGenerateResponse } from "@/types";

interface SceneCardProps {
  scene: EpisodeImage | SceneGenerateResponse;
  onMemoryToggle?: (isMemory: boolean) => void;
}

export function SceneCard({ scene, onMemoryToggle }: SceneCardProps) {
  const [isMemory, setIsMemory] = useState(
    "is_memory" in scene ? scene.is_memory : false
  );
  const [isSaving, setIsSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const episodeImageId = "id" in scene ? scene.id : null;

  const handleToggleMemory = async () => {
    if (!episodeImageId || isSaving) return;

    setIsSaving(true);
    try {
      const updated = await api.scenes.toggleMemory(episodeImageId, !isMemory);
      setIsMemory(updated.is_memory);
      onMemoryToggle?.(updated.is_memory);
    } catch (error) {
      console.error("Failed to toggle memory:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full my-4">
      <div className="relative rounded-xl overflow-hidden bg-muted/30 border border-border/50 shadow-sm">
        {/* Image */}
        <div className="relative aspect-square">
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <p className="text-sm text-muted-foreground">Failed to load image</p>
            </div>
          ) : (
            <img
              src={scene.image_url}
              alt={scene.caption || "Scene"}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}
        </div>

        {/* Caption and save button */}
        <div className="p-3 bg-gradient-to-t from-background/90 to-background/50">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-foreground/80 italic flex-1">
              {scene.caption || "A moment captured..."}
            </p>
            {episodeImageId && (
              <button
                onClick={handleToggleMemory}
                disabled={isSaving}
                className={cn(
                  "flex-shrink-0 p-1.5 rounded-full transition-colors",
                  isMemory
                    ? "text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20"
                    : "text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10"
                )}
                title={isMemory ? "Remove from memories" : "Save as memory"}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Star
                    className={cn("h-4 w-4", isMemory && "fill-current")}
                  />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SceneCardSkeletonProps {
  caption?: string;
}

export function SceneCardSkeleton({ caption }: SceneCardSkeletonProps) {
  return (
    <div className="w-full my-4">
      <div className="relative rounded-xl overflow-hidden bg-muted/30 border border-border/50 shadow-sm">
        {/* Loading state */}
        <div className="relative aspect-square flex items-center justify-center bg-muted/50">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Creating scene...
            </p>
          </div>
        </div>

        {/* Caption placeholder */}
        <div className="p-3 bg-gradient-to-t from-background/90 to-background/50">
          <p className="text-sm text-muted-foreground italic">
            {caption || "Visualizing the moment..."}
          </p>
        </div>
      </div>
    </div>
  );
}
