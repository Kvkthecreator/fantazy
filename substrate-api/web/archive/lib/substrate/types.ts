/**
 * Substrate Intelligence Types
 * 
 * Complete type definitions for the substrate dashboard system that transforms
 * raw basket data into living, intelligence-driven workspace displays.
 */

export interface SubstrateIntelligence {
  basketInfo: {
    id: string;
    name: string;
    status: 'active' | 'archived' | 'draft';
    lastUpdated: string;
    documentCount: number;
    workspaceId: string;
  };
  
  contextUnderstanding: {
    intent: string;
    themes: string[];
    coherenceScore: number;
    lastAnalysis: string;
  };
  
  documents: DocumentSubstrateStatus[];
  
  intelligence: {
    insights: SubstrateInsight[];
    recommendations: SubstrateRecommendation[];
    contextAlerts: ContextAlert[];
    recentActivity: ActivitySummary[];
  };
  
  substrateHealth: {
    contextQuality: number;
    documentAlignment: number;
    evolutionRate: 'stable' | 'growing' | 'active';
  };
}

export interface DocumentSubstrateStatus {
  id: string;
  title: string;
  type: string;
  status: 'stable' | 'growing' | 'review_needed' | 'potential';
  contextAlignment: number;
  lastEvolution: string;
  impactSummary: string;
  actions: DocumentAction[];
}

export interface DocumentAction {
  type: string;
  label: string;
}

export interface SubstrateInsight {
  id: string;
  type: 'pattern_detected' | 'conflict_identified' | 'opportunity_found';
  title: string;
  description: string;
  confidence: number;
  affectedDocuments: string[];
  contextSource: string;
}

export interface SubstrateRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  actions: RecommendationAction[];
  estimatedImpact: 'high' | 'medium' | 'low';
}

export interface RecommendationAction {
  type: string;
  label: string;
}

export interface ContextAlert {
  id: string;
  type: 'conflict' | 'drift' | 'gap' | 'quality';
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  affectedDocuments: string[];
  suggestedActions: string[];
}

export interface ActivitySummary {
  timestamp: string;
  type: 'context_added' | 'document_evolved' | 'insight_generated';
  impact: 'high' | 'medium' | 'low';
  description: string;
  details?: string;
}

// Content input types for universal processor integration
export interface SubstrateContentInput {
  type: 'text' | 'file' | 'pdf' | 'image' | 'url';
  content: string;
  metadata?: {
    filename?: string;
    size?: number;
    fileObject?: File;
    processorType?: string;
    extractionQuality?: number;
    [key: string]: any;
  };
}

// Processing result from add-context endpoint
export interface AddContextResult {
  success: boolean;
  rawDumpId: string;
  processingResults: {
    contentProcessed: number;
    insights: string;
    filesProcessed: number;
    processingQuality?: string | number;
  };
}