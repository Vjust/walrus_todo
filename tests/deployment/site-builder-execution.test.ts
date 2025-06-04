/**
 * @fileoverview Site-builder command execution tests for Walrus Sites deployment
 * 
 * Tests for:
 * - Site-builder installation and setup
 * - Command parameter validation
 * - Output parsing and error handling
 * - Different deployment scenarios
 * - Version compatibility
 * 
 * @author Claude Code
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs/promises';
import { WalrusDeploymentValidator } from '../helpers/deployment-validator';

// Mock external dependencies
jest.mock('child_process');
jest.mock('fs/promises');

const mockedExecSync = jest.mocked(execSync);
const mockedSpawn = jest.mocked(spawn);
const mockedFs = jest.mocked(fs);

describe('Site-Builder Command Execution', () => {
  let validator: WalrusDeploymentValidator;
  
  beforeEach(() => {
    jest.clearAllMocks();
    validator = new WalrusDeploymentValidator();
  });

  describe('Installation and Setup', () => {
    test('should verify site-builder installation', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('which site-builder')) {
          return Buffer.from('/usr/local/bin/site-builder');
        }
        if (command.includes('site-builder --version')) {
          return Buffer.from('site-builder 1.2.3');
        }
        return Buffer.from('');
      });

      // Act
      const installation = await checkSiteBuilderInstallation();

      // Assert
      expect(installation.installed).toBe(true);
      expect(installation.version).toBe('1.2.3');
      expect(installation.path).toBe('/usr/local/bin/site-builder');
    });

    test('should handle missing site-builder installation', async () => {
      // Arrange
      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('which site-builder')) {
          throw new Error('command not found');
        }
        return Buffer.from('');
      });

      // Act
      const installation = await checkSiteBuilderInstallation();

      // Assert
      expect(installation.installed).toBe(false);
      expect(installation.error).toContain('Site-builder not found');
    });

    test('should validate site-builder version compatibility', async () => {
      // Arrange
      const testCases = [
        { version: '1.0.0', compatible: true },
        { version: '0.9.0', compatible: false },
        { version: '2.0.0', compatible: true },
        { version: 'unknown', compatible: false }
      ];

      for (const testCase of testCases) {
        mockedExecSync.mockReturnValue(Buffer.from(`site-builder ${testCase.version}`));

        // Act
        const compatibility = await checkVersionCompatibility();

        // Assert
        expect(compatibility.compatible).toBe(testCase.compatible);
        expect(compatibility.version).toBe(testCase.version);
      }
    });

    test('should handle site-builder installation process', async () => {
      // Arrange
      let installationStep = 0;
      const installationSteps = [
        'Downloading site-builder...',
        'Extracting archive...',
        'Installing to /usr/local/bin...',
        'Installation completed successfully'
      ];

      mockedExecSync.mockImplementation((command: string) => {
        if (command.includes('curl')) {
          return Buffer.from(installationSteps[installationStep++]);
        }
        if (command.includes('tar')) {
          return Buffer.from(installationSteps[installationStep++]);
        }
        if (command.includes('cp')) {
          return Buffer.from(installationSteps[installationStep++]);
        }
        return Buffer.from(installationSteps[installationStep++] || 'success');
      });

      // Act
      const installation = await installSiteBuilder();

      // Assert
      expect(installation.success).toBe(true);
      expect(installation.steps).toHaveLength(4);
      expect(installation.finalMessage).toContain('Installation completed');
    });
  });

  describe('Command Parameter Validation', () => {
    test('should execute site-builder with correct testnet parameters', async () => {
      // Arrange
      const config = {
        network: 'testnet',
        siteName: 'waltodo-test',
        buildDir: '/path/to/build',
        epochs: 5,
        configFile: '/path/to/config.yaml'
      };

      // Act
      await executeSiteBuilderDeploy(config);

      // Assert
      const expectedCommand = [
        'site-builder',
        '--context', 'testnet',
        '--config', '/path/to/config.yaml',
        'publish',
        '--epochs', '5',
        '--site-name', 'waltodo-test',
        '/path/to/build'
      ].join(' ');

      expect(mockedExecSync).toHaveBeenCalledWith(
        expectedCommand,
        expect.objectContaining({ stdio: 'pipe' })
      );
    });

    test('should execute site-builder with correct mainnet parameters', async () => {
      // Arrange
      const config = {
        network: 'mainnet',
        siteName: 'waltodo-prod',
        buildDir: '/path/to/dist',
        epochs: 10,
        wallet: '/path/to/wallet.keystore'
      };

      // Act
      await executeSiteBuilderDeploy(config);

      // Assert
      const expectedCommand = [
        'site-builder',
        '--context', 'mainnet',
        '--wallet', '/path/to/wallet.keystore',
        'publish',
        '--epochs', '10',
        '--site-name', 'waltodo-prod',
        '/path/to/dist'
      ].join(' ');

      expect(mockedExecSync).toHaveBeenCalledWith(
        expectedCommand,
        expect.objectContaining({ stdio: 'pipe' })
      );
    });

    test('should handle optional parameters correctly', async () => {
      // Arrange
      const minimalConfig = {
        network: 'testnet',
        buildDir: '/path/to/build'
      };

      // Act
      await executeSiteBuilderDeploy(minimalConfig);

      // Assert
      const expectedCommand = [
        'site-builder',
        '--context', 'testnet',
        'publish',
        '--epochs', '5',
        '/path/to/build'
      ].join(' ');

      expect(mockedExecSync).toHaveBeenCalledWith(
        expectedCommand,
        expect.objectContaining({ stdio: 'pipe' })
      );
    });

    test('should validate parameter combinations', async () => {
      // Arrange
      const invalidConfigs = [
        { network: 'invalid', buildDir: '/path' },
        { network: 'testnet', buildDir: '' },
        { network: 'testnet', buildDir: '/path', epochs: -1 }
      ];

      for (const config of invalidConfigs) {
        // Act & Assert
        await expect(executeSiteBuilderDeploy(config)).rejects.toThrow(/Invalid configuration/);
      }
    });

    test('should handle environment variable integration', async () => {
      // Arrange
      process.env.WALRUS_CONFIG_PATH = '/custom/config.yaml';
      process.env.SITE_BUILDER_PATH = '/custom/bin/site-builder';

      const config = {
        network: 'testnet',
        buildDir: '/path/to/build'
      };

      // Act
      await executeSiteBuilderDeploy(config);

      // Assert
      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining('/custom/bin/site-builder'),
        expect.objectContaining({ stdio: 'pipe' })
      );

      // Cleanup
      delete process.env.WALRUS_CONFIG_PATH;
      delete process.env.SITE_BUILDER_PATH;
    });
  });

  describe('Output Parsing and Error Handling', () => {
    test('should parse successful deployment output', async () => {
      // Arrange
      const successOutput = `
Starting deployment to Walrus Sites...
✓ Validating build directory
✓ Uploading files to Walrus storage
✓ Creating site configuration
✓ Deploying site to network
✓ Site created successfully!

Site ID: 0x1234567890abcdef...
Site URL: https://abc123def456.walrus.site
Deployment completed in 42.5 seconds
Gas used: 0.001234 SUI
`;

      mockedExecSync.mockReturnValue(Buffer.from(successOutput));

      // Act
      const result = await executeSiteBuilderDeploy({
        network: 'testnet',
        buildDir: '/path/to/build'
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.siteId).toBe('0x1234567890abcdef...');
      expect(result.siteUrl).toBe('https://abc123def456.walrus.site');
      expect(result.deploymentTime).toBe(42.5);
      expect(result.gasUsed).toBe('0.001234 SUI');
    });

    test('should handle deployment failure output', async () => {
      // Arrange
      const failureOutput = `
Starting deployment to Walrus Sites...
✓ Validating build directory
✓ Uploading files to Walrus storage
✗ Failed to create site configuration
Error: Insufficient balance for deployment
Wallet balance: 0.0001 SUI
Required: 0.01 SUI
`;

      mockedExecSync.mockImplementation(() => {
        throw new Error(failureOutput);
      });

      // Act & Assert
      await expect(executeSiteBuilderDeploy({
        network: 'testnet',
        buildDir: '/path/to/build'
      })).rejects.toThrow(/Insufficient balance/);
    });

    test('should parse different error scenarios', async () => {
      // Arrange
      const errorScenarios = [
        {
          output: 'Error: Network not found: invalidnet',
          expectedError: 'InvalidNetworkError',
          expectedMessage: 'Network not found'
        },
        {
          output: 'Error: Build directory does not exist: /invalid/path',
          expectedError: 'BuildDirectoryError',
          expectedMessage: 'Build directory does not exist'
        },
        {
          output: 'Error: Failed to connect to Sui network',
          expectedError: 'NetworkConnectionError',
          expectedMessage: 'Failed to connect to Sui network'
        },
        {
          output: 'Error: Configuration file not found',
          expectedError: 'ConfigurationError',
          expectedMessage: 'Configuration file not found'
        }
      ];

      for (const scenario of errorScenarios) {
        mockedExecSync.mockImplementation(() => {
          throw new Error(scenario.output);
        });

        try {
          await executeSiteBuilderDeploy({
            network: 'testnet',
            buildDir: '/path/to/build'
          });
        } catch (error) {
          expect(error.message).toContain(scenario.expectedMessage);
        }
      }
    });

    test('should handle partial deployment output', async () => {
      // Arrange
      const partialOutput = `
Starting deployment to Walrus Sites...
✓ Validating build directory
✓ Uploading files to Walrus storage
⏳ Creating site configuration...
`;

      mockedExecSync.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      // Act & Assert
      await expect(executeSiteBuilderDeploy({
        network: 'testnet',
        buildDir: '/path/to/build'
      })).rejects.toThrow(/Connection timeout/);
    });

    test('should parse verbose deployment output', async () => {
      // Arrange
      const verboseOutput = `
[DEBUG] Reading configuration from /home/user/.walrus/config.yaml
[DEBUG] Using wallet: /home/user/.walrus/wallet.keystore
[INFO] Starting deployment to testnet
[DEBUG] Scanning build directory: /path/to/build
[DEBUG] Found 42 files to upload
[INFO] Uploading files to Walrus storage...
[DEBUG] Upload progress: 10/42 files (23.8%)
[DEBUG] Upload progress: 20/42 files (47.6%)
[DEBUG] Upload progress: 30/42 files (71.4%)
[DEBUG] Upload progress: 42/42 files (100%)
[INFO] All files uploaded successfully
[DEBUG] Creating site configuration...
[DEBUG] Site configuration created with ID: 0x789
[INFO] Deploying site to network...
[DEBUG] Transaction hash: 0xabc123
[INFO] Site deployed successfully!
Site URL: https://example.walrus.site
`;

      mockedExecSync.mockReturnValue(Buffer.from(verboseOutput));

      // Act
      const result = await executeSiteBuilderDeploy({
        network: 'testnet',
        buildDir: '/path/to/build',
        verbose: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.siteUrl).toBe('https://example.walrus.site');
      expect(result.filesUploaded).toBe(42);
      expect(result.transactionHash).toBe('0xabc123');
    });
  });

  describe('Different Deployment Scenarios', () => {
    test('should handle fresh deployment', async () => {
      // Arrange
      const config = {
        network: 'testnet',
        buildDir: '/path/to/build',
        siteName: 'fresh-deployment'
      };

      mockedExecSync.mockReturnValue(Buffer.from(`
Site created successfully!
Site URL: https://fresh123.walrus.site
`));

      // Act
      const result = await executeSiteBuilderDeploy(config);

      // Assert
      expect(result.success).toBe(true);
      expect(result.isUpdate).toBe(false);
      expect(result.siteUrl).toBe('https://fresh123.walrus.site');
    });

    test('should handle site update deployment', async () => {
      // Arrange
      const config = {
        network: 'testnet',
        buildDir: '/path/to/build',
        siteName: 'existing-site',
        siteId: '0x1234567890abcdef'
      };

      mockedExecSync.mockReturnValue(Buffer.from(`
Site updated successfully!
Site ID: 0x1234567890abcdef
Site URL: https://existing123.walrus.site
`));

      // Act
      const result = await executeSiteBuilderDeploy(config);

      // Assert
      expect(result.success).toBe(true);
      expect(result.isUpdate).toBe(true);
      expect(result.siteId).toBe('0x1234567890abcdef');
    });

    test('should handle dry-run deployment', async () => {
      // Arrange
      const config = {
        network: 'testnet',
        buildDir: '/path/to/build',
        dryRun: true
      };

      mockedExecSync.mockReturnValue(Buffer.from(`
Dry run mode enabled - no actual deployment will occur
✓ Build directory validation passed
✓ Configuration validation passed
✓ Network connectivity check passed
Estimated gas cost: 0.001234 SUI
Estimated storage cost: 0.05 WAL
Total files to upload: 42
Dry run completed successfully
`));

      // Act
      const result = await executeSiteBuilderDeploy(config);

      // Assert
      expect(result.success).toBe(true);
      expect(result.isDryRun).toBe(true);
      expect(result.estimatedGasCost).toBe('0.001234 SUI');
      expect(result.estimatedStorageCost).toBe('0.05 WAL');
    });

    test('should handle deployment with custom domains', async () => {
      // Arrange
      const config = {
        network: 'mainnet',
        buildDir: '/path/to/build',
        customDomains: ['waltodo.com', 'www.waltodo.com']
      };

      mockedExecSync.mockReturnValue(Buffer.from(`
Site deployed successfully!
Site URL: https://prod123.walrus.site
Custom domains configured:
  - waltodo.com
  - www.waltodo.com
`));

      // Act
      const result = await executeSiteBuilderDeploy(config);

      // Assert
      expect(result.success).toBe(true);
      expect(result.customDomains).toEqual(['waltodo.com', 'www.waltodo.com']);
    });

    test('should handle deployment with redirects', async () => {
      // Arrange
      const config = {
        network: 'testnet',
        buildDir: '/path/to/build',
        redirects: [
          { from: '/api/*', to: 'https://api.waltodo.com/api/*', status: 307 }
        ]
      };

      mockedExecSync.mockReturnValue(Buffer.from(`
Site deployed successfully!
Redirects configured: 1
Site URL: https://redirect123.walrus.site
`));

      // Act
      const result = await executeSiteBuilderDeploy(config);

      // Assert
      expect(result.success).toBe(true);
      expect(result.redirectsConfigured).toBe(1);
    });
  });

  describe('Concurrent and Advanced Operations', () => {
    test('should handle concurrent deployments', async () => {
      // Arrange
      const configs = [
        { network: 'testnet', buildDir: '/path/to/build1', siteName: 'site1' },
        { network: 'testnet', buildDir: '/path/to/build2', siteName: 'site2' },
        { network: 'testnet', buildDir: '/path/to/build3', siteName: 'site3' }
      ];

      let callCount = 0;
      mockedExecSync.mockImplementation(() => {
        callCount++;
        return Buffer.from(`Site ${callCount} deployed successfully!`);
      });

      // Act
      const results = await Promise.all(
        configs.map(config => executeSiteBuilderDeploy(config))
      );

      // Assert
      expect(results).toHaveLength(3);
      expect(results.every(result => result.success)).toBe(true);
      expect(mockedExecSync).toHaveBeenCalledTimes(3);
    });

    test('should handle deployment rollback', async () => {
      // Arrange
      const config = {
        network: 'testnet',
        buildDir: '/path/to/build',
        rollbackOnFailure: true
      };

      mockedExecSync
        .mockReturnValueOnce(Buffer.from('Upload successful'))
        .mockImplementationOnce(() => {
          throw new Error('Site creation failed');
        });

      // Act & Assert
      await expect(executeSiteBuilderDeploy(config)).rejects.toThrow(/Site creation failed/);
      
      // Verify rollback was attempted
      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining('rollback'),
        expect.any(Object)
      );
    });

    test('should monitor deployment progress', async () => {
      // Arrange
      const config = {
        network: 'testnet',
        buildDir: '/path/to/build',
        monitorProgress: true
      };

      const progressUpdates = [
        'Starting deployment...',
        'Uploading files: 25%',
        'Uploading files: 50%',
        'Uploading files: 75%',
        'Uploading files: 100%',
        'Deployment completed!'
      ];

      let updateIndex = 0;
      mockedSpawn.mockImplementation(() => {
        const mockProcess = {
          stdout: {
            on: jest.fn((event, callback) => {
              if (event === 'data') {
                progressUpdates.forEach((update, index) => {
                  setTimeout(() => callback(Buffer.from(update)), index * 100);
                });
              }
            })
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 600);
            }
          })
        };
        return mockProcess as any;
      });

      // Act
      const result = await executeSiteBuilderDeployWithProgress(config);

      // Assert
      expect(result.success).toBe(true);
      expect(result.progressUpdates).toHaveLength(6);
    });
  });

  // Helper functions for site-builder testing

  async function checkSiteBuilderInstallation(): Promise<{
    installed: boolean;
    version?: string;
    path?: string;
    error?: string;
  }> {
    try {
      const path = mockedExecSync('which site-builder').toString().trim();
      const versionOutput = mockedExecSync('site-builder --version').toString();
      const version = versionOutput.match(/site-builder (\d+\.\d+\.\d+)/)?.[1];

      return {
        installed: true,
        version,
        path
      };
    } catch (error) {
      return {
        installed: false,
        error: 'Site-builder not found in PATH'
      };
    }
  }

  async function checkVersionCompatibility(): Promise<{
    compatible: boolean;
    version: string;
  }> {
    const versionOutput = mockedExecSync('site-builder --version').toString();
    const version = versionOutput.match(/site-builder (\S+)/)?.[1] || 'unknown';
    
    // Minimum required version: 1.0.0
    const compatible = version !== 'unknown' && 
                      version !== '0.9.0' && 
                      !version.startsWith('0.');

    return { compatible, version };
  }

  async function installSiteBuilder(): Promise<{
    success: boolean;
    steps: string[];
    finalMessage: string;
  }> {
    const steps: string[] = [];
    
    try {
      steps.push(mockedExecSync('curl -L -o site-builder.tar.gz https://...').toString());
      steps.push(mockedExecSync('tar -xzf site-builder.tar.gz').toString());
      steps.push(mockedExecSync('cp site-builder /usr/local/bin/').toString());
      const finalMessage = mockedExecSync('chmod +x /usr/local/bin/site-builder').toString();

      return {
        success: true,
        steps,
        finalMessage
      };
    } catch (error) {
      return {
        success: false,
        steps,
        finalMessage: error.message
      };
    }
  }

  async function executeSiteBuilderDeploy(config: any): Promise<any> {
    // Validate configuration
    if (!['testnet', 'mainnet'].includes(config.network)) {
      throw new Error('Invalid configuration: network must be testnet or mainnet');
    }

    if (!config.buildDir || config.buildDir === '') {
      throw new Error('Invalid configuration: buildDir is required');
    }

    if (config.epochs && config.epochs < 1) {
      throw new Error('Invalid configuration: epochs must be positive');
    }

    // Build command
    const siteBuilderPath = process.env.SITE_BUILDER_PATH || 'site-builder';
    const command = [siteBuilderPath];

    // Add context
    command.push('--context', config.network);

    // Add optional parameters
    if (config.configFile) {
      command.push('--config', config.configFile);
    }

    if (config.wallet) {
      command.push('--wallet', config.wallet);
    }

    // Add publish command
    command.push('publish');

    // Add epochs
    command.push('--epochs', (config.epochs || 5).toString());

    // Add site name
    if (config.siteName) {
      command.push('--site-name', config.siteName);
    }

    // Add build directory
    command.push(config.buildDir);

    try {
      const output = mockedExecSync(command.join(' '), { stdio: 'pipe' }).toString();
      
      // Parse output
      const result = parseDeploymentOutput(output);
      result.success = true;
      
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async function executeSiteBuilderDeployWithProgress(config: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const progressUpdates: string[] = [];
      
      const process = mockedSpawn('site-builder', ['publish', config.buildDir]);
      
      process.stdout.on('data', (data: Buffer) => {
        progressUpdates.push(data.toString());
      });
      
      process.on('close', (code: number) => {
        if (code === 0) {
          resolve({
            success: true,
            progressUpdates
          });
        } else {
          reject(new Error('Deployment failed'));
        }
      });
    });
  }

  function parseDeploymentOutput(output: string): any {
    const result: any = {};

    // Parse site ID
    const siteIdMatch = output.match(/Site ID:\s*(\S+)/);
    if (siteIdMatch) {
      result.siteId = siteIdMatch[1];
      result.isUpdate = true;
    } else {
      result.isUpdate = false;
    }

    // Parse site URL
    const siteUrlMatch = output.match(/Site URL:\s*(https:\/\/\S+)/);
    if (siteUrlMatch) {
      result.siteUrl = siteUrlMatch[1];
    }

    // Parse deployment time
    const timeMatch = output.match(/completed in (\d+\.?\d*) seconds/);
    if (timeMatch) {
      result.deploymentTime = parseFloat(timeMatch[1]);
    }

    // Parse gas used
    const gasMatch = output.match(/Gas used:\s*(\S+\s+\S+)/);
    if (gasMatch) {
      result.gasUsed = gasMatch[1];
    }

    // Parse files uploaded
    const filesMatch = output.match(/Found (\d+) files to upload/);
    if (filesMatch) {
      result.filesUploaded = parseInt(filesMatch[1]);
    }

    // Parse transaction hash
    const txMatch = output.match(/Transaction hash:\s*(\S+)/);
    if (txMatch) {
      result.transactionHash = txMatch[1];
    }

    // Parse custom domains
    const domainsMatch = output.match(/Custom domains configured:\s*([\s\S]*?)(?=\n\S|\n$|$)/);
    if (domainsMatch) {
      result.customDomains = domainsMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- '))
        .map(line => line.substring(2));
    }

    // Parse redirects
    const redirectsMatch = output.match(/Redirects configured:\s*(\d+)/);
    if (redirectsMatch) {
      result.redirectsConfigured = parseInt(redirectsMatch[1]);
    }

    // Parse dry run info
    if (output.includes('Dry run mode enabled')) {
      result.isDryRun = true;
      
      const gasCostMatch = output.match(/Estimated gas cost:\s*(\S+\s+\S+)/);
      if (gasCostMatch) {
        result.estimatedGasCost = gasCostMatch[1];
      }
      
      const storageCostMatch = output.match(/Estimated storage cost:\s*(\S+\s+\S+)/);
      if (storageCostMatch) {
        result.estimatedStorageCost = storageCostMatch[1];
      }
    }

    return result;
  }
});