import { jest } from '@jest/globals';
import * as fs from 'fs';
// import path from 'path';
import crypto from 'crypto';
import { SecureCredentialManager } from '../../apps/cli/src/services/ai/SecureCredentialManager';
import {
  CredentialType,
  AIPermissionLevel,
} from '../../apps/cli/src/types/adapters/AICredentialAdapter';
// import { _CLI_CONFIG } from '../../apps/cli/src/constants';

// Mock Logger module
jest.mock('../../apps/cli/src/utils/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock fs module
jest.mock('fs', () => {
  const originalModule = jest.requireActual('fs');
  const mockFileContent = new Map<string, Buffer | string>();
  const mockStats = { mtime: { getTime: () => Date.now() } };

  return {
    ...originalModule,
    existsSync: jest.fn().mockImplementation((path: string) => {
      if (path.includes('keyfile') || path.includes('.config') || path.includes('key_backups')) {
        return true;
      }
      return mockFileContent.has(path);
    }),
    writeFileSync: jest
      .fn()
      .mockImplementation((path: string, data: Buffer | string, _options?: unknown) => {
        mockFileContent.set(path, data);
      }),
    readFileSync: jest.fn().mockImplementation((path: string, encoding?: string) => {
      if (path.includes('keyfile')) {
        return crypto.randomBytes(32); // Mock encryption key
      }
      if (path.includes('keymetadata')) {
        const metadata = JSON.stringify({
          keyId: 'test-key-id',
          version: 1,
          created: Date.now(),
          lastRotated: Date.now(),
          backupLocations: []
        });
        return encoding === 'utf8' ? metadata : Buffer.from(metadata);
      }
      const content = mockFileContent.get(path) || Buffer.from('');
      if (encoding === 'utf8' && Buffer.isBuffer(content)) {
        return content.toString('utf8');
      }
      return content;
    }),
    mkdirSync: jest.fn(),
    renameSync: jest.fn(),
    copyFileSync: jest.fn(),
    chmodSync: jest.fn(),
    unlinkSync: jest.fn(),
    readdirSync: jest.fn().mockReturnValue([]),
    statSync: jest.fn().mockReturnValue(mockStats),
    constants: originalModule.constants
  };
});

describe('SecureCredentialStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset fs mocks to default implementations
    const mockFileContent = new Map<string, Buffer | string>();
    const mockStats = { mtime: { getTime: () => Date.now() } };
    
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('keyfile') || path.includes('.config') || path.includes('key_backups')) {
        return true;
      }
      return mockFileContent.has(path);
    });
    
    (fs.readFileSync as jest.Mock).mockImplementation((path: string, encoding?: string) => {
      if (path.includes('keyfile')) {
        return crypto.randomBytes(32); // Mock encryption key
      }
      if (path.includes('keymetadata')) {
        const metadata = JSON.stringify({
          keyId: 'test-key-id',
          version: 1,
          created: Date.now(),
          lastRotated: Date.now(),
          backupLocations: []
        });
        return encoding === 'utf8' ? metadata : Buffer.from(metadata);
      }
      const content = mockFileContent.get(path) || Buffer.from('');
      if (encoding === 'utf8' && Buffer.isBuffer(content)) {
        return content.toString('utf8');
      }
      return content;
    });
    
    (fs.writeFileSync as jest.Mock).mockImplementation((path: string, data: Buffer | string, _options?: unknown) => {
      mockFileContent.set(path, data);
    });
    
    (fs.statSync as jest.Mock).mockReturnValue(mockStats);
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
  });

  it('should securely store credentials with encryption', async () => {
    // Create a new instance of SecureCredentialManager
    const manager = new SecureCredentialManager();

    // Store a credential
    await manager.setCredential(
      'test-provider',
      'test-api-key',
      CredentialType.API_KEY
    );

    // Verify file operations
    expect(fs.writeFileSync).toHaveBeenCalled();

    // Get the saved content
    const savedContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1];

    // Verify encryption (content should not contain plaintext key)
    const contentString = savedContent.toString();
    expect(contentString).not.toContain('test-api-key');

    // Verify correct file permissions
    const options = (fs.writeFileSync as jest.Mock).mock.calls[0][2];
    expect(options.mode).toBe(0o600);
  });

  it('should retrieve stored credentials and decrypt them', async () => {
    // Setup a persistent mock file system to simulate storage between instances
    const mockFileContent = new Map<string, Buffer | string>();
    const fixedKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
    
    // Override the mock for this test
    (fs.writeFileSync as jest.Mock).mockImplementation((path: string, data: Buffer | string, _options?: unknown) => {
      mockFileContent.set(path, data);
    });
    
    (fs.renameSync as jest.Mock).mockImplementation((oldPath: string, newPath: string) => {
      const data = mockFileContent.get(oldPath);
      if (data) {
        mockFileContent.set(newPath, data);
        mockFileContent.delete(oldPath);
      }
    });
    
    (fs.readFileSync as jest.Mock).mockImplementation((path: string, encoding?: string) => {
      if (path.includes('.keyfile')) {
        return fixedKey; // Same key for consistency
      }
      if (path.includes('.keymetadata.json')) {
        const metadata = JSON.stringify({
          keyId: 'test-key-id',
          version: 1,
          created: Date.now(),
          lastRotated: Date.now(),
          backupLocations: []
        });
        return encoding === 'utf8' ? metadata : Buffer.from(metadata);
      }
      if (path.includes('secure_credentials.enc')) {
        const content = mockFileContent.get(path) || Buffer.from('');
        return content;
      }
      return Buffer.from('');
    });
    
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('.keyfile') || path.includes('.config') || path.includes('key_backups') || path.includes('.keymetadata.json')) {
        return true;
      }
      if (path.includes('secure_credentials.enc') && mockFileContent.has(path)) {
        return true;
      }
      return false;
    });

    // Setup a mock credential file
    const manager = new SecureCredentialManager();

    // Store a credential to setup encryption
    await manager.setCredential(
      'test-provider',
      'test-api-key',
      CredentialType.API_KEY
    );

    // Verify the encrypted file was created (check all paths in the map)
    const credentialFilePath = Array.from(mockFileContent.keys()).find(key => key.includes('secure_credentials.enc'));
    expect(credentialFilePath).toBeDefined();

    // Mimic a restart by creating a new manager instance
    const managerRestarted = new SecureCredentialManager();

    // Get credential (should be decrypted)
    const credential = await managerRestarted.getCredential('test-provider');

    // Verify correct value
    expect(credential).toBe('test-api-key');
  });

  it('should gracefully handle corrupted credential stores', async () => {
    // Mock readFileSync to return corrupted data for credential files
    const originalMock = (fs.readFileSync as jest.Mock).getMockImplementation();
    (fs.readFileSync as jest.Mock).mockImplementation((path: string, encoding?: string) => {
      if (path.includes('keyfile')) {
        return crypto.randomBytes(32); // Mock encryption key
      }
      if (path.includes('keymetadata')) {
        const metadata = JSON.stringify({
          keyId: 'test-key-id',
          version: 1,
          created: Date.now(),
          lastRotated: Date.now(),
          backupLocations: []
        });
        return encoding === 'utf8' ? metadata : Buffer.from(metadata);
      }
      if (path.includes('secure_credentials.enc')) {
        return Buffer.from('corrupted-data');
      }
      return originalMock?.(path, encoding) || Buffer.from('');
    });

    // Mock existsSync to indicate credentials file exists
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('keyfile') || path.includes('.config') || path.includes('key_backups')) {
        return true;
      }
      if (path.includes('secure_credentials.enc')) {
        return true;
      }
      return false;
    });

    // Creating manager should gracefully handle corruption
    const manager = new SecureCredentialManager();

    // Should start with empty credentials
    const credentials = await manager.listCredentials();
    expect(credentials).toEqual([]);
  });

  it('should prevent path traversal attacks', async () => {
    const manager = new SecureCredentialManager();

    // Attempt storage with path traversal in the provider name
    await manager.setCredential(
      '../../../etc/passwd',
      'malicious-value',
      CredentialType.API_KEY
    );

    // Check that fs.writeFileSync was not called with the traversal path
    const paths = (fs.writeFileSync as jest.Mock).mock.calls.map(
      call => call[0]
    );
    const hasTraversalPath = paths.some(p => p.includes('etc/passwd'));

    expect(hasTraversalPath).toBe(false);
  });

  it('should enforce credential expiration', async () => {
    const manager = new SecureCredentialManager();

    // Create a credential that expires in 1ms
    await manager.setCredential(
      'expiring-provider',
      'test-api-key',
      CredentialType.API_KEY,
      { encrypt: true, expiryDays: 0.00000001 } // Very small number of days
    );

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));

    // Attempt to get expired credential
    await expect(manager.getCredential('expiring-provider')).rejects.toThrow(
      /expired/
    );
  });

  it('should securely update credential permissions', async () => {
    const manager = new SecureCredentialManager();

    // Create a credential
    await manager.setCredential(
      'test-provider',
      'test-api-key',
      CredentialType.API_KEY,
      { encrypt: true },
      {},
      AIPermissionLevel.STANDARD
    );

    // Update permissions
    const updatedCred = await manager.updatePermissions(
      'test-provider',
      AIPermissionLevel.RESTRICTED
    );

    // Verify permissions were updated
    expect(updatedCred.permissionLevel).toBe(AIPermissionLevel.RESTRICTED);

    // Get credential object
    const credObj = await manager.getCredentialObject('test-provider');

    // Verify permissions were persisted
    expect(credObj.permissionLevel).toBe(AIPermissionLevel.RESTRICTED);
  });

  it('should securely remove credentials', async () => {
    const manager = new SecureCredentialManager();

    // Create a credential
    await manager.setCredential(
      'test-provider',
      'test-api-key',
      CredentialType.API_KEY
    );

    // Verify credential exists
    expect(await manager.hasCredential('test-provider')).toBe(true);

    // Remove credential
    const result = await manager.removeCredential('test-provider');
    expect(result).toBe(true);

    // Verify credential was removed
    expect(await manager.hasCredential('test-provider')).toBe(false);
  });

  it('should fallback to environment variables when credentials not found', async () => {
    const manager = new SecureCredentialManager();

    // Set environment variable
    process.env.TEST_PROVIDER_API_KEY = 'env-api-key';

    // Get credential (should use environment variable)
    const credential = await manager.getCredential('test_provider');

    // Verify correct value from environment
    expect(credential).toBe('env-api-key');

    // Clean up
    delete process.env.TEST_PROVIDER_API_KEY;
  });

  it('should handle blockchain verification securely', async () => {
    const manager = new SecureCredentialManager();

    // Mock blockchain adapter with correct interface
    const mockSigner = {
      toSuiAddress: jest.fn().mockReturnValue('addr-123'),
    };
    
    const mockBlockchainAdapter = {
      verifyCredential: jest.fn().mockResolvedValue({
        verificationId: 'ver-123',
      }),
      getSigner: jest.fn().mockReturnValue(mockSigner),
      checkVerificationStatus: jest.fn().mockResolvedValue(true),
      revokeVerification: jest.fn().mockResolvedValue(true),
      generateCredentialProof: jest.fn().mockResolvedValue('proof-123'),
    };

    // Set blockchain adapter
    manager.setBlockchainAdapter(mockBlockchainAdapter as any);

    // Create credential with blockchain verification
    await manager.setCredential(
      'blockchain-provider',
      'test-api-key',
      CredentialType.API_KEY
    );

    // Verify blockchain adapter was called correctly
    expect(mockBlockchainAdapter.verifyCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        providerName: 'blockchain-provider',
        publicKey: 'dummy', // Would be real in production
      })
    );

    // Get credential object to check verification status
    const credObj = await manager.getCredentialObject('blockchain-provider');

    // Verify credential is marked as verified
    expect(credObj.isVerified).toBe(true);
    expect(credObj.verificationProof).toBe('ver-123');
  });

  it('should prevent exposing sensitive data in error messages', async () => {
    const manager = new SecureCredentialManager();

    // Create a credential
    await manager.setCredential(
      'test-provider',
      'sensitive-api-key-123',
      CredentialType.API_KEY
    );

    // Force an error by setting an invalid blockchain adapter
    manager.setBlockchainAdapter({
      checkVerificationStatus: jest.fn().mockImplementation(() => {
        throw new Error(`Failed with key: sensitive-api-key-123`);
      }),
    } as unknown);

    // Get credential object for a verified credential to trigger verification
    let errorMessage = '';
    try {
      // Mock credential object as verified
      (manager as unknown as { credentials: Record<string, unknown> }).credentials['test-provider'] = {
        id: 'cred-123',
        providerName: 'test-provider',
        credentialType: CredentialType.API_KEY,
        credentialValue: 'sensitive-api-key-123',
        isVerified: true,
        verificationProof: 'proof-123',
        storageOptions: { encrypt: true },
        createdAt: Date.now(),
        permissionLevel: AIPermissionLevel.STANDARD,
      };

      await manager.getCredential('test-provider');
    } catch (error) {
      errorMessage = String(error);
    }
    
    // Error should not contain the API key
    expect(errorMessage).not.toContain('sensitive-api-key-123');
  });
});
