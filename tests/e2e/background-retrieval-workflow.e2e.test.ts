import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { backgroundDataRetriever } from '../../apps/cli/src/utils/BackgroundDataRetriever';
import { jobManager } from '../../apps/cli/src/utils/PerformanceMonitor';
import { createBackgroundOperationsManager } from '../../apps/cli/src/utils/background-operations';
import chalk from 'chalk';

/**
 * End-to-end tests for background retrieval operations
 * Tests the complete workflow from command execution to job completion
 */
describe('Background Retrieval Workflow E2E Tests', () => {
  let testJobIds: string[] = [];
  let testOperationIds: string[] = [];

  beforeEach(() => {
    // Clean up any existing test jobs
    testJobIds = [];
    testOperationIds = [];
  });

  afterEach(async () => {
    // Cleanup test jobs and operations
    for (const jobId of testJobIds) {
      try {
        jobManager.cancelJob(jobId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    for (const operationId of testOperationIds) {
      try {
        await backgroundDataRetriever.cancelRetrieval(operationId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Background Retrieve Command', () => {
    test('should start background retrieval and return immediately', async () => {
      const command = spawn(
        'node',
        ['bin/run', 'retrieve', 'test-list', '--background', '--mock'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );

      const output = await captureCommandOutput(command);

      expect(output.stdout).toContain(
        '🚀 Starting background retrieval operation'
      );
      expect(output.stdout).toContain('Job ID:');
      expect(output.stdout).toContain('✓ Background retrieval started');
      expect(output.stdout).toContain('💡 Track progress: waltodo jobs');
      expect(output.exitCode).toBe(0);

      // Extract job ID for cleanup
      const jobIdMatch = output.stdout.match(/Job ID: (job_\w+)/);
      if (jobIdMatch) {
        testJobIds.push(jobIdMatch[1]);
      }
    }, 15000);

    test('should start background retrieval with wait flag and show progress', async () => {
      const command = spawn(
        'node',
        [
          'bin/run',
          'retrieve',
          'QmTestBlob123',
          '--background',
          '--wait',
          '--mock',
          '--timeout',
          '30',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 45000,
        }
      );

      const output = await captureCommandOutput(command);

      expect(output.stdout).toContain(
        '🚀 Starting background retrieval operation'
      );
      expect(output.stdout).toContain('⏳ Waiting for retrieval to complete');
      // Should contain progress indicators
      expect(output.stdout).toMatch(/\[.*\]/); // Progress bar
      expect(output.exitCode).toBe(0);

      // Extract job ID for cleanup
      const jobIdMatch = output.stdout.match(/Job ID: (job_\w+)/);
      if (jobIdMatch) {
        testJobIds.push(jobIdMatch[1]);
      }
    }, 60000);

    test('should handle background retrieval with custom job ID', async () => {
      const customJobId = `test-retrieve-${Date.now()}`;

      const command = spawn(
        'node',
        [
          'bin/run',
          'retrieve',
          'test-blob',
          '--background',
          '--job-id',
          customJobId,
          '--mock',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );

      const output = await captureCommandOutput(command);

      expect(output.stdout).toContain(`Job ID: ${customJobId}`);
      expect(output.exitCode).toBe(0);

      testJobIds.push(customJobId);
    }, 15000);
  });

  describe('Background Fetch Command', () => {
    test('should start background fetch operation', async () => {
      const command = spawn(
        'node',
        ['bin/run', 'fetch', 'QmTestFetch123', '--background', '--mock'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );

      const output = await captureCommandOutput(command);

      expect(output.stdout).toContain('🚀 Starting background fetch operation');
      expect(output.stdout).toContain('Target ID: QmTestFetch123');
      expect(output.stdout).toContain('✓ Background fetch started');
      expect(output.exitCode).toBe(0);

      // Extract job ID for cleanup
      const jobIdMatch = output.stdout.match(/Job ID: (job_\w+)/);
      if (jobIdMatch) {
        testJobIds.push(jobIdMatch[1]);
      }
    }, 15000);

    test('should handle fetch with progress interval settings', async () => {
      const command = spawn(
        'node',
        [
          'bin/run',
          'fetch',
          '0xTestNFT456',
          '--background',
          '--wait',
          '--progress-interval',
          '1',
          '--mock',
          '--timeout',
          '20',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000,
        }
      );

      const output = await captureCommandOutput(command);

      expect(output.stdout).toContain('🚀 Starting background fetch operation');
      expect(output.stdout).toContain('Target ID: 0xTestNFT456');
      expect(output.stdout).toMatch(/\[.*\]/); // Should show progress
      expect(output.exitCode).toBe(0);

      // Extract job ID for cleanup
      const jobIdMatch = output.stdout.match(/Job ID: (job_\w+)/);
      if (jobIdMatch) {
        testJobIds.push(jobIdMatch[1]);
      }
    }, 45000);
  });

  describe('Job Management Integration', () => {
    test('jobs command should list background operations', async () => {
      // Start a background operation first
      const retrieveCommand = spawn(
        'node',
        ['bin/run', 'retrieve', 'test-list', '--background', '--mock'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000,
        }
      );

      await captureCommandOutput(retrieveCommand);

      // Small delay to ensure job is registered
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check jobs list
      const jobsCommand = spawn('node', ['bin/run', 'jobs'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });

      const output = await captureCommandOutput(jobsCommand);

      expect(output.stdout).toContain('Background Jobs');
      expect(output.exitCode).toBe(0);
    }, 20000);

    test('status command should show job details', async () => {
      // Start a background operation
      const retrieveCommand = spawn(
        'node',
        [
          'bin/run',
          'retrieve',
          'test-status',
          '--background',
          '--job-id',
          'test-status-job',
          '--mock',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000,
        }
      );

      await captureCommandOutput(retrieveCommand);
      testJobIds.push('test-status-job');

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check status
      const statusCommand = spawn(
        'node',
        ['bin/run', 'status', 'test-status-job'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );

      const output = await captureCommandOutput(statusCommand);

      expect(output.stdout).toContain('Job Status: test-status-job');
      expect(output.stdout).toContain('Command: retrieve');
      expect(output.stdout).toMatch(/Progress.*%/);
      expect(output.exitCode).toBe(0);
    }, 20000);

    test('cancel command should stop background operation', async () => {
      // Start a long-running background operation
      const retrieveCommand = spawn(
        'node',
        [
          'bin/run',
          'retrieve',
          'large-dataset',
          '--background',
          '--job-id',
          'test-cancel-job',
          '--mock',
          '--timeout',
          '300',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000,
        }
      );

      await captureCommandOutput(retrieveCommand);
      testJobIds.push('test-cancel-job');

      // Small delay to let job start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Cancel the job
      const cancelCommand = spawn(
        'node',
        ['bin/run', 'cancel', 'test-cancel-job'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );

      const output = await captureCommandOutput(cancelCommand);

      expect(output.stdout).toContain('🛑 Cancelling job: test-cancel-job');
      expect(output.stdout).toContain('✅ Job cancelled');
      expect(output.exitCode).toBe(0);
    }, 25000);
  });

  describe('Error Handling', () => {
    test('should handle invalid blob ID gracefully in background', async () => {
      const command = spawn(
        'node',
        [
          'bin/run',
          'retrieve',
          'InvalidBlobId123',
          '--background',
          '--wait',
          '--mock',
          '--timeout',
          '10',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 20000,
        }
      );

      const output = await captureCommandOutput(command);

      expect(output.stdout).toContain(
        '🚀 Starting background retrieval operation'
      );
      // Should handle error gracefully and show failure
      expect(output.exitCode).not.toBe(0);

      // Extract job ID for cleanup
      const jobIdMatch = output.stdout.match(/Job ID: (job_\w+)/);
      if (jobIdMatch) {
        testJobIds.push(jobIdMatch[1]);
      }
    }, 30000);

    test('should handle network timeout in background operation', async () => {
      const command = spawn(
        'node',
        [
          'bin/run',
          'fetch',
          'QmTimeoutTest',
          '--background',
          '--wait',
          '--timeout',
          '5',
          '--mock',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 15000,
        }
      );

      const output = await captureCommandOutput(command);

      expect(output.stdout).toContain('🚀 Starting background fetch operation');
      // Should handle timeout gracefully
      expect(output.exitCode).not.toBe(0);

      // Extract job ID for cleanup
      const jobIdMatch = output.stdout.match(/Job ID: (job_\w+)/);
      if (jobIdMatch) {
        testJobIds.push(jobIdMatch[1]);
      }
    }, 20000);
  });

  describe('Progress Tracking', () => {
    test('should show accurate progress updates', async () => {
      const command = spawn(
        'node',
        [
          'bin/run',
          'retrieve',
          'progress-test',
          '--background',
          '--wait',
          '--mock',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000,
        }
      );

      let progressUpdates = 0;
      let lastProgress = -1;

      command.stdout.on('data', data => {
        const output = data.toString();
        const progressMatch = output.match(/(\d+)%/);

        if (progressMatch) {
          const currentProgress = parseInt(progressMatch[1]);
          if (currentProgress > lastProgress) {
            progressUpdates++;
            lastProgress = currentProgress;
          }
        }
      });

      const output = await captureCommandOutput(command);

      // Should have multiple progress updates
      expect(progressUpdates).toBeGreaterThan(0);
      expect(output.exitCode).toBe(0);

      // Extract job ID for cleanup
      const jobIdMatch = output.stdout.match(/Job ID: (job_\w+)/);
      if (jobIdMatch) {
        testJobIds.push(jobIdMatch[1]);
      }
    }, 45000);
  });

  describe('Background Data Retriever', () => {
    test('should handle blob retrieval operation', async () => {
      const operationId = await backgroundDataRetriever.retrieveFromWalrusBlob(
        'QmTestBlob789',
        {
          mock: true,
          timeout: 10000,
        }
      );

      testOperationIds.push(operationId);

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');

      // Wait a moment for operation to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      const status =
        await backgroundDataRetriever.getRetrievalStatus(operationId);
      expect(status).toBeDefined();
      expect(status?.phase).toBeDefined();
    }, 15000);

    test('should handle batch retrieval operation', async () => {
      const items = [
        { type: 'blob' as const, id: 'QmBatch1' },
        { type: 'blob' as const, id: 'QmBatch2' },
        { type: 'blob' as const, id: 'QmBatch3' },
      ];

      const operationId = await backgroundDataRetriever.retrieveBatch(items, {
        mock: true,
        timeout: 15000,
        chunkSize: 2,
      });

      testOperationIds.push(operationId);

      expect(operationId).toBeDefined();

      // Wait for operation to progress
      await new Promise(resolve => setTimeout(resolve, 2000));

      const status =
        await backgroundDataRetriever.getRetrievalStatus(operationId);
      expect(status).toBeDefined();
      expect(status?.totalItems).toBe(3);
    }, 20000);

    test('should handle cancellation of retrieval operation', async () => {
      const operationId = await backgroundDataRetriever.retrieveFromWalrusBlob(
        'QmCancelTest',
        {
          mock: true,
          timeout: 30000,
        }
      );

      testOperationIds.push(operationId);

      // Wait for operation to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      const cancelled =
        await backgroundDataRetriever.cancelRetrieval(operationId);
      expect(cancelled).toBe(true);

      const status =
        await backgroundDataRetriever.getRetrievalStatus(operationId);
      expect(status?.phase).toBe('complete');
    }, 15000);
  });

  describe('Resource Management', () => {
    test('should clean up resources after operation completion', async () => {
      const command = spawn(
        'node',
        [
          'bin/run',
          'retrieve',
          'cleanup-test',
          '--background',
          '--wait',
          '--mock',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 20000,
        }
      );

      const output = await captureCommandOutput(command);

      expect(output.stdout).toContain('📊 Retrieval Summary');
      expect(output.exitCode).toBe(0);

      // Extract job ID
      const jobIdMatch = output.stdout.match(/Job ID: (job_\w+)/);
      expect(jobIdMatch).toBeTruthy();
      
      const jobId = jobIdMatch![1];
      testJobIds.push(jobId);

      // Check that job completed and was marked as such
      const job = jobManager.getJob(jobId);
      expect(job?.status).toBe('completed');
    }, 30000);

    test('should handle multiple concurrent background operations', async () => {
      const operations = [];

      // Start multiple background operations
      for (let i = 0; i < 3; i++) {
        const command = spawn(
          'node',
          [
            'bin/run',
            'retrieve',
            `concurrent-test-${i}`,
            '--background',
            '--mock',
          ],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 10000,
          }
        );

        operations.push(captureCommandOutput(command));
      }

      const results = await Promise.all(operations);

      // All should succeed
      results.forEach((result, index) => {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✓ Background retrieval started');

        // Extract job IDs for cleanup
        const jobIdMatch = result.stdout.match(/Job ID: (job_\w+)/);
        if (jobIdMatch) {
          testJobIds.push(jobIdMatch[1]);
        }
      });
    }, 30000);
  });
});

/**
 * Helper function to capture command output
 */
async function captureCommandOutput(command: ChildProcess): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    command.stdout?.on('data', data => {
      stdout += data.toString();
    });

    command.stderr?.on('data', data => {
      stderr += data.toString();
    });

    command.on('close', code => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });

    command.on('error', error => {
      reject(error);
    });
  });
}

/**
 * Helper function to wait for condition with timeout
 */
async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 10000,
  intervalMs: number = 100
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return false;
}
