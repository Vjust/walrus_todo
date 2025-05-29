import type { WalrusClientExt } from '../../types/client';
import type { BlobInfo, BlobObject, BlobMetadataShape } from '../../types/walrus';
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
  readBlob: jest.Mock<Promise<Uint8Array>, [{ blobId: string; signal?: AbortSignal }]>;
  writeBlob: jest.Mock<
    Promise<{ blobId: string; blobObject: BlobObject }>,
    [{
      blob: Uint8Array;
      signer: any;
      deletable?: boolean;
      epochs?: number;
      attributes?: Record<string, string>;
      transaction?: any;
      owner?: string;
    }]
  >;
  getBlobInfo: jest.Mock<Promise<BlobInfo>, [string]>;
  getBlobObject: jest.Mock<Promise<BlobObject>, [{ blobId: string }]>;
  getBlobMetadata: jest.Mock<Promise<BlobMetadataShape>, [{ blobId: string; signal?: AbortSignal }]>;
  verifyPoA: jest.Mock<Promise<boolean>, [{ blobId: string }]>;
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
  getStorageProviders: jest.Mock<Promise<string[]>, [{ blobId: string }]>;
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
 * Convert StandardBlobInfo to BlobInfo for interface compatibility
 */
function convertToCompatibleBlobInfo(standardBlobInfo: StandardBlobInfo): BlobInfo {
  return {
    blob_id: standardBlobInfo.blob_id,
    id: standardBlobInfo.id,
    registered_epoch: standardBlobInfo.registered_epoch,
    certified_epoch: standardBlobInfo.certified_epoch,
    storage_cost: standardBlobInfo.storage_cost,
    storage_rebate: standardBlobInfo.storage_rebate,
    size: standardBlobInfo.size,
    encoding_type: standardBlobInfo.encoding_type,
    deletable: standardBlobInfo.deletable,
    cert_epoch: standardBlobInfo.cert_epoch,
    storage: standardBlobInfo.storage,
    metadata: convertToCompatibleBlobMetadata(standardBlobInfo.metadata),
    provider_count: standardBlobInfo.provider_count,
    slivers: standardBlobInfo.slivers,
    attributes: standardBlobInfo.attributes,
    checksum: standardBlobInfo.checksum,
  };
}

/**
 * Convert StandardBlobObject to BlobObject for interface compatibility
 */
function convertToCompatibleBlobObject(standardBlobObject: StandardBlobObject): BlobObject {
  return {
    blob_id: standardBlobObject.blob_id,
    id: standardBlobObject.id,
    registered_epoch: standardBlobObject.registered_epoch,
    storage_cost: standardBlobObject.storage_cost,
    storage_rebate: standardBlobObject.storage_rebate,
    size: standardBlobObject.size,
    encoding_type: standardBlobObject.encoding_type,
    deletable: standardBlobObject.deletable,
    cert_epoch: standardBlobObject.cert_epoch,
    storage: standardBlobObject.storage,
    metadata: convertToCompatibleBlobMetadata(standardBlobObject.metadata),
    provider_count: standardBlobObject.provider_count,
    slivers: standardBlobObject.slivers,
    attributes: standardBlobObject.attributes,
    checksum: standardBlobObject.checksum,
  };
}

/**
 * Convert StandardBlobMetadata to BlobMetadataShape for interface compatibility
 */
function convertToCompatibleBlobMetadata(standardMetadata?: StandardBlobMetadata): BlobMetadataShape | undefined {
  if (!standardMetadata) return undefined;
  
  return {
    blob_id: standardMetadata.blob_id,
    metadata: {
      V1: standardMetadata.V1,
      $kind: 'V1' as const,
    },
    V1: standardMetadata.V1,
    $kind: 'V1' as const,
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

  mockClient.readBlob.mockImplementation(async (params: { blobId: string; signal?: AbortSignal }) => {
    return new Uint8Array([1, 2, 3, 4]);
  });

  mockClient.writeBlob.mockImplementation(async (params: {
    blob: Uint8Array;
    signer: any;
    deletable?: boolean;
    epochs?: number;
    attributes?: Record<string, string>;
    transaction?: any;
    owner?: string;
  }) => {
    return {
      blobId: 'mock-blob-test-todo-id',
      blobObject: convertToCompatibleBlobObject(createMockBlobObject('mock-blob-test-todo-id')),
    };
  });

  mockClient.getBlobInfo.mockResolvedValue(
    convertToCompatibleBlobInfo(createMockBlobInfo('mock-blob-test-todo-id'))
  );

  mockClient.getBlobObject.mockImplementation(async (params: { blobId: string }) => {
    return convertToCompatibleBlobObject(createMockBlobObject(params.blobId));
  });

  mockClient.getBlobMetadata.mockImplementation(async (params: { blobId: string; signal?: AbortSignal }) => {
    return convertToCompatibleBlobMetadata(createMockBlobMetadata(1024))!;
  });

  mockClient.verifyPoA.mockImplementation(async (params: { blobId: string }) => {
    return true;
  });

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
    blob: convertToCompatibleBlobObject(createMockBlobObject('mock-blob-id')),
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

  mockClient.getStorageProviders.mockImplementation(async (params: { blobId: string }) => {
    return [
      'provider1',
      'provider2',
      'provider3',
      'provider4',
    ];
  });

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
