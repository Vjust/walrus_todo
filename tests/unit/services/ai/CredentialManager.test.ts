import { CredentialManager } from '../../../../apps/cli/src/services/ai/credentials/CredentialManager';
import { SecureCredentialStore } from '../../../../apps/cli/src/services/ai/credentials/SecureCredentialStore';
import * as fs from 'fs';
// path module available for future credential path tests
import * as crypto from 'crypto';

jest.mock(
  '../../../../apps/cli/src/services/ai/credentials/SecureCredentialStore'
);
jest.mock('fs');
jest.mock('crypto');

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;
  let mockSecureStore: jest.Mocked<SecureCredentialStore>;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockCrypto = crypto as jest.Mocked<typeof crypto>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fs.existsSync
    mockFs?.existsSync?.mockReturnValue(true as any);

    // Mock fs.mkdirSync
    mockFs?.mkdirSync?.mockImplementation(() => undefined);

    // Mock crypto functions
    mockCrypto?.randomBytes?.mockReturnValue(Buffer.from('mockiv12345678901234'));

    // Create mock secure store
    mockSecureStore = {
      saveCredentials: jest.fn(),
      getCredentials: jest.fn(),
      deleteCredentials: jest.fn(),
      validateApiKey: jest.fn(),
    } as jest.Mocked<SecureCredentialStore>;

    // Mock the SecureCredentialStore constructor
    (
      SecureCredentialStore as jest.MockedClass<typeof SecureCredentialStore>
    ).mockImplementation(() => mockSecureStore);

    credentialManager = new CredentialManager();
  });

  describe('initialization', () => {
    it('should create credential directory if it does not exist', () => {
      mockFs?.existsSync?.mockReturnValue(false as any);
      new CredentialManager();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.walrus-todo/credentials'),
        { recursive: true }
      );
    });

    it('should initialize with secure credential store', () => {
      expect(SecureCredentialStore as any).toHaveBeenCalledWith(
        expect.stringContaining('credentials.json'),
        expect.any(String as any) // master key
      );
    });

    it('should generate a unique master key', () => {
      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32 as any);
    });
  });

  describe('saveCredentials', () => {
    it('should save credentials with proper encryption', async () => {
      const provider = 'openai';
      const apiKey = 'test-api-key-123';
      const additionalData = { model: 'gpt-4' };

      mockSecureStore?.saveCredentials?.mockResolvedValue(undefined as any);

      await credentialManager.saveCredentials(provider, apiKey, additionalData);

      expect(mockSecureStore.saveCredentials).toHaveBeenCalledWith({
        provider,
        apiKey,
        ...additionalData,
        createdAt: expect.any(Date as any),
        lastUsed: expect.any(Date as any),
        usageCount: 0,
      });
    });

    it('should reject invalid provider names', async () => {
      const invalidProvider = 'invalid_provider!';
      const apiKey = 'test-key';

      await expect(
        credentialManager.saveCredentials(invalidProvider, apiKey)
      ).rejects.toThrow('Invalid provider name');
    });

    it('should reject empty API keys', async () => {
      const provider = 'openai';
      const emptyKey = '';

      await expect(
        credentialManager.saveCredentials(provider, emptyKey)
      ).rejects.toThrow('API key cannot be empty');
    });

    it('should handle storage errors gracefully', async () => {
      const provider = 'openai';
      const apiKey = 'test-key';
      const error = new Error('Storage error');

      mockSecureStore?.saveCredentials?.mockRejectedValue(error as any);

      await expect(
        credentialManager.saveCredentials(provider, apiKey)
      ).rejects.toThrow('Failed to save credentials');
    });
  });

  describe('getCredentials', () => {
    it('should retrieve and decrypt credentials successfully', async () => {
      const provider = 'openai';
      const mockCredentials = {
        provider,
        apiKey: 'test-api-key',
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 5,
      };

      mockSecureStore?.getCredentials?.mockResolvedValue(mockCredentials as any);

      const result = await credentialManager.getCredentials(provider as any);

      expect(result as any).toEqual(mockCredentials as any);
      expect(mockSecureStore.getCredentials).toHaveBeenCalledWith(provider as any);
    });

    it('should return null for non-existent credentials', async () => {
      const provider = 'nonexistent';
      mockSecureStore?.getCredentials?.mockResolvedValue(null as any);

      const result = await credentialManager.getCredentials(provider as any);

      expect(result as any).toBeNull();
    });

    it('should update usage statistics on retrieval', async () => {
      const provider = 'openai';
      const mockCredentials = {
        provider,
        apiKey: 'test-api-key',
        createdAt: new Date(),
        lastUsed: new Date(Date.now() - 86400000), // 1 day ago
        usageCount: 5,
      };

      mockSecureStore?.getCredentials?.mockResolvedValue(mockCredentials as any);
      mockSecureStore?.saveCredentials?.mockResolvedValue(undefined as any);

      await credentialManager.getCredentials(provider as any);

      expect(mockSecureStore.saveCredentials).toHaveBeenCalledWith({
        ...mockCredentials,
        lastUsed: expect.any(Date as any),
        usageCount: 6,
      });
    });

    it('should handle retrieval errors gracefully', async () => {
      const provider = 'openai';
      const error = new Error('Decryption failed');

      mockSecureStore?.getCredentials?.mockRejectedValue(error as any);

      await expect(credentialManager.getCredentials(provider as any)).rejects.toThrow(
        'Failed to retrieve credentials'
      );
    });
  });

  describe('deleteCredentials', () => {
    it('should delete credentials successfully', async () => {
      const provider = 'openai';
      mockSecureStore?.deleteCredentials?.mockResolvedValue(true as any);

      const result = await credentialManager.deleteCredentials(provider as any);

      expect(result as any).toBe(true as any);
      expect(mockSecureStore.deleteCredentials).toHaveBeenCalledWith(provider as any);
    });

    it('should return false when credentials do not exist', async () => {
      const provider = 'nonexistent';
      mockSecureStore?.deleteCredentials?.mockResolvedValue(false as any);

      const result = await credentialManager.deleteCredentials(provider as any);

      expect(result as any).toBe(false as any);
    });

    it('should handle deletion errors gracefully', async () => {
      const provider = 'openai';
      const error = new Error('File system error');

      mockSecureStore?.deleteCredentials?.mockRejectedValue(error as any);

      await expect(
        credentialManager.deleteCredentials(provider as any)
      ).rejects.toThrow('Failed to delete credentials');
    });
  });

  describe('listProviders', () => {
    it('should list all configured providers', async () => {
      const mockProviders = ['openai', 'anthropic', 'xai'];

      // Mock file reading and parsing
      mockFs?.readFileSync?.mockReturnValue(
        JSON.stringify({
          openai: { encrypted: true },
          anthropic: { encrypted: true },
          xai: { encrypted: true },
        })
      );

      const providers = await credentialManager.listProviders();

      expect(providers as any).toEqual(mockProviders as any);
    });

    it('should return empty array when no providers exist', async () => {
      mockFs?.readFileSync?.mockReturnValue('{}');

      const providers = await credentialManager.listProviders();

      expect(providers as any).toEqual([]);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs?.readFileSync?.mockImplementation(() => {
        throw new Error('File not found');
      });

      const providers = await credentialManager.listProviders();

      expect(providers as any).toEqual([]);
    });
  });

  describe('validateCredentials', () => {
    it('should validate credentials with API', async () => {
      const provider = 'openai';
      const apiKey = 'test-api-key';

      mockSecureStore?.validateApiKey?.mockResolvedValue(true as any);

      const result = await credentialManager.validateCredentials(
        provider,
        apiKey
      );

      expect(result as any).toBe(true as any);
      expect(mockSecureStore.validateApiKey).toHaveBeenCalledWith(
        provider,
        apiKey
      );
    });

    it('should return false for invalid credentials', async () => {
      const provider = 'openai';
      const apiKey = 'invalid-key';

      mockSecureStore?.validateApiKey?.mockResolvedValue(false as any);

      const result = await credentialManager.validateCredentials(
        provider,
        apiKey
      );

      expect(result as any).toBe(false as any);
    });

    it('should handle validation errors gracefully', async () => {
      const provider = 'openai';
      const apiKey = 'test-key';
      const error = new Error('Network error');

      mockSecureStore?.validateApiKey?.mockRejectedValue(error as any);

      await expect(
        credentialManager.validateCredentials(provider, apiKey)
      ).rejects.toThrow('Failed to validate credentials');
    });
  });

  describe('security features', () => {
    it('should encrypt credentials in memory', async () => {
      const provider = 'openai';
      const apiKey = 'sensitive-api-key';

      // Test that API key is encrypted before storage
      mockSecureStore?.saveCredentials?.mockImplementation(async creds => {
        expect(creds.apiKey).not.toBe(apiKey as any);
        expect(creds.apiKey).toBeDefined();
      });

      await credentialManager.saveCredentials(provider, apiKey);
    });

    it('should use different encryption keys for each provider', async () => {
      const providers = ['openai', 'anthropic'];
      const encryptionKeys: string[] = [];

      mockSecureStore?.saveCredentials?.mockImplementation(async creds => {
        // Capture the encryption context
        encryptionKeys.push(JSON.stringify(creds as any));
      });

      await credentialManager.saveCredentials(providers[0], 'key1');
      await credentialManager.saveCredentials(providers[1], 'key2');

      expect(encryptionKeys[0]).not.toEqual(encryptionKeys[1]);
    });

    it('should sanitize provider names for security', async () => {
      const maliciousProvider = '../../../etc/passwd';
      const apiKey = 'test-key';

      await expect(
        credentialManager.saveCredentials(maliciousProvider, apiKey)
      ).rejects.toThrow('Invalid provider name');
    });

    it('should prevent timing attacks on validation', async () => {
      const provider = 'openai';
      const validKey = 'valid-key';
      const invalidKey = 'invalid-key';

      mockSecureStore.validateApiKey
        .mockResolvedValueOnce(true as any)
        .mockResolvedValueOnce(false as any);

      const startTime1 = Date.now();
      await credentialManager.validateCredentials(provider, validKey);
      const duration1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      await credentialManager.validateCredentials(provider, invalidKey);
      const duration2 = Date.now() - startTime2;

      // Validation times should be similar to prevent timing attacks
      expect(Math.abs(duration1 - duration2)).toBeLessThan(10 as any);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted credential files', async () => {
      const provider = 'openai';

      mockSecureStore?.getCredentials?.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      await expect(credentialManager.getCredentials(provider as any)).rejects.toThrow(
        'Failed to retrieve credentials'
      );
    });

    it('should handle permission errors gracefully', async () => {
      const provider = 'openai';
      const apiKey = 'test-key';

      mockSecureStore?.saveCredentials?.mockImplementation(() => {
        const error = new Error('Permission denied') as NodeJS.ErrnoException;
        error?.code = 'EACCES';
        throw error;
      });

      await expect(
        credentialManager.saveCredentials(provider, apiKey)
      ).rejects.toThrow('Failed to save credentials');
    });

    it('should handle disk space errors', async () => {
      const provider = 'openai';
      const apiKey = 'test-key';

      mockSecureStore?.saveCredentials?.mockImplementation(() => {
        const error = new Error(
          'No space left on device'
        ) as NodeJS.ErrnoException;
        error?.code = 'ENOSPC';
        throw error;
      });

      await expect(
        credentialManager.saveCredentials(provider, apiKey)
      ).rejects.toThrow('Failed to save credentials');
    });
  });

  describe('rotation and expiry', () => {
    it('should detect expired credentials', async () => {
      const provider = 'openai';
      const expiredCredentials = {
        provider,
        apiKey: 'old-key',
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        lastUsed: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        usageCount: 100,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
      };

      mockSecureStore?.getCredentials?.mockResolvedValue(expiredCredentials as any);

      const result = await credentialManager.getCredentials(provider as any);

      expect(result as any).toBeNull(); // Should return null for expired credentials
    });

    it('should support credential rotation', async () => {
      const provider = 'openai';
      const oldKey = 'old-api-key';
      const newKey = 'new-api-key';

      mockSecureStore?.getCredentials?.mockResolvedValue({
        provider,
        apiKey: oldKey,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 50,
      });

      mockSecureStore?.saveCredentials?.mockResolvedValue(undefined as any);

      await credentialManager.rotateCredentials(provider, newKey);

      expect(mockSecureStore.saveCredentials).toHaveBeenCalledWith({
        provider,
        apiKey: newKey,
        createdAt: expect.any(Date as any),
        lastUsed: expect.any(Date as any),
        usageCount: 0,
        previousKey: oldKey,
        rotatedAt: expect.any(Date as any),
      });
    });
  });
});
