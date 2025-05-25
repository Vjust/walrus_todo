import { VaultManager } from '../utils/VaultManager';
import * as fs from 'fs';
import * as path from 'path';
import { WalrusError } from '../types/error';

jest.mock('fs');
jest.mock('path');

describe('VaultManager', () => {
  let vaultManager: VaultManager;
  const testBaseDir = '/test/vaults';
  const mockVaultConfig = {
    name: 'Test Vault',
    maxSize: 1024 * 1024 * 10, // 10MB
    allowedTypes: ['image/jpeg', 'image/png'],
    retentionPeriod: 30, // days
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (path.join as jest.Mock).mockImplementation((...paths) => paths.join('/'));

    vaultManager = new VaultManager(testBaseDir);
  });

  describe('createVault', () => {
    it('should create vault with correct structure', () => {
      const vaultId = vaultManager.createVault(mockVaultConfig);

      expect(vaultId).toMatch(/^[a-f0-9]{32}$/);
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(vaultId)
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('metadata')
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('blobs')
      );
    });

    it('should save vault metadata', () => {
      const vaultId = vaultManager.createVault(mockVaultConfig);

      // Get the last writeFileSync call as there might be multiple calls
      const lastWriteCall = (fs.writeFileSync as jest.Mock).mock.calls.slice(
        -1
      )[0];
      const savedData = JSON.parse(lastWriteCall[1]);

      expect(savedData.vaults[0]).toEqual(
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
    let mockBlobRecord: any;
    let vaultId: string;

    beforeEach(() => {
      vaultId = vaultManager.createVault(mockVaultConfig);
      mockBlobRecord = {
        blobId: 'a'.repeat(64),
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
      vaultManager.saveBlobRecord(mockBlobRecord);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining(mockBlobRecord.blobId),
        expect.any(String)
      );
    });

    it('should update vault statistics', () => {
      vaultManager.saveBlobRecord(mockBlobRecord);
      const vault = vaultManager.getVaultMetadata(vaultId);

      expect(vault.totalFiles).toBe(1);
      expect(vault.totalSize).toBe(mockBlobRecord.size);
    });

    it('should throw error for invalid vault ID', () => {
      mockBlobRecord.vaultId = 'invalid-vault-id';
      expect(() => vaultManager.saveBlobRecord(mockBlobRecord)).toThrow(
        WalrusError
      );
    });
  });

  describe('validateFileForVault', () => {
    let vaultId: string;

    beforeEach(() => {
      vaultId = vaultManager.createVault(mockVaultConfig);
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
      const mockBlobRecord = {
        blobId: 'a'.repeat(64),
        fileName: 'test.jpg',
        size: mockVaultConfig.maxSize - 1024,
        mimeType: 'image/jpeg',
        checksum: 'test-checksum',
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        vaultId,
      };

      vaultManager.saveBlobRecord(mockBlobRecord);

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
      vaultId = vaultManager.createVault(mockVaultConfig);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
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
          blobId: 'a'.repeat(64),
          expiresAt: expiredDate.toISOString(),
          vaultId,
        },
        'blob2.json': {
          blobId: 'b'.repeat(64),
          expiresAt: futureDate.toISOString(),
          vaultId,
        },
      };

      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        const fileName = filePath.split('/').pop() as keyof typeof mockRecords;
        return JSON.stringify(mockRecords[fileName]);
      });

      const expiringBlobs = vaultManager.getExpiringBlobs(3); // Check next 3 days
      expect(expiringBlobs).toHaveLength(1);
      expect(expiringBlobs[0].blobId).toBe('a'.repeat(64));
    });
  });

  describe('updateBlobExpiry', () => {
    let vaultId: string;
    let mockBlobRecord: any;

    beforeEach(() => {
      vaultId = vaultManager.createVault(mockVaultConfig);
      mockBlobRecord = {
        blobId: 'a'.repeat(64),
        fileName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        checksum: 'test-checksum',
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        vaultId,
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockBlobRecord)
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
        expect.stringContaining(newExpiryDate)
      );
    });

    it('should throw error for non-existent blob', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
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
