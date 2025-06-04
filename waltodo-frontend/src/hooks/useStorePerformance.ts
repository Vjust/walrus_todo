/**
 * React hook for monitoring store performance
 */

import { useEffect, useRef, useState } from 'react';
import { storePerformanceMonitor } from '@/stores/performance-monitor';

export interface PerformanceMetrics {
  totalActions: number;
  slowActionsCount: number;
  avgExecutionTime: number;
  slowActionPercentage: number;
  lastSlowAction?: {
    actionName: string;
    storeName: string;
    executionTime: number;
  };
}

/**
 * Hook to monitor store performance in real-time
 */
export function useStorePerformance(updateInterval: number = 10000): PerformanceMetrics {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalActions: 0,
    slowActionsCount: 0,
    avgExecutionTime: 0,
    slowActionPercentage: 0,
  });

  useEffect(() => {
    const updateMetrics = () => {
      const summary = storePerformanceMonitor.getPerformanceSummary();
      const lastSlowAction = summary.slowActions[summary.slowActions.length - 1];
      
      setMetrics({
        totalActions: summary.totalActions,
        slowActionsCount: summary.slowActionsCount,
        avgExecutionTime: summary.avgExecutionTime,
        slowActionPercentage: summary.slowActionPercentage,
        lastSlowAction: lastSlowAction ? {
          actionName: lastSlowAction.actionName,
          storeName: lastSlowAction.storeName,
          executionTime: lastSlowAction.executionTime,
        } : undefined,
      });
    };

    // Initial update
    updateMetrics();

    // Set up interval for updates
    const interval = setInterval(updateMetrics, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  return metrics;
}

/**
 * Hook to monitor performance of specific store
 */
export function useStoreSpecificPerformance(storeName: string): {
  totalActions: number;
  slowActions: number;
  avgExecutionTime: number;
  maxExecutionTime: number;
} {
  const [metrics, setMetrics] = useState({
    totalActions: 0,
    slowActions: 0,
    avgExecutionTime: 0,
    maxExecutionTime: 0,
  });

  useEffect(() => {
    const updateMetrics = () => {
      const summary = storePerformanceMonitor.getPerformanceSummary();
      const storeStats = summary.storeStats.find(s => s.storeName === storeName);
      
      if (storeStats) {
        setMetrics({
          totalActions: storeStats.totalActions,
          slowActions: storeStats.slowActions,
          avgExecutionTime: storeStats.avgExecutionTime,
          maxExecutionTime: storeStats.maxExecutionTime,
        });
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 10000);
    return () => clearInterval(interval);
  }, [storeName]);

  return metrics;
}

/**
 * Hook to track component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const [avgRenderTime, setAvgRenderTime] = useState<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    renderCount.current += 1;
    
    // Update running average
    setAvgRenderTime(prev => {
      const count = renderCount.current;
      return (prev * (count - 1) + renderTime) / count;
    });

    // Log slow renders
    if (renderTime > 16) {
      console.warn(
        `🐌 Slow component render: ${componentName} took ${renderTime.toFixed(2)}ms`
      );
    }
  });

  return {
    avgRenderTime,
    renderCount: renderCount.current,
  };
}

/**
 * Hook to track subscription performance for Zustand selectors
 */
export function useSubscriptionPerformance<T>(
  selector: (state: T) => any,
  selectorName: string
) {
  const lastExecutionTime = useRef<number>(0);
  const executionCount = useRef<number>(0);
  const [performanceData, setPerformanceData] = useState({
    avgExecutionTime: 0,
    executionCount: 0,
    lastExecutionTime: 0,
  });

  // Wrap the selector to measure performance
  const measuredSelector = (state: T) => {
    const startTime = performance.now();
    const result = selector(state);
    const executionTime = performance.now() - startTime;
    
    executionCount.current += 1;
    lastExecutionTime.current = executionTime;
    
    // Update performance data periodically
    if (executionCount.current % 10 === 0) {
      setPerformanceData(prev => ({
        avgExecutionTime: (prev.avgExecutionTime * (executionCount.current - 1) + executionTime) / executionCount.current,
        executionCount: executionCount.current,
        lastExecutionTime: executionTime,
      }));
    }
    
    // Log slow selectors
    if (executionTime > 8) {
      console.warn(
        `🐌 Slow selector: ${selectorName} took ${executionTime.toFixed(2)}ms`
      );
    }
    
    return result;
  };

  return {
    selector: measuredSelector,
    performanceData,
  };
}

/**
 * Hook for debugging store performance issues
 */
export function useStoreDebugger() {
  return {
    getPerformanceSummary: () => storePerformanceMonitor.getPerformanceSummary(),
    getSlowActions: (storeName?: string) => 
      storeName 
        ? storePerformanceMonitor.getSlowActionsForStore(storeName)
        : storePerformanceMonitor.getPerformanceSummary().slowActions,
    clearMetrics: () => storePerformanceMonitor.clearMetrics(),
    exportMetrics: () => storePerformanceMonitor.exportMetrics(),
    setThreshold: (ms: number) => storePerformanceMonitor.setThreshold(ms),
  };
}