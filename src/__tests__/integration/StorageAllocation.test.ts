import { jest } from '@jest/globals';
import { WalrusClient } from '@mysten/walrus';
import { Signer } from '@mysten/sui.js/cryptography';
import { ExpiryMonitor } from '../../utils/ExpiryMonitor';
import { StorageManager } from '../../utils/StorageManager';
import { VaultManager, BlobRecord } from '../../utils/VaultManager';
import { WalrusError, StorageError } from '../../types/errors';
import { Logger } from '../../utils/Logger';
import type { WalrusClientExt } from '../../types/client';

jest.mock('@mysten/walrus');
jest.mock('../../utils/VaultManager');
jest.mock('../../utils/Logger');

describe('Storage Allocation Integration', () => {
  let monitor: ExpiryMonitor;
  let storageManager: StorageManager;
  let mockWalrusClient: jest.MockedObject<WalrusClientExt>;
  let mockVaultManager: jest.Mocked<VaultManager>;
  let mockSigner: jest.Mocked<Signer>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockSigner = {
      signData: jest.fn(),
      toSuiAddress: jest.fn(),
      getPublicKey: jest.fn(),
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
      signPersonalMessage: jest.fn(),
      signTransactionBlock: jest.fn(),
      getKeyScheme: jest.fn(),
      connect: jest.fn(),
      signWithIntent: jest.fn()
    } as unknown as jest.Mocked<Signer>;

    mockWalrusClient = {
      getConfig: jest.fn().mockResolvedValue({ network: 'testnet', version: '1.0.0', maxSize: '1000000' }),
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
      getBlobObject: jest.fn().mockResolvedValue({ blob_id: 'test-blob' }),
      verifyPoA: jest.fn().mockResolvedValue(true),
      writeBlob: jest.fn().mockResolvedValue({ blobId: 'test-blob', blobObject: {} }),
      readBlob: jest.fn().mockResolvedValue(new Uint8Array()),
      getBlobMetadata: jest.fn().mockResolvedValue({
        blob_id: 'test-blob',
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, RS2: false, $kind: 'RedStuff' },
            unencoded_length: '1024',
            hashes: [{
              primary_hash: { Digest: new Uint8Array([1,2,3,4]), $kind: 'Digest' },
              secondary_hash: { Digest: new Uint8Array([5,6,7,8]), $kind: 'Digest' }
            }],
            $kind: 'V1'
          },
          $kind: 'V1'
        }
      }),
      storageCost: jest.fn().mockResolvedValue({
        storageCost: '1000',
        writeCost: '500',
        totalCost: '1500'
      }),
      getStorageProviders: jest.fn().mockResolvedValue(['provider1', 'provider2']),
      getSuiBalance: jest.fn().mockResolvedValue('1000'),
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
      getExpiringBlobs: jest.fn(),
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
        signer: mockSigner
      }
    );
  });

  // ... rest of the test file unchanged ...

});