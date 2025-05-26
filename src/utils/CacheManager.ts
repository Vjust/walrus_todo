/**
 * CacheManager - Advanced caching system with memory management
 *
 * Provides efficient caching with automatic cleanup and memory pressure handling
 * Implements LRU, TTL, and memory-aware cache eviction strategies
 */

import { Logger } from './Logger';

// Logger instance
const logger = Logger.getInstance();

export type EvictionStrategy = 'lru' | 'ttl' | 'memory-pressure';

export interface CacheOptions<K, V> {
  maxSize?: number; // Maximum number of items in cache
  ttl?: number; // Time-to-live in milliseconds
  memoryThreshold?: number; // Memory threshold in bytes (0-1 as percentage)
  evictionStrategy?: EvictionStrategy;
  onEviction?: (key: K, value: V) => void; // Optional callback when items are evicted
  staleWhileRevalidate?: boolean; // Return stale values while fetching new ones
  gcInterval?: number; // Garbage collection interval in milliseconds
  sizeCalculator?: (value: V) => number; // Calculate size of cached items
}

interface CacheEntry<V> {
  value: V;
  expires: number;
  lastAccessed: number;
  size: number;
  isStale: boolean;
}

/**
 * Memory-aware cache implementation with automatic resource cleanup
 */
export class CacheManager<K extends PropertyKey, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private totalSize: number = 0;
  private gcTimer: NodeJS.Timeout | null = null;
  private readonly options: Required<CacheOptions<K, V>>;

  // Default cache options
  private static readonly DEFAULT_OPTIONS: Required<CacheOptions<PropertyKey, unknown>> = {
    maxSize: 1000,
    ttl: 5 * 60 * 1000, // 5 minutes
    memoryThreshold: 0.8, // 80% of available memory
    evictionStrategy: 'lru',
    onEviction: () => {},
    staleWhileRevalidate: false,
    gcInterval: 60 * 1000, // 1 minute
    sizeCalculator: (_value: unknown) => 1, // Default size is 1 unit per item
  };

  constructor(options: CacheOptions<K, V> = {}) {
    this.options = { 
      ...CacheManager.DEFAULT_OPTIONS, 
      ...options 
    } as Required<CacheOptions<K, V>>;
    this.startGarbageCollection();

    // Debug log on creation
    logger.debug(`Cache created with options:`, {
      maxSize: this.options.maxSize,
      ttl: this.options.ttl,
      strategy: this.options.evictionStrategy,
    });
  }

  /**
   * Set a value in the cache
   *
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional TTL override for this item
   * @returns true if set successfully, false if eviction failed
   */
  set(key: K, value: V, ttl?: number): boolean {
    // Calculate item size
    const size = this.options.sizeCalculator(value);

    // Check if we're replacing an existing item
    const existing = this.cache.get(key);
    if (existing) {
      // Update total size delta
      this.totalSize -= existing.size;
      this.totalSize += size;
    } else {
      // New item, check if we need to make room
      if (
        this.cache.size >= this.options.maxSize ||
        this.isMemoryPressureHigh()
      ) {
        const evicted = this.evictItems();
        if (!evicted && this.cache.size >= this.options.maxSize) {
          logger.warn(
            `Cache full, couldn't evict items for key: ${String(key)}`
          );
          return false;
        }
      }

      // Add to total size
      this.totalSize += size;
    }

    // Calculate expiration time
    const expires = Date.now() + (ttl ?? this.options.ttl);

    // Store the entry
    this.cache.set(key, {
      value,
      expires,
      lastAccessed: Date.now(),
      size,
      isStale: false,
    });

    return true;
  }

  /**
   * Get a value from the cache
   *
   * @param key Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();

    // Check if expired
    if (entry.expires < now) {
      // If using stale-while-revalidate, mark as stale but return
      if (this.options.staleWhileRevalidate) {
        entry.isStale = true;
        logger.debug(`Returning stale value for key: ${String(key)}`);
        return entry.value;
      }

      // Otherwise remove and return undefined
      this.delete(key);
      return undefined;
    }

    // Update last accessed time for LRU
    entry.lastAccessed = now;
    return entry.value;
  }

  /**
   * Check if a key exists in the cache (doesn't update lastAccessed)
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key from the cache
   */
  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Call eviction callback
    try {
      this.options.onEviction(key, entry.value);
    } catch (error) {
      logger.error(
        `Error in eviction callback for key ${String(key)}`,
        error as Error
      );
    }

    // Update total size
    this.totalSize -= entry.size;

    // Remove from cache
    return this.cache.delete(key);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    // Call eviction callback for each item
    for (const [key, entry] of this.cache.entries()) {
      try {
        this.options.onEviction(key, entry.value);
      } catch (error) {
        logger.error(
          `Error in eviction callback for key ${String(key)}`,
          error as Error
        );
      }
    }

    // Clear the cache and reset size
    this.cache.clear();
    this.totalSize = 0;
    logger.debug('Cache cleared');
  }

  /**
   * Get cache stats
   */
  getStats(): {
    size: number;
    maxSize: number;
    totalSize: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const entry of this.cache.values()) {
      oldestEntry = Math.min(oldestEntry, entry.lastAccessed);
      newestEntry = Math.max(newestEntry, entry.lastAccessed);
    }

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      totalSize: this.totalSize,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Start the garbage collection interval
   */
  private startGarbageCollection(): void {
    if (this.gcTimer !== null) {
      clearInterval(this.gcTimer);
    }

    this.gcTimer = setInterval(() => {
      this.collectGarbage();
    }, this.options.gcInterval);

    // Ensure cleanup on process exit
    process.on('exit', () => {
      this.cleanup();
    });
  }

  /**
   * Perform garbage collection
   */
  private collectGarbage(): void {
    const now = Date.now();
    const expired: K[] = [];

    // Find expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        expired.push(key);
      }
    }

    // Remove expired entries
    if (expired.length > 0) {
      logger.debug(
        `Garbage collection removing ${expired.length} expired items`
      );
      for (const key of expired) {
        this.delete(key);
      }
    }

    // Check memory pressure and evict if needed
    if (this.isMemoryPressureHigh()) {
      logger.debug('Memory pressure high, evicting items');
      this.evictItems();
    }
  }

  /**
   * Check if memory pressure is high
   */
  private isMemoryPressureHigh(): boolean {
    // Use Node.js memory usage if available
    try {
      const memoryUsage = process.memoryUsage();
      const memoryRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

      return memoryRatio > this.options.memoryThreshold;
    } catch (error) {
      logger.warn('Failed to check memory pressure', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fall back to cache size check
      return this.cache.size >= this.options.maxSize;
    }
  }

  /**
   * Evict items based on the selected strategy
   * @returns true if items were evicted, false otherwise
   */
  private evictItems(): boolean {
    if (this.cache.size === 0) return false;

    // Calculate how many items to evict (10% of cache or at least 1)
    const evictionCount = Math.max(1, Math.floor(this.cache.size * 0.1));
    let evicted = 0;

    switch (this.options.evictionStrategy) {
      case 'lru':
        evicted = this.evictLRU(evictionCount);
        break;
      case 'ttl':
        evicted = this.evictTTL(evictionCount);
        break;
      case 'memory-pressure':
        // Start with TTL, then fallback to LRU if needed
        evicted = this.evictTTL(evictionCount);
        if (evicted === 0) {
          evicted = this.evictLRU(evictionCount);
        }
        break;
    }

    return evicted > 0;
  }

  /**
   * Evict least recently used items
   */
  private evictLRU(count: number): number {
    // Sort all entries by last accessed time
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastAccessed - b.lastAccessed
    );

    // Take the oldest entries up to count
    const toEvict = entries.slice(0, count);

    // Delete each entry
    let evicted = 0;
    for (const [key] of toEvict) {
      if (this.delete(key)) {
        evicted++;
      }
    }

    if (evicted > 0) {
      logger.debug(`Evicted ${evicted} items using LRU strategy`);
    }

    return evicted;
  }

  /**
   * Evict items closest to expiration
   */
  private evictTTL(count: number): number {
    const now = Date.now();

    // Sort all entries by time remaining until expiration
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.expires - b.expires)
      // Filter out already expired entries which will be cleared by GC
      .filter(([, entry]) => entry.expires > now);

    // Take the entries closest to expiration up to count
    const toEvict = entries.slice(0, count);

    // Delete each entry
    let evicted = 0;
    for (const [key] of toEvict) {
      if (this.delete(key)) {
        evicted++;
      }
    }

    if (evicted > 0) {
      logger.debug(`Evicted ${evicted} items using TTL strategy`);
    }

    return evicted;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.gcTimer !== null) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    // Clear the cache
    this.clear();
  }
}
