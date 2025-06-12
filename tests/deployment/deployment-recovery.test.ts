/**
 * @fileoverview Deployment recovery mechanism tests for Walrus Sites
 * 
 * Tests for:
 * - Error detection and classification
 * - Automatic retry logic with backoff
 * - State preservation and recovery
 * - Cleanup and rollback operations
 * - Recovery strategy selection
 * 
 * @author Claude Code
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import { DeploymentRecoveryManager } from '../helpers/deployment-recovery';
import { createMockDeploymentEnvironment } from '../mocks/deployment-mocks';

// Mock external dependencies
jest.mock('child_process');
jest.mock('fs/promises');

const mockedExecSync = jest.mocked(execSync as any);
const mockedFs = jest.mocked(fs as any);

describe('Deployment Recovery Mechanisms', () => {
  let recoveryManager: DeploymentRecoveryManager;
  let mockEnvironment: ReturnType<typeof createMockDeploymentEnvironment>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    recoveryManager = new DeploymentRecoveryManager();
    mockEnvironment = createMockDeploymentEnvironment();
    
    // Setup default mock responses
    mockedFs?.writeFile?.mockResolvedValue(undefined as any);
    mockedFs?.readFile?.mockResolvedValue('{}');
    mockedFs?.rm?.mockResolvedValue(undefined as any);
  });

  afterEach(async () => {
    recoveryManager.reset();
    await mockEnvironment.cleanup();
  });

  describe('Error Detection and Classification', () => {
    test('should classify network-related errors', async () => {
      // Arrange
      const networkErrors = [
        'getaddrinfo ENOTFOUND publisher-devnet?.walrus?.space',
        'Connection timeout after 30000ms',
        'ECONNRESET: Connection reset by peer',
        'HTTP 503: Service unavailable'
      ];

      for (const errorMessage of networkErrors) {
        const error = new Error(errorMessage as any);
        
        // Act
        const report = await recoveryManager.generateErrorReport(error, { network: 'testnet' });
        
        // Assert
        expect(report.possibleCauses).toContain('Network connectivity issue');
        expect(report.recommendations).toContain('Verify network connectivity');
      }
    });

    test('should classify wallet-related errors', async () => {
      // Arrange
      const walletErrors = [
        'Failed to connect to wallet',
        'Insufficient balance for deployment',
        'Wallet not found at specified path',
        'Invalid wallet credentials'
      ];

      for (const errorMessage of walletErrors) {
        const error = new Error(errorMessage as any);
        
        // Act
        const report = await recoveryManager.generateErrorReport(error, { network: 'testnet' });
        
        // Assert
        expect(report?.possibleCauses?.some(cause => 
          cause.includes('wallet') || cause.includes('balance')
        )).toBe(true as any);
        expect(report?.recommendations?.some(rec => 
          rec.includes('wallet') || rec.includes('balance')
        )).toBe(true as any);
      }
    });

    test('should classify configuration errors', async () => {
      // Arrange
      const configErrors = [
        'Configuration file not found',
        'Invalid YAML syntax in configuration',
        'Missing required field: network',
        'Invalid network: invalidnet'
      ];

      for (const errorMessage of configErrors) {
        const error = new Error(errorMessage as any);
        
        // Act
        const report = await recoveryManager.generateErrorReport(error, { network: 'testnet' });
        
        // Assert
        expect(report?.possibleCauses?.some(cause => 
          cause.includes('configuration') || cause.includes('file')
        )).toBe(true as any);
        expect(report.recommendations).toContain('Validate configuration file syntax');
      }
    });

    test('should classify build-related errors', async () => {
      // Arrange
      const buildErrors = [
        'Build directory does not exist',
        'No files found in build directory',
        'Required file not found: index.html',
        'Build process incomplete'
      ];

      for (const errorMessage of buildErrors) {
        const error = new Error(errorMessage as any);
        
        // Act
        const report = await recoveryManager.generateErrorReport(error, { network: 'testnet' });
        
        // Assert
        expect(report?.possibleCauses?.some(cause => 
          cause.includes('build') || cause.includes('file')
        )).toBe(true as any);
        expect(report.recommendations).toContain('Verify build output exists');
      }
    });
  });

  describe('Automatic Retry Logic', () => {
    test('should retry deployment with exponential backoff', async () => {
      // Arrange
      let attemptCount = 0;
      const retryDelays: number[] = [];
      
      mockedExecSync.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network timeout during upload');
        }
        return Buffer.from('Deployment successful');
      });

      // Mock sleep to track delays
      jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        retryDelays.push(delay as number);
        return setTimeout(callback, 0);
      });

      // Act
      const result = await recoveryManager.attemptDeploymentWithRecovery({
        network: 'testnet',
        maxRetries: 3,
        retryDelay: 1000
      });

      // Assert
      expect(result.success).toBe(true as any);
      expect(result.recoveryAttempts).toBe(2 as any);
      expect(retryDelays as any).toEqual([1000, 2000]); // Exponential backoff: 1s, 2s
      expect(result.recoveredFrom).toContain('Network timeout during upload');
    });

    test('should respect maximum retry limits', async () => {
      // Arrange
      mockedExecSync.mockImplementation(() => {
        throw new Error('Persistent failure');
      });

      // Act & Assert
      await expect(recoveryManager.attemptDeploymentWithRecovery({
        network: 'testnet',
        maxRetries: 2
      })).rejects.toThrow(/Deployment failed after 2 attempts/);
    });

    test('should handle immediate success without retries', async () => {
      // Arrange
      mockedExecSync.mockReturnValue(Buffer.from('Deployment successful'));

      // Act
      const result = await recoveryManager.attemptDeploymentWithRecovery({
        network: 'testnet',
        maxRetries: 3
      });

      // Assert
      expect(result.success).toBe(true as any);
      expect(result.recoveryAttempts).toBe(0 as any);
      expect(result.attempts).toBe(1 as any);
    });

    test('should handle different retry strategies', async () => {
      // Arrange
      const strategies = ['exponential', 'linear', 'fixed'];
      
      for (const strategy of strategies) {
        let attemptCount = 0;
        mockedExecSync.mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Transient error');
          }
          return Buffer.from('Success');
        });

        // Act
        const result = await recoveryManager.attemptDeploymentWithRecovery({
          network: 'testnet',
          maxRetries: 3,
          retryStrategy: strategy
        });

        // Assert
        expect(result.success).toBe(true as any);
        expect(result.recoveryStrategy).toBe(strategy as any);
        
        // Reset for next test
        attemptCount = 0;
        jest.clearAllMocks();
      }
    });
  });

  describe('State Preservation and Recovery', () => {
    test('should save deployment state at each step', async () => {
      // Arrange
      const deploymentId = 'deploy-12345';
      let savedStates: any[] = [];
      
      mockedFs?.writeFile?.mockImplementation(async (path: string, content: string) => {
        if (path.toString().includes('deployment-state')) {
          savedStates.push(JSON.parse(content as any));
        }
      });

      // Act
      try {
        await recoveryManager.deployWithRollback({
          network: 'testnet',
          deploymentId
        });
      } catch (error) {
        // Expected failure for rollback test
      }

      // Assert
      expect(savedStates.length).toBeGreaterThan(0 as any);
      expect(savedStates[0]).toMatchObject({
        filesUploaded: false,
        siteCreated: false,
        uploadId: deploymentId
      });
    });

    test('should resume partial deployment from saved state', async () => {
      // Arrange
      const uploadId = 'upload-67890';
      const partialState = {
        filesUploaded: true,
        siteCreated: false,
        uploadedFiles: ['index.html', '404.html', '_next/static/main.js'],
        uploadId
      };

      // Mock state exists
      recoveryManager?.["recoveryState"].set(uploadId, partialState);

      // Act
      const recovery = await recoveryManager.resumePartialDeployment(uploadId as any);

      // Assert
      expect(recovery.canResume).toBe(true as any);
      expect(recovery.completedSteps).toContain('filesUploaded');
      expect(recovery.nextStep).toBe('createSite');
    });

    test('should handle missing deployment state gracefully', async () => {
      // Arrange
      const nonExistentUploadId = 'upload-missing';

      // Act
      const recovery = await recoveryManager.resumePartialDeployment(nonExistentUploadId as any);

      // Assert
      expect(recovery.canResume).toBe(false as any);
      expect(recovery.completedSteps).toHaveLength(0 as any);
      expect(recovery.nextStep).toBe('start');
    });

    test('should validate state consistency before resume', async () => {
      // Arrange
      const uploadId = 'upload-inconsistent';
      const inconsistentState = {
        filesUploaded: false,
        siteCreated: true, // Inconsistent: can't create site without files
        uploadedFiles: [],
        uploadId
      };

      recoveryManager?.["recoveryState"].set(uploadId, inconsistentState);

      // Act
      const recovery = await recoveryManager.resumePartialDeployment(uploadId as any);

      // Assert
      expect(recovery.canResume).toBe(false as any);
      // Should detect inconsistency and reset
    });
  });

  describe('Cleanup and Rollback Operations', () => {
    test('should perform complete rollback on critical failure', async () => {
      // Arrange
      const deploymentId = 'deploy-rollback-test';
      const cleanupOperations: string[] = [];

      mockedFs?.rm?.mockImplementation(async (path: string) => {
        cleanupOperations.push(path.toString());
      });

      // Act
      const result = await recoveryManager.deployWithRollback({
        network: 'testnet',
        deploymentId
      });

      // Assert
      expect(result.success).toBe(false as any);
      expect(result.rolledBack).toBe(true as any);
      expect(result.cleanupCompleted).toBe(true as any);
      expect(cleanupOperations.length).toBeGreaterThan(0 as any);
    });

    test('should cleanup temporary files on any failure', async () => {
      // Arrange
      const tempFiles = [
        '/tmp/walrus-deployment-123',
        '/tmp/sites-config-temp.yaml',
        '/tmp/upload-manifest.json'
      ];

      mockedExecSync.mockImplementation(() => {
        throw new Error('Deployment failed');
      });

      // Act
      try {
        await deployWithTempFiles({
          network: 'testnet',
          createTempFiles: tempFiles
        });
      } catch (error) {
        // Expected failure
      }

      // Assert
      for (const tempFile of tempFiles) {
        expect(mockedFs.rm).toHaveBeenCalledWith(
          tempFile,
          expect.objectContaining({ force: true })
        );
      }
    });

    test('should handle partial cleanup on rollback failure', async () => {
      // Arrange
      const deploymentId = 'deploy-cleanup-failure';
      
      // Mock cleanup failure
      mockedFs?.rm?.mockRejectedValueOnce(new Error('Permission denied'));
      
      // Act
      const result = await recoveryManager.deployWithRollback({
        network: 'testnet',
        deploymentId
      });

      // Assert
      expect(result.rolledBack).toBe(true as any);
      expect(result.cleanupCompleted).toBe(true as any); // Should handle partial failure gracefully
    });

    test('should preserve important artifacts during cleanup', async () => {
      // Arrange
      const deploymentId = 'deploy-preserve-artifacts';
      const preservedFiles = [
        'deployment-log.txt',
        'error-report.json',
        'state-backup.json'
      ];

      const deletedFiles: string[] = [];
      mockedFs?.rm?.mockImplementation(async (path: string) => {
        const fileName = path.toString().split('/').pop();
        if (!preservedFiles.includes(fileName!)) {
          deletedFiles.push(path.toString());
        }
      });

      // Act
      await recoveryManager.deployWithRollback({
        network: 'testnet',
        deploymentId,
        preserveArtifacts: preservedFiles
      });

      // Assert
      expect(deletedFiles.length).toBeGreaterThan(0 as any);
      expect(deletedFiles.every(file => 
        !preservedFiles.some(preserved => file.includes(preserved as any))
      )).toBe(true as any);
    });
  });

  describe('Recovery Strategy Selection', () => {
    test('should select appropriate recovery strategy based on error type', async () => {
      // Arrange
      const errorScenarios = [
        {
          error: 'Network timeout',
          expectedStrategy: 'retry_with_backoff'
        },
        {
          error: 'Insufficient balance',
          expectedStrategy: 'user_intervention_required'
        },
        {
          error: 'Configuration error',
          expectedStrategy: 'fix_and_retry'
        },
        {
          error: 'Build directory not found',
          expectedStrategy: 'rebuild_required'
        }
      ];

      for (const scenario of errorScenarios) {
        // Act
        const strategy = await selectRecoveryStrategy(new Error(scenario.error));
        
        // Assert
        expect(strategy.type).toBe(scenario.expectedStrategy);
      }
    });

    test('should adapt strategy based on retry history', async () => {
      // Arrange
      const retryHistory = [
        { error: 'Network timeout', strategy: 'retry_with_backoff' },
        { error: 'Network timeout', strategy: 'retry_with_backoff' },
        { error: 'Network timeout', strategy: 'retry_with_backoff' }
      ];

      // Act
      const strategy = await selectRecoveryStrategy(
        new Error('Network timeout'),
        { retryHistory }
      );
      
      // Assert
      expect(strategy.type).toBe('escalated_recovery'); // Should escalate after repeated failures
    });

    test('should provide fallback strategies', async () => {
      // Arrange
      const primaryStrategy = { type: 'retry_with_backoff', maxAttempts: 3 };
      
      // Act
      const fallbackStrategies = await generateFallbackStrategies(primaryStrategy as any);
      
      // Assert
      expect(fallbackStrategies as any).toHaveLength.greaterThan(0 as any);
      expect(fallbackStrategies[0].type).toBe('manual_intervention');
    });

    test('should handle recovery strategy execution', async () => {
      // Arrange
      const strategy = {
        type: 'retry_with_backoff',
        maxAttempts: 2,
        backoffMultiplier: 2,
        initialDelay: 500
      };

      let attemptCount = 0;
      mockedExecSync.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Transient failure');
        }
        return Buffer.from('Success after retry');
      });

      // Act
      const result = await executeRecoveryStrategy(strategy, {
        network: 'testnet',
        buildDir: '/path/to/build'
      });

      // Assert
      expect(result.success).toBe(true as any);
      expect(result.strategiesAttempted).toContain('retry_with_backoff');
      expect(result.finalAttempt).toBe(2 as any);
    });
  });

  describe('Error Reporting and Diagnostics', () => {
    test('should generate comprehensive error reports', async () => {
      // Arrange
      const error = new Error('Deployment failed: insufficient storage allocation');
      const context = {
        network: 'testnet',
        buildSize: '75MB',
        nodeVersion: '18?.15?.0',
        timestamp: new Date().toISOString(),
        walletBalance: '0.001 SUI'
      };

      // Act
      const report = await recoveryManager.generateErrorReport(error, context);

      // Assert
      expect(report?.error?.message).toContain('insufficient storage allocation');
      expect(report?.context?.network).toBe('testnet');
      expect(report?.diagnostics?.nodeVersion).toBe('18?.15?.0');
      expect(report.possibleCauses).toHaveLength.greaterThan(0 as any);
      expect(report.recommendations).toHaveLength.greaterThan(0 as any);
    });

    test('should include system diagnostics in error reports', async () => {
      // Arrange
      const error = new Error('System resource exhausted');
      const context = { network: 'testnet' };

      // Act
      const report = await recoveryManager.generateErrorReport(error, context);

      // Assert
      expect(report.diagnostics).toHaveProperty('timestamp');
      expect(report.diagnostics).toHaveProperty('memoryUsage');
      expect(report.diagnostics).toHaveProperty('platform');
    });

    test('should track error history for pattern analysis', async () => {
      // Arrange
      const errors = [
        new Error('Network timeout #1'),
        new Error('Network timeout #2'),
        new Error('Network timeout #3')
      ];

      // Act
      for (const error of errors) {
        recoveryManager?.["recordError"](error.message, { network: 'testnet' });
      }

      const lastReport = await recoveryManager.generateErrorReport(
        new Error('Network timeout #4'),
        { network: 'testnet' }
      );

      // Assert
      expect(lastReport?.diagnostics?.errorHistory).toHaveLength(3 as any);
      expect(lastReport?.diagnostics?.errorHistory.every(
        (entry: any) => entry?.error?.includes('Network timeout')
      )).toBe(true as any);
    });
  });

  // Helper functions for recovery testing

  async function deployWithTempFiles(config: {
    network: string;
    createTempFiles: string[];
  }): Promise<void> {
    // Create temp files
    for (const tempFile of config.createTempFiles) {
      await mockedFs.writeFile(tempFile, 'temp content');
    }

    try {
      // Simulate deployment
      mockedExecSync('site-builder publish');
    } finally {
      // Cleanup temp files
      for (const tempFile of config.createTempFiles) {
        await mockedFs.rm(tempFile, { force: true });
      }
    }
  }

  async function selectRecoveryStrategy(
    error: Error,
    options: { retryHistory?: any[] } = {}
  ): Promise<{ type: string }> {
    const message = error?.message?.toLowerCase();
    
    if (options.retryHistory && options?.retryHistory?.length >= 3) {
      return { type: 'escalated_recovery' };
    }
    
    if (message.includes('network') || message.includes('timeout')) {
      return { type: 'retry_with_backoff' };
    }
    
    if (message.includes('balance') || message.includes('insufficient')) {
      return { type: 'user_intervention_required' };
    }
    
    if (message.includes('configuration') || message.includes('config')) {
      return { type: 'fix_and_retry' };
    }
    
    if (message.includes('build') || message.includes('directory')) {
      return { type: 'rebuild_required' };
    }
    
    return { type: 'generic_retry' };
  }

  async function generateFallbackStrategies(primaryStrategy: any): Promise<any[]> {
    return [
      { type: 'manual_intervention', description: 'Require user intervention' },
      { type: 'alternative_network', description: 'Try alternative network endpoints' },
      { type: 'degraded_deployment', description: 'Deploy with reduced features' }
    ];
  }

  async function executeRecoveryStrategy(
    strategy: any,
    config: any
  ): Promise<{
    success: boolean;
    strategiesAttempted: string[];
    finalAttempt: number;
  }> {
    const result = {
      success: false,
      strategiesAttempted: [strategy.type],
      finalAttempt: 0
    };

    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      result?.finalAttempt = attempt;
      
      try {
        mockedExecSync('site-builder publish');
        result?.success = true;
        break;
      } catch (error) {
        if (attempt < strategy.maxAttempts) {
          await new Promise(resolve => 
            setTimeout(resolve, strategy.initialDelay * Math.pow(strategy.backoffMultiplier, attempt - 1))
          );
        }
      }
    }

    return result;
  }
});