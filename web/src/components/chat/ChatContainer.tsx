"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useChat, RevealedProp } from "@/hooks/useChat";
import { useCharacter } from "@/hooks/useCharacters";
import { useScenes } from "@/hooks/useScenes";
import { useGuestSession } from "@/hooks/useGuestSession";
import { ChatHeader } from "./ChatHeader";
import { CharacterInfoSheet } from "./CharacterInfoSheet";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { MessageInput, SceneGenerationMode } from "./MessageInput";
import { SceneCard, SceneCardSkeleton } from "./SceneCard";
import { InstructionCard } from "./InstructionCard";
import { ItemsDrawer } from "./ItemsDrawer";
import { PropCard } from "./PropCard";
import { EpisodeOpeningCard } from "./EpisodeOpeningCard";
import { RateLimitModal } from "./RateLimitModal";
import { InlineCompletionCard } from "./InlineCompletionCard";
import { InlineSuggestionCard } from "./InlineSuggestionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotaExceededModal } from "@/components/usage";
import { InsufficientSparksModal } from "@/components/sparks";
import { SignupModal } from "@/components/guest/SignupModal";
import { GuestBanner } from "@/components/guest/GuestBanner";
import { api } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import { captureAttribution } from "@/lib/utils/attribution";
import type { Message, EpisodeImage, EpisodeTemplate, InsufficientSparksError, EpisodeAccessError, RateLimitError } from "@/types";
import { cn } from "@/lib/utils";

interface ChatContainerProps {
  characterId: string;
  episodeTemplateId?: string;
}

// A chat item can be a message, scene card, prop card, or inline card
type ChatItem =
  | { type: "message"; data: Message }
  | { type: "scene"; data: EpisodeImage }
  | { type: "prop"; data: RevealedProp }
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
  const [showCharacterInfo, setShowCharacterInfo] = useState(false);
  const [showItemsDrawer, setShowItemsDrawer] = useState(false);
  const [hasNewProp, setHasNewProp] = useState(false);
  const previousPropCountRef = useRef(0);
  const guestSessionCreatingRef = useRef(false);
  const [episodeTemplate, setEpisodeTemplate] = useState<EpisodeTemplate | null>(null);
  const [seriesEpisodes, setSeriesEpisodes] = useState<Array<{
    id: string;
    title: string;
    episode_number: number;
    status: "not_started" | "in_progress" | "completed";
  }>>([]);
  const [seriesTitle, setSeriesTitle] = useState<string | null>(null);  // ADR-004: Series title for header
  const { character, isLoading: isLoadingCharacter } = useCharacter(characterId);

  // Guest session management
  const { guestSessionId, sessionId, messagesRemaining, isGuest, createGuestSession, updateMessagesRemaining, clearGuestSession } = useGuestSession();
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Capture UTM attribution on mount (for direct Episode 0 ad links)
  useEffect(() => {
    captureAttribution();
  }, []);

  // Check authentication status
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize guest session if not authenticated and Episode 0
  useEffect(() => {
    if (!user && episodeTemplateId && !guestSessionId && episodeTemplate?.episode_number === 0) {
      // Prevent race condition: don't create multiple sessions simultaneously
      if (guestSessionCreatingRef.current) return;
      guestSessionCreatingRef.current = true;

      api.episodes.createGuest({
        character_id: characterId,
        episode_template_id: episodeTemplateId,
      })
        .then((response) => {
          createGuestSession({
            guest_session_id: response.guest_session_id,
            session_id: response.session_id,
            messages_remaining: response.messages_remaining,
          });
        })
        .catch((err) => {
          console.error("Failed to create guest session:", err);
          guestSessionCreatingRef.current = false;
        });
    }
  }, [user, episodeTemplateId, characterId, guestSessionId, episodeTemplate?.episode_number, createGuestSession]);

  // Convert guest session after login
  useEffect(() => {
    if (user && guestSessionId) {
      api.episodes.convertGuest(guestSessionId)
        .then(() => {
          clearGuestSession();
          // Reload to show authenticated session
          window.location.reload();
        })
        .catch((err) => {
          console.error("Failed to convert guest session:", err);
          clearGuestSession();
        });
    }
  }, [user, guestSessionId, clearGuestSession]);

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
          // ADR-004: Capture series title for header display
          setSeriesTitle(series.title);

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
          setSeriesTitle(null);
          setSeriesEpisodes([]);
        });
    } else {
      setSeriesTitle(null);
      setSeriesEpisodes([]);
    }
  }, [episodeTemplate?.series_id]);

  // Background image from episode template
  const backgroundImageUrl = episodeTemplate?.background_image_url;

  // Only initialize chat after character is confirmed to exist
  // For guests (non-authenticated users), we need special handling:
  // - If episodeTemplateId is provided but template not loaded yet, wait
  // - If Episode 0 (trial episode), wait for guest session to be created
  // - If authenticated, proceed normally
  const isWaitingForEpisodeTemplate = episodeTemplateId && !episodeTemplate;
  const isGuestOnEpisode0 = !user && episodeTemplate?.episode_number === 0;
  const isGuestNeedingSession = isGuestOnEpisode0 && !guestSessionId;
  // For unauthenticated non-Episode-0 access, either redirect to login or use existing guest session
  const isUnauthenticatedNonGuest = !user && episodeTemplate && episodeTemplate.episode_number !== 0 && !guestSessionId;
  const shouldInitChat = !isLoadingCharacter && !!character && !isWaitingForEpisodeTemplate && !isGuestNeedingSession && !isUnauthenticatedNonGuest;

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
    revealedProps,
    clearVisualPending,
    // Actions
    sendMessage,
    clearSceneSuggestion,
    dismissSuggestion,
  } = useChat({
    characterId,
    episodeTemplateId,
    enabled: shouldInitChat,
    // Guest session support - pass IDs so useChat skips session creation
    guestSessionId: guestSessionId,
    guestEpisodeId: sessionId,  // session_id from useGuestSession is the episode ID
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

  // Wrap sendMessage to handle guest session limits
  const handleSendMessage = async (content: string) => {
    // Check guest message limit before sending
    if (isGuest && messagesRemaining !== null && messagesRemaining <= 0) {
      setShowSignupModal(true);
      return;
    }

    try {
      // Call the original sendMessage from useChat
      await sendMessage(content);

      // Decrement messages remaining for guest users after successful send
      if (isGuest && messagesRemaining !== null) {
        updateMessagesRemaining(messagesRemaining - 1);
      }
    } catch (error: any) {
      // Check if this is the guest message limit error from API
      if (error?.detail?.error === 'guest_message_limit') {
        setShowSignupModal(true);
      } else {
        // Let other errors propagate to useChat's error handlers
        throw error;
      }
    }
  };

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

  // ADR-006: Detect when new props are revealed to show pulse animation
  useEffect(() => {
    if (revealedProps.length > previousPropCountRef.current) {
      setHasNewProp(true);
      // Clear the "new" indicator after 3 seconds
      const timeout = setTimeout(() => setHasNewProp(false), 3000);
      return () => clearTimeout(timeout);
    }
    previousPropCountRef.current = revealedProps.length;
  }, [revealedProps.length]);

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

  // Merge messages, scenes, props, and inline cards into a single timeline
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

    // Add all revealed props (inline in chat timeline)
    for (const prop of revealedProps) {
      items.push({ type: "prop", data: prop });
    }

    // Sort by timestamp (created_at for messages/scenes, revealed_at for props)
    items.sort((a, b) => {
      if (a.type === "completion" || a.type === "suggestion") return 1;
      if (b.type === "completion" || b.type === "suggestion") return -1;

      const getTime = (item: ChatItem): number => {
        if (item.type === "prop") {
          return new Date(item.data.revealed_at).getTime();
        } else if (item.type === "message") {
          return new Date(item.data.created_at).getTime();
        } else if (item.type === "scene") {
          return new Date(item.data.created_at).getTime();
        }
        return 0;
      };

      return getTime(a) - getTime(b);
    });

    return items;
  }, [messages, scenes, revealedProps]);

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

  // Handle avatar click to show character info sheet
  const openCharacterInfo = useCallback(() => {
    setShowCharacterInfo(true);
  }, []);

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
    <div
      className={cn(
        "flex flex-col h-full w-full",
        hasBackground ? "bg-black" : "bg-background"
      )}
      style={hasBackground ? {
        backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.6) 100%), url("${activeBackgroundUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      {/* Header with safe-area padding built in */}
      <div className={cn(
        "flex-shrink-0 pt-[env(safe-area-inset-top)]",
        hasBackground
          ? "mx-2 mt-2 rounded-xl bg-black/50 backdrop-blur-md"
          : "bg-card border-b border-border"
      )}>
        <ChatHeader
          character={character}
          episodeTemplate={episodeTemplate}
          directorState={directorState}
          messageCount={messages.length}
          seriesProgress={seriesProgress}
          seriesTitle={seriesTitle}
          hasBackground={hasBackground}
          revealedProps={revealedProps}
          onItemsClick={() => setShowItemsDrawer(true)}
          hasNewProp={hasNewProp}
        />
      </div>

      {/* Guest banner - show for guest users */}
      {isGuest && messagesRemaining !== null && (
        <GuestBanner
          messagesRemaining={messagesRemaining}
          onSignup={() => setShowSignupModal(true)}
        />
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="mx-auto max-w-2xl px-3 py-2 sm:px-4 sm:py-4">
          {isLoadingChat ? (
            <MessagesSkeleton />
          ) : chatItems.length === 0 ? (
            <EmptyState
              characterName={character.name}
              characterAvatar={character.avatar_url}
              episodeTemplate={episodeTemplate}
              hasBackground={hasBackground}
              onSelect={handleSendMessage}
            />
          ) : (
            <>
              {/* Chat items (messages + scenes + props) */}
              {chatItems.map((item) =>
                item.type === "message" ? (
                  <MessageBubble
                    key={`msg-${item.data.id}`}
                    message={item.data}
                    characterName={character.name}
                    characterAvatar={character.avatar_url}
                    hasBackground={hasBackground}
                    onAvatarClick={openCharacterInfo}
                  />
                ) : item.type === "scene" ? (
                  <SceneCard
                    key={`scene-${item.data.id}`}
                    scene={item.data}
                  />
                ) : item.type === "prop" ? (
                  <PropCard
                    key={`prop-${item.data.id}`}
                    prop={item.data}
                    hasBackground={hasBackground}
                  />
                ) : null
              )}

              {/* Streaming content */}
              {(isSending || streamingContent) && (
                <StreamingBubble
                  content={streamingContent}
                  characterName={character.name}
                  characterAvatar={character.avatar_url}
                  hasBackground={hasBackground}
                  onAvatarClick={openCharacterInfo}
                />
              )}

              {/* Scene generation skeleton */}
              {isGeneratingScene && (
                <SceneCardSkeleton caption="Creating a scene from your conversation..." />
              )}

              {/* Auto-generation skeleton */}
              {isAutoGenerating && (
                <SceneCardSkeleton caption="Capturing this moment..." />
              )}

              {/* Instruction cards */}
              {instructionCards.map((content, index) => (
                <InstructionCard
                  key={`instruction-${index}`}
                  content={content}
                  hasBackground={hasBackground}
                />
              ))}


              {/* Completion card */}
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

              {/* Suggestion card */}
              {nextSuggestion && !suggestionDismissed && !evaluation && (
                <InlineSuggestionCard
                  suggestion={nextSuggestion}
                  characterId={characterId}
                  characterName={character.name}
                  hasBackground={hasBackground}
                  onDismiss={dismissSuggestion}
                />
              )}

              {/* Starter prompts - show when user hasn't sent any message yet */}
              {(() => {
                const userMessages = messages.filter(m => m.role === 'user');
                const hasStarterPrompts = episodeTemplate?.starter_prompts && episodeTemplate.starter_prompts.length > 0;
                const shouldShowPrompts = userMessages.length === 0 && hasStarterPrompts;

                if (!shouldShowPrompts) return null;

                return (
                  <div className="mt-4 space-y-2 w-full max-w-md mx-auto">
                    <p className={cn(
                      "text-xs mb-1 text-center",
                      hasBackground ? "text-white/70" : "text-muted-foreground"
                    )}>
                      Try one of these openers:
                    </p>
                    {episodeTemplate.starter_prompts.slice(0, 3).map((prompt: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(prompt)}
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
                );
              })()}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar with safe-area padding built in */}
      <div className={cn(
        "flex-shrink-0 pb-[env(safe-area-inset-bottom)]",
        hasBackground
          ? "mx-2 mb-2 rounded-xl bg-black/50 backdrop-blur-md"
          : "border-t border-border bg-card"
      )}>
        <MessageInput
          onSend={handleSendMessage}
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

      {/* Character info sheet - triggered by clicking avatar in messages */}
      <CharacterInfoSheet
        character={character}
        isOpen={showCharacterInfo}
        onClose={() => setShowCharacterInfo(false)}
        hasBackground={hasBackground}
      />

      {/* ADR-006: Items drawer for collected props and story brief */}
      <ItemsDrawer
        props={revealedProps}
        isOpen={showItemsDrawer}
        onClose={() => setShowItemsDrawer(false)}
        hasBackground={hasBackground}
        characterName={character.name}
        storyBrief={{
          episodeTitle: episodeTemplate?.title,
          situation: episodeTemplate?.situation,
          backstory: character.backstory || undefined,
        }}
      />

      {/* Guest signup modal */}
      <SignupModal
        open={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        guestSessionId={guestSessionId}
        trigger="message_limit"
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
            {characterName}
          </h2>

          {/* Default prompt */}
          <p className={cn(
            "text-sm mb-4 max-w-sm",
            hasBackground ? "text-white/80" : "text-muted-foreground"
          )}>
            Say hi to start a conversation
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

