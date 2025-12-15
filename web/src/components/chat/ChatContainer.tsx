"use client";

import React, { useRef, useEffect, useMemo, useState } from "react";
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
import type { Relationship, Message, EpisodeImage, InsufficientSparksError, RateLimitError } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChatContainerProps {
  characterId: string;
}

// A chat item can be a message or a scene card
type ChatItem =
  | { type: "message"; data: Message }
  | { type: "scene"; data: EpisodeImage };

export function ChatContainer({ characterId }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showSparksModal, setShowSparksModal] = useState(false);
  const [sparksError, setSparksError] = useState<InsufficientSparksError | null>(null);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null);
  const { character, isLoading: isLoadingCharacter } = useCharacter(characterId);

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

  // Handle visualize button click
  const handleVisualize = async () => {
    if (!episode || isGeneratingScene) return;
    clearSceneSuggestion(); // Clear the suggestion
    await generateScene();
  };

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

  // Only show visualize button after some messages
  const showVisualizeButton = messages.length >= 2;

  return (
    <div className="flex flex-col h-full page-surface">
      {/* Header */}
      <ChatHeader
        character={character}
        relationship={relationship}
        episode={episode}
        onEndEpisode={endEpisode}
      />

      {/* Context bar */}
      <div className="flex flex-wrap gap-2 border-b bg-background/80 px-4 py-2 text-xs text-muted-foreground">
        {relationship && (
          <ContextChip label="Stage" value={formatStage(relationship.stage)} />
        )}
        {episode && (
          <ContextChip
            label="Episode"
            value={`#${episode.episode_number}${episode.started_at ? " • " + formatRelative(episode.started_at) : ""}`}
          />
        )}
        {relationship?.last_interaction_at && (
          <ContextChip label="Last chat" value={formatRelative(relationship.last_interaction_at)} />
        )}
        {character.content_rating && (
          <ContextChip
            label="Content"
            value={character.content_rating.toUpperCase()}
            accent={character.content_rating === "adult" ? "destructive" : "primary"}
          />
        )}
        {character.categories?.slice(0, 3).map((cat) => (
          <ContextChip key={cat} label="Category" value={cat} />
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingChat ? (
          <MessagesSkeleton />
        ) : chatItems.length === 0 ? (
          <EmptyState characterName={character.name} starterPrompts={character.starter_prompts} onSelect={sendMessage} />
        ) : (
          <>
            {chatItems.map((item) =>
              item.type === "message" ? (
                <MessageBubble
                  key={`msg-${item.data.id}`}
                  message={item.data}
                  characterName={character.name}
                  characterAvatar={character.avatar_url}
                />
              ) : (
                <SceneCard key={`scene-${item.data.id}`} scene={item.data} />
              )
            )}
            {streamingContent && (
              <StreamingBubble
                content={streamingContent}
                characterName={character.name}
                characterAvatar={character.avatar_url}
              />
            )}
            {isGeneratingScene && (
              <SceneCardSkeleton caption="Creating a scene from your conversation..." />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scene suggestion inline banner */}
      {suggestScene && !isGeneratingScene && (
        <div className="mx-4 mb-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-primary">This moment would make a great scene.</span>
            <button
              className="text-xs font-semibold text-primary hover:underline"
              onClick={handleVisualize}
            >
              Visualize it
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        onVisualize={handleVisualize}
        disabled={isSending || isLoadingChat}
        isGeneratingScene={isGeneratingScene}
        showVisualizeButton={showVisualizeButton}
        suggestScene={suggestScene}
        placeholder={`Message ${character.name}...`}
      />

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
  starterPrompts: string[];
  onSelect: (prompt: string) => void;
}

function EmptyState({ characterName, starterPrompts, onSelect }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-white text-2xl font-bold mb-4">
        {characterName[0]}
      </div>
      <h2 className="text-lg font-semibold mb-2">Start talking with {characterName}</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        Send a message to begin your conversation. {characterName} will remember everything you share.
      </p>

      {starterPrompts.length > 0 && (
        <div className="space-y-2 w-full max-w-xs">
          <p className="text-xs text-muted-foreground mb-1">Try one of these openers:</p>
          {starterPrompts.slice(0, 3).map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSelect(prompt)}
              className="w-full text-left px-4 py-2.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-sm text-sm transition-all"
            >
              “{prompt}”
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
}: {
  label: string;
  value: string;
  accent?: "muted" | "primary" | "destructive";
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-7 rounded-full px-3 text-[11px] font-medium",
        accent === "primary" && "bg-primary/15 text-primary border border-primary/30",
        accent === "destructive" && "bg-destructive/10 text-destructive border border-destructive/30"
      )}
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mr-1">{label}</span>
      {value}
    </Badge>
  );
}
