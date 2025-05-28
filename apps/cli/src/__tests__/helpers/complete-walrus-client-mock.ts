/**
 * Complete WalrusClient Mock Implementation
 * 
 * This file provides a comprehensive mock implementation for WalrusClientExt
 * that includes ALL required methods that test files need, ensuring that no
 * test fails due to missing mock methods.
 * 
 * Import this instead of creating inline mocks to ensure consistency.
 */

import type { BlobObject, BlobInfo, BlobMetadataShape } from '../../types/walrus';
import type { WalrusClientExt } from '../../types/client';
import type { Transaction } from '@mysten/sui/transactions';

/**
 * Complete WalrusClientExt mock that includes all methods from the interface
 */
export interface CompleteWalrusClientMock extends jest.Mocked<WalrusClientExt> {
  // Additional methods that tests expect but aren't in the base interface
  connect: jest.Mock<Promise<void>, []>;
}

/**
 * Creates a complete WalrusClientExt mock with all methods implemented
 * 
 * @returns A fully mocked WalrusClientExt instance
 */
export function createCompleteWalrusClientMock(): CompleteWalrusClientMock {
  const mockClient = {
    // Connection and initialization methods
    connect: jest.fn(),
    
    // Core WalrusClient methods
    getConfig: jest.fn(),
    getWalBalance: jest.fn(),
    getStorageUsage: jest.fn(),
    getBlobInfo: jest.fn(),
    getBlobObject: jest.fn(),
    verifyPoA: jest.fn(),
    readBlob: jest.fn(),
    getBlobMetadata: jest.fn(),
    storageCost: jest.fn(),
    
    // Transaction execution methods
    executeCreateStorageTransaction: jest.fn(),
    executeCertifyBlobTransaction: jest.fn(),
    executeWriteBlobAttributesTransaction: jest.fn(),
    executeRegisterBlobTransaction: jest.fn(),
    getStorageConfirmationFromNode: jest.fn(),
    createStorageBlock: jest.fn(),
    createStorage: jest.fn(),
    deleteBlob: jest.fn(),
    
    // Enhanced blob writing
    writeBlob: jest.fn(),
    
    // WalrusClientExt extension methods
    getBlobSize: jest.fn(),
    getStorageProviders: jest.fn(),
    reset: jest.fn(),
    
    // Experimental API
    experimental: {
      getBlobData: jest.fn(),
    },
  } as CompleteWalrusClientMock;

  // Set up default implementations
  setupDefaultMockImplementations(mockClient);
  
  return mockClient;
}

/**
 * Sets up realistic default mock implementations for all methods
 */
export function setupDefaultMockImplementations(mockClient: CompleteWalrusClientMock): void {
  // Connection
  mockClient.connect.mockResolvedValue(undefined);
  
  // Core configuration
  mockClient.getConfig.mockResolvedValue({
    network: 'testnet',
    version: '1.0.0',
    maxSize: 10485760,
  });

  // Wallet and storage info
  mockClient.getWalBalance.mockResolvedValue('1000');
  mockClient.getStorageUsage.mockResolvedValue({
    used: '100000',
    total: '1000000',
  });

  // Storage cost calculation
  mockClient.storageCost.mockResolvedValue({
    storageCost: BigInt(100),
    writeCost: BigInt(50),
    totalCost: BigInt(150),
  });

  // Blob operations
  mockClient.readBlob.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
  
  mockClient.writeBlob.mockResolvedValue({
    blobId: 'test-blob-id',
    blobObject: {
      id: { id: 'test-blob-id' },
      blob_id: 'test-blob-id',
      registered_epoch: 1,
      size: '1024',
      encoding_type: 1,
      metadata: {
        $kind: 'V1',
        V1: {
          $kind: 'V1',
          encoding_type: {
            RedStuff: true,
            $kind: 'RedStuff',
          },
          unencoded_length: '1024',
          hashes: [],
        },
      },
      cert_epoch: 2,
      deletable: false,
      storage: {
        id: { id: 'test-storage-id' },
        storage_size: '1000000',
        used_size: '100000',
        end_epoch: 100,
        start_epoch: 1,
      },
    } as BlobObject,
  });

  mockClient.getBlobInfo.mockResolvedValue({
    blob_id: 'test-blob-id',
    registered_epoch: 1,
    certified_epoch: 2,
    size: '1024',
  } as BlobInfo);

  mockClient.getBlobObject.mockResolvedValue({
    id: { id: 'test-blob-id' },
    blob_id: 'test-blob-id',
    registered_epoch: 1,
    size: '1024',
    encoding_type: 1,
    metadata: {
      $kind: 'V1',
      V1: {
        $kind: 'V1',
        encoding_type: {
          RedStuff: true,
          $kind: 'RedStuff',
        },
        unencoded_length: '1024',
        hashes: [],
      },
    },
    cert_epoch: 2,
    deletable: false,
    storage: {
      id: { id: 'test-storage-id' },
      storage_size: '1000000',
      used_size: '100000',
      end_epoch: 100,
      start_epoch: 1,
    },
  } as BlobObject);

  mockClient.getBlobMetadata.mockResolvedValue({
    V1: {
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      unencoded_length: '1024',
      hashes: [
        {
          primary_hash: { Digest: new Uint8Array(32) as Uint8Array<ArrayBufferLike>, $kind: 'Digest' },
          secondary_hash: { Sha256: new Uint8Array(32) as Uint8Array<ArrayBufferLike>, $kind: 'Sha256' },
        },
      ],
      $kind: 'V1',
    },
    $kind: 'V1',
  } as BlobMetadataShape);

  // Verification
  mockClient.verifyPoA.mockResolvedValue(true);

  // Transaction operations
  mockClient.executeCreateStorageTransaction.mockResolvedValue({
    digest: 'test-digest',
    storage: {
      id: { id: 'test-storage-id' },
      start_epoch: 1,
      end_epoch: 100,
      storage_size: '1000000',
    },
  });

  mockClient.executeCertifyBlobTransaction.mockResolvedValue({
    digest: 'test-digest',
  });

  mockClient.executeWriteBlobAttributesTransaction.mockResolvedValue({
    digest: 'test-digest',
  });

  mockClient.executeRegisterBlobTransaction.mockResolvedValue({
    blob: {
      id: { id: 'test-blob-id' },
      blob_id: 'test-blob-id',
      registered_epoch: 1,
      size: '1024',
      encoding_type: 1,
      cert_epoch: 2,
      deletable: false,
      storage: {
        id: { id: 'test-storage-id' },
        storage_size: '1000000',
        used_size: '100000',
        end_epoch: 100,
        start_epoch: 1,
      },
    } as BlobObject,
    digest: 'test-digest',
  });

  mockClient.deleteBlob.mockReturnValue(
    jest.fn().mockResolvedValue({ digest: 'test-digest' })
  );

  mockClient.getStorageConfirmationFromNode.mockResolvedValue({
    primary_verification: true,
    secondary_verification: true,
    provider: 'test-provider',
    signature: 'test-signature',
  });

  mockClient.createStorageBlock.mockResolvedValue({
    serialize: () => Promise.resolve('test-serialized-transaction'),
    build: () => Promise.resolve(new Uint8Array()),
    getDigest: () => Promise.resolve('test-digest'),
    pure: jest.fn(),
    object: jest.fn(),
  } as unknown as Transaction);

  mockClient.createStorage.mockReturnValue(
    jest.fn().mockResolvedValue({
      digest: 'test-digest',
      storage: {
        id: { id: 'test-storage-id' },
        start_epoch: 1,
        end_epoch: 100,
        storage_size: '1000000',
      },
    })
  );

  // Extended methods (WalrusClientExt)
  mockClient.getBlobSize.mockResolvedValue(1024);
  mockClient.getStorageProviders.mockResolvedValue([
    'provider1',
    'provider2',
    'provider3',
  ]);

  mockClient.reset.mockImplementation(() => {
    // Reset all mock functions
    Object.values(mockClient).forEach(value => {
      if (jest.isMockFunction(value)) {
        value.mockClear();
      }
    });
    
    // Reset experimental methods
    if (mockClient.experimental) {
      Object.values(mockClient.experimental).forEach(value => {
        if (jest.isMockFunction(value)) {
          value.mockClear();
        }
      });
    }
    
    // Re-setup default implementations after reset
    setupDefaultMockImplementations(mockClient);
  });

  // Experimental methods - ensure they exist
  if (mockClient.experimental?.getBlobData) {
    (mockClient.experimental.getBlobData as jest.Mock).mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
  }
}

/**
 * Jest module mock factory for @mysten/walrus that creates complete mocks
 */
export const createWalrusModuleMock = () => ({
  WalrusClient: jest.fn().mockImplementation(() => createCompleteWalrusClientMock()),
  // Export commonly imported types
  BlobObject: {},
  BlobInfo: {},
  BlobMetadataShape: {},
});

/**
 * Helper function to get a mock WalrusClient for use in tests
 * 
 * Usage in test files:
 * ```typescript
 * import { getMockWalrusClient } from '../helpers/complete-walrus-client-mock';
 * 
 * const mockClient = getMockWalrusClient();
 * // All methods are available and properly mocked
 * ```
 */
export function getMockWalrusClient(): CompleteWalrusClientMock {
  return createCompleteWalrusClientMock();
}

/**
 * Helper to setup module mocking in jest.mock() calls
 * 
 * Usage:
 * ```typescript
 * import { createWalrusModuleMock } from '../helpers/complete-walrus-client-mock';
 * 
 * jest.mock('@mysten/walrus', () => createWalrusModuleMock());
 * ```
 */
export { createWalrusModuleMock as walrusModuleMock };