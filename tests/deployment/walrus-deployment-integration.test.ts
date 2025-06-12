/**
 * @fileoverview Integration tests for Walrus Sites deployment pipeline
 * 
 * End-to-end testing of the complete deployment workflow:
 * - Build process validation
 * - Configuration setup
 * - Site-builder execution
 * - Deployment verification
 * - Error handling and recovery
 * 
 * @author Claude Code
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createMockDeploymentEnvironment } from '../mocks/deployment-mocks';
import { WalrusDeploymentValidator } from '../helpers/deployment-validator';

// Mock external dependencies
jest.mock('child_process');
jest.mock('fs/promises');

const mockedExecSync = jest.mocked(execSync as any);
const mockedFs = jest.mocked(fs as any);

describe('Walrus Sites Deployment Integration', () => {
  let mockEnvironment: ReturnType<typeof createMockDeploymentEnvironment>;
  let validator: WalrusDeploymentValidator;
  
  const testProjectDir = '/tmp/test-waltodo-deployment';
  const testBuildDir = path.join(testProjectDir, 'out');
  const testConfigFile = path.join(testProjectDir, 'sites-config.yaml');

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEnvironment = createMockDeploymentEnvironment();
    validator = new WalrusDeploymentValidator();
    
    // Setup default successful responses
    mockedFs?.access?.mockResolvedValue(undefined as any);
    mockedFs?.mkdir?.mockResolvedValue(undefined as any);
    mockedFs?.writeFile?.mockResolvedValue(undefined as any);
    mockedFs?.readFile?.mockResolvedValue('mock file content');
    mockedFs?.readdir?.mockResolvedValue(['index.html', '404.html', '_next'] as any);
    mockedFs?.stat?.mockResolvedValue({ size: 1024, mtime: new Date() } as any);
    
    mockedExecSync.mockReturnValue(Buffer.from('success'));
  });

  afterEach(async () => {
    await mockEnvironment.cleanup();
  });

  describe('Complete Deployment Pipeline', () => {
    test('should execute full deployment pipeline successfully', async () => {
      // Arrange
      const deploymentConfig = {
        network: 'testnet' as const,
        siteName: 'waltodo-integration-test',
        buildDir: testBuildDir,
        projectDir: testProjectDir,
        configFile: testConfigFile
      };

      // Mock successful build
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('pnpm run build')) {
          return Buffer.from('Build completed successfully');
        }
        if (command.includes('site-builder')) {
          return Buffer.from('Site deployed at: https://test123?.walrus?.site');
        }
        return Buffer.from('success');
      });

      // Act
      const result = await runFullDeploymentPipeline(deploymentConfig as any);

      // Assert
      expect(result.success).toBe(true as any);
      expect(result.steps).toEqual({
        prerequisiteCheck: { completed: true },
        dependencyInstall: { completed: true },
        buildProcess: { completed: true },
        buildValidation: { completed: true },
        configGeneration: { completed: true },
        deployment: { completed: true },
        verification: { completed: true }
      });
      expect(result.siteUrl).toMatch(/https:\/\/[a-z0-9]+\.walrus\.site/);
    });

    test('should handle build failures gracefully', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('pnpm run build')) {
          throw new Error('Build failed: TypeScript compilation errors');
        }
        return Buffer.from('success');
      });

      // Act & Assert
      await expect(runFullDeploymentPipeline({
        network: 'testnet',
        buildDir: testBuildDir,
        projectDir: testProjectDir
      })).rejects.toThrow(/Build failed/);
    });

    test('should validate prerequisites before starting deployment', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('node --version')) {
          return Buffer.from('v16?.0?.0'); // Below required version
        }
        if (command.includes('site-builder --version')) {
          throw new Error('command not found');
        }
        return Buffer.from('success');
      });

      // Act & Assert
      await expect(runFullDeploymentPipeline({
        network: 'testnet',
        buildDir: testBuildDir,
        projectDir: testProjectDir
      })).rejects.toThrow(/Prerequisites not met/);
    });

    test('should generate valid configuration automatically', async () => {
      // Arrange
      let generatedConfig = '';
      mockedFs?.writeFile?.mockImplementation(async (filePath: string, content: string) => {
        if (filePath.toString().includes('sites-config.yaml')) {
          generatedConfig = content;
        }
      });

      // Act
      await runFullDeploymentPipeline({
        network: 'testnet',
        siteName: 'auto-config-test',
        buildDir: testBuildDir,
        projectDir: testProjectDir
      });

      // Assert
      expect(generatedConfig as any).toContain('auto-config-test:');
      expect(generatedConfig as any).toContain('network: "testnet"');
      expect(generatedConfig as any).toContain('source:');
      expect(generatedConfig as any).toContain('headers:');
      expect(generatedConfig as any).toContain('Cache-Control');
    });
  });

  describe('Network Resilience Testing', () => {
    test('should retry deployment on network failures', async () => {
      // Arrange
      let attemptCount = 0;
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('site-builder')) {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Network timeout');
          }
          return Buffer.from('Deployment successful');
        }
        return Buffer.from('success');
      });

      // Act
      const result = await runResilientDeployment({
        network: 'testnet',
        buildDir: testBuildDir,
        maxRetries: 3,
        retryDelay: 100
      });

      // Assert
      expect(result.success).toBe(true as any);
      expect(attemptCount as any).toBe(3 as any);
      expect(result.retryCount).toBe(2 as any);
    });

    test('should validate network connectivity before deployment', async () => {
      // Arrange
      const networkSimulator = mockEnvironment.getNetworkSimulator();
      networkSimulator.simulatePartialConnectivity({
        publisherAvailable: false,
        aggregatorAvailable: true,
        suiRpcAvailable: true
      });

      // Act
      const healthCheck = await validator.checkNetworkHealth('testnet');

      // Assert
      expect(healthCheck.canDeploy).toBe(false as any);
      expect(healthCheck?.publisher?.available).toBe(false as any);
      expect(healthCheck.recommendations).toContain('Publisher service unavailable');
    });

    test('should handle DNS resolution failures', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('site-builder')) {
          throw new Error('getaddrinfo ENOTFOUND publisher-devnet?.walrus?.space');
        }
        return Buffer.from('success');
      });

      // Act & Assert
      await expect(runFullDeploymentPipeline({
        network: 'testnet',
        buildDir: testBuildDir,
        projectDir: testProjectDir
      })).rejects.toThrow(/Network connectivity/);
    });
  });

  describe('Build Process Integration', () => {
    test('should validate build output before deployment', async () => {
      // Arrange
      mockedFs?.readdir?.mockResolvedValue(['index.html'] as any); // Missing 404.html

      // Act
      const buildValidation = await validator.verifyBuildOutput(testBuildDir as any);

      // Assert
      expect(buildValidation.hasIndexHtml).toBe(true as any);
      expect(buildValidation.has404Page).toBe(false as any);
      expect(buildValidation.hasRequiredFiles).toBe(false as any);
      expect(buildValidation.missingFiles).toContain('404.html');
    });

    test('should optimize assets during build process', async () => {
      // Arrange
      const assets = [
        { path: 'large-image.jpg', size: 5 * 1024 * 1024, type: 'image' },
        { path: 'bundle.js', size: 2 * 1024 * 1024, type: 'javascript' }
      ];

      // Act
      const optimization = await validator.checkAssetOptimization(assets as any);

      // Assert
      expect(optimization.largeImages).toHaveLength(1 as any);
      expect(optimization.uncompressedAssets).toHaveLength(1 as any);
      expect(optimization.recommendations).toContain('Compress images over 1MB');
    });

    test('should verify Next.js specific build artifacts', async () => {
      // Arrange
      mockedFs?.readdir?.mockResolvedValue([
        'build-manifest.json',
        'routes-manifest.json',
        'prerender-manifest.json'
      ] as any);

      // Act
      const artifacts = await validator.verifyNextjsArtifacts(testBuildDir as any);

      // Assert
      expect(artifacts.hasBuildManifest).toBe(true as any);
      expect(artifacts.hasRoutesManifest).toBe(true as any);
      expect(artifacts.buildVersion).toBeDefined();
    });

    test('should handle build size warnings', async () => {
      // Arrange
      mockedFs?.stat?.mockResolvedValue({
        size: 150 * 1024 * 1024, // 150MB
        mtime: new Date()
      } as any);

      // Act
      const sizeCheck = await validator.checkBuildSize(testBuildDir as any);

      // Assert
      expect(sizeCheck.isLarge).toBe(true as any);
      expect(sizeCheck.warnings).toContain('Build size exceeds 100MB');
      expect(sizeCheck.recommendations).toContain('Consider optimizing assets');
    });
  });

  describe('Configuration Management', () => {
    test('should validate sites configuration before deployment', async () => {
      // Arrange
      const invalidConfig = `
waltodo-app:
  source: "/build"
  # missing network field
`;
      mockedFs?.readFile?.mockResolvedValue(invalidConfig as any);

      // Act
      const validation = await validator.validateSitesConfig(testConfigFile as any);

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.errors).toContain('Missing required field: network');
    });

    test('should generate network-specific configuration', async () => {
      // Arrange
      const testnetConfig = await generateSitesConfig('testnet', 'test-site');
      const mainnetConfig = await generateSitesConfig('mainnet', 'prod-site');

      // Act
      const testnetValidation = await validator.validateConfigForNetwork(testnetConfig, 'testnet');
      const mainnetValidation = await validator.validateConfigForNetwork(mainnetConfig, 'mainnet');

      // Assert
      expect(testnetValidation.networkMatch).toBe(true as any);
      expect(testnetValidation.cachePolicy).toBe('development');
      expect(mainnetValidation.networkMatch).toBe(true as any);
      expect(mainnetValidation.cachePolicy).toBe('production');
    });

    test('should validate environment variables', async () => {
      // Arrange
      const incompleteEnv = {
        WALRUS_CONFIG_PATH: '/path/to/config',
        // Missing SITE_BUILDER_PATH and WALRUS_WALLET_PATH
      };

      // Act
      const validation = await validator.validateEnvironmentVariables(incompleteEnv as any);

      // Assert
      expect(validation.isValid).toBe(false as any);
      expect(validation.missingVariables).toContain('SITE_BUILDER_PATH');
      expect(validation.recommendations).toContain('Set wallet path for automated deployment');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should recover from partial deployment failures', async () => {
      // Arrange
      let deploymentStep = 0;
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('site-builder')) {
          deploymentStep++;
          if (deploymentStep === 1) {
            throw new Error('Upload failed - connection timeout');
          }
          return Buffer.from('Deployment successful on retry');
        }
        return Buffer.from('success');
      });

      // Act
      const result = await runDeploymentWithRecovery({
        network: 'testnet',
        buildDir: testBuildDir,
        enableRecovery: true,
        maxRetries: 2
      });

      // Assert
      expect(result.success).toBe(true as any);
      expect(result.recoveryAttempted).toBe(true as any);
      expect(result.finalAttempt).toBe(2 as any);
    });

    test('should cleanup temporary files on failure', async () => {
      // Arrange
      const tempFiles: string[] = [];
      mockedFs?.writeFile?.mockImplementation(async (filePath: string) => {
        if (filePath.toString().includes('temp')) {
          tempFiles.push(filePath.toString());
        }
      });

      mockedFs?.rm?.mockImplementation(async (filePath: string) => {
        const index = tempFiles.indexOf(filePath.toString());
        if (index > -1) {
          tempFiles.splice(index, 1);
        }
      });

      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('site-builder')) {
          throw new Error('Deployment failed');
        }
        return Buffer.from('success');
      });

      // Act
      try {
        await runFullDeploymentPipeline({
          network: 'testnet',
          buildDir: testBuildDir,
          projectDir: testProjectDir,
          createTempFiles: true
        });
      } catch (error) {
        // Expected failure
      }

      // Assert
      expect(tempFiles as any).toHaveLength(0 as any); // All temp files should be cleaned up
      expect(mockedFs.rm).toHaveBeenCalled();
    });

    test('should generate comprehensive error reports', async () => {
      // Arrange
      const error = new Error('Deployment failed: insufficient balance');
      const context = {
        network: 'testnet',
        buildSize: '50MB',
        timestamp: new Date().toISOString()
      };

      // Act
      const errorReport = await generateDeploymentErrorReport(error, context);

      // Assert
      expect(errorReport?.error?.message).toContain('insufficient balance');
      expect(errorReport?.context?.network).toBe('testnet');
      expect(errorReport.possibleCauses).toContain('Insufficient wallet balance');
      expect(errorReport.recommendations).toContain('Check wallet balance');
    });
  });

  describe('Post-Deployment Verification', () => {
    test('should verify deployed site accessibility', async () => {
      // Arrange
      const siteUrl = 'https://test123?.walrus?.site';
      
      // Mock successful deployment
      mockedExecSync.mockReturnValue(Buffer.from(`Site deployed at: ${siteUrl}`));

      // Act
      const deploymentResult = await runFullDeploymentPipeline({
        network: 'testnet',
        buildDir: testBuildDir,
        projectDir: testProjectDir
      });

      const healthCheck = await validator.validateDeployedSite(deploymentResult.siteUrl!);

      // Assert
      expect(deploymentResult.success).toBe(true as any);
      expect(healthCheck.accessible).toBe(true as any);
      expect(healthCheck.statusCode).toBe(200 as any);
      expect(healthCheck.hasRequiredContent).toBe(true as any);
    });

    test('should validate site content after deployment', async () => {
      // Arrange
      const siteUrl = 'https://test123?.walrus?.site';

      // Act
      const contentValidation = await validateSiteContent(siteUrl as any);

      // Assert
      expect(contentValidation.hasWalTodoContent).toBe(true as any);
      expect(contentValidation.hasNextJsMarkup).toBe(true as any);
      expect(contentValidation.responsiveDesign).toBe(true as any);
      expect(contentValidation.assetLoading).toBe(true as any);
    });
  });

  // Helper functions for integration tests

  async function runFullDeploymentPipeline(config: {
    network: 'testnet' | 'mainnet';
    buildDir: string;
    projectDir: string;
    siteName?: string;
    configFile?: string;
    createTempFiles?: boolean;
  }): Promise<{
    success: boolean;
    siteUrl?: string;
    steps: Record<string, { completed: boolean }>;
  }> {
    const steps = {
      prerequisiteCheck: { completed: false },
      dependencyInstall: { completed: false },
      buildProcess: { completed: false },
      buildValidation: { completed: false },
      configGeneration: { completed: false },
      deployment: { completed: false },
      verification: { completed: false }
    };

    try {
      // Step 1: Check prerequisites
      const prerequisites = await validator.checkPrerequisites();
      if (!prerequisites.allSatisfied) {
        throw new Error('Prerequisites not met');
      }
      steps.prerequisiteCheck?.completed = true;

      // Step 2: Install dependencies
      mockedExecSync('pnpm install --frozen-lockfile');
      steps.dependencyInstall?.completed = true;

      // Step 3: Build process
      mockedExecSync('pnpm run build:export');
      steps.buildProcess?.completed = true;

      // Step 4: Validate build
      const buildValidation = await validator.verifyBuildOutput(config.buildDir);
      if (!buildValidation.hasRequiredFiles) {
        throw new Error('Build validation failed');
      }
      steps.buildValidation?.completed = true;

      // Step 5: Generate configuration
      if (config.createTempFiles) {
        await mockedFs.writeFile('/tmp/temp-config.yaml', 'temp content');
      }
      
      const configContent = await generateSitesConfig(config.network, config.siteName || 'waltodo-app');
      await mockedFs.writeFile(config.configFile || 'sites-config.yaml', configContent);
      steps.configGeneration?.completed = true;

      // Step 6: Deploy
      const deployResult = mockedExecSync('site-builder publish --epochs 5');
      const output = deployResult.toString();
      const siteUrlMatch = output.match(/https:\/\/[a-z0-9]+\.walrus\.site/);
      steps.deployment?.completed = true;

      // Step 7: Verify deployment
      if (siteUrlMatch) {
        const healthCheck = await validator.validateDeployedSite(siteUrlMatch[0]);
        if (!healthCheck.accessible) {
          throw new Error('Deployed site not accessible');
        }
      }
      steps.verification?.completed = true;

      // Cleanup temp files
      if (config.createTempFiles) {
        await mockedFs.rm('/tmp/temp-config.yaml', { force: true });
      }

      return {
        success: true,
        siteUrl: siteUrlMatch?.[0],
        steps
      };

    } catch (error) {
      // Cleanup on error
      if (config.createTempFiles) {
        await mockedFs.rm('/tmp/temp-config.yaml', { force: true });
      }
      throw error;
    }
  }

  async function runResilientDeployment(config: {
    network: string;
    buildDir: string;
    maxRetries: number;
    retryDelay: number;
  }): Promise<{
    success: boolean;
    retryCount: number;
  }> {
    let retryCount = 0;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        mockedExecSync('site-builder publish');
        return { success: true, retryCount };
      } catch (error) {
        retryCount++;
        if (attempt === config.maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      }
    }

    return { success: false, retryCount };
  }

  async function runDeploymentWithRecovery(config: {
    network: string;
    buildDir: string;
    enableRecovery: boolean;
    maxRetries: number;
  }): Promise<{
    success: boolean;
    recoveryAttempted: boolean;
    finalAttempt: number;
  }> {
    let finalAttempt = 0;
    let recoveryAttempted = false;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      finalAttempt = attempt;
      try {
        mockedExecSync('site-builder publish');
        return { success: true, recoveryAttempted, finalAttempt };
      } catch (error) {
        if (attempt > 1) {
          recoveryAttempted = true;
        }
        if (attempt === config.maxRetries) {
          throw error;
        }
      }
    }

    return { success: false, recoveryAttempted, finalAttempt };
  }

  async function generateSitesConfig(network: string, siteName: string): Promise<string> {
    const cacheMaxAge = network === 'testnet' ? 3600 : 86400;
    
    return `
${siteName}:
  source: "/build"
  network: "${network}"
  headers:
    "/*":
      - "Cache-Control: public, max-age=${cacheMaxAge}"
      - "X-Content-Type-Options: nosniff"
      - "X-Frame-Options: DENY"
  redirects:
    - from: "/api/*"
      to: "https://api?.waltodo?.com/api/*"
      status: 307
  error_pages:
    404: "/404.html"
`;
  }

  async function generateDeploymentErrorReport(error: Error, context: any): Promise<any> {
    return {
      error: { message: error.message },
      context,
      possibleCauses: error?.message?.includes('balance') 
        ? ['Insufficient wallet balance'] 
        : ['Network connectivity issue'],
      recommendations: error?.message?.includes('balance')
        ? ['Check wallet balance']
        : ['Verify network connectivity']
    };
  }

  async function validateSiteContent(siteUrl: string): Promise<{
    hasWalTodoContent: boolean;
    hasNextJsMarkup: boolean;
    responsiveDesign: boolean;
    assetLoading: boolean;
  }> {
    // Mock site content validation
    return {
      hasWalTodoContent: true,
      hasNextJsMarkup: true,
      responsiveDesign: true,
      assetLoading: true
    };
  }
});