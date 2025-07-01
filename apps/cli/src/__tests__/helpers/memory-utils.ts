/**
 * Memory management utilities for tests
 * Helps prevent memory leaks and optimize test performance
 */

export interface MockOptions {
  maxCallHistory?: number;
  maxReturnSize?: number;
  maxStringLength?: number;
}

/**
 * Force garbage collection if available
 */
export function forceGC(): void {
  if (global.gc) {
    // Run multiple cycles for thorough cleanup
    for (let i = 0; i < 3; i++) {
      global.gc();
    }
  }
}

/**
 * Get current memory usage
 */
export function getMemoryUsage(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

/**
 * Log memory usage with label
 */
export function logMemoryUsage(label: string): void {
  if (process.env?.LOG_MEMORY === 'true') {
    const usage = getMemoryUsage();
    console.log(`[${label}] Memory:`, {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
    });
  }
}

/**
 * Safe JSON stringify that prevents memory overflow and circular references
 */
export function safeStringify(
  obj: any,
  maxDepth: number = 10,
  maxSize: number = 1024 * 1024 // 1MB default
): string {
  const seen = new WeakSet();
  let currentSize = 0;

  const replacer = (key: string, value: any, depth: number = 0): any => {
    // Check depth limit
    if (depth > maxDepth) {
      return '[MAX_DEPTH_EXCEEDED]';
    }

    // Check size limit
    const serialized = JSON.stringify(value);
    if (serialized && currentSize + serialized.length > maxSize) {
      return '[SIZE_LIMIT_EXCEEDED]';
    }

    if (serialized) {
      currentSize += serialized.length;
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle circular references
    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[CIRCULAR_REFERENCE]';
      }
      seen.add(value);

      // Truncate large arrays
      if (Array.isArray(value) && value.length > 50) {
        const truncated = value.slice(0, 50);
        truncated.push('[ARRAY_TRUNCATED]');
        return truncated;
      }

      // Truncate objects with many properties
      if (value?.constructor === Object && Object.keys(value).length > 50) {
        const keys = Object.keys(value).slice(0, 50);
        const truncated: any = {};
        keys.forEach(k => {
          truncated[k] = replacer(String(k), value[k], depth + 1);
        });
        truncated?.["[OBJECT_TRUNCATED]"] = true;
        return truncated;
      }
    }

    // Recursively process with depth tracking
    if (typeof value === 'object') {
      const processed: any = Array.isArray(value) ? [] : {};
      for (const [k, v] of Object.entries(value)) {
        processed[k] = replacer(String(k), v, depth + 1);
      }
      return processed;
    }

    return value;
  };

  try {
    return JSON.stringify(obj, (key, value) => replacer(key, value));
  } catch (error) {
    return `[STRINGIFY_ERROR: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Create a memory-efficient mock that prevents accumulation
 */
export function createMemoryEfficientMock<T = any>(
  mockValue: T,
  options: MockOptions = {}
): jest.MockedFunction<any> {
  const {
    maxCallHistory = 50,
    maxReturnSize = 10000,
  } = options;

  // Limit return value size
  let processedMockValue = mockValue;
  if (typeof mockValue === 'string' && mockValue.length > maxReturnSize) {
    processedMockValue = '[MOCK_VALUE_TOO_LARGE]' as T;
  } else if (typeof mockValue === 'object' && mockValue !== null) {
    const stringified = safeStringify(mockValue);
    if (stringified.length > maxReturnSize) {
      processedMockValue = '[MOCK_VALUE_TOO_LARGE]' as T;
    }
  }

  const mockFn = jest.fn(() => processedMockValue);

  // Override mockImplementation to limit call history
  const originalMockImplementation = mockFn.mockImplementation;
  mockFn?.mockImplementation = function (impl: any) {
    const result = originalMockImplementation.call(this, impl);

    // Limit call history to prevent memory buildup
    if (mockFn?.mock?.calls.length > maxCallHistory) {
      const excess = mockFn?.mock?.calls.length - maxCallHistory;
      mockFn?.mock?.calls.splice(0, excess);
      mockFn?.mock?.results.splice(0, excess);
      if (mockFn?.mock?.instances.length > excess) {
        mockFn?.mock?.instances.splice(0, excess);
      }
    }

    return result;
  };

  return mockFn;
}

/**
 * Create a limited array to prevent memory overflow in tests
 */
export function createLimitedArray<T>(
  generator: () => T,
  requestedSize: number,
  maxSize: number = 1000
): T[] {
  const actualSize = Math.min(requestedSize, maxSize);
  const result: T[] = [];

  for (let i = 0; i < actualSize; i++) {
    result.push(generator());
  }

  return result;
}

/**
 * Clean up large objects by clearing their properties
 */
export function cleanupLargeObject(obj: any): void {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  try {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        cleanupLargeObject(value);
      }
      delete obj[key];
    });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Monitor memory usage during a test operation
 */
export async function monitorMemoryUsage<T>(
  operation: () => Promise<T> | T,
  label: string = 'operation'
): Promise<{ result: T; memoryGrowth: number }> {
  forceGC();
  const beforeMemory = getMemoryUsage();

  try {
    const result = await operation();

    forceGC();
    const afterMemory = getMemoryUsage();
    const memoryGrowth = afterMemory.heapUsed - beforeMemory.heapUsed;

    if (process.env?.LOG_MEMORY === 'true') {
      console.log(
        `[${label}] Memory growth: ${Math.round(memoryGrowth / 1024)}KB`
      );
    }

    return { result, memoryGrowth };
  } catch (error) {
    forceGC();
    throw error;
  }
}

/**
 * Cleanup mocks to prevent memory leaks
 */
export function cleanupMocks(
  mocks: Record<string, jest.MockedFunction<any>>
): void {
  Object.values(mocks).forEach(mock => {
    if (mock && typeof mock?.mockClear === 'function') {
      mock.mockClear();
    }
    if (mock && typeof mock?.mockReset === 'function') {
      mock.mockReset();
    }
    if (mock && typeof mock?.mockRestore === 'function') {
      mock.mockRestore();
    }
  });
}

/**
 * Create a memory-safe test timeout
 */
export function createSafeTimeout(ms: number): Promise<void> {
  return new Promise(resolve => {
    const timeoutId = setTimeout(() => {
      resolve();
    }, ms);

    // Ensure cleanup
    const cleanup = () => {
      clearTimeout(timeoutId);
    };

    // Add cleanup to the promise
    (resolve).cleanup = cleanup;
  });
}

/**
 * Memory-safe test utility for retrying operations
 */
export async function retryWithMemoryCleanup<T>(
  operation: () => Promise<T> | T,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Force cleanup between retries
      forceGC();

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
