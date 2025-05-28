import { jest } from '@jest/globals';
import type { SuiNftStorage } from '../../apps/cli/src/utils/sui-nft-storage';

/**
 * Mock SuiNftStorage with all methods
 */
export interface MockSuiNftStorage extends jest.Mocked<SuiNftStorage> {
  createTodoNft: jest.MockedFunction<(todoData: any) => Promise<any>>;
  updateTodoNftCompletionStatus: jest.MockedFunction<(nftObjectId: string, completed?: boolean) => Promise<any>>;
  deleteTodoNft: jest.MockedFunction<(nftObjectId: string) => Promise<any>>;
  getTodoNft: jest.MockedFunction<(nftObjectId: string) => Promise<any>>;
  getAllTodoNfts: jest.MockedFunction<(owner?: string) => Promise<any[]>>;
  verifyTodoNftOwnership: jest.MockedFunction<(nftObjectId: string, expectedOwner: string) => Promise<boolean>>;
  transferTodoNft: jest.MockedFunction<(nftObjectId: string, newOwner: string) => Promise<any>>;
  batchCreateTodoNfts: jest.MockedFunction<(todoDataArray: any[]) => Promise<any[]>>;
  searchTodoNfts: jest.MockedFunction<(criteria: any) => Promise<any[]>>;
  updateTodoNftMetadata: jest.MockedFunction<(nftObjectId: string, metadata: any) => Promise<any>>;
}

/**
 * Creates a mock SuiNftStorage instance with all methods mocked
 */
export function createMockSuiNftStorage(): MockSuiNftStorage {
  return {
    createTodoNft: jest.fn().mockResolvedValue({
      objectId: 'mock-nft-object-id',
      digest: 'mock-digest',
      transaction: {},
    }),
    updateTodoNftCompletionStatus: jest.fn().mockResolvedValue({
      objectId: 'mock-nft-object-id',
      digest: 'mock-update-digest',
      transaction: {},
    }),
    deleteTodoNft: jest.fn().mockResolvedValue({
      digest: 'mock-delete-digest',
      transaction: {},
    }),
    getTodoNft: jest.fn().mockResolvedValue({
      objectId: 'mock-nft-object-id',
      data: {
        title: 'Mock Todo',
        description: 'Mock Description',
        completed: false,
      },
    }),
    getAllTodoNfts: jest.fn().mockResolvedValue([]),
    verifyTodoNftOwnership: jest.fn().mockResolvedValue(true),
    transferTodoNft: jest.fn().mockResolvedValue({
      digest: 'mock-transfer-digest',
      transaction: {},
    }),
    batchCreateTodoNfts: jest.fn().mockResolvedValue([]),
    searchTodoNfts: jest.fn().mockResolvedValue([]),
    updateTodoNftMetadata: jest.fn().mockResolvedValue({
      objectId: 'mock-nft-object-id',
      digest: 'mock-metadata-digest',
      transaction: {},
    }),
  } as MockSuiNftStorage;
}

/**
 * Creates a SuiNftStorage class mock for jest.MockedClass usage
 */
export function createSuiNftStorageClassMock() {
  const MockSuiNftStorageClass = jest.fn().mockImplementation(() => createMockSuiNftStorage()) as jest.MockedClass<typeof SuiNftStorage>;
  
  // Add prototype methods for cases where tests access methods via prototype
  const mockInstance = createMockSuiNftStorage();
  MockSuiNftStorageClass.prototype = mockInstance;

  return MockSuiNftStorageClass;
}

/**
 * Global SuiNftStorage mock that can be imported
 */
export const mockSuiNftStorage = createMockSuiNftStorage();
export const MockSuiNftStorageClass = createSuiNftStorageClassMock();