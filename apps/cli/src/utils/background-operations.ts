import { Todo } from '../types/todo';
import { BackgroundCacheManager, CacheOperation } from './BackgroundCacheManager';
import { performanceMonitor } from './PerformanceMonitor';
import { Logger } from './Logger';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('background-operations');

export interface BackgroundUploadOptions {
  epochs?: number;
  network?: string;
  batchSize?: number;
  priority?: 'low' | 'normal' | 'high';
  onProgress?: (operationId: string, progress: number) => void;
  onComplete?: (operationId: string, result: any) => void;
  onError?: (operationId: string, error: Error) => void;
}

export interface BackgroundBlobCacheOptions {
  items: Array<{ key: string; value: string }>;
  priority?: 'low' | 'normal' | 'high';
}

export interface BackgroundStorageAllocationOptions {
  size: number;
  epochs?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface BackgroundSyncOptions {
  todos: Todo[];
  direction?: 'push' | 'pull' | 'both';
  resolve?: 'local' | 'blockchain' | 'newest' | 'oldest';
  batchSize?: number;
  priority?: 'low' | 'normal' | 'high';
  onProgress?: (operationId: string, progress: number) => void;
  onComplete?: (operationId: string, result: any) => void;
  onError?: (operationId: string, error: Error) => void;
}

export interface BackgroundContinuousSyncOptions {
  interval?: number; // in seconds
  direction?: 'push' | 'pull' | 'both';
  resolve?: 'local' | 'blockchain' | 'newest' | 'oldest';
  force?: boolean;
  priority?: 'low' | 'normal' | 'high';
  onProgress?: (operationId: string, progress: number, data?: any) => void;
  onComplete?: (operationId: string, result: any) => void;
  onError?: (operationId: string, error: Error) => void;
}

/**
 * High-level interface for background cache operations
 */
export class BackgroundOperations {
  private cacheManager: BackgroundCacheManager;

  constructor(cacheManager: BackgroundCacheManager) {
    this.cacheManager = cacheManager;
    this.setupEventListeners();
  }

  /**
   * Upload todos in the background without blocking the terminal
   */
  async uploadTodosInBackground(
    todos: Todo[],
    options: BackgroundUploadOptions = {}
  ): Promise<string> {
    const operationId = uuidv4();
    
    const operation: CacheOperation = {
      id: operationId,
      type: 'upload',
      data: {
        todos,
        epochs: options.epochs || 5,
        network: options.network || 'testnet',
        batchSize: options.batchSize || 5,
      },
      priority: options.priority || 'normal',
    };

    logger.info(`Starting background upload for ${todos.length} todos`, {
      operationId,
      priority: operation.priority,
    });

    // Setup callbacks if provided
    if (options.onProgress) {
      this.cacheManager.on('operationProgress', (id, progress) => {
        if (id === operationId) {
          options.onProgress!(id, progress);
        }
      });
    }

    if (options.onComplete) {
      this.cacheManager.on('operationCompleted', (id, result) => {
        if (id === operationId) {
          options.onComplete!(id, result);
        }
      });
    }

    if (options.onError) {
      this.cacheManager.on('operationFailed', (id, error) => {
        if (id === operationId) {
          options.onError!(id, error);
        }
      });
    }

    const queuedId = await this.cacheManager.queueOperation(operation);
    
    // Track performance
    performanceMonitor.startOperation(operationId, 'background-upload');

    return queuedId;
  }

  /**
   * Cache blob IDs in the background
   */
  async cacheBlobIdsInBackground(
    options: BackgroundBlobCacheOptions
  ): Promise<string> {
    const operationId = uuidv4();
    
    const operation: CacheOperation = {
      id: operationId,
      type: 'blob-cache',
      data: {
        items: options.items,
      },
      priority: options.priority || 'low',
    };

    logger.info(`Starting background blob ID caching for ${options.items.length} items`, {
      operationId,
    });

    return await this.cacheManager.queueOperation(operation);
  }

  /**
   * Allocate storage space in the background
   */
  async allocateStorageInBackground(
    options: BackgroundStorageAllocationOptions
  ): Promise<string> {
    const operationId = uuidv4();
    
    const operation: CacheOperation = {
      id: operationId,
      type: 'storage-allocation',
      data: {
        size: options.size,
        epochs: options.epochs || 5,
      },
      priority: options.priority || 'normal',
    };

    logger.info(`Starting background storage allocation for ${options.size} bytes`, {
      operationId,
    });

    return await this.cacheManager.queueOperation(operation);
  }

  /**
   * Process batch operations in the background
   */
  async processBatchInBackground(
    items: any[],
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<string> {
    const operationId = uuidv4();
    
    const operation: CacheOperation = {
      id: operationId,
      type: 'batch-process',
      data: {
        items,
      },
      priority,
    };

    logger.info(`Starting background batch processing for ${items.length} items`, {
      operationId,
    });

    return await this.cacheManager.queueOperation(operation);
  }

  /**
   * Sync todos in the background
   */
  async syncTodosInBackground(
    options: BackgroundSyncOptions
  ): Promise<string> {
    const operationId = uuidv4();
    
    const operation: CacheOperation = {
      id: operationId,
      type: 'sync',
      data: {
        todos: options.todos,
        direction: options.direction || 'both',
        resolve: options.resolve || 'newest',
        batchSize: options.batchSize || 10,
        network: 'testnet',
      },
      priority: options.priority || 'normal',
    };

    logger.info(`Starting background sync for ${options.todos.length} todos`, {
      operationId,
      direction: options.direction,
      priority: operation.priority,
    });

    // Setup callbacks if provided
    if (options.onProgress) {
      this.cacheManager.on('operationProgress', (id, progress) => {
        if (id === operationId) {
          options.onProgress!(id, progress);
        }
      });
    }

    if (options.onComplete) {
      this.cacheManager.on('operationCompleted', (id, result) => {
        if (id === operationId) {
          options.onComplete!(id, result);
        }
      });
    }

    if (options.onError) {
      this.cacheManager.on('operationFailed', (id, error) => {
        if (id === operationId) {
          options.onError!(id, error);
        }
      });
    }

    const queuedId = await this.cacheManager.queueOperation(operation);
    
    // Track performance
    performanceMonitor.startOperation(operationId, 'background-sync');

    return queuedId;
  }

  /**
   * Start continuous sync in the background
   */
  async startContinuousSyncInBackground(
    options: BackgroundContinuousSyncOptions = {}
  ): Promise<string> {
    const operationId = uuidv4();
    
    const operation: CacheOperation = {
      id: operationId,
      type: 'continuous-sync',
      data: {
        interval: (options.interval || 300) * 1000, // Convert to milliseconds
        direction: options.direction || 'both',
        resolve: options.resolve || 'newest',
        force: options.force || false,
        network: 'testnet',
      },
      priority: options.priority || 'normal',
      timeout: undefined, // No timeout for continuous operations
    };

    logger.info(`Starting background continuous sync`, {
      operationId,
      interval: options.interval || 300,
      direction: options.direction,
      priority: operation.priority,
    });

    // Setup callbacks if provided
    if (options.onProgress) {
      this.cacheManager.on('operationProgress', (id, progress) => {
        if (id === operationId) {
          options.onProgress!(id, progress);
        }
      });
    }

    if (options.onComplete) {
      this.cacheManager.on('operationCompleted', (id, result) => {
        if (id === operationId) {
          options.onComplete!(id, result);
        }
      });
    }

    if (options.onError) {
      this.cacheManager.on('operationFailed', (id, error) => {
        if (id === operationId) {
          options.onError!(id, error);
        }
      });
    }

    const queuedId = await this.cacheManager.queueOperation(operation);
    
    // Track performance
    performanceMonitor.startOperation(operationId, 'background-continuous-sync');

    return queuedId;
  }

  /**
   * Get status of a background operation
   */
  async getOperationStatus(operationId: string) {
    return await this.cacheManager.getOperationStatus(operationId);
  }

  /**
   * Get result of a completed operation
   */
  async getOperationResult(operationId: string) {
    return await this.cacheManager.getOperationResult(operationId);
  }

  /**
   * Wait for an operation to complete with progress updates
   */
  async waitForOperationWithProgress(
    operationId: string,
    progressCallback?: (progress: number) => void,
    timeoutMs: number = 300000 // 5 minutes
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation ${operationId} timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Setup progress listener
      const progressListener = (id: string, progress: number) => {
        if (id === operationId && progressCallback) {
          progressCallback(progress);
        }
      };

      // Setup completion listener
      const completionListener = (id: string, result: any) => {
        if (id === operationId) {
          clearTimeout(timeoutId);
          this.cacheManager.off('operationProgress', progressListener);
          this.cacheManager.off('operationCompleted', completionListener);
          this.cacheManager.off('operationFailed', failureListener);
          
          performanceMonitor.endOperation(operationId, 'background-operation-wait', true);
          resolve(result);
        }
      };

      // Setup failure listener
      const failureListener = (id: string, error: any) => {
        if (id === operationId) {
          clearTimeout(timeoutId);
          this.cacheManager.off('operationProgress', progressListener);
          this.cacheManager.off('operationCompleted', completionListener);
          this.cacheManager.off('operationFailed', failureListener);
          
          performanceMonitor.endOperation(operationId, 'background-operation-wait', false, {
            error: error instanceof Error ? error.message : String(error),
          });
          reject(error);
        }
      };

      this.cacheManager.on('operationProgress', progressListener);
      this.cacheManager.on('operationCompleted', completionListener);
      this.cacheManager.on('operationFailed', failureListener);

      // Start tracking
      performanceMonitor.startOperation(operationId, 'background-operation-wait');
    });
  }

  /**
   * Cancel a background operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    logger.info(`Cancelling background operation: ${operationId}`);
    return await this.cacheManager.cancelOperation(operationId);
  }

  /**
   * Get list of all active operations
   */
  getActiveOperations() {
    return this.cacheManager.getActiveOperations();
  }

  /**
   * Setup event listeners for logging and monitoring
   */
  private setupEventListeners(): void {
    this.cacheManager.on('operationQueued', (id, type) => {
      logger.info(`Background operation queued: ${type}`, { operationId: id });
    });

    this.cacheManager.on('operationProgress', (id, progress) => {
      logger.debug(`Background operation progress: ${id} - ${progress}%`);
    });

    this.cacheManager.on('operationCompleted', (id, result) => {
      performanceMonitor.endOperation(id, 'background-operation', true, {
        resultSize: JSON.stringify(result).length,
      });
      logger.info(`Background operation completed: ${id}`);
    });

    this.cacheManager.on('operationFailed', (id, error) => {
      performanceMonitor.endOperation(id, 'background-operation', false, {
        error: error instanceof Error ? error.message : String(error),
      });
      logger.error(`Background operation failed: ${id}`, error);
    });

    this.cacheManager.on('operationCancelled', (id) => {
      performanceMonitor.endOperation(id, 'background-operation', false, {
        cancelled: true,
      });
      logger.warn(`Background operation cancelled: ${id}`);
    });

    this.cacheManager.on('operationTimeout', (id) => {
      performanceMonitor.endOperation(id, 'background-operation', false, {
        timeout: true,
      });
      logger.warn(`Background operation timeout: ${id}`);
    });
  }

  /**
   * Shutdown background operations gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down background operations...');
    await this.cacheManager.shutdown();
  }
}

/**
 * Utility functions for common background operations
 */
export class BackgroundUtils {
  /**
   * Create a non-blocking upload operation that returns immediately
   * with a handle to track progress
   */
  static async createNonBlockingUpload(
    backgroundOps: BackgroundOperations,
    todos: Todo[],
    options: BackgroundUploadOptions = {}
  ): Promise<{
    operationId: string;
    getProgress: () => Promise<number>;
    getStatus: () => Promise<any>;
    waitForCompletion: () => Promise<any>;
    cancel: () => Promise<boolean>;
  }> {
    const operationId = await backgroundOps.uploadTodosInBackground(todos, options);

    return {
      operationId,
      getProgress: async () => {
        const status = await backgroundOps.getOperationStatus(operationId);
        return status?.progress || 0;
      },
      getStatus: async () => {
        return await backgroundOps.getOperationStatus(operationId);
      },
      waitForCompletion: async () => {
        return await backgroundOps.waitForOperationWithProgress(operationId);
      },
      cancel: async () => {
        return await backgroundOps.cancelOperation(operationId);
      },
    };
  }

  /**
   * Batch multiple small operations into background jobs
   */
  static async batchOperations<T>(
    operations: Array<() => Promise<T>>,
    batchSize: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
      
      // Small delay between batches to prevent overwhelming
      if (i + batchSize < operations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Monitor system resources and automatically adjust background operation priority
   */
  static async monitorResourceUsage(
    backgroundOps: BackgroundOperations
  ): Promise<void> {
    const checkInterval = 30000; // 30 seconds
    
    setInterval(async () => {
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      const activeOps = backgroundOps.getActiveOperations();
      
      logger.debug(`Resource usage check: ${heapUsedPercent.toFixed(1)}% heap, ${activeOps.length} active ops`);
      
      // If memory usage is high, we could implement logic to pause or throttle operations
      if (heapUsedPercent > 85) {
        logger.warn('High memory usage detected, consider reducing background operations');
        // Could implement automatic operation throttling here
      }
    }, checkInterval);
  }
}

// Export convenience functions
export async function createBackgroundOperationsManager(): Promise<BackgroundOperations> {
  const { createBackgroundCacheManager } = await import('./BackgroundCacheManager');
  const cacheManager = createBackgroundCacheManager();
  return new BackgroundOperations(cacheManager);
}

export { BackgroundOperations };