"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api/client";
import type { EpisodeImage, SceneGenerateResponse } from "@/types";

interface UseScenesOptions {
  episodeId: string | null;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseScenesReturn {
  scenes: EpisodeImage[];
  isLoading: boolean;
  isGenerating: boolean;
  generateScene: (prompt?: string) => Promise<SceneGenerateResponse | null>;
  refreshScenes: () => Promise<void>;
}

export function useScenes({
  episodeId,
  enabled = true,
  onError,
}: UseScenesOptions): UseScenesReturn {
  const [scenes, setScenes] = useState<EpisodeImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const refreshScenes = useCallback(async () => {
    if (!episodeId) return;

    setIsLoading(true);
    try {
      const images = await api.scenes.listForEpisode(episodeId);
      setScenes(images);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [episodeId, onError]);

  const generateScene = useCallback(
    async (prompt?: string): Promise<SceneGenerateResponse | null> => {
      if (!episodeId || isGenerating) return null;

      setIsGenerating(true);
      try {
        const response = await api.scenes.generate({
          episode_id: episodeId,
          prompt,
          trigger_type: "user_request",
        });

        // Refresh scenes list to include the new one
        await refreshScenes();

        return response;
      } catch (error) {
        onError?.(error as Error);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [episodeId, isGenerating, onError, refreshScenes]
  );

  // Load scenes when episode changes
  useEffect(() => {
    if (enabled && episodeId) {
      refreshScenes();
    }
  }, [enabled, episodeId, refreshScenes]);

  return {
    scenes,
    isLoading,
    isGenerating,
    generateScene,
    refreshScenes,
  };
}
