"use client";

import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  characterName?: string;
  characterAvatar?: string | null;
  hasBackground?: boolean;
}

export function MessageBubble({
  message,
  characterName = "Character",
  characterAvatar,
  hasBackground = false,
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
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium shadow-lg ring-2 ring-white/20">
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
          "max-w-[85%] rounded-2xl px-4 py-3 shadow-lg transition-colors",
          isUser
            ? cn(
                "rounded-tr-md",
                hasBackground
                  ? "bg-white/90 text-gray-900 backdrop-blur-sm"
                  : "bg-primary text-primary-foreground"
              )
            : cn(
                "rounded-tl-md backdrop-blur-xl backdrop-saturate-150",
                hasBackground
                  ? "bg-black/50 text-white border border-white/10"
                  : "bg-card/90 text-foreground border border-border/50"
              )
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
        <time className={cn(
          "text-[10px] mt-1.5 block",
          isUser
            ? hasBackground ? "text-gray-500" : "text-primary-foreground/70"
            : hasBackground ? "text-white/50" : "text-muted-foreground"
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
  hasBackground?: boolean;
}

export function StreamingBubble({
  content,
  characterName = "Character",
  characterAvatar,
  hasBackground = false,
}: StreamingBubbleProps) {
  return (
    <div className="flex gap-3 mb-4">
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium shadow-lg ring-2 ring-white/20">
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
      <div className={cn(
        "max-w-[85%] rounded-2xl rounded-tl-md px-4 py-3 shadow-lg",
        "backdrop-blur-xl backdrop-saturate-150",
        hasBackground
          ? "bg-black/50 text-white border border-white/10"
          : "bg-card/90 text-foreground border border-border/50"
      )}>
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {content}
          <span className="inline-block w-1.5 h-4 ml-1 bg-current/50 animate-pulse rounded-sm" />
        </p>
      </div>
    </div>
  );
}
