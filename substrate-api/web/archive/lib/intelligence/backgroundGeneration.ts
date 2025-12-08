/**
 * Background Intelligence Generation System
 * 
 * Handles automatic intelligence generation with debouncing and activity detection.
 * - Documents: 5-minute debounced timer (resets on each change)
 * - Raw dumps: Immediate generation with 1-minute rate limiting
 * - Pauses during active user sessions
 */

import { apiClient } from '@/lib/api/client';

interface BackgroundGenerationOptions {
  basketId: string;
  origin: 'document_update' | 'raw_dump_added';
  documentId?: string;
  rawDumpId?: string;
}

interface PendingGeneration {
  basketId: string;
  origin: string;
  scheduledTime: number;
  timeoutId: NodeJS.Timeout;
}

// Global state for tracking pending generations
const pendingGenerations = new Map<string, PendingGeneration>();
const lastGenerationTimes = new Map<string, number>();

// Configuration
const DOCUMENT_DEBOUNCE_DELAY = 5 * 60 * 1000; // 5 minutes
const RAW_DUMP_RATE_LIMIT = 60 * 1000; // 1 minute
const ACTIVITY_CHECK_INTERVAL = 30 * 1000; // 30 seconds

/**
 * Check if user has active sessions for a basket
 */
async function hasActiveUserSessions(basketId: string): Promise<boolean> {
  try {
    // This would ideally check WebSocket connections, recent API activity, etc.
    // For now, we'll use a simple heuristic based on recent activity
    const response = await apiClient.request(`/api/activity/check/${basketId}`);
    return (response as any)?.hasActivity || false;
  } catch (error) {
    console.warn('Failed to check user activity:', error);
    return false; // Default to not blocking generation
  }
}

/**
 * Generate intelligence in background
 */
async function executeBackgroundGeneration(basketId: string, origin: string): Promise<void> {
  try {
    // Check for active user sessions
    const hasActiveSessions = await hasActiveUserSessions(basketId);
    if (hasActiveSessions) {
      console.log(`Delaying intelligence generation for basket ${basketId} - user is active`);
      
      // Reschedule for later
      scheduleDocumentGeneration(basketId, ACTIVITY_CHECK_INTERVAL);
      return;
    }

    // Check rate limiting
    const lastGeneration = lastGenerationTimes.get(basketId) || 0;
    const now = Date.now();
    
    if (origin === 'raw_dump_added' && now - lastGeneration < RAW_DUMP_RATE_LIMIT) {
      console.log(`Rate limiting intelligence generation for basket ${basketId}`);
      return;
    }

    console.log(`Executing background intelligence generation for basket ${basketId} (${origin})`);

    // Make the generation request
    const result = await apiClient.request(`/api/intelligence/generate/${basketId}`, {
      method: 'POST',
      body: JSON.stringify({
        origin: 'background',
        checkPending: false // Background generation can run even with pending changes
      })
    });

    console.log(`Background intelligence generation completed for basket ${basketId}:`, result);
    
    // Update last generation time
    lastGenerationTimes.set(basketId, now);

  } catch (error) {
    console.error(`Background intelligence generation error for basket ${basketId}:`, error);
  } finally {
    // Clean up pending generation
    pendingGenerations.delete(basketId);
  }
}

/**
 * Schedule document-based generation with debouncing
 */
function scheduleDocumentGeneration(basketId: string, delay = DOCUMENT_DEBOUNCE_DELAY): void {
  // Cancel existing pending generation
  const existing = pendingGenerations.get(basketId);
  if (existing) {
    clearTimeout(existing.timeoutId);
  }

  // Schedule new generation
  const timeoutId = setTimeout(() => {
    executeBackgroundGeneration(basketId, 'document_update');
  }, delay);

  pendingGenerations.set(basketId, {
    basketId,
    origin: 'document_update',
    scheduledTime: Date.now() + delay,
    timeoutId
  });

  console.log(`Scheduled document-based intelligence generation for basket ${basketId} in ${delay}ms`);
}

/**
 * Schedule immediate raw dump generation with rate limiting
 */
function scheduleRawDumpGeneration(basketId: string): void {
  // Check rate limiting
  const lastGeneration = lastGenerationTimes.get(basketId) || 0;
  const now = Date.now();
  
  if (now - lastGeneration < RAW_DUMP_RATE_LIMIT) {
    console.log(`Rate limiting raw dump intelligence generation for basket ${basketId}`);
    return;
  }

  // Cancel any pending document generation (raw dump takes priority)
  const existing = pendingGenerations.get(basketId);
  if (existing && existing.origin === 'document_update') {
    clearTimeout(existing.timeoutId);
    console.log(`Cancelling pending document generation for basket ${basketId} - raw dump takes priority`);
  }

  // Execute immediately
  const timeoutId = setTimeout(() => {
    executeBackgroundGeneration(basketId, 'raw_dump_added');
  }, 0);

  pendingGenerations.set(basketId, {
    basketId,
    origin: 'raw_dump_added',
    scheduledTime: now,
    timeoutId
  });

  console.log(`Scheduled immediate raw dump intelligence generation for basket ${basketId}`);
}

/**
 * Public API for triggering background intelligence generation
 */
export function triggerBackgroundIntelligenceGeneration(options: BackgroundGenerationOptions): void {
  const { basketId, origin } = options;

  switch (origin) {
    case 'document_update':
      scheduleDocumentGeneration(basketId);
      break;
    
    case 'raw_dump_added':
      scheduleRawDumpGeneration(basketId);
      break;
    
    default:
      console.warn(`Unknown background generation origin: ${origin}`);
  }
}

/**
 * Cancel pending generation for a basket
 */
export function cancelBackgroundGeneration(basketId: string): void {
  const pending = pendingGenerations.get(basketId);
  if (pending) {
    clearTimeout(pending.timeoutId);
    pendingGenerations.delete(basketId);
    console.log(`Cancelled pending intelligence generation for basket ${basketId}`);
  }
}

/**
 * Get status of pending generations
 */
export function getBackgroundGenerationStatus(basketId?: string): {
  pending: Array<{
    basketId: string;
    origin: string;
    scheduledTime: number;
    timeRemaining: number;
  }>;
  total: number;
} {
  const now = Date.now();
  let pending = Array.from(pendingGenerations.values());
  
  if (basketId) {
    pending = pending.filter(gen => gen.basketId === basketId);
  }
  
  return {
    pending: pending.map(gen => ({
      basketId: gen.basketId,
      origin: gen.origin,
      scheduledTime: gen.scheduledTime,
      timeRemaining: Math.max(0, gen.scheduledTime - now)
    })),
    total: pending.length
  };
}

/**
 * Clean up old generation state (called periodically)
 */
export function cleanupBackgroundGenerationState(): void {
  const now = Date.now();
  const oldThreshold = 24 * 60 * 60 * 1000; // 24 hours
  
  // Clean up old last generation times
  for (const [basketId, timestamp] of lastGenerationTimes.entries()) {
    if (now - timestamp > oldThreshold) {
      lastGenerationTimes.delete(basketId);
    }
  }
  
  console.log(`Cleaned up background generation state. Active: ${pendingGenerations.size}, Tracked: ${lastGenerationTimes.size}`);
}

// Auto-cleanup every hour
if (typeof global !== 'undefined') {
  setInterval(cleanupBackgroundGenerationState, 60 * 60 * 1000);
}