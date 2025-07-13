/**
 * Local file-based cache implementation
 * Provides persistent caching with TTL support for offline functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  data: T;
  metadata: {
    createdAt: string;
    expiresAt?: string;
    version: string;
    lastSyncTime?: string;
  };
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  baseDir?: string;
  defaultTTL?: number; // in milliseconds
  version?: string;
}

/**
 * File-based cache implementation
 */
export class FileCache {
  private baseDir: string;
  private defaultTTL: number;
  private version: string;
  private lockMap: Map<string, Promise<any>> = new Map();

  constructor(config: CacheConfig = {}) {
    this.baseDir = config.baseDir || path.join(os.homedir(), '.waltodo', 'cache');
    this.defaultTTL = config.defaultTTL || 24 * 60 * 60 * 1000; // 24 hours default
    this.version = config.version || '1.0.0';
  }

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      logger.debug('Cache directory initialized', { path: this.baseDir });
    } catch (error) {
      logger.error('Failed to initialize cache directory:', error);
      throw error;
    }
  }

  /**
   * Get cache file path for a key
   */
  private getCachePath(key: string): string {
    // Sanitize key to be filesystem-safe
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.baseDir, `${safeKey}.json`);
  }

  /**
   * Get temporary file path for atomic writes
   */
  private getTempPath(key: string): string {
    const cachePath = this.getCachePath(key);
    return `${cachePath}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Acquire a lock for a key to handle concurrent access
   */
  private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.lockMap.get(key);
    if (existing) {
      await existing;
    }

    const promise = operation();
    this.lockMap.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.lockMap.delete(key);
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    return this.withLock(key, async () => {
      const cachePath = this.getCachePath(key);

      try {
        const content = await fs.readFile(cachePath, 'utf-8');
        const entry: CacheEntry<T> = JSON.parse(content);

        // Check if entry has expired
        if (entry.metadata.expiresAt) {
          const expiresAt = new Date(entry.metadata.expiresAt);
          if (expiresAt < new Date()) {
            logger.debug('Cache entry expired', { key, expiresAt });
            await this.delete(key);
            return null;
          }
        }

        // Check version compatibility
        if (entry.metadata.version !== this.version) {
          logger.warn('Cache version mismatch', {
            key,
            cacheVersion: entry.metadata.version,
            currentVersion: this.version,
          });
          // You might want to handle migration here
        }

        logger.debug('Cache hit', { key });
        return entry.data;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          logger.debug('Cache miss', { key });
          return null;
        }

        // Handle corrupted cache
        if (error instanceof SyntaxError) {
          logger.error('Corrupted cache entry', { key, error });
          try {
            await this.delete(key);
          } catch (deleteError) {
            logger.error('Failed to delete corrupted cache', { key, error: deleteError });
          }
          return null;
        }

        logger.error('Failed to read cache', { key, error });
        throw error;
      }
    });
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    return this.withLock(key, async () => {
      const cachePath = this.getCachePath(key);
      const tempPath = this.getTempPath(key);

      const entry: CacheEntry<T> = {
        data,
        metadata: {
          createdAt: new Date().toISOString(),
          version: this.version,
          lastSyncTime: new Date().toISOString(),
        },
      };

      // Set expiration if TTL is provided
      const effectiveTTL = ttl !== undefined ? ttl : this.defaultTTL;
      if (effectiveTTL > 0) {
        const expiresAt = new Date(Date.now() + effectiveTTL);
        entry.metadata.expiresAt = expiresAt.toISOString();
      }

      try {
        // Write to temporary file first (atomic write)
        await fs.writeFile(tempPath, JSON.stringify(entry, null, 2), 'utf-8');

        // Atomically rename temp file to final location
        await fs.rename(tempPath, cachePath);

        logger.debug('Cache set', { key, ttl: effectiveTTL });
      } catch (error) {
        logger.error('Failed to write cache', { key, error });

        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }

        throw error;
      }
    });
  }

  /**
   * Delete data from cache
   */
  async delete(key: string): Promise<void> {
    return this.withLock(key, async () => {
      const cachePath = this.getCachePath(key);

      try {
        await fs.unlink(cachePath);
        logger.debug('Cache deleted', { key });
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          logger.debug('Cache entry not found', { key });
          return;
        }
        logger.error('Failed to delete cache', { key, error });
        throw error;
      }
    });
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.baseDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      await Promise.all(
        jsonFiles.map(file => 
          fs.unlink(path.join(this.baseDir, file)).catch(error => {
            logger.error('Failed to delete cache file', { file, error });
          })
        )
      );

      logger.debug('Cache cleared', { count: jsonFiles.length });
    } catch (error) {
      logger.error('Failed to clear cache', { error });
      throw error;
    }
  }

  /**
   * Get all cache keys
   */
  async keys(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', '').replace(/_/g, '-'));
    } catch (error) {
      logger.error('Failed to list cache keys', { error });
      return [];
    }
  }

  /**
   * Check if a key exists in cache (without reading the data)
   */
  async has(key: string): Promise<boolean> {
    const cachePath = this.getCachePath(key);
    try {
      await fs.access(cachePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<{
    size: number;
    count: number;
    oldestEntry?: string;
    newestEntry?: string;
  }> {
    try {
      const files = await fs.readdir(this.baseDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      let totalSize = 0;
      let oldestTime = Infinity;
      let newestTime = -Infinity;
      let oldestEntry: string | undefined;
      let newestEntry: string | undefined;

      await Promise.all(
        jsonFiles.map(async file => {
          const filePath = path.join(this.baseDir, file);
          try {
            const stats = await fs.stat(filePath);
            totalSize += stats.size;

            if (stats.mtimeMs < oldestTime) {
              oldestTime = stats.mtimeMs;
              oldestEntry = new Date(stats.mtime).toISOString();
            }

            if (stats.mtimeMs > newestTime) {
              newestTime = stats.mtimeMs;
              newestEntry = new Date(stats.mtime).toISOString();
            }
          } catch (error) {
            logger.warn('Failed to stat cache file', { file, error });
          }
        })
      );

      return {
        size: totalSize,
        count: jsonFiles.length,
        oldestEntry,
        newestEntry,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      return { size: 0, count: 0 };
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidate(pattern: string | RegExp): Promise<number> {
    try {
      const keys = await this.keys();
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      
      const matchingKeys = keys.filter(key => regex.test(key));
      
      await Promise.all(
        matchingKeys.map(key => this.delete(key).catch(error => {
          logger.error('Failed to invalidate cache key', { key, error });
        }))
      );

      logger.debug('Cache invalidated', { pattern: pattern.toString(), count: matchingKeys.length });
      return matchingKeys.length;
    } catch (error) {
      logger.error('Failed to invalidate cache', { pattern: pattern.toString(), error });
      throw error;
    }
  }

  /**
   * Update cache entry metadata without changing the data
   */
  async touch(key: string, ttl?: number): Promise<boolean> {
    return this.withLock(key, async () => {
      const data = await this.get(key);
      if (data === null) {
        return false;
      }

      await this.set(key, data, ttl);
      return true;
    });
  }
}

// Default cache instance
export const cache = new FileCache();