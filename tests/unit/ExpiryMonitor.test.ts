import { ExpiryMonitor } from '../../src/utils/ExpiryMonitor';
import { VaultManager } from '../../src/utils/VaultManager';
// Unused imports removed during TypeScript cleanup
// import type { WalrusClientExt } from '../../src/types/client';
import { getMockWalrusClient, type CompleteWalrusClientMock } from '../../helpers/complete-walrus-client-mock';

jest.mock('../../src/utils/VaultManager');
jest.mock('@mysten/walrus');

describe('ExpiryMonitor', () => {
  let mockVaultManager: jest.Mocked<VaultManager>;
  let mockWalrusClient: CompleteWalrusClientMock;
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
        signature: new Uint8Array([1, 2, 3, 4]),
        bytes: new Uint8Array([1, 2, 3, 4]),
      }),
      signTransactionBlock: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1, 2, 3, 4]),
        bytes: new Uint8Array([1, 2, 3, 4]),
      }),
      signWithIntent: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1, 2, 3, 4]),
        bytes: new Uint8Array([1, 2, 3, 4]),
      }),
      signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({
        digest: 'mock-digest',
      }),
      signData: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
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
      toSuiAddress: jest.fn().mockReturnValue('mockAddress'),
      getKeyScheme: jest.fn().mockReturnValue('ED25519'),
      connect: jest.fn().mockResolvedValue(undefined),
    },
    network: {
      environment: 'testnet' as const,
      autoSwitch: false,
    },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockDate = new Date('2025-01-01T00:00:00Z');
    jest.setSystemTime(mockDate);

    mockVaultManager = {
      getExpiringBlobs: jest.fn().mockReturnValue([]),
      updateBlobExpiry: jest.fn(),
      getBlobRecord: jest.fn(),
    } as unknown as jest.Mocked<VaultManager>;

    mockWalrusClient = getMockWalrusClient();
    
    // Override specific methods for this test
    mockWalrusClient.getConfig.mockResolvedValue({
      network: 'testnet',
      version: '1.0.0',
      maxSize: 1000000,
    });
    mockWalrusClient.getWalBalance.mockResolvedValue('2000');
    mockWalrusClient.getStorageUsage.mockResolvedValue({ used: '500', total: '2000' });
    mockWalrusClient.getBlobSize.mockResolvedValue(1024);
    mockWalrusClient.getBlobMetadata.mockResolvedValue({
      size: 1024,
      type: 'text/plain',
      created: new Date().toISOString(),
    });
    mockWalrusClient.getBlobInfo.mockResolvedValue({
      id: 'blob1',
      size: 1024,
      type: 'text/plain',
      created: new Date().toISOString(),
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    
    // Add missing method mock if it's used in tests
    (mockWalrusClient as unknown as { getSuiBalance: jest.Mock }).getSuiBalance = jest.fn().mockResolvedValue('1000');
    (mockWalrusClient as unknown as { allocateStorage: jest.Mock }).allocateStorage = jest.fn().mockResolvedValue({
      digest: 'mock-storage-tx',
      storage: {
        id: { id: 'mock-storage-id' },
        start_epoch: 42,
        end_epoch: 52,
        storage_size: '1000000',
      },
    });

    mockWarningHandler = jest.fn().mockResolvedValue(undefined);
    mockRenewalHandler = jest.fn().mockResolvedValue(undefined);

    // Monitor will be created in individual tests as needed
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create an ExpiryMonitor instance', () => {
    const monitor = new ExpiryMonitor(
      mockVaultManager,
      mockWalrusClient,
      mockWarningHandler,
      mockRenewalHandler,
      mockConfig
    );
    
    expect(monitor).toBeInstanceOf(ExpiryMonitor);
  });
});
