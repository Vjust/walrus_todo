/**
 * TodoPublisher class for managing TODO data publishing to Walrus
 * Handles batch publishing, history tracking, and metadata management
 */

import { WalrusClient, WalrusStoreResponse, WalrusJsonMetadata, WalrusCostEstimate } from './walrus';
import { Todo } from '../todos/todo';
import { logger } from '../utils/logger';
import { WalrusError } from '../utils/errors';

/**
 * Publishing options for TODO data
 */
export interface TodoPublishOptions {
  includeStats?: boolean;
  estimateCost?: boolean;
  batchSize?: number;
  retryAttempts?: number;
  includeMetadata?: boolean;
  compression?: boolean;
}

/**
 * Publishing result with metadata
 */
export interface TodoPublishResult extends WalrusStoreResponse {
  metadata: WalrusJsonMetadata;
  todoCount: number;
  batchInfo?: {
    batchNumber: number;
    totalBatches: number;
    batchSize: number;
  };
}

/**
 * Publishing history entry
 */
export interface PublishHistoryEntry {
  id: string;
  timestamp: string;
  blobId: string;
  todoCount: number;
  size: number;
  cost: number;
  success: boolean;
  error?: string;
  metadata: WalrusJsonMetadata;
  batchInfo?: {
    batchNumber: number;
    totalBatches: number;
    batchSize: number;
  };
}

/**
 * Batch processing result
 */
export interface BatchPublishResult {
  results: TodoPublishResult[];
  totalCost: number;
  totalSize: number;
  successCount: number;
  failureCount: number;
  errors: string[];
}

/**
 * TodoPublisher class for managing TODO data publishing
 */
export class TodoPublisher {
  private walrusClient: WalrusClient;
  private publishHistory: PublishHistoryEntry[] = [];
  private defaultOptions: Required<TodoPublishOptions>;

  constructor(walrusClient: WalrusClient, defaultOptions?: Partial<TodoPublishOptions>) {
    this.walrusClient = walrusClient;
    this.defaultOptions = {
      includeStats: true,
      estimateCost: true,
      batchSize: 100,
      retryAttempts: 3,
      includeMetadata: true,
      compression: false,
      ...defaultOptions,
    };
  }

  /**
   * Prepare TODO data for Walrus storage
   */
  private prepareTodoData(
    todos: Todo[],
    options: Required<TodoPublishOptions>
  ): any {
    const payload: any = {
      todos,
      count: todos.length,
    };

    if (options.includeStats) {
      const now = new Date();
      const stats = {
        total: todos.length,
        pending: todos.filter(t => t.status === 'pending').length,
        done: todos.filter(t => t.status === 'done').length,
        priorities: {
          high: todos.filter(t => t.priority === 'high').length,
          medium: todos.filter(t => t.priority === 'medium').length,
          low: todos.filter(t => t.priority === 'low').length,
        },
        tags: this.extractTagStatistics(todos),
        overdue: todos.filter(t => 
          t.status === 'pending' && 
          t.dueDate && 
          new Date(t.dueDate) < now
        ).length,
        publishedAt: new Date().toISOString(),
      };
      payload.statistics = stats;
    }

    if (options.includeMetadata) {
      payload.exportInfo = {
        exportedAt: new Date().toISOString(),
        exportedBy: 'waltodo-publisher',
        version: '1.0.0',
        format: 'json',
        compression: options.compression,
      };
    }

    return payload;
  }

  /**
   * Extract tag statistics from todos
   */
  private extractTagStatistics(todos: Todo[]): { [tag: string]: number } {
    const tagCounts: { [tag: string]: number } = {};
    
    todos.forEach(todo => {
      if (todo.tags) {
        todo.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    return tagCounts;
  }

  /**
   * Create metadata for TODO publishing
   */
  private createMetadata(batchInfo?: { batchNumber: number; totalBatches: number }): WalrusJsonMetadata {
    const metadata: WalrusJsonMetadata = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      appName: 'waltodo',
      appVersion: '1.0.0',
      dataType: 'todos',
      schema: 'todo-v1',
    };

    if (batchInfo && batchInfo.totalBatches > 1) {
      metadata.dataType = 'todos-batch';
      metadata.schema = 'todo-batch-v1';
    }

    return metadata;
  }

  /**
   * Add entry to publishing history
   */
  private addToHistory(entry: Omit<PublishHistoryEntry, 'id' | 'timestamp'>): void {
    const historyEntry: PublishHistoryEntry = {
      id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.publishHistory.push(historyEntry);

    // Keep only last 100 entries
    if (this.publishHistory.length > 100) {
      this.publishHistory = this.publishHistory.slice(-100);
    }

    logger.debug('Added entry to publish history', { 
      entryId: historyEntry.id,
      success: historyEntry.success 
    });
  }

  /**
   * Estimate cost for publishing todos
   */
  async estimatePublishCost(todos: Todo[], options?: Partial<TodoPublishOptions>): Promise<WalrusCostEstimate> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const payload = this.prepareTodoData(todos, mergedOptions);
    const metadata = this.createMetadata();
    
    const wrappedData = {
      metadata,
      data: payload,
    };

    const jsonString = JSON.stringify(wrappedData, null, 2);
    const jsonBuffer = Buffer.from(jsonString, 'utf-8');

    return await this.walrusClient.estimateCost(jsonBuffer);
  }

  /**
   * Publish a single batch of TODOs
   */
  async publishSingle(
    todos: Todo[],
    options?: Partial<TodoPublishOptions>
  ): Promise<TodoPublishResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= mergedOptions.retryAttempts; attempt++) {
      try {
        logger.debug(`Publishing TODO batch (attempt ${attempt})`, { 
          todoCount: todos.length,
          attempt,
          maxAttempts: mergedOptions.retryAttempts
        });

        const payload = this.prepareTodoData(todos, mergedOptions);
        const metadata = this.createMetadata();

        // Estimate cost if requested
        if (mergedOptions.estimateCost) {
          const estimate = await this.estimatePublishCost(todos, mergedOptions);
          logger.info('Publishing cost estimate:', estimate);
          
          if (estimate.warning) {
            logger.warn('Publishing warning:', estimate.warning);
          }
        }

        // Publish to Walrus
        const result = await this.walrusClient.storeJson(payload, metadata, {
          estimateCost: false // Already estimated above
        });

        const publishResult: TodoPublishResult = {
          ...result,
          metadata,
          todoCount: todos.length,
        };

        // Add to history
        this.addToHistory({
          blobId: result.blobId,
          todoCount: todos.length,
          size: result.size,
          cost: result.cost,
          success: true,
          metadata,
        });

        logger.info('TODO batch published successfully', {
          blobId: result.blobId,
          todoCount: todos.length,
          size: result.size,
          cost: result.cost,
          attempt
        });

        return publishResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Publishing attempt ${attempt} failed:`, lastError.message);

        // Add failed attempt to history
        this.addToHistory({
          blobId: '',
          todoCount: todos.length,
          size: 0,
          cost: 0,
          success: false,
          error: lastError.message,
          metadata: this.createMetadata(),
        });

        if (attempt < mergedOptions.retryAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          logger.debug(`Waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new WalrusError(
      `Failed to publish TODO batch after ${mergedOptions.retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Publish TODOs with automatic batching for large datasets
   */
  async publishBatch(
    todos: Todo[],
    options?: Partial<TodoPublishOptions>
  ): Promise<BatchPublishResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    logger.debug('Starting batch TODO publishing', {
      totalTodos: todos.length,
      batchSize: mergedOptions.batchSize
    });

    if (todos.length === 0) {
      throw new WalrusError('No TODOs to publish');
    }

    // If data fits in a single batch, use single publish
    if (todos.length <= mergedOptions.batchSize) {
      try {
        const result = await this.publishSingle(todos, mergedOptions);
        return {
          results: [result],
          totalCost: result.cost,
          totalSize: result.size,
          successCount: 1,
          failureCount: 0,
          errors: [],
        };
      } catch (error) {
        return {
          results: [],
          totalCost: 0,
          totalSize: 0,
          successCount: 0,
          failureCount: 1,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        };
      }
    }

    // Split into batches
    const batches: Todo[][] = [];
    for (let i = 0; i < todos.length; i += mergedOptions.batchSize) {
      batches.push(todos.slice(i, i + mergedOptions.batchSize));
    }

    const results: TodoPublishResult[] = [];
    const errors: string[] = [];
    let totalCost = 0;
    let totalSize = 0;
    let successCount = 0;
    let failureCount = 0;

    logger.info(`Publishing ${todos.length} TODOs in ${batches.length} batches`);

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchInfo = {
        batchNumber: i + 1,
        totalBatches: batches.length,
        batchSize: batch.length,
      };

      try {
        logger.debug(`Processing batch ${batchInfo.batchNumber}/${batchInfo.totalBatches}`, {
          batchSize: batch.length
        });

        const payload = this.prepareTodoData(batch, mergedOptions);
        const metadata = this.createMetadata(batchInfo);

        const result = await this.walrusClient.storeJson(payload, metadata, {
          estimateCost: mergedOptions.estimateCost
        });

        const batchResult: TodoPublishResult = {
          ...result,
          metadata,
          todoCount: batch.length,
          batchInfo,
        };

        results.push(batchResult);
        totalCost += result.cost;
        totalSize += result.size;
        successCount++;

        // Add to history
        this.addToHistory({
          blobId: result.blobId,
          todoCount: batch.length,
          size: result.size,
          cost: result.cost,
          success: true,
          metadata,
          batchInfo,
        });

        logger.info(`Batch ${batchInfo.batchNumber}/${batchInfo.totalBatches} published successfully`, {
          blobId: result.blobId,
          batchSize: batch.length
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Batch ${batchInfo.batchNumber}: ${errorMessage}`);
        failureCount++;

        logger.error(`Batch ${batchInfo.batchNumber} failed:`, errorMessage);

        // Add failed batch to history
        this.addToHistory({
          blobId: '',
          todoCount: batch.length,
          size: 0,
          cost: 0,
          success: false,
          error: errorMessage,
          metadata: this.createMetadata(batchInfo),
          batchInfo,
        });
      }
    }

    const batchResult: BatchPublishResult = {
      results,
      totalCost,
      totalSize,
      successCount,
      failureCount,
      errors,
    };

    logger.info('Batch publishing completed', {
      totalBatches: batches.length,
      successCount,
      failureCount,
      totalCost,
      totalSize
    });

    return batchResult;
  }

  /**
   * Get publishing history
   */
  getPublishHistory(): PublishHistoryEntry[] {
    return [...this.publishHistory];
  }

  /**
   * Clear publishing history
   */
  clearPublishHistory(): void {
    this.publishHistory = [];
    logger.debug('Publishing history cleared');
  }

  /**
   * Get publishing statistics
   */
  getPublishStats(): {
    totalPublishes: number;
    successfulPublishes: number;
    failedPublishes: number;
    totalTodosPublished: number;
    totalCost: number;
    totalSize: number;
    averageCost: number;
    averageSize: number;
  } {
    const successful = this.publishHistory.filter(entry => entry.success);
    const failed = this.publishHistory.filter(entry => !entry.success);
    
    const totalTodosPublished = successful.reduce((sum, entry) => sum + entry.todoCount, 0);
    const totalCost = successful.reduce((sum, entry) => sum + entry.cost, 0);
    const totalSize = successful.reduce((sum, entry) => sum + entry.size, 0);

    return {
      totalPublishes: this.publishHistory.length,
      successfulPublishes: successful.length,
      failedPublishes: failed.length,
      totalTodosPublished,
      totalCost,
      totalSize,
      averageCost: successful.length > 0 ? totalCost / successful.length : 0,
      averageSize: successful.length > 0 ? totalSize / successful.length : 0,
    };
  }

  /**
   * Validate TODO data before publishing
   */
  validateTodosForPublishing(todos: Todo[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(todos)) {
      errors.push('TODOs must be provided as an array');
      return { isValid: false, errors };
    }

    if (todos.length === 0) {
      errors.push('Cannot publish empty TODO list');
      return { isValid: false, errors };
    }

    // Validate each TODO
    todos.forEach((todo, index) => {
      if (!todo.id) {
        errors.push(`TODO at index ${index} is missing required field: id`);
      }
      if (!todo.description || todo.description.trim().length === 0) {
        errors.push(`TODO at index ${index} is missing required field: description`);
      }
      if (!todo.status || !['pending', 'done'].includes(todo.status)) {
        errors.push(`TODO at index ${index} has invalid status: ${todo.status}`);
      }
      if (!todo.priority || !['low', 'medium', 'high'].includes(todo.priority)) {
        errors.push(`TODO at index ${index} has invalid priority: ${todo.priority}`);
      }
      if (!todo.createdAt) {
        errors.push(`TODO at index ${index} is missing required field: createdAt`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}