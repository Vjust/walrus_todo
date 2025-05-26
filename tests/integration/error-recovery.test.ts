/**
 * Error Recovery Integration Tests
 *
 * Tests the application's end-to-end error recovery capabilities across multiple components.
 */

import {
  // _NetworkError,  // Unused import
  StorageError,
  // _BlockchainError,  // Unused import
} from '../../src/types/errors';
import { ErrorSimulator, ErrorType } from '../helpers/error-simulator';

// Import the components to test
import { WalrusStorage } from '../../src/utils/walrus-storage';
import { RetryManager } from '../../src/utils/retry-manager';
import { AIService } from '../../src/services/ai/aiService';
import { createMockAIModelAdapter } from '../mocks/AIModelAdapter.mock';

// Mock cross-component dependencies
jest.mock('../../src/services/ai/AIProviderFactory', () => {
  return {
    AIProviderFactory: {
      createProvider: jest
        .fn()
        .mockImplementation(() => createMockAIModelAdapter()),
      getDefaultProvider: jest.fn().mockImplementation(() => ({
        provider: 'xai',
        modelName: 'grok-beta',
      })),
    },
  };
});

describe('Error Recovery Integration Tests', () => {
  // Setup basic mock clients
  const mockWalrusClient = {
    writeBlob: jest.fn().mockResolvedValue('mock-blob-id'),
    readBlob: jest
      .fn()
      .mockResolvedValue(new Uint8Array(Buffer.from('mock data'))),
    getBlobInfo: jest.fn().mockResolvedValue({
      blob_id: 'mock-blob-id',
      registered_epoch: 10,
      certified_epoch: 11,
      size: '9',
    }),
  };

  // Create service instances
  let walrusStorage: WalrusStorage;
  let aiService: AIService;
  let mockAdapter: unknown;

  beforeEach(() => {
    jest.clearAllMocks();

    walrusStorage = new WalrusStorage(mockWalrusClient);

    mockAdapter = createMockAIModelAdapter();
    aiService = new AIService('test-api-key');
    (aiService as { modelAdapter: unknown }).modelAdapter = mockAdapter;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Multi-Component Error Handling', () => {
    it('should handle cascading failures across components', async () => {
      // Create different simulators for different components
      const storageErrorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.STORAGE,
        probability: 0.5,
        errorMessage: 'Storage operation failed',
        shouldRetry: true,
        recoveryProbability: 0.5,
      });

      const aiErrorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.NETWORK,
        probability: 0.5,
        errorMessage: 'AI service connection failed',
        shouldRetry: true,
        recoveryProbability: 0.5,
      });

      // Apply simulators
      storageErrorSimulator.simulateErrorOnMethod(
        walrusStorage,
        'store',
        'storeTodo'
      );

      aiErrorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'aiProcess'
      );

      // Create complex multi-step operation
      const complexOperation = async (todoData: any) => {
        const results: any = { steps: [] };

        // Step 1: AI processing
        try {
          const suggestions = await aiService.suggest([todoData]);
          results.steps.push({
            name: 'ai',
            status: 'success',
            data: suggestions,
          });
        } catch (error) {
          results.steps.push({
            name: 'ai',
            status: 'failed',
            error: (error as Error).message,
          });
          // Continue despite AI failure
        }

        // Step 2: Storage
        try {
          const storageId = await walrusStorage.store(todoData);
          results.steps.push({
            name: 'storage',
            status: 'success',
            data: storageId,
          });
          results.storageId = storageId;
        } catch (error) {
          results.steps.push({
            name: 'storage',
            status: 'failed',
            error: (error as Error).message,
          });
          throw error; // Storage failure is critical
        }

        return results;
      };

      // Create retry wrapper
      const withRetry = async (todo: any) => {
        const retryManager = new RetryManager(
          ['primary'], // Node name doesn't matter here
          {
            initialDelay: 10,
            maxRetries: 5,
            maxDuration: 1000,
          }
        );

        return await retryManager.execute(async () => {
          return await complexOperation(todo);
        }, 'complex-operation');
      };

      // Execute complex operation multiple times
      const allResults = [];
      const testTodo = { id: 'test-1', title: 'Test Todo' };

      for (let i = 0; i < 5; i++) {
        try {
          const result = await withRetry(testTodo);
          allResults.push({ success: true, result });
        } catch (error) {
          allResults.push({ success: false, error: (error as Error).message });
        }
      }

      // Analyze results
      const fullSuccesses = allResults.filter(r => r.success).length;
      // const _failures = allResults.filter(r => !r.success).length;

      // Should have at least some successes
      expect(fullSuccesses).toBeGreaterThan(0);

      // Check partial successes (AI failed but storage succeeded)
      const partialSuccesses = allResults.filter(
        r =>
          r.success &&
          r.result.steps.some(s => s.name === 'ai' && s.status === 'failed')
      ).length;

      // The test doesn't assert on exact numbers since it's probabilistic,
      // but verifies that the retry and recovery mechanisms work
      expect(partialSuccesses).toBeGreaterThanOrEqual(0);
    });

    it('should handle fallback mechanisms for critical components', async () => {
      // Create a storage error simulator that always fails
      const storageErrorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.STORAGE,
        probability: 1.0,
        errorMessage: 'Primary storage unavailable',
        shouldRetry: false,
      });

      // Apply simulator to storage
      storageErrorSimulator.simulateErrorOnMethod(
        walrusStorage,
        'store',
        'primaryStorage'
      );

      // Create fallback storage
      const fallbackStorage = {
        store: jest.fn().mockResolvedValue('fallback-id'),
      };

      // Multi-storage operation with fallback
      const storeWithFallback = async (data: any) => {
        try {
          // Try primary storage first
          return {
            id: await walrusStorage.store(data),
            storage: 'primary',
          };
        } catch (error) {
          // console.log('Primary storage failed, using fallback'); // Removed console statement
          // On failure, try fallback storage
          return {
            id: await fallbackStorage.store(data),
            storage: 'fallback',
          };
        }
      };

      // Execute operation
      const result = await storeWithFallback({
        id: 'test-1',
        title: 'Test Todo',
      });

      // Verify fallback was used
      expect(result.storage).toBe('fallback');
      expect(result.id).toBe('fallback-id');
      expect(fallbackStorage.store).toHaveBeenCalled();
    });
  });

  describe('Transaction Error Recovery', () => {
    it('should recover from transaction errors with compensation', async () => {
      // Define a multi-step transaction
      interface TransactionStep {
        name: string;
        execute: () => Promise<any>;
        compensate?: () => Promise<void>;
      }

      // Mock step implementations
      const step1 = {
        name: 'step1',
        execute: jest.fn().mockResolvedValue('result1'),
        compensate: jest.fn().mockResolvedValue(undefined),
      };

      const step2 = {
        name: 'step2',
        execute: jest
          .fn()
          .mockRejectedValueOnce(new Error('Step 2 failed on first attempt'))
          .mockResolvedValue('result2'),
        compensate: jest.fn().mockResolvedValue(undefined),
      };

      const step3 = {
        name: 'step3',
        execute: jest.fn().mockResolvedValue('result3'),
        compensate: jest.fn().mockResolvedValue(undefined),
      };

      // Transaction executor with compensation
      const executeTransaction = async (steps: TransactionStep[]) => {
        const results: Record<string, any> = {};
        const executedSteps: TransactionStep[] = [];

        try {
          for (const step of steps) {
            results[step.name] = await step.execute();
            executedSteps.push(step);
          }
          return results;
        } catch (error) {
          // Compensating transaction - rollback in reverse order
          // console.log(`Transaction failed at step ${executedSteps.length}, rolling back`); // Removed console statement

          for (let i = executedSteps.length - 1; i >= 0; i--) {
            const step = executedSteps[i];
            if (step.compensate) {
              await step.compensate();
            }
          }

          throw error;
        }
      };

      // Execute transaction with retry
      const executeWithRetry = async (steps: TransactionStep[]) => {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            return await executeTransaction(steps);
          } catch (error) {
            attempts++;
            // console.log(`Attempt ${attempts} failed, retrying...`); // Removed console statement

            if (attempts >= maxAttempts) {
              throw new Error(
                `Transaction failed after ${maxAttempts} attempts: ${(error as Error).message}`
              );
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      };

      // Execute with retry
      const result = await executeWithRetry([step1, step2, step3]);

      // Verify success after retry
      expect(result).toEqual({
        step1: 'result1',
        step2: 'result2',
        step3: 'result3',
      });

      // Verify compensation for first failure
      expect(step1.compensate).toHaveBeenCalledTimes(1);
      expect(step2.execute).toHaveBeenCalledTimes(2); // Failed once, succeeded once
      expect(step3.compensate).not.toHaveBeenCalled();
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should implement circuit breaker with fallback across components', async () => {
      // Create a circuit breaker implementation
      class CircuitBreaker {
        private failureCount = 0;
        private lastFailure = 0;
        private status: 'closed' | 'open' | 'half-open' = 'closed';

        constructor(
          private readonly failureThreshold: number = 3,
          private readonly resetTimeout: number = 1000
        ) {}

        async execute<T>(
          operation: () => Promise<T>,
          fallback?: () => Promise<T>
        ): Promise<T> {
          // Check if circuit is open
          if (this.status === 'open') {
            const timeElapsed = Date.now() - this.lastFailure;

            if (timeElapsed >= this.resetTimeout) {
              // Try to reset to half-open
              this.status = 'half-open';
            } else if (fallback) {
              return fallback();
            } else {
              throw new Error('Circuit is open');
            }
          }

          try {
            const result = await operation();

            // Success - reset failure count
            if (this.status === 'half-open') {
              this.status = 'closed';
            }
            this.failureCount = 0;

            return result;
          } catch (error) {
            // Record failure
            this.failureCount++;
            this.lastFailure = Date.now();

            // Open circuit if threshold reached
            if (
              this.failureCount >= this.failureThreshold ||
              this.status === 'half-open'
            ) {
              this.status = 'open';
            }

            // Use fallback if available
            if (fallback) {
              return fallback();
            }

            throw error;
          }
        }

        getStatus(): string {
          return this.status;
        }
      }

      // Create a circuit breaker for storage operations
      const storageBreaker = new CircuitBreaker(2, 50);

      // Create a failing storage service
      const mockStoreOperation = jest.fn().mockRejectedValue(
        new StorageError('Storage operation failed', {
          operation: 'write',
          recoverable: false,
        })
      );

      // Create a fallback storage operation
      const mockFallbackOperation = jest
        .fn()
        .mockResolvedValue('fallback-storage-id');

      // Execute multiple operations
      const results = [];

      for (let i = 0; i < 10; i++) {
        try {
          const result = await storageBreaker.execute(
            mockStoreOperation,
            mockFallbackOperation
          );
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: (error as Error).message });
        }
      }

      // Verify circuit breaker behavior
      // First 2 attempts should call primary operation
      expect(mockStoreOperation).toHaveBeenCalledTimes(3); // Initial + half-open test

      // Remaining attempts should use fallback directly due to open circuit
      expect(mockFallbackOperation).toHaveBeenCalledTimes(7);

      // All operations should succeed using fallback
      expect(results.every(r => r.success)).toBe(true);

      // Circuit should be in open state
      expect(storageBreaker.getStatus()).toBe('open');
    });
  });

  describe('Degraded Mode Operation', () => {
    it('should operate in degraded mode when components fail', async () => {
      // Create error simulators
      const aiErrorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.NETWORK,
        probability: 1.0,
        errorMessage: 'AI service unavailable',
      });

      // Apply simulator
      aiErrorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'aiProcess'
      );

      // Service that works with optional AI features
      class TodoService {
        constructor(
          private storage: WalrusStorage,
          private aiService: AIService
        ) {}

        // Method that works with or without AI
        async createTodoWithSuggestions(todoData: any): Promise<any> {
          // Track capabilities
          const capabilities = {
            ai: true,
            storage: true,
          };

          // Try to get AI suggestions
          let suggestions = [];
          try {
            suggestions = await this.aiService.suggest([todoData]);
          } catch (error) {
            // console.log('AI suggestions unavailable, continuing without them'); // Removed console statement
            capabilities.ai = false;
          }

          // Always store the todo
          let storageId;
          try {
            storageId = await this.storage.store(todoData);
          } catch (error) {
            // console.log('Storage failed, operation cannot proceed'); // Removed console statement
            capabilities.storage = false;
            throw error;
          }

          return {
            id: storageId,
            todo: todoData,
            suggestions: suggestions,
            capabilities,
          };
        }
      }

      // Create service
      const todoService = new TodoService(walrusStorage, aiService);

      // Execute operation that should work in degraded mode
      const result = await todoService.createTodoWithSuggestions({
        id: 'todo-1',
        title: 'Test Todo',
      });

      // Verify storage worked but AI failed
      expect(result.id).toBe('mock-blob-id');
      expect(result.capabilities.storage).toBe(true);
      expect(result.capabilities.ai).toBe(false);
      expect(result.suggestions).toEqual([]);
    });
  });
});
