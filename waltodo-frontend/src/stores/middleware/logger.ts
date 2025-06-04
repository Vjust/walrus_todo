/**
 * Logger middleware for Zustand stores
 * Provides structured logging for store actions and state changes
 */

export interface LogEntry {
  timestamp: string;
  storeName: string;
  action: string;
  prevState: any;
  nextState: any;
  duration: number;
}

class StoreLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private enabled = process.env.NODE_ENV === 'development';

  /**
   * Log a store action with timing information
   */
  logAction(
    storeName: string,
    action: string,
    prevState: any,
    nextState: any,
    startTime: number
  ) {
    if (!this.enabled) {return;}

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      storeName,
      action,
      prevState: this.sanitizeState(prevState),
      nextState: this.sanitizeState(nextState),
      duration: performance.now() - startTime,
    };

    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with proper formatting
    this.outputToConsole(entry);
  }

  /**
   * Get all logged entries
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON for debugging
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Filter logs by store name or action pattern
   */
  filterLogs(filter: { storeName?: string; action?: string; since?: Date }) {
    return this.logs.filter(log => {
      if (filter.storeName && !log.storeName.includes(filter.storeName)) {
        return false;
      }
      if (filter.action && !log.action.includes(filter.action)) {
        return false;
      }
      if (filter.since && new Date(log.timestamp) < filter.since) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const durations = this.logs.map(log => log.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const slowActions = this.logs.filter(log => log.duration > 16); // > 1 frame

    return {
      totalActions: this.logs.length,
      averageDuration: avgDuration,
      maxDuration,
      slowActionsCount: slowActions.length,
      slowActions: slowActions.map(log => ({
        action: log.action,
        storeName: log.storeName,
        duration: log.duration,
      })),
    };
  }

  /**
   * Remove sensitive data from state for logging
   */
  private sanitizeState(state: any): any {
    if (typeof state !== 'object' || state === null) {
      return state;
    }

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'private',
      'credential',
      'auth',
    ];

    const sanitized = { ...state };

    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeState(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Output formatted log entry to console
   */
  private outputToConsole(entry: LogEntry) {
    const { storeName, action, duration } = entry;
    
    // Color coding based on performance
    const color = duration > 16 ? '#ff6b6b' : duration > 8 ? '#ffd93d' : '#51cf66';
    
    console.groupCollapsed(
      `%c🏪 ${storeName} %c${action} %c${duration.toFixed(2)}ms`,
      'color: #74c0fc; font-weight: bold',
      'color: #495057',
      `color: ${color}; font-weight: bold`
    );
    
    console.log('Previous State:', entry.prevState);
    console.log('Next State:', entry.nextState);
    console.log('State Diff:', this.getStateDiff(entry.prevState, entry.nextState));
    console.log('Timestamp:', entry.timestamp);
    
    if (duration > 16) {
      console.warn('⚠️ This action took longer than 16ms (1 frame)');
    }
    
    console.groupEnd();
  }

  /**
   * Calculate state differences for logging
   */
  getStateDiff(prev: any, next: any): any {
    if (prev === next) {return 'No changes';}
    
    if (typeof prev !== 'object' || typeof next !== 'object') {
      return { from: prev, to: next };
    }

    const diff: any = {};
    const prevKeys = Object.keys(prev || {});
    const nextKeys = Object.keys(next || {});
    const allKeys = [...prevKeys, ...nextKeys].filter((key, index, arr) => arr.indexOf(key) === index);

    for (const key of allKeys) {
      if (prev[key] !== next[key]) {
        if (typeof prev[key] === 'object' && typeof next[key] === 'object') {
          const nestedDiff = this.getStateDiff(prev[key], next[key]);
          if (nestedDiff !== 'No changes') {
            diff[key] = nestedDiff;
          }
        } else {
          diff[key] = { from: prev[key], to: next[key] };
        }
      }
    }

    return Object.keys(diff).length > 0 ? diff : 'No changes';
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Set maximum number of logs to keep
   */
  setMaxLogs(max: number) {
    this.maxLogs = max;
    if (this.logs.length > max) {
      this.logs = this.logs.slice(-max);
    }
  }
}

// Global logger instance
export const storeLogger = new StoreLogger();

/**
 * Logger middleware factory
 */
export const logger = <T>(
  storeName: string,
  config: (set: any, get: any, api: any) => T
) => {
  return (set: any, get: any, api: any) => {
    const loggedSet = (partial: any, replace?: boolean) => {
      const startTime = performance.now();
      const prevState = get();
      
      // Execute the actual state update
      const result = set(partial, replace);
      
      const nextState = get();
      
      // Only log if state actually changed
      if (prevState !== nextState) {
        // Check for deep equality to avoid logging "No changes"
        const stateDiff = storeLogger.getStateDiff(prevState, nextState);
        if (stateDiff !== 'No changes') {
          // Determine action name from call stack or function name
          const action = getActionName(partial);
          
          // Log the action
          storeLogger.logAction(storeName, action, prevState, nextState, startTime);
        }
      }
      
      return result;
    };

    return config(loggedSet, get, api);
  };
};

/**
 * Helper to extract action name from the set call
 */
function getActionName(partial: any): string {
  if (typeof partial === 'function') {
    return partial.name || 'anonymous action';
  }
  
  if (typeof partial === 'object' && partial !== null) {
    const keys = Object.keys(partial);
    if (keys.length === 1) {
      return `set ${keys[0]}`;
    }
    if (keys.length > 1) {
      return `update ${keys.join(', ')}`;
    }
  }
  
  return 'state update';
}

/**
 * Performance monitoring decorator with better measurement
 */
export const withPerformanceMonitoring = <T extends (...args: any[]) => any>(
  storeName: string,
  actionName: string,
  fn: T
): T => {
  return ((...args: any[]) => {
    // Only measure performance in development and for actions that might be slow
    if (process.env.NODE_ENV !== 'development') {
      return fn(...args);
    }
    
    const startTime = performance.now();
    const result = fn(...args);
    const duration = performance.now() - startTime;
    
    // Only record if action is slow enough to matter
    if (duration > 1) {
      // Record metrics for analysis
      if (typeof window !== 'undefined' && (window as any).debugPerformance) {
        (window as any).debugPerformance.recordAction?.(storeName, actionName, duration);
      }
      
      if (duration > 16) {
        console.warn(
          `🐌 Slow action in ${storeName}: ${actionName} took ${duration.toFixed(2)}ms`,
          { args, duration }
        );
      }
    }
    
    return result;
  }) as T;
};

/**
 * Global debug utilities
 */
export const debugStores = {
  /**
   * Export all store logs
   */
  exportLogs: () => storeLogger.exportLogs(),
  
  /**
   * Clear all store logs
   */
  clearLogs: () => storeLogger.clearLogs(),
  
  /**
   * Get performance statistics
   */
  getStats: () => storeLogger.getPerformanceStats(),
  
  /**
   * Filter logs by criteria
   */
  filterLogs: (filter: Parameters<typeof storeLogger.filterLogs>[0]) => 
    storeLogger.filterLogs(filter),
  
  /**
   * Enable/disable logging
   */
  setLogging: (enabled: boolean) => storeLogger.setEnabled(enabled),
};

// Make debug utilities available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).debugStores = debugStores;
}