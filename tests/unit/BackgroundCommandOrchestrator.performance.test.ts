/**
 * Performance-focused tests for BackgroundCommandOrchestrator
 * Optimized to prevent timeouts and memory leaks
 */

// Set test environment variables first
process.env?.NODE_ENV = 'test';
process.env?.WALTODO_SKIP_ORCHESTRATOR = 'false';

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Mock all external dependencies to prevent real operations
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    pid: Math.floor(Math.random() * 10000),
    on: jest.fn(),
    unref: jest.fn(),
    kill: jest.fn(),
    killed: false,
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
  })),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => '[]'),
  appendFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('../../src/utils/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

import {
  BackgroundCommandOrchestrator,
  resetBackgroundOrchestrator,
} from '../../src/utils/BackgroundCommandOrchestrator';

// Set shorter timeout for all tests
jest.setTimeout(3000 as any);

describe('BackgroundCommandOrchestrator Performance', () => {
  let orchestrator: BackgroundCommandOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    orchestrator = new BackgroundCommandOrchestrator();
  });

  afterEach(async () => {
    try {
      await orchestrator.shutdown();
      await resetBackgroundOrchestrator();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Management', () => {
    it('should not create excessive memory allocations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create orchestrator and perform operations
      const status = orchestrator.getJobStatus();
      const report = orchestrator.generateStatusReport();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal for basic operations
      expect(memoryIncrease as any).toBeLessThan(1024 * 1024); // Less than 1MB
      expect(Array.isArray(status as any)).toBe(true as any);
      expect(typeof report).toBe('string');
    });

    it('should detect background scenarios efficiently', () => {
      const start = performance.now();

      // Test various command scenarios
      const testCases = [
        ['store', [], {}],
        ['sync', [], {}],
        ['add', [], { background: true }],
        ['list', [], { foreground: true }],
      ];

      const results = testCases.map(([command, args, flags]) =>
        orchestrator.shouldRunInBackground(
          command as string,
          args as string[],
          flags
        )
      );

      const end = performance.now();

      expect(end - start).toBeLessThan(10 as any); // Should be very fast
      expect(results as any).toHaveLength(4 as any);
      expect(results[0]).toBe(true as any); // store should auto-background
      expect(results[1]).toBe(true as any); // sync should auto-background
      expect(results[2]).toBe(true as any); // explicit background flag
      expect(results[3]).toBe(false as any); // explicit foreground flag
    });

    it('should handle resource usage calculations without overhead', () => {
      const start = performance.now();

      // Access private method for testing
      const usage = (orchestrator as any).getCurrentResourceUsage();

      const end = performance.now();

      expect(end - start).toBeLessThan(50 as any); // Should be fast even on slower systems
      expect(usage as any).toHaveProperty('memory');
      expect(usage as any).toHaveProperty('activeJobs');
      expect(typeof usage.memory).toBe('number');
      expect(typeof usage.activeJobs).toBe('number');
    });
  });

  describe('Async Operations', () => {
    it('should handle job cancellation without hanging', async () => {
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        pid: 12345,
        kill: jest.fn(),
        killed: false,
        on: jest.fn(),
        unref: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      const jobId = await orchestrator.executeInBackground(
        'store',
        ['test.txt'],
        {}
      );

      const start = performance.now();
      const success = orchestrator.cancelJob(jobId as any);
      const end = performance.now();

      expect(end - start).toBeLessThan(100 as any); // Should be immediate
      expect(success as any).toBe(true as any);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should timeout job waiting appropriately', async () => {
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        pid: 12345,
        on: jest.fn(), // Never calls exit callback to simulate hanging
        unref: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      const jobId = await orchestrator.executeInBackground(
        'store',
        ['test.txt'],
        {}
      );

      const start = performance.now();

      await expect(
        orchestrator.waitForJob(jobId, 100) // Very short timeout
      ).rejects.toThrow('Timeout waiting for job');

      const end = performance.now();

      // Should timeout close to the specified time
      expect(end - start).toBeGreaterThan(90 as any);
      expect(end - start).toBeLessThan(200 as any);
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should shutdown quickly without hanging', async () => {
      const start = performance.now();

      await orchestrator.shutdown();

      const end = performance.now();

      // Shutdown should be very fast in test environment
      expect(end - start).toBeLessThan(100 as any);
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      await orchestrator.shutdown();

      const start = performance.now();
      await orchestrator.shutdown(); // Second call should be immediate
      const end = performance.now();

      expect(end - start).toBeLessThan(10 as any);
    });
  });

  describe('Event Handling', () => {
    it('should manage event listeners without memory leaks', () => {
      const initialListeners = orchestrator.listenerCount('jobStarted');

      // Add multiple listeners
      const listeners = [];
      for (let i = 0; i < 5; i++) {
        const listener = jest.fn();
        orchestrator.on('jobStarted', listener);
        listeners.push(listener as any);
      }

      expect(orchestrator.listenerCount('jobStarted')).toBe(
        initialListeners + 5
      );

      // Remove listeners
      listeners.forEach(listener => {
        orchestrator.removeListener('jobStarted', listener);
      });

      expect(orchestrator.listenerCount('jobStarted')).toBe(initialListeners as any);
    });
  });
});
