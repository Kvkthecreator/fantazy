"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api, APIError } from "@/lib/api/client";
import type {
  Message,
  Episode,
  RateLimitError,
  StreamDirectorState,
  StreamEpisodeCompleteEvent,
  StreamEvent,
} from "@/types";

interface UseChatOptions {
  characterId: string;
  episodeTemplateId?: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onRateLimitExceeded?: (error: RateLimitError) => void;
  onEpisodeComplete?: (event: StreamEpisodeCompleteEvent) => void;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  episode: Episode | null;
  streamingContent: string;
  suggestScene: boolean;
  // Director state (for ALL episodes)
  directorState: StreamDirectorState | null;
  isEpisodeComplete: boolean;
  evaluation: StreamEpisodeCompleteEvent["evaluation"];
  nextSuggestion: StreamEpisodeCompleteEvent["next_suggestion"];
  // Actions
  sendMessage: (content: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  startNewEpisode: () => Promise<void>;
  endEpisode: () => Promise<void>;
  clearSceneSuggestion: () => void;
  clearCompletion: () => void;
}

export function useChat({ characterId, episodeTemplateId, enabled = true, onError, onRateLimitExceeded, onEpisodeComplete }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [suggestScene, setSuggestScene] = useState(false);

  // Director state (for ALL episodes - open + bounded)
  const [directorState, setDirectorState] = useState<StreamDirectorState | null>(null);
  const [isEpisodeComplete, setIsEpisodeComplete] = useState(false);
  const [evaluation, setEvaluation] = useState<StreamEpisodeCompleteEvent["evaluation"]>(null);
  const [nextSuggestion, setNextSuggestion] = useState<StreamEpisodeCompleteEvent["next_suggestion"]>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Store callbacks in refs to avoid dependency issues causing infinite loops
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onRateLimitExceededRef = useRef(onRateLimitExceeded);
  onRateLimitExceededRef.current = onRateLimitExceeded;
  const onEpisodeCompleteRef = useRef(onEpisodeComplete);
  onEpisodeCompleteRef.current = onEpisodeComplete;

  // Track if we've already loaded for this characterId + episodeTemplateId combo
  const loadedKeyRef = useRef<string | null>(null);

  // Load active episode and messages
  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get or create active episode
      let activeEpisode = await api.episodes.getActive(characterId);

      // If we have an episodeTemplateId from URL, check if the active episode matches
      // If not, we need to get/create the correct session for that template
      if (episodeTemplateId && activeEpisode && activeEpisode.episode_template_id !== episodeTemplateId) {
        // The active episode doesn't match the requested template
        // Use conversation.start which properly handles episode template scoping
        try {
          activeEpisode = await api.conversation.start(characterId, {
            episodeTemplateId,
          });
        } catch (err) {
          if (err instanceof APIError && err.status === 409) {
            // Session might already exist - try fetching again
            // Note: getActive doesn't support template filtering, so we use what start returned
          } else {
            throw err;
          }
        }
      } else if (!activeEpisode) {
        // No active episode at all - start new episode with template if provided
        try {
          activeEpisode = await api.conversation.start(characterId, {
            episodeTemplateId,
          });
        } catch (err) {
          // If the backend returns a conflict because the engagement/session already exists, recover gracefully.
          if (err instanceof APIError && err.status === 409) {
            // Attempt to fetch the freshly-active episode again (or one may have been created in parallel)
            activeEpisode = await api.episodes.getActive(characterId);
          } else {
            throw err;
          }
        }
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
  }, [characterId, episodeTemplateId]);

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
      let messageAdded = false;

      for await (const chunk of api.conversation.sendStream(characterId, content, episodeTemplateId)) {
        const event = chunk as StreamEvent;

        if (event.type === "chunk") {
          fullContent += event.content;
          setStreamingContent(fullContent);
        } else if (event.type === "episode_complete") {
          // Director detected episode completion
          setIsEpisodeComplete(true);
          setEvaluation(event.evaluation);
          setNextSuggestion(event.next_suggestion);

          // Update director state to show completion
          setDirectorState({
            turn_count: event.turn_count,
            turns_remaining: 0,
            is_complete: true,
          });

          // Call callback if provided
          onEpisodeCompleteRef.current?.(event);
        } else if (event.type === "done") {
          // Add complete assistant message
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            episode_id: episode.id,
            role: "assistant",
            content: event.content || fullContent,
            model_used: null,
            tokens_input: null,
            tokens_output: null,
            latency_ms: null,
            metadata: {},
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent("");
          messageAdded = true;

          // Check if backend suggests generating a scene
          if (event.suggest_scene) {
            setSuggestScene(true);
          }

          // Update director state from done event (for ALL episodes)
          if (event.director) {
            setDirectorState(event.director);
          }
        }
      }

      // If stream ended without "done" event, add what we have
      if (fullContent && !messageAdded) {
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
      // Check if this is a rate limit error (429)
      if (error instanceof APIError && error.status === 429) {
        const rateLimitError = error.data as RateLimitError;
        onRateLimitExceededRef.current?.(rateLimitError);
        // Remove the optimistic user message on rate limit
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      } else {
        onErrorRef.current?.(error as Error);
      }
      // Keep user message but show error for other errors
    } finally {
      setIsSending(false);
      setStreamingContent("");
    }
  }, [characterId, episode, isSending, episodeTemplateId]);

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

  // Clear scene suggestion
  const clearSceneSuggestion = useCallback(() => {
    setSuggestScene(false);
  }, []);

  // Clear completion state (for dismissing the completion modal)
  const clearCompletion = useCallback(() => {
    setIsEpisodeComplete(false);
    setEvaluation(null);
    setNextSuggestion(null);
  }, []);

  // Load on mount (only when enabled, and only once per characterId + episodeTemplateId combo)
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Create a unique key for characterId + episodeTemplateId combo
    const loadKey = `${characterId}:${episodeTemplateId || "default"}`;

    // Prevent infinite loops - only load once per key
    if (loadedKeyRef.current === loadKey) {
      return;
    }
    loadedKeyRef.current = loadKey;

    loadMessages();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadMessages, enabled, characterId, episodeTemplateId]);

  return {
    messages,
    isLoading,
    isSending,
    episode,
    streamingContent,
    suggestScene,
    // Director state
    directorState,
    isEpisodeComplete,
    evaluation,
    nextSuggestion,
    // Actions
    sendMessage,
    loadMessages,
    startNewEpisode,
    endEpisode,
    clearSceneSuggestion,
    clearCompletion,
  };
}
