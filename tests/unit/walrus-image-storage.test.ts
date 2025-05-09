import { SuiClient } from '@mysten/sui.js';
import { TransactionBlock } from '@mysten/sui.js';
import { WalrusClient, type BlobType, type BlobObject, type Storage } from '@mysten/walrus';
import { createWalrusImageStorage } from '../../src/utils/walrus-image-storage';
import { CLIError } from '../../src/types/error';
import { KeystoreSigner } from '../../src/utils/sui-keystore';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface MockedWalrusClient extends Partial<WalrusClient> {
  readBlob: jest.MockedFunction<(params: { blobId: string, signal?: AbortSignal }) => Promise<Uint8Array>>;
  writeBlob: jest.MockedFunction<(params: { 
    blob: Uint8Array;
    deletable: boolean; 
    epochs: number;
    signer: any;
    attributes: Record<string, string | boolean | number>;
  }) => Promise<{ blobId: string; blobObject: BlobObject }>>;
  getBlobObject: jest.MockedFunction<(params: { blobId: string }) => Promise<BlobObject>>;
  verifyPoA: jest.MockedFunction<(params: { blobId: string }) => Promise<boolean>>;
}

interface MockedSuiClient extends Partial<SuiClient> {
  connect: jest.MockedFunction<() => Promise<void>>;
  getBalance: jest.MockedFunction<(address: string) => Promise<{ coinType: string; totalBalance: bigint; coinObjectCount: number; lockedBalance: { number: bigint }; coinObjectId: string }>>;
  getLatestSuiSystemState: jest.MockedFunction<() => Promise<{ epoch: string }>>;
  getOwnedObjects: jest.MockedFunction<(params: { owner: string }) => Promise<{ data: any[]; hasNextPage: boolean; nextCursor: string | null }>>;
  signAndExecuteTransactionBlock: jest.MockedFunction<(tx: TransactionBlock) => Promise<{ digest: string; effects: { status: { status: string }; created?: { reference: { objectId: string } }[] } }>>;
  executeTransactionBlock: jest.MockedFunction<(tx: TransactionBlock) => Promise<{ digest: string; effects: { status: { status: string } } }>>;
}

jest.mock('child_process');
jest.mock('@mysten/sui/client');
jest.mock('@mysten/walrus');
jest.mock('../../src/utils/sui-keystore');
jest.mock('fs');
jest.mock('path');

describe('WalrusImageStorage', () => {
  let mockSuiClient: MockedSuiClient;
  let mockWalrusClient: MockedWalrusClient;
  let mockKeystoreSigner: jest.MockedClass<typeof KeystoreSigner>;
  let storage: ReturnType<typeof createWalrusImageStorage>;
  
  const mockImagePath = '/path/to/image.jpg';
  const mockImageBuffer = Buffer.from('mock image data');
  const mockJpegHeader = Buffer.from([0xFF, 0xD8]); // JPEG magic numbers

  beforeEach(async () => {
    mockSuiClient = {
      getBalance: jest.fn().mockResolvedValue({
        coinType: 'WAL',
        totalBalance: BigInt(1000),
        coinObjectCount: 1,
        lockedBalance: { number: BigInt(0) },
        coinObjectId: 'mock-coin-object-id'
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
          size: BigInt(1024),
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: BigInt(2048),
            used_size: BigInt(1024)
          },
          deletable: true
        }
      }),
      getBlobObject: jest.fn().mockResolvedValue({
        id: { id: 'test-blob-id' },
        blob_id: 'test-blob-id',
        registered_epoch: 100,
        certified_epoch: 150,
        size: BigInt(1024),
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        storage: {
          id: { id: 'storage1' },
          start_epoch: 100,
          end_epoch: 200,
          storage_size: BigInt(2048),
          used_size: BigInt(1024)
        },
        deletable: true
      }),
      verifyPoA: jest.fn().mockResolvedValue(true)
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
        }),
        sign: jest.fn().mockImplementation(async () => new Uint8Array([0, 1, 2, 3, 4])),
        signData: jest.fn().mockImplementation(() => new Uint8Array([0, 1, 2, 3, 4])),
        signDataAsync: jest.fn().mockImplementation(async () => new Uint8Array([0, 1, 2, 3, 4])),
        signDataWithBytes: jest.fn().mockImplementation(() => ({
          signature: new Uint8Array([0, 1, 2, 3, 4]),
          bytes: new Uint8Array([0, 1, 2, 3, 4])
        })),
        signWithIntent: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'mock-bytes'
        }),
        signTransactionBlock: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'mock-bytes'
        }),
        signTransaction: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'mock-bytes'
        }),
        signPersonalMessage: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'mock-bytes'
        }),
        getKeyScheme: jest.fn().mockReturnValue('ED25519'),
        toSuiAddress: jest.fn().mockReturnValue('0xtest-address'),
        keyScheme: 'ED25519'
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
          blob: expect.any(Uint8Array),
          deletable: false,
          epochs: 52,
          signer: expect.anything(),
          attributes: expect.objectContaining({
            title: 'Test Todo',
            completed: true,
            contentType: 'image/jpeg',
            filename: 'image.jpg',
            type: 'todo-nft-image',
            checksum_algo: 'sha256',
            encoding: 'binary',
            width: expect.any(String),
            height: expect.any(String),
            size: expect.any(String),
            checksum: expect.any(String),
            uploadedAt: expect.any(String)
          })
        })
      );
    });
  });
});