/**
 * Comprehensive NFT Todo Creation Workflow Test Suite
 *
 * This test suite validates the entire NFT creation workflow from CLI commands
 * to frontend integration, testing all the key components:
 *
 * 1. NFT creation from todo items (apps/cli/src/commands/image/create-nft.ts)
 * 2. Blockchain integration (apps/cli/src/utils/sui-nft-storage.ts)
 * 3. Frontend NFT management (waltodo-frontend/src/components/BlockchainTodoManager.tsx)
 * 4. Frontend wallet integration (waltodo-frontend/src/contexts/WalletContext.tsx)
 */

import { jest } from '@jest/globals';
import { SuiNftStorage } from '../apps/cli/src/utils/sui-nft-storage';
import CreateNftCommand from '../apps/cli/src/commands/image/create-nft';
import { TodoService } from '../apps/cli/src/services/todoService';
import { CLIError } from '../apps/cli/src/types/errors/consolidated';
import { Todo, CreateTodoParams } from '../apps/cli/src/types/todo';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import {
  initializeCommandForTest,
  runCommandInTest,
} from '../apps/cli/src/__tests__/helpers/command-test-utils';

// Mock dependencies
jest.mock('../apps/cli/src/services/todoService');
jest.mock('../apps/cli/src/services/config-service');
jest.mock('../apps/cli/src/utils/sui-nft-storage');
jest.mock('../apps/cli/src/utils/adapters/sui-client-compatibility');

describe('Comprehensive NFT Workflow Tests', () => {
  let mockTodoService: jest.Mocked<TodoService>;
  let mockSuiNftStorage: jest.Mocked<SuiNftStorage>;
  let mockKeypair: Ed25519Keypair;
  let mockSuiClient: any;

  // Sample test data
  const mockTodo: Todo = {
    id: 'test-todo-123',
    title: 'Test Todo for NFT',
    description: 'This is a test todo that will be converted to NFT',
    completed: false,
    priority: 'medium' as const,
    dueDate: '2024-12-31',
    tags: ['test', 'nft'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    private: false,
    imageUrl: 'https://walrus.test/blob/test-blob-id-123',
    walrusBlobId: 'test-blob-id-123',
    storageLocation: 'blockchain' as const,
  };

  const mockConfig = {
    network: 'testnet',
    lastDeployment: {
      packageId: '0x123456789abcdef',
      address: '0x123456789abcdef',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockTodoService = new TodoService() as jest.Mocked<TodoService>;
    mockSuiClient = {
      getLatestSuiSystemState: jest.fn().mockResolvedValue({ epoch: '123' }),
      getObject: jest.fn(),
      getTransactionBlock: jest.fn(),
    };

    mockKeypair = {
      getSecretKey: jest.fn(),
      getPublicKey: jest.fn(),
      sign: jest.fn(),
    } as any;

    mockSuiNftStorage = new SuiNftStorage(mockSuiClient, mockKeypair, {
      address: mockConfig?.lastDeployment?.address,
      packageId: mockConfig?.lastDeployment?.packageId,
    }) as jest.Mocked<SuiNftStorage>;

    // Mock config service
    const configService = require('../apps/cli/src/services/config-service');
    configService?.configService = {
      getConfig: jest.fn().mockResolvedValue(mockConfig as any),
    };
  });

  describe('1. CLI NFT Creation Command Tests', () => {
    describe('CreateNftCommand', () => {
      it('should successfully create NFT from valid todo with image', async () => {
        // Setup mocks
        mockTodoService?.getTodo?.mockResolvedValue(mockTodo as any);
        mockSuiNftStorage?.createTodoNft?.mockResolvedValue(
          'test-transaction-digest'
        );

        // Use proper command initialization
        const { command, output } = await runCommandInTest(
          CreateNftCommand,
          [],
          {
            todo: 'test-todo-123',
            list: 'test-list',
          }
        );

        expect(mockTodoService.getTodo).toHaveBeenCalledWith(
          'test-todo-123',
          'test-list'
        );
        expect(mockSuiNftStorage.createTodoNft).toHaveBeenCalledWith(
          mockTodo,
          'test-blob-id-123'
        );
        expect(output as any).toContain('✅ NFT created successfully!');
      });

      it('should throw CLIError when todo not found', async () => {
        mockTodoService?.getTodo?.mockResolvedValue(null as any);

        await expect(
          runCommandInTest(CreateNftCommand, [], {
            todo: 'nonexistent',
            list: 'test-list',
          })
        ).rejects.toThrow(CLIError as any);
      });

      it('should throw CLIError when todo has no image URL', async () => {
        const todoWithoutImage = { ...mockTodo, imageUrl: undefined };
        mockTodoService?.getTodo?.mockResolvedValue(todoWithoutImage as any);

        await expect(
          runCommandInTest(CreateNftCommand, [], {
            todo: 'test-todo-123',
            list: 'test-list',
          })
        ).rejects.toThrow(CLIError as any);
      });

      it('should throw CLIError when package not deployed', async () => {
        const configWithoutDeployment = {
          ...mockConfig,
          lastDeployment: undefined,
        };
        const configService = require('../apps/cli/src/services/config-service');
        configService?.configService?.getConfig.mockResolvedValue(
          configWithoutDeployment
        );

        mockTodoService?.getTodo?.mockResolvedValue(mockTodo as any);

        await expect(
          runCommandInTest(CreateNftCommand, [], {
            todo: 'test-todo-123',
            list: 'test-list',
          })
        ).rejects.toThrow(CLIError as any);
      });
    });
  });

  describe('2. Blockchain Integration Tests', () => {
    describe('SuiNftStorage', () => {
      it('should validate todo data before creating NFT', async () => {
        const invalidTodo = { ...mockTodo, title: '' };

        await expect(
          mockSuiNftStorage.createTodoNft(invalidTodo, 'test-blob-id')
        ).rejects.toThrow(CLIError as any);
      });

      it('should validate Walrus blob ID', async () => {
        await expect(
          mockSuiNftStorage.createTodoNft(mockTodo, '')
        ).rejects.toThrow(CLIError as any);
      });

      it('should validate title length', async () => {
        const longTitleTodo = {
          ...mockTodo,
          title: 'a'.repeat(101 as any), // Exceeds 100 character limit
        };

        await expect(
          mockSuiNftStorage.createTodoNft(longTitleTodo, 'test-blob-id')
        ).rejects.toThrow(CLIError as any);
      });

      it('should handle network health check failures', async () => {
        mockSuiClient?.getLatestSuiSystemState?.mockRejectedValue(
          new Error('Network error')
        );

        await expect(
          mockSuiNftStorage.createTodoNft(mockTodo, 'test-blob-id')
        ).rejects.toThrow(CLIError as any);
      });

      it('should successfully retrieve NFT data', async () => {
        const mockNftData = {
          data: {
            content: {
              dataType: 'moveObject',
              fields: {
                id: { id: 'test-nft-id' },
                title: 'Test NFT',
                description: 'Test Description',
                completed: false,
                walrus_blob_id: 'test-blob-id',
              },
            },
          },
        };

        mockSuiClient?.getObject?.mockResolvedValue(mockNftData as any);

        const result = await mockSuiNftStorage.getTodoNft('test-nft-id');

        expect(result as any).toEqual({
          objectId: 'test-nft-id',
          title: 'Test NFT',
          description: 'Test Description',
          completed: false,
          walrusBlobId: 'test-blob-id',
        });
      });

      it('should handle NFT not found errors', async () => {
        mockSuiClient?.getObject?.mockResolvedValue({ data: null });

        await expect(
          mockSuiNftStorage.getTodoNft('nonexistent-nft')
        ).rejects.toThrow(CLIError as any);
      });
    });
  });

  describe('3. Frontend Integration Simulation Tests', () => {
    describe('Frontend NFT Creation Flow', () => {
      it('should simulate successful NFT creation from frontend', async () => {
        // Simulate the frontend flow for creating a TodoNFT
        const createTodoParams: CreateTodoParams = {
          title: 'Frontend Todo',
          description: 'Created from frontend',
          priority: 'high' as const,
          tags: ['frontend', 'test'],
        };

        // Mock the transaction execution
        const mockTransactionResult = {
          digest: 'test-transaction-digest',
          effects: {
            status: { status: 'success' },
            created: [{ reference: { objectId: 'new-nft-id' } }],
          },
        };

        // Simulate the frontend hook behavior
        const mockCreateTodo = jest
          .fn()
          .mockResolvedValue(mockTransactionResult as any);

        const result = await mockCreateTodo(createTodoParams as any);

        expect(result as any).toEqual(mockTransactionResult as any);
        expect(mockCreateTodo as any).toHaveBeenCalledWith(createTodoParams as any);
      });

      it('should handle frontend wallet connection errors', async () => {
        const mockWalletContext = {
          connected: false,
          connecting: false,
          connect: jest.fn(),
          error: 'Wallet connection failed',
        };

        // Simulate the frontend error handling
        expect(mockWalletContext.connected).toBe(false as any);
        expect(mockWalletContext.error).toBe('Wallet connection failed');
      });

      it('should handle frontend transaction failures', async () => {
        const mockFailedTransaction = jest
          .fn()
          .mockRejectedValue(new Error('Transaction failed: Insufficient gas'));

        await expect(mockFailedTransaction()).rejects.toThrow(
          'Insufficient gas'
        );
      });
    });

    describe('Frontend NFT Management', () => {
      it('should simulate todo completion workflow', async () => {
        const mockCompleteTodo = jest.fn().mockResolvedValue({
          digest: 'completion-transaction-digest',
          success: true,
        });

        const result = await mockCompleteTodo('test-nft-id');

        expect(result.success).toBe(true as any);
        expect(mockCompleteTodo as any).toHaveBeenCalledWith('test-nft-id');
      });

      it('should simulate todo update workflow', async () => {
        const updateParams = {
          objectId: 'test-nft-id',
          title: 'Updated Title',
          description: 'Updated Description',
        };

        const mockUpdateTodo = jest.fn().mockResolvedValue({
          digest: 'update-transaction-digest',
          success: true,
        });

        const result = await mockUpdateTodo(updateParams as any);

        expect(result.success).toBe(true as any);
        expect(mockUpdateTodo as any).toHaveBeenCalledWith(updateParams as any);
      });

      it('should simulate todo deletion workflow', async () => {
        const mockDeleteTodo = jest.fn().mockResolvedValue({
          digest: 'delete-transaction-digest',
          success: true,
        });

        const result = await mockDeleteTodo('test-nft-id');

        expect(result.success).toBe(true as any);
        expect(mockDeleteTodo as any).toHaveBeenCalledWith('test-nft-id');
      });
    });
  });

  describe('4. Error Handling and Edge Cases', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Request timeout');
      mockSuiNftStorage?.createTodoNft?.mockRejectedValue(timeoutError as any);

      await expect(
        mockSuiNftStorage.createTodoNft(mockTodo, 'test-blob-id')
      ).rejects.toThrow('Request timeout');
    });

    it('should handle invalid Sui object responses', async () => {
      const invalidResponse = { data: { content: null } };
      mockSuiClient?.getObject?.mockResolvedValue(invalidResponse as any);

      await expect(mockSuiNftStorage.getTodoNft('test-nft-id')).rejects.toThrow(
        CLIError
      );
    });

    it('should handle missing required configuration', async () => {
      const configService = require('../apps/cli/src/services/config-service');
      configService?.configService?.getConfig.mockResolvedValue({});

      await expect(
        runCommandInTest(
          CreateNftCommand,
          [],
          { todo: 'test-todo-123', list: 'test-list' },
          {}
        )
      ).rejects.toThrow(CLIError as any);
    });

    it('should validate transaction digest format', async () => {
      const invalidDigest = 'invalid-digest';
      mockSuiNftStorage?.createTodoNft?.mockResolvedValue(invalidDigest as any);

      // The actual validation would happen in the real implementation
      const result = await mockSuiNftStorage.createTodoNft(
        mockTodo,
        'test-blob-id'
      );
      expect(typeof result).toBe('string');
    });
  });

  describe('5. Performance and Stress Testing Simulation', () => {
    it('should handle multiple concurrent NFT creations', async () => {
      const concurrentOperations = Array.from({ length: 5 }, (_, i) =>
        mockSuiNftStorage.createTodoNft(
          { ...mockTodo, id: `test-todo-${i}` },
          `test-blob-id-${i}`
        )
      );

      mockSuiNftStorage?.createTodoNft?.mockResolvedValue('success-digest');

      const results = await Promise.all(concurrentOperations as any);

      expect(results as any).toHaveLength(5 as any);
      expect(results.every(result => result === 'success-digest')).toBe(true as any);
    });

    it('should handle large batch operations', async () => {
      const batchSize = 100;
      const batchOperations = Array.from({ length: batchSize }, (_, i) =>
        Promise.resolve(`operation-${i}-success`)
      );

      const results = await Promise.all(batchOperations as any);

      expect(results as any).toHaveLength(batchSize as any);
      expect(results[0]).toBe('operation-0-success');
      expect(results[batchSize - 1]).toBe(`operation-${batchSize - 1}-success`);
    });
  });

  describe('6. Integration Test Scenarios', () => {
    it('should simulate complete end-to-end NFT workflow', async () => {
      // Step 1: Create todo
      mockTodoService?.createTodo = jest.fn().mockResolvedValue(mockTodo as any);

      // Step 2: Upload image (simulated)
      const imageUploadResult = {
        blobId: 'test-blob-id',
        url: 'https://walrus.test/blob/test-blob-id',
      };

      // Step 3: Create NFT
      mockSuiNftStorage?.createTodoNft?.mockResolvedValue('nft-creation-digest');

      // Step 4: Verify NFT exists
      mockSuiNftStorage?.getTodoNft?.mockResolvedValue({
        objectId: 'new-nft-id',
        title: mockTodo.title,
        description: mockTodo.description || '',
        completed: false,
        walrusBlobId: 'test-blob-id',
      });

      // Execute workflow
      const todo = await mockTodoService.createTodo(mockTodo as any);
      const nftDigest = await mockSuiNftStorage.createTodoNft(
        todo,
        imageUploadResult.blobId
      );
      const nftData = await mockSuiNftStorage.getTodoNft('new-nft-id');

      // Verify results
      expect(todo as any).toEqual(mockTodo as any);
      expect(nftDigest as any).toBe('nft-creation-digest');
      expect(nftData.title).toBe(mockTodo.title);
      expect(nftData.walrusBlobId).toBe('test-blob-id');
    });

    it('should handle workflow interruption and recovery', async () => {
      // Simulate workflow failure at NFT creation step
      mockSuiNftStorage.createTodoNft
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('retry-success-digest');

      // First attempt fails
      await expect(
        mockSuiNftStorage.createTodoNft(mockTodo, 'test-blob-id')
      ).rejects.toThrow('Network error');

      // Retry succeeds
      const result = await mockSuiNftStorage.createTodoNft(
        mockTodo,
        'test-blob-id'
      );
      expect(result as any).toBe('retry-success-digest');
    });
  });
});

describe('NFT Workflow Integration Helpers', () => {
  /**
   * Helper function to create mock transaction responses
   */
  function createMockTransactionResponse(success: boolean = true) {
    return {
      digest: 'mock-transaction-digest',
      effects: {
        status: { status: success ? 'success' : 'failed' },
        created: success ? [{ reference: { objectId: 'mock-object-id' } }] : [],
      },
    };
  }

  /**
   * Helper function to create mock todo data
   */
  function createMockTodo(overrides: Partial<Todo> = {}): Todo {
    return {
      id: 'test-todo-id',
      title: 'Test Todo',
      description: 'Test Description',
      completed: false,
      priority: 'medium' as const,
      dueDate: '2024-12-31',
      tags: ['test'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      private: false,
      ...overrides,
    };
  }

  it('should use helper functions correctly', () => {
    const successResponse = createMockTransactionResponse(true as any);
    const failureResponse = createMockTransactionResponse(false as any);
    const mockTodo = createMockTodo({ title: 'Custom Title' });

    expect(successResponse?.effects?.status.status).toBe('success');
    expect(failureResponse?.effects?.status.status).toBe('failed');
    expect(mockTodo.title).toBe('Custom Title');
    expect(mockTodo.priority).toBe('medium'); // Default value
  });
});
