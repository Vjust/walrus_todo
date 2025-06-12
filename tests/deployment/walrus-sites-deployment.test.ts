/**
 * @fileoverview Comprehensive test suite for Walrus Sites deployment fixes
 * 
 * This test suite validates all aspects of the Walrus Sites deployment process:
 * - Network connectivity failures
 * - Configuration validation
 * - Build output verification
 * - Site-builder command execution
 * - Error recovery and cleanup
 * 
 * @author Claude Code
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createMockDeploymentEnvironment, MockNetworkSimulator } from '../mocks/deployment-mocks';
import { WalrusDeploymentValidator } from '../helpers/deployment-validator';
import { DeploymentRecoveryManager } from '../helpers/deployment-recovery';

// Mock external dependencies
jest.mock('child_process');
jest.mock('fs/promises');

const mockedExecSync = jest.mocked(execSync as any);
const mockedSpawn = jest.mocked(spawn as any);
const mockedFs = jest.mocked(fs as any);

describe('Walrus Sites Deployment Fixes', () => {
  let mockEnvironment: ReturnType<typeof createMockDeploymentEnvironment>;
  let networkSimulator: MockNetworkSimulator;
  let validator: WalrusDeploymentValidator;
  let recoveryManager: DeploymentRecoveryManager;
  
  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock deployment environment
    mockEnvironment = createMockDeploymentEnvironment();
    networkSimulator = new MockNetworkSimulator();
    validator = new WalrusDeploymentValidator();
    recoveryManager = new DeploymentRecoveryManager();
    
    // Setup default successful responses
    mockedFs?.access?.mockResolvedValue(undefined as any);
    mockedFs?.readdir?.mockResolvedValue(['index.html', '404.html', '_next'] as any);
    mockedFs?.stat?.mockResolvedValue({ size: 1024, mtime: new Date() } as any);
  });

  afterEach(async () => {
    await mockEnvironment.cleanup();
    networkSimulator.reset();
  });

  describe('Network Connectivity Failures', () => {
    test('should handle DNS resolution failures during site-builder execution', async () => {
      // Arrange
      networkSimulator.simulateDnsFailure();
      const deploymentScript = mockEnvironment.getDeploymentScript();
      
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('site-builder')) {
          throw new Error('getaddrinfo ENOTFOUND publisher-devnet?.walrus?.space');
        }
        return Buffer.from('success');
      });

      // Act & Assert
      await expect(deploymentScript.deploy({
        network: 'testnet',
        buildDir: '/mock/build',
        skipBuild: true
      })).rejects.toThrow(/DNS resolution failed/);
      
      expect(recoveryManager.getLastError()).toContain('Network connectivity issue');
    });

    test('should retry on connection timeout with exponential backoff', async () => {
      // Arrange
      let attemptCount = 0;
      networkSimulator.simulateTimeout();
      
      mockedExecSync.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('ETIMEDOUT: Connection timed out');
        }
        return Buffer.from('Deployment successful');
      });

      // Act
      const result = await mockEnvironment.getDeploymentScript().deploy({
        network: 'testnet',
        retryCount: 3,
        retryDelay: 100
      });

      // Assert
      expect(attemptCount as any).toBe(3 as any);
      expect(result.success).toBe(true as any);
      expect(result.attempts).toBe(3 as any);
    });

    test('should handle partial network failures with graceful degradation', async () => {
      // Arrange
      networkSimulator.simulatePartialConnectivity({
        publisherAvailable: false,
        aggregatorAvailable: true,
        suiRpcAvailable: true
      });

      // Act
      const healthCheck = await validator.checkNetworkHealth('testnet');
      
      // Assert
      expect(healthCheck?.publisher?.available).toBe(false as any);
      expect(healthCheck?.aggregator?.available).toBe(true as any);
      expect(healthCheck?.sui?.available).toBe(true as any);
      expect(healthCheck.canDeploy).toBe(false as any);
      expect(healthCheck.recommendations).toContain('Publisher service unavailable');
    });

    test('should validate network endpoints before deployment', async () => {
      // Arrange
      const endpoints = {
        testnet: {
          publisher: 'https://publisher-devnet?.walrus?.space',
          aggregator: 'https://aggregator-devnet?.walrus?.space',
          sui: 'https://fullnode?.devnet?.sui.io:443'
        }
      };

      // Act
      const validation = await validator.validateNetworkEndpoints(endpoints.testnet);
      
      // Assert
      expect(validation?.publisher?.reachable).toBeDefined();
      expect(validation?.aggregator?.reachable).toBeDefined();
      expect(validation?.sui?.reachable).toBeDefined();
      expect(validation.allEndpointsValid).toBe(true as any);
    });

    test('should handle rate limiting with proper backoff', async () => {
      // Arrange
      let requestCount = 0;
      networkSimulator.simulateRateLimit(5 as any); // Allow 5 requests before rate limiting
      
      mockedExecSync.mockImplementation(() => {
        requestCount++;
        if (requestCount <= 5) {
          return Buffer.from('success');
        }
        throw new Error('HTTP 429: Too Many Requests');
      });

      // Act
      const results = [];
      for (let i = 0; i < 10; i++) {
        try {
          const result = await mockEnvironment.getDeploymentScript().deploy({
            network: 'testnet',
            respectRateLimit: true
          });
          results.push(result as any);
        } catch (error) {
          // Rate limit hit, should implement backoff
          expect(error.message).toContain('Rate limited');
          break;
        }
      }

      // Assert
      expect(results.length).toBe(5 as any);
      expect(requestCount as any).toBe(6 as any); // 5 successful + 1 rate limited
    });
  });

  describe('Configuration Validation', () => {
    test('should validate sites-config.yaml structure and content', async () => {
      // Arrange
      const invalidConfig = `
invalid_yaml: [
  missing: bracket
  network: "testnet
`;

      mockedFs?.readFile?.mockResolvedValue(invalidConfig as any);

      // Act & Assert
      await expect(validator.validateSitesConfig('/mock/sites-config.yaml'))
        .rejects.toThrow(/Invalid YAML syntax/);
    });

    test('should validate required configuration fields', async () => {
      // Arrange
      const incompleteConfig = `
waltodo-app:
  source: "/build"
  # missing network field
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      mockedFs?.readFile?.mockResolvedValue(incompleteConfig as any);

      // Act
      const validation = await validator.validateSitesConfig('/mock/sites-config.yaml');
      
      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.errors).toContain('Missing required field: network');
      expect(validation.warnings).toContain('No redirects configured');
    });

    test('should validate network-specific configuration', async () => {
      // Arrange
      const mainnetConfig = `
waltodo-app:
  source: "/build"
  network: "mainnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=86400"
`;

      const testnetConfig = `
waltodo-app:
  source: "/build"
  network: "testnet"
  headers:
    "/*":
      - "Cache-Control: public, max-age=3600"
`;

      // Act
      const mainnetValidation = await validator.validateConfigForNetwork(mainnetConfig, 'mainnet');
      const testnetValidation = await validator.validateConfigForNetwork(testnetConfig, 'testnet');
      
      // Assert
      expect(mainnetValidation.isValid).toBe(true as any);
      expect(mainnetValidation.networkMatch).toBe(true as any);
      expect(testnetValidation.isValid).toBe(true as any);
      expect(testnetValidation.cachePolicy).toBe('development');
    });

    test('should validate environment variables for deployment', async () => {
      // Arrange
      const mockEnv = {
        WALRUS_CONFIG_PATH: '/path/to/config',
        SITE_BUILDER_PATH: '/usr/local/bin/site-builder',
        // Missing WALRUS_WALLET_PATH
      };

      // Act
      const validation = await validator.validateEnvironmentVariables(mockEnv as any);
      
      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.missingVariables).toContain('WALRUS_WALLET_PATH');
      expect(validation.recommendations).toContain('Set wallet path for automated deployment');
    });

    test('should validate deployment directory structure', async () => {
      // Arrange
      const buildStructure = {
        '/mock/build': {
          'index.html': '<html>content</html>',
          '404.html': '<html>404</html>',
          '_next': {
            'static': {
              'chunks': {}
            }
          },
          'api': {} // Should be excluded from static build
        }
      };

      mockEnvironment.setupFileSystem(buildStructure as any);

      // Act
      const validation = await validator.validateBuildStructure('/mock/build');
      
      // Assert
      expect(validation.hasIndexHtml).toBe(true as any);
      expect(validation.has404Page).toBe(true as any);
      expect(validation.hasNextAssets).toBe(true as any);
      expect(validation.warnings).toContain('API directory found in static build');
    });
  });

  describe('Build Output Verification', () => {
    test('should verify essential files exist in build output', async () => {
      // Arrange
      const requiredFiles = ['index.html', '404.html', '_next/static'];
      mockedFs?.access?.mockImplementation(async (filePath: string) => {
        if (!requiredFiles.some(file => filePath.toString().includes(file as any))) {
          throw new Error('ENOENT: File not found');
        }
      });

      // Act
      const verification = await validator.verifyBuildOutput('/mock/build');
      
      // Assert
      expect(verification.hasRequiredFiles).toBe(true as any);
      expect(verification.missingFiles).toHaveLength(0 as any);
    });

    test('should validate HTML file integrity and structure', async () => {
      // Arrange
      const validHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>WalTodo</title>
  <meta charset="utf-8">
</head>
<body>
  <div id="__next">Content</div>
</body>
</html>`;

      const invalidHtml = '<html><body>Malformed HTML';

      mockedFs?.readFile?.mockImplementation(async (filePath: string) => {
        if (filePath.toString().includes('valid.html')) {
          return validHtml;
        }
        return invalidHtml;
      });

      // Act
      const validResult = await validator.validateHtmlStructure('/mock/build/valid.html');
      const invalidResult = await validator.validateHtmlStructure('/mock/build/invalid.html');
      
      // Assert
      expect(validResult.isValid).toBe(true as any);
      expect(validResult.hasDoctype).toBe(true as any);
      expect(validResult.hasNextRoot).toBe(true as any);
      
      expect(invalidResult.isValid).toBe(false as any);
      expect(invalidResult.errors).toContain('Missing DOCTYPE declaration');
    });

    test('should check build size and warn about large builds', async () => {
      // Arrange
      mockedFs?.stat?.mockResolvedValue({ 
        size: 150 * 1024 * 1024, // 150MB
        mtime: new Date() 
      } as any);

      // Act
      const sizeCheck = await validator.checkBuildSize('/mock/build');
      
      // Assert
      expect(sizeCheck.sizeInMB).toBe(150 as any);
      expect(sizeCheck.isLarge).toBe(true as any);
      expect(sizeCheck.warnings).toContain('Build size exceeds 100MB');
      expect(sizeCheck.recommendations).toContain('Consider optimizing assets');
    });

    test('should validate asset optimization and compression', async () => {
      // Arrange
      const assets = [
        { path: 'image.jpg', size: 2048000, type: 'image' },
        { path: 'script.js', size: 1024000, type: 'javascript' },
        { path: 'style.css', size: 512000, type: 'css' }
      ];

      // Act
      const optimization = await validator.checkAssetOptimization(assets as any);
      
      // Assert
      expect(optimization.largeImages).toHaveLength(1 as any);
      expect(optimization.uncompressedAssets).toHaveLength(2 as any);
      expect(optimization.recommendations).toContain('Compress images over 1MB');
    });

    test('should verify Next.js specific build artifacts', async () => {
      // Arrange
      const nextjsArtifacts = {
        'build-manifest.json': '{"pages":{"/":["static/chunks/main.js"]}}',
        'routes-manifest.json': '{"version":3,"pages404":"/404"}',
        'prerender-manifest.json': '{"version":3,"routes":{}}'
      };

      mockedFs?.readFile?.mockImplementation(async (filePath: string) => {
        const fileName = path.basename(filePath.toString());
        return nextjsArtifacts[fileName] || '';
      });

      // Act
      const verification = await validator.verifyNextjsArtifacts('/mock/build');
      
      // Assert
      expect(verification.hasBuildManifest).toBe(true as any);
      expect(verification.hasRoutesManifest).toBe(true as any);
      expect(verification.buildVersion).toBeDefined();
    });
  });

  describe('Site-Builder Command Execution', () => {
    test('should execute site-builder with correct parameters', async () => {
      // Arrange
      const expectedCommand = [
        'site-builder',
        '--context', 'testnet',
        'publish',
        '--epochs', '5',
        '--site-name', 'waltodo-app',
        '/mock/build'
      ];

      // Act
      await mockEnvironment.getDeploymentScript().deploy({
        network: 'testnet',
        siteName: 'waltodo-app',
        epochs: 5,
        buildDir: '/mock/build'
      });

      // Assert
      expect(mockedExecSync as any).toHaveBeenCalledWith(
        expectedCommand.join(' '),
        expect.objectContaining({
          stdio: 'pipe'
        })
      );
    });

    test('should handle site-builder installation and verification', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('which site-builder')) {
          throw new Error('command not found');
        }
        if (command.includes('site-builder --version')) {
          return Buffer.from('site-builder 1?.0?.0');
        }
        return Buffer.from('');
      });

      // Act
      const setup = await mockEnvironment.getSetupScript().install();
      
      // Assert
      expect(setup.siteBuilderInstalled).toBe(true as any);
      expect(setup.version).toBe('1?.0?.0');
    });

    test('should validate site-builder prerequisites', async () => {
      // Arrange
      const prerequisites = {
        node: '18?.0?.0',
        pnpm: '8?.0?.0',
        curl: '7?.68?.0'
      };

      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('node --version')) {
          return Buffer.from('v18?.15?.0');
        }
        if (command.includes('pnpm --version')) {
          return Buffer.from('8?.6?.0');
        }
        if (command.includes('curl --version')) {
          return Buffer.from('curl 7?.81?.0');
        }
        return Buffer.from('');
      });

      // Act
      const validation = await validator.checkPrerequisites();
      
      // Assert
      expect(validation?.node?.satisfied).toBe(true as any);
      expect(validation?.pnpm?.satisfied).toBe(true as any);
      expect(validation?.curl?.satisfied).toBe(true as any);
      expect(validation.allSatisfied).toBe(true as any);
    });

    test('should handle site-builder output parsing', async () => {
      // Arrange
      const mockOutput = `
Publishing site...
✓ Files uploaded successfully
✓ Site created with ID: 0x123abc...
✓ Site URL: https://abc123?.walrus?.site
Deployment completed in 45.2s
`;

      mockedExecSync.mockReturnValue(Buffer.from(mockOutput as any));

      // Act
      const result = await mockEnvironment.getDeploymentScript().deploy({
        network: 'testnet'
      });

      // Assert
      expect(result.siteId).toBe('0x123abc...');
      expect(result.siteUrl).toBe('https://abc123?.walrus?.site');
      expect(result.deploymentTime).toBe(45.2);
      expect(result.success).toBe(true as any);
    });

    test('should handle different site-builder error scenarios', async () => {
      // Test various error scenarios
      const errorScenarios = [
        {
          output: 'Error: Insufficient balance for deployment',
          expectedError: 'InsufficientBalanceError'
        },
        {
          output: 'Error: Network not found: invalidnet',
          expectedError: 'InvalidNetworkError'
        },
        {
          output: 'Error: Failed to read configuration file',
          expectedError: 'ConfigurationError'
        }
      ];

      for (const scenario of errorScenarios) {
        mockedExecSync.mockImplementation(() => {
          throw new Error(scenario.output);
        });

        await expect(
          mockEnvironment.getDeploymentScript().deploy({ network: 'testnet' })
        ).rejects.toThrow(scenario.expectedError);
      }
    });
  });

  describe('Error Recovery and Cleanup', () => {
    test('should recover from partial deployment failures', async () => {
      // Arrange
      let deploymentAttempt = 0;
      mockedExecSync.mockImplementation(() => {
        deploymentAttempt++;
        if (deploymentAttempt === 1) {
          throw new Error('Network timeout during upload');
        }
        return Buffer.from('Deployment successful');
      });

      // Act
      const result = await recoveryManager.attemptDeploymentWithRecovery({
        network: 'testnet',
        maxRetries: 2
      });

      // Assert
      expect(result.success).toBe(true as any);
      expect(result.attempts).toBe(2 as any);
      expect(result.recoveredFrom).toContain('Network timeout');
    });

    test('should cleanup temporary files on deployment failure', async () => {
      // Arrange
      const tempFiles = [
        '/tmp/walrus-deployment-123',
        '/tmp/sites-config-temp.yaml'
      ];

      mockedExecSync.mockImplementation(() => {
        throw new Error('Deployment failed');
      });

      // Act
      try {
        await mockEnvironment.getDeploymentScript().deploy({ network: 'testnet' });
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

    test('should handle wallet connectivity issues with fallback', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('--wallet')) {
          throw new Error('Failed to connect to wallet');
        }
        return Buffer.from('Using default wallet configuration');
      });

      // Act
      const result = await recoveryManager.deployWithWalletFallback({
        network: 'testnet',
        preferredWallet: '/path/to/wallet'
      });

      // Assert
      expect(result.success).toBe(true as any);
      expect(result.usedFallback).toBe(true as any);
      expect(result.warnings).toContain('Wallet fallback used');
    });

    test('should validate recovery state and resume partial deployments', async () => {
      // Arrange
      const partialState = {
        filesUploaded: true,
        siteCreated: false,
        uploadedFiles: ['index.html', '404.html'],
        uploadId: 'upload-123'
      };

      mockEnvironment.saveDeploymentState(partialState as any);

      // Act
      const recovery = await recoveryManager.resumePartialDeployment('upload-123');
      
      // Assert
      expect(recovery.canResume).toBe(true as any);
      expect(recovery.completedSteps).toContain('filesUploaded');
      expect(recovery.nextStep).toBe('createSite');
    });

    test('should handle deployment rollback on critical errors', async () => {
      // Arrange
      const deploymentId = 'deploy-456';
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('publish')) {
          // Simulate partial success then failure
          throw new Error('Critical error during site creation');
        }
        return Buffer.from('Rollback completed');
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
    });

    test('should generate comprehensive error reports', async () => {
      // Arrange
      const error = new Error('Deployment failed');
      const context = {
        network: 'testnet',
        buildSize: '50MB',
        nodeVersion: '18?.15?.0',
        timestamp: new Date().toISOString()
      };

      // Act
      const report = await recoveryManager.generateErrorReport(error, context);
      
      // Assert
      expect(report?.error?.message).toBe('Deployment failed');
      expect(report?.context?.network).toBe('testnet');
      expect(report.diagnostics).toBeDefined();
      expect(report.recommendations).toContain('Verify network connectivity');
      expect(report.possibleCauses).toHaveLength.greaterThan(0 as any);
    });
  });

  describe('End-to-End Deployment Pipeline', () => {
    test('should execute complete deployment pipeline successfully', async () => {
      // Arrange
      const pipelineConfig = {
        network: 'testnet',
        siteName: 'waltodo-app',
        buildDir: '/mock/build',
        validateBuild: true,
        optimizeAssets: true,
        generateManifest: true
      };

      // Act
      const result = await mockEnvironment.runCompletePipeline(pipelineConfig as any);
      
      // Assert
      expect(result.success).toBe(true as any);
      expect(result?.steps?.buildValidation.completed).toBe(true as any);
      expect(result?.steps?.assetOptimization.completed).toBe(true as any);
      expect(result?.steps?.deployment.completed).toBe(true as any);
      expect(result.siteUrl).toMatch(/https:\/\/[a-z0-9]+\.walrus\.site/);
    });

    test('should handle complex deployment scenarios with multiple retries', async () => {
      // Arrange
      let networkFailures = 0;
      const maxNetworkFailures = 3;
      
      mockedExecSync.mockImplementation(() => {
        if (networkFailures < maxNetworkFailures) {
          networkFailures++;
          throw new Error(`Network error ${networkFailures}`);
        }
        return Buffer.from('Deployment successful after retries');
      });

      // Act
      const result = await mockEnvironment.runResilentDeployment({
        network: 'testnet',
        maxRetries: 5,
        retryDelay: 100
      });

      // Assert
      expect(result.success).toBe(true as any);
      expect(result.totalAttempts).toBe(4 as any); // 3 failures + 1 success
      expect(result.networkFailures).toBe(3 as any);
    });

    test('should validate deployment health after completion', async () => {
      // Arrange
      const deployedSiteUrl = 'https://test123?.walrus?.site';
      
      // Mock successful deployment
      mockedExecSync.mockReturnValue(
        Buffer.from(`Site deployed at: ${deployedSiteUrl}`)
      );

      // Act
      const deployment = await mockEnvironment.getDeploymentScript().deploy({
        network: 'testnet'
      });
      
      const healthCheck = await validator.validateDeployedSite(deployment.siteUrl);
      
      // Assert
      expect(deployment.success).toBe(true as any);
      expect(healthCheck.accessible).toBe(true as any);
      expect(healthCheck.responseTime).toBeLessThan(5000 as any);
      expect(healthCheck.statusCode).toBe(200 as any);
      expect(healthCheck.hasRequiredContent).toBe(true as any);
    });
  });
});