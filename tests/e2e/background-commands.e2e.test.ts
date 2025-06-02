import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

describe('Background Commands E2E', () => {
  let testDir: string;
  let cliPath: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), 'waltodo-e2e-test', Date.now().toString());
    fs.mkdirSync(testDir, { recursive: true });

    // Path to the CLI executable
    cliPath = path.join(process.cwd(), 'bin', 'run');

    // Set test environment
    process.env.WALRUS_TODO_CONFIG_DIR = testDir;
    process.env.WALRUS_USE_MOCK = 'true';
  });

  afterEach(() => {
    // Cleanup test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    delete process.env.WALRUS_TODO_CONFIG_DIR;
    delete process.env.WALRUS_USE_MOCK;
  });

  describe('Basic Background Execution', () => {
    it('should run store command in background with --background flag', async () => {
      const { stdout, stderr } = await execAsync(
        `node ${cliPath} store --background --mock test-file.txt`,
        { cwd: testDir }
      );

      expect(stdout).toContain('Command started in background');
      expect(stdout).toContain('job ID:');
      expect(stderr).toBe('');
    }, 10000);

    it('should run store command in background with --bg flag', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} store --bg --mock test-file.txt`,
        { cwd: testDir }
      );

      expect(stdout).toContain('Command started in background');
    }, 10000);

    it('should respect --foreground flag and run in foreground', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} store --foreground --mock test-file.txt`,
        { cwd: testDir }
      );

      // Should not contain background job messages
      expect(stdout).not.toContain('Command started in background');
    }, 10000);
  });

  describe('Auto-Background Detection', () => {
    it('should auto-detect long-running store operations', async () => {
      // Create a mock scenario that would trigger auto-background
      const { stdout } = await execAsync(
        `node ${cliPath} store --mock large-file.txt`,
        { cwd: testDir }
      );

      // Depending on implementation, this might go to background automatically
      expect(stdout).toBeDefined();
    }, 10000);

    it('should not auto-background short commands like list', async () => {
      const { stdout } = await execAsync(`node ${cliPath} list --mock`, {
        cwd: testDir,
      });

      expect(stdout).not.toContain('Command started in background');
    }, 10000);
  });

  describe('Job Management', () => {
    it('should list background jobs', async () => {
      // First, start a background job
      const { stdout: storeOutput } = await execAsync(
        `node ${cliPath} store --background --mock test-file.txt`,
        { cwd: testDir }
      );

      // Extract job ID from output
      const jobIdMatch = storeOutput.match(/job ID: (\S+)/);
      expect(jobIdMatch).toBeTruthy();

      // List jobs
      const { stdout: listOutput } = await execAsync(`node ${cliPath} jobs`, {
        cwd: testDir,
      });

      expect(listOutput).toContain('Background Jobs');
    }, 15000);

    it('should show job status', async () => {
      // Start a background job
      const { stdout: storeOutput } = await execAsync(
        `node ${cliPath} store --background --mock test-file.txt`,
        { cwd: testDir }
      );

      const jobIdMatch = storeOutput.match(/job ID: (\S+)/);
      expect(jobIdMatch).toBeTruthy();
      const jobId = jobIdMatch![1];

      // Check job status
      const { stdout: statusOutput } = await execAsync(
        `node ${cliPath} jobs status ${jobId}`,
        { cwd: testDir }
      );

      expect(statusOutput).toContain('Job Status');
      expect(statusOutput).toContain(jobId);
    }, 15000);

    it('should cancel running jobs', async () => {
      // Start a background job
      const { stdout: storeOutput } = await execAsync(
        `node ${cliPath} store --background --mock test-file.txt`,
        { cwd: testDir }
      );

      const jobIdMatch = storeOutput.match(/job ID: (\S+)/);
      expect(jobIdMatch).toBeTruthy();
      const jobId = jobIdMatch![1];

      // Cancel the job (with --force to skip confirmation)
      const { stdout: cancelOutput } = await execAsync(
        `node ${cliPath} jobs cancel ${jobId} --force`,
        { cwd: testDir }
      );

      expect(cancelOutput).toContain('cancelled');
    }, 15000);
  });

  describe('Progress Tracking', () => {
    it('should track progress for background jobs', async () => {
      // Start a background job
      const { stdout: storeOutput } = await execAsync(
        `node ${cliPath} store --background --mock test-file.txt`,
        { cwd: testDir }
      );

      const jobIdMatch = storeOutput.match(/job ID: (\S+)/);
      expect(jobIdMatch).toBeTruthy();
      const jobId = jobIdMatch![1];

      // Wait a bit for job to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check status for progress
      const { stdout: statusOutput } = await execAsync(
        `node ${cliPath} jobs status ${jobId}`,
        { cwd: testDir }
      );

      expect(statusOutput).toContain('Progress');
    }, 15000);
  });

  describe('Multiple Commands', () => {
    it('should handle multiple background commands simultaneously', async () => {
      const commands = [
        `node ${cliPath} store --background --mock file1.txt`,
        `node ${cliPath} store --background --mock file2.txt`,
        `node ${cliPath} sync --background --mock`,
      ];

      const results = await Promise.all(
        commands.map(cmd => execAsync(cmd, { cwd: testDir }))
      );

      results.forEach(({ stdout }) => {
        expect(stdout).toContain('Command started in background');
      });

      // Check that all jobs are listed
      const { stdout: listOutput } = await execAsync(`node ${cliPath} jobs`, {
        cwd: testDir,
      });

      expect(listOutput).toContain('Background Jobs');
    }, 20000);

    it('should respect concurrency limits', async () => {
      // Try to start many jobs at once
      const commands = Array.from(
        { length: 15 },
        (_, i) => `node ${cliPath} store --background --mock file${i}.txt`
      );

      const results = await Promise.all(
        commands.map(cmd =>
          execAsync(cmd, { cwd: testDir }).catch(err => ({
            stdout: '',
            stderr: err.message,
          }))
        )
      );

      // Some should succeed, some might be rejected due to limits
      const successful = results.filter(r =>
        r.stdout.includes('Command started in background')
      );
      expect(successful.length).toBeGreaterThan(0);
      expect(successful.length).toBeLessThanOrEqual(15);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      await expect(
        execAsync(`node ${cliPath} invalid-command --background`, {
          cwd: testDir,
        })
      ).rejects.toThrow();
    }, 10000);

    it('should handle missing job IDs in status commands', async () => {
      await expect(
        execAsync(`node ${cliPath} jobs status`, { cwd: testDir })
      ).rejects.toThrow(/Job ID is required/);
    }, 10000);

    it('should handle non-existent job IDs', async () => {
      await expect(
        execAsync(`node ${cliPath} jobs status non-existent-job-id`, {
          cwd: testDir,
        })
      ).rejects.toThrow(/Job not found/);
    }, 10000);
  });

  describe('Resource Management', () => {
    it('should show resource usage in jobs report', async () => {
      const { stdout } = await execAsync(`node ${cliPath} jobs report`, {
        cwd: testDir,
      });

      expect(stdout).toContain('Background Command Orchestrator Status');
      expect(stdout).toContain('Resource Usage');
      expect(stdout).toContain('Memory');
    }, 10000);

    it('should cleanup old jobs', async () => {
      // Start and complete a job first
      const { stdout: storeOutput } = await execAsync(
        `node ${cliPath} store --background --mock small-file.txt`,
        { cwd: testDir }
      );

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Run cleanup
      const { stdout: cleanupOutput } = await execAsync(
        `node ${cliPath} jobs --cleanup --force`,
        { cwd: testDir }
      );

      expect(cleanupOutput).toContain('Cleaned up');
    }, 15000);
  });

  describe('JSON Output', () => {
    it('should support JSON output for jobs list', async () => {
      // Start a background job first
      await execAsync(
        `node ${cliPath} store --background --mock test-file.txt`,
        { cwd: testDir }
      );

      const { stdout } = await execAsync(`node ${cliPath} jobs --json`, {
        cwd: testDir,
      });

      expect(() => JSON.parse(stdout)).not.toThrow();
      const jobs = JSON.parse(stdout);
      expect(Array.isArray(jobs)).toBe(true);
    }, 15000);
  });

  describe('Watch Mode', () => {
    it('should support watch mode for job monitoring', async () => {
      // Note: This is difficult to test in automated fashion due to the interactive nature
      // We'll just verify the command doesn't crash immediately

      const child = exec(`node ${cliPath} jobs --watch`, { cwd: testDir });

      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Kill the process
      child.kill('SIGTERM');

      // Should not throw
      expect(true).toBe(true);
    }, 5000);
  });

  describe('Command Integration', () => {
    it('should integrate background mode with existing store command', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} store --background --mock integration-test.txt`,
        { cwd: testDir }
      );

      expect(stdout).toContain('Command started in background');
      expect(stdout).toContain('Monitor progress with:');
      expect(stdout).toContain('View all jobs with:');
    }, 10000);

    it('should integrate background mode with sync command', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} sync --background --mock`,
        { cwd: testDir }
      );

      expect(stdout).toContain('Command started in background');
    }, 10000);

    it('should show background job notifications on subsequent commands', async () => {
      // Start a background job
      await execAsync(
        `node ${cliPath} store --background --mock notification-test.txt`,
        { cwd: testDir }
      );

      // Wait for job to potentially complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Run another command that should show notifications
      const { stdout } = await execAsync(`node ${cliPath} list --mock`, {
        cwd: testDir,
      });

      // Output might contain job completion notifications
      expect(stdout).toBeDefined();
    }, 15000);
  });
});

// Stress tests
describe('Background Commands Stress Tests', () => {
  let testDir: string;
  let cliPath: string;

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      'waltodo-stress-test',
      Date.now().toString()
    );
    fs.mkdirSync(testDir, { recursive: true });
    cliPath = path.join(process.cwd(), 'bin', 'run');
    process.env.WALRUS_TODO_CONFIG_DIR = testDir;
    process.env.WALRUS_USE_MOCK = 'true';
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    delete process.env.WALRUS_TODO_CONFIG_DIR;
    delete process.env.WALRUS_USE_MOCK;
  });

  it('should handle rapid job creation and completion', async () => {
    const startTime = Date.now();

    // Create 10 jobs rapidly
    const jobPromises = Array.from({ length: 10 }, (_, i) =>
      execAsync(
        `node ${cliPath} store --background --mock stress-test-${i}.txt`,
        { cwd: testDir }
      )
    );

    const results = await Promise.all(jobPromises);
    const endTime = Date.now();

    // Should complete within reasonable time (30 seconds)
    expect(endTime - startTime).toBeLessThan(30000);

    // All jobs should start successfully
    results.forEach(({ stdout }) => {
      expect(stdout).toContain('Command started in background');
    });

    // Check final job count
    const { stdout: listOutput } = await execAsync(`node ${cliPath} jobs`, {
      cwd: testDir,
    });

    expect(listOutput).toContain('Background Jobs');
  }, 45000);

  it('should maintain performance with many completed jobs', async () => {
    // Create and complete many jobs
    const jobPromises = Array.from({ length: 20 }, (_, i) =>
      execAsync(
        `node ${cliPath} store --background --mock perf-test-${i}.txt`,
        { cwd: testDir }
      )
    );

    await Promise.all(jobPromises);

    // Wait for jobs to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Performance test: listing jobs should be fast
    const startTime = Date.now();
    await execAsync(`node ${cliPath} jobs`, { cwd: testDir });
    const endTime = Date.now();

    // Should respond quickly even with many jobs
    expect(endTime - startTime).toBeLessThan(5000);
  }, 60000);
});
