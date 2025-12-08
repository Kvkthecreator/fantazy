"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/useAuth";
import { fetchWithToken } from "@/lib/fetchWithToken";
import { useSmartPolling } from "@/lib/hooks/useSmartPolling";

interface ActiveContextItem {
  type: string;
  content?: string;
  summary?: string;
  relevance_score: number;
}

interface DocumentContext {
  document_id: string;
  analysis_timestamp: string;
  focus_area: string;
  current_themes: string[];
  active_context_items: ActiveContextItem[];
  confidence_score: number;
  last_updated: string;
  status: "analyzing" | "complete" | "error";
}

export function useDocumentContext(documentId?: string, refreshInterval: number = 15000) {  // Increased from 5s to 15s
  const { user } = useAuth();
  
  // Smart polling: pause when inactive
  const { swrConfig } = useSmartPolling({
    activeInterval: refreshInterval,
    inactiveInterval: 0,  // Pause when inactive
    refreshOnFocus: true,
  });
  
  const { data, error, isLoading, mutate } = useSWR<DocumentContext>(
    documentId && user ? `/api/intelligence/document/${documentId}/context` : null,
    async (url: string) => {
      const response = await fetchWithToken(url);
      if (!response.ok) {
        throw new Error('Failed to fetch document context');
      }
      return response.json();
    },
    {
      ...swrConfig,  // Use smart polling config
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      dedupingInterval: 1000
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
    refresh: () => mutate()
  };
}