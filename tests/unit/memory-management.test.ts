/**
 * Tests for memory management utilities to ensure they prevent memory leaks
 */

import {
  createMemoryEfficientMock,
  cleanupMocks,
  safeStringify,
  logMemoryUsage,
  forceGC,
  getMemoryUsage,
} from '../helpers/memory-utils';

import {
  registerForCleanup,
  unregisterCleanup,
  cleanupAllResources,
  getRegisteredResourceCount,
  MemoryLeakDetector,
  withMemoryLeakDetection,
  setupMemoryLeakPrevention,
  ResourcePool,
} from '../helpers/memory-leak-prevention';

describe('Memory Management Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupAllResources();
  });

  describe('Memory Efficient Mocks', () => {
    it('should create memory efficient mocks', () => {
      const mockValue = { test: 'data' };
      const mock = createMemoryEfficientMock(mockValue);

      expect(mock).toBeDefined();
      expect(typeof mock).toBe('function');
      expect(mock()).toEqual(mockValue);
    });

    it('should limit call history to prevent memory buildup', () => {
      const mock = createMemoryEfficientMock('test', { maxCallHistory: 5 });

      // Call mock more than the limit
      for (let i = 0; i < 10; i++) {
        mock();
      }

      // Should not have more than maxCallHistory calls
      expect(mock.mock.calls.length).toBeLessThanOrEqual(5);
    });

    it('should handle large return values', () => {
      const largeValue = 'x'.repeat(2000); // Larger than default limit
      const mock = createMemoryEfficientMock(largeValue, { maxReturnSize: 1000 });

      const result = mock();
      expect(result).toBe('[MOCK_VALUE_TOO_LARGE]');
    });

    it('should cleanup mocks properly', () => {
      const mock1 = jest.fn();
      const mock2 = jest.fn();

      mock1();
      mock2();

      expect(mock1).toHaveBeenCalledTimes(1);
      expect(mock2).toHaveBeenCalledTimes(1);

      cleanupMocks({ mock1, mock2 });

      expect(mock1).toHaveBeenCalledTimes(0);
      expect(mock2).toHaveBeenCalledTimes(0);
    });
  });

  describe('Safe Stringify', () => {
    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference

      const result = safeStringify(obj);
      expect(result).toContain('[CIRCULAR_REFERENCE]');
      expect(result).toContain('test');
    });

    it('should limit object depth', () => {
      const deepObj = { level1: { level2: { level3: { level4: 'deep' } } } };
      const result = safeStringify(deepObj, 2);
      expect(result).toContain('[MAX_DEPTH_EXCEEDED]');
    });

    it('should truncate large arrays', () => {
      const largeArray = new Array(150).fill('item');
      const result = safeStringify(largeArray);
      expect(result).toContain('[ARRAY_TRUNCATED]');
    });

    it('should truncate objects with many properties', () => {
      const largeObj: any = {};
      for (let i = 0; i < 60; i++) {
        largeObj[`prop${i}`] = `value${i}`;
      }
      const result = safeStringify(largeObj);
      expect(result).toContain('[OBJECT_TRUNCATED]');
    });

    it('should handle stringify errors gracefully', () => {
      const problematicObj = {};
      Object.defineProperty(problematicObj, 'problematic', {
        get() {
          throw new Error('Cannot stringify');
        },
        enumerable: true,
      });

      const result = safeStringify(problematicObj);
      expect(result).toContain('[STRINGIFY_ERROR]');
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should get current memory usage', () => {
      const usage = getMemoryUsage();
      expect(usage).toHaveProperty('rss');
      expect(usage).toHaveProperty('heapUsed');
      expect(usage).toHaveProperty('heapTotal');
      expect(usage).toHaveProperty('external');
      expect(typeof usage.rss).toBe('number');
      expect(typeof usage.heapUsed).toBe('number');
    });

    it('should log memory usage without errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logMemoryUsage('test');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'test Usage:',
        expect.objectContaining({
          rss: expect.stringMatching(/\d+(\.\d+)?MB/),
          heapUsed: expect.stringMatching(/\d+(\.\d+)?MB/),
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should force garbage collection if available', () => {
      const originalGC = global.gc;
      global.gc = jest.fn();

      forceGC();

      expect(global.gc).toHaveBeenCalled();

      global.gc = originalGC;
    });

    it('should handle missing garbage collection gracefully', () => {
      const originalGC = global.gc;
      delete (global as any).gc;

      expect(() => forceGC()).not.toThrow();

      global.gc = originalGC;
    });
  });

  describe('Resource Cleanup Registry', () => {
    it('should register and cleanup resources', async () => {
      const cleanupFn = jest.fn();
      const resource = { cleanup: jest.fn() };

      registerForCleanup(cleanupFn);
      registerForCleanup(resource);

      expect(getRegisteredResourceCount()).toBe(2);

      await cleanupAllResources();

      expect(cleanupFn).toHaveBeenCalled();
      expect(resource.cleanup).toHaveBeenCalled();
      expect(getRegisteredResourceCount()).toBe(0);
    });

    it('should unregister resources', () => {
      const resource = { cleanup: jest.fn() };

      registerForCleanup(resource);
      expect(getRegisteredResourceCount()).toBe(1);

      unregisterCleanup(resource);
      expect(getRegisteredResourceCount()).toBe(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const faultyResource = {
        cleanup: jest.fn().mockRejectedValue(new Error('Cleanup failed')),
      };

      registerForCleanup(faultyResource);

      await cleanupAllResources();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error during resource cleanup:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle different cleanup method names', async () => {
      const resource1 = { cleanup: jest.fn() };
      const resource2 = { destroy: jest.fn() };
      const resource3 = { dispose: jest.fn() };

      registerForCleanup(resource1);
      registerForCleanup(resource2);
      registerForCleanup(resource3);

      await cleanupAllResources();

      expect(resource1.cleanup).toHaveBeenCalled();
      expect(resource2.destroy).toHaveBeenCalled();
      expect(resource3.dispose).toHaveBeenCalled();
    });
  });

  describe('Memory Leak Detection', () => {
    it('should create memory leak detector', () => {
      const detector = new MemoryLeakDetector('test', 1000);
      expect(detector).toBeDefined();
    });

    it('should detect potential memory leaks', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Create detector with very low threshold
      const detector = new MemoryLeakDetector('test', 1);
      
      // Simulate memory usage
      const largArray = new Array(1000).fill('memory-consumer');
      
      const hasLeak = detector.checkForLeaks();
      
      // Clean up
      largArray.length = 0;
      
      consoleSpy.mockRestore();
    });

    it('should wrap test functions with memory leak detection', async () => {
      const testFn = jest.fn().mockResolvedValue(undefined);
      const wrappedFn = withMemoryLeakDetection(testFn, {
        threshold: 100 * 1024 * 1024, // High threshold to avoid false positives
        cleanup: false,
        label: 'test-function',
      });

      await wrappedFn();

      expect(testFn).toHaveBeenCalled();
    });

    it('should cleanup resources even if test fails', async () => {
      const cleanupFn = jest.fn();
      const failingTestFn = jest.fn().mockRejectedValue(new Error('Test failed'));

      registerForCleanup(cleanupFn);

      const wrappedFn = withMemoryLeakDetection(failingTestFn, {
        cleanup: true,
        label: 'failing-test',
      });

      await expect(wrappedFn()).rejects.toThrow('Test failed');
      expect(cleanupFn).toHaveBeenCalled();
    });
  });

  describe('Resource Pool', () => {
    it('should create and manage resource pool', async () => {
      const mockResource = { cleanup: jest.fn() };
      const factory = jest.fn().mockResolvedValue(mockResource);

      const pool = new ResourcePool(factory);
      expect(pool.size()).toBe(0);

      const resource = await pool.acquire();
      expect(factory).toHaveBeenCalled();
      expect(pool.size()).toBe(1);
      expect(resource).toBe(mockResource);

      await pool.release(resource);
      expect(mockResource.cleanup).toHaveBeenCalled();
      expect(pool.size()).toBe(0);
    });

    it('should cleanup all resources in pool', async () => {
      const resource1 = { cleanup: jest.fn() };
      const resource2 = { destroy: jest.fn() };
      
      const factory = jest.fn()
        .mockResolvedValueOnce(resource1)
        .mockResolvedValueOnce(resource2);

      const pool = new ResourcePool(factory);

      await pool.acquire();
      await pool.acquire();
      expect(pool.size()).toBe(2);

      await pool.cleanup();
      expect(resource1.cleanup).toHaveBeenCalled();
      expect(resource2.destroy).toHaveBeenCalled();
      expect(pool.size()).toBe(0);
    });

    it('should handle resources without cleanup methods', async () => {
      const resourceWithoutCleanup = { data: 'test' };
      const factory = jest.fn().mockResolvedValue(resourceWithoutCleanup);

      const pool = new ResourcePool(factory);
      const resource = await pool.acquire();

      // Should not throw when releasing resource without cleanup method
      await expect(pool.release(resource)).resolves.not.toThrow();
    });
  });
});