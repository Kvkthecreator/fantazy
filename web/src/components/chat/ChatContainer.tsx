"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { useCharacter } from "@/hooks/useCharacters";
import { useScenes } from "@/hooks/useScenes";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { MessageInput, SceneGenerationMode } from "./MessageInput";
import { SceneCard, SceneCardSkeleton } from "./SceneCard";
import { InstructionCard } from "./InstructionCard";
import { EpisodeOpeningCard } from "./EpisodeOpeningCard";
import { RateLimitModal } from "./RateLimitModal";
import { InlineCompletionCard } from "./InlineCompletionCard";
import { InlineSuggestionCard } from "./InlineSuggestionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotaExceededModal } from "@/components/usage";
import { InsufficientSparksModal } from "@/components/sparks";
import { api } from "@/lib/api/client";
import type { Message, EpisodeImage, EpisodeTemplate, InsufficientSparksError, EpisodeAccessError, RateLimitError } from "@/types";
import { cn } from "@/lib/utils";

interface ChatContainerProps {
  characterId: string;
  episodeTemplateId?: string;
}

// A chat item can be a message, scene card, or inline card
type ChatItem =
  | { type: "message"; data: Message }
  | { type: "scene"; data: EpisodeImage }
  | { type: "completion"; id: string }
  | { type: "suggestion"; id: string };

export function ChatContainer({ characterId, episodeTemplateId }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const refreshScenesRef = useRef<(() => Promise<void>) | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showSparksModal, setShowSparksModal] = useState(false);
  const [sparksError, setSparksError] = useState<InsufficientSparksError | null>(null);
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const [accessError, setAccessError] = useState<EpisodeAccessError | null>(null);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null);
  const [episodeTemplate, setEpisodeTemplate] = useState<EpisodeTemplate | null>(null);
  const [seriesEpisodes, setSeriesEpisodes] = useState<Array<{
    id: string;
    title: string;
    episode_number: number;
    status: "not_started" | "in_progress" | "completed";
  }>>([]);
  const { character, isLoading: isLoadingCharacter } = useCharacter(characterId);

  // Load episode template ONLY if explicitly provided via URL param
  // Free chat mode (no episodeTemplateId) should NOT load any episode template
  useEffect(() => {
    if (episodeTemplateId) {
      api.episodeTemplates.get(episodeTemplateId)
        .then(setEpisodeTemplate)
        .catch((err) => {
          console.error("Failed to load episode template:", err);
          setEpisodeTemplate(null);
        });
    } else {
      // Free chat mode - explicitly clear any episode template
      setEpisodeTemplate(null);
    }
  }, [episodeTemplateId]);

  // Load series episodes for header picker
  useEffect(() => {
    if (episodeTemplate?.series_id) {
      Promise.all([
        api.series.getWithEpisodes(episodeTemplate.series_id),
        api.series.getProgress(episodeTemplate.series_id),
      ])
        .then(([series, progressResponse]) => {
          const progressMap = new Map(
            progressResponse.progress.map((p) => [p.episode_id, p.status])
          );
          const episodesWithStatus = series.episodes.map((ep) => ({
            id: ep.id,
            title: ep.title,
            episode_number: ep.episode_number ?? 0,
            status: progressMap.get(ep.id) ?? ("not_started" as const),
          }));
          setSeriesEpisodes(episodesWithStatus);
        })
        .catch((err) => {
          console.error("Failed to load series data:", err);
          setSeriesEpisodes([]);
        });
    } else {
      setSeriesEpisodes([]);
    }
  }, [episodeTemplate?.series_id]);

  // Background image from episode template
  const backgroundImageUrl = episodeTemplate?.background_image_url;

  // Only initialize chat after character is confirmed to exist
  const shouldInitChat = !isLoadingCharacter && !!character;

  const {
    messages,
    isLoading: isLoadingChat,
    isSending,
    episode,
    streamingContent,
    suggestScene,
    // Director state
    directorState,
    evaluation,
    // Next episode suggestion (decoupled from "completion" - v2.6)
    nextSuggestion,
    suggestionDismissed,
    // Director V2 visual state
    visualPending,
    instructionCards,
    clearVisualPending,
    // Actions
    sendMessage,
    clearSceneSuggestion,
    dismissSuggestion,
  } = useChat({
    characterId,
    episodeTemplateId,
    enabled: shouldInitChat,
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onRateLimitExceeded: (error) => {
      setRateLimitError(error);
      setShowRateLimitModal(true);
    },
    onEpisodeAccessDenied: (error) => {
      setAccessError(error);
      setShowAccessDeniedModal(true);
    },
    onVisualPending: (event) => {
      // Auto-gen image generation started - show loading and poll for completion
      console.log("Auto-gen started, showing loading indicator and polling...");

      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      setIsAutoGenerating(true);
      const initialSceneCount = scenes.length;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max

      // Poll every 2 seconds (FLUX Dev takes ~20-30 seconds)
      pollingIntervalRef.current = setInterval(async () => {
        attempts++;

        if (attempts >= maxAttempts) {
          console.warn("Auto-gen polling timeout after 60 seconds");
          setIsAutoGenerating(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        // Refresh scenes
        await refreshScenesRef.current?.();

        // Check if new scene appeared (scenes state will be updated by refreshScenes)
        // Note: We rely on React's state update cycle to reflect the new scenes count
      }, 2000);
    },
  });

  // Scene generation
  const {
    scenes,
    isGenerating: isGeneratingScene,
    generateScene,
    refreshScenes,
  } = useScenes({
    episodeId: episode?.id ?? null,
    enabled: shouldInitChat && !!episode,
    onError: (error) => {
      console.error("Scene error:", error);
    },
    onQuotaExceeded: () => {
      setShowQuotaModal(true);
    },
    onInsufficientSparks: (error) => {
      setSparksError(error);
      setShowSparksModal(true);
    },
  });

  // Store refreshScenes in ref for use in visual_pending callback
  useEffect(() => {
    refreshScenesRef.current = refreshScenes;
  }, [refreshScenes]);

  // Detect when auto-gen image appears and stop polling
  const previousSceneCountRef = useRef(scenes.length);
  useEffect(() => {
    if (isAutoGenerating && scenes.length > previousSceneCountRef.current) {
      console.log("Auto-gen image detected, stopping poll");
      setIsAutoGenerating(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
    previousSceneCountRef.current = scenes.length;
  }, [scenes.length, isAutoGenerating]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Build series progress for header
  const seriesProgress = useMemo(() => {
    if (!seriesEpisodes.length || !episodeTemplate) return null;
    const currentIndex = seriesEpisodes.findIndex((ep) => ep.id === episodeTemplate.id);
    if (currentIndex === -1) return null;
    return {
      current: currentIndex + 1,
      total: seriesEpisodes.length,
      episodes: seriesEpisodes,
    };
  }, [seriesEpisodes, episodeTemplate]);

  // Merge messages, scenes, and inline cards into a single timeline
  const chatItems = useMemo((): ChatItem[] => {
    const items: ChatItem[] = [];

    // Add all messages
    for (const msg of messages) {
      items.push({ type: "message", data: msg });
    }

    // Add all scenes
    for (const scene of scenes) {
      items.push({ type: "scene", data: scene });
    }

    // Sort by created_at
    items.sort((a, b) => {
      if (a.type === "completion" || a.type === "suggestion") return 1;
      if (b.type === "completion" || b.type === "suggestion") return -1;
      const timeA = new Date((a.data as Message | EpisodeImage).created_at).getTime();
      const timeB = new Date((b.data as Message | EpisodeImage).created_at).getTime();
      return timeA - timeB;
    });

    return items;
  }, [messages, scenes]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatItems, streamingContent, isGeneratingScene, nextSuggestion]);

  // Background is ALWAYS the episode template background - scene cards stay inline only
  const activeBackgroundUrl = backgroundImageUrl;
  const hasBackground = !!activeBackgroundUrl;

  // Broadcast background to document root so shell (sidebar/header) can inherit the immersive layer.
  useEffect(() => {
    if (!hasBackground || !activeBackgroundUrl) {
      document.documentElement.classList.remove("chat-has-bg");
      document.documentElement.style.removeProperty("--chat-bg-image");
      return;
    }
    document.documentElement.classList.add("chat-has-bg");
    document.documentElement.style.setProperty("--chat-bg-image", `url("${activeBackgroundUrl}")`);
    return () => {
      document.documentElement.classList.remove("chat-has-bg");
      document.documentElement.style.removeProperty("--chat-bg-image");
    };
  }, [hasBackground, activeBackgroundUrl]);

  // Handle visualize button click with mode selection
  const handleVisualize = useCallback(async (mode: SceneGenerationMode) => {
    if (!episode || isGeneratingScene) return;
    clearSceneSuggestion();
    await generateScene(undefined, mode);
  }, [episode, isGeneratingScene, clearSceneSuggestion, generateScene]);

  // Check if character has an anchor image for Kontext mode
  const hasAnchorImage = !!character?.avatar_url;

  // Only show visualize button after some messages
  const showVisualizeButton = messages.length >= 2;

  if (isLoadingCharacter) {
    return <ChatSkeleton />;
  }

  if (!character) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-muted-foreground">Character not found</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative flex flex-col h-[100dvh] min-h-[100svh] w-full overflow-hidden",
      !hasBackground && "bg-background"
    )}>
      {/* Full-bleed background layer - only when we have an image */}
      {hasBackground && (
        <div className="absolute inset-0 z-0">
          <img
            src={activeBackgroundUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          />
          {/* Cinematic gradient overlay for depth and readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />
          {/* Subtle vignette effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        </div>
      )}

      {/* Content layer */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header - unified info bar */}
        <div className={cn(
          "transition-colors pt-[env(safe-area-inset-top)]",
          hasBackground
            ? "mx-3 mt-2 sm:mt-3 rounded-2xl backdrop-blur-xl backdrop-saturate-150 bg-black/30"
            : "bg-card border-b border-border"
        )}>
          <ChatHeader
            character={character}
            episodeTemplate={episodeTemplate}
            directorState={directorState}
            messageCount={messages.length}
            seriesProgress={seriesProgress}
            hasBackground={hasBackground}
          />
        </div>

        {/* Messages area - single focal point for all content */}
        <div className="flex-1 overflow-y-auto pt-6 pb-10 sm:pb-6">
          <div className="mx-auto max-w-2xl px-4">
            {isLoadingChat ? (
              <MessagesSkeleton />
            ) : chatItems.length === 0 ? (
              <EmptyState
                characterName={character.name}
                characterAvatar={character.avatar_url}
                episodeTemplate={episodeTemplate}
                hasBackground={hasBackground}
                onSelect={sendMessage}
              />
            ) : (
              <>
                {/* UPSTREAM-DRIVEN: Episode Opening Card (persists as first chat item) */}
                {episodeTemplate?.situation && (
                  <EpisodeOpeningCard
                    title={episodeTemplate.title}
                    situation={episodeTemplate.situation}
                    characterName={character.name}
                    hasBackground={hasBackground}
                  />
                )}

                {/* Chat items (messages + scenes) */}
                {chatItems.map((item) =>
                  item.type === "message" ? (
                    <MessageBubble
                      key={`msg-${item.data.id}`}
                      message={item.data}
                      characterName={character.name}
                      characterAvatar={character.avatar_url}
                      hasBackground={hasBackground}
                    />
                  ) : item.type === "scene" ? (
                    <SceneCard
                      key={`scene-${item.data.id}`}
                      scene={item.data}
                    />
                  ) : null
                )}

                {/* Streaming content or typing indicator */}
                {(isSending || streamingContent) && (
                  <StreamingBubble
                    content={streamingContent}
                    characterName={character.name}
                    characterAvatar={character.avatar_url}
                    hasBackground={hasBackground}
                  />
                )}

                {/* Scene generation skeleton (manual) */}
                {isGeneratingScene && (
                  <SceneCardSkeleton caption="Creating a scene from your conversation..." />
                )}

                {/* Auto-generation skeleton (Director-triggered) */}
                {isAutoGenerating && (
                  <SceneCardSkeleton caption="Capturing this moment..." />
                )}

                {/* Director V2: Instruction cards (game-like hints, free) */}
                {instructionCards.map((content, index) => (
                  <InstructionCard
                    key={`instruction-${index}`}
                    content={content}
                    hasBackground={hasBackground}
                  />
                ))}

                {/* Inline completion card - for Games evaluation (separate concern) */}
                {evaluation && (
                  <InlineCompletionCard
                    evaluation={evaluation}
                    nextSuggestion={nextSuggestion}
                    characterId={characterId}
                    characterName={character.name}
                    hasBackground={hasBackground}
                    onDismiss={dismissSuggestion}
                  />
                )}

                {/* Inline suggestion card - shows when turn budget reached (v2.6: decoupled from completion)
                    Only show if: suggestion exists, not dismissed, and no evaluation card showing */}
                {nextSuggestion && !suggestionDismissed && !evaluation && (
                  <InlineSuggestionCard
                    suggestion={nextSuggestion}
                    characterId={characterId}
                    characterName={character.name}
                    hasBackground={hasBackground}
                    onDismiss={dismissSuggestion}
                  />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar - just input */}
        <div className={cn(
          "pb-[calc(env(safe-area-inset-bottom)+8px)]",
          hasBackground ? "mx-3 mb-3" : "border-t border-border bg-card"
        )}>
          <div className={cn(
            "transition-colors",
            hasBackground
              ? "rounded-2xl backdrop-blur-xl backdrop-saturate-150 bg-black/30"
              : ""
          )}>
            <MessageInput
              onSend={sendMessage}
              onVisualize={handleVisualize}
              disabled={isSending || isLoadingChat}
              isGeneratingScene={isGeneratingScene}
              showVisualizeButton={showVisualizeButton}
              suggestScene={suggestScene}
              placeholder={`Message ${character.name}...`}
              hasBackground={hasBackground}
              hasAnchorImage={hasAnchorImage}
            />
          </div>
          {/* AI disclaimer */}
          <p className={cn(
            "text-center text-[10px] mt-2 transition-colors",
            hasBackground ? "text-white/50" : "text-muted-foreground/60"
          )}>
            This is A.I. and not a real person. Treat everything it says as fiction.
          </p>
        </div>
      </div>

      {/* Modals - only for system errors, not for episode completion */}
      <QuotaExceededModal
        open={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
      />

      <InsufficientSparksModal
        open={showSparksModal}
        onClose={() => setShowSparksModal(false)}
        cost={sparksError?.cost ?? 1}
        featureName="image generation"
      />

      {/* Episode access denied modal (402 - insufficient sparks for episode entry) */}
      <InsufficientSparksModal
        open={showAccessDeniedModal}
        onClose={() => setShowAccessDeniedModal(false)}
        cost={accessError?.required ?? 3}
        featureName="starting this episode"
      />

      <RateLimitModal
        open={showRateLimitModal}
        onClose={() => setShowRateLimitModal(false)}
        resetAt={rateLimitError?.reset_at}
        cooldownSeconds={rateLimitError?.cooldown_seconds}
      />
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {/* Messages skeleton */}
      <div className="flex-1 p-4">
        <MessagesSkeleton />
      </div>
      {/* Input skeleton */}
      <div className="p-4 border-t">
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "flex-row-reverse" : ""}`}>
          {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
          <Skeleton className={`h-16 ${i % 2 === 0 ? "w-48" : "w-64"} rounded-2xl`} />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  characterName: string;
  characterAvatar?: string | null;
  episodeTemplate?: EpisodeTemplate | null;
  hasBackground?: boolean;
  onSelect: (prompt: string) => void;
}

function EmptyState({
  characterName,
  characterAvatar,
  episodeTemplate,
  hasBackground,
  onSelect,
}: EmptyStateProps) {
  // Starter prompts now live on episode_template only (EP-01 Episode-First Pivot)
  const prompts = episodeTemplate?.starter_prompts || [];

  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-full text-center px-4",
      hasBackground && "text-white"
    )}>
      {/* UPSTREAM-DRIVEN: Episode Opening Card (if episode data available) */}
      {episodeTemplate?.situation ? (
        <EpisodeOpeningCard
          title={episodeTemplate.title}
          situation={episodeTemplate.situation}
          characterName={characterName}
          hasBackground={hasBackground}
        />
      ) : (
        /* Fallback: Character-only chat (no episode) */
        <>
          {/* Character avatar or initial */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-white text-2xl font-bold mb-4 border-2 border-white/30 shadow-lg overflow-hidden">
            {characterAvatar ? (
              <img src={characterAvatar} alt={characterName} className="w-full h-full object-cover" />
            ) : (
              characterName[0]
            )}
          </div>

          {/* Character name */}
          <h2 className={cn(
            "text-lg font-semibold mb-2",
            hasBackground && "drop-shadow-md"
          )}>
            Start talking with {characterName}
          </h2>

          {/* Default prompt */}
          <p className={cn(
            "text-sm mb-4 max-w-sm",
            hasBackground ? "text-white/80" : "text-muted-foreground"
          )}>
            Send a message to begin your conversation. {characterName} will remember everything you share.
          </p>
        </>
      )}

      {/* Episode opening line if available */}
      {episodeTemplate?.opening_line && (
        <div className={cn(
          "mb-6 px-4 py-3 rounded-2xl max-w-sm text-left text-sm backdrop-blur-sm",
          hasBackground
            ? "bg-black/30 text-white"
            : "bg-muted/50 border border-border/50"
        )}>
          <p className="italic">&quot;{episodeTemplate.opening_line}&quot;</p>
          <p className={cn(
            "text-xs mt-1",
            hasBackground ? "text-white/60" : "text-muted-foreground"
          )}>
            — {characterName}
          </p>
        </div>
      )}

      {/* Starter prompts */}
      {prompts.length > 0 && (
        <div className="space-y-2 w-full max-w-xs">
          <p className={cn(
            "text-xs mb-1",
            hasBackground ? "text-white/70" : "text-muted-foreground"
          )}>
            Try one of these openers:
          </p>
          {prompts.slice(0, 3).map((prompt: string, i: number) => (
            <button
              key={i}
              onClick={() => onSelect(prompt)}
              className={cn(
                "w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all backdrop-blur-sm",
                hasBackground
                  ? "bg-white/10 hover:bg-white/15 text-white"
                  : "border border-border/70 bg-card hover:border-primary/40 hover:shadow-sm"
              )}
            >
              &quot;{prompt}&quot;
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

