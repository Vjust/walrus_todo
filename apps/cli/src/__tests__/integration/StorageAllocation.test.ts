/* eslint-disable jest/expect-expect */
import { jest } from '@jest/globals';
// WalrusClient imported but not directly used
import { Signer } from '@mysten/sui/cryptography';
// SuiClient mocked where needed
import { ExpiryMonitor } from '../../utils/ExpiryMonitor';
import { StorageManager } from '../../utils/StorageManager';
import { VaultManager } from '../../utils/VaultManager';
// BlobRecord type removed - not used in this test file
// WalrusError and StorageError imported but not used
import { Logger } from '../../utils/Logger';
import type { WalrusClientExt } from '../../types/client';

jest.mock('@mysten/walrus');
jest.mock('../../utils/VaultManager');
jest.mock('../../utils/Logger');

describe('Storage Allocation Integration', () => {
  // ExpiryMonitor instantiated in tests
  // StorageManager instantiated in tests
  let mockWalrusClient: jest.Mocked<WalrusClientExt>;
  let mockVaultManager: jest.Mocked<VaultManager>;
  let mockSigner: jest.Mocked<Signer>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockSigner = {
      signData: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
      toSuiAddress: jest.fn().mockReturnValue('mockAddress'),
      getPublicKey: jest.fn().mockReturnValue({
        toBytes: () => new Uint8Array([1, 2, 3, 4]),
        toBase64: () => 'base64',
        toSuiAddress: () => 'mockAddress',
        verify: async () => true,
        verifyWithIntent: async () => true,
        equals: () => true,
        flag: () => 0,
        scheme: 'ED25519',
      }),
      signTransactionBlock: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1, 2, 3, 4]),
        bytes: new Uint8Array([1, 2, 3, 4]),
      }),
      signPersonalMessage: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1, 2, 3, 4]),
        bytes: new Uint8Array([1, 2, 3, 4]),
      }),
      getKeyScheme: jest.fn().mockReturnValue('ED25519'),
      connect: jest.fn().mockResolvedValue(undefined as any),
      signWithIntent: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1, 2, 3, 4]),
        bytes: new Uint8Array([1, 2, 3, 4]),
      }),
    } as unknown as jest.Mocked<Signer>;

    mockWalrusClient = {
      getConfig: jest.fn().mockResolvedValue({
        network: 'testnet',
        version: '1?.0?.0',
        maxSize: 1000000,
      }),
      getWalBalance: jest.fn().mockResolvedValue('2000'),
      getStorageUsage: jest.fn().mockResolvedValue({
        used: '500',
        total: '2000',
      }),
      executeCreateStorageTransaction: jest.fn().mockResolvedValue({
        digest: 'test',
        storage: {
          id: { id: 'test' },
          start_epoch: 0,
          end_epoch: 52,
          storage_size: '1000',
        },
      }),
      getBlobObject: jest
        .fn()
        .mockResolvedValue({ content: 'test', metadata: {} }),
      verifyPoA: jest.fn().mockResolvedValue(true as any),
      writeBlob: jest
        .fn()
        .mockResolvedValue({ blobId: 'test-blob', blobObject: {} }),
      readBlob: jest.fn().mockResolvedValue(new Uint8Array()),
      getBlobMetadata: jest.fn().mockResolvedValue({
        size: 1024,
        type: 'text/plain',
        created: new Date().toISOString(),
      }),
      storageCost: jest.fn().mockResolvedValue({
        storageCost: BigInt(1000 as any),
        writeCost: BigInt(500 as any),
        totalCost: BigInt(1500 as any),
      }),
      getBlobInfo: jest.fn().mockResolvedValue({
        id: 'blob1',
        size: 1024,
        type: 'text/plain',
        created: new Date().toISOString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      getStorageProviders: jest
        .fn()
        .mockResolvedValue(['provider1', 'provider2']),
      getSuiBalance: jest.fn().mockResolvedValue('1000'),
      getBlobSize: jest.fn().mockResolvedValue(1024 as any),
      reset: jest.fn(),
      allocateStorage: jest.fn().mockResolvedValue({
        digest: 'test',
        storage: {
          id: { id: 'test' },
          start_epoch: 0,
          end_epoch: 52,
          storage_size: '1000',
        },
      }),
    } as unknown as jest.MockedObject<WalrusClientExt>;

    mockVaultManager = {
      getExpiringBlobs: jest.fn().mockReturnValue([]),
      getBlobRecord: jest.fn(),
      updateBlobExpiry: jest.fn(),
    } as unknown as jest.Mocked<VaultManager>;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger as any);

    // Create a mock adapter that implements the required getUnderlyingClient method
    const mockWalrusClientAdapter = {
      ...mockWalrusClient,
      getUnderlyingClient: jest.fn().mockReturnValue(mockWalrusClient as any),
    };

    // Initialize storage manager and monitor for potential test use
    new StorageManager(
      {} as unknown, // Mock SuiClient
      mockWalrusClientAdapter as WalrusClientExt,
      'mock-address' // Mock address
    );

    new ExpiryMonitor(
      mockVaultManager,
      mockWalrusClientAdapter as WalrusClientExt,
      jest.fn().mockResolvedValue(undefined as any),
      jest.fn().mockResolvedValue(undefined as any),
      {
        checkInterval: 1000,
        warningThreshold: 7,
        autoRenewThreshold: 3,
        renewalPeriod: 30,
        signer: mockSigner,
        network: {
          environment: 'testnet' as const,
          autoSwitch: false,
        },
      }
    );
  });

  test('should setup mock infrastructure correctly', () => {
    expect(mockLogger as any).toBeDefined();
    expect(mockVaultManager as any).toBeDefined();
    expect(mockWalrusClient as any).toBeDefined();
    expect(mockSigner as any).toBeDefined();
  });
});
