/**
 * Memory leak prevention utilities for Jest tests
 */

/**
 * Global Jest configuration to prevent memory leaks
 */
export function setupMemoryLeakPrevention() {
  // Increase garbage collection frequency during tests
  if (global.gc) {
    const originalGc = global.gc;
    global.gc = () => {
      originalGc();
      return true;
    };
  }

  // Set up global cleanup after each test
  afterEach(() => {
    // Clear Jest mocks more thoroughly
    jest.clearAllMocks();
    jest.restoreAllMocks();
    
    // Clear timers
    jest.clearAllTimers();
    jest.useRealTimers();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  // Set up global cleanup before each test
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    
    // Reset modules to prevent state leakage
    jest.resetModules();
  });
}

/**
 * Utility to create mock objects with automatic cleanup
 */
export function createCleanMock<T>(mockFn: () => T): T {
  const mock = mockFn();
  
  // Add cleanup function if it's a Jest mock
  if (typeof mock === 'object' && mock !== null) {
    const cleanupFn = () => {
      // Clear any internal references
      Object.keys(mock).forEach(key => {
        const value = (mock as any)[key];
        if (jest.isMockFunction(value)) {
          value.mockClear();
        }
      });
    };
    
    // Store cleanup function for later use
    (mock as any).__cleanup = cleanupFn;
  }
  
  return mock;
}

/**
 * Utility to create test data factories instead of static objects
 */
export function createTestDataFactory<T>(factory: () => T): () => T {
  return () => {
    const data = factory();
    
    // Add a cleanup method to the data if it's an object
    if (typeof data === 'object' && data !== null) {
      (data as any).__cleanup = () => {
        // Clear object properties to help GC
        Object.keys(data).forEach(key => {
          try {
            delete (data as any)[key];
          } catch (e) {
            // Ignore errors during cleanup
          }
        });
      };
    }
    
    return data;
  };
}

/**
 * Utility to limit array sizes in mocks to prevent memory buildup
 */
export function createLimitedArray<T>(items: T[], maxSize: number = 10): T[] {
  return items.slice(0, maxSize);
}

/**
 * Utility to create lightweight mock functions with automatic cleanup
 */
export function createLightweightMock<T extends (...args: any[]) => any>(
  implementation?: T
): jest.MockedFunction<T> {
  const mock = jest.fn(implementation) as jest.MockedFunction<T>;
  
  // Limit call history to prevent memory buildup
  const originalMockImplementation = mock.mockImplementation;
  mock.mockImplementation = function(impl: T) {
    const result = originalMockImplementation.call(this, impl);
    
    // Periodically clear old call history
    if (mock.mock.calls.length > 50) {
      mock.mock.calls.splice(0, 25); // Remove oldest 25 calls
      mock.mock.results.splice(0, 25);
      mock.mock.instances.splice(0, 25);
    }
    
    return result;
  };
  
  return mock;
}

/**
 * Utility to clean up singleton instances
 */
export function cleanupSingletons(singletons: Array<{ getInstance: () => any }>) {
  singletons.forEach(singleton => {
    try {
      const instance = singleton.getInstance();
      if (instance && typeof instance.clear === 'function') {
        instance.clear();
      }
      if (instance && typeof instance.reset === 'function') {
        instance.reset();
      }
      if (instance && typeof instance.destroy === 'function') {
        instance.destroy();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });
}

/**
 * Utility to wrap test functions with automatic cleanup
 */
export function withCleanup<T extends (...args: any[]) => any>(
  testFn: T,
  cleanupFn?: () => void
): T {
  return ((...args: any[]) => {
    try {
      const result = testFn(...args);
      
      // If it's a promise, add cleanup to the end
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          if (cleanupFn) cleanupFn();
          if (global.gc) global.gc();
        });
      }
      
      // Otherwise cleanup immediately
      if (cleanupFn) cleanupFn();
      if (global.gc) global.gc();
      
      return result;
    } catch (error) {
      // Cleanup even if test fails
      if (cleanupFn) cleanupFn();
      if (global.gc) global.gc();
      throw error;
    }
  }) as T;
}

/**
 * Memory usage monitoring utility for tests
 */
export function logMemoryUsage(label: string) {
  if (process.env.NODE_ENV === 'test' && process.env.LOG_MEMORY === 'true') {
    const usage = process.memoryUsage();
    console.log(`[${label}] Memory usage:`, {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`,
    });
  }
}