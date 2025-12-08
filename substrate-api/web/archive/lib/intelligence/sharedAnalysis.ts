// Shared intelligence analysis logic to avoid API-to-API calls
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BasketIntelligenceData {
  understanding: string;
  themes: string[];
  nextSteps: Array<{ description: string; priority: number }>;
  actions: Array<{ type: string; label: string; enabled: boolean; primary?: boolean }>;
  confidenceScore: number;
  memoryGrowth: number;
  lastUpdated: string;
  insights?: any[];
  recommendations?: any[];
  rawDumps?: any[];
  contextItems?: any[];
}

export async function analyzeBasketIntelligence(
  supabase: SupabaseClient,
  basketId: string,
  workspaceId: string
): Promise<BasketIntelligenceData | null> {
  try {
    console.log(`[SharedAnalysis] Fetching basket ${basketId} for workspace ${workspaceId}`);
    
    // First, try to get just the basket to ensure it exists
    const { data: basketData, error: basketError } = await supabase
      .from("baskets")
      .select("*")
      .eq("id", basketId)
      .eq("workspace_id", workspaceId)
      .single();

    if (basketError) {
      console.error(`[SharedAnalysis] Basket query error:`, basketError);
      return null;
    }

    if (!basketData) {
      console.warn(`[SharedAnalysis] Basket ${basketId} not found`);
      return null;
    }

    console.log(`[SharedAnalysis] Found basket: ${basketData.name}`);

    // Now fetch related data separately for better error handling (Canon v3.0: use document_heads for content)
    const [documentsResult, blocksResult, contextResult, rawDumpsResult] = await Promise.all([
      supabase
        .from("document_heads")
        .select("document_id, title, content, document_created_at")
        .eq("basket_id", basketId)
        .eq("workspace_id", workspaceId),
      supabase
        .from("blocks")
        .select("id, semantic_type, content, canonical_value, created_at")
        .eq("basket_id", basketId)
        .eq("workspace_id", workspaceId),
      supabase
        .from("context_items")
        .select("id, type, content, created_at")
        .eq("basket_id", basketId)
        .eq("workspace_id", workspaceId),
      supabase
        .from("raw_dumps")
        .select("id, body_md, created_at")
        .eq("basket_id", basketId)
        .eq("workspace_id", workspaceId)
    ]);

    // Combine the data (Canon v3.0: map document_heads fields)
    const documents = (documentsResult.data || []).map((doc: any) => ({
      id: doc.document_id,
      title: doc.title,
      content: doc.content,
      created_at: doc.document_created_at
    }));

    const basket = {
      ...basketData,
      documents,
      blocks: blocksResult.data || [],
      context_items: contextResult.data || [],
      rawDumps: rawDumpsResult.data || []
    };

    console.log(`[SharedAnalysis] Analysis data: ${basket.documents.length} docs, ${basket.blocks.length} blocks, ${basket.context_items.length} context items, ${basket.rawDumps.length} raw dumps`);

    return analyzeBasketContent(basket);
  } catch (error) {
    console.error('[SharedAnalysis] Unexpected error:', error);
    return null;
  }
}

function analyzeBasketContent(basket: any): BasketIntelligenceData {
  const documents = basket.documents || [];
  const blocks = basket.blocks || [];
  const contextItems = basket.context_items || [];
  const rawDumps = basket.rawDumps || [];
  
  // Determine basket state based on real content (including raw dumps as context)
  const totalContextItems = contextItems.length + rawDumps.length;
  const isEmpty = documents.length === 0 && blocks.length === 0 && totalContextItems === 0;
  const isMinimal = documents.length <= 2 && blocks.length <= 5;
  const isRich = documents.length > 5 || blocks.length > 15;

  if (isEmpty) {
    return generateEmptyStateIntelligence(basket);
  } else if (isMinimal) {
    return generateMinimalStateIntelligence(basket, documents, blocks, contextItems);
  } else {
    return generateRichStateIntelligence(basket, documents, blocks, contextItems);
  }
}

function generateEmptyStateIntelligence(basket: any): BasketIntelligenceData {
  return {
    understanding: `I'm ready to understand your project "${basket.name || 'Untitled'}". Add some content and I'll start building intelligence about your work.`,
    themes: [],
    nextSteps: [
      { description: "Add your first document or paste some content", priority: 1 },
      { description: "Upload relevant files to build context", priority: 2 },
      { description: "Tell me about your project goals", priority: 3 }
    ],
    actions: [
      { type: "add_first_content", label: "Add Your First Content", enabled: true, primary: true },
      { type: "import_files", label: "Import Files", enabled: true },
      { type: "start_template", label: "Start with Template", enabled: true }
    ],
    confidenceScore: 0,
    memoryGrowth: 0,
    lastUpdated: new Date().toISOString(),
    insights: [],
    recommendations: [{
      id: 'add-content',
      priority: 'high',
      title: 'Add content to enable intelligence',
      description: `Your workspace needs content to generate meaningful insights. Add strategic documents, notes, or uploads to begin analysis.`,
      reasoning: 'Insufficient content for analysis'
    }]
  };
}

function generateMinimalStateIntelligence(basket: any, documents: any[], blocks: any[], contextItems: any[]): BasketIntelligenceData {
  const themes = extractThemesFromContent(documents, blocks, contextItems);
  const totalItems = documents.length + blocks.length + contextItems.length;
  
  let understanding = `From your ${documents.length} document${documents.length !== 1 ? 's' : ''}`;
  if (blocks.length > 0) {
    understanding += ` and ${blocks.length} block${blocks.length !== 1 ? 's' : ''}`;
  }
  if (contextItems.length > 0) {
    understanding += ` and ${contextItems.length} context item${contextItems.length !== 1 ? 's' : ''}`;
  }
  
  if (themes.length > 0) {
    understanding += `, I can see early themes around ${themes.slice(0, 2).join(' and ')}.`;
  } else {
    understanding += `, I'm beginning to understand your project structure.`;
  }
  
  return {
    understanding,
    themes: themes,
    nextSteps: [
      { description: "Add more context to deepen my understanding", priority: 1 },
      { description: "Create additional documents to explore themes", priority: 2 },
      { description: "Define relationships between your concepts", priority: 3 }
    ],
    actions: [
      { type: "add_content", label: "Add More Context", enabled: true, primary: true },
      { type: "create_document", label: "Create Document", enabled: true },
      { type: "analyze_deeper", label: "Deep Analysis", enabled: true }
    ],
    confidenceScore: calculateRealConfidenceScore(documents, blocks, contextItems),
    memoryGrowth: calculateRealMemoryGrowth(documents, blocks, contextItems),
    lastUpdated: new Date().toISOString(),
    insights: generateBasicInsights(themes, documents),
    recommendations: generateBasicRecommendations(themes, totalItems)
  };
}

function generateRichStateIntelligence(basket: any, documents: any[], blocks: any[], contextItems: any[]): BasketIntelligenceData {
  const themes = extractThemesFromContent(documents, blocks, contextItems);
  const patterns = identifyPatterns(documents, blocks, contextItems);
  const totalItems = documents.length + blocks.length + contextItems.length;
  
  let understanding = `Analyzing ${documents.length} documents`;
  if (blocks.length > 0) {
    understanding += `, ${blocks.length} blocks`;
  }
  if (contextItems.length > 0) {
    understanding += `, and ${contextItems.length} context items`;
  }
  
  understanding += `, I understand you're working on ${themes.slice(0, 3).join(', ')}.`;
  
  if (patterns.length > 0) {
    understanding += ` I can see strong patterns around ${patterns.slice(0, 2).join(' and ')}.`;
  }
  
  return {
    understanding,
    themes: themes,
    nextSteps: [
      { description: "Create strategic synthesis document", priority: 1 },
      { description: "Identify gaps in current analysis", priority: 2 },
      { description: "Plan next phase of project development", priority: 3 }
    ],
    actions: [
      { type: "create_synthesis", label: "Create Synthesis", enabled: true, primary: true },
      { type: "find_gaps", label: "Find Gaps", enabled: true },
      { type: "strategic_planning", label: "Strategic Planning", enabled: true }
    ],
    confidenceScore: calculateRealConfidenceScore(documents, blocks, contextItems),
    memoryGrowth: calculateRealMemoryGrowth(documents, blocks, contextItems),
    lastUpdated: new Date().toISOString(),
    insights: generateAdvancedInsights(themes, patterns, documents),
    recommendations: generateAdvancedRecommendations(themes, patterns, totalItems)
  };
}

function generateBasicInsights(themes: string[], documents: any[]): any[] {
  // Only generate insights when there's substantial content to analyze
  const totalWords = calculateTotalContentWords(documents);
  
  if (totalWords < 200 || themes.length === 0) {
    return []; // No fake insights for insufficient content
  }
  
  // Generate honest insights only when themes are meaningful
  return themes.slice(0, Math.min(2, themes.length)).map((theme, index) => ({
    id: `insight-${index}`,
    type: 'pattern_detected',
    title: `${theme} Theme Identified`,
    description: `Initial theme emerging around ${theme.toLowerCase()} based on ${totalWords} words of content`,
    confidence: 0.4 + (Math.min(totalWords / 1000, 0.3))
  }));
}

function generateAdvancedInsights(themes: string[], patterns: string[], documents: any[]): any[] {
  const totalWords = calculateTotalContentWords(documents);
  
  // Only generate insights for substantial content with real analysis potential
  if (totalWords < 1000 || themes.length < 2) {
    return []; // No fake insights for insufficient content
  }
  
  const insights: any[] = [];
  
  // Generate honest theme-based insights only when warranted
  themes.slice(0, 3).forEach((theme, index) => {
    const themeWords = countThemeWords(theme, documents);
    if (themeWords > 50) { // Only if theme has substantial content
      insights.push({
        id: `insight-${index}`,
        type: 'pattern_detected',  
        title: `${theme} Theme Analysis`,
        description: `Theme identified across ${themeWords} words in ${documents.length} documents`,
        confidence: Math.min(0.7, 0.4 + (themeWords / 500))
      });
    }
  });

  // Only include pattern insights if patterns are validated by content
  patterns.forEach((pattern, index) => {
    if (validatePatternInContent(pattern, documents)) {
      insights.push({
        id: `pattern-${index}`,
        type: 'strategic_pattern',
        title: `${pattern} Pattern`,
        description: `Pattern validated across multiple documents`,
        confidence: 0.6
      });
    }
  });

  return insights;
}

function generateBasicRecommendations(themes: string[], totalItems: number): any[] {
  const recommendations = [];
  
  // Only recommend theme expansion if there's actual thematic content
  if (themes.length > 0 && totalItems >= 3) {
    recommendations.push({
      id: 'expand-theme',
      priority: 'medium',
      title: `Expand on ${themes[0]}`,
      description: `Add more content around ${themes[0].toLowerCase()} to strengthen analysis`,
      reasoning: 'Theme has sufficient foundation for expansion'
    });
  }
  
  // Always recommend adding content for insufficient workspaces
  if (totalItems < 5) {
    recommendations.push({
      id: 'add-content',
      priority: 'high', 
      title: 'Add substantial content',
      description: 'Add strategic documents, project plans, or detailed notes to enable meaningful analysis',
      reasoning: 'Insufficient content for reliable intelligence generation'
    });
  }
  
  return recommendations;
}

function generateAdvancedRecommendations(themes: string[], patterns: string[], totalItems: number): any[] {
  const recommendations = [];
  
  if (themes.length > 2) {
    recommendations.push({
      id: 'synthesize-themes',
      priority: 'high',
      title: 'Create synthesis document',
      description: `Synthesize insights across ${themes.slice(0, 3).join(', ')} themes`,
      reasoning: 'Multiple themes ready for strategic synthesis'
    });
  }
  
  if (patterns.length > 0) {
    recommendations.push({
      id: 'strategic-planning',
      priority: 'medium',
      title: 'Strategic planning session',
      description: `Plan next steps based on ${patterns[0]} patterns`,
      reasoning: 'Patterns suggest strategic planning opportunity'
    });
  }
  
  return recommendations.slice(0, 3);
}

// Utility functions (extracted from dashboard API)
function extractThemesFromContent(documents: any[], blocks: any[], contextItems: any[]): string[] {
  const themes = new Set<string>();
  
  documents.forEach(doc => {
    if (doc.title) {
      const titleWords = doc.title.toLowerCase()
        .split(/[\s\-_]+/)
        .filter((word: string) => word.length > 3 && !isCommonWord(word));
      titleWords.forEach((word: string) => themes.add(capitalizeWord(word)));
    }
    
    if (doc.content) {
      const contentWords = extractKeywords(doc.content);
      contentWords.forEach((word: string) => themes.add(word));
    }
  });
  
  blocks.forEach(block => {
    if (block.semantic_type) {
      themes.add(capitalizeWord(block.semantic_type.replace(/_/g, ' ')));
    }
    if (block.canonical_value) {
      themes.add(capitalizeWord(block.canonical_value));
    }
  });
  
  return Array.from(themes).slice(0, 8);
}

function identifyPatterns(documents: any[], blocks: any[], contextItems: any[]): string[] {
  const patterns = [];
  
  const docTitles = documents.map(d => d.title?.toLowerCase() || '').join(' ');
  if (docTitles.includes('strategy') || docTitles.includes('plan')) {
    patterns.push('strategic planning');
  }
  if (docTitles.includes('technical') || docTitles.includes('implementation')) {
    patterns.push('technical implementation');
  }
  if (docTitles.includes('user') || docTitles.includes('ux')) {
    patterns.push('user experience');
  }
  
  return patterns.length > 0 ? patterns : ['project development'];
}

function extractKeywords(text: string, limit: number = 3): string[] {
  if (!text) return [];
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word: string) => word.length > 4 && !isCommonWord(word));
    
  const wordCount = new Map<string, number>();
  words.forEach((word: string) => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });
  
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => capitalizeWord(word));
}

function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'have', 'this', 'that', 'with', 'they', 'from', 'will', 'been', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'what', 'about', 'when', 'where', 'some', 'more', 'very', 'into', 'after', 'first', 'well', 'work', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most'
  ]);
  return commonWords.has(word.toLowerCase());
}

function calculateRealConfidenceScore(documents: any[], blocks: any[], contextItems: any[]): number {
  let score = 0;
  
  // Base score from content existence
  const hasDocuments = documents.length > 0;
  const hasBlocks = blocks.length > 0;
  const hasContext = contextItems.length > 0;
  
  if (!hasDocuments && !hasBlocks && !hasContext) return 0;
  
  // Calculate actual content words
  let totalContentWords = 0;
  documents.forEach(doc => {
    if (doc.content && typeof doc.content === 'string') {
      totalContentWords += doc.content.split(/\s+/).filter((word: string) => word.length > 0).length;
    }
  });
  
  blocks.forEach(block => {
    if (block.content && typeof block.content === 'string') {
      totalContentWords += block.content.split(/\s+/).filter((word: string) => word.length > 0).length;
    }
  });
  
  contextItems.forEach(item => {
    if (item.content && typeof item.content === 'string') {
      totalContentWords += item.content.split(/\s+/).filter((word: string) => word.length > 0).length;
    }
  });
  
  // Score based on actual content depth
  if (totalContentWords === 0) return 5; // Has items but no content
  if (totalContentWords < 100) return 15;
  if (totalContentWords < 500) return 35;
  if (totalContentWords < 1000) return 60;
  if (totalContentWords < 2000) return 80;
  return 95;
}

function calculateRealMemoryGrowth(documents: any[], blocks: any[], contextItems: any[]): number {
  // Calculate growth based on actual content recency and activity
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  let recentActivity = 0;
  
  // Check document recency
  documents.forEach(doc => {
    const updated = new Date(doc.updated_at || doc.created_at);
    if (updated > dayAgo) recentActivity += 3;
    else if (updated > weekAgo) recentActivity += 1;
  });
  
  // Check block recency  
  blocks.forEach(block => {
    const updated = new Date(block.updated_at || block.created_at);
    if (updated > dayAgo) recentActivity += 2;
    else if (updated > weekAgo) recentActivity += 0.5;
  });
  
  // Check context recency
  contextItems.forEach(item => {
    const updated = new Date(item.updated_at || item.created_at);
    if (updated > dayAgo) recentActivity += 1;
    else if (updated > weekAgo) recentActivity += 0.3;
  });
  
  return Math.min(Math.round(recentActivity), 25);
}

function capitalizeWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Helper functions for honest content analysis
function calculateTotalContentWords(documents: any[]): number {
  return documents.reduce((total, doc) => {
    if (doc.content && typeof doc.content === 'string') {
      return total + doc.content.split(/\s+/).filter((word: string) => word.length > 0).length;
    }
    return total;
  }, 0);
}

function countThemeWords(theme: string, documents: any[]): number {
  const themeLower = theme.toLowerCase();
  return documents.reduce((count, doc) => {
    if (doc.content && typeof doc.content === 'string') {
      const content = doc.content.toLowerCase();
      const matches = (content.match(new RegExp(themeLower, 'g')) || []).length;
      return count + matches;
    }
    return count;
  }, 0);
}

function validatePatternInContent(pattern: string, documents: any[]): boolean {
  const patternWords = pattern.toLowerCase().split(' ');
  let documentMatches = 0;
  
  documents.forEach(doc => {
    if (doc.content && typeof doc.content === 'string') {
      const content = doc.content.toLowerCase();
      const hasAllWords = patternWords.every(word => content.includes(word));
      if (hasAllWords) documentMatches++;
    }
  });
  
  // Pattern is valid only if found in multiple documents
  return documentMatches >= 2;
}