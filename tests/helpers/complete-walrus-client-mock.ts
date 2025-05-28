import type { WalrusClientExt } from '../../apps/cli/src/types/client';
import type { BlobInfo, BlobObject, BlobMetadataShape } from '../../apps/cli/src/types/walrus';

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
  deleteBlob: jest.Mock<(tx: any) => Promise<{ digest: string }>, [any]>;
  executeRegisterBlobTransaction: jest.Mock<Promise<{ blob: BlobObject; digest: string }>, [any]>;
  getStorageConfirmationFromNode: jest.Mock<Promise<any>, [any]>;
  createStorageBlock: jest.Mock<Promise<any>, [number, number]>;
  createStorage: jest.Mock<(tx: any) => Promise<{ digest: string; storage: any }>, [any]>;
  getStorageProviders: jest.Mock<Promise<string[]>, [any]>;
  reset: jest.Mock<void, []>;
  connect: jest.Mock<Promise<void>, []>;
  experimental?: {
    getBlobData: jest.Mock<Promise<Uint8Array | BlobObject>, []>;
  };
}

/**
 * Creates a complete mock WalrusClient with all methods mocked
 * Uses factory functions to create responses dynamically to reduce memory usage
 */
export function getMockWalrusClient(): CompleteWalrusClientMock {
  // Factory functions for creating mock responses
  const createMockConfig = () => ({
    network: 'testnet',
    version: '1.0.0',
    maxSize: 10485760
  });

  const createMockStorageUsage = () => ({
    used: '100',
    total: '1000'
  });

  const createMockBlob = (length?: number) => new Uint8Array(length || 4).fill(1);

  return {
    getConfig: jest.fn().mockImplementation(() => Promise.resolve(createMockConfig())),
    getWalBalance: jest.fn().mockResolvedValue('1000'),
    getStorageUsage: jest.fn().mockImplementation(() => Promise.resolve(createMockStorageUsage())),
    readBlob: jest.fn().mockImplementation(() => Promise.resolve(createMockBlob())),
    writeBlob: jest.fn().mockImplementation(() => Promise.resolve({
      blobId: 'mock-blob-test-todo-id',
      blobObject: {
        id: { id: 'mock-blob-test-todo-id' },
        blob_id: 'mock-blob-test-todo-id',
        registered_epoch: 100,
        certified_epoch: 150,
        size: BigInt(4), // Match default blob size
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        storage: {
          id: { id: 'storage1' },
          start_epoch: 100,
          end_epoch: 200,
          storage_size: BigInt(2048),
          used_size: BigInt(4), // Match default blob size
        },
        deletable: true,
      }
    })),
    getBlobInfo: jest.fn().mockImplementation(() => Promise.resolve({
      blob_id: 'mock-blob-test-todo-id',
      certified_epoch: 150,
      registered_epoch: 100,
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      unencoded_length: '4', // Match default blob size
      size: '4', // Match default blob size
      hashes: [],
      metadata: {
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '4', // Match default blob size
          hashes: [],
          $kind: 'V1',
        },
        $kind: 'V1',
      },
    })),
    getBlobObject: jest.fn().mockImplementation(() => Promise.resolve({
      id: { id: 'mock-blob-test-todo-id' },
      blob_id: 'mock-blob-test-todo-id',
      registered_epoch: 100,
      certified_epoch: 150,
      size: BigInt(4), // Match default blob size
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      storage: {
        id: { id: 'storage1' },
        start_epoch: 100,
        end_epoch: 200,
        storage_size: BigInt(2048),
        used_size: BigInt(4), // Match default blob size
      },
      deletable: true,
    })),
    getBlobMetadata: jest.fn().mockImplementation(() => Promise.resolve({
      V1: {
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        unencoded_length: '4', // Match default blob size
        hashes: [],
        $kind: 'V1',
      },
      $kind: 'V1',
    })),
    verifyPoA: jest.fn().mockResolvedValue(true),
    getBlobSize: jest.fn().mockResolvedValue(4), // Match default blob size
    storageCost: jest.fn().mockImplementation(() => Promise.resolve({
      storageCost: BigInt(100),
      writeCost: BigInt(50),
      totalCost: BigInt(150),
    })),
    executeCreateStorageTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-transaction-digest',
      storage: {
        id: { id: 'storage1' },
        start_epoch: 100,
        end_epoch: 200,
        storage_size: '2048',
      },
    }),
    executeCertifyBlobTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-certify-digest',
    }),
    executeWriteBlobAttributesTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-attributes-digest',
    }),
    deleteBlob: jest.fn().mockImplementation(() => (tx: any) => Promise.resolve({
      digest: 'mock-delete-digest',
    })),
    executeRegisterBlobTransaction: jest.fn().mockResolvedValue({
      blob: {
        id: { id: 'mock-blob-id' },
        blob_id: 'mock-blob-id',
        registered_epoch: 100,
        certified_epoch: 150,
        size: BigInt(4), // Match default blob size
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        storage: {
          id: { id: 'storage1' },
          start_epoch: 100,
          end_epoch: 200,
          storage_size: BigInt(2048),
          used_size: BigInt(4), // Match default blob size
        },
        deletable: true,
      },
      digest: 'mock-register-digest',
    }),
    getStorageConfirmationFromNode: jest.fn().mockResolvedValue({
      primary_verification: true,
      secondary_verification: true,
      provider: 'mock-provider',
      signature: 'mock-signature',
    }),
    createStorageBlock: jest.fn().mockResolvedValue({}),
    createStorage: jest.fn().mockImplementation(() => (tx: any) => Promise.resolve({
      digest: 'mock-create-storage-digest',
      storage: {
        id: { id: 'storage1' },
        start_epoch: 100,
        end_epoch: 200,
        storage_size: '2048',
      },
    })),
    getStorageProviders: jest.fn().mockImplementation(() => Promise.resolve([
      'provider1',
      'provider2',
      'provider3',
      'provider4',
    ])),
    reset: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    experimental: {
      getBlobData: jest.fn().mockImplementation(() => Promise.resolve(createMockBlob())),
    },
  };
}

/**
 * Creates a mock Walrus module for Jest mocking
 * Uses factory function to create fresh instances and avoid reference sharing
 */
export function createWalrusModuleMock() {
  return {
    WalrusClient: jest.fn().mockImplementation(() => getMockWalrusClient()),
    // Add other exports from @mysten/walrus that might be needed
    createWalrusClient: jest.fn().mockImplementation(() => getMockWalrusClient()),
  };
}

/**
 * Creates a lightweight mock client with minimal functionality
 * for tests that don't need full mock functionality
 */
export function getLightweightMockWalrusClient() {
  return {
    readBlob: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    writeBlob: jest.fn().mockResolvedValue({
      blobId: 'mock-blob-id',
      blobObject: { id: { id: 'mock-blob-id' } }
    }),
    reset: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
  };
}