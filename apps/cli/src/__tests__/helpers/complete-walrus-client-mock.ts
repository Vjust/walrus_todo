import type { WalrusClientExt } from '../../types/client';
import type { BlobInfo, BlobObject, BlobMetadataShape } from '../../types/walrus';

/**
 * Complete mock implementation of WalrusClientExt for testing
 */
export interface CompleteWalrusClientMock extends WalrusClientExt {
  getConfig: jest.Mock<Promise<{ network: string; version: string; maxSize: number }>, []>;
  getWalBalance: jest.Mock<Promise<string>, []>;
  getStorageUsage: jest.Mock<Promise<{ used: string; total: string }>, []>;
  readBlob: jest.Mock<Promise<Uint8Array>, [any]>;
  writeBlob: jest.Mock<Promise<{ blobId: string; blobObject: BlobObject }>, [any]>;
  getBlobInfo: jest.Mock<Promise<BlobInfo>, [string]>;
  getBlobObject: jest.Mock<Promise<BlobObject>, [any]>;
  getBlobMetadata: jest.Mock<Promise<BlobMetadataShape>, [any]>;
  verifyPoA: jest.Mock<Promise<boolean>, [any]>;
  getBlobSize: jest.Mock<Promise<number>, [string]>;
  storageCost: jest.Mock<Promise<{ storageCost: bigint; writeCost: bigint; totalCost: bigint }>, [number, number]>;
  executeCreateStorageTransaction: jest.Mock<Promise<{ digest: string; storage: any }>, [any]>;
  executeCertifyBlobTransaction: jest.Mock<Promise<{ digest: string }>, [any]>;
  executeWriteBlobAttributesTransaction: jest.Mock<Promise<{ digest: string }>, [any]>;
  deleteBlob: jest.Mock<any, [any]>;
  executeRegisterBlobTransaction: jest.Mock<Promise<{ blob: BlobObject; digest: string }>, [any]>;
  getStorageConfirmationFromNode: jest.Mock<Promise<any>, [any]>;
  createStorageBlock: jest.Mock<Promise<any>, [number, number]>;
  createStorage: jest.Mock<any, [any]>;
  getStorageProviders: jest.Mock<Promise<string[]>, [any]>;
  reset: jest.Mock<void, []>;
  connect: jest.Mock<Promise<void>, []>;
}

/**
 * Creates a complete mock WalrusClient with all methods mocked
 */
export function getMockWalrusClient(): CompleteWalrusClientMock {
  return {
    getConfig: jest.fn().mockResolvedValue({
      network: 'testnet',
      version: '1.0.0',
      maxSize: 10485760
    }),
    getWalBalance: jest.fn().mockResolvedValue('1000'),
    getStorageUsage: jest.fn().mockResolvedValue({
      used: '100',
      total: '1000'
    }),
    readBlob: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    writeBlob: jest.fn().mockResolvedValue({
      blobId: 'mock-blob-test-todo-id',
      blobObject: {
        id: { id: 'mock-blob-test-todo-id' },
        blob_id: 'mock-blob-test-todo-id',
        registered_epoch: 100,
        certified_epoch: 150,
        size: BigInt(1024),
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        storage: {
          id: { id: 'storage1' },
          start_epoch: 100,
          end_epoch: 200,
          storage_size: BigInt(2048),
          used_size: BigInt(1024),
        },
        deletable: true,
      }
    }),
    getBlobInfo: jest.fn().mockResolvedValue({
      blob_id: 'mock-blob-test-todo-id',
      certified_epoch: 150,
      registered_epoch: 100,
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      unencoded_length: '1024',
      size: '1024',
      hashes: [],
      metadata: {
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1024',
          hashes: [],
          $kind: 'V1',
        },
        $kind: 'V1',
      },
    }),
    getBlobObject: jest.fn().mockResolvedValue({
      id: { id: 'mock-blob-test-todo-id' },
      blob_id: 'mock-blob-test-todo-id',
      registered_epoch: 100,
      certified_epoch: 150,
      size: BigInt(1024),
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      storage: {
        id: { id: 'storage1' },
        start_epoch: 100,
        end_epoch: 200,
        storage_size: BigInt(2048),
        used_size: BigInt(1024),
      },
      deletable: true,
    }),
    getBlobMetadata: jest.fn().mockResolvedValue({
      V1: {
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        unencoded_length: '1024',
        hashes: [],
        $kind: 'V1',
      },
      $kind: 'V1',
    }),
    verifyPoA: jest.fn().mockResolvedValue(true),
    getBlobSize: jest.fn().mockResolvedValue(1024),
    storageCost: jest.fn().mockResolvedValue({
      storageCost: BigInt(100),
      writeCost: BigInt(50),
      totalCost: BigInt(150),
    }),
    executeCreateStorageTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-transaction-digest',
      storage: {
        id: { id: 'storage1' },
        start_epoch: 100,
        end_epoch: 200,
        storage_size: '2048',
      },
    }),
    getStorageProviders: jest.fn().mockResolvedValue([
      'provider1',
      'provider2',
      'provider3',
      'provider4',
    ]),
    executeCertifyBlobTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-certify-digest',
    }),
    executeWriteBlobAttributesTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-attributes-digest',
    }),
    deleteBlob: jest.fn().mockImplementation(() => jest.fn().mockResolvedValue({
      digest: 'mock-delete-digest',
    })),
    executeRegisterBlobTransaction: jest.fn().mockResolvedValue({
      blob: {
        id: { id: 'mock-blob-id' },
        blob_id: 'mock-blob-id',
        registered_epoch: 100,
        certified_epoch: 150,
        size: BigInt(1024),
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        storage: {
          id: { id: 'storage1' },
          start_epoch: 100,
          end_epoch: 200,
          storage_size: BigInt(2048),
          used_size: BigInt(1024),
        },
        deletable: true,
      },
      digest: 'mock-register-digest',
    }),
    getStorageConfirmationFromNode: jest.fn().mockResolvedValue({
      confirmed: true,
      epoch: 150,
    }),
    createStorageBlock: jest.fn().mockResolvedValue({}),
    createStorage: jest.fn().mockImplementation(() => jest.fn().mockResolvedValue({
      id: { id: 'storage1' },
      start_epoch: 100,
      end_epoch: 200,
      storage_size: BigInt(2048),
    })),
    reset: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock Walrus module for Jest mocking
 */
export function createWalrusModuleMock() {
  const mockClient = getMockWalrusClient();
  
  return {
    WalrusClient: jest.fn().mockImplementation(() => mockClient),
    // Add other exports from @mysten/walrus that might be needed
    createWalrusClient: jest.fn().mockImplementation(() => mockClient),
  };
}