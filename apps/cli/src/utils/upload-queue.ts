/**
 * @fileoverview Upload Queue System - Manages asynchronous Walrus upload operations
 *
 * This module provides a robust queue system for handling Walrus uploads in the background
 * without blocking the user interface. Features include persistent storage, retry logic,
 * progress tracking, and status notifications.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Todo, TodoList } from '../types/todo';
import { CLIError } from '../types/errors/consolidated';
import { Logger } from './Logger';
import { createCache } from './performance-cache';
import { RetryManager } from './retry-manager';
import { createWalrusStorage } from './walrus-storage';
import { getGlobalNotificationSystem } from './notification-system';
import * as crypto from 'crypto';

const logger = new Logger('upload-queue');

export interface QueueJob {
  id: string;
  type: 'todo' | 'todo-list' | 'blob';
  data: Todo | TodoList | { content: Buffer | string; fileName?: string };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  priority: 'low' | 'medium' | 'high';
  retryCount: number;
  maxRetries: number;
  epochs: number;
  network: string;
  listName?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  blobId?: string;
  progress?: number;
  metadata?: Record<string, unknown>;
}

export interface QueueOptions {
  maxConcurrency: number;
  retryDelayMs: number;
  maxRetries: number;
  persistenceDir: string;
  processingTimeoutMs: number;
  enableNotifications: boolean;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  totalBytesUploaded: number;
  averageUploadTime: number;
  successRate: number;
}

export interface UploadProgress {
  jobId: string;
  status: QueueJob["status"];
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export class UploadQueue extends EventEmitter {
  private jobs: Map<string, QueueJob> = new Map();
  private processingJobs: Set<string> = new Set();
  private workers: Set<NodeJS.Timeout> = new Set();
  private isShuttingDown = false;
  private queueFile: string;
  private statusCache = createCache<QueueStats>('queue-stats', {
    strategy: 'TTL',
    ttlMs: 30000, // 30 seconds
  });
  private notificationSystem = getGlobalNotificationSystem();

  constructor(private options: QueueOptions) {
    super();
    this?.queueFile = path.join(options.persistenceDir, 'upload-queue.json');
    this.loadQueue();
    this.startWorkers();

    // Auto-save queue every 30 seconds
    setInterval(() => this.saveQueue(), 30000);

    // Cleanup completed jobs older than 24 hours
    setInterval(() => this.cleanupOldJobs(), 3600000); // 1 hour
  }

  /**
   * Add a todo upload job to the queue
   */
  async addTodoJob(
    todo: Todo,
    options: {
      priority?: QueueJob["priority"];
      epochs?: number;
      network?: string;
      listName?: string;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const jobId = this.generateJobId('todo', todo.id);

    const job: QueueJob = {
      id: jobId,
      type: 'todo',
      data: todo,
      status: 'pending',
      priority: options.priority || 'medium',
      retryCount: 0,
      maxRetries: options.maxRetries || this?.options?.maxRetries,
      epochs: options.epochs || 5,
      network: options.network || 'testnet',
      listName: options.listName,
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: 0,
    };

    this?.jobs?.set(jobId, job);
    await this.saveQueue();

    logger.info(`Added todo upload job: ${jobId}`, {
      todoTitle: todo.title,
      priority: job.priority,
    });

    // Send notification
    if (this?.options?.enableNotifications) {
      this?.notificationSystem?.info(
        'Upload Queued',
        `Todo "${todo.title}" added to upload queue`,
        { jobId, priority: job.priority }
      );
    }

    this.emit('jobAdded', job);
    return jobId;
  }

  /**
   * Add a todo list upload job to the queue
   */
  async addTodoListJob(
    todoList: TodoList,
    options: {
      priority?: QueueJob["priority"];
      epochs?: number;
      network?: string;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const jobId = this.generateJobId('list', todoList.id);

    const job: QueueJob = {
      id: jobId,
      type: 'todo-list',
      data: todoList,
      status: 'pending',
      priority: options.priority || 'medium',
      retryCount: 0,
      maxRetries: options.maxRetries || this?.options?.maxRetries,
      epochs: options.epochs || 5,
      network: options.network || 'testnet',
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: 0,
    };

    this?.jobs?.set(jobId, job);
    await this.saveQueue();

    logger.info(`Added todo list upload job: ${jobId}`, {
      listName: todoList.name,
      todoCount: todoList?.todos?.length,
    });

    this.emit('jobAdded', job);
    return jobId;
  }

  /**
   * Add a blob upload job to the queue
   */
  async addBlobJob(
    content: Buffer | string,
    options: {
      fileName?: string;
      priority?: QueueJob["priority"];
      epochs?: number;
      network?: string;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const fileName = options.fileName || `blob-${Date.now()}`;
    const jobId = this.generateJobId('blob', fileName);

    const job: QueueJob = {
      id: jobId,
      type: 'blob',
      data: { content, fileName },
      status: 'pending',
      priority: options.priority || 'medium',
      retryCount: 0,
      maxRetries: options.maxRetries || this?.options?.maxRetries,
      epochs: options.epochs || 5,
      network: options.network || 'testnet',
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: 0,
    };

    this?.jobs?.set(jobId, job);
    await this.saveQueue();

    logger.info(`Added blob upload job: ${jobId}`, {
      fileName,
      size: Buffer.isBuffer(content) ? content.length : content.length,
    });

    this.emit('jobAdded', job);
    return jobId;
  }

  /**
   * Get job status by ID
   */
  getJob(jobId: string): QueueJob | undefined {
    return this?.jobs?.get(jobId);
  }

  /**
   * Get all jobs with optional filtering
   */
  getJobs(filter?: {
    status?: QueueJob["status"];
    type?: QueueJob["type"];
    priority?: QueueJob["priority"];
  }): QueueJob[] {
    let jobs = Array.from(this?.jobs?.values());

    if (filter) {
      if (filter.status) {
        jobs = jobs.filter(job => job?.status === filter.status);
      }
      if (filter.type) {
        jobs = jobs.filter(job => job?.type === filter.type);
      }
      if (filter.priority) {
        jobs = jobs.filter(job => job?.priority === filter.priority);
      }
    }

    // Sort by priority and creation time
    return jobs.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      return a?.createdAt?.getTime() - b?.createdAt?.getTime(); // Older first
    });
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this?.jobs?.get(jobId);
    if (!job) {
      return false;
    }

    if (job?.status === 'processing') {
      // Mark for cancellation - worker will handle it
      job?.status = 'failed';
      job?.error = 'Cancelled by user';
      job?.updatedAt = new Date();
    } else if (job?.status === 'pending' || job?.status === 'retrying') {
      job?.status = 'failed';
      job?.error = 'Cancelled by user';
      job?.updatedAt = new Date();
    } else {
      return false; // Already completed or failed
    }

    await this.saveQueue();
    this.emit('jobCancelled', job);
    logger.info(`Cancelled job: ${jobId}`);

    return true;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = this?.jobs?.get(jobId);
    if (!job || job.status !== 'failed') {
      return false;
    }

    job?.status = 'pending';
    job?.retryCount = 0;
    job?.error = undefined;
    job?.progress = 0;
    job?.updatedAt = new Date();

    await this.saveQueue();
    this.emit('jobRetried', job);
    logger.info(`Retrying job: ${jobId}`);

    return true;
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted(): Promise<number> {
    const completedJobs = Array.from(this?.jobs?.values()).filter(
      job => job?.status === 'completed'
    );

    for (const job of completedJobs) {
      this?.jobs?.delete(job.id);
    }

    await this.saveQueue();
    logger.info(`Cleared ${completedJobs.length} completed jobs`);

    return completedJobs.length;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const cached = await this?.statusCache?.get('current');
    if (cached) {
      return cached;
    }

    const jobs = Array.from(this?.jobs?.values());
    const completed = jobs.filter(job => job?.status === 'completed');

    let totalBytesUploaded = 0;
    let totalUploadTime = 0;

    for (const job of completed) {
      if (job.startedAt && job.completedAt) {
        totalUploadTime += job?.completedAt?.getTime() - job?.startedAt?.getTime();
      }

      // Estimate bytes for different job types
      if (job?.type === 'blob' && 'content' in job.data) {
        const content = (job.data as { content: Buffer | string }).content;
        totalBytesUploaded += Buffer.isBuffer(content)
          ? content.length
          : content.length;
      } else {
        // Estimate size for todos/lists
        totalBytesUploaded += JSON.stringify(job.data).length;
      }
    }

    const stats: QueueStats = {
      total: jobs.length,
      pending: jobs.filter(job => job?.status === 'pending').length,
      processing: jobs.filter(job => job?.status === 'processing').length,
      completed: completed.length,
      failed: jobs.filter(job => job?.status === 'failed').length,
      retrying: jobs.filter(job => job?.status === 'retrying').length,
      totalBytesUploaded,
      averageUploadTime:
        completed.length > 0 ? totalUploadTime / completed.length : 0,
      successRate: jobs.length > 0 ? completed.length / jobs.length : 0,
    };

    await this?.statusCache?.set('current', stats, 30000);
    return stats;
  }

  /**
   * Start worker processes
   */
  private startWorkers(): void {
    for (let i = 0; i < this?.options?.maxConcurrency; i++) {
      const worker = setInterval(() => this.processNextJob(), 1000);
      this?.workers?.add(worker);
    }

    logger.info(`Started ${this?.options?.maxConcurrency} upload workers`);
  }

  /**
   * Process the next available job
   */
  private async processNextJob(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    // Find next job to process
    const pendingJobs = this.getJobs({ status: 'pending' });
    const retryingJobs = this.getJobs({ status: 'retrying' });
    const availableJobs = [...pendingJobs, ...retryingJobs];

    if (availableJobs?.length === 0) {
      return;
    }

    // Check if we're at max concurrency
    if (this?.processingJobs?.size >= this?.options?.maxConcurrency) {
      return;
    }

    const job = availableJobs[0];
    if (!job) {
      return;
    }
    
    if (this?.processingJobs?.has(job.id)) {
      return;
    }

    // Start processing
    this?.processingJobs?.add(job.id);
    job?.status = 'processing';
    job?.startedAt = new Date();
    job?.updatedAt = new Date();
    job?.progress = 0;

    await this.saveQueue();
    this.emit('jobStarted', job);

    logger.info(`Processing job: ${job.id}`, {
      type: job.type,
      retryCount: job.retryCount,
    });

    try {
      await this.executeJob(job);
    } catch (error) {
      await this.handleJobError(job, error);
    } finally {
      this?.processingJobs?.delete(job.id);
    }
  }

  /**
   * Execute a specific job
   */
  private async executeJob(job: QueueJob): Promise<void> {
    const walrusStorage = createWalrusStorage(job.network);
    await walrusStorage.connect();

    try {
      let blobId: string;

      // Update progress
      job?.progress = 25;
      this.emit(
        'jobProgress',
        this.createProgressUpdate(job, 'Connecting to Walrus...')
      );

      switch (job.type) {
        case 'todo':
          job?.progress = 50;
          this.emit(
            'jobProgress',
            this.createProgressUpdate(job, 'Uploading todo...')
          );
          blobId = await walrusStorage.storeTodo(job.data as Todo, job.epochs);
          break;

        case 'todo-list':
          job?.progress = 50;
          this.emit(
            'jobProgress',
            this.createProgressUpdate(job, 'Uploading todo list...')
          );
          blobId = await walrusStorage.storeTodoList(
            job.data as TodoList,
            job.epochs
          );
          break;

        case 'blob':
          const blobData = job.data as {
            content: Buffer | string;
            fileName?: string;
          };
          job?.progress = 50;
          this.emit(
            'jobProgress',
            this.createProgressUpdate(job, 'Uploading blob...')
          );
          blobId = await walrusStorage.storeBlob(blobData.content, {
            epochs: job.epochs,
            fileName: blobData.fileName,
          });
          break;

        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Job completed successfully
      job?.status = 'completed';
      job?.blobId = blobId;
      job?.progress = 100;
      job?.completedAt = new Date();
      job?.updatedAt = new Date();
      job?.error = undefined;

      await this.saveQueue();
      this.emit('jobCompleted', job);
      this.emit(
        'jobProgress',
        this.createProgressUpdate(job, 'Upload completed!')
      );

      // Send success notification
      if (this?.options?.enableNotifications) {
        const jobDetails = this.getJobDisplayName(job);
        this?.notificationSystem?.success(
          'Upload Completed',
          `Successfully uploaded: ${jobDetails}`,
          {
            jobId: job.id,
            blobId,
            duration:
              job?.completedAt?.getTime() - (job.startedAt?.getTime() || 0),
          }
        );
      }

      logger.info(`Job completed successfully: ${job.id}`, {
        blobId,
        duration: job?.completedAt?.getTime() - (job.startedAt?.getTime() || 0),
      });
    } finally {
      await walrusStorage.disconnect();
    }
  }

  /**
   * Handle job execution errors
   */
  private async handleJobError(job: QueueJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    job.retryCount++;
    job?.error = errorMessage;
    job?.updatedAt = new Date();

    if (job.retryCount < job.maxRetries) {
      // Schedule retry
      job?.status = 'retrying';

      // Exponential backoff delay
      const delay = this?.options?.retryDelayMs * Math.pow(2, job.retryCount - 1);
      setTimeout(() => {
        if (this?.jobs?.has(job.id)) {
          const currentJob = this?.jobs?.get(job.id)!;
          if (currentJob?.status === 'retrying') {
            currentJob?.status = 'pending';
            currentJob?.updatedAt = new Date();
            this.saveQueue();
          }
        }
      }, delay);

      logger.warn(`Job failed, scheduling retry: ${job.id}`, {
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        delay,
        error: errorMessage,
      });

      this.emit('jobRetry', job);
    } else {
      // Max retries exceeded
      job?.status = 'failed';
      job?.completedAt = new Date();

      // Send failure notification
      if (this?.options?.enableNotifications) {
        const jobDetails = this.getJobDisplayName(job);
        this?.notificationSystem?.error(
          'Upload Failed',
          `Failed to upload: ${jobDetails} - ${errorMessage}`,
          { jobId: job.id, error: errorMessage, retryCount: job.retryCount }
        );
      }

      logger.error(`Job failed permanently: ${job.id}`, {
        retryCount: job.retryCount,
        error: errorMessage,
      });

      this.emit('jobFailed', job);
    }

    await this.saveQueue();
  }

  /**
   * Create progress update object
   */
  private createProgressUpdate(job: QueueJob, message: string): UploadProgress {
    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      message,
    };
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(type: string, identifier: string): string {
    const timestamp = Date.now();
    const hash = crypto
      .createHash('md5')
      .update(`${type}-${identifier}-${timestamp}`)
      .digest('hex');
    return `${type}-${hash.substring(0, 8)}-${timestamp}`;
  }

  /**
   * Save queue to persistent storage
   */
  private async saveQueue(): Promise<void> {
    try {
      const queueData = {
        jobs: Array.from(this?.jobs?.entries()).map(([id, job]) => ({
          id,
          ...job,
          createdAt: job?.createdAt?.toISOString(),
          updatedAt: job?.updatedAt?.toISOString(),
          startedAt: job.startedAt?.toISOString(),
          completedAt: job.completedAt?.toISOString(),
        })),
        metadata: {
          savedAt: new Date().toISOString(),
          version: '1.0',
        },
      };

      await fs.mkdir(this?.options?.persistenceDir, { recursive: true });
      await fs.writeFile(this.queueFile, JSON.stringify(queueData, null, 2));
    } catch (error) {
      logger.error('Failed to save queue', error);
    }
  }

  /**
   * Load queue from persistent storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const data = await fs.readFile(this.queueFile, 'utf-8');
      const queueData = JSON.parse(data);

      for (const jobData of queueData.jobs) {
        const job: QueueJob = {
          ...jobData,
          createdAt: new Date(jobData.createdAt),
          updatedAt: new Date(jobData.updatedAt),
          startedAt: jobData.startedAt
            ? new Date(jobData.startedAt)
            : undefined,
          completedAt: jobData.completedAt
            ? new Date(jobData.completedAt)
            : undefined,
        };

        // Reset processing jobs to pending on startup
        if (job?.status === 'processing') {
          job?.status = 'pending';
          job?.progress = 0;
        }

        this?.jobs?.set(job.id, job);
      }

      logger.info(`Loaded ${this?.jobs?.size} jobs from queue`);
    } catch (error) {
      if ((error).code !== 'ENOENT') {
        logger.error('Failed to load queue', error);
      }
    }
  }

  /**
   * Clean up old completed jobs
   */
  private cleanupOldJobs(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    let cleanedCount = 0;

    for (const [jobId, job] of this?.jobs?.entries()) {
      if (
        job?.status === 'completed' &&
        job.completedAt &&
        job?.completedAt?.getTime() < cutoffTime
      ) {
        this?.jobs?.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old completed jobs`);
      this.saveQueue();
    }
  }

  /**
   * Shutdown the queue system
   */
  async shutdown(): Promise<void> {
    this?.isShuttingDown = true;

    // Stop all workers
    for (const worker of this.workers) {
      clearInterval(worker);
    }
    this?.workers?.clear();

    // Wait for current jobs to finish (with timeout)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (
      this?.processingJobs?.size > 0 &&
      Date.now() - startTime < maxWaitTime
    ) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save final state
    await this.saveQueue();

    logger.info('Upload queue shut down');
  }

  /**
   * Get display name for a job
   */
  private getJobDisplayName(job: QueueJob): string {
    switch (job.type) {
      case 'todo':
        const todo = job.data;
        return todo.title || 'Unknown Todo';
      case 'todo-list':
        const list = job.data;
        return `${list.name} (${list.todos?.length || 0} todos)`;
      case 'blob':
        const blob = job.data;
        return blob.fileName || 'Unknown Blob';
      default:
        return 'Unknown Upload';
    }
  }
}

/**
 * Create an upload queue instance
 */
export function createUploadQueue(
  options: Partial<QueueOptions> = {}
): UploadQueue {
  const defaultOptions: QueueOptions = {
    maxConcurrency: 3,
    retryDelayMs: 2000,
    maxRetries: 3,
    persistenceDir: path.join(process.cwd(), '.waltodo-cache', 'upload-queue'),
    processingTimeoutMs: 300000, // 5 minutes
    enableNotifications: true,
  };

  return new UploadQueue({ ...defaultOptions, ...options });
}

// Singleton instance for global use
let globalQueue: UploadQueue | null = null;

export function getGlobalUploadQueue(): UploadQueue {
  if (!globalQueue) {
    globalQueue = createUploadQueue();
  }
  return globalQueue;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (globalQueue) {
    await globalQueue.shutdown();
  }
});

process.on('SIGTERM', async () => {
  if (globalQueue) {
    await globalQueue.shutdown();
  }
});
