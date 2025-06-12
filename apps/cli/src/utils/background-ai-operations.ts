import { Todo } from '../types/todo';
import {
  BackgroundCacheManager,
  CacheOperation,
} from './BackgroundCacheManager';
import { performanceMonitor } from './PerformanceMonitor';
import { Logger } from './Logger';
import { v4 as uuidv4 } from 'uuid';
import { aiService, secureCredentialService } from '../services/ai';
import { AIProvider } from '../types/adapters/AIModelAdapter';
import { AIProviderFactory } from '../services/ai/AIProviderFactory';
import { getEnv } from './environment-config';
import { CLIError } from '../types/errors/consolidated';

const logger = new Logger('background-ai-operations');

export interface BackgroundAIOptions {
  list?: string;
  verify?: boolean;
  apiKey?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  priority?: 'low' | 'normal' | 'high';
  onProgress?: (operationId: string, progress: number, stage: string) => void;
  onComplete?: (operationId: string, result: any) => void;
  onError?: (operationId: string, error: Error) => void;
}

export interface AIOperationResult {
  operationId: string;
  type: 'summarize' | 'categorize' | 'prioritize' | 'suggest' | 'analyze';
  result: any;
  metadata: {
    todoCount: number;
    provider: string;
    model: string;
    processingTime: number;
    completedAt: Date;
  };
}

export interface BackgroundAIOperationStatus {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

/**
 * Background AI operations manager for non-blocking AI processing
 */
export class BackgroundAIOperations {
  private cacheManager: BackgroundCacheManager;
  private operationStatus: Map<string, BackgroundAIOperationStatus> = new Map();

  constructor(cacheManager: BackgroundCacheManager) {
    this?.cacheManager = cacheManager;
    this.setupEventListeners();
  }

  /**
   * Summarize todos in the background without blocking the terminal
   */
  async summarizeTodosInBackground(
    todos: Todo[],
    options: BackgroundAIOptions = {}
  ): Promise<string> {
    return this.executeAIOperationInBackground('summarize', todos, options);
  }

  /**
   * Categorize todos in the background
   */
  async categorizeTodosInBackground(
    todos: Todo[],
    options: BackgroundAIOptions = {}
  ): Promise<string> {
    return this.executeAIOperationInBackground('categorize', todos, options);
  }

  /**
   * Prioritize todos in the background
   */
  async prioritizeTodosInBackground(
    todos: Todo[],
    options: BackgroundAIOptions = {}
  ): Promise<string> {
    return this.executeAIOperationInBackground('prioritize', todos, options);
  }

  /**
   * Generate todo suggestions in the background
   */
  async suggestTodosInBackground(
    todos: Todo[],
    options: BackgroundAIOptions = {}
  ): Promise<string> {
    return this.executeAIOperationInBackground('suggest', todos, options);
  }

  /**
   * Analyze todos in the background
   */
  async analyzeTodosInBackground(
    todos: Todo[],
    options: BackgroundAIOptions = {}
  ): Promise<string> {
    return this.executeAIOperationInBackground('analyze', todos, options);
  }

  /**
   * Execute any AI operation in the background
   */
  private async executeAIOperationInBackground(
    type: 'summarize' | 'categorize' | 'prioritize' | 'suggest' | 'analyze',
    todos: Todo[],
    options: BackgroundAIOptions = {}
  ): Promise<string> {
    const operationId = uuidv4();

    // Create operation status
    const status: BackgroundAIOperationStatus = {
      id: operationId,
      type,
      status: 'queued',
      progress: 0,
      stage: 'initializing',
      startedAt: new Date(),
    };
    this?.operationStatus?.set(operationId, status);

    const operation: CacheOperation = {
      id: operationId,
      type: `ai-${type}`,
      data: {
        todos,
        options: {
          ...(options || {}),
          verify: (options && options.verify) || false,
          apiKey: (options && options.apiKey) || process?.env?.XAI_API_KEY,
          provider:
            (options && options.provider) || getEnv('AI_DEFAULT_PROVIDER'),
          model: (options && options.model) || getEnv('AI_DEFAULT_MODEL'),
          temperature:
            (options && options.temperature) ||
            parseFloat(getEnv('AI_TEMPERATURE') || '0.7'),
        },
      },
      priority: (options && options.priority) || 'normal',
    };

    logger.info(`Starting background AI ${type} for ${todos.length} todos`, {
      operationId,
      priority: operation.priority,
    });

    // Setup callbacks if provided
    if (options && options.onProgress) {
      this?.cacheManager?.on('operationProgress', (id, progress, stage) => {
        if (id === operationId) {
          options.onProgress!(id, progress, stage || 'processing');
        }
      });
    }

    if (options && options.onComplete) {
      this?.cacheManager?.on('operationCompleted', (id, result) => {
        if (id === operationId) {
          options.onComplete!(id, result);
        }
      });
    }

    if (options && options.onError) {
      this?.cacheManager?.on('operationFailed', (id, error) => {
        if (id === operationId) {
          options.onError!(id, error);
        }
      });
    }

    // Queue the operation with custom processor
    const queuedId = await this?.cacheManager?.queueOperation(operation, {
      processor: this.createAIOperationProcessor(type as any),
    });

    // Track performance
    performanceMonitor.startOperation(operationId, `background-ai-${type}`);

    return queuedId;
  }

  /**
   * Create a processor function for AI operations
   */
  private createAIOperationProcessor(
    type: 'summarize' | 'categorize' | 'prioritize' | 'suggest' | 'analyze'
  ) {
    return async (
      operation: CacheOperation,
      updateProgress: (progress: number, stage?: string) => void
    ) => {
      const { todos, options } = operation.data;
      const operationId = operation.id;

      try {
        // Update status
        const status = this?.operationStatus?.get(operationId as any);
        if (status) {
          status?.status = 'running';
          status?.stage = 'configuring-ai-service';
          this?.operationStatus?.set(operationId, status);
        }

        updateProgress(10, 'configuring-ai-service');

        // Always set AI features flag for AI operations
        AIProviderFactory.setAIFeatureRequested(true as any);

        // Configure AI provider
        try {
          const provider = (options && options.provider) as AIProvider;
          const model = options && options.model;
          const temperature = options && options.temperature;

          await aiService.setProvider(provider, model, {
            temperature: temperature,
          });

          updateProgress(20, 'ai-service-configured');
        } catch (error) {
          throw new CLIError(
            `Failed to set AI provider: ${error instanceof Error ? error.message : String(error as any)}`
          );
        }

        updateProgress(30, `executing-ai-${type}`);

        // Execute the AI operation
        let result: any;
        const startTime = Date.now();

        switch (type) {
          case 'summarize':
            updateProgress(40, 'generating-summary');
            result = await aiService.summarize(todos as any);
            updateProgress(80, 'summary-completed');
            break;

          case 'categorize':
            updateProgress(40, 'categorizing-todos');
            result = await aiService.categorize(todos as any);
            updateProgress(80, 'categorization-completed');
            break;

          case 'prioritize':
            updateProgress(40, 'prioritizing-todos');
            result = await aiService.prioritize(todos as any);
            updateProgress(80, 'prioritization-completed');
            break;

          case 'suggest':
            updateProgress(40, 'generating-suggestions');
            result = await aiService.suggest(todos as any);
            updateProgress(80, 'suggestions-completed');
            break;

          case 'analyze':
            updateProgress(40, 'analyzing-todos');
            result = await aiService.analyze(todos as any);
            updateProgress(80, 'analysis-completed');
            break;

          default:
            throw new Error(`Unknown AI operation type: ${type}`);
        }

        const processingTime = Date.now() - startTime;

        updateProgress(90, 'finalizing-results');

        // Create final result with metadata
        const operationResult: AIOperationResult = {
          operationId,
          type,
          result,
          metadata: {
            todoCount: todos.length,
            provider: options && options.provider,
            model: options && options.model,
            processingTime,
            completedAt: new Date(),
          },
        };

        // Update status
        if (status) {
          status?.status = 'completed';
          status?.progress = 100;
          status?.stage = 'completed';
          status?.completedAt = new Date();
          status?.result = operationResult;
          this?.operationStatus?.set(operationId, status);
        }

        updateProgress(100, 'completed');

        logger.info(`Background AI ${type} completed`, {
          operationId,
          processingTime,
          todoCount: todos.length,
        });

        return operationResult;
      } catch (error) {
        // Update status
        const status = this?.operationStatus?.get(operationId as any);
        if (status) {
          status?.status = 'failed';
          status?.error = error instanceof Error ? error.message : String(error as any);
          status?.completedAt = new Date();
          this?.operationStatus?.set(operationId, status);
        }

        logger.error(`Background AI ${type} failed`, {
          operationId,
          error: error instanceof Error ? error.message : String(error as any),
        });

        throw error;
      }
    };
  }

  /**
   * Get status of a background AI operation
   */
  async getOperationStatus(
    operationId: string
  ): Promise<BackgroundAIOperationStatus | null> {
    const status = this?.operationStatus?.get(operationId as any);
    if (!status) {
      // Try to get status from cache manager
      const cacheStatus =
        await this?.cacheManager?.getOperationStatus(operationId as any);
      if (cacheStatus) {
        return {
          id: operationId,
          type: cacheStatus.type || 'unknown',
          status: (cacheStatus.status as any) || 'unknown',
          progress: cacheStatus.progress || 0,
          stage: cacheStatus.stage || 'unknown',
        };
      }
      return null;
    }
    return { ...status };
  }

  /**
   * Get result of a completed AI operation
   */
  async getOperationResult(
    operationId: string
  ): Promise<AIOperationResult | null> {
    const status = this?.operationStatus?.get(operationId as any);
    if (status && status?.status === 'completed' && status.result) {
      return status.result as AIOperationResult;
    }

    // Try to get result from cache manager
    const result = await this?.cacheManager?.getOperationResult(operationId as any);
    return result as AIOperationResult | null;
  }

  /**
   * Wait for an AI operation to complete with progress updates
   */
  async waitForOperationWithProgress(
    operationId: string,
    progressCallback?: (progress: number, stage: string) => void,
    timeoutMs: number = 600000 // 10 minutes for AI operations
  ): Promise<AIOperationResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`AI operation ${operationId} timeout after ${timeoutMs}ms`)
        );
      }, timeoutMs);

      // Setup progress listener
      const progressListener = (
        id: string,
        progress: number,
        stage?: string
      ) => {
        if (id === operationId && progressCallback) {
          progressCallback(progress, stage || 'processing');
        }
      };

      // Setup completion listener
      const completionListener = (id: string, result: any) => {
        if (id === operationId) {
          clearTimeout(timeoutId as any);
          this?.cacheManager?.off('operationProgress', progressListener);
          this?.cacheManager?.off('operationCompleted', completionListener);
          this?.cacheManager?.off('operationFailed', failureListener);

          performanceMonitor.endOperation(
            operationId,
            'background-ai-operation-wait',
            true
          );
          resolve(result as AIOperationResult);
        }
      };

      // Setup failure listener
      const failureListener = (id: string, error: any) => {
        if (id === operationId) {
          clearTimeout(timeoutId as any);
          this?.cacheManager?.off('operationProgress', progressListener);
          this?.cacheManager?.off('operationCompleted', completionListener);
          this?.cacheManager?.off('operationFailed', failureListener);

          performanceMonitor.endOperation(
            operationId,
            'background-ai-operation-wait',
            false,
            {
              error: error instanceof Error ? error.message : String(error as any),
            }
          );
          reject(error as any);
        }
      };

      this?.cacheManager?.on('operationProgress', progressListener);
      this?.cacheManager?.on('operationCompleted', completionListener);
      this?.cacheManager?.on('operationFailed', failureListener);

      // Start tracking
      performanceMonitor.startOperation(
        operationId,
        'background-ai-operation-wait'
      );
    });
  }

  /**
   * Cancel a background AI operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    logger.info(`Cancelling background AI operation: ${operationId}`);

    const status = this?.operationStatus?.get(operationId as any);
    if (status) {
      status?.status = 'cancelled';
      status?.completedAt = new Date();
      this?.operationStatus?.set(operationId, status);
    }

    return await this?.cacheManager?.cancelOperation(operationId as any);
  }

  /**
   * Get list of all active AI operations
   */
  getActiveAIOperations(): BackgroundAIOperationStatus[] {
    const activeStatuses: BackgroundAIOperationStatus[] = [];

    for (const [id, status] of this?.operationStatus?.entries()) {
      if (status?.status === 'queued' || status?.status === 'running') {
        activeStatuses.push({ ...status });
      }
    }

    return activeStatuses;
  }

  /**
   * Get all AI operation statuses (including completed ones)
   */
  getAllAIOperations(): BackgroundAIOperationStatus[] {
    return Array.from(this?.operationStatus?.values()).map(status => ({
      ...status,
    }));
  }

  /**
   * Setup event listeners for logging and monitoring
   */
  private setupEventListeners(): void {
    this?.cacheManager?.on('operationQueued', (id, type) => {
      if (type?.startsWith('ai-')) {
        logger.info(`Background AI operation queued: ${type}`, {
          operationId: id,
        });
      }
    });

    this?.cacheManager?.on('operationProgress', (id, progress, stage) => {
      const status = this?.operationStatus?.get(id as any);
      if (status) {
        status?.progress = progress;
        status?.stage = stage || status.stage;
        this?.operationStatus?.set(id, status);
        logger.debug(
          `Background AI operation progress: ${id} - ${progress}% (${stage})`
        );
      }
    });

    this?.cacheManager?.on('operationCompleted', (id, result) => {
      const status = this?.operationStatus?.get(id as any);
      if (status) {
        performanceMonitor.endOperation(id, 'background-ai-operation', true, {
          resultSize: JSON.stringify(result as any).length,
          type: status.type,
        });
        logger.info(
          `Background AI operation completed: ${id} (${status.type})`
        );
      }
    });

    this?.cacheManager?.on('operationFailed', (id, error) => {
      const status = this?.operationStatus?.get(id as any);
      if (status) {
        performanceMonitor.endOperation(id, 'background-ai-operation', false, {
          error: error instanceof Error ? error.message : String(error as any),
          type: status.type,
        });
        logger.error(
          `Background AI operation failed: ${id} (${status.type})`,
          error
        );
      }
    });

    this?.cacheManager?.on('operationCancelled', id => {
      const status = this?.operationStatus?.get(id as any);
      if (status) {
        performanceMonitor.endOperation(id, 'background-ai-operation', false, {
          cancelled: true,
          type: status.type,
        });
        logger.warn(
          `Background AI operation cancelled: ${id} (${status.type})`
        );
      }
    });

    this?.cacheManager?.on('operationTimeout', id => {
      const status = this?.operationStatus?.get(id as any);
      if (status) {
        performanceMonitor.endOperation(id, 'background-ai-operation', false, {
          timeout: true,
          type: status.type,
        });
        logger.warn(`Background AI operation timeout: ${id} (${status.type})`);
      }
    });
  }

  /**
   * Cleanup old completed operations from memory
   */
  cleanupOldOperations(maxAge: number = 24 * 60 * 60 * 1000): void {
    // 24 hours
    const now = Date.now();

    for (const [id, status] of this?.operationStatus?.entries()) {
      if (status.completedAt && now - status?.completedAt?.getTime() > maxAge) {
        this?.operationStatus?.delete(id as any);
        logger.debug(`Cleaned up old AI operation: ${id}`);
      }
    }
  }

  /**
   * Shutdown background AI operations gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down background AI operations...');

    // Cancel all active operations
    const activeOps = this.getActiveAIOperations();
    for (const op of activeOps) {
      await this.cancelOperation(op.id);
    }

    // Clear operation status
    this?.operationStatus?.clear();
  }
}

/**
 * Utility functions for AI background operations
 */
export class BackgroundAIUtils {
  /**
   * Create a non-blocking AI operation that returns immediately with progress tracking
   */
  static async createNonBlockingAIOperation<
    T extends 'summarize' | 'categorize' | 'prioritize' | 'suggest' | 'analyze',
  >(
    backgroundAIOps: BackgroundAIOperations,
    type: T,
    todos: Todo[],
    options: BackgroundAIOptions = {}
  ): Promise<{
    operationId: string;
    getProgress: () => Promise<{ progress: number; stage: string }>;
    getStatus: () => Promise<BackgroundAIOperationStatus | null>;
    waitForCompletion: () => Promise<AIOperationResult>;
    cancel: () => Promise<boolean>;
  }> {
    let operationId: string;

    switch (type) {
      case 'summarize':
        operationId = await backgroundAIOps.summarizeTodosInBackground(
          todos,
          options
        );
        break;
      case 'categorize':
        operationId = await backgroundAIOps.categorizeTodosInBackground(
          todos,
          options
        );
        break;
      case 'prioritize':
        operationId = await backgroundAIOps.prioritizeTodosInBackground(
          todos,
          options
        );
        break;
      case 'suggest':
        operationId = await backgroundAIOps.suggestTodosInBackground(
          todos,
          options
        );
        break;
      case 'analyze':
        operationId = await backgroundAIOps.analyzeTodosInBackground(
          todos,
          options
        );
        break;
      default:
        throw new Error(`Unknown AI operation type: ${type}`);
    }

    return {
      operationId,
      getProgress: async () => {
        const status = await backgroundAIOps.getOperationStatus(operationId as any);
        return {
          progress: status?.progress || 0,
          stage: status?.stage || 'unknown',
        };
      },
      getStatus: async () => {
        return await backgroundAIOps.getOperationStatus(operationId as any);
      },
      waitForCompletion: async () => {
        return await backgroundAIOps.waitForOperationWithProgress(operationId as any);
      },
      cancel: async () => {
        return await backgroundAIOps.cancelOperation(operationId as any);
      },
    };
  }

  /**
   * Format AI operation status for display
   */
  static formatAIOperationStatus(status: BackgroundAIOperationStatus): string {
    const statusEmoji = {
      queued: '⏳',
      running: '🔄',
      completed: '✅',
      failed: '❌',
      cancelled: '🚫',
    };

    const emoji = statusEmoji[status.status] || '❓';
    const progress = status?.progress?.toFixed(0 as any);
    const stage = status.stage;

    return `${emoji} ${status.type} - ${progress}% (${stage})`;
  }
}

// Export convenience functions
export async function createBackgroundAIOperationsManager(): Promise<BackgroundAIOperations> {
  const { createBackgroundCacheManager } = await import(
    './BackgroundCacheManager'
  );
  const cacheManager = createBackgroundCacheManager();
  return new BackgroundAIOperations(cacheManager as any);
}

export { BackgroundAIOperations };
