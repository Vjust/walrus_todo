import { expect, describe, test, beforeEach } from '@jest/globals';
import { configService } from '../../apps/cli/src/services/config-service';
import { TodoList } from '../../apps/cli/src/types/todo';
import { createMockTodo } from '../helpers/test-utils';
import type { Config } from '../../apps/cli/src/types/config';

// Import proper mock implementations
import {
  createMockTodoService,
  createMockSuiClient,
  createMockSuiNftStorage,
  type MockTodoService,
  type MockSuiClient,
  type MockSuiNftStorage,
} from '../mocks';

// Create mock instances
const mockTodoService = createMockTodoService();
const mockSuiClient = createMockSuiClient();
const mockSuiNftStorage = createMockSuiNftStorage();

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

// Create getter function with proper type
const getConfigMock = jest.fn<() => Promise<MockConfig>>();
getConfigMock.mockResolvedValue(mockConfig);
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
    mockTodoService.getList.mockResolvedValue(defaultList);
    mockTodoService.getTodo.mockResolvedValue(defaultTodo);
    mockTodoService.toggleItemStatus.mockImplementation(async () => {});

    mockSuiClient.getLatestSuiSystemState.mockResolvedValue({
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
      totalStake: '1000000',
    });
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

    mockTodoService.getTodo.mockResolvedValue(todoWithNft);

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

    mockTodoService.getTodo.mockResolvedValue(todoWithNft);
    mockSuiNftStorage.updateTodoNftCompletionStatus.mockRejectedValue(
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

    mockTodoService.getTodo.mockResolvedValue(completedTodo);

    await expect(
      mockTodoService.toggleItemStatus('default', 'todo123', true)
    ).rejects.toThrow('Todo is already completed');
  });
});
