"use client";

import { useCallback, useRef, useEffect, useState } from 'react';
import type { PageContext } from './pageContextDetection';
import type { SynthesisContext } from './crossPageSynthesis';
import type { BehavioralContext } from './behavioralTriggers';

// Core interfaces for performance optimizations
export interface PerformanceOptimizations {
  behavioralTracking: {
    throttleInterval: number;
    eventDebouncing: number;
    cleanupInterval: number;
  };
  crossPageSynthesis: {
    cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
    recomputeThreshold: number;
    preloadStrategy: boolean;
  };
  modalPerformance: {
    lazyLoading: boolean;
    precomputeChanges: boolean;
    loadingStateManagement: boolean;
  };
}

export interface ThrottledFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
}

export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  computationCost: number;
  size?: number;
}

export interface PerformanceMetrics {
  cacheHitRate: number;
  averageComputationTime: number;
  throttledCalls: number;
  debouncedCalls: number;
  memoryUsage: number;
  cleanupFrequency: number;
}

/**
 * Advanced performance optimization utilities
 */
export class PerformanceOptimizationManager {
  private config: PerformanceOptimizations;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private throttledFunctions: Map<string, any> = new Map();
  private debouncedFunctions: Map<string, any> = new Map();
  private metrics: PerformanceMetrics;
  private cleanupInterval?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;

  constructor(config: PerformanceOptimizations) {
    this.config = config;
    this.metrics = {
      cacheHitRate: 0,
      averageComputationTime: 0,
      throttledCalls: 0,
      debouncedCalls: 0,
      memoryUsage: 0,
      cleanupFrequency: 0
    };

    this.initializePerformanceMonitoring();
    this.startCleanupInterval();
  }

  /**
   * Create a throttled function with advanced throttling
   */
  createThrottledFunction<T extends (...args: any[]) => any>(
    fn: T,
    wait: number,
    options: {
      leading?: boolean;
      trailing?: boolean;
      maxWait?: number;
    } = {}
  ): ThrottledFunction<T> {
    const { leading = true, trailing = true, maxWait } = options;
    
    let lastCallTime: number | undefined;
    let lastInvokeTime = 0;
    let timerId: NodeJS.Timeout | undefined;
    let lastArgs: Parameters<T> | undefined;
    let lastThis: any;
    let result: ReturnType<T>;

    const invokeFunc = (time: number) => {
      const args = lastArgs!;
      const thisArg = lastThis;
      lastArgs = lastThis = undefined;
      lastInvokeTime = time;
      result = fn.apply(thisArg, args);
      this.metrics.throttledCalls++;
      return result;
    };

    const leadingEdge = (time: number) => {
      lastInvokeTime = time;
      timerId = setTimeout(timerExpired, wait);
      return leading ? invokeFunc(time) : result;
    };

    const remainingWait = (time: number) => {
      const timeSinceLastCall = time - lastCallTime!;
      const timeSinceLastInvoke = time - lastInvokeTime;
      const timeWaiting = wait - timeSinceLastCall;
      
      return maxWait !== undefined
        ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
        : timeWaiting;
    };

    const shouldInvoke = (time: number) => {
      if (lastCallTime === undefined) return true;
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;
      
      return (timeSinceLastCall >= wait ||
              timeSinceLastCall < 0 ||
              (maxWait !== undefined && timeSinceLastInvoke >= maxWait));
    };

    const timerExpired = () => {
      const time = Date.now();
      if (shouldInvoke(time)) {
        return trailingEdge(time);
      }
      timerId = setTimeout(timerExpired, remainingWait(time));
    };

    const trailingEdge = (time: number) => {
      timerId = undefined;
      if (trailing && lastArgs) {
        return invokeFunc(time);
      }
      lastArgs = lastThis = undefined;
      return result;
    };

    const cancel = () => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      lastInvokeTime = 0;
      lastArgs = lastThis = timerId = undefined;
    };

    const flush = () => {
      return timerId === undefined ? result : trailingEdge(Date.now());
    };

    function throttled(this: any, ...args: Parameters<T>): ReturnType<T> {
      const time = Date.now();
      const isInvoking = shouldInvoke(time);

      lastArgs = args;
      lastThis = this;
      lastCallTime = time;

      if (isInvoking) {
        if (timerId === undefined) {
          return leadingEdge(lastCallTime);
        }
        if (maxWait !== undefined) {
          timerId = setTimeout(timerExpired, wait);
          return invokeFunc(lastCallTime);
        }
      }
      if (timerId === undefined) {
        timerId = setTimeout(timerExpired, wait);
      }
      return result;
    }

    // Attach cancel and flush methods
    (throttled as any).cancel = cancel;
    (throttled as any).flush = flush;

    return throttled as unknown as ThrottledFunction<T>;
  }

  /**
   * Create a debounced function with advanced debouncing
   */
  createDebouncedFunction<T extends (...args: any[]) => any>(
    fn: T,
    wait: number,
    options: {
      leading?: boolean;
      trailing?: boolean;
      maxWait?: number;
    } = {}
  ): DebouncedFunction<T> {
    const { leading = false, trailing = true, maxWait } = options;
    
    let lastCallTime: number | undefined;
    let lastInvokeTime = 0;
    let timerId: NodeJS.Timeout | undefined;
    let lastArgs: Parameters<T> | undefined;
    let lastThis: any;
    let result: ReturnType<T>;

    const invokeFunc = (time: number) => {
      const args = lastArgs!;
      const thisArg = lastThis;
      lastArgs = lastThis = undefined;
      lastInvokeTime = time;
      result = fn.apply(thisArg, args);
      this.metrics.debouncedCalls++;
      return result;
    };

    const leadingEdge = (time: number) => {
      lastInvokeTime = time;
      timerId = setTimeout(timerExpired, wait);
      return leading ? invokeFunc(time) : result;
    };

    const remainingWait = (time: number) => {
      const timeSinceLastCall = time - lastCallTime!;
      const timeSinceLastInvoke = time - lastInvokeTime;
      const timeWaiting = wait - timeSinceLastCall;
      
      return maxWait !== undefined
        ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
        : timeWaiting;
    };

    const shouldInvoke = (time: number) => {
      if (lastCallTime === undefined) return true;
      const timeSinceLastCall = time - lastCallTime;
      const timeSinceLastInvoke = time - lastInvokeTime;
      
      return (timeSinceLastCall >= wait ||
              timeSinceLastCall < 0 ||
              (maxWait !== undefined && timeSinceLastInvoke >= maxWait));
    };

    const timerExpired = () => {
      const time = Date.now();
      if (shouldInvoke(time)) {
        return trailingEdge(time);
      }
      timerId = setTimeout(timerExpired, remainingWait(time));
    };

    const trailingEdge = (time: number) => {
      timerId = undefined;
      if (trailing && lastArgs) {
        return invokeFunc(time);
      }
      lastArgs = lastThis = undefined;
      return result;
    };

    const cancel = () => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      lastInvokeTime = 0;
      lastArgs = lastThis = timerId = undefined;
    };

    const flush = () => {
      return timerId === undefined ? result : trailingEdge(Date.now());
    };

    function debounced(this: any, ...args: Parameters<T>): ReturnType<T> {
      const time = Date.now();
      const isInvoking = shouldInvoke(time);

      lastArgs = args;
      lastThis = this;
      lastCallTime = time;

      if (isInvoking) {
        if (timerId === undefined) {
          return leadingEdge(lastCallTime);
        }
        if (maxWait !== undefined) {
          timerId = setTimeout(timerExpired, wait);
          return invokeFunc(lastCallTime);
        }
      }
      if (timerId === undefined) {
        timerId = setTimeout(timerExpired, wait);
      }
      return result;
    }

    // Attach cancel and flush methods
    (debounced as any).cancel = cancel;
    (debounced as any).flush = flush;

    return debounced as unknown as DebouncedFunction<T>;
  }

  /**
   * Advanced caching with LRU eviction and smart invalidation
   */
  createCache<T>(maxSize: number = 100): {
    get: (key: string) => T | undefined;
    set: (key: string, value: T, computationCost?: number) => void;
    has: (key: string) => boolean;
    delete: (key: string) => boolean;
    clear: () => void;
    size: () => number;
  } {
    const cacheSize = maxSize;
    
    return {
      get: (key: string): T | undefined => {
        const entry = this.cache.get(key);
        if (!entry) {
          return undefined;
        }
        
        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        
        // Update cache hit rate
        this.updateCacheHitRate(true);
        
        return entry.data;
      },

      set: (key: string, value: T, computationCost: number = 1): void => {
        const now = Date.now();
        const entry: CacheEntry<T> = {
          data: value,
          timestamp: now,
          accessCount: 1,
          lastAccessed: now,
          computationCost
        };

        // Check if we need to evict entries
        if (this.cache.size >= cacheSize && !this.cache.has(key)) {
          this.evictLeastUseful();
        }

        this.cache.set(key, entry);
        this.updateMemoryUsage();
      },

      has: (key: string): boolean => {
        return this.cache.has(key);
      },

      delete: (key: string): boolean => {
        const result = this.cache.delete(key);
        if (result) {
          this.updateMemoryUsage();
        }
        return result;
      },

      clear: (): void => {
        this.cache.clear();
        this.updateMemoryUsage();
      },

      size: (): number => {
        return this.cache.size;
      }
    };
  }

  /**
   * Evict least useful cache entries based on access patterns and age
   */
  private evictLeastUseful(): void {
    const now = Date.now();
    let leastUsefulKey: string | null = null;
    let leastUsefulScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Calculate usefulness score based on:
      // - Access frequency
      // - Recency
      // - Computation cost
      const age = now - entry.timestamp;
      const recency = now - entry.lastAccessed;
      
      const usefulnessScore = (
        (entry.accessCount * entry.computationCost) / 
        (1 + age / 1000 + recency / 1000)
      );

      if (usefulnessScore < leastUsefulScore) {
        leastUsefulScore = usefulnessScore;
        leastUsefulKey = key;
      }
    }

    if (leastUsefulKey) {
      this.cache.delete(leastUsefulKey);
    }
  }

  /**
   * Smart cache invalidation based on context changes
   */
  invalidateCache(pattern: string | RegExp): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          keysToDelete.push(key);
        }
      } else {
        if (pattern.test(key)) {
          keysToDelete.push(key);
        }
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      invalidatedCount++;
    });

    this.updateMemoryUsage();
    return invalidatedCount;
  }

  /**
   * Preload related contexts based on synthesis patterns
   */
  async preloadRelatedContexts(
    currentPage: string,
    synthesisContext: SynthesisContext,
    preloadFn: (page: string) => Promise<any>
  ): Promise<void> {
    if (!this.config.crossPageSynthesis.preloadStrategy) return;

    const relatedPages = synthesisContext.workflowPatterns
      .filter(pattern => pattern.sequence.includes(currentPage))
      .flatMap(pattern => {
        const currentIndex = pattern.sequence.indexOf(currentPage);
        return pattern.sequence.slice(currentIndex + 1, currentIndex + 3); // Next 2 pages
      })
      .filter((page, index, arr) => arr.indexOf(page) === index) // Unique pages
      .slice(0, 3); // Limit to 3 preloads

    // Preload in background
    const preloadPromises = relatedPages.map(async (page) => {
      const cacheKey = `preload_${page}`;
      if (!this.cache.has(cacheKey)) {
        try {
          const data = await preloadFn(page);
          const now = Date.now();
          const entry: CacheEntry<any> = {
            data,
            timestamp: now,
            lastAccessed: now,
            accessCount: 0,
            size: 1,
            computationCost: 2 // Higher computation cost for preloaded data
          };
          this.cache.set(cacheKey, entry);
        } catch (error) {
          console.warn(`Failed to preload context for ${page}:`, error);
        }
      }
    });

    // Don't wait for preloads to complete
    Promise.all(preloadPromises).catch(console.warn);
  }

  /**
   * Optimize synthesis computation with smart caching
   */
  optimizeSynthesisComputation<T>(
    computeFn: () => T,
    cacheKey: string,
    dependencies: any[] = []
  ): T {
    // Create dependency hash
    const dependencyHash = this.hashDependencies(dependencies);
    const fullCacheKey = `${cacheKey}_${dependencyHash}`;

    // Check cache first
    const cachedEntry = this.cache.get(fullCacheKey);
    if (cachedEntry) {
      // Update access statistics
      cachedEntry.accessCount++;
      cachedEntry.lastAccessed = Date.now();
      this.updateCacheHitRate(true);
      return cachedEntry.data as T;
    }

    // Update cache miss rate
    this.updateCacheHitRate(false);

    // Compute and cache result
    const startTime = performance.now();
    const result = computeFn();
    const computationTime = performance.now() - startTime;

    // Update average computation time
    this.updateAverageComputationTime(computationTime);

    // Cache with computation cost based on time
    const computationCost = Math.max(1, Math.floor(computationTime / 10));
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data: result,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1,
      size: 1, // Default size
      computationCost
    };
    
    this.cache.set(fullCacheKey, entry);
    
    // Check if cache needs eviction (default max 100 entries)
    const maxEntries = 100;
    if (this.cache.size > maxEntries) {
      this.evictLeastUseful();
    }

    return result;
  }

  /**
   * Memory-efficient behavioral tracking
   */
  trackBehaviorEfficiently(
    updateFn: (context: BehavioralContext) => BehavioralContext,
    context: BehavioralContext
  ): BehavioralContext {
    const throttled = this.getOrCreateThrottledFunction(
      'behavioral_update',
      updateFn,
      this.config.behavioralTracking.throttleInterval
    );

    const result = throttled(context);
    return result !== undefined ? result : context;
  }

  /**
   * Get or create a throttled function for reuse
   */
  private getOrCreateThrottledFunction<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    interval: number
  ): ThrottledFunction<T> {
    if (!this.throttledFunctions.has(key)) {
      const throttled = this.createThrottledFunction(fn, interval, {
        leading: true,
        trailing: true
      });
      this.throttledFunctions.set(key, throttled);
    }
    return this.throttledFunctions.get(key);
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name.includes('intelligence') || entry.name.includes('synthesis')) {
            this.updateAverageComputationTime(entry.duration);
          }
        }
      });
      
      try {
        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        console.warn('Performance monitoring not fully supported:', error);
      }
    }
  }

  /**
   * Start cleanup interval for memory management
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEntries();
      this.metrics.cleanupFrequency++;
    }, this.config.behavioralTracking.cleanupInterval);
  }

  /**
   * Clean up old cache entries
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAge && entry.accessCount < 2) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    this.updateMemoryUsage();
  }

  /**
   * Update cache hit rate metric
   */
  private updateCacheHitRate(hit: boolean): void {
    // Simple moving average
    const currentRate = this.metrics.cacheHitRate;
    const newRate = hit ? 1 : 0;
    this.metrics.cacheHitRate = currentRate * 0.9 + newRate * 0.1;
  }

  /**
   * Update average computation time metric
   */
  private updateAverageComputationTime(time: number): void {
    const currentAvg = this.metrics.averageComputationTime;
    this.metrics.averageComputationTime = currentAvg * 0.9 + time * 0.1;
  }

  /**
   * Update memory usage metric
   */
  private updateMemoryUsage(): void {
    this.metrics.memoryUsage = this.cache.size;
  }

  /**
   * Hash dependencies for cache keys
   */
  private hashDependencies(dependencies: any[]): string {
    return dependencies
      .map(dep => typeof dep === 'object' ? JSON.stringify(dep) : String(dep))
      .join('|');
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    this.cache.clear();
    this.throttledFunctions.clear();
    this.debouncedFunctions.clear();
  }
}

// Default performance configuration
export const defaultPerformanceConfig: PerformanceOptimizations = {
  behavioralTracking: {
    throttleInterval: 500, // 500ms
    eventDebouncing: 300, // 300ms
    cleanupInterval: 300000 // 5 minutes
  },
  crossPageSynthesis: {
    cacheStrategy: 'moderate',
    recomputeThreshold: 0.7,
    preloadStrategy: true
  },
  modalPerformance: {
    lazyLoading: true,
    precomputeChanges: true,
    loadingStateManagement: true
  }
};

// Lazy initialization to avoid circular dependency issues
let _performanceManager: PerformanceOptimizationManager | null = null;

export function getPerformanceManager(): PerformanceOptimizationManager {
  if (!_performanceManager) {
    _performanceManager = new PerformanceOptimizationManager(defaultPerformanceConfig);
  }
  return _performanceManager;
}

// Export for backward compatibility
export const performanceManager = new Proxy({} as PerformanceOptimizationManager, {
  get(target, prop) {
    return getPerformanceManager()[prop as keyof PerformanceOptimizationManager];
  }
});

/**
 * React hooks for performance optimization
 */

// Hook for throttled callbacks
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList
): ThrottledFunction<T> {
  const callbackRef = useRef(callback);
  const throttledRef = useRef<ThrottledFunction<T> | null>(null);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create or update throttled function
  useEffect(() => {
    if (throttledRef.current) {
      throttledRef.current.cancel();
    }
    
    // Use lazy initialization
    try {
      const manager = getPerformanceManager();
      throttledRef.current = manager.createThrottledFunction(
        (...args: Parameters<T>) => callbackRef.current(...args),
        delay,
        { leading: true, trailing: true }
      );
    } catch (error) {
      // Fallback if initialization fails
      console.warn('Performance manager not ready:', error);
    }

    return () => {
      if (throttledRef.current) {
        throttledRef.current.cancel();
      }
    };
  }, [delay, ...deps]);

  // Return a fallback if throttled function not ready
  if (!throttledRef.current) {
    return callback as unknown as ThrottledFunction<T>;
  }

  return throttledRef.current;
}

// Hook for debounced callbacks
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList
): DebouncedFunction<T> {
  const callbackRef = useRef(callback);
  const debouncedRef = useRef<DebouncedFunction<T> | null>(null);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create or update debounced function
  useEffect(() => {
    if (debouncedRef.current) {
      debouncedRef.current.cancel();
    }
    
    // Use lazy initialization
    try {
      const manager = getPerformanceManager();
      debouncedRef.current = manager.createDebouncedFunction(
        (...args: Parameters<T>) => callbackRef.current(...args),
        delay,
        { leading: false, trailing: true }
      );
    } catch (error) {
      // Fallback if initialization fails
      console.warn('Performance manager not ready:', error);
    }

    return () => {
      if (debouncedRef.current) {
        debouncedRef.current.cancel();
      }
    };
  }, [delay, ...deps]);

  // Return a fallback if debounced function not ready
  if (!debouncedRef.current) {
    return callback as unknown as DebouncedFunction<T>;
  }

  return debouncedRef.current;
}

// Hook for optimized computation with caching
export function useOptimizedComputation<T>(
  computeFn: () => T,
  dependencies: React.DependencyList,
  cacheKey: string
): T {
  const computationRef = useRef<T | undefined>(undefined);
  const depsRef = useRef<React.DependencyList | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  // Ensure performanceManager is available
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Check if dependencies have changed
  const depsChanged = !depsRef.current || 
    dependencies.length !== depsRef.current.length ||
    dependencies.some((dep, index) => dep !== depsRef.current![index]);

  if (depsChanged || computationRef.current === undefined) {
    // Use lazy initialization with fallback
    try {
      const manager = getPerformanceManager();
      computationRef.current = manager.optimizeSynthesisComputation(
        computeFn,
        cacheKey,
        [...dependencies]
      );
    } catch (error) {
      // Fallback to direct computation
      computationRef.current = computeFn();
    }
    depsRef.current = dependencies;
  }

  return computationRef.current;
}