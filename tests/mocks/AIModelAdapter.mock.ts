/**
 * Mock implementations for AI Model Adapters
 * Used in test files to simulate AI provider behavior
 */

import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { expectedResults } from '../helpers/ai-test-utils';

/**
 * Creates a mock AI model adapter for testing
 */
export const createMockAIModelAdapter = () => {
  return {
    processWithPromptTemplate: jest.fn().mockResolvedValue({
      result: expectedResults.summarize,
      modelName: 'mock-model',
      provider: AIProvider.XAI,
      timestamp: Date.now()
    }),
    
    completeStructured: jest.fn().mockResolvedValue({
      result: JSON.stringify(expectedResults.categorize),
      modelName: 'mock-model',
      provider: AIProvider.XAI,
      timestamp: Date.now()
    }),
    
    complete: jest.fn().mockResolvedValue({
      result: expectedResults.summarize,
      modelName: 'mock-model',
      provider: AIProvider.XAI,
      timestamp: Date.now()
    }),
    
    getProvider: jest.fn().mockReturnValue(AIProvider.XAI),
    getModelName: jest.fn().mockReturnValue('mock-model'),
    
    // Configuration methods
    updateConfig: jest.fn(),
    validateConfig: jest.fn().mockReturnValue(true)
  };
};