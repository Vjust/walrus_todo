import type { WalrusClientExt } from '../../types/client';
import type {
  StandardBlobObject,
  StandardBlobInfo,
  StandardBlobMetadata,
} from '../../types/mocks/shared-types';
import {
  createMockBlobObject,
  createMockBlobInfo,
  createMockBlobMetadata,
  createMockStorageConfirmation,
} from '../../types/mocks/factories';

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
    Promise<{ blobId: string; blobObject: StandardBlobObject }>,
    [any]
  >;
  getBlobInfo: jest.Mock<Promise<StandardBlobInfo>, [string]>;
  getBlobObject: jest.Mock<Promise<StandardBlobObject>, [any]>;
  getBlobMetadata: jest.Mock<Promise<StandardBlobMetadata>, [any]>;
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
    Promise<{ blob: StandardBlobObject; digest: string }>,
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
    getBlobData: jest.Mock<Promise<Uint8Array | StandardBlobObject>, []>;
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
    blobObject: createMockBlobObject('mock-blob-test-todo-id'),
  });

  mockClient.getBlobInfo.mockResolvedValue(
    createMockBlobInfo('mock-blob-test-todo-id')
  );

  mockClient.getBlobObject.mockResolvedValue(
    createMockBlobObject('mock-blob-test-todo-id')
  );

  mockClient.getBlobMetadata.mockResolvedValue(
    createMockBlobMetadata(1024)
  );

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
    blob: createMockBlobObject('mock-blob-id'),
    digest: 'mock-register-digest',
  });

  mockClient.getStorageConfirmationFromNode.mockResolvedValue(
    createMockStorageConfirmation()
  );

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
