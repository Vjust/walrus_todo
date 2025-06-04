/**
 * Performance monitoring utilities for Zustand stores
 */

interface ActionMetrics {
  actionName: string;
  storeName: string;
  executionTime: number;
  timestamp: number;
  isSlowAction: boolean;
}

class StorePerformanceMonitor {
  private metrics: ActionMetrics[] = [];
  private maxMetrics = 200;
  private slowActionThreshold = 16; // 16ms = 1 frame at 60fps
  private enabled = process.env.NODE_ENV === 'development';

  /**
   * Record action execution time
   */
  recordAction(storeName: string, actionName: string, executionTime: number) {
    if (!this.enabled) return;

    const metric: ActionMetrics = {
      actionName,
      storeName,
      executionTime,
      timestamp: Date.now(),
      isSlowAction: executionTime > this.slowActionThreshold,
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow actions
    if (metric.isSlowAction) {
      console.warn(
        `🐌 Slow store action: ${storeName}.${actionName} took ${executionTime.toFixed(2)}ms`
      );
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const slowActions = this.metrics.filter(m => m.isSlowAction);
    const totalActions = this.metrics.length;
    const avgExecutionTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalActions;

    // Group by store
    const byStore: Record<string, ActionMetrics[]> = {};
    this.metrics.forEach(metric => {
      if (!byStore[metric.storeName]) {
        byStore[metric.storeName] = [];
      }
      byStore[metric.storeName].push(metric);
    });

    const storeStats = Object.entries(byStore).map(([storeName, metrics]) => ({
      storeName,
      totalActions: metrics.length,
      slowActions: metrics.filter(m => m.isSlowAction).length,
      avgExecutionTime: metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length,
      maxExecutionTime: Math.max(...metrics.map(m => m.executionTime)),
    }));

    return {
      totalActions,
      slowActionsCount: slowActions.length,
      avgExecutionTime,
      slowActionPercentage: (slowActions.length / totalActions) * 100,
      storeStats,
      slowActions: slowActions.slice(-10), // Last 10 slow actions
    };
  }

  /**
   * Get slow actions for specific store
   */
  getSlowActionsForStore(storeName: string) {
    return this.metrics
      .filter(m => m.storeName === storeName && m.isSlowAction)
      .sort((a, b) => b.executionTime - a.executionTime);
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = [];
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics() {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Set slow action threshold
   */
  setThreshold(ms: number) {
    this.slowActionThreshold = ms;
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

// Global performance monitor instance
export const storePerformanceMonitor = new StorePerformanceMonitor();

/**
 * Performance decorator for store actions
 */
export function measureStoreAction<T extends (...args: any[]) => any>(
  storeName: string,
  actionName: string,
  action: T
): T {
  return ((...args: any[]) => {
    const startTime = performance.now();
    const result = action(...args);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    storePerformanceMonitor.recordAction(storeName, actionName, executionTime);

    return result;
  }) as T;
}

/**
 * Throttled action wrapper to prevent excessive updates
 */
export function throttleAction<T extends (...args: any[]) => any>(
  action: T,
  delay: number = 16 // Default to 16ms (60fps)
): T {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: any[]) => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      lastCall = now;
      return action(...args);
    } else {
      // Queue the action to run after the delay
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        action(...args);
        timeoutId = null;
      }, delay - (now - lastCall));
    }
  }) as T;
}

/**
 * Debounced action wrapper for actions that should only run after input stops
 */
export function debounceAction<T extends (...args: any[]) => any>(
  action: T,
  delay: number = 300
): T {
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      action(...args);
      timeoutId = null;
    }, delay);
  }) as T;
}

/**
 * Batched action wrapper for actions that can be batched together
 */
export function batchActions<T extends (...args: any[]) => any>(
  action: T,
  batchSize: number = 10,
  batchDelay: number = 16
): T {
  let batch: any[][] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  const processBatch = () => {
    if (batch.length === 0) return;
    
    const currentBatch = [...batch];
    batch = [];
    
    // Process all batched calls
    currentBatch.forEach(args => action(...args));
    timeoutId = null;
  };

  return ((...args: any[]) => {
    batch.push(args);
    
    // Process immediately if batch is full
    if (batch.length >= batchSize) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      processBatch();
    } else if (!timeoutId) {
      // Schedule batch processing
      timeoutId = setTimeout(processBatch, batchDelay);
    }
  }) as T;
}

/**
 * Selective subscription helper for better performance
 */
export function createSelector<T, R>(
  selector: (state: T) => R,
  equalityFn?: (a: R, b: R) => boolean
) {
  let lastResult: R;
  let hasResult = false;

  return (state: T): R => {
    const newResult = selector(state);
    
    if (!hasResult || (equalityFn ? !equalityFn(lastResult, newResult) : lastResult !== newResult)) {
      lastResult = newResult;
      hasResult = true;
    }
    
    return lastResult;
  };
}

/**
 * Global debug utilities for performance monitoring
 */
export const debugPerformance = {
  getSummary: () => storePerformanceMonitor.getPerformanceSummary(),
  getSlowActions: (storeName?: string) => 
    storeName 
      ? storePerformanceMonitor.getSlowActionsForStore(storeName)
      : storePerformanceMonitor.getPerformanceSummary().slowActions,
  clearMetrics: () => storePerformanceMonitor.clearMetrics(),
  exportMetrics: () => storePerformanceMonitor.exportMetrics(),
  setThreshold: (ms: number) => storePerformanceMonitor.setThreshold(ms),
  setEnabled: (enabled: boolean) => storePerformanceMonitor.setEnabled(enabled),
};

// Make debug utilities globally available in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).debugPerformance = debugPerformance;
}