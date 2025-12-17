"use client";

import { useState } from "react";
import { Star, Loader2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import type { EpisodeImage, SceneGenerateResponse } from "@/types";

interface SceneCardProps {
  scene: EpisodeImage | SceneGenerateResponse;
  onMemoryToggle?: (isMemory: boolean) => void;
  isLatest?: boolean;
}

export function SceneCard({ scene, onMemoryToggle, isLatest = false }: SceneCardProps) {
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

  // When this scene is the latest (shown as background), display a minimal inline indicator
  if (isLatest) {
    return (
      <div className="my-4 flex justify-center">
        <div className={cn(
          "inline-flex items-center gap-3 rounded-full px-4 py-2",
          "backdrop-blur-xl backdrop-saturate-150",
          "bg-black/40 border border-white/20 shadow-lg"
        )}>
          <Maximize2 className="h-4 w-4 text-white/70" />
          <p className="text-sm text-white/90 italic">
            {scene.caption || "Scene visualized"}
          </p>
          {episodeImageId && (
            <button
              onClick={handleToggleMemory}
              disabled={isSaving}
              className={cn(
                "rounded-full p-1.5 transition-colors",
                isMemory
                  ? "text-yellow-300"
                  : "text-white/60 hover:text-white"
              )}
              title={isMemory ? "Remove from memories" : "Save as memory"}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Star className={cn("h-4 w-4", isMemory && "fill-current")} />
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Regular scene card for non-latest scenes
  return (
    <div className="my-4 w-full">
      <div className={cn(
        "relative overflow-hidden rounded-2xl shadow-xl",
        "ring-1 ring-white/10"
      )}>
        {/* Image */}
        <div className="relative aspect-[16/9]">
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            </div>
          )}
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <p className="text-sm text-white/80">Failed to load image</p>
            </div>
          ) : (
            <img
              src={scene.image_url}
              alt={scene.caption || "Scene"}
              className={cn(
                "h-full w-full object-cover transition-all duration-500",
                imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}
          {/* Cinematic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        </div>

        {/* Caption and save button */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 px-4 py-3">
          <p className="flex-1 text-sm italic text-white drop-shadow-lg leading-relaxed">
            {scene.caption || "A moment captured..."}
          </p>
          {episodeImageId && (
            <button
              onClick={handleToggleMemory}
              disabled={isSaving}
              className={cn(
                "flex-shrink-0 rounded-full p-2.5 backdrop-blur-md transition-all",
                "border border-white/20 shadow-lg",
                isMemory
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
              )}
              title={isMemory ? "Remove from memories" : "Save as memory"}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Star className={cn("h-4 w-4", isMemory && "fill-current")} />
              )}
            </button>
          )}
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
    <div className="my-4 w-full">
      <div className="relative overflow-hidden rounded-2xl bg-black/20 shadow-lg backdrop-blur-sm">
        <div className="relative flex aspect-[16/9] items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">{caption || "Visualizing the moment..."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
