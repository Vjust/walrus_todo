/**
 * @fileoverview AI Test Factory implementation that provides mock objects and utilities
 * for AI-related testing. This factory follows the test factory pattern to simplify
 * the creation of test fixtures and enables consistent test setup across the test suite.
 */

import { AIService } from '../../src/services/ai/aiService';
import { AIVerificationService } from '../../src/services/ai/AIVerificationService';
import { BlockchainAIVerificationService } from '../../src/services/ai/BlockchainAIVerificationService';
import { AIProvider, AIModelOptions } from '../../src/types/adapters/AIModelAdapter';
import { AIVerifierAdapter, AIPrivacyLevel } from '../../src/types/adapters/AIVerifierAdapter';
import { createMockAIModelAdapter } from '../mocks/AIModelAdapter.mock';
import { createMockAIVerifierAdapter } from '../mocks/AIVerifierAdapter.mock';
import { expectedResults } from './ai-test-utils';
import { Todo } from '../../src/types/todo';

/**
 * Factory class for creating pre-configured AI services and utilities for testing.
 *
 * This factory follows the test factory pattern to simplify test setup by providing:
 * 1. Mock AI services with pre-configured responses
 * 2. Mock verification services with controllable behavior
 * 3. Utility methods for generating test data and validation functions
 *
 * @example
 * // Create a mock AI service for testing
 * const mockAIService = AITestFactory.createMockAIService({
 *   provider: AIProvider.XAI,
 *   modelName: 'custom-model',
 *   withVerification: true
 * });
 *
 * // Use the service in tests
 * const result = await mockAIService.summarize(todos);
 * expect(result).toContain('summary');
 */
export class AITestFactory {
  /**
   * Creates a mock AIService with pre-configured responses for all standard operations.
   *
   * The mock service responds to different operations with realistic mock data,
   * determined by analyzing the prompt text to identify which operation is being executed.
   * This allows tests to focus on behavior rather than response format details.
   *
   * @param options - Configuration options for the mock service
   * @param options.provider - The AI provider to simulate (defaults to XAI)
   * @param options.modelName - The model name to use in responses (defaults to 'mock-model')
   * @param options.withVerification - Whether to include a verification service (defaults to false)
   * @returns A configured AIService instance with mock adapters injected
   *
   * @example
   * // Create a simple mock AI service
   * const basicService = AITestFactory.createMockAIService();
   *
   * // Create a mock service with verification enabled
   * const verifiedService = AITestFactory.createMockAIService({
   *   withVerification: true
   * });
   */
  public static createMockAIService(options: {
    provider?: AIProvider;
    modelName?: string;
    withVerification?: boolean;
  } = {}): AIService {
    const mockAdapter = createMockAIModelAdapter();

    // Configure the mock adapter with standard responses for template-based processing
    mockAdapter.processWithPromptTemplate = jest.fn().mockResolvedValue({
      result: expectedResults.summarize,
      modelName: options.modelName || 'mock-model',
      provider: options.provider || AIProvider.XAI,
      timestamp: Date.now()
    });

    // Configure the structured completion to return different responses based on prompt content
    mockAdapter.completeStructured = jest.fn().mockImplementation(async (params) => {
      const promptStr = typeof params.prompt === 'string'
        ? params.prompt
        : JSON.stringify(params.prompt);

      let result: any;

      // Determine the operation type from prompt contents
      if (promptStr.includes('categorize') || promptStr.toLowerCase().includes('categories')) {
        result = expectedResults.categorize;
      } else if (promptStr.includes('prioritize') || promptStr.toLowerCase().includes('priority')) {
        result = expectedResults.prioritize;
      } else if (promptStr.includes('suggest') || promptStr.toLowerCase().includes('suggestions')) {
        result = expectedResults.suggest;
      } else if (promptStr.includes('analyze') || promptStr.toLowerCase().includes('analysis')) {
        result = expectedResults.analyze;
      } else {
        result = { 'default': 'mock structured result' };
      }

      return {
        result,
        modelName: options.modelName || 'mock-model',
        provider: options.provider || AIProvider.XAI,
        timestamp: Date.now()
      };
    });

    // Create the service with mock API key and configured provider/model
    const aiService = new AIService(
      'mock-api-key',
      options.provider || AIProvider.XAI,
      options.modelName || 'mock-model'
    );

    // Inject the mock adapter by replacing the internal adapter instance
    (aiService as any).modelAdapter = mockAdapter;

    // Optionally add verification service if requested
    if (options.withVerification) {
      const mockVerifierAdapter = createMockAIVerifierAdapter();
      const verificationService = new AIVerificationService(mockVerifierAdapter);
      (aiService as any).verificationService = verificationService;
    }

    return aiService;
  }

  /**
   * Creates a mock AIVerificationService with default pre-configured behavior.
   *
   * The mock verification service simulates successful verification operations
   * by default, allowing tests to focus on behaviors that depend on verification
   * rather than the verification process itself.
   *
   * @returns A configured AIVerificationService instance with mock adapter injected
   *
   * @example
   * const verificationService = AITestFactory.createMockVerificationService();
   * const isValid = await verificationService.verifyOperation(record);
   * expect(isValid).toBe(true); // Default behavior returns true
   */
  public static createMockVerificationService(): AIVerificationService {
    const mockVerifierAdapter = createMockAIVerifierAdapter();
    return new AIVerificationService(mockVerifierAdapter);
  }

  /**
   * Creates a mock BlockchainAIVerificationService with pre-configured dependencies.
   *
   * This service represents the blockchain-based verification system, which requires
   * several complex dependencies. The factory handles mocking all these dependencies
   * to provide a usable service instance for testing.
   *
   * Note: This method expects the dependent modules to be mocked at the Jest module level.
   *
   * @returns A configured BlockchainAIVerificationService with all dependencies mocked
   *
   * @example
   * // In a test file where the dependencies are mocked
   * jest.mock('../../src/services/ai/BlockchainVerifier');
   * jest.mock('../../src/services/ai/AIPermissionManager');
   * jest.mock('../../src/services/ai/SecureCredentialManager');
   *
   * const blockchainVerifier = AITestFactory.createMockBlockchainVerificationService();
   * await blockchainVerifier.verifyCredentials('mock-key');
   */
  public static createMockBlockchainVerificationService(): BlockchainAIVerificationService {
    // These dependencies are expected to be mocked at the module level in tests
    const blockchainVerifier = new (jest.requireMock('../../src/services/ai/BlockchainVerifier').BlockchainVerifier)();
    const permissionManager = (jest.requireMock('../../src/services/ai/AIPermissionManager').getPermissionManager)();
    const credentialManager = new (jest.requireMock('../../src/services/ai/SecureCredentialManager').SecureCredentialManager)();

    return new BlockchainAIVerificationService(
      blockchainVerifier,
      permissionManager,
      credentialManager,
      'mock-provider'
    );
  }

  /**
   * Creates a customizable AIVerifierAdapter mock with configurable failure modes.
   *
   * This method allows tests to simulate various failure scenarios in the verification
   * process, such as creation failures or validation failures, enabling thorough testing
   * of error handling and edge cases.
   *
   * @param options - Configuration options for the mock adapter
   * @param options.verificationCreationSucceeds - Whether verification creation succeeds (defaults to true)
   * @param options.verificationValidationSucceeds - Whether verification validation succeeds (defaults to true)
   * @returns A configured AIVerifierAdapter mock with the specified behaviors
   *
   * @example
   * // Create a verifier that fails validation
   * const failingVerifier = AITestFactory.createCustomVerifierAdapter({
   *   verificationValidationSucceeds: false
   * });
   *
   * // Create a service using this faulty adapter
   * const verificationService = new AIVerificationService(failingVerifier);
   * const isValid = await verificationService.verifyOperation(record);
   * expect(isValid).toBe(false); // Will fail due to our configuration
   */
  public static createCustomVerifierAdapter(options: {
    verificationCreationSucceeds?: boolean;
    verificationValidationSucceeds?: boolean;
  } = {}): AIVerifierAdapter {
    const mockAdapter = createMockAIVerifierAdapter();

    // Override behavior based on options to simulate failures if requested
    if (options.verificationCreationSucceeds === false) {
      mockAdapter.createVerification = jest.fn().mockRejectedValue(
        new Error('Failed to create verification')
      );
    }

    if (options.verificationValidationSucceeds === false) {
      mockAdapter.verifyRecord = jest.fn().mockResolvedValue(false);
    }

    return mockAdapter;
  }

  /**
   * Generates simulated AI responses for different operation types based on the provided parameters.
   *
   * This utility method creates realistic mock data that follows the expected format
   * for each operation type, making it easy to test code that processes AI responses
   * without requiring actual AI calls.
   *
   * @param operationType - The type of AI operation to generate a response for
   *                       ('summarize', 'categorize', 'prioritize', 'suggest', or 'analyze')
   * @param todoCount - The number of todos to simulate in the response (defaults to 3)
   * @returns A mock response object appropriate for the specified operation type
   *
   * @example
   * // Generate a mock categorization response for 5 todos
   * const mockCategories = AITestFactory.generateMockResponses('categorize', 5);
   * // Returns an object with categories (work/personal) and todo IDs distributed between them
   *
   * // Generate mock suggestions
   * const mockSuggestions = AITestFactory.generateMockResponses('suggest');
   * // Returns an array of suggested tasks
   */
  public static generateMockResponses(operationType: string, todoCount: number = 3): any {
    switch (operationType.toLowerCase()) {
      case 'summarize':
        return `This is a mock summary of ${todoCount} todos. The todos appear to be related to work and personal tasks.`;

      case 'categorize':
        return {
          'work': Array.from({ length: Math.floor(todoCount / 2) }).map((_, i) => `todo-${i + 1}`),
          'personal': Array.from({ length: Math.ceil(todoCount / 2) }).map((_, i) => `todo-${Math.floor(todoCount / 2) + i + 1}`)
        };

      case 'prioritize':
        return Array.from({ length: todoCount }).reduce((acc, _, i) => {
          acc[`todo-${i + 1}`] = Math.floor(Math.random() * 10) + 1;
          return acc;
        }, {} as Record<string, number>);

      case 'suggest':
        return [
          'Complete project documentation',
          'Schedule team meeting',
          'Review progress with stakeholders',
          'Update task dependencies',
          'Prepare quarterly report'
        ].slice(0, todoCount);

      case 'analyze':
        return {
          'themes': ['work', 'planning', 'communication'],
          'bottlenecks': ['waiting for approvals', 'resource constraints'],
          'timeEstimates': {
            'total': `${todoCount * 2} days`,
            'critical': `${Math.ceil(todoCount / 2)} days`
          },
          'recommendations': [
            'Focus on high priority items first',
            'Consider delegating routine tasks',
            'Set up regular check-ins'
          ]
        };

      default:
        return 'Mock response';
    }
  }

  /**
   * Creates a test function that validates AI operation results against expected formats.
   *
   * This factory method returns a Jest validator function that knows how to check
   * the format and structure of responses for different operation types, ensuring
   * that processed results match the expected output format.
   *
   * @param operationType - The type of AI operation to create a validator for
   *                       ('summarize', 'categorize', 'prioritize', 'suggest', or 'analyze')
   * @returns A function that validates results for the specified operation type
   *
   * @example
   * // Create a validator for categorization results
   * const validateCategories = AITestFactory.createOperationValidator('categorize');
   *
   * // Use in a test
   * test('categorize should return valid categories', async () => {
   *   const result = await aiService.categorize(todos);
   *   validateCategories(result, todos);
   * });
   */
  public static createOperationValidator(operationType: string): (result: any, todos: Todo[]) => void {
    return (result: any, todos: Todo[]) => {
      expect(result).toBeDefined();

      switch (operationType.toLowerCase()) {
        case 'summarize':
          // Summarize operations should return a non-empty string
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
          break;

        case 'categorize':
          // Categorize operations should return an object with category keys
          // and arrays of todo IDs as values
          expect(typeof result).toBe('object');
          expect(Object.keys(result).length).toBeGreaterThan(0);

          // Each category should have an array of todo IDs
          Object.values(result).forEach(todoIds => {
            expect(Array.isArray(todoIds)).toBe(true);
          });
          break;

        case 'prioritize':
          // Prioritize operations should return an object mapping todo IDs
          // to numeric priority values (1-10)
          expect(typeof result).toBe('object');
          expect(Object.keys(result).length).toBeGreaterThan(0);

          // Each todo ID should have a numeric priority
          Object.entries(result).forEach(([todoId, priority]) => {
            expect(typeof priority).toBe('number');
            expect(priority).toBeGreaterThanOrEqual(1);
            expect(priority).toBeLessThanOrEqual(10);
          });
          break;

        case 'suggest':
          // Suggest operations should return an array of string suggestions
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBeGreaterThan(0);

          // Each suggestion should be a string
          result.forEach(suggestion => {
            expect(typeof suggestion).toBe('string');
            expect(suggestion.length).toBeGreaterThan(0);
          });
          break;

        case 'analyze':
          // Analyze operations should return a structured object with analysis results
          expect(typeof result).toBe('object');
          expect(Object.keys(result).length).toBeGreaterThan(0);
          break;

        default:
          throw new Error(`Unknown operation type: ${operationType}`);
      }
    };
  }
}