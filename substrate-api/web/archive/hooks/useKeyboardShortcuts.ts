import { useEffect } from 'react';

export interface Shortcut {
  key: string;
  handler: () => void;
  description?: string;
}

/**
 * Hook for managing keyboard shortcuts with Mousetrap-like functionality
 * Supports single keys and key combinations like 'g d', 'ctrl+s', etc.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const activeShortcuts = new Map<string, Shortcut>();
    
    // Parse and register shortcuts
    shortcuts.forEach(shortcut => {
      activeShortcuts.set(shortcut.key.toLowerCase(), shortcut);
    });
    
    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }
      
      const key = event.key.toLowerCase();
      
      // Handle multi-key combinations like 'g d'
      if (key === 'g') {
        event.preventDefault();
        let waitingForSecondKey = true;
        
        const handleSecondKey = (e2: KeyboardEvent) => {
          if (!waitingForSecondKey) return;
          waitingForSecondKey = false;
          
          const combo = `g ${e2.key.toLowerCase()}`;
          const shortcut = activeShortcuts.get(combo);
          
          if (shortcut) {
            e2.preventDefault();
            shortcut.handler();
          }
          
          document.removeEventListener('keydown', handleSecondKey);
        };
        
        document.addEventListener('keydown', handleSecondKey);
        
        // Cleanup if no second key pressed within 2 seconds
        setTimeout(() => {
          waitingForSecondKey = false;
          document.removeEventListener('keydown', handleSecondKey);
        }, 2000);
        
        return;
      }
      
      // Handle modifier combinations
      let modifiedKey = '';
      if (event.ctrlKey) modifiedKey += 'ctrl+';
      if (event.altKey) modifiedKey += 'alt+';
      if (event.shiftKey) modifiedKey += 'shift+';
      if (event.metaKey) modifiedKey += 'meta+';
      modifiedKey += key;
      
      const shortcut = activeShortcuts.get(modifiedKey);
      if (shortcut) {
        event.preventDefault();
        shortcut.handler();
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [shortcuts]);
}

/**
 * Predefined shortcut patterns for common navigation
 */
export const createNavigationShortcuts = (
  navigate: (path: string) => void,
  basePath: string
): Shortcut[] => [
  {
    key: 'g d',
    handler: () => navigate(`${basePath}`),
    description: 'Go to Dashboard'
  },
  {
    key: 'g b',
    handler: () => navigate(`${basePath}/blocks`),
    description: 'Go to Blocks'
  },
  {
    key: 'g c',
    handler: () => navigate(`${basePath}/context`),
    description: 'Go to Context'
  },
  {
    key: 'g o',
    handler: () => navigate(`${basePath}/documents`),
    description: 'Go to Documents'
  },
  {
    key: 'g i',
    handler: () => navigate(`${basePath}/insights`),
    description: 'Go to Insights'
  },
  {
    key: 'g h',
    handler: () => navigate(`${basePath}/timeline`),
    description: 'Go to Timeline'
  }
];