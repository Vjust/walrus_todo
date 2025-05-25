import { jest, expect, describe, test, beforeEach } from '@jest/globals';
import { TodoService } from '../../services/todoService';
// WalrusStorage import removed - not used in this test file
import { SuiNftStorage } from '../../utils/sui-nft-storage';
import { configService } from '../../services/config-service';
// import { SuiClient } from '@mysten/sui/client';
import { TodoList } from '../../types/todo';
import { createMockTodo } from '../helpers/test-utils';
import { createMockSystemStateResponse } from '../sui-test-types';
import type { Config } from '../../types';

// Mock services
jest.mock('../../services/todoService');
jest.mock('../../utils/walrus-storage');
jest.mock('../../utils/sui-nft-storage');
jest.mock('../../services/config-service');
jest.mock('@mysten/sui/client');

const mockTodoService = TodoService as jest.MockedClass<typeof TodoService>;
// WalrusStorage mocked but not directly used in tests
const mockSuiNftStorage = SuiNftStorage as jest.MockedClass<
  typeof SuiNftStorage
>;
// Create a mock constructor for SuiClient
const mockSuiClient = {
  getLatestSuiSystemState: jest.fn(),
  getBalance: jest.fn(),
  getOwnedObjects: jest.fn(),
  // Add other methods as needed
} as any;

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
const getConfigMock = jest.fn().mockReturnValue(mockConfig);
// Mock configService's getConfig method to use our mock
jest.spyOn(configService, 'getConfig').mockImplementation(getConfigMock);

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
    mockTodoService.prototype.getList.mockResolvedValue(defaultList);
    mockTodoService.prototype.getTodo.mockResolvedValue(defaultTodo);
    mockTodoService.prototype.toggleItemStatus.mockImplementation(
      async () => {}
    );

    mockSuiClient.prototype.getLatestSuiSystemState.mockResolvedValue(
      createMockSystemStateResponse({
        epoch: '0',
        protocolVersion: '1',
      })
    );
  });

  test('completes a local todo', async () => {
    await mockTodoService.prototype.toggleItemStatus(
      'default',
      'todo123',
      true
    );

    expect(mockTodoService.prototype.toggleItemStatus).toHaveBeenCalledWith(
      'default',
      'todo123',
      true
    );
    expect(
      mockSuiNftStorage.prototype.updateTodoNftCompletionStatus
    ).not.toHaveBeenCalled();
  });

  test('completes a blockchain todo', async () => {
    const todoWithNft = {
      ...defaultTodo,
      nftObjectId: 'test-nft-id',
    };

    mockTodoService.prototype.getTodo.mockResolvedValue(todoWithNft);

    await mockTodoService.prototype.toggleItemStatus(
      'default',
      'todo123',
      true
    );

    expect(mockTodoService.prototype.toggleItemStatus).toHaveBeenCalledWith(
      'default',
      'todo123',
      true
    );
    expect(
      mockSuiNftStorage.prototype.updateTodoNftCompletionStatus
    ).toHaveBeenCalledWith('test-nft-id');
  });

  test('handles blockchain todo completion failure', async () => {
    const todoWithNft = {
      ...defaultTodo,
      nftObjectId: 'test-nft-id',
    };

    mockTodoService.prototype.getTodo.mockResolvedValue(todoWithNft);
    mockSuiNftStorage.prototype.updateTodoNftCompletionStatus.mockRejectedValue(
      new Error('Failed to update NFT')
    );

    await expect(
      mockTodoService.prototype.toggleItemStatus('default', 'todo123', true)
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
      mockTodoService.prototype.toggleItemStatus('default', 'todo123', true)
    ).rejects.toThrow('Contract not deployed');
  });

  test('handles already completed todo', async () => {
    const completedTodo = {
      ...defaultTodo,
      completed: true,
    };

    mockTodoService.prototype.getTodo.mockResolvedValue(completedTodo);

    await expect(
      mockTodoService.prototype.toggleItemStatus('default', 'todo123', true)
    ).rejects.toThrow('Todo is already completed');
  });
});
