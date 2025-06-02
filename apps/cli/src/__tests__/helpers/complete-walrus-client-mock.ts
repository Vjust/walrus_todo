import type { WalrusClientExt } from '../../types/client';
import type { BlobInfo, BlobObject, BlobMetadataShape } from '../../types/walrus';
import type {
  MockBlobRecord,
} from '../../types/mocks/shared-types';
import {
  createMockBlobMetadata,
} from '../../types/mocks/factories';
import { createMemoryEfficientMock, cleanupMocks } from './memory-utils';

// Internal storage for mock state to simulate real Walrus behavior
// Using shared MockBlobRecord from mocks/shared-types.ts

const mockBlobStorage: Record<string, MockBlobRecord> = {};
let currentEpoch = 100;

/**
 * Complete mock implementation of WalrusClientExt for testing
 */
export interface CompleteWalrusClientMock extends WalrusClientExt {
  getConfig: jest.Mock<
    Promise<{ network: string; version: string; maxSize: number }>,
    []
  >;
  getWalBalance: jest.Mock<Promise<string>, []>;
  getStorageUsage: jest.Mock<Promise<{ used: string; total: string }>, []>;
  readBlob: jest.Mock<Promise<Uint8Array>, [any]>;
  writeBlob: jest.Mock<
    Promise<{ blobId: string; blobObject: BlobObject }>,
    [any]
  >;
  getBlobInfo: jest.Mock<Promise<BlobInfo>, [string]>;
  getBlobObject: jest.Mock<Promise<BlobObject>, [any]>;
  getBlobMetadata: jest.Mock<Promise<BlobMetadataShape>, [any]>;
  verifyPoA: jest.Mock<Promise<boolean>, [any]>;
  getBlobSize: jest.Mock<Promise<number>, [string]>;
  storageCost: jest.Mock<
    Promise<{ storageCost: bigint; writeCost: bigint; totalCost: bigint }>,
    [number, number]
  >;
  executeCreateStorageTransaction: jest.Mock<
    Promise<{ digest: string; storage: any }>,
    [any]
  >;
  executeCertifyBlobTransaction: jest.Mock<Promise<{ digest: string }>, [any]>;
  executeWriteBlobAttributesTransaction: jest.Mock<
    Promise<{ digest: string }>,
    [any]
  >;
  deleteBlob: jest.Mock<(tx: any) => Promise<{ digest: string }>, [any]>;
  executeRegisterBlobTransaction: jest.Mock<
    Promise<{ blob: BlobObject; digest: string }>,
    [any]
  >;
  getStorageConfirmationFromNode: jest.Mock<Promise<any>, [any]>;
  createStorageBlock: jest.Mock<Promise<any>, [number, number]>;
  createStorage: jest.Mock<
    (tx: any) => Promise<{ digest: string; storage: any }>,
    [any]
  >;
  getStorageProviders: jest.Mock<Promise<string[]>, [any]>;
  reset: jest.Mock<void, []>;
  connect: jest.Mock<Promise<void>, []>;
  experimental?: {
    getBlobData: jest.Mock<Promise<Uint8Array | BlobObject>, []>;
  };
  // Additional helper methods for test setup
  _setBlobCertified?: (blobId: string, certified: boolean) => void;
  _simulateEpochProgress?: (epochs: number) => void;
  _addMockBlob?: (
    blobId: string,
    data: Uint8Array,
    options?: Partial<MockBlobRecord>
  ) => void;
}

// Using shared createMockBlobMetadata function from factories

/**
 * Creates a complete mock WalrusClient with all methods mocked
 * Uses memory-efficient mocks to prevent heap overflow
 */
export function getMockWalrusClient(): CompleteWalrusClientMock {
  return {
    getConfig: createMemoryEfficientMock(
      Promise.resolve({
        network: 'testnet',
        version: '1.0.0',
        maxSize: 10485760,
      })
    ),
    getWalBalance: createMemoryEfficientMock(Promise.resolve('1000')),
    getStorageUsage: createMemoryEfficientMock(
      Promise.resolve({
        used: '100',
        total: '1000',
      })
    ),

    // Improved readBlob that checks mock storage
    readBlob: jest
      .fn()
      .mockImplementation(async (_params: { blobId: string }) => {
        const record = mockBlobStorage[_params.blobId];
        if (record) {
          return record.data;
        }
        return new Uint8Array([1, 2, 3, 4]); // Default fallback
      }),

    // Improved writeBlob that stores in mock storage
    writeBlob: jest.fn().mockImplementation(async (params: any) => {
      const blobId = params.blobId || `mock-blob-${Date.now()}`;
      const data = params.blob || params.data || new Uint8Array([1, 2, 3, 4]);
      const size = data.length;

      const metadata = createMockBlobMetadata(size);
      const storage = {
        id: { id: 'storage1' },
        start_epoch: currentEpoch,
        end_epoch: currentEpoch + 100,
        storage_size: (size * 2).toString(),
        used_size: size.toString(),
      };

      // Store in mock storage
      mockBlobStorage[blobId] = {
        blobId,
        data,
        registered_epoch: currentEpoch,
        certified_epoch: currentEpoch + 50, // Auto-certify after 50 epochs
        size,
        encoding_type: 1,
        metadata,
        storage,
        attributes: params.attributes || {},
        contentType: params.contentType || 'application/octet-stream',
        owner: params.owner || 'mock-owner',
        tags: params.tags || [],
      };

      return {
        blobId,
        blobObject: {
          id: { id: blobId },
          blob_id: blobId,
          registered_epoch: currentEpoch,
          cert_epoch: currentEpoch + 50,
          size: size.toString(),
          encoding_type: 1,
          storage,
          deletable: true,
          metadata,
        },
      };
    }),
    // Improved getBlobInfo that uses mock storage
    getBlobInfo: jest.fn().mockImplementation(async (blobId: string) => {
      const record = mockBlobStorage[blobId];
      if (record) {
        return {
          blob_id: record.blobId,
          certified_epoch: record.certified_epoch || 0,
          id: { id: record.blobId },
          registered_epoch: record.registered_epoch,
          size: record.size.toString(),
          encoding_type: 1,
          deletable: true,
          metadata: record.metadata,
        } as BlobInfo;
      }

      // Default fallback for unknown blobs
      return {
        blob_id: blobId,
        certified_epoch: 150,
        id: { id: blobId },
        registered_epoch: 100,
        size: '1024',
        encoding_type: 1,
        deletable: true,
        metadata: createMockBlobMetadata(1024),
      } as BlobInfo;
    }),

    // Improved getBlobObject that uses mock storage
    getBlobObject: jest
      .fn()
      .mockImplementation(async (_params: { blobId: string }) => {
        const record = mockBlobStorage[_params.blobId];
        if (record) {
          return {
            blob_id: record.blobId,
            id: { id: record.blobId },
            registered_epoch: record.registered_epoch,
            cert_epoch: record.certified_epoch,
            size: record.size.toString(),
            encoding_type: 1,
            storage: record.storage,
            deletable: true,
            metadata: record.metadata,
            attributes: record.attributes,
          } as BlobObject;
        }

        // Default fallback
        return {
          blob_id: _params.blobId,
          id: { id: _params.blobId },
          registered_epoch: 100,
          cert_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048',
            used_size: '1024',
          },
          deletable: true,
        } as BlobObject;
      }),

    // Improved getBlobMetadata that uses mock storage
    getBlobMetadata: jest
      .fn()
      .mockImplementation(async (_params: { blobId: string }) => {
        const record = mockBlobStorage[_params.blobId];
        if (record) {
          return record.metadata;
        }

        // Default fallback
        return createMockBlobMetadata(1024);
      }),
    // Improved verifyPoA that checks certification status
    verifyPoA: jest
      .fn()
      .mockImplementation(async (_params: { blobId: string }) => {
        const record = mockBlobStorage[_params.blobId];
        if (record) {
          // PoA is complete if blob is certified
          return (
            record.certified_epoch !== undefined &&
            record.certified_epoch <= currentEpoch
          );
        }
        return true; // Default to true for unknown blobs
      }),

    // Improved getBlobSize that uses mock storage
    getBlobSize: jest.fn().mockImplementation(async (blobId: string) => {
      const record = mockBlobStorage[blobId];
      if (record) {
        return record.size;
      }
      return 1024; // Default size
    }),
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
    // Improved getStorageProviders that can simulate different provider counts
    getStorageProviders: jest
      .fn()
      .mockImplementation(async (_params: { blobId: string }) => {
        const record = mockBlobStorage[_params.blobId];
        if (record) {
          // Return a variable number of providers based on blob characteristics
          const baseProviders = [
            'provider1',
            'provider2',
            'provider3',
            'provider4',
          ];
          return baseProviders.slice(0, Math.max(2, record.size % 5)); // 2-4 providers
        }
        return ['provider1', 'provider2', 'provider3', 'provider4'];
      }),
    executeCertifyBlobTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-certify-digest',
    }),
    executeWriteBlobAttributesTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-attributes-digest',
    }),
    deleteBlob: jest.fn().mockImplementation(
      () => (_tx: any) =>
        Promise.resolve({
          digest: 'mock-delete-digest',
        })
    ),
    executeRegisterBlobTransaction: jest.fn().mockResolvedValue({
      blob: {
        id: { id: 'mock-blob-id' },
        blob_id: 'mock-blob-id',
        registered_epoch: 100,
        cert_epoch: 150,
        size: '1024',
        encoding_type: 1,
        storage: {
          id: { id: 'storage1' },
          start_epoch: 100,
          end_epoch: 200,
          storage_size: '2048',
          used_size: '1024',
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
    createStorage: jest.fn().mockImplementation(
      () => (_tx: any) =>
        Promise.resolve({
          digest: 'mock-create-storage-digest',
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048',
          },
        })
    ),
    // Improved reset that clears mock storage
    reset: jest.fn().mockImplementation(() => {
      // Clear all mock storage when reset is called
      Object.keys(mockBlobStorage).forEach(key => delete mockBlobStorage[key]);
      currentEpoch = 100; // Reset epoch
    }),

    connect: jest.fn().mockResolvedValue(undefined),
    experimental: {
      getBlobData: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    },

    // Helper methods for test setup
    _setBlobCertified: (blobId: string, certified: boolean) => {
      const record = mockBlobStorage[blobId];
      if (record) {
        if (certified) {
          record.certified_epoch = currentEpoch;
        } else {
          record.certified_epoch = undefined;
        }
      }
    },

    _simulateEpochProgress: (epochs: number) => {
      currentEpoch += epochs;
      // Update certification for blobs that should be certified
      Object.values(mockBlobStorage).forEach(record => {
        if (
          record.certificationInProgress &&
          record.registered_epoch + 50 <= currentEpoch
        ) {
          record.certified_epoch = record.registered_epoch + 50;
          record.certificationInProgress = false;
        }
      });
    },

    _addMockBlob: (
      blobId: string,
      data: Uint8Array,
      options?: Partial<MockBlobRecord>
    ) => {
      const size = data.length;
      const metadata = createMockBlobMetadata(size);
      const storage = {
        id: { id: 'storage1' },
        start_epoch: currentEpoch,
        end_epoch: currentEpoch + 100,
        storage_size: (size * 2).toString(),
        used_size: size.toString(),
      };

      mockBlobStorage[blobId] = {
        blobId,
        data,
        registered_epoch: currentEpoch,
        certified_epoch: options?.certified_epoch,
        size,
        encoding_type: 1,
        metadata,
        storage,
        attributes: options?.attributes || {},
        contentType: options?.contentType || 'application/octet-stream',
        owner: options?.owner || 'mock-owner',
        tags: options?.tags || [],
        certificationInProgress: options?.certified_epoch === undefined,
        ...options,
      };
    },
  };
}

/**
 * Clean up all mocks to prevent memory leaks
 */
export function cleanupWalrusClientMocks(
  client: CompleteWalrusClientMock
): void {
  const mocks = {
    getConfig: client.getConfig,
    getWalBalance: client.getWalBalance,
    getStorageUsage: client.getStorageUsage,
    readBlob: client.readBlob,
    writeBlob: client.writeBlob,
    getBlobInfo: client.getBlobInfo,
    getBlobObject: client.getBlobObject,
    getBlobMetadata: client.getBlobMetadata,
    verifyPoA: client.verifyPoA,
    getBlobSize: client.getBlobSize,
    storageCost: client.storageCost,
    executeCreateStorageTransaction: client.executeCreateStorageTransaction,
    executeCertifyBlobTransaction: client.executeCertifyBlobTransaction,
    executeWriteBlobAttributesTransaction:
      client.executeWriteBlobAttributesTransaction,
    deleteBlob: client.deleteBlob,
    executeRegisterBlobTransaction: client.executeRegisterBlobTransaction,
    getStorageConfirmationFromNode: client.getStorageConfirmationFromNode,
    createStorageBlock: client.createStorageBlock,
    createStorage: client.createStorage,
    getStorageProviders: client.getStorageProviders,
    reset: client.reset,
    connect: client.connect,
  };

  cleanupMocks(mocks);

  if (client.experimental?.getBlobData) {
    cleanupMocks({ getBlobData: client.experimental.getBlobData });
  }
}

/**
 * Creates a configured mock client for specific test scenarios
 */
export function createConfiguredMockClient(
  config: {
    defaultCertified?: boolean;
    simulateNetworkErrors?: boolean;
    customBlobData?: Record<string, Uint8Array>;
    providerCount?: number;
    currentEpoch?: number;
  } = {}
): CompleteWalrusClientMock {
  const client = getMockWalrusClient();

  // Apply configuration
  if (config.currentEpoch !== undefined) {
    currentEpoch = config.currentEpoch;
  }

  if (config.customBlobData) {
    Object.entries(config.customBlobData).forEach(([blobId, data]) => {
      client._addMockBlob?.(blobId, data, {
        certified_epoch: config.defaultCertified ? currentEpoch : undefined,
      });
    });
  }

  if (config.simulateNetworkErrors) {
    // Make some calls intermittently fail
    const originalReadBlob = client.readBlob;
    client.readBlob.mockImplementation(async (params: any) => {
      if (Math.random() < 0.3) {
        // 30% failure rate
        throw new Error('Network error');
      }
      return originalReadBlob(params);
    });
  }

  if (config.providerCount !== undefined) {
    const providers = Array.from(
      { length: config.providerCount },
      (_, i) => `provider${i + 1}`
    );
    client.getStorageProviders.mockResolvedValue(providers);
  }

  return client;
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
    // Cleanup function for tests
    cleanup: () => cleanupWalrusClientMocks(mockClient),
  };
}

/**
 * Export additional utilities for tests
 */
export { mockBlobStorage, currentEpoch, createMockBlobMetadata };
