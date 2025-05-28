/**
 * @fileoverview AI Test Factory implementation that provides mock objects and utilities
 * for AI-related testing. This factory follows the test factory pattern to simplify
 * the creation of test fixtures and enables consistent test setup across the test suite.
 */

import { AIService } from '../../apps/cli/src/services/ai/aiService';
import { AIVerificationService } from '../../apps/cli/src/services/ai/AIVerificationService';
import { BlockchainAIVerificationService } from '../../apps/cli/src/services/ai/BlockchainAIVerificationService';
import {
  AIProvider,
} from '../../apps/cli/src/types/adapters/AIModelAdapter';
import {
  AIVerifierAdapter,
} from '../../apps/cli/src/types/adapters/AIVerifierAdapter';
// Create mock AI adapters inline
const createMockAIModelAdapter = () => ({
  processWithPromptTemplate: jest.fn().mockResolvedValue({
    result: expectedResults.summarize,
    modelName: 'mock-model',
    provider: AIProvider.XAI,
    timestamp: Date.now(),
  }),
  completeStructured: jest.fn().mockResolvedValue({
    result: JSON.stringify(expectedResults.categorize),
    modelName: 'mock-model',
    provider: AIProvider.XAI,
    timestamp: Date.now(),
  }),
  complete: jest.fn().mockResolvedValue({
    result: expectedResults.summarize,
    modelName: 'mock-model',
    provider: AIProvider.XAI,
    timestamp: Date.now(),
  }),
  getProvider: jest.fn().mockReturnValue(AIProvider.XAI),
  getModelName: jest.fn().mockReturnValue('mock-model'),
  updateConfig: jest.fn(),
  validateConfig: jest.fn().mockReturnValue(true),
});

const createMockAIVerifierAdapter = (): AIVerifierAdapter => ({
  verifyAIOperation: jest.fn().mockResolvedValue(true),
  getVerificationStatus: jest.fn().mockResolvedValue('verified'),
  createVerificationProof: jest.fn().mockResolvedValue('proof-data'),
});
import { expectedResults } from './ai-test-utils';
import { Todo } from '../../apps/cli/src/types/todo';

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
  public static createMockAIService(
    options: {
      provider?: AIProvider;
      modelName?: string;
      withVerification?: boolean;
    } = {}
  ): AIService {
    const mockAdapter = createMockAIModelAdapter();

    // Configure the mock adapter with standard responses for template-based processing
    mockAdapter.processWithPromptTemplate = jest.fn().mockResolvedValue({
      result: expectedResults.summarize,
      modelName: options.modelName || 'mock-model',
      provider: options.provider || AIProvider.XAI,
      timestamp: Date.now(),
    });

    // Configure the structured completion to return different responses based on prompt content
    mockAdapter.completeStructured = jest
      .fn()
      .mockImplementation(async params => {
        const promptStr =
          typeof params.prompt === 'string'
            ? params.prompt
            : JSON.stringify(params.prompt);

        let result: unknown;

        // Determine the operation type from prompt contents
        if (
          promptStr.includes('categorize') ||
          promptStr.toLowerCase().includes('categories')
        ) {
          result = expectedResults.categorize;
        } else if (
          promptStr.includes('prioritize') ||
          promptStr.toLowerCase().includes('priority')
        ) {
          result = expectedResults.prioritize;
        } else if (
          promptStr.includes('suggest') ||
          promptStr.toLowerCase().includes('suggestions')
        ) {
          result = expectedResults.suggest;
        } else if (
          promptStr.includes('analyze') ||
          promptStr.toLowerCase().includes('analysis')
        ) {
          result = expectedResults.analyze;
        } else {
          result = { default: 'mock structured result' };
        }

        return {
          result,
          modelName: options.modelName || 'mock-model',
          provider: options.provider || AIProvider.XAI,
          timestamp: Date.now(),
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
      const verificationService = new AIVerificationService(
        mockVerifierAdapter
      );
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
   * jest.mock('../../apps/cli/src/services/ai/BlockchainVerifier');
   * jest.mock('../../apps/cli/src/services/ai/AIPermissionManager');
   * jest.mock('../../apps/cli/src/services/ai/SecureCredentialManager');
   *
   * const blockchainVerifier = AITestFactory.createMockBlockchainVerificationService();
   * await blockchainVerifier.verifyCredentials('mock-key');
   */
  public static createMockBlockchainVerificationService(): BlockchainAIVerificationService {
    // These dependencies are expected to be mocked at the module level in tests
    const blockchainVerifier = new (jest.requireMock(
      '../../apps/cli/src/services/ai/BlockchainVerifier'
    ).BlockchainVerifier)();
    const permissionManager = jest
      .requireMock('../../apps/cli/src/services/ai/AIPermissionManager')
      .getPermissionManager();
    const credentialManager = new (jest.requireMock(
      '../../apps/cli/src/services/ai/SecureCredentialManager'
    ).SecureCredentialManager)();

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
  public static createCustomVerifierAdapter(
    options: {
      verificationCreationSucceeds?: boolean;
      verificationValidationSucceeds?: boolean;
    } = {}
  ): AIVerifierAdapter {
    const mockAdapter = createMockAIVerifierAdapter();

    // Override behavior based on options to simulate failures if requested
    if (options.verificationCreationSucceeds === false) {
      mockAdapter.createVerification = jest
        .fn()
        .mockRejectedValue(new Error('Failed to create verification'));
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
  public static generateMockResponses(
    operationType: string,
    todoCount: number = 3
  ): unknown {
    switch (operationType.toLowerCase()) {
      case 'summarize':
        return `This is a mock summary of ${todoCount} todos. The todos appear to be related to work and personal tasks.`;

      case 'categorize':
        return {
          work: Array.from({ length: Math.floor(todoCount / 2) }).map(
            (_, i) => `todo-${i + 1}`
          ),
          personal: Array.from({ length: Math.ceil(todoCount / 2) }).map(
            (_, i) => `todo-${Math.floor(todoCount / 2) + i + 1}`
          ),
        };

      case 'prioritize':
        return Array.from({ length: todoCount }).reduce(
          (acc, _, i) => {
            acc[`todo-${i + 1}`] = Math.floor(Math.random() * 10) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

      case 'suggest':
        return [
          'Complete project documentation',
          'Schedule team meeting',
          'Review progress with stakeholders',
          'Update task dependencies',
          'Prepare quarterly report',
        ].slice(0, todoCount);

      case 'analyze':
        return {
          themes: ['work', 'planning', 'communication'],
          bottlenecks: ['waiting for approvals', 'resource constraints'],
          timeEstimates: {
            total: `${todoCount * 2} days`,
            critical: `${Math.ceil(todoCount / 2)} days`,
          },
          recommendations: [
            'Focus on high priority items first',
            'Consider delegating routine tasks',
            'Set up regular check-ins',
          ],
        };

      default:
        return 'Mock response';
    }
  }

  /**
   * Creates a validator for different AI operation types.
   *
   * This factory method returns a validator object that can check
   * the format and structure of responses for different operation types.
   * The validator returns validation results that can be used in test assertions.
   *
   * @param operationType - The type of AI operation to create a validator for
   *                       ('summarize', 'categorize', 'prioritize', 'suggest', or 'analyze')
   * @returns A validator object with validate() and getExpectedType() methods
   *
   * @example
   * // Create a validator for categorization results
   * const validator = AITestFactory.createOperationValidator('categorize');
   *
   * // Use in a test
   * test('categorize should return valid categories', async () => {
   *   const result = await aiService.categorize(todos);
   *   const validation = validator.validate(result, todos);
   *   expect(validation.isValid).toBe(true);
   *   expect(validation.errors).toEqual([]);
   * });
   */
  public static createOperationValidator(
    operationType: string
  ): {
    validate: (result: unknown, todos: Todo[]) => { isValid: boolean; errors: string[] };
    getExpectedType: () => string;
  } {
    const getValidationResult = (result: unknown, _todos: Todo[]): { isValid: boolean; errors: string[] } => {
      const errors: string[] = [];
      
      if (result === undefined || result === null) {
        errors.push('Result is undefined or null');
        return { isValid: false, errors };
      }

      switch (operationType.toLowerCase()) {
        case 'summarize':
          // Summarize operations should return a non-empty string
          if (typeof result !== 'string') {
            errors.push(`Expected string, got ${typeof result}`);
          } else if (result.length === 0) {
            errors.push('Summary string is empty');
          }
          break;

        case 'categorize':
          // Categorize operations should return an object with category keys
          // and arrays of todo IDs as values
          if (typeof result !== 'object' || result === null) {
            errors.push(`Expected object, got ${typeof result}`);
          } else if (Object.keys(result).length === 0) {
            errors.push('Categories object is empty');
          } else {
            // Each category should have an array of todo IDs
            Object.entries(result).forEach(([category, todoIds]) => {
              if (!Array.isArray(todoIds)) {
                errors.push(`Category "${category}" does not contain an array`);
              }
            });
          }
          break;

        case 'prioritize':
          // Prioritize operations should return an object mapping todo IDs
          // to numeric priority values (1-10)
          if (typeof result !== 'object' || result === null) {
            errors.push(`Expected object, got ${typeof result}`);
          } else if (Object.keys(result).length === 0) {
            errors.push('Priorities object is empty');
          } else {
            // Each todo ID should have a numeric priority
            Object.entries(result).forEach(([todoId, priority]) => {
              if (typeof priority !== 'number') {
                errors.push(`Priority for todo "${todoId}" is not a number`);
              } else if (priority < 1 || priority > 10) {
                errors.push(`Priority for todo "${todoId}" is ${priority}, outside range 1-10`);
              }
            });
          }
          break;

        case 'suggest':
          // Suggest operations should return an array of string suggestions
          if (!Array.isArray(result)) {
            errors.push(`Expected array, got ${typeof result}`);
          } else if (result.length === 0) {
            errors.push('Suggestions array is empty');
          } else {
            // Each suggestion should be a string
            result.forEach((suggestion, index) => {
              if (typeof suggestion !== 'string') {
                errors.push(`Suggestion at index ${index} is not a string`);
              } else if (suggestion.length === 0) {
                errors.push(`Suggestion at index ${index} is empty`);
              }
            });
          }
          break;

        case 'analyze':
          // Analyze operations should return a structured object with analysis results
          if (typeof result !== 'object' || result === null) {
            errors.push(`Expected object, got ${typeof result}`);
          } else if (Object.keys(result).length === 0) {
            errors.push('Analysis object is empty');
          }
          break;

        default:
          throw new Error(`Unknown operation type: ${operationType}`);
      }
      
      return { isValid: errors.length === 0, errors };
    };
    
    const getExpectedType = (): string => {
      switch (operationType.toLowerCase()) {
        case 'summarize':
          return 'string';
        case 'categorize':
        case 'prioritize':
        case 'analyze':
          return 'object';
        case 'suggest':
          return 'array';
        default:
          return 'unknown';
      }
    };
    
    return {
      validate: getValidationResult,
      getExpectedType
    };
  }
}
