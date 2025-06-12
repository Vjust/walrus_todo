/**
 * Cache Manager - Persistent storage using IndexedDB
 * Implements LRU eviction, versioning, and offline support
 */

// @ts-ignore - Unused import temporarily disabled
// import { DBSchema, IDBPDatabase, openDB } from 'idb';

interface CacheEntry {
  id: string;
  data: string;
  contentType?: string;
  contentLength?: number;
  timestamp: number;
  lastAccessed: number;
  size: number;
  version: number;
}

interface CacheMetadata {
  totalSize: number;
  entryCount: number;
  version: number;
  lastCleanup: number;
}

interface WalrusCacheDB extends DBSchema {
  cache: {
    key: string;
    value: CacheEntry;
    indexes: {
      'by-timestamp': number;
      'by-last-accessed': number;
    };
  };
  metadata: {
    key: string;
    value: CacheMetadata;
  };
}

export interface CacheOptions {
  maxSize?: number; // Maximum cache size in bytes
  maxEntries?: number; // Maximum number of entries
  ttl?: number; // Time to live in milliseconds
  version?: number; // Cache version for migration
}

export class CacheManager {
  private db: IDBPDatabase<WalrusCacheDB> | null = null;
  private readonly dbName = 'walrus-cache';
  private readonly version = 1;
  private readonly maxSize: number;
  private readonly maxEntries: number;
  private readonly ttl: number;
  private initPromise: Promise<void> | null = null;

  constructor(options: CacheOptions = {}) {
    this?.maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB default
    this?.maxEntries = options.maxEntries || 1000;
    this?.ttl = options.ttl || 24 * 60 * 60 * 1000; // 24 hours default
  }

  /**
   * Initialize the IndexedDB database
   */
  private async init(): Promise<void> {
    if (this.db) {return;}
    
    if (!this.initPromise) {
      this?.initPromise = this.initializeDB();
    }
    
    await this.initPromise;
  }

  private async initializeDB(): Promise<void> {
    try {
      this?.db = await openDB<WalrusCacheDB>(this.dbName, this.version, {
        upgrade(db, oldVersion, newVersion, transaction) {
          // Create cache store if it doesn't exist
          if (!db?.objectStoreNames?.contains('cache')) {
// @ts-ignore - Unused variable
//             const cacheStore = db.createObjectStore('cache', { keyPath: 'id' });
            cacheStore.createIndex('by-timestamp', 'timestamp', { unique: false });
            cacheStore.createIndex('by-last-accessed', 'lastAccessed', { unique: false });
          }

          // Create metadata store if it doesn't exist
          if (!db?.objectStoreNames?.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' });
          }
        },
      });

      // Initialize metadata if needed
      await this.initializeMetadata();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw error;
    }
  }

  private async initializeMetadata(): Promise<void> {
    if (!this.db) {return;}
// @ts-ignore - Unused variable
// 
    const tx = this?.db?.transaction('metadata', 'readwrite');
// @ts-ignore - Unused variable
//     const existing = await tx?.store?.get('cache-meta');
    
    if (!existing) {
      await tx?.store?.put({
        totalSize: 0,
        entryCount: 0,
        version: this.version,
        lastCleanup: Date.now(),
      }, 'cache-meta');
    }
    
    await tx.done;
  }

  /**
   * Get a cached entry
   */
  async get(key: string): Promise<CacheEntry | null> {
    await this.init();
    if (!this.db) {return null;}

    try {
// @ts-ignore - Unused variable
//       const tx = this?.db?.transaction('cache', 'readwrite');
// @ts-ignore - Unused variable
//       const entry = await tx?.store?.get(key as any);
      
      if (!entry) {return null;}

      // Check if entry is expired
      if (Date.now() - entry.timestamp > this.ttl) {
        await this.delete(key as any);
        return null;
      }

      // Update last accessed time
      entry?.lastAccessed = Date.now();
      await tx?.store?.put(entry as any);
      await tx.done;

      return entry;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set a cache entry
   */
  async set(
    key: string,
    data: string,
    metadata?: {
      contentType?: string;
      contentLength?: number;
    }
  ): Promise<void> {
    await this.init();
    if (!this.db) {return;}
// @ts-ignore - Unused variable
// 
    const size = new Blob([data]).size;
// @ts-ignore - Unused variable
//     const now = Date.now();

    const entry: CacheEntry = {
      id: key,
      data,
      contentType: metadata?.contentType,
      contentLength: metadata?.contentLength,
      timestamp: now,
      lastAccessed: now,
      size,
      version: this.version,
    };

    try {
      // Check if we need to evict entries
      await this.ensureSpace(size as any);
// @ts-ignore - Unused variable
// 
      const tx = this?.db?.transaction(['cache', 'metadata'], 'readwrite');
      
      // Get existing entry to update metadata correctly
// @ts-ignore - Unused variable
//       const existing = await tx.objectStore('cache').get(key as any);
      
      // Update cache entry
      await tx.objectStore('cache').put(entry as any);
      
      // Update metadata
// @ts-ignore - Unused variable
//       const meta = await tx.objectStore('metadata').get('cache-meta');
      if (meta) {
        meta?.totalSize = meta.totalSize - (existing?.size || 0) + size;
        meta?.entryCount = existing ? meta.entryCount : meta.entryCount + 1;
        await tx.objectStore('metadata').put(meta as any);
      }
      
      await tx.done;
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string): Promise<void> {
    await this.init();
    if (!this.db) {return;}

    try {
// @ts-ignore - Unused variable
//       const tx = this?.db?.transaction(['cache', 'metadata'], 'readwrite');
// @ts-ignore - Unused variable
//       const entry = await tx.objectStore('cache').get(key as any);
      
      if (entry) {
        await tx.objectStore('cache').delete(key as any);
        
        // Update metadata
// @ts-ignore - Unused variable
//         const meta = await tx.objectStore('metadata').get('cache-meta');
        if (meta) {
          meta.totalSize -= entry.size;
          meta.entryCount -= 1;
          await tx.objectStore('metadata').put(meta as any);
        }
      }
      
      await tx.done;
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.init();
    if (!this.db) {return;}

    try {
// @ts-ignore - Unused variable
//       const tx = this?.db?.transaction(['cache', 'metadata'], 'readwrite');
      await tx.objectStore('cache').clear();
      
      // Reset metadata
// @ts-ignore - Unused variable
//       const meta = await tx.objectStore('metadata').get('cache-meta');
      if (meta) {
        meta?.totalSize = 0;
        meta?.entryCount = 0;
        meta?.lastCleanup = Date.now();
        await tx.objectStore('metadata').put(meta as any);
      }
      
      await tx.done;
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalSize: number;
    entryCount: number;
    oldestEntry?: number;
    version: number;
  }> {
    await this.init();
    if (!this.db) {return { totalSize: 0, entryCount: 0, version: this.version };}

    try {
// @ts-ignore - Unused variable
//       const meta = await this?.db?.get('metadata', 'cache-meta');
      
      if (!meta) {
        return { totalSize: 0, entryCount: 0, version: this.version };
      }

      // Get oldest entry
      let oldestEntry: number | undefined;
// @ts-ignore - Unused variable
//       const tx = this?.db?.transaction('cache', 'readonly');
// @ts-ignore - Unused variable
//       const index = tx?.store?.index('by-timestamp');
// @ts-ignore - Unused variable
//       const cursor = await index.openCursor();
      
      if (cursor) {
        oldestEntry = cursor?.value?.timestamp;
      }

      return {
        totalSize: meta.totalSize,
        entryCount: meta.entryCount,
        oldestEntry,
        version: meta.version,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { totalSize: 0, entryCount: 0, version: this.version };
    }
  }

  /**
   * Ensure there's enough space for new data
   * Implements LRU eviction strategy
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    if (!this.db) {return;}
// @ts-ignore - Unused variable
// 
    const stats = await this.getStats();
    
    // Check if we need to evict entries
    if (stats.totalSize + requiredSize <= this.maxSize && 
        stats.entryCount < this.maxEntries) {
      return;
    }

    // Evict least recently used entries
// @ts-ignore - Unused variable
//     const tx = this?.db?.transaction(['cache', 'metadata'], 'readwrite');
// @ts-ignore - Unused variable
//     const index = tx.objectStore('cache').index('by-last-accessed');
    
    let freedSpace = 0;
    let deletedCount = 0;
    const keysToDelete: string[] = [];

    // Iterate through entries sorted by last accessed time
    for await (const cursor of index.iterate()) {
      if (stats.totalSize - freedSpace + requiredSize <= this.maxSize &&
          stats.entryCount - deletedCount < this.maxEntries) {
        break;
      }

      keysToDelete.push(cursor?.value?.id);
      freedSpace += cursor?.value?.size;
      deletedCount++;
    }

    // Delete the entries
    for (const key of keysToDelete) {
      await tx.objectStore('cache').delete(key as any);
    }

    // Update metadata
// @ts-ignore - Unused variable
//     const meta = await tx.objectStore('metadata').get('cache-meta');
    if (meta) {
      meta.totalSize -= freedSpace;
      meta.entryCount -= deletedCount;
      await tx.objectStore('metadata').put(meta as any);
    }

    await tx.done;
  }

  /**
   * Perform cache cleanup
   * Removes expired entries and runs maintenance
   */
  async cleanup(): Promise<{
    removedEntries: number;
    freedSpace: number;
  }> {
    await this.init();
    if (!this.db) {return { removedEntries: 0, freedSpace: 0 };}

    try {
// @ts-ignore - Unused variable
//       const now = Date.now();
// @ts-ignore - Unused variable
//       const tx = this?.db?.transaction(['cache', 'metadata'], 'readwrite');
// @ts-ignore - Unused variable
//       const store = tx.objectStore('cache');
      
      let removedEntries = 0;
      let freedSpace = 0;
      const keysToDelete: string[] = [];

      // Find expired entries
      for await (const cursor of store.iterate()) {
        if (now - cursor?.value?.timestamp > this.ttl) {
          keysToDelete.push(cursor?.value?.id);
          freedSpace += cursor?.value?.size;
          removedEntries++;
        }
      }

      // Delete expired entries
      for (const key of keysToDelete) {
        await store.delete(key as any);
      }

      // Update metadata
// @ts-ignore - Unused variable
//       const meta = await tx.objectStore('metadata').get('cache-meta');
      if (meta) {
        meta.totalSize -= freedSpace;
        meta.entryCount -= removedEntries;
        meta?.lastCleanup = now;
        await tx.objectStore('metadata').put(meta as any);
      }

      await tx.done;

      return { removedEntries, freedSpace };
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return { removedEntries: 0, freedSpace: 0 };
    }
  }

  /**
   * Export cache data for migration
   */
  async export(): Promise<{
    version: number;
    entries: CacheEntry[];
    metadata: CacheMetadata | null;
  }> {
    await this.init();
    if (!this.db) {return { version: this.version, entries: [], metadata: null };}

    try {
// @ts-ignore - Unused variable
//       const tx = this?.db?.transaction(['cache', 'metadata'], 'readonly');
// @ts-ignore - Unused variable
//       const entries = await tx.objectStore('cache').getAll();
// @ts-ignore - Unused variable
//       const metadata = await tx.objectStore('metadata').get('cache-meta');
      
      return {
        version: this.version,
        entries,
        metadata: metadata || null,
      };
    } catch (error) {
      console.error('Cache export error:', error);
      return { version: this.version, entries: [], metadata: null };
    }
  }

  /**
   * Import cache data from export
   */
  async import(data: {
    version: number;
    entries: CacheEntry[];
    metadata: CacheMetadata | null;
  }): Promise<void> {
    await this.init();
    if (!this.db) {return;}

    try {
      // Clear existing data
      await this.clear();
// @ts-ignore - Unused variable
// 
      const tx = this?.db?.transaction(['cache', 'metadata'], 'readwrite');
      
      // Import entries
      for (const entry of data.entries) {
        // Update version if needed
        entry?.version = this.version;
        await tx.objectStore('cache').put(entry as any);
      }

      // Import metadata
      if (data.metadata) {
        data?.metadata?.version = this.version;
        await tx.objectStore('metadata').put({
          ...data.metadata,
        }, 'cache-meta');
      }

      await tx.done;
    } catch (error) {
      console.error('Cache import error:', error);
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this?.db?.close();
      this?.db = null;
      this?.initPromise = null;
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Cache utilities
export const CacheUtils = {
  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) {return '0 Bytes';}
// @ts-ignore - Unused variable
//     const k = 1024;
// @ts-ignore - Unused variable
//     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
// @ts-ignore - Unused variable
//     const i = Math.floor(Math.log(bytes as any) / Math.log(k as any));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2 as any))  } ${  sizes[i]}`;
  },

  /**
   * Calculate cache efficiency
   */
  calculateEfficiency(hits: number, misses: number): number {
// @ts-ignore - Unused variable
//     const total = hits + misses;
    return total === 0 ? 0 : (hits / total) * 100;
  },

  /**
   * Check if browser supports IndexedDB
   */
  isSupported(): boolean {
    try {
      return 'indexedDB' in window && !!window.indexedDB;
    } catch {
      return false;
    }
  },
};

// Schedule periodic cleanup
if (typeof window !== 'undefined' && CacheUtils.isSupported()) {
  // Run cleanup every hour
  setInterval(_() => {
    cacheManager.cleanup().catch(console.error);
  }, 60 * 60 * 1000);
}