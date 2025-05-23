import { ExpiryMonitor } from '../../src/utils/ExpiryMonitor';
import { VaultManager, BlobRecord } from '../../src/utils/VaultManager';
import { WalrusClientExt } from '../../src/types/client';

jest.mock('../../src/utils/VaultManager');
jest.mock('@mysten/walrus');

describe('ExpiryMonitor', () => {
  let monitor: ExpiryMonitor;
  let mockVaultManager: jest.Mocked<VaultManager>;
  let mockWalrusClient: jest.MockedObject<WalrusClientExt>;
  let mockWarningHandler: jest.Mock;
  let mockRenewalHandler: jest.Mock;
  let mockDate: Date;

  const mockConfig = {
    checkInterval: 1000,
    warningThreshold: 7,
    autoRenewThreshold: 3,
    renewalPeriod: 30,
    signer: {
      signPersonalMessage: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1,2,3,4]),
        bytes: new Uint8Array([1,2,3,4])
      }),
      signTransactionBlock: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1,2,3,4]),
        bytes: new Uint8Array([1,2,3,4])
      }),
      signWithIntent: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1,2,3,4]),
        bytes: new Uint8Array([1,2,3,4])
      }),
      signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({
        digest: 'mock-digest'
      }),
      signData: jest.fn().mockReturnValue(new Uint8Array([1,2,3,4])),
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
      toSuiAddress: jest.fn().mockReturnValue('mockAddress'),
      getKeyScheme: jest.fn().mockReturnValue('ED25519'),
      connect: jest.fn().mockResolvedValue(undefined)
    },
    network: {
      environment: 'testnet' as const,
      autoSwitch: false
    }
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockDate = new Date('2025-01-01T00:00:00Z');
    jest.setSystemTime(mockDate);

    mockVaultManager = {
      getExpiringBlobs: jest.fn().mockReturnValue([]),
      updateBlobExpiry: jest.fn(),
      getBlobRecord: jest.fn()
    } as unknown as jest.Mocked<VaultManager>;

    mockWalrusClient = {
      getConfig: jest.fn().mockResolvedValue({ network: 'testnet', version: '1.0.0', maxSize: 1000000 }),
      getWalBalance: jest.fn().mockResolvedValue('2000'),
      getStorageUsage: jest.fn().mockResolvedValue({ used: '500', total: '2000' }),
      getBlobObject: jest.fn().mockResolvedValue({ content: 'test', metadata: {} }),
      verifyPoA: jest.fn().mockResolvedValue(true),
      writeBlob: jest.fn().mockResolvedValue({ blobId: 'blob1', blobObject: {} }),
      readBlob: jest.fn().mockResolvedValue(new Uint8Array()),
      getBlobMetadata: jest.fn().mockResolvedValue({ 
        size: 1024,
        type: 'text/plain',
        created: new Date().toISOString()
      }),
      storageCost: jest.fn().mockResolvedValue({ storageCost: BigInt(1000), writeCost: BigInt(500), totalCost: BigInt(1500) }),
      executeCreateStorageTransaction: jest.fn().mockResolvedValue({
        digest: 'tx1',
        storage: {
          id: { id: 'storage1' },
          start_epoch: 40,
          end_epoch: 52,
          storage_size: '1000000'
        }
      }),
      getBlobInfo: jest.fn().mockResolvedValue({
        id: 'blob1',
        size: 1024,
        type: 'text/plain',
        created: new Date().toISOString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }),
      getStorageProviders: jest.fn().mockResolvedValue(['provider1', 'provider2']),
      getSuiBalance: jest.fn().mockResolvedValue('1000'),
      getBlobSize: jest.fn().mockResolvedValue(1024),
      reset: jest.fn(),
      allocateStorage: jest.fn().mockResolvedValue({
        digest: 'mock-storage-tx',
        storage: {
          id: { id: 'mock-storage-id' },
          start_epoch: 42,
          end_epoch: 52,
          storage_size: '1000000'
        }
      })
    } as unknown as jest.MockedObject<WalrusClientExt>;

    mockWarningHandler = jest.fn().mockResolvedValue(undefined);
    mockRenewalHandler = jest.fn().mockResolvedValue(undefined);

    monitor = new ExpiryMonitor(
      mockVaultManager,
      mockWalrusClient,
      mockWarningHandler,
      mockRenewalHandler,
      mockConfig
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ... rest of the test file unchanged ...

});