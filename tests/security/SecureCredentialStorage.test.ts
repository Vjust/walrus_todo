import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SecureCredentialManager } from '../../src/services/ai/SecureCredentialManager';
import { CredentialType, AIPermissionLevel } from '../../src/types/adapters/AICredentialAdapter';
import { CLI_CONFIG } from '../../src/constants';

// Mock fs module
jest.mock('fs', () => {
  const originalModule = jest.requireActual('fs');
  const mockFileContent = new Map<string, Buffer>();
  
  return {
    ...originalModule,
    existsSync: jest.fn().mockImplementation((path: string) => {
      if (path.includes('keyfile')) {
        return true;
      }
      return mockFileContent.has(path);
    }),
    writeFileSync: jest.fn().mockImplementation((path: string, data: Buffer, options: any) => {
      mockFileContent.set(path, data);
    }),
    readFileSync: jest.fn().mockImplementation((path: string) => {
      if (path.includes('keyfile')) {
        return crypto.randomBytes(32); // Mock encryption key
      }
      return mockFileContent.get(path) || Buffer.from('');
    }),
    mkdirSync: jest.fn()
  };
});

describe('SecureCredentialStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    // Setup a mock credential file
    const manager = new SecureCredentialManager();
    
    // Store a credential to setup encryption
    await manager.setCredential(
      'test-provider',
      'test-api-key',
      CredentialType.API_KEY
    );
    
    // Mimic a restart by creating a new manager instance
    const managerRestarted = new SecureCredentialManager();
    
    // Get credential (should be decrypted)
    const credential = await managerRestarted.getCredential('test-provider');
    
    // Verify correct value
    expect(credential).toBe('test-api-key');
  });
  
  it('should gracefully handle corrupted credential stores', async () => {
    // Mock readFileSync to return corrupted data
    (fs.readFileSync as jest.Mock).mockImplementationOnce((path: string) => {
      if (path.includes('keyfile')) {
        return crypto.randomBytes(32); // Mock encryption key
      }
      return Buffer.from('corrupted-data');
    });
    
    // Mock existsSync to indicate credentials file exists
    (fs.existsSync as jest.Mock).mockImplementationOnce(() => true);
    
    // Console error spy
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Creating manager should gracefully handle corruption
    const manager = new SecureCredentialManager();
    
    // Error should have been logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load credentials:',
      expect.anything()
    );
    
    // Should start with empty credentials
    const credentials = await manager.listCredentials();
    expect(credentials).toEqual([]);
    
    consoleErrorSpy.mockRestore();
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
    const paths = (fs.writeFileSync as jest.Mock).mock.calls.map(call => call[0]);
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
    await expect(manager.getCredential('expiring-provider'))
      .rejects
      .toThrow(/expired/);
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
    
    // Mock blockchain adapter
    const mockBlockchainAdapter = {
      verifyCredential: jest.fn().mockResolvedValue({
        verificationId: 'ver-123'
      }),
      signer: {
        toSuiAddress: jest.fn().mockResolvedValue('addr-123')
      }
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
        publicKey: 'dummy' // Would be real in production
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
      })
    } as any);
    
    // Get credential object for a verified credential to trigger verification
    try {
      // Mock credential object as verified
      (manager as any).credentials['test-provider'] = {
        id: 'cred-123',
        providerName: 'test-provider',
        credentialType: CredentialType.API_KEY,
        credentialValue: 'sensitive-api-key-123',
        isVerified: true,
        verificationProof: 'proof-123',
        storageOptions: { encrypt: true },
        createdAt: Date.now(),
        permissionLevel: AIPermissionLevel.STANDARD
      };
      
      await manager.getCredential('test-provider');
    } catch (error) {
      // Error should not contain the API key
      expect(String(error)).not.toContain('sensitive-api-key-123');
    }
  });
});