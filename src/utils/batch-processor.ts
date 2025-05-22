import { Logger } from './Logger';
import { sleep } from './index';
import { RETRY_CONFIG } from '../constants';

export interface BatchOptions {
  batchSize: number;
  concurrencyLimit: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  progressCallback?: (progress: BatchProgress) => void;
  errorHandler?: (error: Error, item: unknown, index: number) => void | Promise<void>;
  pauseBetweenBatchesMs?: number;
}

export interface BatchProgress {
  processed: number;
  total: number;
  successful: number;
  failed: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  elapsedMs: number;
  estimatedTimeRemainingMs: number;
}

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ item: unknown; error: Error; index: number }>;
  progress: BatchProgress;
  duration: number;
}

export class BatchProcessor {
  private readonly logger = Logger.getInstance();
  private abortController?: AbortController;

  constructor(private options: BatchOptions) {
    this.options = {
      ...options,
      retryAttempts: options.retryAttempts ?? RETRY_CONFIG.ATTEMPTS,
      retryDelayMs: options.retryDelayMs ?? RETRY_CONFIG.DELAY_MS
    };
  }

  /**
   * Process items in batches with configurable concurrency
   */
  async process<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const totalItems = items.length;
    const batchSize = this.options.batchSize;
    const totalBatches = Math.ceil(totalItems / batchSize);
    
    const successful: R[] = [];
    const failed: Array<{ item: T; error: Error; index: number }> = [];
    
    let processedCount = 0;
    this.abortController = new AbortController();

    try {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        if (this.abortController.signal.aborted) {
          throw new Error('Batch processing aborted');
        }

        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, totalItems);
        const batchItems = items.slice(batchStart, batchEnd);

        this.logger.info(`Processing batch ${batchIndex + 1}/${totalBatches}`, {
          batchSize: batchItems.length,
          range: `${batchStart}-${batchEnd - 1}`
        });

        // Process batch with concurrency control
        const batchResults = await this.processBatchWithConcurrency(
          batchItems,
          batchStart,
          processor
        );

        // Collect results
        for (const result of batchResults) {
          processedCount++;
          
          if (result.success && result.value !== undefined) {
            successful.push(result.value);
          } else if (!result.success && result.error) {
            failed.push({
              item: result.item,
              error: result.error,
              index: result.index
            });
          }

          // Report progress
          if (this.options.progressCallback) {
            const elapsedMs = Date.now() - startTime;
            const itemsPerMs = processedCount / elapsedMs;
            const remainingItems = totalItems - processedCount;
            const estimatedTimeRemainingMs = remainingItems / itemsPerMs;

            const progress: BatchProgress = {
              processed: processedCount,
              total: totalItems,
              successful: successful.length,
              failed: failed.length,
              percentage: (processedCount / totalItems) * 100,
              currentBatch: batchIndex + 1,
              totalBatches,
              elapsedMs,
              estimatedTimeRemainingMs
            };

            this.options.progressCallback(progress);
          }
        }

        // Pause between batches if configured
        if (this.options.pauseBetweenBatchesMs && batchIndex < totalBatches - 1) {
          await sleep(this.options.pauseBetweenBatchesMs);
        }
      }
    } catch (_error) {
      this.logger.error('Batch processing error', error);
      throw error;
    }

    const duration = Date.now() - startTime;
    const finalProgress: BatchProgress = {
      processed: processedCount,
      total: totalItems,
      successful: successful.length,
      failed: failed.length,
      percentage: 100,
      currentBatch: totalBatches,
      totalBatches,
      elapsedMs: duration,
      estimatedTimeRemainingMs: 0
    };

    this.logger.info('Batch processing completed', {
      successful: successful.length,
      failed: failed.length,
      duration: `${duration}ms`
    });

    return {
      successful,
      failed,
      progress: finalProgress,
      duration
    };
  }

  /**
   * Process a batch with concurrency control
   */
  private async processBatchWithConcurrency<T, R>(
    items: T[],
    startIndex: number,
    processor: (item: T, index: number) => Promise<R>
  ): Promise<Array<BatchItemResult<T, R>>> {
    const concurrencyLimit = this.options.concurrencyLimit;
    const results: Array<BatchItemResult<T, R>> = [];
    const activePromises: Map<number, Promise<void>> = new Map();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const globalIndex = startIndex + i;

      // Wait if we've reached the concurrency limit
      while (activePromises.size >= concurrencyLimit) {
        await Promise.race(activePromises.values());
      }

      // Process item
      const promise = this.processItemWithRetry(item, globalIndex, processor)
        .then((result) => {
          results[i] = result;
          activePromises.delete(i);
        });

      activePromises.set(i, promise);
    }

    // Wait for all remaining promises
    await Promise.all(activePromises.values());

    return results;
  }

  /**
   * Process a single item with retry logic
   */
  private async processItemWithRetry<T, R>(
    item: T,
    index: number,
    processor: (item: T, index: number) => Promise<R>
  ): Promise<BatchItemResult<T, R>> {
    let lastError: Error | null = null;

    const retryAttempts = this.options.retryAttempts || 3;
    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const value = await processor(item, index);
        return {
          item,
          index,
          success: true,
          value,
          error: null
        };
      } catch (_error) {
        lastError = error as Error;
        
        this.logger.warn(`Processing failed for item ${index}, attempt ${attempt + 1}`, {
          error: error instanceof Error ? error.message : String(error)
        });

        // Call error handler if provided
        if (this.options.errorHandler) {
          await this.options.errorHandler(lastError, item, index);
        }

        // Retry with exponential backoff
        if (attempt < retryAttempts - 1) {
          const retryDelayMs = this.options.retryDelayMs || 1000;
          const delay = retryDelayMs * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }

    return {
      item,
      index,
      success: false,
      value: null,
      error: lastError || new Error('Unknown error during processing')
    };
  }

  /**
   * Abort batch processing
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.logger.info('Batch processing aborted');
    }
  }

  /**
   * Process items in parallel chunks
   */
  static async processInParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: Partial<BatchOptions> = {}
  ): Promise<R[]> {
    const defaultOptions: BatchOptions = {
      batchSize: 10,
      concurrencyLimit: 5,
      ...options
    };

    const batchProcessor = new BatchProcessor(defaultOptions);
    const result = await batchProcessor.process(items, (item, _index) => processor(item));
    
    if (result.failed.length > 0) {
      throw new Error(`Batch processing failed for ${result.failed.length} items`);
    }

    return result.successful;
  }

  /**
   * Map over items with batching
   */
  static async map<T, R>(
    items: T[],
    mapper: (item: T, index: number) => Promise<R>,
    options: Partial<BatchOptions> = {}
  ): Promise<R[]> {
    const defaultOptions: BatchOptions = {
      batchSize: 10,
      concurrencyLimit: 5,
      ...options
    };

    const batchProcessor = new BatchProcessor(defaultOptions);
    const result = await batchProcessor.process(items, mapper);
    
    return result.successful;
  }

  /**
   * Filter items with batching
   */
  static async filter<T>(
    items: T[],
    predicate: (item: T, index: number) => Promise<boolean>,
    options: Partial<BatchOptions> = {}
  ): Promise<T[]> {
    const defaultOptions: BatchOptions = {
      batchSize: 10,
      concurrencyLimit: 5,
      ...options
    };

    const batchProcessor = new BatchProcessor(defaultOptions);
    const result = await batchProcessor.process(items, async (item, index) => {
      const passed = await predicate(item, index);
      return { item, passed };
    });
    
    return result.successful
      .filter(({ passed }) => passed)
      .map(({ item }) => item);
  }
}

interface BatchItemResult<T, R> {
  item: T;
  index: number;
  success: boolean;
  value: R | null;
  error: Error | null;
}

// Export utility functions
export const processBatch = BatchProcessor.processInParallel;
export const batchMap = BatchProcessor.map;
export const batchFilter = BatchProcessor.filter;