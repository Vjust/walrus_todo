/**
 * Comprehensive WalrusClient mock implementation
 * 
 * This mock provides all required methods that test files need for WalrusClient,
 * including getBlobSize, getStorageProviders, reset, and all other methods used
 * throughout the test suite.
 */

import type { BlobObject } from '../../types/walrus';
import type { Transaction } from '@mysten/sui/transactions';

/**
 * Complete WalrusClient mock interface matching WalrusClientExt
 */
export interface MockWalrusClient {
  // Core blob operations
  readBlob: jest.Mock;
  writeBlob: jest.Mock;
  getBlobInfo: jest.Mock;
  getBlobObject: jest.Mock;
  getBlobMetadata: jest.Mock;
  
  // Storage operations
  storageCost: jest.Mock;
  executeCreateStorageTransaction: jest.Mock;
  getWalBalance: jest.Mock;
  getStorageUsage: jest.Mock;
  
  // Connection and configuration
  connect: jest.Mock;
  getConfig: jest.Mock;
  
  // Verification operations
  verifyPoA: jest.Mock;
  
  // Transaction operations
  executeCertifyBlobTransaction: jest.Mock;
  executeWriteBlobAttributesTransaction: jest.Mock;
  executeRegisterBlobTransaction: jest.Mock;
  deleteBlob: jest.Mock;
  getStorageConfirmationFromNode: jest.Mock;
  createStorageBlock: jest.Mock;
  createStorage: jest.Mock;
  
  // Extended methods required by tests (WalrusClientExt)
  getBlobSize: jest.Mock;
  getStorageProviders: jest.Mock;
  reset: jest.Mock;
  
  // Experimental methods
  experimental?: {
    getBlobData: jest.Mock;
  };
}

/**
 * Creates a comprehensive WalrusClient mock with all required methods
 */
export function createWalrusClientMock(): MockWalrusClient {
  return {
    // Core blob operations
    readBlob: jest.fn(),
    writeBlob: jest.fn(),
    getBlobInfo: jest.fn(),
    getBlobObject: jest.fn(),
    getBlobMetadata: jest.fn(),
    
    // Storage operations
    storageCost: jest.fn(),
    executeCreateStorageTransaction: jest.fn(),
    getWalBalance: jest.fn(),
    getStorageUsage: jest.fn(),
    
    // Connection and configuration
    connect: jest.fn(),
    getConfig: jest.fn(),
    
    // Verification operations
    verifyPoA: jest.fn(),
    
    // Transaction operations
    executeCertifyBlobTransaction: jest.fn(),
    executeWriteBlobAttributesTransaction: jest.fn(),
    executeRegisterBlobTransaction: jest.fn(),
    deleteBlob: jest.fn(),
    getStorageConfirmationFromNode: jest.fn(),
    createStorageBlock: jest.fn(),
    createStorage: jest.fn(),
    
    // Extended methods required by tests (WalrusClientExt)
    getBlobSize: jest.fn(),
    getStorageProviders: jest.fn(),
    reset: jest.fn(),
    
    // Experimental methods
    experimental: {
      getBlobData: jest.fn(),
    },
  };
}

/**
 * Sets up default mock responses for WalrusClient
 */
export function setupDefaultWalrusClientMocks(mockClient: MockWalrusClient): void {
  // Connection and configuration
  mockClient.connect.mockResolvedValue(undefined);
  mockClient.getConfig.mockResolvedValue({
    network: 'testnet',
    version: '1.0.0',
    maxSize: 10485760,
  });

  // Storage operations
  mockClient.getWalBalance.mockResolvedValue('1000');
  mockClient.getStorageUsage.mockResolvedValue({
    used: '100000',
    total: '1000000',
  });
  
  mockClient.storageCost.mockResolvedValue({
    storageCost: BigInt(100),
    writeCost: BigInt(50),
    totalCost: BigInt(150),
  });

  mockClient.executeCreateStorageTransaction.mockResolvedValue({
    digest: 'test-digest',
    storage: {
      id: { id: 'test-storage-id' },
      storage_size: '1000000',
      end_epoch: 100,
      start_epoch: 1,
    },
  });

  // Transaction operations
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
      deletable: false,
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

  // Blob operations
  mockClient.readBlob.mockResolvedValue(new Uint8Array());
  
  mockClient.writeBlob.mockResolvedValue({
    blobId: 'test-blob-id',
    blobObject: {
      id: { id: 'test-blob-id' },
      blob_id: 'test-blob-id',
      registered_epoch: 1,
      size: '1024',
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
      storage: {
        id: { id: 'test-storage-id' },
        storage_size: '1000000',
        used_size: '1024',
        end_epoch: 100,
        start_epoch: 1,
      },
      deletable: false,
    } as BlobObject,
  });

  mockClient.getBlobInfo.mockResolvedValue({
    blob_id: 'test-blob-id',
    registered_epoch: 1,
    cert_epoch: 2,
    size: '1024',
  });

  mockClient.getBlobObject.mockResolvedValue({
    id: { id: 'test-blob-id' },
    blob_id: 'test-blob-id',
    registered_epoch: 1,
    size: '1024',
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
    storage: {
      id: { id: 'test-storage-id' },
      storage_size: '1000000',
      used_size: '1024',
      end_epoch: 100,
      start_epoch: 1,
    },
    deletable: false,
  } as BlobObject);

  mockClient.getBlobMetadata.mockResolvedValue({
    V1: {
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      unencoded_length: '1024',
      hashes: [
        {
          primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
          secondary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
        },
      ],
      $kind: 'V1',
    },
    $kind: 'V1',
  });

  // Verification operations
  mockClient.verifyPoA.mockResolvedValue(true);

  // Extended methods (WalrusClientExt)
  mockClient.getBlobSize.mockResolvedValue(1024);
  mockClient.getStorageProviders.mockResolvedValue([
    'provider1',
    'provider2',
  ]);
  mockClient.reset.mockImplementation(() => {
    // Reset mock implementation - clears all mock state
    Object.values(mockClient).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear();
      }
    });
    // Reset experimental methods
    if (mockClient.experimental) {
      Object.values(mockClient.experimental).forEach(mock => {
        if (jest.isMockFunction(mock)) {
          mock.mockClear();
        }
      });
    }
  });
  
  // Experimental methods
  mockClient.experimental!.getBlobData.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
}

/**
 * Jest mock factory for @mysten/walrus WalrusClient
 */
export const WalrusClientMockFactory = () => {
  const mockClient = createWalrusClientMock();
  setupDefaultWalrusClientMocks(mockClient);
  return mockClient;
};

/**
 * Complete Jest module mock for @mysten/walrus
 */
export const walrusModuleMock = {
  WalrusClient: jest.fn().mockImplementation(() => {
    const mockClient = createWalrusClientMock();
    setupDefaultWalrusClientMocks(mockClient);
    return mockClient;
  }),
  // Export additional types that might be imported
  BlobObject: {},
  BlobInfo: {},
  BlobMetadataShape: {},
};

/**
 * Default export for direct import
 */
export default walrusModuleMock;