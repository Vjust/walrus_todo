import { KeyManagementService } from '../../../apps/cli/src/services/key-management';
import { SecureStorage } from '../../../apps/cli/src/services/secure-storage';
import { CLIError } from '../../../apps/cli/src/types/errors';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Mock SecureStorage
jest.mock('../../../apps/cli/src/services/secure-storage');

// Mock Ed25519Keypair
jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: {
    fromSecretKey: jest.fn(),
    generate: jest.fn(),
  },
}));

describe('KeyManagementService', () => {
  let keyManagementService: KeyManagementService;
  let mockSecureStorage: jest.Mocked<SecureStorage>;
  let mockKeypair: jest.Mocked<Ed25519Keypair>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance
    (
      KeyManagementService as unknown as { instance?: KeyManagementService }
    ).instance = undefined;

    // Initialize mocks
    mockSecureStorage = {
      getSecureItem: jest.fn(),
      setSecureItem: jest.fn(),
    } as unknown as jest.Mocked<SecureStorage>;

    mockKeypair = {
      toSuiAddress: jest.fn().mockReturnValue('0x123...'),
      getPublicKey: jest
        .fn()
        .mockReturnValue({ toBase64: () => 'mock-public-key' }),
      export: jest.fn().mockReturnValue({ privateKey: 'mock-private' }),
    } as unknown as jest.Mocked<Ed25519Keypair>;

    // Setup mock implementations
    (
      SecureStorage as jest.MockedClass<typeof SecureStorage>
    ).mockImplementation(() => mockSecureStorage);
    (Ed25519Keypair.fromSecretKey as jest.MockedFunction<typeof Ed25519Keypair.fromSecretKey>).mockReturnValue(mockKeypair);
    (Ed25519Keypair.generate as jest.MockedFunction<typeof Ed25519Keypair.generate>).mockReturnValue(mockKeypair);

    keyManagementService = KeyManagementService.getInstance();
  });

  afterEach(() => {
    // Clear the singleton instance to ensure clean state
    (
      KeyManagementService as unknown as { instance?: KeyManagementService }
    ).instance = undefined;
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = KeyManagementService.getInstance();
      const instance2 = KeyManagementService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getKeypair', () => {
    const validPrivateKeyBase64 = 'dGVzdC1wcml2YXRlLWtleQo='; // base64 encoded test key

    it('should retrieve and cache keypair from secure storage', async () => {
      mockSecureStorage.getSecureItem.mockResolvedValue(validPrivateKeyBase64);

      const keypair = await keyManagementService.getKeypair();

      expect(mockSecureStorage.getSecureItem).toHaveBeenCalledWith(
        'SUI_PRIVATE_KEY'
      );
      expect(Ed25519Keypair.fromSecretKey).toHaveBeenCalledWith(
        Buffer.from(validPrivateKeyBase64, 'base64')
      );
      expect(keypair).toBe(mockKeypair);
    });

    it('should return cached keypair on subsequent calls', async () => {
      mockSecureStorage.getSecureItem.mockResolvedValue(validPrivateKeyBase64);

      const keypair1 = await keyManagementService.getKeypair();
      const keypair2 = await keyManagementService.getKeypair();

      expect(mockSecureStorage.getSecureItem).toHaveBeenCalledTimes(1);
      expect(Ed25519Keypair.fromSecretKey).toHaveBeenCalledTimes(1);
      expect(keypair1).toBe(keypair2);
    });

    it('should throw error when no private key is found', async () => {
      mockSecureStorage.getSecureItem.mockResolvedValue(null);

      await expect(keyManagementService.getKeypair()).rejects.toThrow(
        new CLIError(
          'No private key found. Please configure your wallet first.',
          'NO_PRIVATE_KEY'
        )
      );
    });

    it('should throw error when keypair creation fails', async () => {
      mockSecureStorage.getSecureItem.mockResolvedValue(validPrivateKeyBase64);
      (Ed25519Keypair.fromSecretKey as jest.MockedFunction<typeof Ed25519Keypair.fromSecretKey>).mockImplementation(() => {
        throw new Error('Invalid key format');
      });

      await expect(keyManagementService.getKeypair()).rejects.toThrow(
        new CLIError(
          'Failed to load keypair: Invalid key format',
          'KEYPAIR_LOAD_FAILED'
        )
      );
    });
  });

  describe('storeKeypair', () => {
    const validPrivateKeyBase64 = 'dGVzdC1wcml2YXRlLWtleQo=';

    it('should store valid private key in secure storage', async () => {
      await keyManagementService.storeKeypair(validPrivateKeyBase64);

      expect(Ed25519Keypair.fromSecretKey).toHaveBeenCalledWith(
        Buffer.from(validPrivateKeyBase64, 'base64')
      );
      expect(mockSecureStorage.setSecureItem).toHaveBeenCalledWith(
        'SUI_PRIVATE_KEY',
        validPrivateKeyBase64
      );
    });

    it('should cache the keypair after successful storage', async () => {
      await keyManagementService.storeKeypair(validPrivateKeyBase64);

      // Clear mocks to verify cache is used
      jest.clearAllMocks();

      const keypair = await keyManagementService.getKeypair();
      expect(mockSecureStorage.getSecureItem).not.toHaveBeenCalled();
      expect(keypair).toBe(mockKeypair);
    });

    it('should validate private key format before storing', async () => {
      (Ed25519Keypair.fromSecretKey as jest.MockedFunction<typeof Ed25519Keypair.fromSecretKey>).mockImplementation(() => {
        throw new Error('Invalid base64');
      });

      await expect(
        keyManagementService.storeKeypair('invalid-key')
      ).rejects.toThrow(
        new CLIError(
          'Invalid private key format: Invalid base64',
          'INVALID_PRIVATE_KEY'
        )
      );

      expect(mockSecureStorage.setSecureItem).not.toHaveBeenCalled();
    });

    it('should replace existing key when storing new one', async () => {
      const newKey = 'bmV3LXByaXZhdGUta2V5Cg==';

      // Store first key
      await keyManagementService.storeKeypair(validPrivateKeyBase64);

      // Store new key
      await keyManagementService.storeKeypair(newKey);

      expect(mockSecureStorage.setSecureItem).toHaveBeenCalledTimes(2);
      expect(mockSecureStorage.setSecureItem).toHaveBeenLastCalledWith(
        'SUI_PRIVATE_KEY',
        newKey
      );
    });
  });

  describe('clearCache', () => {
    it('should clear the cached keypair', async () => {
      const validPrivateKeyBase64 = 'dGVzdC1wcml2YXRlLWtleQo=';
      mockSecureStorage.getSecureItem.mockResolvedValue(validPrivateKeyBase64);

      // Load and cache keypair
      await keyManagementService.getKeypair();
      expect(mockSecureStorage.getSecureItem).toHaveBeenCalledTimes(1);

      // Clear cache
      keyManagementService.clearCache();

      // Next call should fetch from storage again
      await keyManagementService.getKeypair();
      expect(mockSecureStorage.getSecureItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('key generation scenarios', () => {
    it('should handle generation of new keypairs', async () => {
      const newKeypair = mockKeypair;
      (Ed25519Keypair.generate as jest.MockedFunction<typeof Ed25519Keypair.generate>).mockReturnValue(newKeypair);

      // Generate new keypair
      Ed25519Keypair.generate();

      // Store the exported private key
      const exportedKey = Buffer.from('generated-private-key').toString(
        'base64'
      );
      await keyManagementService.storeKeypair(exportedKey);

      expect(mockSecureStorage.setSecureItem).toHaveBeenCalledWith(
        'SUI_PRIVATE_KEY',
        exportedKey
      );
    });
  });

  describe('error scenarios', () => {
    it('should handle storage errors gracefully', async () => {
      mockSecureStorage.getSecureItem.mockRejectedValue(
        new Error('Storage access denied')
      );

      await expect(keyManagementService.getKeypair()).rejects.toThrow(
        'Storage access denied'
      );
    });

    it('should handle corrupt key data', async () => {
      mockSecureStorage.getSecureItem.mockResolvedValue('not-valid-base64&&&');
      (Ed25519Keypair.fromSecretKey as jest.MockedFunction<typeof Ed25519Keypair.fromSecretKey>).mockImplementation(() => {
        throw new Error('Invalid base64 string');
      });

      await expect(keyManagementService.getKeypair()).rejects.toThrow(
        new CLIError(
          'Failed to load keypair: Invalid base64 string',
          'KEYPAIR_LOAD_FAILED'
        )
      );
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent getKeypair calls safely', async () => {
      const validPrivateKeyBase64 = 'dGVzdC1wcml2YXRlLWtleQo=';
      mockSecureStorage.getSecureItem.mockResolvedValue(validPrivateKeyBase64);

      // Simulate concurrent access
      const promises = [
        keyManagementService.getKeypair(),
        keyManagementService.getKeypair(),
        keyManagementService.getKeypair(),
      ];

      const results = await Promise.all(promises);

      // Should only fetch from storage once due to caching
      expect(mockSecureStorage.getSecureItem).toHaveBeenCalledTimes(1);
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
    });
  });
});
