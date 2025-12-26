"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api, APIError } from "@/lib/api/client";
import type {
  Message,
  Episode,
  RateLimitError,
  EpisodeAccessError,
  StreamDirectorState,
  StreamEpisodeCompleteEvent,
  StreamVisualPendingEvent,
  StreamInstructionCardEvent,
  StreamNeedsSparksEvent,
  StreamEvent,
  VisualType,
} from "@/types";

// Visual pending state for Director V2
interface VisualPendingState {
  visual_type: Exclude<VisualType, "none" | "instruction">;
  visual_hint: string | null;
  sparks_deducted: number;
}

interface UseChatOptions {
  characterId: string;
  episodeTemplateId?: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onRateLimitExceeded?: (error: RateLimitError) => void;
  onEpisodeAccessDenied?: (error: EpisodeAccessError) => void;
  onEpisodeComplete?: (event: StreamEpisodeCompleteEvent) => void;
  onVisualPending?: (event: StreamVisualPendingEvent) => void;
  onInstructionCard?: (event: StreamInstructionCardEvent) => void;
  onNeedsSparks?: (event: StreamNeedsSparksEvent) => void;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  episode: Episode | null;
  streamingContent: string;
  suggestScene: boolean;
  // Director V2 state
  directorState: StreamDirectorState | null;
  isEpisodeComplete: boolean;
  nextSuggestion: StreamEpisodeCompleteEvent["next_suggestion"];
  evaluation: StreamEpisodeCompleteEvent["evaluation"];  // Games evaluation (optional)
  // Director V2 visual state
  visualPending: VisualPendingState | null;
  instructionCards: string[];  // Accumulated instruction cards for session
  needsSparks: boolean;
  // Actions
  sendMessage: (content: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  startNewEpisode: () => Promise<void>;
  endEpisode: () => Promise<void>;
  clearSceneSuggestion: () => void;
  clearCompletion: () => void;
  clearVisualPending: () => void;
  clearNeedsSparks: () => void;
}

export function useChat({
  characterId,
  episodeTemplateId,
  enabled = true,
  onError,
  onRateLimitExceeded,
  onEpisodeAccessDenied,
  onEpisodeComplete,
  onVisualPending,
  onInstructionCard,
  onNeedsSparks,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [suggestScene, setSuggestScene] = useState(false);

  // Director V2 state
  const [directorState, setDirectorState] = useState<StreamDirectorState | null>(null);
  const [isEpisodeComplete, setIsEpisodeComplete] = useState(false);
  const [nextSuggestion, setNextSuggestion] = useState<StreamEpisodeCompleteEvent["next_suggestion"]>(null);
  const [evaluation, setEvaluation] = useState<StreamEpisodeCompleteEvent["evaluation"]>(undefined);

  // Director V2 visual state
  const [visualPending, setVisualPending] = useState<VisualPendingState | null>(null);
  const [instructionCards, setInstructionCards] = useState<string[]>([]);
  const [needsSparks, setNeedsSparks] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Store callbacks in refs to avoid dependency issues causing infinite loops
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onRateLimitExceededRef = useRef(onRateLimitExceeded);
  onRateLimitExceededRef.current = onRateLimitExceeded;
  const onEpisodeAccessDeniedRef = useRef(onEpisodeAccessDenied);
  onEpisodeAccessDeniedRef.current = onEpisodeAccessDenied;
  const onEpisodeCompleteRef = useRef(onEpisodeComplete);
  onEpisodeCompleteRef.current = onEpisodeComplete;
  const onVisualPendingRef = useRef(onVisualPending);
  onVisualPendingRef.current = onVisualPending;
  const onInstructionCardRef = useRef(onInstructionCard);
  onInstructionCardRef.current = onInstructionCard;
  const onNeedsSparksRef = useRef(onNeedsSparks);
  onNeedsSparksRef.current = onNeedsSparks;

  // Track if we've already loaded for this characterId + episodeTemplateId combo
  const loadedKeyRef = useRef<string | null>(null);

  // Load active episode and messages
  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get or create active episode
      let activeEpisode = await api.episodes.getActive(characterId);

      // Check if the active session matches what we need:
      // - If episodeTemplateId provided: active session must have matching episode_template_id
      // - If NO episodeTemplateId (free chat): active session must have NULL episode_template_id
      const needsNewSession =
        !activeEpisode ||
        (episodeTemplateId && activeEpisode.episode_template_id !== episodeTemplateId) ||
        (!episodeTemplateId && activeEpisode.episode_template_id);

      if (needsNewSession) {
        // Use conversation.start which properly handles session scoping by episode_template_id
        // - With episodeTemplateId: creates/reactivates episode session
        // - Without episodeTemplateId: creates/reactivates free chat session (episode_template_id = NULL)
        try {
          activeEpisode = await api.conversation.start(characterId, {
            episodeTemplateId,
          });
        } catch (err) {
          if (err instanceof APIError && err.status === 409) {
            // Session might already exist - try fetching again
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
      // Check if this is an episode access error (402 - insufficient sparks for episode)
      if (error instanceof APIError && error.status === 402) {
        const accessError = error.data as EpisodeAccessError;
        onEpisodeAccessDeniedRef.current?.(accessError);
      } else {
        onErrorRef.current?.(error as Error);
      }
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
        } else if (event.type === "visual_pending") {
          // Director V2: Visual generation started
          setVisualPending({
            visual_type: event.visual_type,
            visual_hint: event.visual_hint,
            sparks_deducted: event.sparks_deducted,
          });
          onVisualPendingRef.current?.(event);
        } else if (event.type === "instruction_card") {
          // Director V2: Instruction card (free, no image)
          setInstructionCards((prev) => [...prev, event.content]);
          onInstructionCardRef.current?.(event);
        } else if (event.type === "needs_sparks") {
          // Director V2: User needs more sparks
          setNeedsSparks(true);
          onNeedsSparksRef.current?.(event);
        } else if (event.type === "episode_complete") {
          // Director detected episode completion
          setIsEpisodeComplete(true);
          setNextSuggestion(event.next_suggestion);
          // Set evaluation if provided (Games feature)
          if (event.evaluation) {
            setEvaluation(event.evaluation);
          }

          // Update director state to show completion
          setDirectorState((prev) => ({
            ...(prev || { turn_count: event.turn_count, turns_remaining: 0, pacing: "resolve" }),
            turn_count: event.turn_count,
            turns_remaining: 0,
            is_complete: true,
            status: "done",
            pacing: "resolve",  // Episode complete = resolve phase
          }));

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
            console.log("[useChat] Director state received:", event.director);
            setDirectorState(event.director);
          } else {
            console.warn("[useChat] Done event missing director data:", event);
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
    setNextSuggestion(null);
  }, []);

  // Clear visual pending state (after image is rendered or dismissed)
  const clearVisualPending = useCallback(() => {
    setVisualPending(null);
  }, []);

  // Clear needs sparks state (after user dismisses prompt)
  const clearNeedsSparks = useCallback(() => {
    setNeedsSparks(false);
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
    // Director V2 state
    directorState,
    isEpisodeComplete,
    nextSuggestion,
    evaluation,
    // Director V2 visual state
    visualPending,
    instructionCards,
    needsSparks,
    // Actions
    sendMessage,
    loadMessages,
    startNewEpisode,
    endEpisode,
    clearSceneSuggestion,
    clearCompletion,
    clearVisualPending,
    clearNeedsSparks,
  };
}
