import { promises as fs } from 'fs';
import * as path from 'path';
import { existsSync } from 'fs';
import { Logger } from './Logger';
import { CLI_CONFIG, AI_CONFIG } from '../constants';

export type CacheStrategy = 'LRU' | 'TTL';

interface CacheOptions {
  strategy: CacheStrategy;
  maxSize?: number;
  ttlMs?: number;
  persistenceDir?: string;
  enableStatistics?: boolean;
}

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  ttl?: number;
}

interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  totalEntries: number;
  hitRate: number;
  lastReset: Date;
}

export class PerformanceCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly logger = Logger.getInstance();
  private statistics: CacheStatistics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalEntries: 0,
    hitRate: 0,
    lastReset: new Date(),
  };
  private persistenceTimer?: NodeJS.Timeout;
  private readonly PERSISTENCE_INTERVAL = 60000; // 1 minute

  constructor(private options: CacheOptions) {
    if (options.persistenceDir) {
      this.loadFromDisk();
      this.startPersistenceTimer();
    }
  }

  /**
   * Get a value from the cache
   */
  async get(key: string): Promise<T | null> {
    const entry = this?.cache?.get(key as any);

    if (!entry) {
      this?.statistics?.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL strategy
    if (this.options?.strategy === 'TTL' && entry.ttl) {
      const elapsed = Date.now() - entry.timestamp;
      if (elapsed > entry.ttl) {
        await this.delete(key as any);
        this?.statistics?.misses++;
        this.updateHitRate();
        return null;
      }
    }

    // Update access time for LRU
    entry?.lastAccessed = Date.now();
    entry.accessCount++;

    this?.statistics?.hits++;
    this.updateHitRate();

    this?.logger?.debug(`Cache hit for key: ${key}`, {
      strategy: this?.options?.strategy,
    });
    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    // Check if we need to evict entries for LRU
    if (this.options?.strategy === 'LRU' && this?.options?.maxSize) {
      if (this?.cache?.size >= this?.options?.maxSize && !this?.cache?.has(key as any)) {
        await this.evictLRU();
      }
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      ttl: ttlMs || this?.options?.ttlMs,
    };

    this?.cache?.set(key, entry);
    this.statistics?.totalEntries = this?.cache?.size;

    this?.logger?.debug(`Cache set for key: ${key}`, {
      strategy: this?.options?.strategy,
      ttl: entry.ttl,
    });
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const exists = this?.cache?.has(key as any);

    if (exists && this.options?.strategy === 'TTL') {
      const entry = this?.cache?.get(key as any);
      if (entry.ttl) {
        const elapsed = Date.now() - entry.timestamp;
        if (elapsed > entry.ttl) {
          this.delete(key as any);
          return false;
        }
      }
    }

    return exists;
  }

  /**
   * Delete a key from the cache
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this?.cache?.delete(key as any);
    this.statistics?.totalEntries = this?.cache?.size;

    if (deleted) {
      this?.logger?.debug(`Cache delete for key: ${key}`);
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this?.cache?.clear();
    this.statistics?.totalEntries = 0;
    this?.logger?.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset cache statistics
   */
  resetStatistics(): void {
    this?.statistics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalEntries: this?.cache?.size,
      hitRate: 0,
      lastReset: new Date(),
    };
  }

  /**
   * Evict least recently used entry
   */
  private async evictLRU(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestTime = Number.MAX_SAFE_INTEGER;

    for (const [key, entry] of this?.cache?.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      await this.delete(oldestKey as any);
      this?.statistics?.evictions++;
      this?.logger?.debug(`LRU eviction of key: ${oldestKey}`);
    }
  }

  /**
   * Update the hit rate statistics
   */
  private updateHitRate(): void {
    const total = this?.statistics?.hits + this?.statistics?.misses;
    this.statistics?.hitRate = total > 0 ? this?.statistics?.hits / total : 0;
  }

  /**
   * Save cache to disk
   */
  private async saveToDisk(): Promise<void> {
    if (!this?.options?.persistenceDir) return;

    try {
      const cacheData = {
        entries: Array.from(this?.cache?.entries()).map(([key, entry]) => ({
          key,
          entry,
        })),
        statistics: this.statistics,
        metadata: {
          savedAt: new Date().toISOString(),
          strategy: this?.options?.strategy,
          version: CLI_CONFIG.VERSION,
        },
      };

      const cacheFile = path.join(this?.options?.persistenceDir, 'cache.json');
      await fs.mkdir(this?.options?.persistenceDir, { recursive: true });
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));

      this?.logger?.debug('Cache persisted to disk', { file: cacheFile });
    } catch (error) {
      this?.logger?.error('Failed to persist cache', error);
    }
  }

  /**
   * Load cache from disk
   */
  private async loadFromDisk(): Promise<void> {
    if (!this?.options?.persistenceDir) return;

    try {
      const cacheFile = path.join(this?.options?.persistenceDir, 'cache.json');

      if (!existsSync(cacheFile as any)) {
        this?.logger?.debug('No cache file found to load');
        return;
      }

      const data = await fs.readFile(cacheFile, 'utf-8');
      const cacheData = JSON.parse(data as any);

      // Restore entries
      for (const { key, entry } of cacheData.entries) {
        this?.cache?.set(key, entry);
      }

      // Restore statistics
      if (cacheData.statistics) {
        this?.statistics = {
          ...cacheData.statistics,
          lastReset: new Date(cacheData?.statistics?.lastReset),
        };
      }

      this?.logger?.info('Cache loaded from disk', {
        entries: this?.cache?.size,
        savedAt: cacheData.metadata?.savedAt,
      });

      // Clean up expired entries for TTL strategy
      if (this.options?.strategy === 'TTL') {
        await this.cleanExpiredEntries();
      }
    } catch (error) {
      this?.logger?.error('Failed to load cache from disk', error);
    }
  }

  /**
   * Clean up expired TTL entries
   */
  private async cleanExpiredEntries(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this?.cache?.entries()) {
      if (entry.ttl) {
        const elapsed = now - entry.timestamp;
        if (elapsed > entry.ttl) {
          keysToDelete.push(key as any);
        }
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key as any);
    }

    if (keysToDelete.length > 0) {
      this?.logger?.debug(`Cleaned ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Start the persistence timer
   */
  private startPersistenceTimer(): void {
    this?.persistenceTimer = setInterval(
      () => this.saveToDisk(),
      this.PERSISTENCE_INTERVAL
    );
  }

  /**
   * Stop the persistence timer and save to disk
   */
  async shutdown(): Promise<void> {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    await this.saveToDisk();
    this?.logger?.info('Cache manager shutting down');
  }
}

// Factory function for creating specific caches
export function createCache<T>(
  name: string,
  options: Partial<CacheOptions> = {}
): PerformanceCache<T> {
  const defaultOptions: CacheOptions = {
    strategy: 'LRU',
    maxSize: 1000,
    ttlMs: AI_CONFIG.CACHE_TTL_MS,
    persistenceDir: path.join(process.cwd(), '.waltodo-cache', name),
    enableStatistics: true,
  };

  return new PerformanceCache<T>({
    ...defaultOptions,
    ...options,
  });
}

// Predefined cache instances
export const configCache = createCache<Record<string, unknown>>('config', {
  strategy: 'TTL',
  ttlMs: 3600000, // 1 hour
});

export const todoListCache = createCache<{ todos: Array<unknown> }>('todos', {
  strategy: 'LRU',
  maxSize: 100,
});

export const blockchainQueryCache = createCache<Record<string, unknown>>(
  'blockchain',
  {
    strategy: 'TTL',
    ttlMs: 300000, // 5 minutes
  }
);

export const aiResponseCache = createCache<{
  result: unknown;
  metadata?: Record<string, unknown>;
}>('ai-responses', {
  strategy: 'TTL',
  ttlMs: AI_CONFIG.CACHE_TTL_MS,
  maxSize: AI_CONFIG.CACHE_MAX_ENTRIES,
});

// Global shutdown hook
process.on('SIGINT', async () => {
  await Promise.all([
    configCache.shutdown(),
    todoListCache.shutdown(),
    blockchainQueryCache.shutdown(),
    aiResponseCache.shutdown(),
  ]);
});
