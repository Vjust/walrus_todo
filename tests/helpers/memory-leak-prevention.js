/**
 * Memory Leak Prevention Utilities for Jest Tests
 * Provides utilities to prevent memory leaks during test execution
 */

const activeResources = new Set();
const originalTimers = {
  setTimeout: global.setTimeout,
  setInterval: global.setInterval,
  setImmediate: global.setImmediate,
};

/**
 * Setup memory leak prevention
 */
function setupMemoryLeakPrevention() {
  // Track timers to prevent memory leaks
  global.setTimeout = function (callback, ms, ...args) {
    const timer = originalTimers.setTimeout.call(this, callback, ms, ...args);
    activeResources.add({ type: 'timeout', timer });
    return timer;
  };

  global.setInterval = function (callback, ms, ...args) {
    const timer = originalTimers.setInterval.call(this, callback, ms, ...args);
    activeResources.add({ type: 'interval', timer });
    return timer;
  };

  global.setImmediate = function (callback, ...args) {
    const timer = originalTimers.setImmediate.call(this, callback, ...args);
    activeResources.add({ type: 'immediate', timer });
    return timer;
  };

  // Track clear operations
  const originalClearTimeout = global.clearTimeout;
  global.clearTimeout = function (timer) {
    activeResources.forEach(resource => {
      if (resource.timer === timer) {
        activeResources.delete(resource);
      }
    });
    return originalClearTimeout.call(this, timer);
  };

  const originalClearInterval = global.clearInterval;
  global.clearInterval = function (timer) {
    activeResources.forEach(resource => {
      if (resource.timer === timer) {
        activeResources.delete(resource);
      }
    });
    return originalClearInterval.call(this, timer);
  };

  const originalClearImmediate = global.clearImmediate;
  global.clearImmediate = function (timer) {
    activeResources.forEach(resource => {
      if (resource.timer === timer) {
        activeResources.delete(resource);
      }
    });
    return originalClearImmediate.call(this, timer);
  };

  // Global cleanup function
  global.clearAllTimers = function () {
    activeResources.forEach(resource => {
      try {
        switch (resource.type) {
          case 'timeout':
            clearTimeout(resource.timer);
            break;
          case 'interval':
            clearInterval(resource.timer);
            break;
          case 'immediate':
            clearImmediate(resource.timer);
            break;
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    activeResources.clear();
  };
}

/**
 * Cleanup all tracked resources
 */
function cleanupAllResources() {
  // Clear all tracked timers
  if (global.clearAllTimers) {
    global.clearAllTimers();
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Clear any remaining event listeners
  if (process.removeAllListeners) {
    process.removeAllListeners();
  }

  // Reset active resources tracking
  activeResources.clear();

  // Restore original timer functions
  Object.assign(global, originalTimers);
}

/**
 * Get memory usage statistics
 */
function getMemoryStats() {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
    externalMB: Math.round(usage.external / 1024 / 1024),
    rss: Math.round(usage.rss / 1024 / 1024),
    activeResourcesCount: activeResources.size,
  };
}

/**
 * Check for memory leaks
 */
function checkMemoryLeaks() {
  const stats = getMemoryStats();
  const leaks = [];

  if (activeResources.size > 0) {
    leaks.push(`${activeResources.size} active timers not cleaned up`);
  }

  if (stats.heapUsedMB > 512) {
    leaks.push(`High heap usage: ${stats.heapUsedMB}MB`);
  }

  return {
    hasLeaks: leaks.length > 0,
    leaks,
    stats,
  };
}

module.exports = {
  setupMemoryLeakPrevention,
  cleanupAllResources,
  getMemoryStats,
  checkMemoryLeaks,
};
