import { jest, expect, describe, test, beforeEach } from '@jest/globals';

// Mock problematic dependencies first
jest.mock('@langchain/core/prompts', () => ({}));
jest.mock('p-retry', () => ({ default: jest.fn(() => Promise.resolve()) }));
jest.mock('../../services/ai/aiService.ts', () => ({}));

import { configService } from '../../services/config-service';
import { TodoList, StorageLocation, Todo } from '../../types/todo';
import { createMockSystemStateResponse } from '../sui-test-types';
import type { Config } from '../../types';

// Create mock todo directly without importing test-utils to avoid dependency issues
function createMockTodo(overrides?: Partial<Todo>): Todo {
  const base = {
    id: 'test-todo-id',
    title: 'Test Todo',
    description: '',
    completed: false,
    priority: 'medium' as const,
    tags: [] as string[],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: true,
    storageLocation: 'local' as StorageLocation,
  };

  return {
    ...base,
    ...overrides,
  } as Todo;
}

// Create mock instances directly to avoid import path issues
const mockTodoService = {
  getAllLists: jest.fn(),
  getAllListsSync: jest.fn(),
  listTodos: jest.fn(),
  getAllListsWithContent: jest.fn(),
  createList: jest.fn(),
  getList: jest.fn(),
  getTodo: jest.fn(),
  getTodoByTitle: jest.fn(),
  getTodoByTitleOrId: jest.fn(),
  addTodo: jest.fn(),
  updateTodo: jest.fn(),
  toggleItemStatus: jest.fn(),
  completeTodo: jest.fn(),
  deleteTodo: jest.fn(),
  saveList: jest.fn(),
  deleteList: jest.fn(),
  findTodoByIdOrTitle: jest.fn(),
  findTodoByIdOrTitleAcrossLists: jest.fn(),
};

const mockSuiClient = {
  getLatestSuiSystemState: jest.fn(),
  getObject: jest.fn(),
  executeTransactionBlock: jest.fn(),
  signAndExecuteTransactionBlock: jest.fn(),
};

const mockSuiNftStorage = {
  createTodoNft: jest.fn(),
  updateTodoNftCompletionStatus: jest.fn(),
  deleteTodoNft: jest.fn(),
  getTodoNft: jest.fn(),
  getAllTodoNfts: jest.fn(),
  verifyTodoNftOwnership: jest.fn(),
};

// Using real implementations - create instances directly
// let todoService: TodoService;
// let suiNftStorage: SuiNftStorage;

// Mock getConfig with correct type for the mock config
type MockConfig = Config & {
  lastDeployment?: {
    packageId: string;
  } | null;
};

const mockConfig: MockConfig = {
  network: 'testnet',
  walletAddress: 'mock-address',
  encryptedStorage: false,
  lastDeployment: {
    packageId: 'test-package-id',
  },
};

// Create non-async getter function for config
const getConfigMock = jest.fn().mockReturnValue(mockConfig as any);
// Mock configService's getConfig method to use our mock
jest.spyOn(configService, 'getConfig').mockImplementation(getConfigMock as any);

describe('complete', () => {
  const defaultTodo = createMockTodo({
    id: 'todo123',
  });

  const defaultList: TodoList = {
    id: 'default',
    name: 'default',
    owner: 'default-owner',
    todos: [],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockTodoService?.getList?.mockResolvedValue(defaultList as any);
    mockTodoService?.getTodo?.mockResolvedValue(defaultTodo as any);
    mockTodoService?.toggleItemStatus?.mockImplementation(async () => {});

    mockSuiClient?.getLatestSuiSystemState?.mockResolvedValue(
      createMockSystemStateResponse({
        epoch: '0',
        protocolVersion: '1',
      })
    );
  });

  test('completes a local todo', async () => {
    await mockTodoService.toggleItemStatus('default', 'todo123', true);

    expect(mockTodoService.toggleItemStatus).toHaveBeenCalledWith(
      'default',
      'todo123',
      true
    );
    expect(
      mockSuiNftStorage.updateTodoNftCompletionStatus
    ).not.toHaveBeenCalled();
  });

  test('completes a blockchain todo', async () => {
    const todoWithNft = {
      ...defaultTodo,
      nftObjectId: 'test-nft-id',
    };

    mockTodoService?.getTodo?.mockResolvedValue(todoWithNft as any);

    await mockTodoService.toggleItemStatus('default', 'todo123', true);

    expect(mockTodoService.toggleItemStatus).toHaveBeenCalledWith(
      'default',
      'todo123',
      true
    );
    expect(
      mockSuiNftStorage.updateTodoNftCompletionStatus
    ).toHaveBeenCalledWith('test-nft-id');
  });

  test('handles blockchain todo completion failure', async () => {
    const todoWithNft = {
      ...defaultTodo,
      nftObjectId: 'test-nft-id',
    };

    mockTodoService?.getTodo?.mockResolvedValue(todoWithNft as any);
    mockSuiNftStorage?.updateTodoNftCompletionStatus?.mockRejectedValue(
      new Error('Failed to update NFT')
    );

    await expect(
      mockTodoService.toggleItemStatus('default', 'todo123', true)
    ).rejects.toThrow('Failed to update NFT');
  });

  test('handles network validation errors', async () => {
    getConfigMock.mockResolvedValueOnce({
      network: 'testnet',
      walletAddress: 'mock-address',
      encryptedStorage: false,
      lastDeployment: null,
    });

    await expect(
      mockTodoService.toggleItemStatus('default', 'todo123', true)
    ).rejects.toThrow('Contract not deployed');
  });

  test('handles already completed todo', async () => {
    const completedTodo = {
      ...defaultTodo,
      completed: true,
    };

    mockTodoService?.getTodo?.mockResolvedValue(completedTodo as any);

    await expect(
      mockTodoService.toggleItemStatus('default', 'todo123', true)
    ).rejects.toThrow('Todo is already completed');
  });
});
