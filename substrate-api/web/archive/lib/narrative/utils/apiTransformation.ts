/**
 * API Transformation Utilities
 * 
 * Transform API responses from Python narrative intelligence backend
 * into frontend-friendly data structures
 */

import { transformConfidenceToNarrative, transformHealthToNarrative } from './languageTransformation';
import { formatTimeAgo, formatInsightCount } from './narrativeFormatting';

export interface TransformedDashboardData {
  understanding: string;
  themes: string[];
  nextSteps: Array<{
    description: string;
    priority: number;
  }>;
  actions: Array<{
    type: string;
    label: string;
    enabled: boolean;
    primary?: boolean;
  }>;
  confidenceScore: number;
  memoryGrowth: number;
  lastUpdated: string;
  stage?: string;
  health?: string;
  insights: number;
}

export function transformDashboardResponse(apiResponse: any): TransformedDashboardData {
  if (!apiResponse?.success || !apiResponse?.dashboard) {
    return createFallbackDashboardData();
  }

  const dashboard = apiResponse.dashboard;
  
  return {
    understanding: dashboard.understanding?.current_understanding || "Building understanding of your project...",
    
    themes: dashboard.understanding?.discovered_themes?.map((theme: any) => theme.name) || [],
    
    nextSteps: dashboard.next_steps?.immediate_steps?.map((step: any, index: number) => ({
      description: step.description,
      priority: index + 1
    })) || [],
    
    actions: dashboard.guidance?.slice(0, 3)?.map((guidance: any) => ({
      type: "guidance",
      label: guidance.title,
      enabled: true,
      primary: guidance.difficulty === "beginner_friendly"
    })) || [],
    
    confidenceScore: transformConfidenceScore(dashboard.understanding?.confidence?.level),
    
    memoryGrowth: calculateMemoryGrowth(dashboard.health?.overall_health),
    
    lastUpdated: dashboard.timestamp || new Date().toISOString(),
    
    stage: dashboard.understanding?.intelligence_level?.stage,
    
    health: dashboard.health?.overall_health,
    
    insights: 0 // TODO: Get from insights API when available
  };
}

export function transformProjectUnderstanding(apiResponse: any) {
  if (!apiResponse?.success || !apiResponse?.understanding) {
    return null;
  }

  const understanding = apiResponse.understanding;
  
  return {
    personalized_greeting: understanding.personalized_greeting,
    current_understanding: understanding.current_understanding,
    intelligence_level: understanding.intelligence_level,
    confidence: understanding.confidence,
    discovered_themes: understanding.discovered_themes || [],
    next_steps: understanding.next_steps || [],
    recommended_actions: understanding.recommended_actions || []
  };
}

export function transformGuidanceResponse(apiResponse: any) {
  if (!apiResponse?.success || !apiResponse?.guidance) {
    return [];
  }

  return apiResponse.guidance.map((item: any) => ({
    title: item.title,
    description: item.description,
    recommendation: item.recommendation,
    reasoning: item.reasoning,
    action_plan: item.action_plan || [],
    expected_outcome: item.expected_outcome,
    timeframe: item.timeframe,
    difficulty: item.difficulty
  }));
}

export function transformHealthResponse(apiResponse: any) {
  if (!apiResponse?.success || !apiResponse?.health_assessment) {
    return null;
  }

  const health = apiResponse.health_assessment;
  
  return {
    overall_health: health.overall_health,
    strengths: health.strengths || [],
    improvement_areas: health.improvement_areas || [],
    recommendations: health.recommendations || [],
    progress_trajectory: health.progress_trajectory
  };
}

function transformConfidenceScore(confidenceLevel: string): number {
  const confidenceMap: Record<string, number> = {
    'just_getting_started': 10,
    'building_understanding': 40,
    'solid_grasp': 70,
    'comprehensive_knowledge': 90
  };
  
  return confidenceMap[confidenceLevel] || 10;
}

function calculateMemoryGrowth(healthLevel: string): number {
  const growthMap: Record<string, number> = {
    'excellent': 15,
    'good': 10,
    'developing': 5,
    'needs_attention': 0
  };
  
  return growthMap[healthLevel] || 0;
}

function createFallbackDashboardData(): TransformedDashboardData {
  return {
    understanding: "Add some content to help me understand your project",
    themes: [],
    nextSteps: [],
    actions: [],
    confidenceScore: 0,
    memoryGrowth: 0,
    lastUpdated: new Date().toISOString(),
    insights: 0
  };
}

export function transformErrorToUserMessage(error: any): string {
  if (typeof error === 'string') {
    return transformTechnicalError(error);
  }
  
  if (error?.message) {
    return transformTechnicalError(error.message);
  }
  
  return "I'm having trouble right now. Please try again in a moment.";
}

function transformTechnicalError(technicalError: string): string {
  const errorMap: Record<string, string> = {
    'Failed to fetch': "I can't connect right now. Please check your connection and try again.",
    'Network error': "There's a connection issue. Please try again in a moment.",
    '404': "I couldn't find what you're looking for. The content might have moved.",
    '500': "I'm experiencing some technical difficulties. Please try again soon.",
    'Unauthorized': "You need to sign in to access this.",
    'Forbidden': "You don't have permission to access this content.",
    'Timeout': "This is taking longer than expected. Please try again."
  };
  
  for (const [technical, narrative] of Object.entries(errorMap)) {
    if (technicalError.toLowerCase().includes(technical.toLowerCase())) {
      return narrative;
    }
  }
  
  return "Something unexpected happened. Please try again.";
}

export function createProgressiveDisclosureData(
  story: string,
  technicalDetails?: any,
  reasoning?: string
): {
  story: string;
  reasoning?: string;
  substrate?: any;
} {
  return {
    story: story,
    reasoning: reasoning,
    substrate: technicalDetails
  };
}