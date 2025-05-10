import { Todo } from '../../src/types/todo';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { AIPrivacyLevel, AIActionType } from '../../src/types/adapters/AIVerifierAdapter';

/**
 * Utility functions and data for AI service testing
 */

/**
 * Create sample todos for testing
 */
export const createSampleTodos = (count: number = 3): Todo[] => {
  return Array.from({ length: count }).map((_, index) => ({
    id: `todo-${index + 1}`,
    title: `Sample Todo ${index + 1}`,
    description: `This is a sample todo description for testing purposes ${index + 1}`,
    completed: index === 0,
    priority: index === 0 ? 'high' : (index === 1 ? 'medium' : 'low'),
    tags: [`tag-${index + 1}`, 'test'],
    createdAt: new Date(2023, 0, index + 1).toISOString(),
    updatedAt: new Date(2023, 0, index + 1).toISOString(),
    private: index % 2 === 0,
    storageLocation: index % 2 === 0 ? 'local' : 'blockchain'
  }));
};

/**
 * Sample expected results for different AI operations
 */
export const expectedResults = {
  summarize: 'This is a mock summary of the todos for testing purposes.',
  categorize: {
    'work': ['todo-1'],
    'personal': ['todo-2'],
    'errands': ['todo-3']
  },
  prioritize: {
    'todo-1': 9,
    'todo-2': 6,
    'todo-3': 3
  },
  suggest: [
    'Complete documentation for the project',
    'Schedule a follow-up meeting',
    'Prepare presentation slides'
  ],
  analyze: {
    'themes': ['work', 'planning'],
    'bottlenecks': ['dependency on external teams'],
    'timeEstimates': {
      'todo-1': '1 day',
      'todo-2': '3 days',
      'todo-3': '2 hours'
    },
    'workflow': ['start with todo-3', 'then todo-1', 'finally todo-2']
  }
};

/**
 * Mock API configuration for different providers
 */
export const mockApiConfig = {
  [AIProvider.XAI]: {
    apiKey: 'mock-xai-api-key',
    modelName: 'grok-beta',
    options: { temperature: 0.7 }
  },
  [AIProvider.OPENAI]: {
    apiKey: 'mock-openai-api-key',
    modelName: 'gpt-4',
    options: { temperature: 0.5 }
  },
  [AIProvider.ANTHROPIC]: {
    apiKey: 'mock-anthropic-api-key',
    modelName: 'claude-3',
    options: { temperature: 0.6 }
  }
};

/**
 * Verification helper to validate verification records
 */
export const verificationHelper = {
  validateVerificationRecord: (
    actionType: AIActionType,
    privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY,
    metadata: Record<string, string> = {}
  ) => (record: any) => {
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
  }
};

/**
 * Helper to validate consistent error handling
 */
export const errorHelper = {
  validateError: (error: any, expectedErrorCode: string) => {
    expect(error).toBeDefined();
    expect(error.name).toBe('CLIError');
    expect(error.code).toBe(expectedErrorCode);
  }
};