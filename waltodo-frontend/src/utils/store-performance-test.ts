/**
 * Performance testing utilities for Zustand stores
 */

import { useUIStore } from '@/stores/ui-store';
import { useWalletStore } from '@/stores/wallet-store';
import { useTodoStore } from '@/stores/todo-store';
import { useAppStore } from '@/stores/app-store';

interface PerformanceTestResult {
  actionName: string;
  storeName: string;
  averageTime: number;
  maxTime: number;
  minTime: number;
  totalRuns: number;
  slowActionCount: number;
}

/**
 * Test store action performance
 */
export async function testStorePerformance(): Promise<PerformanceTestResult[]> {
  const results: PerformanceTestResult[] = [];
  const testIterations = 100;
  const slowActionThreshold = 16; // 16ms = 1 frame at 60fps

  // Test UI Store actions
  const uiTestResults = await runUIStoreTests(testIterations, slowActionThreshold);
  results.push(...uiTestResults);

  // Test Wallet Store actions
  const walletTestResults = await runWalletStoreTests(testIterations, slowActionThreshold);
  results.push(...walletTestResults);

  // Test Todo Store actions
  const todoTestResults = await runTodoStoreTests(testIterations, slowActionThreshold);
  results.push(...todoTestResults);

  // Test App Store actions
  const appTestResults = await runAppStoreTests(testIterations, slowActionThreshold);
  results.push(...appTestResults);

  return results;
}

async function runUIStoreTests(iterations: number, threshold: number): Promise<PerformanceTestResult[]> {
  const results: PerformanceTestResult[] = [];
  
  // Test modal operations
  const modalTimes = await measureActionPerformance(
    'UI Store',
    'modal operations',
    iterations,
    () => {
      useUIStore.getState().openModal('createTodo');
      useUIStore.getState().closeModal('createTodo');
    }
  );
  results.push(createTestResult('modal operations', 'UI Store', modalTimes, threshold));

  // Test form updates
  const formTimes = await measureActionPerformance(
    'UI Store',
    'form updates',
    iterations,
    () => {
      useUIStore.getState().updateForm('createTodo', { title: 'Test Todo' });
      useUIStore.getState().resetForm('createTodo');
    }
  );
  results.push(createTestResult('form updates', 'UI Store', formTimes, threshold));

  // Test search operations
  const searchTimes = await measureActionPerformance(
    'UI Store',
    'search operations',
    iterations,
    () => {
      useUIStore.getState().setSearchQuery('test');
      useUIStore.getState().setFilter('status', 'completed');
      useUIStore.getState().clearFilters();
    }
  );
  results.push(createTestResult('search operations', 'UI Store', searchTimes, threshold));

  return results;
}

async function runWalletStoreTests(iterations: number, threshold: number): Promise<PerformanceTestResult[]> {
  const results: PerformanceTestResult[] = [];

  // Test connection operations
  const connectionTimes = await measureActionPerformance(
    'Wallet Store',
    'connection operations',
    iterations,
    () => {
      useWalletStore.getState().setConnectionStatus('connecting');
      useWalletStore.getState().setAccount('0x123...abc', 'Test Wallet');
      useWalletStore.getState().setConnectionStatus('connected');
    }
  );
  results.push(createTestResult('connection operations', 'Wallet Store', connectionTimes, threshold));

  // Test transaction operations
  const transactionTimes = await measureActionPerformance(
    'Wallet Store',
    'transaction operations',
    iterations,
    () => {
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      useWalletStore.getState().addTransaction({
        id: txId,
        status: 'pending',
        type: 'todo_create',
      });
      useWalletStore.getState().updateTransaction(txId, { status: 'success' });
    }
  );
  results.push(createTestResult('transaction operations', 'Wallet Store', transactionTimes, threshold));

  return results;
}

async function runTodoStoreTests(iterations: number, threshold: number): Promise<PerformanceTestResult[]> {
  const results: PerformanceTestResult[] = [];

  // Test todo CRUD operations
  const crudTimes = await measureActionPerformance(
    'Todo Store',
    'CRUD operations',
    iterations,
    () => {
      const todoId = `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add todo
      useTodoStore.getState().addTodo('default', {
        title: 'Test Todo',
        description: 'Test Description',
        priority: 'medium',
        completed: false,
        tags: ['test'],
        category: 'work',
        private: false,
      });

      // Update todo
      useTodoStore.getState().updateTodo('default', todoId, { title: 'Updated Todo' });
      
      // Complete todo
      useTodoStore.getState().completeTodo('default', todoId);
      
      // Delete todo
      useTodoStore.getState().deleteTodo('default', todoId);
    }
  );
  results.push(createTestResult('CRUD operations', 'Todo Store', crudTimes, threshold));

  // Test bulk operations
  const bulkTimes = await measureActionPerformance(
    'Todo Store',
    'bulk operations',
    iterations,
    () => {
      const updates = Array.from({ length: 10 }, (_, i) => ({
        id: `todo_${i}`,
        updates: { title: `Bulk Updated Todo ${i}` }
      }));
      
      useTodoStore.getState().bulkUpdateTodos('default', updates);
    }
  );
  results.push(createTestResult('bulk operations', 'Todo Store', bulkTimes, threshold));

  return results;
}

async function runAppStoreTests(iterations: number, threshold: number): Promise<PerformanceTestResult[]> {
  const results: PerformanceTestResult[] = [];

  // Test network status updates
  const networkTimes = await measureActionPerformance(
    'App Store',
    'network updates',
    iterations,
    () => {
      useAppStore.getState().updateNetworkStatus('sui', 'healthy', 50);
      useAppStore.getState().updateNetworkStatus('walrus', 'degraded', 100);
      useAppStore.getState().updateNetworkStatus('api', 'healthy', 25);
    }
  );
  results.push(createTestResult('network updates', 'App Store', networkTimes, threshold));

  // Test performance tracking
  const performanceTimes = await measureActionPerformance(
    'App Store',
    'performance tracking',
    iterations,
    () => {
      useAppStore.getState().recordRender(Math.random() * 20);
      useAppStore.getState().updateMemoryUsage(Math.random() * 100);
    }
  );
  results.push(createTestResult('performance tracking', 'App Store', performanceTimes, threshold));

  return results;
}

async function measureActionPerformance(
  storeName: string,
  actionName: string,
  iterations: number,
  action: () => void
): Promise<number[]> {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    
    try {
      action();
    } catch (error) {
      console.warn(`Error in ${storeName} ${actionName}:`, error);
    }
    
    const endTime = performance.now();
    times.push(endTime - startTime);
    
    // Small delay to prevent overwhelming the store
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  return times;
}

function createTestResult(
  actionName: string,
  storeName: string,
  times: number[],
  threshold: number
): PerformanceTestResult {
  const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const slowActionCount = times.filter(time => time > threshold).length;

  return {
    actionName,
    storeName,
    averageTime,
    maxTime,
    minTime,
    totalRuns: times.length,
    slowActionCount,
  };
}

/**
 * Log performance test results in a readable format
 */
export function logPerformanceResults(results: PerformanceTestResult[]): void {
  console.group('🚀 Store Performance Test Results');
  
  const failedTests = results.filter(result => result.averageTime > 16);
  const passedTests = results.filter(result => result.averageTime <= 16);
  
  if (passedTests.length > 0) {
    console.group('✅ Passed Tests (< 16ms average)');
    console.table(passedTests.map(result => ({
      'Store': result.storeName,
      'Action': result.actionName,
      'Avg (ms)': result.averageTime.toFixed(2),
      'Max (ms)': result.maxTime.toFixed(2),
      'Slow Actions': `${result.slowActionCount}/${result.totalRuns}`,
    })));
    console.groupEnd();
  }
  
  if (failedTests.length > 0) {
    console.group('❌ Failed Tests (> 16ms average)');
    console.table(failedTests.map(result => ({
      'Store': result.storeName,
      'Action': result.actionName,
      'Avg (ms)': result.averageTime.toFixed(2),
      'Max (ms)': result.maxTime.toFixed(2),
      'Slow Actions': `${result.slowActionCount}/${result.totalRuns}`,
    })));
    console.groupEnd();
  }
  
  const overallStats = {
    'Total Tests': results.length,
    'Passed': passedTests.length,
    'Failed': failedTests.length,
    'Success Rate': `${((passedTests.length / results.length) * 100).toFixed(1)}%`,
    'Overall Avg (ms)': (results.reduce((sum, r) => sum + r.averageTime, 0) / results.length).toFixed(2),
  };
  
  console.table(overallStats);
  console.groupEnd();
}

/**
 * Run performance test and log results
 */
export async function runPerformanceTest(): Promise<void> {
  console.log('🧪 Starting store performance tests...');
  
  try {
    const results = await testStorePerformance();
    logPerformanceResults(results);
    
    // Make results available globally for debugging
    if (typeof window !== 'undefined') {
      (window as any).storePerformanceResults = results;
    }
  } catch (error) {
    console.error('Performance test failed:', error);
  }
}

// Make test function globally available in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).runStorePerformanceTest = runPerformanceTest;
}