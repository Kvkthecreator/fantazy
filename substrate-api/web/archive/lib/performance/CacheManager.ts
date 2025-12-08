// ============================================================================
// ADVANCED CACHING SYSTEM
// ============================================================================
// Multi-tier caching with intelligent invalidation and performance monitoring

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessTime: number;
  ttl: number;
  tags: string[];
  size: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  enableCompression: boolean;
  enableMetrics: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'priority';
  persistToDisk: boolean;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  averageResponseTime: number;
  memoryUsage: number;
  evictionCount: number;
  compressionRatio: number;
}

export interface CacheInvalidationRule {
  id: string;
  pattern: string | RegExp;
  tags: string[];
  condition: (entry: CacheEntry<any>) => boolean;
  action: 'delete' | 'refresh' | 'mark_stale';
}

/**
 * Advanced Multi-Tier Cache Manager
 * 
 * Features:
 * - L1: Memory cache with LRU/LFU eviction
 * - L2: IndexedDB persistent cache
 * - L3: Service Worker cache
 * - Intelligent prefetching and preloading
 * - Smart invalidation with tag-based rules
 * - Compression and performance metrics
 * - Change-aware caching for real-time updates
 */
export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private persistentCache: IDBDatabase | null = null;
  private serviceWorkerCache: Cache | null = null;
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private invalidationRules: Map<string, CacheInvalidationRule> = new Map();
  private compressionWorker: Worker | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      enableCompression: true,
      enableMetrics: true,
      evictionPolicy: 'lru',
      persistToDisk: true,
      ...config
    };

    this.metrics = {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      evictionCount: 0,
      compressionRatio: 0
    };

    this.initializeCache();
  }

  // ========================================================================
  // CACHE INITIALIZATION
  // ========================================================================

  private async initializeCache(): Promise<void> {
    try {
      // Initialize IndexedDB for persistent caching
      if (this.config.persistToDisk && typeof window !== 'undefined') {
        await this.initializePersistentCache();
      }

      // Initialize Service Worker cache
      if ('serviceWorker' in navigator && 'caches' in window) {
        await this.initializeServiceWorkerCache();
      }

      // Initialize compression worker
      if (this.config.enableCompression) {
        await this.initializeCompressionWorker();
      }

      // Set up automatic cleanup
      this.startCleanupInterval();

      console.log('🚀 Advanced Cache Manager initialized');
    } catch (error) {
      console.error('Failed to initialize cache manager:', error);
    }
  }

  private async initializePersistentCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('yarnnn_cache', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.persistentCache = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache_entries')) {
          const store = db.createObjectStore('cache_entries', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('tags', 'tags', { multiEntry: true });
        }
      };
    });
  }

  private async initializeServiceWorkerCache(): Promise<void> {
    try {
      this.serviceWorkerCache = await caches.open('yarnnn_sw_cache_v1');
    } catch (error) {
      console.warn('Service Worker cache not available:', error);
    }
  }

  private async initializeCompressionWorker(): Promise<void> {
    try {
      // Create compression worker for large cache entries
      const workerBlob = new Blob([`
        self.onmessage = function(e) {
          const { data, action } = e.data;
          
          if (action === 'compress') {
            // Simple compression simulation - in production use real compression
            const compressed = JSON.stringify(data);
            self.postMessage({ compressed, originalSize: data.length, compressedSize: compressed.length });
          } else if (action === 'decompress') {
            const decompressed = JSON.parse(data);
            self.postMessage({ decompressed });
          }
        };
      `], { type: 'application/javascript' });

      this.compressionWorker = new Worker(URL.createObjectURL(workerBlob));
    } catch (error) {
      console.warn('Compression worker not available:', error);
    }
  }

  // ========================================================================
  // CORE CACHE OPERATIONS
  // ========================================================================

  async get<T>(key: string, options: { 
    skipL1?: boolean;
    skipL2?: boolean;
    skipL3?: boolean;
  } = {}): Promise<T | null> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      // L1: Memory cache
      if (!options.skipL1) {
        const memoryResult = await this.getFromMemoryCache<T>(key);
        if (memoryResult !== null) {
          this.recordCacheHit(startTime);
          return memoryResult;
        }
      }

      // L2: Persistent cache
      if (!options.skipL2 && this.persistentCache) {
        const persistentResult = await this.getFromPersistentCache<T>(key);
        if (persistentResult !== null) {
          // Promote to memory cache
          await this.setInMemoryCache(key, persistentResult, { skipPersistent: true });
          this.recordCacheHit(startTime);
          return persistentResult;
        }
      }

      // L3: Service Worker cache
      if (!options.skipL3 && this.serviceWorkerCache) {
        const swResult = await this.getFromServiceWorkerCache<T>(key);
        if (swResult !== null) {
          // Promote to higher tiers
          await this.setInMemoryCache(key, swResult, { skipPersistent: false });
          this.recordCacheHit(startTime);
          return swResult;
        }
      }

      this.recordCacheMiss(startTime);
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.recordCacheMiss(startTime);
      return null;
    }
  }

  async set<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      tags?: string[];
      priority?: CacheEntry<T>['priority'];
      skipL1?: boolean;
      skipL2?: boolean;
      skipL3?: boolean;
    } = {}
  ): Promise<void> {
    const ttl = options.ttl || this.config.defaultTTL;
    const tags = options.tags || [];
    const priority = options.priority || 'medium';

    try {
      // Set in memory cache
      if (!options.skipL1) {
        await this.setInMemoryCache(key, value, { 
          ttl, tags, priority, 
          skipPersistent: options.skipL2 
        });
      }

      // Set in persistent cache
      if (!options.skipL2 && this.persistentCache) {
        await this.setInPersistentCache(key, value, { ttl, tags, priority });
      }

      // Set in Service Worker cache for static resources
      if (!options.skipL3 && this.serviceWorkerCache && this.isStaticResource(key)) {
        await this.setInServiceWorkerCache(key, value);
      }

    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // Delete from all tiers
      this.memoryCache.delete(key);
      
      if (this.persistentCache) {
        const transaction = this.persistentCache.transaction(['cache_entries'], 'readwrite');
        const store = transaction.objectStore('cache_entries');
        await store.delete(key);
      }

      if (this.serviceWorkerCache) {
        await this.serviceWorkerCache.delete(key);
      }

    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // ========================================================================
  // MEMORY CACHE OPERATIONS
  // ========================================================================

  private async getFromMemoryCache<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessTime = Date.now();

    return entry.value as T;
  }

  private async setInMemoryCache<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      tags?: string[];
      priority?: CacheEntry<T>['priority'];
      skipPersistent?: boolean;
    } = {}
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessTime: Date.now(),
      ttl: options.ttl || this.config.defaultTTL,
      tags: options.tags || [],
      size: this.calculateSize(value),
      priority: options.priority || 'medium'
    };

    // Check memory limits and evict if necessary
    await this.evictIfNecessary(entry.size);

    this.memoryCache.set(key, entry);
    this.updateMemoryUsage();
  }

  // ========================================================================
  // PERSISTENT CACHE OPERATIONS
  // ========================================================================

  private async getFromPersistentCache<T>(key: string): Promise<T | null> {
    if (!this.persistentCache) return null;

    try {
      const transaction = this.persistentCache.transaction(['cache_entries'], 'readonly');
      const store = transaction.objectStore('cache_entries');
      const request = store.get(key);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve(null);
            return;
          }

          // Check TTL
          if (Date.now() > result.timestamp + result.ttl) {
            // Delete expired entry
            this.deleteFromPersistentCache(key);
            resolve(null);
            return;
          }

          resolve(result.value);
        };

        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.error('Persistent cache get error:', error);
      return null;
    }
  }

  private async setInPersistentCache<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      tags?: string[];
      priority?: CacheEntry<T>['priority'];
    } = {}
  ): Promise<void> {
    if (!this.persistentCache) return;

    try {
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessTime: Date.now(),
        ttl: options.ttl || this.config.defaultTTL,
        tags: options.tags || [],
        size: this.calculateSize(value),
        priority: options.priority || 'medium'
      };

      const transaction = this.persistentCache.transaction(['cache_entries'], 'readwrite');
      const store = transaction.objectStore('cache_entries');
      await store.put(entry);

    } catch (error) {
      console.error('Persistent cache set error:', error);
    }
  }

  private async deleteFromPersistentCache(key: string): Promise<void> {
    if (!this.persistentCache) return;

    try {
      const transaction = this.persistentCache.transaction(['cache_entries'], 'readwrite');
      const store = transaction.objectStore('cache_entries');
      await store.delete(key);
    } catch (error) {
      console.error('Persistent cache delete error:', error);
    }
  }

  // ========================================================================
  // SERVICE WORKER CACHE OPERATIONS
  // ========================================================================

  private async getFromServiceWorkerCache<T>(key: string): Promise<T | null> {
    if (!this.serviceWorkerCache) return null;

    try {
      const response = await this.serviceWorkerCache.match(key);
      if (!response) return null;

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error('Service Worker cache get error:', error);
      return null;
    }
  }

  private async setInServiceWorkerCache<T>(key: string, value: T): Promise<void> {
    if (!this.serviceWorkerCache) return;

    try {
      const response = new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json' }
      });
      await this.serviceWorkerCache.put(key, response);
    } catch (error) {
      console.error('Service Worker cache set error:', error);
    }
  }

  // ========================================================================
  // INTELLIGENT INVALIDATION
  // ========================================================================

  addInvalidationRule(rule: CacheInvalidationRule): void {
    this.invalidationRules.set(rule.id, rule);
  }

  removeInvalidationRule(ruleId: string): void {
    this.invalidationRules.delete(ruleId);
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    const keysToInvalidate: string[] = [];

    // Check memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        keysToInvalidate.push(key);
      }
    }

    // Check persistent cache
    if (this.persistentCache) {
      const transaction = this.persistentCache.transaction(['cache_entries'], 'readonly');
      const store = transaction.objectStore('cache_entries');
      const index = store.index('tags');

      for (const tag of tags) {
        const request = index.getAll(tag);
        request.onsuccess = () => {
          request.result.forEach(entry => {
            if (!keysToInvalidate.includes(entry.key)) {
              keysToInvalidate.push(entry.key);
            }
          });
        };
      }
    }

    // Invalidate all found keys
    for (const key of keysToInvalidate) {
      await this.delete(key);
    }

    console.log(`🧹 Invalidated ${keysToInvalidate.length} cache entries by tags:`, tags);
  }

  async invalidateByPattern(pattern: string | RegExp): Promise<void> {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keysToInvalidate: string[] = [];

    // Check memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        keysToInvalidate.push(key);
      }
    }

    // Invalidate matching keys
    for (const key of keysToInvalidate) {
      await this.delete(key);
    }

    console.log(`🧹 Invalidated ${keysToInvalidate.length} cache entries by pattern:`, pattern);
  }

  // ========================================================================
  // EVICTION POLICIES
  // ========================================================================

  private async evictIfNecessary(newEntrySize: number): Promise<void> {
    const currentSize = Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.size, 0);

    if (currentSize + newEntrySize <= this.config.maxSize) {
      return;
    }

    const bytesToEvict = (currentSize + newEntrySize) - this.config.maxSize;
    let bytesEvicted = 0;

    switch (this.config.evictionPolicy) {
      case 'lru':
        bytesEvicted = await this.evictLRU(bytesToEvict);
        break;
      case 'lfu':
        bytesEvicted = await this.evictLFU(bytesToEvict);
        break;
      case 'ttl':
        bytesEvicted = await this.evictByTTL(bytesToEvict);
        break;
      case 'priority':
        bytesEvicted = await this.evictByPriority(bytesToEvict);
        break;
    }

    this.metrics.evictionCount++;
    console.log(`🗑️  Evicted ${bytesEvicted} bytes using ${this.config.evictionPolicy} policy`);
  }

  private async evictLRU(bytesToEvict: number): Promise<number> {
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.lastAccessTime - b.lastAccessTime);

    let bytesEvicted = 0;
    for (const [key, entry] of entries) {
      if (bytesEvicted >= bytesToEvict) break;
      
      this.memoryCache.delete(key);
      bytesEvicted += entry.size;
    }

    return bytesEvicted;
  }

  private async evictLFU(bytesToEvict: number): Promise<number> {
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.accessCount - b.accessCount);

    let bytesEvicted = 0;
    for (const [key, entry] of entries) {
      if (bytesEvicted >= bytesToEvict) break;
      
      this.memoryCache.delete(key);
      bytesEvicted += entry.size;
    }

    return bytesEvicted;
  }

  private async evictByTTL(bytesToEvict: number): Promise<number> {
    const now = Date.now();
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => (a.timestamp + a.ttl) - (b.timestamp + b.ttl));

    let bytesEvicted = 0;
    for (const [key, entry] of entries) {
      if (bytesEvicted >= bytesToEvict) break;
      
      this.memoryCache.delete(key);
      bytesEvicted += entry.size;
    }

    return bytesEvicted;
  }

  private async evictByPriority(bytesToEvict: number): Promise<number> {
    const priorityOrder = { 'low': 0, 'medium': 1, 'high': 2, 'critical': 3 };
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    let bytesEvicted = 0;
    for (const [key, entry] of entries) {
      if (bytesEvicted >= bytesToEvict || entry.priority === 'critical') break;
      
      this.memoryCache.delete(key);
      bytesEvicted += entry.size;
    }

    return bytesEvicted;
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private calculateSize(value: any): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 1024; // Fallback size estimate
    }
  }

  private isStaticResource(key: string): boolean {
    return key.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/i) !== null;
  }

  private recordCacheHit(startTime: number): void {
    this.metrics.totalHits++;
    this.updateMetrics(startTime);
  }

  private recordCacheMiss(startTime: number): void {
    this.metrics.totalMisses++;
    this.updateMetrics(startTime);
  }

  private updateMetrics(startTime: number): void {
    const responseTime = performance.now() - startTime;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;

    this.metrics.hitRate = this.metrics.totalHits / this.metrics.totalRequests;
    this.metrics.missRate = this.metrics.totalMisses / this.metrics.totalRequests;
  }

  private updateMemoryUsage(): void {
    this.metrics.memoryUsage = Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  private startCleanupInterval(): void {
    setInterval(async () => {
      await this.cleanupExpiredEntries();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.persistentCache) {
      const transaction = this.persistentCache.transaction(['cache_entries'], 'readwrite');
      const store = transaction.objectStore('cache_entries');
      await store.clear();
    }

    if (this.serviceWorkerCache) {
      const keys = await this.serviceWorkerCache.keys();
      await Promise.all(keys.map(key => this.serviceWorkerCache!.delete(key)));
    }

    console.log('🧹 All caches cleared');
  }

  async prefetch<T>(keys: string[], fetcher: (key: string) => Promise<T>): Promise<void> {
    const prefetchPromises = keys.map(async (key) => {
      const cached = await this.get<T>(key);
      if (cached === null) {
        try {
          const value = await fetcher(key);
          await this.set(key, value, { tags: ['prefetch'] });
        } catch (error) {
          console.warn(`Prefetch failed for key ${key}:`, error);
        }
      }
    });

    await Promise.all(prefetchPromises);
    console.log(`🚀 Prefetched ${keys.length} cache entries`);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let globalCacheManager: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager();
  }
  return globalCacheManager;
}