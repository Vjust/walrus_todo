import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SecureCredentialManager, AIPermissionLevel } from '../../src/services/ai/SecureCredentialManager';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { CLIError } from '../../src/types/error';

// Mock the crypto module
jest.mock('crypto', () => {
  return {
    randomBytes: jest.fn().mockReturnValue(Buffer.from('1234567890abcdef')),
    createCipheriv: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue(Buffer.from('encrypted')),
      final: jest.fn().mockReturnValue(Buffer.from('data'))
    }),
    createDecipheriv: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue(Buffer.from('decrypted')),
      final: jest.fn().mockReturnValue(Buffer.from('data'))
    }),
    createHash: jest.fn().mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('hashed')
    }))
  };
});

// Mock fs for file operations
jest.mock('fs', () => {
  const mockFileData = {};
  return {
    existsSync: jest.fn().mockImplementation((path) => {
      return mockFileData[path] !== undefined;
    }),
    readFileSync: jest.fn().mockImplementation((path) => {
      if (mockFileData[path]) {
        return mockFileData[path];
      }
      throw new Error('File not found');
    }),
    writeFileSync: jest.fn().mockImplementation((path, data) => {
      mockFileData[path] = data;
    }),
    unlinkSync: jest.fn().mockImplementation((path) => {
      delete mockFileData[path];
    }),
    mkdirSync: jest.fn().mockImplementation(() => {})
  };
});

describe('Secure Credential Manager', () => {
  // Environment setup
  const originalEnv = process.env;
  const keysDir = '/mock/keys';
  
  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // SECTION: Basic credential management
  describe('Credential Management', () => {
    it('should initialize with a master key', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      expect(credentialManager).toBeDefined();
    });

    it('should store and retrieve credentials', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      
      // Store a credential
      credentialManager.storeCredential(
        AIProvider.XAI,
        'api-key-123',
        AIPermissionLevel.FULL
      );
      
      // Retrieve the credential
      const credential = credentialManager.getCredential(AIProvider.XAI);
      expect(credential).toBe('api-key-123');
    });

    it('should retrieve credential object with permission level', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      
      // Store a credential
      credentialManager.storeCredential(
        AIProvider.XAI,
        'api-key-123',
        AIPermissionLevel.FULL
      );
      
      // Retrieve the credential object
      const credentialObj = credentialManager.getCredentialObject(AIProvider.XAI);
      expect(credentialObj).toEqual({
        provider: AIProvider.XAI,
        key: 'api-key-123',
        permissionLevel: AIPermissionLevel.FULL
      });
    });

    it('should throw an error when retrieving non-existent credential', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      
      expect(() => {
        credentialManager.getCredential(AIProvider.OPENAI);
      }).toThrow('No credentials found for provider');
    });

    it('should update an existing credential', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      
      // Store a credential
      credentialManager.storeCredential(
        AIProvider.XAI,
        'api-key-original',
        AIPermissionLevel.FULL
      );
      
      // Update the credential
      credentialManager.storeCredential(
        AIProvider.XAI,
        'api-key-updated',
        AIPermissionLevel.READ_ONLY
      );
      
      // Retrieve the updated credential
      const credential = credentialManager.getCredential(AIProvider.XAI);
      expect(credential).toBe('api-key-updated');
      
      // Check the updated permission level
      const credentialObj = credentialManager.getCredentialObject(AIProvider.XAI);
      expect(credentialObj.permissionLevel).toBe(AIPermissionLevel.READ_ONLY);
    });

    it('should delete a stored credential', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      
      // Store a credential
      credentialManager.storeCredential(
        AIProvider.XAI,
        'api-key-123',
        AIPermissionLevel.FULL
      );
      
      // Delete the credential
      credentialManager.deleteCredential(AIProvider.XAI);
      
      // Verify the credential is deleted
      expect(() => {
        credentialManager.getCredential(AIProvider.XAI);
      }).toThrow('No credentials found for provider');
    });
  });

  // SECTION: Multiple provider support
  describe('Multiple Provider Support', () => {
    it('should store credentials for multiple providers', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      
      // Store credentials for multiple providers
      credentialManager.storeCredential(
        AIProvider.XAI,
        'xai-api-key',
        AIPermissionLevel.FULL
      );
      
      credentialManager.storeCredential(
        AIProvider.OPENAI,
        'openai-api-key',
        AIPermissionLevel.READ_ONLY
      );
      
      credentialManager.storeCredential(
        AIProvider.ANTHROPIC,
        'anthropic-api-key',
        AIPermissionLevel.RESTRICTED
      );
      
      // Retrieve and verify each credential
      expect(credentialManager.getCredential(AIProvider.XAI)).toBe('xai-api-key');
      expect(credentialManager.getCredential(AIProvider.OPENAI)).toBe('openai-api-key');
      expect(credentialManager.getCredential(AIProvider.ANTHROPIC)).toBe('anthropic-api-key');
      
      // Verify permission levels
      expect(credentialManager.getCredentialObject(AIProvider.XAI).permissionLevel)
        .toBe(AIPermissionLevel.FULL);
      expect(credentialManager.getCredentialObject(AIProvider.OPENAI).permissionLevel)
        .toBe(AIPermissionLevel.READ_ONLY);
      expect(credentialManager.getCredentialObject(AIProvider.ANTHROPIC).permissionLevel)
        .toBe(AIPermissionLevel.RESTRICTED);
    });

    it('should list all stored providers', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      
      // Store credentials for multiple providers
      credentialManager.storeCredential(
        AIProvider.XAI,
        'xai-api-key',
        AIPermissionLevel.FULL
      );
      
      credentialManager.storeCredential(
        AIProvider.OPENAI,
        'openai-api-key',
        AIPermissionLevel.READ_ONLY
      );
      
      // List all providers
      const providers = credentialManager.listProviders();
      
      expect(providers).toEqual([AIProvider.XAI, AIProvider.OPENAI]);
    });
  });

  // SECTION: Environment variable integration
  describe('Environment Variable Integration', () => {
    it('should use API key from environment variable if available', () => {
      // Set environment variable
      process.env.XAI_API_KEY = 'env-xai-api-key';
      
      const credentialManager = new SecureCredentialManager(keysDir);
      
      // Get credential with fallback to environment variable
      const credential = credentialManager.getCredentialWithEnvFallback(AIProvider.XAI);
      
      expect(credential).toBe('env-xai-api-key');
    });

    it('should fall back to stored credential when environment variable is not set', () => {
      // Make sure environment variable is not set
      delete process.env.XAI_API_KEY;
      
      const credentialManager = new SecureCredentialManager(keysDir);
      
      // Store a credential
      credentialManager.storeCredential(
        AIProvider.XAI,
        'stored-xai-api-key',
        AIPermissionLevel.FULL
      );
      
      // Get credential with fallback to environment variable
      const credential = credentialManager.getCredentialWithEnvFallback(AIProvider.XAI);
      
      expect(credential).toBe('stored-xai-api-key');
    });

    it('should throw an error when no credential is available', () => {
      // Make sure environment variable is not set
      delete process.env.XAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const credentialManager = new SecureCredentialManager(keysDir);
      
      // Attempt to get credential without any source
      expect(() => {
        credentialManager.getCredentialWithEnvFallback(AIProvider.XAI);
      }).toThrow('No credentials found for provider');
    });
  });

  // SECTION: Error handling and validation
  describe('Error Handling and Validation', () => {
    it('should throw a specific error type when credential is not found', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      
      try {
        credentialManager.getCredential(AIProvider.ANTHROPIC);
        fail('Expected error was not thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CLIError);
        expect((error as CLIError).code).toBe('CREDENTIAL_NOT_FOUND');
      }
    });

    it('should validate permission levels when storing credentials', () => {
      const credentialManager = new SecureCredentialManager(keysDir);
      
      expect(() => {
        credentialManager.storeCredential(
          AIProvider.XAI,
          'api-key',
          'invalid-level' as AIPermissionLevel
        );
      }).toThrow('Invalid permission level');
    });
  });
});