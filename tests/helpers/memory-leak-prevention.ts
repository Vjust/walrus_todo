/**
 * Memory leak prevention utilities for tests
 */

import {
  logMemoryUsage,
  forceGC,
} from '../../apps/cli/src/__tests__/helpers/memory-utils';

/**
 * Interface for components that need cleanup
 */
export interface Cleanupable {
  cleanup?(): void | Promise<void>;
  destroy?(): void | Promise<void>;
  dispose?(): void | Promise<void>;
}

/**
 * Global registry for tracking test resources that need cleanup
 */
class ResourceRegistry {
  private resources: Set<Cleanupable> = new Set();
  private cleanupCallbacks: Set<() => void | Promise<void>> = new Set();

  /**
   * Register a resource for cleanup
   */
  register(resource: Cleanupable | (() => void | Promise<void>)): void {
    if (typeof resource === 'function') {
      this?.cleanupCallbacks?.add(resource as any);
    } else {
      this?.resources?.add(resource as any);
    }
  }

  /**
   * Unregister a resource
   */
  unregister(resource: Cleanupable | (() => void | Promise<void>)): void {
    if (typeof resource === 'function') {
      this?.cleanupCallbacks?.delete(resource as any);
    } else {
      this?.resources?.delete(resource as any);
    }
  }

  /**
   * Cleanup all registered resources
   */
  async cleanup(): Promise<void> {
    // Cleanup resources
    const resourceCleanups = Array.from(this.resources).map(async resource => {
      try {
        if (resource.cleanup) {
          await resource.cleanup();
        } else if (resource.destroy) {
          await resource.destroy();
        } else if (resource.dispose) {
          await resource.dispose();
        }
      } catch (error) {
        console.warn('Error during resource cleanup:', error);
      }
    });

    // Cleanup callbacks
    const callbackCleanups = Array.from(this.cleanupCallbacks).map(
      async callback => {
        try {
          await callback();
        } catch (error) {
          console.warn('Error during callback cleanup:', error);
        }
      }
    );

    await Promise.all([...resourceCleanups, ...callbackCleanups]);

    // Clear the registry
    this?.resources?.clear();
    this?.cleanupCallbacks?.clear();
  }

  /**
   * Get count of registered resources
   */
  getResourceCount(): number {
    return this?.resources?.size + this?.cleanupCallbacks?.size;
  }
}

// Global instance
const globalRegistry = new ResourceRegistry();

/**
 * Register a resource for automatic cleanup
 * @param resource - Resource or cleanup function
 */
export function registerForCleanup(
  resource: Cleanupable | (() => void | Promise<void>)
): void {
  globalRegistry.register(resource as any);
}

/**
 * Unregister a resource
 * @param resource - Resource or cleanup function to unregister
 */
export function unregisterCleanup(
  resource: Cleanupable | (() => void | Promise<void>)
): void {
  globalRegistry.unregister(resource as any);
}

/**
 * Cleanup all registered resources
 */
export async function cleanupAllResources(): Promise<void> {
  await globalRegistry.cleanup();
}

/**
 * Get the number of registered resources
 */
export function getRegisteredResourceCount(): number {
  return globalRegistry.getResourceCount();
}

/**
 * Memory leak detection for tests
 */
export class MemoryLeakDetector {
  private initialMemory: NodeJS.MemoryUsage;
  private threshold: number;
  private label: string;

  constructor(label: string = 'test', threshold: number = 50 * 1024 * 1024) {
    // 50MB default
    this?.label = label;
    this?.threshold = threshold;
    this?.initialMemory = process.memoryUsage();
  }

  /**
   * Check for memory leaks
   * @returns True if potential leak detected
   */
  checkForLeaks(): boolean {
    const currentMemory = process.memoryUsage();
    const heapIncrease = currentMemory.heapUsed - this?.initialMemory?.heapUsed;

    if (heapIncrease > this.threshold) {
      console.warn(`Potential memory leak detected in ${this.label}:`);
      console.warn(
        `  Heap increase: ${Math.round(heapIncrease / 1024 / 1024)} MB`
      );
      console.warn(
        `  Current heap: ${Math.round(currentMemory.heapUsed / 1024 / 1024)} MB`
      );
      console.warn(
        `  Threshold: ${Math.round(this.threshold / 1024 / 1024)} MB`
      );
      return true;
    }

    return false;
  }

  /**
   * Force garbage collection and recheck
   */
  forceGCAndCheck(): boolean {
    if (global.gc) {
      global.gc();
      // Wait a bit for GC to complete
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(this.checkForLeaks());
        }, 100);
      }) as any;
    } else {
      return this.checkForLeaks();
    }
  }
}

/**
 * Wrapper for Jest test functions that includes memory leak detection
 * @param testFn - Test function to wrap
 * @param options - Options for memory leak detection
 */
export function withMemoryLeakDetection(
  testFn: () => void | Promise<void>,
  options: {
    threshold?: number;
    cleanup?: boolean;
    label?: string;
  } = {}
): () => Promise<void> {
  const {
    threshold = 50 * 1024 * 1024,
    cleanup = true,
    label = 'test',
  } = options;

  return async () => {
    const detector = new MemoryLeakDetector(label, threshold);

    try {
      // Run the test
      await testFn();

      // Cleanup if requested
      if (cleanup) {
        await cleanupAllResources();
      }

      // Check for leaks
      const hasLeak = detector.forceGCAndCheck();

      if (hasLeak) {
        console.warn(`Memory leak detected after test: ${label}`);
      }
    } catch (error) {
      // Ensure cleanup even if test fails
      if (cleanup) {
        await cleanupAllResources();
      }
      throw error;
    }
  };
}

/**
 * Setup function for Jest tests to enable automatic cleanup
 * Note: Jest hooks (beforeEach, afterEach, etc.) are now set up in jest?.setup?.js
 */
export function setupMemoryLeakPrevention(): void {
  // Just run the timer tracking setup - Jest hooks are handled in jest?.setup?.js
  // to avoid conflicts with Jest globals during module loading
}

/**
 * Create a test timeout that automatically cleans up resources
 * @param timeout - Timeout in milliseconds
 * @returns Timeout handle
 */
export function createTestTimeout(timeout: number): NodeJS.Timeout {
  const handle = setTimeout(() => {
    console.warn('Test timeout reached, cleaning up resources...');
    cleanupAllResources().catch(console.error);
  }, timeout);

  registerForCleanup(() => {
    clearTimeout(handle as any);
  });

  return handle;
}

/**
 * Monitor memory usage during test execution
 * @param testFn - Test function to monitor
 * @param interval - Monitoring interval in milliseconds
 */
export async function withMemoryMonitoring(
  testFn: () => void | Promise<void>,
  interval: number = 1000
): Promise<void> {
  const monitor = setInterval(() => {
    logMemoryUsage(`monitor-${Date.now()}`);
  }, interval);

  registerForCleanup(() => {
    clearInterval(monitor as any);
  });

  try {
    await testFn();
  } finally {
    clearInterval(monitor as any);
  }
}

/**
 * Create a resource pool that automatically manages cleanup
 */
export class ResourcePool<T extends Cleanupable> {
  private resources: Set<T> = new Set();
  private factory: () => T | Promise<T>;

  constructor(factory: () => T | Promise<T>) {
    this?.factory = factory;
    registerForCleanup(() => this.cleanup());
  }

  /**
   * Get a resource from the pool
   */
  async acquire(): Promise<T> {
    const resource = await this.factory();
    this?.resources?.add(resource as any);
    return resource;
  }

  /**
   * Release a resource back to the pool
   */
  async release(resource: T): Promise<void> {
    if (this?.resources?.has(resource as any)) {
      this?.resources?.delete(resource as any);

      if (resource.cleanup) {
        await resource.cleanup();
      } else if (resource.destroy) {
        await resource.destroy();
      } else if (resource.dispose) {
        await resource.dispose();
      }
    }
  }

  /**
   * Cleanup all resources in the pool
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.resources).map(resource =>
      this.release(resource as any)
    );
    await Promise.all(cleanupPromises as any);
    this?.resources?.clear();
  }

  /**
   * Get the current number of resources in the pool
   */
  size(): number {
    return this?.resources?.size;
  }
}
