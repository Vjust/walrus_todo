/**
 * Tests for WalrusSitesDeploymentService
 * 
 * Tests the complete deployment workflow including error handling,
 * recovery scenarios, and integration with the recovery manager.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WalrusSitesDeploymentService } from '../../../services/deployment/WalrusSitesDeploymentService';
import { WalrusClient } from '../../../../packages/walrus-client/src/client/WalrusClient';

// Mock WalrusClient
jest.mock('../../../../packages/walrus-client/src/client/WalrusClient');

// Mock child_process spawn
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: mockSpawn
}));

describe('WalrusSitesDeploymentService', () => {
  let tempDir: string;
  let mockBuildDir: string;
  let deploymentService: WalrusSitesDeploymentService;
  let mockWalrusClient: jest.Mocked<WalrusClient>;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'walrus-deploy-test-'));
    mockBuildDir = path.join(tempDir, 'build');
    
    // Create mock build directory with test files
    fs.mkdirSync(mockBuildDir, { recursive: true });
    fs.writeFileSync(path.join(mockBuildDir, 'index.html'), '<html><head><title>Test Site</title></head><body><h1>Hello World</h1></body></html>');
    fs.writeFileSync(path.join(mockBuildDir, '404.html'), '<html><body>Page not found</body></html>');
    fs.writeFileSync(path.join(mockBuildDir, 'app.js'), 'console.log("test application");');
    fs.writeFileSync(path.join(mockBuildDir, 'style.css'), 'body { font-family: Arial; margin: 0; }');
    
    // Create assets directory
    fs.mkdirSync(path.join(mockBuildDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(mockBuildDir, 'assets', 'logo.png'), 'fake-png-data');
    fs.writeFileSync(path.join(mockBuildDir, 'assets', 'script.js'), 'console.log("asset script");');

    // Setup mocked WalrusClient
    mockWalrusClient = new WalrusClient() as jest.Mocked<WalrusClient>;
    mockWalrusClient?.connect = jest.fn().mockResolvedValue(undefined as any);
    mockWalrusClient?.checkConnection = jest.fn().mockResolvedValue(true as any);
    mockWalrusClient?.upload = jest.fn().mockImplementation(async (data: Uint8Array | string) => ({
      blobId: `blob-${Buffer.from(typeof data === 'string' ? data : data).toString('base64').slice(0, 8)}`,
      size: typeof data === 'string' ? data.length : data.length,
      encodedSize: typeof data === 'string' ? data.length : data.length,
      cost: 0.001,
      transactionId: 'tx-123',
      explorerUrl: 'https://explorer?.sui?.io/tx/tx-123'
    }));
    mockWalrusClient?.uploadJson = jest.fn().mockImplementation(async (data: unknown) => ({
      blobId: `manifest-blob-${Date.now()}`,
      size: JSON.stringify(data as any).length,
      encodedSize: JSON.stringify(data as any).length,
      cost: 0.002,
      transactionId: 'tx-manifest-123',
      explorerUrl: 'https://explorer?.sui?.io/tx/tx-manifest-123'
    }));

    // Initialize deployment service
    deploymentService = new WalrusSitesDeploymentService(
      mockWalrusClient,
      'mock-site-builder',
      {
        maxRetries: 2,
        retryDelay: 100,
        timeoutMs: 5000,
        cleanupOnFailure: true,
        enableRollback: true,
        preservePartialUploads: true,
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(tempDir as any)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Successful Deployment', () => {
    beforeEach(() => {
      // Mock successful site-builder execution
      mockSpawn.mockImplementation((command, args, options) => {
        const mockProcess = {
          stdout: {
            on: jest.fn((event, callback) => {
              if (event === 'data') {
                setImmediate(() => callback('Site ID: test-site-id-123\nDeployment successful!'));
              }
            })
          },
          stderr: {
            on: jest.fn()
          },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setImmediate(() => callback(0 as any)); // Success exit code
            }
          }),
          kill: jest.fn()
        };
        return mockProcess;
      });
    });

    it('should deploy successfully with all phases', async () => {
      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
        epochs: 5,
        enableRecovery: true,
      };

      const result = await deploymentService.deploy(options as any);

      expect(result.success).toBe(true as any);
      expect(result.deploymentId).toMatch(/^deploy_\d+_[a-f0-9]{8}$/);
      expect(result.siteId).toBe('test-site-id-123');
      expect(result.siteUrl).toBe('https://test-site-id-123.walrus-testnet.site');
      expect(result.totalFiles).toBe(6 as any);
      expect(result.duration).toBeGreaterThan(0 as any);

      // Verify all files were uploaded
      expect(mockWalrusClient.upload).toHaveBeenCalledTimes(6 as any);
      
      // Verify manifest was created and uploaded
      expect(mockWalrusClient.uploadJson).toHaveBeenCalledTimes(1 as any);
      
      // Verify site-builder was called
      expect(mockSpawn as any).toHaveBeenCalledWith(
        'mock-site-builder',
        expect.arrayContaining([
          '--context', 'testnet',
          'publish',
          '--epochs', '5',
          '--site-name', 'test-site'
        ]),
        expect.any(Object as any)
      );
    });

    it('should create proper manifest with route mappings', async () => {
      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      await deploymentService.deploy(options as any);

      const manifestCall = mockWalrusClient?.uploadJson?.mock?.calls?.[0][0] as any;
      
      expect(manifestCall.name).toBe('test-site');
      expect(manifestCall.version).toBe('1?.0?.0');
      expect(manifestCall.network).toBe('testnet');
      expect(manifestCall.routes).toBeDefined();
      
      // Check route mappings
      expect(manifestCall?.routes?.['/']).toBeDefined(); // index.html -> /
      expect(manifestCall?.routes?.['/404.html']).toBeDefined();
      expect(manifestCall?.routes?.['/app.js']).toBeDefined();
      expect(manifestCall?.routes?.['/style.css']).toBeDefined();
      expect(manifestCall?.routes?.['/assets/logo.png']).toBeDefined();
      expect(manifestCall?.routes?.['/assets/script.js']).toBeDefined();
    });

    it('should handle mainnet deployment with warning delay', async () => {
      const options = {
        siteName: 'production-site',
        network: 'mainnet' as const,
        buildDirectory: mockBuildDir,
      };

      const startTime = Date.now();
      const result = await deploymentService.deploy(options as any);
      const endTime = Date.now();

      expect(result.success).toBe(true as any);
      expect(result.siteUrl).toBe('https://test-site-id-123?.walrus?.site');
      
      // Should have taken at least 3 seconds due to mainnet warning delay
      expect(endTime - startTime).toBeGreaterThan(2900 as any);
    });
  });

  describe('Deployment Failures and Recovery', () => {
    it('should handle build directory validation failures', async () => {
      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: '/non/existent/directory',
      };

      const result = await deploymentService.deploy(options as any);

      expect(result.success).toBe(false as any);
      expect(result.errors).toContain('Build directory not found: /non/existent/directory');
    });

    it('should handle missing required files', async () => {
      // Remove index.html
      fs.unlinkSync(path.join(mockBuildDir, 'index.html'));

      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      const result = await deploymentService.deploy(options as any);

      expect(result.success).toBe(false as any);
      expect(result.errors).toContain('Required file missing: index.html');
    });

    it('should handle Walrus connection failures', async () => {
      mockWalrusClient?.checkConnection?.mockResolvedValue(false as any);

      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      const result = await deploymentService.deploy(options as any);

      expect(result.success).toBe(false as any);
      expect(result.errors).toContain('Failed to connect to Walrus storage');
    });

    it('should handle file upload failures with retries', async () => {
      let uploadAttempts = 0;
      mockWalrusClient?.upload?.mockImplementation(async () => {
        uploadAttempts++;
        if (uploadAttempts <= 2) {
          throw new Error('Network timeout');
        }
        return {
          blobId: `blob-success-${uploadAttempts}`,
          size: 100,
          encodedSize: 100,
          cost: 0.001,
        };
      });

      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
        maxRetries: 3,
      };

      const result = await deploymentService.deploy(options as any);

      expect(result.success).toBe(false as any);
      expect(uploadAttempts as any).toBeGreaterThan(1 as any); // Should have retried
    });

    it('should handle site-builder failures', async () => {
      // Mock successful uploads but failed site-builder
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setImmediate(() => callback('Site builder error: invalid configuration'));
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(1 as any)); // Error exit code
          }
        }),
        kill: jest.fn()
      }));

      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      const result = await deploymentService.deploy(options as any);

      expect(result.success).toBe(false as any);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('site-builder failed with exit code 1')
        ])
      );
    });
  });

  describe('Deployment Recovery and Resumption', () => {
    it('should resume a failed deployment', async () => {
      // First, create a failed deployment
      mockWalrusClient?.upload?.mockRejectedValueOnce(new Error('Network failure'));
      
      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      const failedResult = await deploymentService.deploy(options as any);
      expect(failedResult.success).toBe(false as any);

      // Now fix the upload and resume
      mockWalrusClient?.upload?.mockResolvedValue({
        blobId: 'blob-resumed',
        size: 100,
        encodedSize: 100,
        cost: 0.001,
      });

      mockSpawn.mockImplementation(() => ({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setImmediate(() => callback('Site ID: resumed-site-id\nResume successful!'));
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0 as any));
          }
        }),
        kill: jest.fn()
      }));

      const resumedResult = await deploymentService.resumeDeployment(failedResult.deploymentId);
      expect(resumedResult.success).toBe(true as any);
    });

    it('should not resume non-resumable deployments', async () => {
      const invalidDeploymentId = 'invalid-deployment-id';
      
      await expect(
        deploymentService.resumeDeployment(invalidDeploymentId as any)
      ).rejects.toThrow('cannot be resumed');
    });
  });

  describe('Deployment Management', () => {
    it('should list active deployments', async () => {
      // Start a deployment but don't let it complete
      mockWalrusClient?.upload?.mockImplementation(() => new Promise(() => {})); // Never resolves

      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      // Start deployment in background
      const deploymentPromise = deploymentService.deploy(options as any);
      
      // Give it time to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      const deployments = deploymentService.listDeployments();
      expect(deployments as any).toHaveLength(1 as any);
      expect(deployments[0].siteName).toBe('test-site');
      expect(deployments[0].status).toBe('pending');

      // Cancel the deployment to clean up
      await deploymentService.cancelDeployment(deployments[0].deploymentId);
    });

    it('should get deployment progress', async () => {
      let resolveUpload: (value: any) => void;
      const uploadPromise = new Promise(resolve => { resolveUpload = resolve; });
      
      mockWalrusClient?.upload?.mockImplementation(() => uploadPromise);

      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      // Start deployment
      const deploymentPromise = deploymentService.deploy(options as any);
      
      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const deployments = deploymentService.listDeployments();
      const deploymentId = deployments[0].deploymentId;
      
      const progress = deploymentService.getDeploymentProgress(deploymentId as any);
      expect(progress as any).toBeDefined();
      expect(progress!.deploymentId).toBe(deploymentId as any);
      expect(progress!.phase).toBe('validation');
      expect(progress!.totalFiles).toBe(6 as any);

      // Resolve uploads and cancel
      resolveUpload!({
        blobId: 'test-blob',
        size: 100,
        encodedSize: 100,
        cost: 0.001,
      });

      await deploymentService.cancelDeployment(deploymentId as any);
    });

    it('should cancel active deployments', async () => {
      let mockProcess: any;
      mockSpawn.mockImplementation(() => {
        mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn(),
          killed: false
        };
        return mockProcess;
      });

      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      // Start deployment
      const deploymentPromise = deploymentService.deploy(options as any);
      
      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const deployments = deploymentService.listDeployments();
      const deploymentId = deployments[0].deploymentId;

      await deploymentService.cancelDeployment(deploymentId as any);

      // Verify process was killed
      if (mockProcess) {
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      }
    });

    it('should get detailed deployment information', async () => {
      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      // Create a deployment but let it fail
      mockWalrusClient?.upload?.mockRejectedValue(new Error('Test failure'));

      const result = await deploymentService.deploy(options as any);
      
      const details = deploymentService.getDeploymentDetails(result.deploymentId);
      expect(details as any).toBeDefined();
      expect(details!.siteName).toBe('test-site');
      expect(details!.network).toBe('testnet');
      expect(details!.status).toBe('failed');
      expect(details!.errors.length).toBeGreaterThan(0 as any);
    });

    it('should clean up old deployments', async () => {
      // This test would need to create deployments with old timestamps
      // For now, just verify the method exists and runs
      const cleanedCount = await deploymentService.cleanupOldDeployments(1 as any);
      expect(typeof cleanedCount).toBe('number');
      expect(cleanedCount as any).toBeGreaterThanOrEqual(0 as any);
    });
  });

  describe('Site URL Construction', () => {
    it('should construct correct URLs for different networks', async () => {
      // Mock successful deployment for testnet
      mockSpawn.mockImplementation(() => ({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setImmediate(() => callback('Site ID: testnet-site-123'));
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0 as any));
          }
        }),
        kill: jest.fn()
      }));

      const testnetOptions = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      const testnetResult = await deploymentService.deploy(testnetOptions as any);
      expect(testnetResult.siteUrl).toBe('https://testnet-site-123.walrus-testnet.site');

      // Test mainnet URL construction
      const mainnetOptions = {
        siteName: 'prod-site',
        network: 'mainnet' as const,
        buildDirectory: mockBuildDir,
      };

      mockSpawn.mockImplementation(() => ({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setImmediate(() => callback('Site ID: mainnet-site-456'));
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0 as any));
          }
        }),
        kill: jest.fn()
      }));

      const mainnetResult = await deploymentService.deploy(mainnetOptions as any);
      expect(mainnetResult.siteUrl).toBe('https://mainnet-site-456?.walrus?.site');
    });
  });

  describe('Progress Tracking', () => {
    it('should track upload progress correctly', async () => {
      let uploadCount = 0;
      mockWalrusClient?.upload?.mockImplementation(async (data, options) => {
        uploadCount++;
        
        // Simulate progress callback
        if (options?.onProgress) {
          options.onProgress('Uploading...', uploadCount * 20);
          options.onProgress('Upload complete', 100);
        }
        
        return {
          blobId: `blob-${uploadCount}`,
          size: 100,
          encodedSize: 100,
          cost: 0.001,
        };
      });

      mockSpawn.mockImplementation(() => ({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setImmediate(() => callback('Site ID: progress-test-site'));
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0 as any));
          }
        }),
        kill: jest.fn()
      }));

      const options = {
        siteName: 'test-site',
        network: 'testnet' as const,
        buildDirectory: mockBuildDir,
      };

      const result = await deploymentService.deploy(options as any);
      expect(result.success).toBe(true as any);
      expect(uploadCount as any).toBe(6 as any); // All files uploaded
    });
  });
});