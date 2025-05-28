import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import { BackgroundCommandOrchestrator, ResourceUsage } from '../../apps/cli/src/utils/BackgroundCommandOrchestrator';
import { PerformanceMonitor, JobManager } from '../../apps/cli/src/utils/PerformanceMonitor';
import { ResourceManager, ResourceType } from '../../apps/cli/src/utils/ResourceManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../apps/cli/src/utils/Logger');

const mockFs = fs as jest.Mocked<typeof fs>;

/**
 * Resource Monitor Tester Agent
 * 
 * Comprehensive tests for resource monitoring components:
 * 1. 5-second resource monitoring intervals
 * 2. Job throttling mechanisms
 * 3. Memory leak detection and prevention
 * 4. CPU usage monitoring
 * 5. Resource cleanup and garbage collection
 */
describe('Resource Monitoring Validation', () => {
  let orchestrator: BackgroundCommandOrchestrator;
  let performanceMonitor: PerformanceMonitor;
  let resourceManager: ResourceManager;
  let testConfigDir: string;
  let mockSpawn: jest.Mock;
  let resourceUpdateEvents: ResourceUsage[] = [];

  beforeAll(() => {
    // Setup comprehensive mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => undefined);
    mockFs.readFileSync.mockReturnValue('[]');
    mockFs.appendFileSync.mockImplementation(() => undefined);
    
    mockSpawn = require('child_process').spawn;
    mockSpawn.mockImplementation(() => ({
      pid: Math.floor(Math.random() * 10000) + 1000,
      on: jest.fn(),
      unref: jest.fn(),
      kill: jest.fn(),
      killed: false,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() }
    }));
  });

  beforeEach(() => {
    testConfigDir = path.join(os.tmpdir(), 'waltodo-resource-test', Date.now().toString());
    orchestrator = new BackgroundCommandOrchestrator(testConfigDir);
    performanceMonitor = new PerformanceMonitor(path.join(testConfigDir, 'performance'));
    resourceManager = ResourceManager.getInstance({ autoDispose: false });
    resourceUpdateEvents = [];

    // Capture resource updates
    orchestrator.on('resourceUpdate', (usage: ResourceUsage) => {
      resourceUpdateEvents.push(usage);
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
    await resourceManager.disposeAll({ continueOnError: true });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('5-Second Resource Monitoring Intervals', () => {
    it('should emit resource updates every 5 seconds', async () => {
      jest.useFakeTimers();
      
      // Clear any initial events
      resourceUpdateEvents = [];
      
      // Fast-forward 5 seconds
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // Allow async operations to complete
      
      expect(resourceUpdateEvents.length).toBeGreaterThanOrEqual(1);
      
      // Fast-forward another 5 seconds
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      
      expect(resourceUpdateEvents.length).toBeGreaterThanOrEqual(2);
      
      // Verify timing consistency
      const firstEvent = resourceUpdateEvents[0];
      expect(firstEvent).toHaveProperty('memory');
      expect(firstEvent).toHaveProperty('cpu');
      expect(firstEvent).toHaveProperty('activeJobs');
      expect(firstEvent).toHaveProperty('totalJobs');
    });

    it('should maintain accurate resource usage data', async () => {
      jest.useFakeTimers();
      
      // Create some jobs to track
      const jobPromises = [];
      for (let i = 0; i < 3; i++) {
        jobPromises.push(orchestrator.executeInBackground('store', [`file${i}.txt`], {}));
      }
      await Promise.all(jobPromises);
      
      // Clear events and trigger monitoring
      resourceUpdateEvents = [];
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      
      const usage = resourceUpdateEvents[0];
      expect(usage.activeJobs).toBe(3);
      expect(usage.totalJobs).toBe(3);
      expect(usage.memory).toBeGreaterThanOrEqual(0);
      expect(usage.memory).toBeLessThanOrEqual(1);
    });

    it('should stop monitoring after shutdown', async () => {
      jest.useFakeTimers();
      
      await orchestrator.shutdown();
      
      // Clear events and advance time
      resourceUpdateEvents = [];
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
      
      // Should not receive updates after shutdown
      expect(resourceUpdateEvents.length).toBe(0);
    });
  });

  describe('Job Throttling Mechanisms', () => {
    it('should throttle jobs when max concurrency is reached', async () => {
      // Set low concurrency limit for testing
      orchestrator['maxConcurrentJobs'] = 2;
      
      // Create jobs up to limit
      const job1 = await orchestrator.executeInBackground('store', ['file1.txt'], {});
      const job2 = await orchestrator.executeInBackground('store', ['file2.txt'], {});
      
      // Third job should fail due to concurrency limit
      await expect(
        orchestrator.executeInBackground('store', ['file3.txt'], {})
      ).rejects.toThrow(/concurrency limit reached/);
      
      expect(orchestrator.getJobStatus().filter(j => j.status === 'running')).toHaveLength(2);
    });

    it('should auto-adjust concurrency based on memory usage', async () => {
      jest.useFakeTimers();
      
      const initialConcurrency = orchestrator['maxConcurrentJobs'];
      
      // Mock high memory usage
      jest.spyOn(orchestrator as any, 'getCurrentResourceUsage').mockReturnValue({
        memory: 0.95, // 95% memory usage
        cpu: 0.3,
        activeJobs: 2,
        totalJobs: 2
      });
      
      // Trigger resource monitoring
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      
      const newConcurrency = orchestrator['maxConcurrentJobs'];
      expect(newConcurrency).toBeLessThan(initialConcurrency);
    });

    it('should increase concurrency when resources are available', async () => {
      jest.useFakeTimers();
      
      // First reduce concurrency
      orchestrator['maxConcurrentJobs'] = 2;
      
      // Mock low resource usage
      jest.spyOn(orchestrator as any, 'getCurrentResourceUsage').mockReturnValue({
        memory: 0.3, // 30% memory usage
        cpu: 0.2,    // 20% CPU usage
        activeJobs: 0,
        totalJobs: 0
      });
      
      // Trigger resource monitoring
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      
      const newConcurrency = orchestrator['maxConcurrentJobs'];
      expect(newConcurrency).toBeGreaterThan(2);
      expect(newConcurrency).toBeLessThanOrEqual(10); // Max limit
    });

    it('should respect command-specific concurrency limits', async () => {
      // Test deploy command with maxConcurrency: 1
      const job1 = await orchestrator.executeInBackground('deploy', [], {});
      
      // Second deploy job should fail
      await expect(
        orchestrator.executeInBackground('deploy', [], {})
      ).rejects.toThrow(/concurrency limit reached/);
      
      // But other commands should still work
      const job2 = await orchestrator.executeInBackground('store', ['file.txt'], {});
      expect(job2).toBeDefined();
    });
  });

  describe('Memory Leak Detection and Prevention', () => {
    it('should not accumulate memory with rapid job creation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and complete many jobs rapidly
      const jobs = [];
      for (let i = 0; i < 20; i++) {
        const mockProcess = mockSpawn.mockReturnValue({
          pid: 1000 + i,
          on: jest.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0, null), 10);
            }
          }),
          unref: jest.fn(),
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() }
        });
        
        const jobId = await orchestrator.executeInBackground('store', [`file${i}.txt`], {});
        jobs.push(jobId);
      }
      
      // Wait for jobs to complete
      await Promise.all(jobs.map(jobId => 
        orchestrator.waitForJob(jobId, 1000).catch(() => {})
      ));
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB for 20 jobs)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should cleanup job data for completed jobs', async () => {
      const jobManager = new JobManager(testConfigDir);
      
      // Create and complete a job
      const job = jobManager.createJob('test', [], {});
      jobManager.startJob(job.id, 1234);
      jobManager.completeJob(job.id);
      
      const initialJobCount = jobManager.getAllJobs().length;
      
      // Trigger cleanup of old jobs (simulate 8 days old)
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000);
      jobManager['activeJobs'].get(job.id)!.startTime = oldTimestamp;
      jobManager['activeJobs'].get(job.id)!.endTime = oldTimestamp + 1000;
      
      const cleaned = jobManager.cleanupOldJobs();
      
      expect(cleaned).toBeGreaterThan(0);
      expect(jobManager.getAllJobs().length).toBeLessThan(initialJobCount);
    });

    it('should limit performance metrics to prevent memory overflow', () => {
      const monitor = new PerformanceMonitor();
      const maxMetrics = monitor['maxMetrics'];
      
      // Add more metrics than the limit
      for (let i = 0; i < maxMetrics + 100; i++) {
        monitor.measureSync('test-operation', () => {
          // Simple operation
          return Math.random();
        });
      }
      
      const metrics = monitor['metrics'];
      expect(metrics.length).toBeLessThanOrEqual(maxMetrics);
    });
  });

  describe('CPU Usage Monitoring', () => {
    it('should track CPU usage in performance metrics', () => {
      const monitor = new PerformanceMonitor();
      const operationId = 'cpu-test-' + Date.now();
      
      monitor.startOperation(operationId, 'cpu-intensive-task');
      
      // Simulate CPU-intensive work
      let result = 0;
      for (let i = 0; i < 10000; i++) {
        result += Math.sqrt(i);
      }
      
      const metric = monitor.endOperation(operationId, 'cpu-intensive-task', true, { result });
      
      expect(metric.cpuUsage).toBeDefined();
      expect(metric.cpuUsage?.user).toBeGreaterThanOrEqual(0);
      expect(metric.cpuUsage?.system).toBeGreaterThanOrEqual(0);
    });

    it('should include CPU data in performance reports', () => {
      const monitor = new PerformanceMonitor();
      
      // Add some operations with CPU tracking
      for (let i = 0; i < 5; i++) {
        monitor.measureSync('cpu-operation', () => {
          // CPU work
          let sum = 0;
          for (let j = 0; j < 1000; j++) {
            sum += Math.random();
          }
          return sum;
        });
      }
      
      const report = monitor.generateReport();
      expect(report.operationBreakdown['cpu-operation']).toBeDefined();
      expect(report.operationBreakdown['cpu-operation'].count).toBe(5);
    });
  });

  describe('Resource Cleanup and Garbage Collection', () => {
    it('should properly dispose of all resources on shutdown', async () => {
      // Create some resources
      const job1 = await orchestrator.executeInBackground('store', ['file1.txt'], {});
      const job2 = await orchestrator.executeInBackground('sync', [], {});
      
      const activeJobsBefore = orchestrator.getJobStatus().filter(j => 
        j.status === 'running' || j.status === 'pending'
      ).length;
      
      expect(activeJobsBefore).toBeGreaterThan(0);
      
      // Shutdown should cancel all active jobs
      await orchestrator.shutdown();
      
      // Verify all processes were killed
      const killCalls = mockSpawn.mock.results
        .map(result => result.value)
        .filter(process => process.kill)
        .reduce((count, process) => count + process.kill.mock.calls.length, 0);
      
      expect(killCalls).toBeGreaterThanOrEqual(activeJobsBefore);
    });

    it('should cleanup file handles and log files', async () => {
      const jobManager = new JobManager(testConfigDir);
      
      // Create job with log file
      const job = jobManager.createJob('test', [], {});
      jobManager.writeJobLog(job.id, 'Test log entry');
      
      // Mock file existence
      mockFs.existsSync.mockReturnValue(true);
      
      // Complete and cleanup job
      jobManager.completeJob(job.id);
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000);
      jobManager['activeJobs'].get(job.id)!.startTime = oldTimestamp;
      jobManager['activeJobs'].get(job.id)!.endTime = oldTimestamp + 1000;
      
      const cleaned = jobManager.cleanupOldJobs();
      
      expect(cleaned).toBeGreaterThan(0);
      // Verify file deletion was attempted
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should handle resource disposal errors gracefully', async () => {
      const resourceManager = ResourceManager.getInstance();
      
      // Create a mock resource that throws on disposal
      const faultyResource = {
        dispose: jest.fn().mockRejectedValue(new Error('Disposal failed')),
        isDisposed: jest.fn().mockReturnValue(false),
        _resourceManagerMetadata: {
          id: 'faulty-resource',
          type: ResourceType.OTHER,
          description: 'Faulty test resource',
          registeredAt: new Date(),
          disposeWithManager: true
        }
      };
      
      resourceManager.registerResource(faultyResource);
      
      // Should not throw, but should handle errors
      await expect(
        resourceManager.disposeAll({ continueOnError: true })
      ).resolves.not.toThrow();
      
      expect(faultyResource.dispose).toHaveBeenCalled();
    });

    it('should clear active processes map on shutdown', async () => {
      // Create some jobs
      await orchestrator.executeInBackground('store', ['file1.txt'], {});
      await orchestrator.executeInBackground('store', ['file2.txt'], {});
      
      const activeProcessesSize = orchestrator['activeProcesses'].size;
      expect(activeProcessesSize).toBeGreaterThan(0);
      
      await orchestrator.shutdown();
      
      expect(orchestrator['activeProcesses'].size).toBe(0);
    });
  });

  describe('Stress Tests - Extended Operation', () => {
    it('should maintain stable resource usage over extended periods', async () => {
      jest.useFakeTimers();
      
      const resourceSnapshots: ResourceUsage[] = [];
      
      // Monitor for 30 minutes (simulated)
      for (let minute = 0; minute < 30; minute++) {
        // Advance 1 minute
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
        
        // Create some load every few minutes
        if (minute % 5 === 0) {
          const job = await orchestrator.executeInBackground('store', [`file-${minute}.txt`], {});
          // Simulate completion
          setTimeout(() => {
            const mockProcess = orchestrator['activeProcesses'].get(job);
            if (mockProcess) {
              mockProcess.emit('exit', 0, null);
            }
          }, 100);
        }
        
        // Collect resource snapshot
        const usage = orchestrator['getCurrentResourceUsage']();
        resourceSnapshots.push(usage);
      }
      
      // Analyze resource stability
      const memoryValues = resourceSnapshots.map(s => s.memory);
      const maxMemory = Math.max(...memoryValues);
      const minMemory = Math.min(...memoryValues);
      const memoryVariance = maxMemory - minMemory;
      
      // Memory usage should not grow unbounded
      expect(memoryVariance).toBeLessThan(0.2); // Less than 20% variance
      expect(maxMemory).toBeLessThan(0.8); // Never exceed 80% memory
    });

    it('should handle high job submission rates without degradation', async () => {
      const startTime = performance.now();
      const jobIds: string[] = [];
      
      // Submit 100 jobs rapidly
      for (let i = 0; i < 100; i++) {
        try {
          const jobId = await orchestrator.executeInBackground('store', [`batch-file-${i}.txt`], {});
          jobIds.push(jobId);
        } catch (error) {
          // Expected for concurrency limits
          if (!(error as Error).message.includes('concurrency limit')) {
            throw error;
          }
        }
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should handle rapid submissions efficiently
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds
      expect(jobIds.length).toBeGreaterThan(0);
      
      // Verify system remains responsive
      const statusTime = performance.now();
      const status = orchestrator.getJobStatus();
      const statusDuration = performance.now() - statusTime;
      
      expect(statusDuration).toBeLessThan(100); // Status check under 100ms
      expect(Array.isArray(status)).toBe(true);
    });

    it('should detect and prevent memory leaks in job processing', async () => {
      const initialHeap = process.memoryUsage().heapUsed;
      const snapshots: number[] = [initialHeap];
      
      // Process many jobs
      for (let batch = 0; batch < 10; batch++) {
        const batchJobs = [];
        
        // Create batch of jobs
        for (let i = 0; i < 10; i++) {
          const mockProcess = {
            pid: 1000 + (batch * 10) + i,
            on: jest.fn((event, callback) => {
              if (event === 'exit') {
                setTimeout(() => callback(0, null), Math.random() * 50);
              }
            }),
            unref: jest.fn(),
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() }
          };
          mockSpawn.mockReturnValue(mockProcess);
          
          const jobId = await orchestrator.executeInBackground('store', [`batch-${batch}-file-${i}.txt`], {});
          batchJobs.push(jobId);
        }
        
        // Wait for batch completion
        await Promise.all(batchJobs.map(jobId => 
          orchestrator.waitForJob(jobId, 500).catch(() => {})
        ));
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Take memory snapshot
        snapshots.push(process.memoryUsage().heapUsed);
      }
      
      // Analyze memory growth
      const memoryGrowth = snapshots[snapshots.length - 1] - snapshots[0];
      const avgGrowthPerBatch = memoryGrowth / 10;
      
      // Memory growth should be minimal
      expect(avgGrowthPerBatch).toBeLessThan(1024 * 1024); // Less than 1MB per batch
    });
  });

  describe('Resource Monitoring Accuracy and Reliability', () => {
    it('should provide accurate memory usage calculations', () => {
      const usage = orchestrator['getCurrentResourceUsage']();
      
      // Memory should be a valid percentage
      expect(usage.memory).toBeGreaterThanOrEqual(0);
      expect(usage.memory).toBeLessThanOrEqual(1);
      expect(typeof usage.memory).toBe('number');
      expect(Number.isFinite(usage.memory)).toBe(true);
    });

    it('should correctly count active and total jobs', async () => {
      // Create some jobs in different states
      const runningJobs = [];
      for (let i = 0; i < 3; i++) {
        const jobId = await orchestrator.executeInBackground('store', [`file${i}.txt`], {});
        runningJobs.push(jobId);
      }
      
      const usage = orchestrator['getCurrentResourceUsage']();
      
      expect(usage.activeJobs).toBe(3);
      expect(usage.totalJobs).toBe(3);
      
      // Complete one job
      const mockProcess = orchestrator['activeProcesses'].get(runningJobs[0]);
      if (mockProcess) {
        mockProcess.emit('exit', 0, null);
      }
      
      // Wait a bit for the job to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const updatedUsage = orchestrator['getCurrentResourceUsage']();
      expect(updatedUsage.activeJobs).toBe(2);
      expect(updatedUsage.totalJobs).toBe(3);
    });

    it('should handle resource monitoring errors gracefully', () => {
      // Mock os.totalmem to throw an error
      const originalTotalMem = os.totalmem;
      jest.spyOn(os, 'totalmem').mockImplementation(() => {
        throw new Error('System error');
      });
      
      // Should not crash when getting resource usage
      expect(() => {
        orchestrator['getCurrentResourceUsage']();
      }).not.toThrow();
      
      // Restore original function
      (os.totalmem as jest.Mock).mockRestore();
    });

    it('should emit resource updates with consistent format', async () => {
      jest.useFakeTimers();
      
      resourceUpdateEvents = [];
      
      // Trigger multiple resource updates
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
      }
      
      expect(resourceUpdateEvents.length).toBeGreaterThanOrEqual(3);
      
      // Verify all events have consistent structure
      resourceUpdateEvents.forEach((event, index) => {
        expect(event).toMatchObject({
          memory: expect.any(Number),
          cpu: expect.any(Number),
          activeJobs: expect.any(Number),
          totalJobs: expect.any(Number)
        });
        
        // Values should be within valid ranges
        expect(event.memory).toBeGreaterThanOrEqual(0);
        expect(event.memory).toBeLessThanOrEqual(1);
        expect(event.cpu).toBeGreaterThanOrEqual(0);
        expect(event.activeJobs).toBeGreaterThanOrEqual(0);
        expect(event.totalJobs).toBeGreaterThanOrEqual(0);
        expect(event.totalJobs).toBeGreaterThanOrEqual(event.activeJobs);
      });
    });
  });
});

// Memory leak detection utilities
function measureMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers
  };
}

function forceGarbageCollection() {
  if (global.gc) {
    global.gc();
  } else {
    // Trigger garbage collection through memory pressure
    const arrays = [];
    try {
      for (let i = 0; i < 100; i++) {
        arrays.push(new Array(100000).fill(0));
      }
    } catch (e) {
      // Expected memory pressure
    }
    arrays.length = 0;
  }
}