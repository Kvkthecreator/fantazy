"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { fetchWithToken } from '@/lib/fetchWithToken';

export interface ContentInput {
  type: 'text' | 'file' | 'url' | 'pdf' | 'image';
  content: string;
  metadata?: Record<string, any>;
}

export interface IntelligenceResult {
  themes: string[];
  context_items: Array<{
    type: string;
    content: string;
    relevance_score: number;
  }>;
  patterns: Array<{
    pattern_type: string;
    description: string;
    confidence: number;
  }>;
  confidence_score: number;
}

export interface SuggestedDocument {
  title: string;
  type: string;
  description: string;
  initial_content: string;
  relevance: number;
}

export interface BasketStructure {
  suggested_name: string;
  description: string;
  organization_strategy: string;
}

export interface ProcessingResponse {
  intelligence: IntelligenceResult;
  suggested_structure: {
    documents: SuggestedDocument[];
    organization: BasketStructure;
  };
  processing_summary: string;
  processed_at: string;
  processing_intent: string;
}

export interface BasketInitializationResult {
  basket: {
    id: string;
    name: string;
    status: string;
    created_at: string;
  };
  documents: Array<{
    id: string;
    title: string;
    type: string;
  }>;
  context_items: number;
  blocks_created: number;
  intelligence_summary: {
    themes_count: number;
    confidence_score: number;
    patterns_identified: number;
  };
  next_steps: string[];
}

export function useUniversalIntelligence() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processContent = async (
    inputs: ContentInput[],
    processing_intent: 'onboarding' | 'enhancement' = 'onboarding',
    workspace_context?: { basket_id?: string; existing_themes?: string[] }
  ): Promise<ProcessingResponse | null> => {
    if (!user || !inputs.length) return null;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetchWithToken('/api/intelligence/process-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs,
          workspace_context,
          processing_intent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process content');
      }

      const result: ProcessingResponse = await response.json();
      setProcessingResult(result);
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Content processing error:', err);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const createInitialBasket = async (
    intelligence: IntelligenceResult,
    suggested_structure: {
      documents: SuggestedDocument[];
      organization: BasketStructure;
    },
    user_modifications?: {
      basket_name?: string;
      selected_documents?: string[];
      additional_context?: string;
    }
  ): Promise<BasketInitializationResult | null> => {
    if (!user) return null;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetchWithToken('/api/intelligence/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intelligence,
          suggested_structure,
          user_modifications
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initialize basket');
      }

      const { result } = await response.json();
      return result as BasketInitializationResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Basket initialization error:', err);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setProcessingResult(null);
    setError(null);
    setIsProcessing(false);
  };

  return {
    processContent,
    createInitialBasket,
    reset,
    isProcessing,
    processingResult,
    error,
    // Computed properties for easier access
    hasResult: !!processingResult,
    themes: processingResult?.intelligence.themes || [],
    confidence: processingResult?.intelligence.confidence_score || 0,
    suggestedDocuments: processingResult?.suggested_structure.documents || [],
    basketName: processingResult?.suggested_structure.organization.suggested_name || '',
  };
}

// Real-time processing hook for live updates
export function useRealtimeIntelligence(inputs: ContentInput[]) {
  const { processContent } = useUniversalIntelligence();
  const [liveResult, setLiveResult] = useState<ProcessingResponse | null>(null);
  const [isLiveProcessing, setIsLiveProcessing] = useState(false);

  useEffect(() => {
    if (inputs.length === 0) {
      setLiveResult(null);
      return;
    }

    // Debounce processing to avoid excessive API calls
    const timeoutId = setTimeout(async () => {
      setIsLiveProcessing(true);
      const result = await processContent(inputs, 'onboarding');
      setLiveResult(result);
      setIsLiveProcessing(false);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [inputs, processContent]);

  return {
    liveResult,
    isLiveProcessing,
    hasLiveResult: !!liveResult,
    liveThemes: liveResult?.intelligence.themes || [],
    liveConfidence: liveResult?.intelligence.confidence_score || 0,
  };
}