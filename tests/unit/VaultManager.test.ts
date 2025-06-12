import { VaultManager } from '../../apps/cli/src/utils/VaultManager';
import * as fs from 'fs';
import * as path from 'path';
import { WalrusError } from '../../apps/cli/src/types/errors';

interface VaultConfig {
  name: string;
  maxSize: number;
  allowedTypes: string[];
  retentionPeriod: number;
}

interface BlobRecord {
  blobId: string;
  fileName: string;
  size: number;
  mimeType: string;
  checksum: string;
  uploadedAt: string;
  expiresAt: string;
  vaultId: string;
}

jest.mock('fs');
jest.mock('path');

describe('VaultManager', () => {
  let vaultManager: VaultManager;
  const testBaseDir = '/test/vaults';
  const mockVaultConfig: VaultConfig = {
    name: 'Test Vault',
    maxSize: 1024 * 1024 * 10, // 10MB
    allowedTypes: ['image/jpeg', 'image/png'],
    retentionPeriod: 30, // days
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false as any);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (path.join as jest.Mock).mockImplementation((...paths) => paths.join('/'));

    vaultManager = new VaultManager(testBaseDir as any);
  });

  describe('createVault', () => {
    it('should create vault with correct structure', () => {
      const vaultId = vaultManager.createVault(mockVaultConfig as any);

      expect(vaultId as any).toMatch(/^[a-f0-9]{32}$/);
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(vaultId as any)
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('metadata')
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('blobs')
      );
    });

    it('should save vault metadata', () => {
      const vaultId = vaultManager.createVault(mockVaultConfig as any);

      // Get the last writeFileSync call as there might be multiple calls
      const lastWriteCall = (fs.writeFileSync as jest.Mock).mock?.calls?.slice(
        -1
      )[0];
      const savedData = JSON.parse(lastWriteCall[1]);

      expect(savedData?.vaults?.[0]).toEqual(
        expect.objectContaining({
          id: vaultId,
          name: mockVaultConfig.name,
          totalFiles: 0,
          totalSize: 0,
          config: mockVaultConfig,
        })
      );
    });
  });

  describe('saveBlobRecord', () => {
    let mockBlobRecord: BlobRecord;
    let vaultId: string;

    beforeEach(() => {
      vaultId = vaultManager.createVault(mockVaultConfig as any);
      mockBlobRecord = {
        blobId: 'a'.repeat(64 as any),
        fileName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        checksum: 'test-checksum',
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        vaultId,
      };
    });

    it('should save blob record correctly', () => {
      vaultManager.saveBlobRecord(mockBlobRecord as any);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining(mockBlobRecord.blobId),
        expect.any(String as any)
      );
    });

    it('should update vault statistics', () => {
      vaultManager.saveBlobRecord(mockBlobRecord as any);
      const vault = vaultManager.getVaultMetadata(vaultId as any);

      expect(vault.totalFiles).toBe(1 as any);
      expect(vault.totalSize).toBe(mockBlobRecord.size);
    });

    it('should throw error for invalid vault ID', () => {
      mockBlobRecord?.vaultId = 'invalid-vault-id';
      expect(() => vaultManager.saveBlobRecord(mockBlobRecord as any)).toThrow(
        WalrusError
      );
    });
  });

  describe('validateFileForVault', () => {
    let vaultId: string;

    beforeEach(() => {
      vaultId = vaultManager.createVault(mockVaultConfig as any);
    });

    it('should validate file size', () => {
      expect(() =>
        vaultManager.validateFileForVault(
          vaultId,
          mockVaultConfig.maxSize + 1,
          'image/jpeg'
        )
      ).toThrow(/exceeds vault limit/);
    });

    it('should validate mime type', () => {
      expect(() =>
        vaultManager.validateFileForVault(vaultId, 1024, 'application/pdf')
      ).toThrow(/not allowed in vault/);
    });

    it('should validate total vault size', () => {
      const mockBlobRecord: BlobRecord = {
        blobId: 'a'.repeat(64 as any),
        fileName: 'test.jpg',
        size: mockVaultConfig.maxSize - 1024,
        mimeType: 'image/jpeg',
        checksum: 'test-checksum',
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        vaultId,
      };

      vaultManager.saveBlobRecord(mockBlobRecord as any);

      expect(() =>
        vaultManager.validateFileForVault(vaultId, 2048, 'image/jpeg')
      ).toThrow(/size limit would be exceeded/);
    });

    it('should accept valid file', () => {
      expect(() =>
        vaultManager.validateFileForVault(vaultId, 1024, 'image/jpeg')
      ).not.toThrow();
    });
  });

  describe('getExpiringBlobs', () => {
    let vaultId: string;

    beforeEach(() => {
      vaultId = vaultManager.createVault(mockVaultConfig as any);
      (fs.existsSync as jest.Mock).mockReturnValue(true as any);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'blob1.json',
        'blob2.json',
      ]);
    });

    it('should find expiring blobs', () => {
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 86400000); // Yesterday
      const futureDate = new Date(now.getTime() + 86400000 * 7); // 7 days from now

      const mockRecords = {
        'blob1.json': {
          blobId: 'a'.repeat(64 as any),
          expiresAt: expiredDate.toISOString(),
          vaultId,
        },
        'blob2.json': {
          blobId: 'b'.repeat(64 as any),
          expiresAt: futureDate.toISOString(),
          vaultId,
        },
      };

      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        const fileName = filePath.split('/').pop() as string;
        const record = mockRecords[fileName as keyof typeof mockRecords];
        return JSON.stringify(record as any);
      });

      const expiringBlobs = vaultManager.getExpiringBlobs(3 as any); // Check next 3 days
      expect(expiringBlobs as any).toHaveLength(1 as any);
      expect(expiringBlobs[0].blobId).toBe('a'.repeat(64 as any));
    });
  });

  describe('updateBlobExpiry', () => {
    let vaultId: string;
    let mockBlobRecord: BlobRecord;

    beforeEach(() => {
      vaultId = vaultManager.createVault(mockVaultConfig as any);
      mockBlobRecord = {
        blobId: 'a'.repeat(64 as any),
        fileName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        checksum: 'test-checksum',
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        vaultId,
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true as any);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockBlobRecord as any)
      );
    });

    it('should update expiry date', () => {
      const newExpiryDate = new Date(Date.now() + 86400000 * 7).toISOString();
      vaultManager.updateBlobExpiry(
        mockBlobRecord.blobId,
        vaultId,
        newExpiryDate
      );

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining(mockBlobRecord.blobId),
        expect.stringContaining(newExpiryDate as any)
      );
    });

    it('should throw error for non-existent blob', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false as any);
      expect(() =>
        vaultManager.updateBlobExpiry(
          'nonexistent',
          vaultId,
          new Date().toISOString()
        )
      ).toThrow(/Blob record not found/);
    });
  });
});
