import { Logger } from './Logger';
import { PerformanceCache, createCache } from './performance-cache';

export interface LazyLoadOptions {
  preloadHints?: string[];
  cacheModules?: boolean;
  loadTimeout?: number;
}

interface ModuleInfo {
  path: string;
  module: unknown;
  loadTime: number;
  lastAccessed: number;
  preloaded: boolean;
}

export class LazyLoader {
  private readonly logger = Logger.getInstance();
  private readonly moduleCache: Map<string, ModuleInfo> = new Map();
  private readonly loadingPromises: Map<string, Promise<unknown>> = new Map();
  private readonly preloadQueue: Set<string> = new Set();
  private preloadTimer?: NodeJS.Timeout;
  private readonly PRELOAD_DELAY = 100; // ms

  // Use cache manager for persistent caching
  private persistentCache?: PerformanceCache<ModuleInfo>;

  constructor(private options: LazyLoadOptions = {}) {
    if (options.cacheModules) {
      this.persistentCache = createCache<ModuleInfo>('lazy-modules', {
        strategy: 'LRU',
        maxSize: 50,
        ttlMs: 86400000, // 24 hours
      });
    }

    // Schedule preloading of hinted modules
    if (options.preloadHints && options.preloadHints.length > 0) {
      this.schedulePreload(options.preloadHints);
    }
  }

  /**
   * Load a module lazily with caching
   */
  async load<T = unknown>(modulePath: string): Promise<T> {
    const startTime = Date.now();

    // Check memory cache first
    const cached = this.moduleCache.get(modulePath);
    if (cached) {
      cached.lastAccessed = Date.now();
      this.logger.debug(`Module loaded from memory cache: ${modulePath}`, {
        loadTime: `${Date.now() - startTime}ms`,
      });
      return cached.module as T;
    }

    // Check persistent cache if enabled
    if (this.persistentCache) {
      const persistentCached = await this.persistentCache.get(modulePath);
      if (persistentCached) {
        this.moduleCache.set(modulePath, persistentCached);
        this.logger.debug(
          `Module loaded from persistent cache: ${modulePath}`,
          {
            loadTime: `${Date.now() - startTime}ms`,
          }
        );
        return persistentCached.module as T;
      }
    }

    // Check if already loading
    const existingPromise = this.loadingPromises.get(modulePath);
    if (existingPromise) {
      this.logger.debug(`Waiting for existing load: ${modulePath}`);
      return existingPromise as Promise<T>;
    }

    // Load the module
    const loadPromise = this.loadModule<T>(modulePath, startTime);
    this.loadingPromises.set(modulePath, loadPromise);

    try {
      const module = await loadPromise;
      this.loadingPromises.delete(modulePath);
      return module;
    } catch (error) {
      this.loadingPromises.delete(modulePath);
      throw error;
    }
  }

  /**
   * Load a module with timeout
   */
  private async loadModule<T>(
    modulePath: string,
    startTime: number
  ): Promise<T> {
    const timeout = this.options.loadTimeout || 5000;

    try {
      const loadPromise = import(modulePath);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Module load timeout: ${modulePath}`)),
          timeout
        );
      });

      const module = await Promise.race([loadPromise, timeoutPromise]);
      const loadTime = Date.now() - startTime;

      const moduleInfo: ModuleInfo = {
        path: modulePath,
        module,
        loadTime,
        lastAccessed: Date.now(),
        preloaded: false,
      };

      // Cache the module
      this.moduleCache.set(modulePath, moduleInfo);

      if (this.persistentCache) {
        await this.persistentCache.set(modulePath, moduleInfo);
      }

      this.logger.info(`Module loaded: ${modulePath}`, {
        loadTime: `${loadTime}ms`,
        cacheSize: this.moduleCache.size,
      });

      return module;
    } catch (error) {
      this.logger.error(`Failed to load module: ${modulePath}`, error);
      throw error;
    }
  }

  /**
   * Preload modules in the background
   */
  async preload(modulePaths: string[]): Promise<void> {
    for (const path of modulePaths) {
      this.preloadQueue.add(path);
    }

    if (!this.preloadTimer) {
      this.scheduleNextPreload();
    }
  }

  /**
   * Schedule preloading of hinted modules
   */
  private schedulePreload(hints: string[]): void {
    // Add to preload queue
    for (const hint of hints) {
      this.preloadQueue.add(hint);
    }

    // Start preloading after a delay
    setTimeout(() => this.scheduleNextPreload(), this.PRELOAD_DELAY);
  }

  /**
   * Schedule the next preload operation
   */
  private scheduleNextPreload(): void {
    if (this.preloadQueue.size === 0) {
      this.preloadTimer = undefined;
      return;
    }

    const modulePath = this.preloadQueue.values().next().value;
    this.preloadQueue.delete(modulePath);

    // Preload in background
    this.loadModuleInBackground(modulePath).finally(() => {
      // Schedule next preload
      this.preloadTimer = setTimeout(
        () => this.scheduleNextPreload(),
        this.PRELOAD_DELAY
      );
    });
  }

  /**
   * Load a module in the background for preloading
   */
  private async loadModuleInBackground(modulePath: string): Promise<void> {
    try {
      const startTime = Date.now();
      const module = await import(modulePath);
      const loadTime = Date.now() - startTime;

      const moduleInfo: ModuleInfo = {
        path: modulePath,
        module,
        loadTime,
        lastAccessed: Date.now(),
        preloaded: true,
      };

      this.moduleCache.set(modulePath, moduleInfo);

      if (this.persistentCache) {
        await this.persistentCache.set(modulePath, moduleInfo);
      }

      this.logger.debug(`Module preloaded: ${modulePath}`, {
        loadTime: `${loadTime}ms`,
      });
    } catch (error) {
      this.logger.warn(`Failed to preload module: ${modulePath}`, error);
    }
  }

  /**
   * Clear module from cache
   */
  async clear(modulePath: string): Promise<void> {
    this.moduleCache.delete(modulePath);

    if (this.persistentCache) {
      await this.persistentCache.delete(modulePath);
    }

    this.logger.debug(`Module cleared from cache: ${modulePath}`);
  }

  /**
   * Clear all cached modules
   */
  async clearAll(): Promise<void> {
    this.moduleCache.clear();

    if (this.persistentCache) {
      await this.persistentCache.clear();
    }

    this.logger.info('All modules cleared from cache');
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    memoryCacheSize: number;
    preloadedCount: number;
    averageLoadTime: number;
    modules: Array<{
      path: string;
      loadTime: number;
      preloaded: boolean;
      lastAccessed: Date;
    }>;
  } {
    const modules = Array.from(this.moduleCache.values());
    const preloadedCount = modules.filter(m => m.preloaded).length;
    const totalLoadTime = modules.reduce((sum, m) => sum + m.loadTime, 0);
    const averageLoadTime =
      modules.length > 0 ? totalLoadTime / modules.length : 0;

    return {
      memoryCacheSize: this.moduleCache.size,
      preloadedCount,
      averageLoadTime,
      modules: modules.map(m => ({
        path: m.path,
        loadTime: m.loadTime,
        preloaded: m.preloaded,
        lastAccessed: new Date(m.lastAccessed),
      })),
    };
  }

  /**
   * Shutdown the lazy loader
   */
  async shutdown(): Promise<void> {
    if (this.preloadTimer) {
      clearTimeout(this.preloadTimer);
    }

    if (this.persistentCache) {
      await this.persistentCache.shutdown();
    }

    this.logger.info('Lazy loader shutting down');
  }
}

// Singleton instance for global use
let globalLazyLoader: LazyLoader | null = null;

export function getGlobalLazyLoader(options?: LazyLoadOptions): LazyLoader {
  if (!globalLazyLoader) {
    globalLazyLoader = new LazyLoader(
      options || {
        cacheModules: true,
        preloadHints: ['@mysten/sui/client', '@mysten/walrus', 'chalk', 'ora'],
      }
    );
  }
  return globalLazyLoader;
}

// Export convenience functions
export async function lazyLoad<T = any>(modulePath: string): Promise<T> {
  const loader = getGlobalLazyLoader();
  return loader.load<T>(modulePath);
}

export async function preloadModules(modulePaths: string[]): Promise<void> {
  const loader = getGlobalLazyLoader();
  return loader.preload(modulePaths);
}

// Shutdown hook
process.on('SIGINT', async () => {
  if (globalLazyLoader) {
    await globalLazyLoader.shutdown();
  }
});
