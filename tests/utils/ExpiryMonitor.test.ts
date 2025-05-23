import { WalrusClient } from '@mysten/walrus';
import { ExpiryMonitor } from '../../src/utils/ExpiryMonitor';
import { VaultManager, BlobRecord } from '../../src/utils/VaultManager';
import { StorageError } from '../../src/types/errors/consolidated';
import { Signer } from '@mysten/sui/cryptography';
import * as childProcess from 'child_process';
import { Logger } from '../../src/utils/Logger';

jest.mock('child_process');
jest.mock('@mysten/walrus');
jest.mock('../../src/utils/VaultManager');
jest.mock('../../src/utils/Logger');

describe('ExpiryMonitor', () => {
  let monitor: ExpiryMonitor;
  let mockVaultManager: jest.Mocked<VaultManager>;
  let mockWalrusClient: jest.Mocked<WalrusClient>;
  let mockWarningHandler: jest.Mock<Promise<void>, [BlobRecord[]]>;
  let mockRenewalHandler: jest.Mock<Promise<void>, [BlobRecord[]]>;
  let mockSigner: jest.Mocked<Signer>;
  // let mockExecSync: jest.SpyInstance; // Currently unused
  let mockLogger: jest.Mocked<Logger>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    // mockExecSync = jest.spyOn(childProcess, 'execSync') // Currently unused
    //   .mockReturnValue(Buffer.from('testnet\n'));
  });

  const testConfig = {
    checkInterval: 1000,
    warningThreshold: 7,
    autoRenewThreshold: 3,
    renewalPeriod: 30,
    storage: {
      minAllocation: BigInt(1000),
      checkThreshold: 20
    },
    signer: mockSigner
  };

  beforeEach(() => {
    mockVaultManager = {
      createVault: jest.fn(),
      saveBlobRecord: jest.fn(),
      getVaultMetadata: jest.fn(),
      validateFileForVault: jest.fn(),
      getExpiringBlobs: jest.fn(),
      getBlobRecord: jest.fn(),
      updateBlobExpiry: jest.fn(),
      baseDir: '/mock/base/dir',
      vaults: new Map(),
      recordsFile: '/mock/base/dir/vault-records.json',
      initializeVaultSystem: jest.fn(),
      saveVaultRecords: jest.fn()
    } as unknown as jest.Mocked<VaultManager>;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);

    mockWalrusClient = {
      getConfig: jest.fn().mockResolvedValue({ network: 'testnet', version: '1.0.0', maxSize: 1000000 }),
      getWalBalance: jest.fn().mockResolvedValue('2000'),
      getStorageUsage: jest.fn().mockResolvedValue({ used: '500', total: '2000' }),
      getBlobObject: jest.fn().mockResolvedValue({
        id: { id: 'mock-blob-id' },
        blob_id: 'mock-blob-id',
        registered_epoch: 1,
        size: '1024',
        encoding_type: 1,
        cert_epoch: 1,
        storage: {
          id: { id: 'mock-storage-id' },
          storage_size: '1000',
          used_size: '100',
          end_epoch: 100,
          start_epoch: 1
        },
        deletable: false
      }),
      verifyPoA: jest.fn().mockResolvedValue(true),
      executeCreateStorageTransaction: jest.fn().mockResolvedValue({
        digest: 'tx1',
        storage: {
          id: { id: 'storage1' },
          start_epoch: 40,
          end_epoch: 52,
          storage_size: '1000000'
        }
      })
    } as unknown as jest.Mocked<WalrusClient>;

    mockSigner = {
      signData: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      toSuiAddress: jest.fn().mockReturnValue('mock-address'),
      getPublicKey: jest.fn().mockReturnValue({
        toBase64: () => 'mock-base64',
        toSuiAddress: () => 'mock-address',
        equals: () => true,
        verify: () => Promise.resolve(true),
        verifyWithIntent: () => Promise.resolve(true),
        flag: () => 0x00,
        scheme: () => 'ED25519',
        bytes: () => new Uint8Array([1, 2, 3])
      }),
      getKeyScheme: jest.fn().mockReturnValue('ED25519'),
      connect: jest.fn().mockReturnValue({
        client: {},
        signData: jest.fn(),
        toSuiAddress: jest.fn(),
        getPublicKey: jest.fn()
      }),
      sign: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      signMessage: jest.fn().mockResolvedValue({ signature: 'mock-sig', bytes: 'mock-bytes' }),
      signTransaction: jest.fn().mockResolvedValue({ signature: 'mock-sig', bytes: 'mock-bytes' }),
      signAndExecuteTransaction: jest.fn().mockResolvedValue({
        digest: 'mock-digest',
        effects: { 
          status: { status: 'success' },
          created: [{ reference: { objectId: 'mock-object-id' } }]
        }
      }),
      signWithIntent: jest.fn().mockResolvedValue({ signature: 'mock-sig', bytes: 'mock-bytes' })
    } as unknown as jest.Mocked<Signer>;

    mockWarningHandler = jest.fn().mockResolvedValue(undefined);
    mockRenewalHandler = jest.fn().mockResolvedValue(undefined);

    monitor = new ExpiryMonitor(
      mockVaultManager,
      mockWalrusClient,
      mockWarningHandler,
      mockRenewalHandler,
      {
        ...testConfig,
        signer: mockSigner
      }
    );
  });

  // ... existing test groups ...

  describe('Storage Allocation', () => {
    const testBlob: BlobRecord = {
      blobId: 'test-blob-2',
      vaultId: 'vault-2',
      fileName: 'test2.jpg',
      size: 1000,
      mimeType: 'image/jpeg',
      checksum: 'sha256:def456',
      uploadedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
    };

    it('should check storage before renewal', async () => {
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '500',  // Using 25%
        total: '2000'
      });
      mockVaultManager.getBlobRecord.mockReturnValue(testBlob);

      await monitor.renewBlobById(testBlob.blobId, testBlob.vaultId);

      expect(mockWalrusClient.executeCreateStorageTransaction).toHaveBeenCalled();
      expect(mockWalrusClient.getStorageUsage).toHaveBeenCalled();
    });

    it('should fail renewal on insufficient storage', async () => {
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '1900',  // Using 95%
        total: '2000'
      });
      mockVaultManager.getBlobRecord.mockReturnValue(testBlob);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);
      mockWalrusClient.getBlobObject.mockResolvedValue({
        id: { id: testBlob.blobId },
        blob_id: testBlob.blobId,
        registered_epoch: 1,
        cert_epoch: 1,
        size: '1024',
        encoding_type: 1,
        storage: {
          id: { id: 'mock-storage-id' },
          storage_size: '1000',
          used_size: '100',
          end_epoch: 100,
          start_epoch: 1
        },
        deletable: false
      });

      await expect(monitor.renewBlobById(testBlob.blobId, testBlob.vaultId))
        .rejects
        .toThrow('Storage capacity exceeded');

      expect(mockWalrusClient.executeCreateStorageTransaction)
        .not.toHaveBeenCalled();
    });

    it('should warn on low storage during batch renewal', async () => {
      // Setup storage at 85% usage
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '1700',
        total: '2000'
      });

      // Mock a blob that needs renewal
      const expiringBlob = {
        blobId: 'test-blob',
        vaultId: 'test-vault',
        fileName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        checksum: 'sha256:abc123',
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days until expiry
      };
      mockVaultManager.getExpiringBlobs.mockReturnValue([expiringBlob]);

      // Start monitoring
      monitor.start();
      await jest.advanceTimersByTimeAsync(1000);

      // Storage warning should be logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Insufficient storage for renewal',
        expect.any(Error),
        expect.objectContaining({ usedPercentage: 85 })
      );

      expect(mockRenewalHandler).not.toHaveBeenCalled();

      // Renewal should still be attempted
      expect(mockWalrusClient.executeCreateStorageTransaction).toHaveBeenCalled();
    });

    it('should skip renewal for insufficient storage', async () => {
      const blob1 = { ...testBlob, blobId: 'blob1' };
      const blob2 = { ...testBlob, blobId: 'blob2' };
      
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '1900',  // 95% used
        total: '2000'
      });
      mockVaultManager.getExpiringBlobs.mockReturnValue([blob1, blob2]);

      monitor.start();
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockRenewalHandler).not.toHaveBeenCalled();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Insufficient storage for renewal',
        expect.any(Error),
        expect.objectContaining({ usedPercentage: 95 })
      );

      expect(mockWalrusClient.executeCreateStorageTransaction).not.toHaveBeenCalled();
    });

    it('should handle storage check errors gracefully', async () => {
      // Mock storage check to fail
      mockWalrusClient.getStorageUsage.mockRejectedValue(new Error('Storage check failed'));
      
      // Mock blob data
      const blob = {
        blobId: 'test-blob',
        vaultId: 'test-vault',
        fileName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        checksum: 'sha256:abc123',
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      };
      mockVaultManager.getBlobRecord.mockReturnValue(blob);

      // Mock blob object verification
      mockWalrusClient.verifyPoA.mockResolvedValue(true);
      mockWalrusClient.getBlobObject.mockResolvedValue({
        id: { id: blob.blobId },
        blob_id: blob.blobId,
        size: '1024',
        registered_epoch: 1,
        cert_epoch: 1,
        encoding_type: 1,
        storage: {
          id: { id: 'mock-storage-id' },
          storage_size: '1000',
          used_size: '100',
          end_epoch: 100,
          start_epoch: 1
        },
        deletable: false
      });

      // Attempt renewal
      await expect(monitor.renewBlobById(blob.blobId, blob.vaultId))
        .rejects
        .toThrow(StorageError);

      // Error should be logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to renew blob test-blob',
        expect.any(Error),
        expect.objectContaining({ blob })
      );

      // No storage transaction should be attempted
      expect(mockWalrusClient.executeCreateStorageTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Expiry Check', () => {
    it('should detect blobs near expiry', async () => {
      const expiringBlobs = [
        {
          blobId: 'blob1',
          vaultId: 'vault1',
          fileName: 'test1.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          checksum: 'sha256:abc123',
          uploadedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days until expiry
        }
      ];
      mockVaultManager.getExpiringBlobs.mockReturnValue(expiringBlobs);

      monitor.start();
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockWarningHandler).toHaveBeenCalledWith(expiringBlobs);
    });

    it('should renew blobs near expiry', async () => {
      const expiringBlobs = [
        {
          blobId: 'blob1',
          vaultId: 'vault1',
          fileName: 'test1.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          checksum: 'sha256:abc123',
          uploadedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day until expiry
        }
      ];
      mockVaultManager.getExpiringBlobs.mockReturnValue(expiringBlobs);

      monitor.start();
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockRenewalHandler).toHaveBeenCalledWith(expiringBlobs);
    });

    it('should handle errors during expiry check', async () => {
      mockVaultManager.getExpiringBlobs.mockImplementation(() => {
        throw new Error('Failed to check expiring blobs');
      });

      monitor.start();
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to check blob expiry',
        expect.any(Error),
        expect.objectContaining({ config: testConfig })
      );
    });
  });
});