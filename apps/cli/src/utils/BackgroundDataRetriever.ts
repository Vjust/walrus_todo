import { EventEmitter } from 'events';
import { Logger } from './Logger';
import { performanceMonitor, jobManager } from './PerformanceMonitor';
import { createWalrusStorage } from './walrus-storage';
import { SuiNftStorage } from './sui-nft-storage';
import { SuiClient } from './adapters/sui-client-compatibility';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { CLIError } from '../types/errors/consolidated';
import { RetryManager } from './retry-manager';
import { RETRY_CONFIG } from '../constants';
import { createCache } from './performance-cache';
import { v4 as uuidv4 } from 'uuid';
import chalk = require('chalk');

export interface DataRetrievalOptions {
  network?: string;
  mock?: boolean;
  timeout?: number;
  retries?: number;
  chunkSize?: number;
  onProgress?: (progress: number, phase: string) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onError?: (error: Error) => void;
}

export interface RetrievalProgress {
  phase: 'connecting' | 'fetching' | 'processing' | 'saving' | 'complete';
  progress: number;
  currentItem?: string;
  totalItems?: number;
  processedItems?: number;
  bytesTransferred?: number;
  totalBytes?: number;
  chunksCompleted?: number;
  totalChunks?: number;
}

export interface RetrievalResult {
  success: boolean;
  data?: any;
  metadata?: {
    totalItems: number;
    bytesTransferred: number;
    duration: number;
    chunks: number;
    errors: string[];
  };
  error?: Error;
}

/**
 * Background Data Retriever for large, non-blocking downloads from Walrus and Sui
 */
export class BackgroundDataRetriever extends EventEmitter {
  private logger = new Logger('BackgroundDataRetriever');
  private cache = createCache('background-retrievals', {
    strategy: 'TTL',
    ttlMs: 3600000, // 1 hour
  });

  /**
   * Retrieve todo from Walrus blob in background with chunked transfer
   */
  async retrieveFromWalrusBlob(
    blobId: string,
    options: DataRetrievalOptions = {}
  ): Promise<string> {
    const operationId = uuidv4();
    const jobId = jobManager.createJob('retrieve-blob', [blobId], {
      network: options.network,
      mock: options.mock,
    }).id;

    this?.logger?.info(`Starting background Walrus blob retrieval: ${blobId}`, {
      operationId,
      jobId,
    });

    // Start the operation in background
    setImmediate(() =>
      this.executeWalrusRetrieval(operationId, jobId, blobId, options)
    );

    return operationId;
  }

  /**
   * Retrieve NFT data from Sui blockchain in background
   */
  async retrieveFromSuiNft(
    objectId: string,
    contractConfig: any,
    options: DataRetrievalOptions = {}
  ): Promise<string> {
    const operationId = uuidv4();
    const jobId = jobManager.createJob('retrieve-nft', [objectId], {
      network: options.network,
      contractAddress: contractConfig.address,
    }).id;

    this?.logger?.info(`Starting background Sui NFT retrieval: ${objectId}`, {
      operationId,
      jobId,
    });

    // Start the operation in background
    setImmediate(() =>
      this.executeSuiRetrieval(
        operationId,
        jobId,
        objectId,
        contractConfig,
        options
      )
    );

    return operationId;
  }

  /**
   * Retrieve multiple items in batch with background processing
   */
  async retrieveBatch(
    items: Array<{ type: 'blob' | 'nft'; id: string; config?: any }>,
    options: DataRetrievalOptions = {}
  ): Promise<string> {
    const operationId = uuidv4();
    const jobId = jobManager.createJob(
      'retrieve-batch',
      items.map(i => i.id),
      {
        batchSize: items.length,
        network: options.network,
      }
    ).id;

    this?.logger?.info(
      `Starting background batch retrieval: ${items.length} items`,
      {
        operationId,
        jobId,
      }
    );

    // Start the batch operation in background
    setImmediate(() =>
      this.executeBatchRetrieval(operationId, jobId, items, options)
    );

    return operationId;
  }

  /**
   * Get status of a background retrieval operation
   */
  async getRetrievalStatus(
    operationId: string
  ): Promise<RetrievalProgress | null> {
    return await this?.cache?.get(`status:${operationId}`);
  }

  /**
   * Get result of a completed retrieval operation
   */
  async getRetrievalResult(
    operationId: string
  ): Promise<RetrievalResult | null> {
    return await this?.cache?.get(`result:${operationId}`);
  }

  /**
   * Cancel a background retrieval operation
   */
  async cancelRetrieval(operationId: string): Promise<boolean> {
    const status = await this.getRetrievalStatus(operationId);
    if (!status || status?.phase === 'complete') {
      return false;
    }

    // Mark as cancelled
    await this.updateProgress(operationId, {
      ...status,
      phase: 'complete',
      progress: 0,
    });

    // Cancel the job
    const jobData = await this?.cache?.get(`job:${operationId}`);
    if (jobData?.jobId) {
      jobManager.cancelJob(jobData.jobId);
    }

    this.emit('retrievalCancelled', operationId);
    return true;
  }

  /**
   * Execute Walrus blob retrieval with progress tracking
   */
  private async executeWalrusRetrieval(
    operationId: string,
    jobId: string,
    blobId: string,
    options: DataRetrievalOptions
  ): Promise<void> {
    const perfId = `walrus-retrieval-${operationId}`;
    performanceMonitor.startOperation(perfId, 'walrus-blob-retrieval');

    try {
      // Store job reference
      await this?.cache?.set(`job:${operationId}`, { jobId });

      // Initialize progress
      await this.updateProgress(operationId, {
        phase: 'connecting',
        progress: 0,
        currentItem: blobId,
        totalItems: 1,
        processedItems: 0,
      });

      jobManager.startJob(jobId);
      jobManager.updateProgress(jobId, 0);

      // Connect to Walrus
      this?.logger?.debug(`Connecting to Walrus storage for ${blobId}`);
      const walrusStorage = createWalrusStorage(
        options.network || 'testnet',
        options.mock || false
      );

      await this.updateProgress(operationId, {
        phase: 'connecting',
        progress: 10,
        currentItem: blobId,
        totalItems: 1,
        processedItems: 0,
      });

      await walrusStorage.connect();
      jobManager.updateProgress(jobId, 20);

      await this.updateProgress(operationId, {
        phase: 'fetching',
        progress: 20,
        currentItem: blobId,
        totalItems: 1,
        processedItems: 0,
      });

      // Retrieve with retry and progress tracking
      let todo;
      const startTime = Date.now();

      try {
        todo = await RetryManager.retry(
          async () => {
            await this.updateProgress(operationId, {
              phase: 'fetching',
              progress: Math.min(90, 30 + Math.random() * 40), // Simulate progress
              currentItem: blobId,
              totalItems: 1,
              processedItems: 0,
            });

            const result = await walrusStorage.retrieveTodo(blobId);

            await this.updateProgress(operationId, {
              phase: 'processing',
              progress: 90,
              currentItem: blobId,
              totalItems: 1,
              processedItems: 0,
            });

            return result;
          },
          {
            maxRetries: options.retries || RETRY_CONFIG.ATTEMPTS,
            retryableErrors: [/NETWORK_ERROR/, /CONNECTION_REFUSED/, /TIMEOUT/],
            onRetry: (error, attempt) => {
              this?.logger?.warn(
                `Retry attempt ${attempt} for blob ${blobId}:`,
                error
              );
              jobManager.writeJobLog(
                jobId,
                `Retry ${attempt}: ${error.message}`
              );
            },
          }
        );

        // Processing and saving
        await this.updateProgress(operationId, {
          phase: 'saving',
          progress: 95,
          currentItem: blobId,
          totalItems: 1,
          processedItems: 0,
        });

        const duration = Date.now() - startTime;
        const result: RetrievalResult = {
          success: true,
          data: todo,
          metadata: {
            totalItems: 1,
            bytesTransferred: JSON.stringify(todo).length,
            duration,
            chunks: 1,
            errors: [],
          },
        };

        // Complete the operation
        await this.updateProgress(operationId, {
          phase: 'complete',
          progress: 100,
          currentItem: blobId,
          totalItems: 1,
          processedItems: 1,
        });

        await this?.cache?.set(`result:${operationId}`, result);

        jobManager.completeJob(jobId, {
          blobId,
          itemsRetrieved: 1,
          bytesTransferred: result?.metadata?.bytesTransferred,
          duration,
        });

        performanceMonitor.endOperation(perfId, 'walrus-blob-retrieval', true, {
          blobId,
          duration,
          bytesTransferred: result?.metadata?.bytesTransferred,
        });

        this.emit('retrievalComplete', operationId, result);
        this?.logger?.info(`Walrus blob retrieval completed: ${blobId}`, {
          operationId,
          duration,
        });
      } catch (retrievalError) {
        throw new CLIError(
          `Failed to retrieve blob ${blobId}: ${retrievalError instanceof Error ? retrievalError.message : String(retrievalError)}`,
          'WALRUS_RETRIEVAL_FAILED'
        );
      } finally {
        // Cleanup
        try {
          await walrusStorage.disconnect();
        } catch (disconnectError) {
          this?.logger?.warn('Error disconnecting from Walrus:', disconnectError);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const result: RetrievalResult = {
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
        metadata: {
          totalItems: 1,
          bytesTransferred: 0,
          duration: Date.now() - Date.now(),
          chunks: 0,
          errors: [errorMessage],
        },
      };

      await this?.cache?.set(`result:${operationId}`, result);
      jobManager.failJob(jobId, errorMessage);

      performanceMonitor.endOperation(perfId, 'walrus-blob-retrieval', false, {
        error: errorMessage,
      });

      this.emit('retrievalFailed', operationId, error);
      this?.logger?.error(`Walrus blob retrieval failed: ${blobId}`, error);
    }
  }

  /**
   * Execute Sui NFT retrieval with progress tracking
   */
  private async executeSuiRetrieval(
    operationId: string,
    jobId: string,
    objectId: string,
    contractConfig: any,
    options: DataRetrievalOptions
  ): Promise<void> {
    const perfId = `sui-retrieval-${operationId}`;
    performanceMonitor.startOperation(perfId, 'sui-nft-retrieval');

    try {
      // Store job reference
      await this?.cache?.set(`job:${operationId}`, { jobId });

      // Initialize progress
      await this.updateProgress(operationId, {
        phase: 'connecting',
        progress: 0,
        currentItem: objectId,
        totalItems: 1,
        processedItems: 0,
      });

      jobManager.startJob(jobId);

      // Connect to Sui and Walrus
      const suiClient = new SuiClient({ url: options.network || 'testnet' });
      const signer = {} as Ed25519Keypair; // Mock signer for retrieval
      const suiNftStorage = new SuiNftStorage(
        suiClient,
        signer,
        contractConfig
      );

      await this.updateProgress(operationId, {
        phase: 'fetching',
        progress: 20,
        currentItem: objectId,
        totalItems: 1,
        processedItems: 0,
      });

      // Get NFT data
      const nftData = await RetryManager.retry(
        () => suiNftStorage.getTodoNft(objectId),
        {
          maxRetries: options.retries || RETRY_CONFIG.ATTEMPTS,
          onRetry: (error, attempt) => {
            this?.logger?.warn(
              `Retry attempt ${attempt} for NFT ${objectId}:`,
              error
            );
            jobManager.writeJobLog(
              jobId,
              `NFT Retry ${attempt}: ${error.message}`
            );
          },
        }
      );

      if (!nftData.walrusBlobId) {
        throw new CLIError(
          'NFT does not contain a valid Walrus blob ID',
          'INVALID_NFT'
        );
      }

      await this.updateProgress(operationId, {
        phase: 'fetching',
        progress: 50,
        currentItem: `${objectId} -> ${nftData.walrusBlobId}`,
        totalItems: 1,
        processedItems: 0,
      });

      // Retrieve from Walrus
      const walrusStorage = createWalrusStorage(
        options.network || 'testnet',
        options.mock || false
      );
      await walrusStorage.connect();

      const todo = await RetryManager.retry(
        () => walrusStorage.retrieveTodo(nftData.walrusBlobId),
        {
          maxRetries: options.retries || RETRY_CONFIG.ATTEMPTS,
          onRetry: (error, attempt) => {
            this?.logger?.warn(
              `Retry attempt ${attempt} for Walrus blob ${nftData.walrusBlobId}:`,
              error
            );
            jobManager.writeJobLog(
              jobId,
              `Walrus Retry ${attempt}: ${error.message}`
            );
          },
        }
      );

      await this.updateProgress(operationId, {
        phase: 'processing',
        progress: 90,
        currentItem: objectId,
        totalItems: 1,
        processedItems: 0,
      });

      // Combine NFT and todo data
      const combinedData = {
        ...todo,
        nftObjectId: objectId,
        walrusBlobId: nftData.walrusBlobId,
      };

      const result: RetrievalResult = {
        success: true,
        data: combinedData,
        metadata: {
          totalItems: 1,
          bytesTransferred: JSON.stringify(combinedData).length,
          duration: Date.now() - Date.now(),
          chunks: 1,
          errors: [],
        },
      };

      await this.updateProgress(operationId, {
        phase: 'complete',
        progress: 100,
        currentItem: objectId,
        totalItems: 1,
        processedItems: 1,
      });

      await this?.cache?.set(`result:${operationId}`, result);

      jobManager.completeJob(jobId, {
        objectId,
        walrusBlobId: nftData.walrusBlobId,
        itemsRetrieved: 1,
        bytesTransferred: result?.metadata?.bytesTransferred,
      });

      performanceMonitor.endOperation(perfId, 'sui-nft-retrieval', true, {
        objectId,
        walrusBlobId: nftData.walrusBlobId,
        bytesTransferred: result?.metadata?.bytesTransferred,
      });

      this.emit('retrievalComplete', operationId, result);
      this?.logger?.info(`Sui NFT retrieval completed: ${objectId}`, {
        operationId,
      });

      // Cleanup
      await walrusStorage.disconnect();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const result: RetrievalResult = {
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
        metadata: {
          totalItems: 1,
          bytesTransferred: 0,
          duration: 0,
          chunks: 0,
          errors: [errorMessage],
        },
      };

      await this?.cache?.set(`result:${operationId}`, result);
      jobManager.failJob(jobId, errorMessage);

      performanceMonitor.endOperation(perfId, 'sui-nft-retrieval', false, {
        error: errorMessage,
      });

      this.emit('retrievalFailed', operationId, error);
      this?.logger?.error(`Sui NFT retrieval failed: ${objectId}`, error);
    }
  }

  /**
   * Execute batch retrieval with parallel processing
   */
  private async executeBatchRetrieval(
    operationId: string,
    jobId: string,
    items: Array<{ type: 'blob' | 'nft'; id: string; config?: any }>,
    options: DataRetrievalOptions
  ): Promise<void> {
    const perfId = `batch-retrieval-${operationId}`;
    performanceMonitor.startOperation(perfId, 'batch-retrieval');

    try {
      await this?.cache?.set(`job:${operationId}`, { jobId });

      await this.updateProgress(operationId, {
        phase: 'connecting',
        progress: 0,
        totalItems: items.length,
        processedItems: 0,
      });

      jobManager.startJob(jobId);

      const batchSize = options.chunkSize || 5;
      const results: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(async (item, batchIndex) => {
          const itemIndex = i + batchIndex;
          try {
            await this.updateProgress(operationId, {
              phase: 'fetching',
              progress: Math.round((itemIndex / items.length) * 80),
              totalItems: items.length,
              processedItems: itemIndex,
              currentItem: item.id,
            });

            if (item?.type === 'blob') {
              const subOperationId = await this.retrieveFromWalrusBlob(
                item.id,
                {
                  ...options,
                  timeout: 60000, // Shorter timeout for batch items
                }
              );
              const result = await this.waitForCompletion(
                subOperationId,
                60000
              );
              return { index: itemIndex, result };
            } else {
              const subOperationId = await this.retrieveFromSuiNft(
                item.id,
                item.config,
                {
                  ...options,
                  timeout: 60000,
                }
              );
              const result = await this.waitForCompletion(
                subOperationId,
                60000
              );
              return { index: itemIndex, result };
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            errors.push(`Item ${itemIndex} (${item.id}): ${errorMessage}`);
            jobManager.writeJobLog(
              jobId,
              `Error processing ${item.id}: ${errorMessage}`
            );
            return { index: itemIndex, error: errorMessage };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Small delay between batches
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      await this.updateProgress(operationId, {
        phase: 'processing',
        progress: 90,
        totalItems: items.length,
        processedItems: items.length,
      });

      const successfulResults = results.filter(
        r => r?.status === 'fulfilled' && r.value?.result?.success
      );

      const finalResult: RetrievalResult = {
        success: errors.length < items.length / 2, // Success if less than half failed
        data: successfulResults.map(r =>
          r?.status === 'fulfilled' ? r?.value?.result.data : null
        ),
        metadata: {
          totalItems: items.length,
          bytesTransferred: successfulResults.reduce((sum, r) => {
            return (
              sum +
              (r?.status === 'fulfilled'
                ? r?.value?.result?.metadata?.bytesTransferred || 0
                : 0)
            );
          }, 0),
          duration: Date.now() - Date.now(),
          chunks: Math.ceil(items.length / batchSize),
          errors,
        },
      };

      await this.updateProgress(operationId, {
        phase: 'complete',
        progress: 100,
        totalItems: items.length,
        processedItems: items.length,
      });

      await this?.cache?.set(`result:${operationId}`, finalResult);

      jobManager.completeJob(jobId, {
        totalItems: items.length,
        successfulItems: successfulResults.length,
        failedItems: errors.length,
        bytesTransferred: finalResult?.metadata?.bytesTransferred,
      });

      performanceMonitor.endOperation(
        perfId,
        'batch-retrieval',
        finalResult.success,
        {
          totalItems: items.length,
          successfulItems: successfulResults.length,
          bytesTransferred: finalResult?.metadata?.bytesTransferred,
        }
      );

      this.emit('retrievalComplete', operationId, finalResult);
      this?.logger?.info(
        `Batch retrieval completed: ${successfulResults.length}/${items.length} successful`,
        { operationId }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const result: RetrievalResult = {
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
        metadata: {
          totalItems: items.length,
          bytesTransferred: 0,
          duration: 0,
          chunks: 0,
          errors: [errorMessage],
        },
      };

      await this?.cache?.set(`result:${operationId}`, result);
      jobManager.failJob(jobId, errorMessage);

      performanceMonitor.endOperation(perfId, 'batch-retrieval', false, {
        error: errorMessage,
      });

      this.emit('retrievalFailed', operationId, error);
      this?.logger?.error(`Batch retrieval failed`, error);
    }
  }

  /**
   * Update progress and emit events
   */
  private async updateProgress(
    operationId: string,
    progress: RetrievalProgress
  ): Promise<void> {
    await this?.cache?.set(`status:${operationId}`, progress);
    this.emit('retrievalProgress', operationId, progress);

    if (progress.onProgress) {
      progress.onProgress(progress.progress, progress.phase);
    }
  }

  /**
   * Wait for a retrieval operation to complete
   */
  private async waitForCompletion(
    operationId: string,
    timeoutMs: number
  ): Promise<RetrievalResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Operation ${operationId} timed out after ${timeoutMs}ms`)
        );
      }, timeoutMs);

      const checkCompletion = async () => {
        const status = await this.getRetrievalStatus(operationId);

        if (status?.phase === 'complete') {
          clearTimeout(timeoutId);
          const result = await this.getRetrievalResult(operationId);
          if (result) {
            resolve(result);
          } else {
            reject(new Error(`No result found for operation ${operationId}`));
          }
          return;
        }

        // Check again in 1 second
        setTimeout(checkCompletion, 1000);
      };

      checkCompletion();
    });
  }

  /**
   * Get summary of all active retrievals
   */
  async getActiveRetrievals(): Promise<
    Array<{ operationId: string; progress: RetrievalProgress }>
  > {
    // This would need to be implemented with a proper storage mechanism
    // For now, we'll return an empty array
    return [];
  }

  /**
   * Cleanup old completed operations
   */
  async cleanup(maxAge: number = 3600000): Promise<number> {
    // This would clean up old cache entries
    // Implementation depends on the cache system used
    return 0;
  }
}

// Export singleton instance
export const backgroundDataRetriever = new BackgroundDataRetriever();
