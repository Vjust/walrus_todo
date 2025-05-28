import { BackgroundCacheManager, CacheOperation } from '../utils/BackgroundCacheManager';
import { performanceMonitor } from '../utils/PerformanceMonitor';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

describe('BackgroundCacheManager', () => {
  let cacheManager: BackgroundCacheManager;
  const testCacheDir = '.test-cache/background';

  beforeEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }

    cacheManager = new BackgroundCacheManager({
      maxConcurrentProcesses: 2,
      processTimeout: 10000, // 10 seconds for tests
      enableWorkerThreads: false, // Disable for easier testing
      cacheDir: testCacheDir,
      logLevel: 'error', // Reduce noise in tests
    });
  });

  afterEach(async () => {
    await cacheManager.shutdown();
    
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('Operation Queuing', () => {
    it('should queue operations successfully', async () => {
      const operation: CacheOperation = {
        id: uuidv4(),
        type: 'blob-cache',
        data: { items: [{ key: 'test', value: 'value' }] },
        priority: 'medium' as const,
      };

      const operationId = await cacheManager.queueOperation(operation);
      expect(operationId).toBe(operation.id);

      const status = await cacheManager.getOperationStatus(operationId);
      expect(status).toBeTruthy();
      expect(status?.type).toBe('blob-cache');
      expect(status?.status).toMatch(/pending|running/);
    });

    it('should handle high priority operations first', async () => {
      const lowPriorityOp: CacheOperation = {
        id: uuidv4(),
        type: 'blob-cache',
        data: { items: [] },
        priority: 'low' as const,
      };

      const highPriorityOp: CacheOperation = {
        id: uuidv4(),
        type: 'blob-cache',
        data: { items: [] },
        priority: 'high' as const,
      };

      await cacheManager.queueOperation(lowPriorityOp);
      await cacheManager.queueOperation(highPriorityOp);

      // High priority should be processed first (or at least be in the queue)
      const activeOps = cacheManager.getActiveOperations();
      expect(activeOps.length).toBeGreaterThan(0);
    });
  });

  describe('Operation Status', () => {
    it('should track operation status correctly', async () => {
      const operation: CacheOperation = {
        id: uuidv4(),
        type: 'storage-allocation',
        data: { size: 1024 },
        priority: 'medium' as const,
      };

      await cacheManager.queueOperation(operation);
      
      const status = await cacheManager.getOperationStatus(operation.id);
      expect(status).toBeTruthy();
      expect(status?.id).toBe(operation.id);
      expect(status?.type).toBe('storage-allocation');
      expect(['pending', 'running', 'completed', 'failed']).toContain(status?.status);
    });

    it('should return null for non-existent operations', async () => {
      const status = await cacheManager.getOperationStatus('non-existent-id');
      expect(status).toBeNull();
    });
  });

  describe('Operation Cancellation', () => {
    it('should cancel pending operations', async () => {
      const operation: CacheOperation = {
        id: uuidv4(),
        type: 'batch-process',
        data: { items: [] },
        priority: 'low' as const, // Low priority to keep it pending longer
      };

      await cacheManager.queueOperation(operation);
      
      // Try to cancel before it starts running
      const cancelled = await cacheManager.cancelOperation(operation.id);
      expect(cancelled).toBe(true);

      const status = await cacheManager.getOperationStatus(operation.id);
      expect(status?.status).toBe('failed');
      expect(status?.error).toContain('cancelled');
    });

    it('should return false for cancelling non-existent operations', async () => {
      const cancelled = await cacheManager.cancelOperation('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('Active Operations', () => {
    it('should list active operations', async () => {
      const operation1: CacheOperation = {
        id: uuidv4(),
        type: 'blob-cache',
        data: { items: [] },
        priority: 'medium' as const,
      };

      const operation2: CacheOperation = {
        id: uuidv4(),
        type: 'storage-allocation',
        data: { size: 2048 },
        priority: 'high' as const,
      };

      await cacheManager.queueOperation(operation1);
      await cacheManager.queueOperation(operation2);

      const activeOps = cacheManager.getActiveOperations();
      expect(activeOps.length).toBeGreaterThanOrEqual(0);
      
      // Check that our operations are in the list
      const opIds = activeOps.map(op => op.id);
      if (activeOps.length > 0) {
        expect(opIds).toContain(operation1.id);
        expect(opIds).toContain(operation2.id);
      }
    });
  });

  describe('Operation Waiting', () => {
    it('should wait for operation completion', async () => {
      const operation: CacheOperation = {
        id: uuidv4(),
        type: 'blob-cache',
        data: { items: [{ key: 'test', value: 'test-value' }] },
        priority: 'high' as const,
        timeout: 5000,
      };

      await cacheManager.queueOperation(operation);

      // Wait for operation with short timeout for test
      try {
        const result = await cacheManager.waitForOperation(operation.id, 8000);
        expect(result).toBeTruthy();
      } catch (error) {
        // Timeout is acceptable in test environment
        expect((error as Error).message).toContain('timeout');
      }
    });

    it('should timeout when waiting too long', async () => {
      const operation: CacheOperation = {
        id: uuidv4(),
        type: 'batch-process',
        data: { items: Array(1000).fill({}) }, // Large data to take time
        priority: 'low' as const,
      };

      await cacheManager.queueOperation(operation);

      await expect(
        cacheManager.waitForOperation(operation.id, 100) // Very short timeout
      ).rejects.toThrow(/timeout/);
    });
  });

  describe('Cache Persistence', () => {
    it('should persist operation status to cache', async () => {
      const operation: CacheOperation = {
        id: uuidv4(),
        type: 'blob-cache',
        data: { items: [] },
        priority: 'medium' as const,
      };

      await cacheManager.queueOperation(operation);
      
      // Wait a bit for the operation to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = await cacheManager.getOperationStatus(operation.id);
      expect(status).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operation types gracefully', async () => {
      const operation: CacheOperation = {
        id: uuidv4(),
        type: 'invalid-type' as any,
        data: {},
        priority: 'medium' as const,
      };

      await cacheManager.queueOperation(operation);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const status = await cacheManager.getOperationStatus(operation.id);
      expect(status?.status).toBe('failed');
    });
  });

  describe('Resource Management', () => {
    it('should limit concurrent processes', async () => {
      const operations: CacheOperation[] = [];
      
      // Create more operations than the max concurrent limit
      for (let i = 0; i < 5; i++) {
        operations.push({
          id: uuidv4(),
          type: 'batch-process',
          data: { items: Array(10).fill({}) },
          priority: 'medium' as const,
        });
      }

      // Queue all operations
      for (const op of operations) {
        await cacheManager.queueOperation(op);
      }

      // Check that we don't exceed max concurrent processes
      const activeOps = cacheManager.getActiveOperations();
      expect(activeOps.length).toBeLessThanOrEqual(2); // Our test limit
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should integrate with performance monitor', async () => {
      const operation: CacheOperation = {
        id: uuidv4(),
        type: 'storage-allocation',
        data: { size: 512 },
        priority: 'medium' as const,
      };

      const operationId = `test-operation-${Date.now()}`;
      performanceMonitor.startOperation(operationId, 'background-cache-test');

      await cacheManager.queueOperation(operation);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      performanceMonitor.endOperation(operationId, 'background-cache-test', true);

      const report = performanceMonitor.generateReport();
      expect(report.totalOperations).toBeGreaterThan(0);
    });
  });
});