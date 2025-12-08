/**
 * Contextual Awareness System
 * Provides state-aware content for the complementary panel
 */

import { useEffect, useState } from 'react';

interface ContextualContent {
  recentInsights?: any[];
  memoryGrowth?: any;
  suggestedActions?: any[];
  writingHelp?: any;
  relatedInsights?: any[];
  connectionSuggestions?: any[];
  themePatterns?: any[];
}

export function useContextualAwareness(
  view: string,
  basketId?: string
): ContextualContent {
  const [content, setContent] = useState<ContextualContent>({});

  useEffect(() => {
    // Update content based on view and context
    const updateContent = async () => {
      const newContent = await getContextualContent(view, basketId);
      setContent(newContent);
    };

    updateContent();
    
    // Refresh periodically for ambient updates
    const interval = setInterval(updateContent, 30000);
    
    return () => clearInterval(interval);
  }, [view, basketId]);

  return content;
}

async function getContextualContent(
  view: string,
  basketId?: string
): Promise<ContextualContent> {
  
  switch (view) {
    case 'dashboard':
      return {
        recentInsights: await getRecentInsights(basketId),
        memoryGrowth: await getMemoryGrowthMetrics(basketId),
        suggestedActions: await getSuggestedActions(basketId, 'dashboard')
      };

    case 'documents':
      return {
        writingHelp: await getWritingAssistance(basketId),
        relatedInsights: await getRelatedInsights(basketId, 'document'),
        suggestedActions: await getSuggestedActions(basketId, 'writing')
      };

    case 'insights':
      return {
        connectionSuggestions: await getConnectionOpportunities(basketId),
        themePatterns: await getEmergingPatterns(basketId),
        relatedInsights: await getRelatedInsights(basketId, 'insight')
      };

    default:
      return {};
  }
}

// Mock data fetchers - would connect to real APIs in production
async function getRecentInsights(basketId?: string): Promise<any[]> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return [
    {
      id: '1',
      title: 'User engagement pattern discovered',
      summary: 'I noticed users prefer visual explanations over text-heavy documentation',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      confidence: 0.85
    },
    {
      id: '2', 
      title: 'Technical architecture insight',
      summary: 'The modular component structure is enabling faster feature development',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      confidence: 0.92
    }
  ];
}

async function getMemoryGrowthMetrics(basketId?: string): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return {
    level: 'developing',
    percentage: 65,
    insightsProcessed: 42,
    connectionsFound: 18,
    lastUpdated: new Date().toISOString()
  };
}

async function getSuggestedActions(basketId: string | undefined, context: string): Promise<any[]> {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const baseActions = [
    {
      id: 'capture',
      label: 'Capture new insight',
      icon: 'Lightbulb',
      priority: 'high'
    },
    {
      id: 'explore',
      label: 'Explore connections',
      icon: 'Link2',
      priority: 'medium'
    }
  ];

  if (context === 'writing') {
    return [
      {
        id: 'outline',
        label: 'Generate outline',
        icon: 'List',
        priority: 'high'
      },
      {
        id: 'enhance',
        label: 'Enhance clarity',
        icon: 'Sparkles',
        priority: 'medium'
      }
    ];
  }

  return baseActions;
}

async function getWritingAssistance(basketId?: string): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    nextSentence: "Consider exploring the user experience implications of this approach...",
    keywords: ['user experience', 'accessibility', 'engagement'],
    tone: 'professional',
    suggestions: [
      'Add concrete examples',
      'Consider visual diagrams',
      'Reference related insights'
    ]
  };
}

async function getRelatedInsights(basketId: string | undefined, type: string): Promise<any[]> {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return [
    {
      id: '1',
      title: 'Related user research finding',
      relevance: 'High relevance to current topic',
      connection: 'Both discuss user preferences'
    },
    {
      id: '2',
      title: 'Previous implementation pattern',
      relevance: 'Medium relevance',
      connection: 'Similar technical approach'
    }
  ];
}

async function getConnectionOpportunities(basketId?: string): Promise<any[]> {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return [
    {
      id: '1',
      description: 'Connect this insight with your user research findings',
      strength: 0.85
    },
    {
      id: '2',
      description: 'This pattern relates to your architecture decisions',
      strength: 0.72
    }
  ];
}

async function getEmergingPatterns(basketId?: string): Promise<any[]> {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return [
    { name: 'User-centered design', count: 8 },
    { name: 'Iterative development', count: 6 },
    { name: 'Accessibility focus', count: 4 },
    { name: 'Performance optimization', count: 3 }
  ];
}

// Context priority determination
export function determineContextPriority(
  view: string,
  userActivity: string,
  hasUrgentUpdates: boolean
): 'ambient' | 'supportive' | 'hidden' {
  
  // Hide during deep focus work
  if (userActivity === 'active_work' && view === 'documents') {
    return hasUrgentUpdates ? 'ambient' : 'hidden';
  }
  
  // Ambient during exploration
  if (userActivity === 'exploring') {
    return 'ambient';
  }
  
  // Supportive during dashboard overview
  if (view === 'dashboard') {
    return 'supportive';
  }
  
  // Default to ambient to avoid distraction
  return 'ambient';
}