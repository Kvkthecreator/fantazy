"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Send, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { GameMessageResponse } from "@/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface GameState {
  sessionId: string;
  anonymousId: string | null;
  characterName: string;
  characterAvatarUrl: string | null;
  turnBudget: number;
  situation: string;
  openingLine: string;
}

function HometownCrushChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [turnsRemaining, setTurnsRemaining] = useState(4);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load game state from session storage or redirect if no session
  useEffect(() => {
    if (!sessionId) {
      router.replace("/play/hometown-crush");
      return;
    }

    const storedState = sessionStorage.getItem(`hometown-crush-${sessionId}`);
    if (storedState) {
      const state = JSON.parse(storedState) as GameState;
      setGameState(state);
      setTurnsRemaining(state.turnBudget);
      setMessages([{
        id: "opening",
        role: "assistant",
        content: state.openingLine,
      }]);
    } else {
      router.replace("/play/hometown-crush");
    }
  }, [sessionId, router]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !sessionId || isSending || isComplete) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsSending(true);
    setError(null);

    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: userMessage }]);

    try {
      const response: GameMessageResponse = await api.games.sendMessage(
        "hometown-crush",
        sessionId,
        userMessage,
        gameState?.anonymousId || undefined
      );

      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", content: response.message_content },
      ]);

      setTurnCount(response.turn_count);
      setTurnsRemaining(response.turns_remaining);

      if (response.is_complete) {
        setIsComplete(true);
        setTimeout(() => {
          router.push(`/play/hometown-crush/result?session=${sessionId}`);
        }, 1500);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [inputValue, sessionId, isSending, isComplete, gameState?.anonymousId, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <Link
            href="/play/hometown-crush"
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
            {gameState.characterAvatarUrl ? (
              <img
                src={gameState.characterAvatarUrl}
                alt={gameState.characterName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-primary-foreground">
                {gameState.characterName[0]}
              </span>
            )}
          </div>
          <div>
            <h1 className="font-semibold">{gameState.characterName}</h1>
            <p className="text-xs text-muted-foreground">The Flirt Test</p>
          </div>
        </div>
        {/* Turn counter */}
        <div className="text-right">
          <div className="text-sm font-medium">
            {turnsRemaining} {turnsRemaining === 1 ? "turn" : "turns"} left
          </div>
          <div className="text-xs text-muted-foreground">
            {turnCount} of {gameState.turnBudget}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Situation */}
          <div className="text-center text-muted-foreground text-sm italic mb-6 px-4">
            {gameState.situation}
          </div>

          {/* Messages */}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              characterName={gameState.characterName}
              characterAvatarUrl={gameState.characterAvatarUrl}
            />
          ))}

          {/* Sending indicator */}
          {isSending && (
            <div className="flex gap-2 items-end">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center flex-shrink-0">
                {gameState.characterAvatarUrl ? (
                  <img
                    src={gameState.characterAvatarUrl}
                    alt={gameState.characterName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-primary-foreground">
                    {gameState.characterName[0]}
                  </span>
                )}
              </div>
              <Card className="px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </Card>
            </div>
          )}

          {/* Complete indicator */}
          {isComplete && (
            <div className="text-center py-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Conversation complete! Revealing your trope...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="p-4 border-t bg-card">
        <div className="max-w-2xl mx-auto">
          {error && (
            <p className="text-destructive text-sm text-center mb-2">{error}</p>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending || isComplete}
              placeholder={isComplete ? "Conversation complete" : `Reply to ${gameState.characterName}...`}
              className={cn(
                "flex-1 px-4 py-3 rounded-full",
                "bg-muted border border-border",
                "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending || isComplete}
              size="icon"
              className="h-12 w-12 rounded-full"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-center text-muted-foreground/60 text-xs mt-2">
            This is A.I. and not a real person.
          </p>
        </div>
      </footer>
    </div>
  );
}

function MessageBubble({
  message,
  characterName,
  characterAvatarUrl,
}: {
  message: Message;
  characterName: string;
  characterAvatarUrl: string | null;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "items-end")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center flex-shrink-0">
          {characterAvatarUrl ? (
            <img
              src={characterAvatarUrl}
              alt={characterName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-primary-foreground">
              {characterName[0]}
            </span>
          )}
        </div>
      )}
      <Card
        className={cn(
          "max-w-[80%] px-4 py-3 rounded-2xl",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "rounded-bl-sm"
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </Card>
    </div>
  );
}

export default function HometownCrushChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <HometownCrushChatContent />
    </Suspense>
  );
}
