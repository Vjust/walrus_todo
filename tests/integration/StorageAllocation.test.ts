import { jest } from '@jest/globals';
import { WalrusClient } from '@mysten/walrus';
import { Signer } from '@mysten/sui/cryptography';
import { ExpiryMonitor } from '@/utils/ExpiryMonitor';
import { StorageManager } from '@/utils/StorageManager';
import { VaultManager, BlobRecord } from '@/utils/VaultManager';
import { WalrusError, StorageError } from '@/types/errors';
import { Logger } from '@/utils/Logger';
import type { WalrusClientExt } from '@/types/client';

jest.mock('@mysten/walrus');
jest.mock('@/utils/VaultManager');
jest.mock('@/utils/Logger');

describe('Storage Allocation Integration', () => {
  let _monitor: ExpiryMonitor;
  let storageManager: StorageManager;
  let mockWalrusClient: jest.MockedObject<WalrusClientExt>;
  let mockVaultManager: jest.Mocked<VaultManager>;
  let _mockSigner: jest.Mocked<Signer>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockSigner = {
      signData: jest.fn().mockReturnValue(new Uint8Array([1,2,3,4])),
      toSuiAddress: jest.fn().mockReturnValue('mockAddress'),
      getPublicKey: jest.fn().mockReturnValue({
        toBytes: () => new Uint8Array([1,2,3,4]),
        toBase64: () => 'base64',
        toSuiAddress: () => 'mockAddress',
        verify: async () => true,
        verifyWithIntent: async () => true,
        equals: () => true,
        flag: () => 0,
        scheme: 'ED25519'
      }),
      signTransactionBlock: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1,2,3,4]),
        bytes: new Uint8Array([1,2,3,4])
      }),
      signPersonalMessage: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1,2,3,4]),
        bytes: new Uint8Array([1,2,3,4])
      }),
      getKeyScheme: jest.fn().mockReturnValue('ED25519'),
      connect: jest.fn().mockResolvedValue(undefined),
      signWithIntent: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1,2,3,4]),
        bytes: new Uint8Array([1,2,3,4])
      })
    } as unknown as jest.Mocked<Signer>;

    mockWalrusClient = {
      getConfig: jest.fn().mockResolvedValue({ network: 'testnet', version: '1.0.0', maxSize: 1000000 }),
      getWalBalance: jest.fn().mockResolvedValue('2000'),
      getStorageUsage: jest.fn().mockResolvedValue({
        used: '500',
        total: '2000'
      }),
      executeCreateStorageTransaction: jest.fn().mockResolvedValue({
        digest: 'test',
        storage: {
          id: { id: 'test' },
          start_epoch: '0',
          end_epoch: '52',
          storage_size: '1000'
        }
      }),
      getBlobObject: jest.fn().mockResolvedValue({ content: 'test', metadata: {} }),
      verifyPoA: jest.fn().mockResolvedValue(true),
      writeBlob: jest.fn().mockResolvedValue({ blobId: 'test-blob', blobObject: {} }),
      readBlob: jest.fn().mockResolvedValue(new Uint8Array()),
      getBlobMetadata: jest.fn().mockResolvedValue({
        size: '1024',
        type: 'text/plain',
        created: new Date().toISOString()
      }),
      storageCost: jest.fn().mockResolvedValue({
        storageCost: BigInt(1000).toString(),
        writeCost: BigInt(500).toString(),
        totalCost: BigInt(1500).toString()
      }),
      getBlobInfo: jest.fn().mockResolvedValue({
        id: 'blob1',
        size: '1024',
        type: 'text/plain',
        created: new Date().toISOString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }),
      getStorageProviders: jest.fn().mockResolvedValue(['provider1', 'provider2']),
      getSuiBalance: jest.fn().mockResolvedValue('1000'),
      getBlobSize: jest.fn().mockResolvedValue('1024'),
      reset: jest.fn(),
      allocateStorage: jest.fn().mockResolvedValue({
        digest: 'test',
        storage: {
          id: { id: 'test' },
          start_epoch: '0',
          end_epoch: '52',
          storage_size: '1000'
        }
      })
    } as unknown as jest.MockedObject<WalrusClientExt>;

    mockVaultManager = {
      getExpiringBlobs: jest.fn().mockReturnValue([]),
      getBlobRecord: jest.fn(),
      updateBlobExpiry: jest.fn()
    } as unknown as jest.Mocked<VaultManager>;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);

    storageManager = new StorageManager(mockWalrusClient, {
      minAllocation: '1000',
      checkThreshold: 20,
      signer: mockSigner
    });

    monitor = new ExpiryMonitor(
      mockVaultManager,
      mockWalrusClient,
      jest.fn().mockResolvedValue(undefined),
      jest.fn().mockResolvedValue(undefined),
      {
        checkInterval: 1000,
        warningThreshold: 7,
        autoRenewThreshold: 3,
        renewalPeriod: 30,
        signer: mockSigner,
        network: {
          environment: 'testnet' as const,
          autoSwitch: false
        }
      }
    );
  });

  // ... rest of the test file unchanged ...

});