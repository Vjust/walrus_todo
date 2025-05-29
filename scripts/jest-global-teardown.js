/**
 * Global Jest teardown to ensure proper cleanup of async operations
 * and prevent "Jest did not exit" issues
 */

module.exports = async () => {
  console.log('\n🧹 Running global test teardown...');
  
  try {
    // Force cleanup of background orchestrator if it exists
    if (global.backgroundOrchestrator) {
      try {
        await global.backgroundOrchestrator.shutdown();
        console.log('🔄 Background orchestrator shut down');
      } catch (error) {
        console.warn('⚠️  Failed to shutdown background orchestrator:', error.message);
      }
    }

    // Clear all timers and intervals
    if (typeof global.clearAllTimers === 'function') {
      global.clearAllTimers();
    }

    // Get active handles and requests before cleanup
    const activeHandles = process._getActiveHandles();
    const activeRequests = process._getActiveRequests();

    console.log(`🔍 Found ${activeHandles.length} active handles and ${activeRequests.length} active requests`);

    // Force close handles that might prevent Jest from exiting
    let closedHandles = 0;
    activeHandles.forEach((handle) => {
      if (handle && typeof handle.close === 'function') {
        try {
          handle.close();
          closedHandles++;
        } catch (error) {
          // Ignore errors during forced cleanup
        }
      } else if (handle && typeof handle.destroy === 'function') {
        try {
          handle.destroy();
          closedHandles++;
        } catch (error) {
          // Ignore errors during forced cleanup
        }
      } else if (handle && typeof handle.unref === 'function') {
        try {
          handle.unref();
          closedHandles++;
        } catch (error) {
          // Ignore errors during forced cleanup
        }
      }
    });

    // Abort active requests
    let abortedRequests = 0;
    activeRequests.forEach((request) => {
      if (request && typeof request.abort === 'function') {
        try {
          request.abort();
          abortedRequests++;
        } catch (error) {
          // Ignore errors during forced cleanup
        }
      }
    });

    if (closedHandles > 0) {
      console.log(`🚪 Closed ${closedHandles} handles`);
    }
    if (abortedRequests > 0) {
      console.log(`🛑 Aborted ${abortedRequests} requests`);
    }

    // Force multiple garbage collection cycles
    if (global.gc) {
      for (let i = 0; i < 5; i++) {
        global.gc();
      }
      console.log('🗑️  Forced multiple garbage collection cycles');
    }

    // Final check for remaining handles
    const remainingHandles = process._getActiveHandles().length;
    const remainingRequests = process._getActiveRequests().length;
    
    if (remainingHandles > 0 || remainingRequests > 0) {
      console.warn(`⚠️  ${remainingHandles} handles and ${remainingRequests} requests still active after cleanup`);
    } else {
      console.log('✅ All handles and requests cleaned up successfully');
    }

    // Memory usage after cleanup
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    console.log(`📊 Final memory usage: ${heapUsedMB}MB`);
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Error during global teardown:', error.message);
  }
};