"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/useAuth";
import { fetchWithToken } from "@/lib/fetchWithToken";
import { useSmartPolling } from "@/lib/hooks/useSmartPolling";
import type { ContextItem } from "@/shared/contracts/context";

interface BlockSuggestion {
  suggestion_id: string;
  block_type: string;
  suggested_content: string;
  confidence: number;
  reasoning: string;
  position: number;
}

interface MemoryConnection {
  connection_id: string;
  related_document_id: string;
  related_content: string;
  connection_type: "thematic" | "factual" | "contextual" | "reference";
  strength: number;
  position?: {
    start: number;
    end: number;
  };
}

interface CursorContextData {
  document_id: string;
  cursor_position: number;
  relevant_context_items: ContextItem[];
  suggested_blocks: BlockSuggestion[];
  memory_connections: MemoryConnection[];
  last_updated: string;
}

export function useDocumentIntelligence(
  documentId: string,
  cursorPosition?: number,
  refreshInterval: number = 12000  // Reduced from 3s to 12s
) {
  const { user } = useAuth();
  
  // Smart polling: slower when inactive
  const { swrConfig } = useSmartPolling({
    activeInterval: refreshInterval,
    inactiveInterval: 0,  // Pause when inactive
    refreshOnFocus: true,
  });
  
  const { data, error, isLoading, mutate } = useSWR<CursorContextData>(
    documentId && user && cursorPosition !== undefined
      ? `/api/intelligence/document/${documentId}/cursor-context?position=${cursorPosition}`
      : null,
    async (url: string) => {
      const response = await fetchWithToken(url);
      if (!response.ok) {
        throw new Error('Failed to fetch document intelligence');
      }
      return response.json();
    },
    {
      ...swrConfig,  // Use smart polling config
      errorRetryCount: 2,
      errorRetryInterval: 1000,
      dedupingInterval: 500
    }
  );

  return {
    contextItems: data?.relevant_context_items || [],
    blockSuggestions: data?.suggested_blocks || [],
    memoryConnections: data?.memory_connections || [],
    isLoading,
    error,
    refresh: () => mutate()
  };
}

interface SelectionAnalysisData {
  document_id: string;
  selected_text: string;
  context_suggestions: ContextItem[];
  related_content: {
    document_id: string;
    content: string;
    relevance: number;
  }[];
  enhancement_options: {
    type: string;
    description: string;
    suggested_action: string;
  }[];
}

export function useSelectionAnalysis(
  documentId: string,
  selectedText?: string,
  documentContext?: string
) {
  const { user } = useAuth();
  
  const { data, error, isLoading, mutate } = useSWR<SelectionAnalysisData>(
    documentId && user && selectedText
      ? `/api/intelligence/document/${documentId}/analyze-selection`
      : null,
    async (url: string) => {
      const response = await fetchWithToken(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selected_text: selectedText,
          document_context: documentContext || ""
        })
      });
      if (!response.ok) {
        throw new Error('Failed to analyze selection');
      }
      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      errorRetryCount: 1,
      dedupingInterval: 1000
    }
  );

  return {
    contextSuggestions: data?.context_suggestions || [],
    relatedContent: data?.related_content || [],
    enhancementOptions: data?.enhancement_options || [],
    isLoading,
    error,
    refresh: () => mutate()
  };
}