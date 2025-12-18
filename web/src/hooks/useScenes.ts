"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api, APIError } from "@/lib/api/client";
import type { EpisodeImage, SceneGenerateResponse, QuotaExceededError, InsufficientSparksError, SceneGenerationMode } from "@/types";

interface UseScenesOptions {
  episodeId: string | null;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onQuotaExceeded?: (error: QuotaExceededError) => void;
  onInsufficientSparks?: (error: InsufficientSparksError) => void;
}

interface UseScenesReturn {
  scenes: EpisodeImage[];
  isLoading: boolean;
  isGenerating: boolean;
  generateScene: (prompt?: string, mode?: SceneGenerationMode) => Promise<SceneGenerateResponse | null>;
  refreshScenes: () => Promise<void>;
  quotaExceeded: boolean;
}

export function useScenes({
  episodeId,
  enabled = true,
  onError,
  onQuotaExceeded,
  onInsufficientSparks,
}: UseScenesOptions): UseScenesReturn {
  const [scenes, setScenes] = useState<EpisodeImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Store callbacks in refs to avoid dependency issues
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onQuotaExceededRef = useRef(onQuotaExceeded);
  onQuotaExceededRef.current = onQuotaExceeded;
  const onInsufficientSparksRef = useRef(onInsufficientSparks);
  onInsufficientSparksRef.current = onInsufficientSparks;

  // Track if we've already loaded for this episodeId
  const loadedEpisodeRef = useRef<string | null>(null);

  const refreshScenes = useCallback(async () => {
    if (!episodeId) return;

    setIsLoading(true);
    try {
      const images = await api.scenes.listForEpisode(episodeId);
      setScenes(images);
    } catch (error) {
      onErrorRef.current?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [episodeId]);

  const generateScene = useCallback(
    async (prompt?: string, mode?: SceneGenerationMode): Promise<SceneGenerateResponse | null> => {
      if (!episodeId || isGenerating) return null;

      setIsGenerating(true);
      setQuotaExceeded(false);
      try {
        const response = await api.scenes.generate({
          episode_id: episodeId,
          prompt,
          trigger_type: "user_request",
          generation_mode: mode,
        });

        // Refresh scenes list to include the new one
        await refreshScenes();

        return response;
      } catch (error) {
        // Check if this is a quota exceeded error (429)
        if (error instanceof APIError && error.status === 429) {
          const quotaError = error.data as QuotaExceededError;
          setQuotaExceeded(true);
          onQuotaExceededRef.current?.(quotaError);
        }
        // Check if this is an insufficient sparks error (402)
        else if (error instanceof APIError && error.status === 402) {
          const sparksError = error.data as InsufficientSparksError;
          onInsufficientSparksRef.current?.(sparksError);
        } else {
          onErrorRef.current?.(error as Error);
        }
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [episodeId, isGenerating, refreshScenes]
  );

  // Load scenes when episode changes (only once per episodeId)
  useEffect(() => {
    if (enabled && episodeId && loadedEpisodeRef.current !== episodeId) {
      loadedEpisodeRef.current = episodeId;
      refreshScenes();
    }
  }, [enabled, episodeId, refreshScenes]);

  return {
    scenes,
    isLoading,
    isGenerating,
    generateScene,
    refreshScenes,
    quotaExceeded,
  };
}
