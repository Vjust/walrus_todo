import { SuiClient } from '@mysten/sui/dist/client';
import type { JsonRpcProvider } from '@mysten/sui/dist/client';
import { WalrusClient, type BlobType, type BlobObject, type Storage } from '@mysten/walrus';
import { createWalrusImageStorage } from '../utils/walrus-image-storage';
import { CLIError } from '../types/error';
import { KeystoreSigner } from '../utils/sui-keystore';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface MockedWalrusClient extends Partial<WalrusClient> {
  readBlob: jest.Mock;
  writeBlob: jest.Mock;
  executeCreateStorageTransaction: jest.Mock;
  getBlobType?: jest.Mock;
}

interface MockedSuiClient extends Partial<SuiClient> {
  provider: JsonRpcProvider;
  getBalance: jest.Mock;
  getLatestSuiSystemState: jest.Mock;
  getOwnedObjects: jest.Mock;
  signAndExecuteTransactionBlock: jest.Mock;
  executeTransactionBlock: jest.Mock;
}

jest.mock('child_process');
jest.mock('@mysten/sui/client');
jest.mock('@mysten/walrus');
jest.mock('../utils/sui-keystore');
jest.mock('fs');
jest.mock('path');

describe('WalrusImageStorage', () => {
  let mockSuiClient: MockedSuiClient;
  let mockWalrusClient: MockedWalrusClient;
  let mockKeystoreSigner: jest.Mocked<typeof KeystoreSigner>;
  let storage: ReturnType<typeof createWalrusImageStorage>;
  
  const mockImagePath = '/path/to/image.jpg';
  const mockImageBuffer = Buffer.from('mock image data');
  const mockJpegHeader = Buffer.from([0xFF, 0xD8]); // JPEG magic numbers

  beforeEach(async () => {
    mockSuiClient = {
      getBalance: jest.fn().mockResolvedValue({
        coinType: 'WAL',
        totalBalance: '1000',
        coinObjectCount: 1,
        lockedBalance: { number: '0' }
      }),
      getLatestSuiSystemState: jest.fn().mockResolvedValue({ epoch: '1' }),
      getOwnedObjects: jest.fn().mockResolvedValue({
        data: [{
          data: {
            objectId: 'existing-storage',
            digest: '0xdigest',
            version: '1',
            type: '0x2::storage::Storage',
            owner: { AddressOwner: 'owner' },
            content: {
              dataType: 'moveObject',
              type: '0x2::storage::Storage',
              hasPublicTransfer: true,
              fields: {
                storage_size: '2000000',
                used_size: '100000',
                end_epoch: '100',
                id: { id: 'storage1' },
                start_epoch: '50',
                deletable: true
              }
            }
          }
        }],
        hasNextPage: false,
        nextCursor: null
      }),
      signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({ digest: 'test-digest', effects: { status: { status: 'success' } } }),
      executeTransactionBlock: jest.fn().mockResolvedValue({ digest: 'test-digest', effects: { status: { status: 'success' } } })
    } as MockedSuiClient;

    mockWalrusClient = {
      readBlob: jest.fn(),
      writeBlob: jest.fn().mockResolvedValue({
        blobId: 'test-blob-id',
        blobObject: {
          id: { id: 'test-blob-id' },
          blob_id: 'test-blob-id',
          registered_epoch: 100,
          certified_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048'
          },
          deletable: true
        }
      }),
      getBlobType: jest.fn().mockReturnValue('image'),
      executeCreateStorageTransaction: jest.fn()
    } as MockedWalrusClient;

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.concat([mockJpegHeader, mockImageBuffer]));
    (path.basename as jest.Mock).mockReturnValue('image.jpg');

    mockKeystoreSigner = {
      fromPath: jest.fn().mockResolvedValue({
        connect: jest.fn().mockReturnThis(),
        getAddress: jest.fn().mockResolvedValue('0xtest-address'),
        getPublicKey: jest.fn().mockReturnValue({
          toSuiAddress: () => '0xtest-address',
          scheme: 'ED25519'
        })
      })
    } as unknown as jest.Mocked<typeof KeystoreSigner>;

    (KeystoreSigner as unknown as jest.Mock).mockImplementation(() => mockKeystoreSigner);
    storage = createWalrusImageStorage();
    await storage.init();
  });

  describe('uploadImage', () => {
    it('should validate input path', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await expect(storage.uploadImage('')).rejects.toThrow(/Image path is required/);
      await expect(storage.uploadImage('nonexistent.jpg')).rejects.toThrow(/Image not found/);
    });

    it('should validate image format', async () => {
      // Invalid magic numbers
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('invalid'));
      await expect(storage.uploadImage(mockImagePath))
        .rejects.toThrow(/Unsupported image format/);

      // Too small
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from([0xFF]));
      await expect(storage.uploadImage(mockImagePath))
        .rejects.toThrow(/File too small/);
    });

    it('should validate image size', async () => {
      // Create large buffer > 10MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      largeBuffer.write('\xFF\xD8'); // JPEG header
      (fs.readFileSync as jest.Mock).mockReturnValue(largeBuffer);

      await expect(storage.uploadImage(mockImagePath))
        .rejects.toThrow(/exceeds maximum allowed size/);
    });

    it('should handle upload failures with retries', async () => {
      mockWalrusClient.writeBlob
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          blobId: 'test-blob-id',
          blobObject: {
            id: { id: 'test-blob-id' },
            blob_id: 'test-blob-id',
            registered_epoch: 100,
            certified_epoch: 150,
            size: '1024',
            encoding_type: 1,
            storage: {
              id: { id: 'storage1' },
              start_epoch: 100,
              end_epoch: 200,
              storage_size: '2048'
            },
            deletable: true
          }
        });

      mockWalrusClient.readBlob.mockResolvedValueOnce(Buffer.concat([mockJpegHeader, mockImageBuffer]));

      const result = await storage.uploadImage(mockImagePath);
      expect(result).toBe('https://testnet.wal.app/blob/test-blob-id');
      expect(mockWalrusClient.writeBlob).toHaveBeenCalledTimes(3);
    });

    it('should verify uploaded content', async () => {
      // Mock successful upload but verification failure
      mockWalrusClient.writeBlob.mockResolvedValueOnce({
        blobId: 'test-blob-id',
        blobObject: {
          id: { id: 'test-blob-id' },
          blob_id: 'test-blob-id',
          registered_epoch: 100,
          certified_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048'
          },
          deletable: true
        }
      });

      // Mock verification returning different content
      mockWalrusClient.readBlob.mockResolvedValueOnce(Buffer.from('different content'));

      await expect(storage.uploadImage(mockImagePath))
        .rejects.toThrow(/Content integrity check failed/);
    });

    it('should handle verification timeout', async () => {
      mockWalrusClient.writeBlob.mockResolvedValueOnce({
        blobId: 'test-blob-id',
        blobObject: {
          id: { id: 'test-blob-id' },
          blob_id: 'test-blob-id',
          registered_epoch: 100,
          certified_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048'
          },
          deletable: true
        }
      });

      // Mock verification timing out
      mockWalrusClient.readBlob.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 11000)));

      await expect(storage.uploadImage(mockImagePath))
        .rejects.toThrow(/verification timed out/);
    });

    it('should upload successfully with metadata', async () => {
      const imageBuffer = Buffer.concat([mockJpegHeader, mockImageBuffer]);
      (fs.readFileSync as jest.Mock).mockReturnValue(imageBuffer);

      mockWalrusClient.writeBlob.mockResolvedValueOnce({
        blobId: 'test-blob-id',
        blobObject: {
          id: { id: 'test-blob-id' },
          blob_id: 'test-blob-id',
          registered_epoch: 100,
          certified_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048'
          },
          deletable: true
        }
      });

      mockWalrusClient.readBlob.mockResolvedValueOnce(imageBuffer);

      const result = await storage.uploadTodoImage(mockImagePath, 'Test Todo', true);
      expect(result).toBe('https://testnet.wal.app/blob/test-blob-id');

      // Verify metadata was included
      expect(mockWalrusClient.writeBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            title: 'Test Todo',
            completed: 'true',
            checksum_algo: 'sha256',
            encoding: 'binary'
          })
        })
      );
    });
  });
});