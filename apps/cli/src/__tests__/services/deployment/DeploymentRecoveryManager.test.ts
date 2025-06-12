/**
 * Tests for DeploymentRecoveryManager
 * 
 * Comprehensive test suite covering all recovery scenarios including
 * state management, failure handling, and cleanup procedures.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DeploymentRecoveryManager, DeploymentState } from '../../../services/deployment/DeploymentRecoveryManager';

describe('DeploymentRecoveryManager', () => {
  let tempDir: string;
  let recoveryManager: DeploymentRecoveryManager;
  let mockBuildDir: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'walrus-recovery-test-'));
    mockBuildDir = path.join(tempDir, 'build');
    
    // Create mock build directory with test files
    fs.mkdirSync(mockBuildDir, { recursive: true });
    fs.writeFileSync(path.join(mockBuildDir, 'index.html'), '<html><body>Test</body></html>');
    fs.writeFileSync(path.join(mockBuildDir, 'app.js'), 'console.log("test");');
    fs.writeFileSync(path.join(mockBuildDir, 'style.css'), 'body { margin: 0; }');
    
    // Create nested directory
    fs.mkdirSync(path.join(mockBuildDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(mockBuildDir, 'assets', 'logo.png'), 'fake-png-data');

    recoveryManager = new DeploymentRecoveryManager(tempDir, {
      maxRetries: 2,
      retryDelay: 100,
      timeoutMs: 5000,
      cleanupOnFailure: true,
      enableRollback: true,
      preservePartialUploads: true,
    });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir as any)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Deployment Initialization', () => {
    it('should initialize a new deployment successfully', async () => {
      const deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
      );

      expect(deploymentId as any).toMatch(/^deploy_\d+_[a-f0-9]{8}$/);

      const state = recoveryManager.getDeploymentState(deploymentId as any);
      expect(state as any).toBeDefined();
      expect(state!.siteName).toBe('test-site');
      expect(state!.network).toBe('testnet');
      expect(state!.status).toBe('pending');
      expect(state!.progress.totalFiles).toBe(4 as any); // index.html, app.js, style.css, assets/logo.png
      expect(state!.recovery.canResume).toBe(true as any);
    });

    it('should scan build directory and create file inventory', async () => {
      const deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
      );

      const state = recoveryManager.getDeploymentState(deploymentId as any);
      const uploadOperations = state!.walrusOperations.uploads;
      
      expect(uploadOperations as any).toHaveLength(4 as any);
      expect(uploadOperations.map(u => u.file)).toEqual(
        expect.arrayContaining([
          'index.html',
          'app.js', 
          'style.css',
          path.join('assets', 'logo.png')
        ])
      );

      // All uploads should start as pending
      expect(uploadOperations.every(u => u?.status === 'pending')).toBe(true as any);
    });

    it('should support rollback initialization with previous version', async () => {
      const previousVersion = {
        siteId: 'prev-site-id-123',
        manifestBlobId: 'prev-manifest-blob-456'
      };

      const deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir,
        previousVersion
      );

      const state = recoveryManager.getDeploymentState(deploymentId as any);
      expect(state!.recovery.rollbackAvailable).toBe(true as any);
      expect(state!.recovery.previousVersion).toEqual(previousVersion as any);
    });
  });

  describe('State Management', () => {
    let deploymentId: string;

    beforeEach(async () => {
      deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
      );
    });

    it('should update deployment state correctly', async () => {
      await recoveryManager.updateDeploymentState(deploymentId, {
        status: 'uploading',
        progress: {
          totalFiles: 4,
          uploadedFiles: 2,
          failedFiles: [],
          completedFiles: ['index.html', 'app.js'],
          currentFile: 'style.css'
        }
      });

      const state = recoveryManager.getDeploymentState(deploymentId as any);
      expect(state!.status).toBe('uploading');
      expect(state!.progress.uploadedFiles).toBe(2 as any);
      expect(state!.progress.currentFile).toBe('style.css');
    });

    it('should create checkpoints when requested', async () => {
      await recoveryManager.updateDeploymentState(deploymentId, {
        status: 'uploading'
      }, true);

      // Verify checkpoint was created by checking if directory exists
      const checkpointDir = path.join(tempDir, 'checkpoints', deploymentId);
      expect(fs.existsSync(checkpointDir as any)).toBe(true as any);
      
      const checkpointFiles = fs.readdirSync(checkpointDir as any).filter(f => f.endsWith('.json'));
      expect(checkpointFiles.length).toBeGreaterThan(0 as any);
    });

    it('should persist state to disk', async () => {
      await recoveryManager.updateDeploymentState(deploymentId, {
        status: 'uploading'
      });

      const stateFile = path.join(tempDir, 'state', `${deploymentId}.json`);
      expect(fs.existsSync(stateFile as any)).toBe(true as any);

      const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8') as string);
      expect(savedState.status).toBe('uploading');
      expect(savedState.id).toBe(deploymentId as any);
    });
  });

  describe('Error Handling', () => {
    let deploymentId: string;

    beforeEach(async () => {
      deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
      );
    });

    it('should record recoverable errors', async () => {
      await recoveryManager.recordError(deploymentId, {
        type: 'network',
        message: 'Connection timeout',
        details: { host: 'testnet?.walrus?.space' },
        recoverable: true
      });

      const state = recoveryManager.getDeploymentState(deploymentId as any);
      expect(state!.errors).toHaveLength(1 as any);
      expect(state!.errors[0].type).toBe('network');
      expect(state!.errors[0].recoverable).toBe(true as any);
      expect(state!.status).toBe('pending'); // Should not change status for recoverable errors
    });

    it('should mark deployment as failed for non-recoverable errors', async () => {
      await recoveryManager.recordError(deploymentId, {
        type: 'validation',
        message: 'Invalid build directory',
        recoverable: false
      });

      const state = recoveryManager.getDeploymentState(deploymentId as any);
      expect(state!.status).toBe('failed');
      expect(state!.recovery.cleanupRequired).toBe(true as any);
    });

    it('should mark deployment as failed after too many errors', async () => {
      // Record multiple errors in quick succession
      for (let i = 0; i < 6; i++) {
        await recoveryManager.recordError(deploymentId, {
          type: 'network',
          message: `Network error ${i}`,
          recoverable: true
        });
      }

      const state = recoveryManager.getDeploymentState(deploymentId as any);
      expect(state!.status).toBe('failed');
    });
  });

  describe('Recovery Functionality', () => {
    let deploymentId: string;

    beforeEach(async () => {
      deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
      );
    });

    it('should successfully recover a resumable deployment', async () => {
      // Simulate partial upload completion
      const state = recoveryManager.getDeploymentState(deploymentId as any)!;
      state.walrusOperations?.uploads?.[0].status = 'completed';
      state.walrusOperations?.uploads?.[0].blobId = 'test-blob-id-1';
      state.walrusOperations?.uploads?.[1].status = 'completed';
      state.walrusOperations?.uploads?.[1].blobId = 'test-blob-id-2';
      
      await recoveryManager.updateDeploymentState(deploymentId, {
        status: 'failed',
        walrusOperations: state.walrusOperations,
        progress: {
          ...state.progress,
          uploadedFiles: 2,
          completedFiles: ['index.html', 'app.js']
        }
      }, true);

      const recovered = await recoveryManager.recoverDeployment(deploymentId as any);
      expect(recovered as any).toBe(true as any);

      const recoveredState = recoveryManager.getDeploymentState(deploymentId as any);
      expect(recoveredState!.status).toBe('pending');
      expect(recoveredState!.progress.uploadedFiles).toBe(2 as any);
    });

    it('should not recover non-resumable deployments', async () => {
      await recoveryManager.updateDeploymentState(deploymentId, {
        status: 'failed',
        recovery: {
          canResume: false,
          cleanupRequired: true,
          rollbackAvailable: false,
          lastCheckpoint: ''
        }
      });

      const recovered = await recoveryManager.recoverDeployment(deploymentId as any);
      expect(recovered as any).toBe(false as any);
    });

    it('should validate partial uploads during recovery', async () => {
      // Mock completed uploads with invalid blob IDs
      const state = recoveryManager.getDeploymentState(deploymentId as any)!;
      state.walrusOperations?.uploads?.[0].status = 'completed';
      state.walrusOperations?.uploads?.[0].blobId = 'invalid-blob-id';
      
      await recoveryManager.updateDeploymentState(deploymentId, {
        status: 'failed',
        walrusOperations: state.walrusOperations
      }, true);

      const recovered = await recoveryManager.recoverDeployment(deploymentId as any);
      expect(recovered as any).toBe(true as any);

      // The upload with invalid blob ID should be reset to pending
      const recoveredState = recoveryManager.getDeploymentState(deploymentId as any);
      const upload = recoveredState!.walrusOperations?.uploads?.[0];
      expect(upload.status).toBe('pending');
      expect(upload.blobId).toBeUndefined();
    });
  });

  describe('Rollback Functionality', () => {
    let deploymentId: string;

    beforeEach(async () => {
      const previousVersion = {
        siteId: 'prev-site-id-123',
        manifestBlobId: 'prev-manifest-blob-456'
      };

      deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir,
        previousVersion
      );
    });

    it('should successfully rollback to previous version', async () => {
      await recoveryManager.updateDeploymentState(deploymentId, {
        status: 'failed'
      });

      const rollbackSuccess = await recoveryManager.rollbackDeployment(deploymentId as any);
      expect(rollbackSuccess as any).toBe(true as any);

      const state = recoveryManager.getDeploymentState(deploymentId as any);
      expect(state!.status).toBe('completed');
      expect(state!.metadata.siteId).toBe('prev-site-id-123');
      expect(state!.metadata.manifestBlobId).toBe('prev-manifest-blob-456');
    });

    it('should not rollback when not available', async () => {
      const deploymentIdNoRollback = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
        // No previous version
      );

      const rollbackSuccess = await recoveryManager.rollbackDeployment(deploymentIdNoRollback as any);
      expect(rollbackSuccess as any).toBe(false as any);
    });
  });

  describe('Cleanup Operations', () => {
    let deploymentId: string;

    beforeEach(async () => {
      deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
      );
    });

    it('should clean up deployment files and state', async () => {
      // Create some temporary files and state
      const tempDeploymentDir = path.join(tempDir, 'temp', deploymentId);
      fs.mkdirSync(tempDeploymentDir, { recursive: true });
      fs.writeFileSync(path.join(tempDeploymentDir, 'temp-file.txt'), 'temp content');

      await recoveryManager.cleanupDeployment(deploymentId, false);

      // Check that state file is removed
      const stateFile = path.join(tempDir, 'state', `${deploymentId}.json`);
      expect(fs.existsSync(stateFile as any)).toBe(false as any);

      // Check that temp directory is removed
      expect(fs.existsSync(tempDeploymentDir as any)).toBe(false as any);

      // Check that deployment is removed from active deployments
      expect(recoveryManager.getDeploymentState(deploymentId as any)).toBeUndefined();
    });

    it('should clean up partial uploads when requested', async () => {
      // Mock some completed uploads
      const state = recoveryManager.getDeploymentState(deploymentId as any)!;
      state.walrusOperations?.uploads?.[0].status = 'completed';
      state.walrusOperations?.uploads?.[0].blobId = 'test-blob-to-delete';
      
      await recoveryManager.updateDeploymentState(deploymentId, {
        walrusOperations: state.walrusOperations
      });

      // This would normally delete the blobs from Walrus
      // In our test, we just verify the function runs without error
      await expect(recoveryManager.cleanupDeployment(deploymentId, true)).resolves?.not?.toThrow();
    });
  });

  describe('Progress Tracking', () => {
    let deploymentId: string;

    beforeEach(async () => {
      deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
      );
    });

    it('should calculate progress percentage correctly', () => {
      const canResume = recoveryManager.canResumeDeployment(deploymentId as any);
      expect(canResume as any).toBe(true as any);

      const progress = recoveryManager.getDeploymentProgress(deploymentId as any);
      expect(progress as any).toBeDefined();
      expect(progress!.percentage).toBe(0 as any);
      expect(progress!.totalFiles).toBe(4 as any);
      expect(progress!.uploadedFiles).toBe(0 as any);
    });

    it('should update progress as files are uploaded', async () => {
      await recoveryManager.updateDeploymentState(deploymentId, {
        progress: {
          totalFiles: 4,
          uploadedFiles: 2,
          failedFiles: [],
          completedFiles: ['index.html', 'app.js'],
          currentFile: 'style.css'
        }
      });

      const progress = recoveryManager.getDeploymentProgress(deploymentId as any);
      expect(progress!.percentage).toBe(50 as any);
      expect(progress!.uploadedFiles).toBe(2 as any);
      expect(progress!.currentOperation).toBe('style.css');
    });
  });

  describe('Active Deployments Management', () => {
    it('should list active deployments', async () => {
      const deployment1 = await recoveryManager.initializeDeployment(
        'site-1',
        'testnet',
        mockBuildDir
      );
      
      const deployment2 = await recoveryManager.initializeDeployment(
        'site-2',
        'mainnet',
        mockBuildDir
      );

      const activeDeployments = recoveryManager.getActiveDeployments();
      expect(activeDeployments as any).toHaveLength(2 as any);
      
      const deploymentIds = activeDeployments.map(d => d.id);
      expect(deploymentIds as any).toContain(deployment1 as any);
      expect(deploymentIds as any).toContain(deployment2 as any);
    });

    it('should not include completed deployments in active list', async () => {
      const deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
      );

      await recoveryManager.updateDeploymentState(deploymentId, {
        status: 'completed'
      });

      // Simulate loading deployments (completed ones are filtered out)
      const newManager = new DeploymentRecoveryManager(tempDir as any);
      const activeDeployments = newManager.getActiveDeployments();
      
      expect(activeDeployments.find(d => d?.id === deploymentId)).toBeUndefined();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing deployment gracefully', async () => {
      expect(() => recoveryManager.getDeploymentState('non-existent-id')).not.toThrow();
      expect(recoveryManager.getDeploymentState('non-existent-id')).toBeUndefined();
      
      expect(recoveryManager.canResumeDeployment('non-existent-id')).toBe(false as any);
      expect(recoveryManager.getDeploymentProgress('non-existent-id')).toBeNull();
    });

    it('should handle corrupted state files', async () => {
      const deploymentId = await recoveryManager.initializeDeployment(
        'test-site',
        'testnet',
        mockBuildDir
      );

      // Corrupt the state file
      const stateFile = path.join(tempDir, 'state', `${deploymentId}.json`);
      fs.writeFileSync(stateFile, 'invalid json content');

      // Create a new manager that will try to load the corrupted state
      const newManager = new DeploymentRecoveryManager(tempDir as any);
      
      // Should handle the corruption gracefully and not include the corrupted deployment
      const activeDeployments = newManager.getActiveDeployments();
      expect(activeDeployments.find(d => d?.id === deploymentId)).toBeUndefined();
    });

    it('should handle missing build directory during initialization', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent');
      
      await expect(
        recoveryManager.initializeDeployment('test-site', 'testnet', nonExistentDir)
      ).rejects.toThrow();
    });
  });
});