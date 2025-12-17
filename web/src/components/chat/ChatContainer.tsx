"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { useCharacter } from "@/hooks/useCharacters";
import { useScenes } from "@/hooks/useScenes";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { SceneCard, SceneCardSkeleton } from "./SceneCard";
import { RateLimitModal } from "./RateLimitModal";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotaExceededModal } from "@/components/usage";
import { InsufficientSparksModal } from "@/components/sparks";
import { api } from "@/lib/api/client";
import type { Relationship, Message, EpisodeImage, EpisodeTemplate, InsufficientSparksError, RateLimitError } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ChatContainerProps {
  characterId: string;
  episodeTemplateId?: string;
}

// A chat item can be a message or a scene card
type ChatItem =
  | { type: "message"; data: Message }
  | { type: "scene"; data: EpisodeImage };

export function ChatContainer({ characterId, episodeTemplateId }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showSparksModal, setShowSparksModal] = useState(false);
  const [sparksError, setSparksError] = useState<InsufficientSparksError | null>(null);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null);
  const [episodeTemplate, setEpisodeTemplate] = useState<EpisodeTemplate | null>(null);
  const { character, isLoading: isLoadingCharacter } = useCharacter(characterId);

  // Load episode template if provided
  useEffect(() => {
    if (episodeTemplateId) {
      api.episodeTemplates.get(episodeTemplateId)
        .then(setEpisodeTemplate)
        .catch((err) => {
          console.error("Failed to load episode template:", err);
          setEpisodeTemplate(null);
        });
    } else {
      // Try to get default episode template for character
      api.episodeTemplates.getDefault(characterId)
        .then(setEpisodeTemplate)
        .catch(() => setEpisodeTemplate(null));
    }
  }, [episodeTemplateId, characterId]);

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
    sendMessage,
    endEpisode,
    clearSceneSuggestion,
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
  });

  // Scene generation
  const {
    scenes,
    isGenerating: isGeneratingScene,
    generateScene,
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

  // Merge messages and scenes into a single timeline
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
      const timeA = new Date(a.data.created_at).getTime();
      const timeB = new Date(b.data.created_at).getTime();
      return timeA - timeB;
    });

    return items;
  }, [messages, scenes]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatItems, streamingContent, isGeneratingScene]);

  // Get relationship
  const [relationship, setRelationship] = React.useState<Relationship | null>(null);
  React.useEffect(() => {
    api.relationships.getByCharacter(characterId)
      .then(setRelationship)
      .catch(() => setRelationship(null));
  }, [characterId]);

  // Background is ALWAYS the episode template background - scene cards stay inline only
  const activeBackgroundUrl = backgroundImageUrl;
  const hasBackground = !!activeBackgroundUrl;

  // Broadcast background to document root so shell (sidebar/header) can inherit the immersive layer.
  // This hook MUST be called before any early returns to satisfy React's rules of hooks.
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

  // Handle visualize button click
  const handleVisualize = useCallback(async () => {
    if (!episode || isGeneratingScene) return;
    clearSceneSuggestion(); // Clear the suggestion
    await generateScene();
  }, [episode, isGeneratingScene, clearSceneSuggestion, generateScene]);

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
      "relative flex flex-col h-full w-full overflow-hidden",
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
      <div className={cn(
        "relative z-10 flex flex-col h-full",
        hasBackground ? "" : ""
      )}>
        {/* Header - glass when immersive, standard when not */}
        <div className={cn(
          "transition-colors",
          hasBackground
            ? "mx-3 mt-3 rounded-2xl backdrop-blur-xl backdrop-saturate-150 bg-black/30"
            : "bg-card border-b border-border"
        )}>
          <ChatHeader
            character={character}
            relationship={relationship}
            episode={episode}
            onEndEpisode={endEpisode}
            hasBackground={hasBackground}
          />
          {/* Integrated context bar */}
          <div className={cn(
            "flex flex-wrap gap-2 px-4 py-2 text-xs",
            hasBackground
              ? "text-white/90"
              : "border-t border-border text-muted-foreground"
          )}>
            {relationship && (
              <ContextChip label="Stage" value={formatStage(relationship.stage)} hasBackground={hasBackground} />
            )}
            {episode && (
              <ContextChip
                label="Episode"
                value={`#${episode.episode_number}${episode.started_at ? " • " + formatRelative(episode.started_at) : ""}`}
                hasBackground={hasBackground}
              />
            )}
            {episodeTemplate && !episode && (
              <ContextChip
                label="Scene"
                value={episodeTemplate.title}
                hasBackground={hasBackground}
              />
            )}
            {character.content_rating && (
              <ContextChip
                label="Content"
                value={character.content_rating.toUpperCase()}
                accent={character.content_rating === "adult" ? "destructive" : "primary"}
                hasBackground={hasBackground}
              />
            )}
          </div>
        </div>

        {/* Messages area - centered with max-width for readability */}
        <div className="flex-1 overflow-y-auto py-6">
          <div className="mx-auto max-w-2xl px-4">
            {isLoadingChat ? (
              <MessagesSkeleton />
            ) : chatItems.length === 0 ? (
              <EmptyState
                characterName={character.name}
                characterAvatar={character.avatar_url}
                starterPrompts={character.starter_prompts}
                episodeTemplate={episodeTemplate}
                hasBackground={hasBackground}
                onSelect={sendMessage}
              />
            ) : (
              <>
                {/* Stage direction at the start of conversation */}
                {episodeTemplate?.episode_frame && (
                  <StageDirection
                    frame={episodeTemplate.episode_frame}
                    hasBackground={hasBackground}
                  />
                )}
                {chatItems.map((item) =>
                  item.type === "message" ? (
                    <MessageBubble
                      key={`msg-${item.data.id}`}
                      message={item.data}
                      characterName={character.name}
                      characterAvatar={character.avatar_url}
                      hasBackground={hasBackground}
                    />
                  ) : (
                    <SceneCard
                      key={`scene-${item.data.id}`}
                      scene={item.data}
                    />
                  )
                )}
                {streamingContent && (
                  <StreamingBubble
                    content={streamingContent}
                    characterName={character.name}
                    characterAvatar={character.avatar_url}
                    hasBackground={hasBackground}
                  />
                )}
                {isGeneratingScene && (
                  <SceneCardSkeleton caption="Creating a scene from your conversation..." />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scene suggestion inline banner */}
        {suggestScene && !isGeneratingScene && (
          <div className="mx-auto max-w-2xl px-4 mb-2">
            <div className={cn(
              "rounded-xl border px-4 py-3 text-sm shadow-lg",
              "backdrop-blur-xl backdrop-saturate-150",
              hasBackground
                ? "border-white/20 bg-white/10 text-white"
                : "border-primary/30 bg-primary/5 text-foreground"
            )}>
              <div className="flex items-center justify-between gap-3">
                <span className={cn(
                  "text-xs font-medium",
                  hasBackground ? "text-white/90" : "text-primary"
                )}>
                  This moment would make a great scene.
                </span>
                <button
                  className={cn(
                    "text-xs font-semibold hover:underline",
                    hasBackground ? "text-white" : "text-primary"
                  )}
                  onClick={handleVisualize}
                >
                  Visualize it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input bar - glass when immersive, standard when not */}
        <div className={cn(
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

      {/* Quota Exceeded Modal */}
      <QuotaExceededModal
        open={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
      />

      {/* Insufficient Sparks Modal */}
      <InsufficientSparksModal
        open={showSparksModal}
        onClose={() => setShowSparksModal(false)}
        cost={sparksError?.cost ?? 1}
        featureName="image generation"
      />

      {/* Rate Limit Modal */}
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
  starterPrompts: string[];
  episodeTemplate?: EpisodeTemplate | null;
  hasBackground?: boolean;
  onSelect: (prompt: string) => void;
}

function EmptyState({
  characterName,
  characterAvatar,
  starterPrompts,
  episodeTemplate,
  hasBackground,
  onSelect,
}: EmptyStateProps) {
  // Use episode template's starter prompts if available, otherwise use character's
  const prompts = episodeTemplate?.starter_prompts?.length
    ? episodeTemplate.starter_prompts
    : starterPrompts;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-full text-center px-4",
      hasBackground && "text-white"
    )}>
      {/* Character avatar or initial */}
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-white text-2xl font-bold mb-4 border-2 border-white/30 shadow-lg overflow-hidden">
        {characterAvatar ? (
          <img src={characterAvatar} alt={characterName} className="w-full h-full object-cover" />
        ) : (
          characterName[0]
        )}
      </div>

      {/* Episode title or character name */}
      <h2 className={cn(
        "text-lg font-semibold mb-2",
        hasBackground && "drop-shadow-md"
      )}>
        {episodeTemplate?.title || `Start talking with ${characterName}`}
      </h2>

      {/* Episode situation or default prompt */}
      <p className={cn(
        "text-sm mb-4 max-w-sm",
        hasBackground ? "text-white/80" : "text-muted-foreground"
      )}>
        {episodeTemplate?.situation || `Send a message to begin your conversation. ${characterName} will remember everything you share.`}
      </p>

      {/* Episode frame - stage direction (Hybrid POV) */}
      {episodeTemplate?.episode_frame && (
        <div className={cn(
          "mb-4 px-4 py-3 rounded-xl max-w-sm text-sm backdrop-blur-sm border-l-2",
          hasBackground
            ? "bg-black/20 border-white/40 text-white/90"
            : "bg-muted/30 border-primary/40 text-muted-foreground"
        )}>
          <p className="leading-relaxed">
            [{episodeTemplate.episode_frame}]
          </p>
        </div>
      )}

      {/* Episode opening line if available */}
      {episodeTemplate?.opening_line && (
        <div className={cn(
          "mb-6 px-4 py-3 rounded-2xl max-w-sm text-left text-sm backdrop-blur-sm",
          hasBackground
            ? "bg-black/30 text-white"
            : "bg-muted/50 border border-border/50"
        )}>
          <p className="italic">"{episodeTemplate.opening_line}"</p>
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
              "{prompt}"
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatStage(stage?: string | null) {
  if (!stage) return "";
  const map: Record<string, string> = {
    acquaintance: "Just met",
    friendly: "Friendly",
    close: "Close",
    intimate: "Special",
  };
  return map[stage] || stage;
}

function formatRelative(dateString?: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function ContextChip({
  label,
  value,
  accent = "muted",
  hasBackground,
}: {
  label: string;
  value: string;
  accent?: "muted" | "primary" | "destructive";
  hasBackground?: boolean;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-7 rounded-full px-3 text-[11px] font-medium border-0",
        hasBackground
          ? "bg-white/10 text-white/90"
          : accent === "primary"
            ? "bg-primary/15 text-primary"
            : accent === "destructive"
              ? "bg-destructive/10 text-destructive"
              : ""
      )}
    >
      <span className={cn(
        "text-[10px] uppercase tracking-wide mr-1",
        hasBackground ? "text-white/60" : "text-muted-foreground/80"
      )}>
        {label}
      </span>
      {value}
    </Badge>
  );
}

/**
 * StageDirection - Platform stage direction (Hybrid POV)
 * Displays the episode_frame as scene-setting narration at the start of conversation.
 */
function StageDirection({
  frame,
  hasBackground,
}: {
  frame: string;
  hasBackground?: boolean;
}) {
  return (
    <div className="flex justify-center mb-6">
      <div className={cn(
        "max-w-md px-5 py-3 rounded-xl text-sm text-center backdrop-blur-sm border",
        hasBackground
          ? "bg-black/30 border-white/20 text-white/90"
          : "bg-muted/40 border-border/50 text-muted-foreground"
      )}>
        <p className="leading-relaxed italic">
          [{frame}]
        </p>
      </div>
    </div>
  );
}
