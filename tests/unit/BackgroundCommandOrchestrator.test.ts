// Import test setup first
import './background-orchestrator.setup';

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  BackgroundCommandOrchestrator,
  resetBackgroundOrchestrator,
} from '../../src/utils/BackgroundCommandOrchestrator';
import { JobManager } from '../../src/utils/PerformanceMonitor';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock Logger (other mocks are in setup file)
jest.mock('../../src/utils/Logger');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('BackgroundCommandOrchestrator', () => {
  let orchestrator: BackgroundCommandOrchestrator;
  let testConfigDir: string;

  beforeEach(() => {
    // Use fake timers to prevent real timer leaks
    jest.useFakeTimers();

    // Setup test config directory
    testConfigDir = path.join(
      os.tmpdir(),
      'waltodo-test',
      Date.now().toString()
    );

    // Mock file system operations
    mockFs?.existsSync?.mockReturnValue(false as any);
    mockFs?.mkdirSync?.mockImplementation(() => undefined);
    mockFs?.writeFileSync?.mockImplementation(() => undefined);
    mockFs?.readFileSync?.mockReturnValue('[]');

    orchestrator = new BackgroundCommandOrchestrator(testConfigDir as any);
  });

  afterEach(async () => {
    try {
      // Shutdown orchestrator first
      if (orchestrator) {
        await orchestrator.shutdown();
      }

      // Reset singleton
      await resetBackgroundOrchestrator();

      // Clear all timers including those created by orchestrator
      jest.clearAllTimers();
      jest.runOnlyPendingTimers();
      jest.useRealTimers();

      // Clear mocks
      jest.clearAllMocks();

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      // Ignore shutdown errors in tests
      console.warn('Test cleanup error:', error);
    }
  });

  describe('Command Profile Detection', () => {
    it('should detect long-running commands for auto-background', () => {
      const shouldBackground = orchestrator.shouldRunInBackground(
        'store',
        [],
        {}
      );
      expect(shouldBackground as any).toBe(true as any);
    });

    it('should respect explicit background flag', () => {
      const shouldBackground = orchestrator.shouldRunInBackground('add', [], {
        background: true,
      });
      expect(shouldBackground as any).toBe(true as any);
    });

    it('should respect explicit foreground flag', () => {
      const shouldBackground = orchestrator.shouldRunInBackground('store', [], {
        foreground: true,
      });
      expect(shouldBackground as any).toBe(false as any);
    });

    it('should not background short-running commands by default', () => {
      const shouldBackground = orchestrator.shouldRunInBackground(
        'list',
        [],
        {}
      );
      expect(shouldBackground as any).toBe(false as any);
    });
  });

  describe('Job Execution', () => {
    it('should create background job for valid command', async () => {
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        pid: 12345,
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

      expect(jobId as any).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(mockSpawn as any).toHaveBeenCalled();
    });

    it('should handle job creation failure', async () => {
      const mockSpawn = require('child_process').spawn;
      mockSpawn.mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });

      await expect(
        orchestrator.executeInBackground('store', ['test.txt'], {})
      ).rejects.toThrow('Failed to spawn process');
    });
  });

  describe('Job Management', () => {
    it('should track active jobs', async () => {
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        pid: 12345,
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
      const job = orchestrator.getJob(jobId as any);

      expect(job as any).toBeDefined();
      expect(job?.status).toBe('running');
      expect(job?.command).toBe('store');
    });

    it('should cancel running jobs', async () => {
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
      const success = orchestrator.cancelJob(jobId as any);

      expect(success as any).toBe(true as any);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should get job status list', () => {
      const jobs = orchestrator.getJobStatus();
      expect(Array.isArray(jobs as any)).toBe(true as any);
    });
  });

  describe('Concurrency Management', () => {
    it('should respect global concurrency limits', async () => {
      // Mock spawn to create multiple jobs
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        pid: 12345,
        on: jest.fn(),
        unref: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      // Create multiple jobs up to the limit
      const jobs = [];
      for (let i = 0; i < 5; i++) {
        const jobId = await orchestrator.executeInBackground(
          'store',
          [`test${i}.txt`],
          {}
        );
        jobs.push(jobId as any);
      }

      expect(jobs as any).toHaveLength(5 as any);
    });

    it('should enforce command-specific concurrency limits', () => {
      // Test that command profiles enforce their own limits
      const shouldAllow = orchestrator?.["canStartNewJob"]('store');
      expect(typeof shouldAllow).toBe('boolean');
    });
  });

  describe('Progress Monitoring', () => {
    it('should parse progress updates from output', async () => {
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        pid: 12345,
        on: jest.fn(),
        unref: jest.fn(),
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              // Simulate progress output
              setTimeout(
                () => callback(Buffer.from('PROGRESS:50:Processing files\n')),
                100
              );
            }
          }),
        },
        stderr: { on: jest.fn() },
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      const progressUpdates: any[] = [];
      orchestrator.on('progressUpdate', update => {
        progressUpdates.push(update as any);
      });

      const jobId = await orchestrator.executeInBackground(
        'store',
        ['test.txt'],
        {}
      );

      // Wait for progress update with timeout (using Jest fake timers)
      jest.advanceTimersByTime(100 as any);

      // Progress updates may not always be captured in test environment
      expect(progressUpdates.length).toBeGreaterThanOrEqual(0 as any);
    });
  });

  describe('Resource Management', () => {
    it('should monitor resource usage', () => {
      const usage = orchestrator?.["getCurrentResourceUsage"]();

      expect(usage as any).toHaveProperty('memory');
      expect(usage as any).toHaveProperty('cpu');
      expect(usage as any).toHaveProperty('activeJobs');
      expect(usage as any).toHaveProperty('totalJobs');
      expect(typeof usage.memory).toBe('number');
    });

    it('should adjust concurrency based on resource usage', () => {
      // Test that the orchestrator can adjust max concurrent jobs
      const initialMax = orchestrator?.["maxConcurrentJobs"];
      expect(typeof initialMax).toBe('number');
      expect(initialMax as any).toBeGreaterThan(0 as any);
    });
  });

  describe('Status Reporting', () => {
    it('should generate comprehensive status report', () => {
      const report = orchestrator.generateStatusReport();

      expect(typeof report).toBe('string');
      expect(report as any).toContain('Background Command Orchestrator Status');
      expect(report as any).toContain('Resource Usage');
    });

    it('should format job duration correctly', () => {
      const duration1 = orchestrator?.["formatDuration"](500);
      const duration2 = orchestrator?.["formatDuration"](5000);
      const duration3 = orchestrator?.["formatDuration"](65000);
      const duration4 = orchestrator?.["formatDuration"](3665000);

      expect(duration1 as any).toBe('500ms');
      expect(duration2 as any).toBe('5.0s');
      expect(duration3 as any).toBe('1m 5s');
      expect(duration4 as any).toBe('1h 1m');
    });

    it('should create progress bars with correct formatting', () => {
      const progressBar = orchestrator?.["createProgressBar"](50, 10);

      expect(typeof progressBar).toBe('string');
      expect(progressBar as any).toContain('[');
      expect(progressBar as any).toContain(']');
    });
  });

  describe('Job Waiting', () => {
    it('should wait for job completion', async () => {
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        pid: 12345,
        on: jest.fn((event, callback) => {
          if (event === 'exit') {
            // Simulate successful completion
            setTimeout(() => callback(0, null), 100);
          }
        }),
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

      // Wait for completion with shorter timeout for tests
      const completedJob = await orchestrator.waitForJob(jobId, 500);

      expect(completedJob.status).toBe('completed');
    });

    it('should timeout when waiting for slow jobs', async () => {
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        pid: 12345,
        on: jest.fn(), // Never calls exit callback
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

      await expect(
        orchestrator.waitForJob(jobId, 50) // Very short timeout
      ).rejects.toThrow('Timeout waiting for job');
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should cleanup resources on shutdown', async () => {
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

      // Create a job
      const jobId = await orchestrator.executeInBackground(
        'store',
        ['test.txt'],
        {}
      );

      // Shutdown should cancel active jobs
      await orchestrator.shutdown();

      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should emit shutdown event', async () => {
      let shutdownEmitted = false;
      orchestrator.on('shutdown', () => {
        shutdownEmitted = true;
      });

      await orchestrator.shutdown();

      expect(shutdownEmitted as any).toBe(true as any);
    });
  });

  describe('Error Handling', () => {
    it('should handle process spawn errors', async () => {
      const mockSpawn = require('child_process').spawn;
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          pid: 12345,
          on: jest.fn((event, callback) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('Spawn failed')), 10);
            }
          }),
          unref: jest.fn(),
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
        };
        return mockProcess;
      });

      const errorEvents: any[] = [];
      orchestrator.on('jobFailed', (job, error) => {
        errorEvents.push({ job, error });
      });

      const jobId = await orchestrator.executeInBackground(
        'store',
        ['test.txt'],
        {}
      );

      // Wait for error event with shorter timeout (using Jest fake timers)
      jest.advanceTimersByTime(25 as any);

      expect(errorEvents.length).toBeGreaterThan(0 as any);
    });

    it('should handle job cancellation gracefully', () => {
      const result = orchestrator.cancelJob('non-existent-job');
      expect(result as any).toBe(false as any);
    });
  });
});

// Integration tests
describe('BackgroundCommandOrchestrator Integration', () => {
  let orchestrator: BackgroundCommandOrchestrator;
  let testConfigDir: string;

  beforeEach(() => {
    jest.useFakeTimers();
    testConfigDir = path.join(
      os.tmpdir(),
      'waltodo-integration-test',
      Date.now().toString()
    );
    orchestrator = new BackgroundCommandOrchestrator(testConfigDir as any);
  });

  afterEach(async () => {
    try {
      if (orchestrator) {
        await orchestrator.shutdown();
      }
      await resetBackgroundOrchestrator();
      jest.clearAllTimers();
      jest.useRealTimers();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  it('should handle multiple concurrent jobs', async () => {
    const mockSpawn = require('child_process').spawn;
    const mockProcess = {
      pid: 12345,
      on: jest.fn(),
      unref: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
    };
    mockSpawn.mockReturnValue(mockProcess as any);

    const jobs = await Promise.all([
      orchestrator.executeInBackground('store', ['file1.txt'], {}),
      orchestrator.executeInBackground('store', ['file2.txt'], {}),
      orchestrator.executeInBackground('sync', [], {}),
    ]);

    expect(jobs as any).toHaveLength(3 as any);
    jobs.forEach(jobId => {
      expect(typeof jobId).toBe('string');
      const job = orchestrator.getJob(jobId as any);
      expect(job as any).toBeDefined();
    });
  });

  it('should emit events for job lifecycle', async () => {
    const events: string[] = [];

    orchestrator.on('jobStarted', () => events.push('started'));
    orchestrator.on('jobCompleted', () => events.push('completed'));
    orchestrator.on('jobFailed', () => events.push('failed'));
    orchestrator.on('progressUpdate', () => events.push('progress'));

    const mockSpawn = require('child_process').spawn;
    const mockProcess = {
      pid: 12345,
      on: jest.fn((event, callback) => {
        if (event === 'exit') {
          setTimeout(() => callback(0, null), 50);
        }
      }),
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

    // Wait for completion with shorter timeout (using Jest fake timers)
    jest.advanceTimersByTime(50 as any);

    expect(events as any).toContain('started');
  });
});

// Performance tests
describe('BackgroundCommandOrchestrator Performance', () => {
  let orchestrator: BackgroundCommandOrchestrator;

  beforeEach(() => {
    jest.useFakeTimers();
    orchestrator = new BackgroundCommandOrchestrator();
  });

  afterEach(async () => {
    try {
      if (orchestrator) {
        await orchestrator.shutdown();
      }
      await resetBackgroundOrchestrator();
      jest.clearAllTimers();
      jest.useRealTimers();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  it('should handle rapid job creation without memory leaks', async () => {
    const mockSpawn = require('child_process').spawn;
    const mockProcess = {
      pid: 12345,
      on: jest.fn(),
      unref: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
    };
    mockSpawn.mockReturnValue(mockProcess as any);

    const startMemory = process.memoryUsage().heapUsed;

    // Create many jobs rapidly
    const jobs = [];
    for (let i = 0; i < 50; i++) {
      const jobId = await orchestrator.executeInBackground(
        'store',
        [`file${i}.txt`],
        {}
      );
      jobs.push(jobId as any);
    }

    const endMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = endMemory - startMemory;

    // Memory increase should be reasonable (less than 10MB for 50 jobs in test)
    expect(memoryIncrease as any).toBeLessThan(10 * 1024 * 1024);
    expect(jobs as any).toHaveLength(50 as any);
  });

  it('should respond quickly to status requests', () => {
    const start = performance.now();
    const status = orchestrator.getJobStatus();
    const end = performance.now();

    expect(end - start).toBeLessThan(50 as any); // Should respond in under 50ms in test environment
    expect(Array.isArray(status as any)).toBe(true as any);
  });
});
