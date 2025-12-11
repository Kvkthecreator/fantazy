"use client";

import { useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { useCharacter } from "@/hooks/useCharacters";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import type { Relationship } from "@/types";

interface ChatContainerProps {
  characterId: string;
}

export function ChatContainer({ characterId }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { character, isLoading: isLoadingCharacter } = useCharacter(characterId);

  const {
    messages,
    isLoading: isLoadingChat,
    isSending,
    episode,
    streamingContent,
    sendMessage,
    endEpisode,
  } = useChat({
    characterId,
    onError: (error) => {
      console.error("Chat error:", error);
      // TODO: Show toast
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Get relationship (simplified - in real app would fetch)
  const [relationship, setRelationship] = React.useState<Relationship | null>(null);
  React.useEffect(() => {
    api.relationships.getByCharacter(characterId)
      .then(setRelationship)
      .catch(() => setRelationship(null));
  }, [characterId]);

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
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <ChatHeader
        character={character}
        relationship={relationship}
        episode={episode}
        onEndEpisode={endEpisode}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingChat ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <EmptyState characterName={character.name} starterPrompts={character.starter_prompts} onSelect={sendMessage} />
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                characterName={character.name}
                characterAvatar={character.avatar_url}
              />
            ))}
            {streamingContent && (
              <StreamingBubble
                content={streamingContent}
                characterName={character.name}
                characterAvatar={character.avatar_url}
              />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        disabled={isSending || isLoadingChat}
        placeholder={`Message ${character.name}...`}
      />
    </div>
  );
}

// Need to add React import for useState/useEffect used inline
import React from "react";

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
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold mb-4">
        {characterName[0]}
      </div>
      <h2 className="text-lg font-semibold mb-2">Start talking with {characterName}</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Send a message to begin your conversation. {characterName} will remember everything you share.
      </p>

      {starterPrompts.length > 0 && (
        <div className="space-y-2 w-full max-w-xs">
          <p className="text-xs text-muted-foreground mb-2">Or try one of these:</p>
          {starterPrompts.slice(0, 3).map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSelect(prompt)}
              className="w-full text-left px-4 py-2.5 rounded-xl bg-muted/50 hover:bg-muted text-sm transition-colors"
            >
              &ldquo;{prompt}&rdquo;
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
