import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { WalrusClient } from '@mysten/walrus';
import type { BlobObject } from '../types/walrus';
import { createWalrusImageStorage, type ClientWithExtensions } from '../utils/walrus-image-storage';
import { CLIError } from '../types/error';
import { KeystoreSigner } from '../utils/sui-keystore';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { MockWalrusClient } from '../utils/MockWalrusClient';

interface MockedWalrusClient {
  readBlob: jest.MockedFunction<(options: { blobId: string, signal?: AbortSignal }) => Promise<Uint8Array>>;
  writeBlob: jest.MockedFunction<(options: {
    blob: Uint8Array;
    deletable?: boolean;
    epochs: number;
    signer: any;
    signal?: AbortSignal;
    owner?: string;
    attributes?: Record<string, string>;
  }) => Promise<{ blobId: string; blobObject: BlobObject }>>;
  getBlobObject: jest.MockedFunction<(params: { blobId: string }) => Promise<BlobObject>>;
  verifyPoA: jest.MockedFunction<(params: { blobId: string }) => Promise<boolean>>;
}

interface MockedSuiClient {
  connect: jest.MockedFunction<() => Promise<void>>;
  getBalance: jest.MockedFunction<(params: { owner: string; coinType: string }) => Promise<{ coinType: string; totalBalance: bigint; coinObjectCount: number; lockedBalance: { number: bigint }; coinObjectId: string }>>;
  getLatestSuiSystemState: jest.MockedFunction<() => Promise<{ epoch: string }>>;
  getOwnedObjects: jest.MockedFunction<(params: { owner: string }) => Promise<{ data: any[]; hasNextPage: boolean; nextCursor: string | null; pageNumber: number }>>;
  signAndExecuteTransactionBlock: jest.MockedFunction<(tx: TransactionBlock) => Promise<{ digest: string; effects: { status: { status: string }; created?: { reference: { objectId: string } }[] } }>>;
  executeTransactionBlock: jest.MockedFunction<(tx: TransactionBlock) => Promise<{ digest: string; effects: { status: { status: string } } }>>;
}

jest.mock('child_process');
jest.mock('@mysten/sui.js/client');
jest.mock('@mysten/walrus');
jest.mock('../utils/sui-keystore');
jest.mock('fs');
jest.mock('path');
jest.mock('../utils/MockWalrusClient', () => {
  return {
    MockWalrusClient: jest.fn().mockImplementation(() => ({
      readBlob: jest.fn(),
      writeBlob: jest.fn(),
      getBlobObject: jest.fn(),
      verifyPoA: jest.fn(),
      getUnderlyingClient: jest.fn()
    })),
    createMockWalrusClient: jest.fn().mockImplementation(() => ({
      readBlob: jest.fn(),
      writeBlob: jest.fn(),
      getBlobObject: jest.fn(),
      verifyPoA: jest.fn(),
      getUnderlyingClient: jest.fn()
    }))
  };
});

describe('WalrusImageStorage', () => {
  // Properly initialize variables to be used throughout tests
  let mockSuiClient: MockedSuiClient;
  let mockWalrusClient: MockedWalrusClient;
  let mockKeystoreSigner: jest.MockedClass<typeof KeystoreSigner>;
  let storage: ReturnType<typeof createWalrusImageStorage>;
  
  // Define constants for image data
  const mockImagePath = '/path/to/image.jpg';
  const mockImageBuffer = Buffer.from('mock image data');
  const mockJpegHeader = Buffer.from([0xFF, 0xD8]); // JPEG magic numbers

  beforeEach(async () => {
    // Set up SuiClient mock
    mockSuiClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      getBalance: jest.fn().mockImplementation(({ owner, coinType }) => Promise.resolve({
        coinType: coinType || 'WAL',
        totalBalance: BigInt(1000),
        coinObjectCount: 1,
        lockedBalance: { number: BigInt(0) },
        coinObjectId: 'mock-coin-object-id'
      })),
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
          },
          digest: '0xdigest123',
          version: '1',
          type: '0x2::storage::Storage',
          owner: { AddressOwner: 'owner' },
          previousTransaction: '0x123456',
          storageRebate: '0',
          display: null
        }],
        hasNextPage: false,
        nextCursor: null,
        pageNumber: 1
      }),
      signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({ digest: 'test-digest', effects: { status: { status: 'success' } } }),
      executeTransactionBlock: jest.fn().mockResolvedValue({ digest: 'test-digest', effects: { status: { status: 'success' } } })
    };

    // Define mockWalrusClient before using it, to fix the undefined variable issue
    mockWalrusClient = {
      readBlob: jest.fn().mockResolvedValue(new Uint8Array(Buffer.concat([mockJpegHeader, mockImageBuffer]))),
      writeBlob: jest.fn().mockResolvedValue({
        blobId: 'test-blob-id',
        blobObject: {
          id: { id: 'test-blob-id' },
          blob_id: 'test-blob-id',
          registered_epoch: 100,
          cert_epoch: 150,
          size: '1024',
          storage_cost: {
            value: BigInt(2048).toString()
          },
          storage_rebate: {
            value: '0'
          },
          deletable: true
        }
      }),
      getBlobObject: jest.fn().mockImplementation((params) => Promise.resolve({
        id: { id: params.blobId || 'test-blob-id' },
        blob_id: params.blobId || 'test-blob-id',
        registered_epoch: 100,
        cert_epoch: 150,
        size: '1024',
        storage_cost: {
          value: BigInt(2048).toString()
        },
        storage_rebate: {
          value: '0'
        },
        deletable: true
      })),
      verifyPoA: jest.fn().mockImplementation((params) => Promise.resolve(true))
    } as MockedWalrusClient;

    // Set up WalrusClient mock
    const WalrusClientConstructor = WalrusClient as jest.MockedClass<typeof WalrusClient>;
    WalrusClientConstructor.mockImplementation(() => {
      return mockWalrusClient as unknown as WalrusClient;
    });

    // Set up fs and path mocks
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.concat([mockJpegHeader, mockImageBuffer]));
    (path.basename as jest.Mock).mockReturnValue('image.jpg');
    (execSync as jest.Mock).mockReturnValue(Buffer.from('testnet', 'utf-8'));

    // Set up KeystoreSigner mock
    mockKeystoreSigner = KeystoreSigner as jest.MockedClass<typeof KeystoreSigner>;
    
    // Mock the constructor
    mockKeystoreSigner.mockImplementation(() => ({
      connect: jest.fn().mockReturnThis(),
      getAddress: jest.fn().mockResolvedValue('0xtest-address'),
      getPublicKey: jest.fn().mockReturnValue({
        toSuiAddress: () => '0xtest-address',
        scheme: 'ED25519'
      }),
      sign: jest.fn().mockImplementation(async () => new Uint8Array([0, 1, 2, 3, 4])),
      signData: jest.fn().mockImplementation(() => new Uint8Array([0, 1, 2, 3, 4])),
      signDataAsync: jest.fn().mockImplementation(async () => new Uint8Array([0, 1, 2, 3, 4])),
      signDataWithBytes: jest.fn().mockImplementation(() => new Uint8Array([0, 1, 2, 3, 4])),
      signWithIntent: jest.fn(),
      signTransactionBlock: jest.fn(),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      getKeyScheme: jest.fn().mockReturnValue('ED25519'),
      toSuiAddress: jest.fn().mockReturnValue('0xtest-address'),
      signAndExecuteTransactionBlock: jest.fn(),
      signedTransactionBlock: jest.fn(),
      // Just use an empty object for the keypair and cast it - we're not directly testing its functionality
      keypair: {} as any,
      keyScheme: 'ED25519',
      suiClient: mockSuiClient as unknown as SuiClient
    }));
    
    // Mock the static method
    mockKeystoreSigner.fromPath = jest.fn().mockImplementation(async () => ({
      connect: jest.fn().mockReturnThis(),
      getAddress: jest.fn().mockResolvedValue('0xtest-address'),
      getPublicKey: jest.fn().mockReturnValue({
        toSuiAddress: () => '0xtest-address',
        scheme: 'ED25519'
      }),
      sign: jest.fn().mockImplementation(async () => new Uint8Array([0, 1, 2, 3, 4])),
      signData: jest.fn().mockImplementation(() => new Uint8Array([0, 1, 2, 3, 4])),
      signDataAsync: jest.fn().mockImplementation(async () => new Uint8Array([0, 1, 2, 3, 4])),
      signDataWithBytes: jest.fn().mockImplementation(() => new Uint8Array([0, 1, 2, 3, 4])),
      signWithIntent: jest.fn(),
      signTransactionBlock: jest.fn(),
      signTransaction: jest.fn(),
      signPersonalMessage: jest.fn(),
      getKeyScheme: jest.fn().mockReturnValue('ED25519'),
      toSuiAddress: jest.fn().mockReturnValue('0xtest-address'),
      signAndExecuteTransactionBlock: jest.fn(),
      signedTransactionBlock: jest.fn(),
      // Just use an empty object for the keypair and cast it - we're not directly testing its functionality
      keypair: {} as any,
      keyScheme: 'ED25519',
      suiClient: mockSuiClient as unknown as SuiClient
    }));

    // Create storage instance with mockSuiClient
    const SuiClientConstructor = SuiClient as jest.MockedClass<typeof SuiClient>;
    SuiClientConstructor.mockImplementation(() => mockSuiClient as unknown as SuiClient);
    
    // Initialize storage with the mock client
    storage = createWalrusImageStorage(
      mockSuiClient as unknown as SuiClient, 
      true  // Use mock mode for testing
    );
    await storage.connect();
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
            cert_epoch: 150,
            size: '1024',
            // Using storage_cost and storage_rebate as per BlobObject interface
            storage_cost: {
              value: BigInt(2048).toString()
            },
            storage_rebate: {
              value: '0'
            },
            deletable: true
          }
        });

      mockWalrusClient.readBlob.mockResolvedValueOnce(new Uint8Array(Buffer.concat([mockJpegHeader, mockImageBuffer])));

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
          // Using storage_cost and storage_rebate properties from BlobObject interface
          storage_cost: {
            value: BigInt(2048).toString()
          },
          storage_rebate: {
            value: '0'
          },
          deletable: true
        }
      });

      // Mock verification returning different content
      mockWalrusClient.readBlob.mockResolvedValueOnce(new Uint8Array(Buffer.from('different content')));

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
          cert_epoch: 150,
          size: '1024',
          // Using storage_cost and storage_rebate properties from BlobObject interface
          storage_cost: {
            value: BigInt(2048).toString()
          },
          storage_rebate: {
            value: '0'
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
          cert_epoch: 150,
          size: '1024',
          // Using storage_cost and storage_rebate properties from BlobObject interface
          storage_cost: {
            value: BigInt(2048).toString()
          },
          storage_rebate: {
            value: '0'
          },
          deletable: true
        }
      });

      mockWalrusClient.readBlob.mockResolvedValueOnce(new Uint8Array(imageBuffer));

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
            completed: 'true', // Changed to string as per the updated interface
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