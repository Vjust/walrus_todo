import { Todo } from '../../apps/cli/src/types/todo';
import { AIProvider } from '../../apps/cli/src/types/adapters/AIModelAdapter';
import {
  AIPrivacyLevel,
  AIActionType,
} from '../../apps/cli/src/types/adapters/AIVerifierAdapter';

/**
 * @module AITestUtils
 * @description
 * Utility functions and data for AI service testing. This module provides helpers for mocking
 * AI service responses, creating test data, and validating AI-related verification records
 * and error handling.
 *
 * The utilities in this module are specifically designed to support testing of:
 * - AI operation results (summarize, categorize, prioritize, etc.)
 * - AI provider configurations
 * - Verification records for AI operations
 * - Error handling in AI services
 */

/**
 * Creates an array of sample todos for testing AI operations
 *
 * @param {number} count - The number of sample todos to generate (default: 3)
 * @returns {Todo[]} An array of sample todos with varying properties
 *
 * @example
 * // Create 5 sample todos
 * const todos = createSampleTodos(5);
 *
 * @description
 * The generated todos will have the following characteristics:
 * - Sequential IDs (todo-1, todo-2, etc.)
 * - First todo is completed, others are incomplete
 * - Varied priorities (first: high, second: medium, others: low)
 * - Each has tags including a sequential tag and 'test'
 * - Sequential creation dates starting from January 2023
 * - Alternating privacy setting (even-indexed todos are private)
 * - Alternating storage location (even-indexed use local, odd-indexed use blockchain)
 */
export const createSampleTodos = (count: number = 3): Todo[] => {
  return Array.from({ length: count }).map((_, index) => ({
    id: `todo-${index + 1}`,
    title: `Sample Todo ${index + 1}`,
    description: `This is a sample todo description for testing purposes ${index + 1}`,
    completed: index === 0,
    priority: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
    tags: [`tag-${index + 1}`, 'test'],
    createdAt: new Date(2023, 0, index + 1).toISOString(),
    updatedAt: new Date(2023, 0, index + 1).toISOString(),
    private: index % 2 === 0,
    storageLocation: index % 2 === 0 ? 'local' : 'blockchain',
  }));
};

/**
 * @typedef {Object} ExpectedResults
 * @property {string} summarize - Expected result for the summarize operation
 * @property {Object.<string, string[]>} categorize - Expected category-to-todoIds mapping
 * @property {Object.<string, number>} prioritize - Expected todoId-to-score mapping
 * @property {string[]} suggest - Expected list of todo suggestions
 * @property {Object} analyze - Expected analysis results with themes, bottlenecks, etc.
 *
 * @description
 * Sample expected results for different AI operations to use in tests.
 * Each property represents the expected output of a specific AI operation:
 * - summarize: A text summary of todos
 * - categorize: Maps category names to arrays of todo IDs
 * - prioritize: Maps todo IDs to numerical priority scores
 * - suggest: An array of suggested new todos
 * - analyze: Complex object with themes, bottlenecks, time estimates, and workflow suggestions
 */
export const expectedResults = {
  summarize: 'This is a mock summary of the todos for testing purposes.',
  categorize: {
    work: ['todo-1'],
    personal: ['todo-2'],
    errands: ['todo-3'],
  },
  prioritize: {
    'todo-1': 9,
    'todo-2': 6,
    'todo-3': 3,
  },
  suggest: [
    'Complete documentation for the project',
    'Schedule a follow-up meeting',
    'Prepare presentation slides',
  ],
  analyze: {
    themes: ['work', 'planning'],
    bottlenecks: ['dependency on external teams'],
    timeEstimates: {
      'todo-1': '1 day',
      'todo-2': '3 days',
      'todo-3': '2 hours',
    },
    workflow: ['start with todo-3', 'then todo-1', 'finally todo-2'],
  },
};

/**
 * @typedef {Object} ApiConfig
 * @property {string} apiKey - Mock API key for the provider
 * @property {string} modelName - Model name to use with the provider
 * @property {Object} options - Additional configuration options
 *
 * @description
 * Mock API configuration for different AI providers.
 * Includes configuration for XAI (Grok), OpenAI (GPT), and Anthropic (Claude).
 * Each configuration contains:
 * - apiKey: A mock API key for authentication
 * - modelName: The name of the model to use
 * - options: Additional provider-specific configuration options
 *
 * @example
 * // Access the mock configuration for OpenAI
 * const openaiConfig = mockApiConfig[AIProvider.OPENAI];
 */
export const mockApiConfig = {
  [AIProvider.XAI]: {
    apiKey: 'mock-xai-api-key',
    modelName: 'grok-beta',
    options: { temperature: 0.7 },
  },
  [AIProvider.OPENAI]: {
    apiKey: 'mock-openai-api-key',
    modelName: 'gpt-4',
    options: { temperature: 0.5 },
  },
  [AIProvider.ANTHROPIC]: {
    apiKey: 'mock-anthropic-api-key',
    modelName: 'claude-3',
    options: { temperature: 0.6 },
  },
};

/**
 * @namespace verificationHelper
 * @description
 * Helper utilities for validating AI operation verification records.
 * These helpers ensure that verification records contain the expected fields
 * and values for audit and compliance purposes.
 */
export const verificationHelper = {
  /**
   * Creates a validator function that checks if a verification record
   * contains all required fields and matches expected values
   *
   * @param {AIActionType} actionType - The type of AI action being verified
   * @param {AIPrivacyLevel} privacyLevel - The privacy level of the verification (default: HASH_ONLY)
   * @param {Record<string, string>} metadata - Additional metadata fields to validate
   * @returns {Function} A function that validates a verification record
   *
   * @example
   * // Create a validator for a summarize operation with metadata
   * const validateSummarize = verificationHelper.validateVerificationRecord(
   *   AIActionType.SUMMARIZE,
   *   AIPrivacyLevel.HASH_ONLY,
   *   { userId: '123', source: 'cli' }
   * );
   *
   * // Use the validator in a test
   * test('should generate valid verification record', () => {
   *   const record = aiService.summarize(todos);
   *   validateSummarize(record.verification);
   * });
   */
  validateVerificationRecord:
    (
      actionType: AIActionType,
      privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY,
      metadata: Record<string, string> = {}
    ) =>
    (record: any) => {
      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
      expect(record.actionType).toBe(actionType);
      expect(record.privacyLevel).toBe(privacyLevel);
      expect(record.timestamp).toBeDefined();
      expect(record.signature).toBeDefined();
      expect(record.requestHash).toBeDefined();
      expect(record.responseHash).toBeDefined();

      // Check metadata keys are present
      Object.keys(metadata).forEach(key => {
        expect(record.metadata[key]).toBeDefined();
      });
    },
};

/**
 * @namespace errorHelper
 * @description
 * Helper utilities for validating error handling in AI services.
 * These helpers ensure that errors thrown by AI services are properly
 * structured and contain the expected information.
 */
export const errorHelper = {
  /**
   * Validates that an error object has the expected structure and error code
   *
   * @param {any} error - The error object to validate
   * @param {string} expectedErrorCode - The expected error code
   *
   * @example
   * test('should throw correct error on API failure', async () => {
   *   try {
   *     await aiService.summarize(todos);
   *     fail('Expected an error to be thrown');
   *   } catch (_error) {
   *     errorHelper.validateError(error, 'AI_API_ERROR');
   *   }
   * });
   *
   * @description
   * Checks that the error:
   * - Is defined
   * - Has name 'CLIError'
   * - Has the expected error code
   */
  validateError: (error: any, expectedErrorCode: string) => {
    expect(error).toBeDefined();
    expect(error.name).toBe('CLIError');
    expect(error.code).toBe(expectedErrorCode);
  },
};
