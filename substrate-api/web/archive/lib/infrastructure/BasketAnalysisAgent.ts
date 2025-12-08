/**
 * Infrastructure Agent: Pure Technical Basket Analysis
 * 
 * This agent provides raw technical analysis of basket data structures.
 * It processes documents, blocks, and context items purely for data extraction.
 * 
 * CRITICAL: This agent must NOT contain user-facing language or narrative elements.
 * All outputs are technical substrate for consumption by narrative agents.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Technical data structures - no user-facing language
export interface BasketDataSubstrate {
  basket_id: string;
  documents: DocumentSubstrate[];
  blocks: BlockSubstrate[];
  context_items: ContextSubstrate[];
  metadata: BasketMetadata;
}

export interface DocumentSubstrate {
  id: string;
  title: string;
  content: string;
  word_count: number;
  created_at: string;
  file_type?: string;
}

export interface BlockSubstrate {
  id: string;
  type: string;
  content: string;
  state: 'PROPOSED' | 'ACTIVE' | 'ARCHIVED';
  word_count: number;
  created_at: string;
}

export interface ContextSubstrate {
  id: string;
  content: string;
  item_type: string;
  created_at: string;
}

export interface BasketMetadata {
  name: string;
  status: string;
  created_at: string;
  last_modified: string;
  total_documents: number;
  total_blocks: number;
  total_context_items: number;
}

// Technical analysis outputs - purely computational
export interface ThematicAnalysisSubstrate {
  dominant_themes: string[];
  theme_distribution: Record<string, number>;
  content_coherence_score: number;
  pattern_strength: 'weak' | 'moderate' | 'strong';
  analysis_confidence: number; // 0-1 scale
}

export interface ContentRelationshipSubstrate {
  document_connections: Array<{
    source_id: string;
    target_id: string;
    relationship_strength: number;
    connection_type: 'semantic' | 'chronological' | 'structural';
  }>;
  block_clusters: Array<{
    cluster_id: string;
    block_ids: string[];
    cluster_strength: number;
  }>;
}

export interface BasketStateClassification {
  state: 'empty' | 'minimal' | 'developing' | 'rich' | 'complex';
  content_density: number;
  development_trajectory: 'static' | 'growing' | 'consolidating';
  processing_recommendations: string[];
}

/**
 * Pure Infrastructure Agent: Basket Analysis
 * 
 * Processes basket data structures for technical analysis.
 * Contains NO user-facing language or narrative elements.
 */
export class BasketAnalysisAgent {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Extract pure basket data substrate
   */
  async extractBasketSubstrate(basketId: string): Promise<BasketDataSubstrate> {
    // Fetch raw data from database
    const { data: basket } = await this.supabase
      .from('baskets')
      .select(`
        id, name, status, created_at,
        documents(*),
        blocks(*),
        context_items(*)
      `)
      .eq('id', basketId)
      .single();

    if (!basket) {
      throw new Error(`Basket ${basketId} not found`);
    }

    // Transform to technical substrate format
    return {
      basket_id: basket.id,
      documents: basket.documents?.map(this.transformDocument) || [],
      blocks: basket.blocks?.map(this.transformBlock) || [],
      context_items: basket.context_items?.map(this.transformContextItem) || [],
      metadata: {
        name: basket.name,
        status: basket.status,
        created_at: basket.created_at,
        last_modified: basket.created_at,
        total_documents: basket.documents?.length || 0,
        total_blocks: basket.blocks?.length || 0,
        total_context_items: basket.context_items?.length || 0,
      }
    };
  }

  /**
   * Perform thematic analysis on content
   */
  analyzeThemes(substrate: BasketDataSubstrate): ThematicAnalysisSubstrate {
    const allContent = [
      ...substrate.documents.map(d => d.content),
      ...substrate.blocks.map(b => b.content),
      ...substrate.context_items.map(c => c.content)
    ].join(' ');

    // Technical theme extraction (simplified implementation)
    const words = allContent.toLowerCase().split(/\s+/);
    const wordFreq = words.reduce((acc, word) => {
      if (word.length > 3) {
        acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const dominantThemes = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);

    const totalWords = Object.values(wordFreq).reduce((sum, count) => sum + count, 0);
    const themeDistribution = Object.fromEntries(
      dominantThemes.map(theme => [theme, wordFreq[theme] / totalWords])
    );

    return {
      dominant_themes: dominantThemes,
      theme_distribution: themeDistribution,
      content_coherence_score: this.calculateCoherenceScore(substrate),
      pattern_strength: this.assessPatternStrength(substrate),
      analysis_confidence: this.calculateAnalysisConfidence(substrate)
    };
  }

  /**
   * Analyze content relationships
   */
  analyzeRelationships(substrate: BasketDataSubstrate): ContentRelationshipSubstrate {
    // Technical relationship analysis
    const documentConnections = this.calculateDocumentConnections(substrate.documents);
    const blockClusters = this.calculateBlockClusters(substrate.blocks);

    return {
      document_connections: documentConnections,
      block_clusters: blockClusters
    };
  }

  /**
   * Classify basket development state
   */
  classifyBasketState(substrate: BasketDataSubstrate): BasketStateClassification {
    const totalContent = substrate.metadata.total_documents + substrate.metadata.total_blocks;
    const totalWords = substrate.documents.reduce((sum, doc) => sum + doc.word_count, 0) +
                      substrate.blocks.reduce((sum, block) => sum + block.word_count, 0);

    let state: BasketStateClassification['state'];
    if (totalContent === 0) {
      state = 'empty';
    } else if (totalContent <= 2) {
      state = 'minimal';
    } else if (totalContent <= 10) {
      state = 'developing';
    } else if (totalContent <= 25) {
      state = 'rich';
    } else {
      state = 'complex';
    }

    return {
      state,
      content_density: totalWords / Math.max(totalContent, 1),
      development_trajectory: this.assessDevelopmentTrajectory(substrate),
      processing_recommendations: this.generateProcessingRecommendations(state, substrate)
    };
  }

  // Private technical processing methods
  private transformDocument(doc: any): DocumentSubstrate {
    return {
      id: doc.id,
      title: doc.title || 'Untitled',
      content: doc.content || '',
      word_count: doc.content ? doc.content.split(/\s+/).length : 0,
      created_at: doc.created_at,
      file_type: doc.file_type
    };
  }

  private transformBlock(block: any): BlockSubstrate {
    return {
      id: block.id,
      type: block.type || 'text',
      content: block.content || '',
      state: block.state || 'PROPOSED',
      word_count: block.content ? block.content.split(/\s+/).length : 0,
      created_at: block.created_at
    };
  }

  private transformContextItem(item: any): ContextSubstrate {
    return {
      id: item.id,
      content: item.content || '',
      item_type: item.item_type || 'general',
      created_at: item.created_at
    };
  }

  private calculateCoherenceScore(substrate: BasketDataSubstrate): number {
    // Technical coherence calculation
    const totalContent = substrate.metadata.total_documents + substrate.metadata.total_blocks;
    return Math.min(totalContent * 0.1, 1.0);
  }

  private assessPatternStrength(substrate: BasketDataSubstrate): 'weak' | 'moderate' | 'strong' {
    const contentItems = substrate.metadata.total_documents + substrate.metadata.total_blocks;
    if (contentItems >= 10) return 'strong';
    if (contentItems >= 5) return 'moderate';
    return 'weak';
  }

  private calculateAnalysisConfidence(substrate: BasketDataSubstrate): number {
    const contentItems = substrate.metadata.total_documents + substrate.metadata.total_blocks;
    return Math.min(contentItems * 0.05, 1.0);
  }

  private calculateDocumentConnections(documents: DocumentSubstrate[]) {
    // Simplified semantic connection analysis
    return documents.flatMap((doc, i) => 
      documents.slice(i + 1).map(otherDoc => ({
        source_id: doc.id,
        target_id: otherDoc.id,
        relationship_strength: this.calculateSemanticSimilarity(doc.content, otherDoc.content),
        connection_type: 'semantic' as const
      }))
    );
  }

  private calculateBlockClusters(blocks: BlockSubstrate[]) {
    // Simple clustering by content similarity
    const clusters: Array<{cluster_id: string; block_ids: string[]; cluster_strength: number}> = [];
    
    blocks.forEach((block, i) => {
      const clusterId = `cluster_${i}`;
      const relatedBlocks = blocks.filter(otherBlock => 
        this.calculateSemanticSimilarity(block.content, otherBlock.content) > 0.3
      );
      
      if (relatedBlocks.length > 1) {
        clusters.push({
          cluster_id: clusterId,
          block_ids: relatedBlocks.map(b => b.id),
          cluster_strength: relatedBlocks.length / blocks.length
        });
      }
    });

    return clusters;
  }

  private calculateSemanticSimilarity(content1: string, content2: string): number {
    // Simplified similarity calculation
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  private assessDevelopmentTrajectory(substrate: BasketDataSubstrate): 'static' | 'growing' | 'consolidating' {
    // Technical trajectory assessment based on recent activity
    const recentThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    const recentItems = [
      ...substrate.documents.filter(d => new Date(d.created_at).getTime() > recentThreshold),
      ...substrate.blocks.filter(b => new Date(b.created_at).getTime() > recentThreshold)
    ];

    if (recentItems.length === 0) return 'static';
    if (recentItems.length >= 3) return 'growing';
    return 'consolidating';
  }

  private generateProcessingRecommendations(
    state: BasketStateClassification['state'], 
    substrate: BasketDataSubstrate
  ): string[] {
    // Technical processing recommendations
    switch (state) {
      case 'empty':
        return ['content_capture_required', 'initialization_needed'];
      case 'minimal':
        return ['content_expansion_suggested', 'theme_development_possible'];
      case 'developing':
        return ['relationship_analysis_viable', 'pattern_detection_active'];
      case 'rich':
        return ['advanced_analysis_available', 'coherence_optimization_possible'];
      case 'complex':
        return ['full_intelligence_analysis', 'advanced_coordination_recommended'];
      default:
        return ['standard_processing'];
    }
  }
}