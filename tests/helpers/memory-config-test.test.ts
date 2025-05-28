/**
 * Memory Configuration Test
 * Verifies that Jest memory configuration is properly set and conflicts are resolved
 */

const { getMemoryStats, checkMemoryLeaks } = require('./memory-leak-prevention');

describe('Memory Configuration', () => {
  test('should have proper memory configuration set', () => {
    const nodeOptions = process.env.NODE_OPTIONS || '';
    
    // Check that memory limit is set
    expect(nodeOptions).toMatch(/--max-old-space-size=\d+/);
    
    // Check that garbage collection is enabled
    expect(nodeOptions).toContain('--expose-gc');
    
    // Verify that global.gc is available
    expect(typeof global.gc).toBe('function');
  });

  test('should track memory usage within acceptable limits', () => {
    const stats = getMemoryStats();
    
    expect(stats.heapUsedMB).toBeGreaterThan(0);
    expect(stats.heapTotalMB).toBeGreaterThan(stats.heapUsedMB);
    
    // Memory should be reasonable for test environment
    expect(stats.heapUsedMB).toBeLessThan(512);
    
    console.log('Memory stats:', stats);
  });

  test('should not have memory leaks after cleanup', () => {
    // Create some timers to test cleanup
    const timeout1 = setTimeout(() => {}, 1000);
    const timeout2 = setTimeout(() => {}, 2000);
    const interval1 = setInterval(() => {}, 1000);
    
    // Clean up manually
    clearTimeout(timeout1);
    clearTimeout(timeout2);
    clearInterval(interval1);
    
    // Check for leaks
    const leakCheck = checkMemoryLeaks();
    
    // Should not have excessive leaks
    expect(leakCheck.leaks.length).toBeLessThanOrEqual(1);
    
    if (leakCheck.hasLeaks) {
      console.warn('Detected potential memory leaks:', leakCheck.leaks);
    }
  });

  test('should handle Jest worker configuration correctly', () => {
    // In workers, JEST_WORKER_ID should be set
    if (process.env.JEST_WORKER_ID) {
      expect(parseInt(process.env.JEST_WORKER_ID)).toBeGreaterThan(0);
    }
    
    // NODE_ENV should be test
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('should have proper Jest configuration options', () => {
    // Check Jest timeout is set
    expect(jest.getTimeout()).toBe(30000);
    
    // Check that global cleanup functions are available
    expect(typeof global.clearAllTimers).toBe('function');
    expect(typeof global.performCleanup).toBe('function');
    expect(typeof global.createSafeStub).toBe('function');
  });

  test('should force garbage collection when available', () => {
    const initialMemory = process.memoryUsage();
    
    // Create some objects to increase memory usage
    const largeArray = new Array(10000).fill({ data: 'test data '.repeat(100) });
    
    const afterAllocation = process.memoryUsage();
    expect(afterAllocation.heapUsed).toBeGreaterThan(initialMemory.heapUsed);
    
    // Clear the array
    largeArray.length = 0;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      
      const afterGC = process.memoryUsage();
      // Memory usage should be reduced after GC
      expect(afterGC.heapUsed).toBeLessThanOrEqual(afterAllocation.heapUsed);
    }
  });
});

// Cleanup after all tests
afterAll(() => {
  if (global.performCleanup) {
    global.performCleanup();
  }
});