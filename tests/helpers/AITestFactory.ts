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
 * Factory class to create pre-configured AI services for testing
 */
export class AITestFactory {
  /**
   * Create a mock AIService with pre-configured responses
   */
  public static createMockAIService(options: {
    provider?: AIProvider;
    modelName?: string;
    withVerification?: boolean;
  } = {}) {
    const mockAdapter = createMockAIModelAdapter();

    // Configure the mock adapter with standard responses
    mockAdapter.processWithPromptTemplate = jest.fn().mockResolvedValue({
      result: expectedResults.summarize,
      modelName: options.modelName || 'mock-model',
      provider: options.provider || AIProvider.XAI,
      timestamp: Date.now()
    });

    mockAdapter.completeStructured = jest.fn().mockImplementation(async (params) => {
      const promptStr = typeof params.prompt === 'string' 
        ? params.prompt 
        : JSON.stringify(params.prompt);
      
      let result: any;
      
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

    // Create the service
    const aiService = new AIService(
      'mock-api-key',
      options.provider || AIProvider.XAI,
      options.modelName || 'mock-model'
    );
    
    // Replace the adapter with our mock
    (aiService as any).modelAdapter = mockAdapter;
    
    // Add verification service if requested
    if (options.withVerification) {
      const mockVerifierAdapter = createMockAIVerifierAdapter();
      const verificationService = new AIVerificationService(mockVerifierAdapter);
      (aiService as any).verificationService = verificationService;
    }
    
    return aiService;
  }
  
  /**
   * Create a mock AIVerificationService with pre-configured behavior
   */
  public static createMockVerificationService(): AIVerificationService {
    const mockVerifierAdapter = createMockAIVerifierAdapter();
    return new AIVerificationService(mockVerifierAdapter);
  }
  
  /**
   * Create a mock BlockchainAIVerificationService with pre-configured behavior
   */
  public static createMockBlockchainVerificationService(): BlockchainAIVerificationService {
    // These dependencies are mocked at the module level in tests
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
   * Create a customizable AIVerifierAdapter mock
   */
  public static createCustomVerifierAdapter(options: {
    verificationCreationSucceeds?: boolean;
    verificationValidationSucceeds?: boolean;
  } = {}) {
    const mockAdapter = createMockAIVerifierAdapter();
    
    // Override behavior based on options
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
   * Generate simulated AI responses for testing
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
   * Create a test function to validate AI operation results
   */
  public static createOperationValidator(operationType: string) {
    return (result: any, todos: Todo[]) => {
      expect(result).toBeDefined();
      
      switch (operationType.toLowerCase()) {
        case 'summarize':
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
          break;
          
        case 'categorize':
          expect(typeof result).toBe('object');
          expect(Object.keys(result).length).toBeGreaterThan(0);
          
          // Each category should have an array of todo IDs
          Object.values(result).forEach(todoIds => {
            expect(Array.isArray(todoIds)).toBe(true);
          });
          break;
          
        case 'prioritize':
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
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBeGreaterThan(0);
          
          // Each suggestion should be a string
          result.forEach(suggestion => {
            expect(typeof suggestion).toBe('string');
            expect(suggestion.length).toBeGreaterThan(0);
          });
          break;
          
        case 'analyze':
          expect(typeof result).toBe('object');
          expect(Object.keys(result).length).toBeGreaterThan(0);
          break;
          
        default:
          throw new Error(`Unknown operation type: ${operationType}`);
      }
    };
  }
}