import { test } from '@oclif/test';
import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sinon from 'sinon';

// Mock configuration values that would normally be in the user's home directory
const mockBaseConfig = {
  privateKey: 'mock-private-key',
  network: 'testnet',
  walrusEndpoint: 'https://testnet.wal.app',
  storage: {
    defaultSize: 1000000,
    defaultEpochs: 52,
  },
};

// Create temporary directory for test files
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'walrus-verify-test-'));

// Mock the background AI operations manager
const mockBackgroundOpsManager = {
  getOperationStatus: jest.fn().mockResolvedValue({
    type: 'verification',
    status: 'completed',
    progress: 100,
    stage: 'completed',
    startedAt: new Date(),
    completedAt: new Date(),
    error: null,
  }),
  waitForOperationWithProgress: jest.fn().mockResolvedValue({
    success: true,
    result: 'verification completed',
  }),
};

// Mock the createBackgroundAIOperationsManager function
jest.mock('../../apps/cli/src/utils/background-ai-operations', () => ({
  createBackgroundAIOperationsManager: jest
    .fn()
    .mockResolvedValue(mockBackgroundOpsManager),
  BackgroundAIOperations: jest.fn(),
  BackgroundAIUtils: jest.fn(),
}));

// Mock the config service
jest.mock('../../apps/cli/src/services/config-service', () => ({
  configService: {
    getConfig: jest.fn().mockResolvedValue(mockBaseConfig),
  },
}));

// Mock the AIVerifierAdapter
jest.mock('../../apps/cli/src/types/adapters/AIVerifierAdapter', () => ({
  AIVerifierAdapter: jest.fn(),
  VerificationRecord: jest.fn(),
}));

describe('verify commands', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    // Create test files
    const testJsonContent = JSON.stringify({ test: 'data' }, null, 2);
    fs.writeFileSync(path.join(tmpDir, 'test-data.json'), testJsonContent);

    // Reset all mocks
    jest.clearAllMocks();

    // Reset mock implementations
    mockBackgroundOpsManager.getOperationStatus.mockResolvedValue({
      type: 'verification',
      status: 'completed',
      progress: 100,
      stage: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      error: null,
    });

    mockBackgroundOpsManager.waitForOperationWithProgress.mockResolvedValue({
      success: true,
      result: 'verification completed',
    });

    // Set up config in home directory
    const configDir = path.join(os.homedir(), '.walrus-todo');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify(mockBaseConfig, null, 2)
    );

    // Use fake timers for consistent testing
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    // Clean up test files
    try {
      fs.readdirSync(tmpDir).forEach(file => {
        fs.unlinkSync(path.join(tmpDir, file));
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Restore clock
    if (clock) {
      clock.restore();
    }
  });

  afterAll(() => {
    // Remove temporary directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('AI verification operations', () => {
    describe('list action', () => {
      test
        .stdout()
        .command(['verify', 'list'])
        .it('successfully lists AI operation verifications', ctx => {
          expect(ctx.stdout).to.contain('Fetching AI operation verifications');
          expect(ctx.stdout).to.contain('No verifications found');
        });

      test
        .stdout()
        .command(['verify', 'list', '--format', 'json'])
        .it('lists verifications in JSON format', ctx => {
          expect(ctx.stdout).to.contain('Fetching AI operation verifications');
          expect(ctx.stdout).to.contain('No verifications found');
        });

      test
        .stdout()
        .command(['verify', 'list', '--background'])
        .it('starts list operation in background', ctx => {
          expect(ctx.stdout).to.contain(
            'Starting verification list operation in background'
          );
          expect(ctx.stdout).to.contain('Job ID:');
          expect(ctx.stdout).to.contain('Commands to check progress:');
        });

      test
        .stdout()
        .timeout(10000)
        .command(['verify', 'list', '--background', '--wait'])
        .it('starts list operation in background and waits', async ctx => {
          expect(ctx.stdout).to.contain(
            'Starting verification list operation in background'
          );
          expect(ctx.stdout).to.contain(
            'Simulating verification list operation'
          );
        });
    });

    describe('show action', () => {
      test
        .stdout()
        .command(['verify', 'show', 'test-verification-id'])
        .it('successfully shows verification details', ctx => {
          expect(ctx.stdout).to.contain(
            'Fetching verification details for test-verification-id'
          );
          expect(ctx.stdout).to.contain('Verification Details:');
          expect(ctx.stdout).to.contain('ID:          test-verification-id');
          expect(ctx.stdout).to.contain('Type:        SUMMARIZE');
          expect(ctx.stdout).to.contain('Metadata:');
        });

      test
        .stdout()
        .command(['verify', 'show', 'test-verification-id', '--format', 'json'])
        .it('shows verification details in JSON format', ctx => {
          expect(ctx.stdout).to.contain(
            'Fetching verification details for test-verification-id'
          );
          expect(ctx.stdout).to.contain('"id": "test-verification-id"');
          expect(ctx.stdout).to.contain('"verificationType": 0');
        });

      test
        .stderr()
        .command(['verify', 'show'])
        .exit(2)
        .it('requires verification ID for show action');

      test
        .stdout()
        .command(['verify', 'show', 'test-id', '--background'])
        .it('starts show operation in background', ctx => {
          expect(ctx.stdout).to.contain(
            'Starting verification show operation for test-id in background'
          );
          expect(ctx.stdout).to.contain('Job ID:');
        });
    });

    describe('export action', () => {
      test
        .stdout()
        .command(['verify', 'export', 'test-verification-id'])
        .it('successfully exports verification', ctx => {
          expect(ctx.stdout).to.contain(
            'Exporting verification test-verification-id'
          );
          expect(ctx.stdout).to.contain('"type": "AIVerificationAttestation"');
          expect(ctx.stdout).to.contain('"version": "1.0.0"');
        });

      test
        .stdout()
        .command([
          'verify',
          'export',
          'test-verification-id',
          '--output',
          path.join(tmpDir, 'export.json'),
        ])
        .it('exports verification to file', ctx => {
          expect(ctx.stdout).to.contain(
            'Exporting verification test-verification-id'
          );
          expect(ctx.stdout).to.contain(
            `Attestation exported to ${path.join(tmpDir, 'export.json')}`
          );
          // Verify file was created
          expect(fs.existsSync(path.join(tmpDir, 'export.json'))).to.be.true;
        });

      test
        .stdout()
        .command(['verify', 'export', 'test-verification-id', '--content'])
        .it('exports verification with content', ctx => {
          expect(ctx.stdout).to.contain(
            'Exporting verification test-verification-id'
          );
          expect(ctx.stdout).to.contain('"content"');
          expect(ctx.stdout).to.contain('"request": "Mock request content"');
          expect(ctx.stdout).to.contain(
            '"response": "Mock AI response content"'
          );
        });

      test
        .stderr()
        .command(['verify', 'export'])
        .exit(2)
        .it('requires verification ID for export action');

      test
        .stdout()
        .command(['verify', 'export', 'test-id', '--background'])
        .it('starts export operation in background', ctx => {
          expect(ctx.stdout).to.contain(
            'Starting verification export operation for test-id in background'
          );
          expect(ctx.stdout).to.contain('Job ID:');
        });
    });

    describe('background job management', () => {
      test
        .stdout()
        .command(['verify', 'list', '--jobId', 'test-job-123'])
        .it('checks status of background job', ctx => {
          expect(ctx.stdout).to.contain(
            'Verification Job Status: test-job-123'
          );
          expect(ctx.stdout).to.contain('Type: verification');
          expect(ctx.stdout).to.contain('Status: ✅ Completed');
          expect(ctx.stdout).to.contain('Progress: 100%');
        });

      test
        .stdout()
        .timeout(5000)
        .do(() => {
          // Mock a running operation
          mockBackgroundOpsManager.getOperationStatus.mockResolvedValueOnce({
            type: 'verification',
            status: 'running',
            progress: 50,
            stage: 'processing',
            startedAt: new Date(),
            completedAt: null,
            error: null,
          });
        })
        .command(['verify', 'list', '--jobId', 'test-job-123', '--wait'])
        .it('waits for background job completion', ctx => {
          expect(ctx.stdout).to.contain(
            'Verification Job Status: test-job-123'
          );
          expect(ctx.stdout).to.contain(
            'Waiting for verification operation to complete'
          );
        });

      test
        .stdout()
        .command([
          'verify',
          'list',
          '--jobId',
          'test-job-123',
          '--format',
          'json',
        ])
        .it('shows job status in JSON format', ctx => {
          expect(ctx.stdout).to.contain('"type": "verification"');
          expect(ctx.stdout).to.contain('"status": "completed"');
          expect(ctx.stdout).to.contain('"progress": 100');
        });

      test
        .stderr()
        .do(() => {
          // Mock job not found
          mockBackgroundOpsManager.getOperationStatus.mockResolvedValueOnce(
            null
          );
        })
        .command(['verify', 'list', '--jobId', 'nonexistent-job'])
        .exit(2)
        .it('handles non-existent job ID', ctx => {
          expect(ctx.stderr).to.contain('Job nonexistent-job not found');
        });

      test
        .stdout()
        .do(() => {
          // Mock operation with error
          mockBackgroundOpsManager.getOperationStatus.mockResolvedValueOnce({
            type: 'verification',
            status: 'failed',
            progress: 75,
            stage: 'failed',
            startedAt: new Date(),
            completedAt: new Date(),
            error: 'Verification failed: Network timeout',
          });
        })
        .command(['verify', 'list', '--jobId', 'failed-job'])
        .it('displays job error information', ctx => {
          expect(ctx.stdout).to.contain('Status: ❌ Failed');
          expect(ctx.stdout).to.contain(
            'Error: Verification failed: Network timeout'
          );
        });
    });

    describe('error handling', () => {
      test
        .stderr()
        .command(['verify', 'invalid-action'])
        .exit(2)
        .it('handles invalid action');

      test
        .stderr()
        .do(() => {
          // Mock background operations manager failure
          const mockCreateBackgroundAIOperationsManager =
            require('../../apps/cli/src/utils/background-ai-operations').createBackgroundAIOperationsManager;
          mockCreateBackgroundAIOperationsManager.mockRejectedValueOnce(
            new Error('Background service unavailable')
          );
        })
        .command(['verify', 'list', '--background'])
        .exit(2)
        .it('handles background service failure', ctx => {
          expect(ctx.stderr).to.contain(
            'Failed to start background verification list: Background service unavailable'
          );
        });
    });
  });
});
