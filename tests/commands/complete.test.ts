import { jest, expect, describe, test, beforeEach } from '@jest/globals';
import { TodoService } from '../../../src/services/todoService';
import { WalrusStorage } from '../../../src/utils/walrus-storage';
import { SuiNftStorage } from '../../../src/utils/sui-nft-storage';
import { configService } from '../../../src/services/config-service';
import { SuiClient } from '@mysten/sui.js/client';
import { CLIError } from '../../../src/types/error';
import { Todo, TodoList } from '../../../src/types/todo';
import { createMockTodo } from '../helpers/test-utils';
import { createMockSystemStateResponse } from '../sui-test-types';
import type { Config } from '../../../src/types/config';

// Mock services
jest.mock('../../../src/services/todoService');
jest.mock('../../../src/utils/walrus-storage');
jest.mock('../../../src/utils/sui-nft-storage');
jest.mock('../../../src/services/config-service');
jest.mock('@mysten/sui.js/client');

const mockTodoService = TodoService as jest.MockedClass<typeof TodoService>;
const mockWalrusStorage = WalrusStorage as jest.MockedClass<typeof WalrusStorage>;
const mockSuiNftStorage = SuiNftStorage as jest.MockedClass<typeof SuiNftStorage>;
const mockSuiClient = SuiClient as jest.MockedClass<typeof SuiClient>;

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
    packageId: 'test-package-id'
  }
};

// Create getter function with proper type
const getConfigMock = jest.fn<() => Promise<MockConfig>>();
getConfigMock.mockResolvedValue(mockConfig);
jest.spyOn(configService, 'getConfig').mockImplementation(getConfigMock);

describe('complete', () => {
  const defaultTodo = createMockTodo({
    id: 'todo123'
  });

  const defaultList: TodoList = {
    id: 'default',
    name: 'default',
    owner: 'default-owner',
    todos: [],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockTodoService.prototype.getList.mockResolvedValue(defaultList);
    mockTodoService.prototype.getTodo.mockResolvedValue(defaultTodo);
    mockTodoService.prototype.toggleItemStatus.mockImplementation(async () => {});

    mockSuiClient.prototype.getLatestSuiSystemState.mockResolvedValue({
      activeValidators: [],
      safeMode: false,
      epoch: '0',
      referenceGasPrice: '1000',
      protocolVersion: '1',
      systemStateVersion: '1',
      maxValidatorCount: '100',
      minValidatorCount: '4',
      validatorCandidatesSize: '0',
      atRiskValidators: [],
      storageFundTotalObjectStorageRebates: '0',
      storageFundNonRefundableBalance: '1000000',
      stakeSubsidyCurrentDistributionAmount: '0',
      totalStake: '1000000'
    });
  });

  test('completes a local todo', async () => {
    await mockTodoService.prototype.toggleItemStatus('default', 'todo123', true);
    
    expect(mockTodoService.prototype.toggleItemStatus).toHaveBeenCalledWith('default', 'todo123', true);
    expect(mockSuiNftStorage.prototype.updateTodoNftCompletionStatus).not.toHaveBeenCalled();
  });

  test('completes a blockchain todo', async () => {
    const todoWithNft = {
      ...defaultTodo,
      nftObjectId: 'test-nft-id'
    };

    mockTodoService.prototype.getTodo.mockResolvedValue(todoWithNft);

    await mockTodoService.prototype.toggleItemStatus('default', 'todo123', true);

    expect(mockTodoService.prototype.toggleItemStatus).toHaveBeenCalledWith('default', 'todo123', true);
    expect(mockSuiNftStorage.prototype.updateTodoNftCompletionStatus).toHaveBeenCalledWith('test-nft-id');
  });

  test('handles blockchain todo completion failure', async () => {
    const todoWithNft = {
      ...defaultTodo,
      nftObjectId: 'test-nft-id'
    };

    mockTodoService.prototype.getTodo.mockResolvedValue(todoWithNft);
    mockSuiNftStorage.prototype.updateTodoNftCompletionStatus.mockRejectedValue(new Error('Failed to update NFT'));

    await expect(mockTodoService.prototype.toggleItemStatus('default', 'todo123', true))
      .rejects.toThrow('Failed to update NFT');
  });

  test('handles network validation errors', async () => {
    getConfigMock.mockResolvedValueOnce({
      network: 'testnet',
      walletAddress: 'mock-address',
      encryptedStorage: false,
      lastDeployment: null
    });

    await expect(mockTodoService.prototype.toggleItemStatus('default', 'todo123', true))
      .rejects.toThrow('Contract not deployed');
  });

  test('handles already completed todo', async () => {
    const completedTodo = {
      ...defaultTodo,
      completed: true
    };

    mockTodoService.prototype.getTodo.mockResolvedValue(completedTodo);

    await expect(mockTodoService.prototype.toggleItemStatus('default', 'todo123', true))
      .rejects.toThrow('Todo is already completed');
  });
});