import { createWalrusImageStorage } from '../utils/walrus-image-storage';
import { KeystoreSigner } from '../utils/sui-keystore';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  createWalrusModuleMock,
  getMockWalrusClient,
} from './helpers/complete-walrus-client-mock';

// Mock the external dependencies
jest.mock('@mysten/walrus', () => createWalrusModuleMock());

jest.mock('@mysten/sui/client', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    getBalance: jest.fn(),
    getLatestSuiSystemState: jest.fn(),
    getOwnedObjects: jest.fn(),
    signAndExecuteTransactionBlock: jest.fn(),
    executeTransactionBlock: jest.fn(),
  })),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  basename: jest.fn(),
}));

jest.mock('../utils/sui-keystore', () => ({
  KeystoreSigner: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('WalrusImageStorage', () => {
  let mockSuiClient: {
    connect: jest.Mock;
    getBalance: jest.Mock;
    getLatestSuiSystemState: jest.Mock;
    getOwnedObjects: jest.Mock;
    signAndExecuteTransactionBlock: jest.Mock;
    executeTransactionBlock: jest.Mock;
  };
  let mockWalrusClient: ReturnType<typeof getMockWalrusClient>;
  let mockKeystoreSigner: {
    fromPath: jest.Mock;
  };
  let storage: ReturnType<typeof createWalrusImageStorage>;

  const mockImagePath = '/path/to/image.jpg';
  const mockImageBuffer = Buffer.from('mock image data');
  const mockJpegHeader = Buffer.from([0xff, 0xd8]); // JPEG magic numbers

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    mockWalrusClient = getMockWalrusClient();

    mockSuiClient = {
      connect: jest.fn(),
      getBalance: jest.fn(),
      getLatestSuiSystemState: jest.fn(),
      getOwnedObjects: jest.fn(),
      signAndExecuteTransactionBlock: jest.fn(),
      executeTransactionBlock: jest.fn(),
    };

    mockKeystoreSigner = {
      fromPath: jest.fn().mockResolvedValue({
        connect: jest.fn().mockReturnThis(),
        getAddress: jest.fn().mockResolvedValue('0xtest-address'),
        getPublicKey: jest.fn().mockReturnValue({
          toSuiAddress: () => '0xtest-address',
          scheme: 'ED25519',
        }),
        sign: jest
          .fn()
          .mockImplementation(async () => new Uint8Array([0, 1, 2, 3, 4])),
        signData: jest
          .fn()
          .mockImplementation(() => new Uint8Array([0, 1, 2, 3, 4])),
        signDataAsync: jest
          .fn()
          .mockImplementation(async () => new Uint8Array([0, 1, 2, 3, 4])),
        signDataWithBytes: jest.fn().mockImplementation(() => ({
          signature: new Uint8Array([0, 1, 2, 3, 4]),
          bytes: new Uint8Array([0, 1, 2, 3, 4]),
        })),
        signWithIntent: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'mock-bytes',
        }),
        signTransactionBlock: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'mock-bytes',
        }),
        signTransaction: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'mock-bytes',
        }),
        signPersonalMessage: jest.fn().mockResolvedValue({
          signature: 'mock-signature',
          bytes: 'mock-bytes',
        }),
        getKeyScheme: jest.fn().mockReturnValue('ED25519'),
        toSuiAddress: jest.fn().mockReturnValue('0xtest-address'),
        keyScheme: 'ED25519',
      }),
    };

    // Mock constructor implementations
    // WalrusClient mock already set up in module mock
    // SuiClient mock already set up in module mock
    (KeystoreSigner as unknown as jest.Mock).mockImplementation(
      () => mockKeystoreSigner
    );
    (execSync as jest.Mock).mockImplementation((cmd: string): string => {
      if (cmd.includes('active-env')) return 'testnet';
      if (cmd.includes('active-address')) return '0xtest-address';
      throw new Error(`Unexpected command: ${cmd}`);
    });

    // Setup default mock responses
    mockSuiClient.getBalance.mockResolvedValue({
      coinType: 'WAL',
      totalBalance: '1000',
      coinObjectCount: 1,
      lockedBalance: { number: '0' },
      coinObjectId: 'mock-coin-object-id',
    });

    mockSuiClient.getLatestSuiSystemState.mockResolvedValue({ epoch: '1' });
    mockSuiClient.getOwnedObjects.mockResolvedValue({
      data: [
        {
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
                deletable: true,
              },
            },
          },
        },
      ],
      hasNextPage: false,
      nextCursor: null,
    });

    mockSuiClient.signAndExecuteTransactionBlock.mockResolvedValue({
      digest: 'test-digest',
      effects: { status: { status: 'success' } },
    });

    mockWalrusClient.writeBlob.mockResolvedValue({
      blobId: 'test-blob-id',
      blobObject: {
        id: { id: 'test-blob-id' },
        blob_id: 'test-blob-id',
        registered_epoch: 100,
        cert_epoch: 150,
        size: '1024',
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        storage: {
          id: { id: 'storage1' },
          start_epoch: 100,
          end_epoch: 200,
          storage_size: '2048',
          used_size: '1024',
        },
        deletable: true,
      },
    });

    mockWalrusClient.getBlobObject.mockResolvedValue({
      id: { id: 'test-blob-id' },
      blob_id: 'test-blob-id',
      registered_epoch: 100,
      cert_epoch: 150,
      size: '1024',
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      storage: {
        id: { id: 'storage1' },
        start_epoch: 100,
        end_epoch: 200,
        storage_size: '2048',
        used_size: '1024',
      },
      deletable: true,
    });

    mockWalrusClient.verifyPoA.mockResolvedValue(true);

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      Buffer.concat([mockJpegHeader, mockImageBuffer])
    );
    (path.basename as jest.Mock).mockReturnValue('image.jpg');

    storage = createWalrusImageStorage(mockSuiClient, true);
    await storage.connect();
  });

  describe('uploadImage', () => {
    it('should validate input path', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await expect(storage.uploadImage('')).rejects.toThrow(
        /Image path is required/
      );
      await expect(storage.uploadImage('nonexistent.jpg')).rejects.toThrow(
        /Image not found/
      );
    });

    it('should validate image format', async () => {
      // Invalid magic numbers
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('invalid'));
      await expect(storage.uploadImage(mockImagePath)).rejects.toThrow(
        /Unsupported image format/
      );

      // Too small
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from([0xff]));
      await expect(storage.uploadImage(mockImagePath)).rejects.toThrow(
        /File too small/
      );
    });

    it('should validate image size', async () => {
      // Create large buffer > 10MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      largeBuffer.write('\xFF\xD8'); // JPEG header
      (fs.readFileSync as jest.Mock).mockReturnValue(largeBuffer);

      await expect(storage.uploadImage(mockImagePath)).rejects.toThrow(
        /exceeds maximum allowed size/
      );
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
            cert_epoch: 150,
            size: '1024',
            encoding_type: 1,
            storage: {
              id: { id: 'storage1' },
              start_epoch: 100,
              end_epoch: 200,
              storage_size: '2048',
              used_size: '100',
            },
            deletable: true,
          },
        });

      mockWalrusClient.readBlob.mockResolvedValueOnce(
        Buffer.concat([mockJpegHeader, mockImageBuffer])
      );

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
          cert_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048',
            used_size: '100',
          },
          deletable: true,
        },
      });

      // Mock verification returning different content
      mockWalrusClient.readBlob.mockResolvedValueOnce(
        Buffer.from('different content')
      );

      await expect(storage.uploadImage(mockImagePath)).rejects.toThrow(
        /Content integrity check failed/
      );
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
          cert_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048',
            used_size: '100',
          },
          deletable: true,
        },
      });

      mockWalrusClient.readBlob.mockResolvedValueOnce(imageBuffer);

      const result = await storage.uploadTodoImage(
        mockImagePath,
        'Test Todo',
        true
      );
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
            uploadedAt: expect.any(String),
          }),
        })
      );
    });
  });
});
