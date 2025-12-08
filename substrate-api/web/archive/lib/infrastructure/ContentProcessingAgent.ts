/**
 * Infrastructure Agent: Pure Technical Content Processing
 * 
 * This agent provides raw technical processing of document and block content.
 * It performs text analysis, extraction, and transformation purely for data processing.
 * 
 * CRITICAL: This agent must NOT contain user-facing language or narrative elements.
 * All outputs are technical substrate for consumption by narrative agents.
 */

// Technical content structures - no user-facing language
export interface ContentSubstrate {
  content_id: string;
  raw_text: string;
  processed_text: string;
  word_count: number;
  character_count: number;
  content_type: 'document' | 'block' | 'context_item';
  metadata: ContentMetadata;
}

export interface ContentMetadata {
  language: string;
  encoding: string;
  structure_type: 'plain_text' | 'markdown' | 'structured';
  quality_score: number; // 0-1 technical quality assessment
  processing_flags: string[];
}

export interface TextAnalysisSubstrate {
  readability_score: number;
  complexity_level: 'low' | 'medium' | 'high';
  sentence_count: number;
  paragraph_count: number;
  key_terms: Array<{
    term: string;
    frequency: number;
    importance_score: number;
  }>;
  structural_elements: {
    headers: string[];
    lists: string[];
    links: string[];
    code_blocks: string[];
  };
}

export interface ContentExtractionResult {
  title?: string;
  summary_sentences: string[];
  main_topics: string[];
  supporting_details: string[];
  action_items: string[];
  technical_terms: string[];
}

export interface ProcessingRecommendations {
  chunk_strategy: 'none' | 'semantic' | 'structural' | 'size_based';
  analysis_depth: 'basic' | 'standard' | 'comprehensive';
  relationship_analysis: boolean;
  theme_extraction: boolean;
  summary_generation: boolean;
}

/**
 * Pure Infrastructure Agent: Content Processing
 * 
 * Processes text content for technical analysis and extraction.
 * Contains NO user-facing language or narrative elements.
 */
export class ContentProcessingAgent {
  /**
   * Process raw content into technical substrate
   */
  processContent(
    contentId: string,
    rawText: string,
    contentType: 'document' | 'block' | 'context_item'
  ): ContentSubstrate {
    const processedText = this.cleanAndNormalizeText(rawText);
    const metadata = this.extractContentMetadata(rawText);

    return {
      content_id: contentId,
      raw_text: rawText,
      processed_text: processedText,
      word_count: this.countWords(processedText),
      character_count: processedText.length,
      content_type: contentType,
      metadata
    };
  }

  /**
   * Perform technical text analysis
   */
  analyzeText(substrate: ContentSubstrate): TextAnalysisSubstrate {
    const sentences = this.extractSentences(substrate.processed_text);
    const paragraphs = this.extractParagraphs(substrate.processed_text);
    const keyTerms = this.extractKeyTerms(substrate.processed_text);
    const structuralElements = this.extractStructuralElements(substrate.raw_text);

    return {
      readability_score: this.calculateReadabilityScore(sentences),
      complexity_level: this.assessComplexityLevel(substrate.processed_text),
      sentence_count: sentences.length,
      paragraph_count: paragraphs.length,
      key_terms: keyTerms,
      structural_elements: structuralElements
    };
  }

  /**
   * Extract structured information from content
   */
  extractContent(substrate: ContentSubstrate): ContentExtractionResult {
    const text = substrate.processed_text;
    
    return {
      title: this.extractTitle(substrate.raw_text),
      summary_sentences: this.extractSummarySentences(text),
      main_topics: this.extractMainTopics(text),
      supporting_details: this.extractSupportingDetails(text),
      action_items: this.extractActionItems(text),
      technical_terms: this.extractTechnicalTerms(text)
    };
  }

  /**
   * Generate processing recommendations based on content analysis
   */
  generateProcessingRecommendations(
    substrate: ContentSubstrate,
    analysis: TextAnalysisSubstrate
  ): ProcessingRecommendations {
    const wordCount = substrate.word_count;
    const complexity = analysis.complexity_level;
    const hasStructure = Object.values(analysis.structural_elements).some(arr => arr.length > 0);

    let chunkStrategy: ProcessingRecommendations['chunk_strategy'] = 'none';
    if (wordCount > 2000) {
      chunkStrategy = hasStructure ? 'structural' : 'size_based';
    } else if (wordCount > 500 && complexity === 'high') {
      chunkStrategy = 'semantic';
    }

    let analysisDepth: ProcessingRecommendations['analysis_depth'] = 'basic';
    if (wordCount > 1000 || complexity === 'high') {
      analysisDepth = 'standard';
    }
    if (wordCount > 3000 && hasStructure) {
      analysisDepth = 'comprehensive';
    }

    return {
      chunk_strategy: chunkStrategy,
      analysis_depth: analysisDepth,
      relationship_analysis: wordCount > 500,
      theme_extraction: wordCount > 200,
      summary_generation: wordCount > 300
    };
  }

  /**
   * Batch process multiple content items
   */
  batchProcessContent(
    contentItems: Array<{
      id: string;
      text: string;
      type: 'document' | 'block' | 'context_item';
    }>
  ): Array<{
    substrate: ContentSubstrate;
    analysis: TextAnalysisSubstrate;
    extraction: ContentExtractionResult;
    recommendations: ProcessingRecommendations;
  }> {
    return contentItems.map(item => {
      const substrate = this.processContent(item.id, item.text, item.type);
      const analysis = this.analyzeText(substrate);
      const extraction = this.extractContent(substrate);
      const recommendations = this.generateProcessingRecommendations(substrate, analysis);

      return {
        substrate,
        analysis,
        extraction,
        recommendations
      };
    });
  }

  // Private technical processing methods
  private cleanAndNormalizeText(text: string): string {
    // Remove excessive whitespace, normalize line endings
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private extractContentMetadata(text: string): ContentMetadata {
    const hasMarkdown = /[#*`\[\]]/g.test(text);
    const hasStructure = /^[\s]*[-*+]|\d+\./gm.test(text);
    
    let structureType: ContentMetadata['structure_type'] = 'plain_text';
    if (hasMarkdown) structureType = 'markdown';
    else if (hasStructure) structureType = 'structured';

    const qualityScore = this.calculateQualityScore(text);
    const processingFlags = this.identifyProcessingFlags(text);

    return {
      language: 'en', // Simplified - could use language detection
      encoding: 'utf-8',
      structure_type: structureType,
      quality_score: qualityScore,
      processing_flags: processingFlags
    };
  }

  private countWords(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  private extractSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private extractParagraphs(text: string): string[] {
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  }

  private extractKeyTerms(text: string): Array<{term: string; frequency: number; importance_score: number}> {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([term, freq]) => ({
        term,
        frequency: freq,
        importance_score: freq / words.length
      }));
  }

  private extractStructuralElements(text: string) {
    return {
      headers: text.match(/^#+\s+.+$/gm) || [],
      lists: text.match(/^[\s]*[-*+]\s+.+$/gm) || [],
      links: text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [],
      code_blocks: text.match(/```[\s\S]*?```/g) || []
    };
  }

  private calculateReadabilityScore(sentences: string[]): number {
    // Simplified Flesch reading ease approximation
    const avgWordsPerSentence = sentences.reduce((sum, s) => 
      sum + s.trim().split(/\s+/).length, 0) / sentences.length;
    
    // Simplified calculation - higher score = more readable
    return Math.max(0, Math.min(1, (20 - avgWordsPerSentence) / 15));
  }

  private assessComplexityLevel(text: string): 'low' | 'medium' | 'high' {
    const avgWordLength = text.replace(/[^\w\s]/g, '').split(/\s+/)
      .reduce((sum, word) => sum + word.length, 0) / this.countWords(text);
    
    if (avgWordLength < 4.5) return 'low';
    if (avgWordLength < 6) return 'medium';
    return 'high';
  }

  private calculateQualityScore(text: string): number {
    let score = 0.5; // Base score
    
    // Boost for decent length
    const wordCount = this.countWords(text);
    if (wordCount > 50) score += 0.2;
    if (wordCount > 200) score += 0.1;
    
    // Boost for structure
    if (/^#+\s+/gm.test(text)) score += 0.1; // Headers
    if (/^[\s]*[-*+]/gm.test(text)) score += 0.1; // Lists
    
    return Math.min(1, score);
  }

  private identifyProcessingFlags(text: string): string[] {
    const flags: string[] = [];
    
    if (text.length > 10000) flags.push('large_content');
    if (/```/.test(text)) flags.push('contains_code');
    if (/\[([^\]]+)\]\(([^)]+)\)/.test(text)) flags.push('contains_links');
    if (/^#+\s+/gm.test(text)) flags.push('structured_content');
    if (text.split('\n').length > 50) flags.push('multi_section');
    
    return flags;
  }

  private extractTitle(text: string): string | undefined {
    // Look for markdown header at start
    const headerMatch = text.match(/^#+\s+(.+)$/m);
    if (headerMatch) return headerMatch[1].trim();
    
    // Look for first line if it's short and title-like
    const firstLine = text.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100 && firstLine.length > 5) {
      return firstLine;
    }
    
    return undefined;
  }

  private extractSummarySentences(text: string): string[] {
    const sentences = this.extractSentences(text);
    // Return first 2-3 sentences as summary
    return sentences.slice(0, Math.min(3, Math.ceil(sentences.length * 0.1)));
  }

  private extractMainTopics(text: string): string[] {
    // Extract potential topics from headers and key terms
    const headers = text.match(/^#+\s+(.+)$/gm)?.map(h => h.replace(/^#+\s+/, '')) || [];
    const keyTerms = this.extractKeyTerms(text).slice(0, 5).map(kt => kt.term);
    
    return [...headers, ...keyTerms].slice(0, 10);
  }

  private extractSupportingDetails(text: string): string[] {
    // Extract list items and secondary information
    const listItems = text.match(/^[\s]*[-*+]\s+(.+)$/gm)?.map(item => 
      item.replace(/^[\s]*[-*+]\s+/, '').trim()
    ) || [];
    
    return listItems.slice(0, 10);
  }

  private extractActionItems(text: string): string[] {
    // Look for action-oriented phrases
    const actionWords = ['todo', 'task', 'action', 'need to', 'should', 'must', 'will'];
    const sentences = this.extractSentences(text);
    
    return sentences.filter(sentence => 
      actionWords.some(word => sentence.toLowerCase().includes(word))
    ).slice(0, 5);
  }

  private extractTechnicalTerms(text: string): string[] {
    // Look for technical patterns: camelCase, PascalCase, snake_case, etc.
    const technicalPattern = /\b(?:[A-Z][a-z]+[A-Z][a-zA-Z]*|[a-z]+_[a-z_]+|[A-Z]{2,})\b/g;
    const matches = text.match(technicalPattern) || [];
    
    // Deduplicate and return top matches
    return [...new Set(matches)].slice(0, 10);
  }
}