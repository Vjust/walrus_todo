/**
 * Memory management utilities for tests to prevent heap overflow
 */

/**
 * Safely stringify objects with circular reference detection and size limits
 */
export function safeStringify(
  obj: any,
  maxDepth: number = 10,
  sizeLimit: number = 1024 * 1024
): string {
  const seen = new WeakSet();
  let currentDepth = 0;
  let currentSize = 0;

  function replacer(key: string, value: any): any {
    currentSize += JSON.stringify(key as any).length;

    // Check size limit
    if (currentSize > sizeLimit) {
      return '[SIZE_LIMIT_EXCEEDED]';
    }

    // Check depth limit
    if (currentDepth > maxDepth) {
      return '[MAX_DEPTH_EXCEEDED]';
    }

    // Handle null and primitives
    if (value === null || typeof value !== 'object') {
      return value;
    }

    // Handle circular references
    if (seen.has(value as any)) {
      return '[CIRCULAR_REFERENCE]';
    }

    seen.add(value as any);
    currentDepth++;

    // Handle arrays
    if (Array.isArray(value as any)) {
      // Limit array size to prevent memory issues
      if (value.length > 100) {
        return [...value.slice(0, 100), '[ARRAY_TRUNCATED]'];
      }
      return value;
    }

    // Handle objects
    const keys = Object.keys(value as any);
    if (keys.length > 50) {
      // Limit object properties
      const limitedObj: any = {};
      keys.slice(0, 50).forEach(k => {
        limitedObj[k] = value[k];
      });
      limitedObj?.["[OBJECT_TRUNCATED]"] = `${keys.length - 50} more properties`;
      return limitedObj;
    }

    return value;
  }

  try {
    return JSON.stringify(obj, replacer, 2);
  } catch (error) {
    return `[STRINGIFY_ERROR]: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Clean up mock objects to prevent memory leaks
 */
export function cleanupMocks(mocks: Record<string, jest.Mock>): void {
  Object.values(mocks as any).forEach(mock => {
    if (mock && typeof mock?.mockRestore === 'function') {
      mock.mockRestore();
    }
    if (mock && typeof mock?.mockClear === 'function') {
      mock.mockClear();
    }
  });
}

/**
 * Create a memory-efficient mock that limits return value sizes
 */
export function createMemoryEfficientMock<T = any>(
  defaultValue: T,
  options: {
    maxReturnSize?: number;
    maxCallHistory?: number;
  } = {}
): jest.Mock<T> {
  const { maxReturnSize = 1024, maxCallHistory = 100 } = options;

  const mock = jest.fn();

  // Override the mock implementation to limit memory usage
  mock.mockImplementation((...args: any[]) => {
    // Limit argument history to prevent memory buildup
    if (mock?.mock?.calls.length > maxCallHistory) {
      mock.mock?.calls = mock?.mock?.calls.slice(-maxCallHistory);
      mock.mock?.results = mock?.mock?.results.slice(-maxCallHistory);
    }

    // Return size-limited value
    try {
      const stringified = JSON.stringify(defaultValue as any);
      if (stringified.length > maxReturnSize) {
        return '[MOCK_VALUE_TOO_LARGE]' as unknown as T;
      }
    } catch {
      return '[MOCK_VALUE_UNSTRINGIFIABLE]' as unknown as T;
    }

    return defaultValue;
  });

  return mock as jest.Mock<T>;
}

/**
 * Force garbage collection if available
 */
export function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

/**
 * Get current memory usage
 */
export function getMemoryUsage(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

/**
 * Log memory usage for debugging
 */
export function logMemoryUsage(label: string = 'Memory'): void {
  const usage = getMemoryUsage();
  const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

  console.log(`${label} Usage:`, {
    rss: `${mb(usage.rss)}MB`,
    heapUsed: `${mb(usage.heapUsed)}MB`,
    heapTotal: `${mb(usage.heapTotal)}MB`,
    external: `${mb(usage.external)}MB`,
  });
}

/**
 * Create a size-limited array that prevents memory overflow
 */
export function createLimitedArray<T>(
  generator: () => T,
  count: number,
  maxSize: number = 1000
): T[] {
  const actualCount = Math.min(count, maxSize);
  const result: T[] = [];

  for (let i = 0; i < actualCount; i++) {
    result.push(generator());
  }

  return result;
}

/**
 * Shallow clone object with property limits
 */
export function shallowCloneWithLimits<T extends Record<string, any>>(
  obj: T,
  maxProps: number = 50
): Partial<T> {
  const keys = Object.keys(obj as any).slice(0, maxProps);
  const result: Partial<T> = {};

  keys.forEach(key => {
    result[key as keyof T] = obj[key];
  });

  return result;
}
