"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api/client";
import type { Message, Episode, Character } from "@/types";

interface UseChatOptions {
  characterId: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  episode: Episode | null;
  streamingContent: string;
  sendMessage: (content: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  startNewEpisode: () => Promise<void>;
  endEpisode: () => Promise<void>;
}

export function useChat({ characterId, enabled = true, onError }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [streamingContent, setStreamingContent] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);

  // Store onError in a ref to avoid dependency issues causing infinite loops
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Track if we've already loaded for this characterId
  const loadedCharacterRef = useRef<string | null>(null);

  // Load active episode and messages
  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get or create active episode
      let activeEpisode = await api.episodes.getActive(characterId);

      if (!activeEpisode) {
        activeEpisode = await api.conversation.start(characterId);
      }

      setEpisode(activeEpisode);

      // Load messages
      if (activeEpisode) {
        const msgs = await api.messages.list(activeEpisode.id);
        setMessages(msgs);
      }
    } catch (error) {
      onErrorRef.current?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [characterId]);

  // Send message (non-streaming)
  const sendMessageSimple = useCallback(async (content: string) => {
    if (!episode || isSending) return;

    setIsSending(true);

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      episode_id: episode.id,
      role: "user",
      content,
      model_used: null,
      tokens_input: null,
      tokens_output: null,
      latency_ms: null,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await api.conversation.send(characterId, content);

      // Replace temp message and add response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMessage.id);
        // Add real user message (from response context) and assistant response
        return [
          ...filtered,
          { ...tempUserMessage, id: `user-${Date.now()}` },
          response,
        ];
      });
    } catch (error) {
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      onErrorRef.current?.(error as Error);
    } finally {
      setIsSending(false);
    }
  }, [characterId, episode, isSending]);

  // Send message with streaming
  const sendMessage = useCallback(async (content: string) => {
    if (!episode || isSending) return;

    setIsSending(true);
    setStreamingContent("");

    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      episode_id: episode.id,
      role: "user",
      content,
      model_used: null,
      tokens_input: null,
      tokens_output: null,
      latency_ms: null,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      let fullContent = "";

      for await (const chunk of api.conversation.sendStream(characterId, content)) {
        if (chunk.type === "chunk") {
          fullContent += chunk.content;
          setStreamingContent(fullContent);
        } else if (chunk.type === "done") {
          // Add complete assistant message
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            episode_id: episode.id,
            role: "assistant",
            content: chunk.content || fullContent,
            model_used: null,
            tokens_input: null,
            tokens_output: null,
            latency_ms: null,
            metadata: {},
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent("");
        }
      }

      // If stream ended without "done" event, add what we have
      if (fullContent && !messages.find((m) => m.content === fullContent)) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          episode_id: episode.id,
          role: "assistant",
          content: fullContent,
          model_used: null,
          tokens_input: null,
          tokens_output: null,
          latency_ms: null,
          metadata: {},
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingContent("");
      }
    } catch (error) {
      onErrorRef.current?.(error as Error);
      // Keep user message but show error
    } finally {
      setIsSending(false);
      setStreamingContent("");
    }
  }, [characterId, episode, isSending, messages]);

  // Start new episode
  const startNewEpisode = useCallback(async () => {
    try {
      // End current episode if exists
      if (episode?.is_active) {
        await api.conversation.end(characterId);
      }

      // Start new episode
      const newEpisode = await api.conversation.start(characterId);
      setEpisode(newEpisode);
      setMessages([]);
    } catch (error) {
      onErrorRef.current?.(error as Error);
    }
  }, [characterId, episode]);

  // End current episode
  const endEpisode = useCallback(async () => {
    if (!episode?.is_active) return;

    try {
      const ended = await api.conversation.end(characterId);
      setEpisode(ended);
    } catch (error) {
      onErrorRef.current?.(error as Error);
    }
  }, [characterId, episode]);

  // Load on mount (only when enabled, and only once per characterId)
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Prevent infinite loops - only load once per characterId
    if (loadedCharacterRef.current === characterId) {
      return;
    }
    loadedCharacterRef.current = characterId;

    loadMessages();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadMessages, enabled, characterId]);

  return {
    messages,
    isLoading,
    isSending,
    episode,
    streamingContent,
    sendMessage,
    loadMessages,
    startNewEpisode,
    endEpisode,
  };
}
