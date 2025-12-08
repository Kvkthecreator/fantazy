/**
 * Infrastructure Agent: Pure Technical Data Coordination
 * 
 * This agent coordinates between different infrastructure agents and manages
 * technical data flow. It orchestrates analysis workflows and manages caching.
 * 
 * CRITICAL: This agent must NOT contain user-facing language or narrative elements.
 * All outputs are technical coordination data for consumption by narrative agents.
 */

import { BasketAnalysisAgent } from './BasketAnalysisAgent';
import type { BasketDataSubstrate, ThematicAnalysisSubstrate, ContentRelationshipSubstrate, BasketStateClassification } from './BasketAnalysisAgent';
import { ContentProcessingAgent } from './ContentProcessingAgent';
import type { ContentSubstrate, TextAnalysisSubstrate, ContentExtractionResult, ProcessingRecommendations } from './ContentProcessingAgent';

// Technical coordination structures
export interface AnalysisWorkflowRequest {
  basket_id: string;
  analysis_depth: 'basic' | 'standard' | 'comprehensive';
  include_relationships: boolean;
  include_themes: boolean;
  include_content_extraction: boolean;
  cache_results: boolean;
}

export interface CoordinatedAnalysisResult {
  basket_substrate: BasketDataSubstrate;
  basket_classification: BasketStateClassification;
  thematic_analysis?: ThematicAnalysisSubstrate;
  relationship_analysis?: ContentRelationshipSubstrate;
  content_analyses: Array<{
    content_id: string;
    substrate: ContentSubstrate;
    text_analysis: TextAnalysisSubstrate;
    extraction: ContentExtractionResult;
    recommendations: ProcessingRecommendations;
  }>;
  processing_metadata: ProcessingMetadata;
}

export interface ProcessingMetadata {
  analysis_timestamp: string;
  processing_duration_ms: number;
  cache_hit: boolean;
  workflow_id: string;
  agent_versions: {
    basket_analysis: string;
    content_processing: string;
    coordination: string;
  };
  quality_metrics: {
    data_completeness: number;
    analysis_confidence: number;
    processing_success_rate: number;
  };
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiry_ms: number;
  access_count: number;
}

/**
 * Pure Infrastructure Agent: Data Coordination
 * 
 * Coordinates technical analysis workflows between infrastructure agents.
 * Contains NO user-facing language or narrative elements.
 */
export class DataCoordinationAgent {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DEFAULT_EXPIRY = 15 * 60 * 1000; // 15 minutes
  private readonly VERSION = '1.0.0';

  constructor(
    private basketAgent: BasketAnalysisAgent,
    private contentAgent: ContentProcessingAgent
  ) {}

  /**
   * Execute coordinated analysis workflow
   */
  async executeAnalysisWorkflow(request: AnalysisWorkflowRequest): Promise<CoordinatedAnalysisResult> {
    const startTime = Date.now();
    const workflowId = this.generateWorkflowId();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult && request.cache_results) {
      return this.updateProcessingMetadata(cachedResult, startTime, workflowId, true);
    }

    // Execute analysis workflow
    const result = await this.performCoordinatedAnalysis(request, workflowId);
    
    // Cache result if requested
    if (request.cache_results) {
      this.cacheResult(cacheKey, result);
    }

    return this.updateProcessingMetadata(result, startTime, workflowId, false);
  }

  /**
   * Batch process multiple baskets
   */
  async batchProcessBaskets(
    basketIds: string[],
    baseRequest: Omit<AnalysisWorkflowRequest, 'basket_id'>
  ): Promise<CoordinatedAnalysisResult[]> {
    // Process in parallel with concurrency limit
    const concurrencyLimit = 3;
    const results: CoordinatedAnalysisResult[] = [];
    
    for (let i = 0; i < basketIds.length; i += concurrencyLimit) {
      const batch = basketIds.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(basketId =>
        this.executeAnalysisWorkflow({ ...baseRequest, basket_id: basketId })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Get processing statistics
   */
  getProcessingStatistics(): {
    cache_stats: {
      total_entries: number;
      cache_hit_rate: number;
      memory_usage_estimate: number;
    };
    performance_stats: {
      avg_processing_time_ms: number;
      total_workflows_executed: number;
      success_rate: number;
    };
  } {
    const cacheStats = this.calculateCacheStatistics();
    
    return {
      cache_stats: cacheStats,
      performance_stats: {
        avg_processing_time_ms: 0, // Would track this in production
        total_workflows_executed: 0, // Would track this in production
        success_rate: 1.0 // Would track this in production
      }
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): number {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.expiry_ms) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    return cleared;
  }

  /**
   * Force clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  // Private coordination methods
  private async performCoordinatedAnalysis(
    request: AnalysisWorkflowRequest,
    workflowId: string
  ): Promise<CoordinatedAnalysisResult> {
    // Step 1: Extract basket substrate
    const basketSubstrate = await this.basketAgent.extractBasketSubstrate(request.basket_id);
    
    // Step 2: Classify basket state
    const basketClassification = this.basketAgent.classifyBasketState(basketSubstrate);
    
    // Step 3: Process individual content items
    const contentItems = [
      ...basketSubstrate.documents.map(d => ({ id: d.id, text: d.content, type: 'document' as const })),
      ...basketSubstrate.blocks.map(b => ({ id: b.id, text: b.content, type: 'block' as const })),
      ...basketSubstrate.context_items.map(c => ({ id: c.id, text: c.content, type: 'context_item' as const }))
    ];
    
    const contentAnalyses = this.contentAgent.batchProcessContent(contentItems);
    
    // Step 4: Optional thematic analysis
    let thematicAnalysis: ThematicAnalysisSubstrate | undefined;
    if (request.include_themes && this.shouldPerformThematicAnalysis(basketClassification)) {
      thematicAnalysis = this.basketAgent.analyzeThemes(basketSubstrate);
    }
    
    // Step 5: Optional relationship analysis
    let relationshipAnalysis: ContentRelationshipSubstrate | undefined;
    if (request.include_relationships && this.shouldPerformRelationshipAnalysis(basketClassification)) {
      relationshipAnalysis = this.basketAgent.analyzeRelationships(basketSubstrate);
    }
    
    return {
      basket_substrate: basketSubstrate,
      basket_classification: basketClassification,
      thematic_analysis: thematicAnalysis,
      relationship_analysis: relationshipAnalysis,
      content_analyses: contentAnalyses.map(ca => ({
        content_id: ca.substrate.content_id,
        substrate: ca.substrate,
        text_analysis: ca.analysis,
        extraction: ca.extraction,
        recommendations: ca.recommendations
      })),
      processing_metadata: {
        analysis_timestamp: new Date().toISOString(),
        processing_duration_ms: 0, // Will be updated
        cache_hit: false,
        workflow_id: workflowId,
        agent_versions: {
          basket_analysis: '1.0.0',
          content_processing: '1.0.0',
          coordination: this.VERSION
        },
        quality_metrics: this.calculateQualityMetrics(basketSubstrate, contentAnalyses)
      }
    };
  }

  private shouldPerformThematicAnalysis(classification: BasketStateClassification): boolean {
    return classification.state !== 'empty' && classification.state !== 'minimal';
  }

  private shouldPerformRelationshipAnalysis(classification: BasketStateClassification): boolean {
    return classification.state === 'rich' || classification.state === 'complex';
  }

  private calculateQualityMetrics(
    basketSubstrate: BasketDataSubstrate,
    contentAnalyses: any[]
  ): ProcessingMetadata['quality_metrics'] {
    const totalItems = basketSubstrate.metadata.total_documents + 
                      basketSubstrate.metadata.total_blocks + 
                      basketSubstrate.metadata.total_context_items;
    
    const dataCompleteness = totalItems > 0 ? 
      contentAnalyses.filter(ca => ca.substrate.word_count > 0).length / contentAnalyses.length : 0;
    
    const avgQuality = contentAnalyses.length > 0 ?
      contentAnalyses.reduce((sum, ca) => sum + ca.substrate.metadata.quality_score, 0) / contentAnalyses.length : 0;
    
    return {
      data_completeness: dataCompleteness,
      analysis_confidence: avgQuality,
      processing_success_rate: 1.0 // Would track actual failures in production
    };
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(request: AnalysisWorkflowRequest): string {
    const keyData = {
      basket_id: request.basket_id,
      analysis_depth: request.analysis_depth,
      include_relationships: request.include_relationships,
      include_themes: request.include_themes,
      include_content_extraction: request.include_content_extraction
    };
    
    return `analysis_${JSON.stringify(keyData).replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  private getCachedResult(key: string): CoordinatedAnalysisResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.timestamp + entry.expiry_ms) {
      this.cache.delete(key);
      return null;
    }
    
    entry.access_count++;
    return entry.data;
  }

  private cacheResult(key: string, result: CoordinatedAnalysisResult): void {
    this.cache.set(key, {
      key,
      data: result,
      timestamp: Date.now(),
      expiry_ms: this.CACHE_DEFAULT_EXPIRY,
      access_count: 1
    });
  }

  private updateProcessingMetadata(
    result: CoordinatedAnalysisResult,
    startTime: number,
    workflowId: string,
    cacheHit: boolean
  ): CoordinatedAnalysisResult {
    const processingDuration = Date.now() - startTime;
    
    return {
      ...result,
      processing_metadata: {
        ...result.processing_metadata,
        processing_duration_ms: processingDuration,
        cache_hit: cacheHit,
        workflow_id: workflowId
      }
    };
  }

  private calculateCacheStatistics() {
    const totalEntries = this.cache.size;
    const totalAccesses = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.access_count, 0);
    const cacheHits = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + Math.max(0, entry.access_count - 1), 0);
    
    return {
      total_entries: totalEntries,
      cache_hit_rate: totalAccesses > 0 ? cacheHits / totalAccesses : 0,
      memory_usage_estimate: totalEntries * 1024 // Rough estimate in bytes
    };
  }
}