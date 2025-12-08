/**
 * Attention Management System
 * Implements the 80/20 attention distribution principle
 */

interface AttentionConfig {
  navigation: {
    classes: string;
    width: string;
    priority: number;
  };
  primary: {
    classes: string;
    priority: number;
  };
  complementary: {
    classes: string;
    width: string;
    priority: 'ambient' | 'supportive' | 'hidden';
  };
}

export function useAttentionManagement(
  view: string,
  focusMode: boolean = false
): AttentionConfig {
  
  // Focus mode: 100% attention to primary workspace
  if (focusMode) {
    return {
      navigation: {
        classes: 'w-16',
        width: '4rem',
        priority: 1
      },
      primary: {
        classes: 'flex-1',
        priority: 100
      },
      complementary: {
        classes: 'hidden',
        width: '0',
        priority: 'hidden'
      }
    };
  }

  // View-specific attention distribution
  switch (view) {
    case 'documents':
      // Writing/editing needs maximum focus
      return {
        navigation: {
          classes: 'w-64',
          width: '16rem',
          priority: 10
        },
        primary: {
          classes: 'flex-1',
          priority: 85
        },
        complementary: {
          classes: 'w-80',
          width: '20rem',
          priority: 'ambient' // Minimal distraction during writing
        }
      };

    case 'insights':
      // Exploration benefits from connections
      return {
        navigation: {
          classes: 'w-72',
          width: '18rem', 
          priority: 15
        },
        primary: {
          classes: 'flex-1',
          priority: 75
        },
        complementary: {
          classes: 'w-96',
          width: '24rem',
          priority: 'supportive' // More context helpful for exploration
        }
      };

    case 'dashboard':
    default:
      // Overview benefits from balanced attention
      return {
        navigation: {
          classes: 'w-72',
          width: '18rem',
          priority: 20
        },
        primary: {
          classes: 'flex-1',
          priority: 80
        },
        complementary: {
          classes: 'w-80',
          width: '20rem',
          priority: 'supportive'
        }
      };
  }
}

// Responsive breakpoint management
export function getResponsiveAttention(screenWidth: number): Partial<AttentionConfig> {
  if (screenWidth < 768) {
    // Mobile: Primary gets 100%, others are overlays
    return {
      navigation: {
        classes: 'fixed left-0 top-0 h-full z-50 w-72 -translate-x-full',
        width: '18rem',
        priority: 5
      },
      primary: {
        classes: 'w-full',
        priority: 95
      },
      complementary: {
        classes: 'fixed bottom-0 left-0 right-0 z-40',
        width: '100%',
        priority: 'ambient'
      }
    };
  }

  if (screenWidth < 1200) {
    // Tablet: Collapsible complementary panel
    return {
      navigation: {
        classes: 'w-60',
        width: '15rem',
        priority: 15
      },
      primary: {
        classes: 'flex-1',
        priority: 80
      },
      complementary: {
        classes: 'w-0 overflow-hidden',
        width: '0',
        priority: 'hidden'
      }
    };
  }

  // Desktop: Full layout
  return {};
}

// Calculate visual weight distribution
export function calculateVisualWeight(config: AttentionConfig): {
  navigation: number;
  primary: number;
  complementary: number;
} {
  const total = 100;
  
  return {
    navigation: config.navigation.priority,
    primary: config.primary.priority,
    complementary: config.complementary.priority === 'hidden' ? 0 : 
                  config.complementary.priority === 'ambient' ? 5 : 
                  (total - config.navigation.priority - config.primary.priority)
  };
}

// Attention tracking for analytics
export function trackAttentionMetrics(
  view: string,
  focusMode: boolean,
  timeSpent: number,
  interactions: number
) {
  // This would connect to analytics in production
  const metrics = {
    view,
    focusMode,
    timeSpent,
    interactions,
    attentionScore: calculateAttentionScore(timeSpent, interactions),
    timestamp: new Date().toISOString()
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Attention Metrics:', metrics);
  }

  return metrics;
}

function calculateAttentionScore(timeSpent: number, interactions: number): number {
  // Simple attention score based on engagement
  const timeScore = Math.min(timeSpent / 60000, 1) * 50; // Max 50 points for 60s+
  const interactionScore = Math.min(interactions / 10, 1) * 50; // Max 50 points for 10+ interactions
  
  return Math.round(timeScore + interactionScore);
}