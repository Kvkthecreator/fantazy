"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Page Context Types
export type PageType = 'dashboard' | 'document' | 'timeline' | 'detailed-view' | 'unknown';

export interface CursorPosition {
  x: number;
  y: number;
  element?: string;
  timestamp: number;
}

export interface SelectedText {
  text: string;
  element?: string;
  position: { start: number; end: number };
  timestamp: number;
}

export interface DocumentEdit {
  action: 'insert' | 'delete' | 'modify';
  position: number;
  content: string;
  timestamp: number;
}

export interface UserActivity {
  lastAction: string;
  timeOnPage: number;
  scrollPosition: number;
  recentEdits: DocumentEdit[];
  cursorPosition?: CursorPosition;
  selectedText?: SelectedText;
  keystrokeCount: number;
  mouseMovements: number;
  isActivelyEngaged: boolean;
}

export interface PageContent {
  currentDocument?: {
    id: string;
    title: string;
    type: string;
    wordCount: number;
    activeSection?: string;
  };
  basketOverview?: {
    documentCount: number;
    totalWords: number;
    recentChanges: number;
    dominantThemes: string[];
  };
  activeSection?: string;
  userFocus?: CursorPosition | SelectedText;
}

export interface PageContext {
  page: PageType;
  content: PageContent;
  userActivity: UserActivity;
  confidence: number;
  timestamp: number;
}

// Page detection patterns
const PAGE_PATTERNS = {
  dashboard: /^\/baskets\/[^\/]+\/dashboard\/?$/,
  document: /^\/baskets\/[^\/]+\/documents/,
  timeline: /^\/baskets\/[^\/]+\/timeline/,
  'detailed-view': /^\/baskets\/[^\/]+\/detailed-view/
} as const;

/**
 * Hook for detecting and tracking page context
 */
export function usePageContext(basketId?: string): PageContext {
  const pathname = usePathname();
  const [context, setContext] = useState<PageContext>({
    page: 'unknown',
    content: {},
    userActivity: {
      lastAction: 'page_load',
      timeOnPage: 0,
      scrollPosition: 0,
      recentEdits: [],
      keystrokeCount: 0,
      mouseMovements: 0,
      isActivelyEngaged: false
    },
    confidence: 0,
    timestamp: Date.now()
  });

  const pageLoadTime = useRef(Date.now());
  const activityTimeout = useRef<NodeJS.Timeout | null>(null);
  const recentEdits = useRef<DocumentEdit[]>([]);

  // Detect page type from pathname
  const detectPageType = useCallback((path: string): { page: PageType; confidence: number } => {
    for (const [pageType, pattern] of Object.entries(PAGE_PATTERNS)) {
      if (pattern.test(path)) {
        return { page: pageType as PageType, confidence: 0.95 };
      }
    }
    
    // Fallback detection for basket routes
    if (/^\/baskets\/[^\/]+/.test(path)) {
      return { page: 'dashboard', confidence: 0.6 };
    }
    
    return { page: 'unknown', confidence: 0.1 };
  }, []);

  // Track user activity
  const updateActivity = useCallback((action: string, details?: Partial<UserActivity>) => {
    const now = Date.now();
    const timeOnPage = now - pageLoadTime.current;
    
    setContext(prev => ({
      ...prev,
      userActivity: {
        ...prev.userActivity,
        lastAction: action,
        timeOnPage,
        ...details,
        isActivelyEngaged: true
      },
      timestamp: now
    }));

    // Reset engagement timeout
    if (activityTimeout.current) {
      clearTimeout(activityTimeout.current);
    }
    
    // Mark as not engaged after 30 seconds of inactivity
    activityTimeout.current = setTimeout(() => {
      setContext(prev => ({
        ...prev,
        userActivity: {
          ...prev.userActivity,
          isActivelyEngaged: false
        }
      }));
    }, 30000);
  }, []);

  // Detect page content based on DOM and context
  const detectPageContent = useCallback(async (pageType: PageType): Promise<PageContent> => {
    const content: PageContent = {};

    try {
      switch (pageType) {
        case 'dashboard':
          // Extract dashboard overview data
          const statsElements = document.querySelectorAll('[data-stat]');
          const themeElements = document.querySelectorAll('[data-theme]');
          
          content.basketOverview = {
            documentCount: parseInt(document.querySelector('[data-stat="documents"]')?.textContent || '0'),
            totalWords: parseInt(document.querySelector('[data-stat="words"]')?.textContent?.replace(/,/g, '') || '0'),
            recentChanges: parseInt(document.querySelector('[data-stat="changes"]')?.textContent || '0'),
            dominantThemes: Array.from(themeElements).map(el => el.textContent || '').filter(Boolean)
          };
          break;

        case 'document':
          // Extract current document data
          const titleElement = document.querySelector('h1, [data-document-title]');
          const contentElement = document.querySelector('[data-document-content], .prose, .editor');
          const sectionElement = document.querySelector('[data-active-section]');
          
          if (titleElement || contentElement) {
            content.currentDocument = {
              id: basketId || 'unknown',
              title: titleElement?.textContent || 'Untitled Document',
              type: 'document',
              wordCount: contentElement?.textContent?.split(/\s+/).length || 0,
              activeSection: sectionElement?.textContent || undefined
            };
          }
          break;

        case 'timeline':
          // Extract timeline-specific data
          const timelineEntries = document.querySelectorAll('[data-timeline-entry]');
          content.activeSection = `${timelineEntries.length} entries`;
          break;

        case 'detailed-view':
          // Extract detailed view context
          const analysisSection = document.querySelector('[data-analysis-section]');
          content.activeSection = analysisSection?.getAttribute('data-analysis-section') || 'substrate';
          break;
      }
    } catch (error) {
      console.warn('Failed to detect page content:', error);
    }

    return content;
  }, [basketId]);

  // Track text selection
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText: SelectedText = {
        text: selection.toString(),
        element: (selection.anchorNode?.parentElement as HTMLElement)?.tagName?.toLowerCase(),
        position: {
          start: selection.anchorOffset,
          end: selection.focusOffset
        },
        timestamp: Date.now()
      };

      updateActivity('text_selected', { selectedText });
    }
  }, [updateActivity]);

  // Track cursor position
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const cursorPosition: CursorPosition = {
      x: e.clientX,
      y: e.clientY,
      element: (e.target as HTMLElement)?.tagName?.toLowerCase(),
      timestamp: Date.now()
    };

    // Throttle cursor updates
    const now = Date.now();
    if (now - (context.userActivity.cursorPosition?.timestamp || 0) > 1000) {
      updateActivity('cursor_moved', { 
        cursorPosition,
        mouseMovements: context.userActivity.mouseMovements + 1
      });
    }
  }, [context.userActivity, updateActivity]);

  // Track scrolling
  const handleScroll = useCallback(() => {
    const scrollPosition = window.scrollY;
    updateActivity('scrolled', { scrollPosition });
  }, [updateActivity]);

  // Track keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const keystrokeCount = context.userActivity.keystrokeCount + 1;
    
    // Track document edits if in an editable element
    const isEditable = (e.target as HTMLElement)?.isContentEditable || 
                      (e.target as HTMLInputElement)?.type === 'text' ||
                      (e.target as HTMLElement)?.tagName === 'TEXTAREA';

    if (isEditable && e.key.length === 1) {
      const edit: DocumentEdit = {
        action: 'insert',
        position: (e.target as HTMLInputElement)?.selectionStart || 0,
        content: e.key,
        timestamp: Date.now()
      };

      recentEdits.current.push(edit);
      // Keep only last 10 edits
      if (recentEdits.current.length > 10) {
        recentEdits.current.shift();
      }

      updateActivity('typing', { 
        keystrokeCount,
        recentEdits: [...recentEdits.current]
      });
    } else {
      updateActivity('key_pressed', { keystrokeCount });
    }
  }, [context.userActivity, updateActivity]);

  // Set up event listeners
  useEffect(() => {
    document.addEventListener('selectionchange', handleTextSelection);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('selectionchange', handleTextSelection);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleTextSelection, handleMouseMove, handleScroll, handleKeyDown]);

  // Update context when pathname changes
  useEffect(() => {
    const { page, confidence } = detectPageType(pathname);
    
    // Reset activity tracking for new page
    pageLoadTime.current = Date.now();
    recentEdits.current = [];
    
    // Detect content for new page
    detectPageContent(page).then(content => {
      setContext(prev => ({
        ...prev,
        page,
        content,
        confidence,
        timestamp: Date.now(),
        userActivity: {
          ...prev.userActivity,
          lastAction: 'page_navigation',
          timeOnPage: 0,
          scrollPosition: 0,
          recentEdits: [],
          keystrokeCount: 0,
          mouseMovements: 0,
          isActivelyEngaged: true
        }
      }));
    });

    updateActivity('page_navigation');
  }, [pathname, detectPageType, detectPageContent, updateActivity]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (activityTimeout.current) {
        clearTimeout(activityTimeout.current);
      }
    };
  }, []);

  return context;
}

/**
 * Generate ambient intelligence message based on page context
 */
export function generateAmbientMessage(context: PageContext, intelligence?: any): string {
  const { page, content, userActivity } = context;
  const isEngaged = userActivity.isActivelyEngaged;
  const timeOnPage = Math.floor(userActivity.timeOnPage / 1000 / 60); // minutes

  switch (page) {
    case 'dashboard':
      if (!intelligence) {
        return "🧠 Ready to analyze your workspace";
      }
      
      const docCount = content.basketOverview?.documentCount || 0;
      const themes = content.basketOverview?.dominantThemes || [];
      
      if (themes.length > 0) {
        return `🧠 Analyzing ${docCount} documents | ${themes[0]} patterns emerging | Ready to synthesize`;
      } else if (docCount > 0) {
        return `🧠 Processing ${docCount} documents | New patterns emerging | Tap for insights`;
      } else {
        return "🧠 Workspace ready | Add content to begin analysis";
      }

    case 'document':
      const doc = content.currentDocument;
      if (!doc) {
        return "🧠 Following along | Ready to assist with writing";
      }

      const wordCount = doc.wordCount;
      if (userActivity.recentEdits.length > 0 && isEngaged) {
        return "🧠 Following your edits | This section developing well | Tap for expansion ideas";
      } else if (wordCount > 500) {
        return `🧠 Tracking ${wordCount} words | Content flow looks strong | Ready for analysis`;
      } else if (wordCount > 0) {
        return "🧠 Following along | Good start | Tap for writing assistance";
      } else {
        return "🧠 Ready to help | Start writing and I'll follow along";
      }

    case 'timeline':
      if (timeOnPage > 2) {
        return "🧠 Tracking evolution | Major shift detected last week | Explore patterns?";
      } else {
        return "🧠 Timeline analysis ready | Patterns across time visible | Tap to explore";
      }

    case 'detailed-view':
      const section = content.activeSection;
      if (section) {
        return `🧠 Analyzing ${section} layer | Technical patterns visible | Deep insights available`;
      } else {
        return "🧠 Substrate analysis ready | Technical insights available | Tap for deep dive";
      }

    default:
      return "🧠 Context awareness active | Ready to assist";
  }
}

/**
 * Get context-specific intelligence capabilities
 */
export function getContextCapabilities(context: PageContext): string[] {
  const { page, content, userActivity } = context;

  switch (page) {
    case 'dashboard':
      return [
        'Synthesize patterns across documents',
        'Strategic insights and recommendations',
        'Content gap analysis',
        'Theme evolution tracking'
      ];

    case 'document':
      const capabilities = [
        'Section-specific assistance',
        'Writing flow analysis',
        'Content expansion ideas'
      ];
      
      if (userActivity.selectedText) {
        capabilities.unshift('Analyze selected text');
      }
      
      if (userActivity.recentEdits.length > 0) {
        capabilities.push('Recent edit optimization');
      }
      
      return capabilities;

    case 'timeline':
      return [
        'Evolution pattern analysis',
        'Progress tracking insights',
        'Temporal trend identification',
        'Milestone detection'
      ];

    case 'detailed-view':
      return [
        'Technical substrate analysis',
        'Data quality assessment',
        'Processing insights',
        'Debugging assistance'
      ];

    default:
      return ['General intelligence assistance'];
  }
}