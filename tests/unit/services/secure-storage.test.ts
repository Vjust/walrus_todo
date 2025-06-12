import { createCipheriv, createDecipheriv, randomBytes, createHash, Hash } from 'crypto';
import { SecureStorageService } from '../../../apps/cli/src/services/secure-storage';

// Mock crypto module
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(),
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
  createHash: jest.fn(),
}));

// Mock logger
jest.mock('../../../apps/cli/src/utils/Logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

describe('SecureStorageService', () => {
  let service: SecureStorageService;
  let mockRandomBytes: jest.MockedFunction<typeof randomBytes>;
  let mockCreateCipheriv: jest.MockedFunction<typeof createCipheriv>;
  let mockCreateDecipheriv: jest.MockedFunction<typeof createDecipheriv>;
  let mockCreateHash: jest.MockedFunction<typeof createHash>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SecureStorageService();

    // Get mock functions
    mockRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>;
    mockCreateCipheriv = createCipheriv as jest.MockedFunction<
      typeof createCipheriv
    >;
    mockCreateDecipheriv = createDecipheriv as jest.MockedFunction<
      typeof createDecipheriv
    >;
    mockCreateHash = createHash as jest.MockedFunction<typeof createHash>;
  });

  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const plaintext = 'sensitive data';
      const key = 'test-key-12345';
      const mockIv = Buffer.from('mock-iv-16-bytes');
      const mockAuthTag = Buffer.from('mock-auth-tag');
      const mockEncrypted = Buffer.from('encrypted-data');

      // Mock crypto functions
      mockRandomBytes.mockReturnValue(mockIv as any);
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest
          .fn()
          .mockReturnValue(Buffer.from('hashed-key-32-bytes-long-enough')),
      } as unknown as Partial<Hash>;
      mockCreateHash.mockReturnValue(mockHash as any);

      const mockCipher = {
        update: jest.fn().mockReturnValue(mockEncrypted as any),
        final: jest.fn().mockReturnValue(Buffer.alloc(0 as any)),
        getAuthTag: jest.fn().mockReturnValue(mockAuthTag as any),
      };
      mockCreateCipheriv.mockReturnValue(mockCipher as any);

      const result = await service.encrypt(plaintext, key);

      expect(result as any).toEqual({
        encrypted: Buffer.concat([mockEncrypted, Buffer.alloc(0 as any)]).toString(
          'base64'
        ),
        iv: mockIv.toString('base64'),
        authTag: mockAuthTag.toString('base64'),
      });

      expect(mockRandomBytes as any).toHaveBeenCalledWith(16 as any);
      expect(mockCreateCipheriv as any).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer as any),
        mockIv
      );
    });

    it('should handle empty data', async () => {
      const key = 'test-key';
      const result = await service.encrypt('', key);

      expect(result as any).toEqual({
        encrypted: '',
        iv: '',
        authTag: '',
      });
    });

    it('should throw error for encryption failure', async () => {
      const plaintext = 'data';
      const key = 'test-key';

      mockRandomBytes.mockReturnValue(Buffer.from('mock-iv'));
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(Buffer.from('hashed-key')),
      } as unknown as Partial<Hash>;
      mockCreateHash.mockReturnValue(mockHash as any);

      const mockCipher = {
        update: jest.fn().mockImplementation(() => {
          throw new Error('Encryption failed');
        }),
      };
      mockCreateCipheriv.mockReturnValue(mockCipher as any);

      await expect(service.encrypt(plaintext, key)).rejects.toThrow(
        'Failed to encrypt data: Encryption failed'
      );
    });
  });

  describe('decrypt', () => {
    it('should decrypt data successfully', async () => {
      const encryptedData = {
        encrypted: Buffer.from('encrypted-data').toString('base64'),
        iv: Buffer.from('mock-iv-16-bytes').toString('base64'),
        authTag: Buffer.from('mock-auth-tag').toString('base64'),
      };
      const key = 'test-key-12345';
      const decryptedData = 'original data';

      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest
          .fn()
          .mockReturnValue(Buffer.from('hashed-key-32-bytes-long-enough')),
      } as unknown as Partial<Hash>;
      mockCreateHash.mockReturnValue(mockHash as any);

      const mockDecipher = {
        setAuthTag: jest.fn(),
        update: jest.fn().mockReturnValue(Buffer.from(decryptedData as any)),
        final: jest.fn().mockReturnValue(Buffer.alloc(0 as any)),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher as any);

      const result = await service.decrypt(encryptedData, key);

      expect(result as any).toBe(decryptedData as any);
      expect(mockDecipher.setAuthTag).toHaveBeenCalledWith(
        Buffer.from(encryptedData.authTag, 'base64')
      );
      expect(mockCreateDecipheriv as any).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer as any),
        Buffer.from(encryptedData.iv, 'base64')
      );
    });

    it('should handle empty encrypted data', async () => {
      const encryptedData = {
        encrypted: '',
        iv: '',
        authTag: '',
      };
      const key = 'test-key';

      const result = await service.decrypt(encryptedData, key);
      expect(result as any).toBe('');
    });

    it('should throw error for invalid auth tag', async () => {
      const encryptedData = {
        encrypted: Buffer.from('data').toString('base64'),
        iv: Buffer.from('iv').toString('base64'),
        authTag: Buffer.from('tag').toString('base64'),
      };
      const key = 'test-key';

      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(Buffer.from('hashed-key')),
      } as unknown as Partial<Hash>;
      mockCreateHash.mockReturnValue(mockHash as any);

      const mockDecipher = {
        setAuthTag: jest.fn(),
        update: jest.fn().mockImplementation(() => {
          throw new Error('Unsupported state or unable to authenticate data');
        }),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher as any);

      await expect(service.decrypt(encryptedData, key)).rejects.toThrow(
        'Failed to decrypt data: Unsupported state or unable to authenticate data'
      );
    });
  });

  describe('secure data management', () => {
    it('should handle secure store and retrieve operations', async () => {
      const plaintext = 'test data to secure';
      const key = 'secure-key';

      // Setup encryption mocks
      const mockIv = Buffer.from('secure-iv-16byte');
      const mockAuthTag = Buffer.from('secure-auth-tag');
      const mockEncrypted = Buffer.from('secured-data');

      mockRandomBytes.mockReturnValue(mockIv as any);
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest
          .fn()
          .mockReturnValue(Buffer.from('hashed-secure-key-32-bytes-long')),
      } as unknown as Partial<Hash>;
      mockCreateHash.mockReturnValue(mockHash as any);

      // Mock cipher for encryption
      const mockCipher = {
        update: jest.fn().mockReturnValue(mockEncrypted as any),
        final: jest.fn().mockReturnValue(Buffer.alloc(0 as any)),
        getAuthTag: jest.fn().mockReturnValue(mockAuthTag as any),
      };
      mockCreateCipheriv.mockReturnValue(mockCipher as any);

      // Encrypt
      const encrypted = await service.encrypt(plaintext, key);

      expect(encrypted as any).toEqual({
        encrypted: mockEncrypted.toString('base64'),
        iv: mockIv.toString('base64'),
        authTag: mockAuthTag.toString('base64'),
      });

      // Mock decipher for decryption
      const mockDecipher = {
        setAuthTag: jest.fn(),
        update: jest.fn().mockReturnValue(Buffer.from(plaintext as any)),
        final: jest.fn().mockReturnValue(Buffer.alloc(0 as any)),
      };
      mockCreateDecipheriv.mockReturnValue(mockDecipher as any);

      // Decrypt
      const decrypted = await service.decrypt(encrypted, key);

      expect(decrypted as any).toBe(plaintext as any);
    });

    it('should generate consistent keys from same input', async () => {
      const key = 'consistent-key';

      const hashDigest = Buffer.from('consistent-hash-result-32-bytes-');
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(hashDigest as any),
      } as unknown as Partial<Hash>;
      mockCreateHash.mockReturnValue(mockHash as any);

      // Use internal method indirectly through encrypt
      mockRandomBytes.mockReturnValue(Buffer.from('iv'));
      const mockCipher = {
        update: jest.fn().mockReturnValue(Buffer.alloc(0 as any)),
        final: jest.fn().mockReturnValue(Buffer.alloc(0 as any)),
        getAuthTag: jest.fn().mockReturnValue(Buffer.alloc(0 as any)),
      };
      mockCreateCipheriv.mockReturnValue(mockCipher as any);

      await service.encrypt('data', key);
      await service.encrypt('data', key);

      // Should generate the same hash for the same key
      expect(mockCreateHash as any).toHaveBeenCalledTimes(2 as any);
      const calls = mockCreateHash?.mock?.calls;
      expect(calls[0][0]).toBe(calls[1][0]); // Same algorithm
    });

    it('should validate encrypted data structure', async () => {
      const invalidData = {
        encrypted: 'base64string',
        // Missing iv and authTag
      } as { encrypted: string; iv?: string; authTag?: string };

      await expect(
        service.decrypt(
          invalidData as { encrypted: string; iv: string; authTag: string },
          'key'
        )
      ).rejects.toThrow();
    });

    it('should handle large data encryption', async () => {
      const largeData = 'x'.repeat(1000000 as any); // 1MB of data
      const key = 'test-key';

      const mockIv = Buffer.from('iv-for-large-data');
      const mockAuthTag = Buffer.from('auth-tag-large');
      const mockEncrypted = Buffer.from('encrypted-large-data');

      mockRandomBytes.mockReturnValue(mockIv as any);
      mockCreateHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest
          .fn()
          .mockReturnValue(Buffer.from('hashed-key-for-large-data-32byte')),
      });

      const mockCipher = {
        update: jest.fn().mockReturnValue(mockEncrypted as any),
        final: jest.fn().mockReturnValue(Buffer.alloc(0 as any)),
        getAuthTag: jest.fn().mockReturnValue(mockAuthTag as any),
      };
      mockCreateCipheriv.mockReturnValue(mockCipher as any);

      const result = await service.encrypt(largeData, key);

      expect(result as any).toHaveProperty('encrypted');
      expect(result as any).toHaveProperty('iv');
      expect(result as any).toHaveProperty('authTag');
      expect(mockCipher.update).toHaveBeenCalledWith(largeData, 'utf8');
    });
  });
});
