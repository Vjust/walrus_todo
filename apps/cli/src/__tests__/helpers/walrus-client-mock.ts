import type { WalrusClientExt } from '../../types/client';
import type {
  BlobInfo,
  BlobObject,
  BlobMetadataShape,
} from '../../types/walrus';

/**
 * Mock implementation of WalrusClientExt for testing
 */
export interface MockWalrusClient extends WalrusClientExt {
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
}

/**
 * Creates a mock WalrusClient with all methods as Jest mocks
 */
export function createWalrusClientMock(): MockWalrusClient {
  return {
    getConfig: jest.fn(),
    getWalBalance: jest.fn(),
    getStorageUsage: jest.fn(),
    readBlob: jest.fn(),
    writeBlob: jest.fn(),
    getBlobInfo: jest.fn(),
    getBlobObject: jest.fn(),
    getBlobMetadata: jest.fn(),
    verifyPoA: jest.fn(),
    getBlobSize: jest.fn(),
    storageCost: jest.fn(),
    executeCreateStorageTransaction: jest.fn(),
    executeCertifyBlobTransaction: jest.fn(),
    executeWriteBlobAttributesTransaction: jest.fn(),
    deleteBlob: jest.fn(),
    executeRegisterBlobTransaction: jest.fn(),
    getStorageConfirmationFromNode: jest.fn(),
    createStorageBlock: jest.fn(),
    createStorage: jest.fn(),
    getStorageProviders: jest.fn(),
    reset: jest.fn(),
    connect: jest.fn(),
    experimental: {
      getBlobData: jest.fn(),
    },
  };
}

/**
 * Sets up default mock implementations for a WalrusClient mock
 */
export function setupDefaultWalrusClientMocks(
  mockClient: MockWalrusClient
): void {
  mockClient.getConfig.mockResolvedValue({
    network: 'testnet',
    version: '1.0.0',
    maxSize: 10485760,
  });

  mockClient.getWalBalance.mockResolvedValue('1000');

  mockClient.getStorageUsage.mockResolvedValue({
    used: '100',
    total: '1000',
  });

  mockClient.readBlob.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

  mockClient.writeBlob.mockResolvedValue({
    blobId: 'mock-blob-test-todo-id',
    blobObject: {
      id: { id: 'mock-blob-test-todo-id' },
      blob_id: 'mock-blob-test-todo-id',
      registered_epoch: 100,
      cert_epoch: 150,
      size: '1024',
      encoding_type: 0,
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

  mockClient.getBlobInfo.mockResolvedValue({
    blob_id: 'mock-blob-test-todo-id',
    certified_epoch: 150,
    registered_epoch: 100,
    encoding_type: 0,
    size: '1024',
    metadata: {
      V1: {
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        unencoded_length: '1024',
        hashes: [],
        $kind: 'V1',
      },
      $kind: 'V1',
    },
  });

  mockClient.getBlobObject.mockResolvedValue({
    id: { id: 'mock-blob-test-todo-id' },
    blob_id: 'mock-blob-test-todo-id',
    registered_epoch: 100,
    size: '1024',
    encoding_type: 0,
    storage: {
      id: { id: 'storage1' },
      start_epoch: 100,
      end_epoch: 200,
      storage_size: '2048',
      used_size: '1024',
    },
    deletable: true,
  });

  mockClient.getBlobMetadata.mockResolvedValue({
    V1: {
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      unencoded_length: '1024',
      hashes: [],
      $kind: 'V1',
    },
    $kind: 'V1',
  });

  mockClient.verifyPoA.mockResolvedValue(true);

  mockClient.getBlobSize.mockResolvedValue(1024);

  mockClient.storageCost.mockResolvedValue({
    storageCost: BigInt(100),
    writeCost: BigInt(50),
    totalCost: BigInt(150),
  });

  mockClient.executeCreateStorageTransaction.mockResolvedValue({
    digest: 'mock-transaction-digest',
    storage: {
      id: { id: 'storage1' },
      start_epoch: 100,
      end_epoch: 200,
      storage_size: '2048',
    },
  });

  mockClient.executeCertifyBlobTransaction.mockResolvedValue({
    digest: 'mock-certify-digest',
  });

  mockClient.executeWriteBlobAttributesTransaction.mockResolvedValue({
    digest: 'mock-attributes-digest',
  });

  mockClient.deleteBlob.mockImplementation(
    () => (tx: any) =>
      Promise.resolve({
        digest: 'mock-delete-digest',
      })
  );

  mockClient.executeRegisterBlobTransaction.mockResolvedValue({
    blob: {
      id: { id: 'mock-blob-id' },
      blob_id: 'mock-blob-id',
      registered_epoch: 100,
      cert_epoch: 150,
      size: '1024',
      encoding_type: 0,
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
  });

  mockClient.getStorageConfirmationFromNode.mockResolvedValue({
    primary_verification: true,
    secondary_verification: true,
    provider: 'mock-provider',
    signature: 'mock-signature',
  });

  mockClient.createStorageBlock.mockResolvedValue({});

  mockClient.createStorage.mockImplementation(
    () => (tx: any) =>
      Promise.resolve({
        digest: 'mock-create-storage-digest',
        storage: {
          id: { id: 'storage1' },
          start_epoch: 100,
          end_epoch: 200,
          storage_size: '2048',
        },
      })
  );

  mockClient.getStorageProviders.mockResolvedValue([
    'provider1',
    'provider2',
    'provider3',
    'provider4',
  ]);

  mockClient.reset.mockImplementation(() => {});

  mockClient.connect.mockResolvedValue(undefined);

  if (mockClient.experimental) {
    mockClient.experimental.getBlobData.mockResolvedValue(
      new Uint8Array([1, 2, 3, 4])
    );
  }
}

/**
 * Creates a mock WalrusClient with default implementations
 */
export function getMockWalrusClient(): MockWalrusClient {
  const mockClient = createWalrusClientMock();
  setupDefaultWalrusClientMocks(mockClient);
  return mockClient;
}

/**
 * Creates a mock Walrus module for Jest mocking
 */
export function createWalrusModuleMock() {
  const mockClient = createWalrusClientMock();
  setupDefaultWalrusClientMocks(mockClient);

  return {
    WalrusClient: jest.fn().mockImplementation(() => mockClient),
    createWalrusClient: jest.fn().mockImplementation(() => mockClient),
  };
}
