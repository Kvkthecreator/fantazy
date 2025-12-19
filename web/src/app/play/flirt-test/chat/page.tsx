"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GameMessageResponse } from "@/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface GameState {
  sessionId: string;
  characterName: string;
  characterAvatarUrl: string | null;
  turnBudget: number;
  situation: string;
  openingLine: string;
}

function FlirtTestChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [turnsRemaining, setTurnsRemaining] = useState(7);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load game state from session storage or redirect if no session
  useEffect(() => {
    if (!sessionId) {
      router.replace("/play/flirt-test");
      return;
    }

    // Try to get game state from session storage
    const storedState = sessionStorage.getItem(`flirt-test-${sessionId}`);
    if (storedState) {
      const state = JSON.parse(storedState) as GameState;
      setGameState(state);
      setTurnsRemaining(state.turnBudget);
      // Add opening line as first message
      setMessages([{
        id: "opening",
        role: "assistant",
        content: state.openingLine,
      }]);
    } else {
      // If no stored state, redirect to start
      router.replace("/play/flirt-test");
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

    // Optimistically add user message
    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: userMessage }]);

    try {
      // Send message to API
      const response: GameMessageResponse = await api.games.sendMessage(
        "flirt-test",
        sessionId,
        userMessage
      );

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "assistant", content: response.message_content },
      ]);

      setTurnCount(response.turn_count);
      setTurnsRemaining(response.turns_remaining);

      if (response.is_complete) {
        setIsComplete(true);
        // Wait a moment then redirect to result
        setTimeout(() => {
          router.push(`/play/flirt-test/result?session=${sessionId}`);
        }, 1500);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message. Please try again.");
      // Remove the optimistic user message
      setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [inputValue, sessionId, isSending, isComplete, router]);

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 backdrop-blur-sm bg-black/20">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-purple-400 flex items-center justify-center text-lg font-bold">
            {gameState.characterName[0]}
          </div>
          <div>
            <h1 className="font-semibold">{gameState.characterName}</h1>
            <p className="text-xs text-white/50">Flirt Test</p>
          </div>
        </div>
        {/* Turn counter */}
        <div className="text-right">
          <div className="text-sm font-medium">
            {turnsRemaining} {turnsRemaining === 1 ? "turn" : "turns"} left
          </div>
          <div className="text-xs text-white/50">
            {turnCount} of {gameState.turnBudget}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Situation */}
          <div className="text-center text-white/50 text-sm italic mb-6 px-4">
            {gameState.situation}
          </div>

          {/* Messages */}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              characterName={gameState.characterName}
            />
          ))}

          {/* Sending indicator */}
          {isSending && (
            <div className="flex gap-2 items-end">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-purple-400 flex items-center justify-center text-sm font-bold">
                {gameState.characterName[0]}
              </div>
              <div className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Complete indicator */}
          {isComplete && (
            <div className="text-center py-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-rose-500/20 to-purple-500/20 border border-white/20">
                <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Test complete! Getting your result...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="p-4 border-t border-white/10 backdrop-blur-sm bg-black/20">
        <div className="max-w-2xl mx-auto">
          {error && (
            <p className="text-red-400 text-sm text-center mb-2">{error}</p>
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
                "bg-white/10 border border-white/20",
                "text-white placeholder:text-white/40",
                "focus:outline-none focus:border-white/40",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending || isComplete}
              className={cn(
                "px-6 rounded-full",
                "bg-gradient-to-r from-rose-500 to-purple-500 hover:from-rose-400 hover:to-purple-400"
              )}
            >
              Send
            </Button>
          </div>
          <p className="text-center text-white/30 text-xs mt-2">
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
}: {
  message: Message;
  characterName: string;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "items-end")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-purple-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {characterName[0]}
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] px-4 py-3 rounded-2xl",
          isUser
            ? "bg-gradient-to-r from-rose-500 to-purple-500 rounded-br-sm"
            : "bg-white/10 rounded-bl-sm"
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

export default function FlirtTestChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-rose-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    }>
      <FlirtTestChatContent />
    </Suspense>
  );
}
