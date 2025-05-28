import { Worker } from 'worker_threads';
import { ChildProcess, spawn, fork } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { Logger } from './Logger';
import { PerformanceCache, createCache } from './performance-cache';

export interface BackgroundCacheConfig {
  maxConcurrentProcesses: number;
  processTimeout: number;
  enableWorkerThreads: boolean;
  cacheDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface CacheOperation {
  id: string;
  type:
    | 'upload'
    | 'blob-cache'
    | 'storage-allocation'
    | 'batch-process'
    | 'sync'
    | 'continuous-sync'
    | 'ai-summarize'
    | 'ai-categorize'
    | 'ai-prioritize'
    | 'ai-suggest'
    | 'ai-analyze';
  data: any;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
}

export interface OperationProcessor {
  processor: (
    operation: CacheOperation,
    updateProgress: (progress: number, stage?: string) => void
  ) => Promise<any>;
}

export interface ProcessStatus {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  progress: number;
  stage?: string;
  startTime: number;
  endTime?: number;
  error?: string;
  result?: any;
  pid?: number;
}

/**
 * Background Cache Manager that spawns cache operations as background processes
 * without blocking the terminal. Supports both worker threads and child processes.
 */
export class BackgroundCacheManager extends EventEmitter {
  private readonly logger = Logger.getInstance();
  private readonly config: BackgroundCacheConfig;
  private readonly activeProcesses = new Map<string, ChildProcess | Worker>();
  private readonly processStatus = new Map<string, ProcessStatus>();
  private readonly operationQueue: CacheOperation[] = [];
  private readonly statusCache: PerformanceCache<ProcessStatus>;
  private readonly resultCache: PerformanceCache<any>;
  private readonly operationProcessors = new Map<string, OperationProcessor>();
  private isShuttingDown = false;
  private processCleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<BackgroundCacheConfig> = {}) {
    super();

    this.config = {
      maxConcurrentProcesses: 3,
      processTimeout: 300000, // 5 minutes
      enableWorkerThreads: true,
      cacheDir: path.join(process.cwd(), '.waltodo-cache', 'background'),
      logLevel: 'info',
      ...config,
    };

    // Initialize caches
    this.statusCache = createCache<ProcessStatus>('process-status', {
      strategy: 'LRU',
      maxSize: 100,
      persistenceDir: path.join(this.config.cacheDir, 'status'),
    });

    this.resultCache = createCache<any>('process-results', {
      strategy: 'TTL',
      ttlMs: 3600000, // 1 hour
      persistenceDir: path.join(this.config.cacheDir, 'results'),
    });

    this.setupCleanupTimer();
    this.setupProcessExitHandlers();
  }

  /**
   * Queue a cache operation to run in the background
   */
  async queueOperation(
    operation: CacheOperation,
    options?: OperationProcessor
  ): Promise<string> {
    this.logger.info(`Queuing background operation: ${operation.type}`, {
      id: operation.id,
      priority: operation.priority,
    });

    // Initialize status
    const status: ProcessStatus = {
      id: operation.id,
      type: operation.type,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
    };

    this.processStatus.set(operation.id, status);
    await this.statusCache.set(operation.id, status);

    // Store custom processor if provided
    if (options?.processor) {
      this.operationProcessors.set(operation.id, options);
    }

    // Add to queue based on priority
    if (operation.priority === 'high') {
      this.operationQueue.unshift(operation);
    } else {
      this.operationQueue.push(operation);
    }

    // Process queue
    setImmediate(() => this.processQueue());

    this.emit('operationQueued', operation.id, operation.type);
    return operation.id;
  }

  /**
   * Get status of a background operation
   */
  async getOperationStatus(operationId: string): Promise<ProcessStatus | null> {
    // Check memory first
    let status = this.processStatus.get(operationId);

    // Fall back to cache
    if (!status) {
      status = await this.statusCache.get(operationId);
    }

    return status || null;
  }

  /**
   * Get result of a completed operation
   */
  async getOperationResult(operationId: string): Promise<any> {
    const status = await this.getOperationStatus(operationId);

    if (!status || status.status !== 'completed') {
      return null;
    }

    // Check if result is in memory
    if (status.result) {
      return status.result;
    }

    // Check cache
    return await this.resultCache.get(operationId);
  }

  /**
   * Cancel a pending or running operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const process = this.activeProcesses.get(operationId);

    if (process) {
      if ('terminate' in process) {
        // Worker thread
        await process.terminate();
      } else {
        // Child process
        process.kill('SIGTERM');
      }

      this.activeProcesses.delete(operationId);

      // Update status
      const status = this.processStatus.get(operationId);
      if (status) {
        status.status = 'failed';
        status.error = 'Operation cancelled';
        status.endTime = Date.now();
        await this.statusCache.set(operationId, status);
      }

      this.emit('operationCancelled', operationId);
      return true;
    }

    // Remove from queue if pending
    const queueIndex = this.operationQueue.findIndex(
      op => op.id === operationId
    );
    if (queueIndex >= 0) {
      this.operationQueue.splice(queueIndex, 1);

      const status = this.processStatus.get(operationId);
      if (status) {
        status.status = 'failed';
        status.error = 'Operation cancelled before execution';
        status.endTime = Date.now();
        await this.statusCache.set(operationId, status);
      }

      this.emit('operationCancelled', operationId);
      return true;
    }

    return false;
  }

  /**
   * Get list of all active operations
   */
  getActiveOperations(): ProcessStatus[] {
    return Array.from(this.processStatus.values()).filter(
      status => status.status === 'running' || status.status === 'pending'
    );
  }

  /**
   * Wait for an operation to complete
   */
  async waitForOperation(
    operationId: string,
    timeoutMs: number = 60000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Operation ${operationId} timeout after ${timeoutMs}ms`)
        );
      }, timeoutMs);

      const checkStatus = async () => {
        const status = await this.getOperationStatus(operationId);

        if (!status) {
          clearTimeout(timeoutId);
          reject(new Error(`Operation ${operationId} not found`));
          return;
        }

        if (status.status === 'completed') {
          clearTimeout(timeoutId);
          const result = await this.getOperationResult(operationId);
          resolve(result);
        } else if (status.status === 'failed') {
          clearTimeout(timeoutId);
          reject(new Error(status.error || 'Operation failed'));
        } else {
          // Check again in 1 second
          setTimeout(checkStatus, 1000);
        }
      };

      checkStatus();
    });
  }

  /**
   * Process the operation queue
   */
  private async processQueue(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    // Check if we can start new processes
    if (this.activeProcesses.size >= this.config.maxConcurrentProcesses) {
      return;
    }

    // Get next operation from queue
    const operation = this.operationQueue.shift();
    if (!operation) {
      return;
    }

    try {
      await this.executeOperation(operation);
    } catch (error) {
      this.logger.error(`Failed to execute operation ${operation.id}`, error);
      await this.markOperationFailed(operation.id, error);
    }

    // Continue processing queue
    setImmediate(() => this.processQueue());
  }

  /**
   * Execute a cache operation in the background
   */
  private async executeOperation(operation: CacheOperation): Promise<void> {
    const status = this.processStatus.get(operation.id);
    if (!status) {
      throw new Error(`Status not found for operation ${operation.id}`);
    }

    // Check if we have a custom processor for this operation
    const customProcessor = this.operationProcessors.get(operation.id);
    if (customProcessor?.processor) {
      return this.executeCustomProcessor(
        operation,
        status,
        customProcessor.processor
      );
    }

    // Update status to running
    status.status = 'running';
    status.startTime = Date.now();
    await this.statusCache.set(operation.id, status);

    this.logger.info(`Starting background operation: ${operation.type}`, {
      id: operation.id,
    });

    try {
      let process: ChildProcess | Worker;

      if (this.config.enableWorkerThreads && operation.type !== 'upload') {
        // Use worker threads for CPU-intensive operations
        process = await this.createWorkerProcess(operation);
      } else {
        // Use child processes for I/O operations like uploads
        process = await this.createChildProcess(operation);
      }

      this.activeProcesses.set(operation.id, process);
      status.pid = 'pid' in process ? process.pid : undefined;

      // Set timeout
      const timeoutMs = operation.timeout || this.config.processTimeout;
      const timeoutId = setTimeout(async () => {
        await this.timeoutOperation(operation.id);
      }, timeoutMs);

      // Handle process completion
      const handleCompletion = async (result?: any, error?: Error) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(operation.id);

        if (error) {
          await this.markOperationFailed(operation.id, error);
        } else {
          await this.markOperationCompleted(operation.id, result);
        }
      };

      if ('on' in process) {
        // Worker thread
        process.on('message', result => handleCompletion(result));
        process.on('error', error => handleCompletion(undefined, error));
        process.on('exit', code => {
          if (code !== 0) {
            handleCompletion(
              undefined,
              new Error(`Worker exited with code ${code}`)
            );
          }
        });
      } else {
        // Child process
        process.on('message', (message: any) => {
          if (message.type === 'result') {
            handleCompletion(message.data);
          } else if (message.type === 'progress') {
            this.updateOperationProgress(operation.id, message.progress);
          } else if (message.type === 'error') {
            handleCompletion(undefined, new Error(message.error));
          }
        });

        process.on('error', error => handleCompletion(undefined, error));
        process.on('exit', code => {
          if (code !== 0) {
            handleCompletion(
              undefined,
              new Error(`Process exited with code ${code}`)
            );
          }
        });
      }
    } catch (error) {
      await this.markOperationFailed(operation.id, error);
    }
  }

  /**
   * Execute a custom processor function directly in the current process
   */
  private async executeCustomProcessor(
    operation: CacheOperation,
    status: ProcessStatus,
    processor: (
      operation: CacheOperation,
      updateProgress: (progress: number, stage?: string) => void
    ) => Promise<any>
  ): Promise<void> {
    // Update status to running
    status.status = 'running';
    status.startTime = Date.now();
    await this.statusCache.set(operation.id, status);

    this.logger.info(
      `Starting custom processor for operation: ${operation.type}`,
      {
        id: operation.id,
      }
    );

    try {
      // Create progress update function
      const updateProgress = async (progress: number, stage?: string) => {
        status.progress = progress;
        status.stage = stage;
        this.processStatus.set(operation.id, status);
        await this.statusCache.set(operation.id, status);
        this.emit('operationProgress', operation.id, progress, stage);
      };

      // Execute the custom processor
      const result = await processor(operation, updateProgress);

      // Mark as completed
      await this.markOperationCompleted(operation.id, result);
    } catch (error) {
      this.logger.error(
        `Custom processor failed for operation ${operation.id}`,
        error
      );
      await this.markOperationFailed(operation.id, error);
    } finally {
      // Clean up the processor reference
      this.operationProcessors.delete(operation.id);
    }
  }

  /**
   * Create a worker thread for CPU-intensive operations
   */
  private async createWorkerProcess(
    operation: CacheOperation
  ): Promise<Worker> {
    const workerScript = path.join(__dirname, 'background-cache-worker.js');

    // Ensure worker script exists
    await this.ensureWorkerScript();

    const worker = new Worker(workerScript, {
      workerData: {
        operation,
        config: this.config,
      },
    });

    return worker;
  }

  /**
   * Create a child process for I/O operations
   */
  private async createChildProcess(
    operation: CacheOperation
  ): Promise<ChildProcess> {
    const processScript = path.join(__dirname, 'background-cache-process.js');

    // Ensure process script exists
    await this.ensureProcessScript();

    const child = fork(processScript, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        BACKGROUND_CACHE_OPERATION: JSON.stringify(operation),
        BACKGROUND_CACHE_CONFIG: JSON.stringify(this.config),
      },
    });

    return child;
  }

  /**
   * Update operation progress
   */
  private async updateOperationProgress(
    operationId: string,
    progress: number
  ): Promise<void> {
    const status = this.processStatus.get(operationId);
    if (status) {
      status.progress = Math.min(100, Math.max(0, progress));
      await this.statusCache.set(operationId, status);
      this.emit('operationProgress', operationId, progress);
    }
  }

  /**
   * Mark operation as completed
   */
  private async markOperationCompleted(
    operationId: string,
    result: any
  ): Promise<void> {
    const status = this.processStatus.get(operationId);
    if (status) {
      status.status = 'completed';
      status.progress = 100;
      status.endTime = Date.now();
      status.result = result;

      await this.statusCache.set(operationId, status);
      await this.resultCache.set(operationId, result);

      this.emit('operationCompleted', operationId, result);

      this.logger.info(`Background operation completed: ${status.type}`, {
        id: operationId,
        duration: status.endTime - status.startTime,
      });
    }
  }

  /**
   * Mark operation as failed
   */
  private async markOperationFailed(
    operationId: string,
    error: any
  ): Promise<void> {
    const status = this.processStatus.get(operationId);
    if (status) {
      status.status = 'failed';
      status.endTime = Date.now();
      status.error = error instanceof Error ? error.message : String(error);

      await this.statusCache.set(operationId, status);

      this.emit('operationFailed', operationId, error);

      this.logger.error(`Background operation failed: ${status.type}`, {
        id: operationId,
        error: status.error,
        duration: status.endTime - status.startTime,
      });
    }
  }

  /**
   * Handle operation timeout
   */
  private async timeoutOperation(operationId: string): Promise<void> {
    const process = this.activeProcesses.get(operationId);
    if (process) {
      if ('terminate' in process) {
        await process.terminate();
      } else {
        process.kill('SIGKILL');
      }
      this.activeProcesses.delete(operationId);
    }

    const status = this.processStatus.get(operationId);
    if (status) {
      status.status = 'timeout';
      status.endTime = Date.now();
      status.error = 'Operation timeout';

      await this.statusCache.set(operationId, status);
      this.emit('operationTimeout', operationId);

      this.logger.warn(`Background operation timeout: ${status.type}`, {
        id: operationId,
      });
    }
  }

  /**
   * Setup cleanup timer to remove old completed operations
   */
  private setupCleanupTimer(): void {
    this.processCleanupTimer = setInterval(async () => {
      await this.cleanupOldOperations();
    }, 600000); // Run every 10 minutes
  }

  /**
   * Clean up old completed operations
   */
  private async cleanupOldOperations(): Promise<void> {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    for (const [id, status] of this.processStatus.entries()) {
      if (
        (status.status === 'completed' ||
          status.status === 'failed' ||
          status.status === 'timeout') &&
        status.endTime &&
        status.endTime < cutoffTime
      ) {
        this.processStatus.delete(id);
        // Keep cache entries for longer persistence
      }
    }
  }

  /**
   * Setup process exit handlers for graceful cleanup
   */
  private setupProcessExitHandlers(): void {
    const cleanup = async () => {
      await this.shutdown();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }

  /**
   * Ensure worker script exists
   */
  private async ensureWorkerScript(): Promise<void> {
    const workerScript = path.join(__dirname, 'background-cache-worker.js');

    if (!existsSync(workerScript)) {
      const workerCode = this.generateWorkerScript();
      await fs.writeFile(workerScript, workerCode, 'utf8');
    }
  }

  /**
   * Ensure process script exists
   */
  private async ensureProcessScript(): Promise<void> {
    const processScript = path.join(__dirname, 'background-cache-process.js');

    if (!existsSync(processScript)) {
      const processCode = this.generateProcessScript();
      await fs.writeFile(processScript, processCode, 'utf8');
    }
  }

  /**
   * Generate worker script for CPU-intensive operations
   */
  private generateWorkerScript(): string {
    return `
const { parentPort, workerData } = require('worker_threads');
const { createCache } = require('./performance-cache');

async function processOperation(operation, config) {
  try {
    let result;
    
    switch (operation.type) {
      case 'blob-cache':
        result = await processBlobCache(operation.data);
        break;
      case 'storage-allocation':
        result = await processStorageAllocation(operation.data);
        break;
      case 'batch-process':
        result = await processBatchOperation(operation.data);
        break;
      case 'sync':
        result = await processSyncOperation(operation.data);
        break;
      case 'continuous-sync':
        result = await processContinuousSyncOperation(operation.data);
        break;
      default:
        throw new Error(\`Unknown operation type: \${operation.type}\`);
    }
    
    parentPort.postMessage(result);
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
}

async function processBlobCache(data) {
  // Implement blob caching logic
  const cache = createCache('blob-ids', { strategy: 'LRU', maxSize: 1000 });
  
  for (const item of data.items) {
    await cache.set(item.key, item.value);
  }
  
  return { cached: data.items.length };
}

async function processStorageAllocation(data) {
  // Implement storage allocation logic
  return { allocated: data.size };
}

async function processBatchOperation(data) {
  // Implement batch processing logic
  return { processed: data.items.length };
}

async function processSyncOperation(data) {
  // Implement sync operation logic
  const { TodoService } = require('../services/todoService');
  const { createWalrusStorage } = require('./walrus-storage');
  
  const todoService = new TodoService();
  const walrusStorage = createWalrusStorage(data.network || 'testnet', false);
  await walrusStorage.connect();
  
  let syncedCount = 0;
  let failedCount = 0;
  
  try {
    for (const todo of data.todos) {
      try {
        if (data.direction === 'push' || data.direction === 'both') {
          if (todo.walrusBlobId) {
            await walrusStorage.updateTodo(todo.walrusBlobId, todo);
          }
        }
        
        if (data.direction === 'pull' || data.direction === 'both') {
          if (todo.walrusBlobId) {
            const blockchainTodo = await walrusStorage.retrieveTodo(todo.walrusBlobId);
            await todoService.updateTodo(data.listName || 'default', todo.id, blockchainTodo);
          }
        }
        
        syncedCount++;
      } catch (error) {
        failedCount++;
      }
    }
  } finally {
    await walrusStorage.disconnect();
  }
  
  return { synced: syncedCount, failed: failedCount, total: data.todos.length };
}

async function processContinuousSyncOperation(data) {
  // Implement continuous sync logic (daemon-like behavior)
  const { TodoService } = require('../services/todoService');
  const { createWalrusStorage } = require('./walrus-storage');
  
  const todoService = new TodoService();
  const walrusStorage = createWalrusStorage('testnet', false);
  
  let isRunning = true;
  let cycles = 0;
  let totalSynced = 0;
  
  // Set up graceful shutdown
  process.on('SIGTERM', () => {
    isRunning = false;
  });
  
  while (isRunning) {
    try {
      await walrusStorage.connect();
      
      // Get all lists with 'both' storage todos
      const lists = await todoService.getAllLists();
      let cycleSynced = 0;
      
      for (const listName of lists) {
        const list = await todoService.getList(listName);
        if (list) {
          const bothStorageTodos = list.todos.filter(t => t.storageLocation === 'both');
          
          for (const todo of bothStorageTodos) {
            try {
              // Perform sync based on direction and resolve strategy
              if (data.direction === 'push' || data.direction === 'both') {
                if (todo.walrusBlobId) {
                  await walrusStorage.updateTodo(todo.walrusBlobId, todo);
                }
              }
              
              if (data.direction === 'pull' || data.direction === 'both') {
                if (todo.walrusBlobId) {
                  const blockchainTodo = await walrusStorage.retrieveTodo(todo.walrusBlobId);
                  await todoService.updateTodo(listName, todo.id, blockchainTodo);
                }
              }
              
              cycleSynced++;
              totalSynced++;
            } catch (error) {
              // Log error but continue
              console.error(\`Sync error for todo \${todo.id}:\`, error.message);
            }
          }
        }
      }
      
      await walrusStorage.disconnect();
      cycles++;
      
      // Report progress
      parentPort.postMessage({
        type: 'progress',
        data: {
          cycles,
          totalSynced,
          cycleSynced,
          timestamp: Date.now()
        }
      });
      
      // Wait for next interval
      if (isRunning) {
        await new Promise(resolve => setTimeout(resolve, data.interval || 300000));
      }
      
    } catch (error) {
      console.error('Continuous sync cycle error:', error.message);
      await new Promise(resolve => setTimeout(resolve, Math.min(data.interval || 300000, 60000)));
    }
  }
  
  return { cycles, totalSynced, stopped: true };
}

processOperation(workerData.operation, workerData.config);
`;
  }

  /**
   * Generate process script for I/O operations
   */
  private generateProcessScript(): string {
    return `
const operation = JSON.parse(process.env.BACKGROUND_CACHE_OPERATION);
const config = JSON.parse(process.env.BACKGROUND_CACHE_CONFIG);

async function processOperation() {
  try {
    let result;
    
    switch (operation.type) {
      case 'upload':
        result = await processUpload(operation.data);
        break;
      case 'sync':
        result = await processSync(operation.data);
        break;
      case 'continuous-sync':
        result = await processContinuousSync(operation.data);
        break;
      default:
        throw new Error(\`Unknown operation type: \${operation.type}\`);
    }
    
    process.send({ type: 'result', data: result });
  } catch (error) {
    process.send({ type: 'error', error: error.message });
  }
}

async function processUpload(data) {
  // Implement upload logic
  const { createWalrusStorage } = require('./walrus-storage');
  
  const storage = createWalrusStorage(data.network || 'testnet', false);
  await storage.connect();
  
  const results = [];
  
  for (let i = 0; i < data.todos.length; i++) {
    const todo = data.todos[i];
    
    // Report progress
    const progress = Math.round((i / data.todos.length) * 100);
    process.send({ type: 'progress', progress });
    
    try {
      const blobId = await storage.storeTodo(todo, data.epochs || 5);
      results.push({ id: todo.id, blobId, success: true });
    } catch (error) {
      results.push({ id: todo.id, error: error.message, success: false });
    }
  }
  
  await storage.disconnect();
  return { uploads: results };
}

async function processSync(data) {
  // Implement sync operation logic for child process
  const { TodoService } = require('../services/todoService');
  const { createWalrusStorage } = require('./walrus-storage');
  
  const todoService = new TodoService();
  const walrusStorage = createWalrusStorage(data.network || 'testnet', false);
  await walrusStorage.connect();
  
  let syncedCount = 0;
  let failedCount = 0;
  const total = data.todos.length;
  
  try {
    for (let i = 0; i < data.todos.length; i++) {
      const todo = data.todos[i];
      
      // Report progress
      const progress = Math.round((i / total) * 100);
      process.send({ type: 'progress', progress });
      
      try {
        if (data.direction === 'push' || data.direction === 'both') {
          if (todo.walrusBlobId) {
            await walrusStorage.updateTodo(todo.walrusBlobId, todo);
          }
        }
        
        if (data.direction === 'pull' || data.direction === 'both') {
          if (todo.walrusBlobId) {
            const blockchainTodo = await walrusStorage.retrieveTodo(todo.walrusBlobId);
            await todoService.updateTodo(data.listName || 'default', todo.id, blockchainTodo);
          }
        }
        
        syncedCount++;
      } catch (error) {
        failedCount++;
        console.error(\`Sync error for todo \${todo.id}:\`, error.message);
      }
    }
  } finally {
    await walrusStorage.disconnect();
  }
  
  return { synced: syncedCount, failed: failedCount, total };
}

async function processContinuousSync(data) {
  // Implement continuous sync logic for child process
  const { TodoService } = require('../services/todoService');
  const { createWalrusStorage } = require('./walrus-storage');
  
  const todoService = new TodoService();
  const walrusStorage = createWalrusStorage('testnet', false);
  
  let isRunning = true;
  let cycles = 0;
  let totalSynced = 0;
  
  // Set up graceful shutdown
  process.on('SIGTERM', () => {
    isRunning = false;
    process.send({ type: 'result', data: { cycles, totalSynced, stopped: true } });
  });
  
  process.send({ type: 'progress', progress: 0 });
  
  while (isRunning) {
    try {
      await walrusStorage.connect();
      
      // Get all lists with 'both' storage todos
      const lists = await todoService.getAllLists();
      let cycleSynced = 0;
      
      for (const listName of lists) {
        if (!isRunning) break;
        
        const list = await todoService.getList(listName);
        if (list) {
          const bothStorageTodos = list.todos.filter(t => t.storageLocation === 'both');
          
          for (const todo of bothStorageTodos) {
            if (!isRunning) break;
            
            try {
              // Perform sync based on direction and resolve strategy
              if (data.direction === 'push' || data.direction === 'both') {
                if (todo.walrusBlobId) {
                  await walrusStorage.updateTodo(todo.walrusBlobId, todo);
                }
              }
              
              if (data.direction === 'pull' || data.direction === 'both') {
                if (todo.walrusBlobId) {
                  const blockchainTodo = await walrusStorage.retrieveTodo(todo.walrusBlobId);
                  await todoService.updateTodo(listName, todo.id, blockchainTodo);
                }
              }
              
              cycleSynced++;
              totalSynced++;
            } catch (error) {
              // Log error but continue
              console.error(\`Sync error for todo \${todo.id}:\`, error.message);
            }
          }
        }
      }
      
      await walrusStorage.disconnect();
      cycles++;
      
      // Report progress with cycle information
      process.send({
        type: 'progress',
        progress: Math.min(100, (cycles * 10) % 100), // Cycling progress indicator
        data: {
          cycles,
          totalSynced,
          cycleSynced,
          timestamp: Date.now()
        }
      });
      
      // Wait for next interval
      if (isRunning) {
        await new Promise(resolve => setTimeout(resolve, data.interval || 300000));
      }
      
    } catch (error) {
      console.error('Continuous sync cycle error:', error.message);
      process.send({ type: 'error', error: error.message });
      
      // Wait before retrying, but not as long as normal interval
      if (isRunning) {
        await new Promise(resolve => setTimeout(resolve, Math.min(data.interval || 300000, 60000)));
      }
    }
  }
  
  return { cycles, totalSynced, stopped: true };
}

processOperation();
`;
  }

  /**
   * Shutdown the background cache manager gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down background cache manager...');

    // Clear cleanup timer
    if (this.processCleanupTimer) {
      clearInterval(this.processCleanupTimer);
    }

    // Terminate all active processes
    const shutdownPromises: Promise<void>[] = [];

    for (const [id, process] of this.activeProcesses.entries()) {
      shutdownPromises.push(
        new Promise<void>(resolve => {
          const timeout = setTimeout(() => {
            if ('terminate' in process) {
              process.terminate();
            } else {
              process.kill('SIGKILL');
            }
            resolve();
          }, 5000); // 5 second grace period

          if ('terminate' in process) {
            process.terminate().then(() => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            process.kill('SIGTERM');
            process.on('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          }
        })
      );
    }

    await Promise.all(shutdownPromises);
    this.activeProcesses.clear();

    // Shutdown caches
    await Promise.all([
      this.statusCache.shutdown(),
      this.resultCache.shutdown(),
    ]);

    this.logger.info('Background cache manager shutdown complete');
  }
}

// Factory function for creating background cache manager
export function createBackgroundCacheManager(
  config?: Partial<BackgroundCacheConfig>
): BackgroundCacheManager {
  return new BackgroundCacheManager(config);
}

// Global instance for singleton usage
let globalBackgroundCacheManager: BackgroundCacheManager | null = null;

export function getGlobalBackgroundCacheManager(): BackgroundCacheManager {
  if (!globalBackgroundCacheManager) {
    globalBackgroundCacheManager = createBackgroundCacheManager();
  }
  return globalBackgroundCacheManager;
}
