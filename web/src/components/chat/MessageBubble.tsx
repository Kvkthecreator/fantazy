"use client";

import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  characterName?: string;
  characterAvatar?: string | null;
}

export function MessageBubble({
  message,
  characterName = "Character",
  characterAvatar,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
          {characterAvatar ? (
            <img
              src={characterAvatar}
              alt={characterName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            characterName[0]
          )}
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 border shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm border-primary/30"
            : "bg-card rounded-tl-sm border-border/80"
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <time className={cn(
          "text-[10px] mt-1 block",
          isUser ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
}

interface StreamingBubbleProps {
  content: string;
  characterName?: string;
  characterAvatar?: string | null;
}

export function StreamingBubble({
  content,
  characterName = "Character",
  characterAvatar,
}: StreamingBubbleProps) {
  return (
    <div className="flex gap-3 mb-4">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
        {characterAvatar ? (
          <img
            src={characterAvatar}
        alt={characterName}
        className="w-full h-full rounded-full object-cover"
      />
    ) : (
      characterName[0]
        )}
      </div>

      {/* Message content */}
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-card border border-border/80 px-4 py-2.5 shadow-sm">
        <p className="text-sm whitespace-pre-wrap break-words">
          {content}
          <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/50 animate-pulse" />
        </p>
      </div>
    </div>
  );
}
