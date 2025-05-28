/**
 * Utilities for cleaning up async operations in tests
 * to prevent Jest exit issues and memory leaks
 */

import { resetBackgroundOrchestrator } from '../../apps/cli/src/utils/BackgroundCommandOrchestrator';

// Track promises and async operations for cleanup
const activePromises = new Set<Promise<any>>();
const activeAbortControllers = new Set<AbortController>();
const activeEventEmitters = new Set<NodeJS.EventEmitter>();

/**
 * Register a promise for cleanup tracking
 */
export function trackPromise<T>(promise: Promise<T>): Promise<T> {
  activePromises.add(promise);
  
  // Remove from tracking when resolved
  promise
    .finally(() => {
      activePromises.delete(promise);
    })
    .catch(() => {
      // Ignore errors during cleanup
    });
  
  return promise;
}

/**
 * Register an AbortController for cleanup
 */
export function trackAbortController(controller: AbortController): AbortController {
  activeAbortControllers.add(controller);
  return controller;
}

/**
 * Register an EventEmitter for cleanup
 */
export function trackEventEmitter(emitter: NodeJS.EventEmitter): NodeJS.EventEmitter {
  activeEventEmitters.add(emitter);
  return emitter;
}

/**
 * Wait for all tracked promises to settle
 */
export async function waitForActivePromises(timeoutMs: number = 5000): Promise<void> {
  if (activePromises.size === 0) {
    return;
  }

  const promises = Array.from(activePromises);
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout waiting for ${promises.length} promises`)), timeoutMs);
  });

  try {
    await Promise.race([
      Promise.allSettled(promises),
      timeoutPromise
    ]);
  } catch (error) {
    console.warn(`Failed to wait for ${promises.length} active promises:`, error);
  }
}

/**
 * Abort all tracked AbortControllers
 */
export function abortAllControllers(): void {
  activeAbortControllers.forEach(controller => {
    try {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    } catch (error) {
      // Ignore errors during abort
    }
  });
  activeAbortControllers.clear();
}

/**
 * Remove all listeners from tracked EventEmitters
 */
export function cleanupEventEmitters(): void {
  activeEventEmitters.forEach(emitter => {
    try {
      emitter.removeAllListeners();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });
  activeEventEmitters.clear();
}

/**
 * Comprehensive cleanup of all async operations
 */
export async function cleanupAsyncOperations(): Promise<void> {
  // Abort all controllers first
  abortAllControllers();
  
  // Clean up event emitters
  cleanupEventEmitters();
  
  // Wait for active promises with timeout
  await waitForActivePromises(1000); // Shorter timeout for tests
  
  // Reset background orchestrator
  try {
    await resetBackgroundOrchestrator();
  } catch (error) {
    // Ignore errors during cleanup
  }
  
  // Clear remaining promises
  activePromises.clear();
}

/**
 * Setup automatic cleanup hooks for Jest
 */
export function setupAsyncCleanup(): void {
  // Override Promise constructor to track promises
  const OriginalPromise = global.Promise;
  
  global.Promise = class TrackedPromise<T> extends OriginalPromise<T> {
    constructor(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void) {
      const trackedPromise = new OriginalPromise<T>(executor);
      trackPromise(trackedPromise);
      return trackedPromise as any;
    }
  } as any;

  // Override AbortController to track instances
  const OriginalAbortController = global.AbortController;
  if (OriginalAbortController) {
    global.AbortController = class TrackedAbortController extends OriginalAbortController {
      constructor() {
        super();
        trackAbortController(this);
      }
    };
  }

  // Setup cleanup hooks
  afterEach(async () => {
    await cleanupAsyncOperations();
  });

  afterAll(() => {
    // Restore original constructors
    global.Promise = OriginalPromise;
    if (OriginalAbortController) {
      global.AbortController = OriginalAbortController;
    }
  });
}

/**
 * Create a timeout promise that can be cleaned up
 */
export function createCleanupTimeout(ms: number): Promise<void> {
  let timeoutId: NodeJS.Timeout;
  
  const promise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(resolve, ms);
  });
  
  // Add cleanup method
  (promise as any).cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
  
  return trackPromise(promise);
}

/**
 * Wrap async test functions with automatic cleanup
 */
export function withAsyncCleanup<T extends (...args: any[]) => Promise<any>>(
  testFn: T
): T {
  return (async (...args: any[]) => {
    try {
      const result = await testFn(...args);
      await cleanupAsyncOperations();
      return result;
    } catch (error) {
      await cleanupAsyncOperations();
      throw error;
    }
  }) as T;
}

/**
 * Get statistics about active async operations
 */
export function getAsyncStats() {
  return {
    activePromises: activePromises.size,
    activeAbortControllers: activeAbortControllers.size,
    activeEventEmitters: activeEventEmitters.size,
    totalTracked: activePromises.size + activeAbortControllers.size + activeEventEmitters.size
  };
}