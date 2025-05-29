/**
 * @fileoverview Upload Queue System Tests
 *
 * Tests for the asynchronous upload queue functionality including
 * job management, status tracking, and error handling.
 */

import { createUploadQueue, QueueJob } from '../utils/upload-queue';
import { createNotificationSystem } from '../utils/notification-system';
import { Todo } from '../types/todo';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Test environment setup
const testDir = path.join(os.tmpdir(), 'waltodo-test-queue');
const testOptions = {
  maxConcurrency: 1,
  retryDelayMs: 100,
  maxRetries: 2,
  persistenceDir: testDir,
  processingTimeoutMs: 5000,
  enableNotifications: false,
};

// Sample test todo
const sampleTodo: Todo = {
  id: 'test-todo-1',
  title: 'Test Todo',
  description: 'A test todo for queue testing',
  completed: false,
  priority: 'medium' as const,
  tags: ['test'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  private: false,
  storageLocation: 'local' as const,
};

describe('Upload Queue System', () => {
  let queue: ReturnType<typeof createUploadQueue>;

  beforeEach(async () => {
    // Clean test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Create fresh queue instance
    queue = createUploadQueue(testOptions);
  });

  afterEach(async () => {
    // Shutdown queue
    if (queue) {
      await queue.shutdown();
    }

    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Job Management', () => {
    test('should add todo job to queue', async () => {
      const jobId = await queue.addTodoJob(sampleTodo, {
        priority: 'medium' as const,
        epochs: 5,
        network: 'testnet',
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId).toMatch(/^todo-/);

      const job = queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe('todo');
      expect(job?.status).toBe('pending');
      expect(job?.priority).toBe('medium');
    });

    test('should add todo list job to queue', async () => {
      const todoList = {
        id: 'test-list-1',
        name: 'Test List',
        owner: 'test-user',
        todos: [sampleTodo],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const jobId = await queue.addTodoListJob(todoList, {
        priority: 'high' as const,
        epochs: 3,
        network: 'testnet',
      });

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^list-/);

      const job = queue.getJob(jobId);
      expect(job?.type).toBe('todo-list');
      expect(job?.priority).toBe('high');
    });

    test('should add blob job to queue', async () => {
      const testContent = 'Test blob content';
      const jobId = await queue.addBlobJob(testContent, {
        fileName: 'test.txt',
        priority: 'low' as const,
        epochs: 2,
      });

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^blob-/);

      const job = queue.getJob(jobId);
      expect(job?.type).toBe('blob');
      expect(job?.priority).toBe('low');
    });

    test('should get jobs with filtering', async () => {
      // Add multiple jobs
      await queue.addTodoJob(sampleTodo, { priority: 'high' as const });
      await queue.addTodoJob(
        { ...sampleTodo, id: 'test-todo-2' },
        { priority: 'low' as const }
      );
      await queue.addBlobJob('test', { priority: 'medium' as const });

      // Test filtering
      const allJobs = queue.getJobs();
      expect(allJobs).toHaveLength(3);

      const todoJobs = queue.getJobs({ type: 'todo' });
      expect(todoJobs).toHaveLength(2);

      const highPriorityJobs = queue.getJobs({ priority: 'high' as const });
      expect(highPriorityJobs).toHaveLength(1);

      const pendingJobs = queue.getJobs({ status: 'pending' });
      expect(pendingJobs).toHaveLength(3);
    });

    test('should cancel job', async () => {
      const jobId = await queue.addTodoJob(sampleTodo);

      let job = queue.getJob(jobId);
      expect(job?.status).toBe('pending');

      const cancelled = await queue.cancelJob(jobId);
      expect(cancelled).toBe(true);

      job = queue.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toBe('Cancelled by user');
    });

    test('should not cancel non-existent job', async () => {
      const cancelled = await queue.cancelJob('non-existent-job');
      expect(cancelled).toBe(false);
    });

    test('should retry failed job', async () => {
      const jobId = await queue.addTodoJob(sampleTodo);

      // Simulate job failure
      await queue.cancelJob(jobId);

      let job = queue.getJob(jobId);
      expect(job?.status).toBe('failed');

      const retried = await queue.retryJob(jobId);
      expect(retried).toBe(true);

      job = queue.getJob(jobId);
      expect(job?.status).toBe('pending');
      expect(job?.retryCount).toBe(0);
      expect(job?.error).toBeUndefined();
    });
  });

  describe('Queue Statistics', () => {
    test('should provide accurate statistics', async () => {
      // Initially empty
      let stats = await queue.getStats();
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);

      // Add some jobs
      await queue.addTodoJob(sampleTodo);
      await queue.addTodoJob({ ...sampleTodo, id: 'test-todo-2' });

      stats = await queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });

    test('should calculate success rate', async () => {
      // Add and simulate completing some jobs
      const jobId1 = await queue.addTodoJob(sampleTodo);
      const jobId2 = await queue.addTodoJob({
        ...sampleTodo,
        id: 'test-todo-2',
      });

      // Simulate one success and one failure
      const job1 = queue.getJob(jobId1)!;
      job1.status = 'completed';
      job1.blobId = 'test-blob-id';
      job1.completedAt = new Date();

      await queue.cancelJob(jobId2); // This creates a failure

      const stats = await queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBe(0.5);
    });
  });

  describe('Queue Persistence', () => {
    test('should persist queue state', async () => {
      // Add jobs to queue
      const jobId1 = await queue.addTodoJob(sampleTodo);
      const jobId2 = await queue.addBlobJob('test content');

      // Shutdown queue
      await queue.shutdown();

      // Create new queue instance
      const newQueue = createUploadQueue(testOptions);

      // Check that jobs were restored
      const job1 = newQueue.getJob(jobId1);
      const job2 = newQueue.getJob(jobId2);

      expect(job1).toBeDefined();
      expect(job2).toBeDefined();
      expect(job1?.type).toBe('todo');
      expect(job2?.type).toBe('blob');

      await newQueue.shutdown();
    });

    test('should reset processing jobs to pending on load', async () => {
      // Add job and simulate it being in processing state
      const jobId = await queue.addTodoJob(sampleTodo);
      const job = queue.getJob(jobId)!;
      job.status = 'processing';
      job.startedAt = new Date();

      // Shutdown and recreate queue
      await queue.shutdown();
      const newQueue = createUploadQueue(testOptions);

      // Job should be reset to pending
      const reloadedJob = newQueue.getJob(jobId);
      expect(reloadedJob?.status).toBe('pending');
      expect(reloadedJob?.progress).toBe(0);

      await newQueue.shutdown();
    });
  });

  describe('Job Cleanup', () => {
    test('should clear completed jobs', async () => {
      // Add and complete some jobs
      const jobId1 = await queue.addTodoJob(sampleTodo);
      const jobId2 = await queue.addTodoJob({
        ...sampleTodo,
        id: 'test-todo-2',
      });

      // Simulate completion
      const job1 = queue.getJob(jobId1)!;
      job1.status = 'completed';
      job1.completedAt = new Date();

      const job2 = queue.getJob(jobId2)!;
      job2.status = 'completed';
      job2.completedAt = new Date();

      // Clear completed jobs
      const cleared = await queue.clearCompleted();
      expect(cleared).toBe(2);

      // Verify jobs are removed
      expect(queue.getJob(jobId1)).toBeUndefined();
      expect(queue.getJob(jobId2)).toBeUndefined();

      const stats = await queue.getStats();
      expect(stats.total).toBe(0);
    });
  });
});

describe('Notification System', () => {
  let notifications: ReturnType<typeof createNotificationSystem>;

  beforeEach(() => {
    notifications = createNotificationSystem({
      enableCLI: false, // Disable CLI output during tests
      enableDesktop: false,
      enableSound: false,
      verbosity: 'minimal',
    });
  });

  afterEach(() => {
    notifications.clearNotifications();
  });

  test('should create notifications', () => {
    const id = notifications.info('Test Title', 'Test message');

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');

    const notification = notifications
      .getNotifications()
      .find(n => n.id === id);
    expect(notification).toBeDefined();
    expect(notification?.type).toBe('info');
    expect(notification?.title).toBe('Test Title');
    expect(notification?.message).toBe('Test message');
  });

  test('should update notifications', () => {
    const id = notifications.progress('Upload', 'Starting...');

    const updated = notifications.updateNotification(id, {
      message: 'Progress 50%',
    });

    expect(updated).toBe(true);

    const notification = notifications
      .getNotifications()
      .find(n => n.id === id);
    expect(notification?.message).toBe('Progress 50%');
  });

  test('should remove notifications', () => {
    const id = notifications.warning('Warning', 'Test warning');

    let notification = notifications.getNotifications().find(n => n.id === id);
    expect(notification).toBeDefined();

    const removed = notifications.removeNotification(id);
    expect(removed).toBe(true);

    notification = notifications.getNotifications().find(n => n.id === id);
    expect(notification).toBeUndefined();
  });

  test('should clear notifications by type', () => {
    notifications.info('Info 1', 'Message 1');
    notifications.info('Info 2', 'Message 2');
    notifications.error('Error 1', 'Error message');
    notifications.warning('Warning 1', 'Warning message');

    expect(notifications.getNotifications()).toHaveLength(4);

    const cleared = notifications.clearNotificationsByType('info');
    expect(cleared).toBe(2);
    expect(notifications.getNotifications()).toHaveLength(2);

    const remaining = notifications.getNotifications();
    expect(remaining.some(n => n.type === 'info')).toBe(false);
    expect(remaining.some(n => n.type === 'error')).toBe(true);
    expect(remaining.some(n => n.type === 'warning')).toBe(true);
  });

  test('should handle upload notifications', () => {
    const mockJob: QueueJob = {
      id: 'test-job-1',
      type: 'todo',
      data: sampleTodo,
      status: 'pending',
      priority: 'medium' as const,
      retryCount: 0,
      maxRetries: 3,
      epochs: 5,
      network: 'testnet',
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: 0,
    };

    const uploadNotifications =
      notifications.createUploadNotifications(mockJob);

    expect(uploadNotifications.started).toBeDefined();
    expect(uploadNotifications.progress).toBeDefined();
    expect(uploadNotifications.completed).toBeDefined();
    expect(uploadNotifications.failed).toBeDefined();

    // Verify notification content
    const allNotifications = notifications.getNotifications();
    expect(allNotifications).toHaveLength(4);

    const startedNotification = allNotifications.find(
      n => n.title === 'Upload Started'
    );
    expect(startedNotification?.message).toContain('Test Todo');
  });
});
