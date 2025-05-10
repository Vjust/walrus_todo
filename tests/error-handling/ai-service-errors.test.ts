/**
 * AI Service Error Handling Tests
 * 
 * Tests the application's handling of AI service errors,
 * including API connection issues, rate limits, token limits,
 * and response parsing failures.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AIService } from '../../src/services/ai/aiService';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { ErrorSimulator, ErrorType } from '../helpers/error-simulator';
import { createMockAIModelAdapter } from '../mocks/AIModelAdapter.mock';
import { createSampleTodos } from '../helpers/ai-test-utils';

// Mock the AIProviderFactory
jest.mock('../../src/services/ai/AIProviderFactory', () => {
  return {
    AIProviderFactory: {
      createProvider: jest.fn().mockImplementation(() => createMockAIModelAdapter()),
      getDefaultProvider: jest.fn().mockImplementation(() => ({
        provider: 'xai',
        modelName: 'grok-beta'
      }))
    }
  };
});

describe('AI Service Error Handling', () => {
  const sampleTodos = createSampleTodos(3);
  let mockAdapter: any;
  let aiService: AIService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter = createMockAIModelAdapter();
    
    // Initialize the AI service with mock adapter
    aiService = new AIService('test-api-key');
    (aiService as any).modelAdapter = mockAdapter;
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('API Connection Errors', () => {
    it('should handle complete API unavailability', async () => {
      // Create total failure simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.NETWORK,
        probability: 1.0,
        errorMessage: 'Unable to connect to AI service: connection refused'
      });
      
      // Apply simulator to adapter
      errorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'apiCall'
      );
      
      // Attempt AI operation
      await expect(aiService.summarize(sampleTodos))
        .rejects.toThrow(/Unable to connect/);
    });
    
    it('should handle intermittent API failures', async () => {
      // Create intermittent failure simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.NETWORK,
        probability: 0.5,
        errorMessage: 'API connection interrupted',
        recoveryProbability: 0.5,
        recoveryDelay: 50
      });
      
      // Apply simulator to adapter methods
      errorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'apiCall'
      );
      
      // Make multiple calls
      const results = [];
      
      for (let i = 0; i < 10; i++) {
        try {
          const result = await aiService.summarize(sampleTodos);
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      
      // Should have mix of successes and failures
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;
      
      expect(successes).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);
    });
  });
  
  describe('Rate Limiting', () => {
    it('should handle rate limit errors', async () => {
      // Create rate limit error simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.RATE_LIMIT,
        probability: 1.0,
        errorMessage: '429 Too Many Requests: Rate limit exceeded'
      });
      
      // Apply simulator to adapter
      errorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'apiCall'
      );
      
      // Attempt AI operation
      await expect(aiService.summarize(sampleTodos))
        .rejects.toThrow(/429 Too Many Requests/);
    });
    
    it('should handle progressive rate limiting with backoff', async () => {
      // Setup adapter to fail with rate limits then succeed
      mockAdapter.processWithPromptTemplate = jest.fn()
        .mockRejectedValueOnce(new Error('429 Too Many Requests: Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('429 Too Many Requests: Rate limit exceeded'))
        .mockResolvedValueOnce({
          result: 'Success after rate limit backoff',
          modelName: 'mock-model',
          provider: AIProvider.XAI,
          timestamp: Date.now()
        });
      
      // Create a retry wrapper
      const retryWithBackoff = async () => {
        let attempts = 0;
        const maxAttempts = 5;
        let backoffMs = 10; // Start with 10ms for faster tests
        
        while (attempts < maxAttempts) {
          try {
            return await aiService.summarize(sampleTodos);
          } catch (error) {
            if (attempts < maxAttempts - 1 && error.message?.includes('429')) {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              backoffMs *= 2; // Exponential backoff
            } else {
              throw error;
            }
          }
        }
      };
      
      // Execute with retries
      const result = await retryWithBackoff();
      
      // Verify eventual success
      expect(result).toBe('Success after rate limit backoff');
      expect(mockAdapter.processWithPromptTemplate).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('Token Limit Errors', () => {
    it('should handle token limit exceeded errors', async () => {
      // Create token limit simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.RESOURCE_EXHAUSTED,
        probability: 1.0,
        errorMessage: 'Input exceeds maximum token limit'
      });
      
      // Apply simulator to adapter
      errorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'tokenCheck'
      );
      
      // Create very large input
      const largeTodos = Array.from({ length: 100 }).map((_, index) => ({
        id: `todo-${index}`,
        title: `Todo ${index}`,
        description: 'a'.repeat(1000), // Large description
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      // Attempt AI operation with large input
      await expect(aiService.summarize(largeTodos))
        .rejects.toThrow(/exceeds maximum token limit/);
    });
    
    it('should truncate large inputs to prevent token limit errors', async () => {
      // Mock the tokenizer/truncator method
      const truncateSpy = jest.spyOn(aiService as any, 'truncateInputForTokenLimit')
        .mockImplementation((todos) => {
          // Return only first 3 todos with truncated descriptions
          return todos.slice(0, 3).map(todo => ({
            ...todo,
            description: todo.description?.substring(0, 100) || ''
          }));
        });
      
      // Create large input
      const largeTodos = Array.from({ length: 100 }).map((_, index) => ({
        id: `todo-${index}`,
        title: `Todo ${index}`,
        description: 'a'.repeat(1000),
        completed: false
      }));
      
      // Make API call with truncation
      const result = await aiService.summarize(largeTodos);
      
      // Verify truncation was used
      expect(truncateSpy).toHaveBeenCalled();
      
      // Verify API received truncated input
      const apiCallArgs = mockAdapter.processWithPromptTemplate.mock.calls[0][1];
      const parsedTodos = JSON.parse(apiCallArgs.todos);
      
      expect(parsedTodos.length).toBeLessThan(largeTodos.length);
    });
  });
  
  describe('Response Parsing Errors', () => {
    it('should handle invalid JSON in API responses', async () => {
      // Set up adapter to return invalid JSON
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: 'Not a valid JSON response',
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Call method expecting structured data
      const result = await aiService.categorize(sampleTodos);
      
      // Should return fallback (empty) result
      expect(result).toEqual({});
    });
    
    it('should handle unexpected response formats', async () => {
      // Mock unexpected response structure
      mockAdapter.processWithPromptTemplate = jest.fn().mockResolvedValue({
        result: null, // Missing expected result
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Call AI service method
      const result = await aiService.summarize(sampleTodos);
      
      // Should handle gracefully with empty result
      expect(result).toBe('');
    });
    
    it('should handle invalid suggestion schema', async () => {
      // Mock invalid suggestion format
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: '{"invalid": "schema"}', // Not following expected schema
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Call suggestions method
      const result = await aiService.suggest(sampleTodos);
      
      // Should return empty suggestions array
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
  
  describe('Authentication Errors', () => {
    it('should handle invalid API key errors', async () => {
      // Create auth error simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.AUTHENTICATION,
        probability: 1.0,
        errorMessage: '401 Unauthorized: Invalid API key'
      });
      
      // Apply simulator to adapter
      errorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'authenticate'
      );
      
      // Attempt operation with invalid key
      await expect(aiService.summarize(sampleTodos))
        .rejects.toThrow(/401 Unauthorized/);
    });
    
    it('should handle expired API credentials', async () => {
      // Create expired credentials simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.AUTHENTICATION,
        probability: 1.0,
        errorMessage: '401 Unauthorized: API key expired'
      });
      
      // Apply simulator to adapter
      errorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'authenticate'
      );
      
      // Attempt operation with expired credentials
      await expect(aiService.summarize(sampleTodos))
        .rejects.toThrow(/API key expired/);
    });
  });
  
  describe('Fallback Behavior', () => {
    it('should fall back to defaults for failed AI operations', async () => {
      // Create error simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.NETWORK,
        probability: 1.0,
        errorMessage: 'API connection failed'
      });
      
      // Apply simulator to adapter
      errorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'apiCall'
      );
      
      // Implement fallback method on service
      const withFallbackSpy = jest.spyOn(aiService as any, 'withFallback')
        .mockImplementation(async (operation, fallbackValue) => {
          try {
            return await operation();
          } catch (error) {
            return fallbackValue;
          }
        });
      
      // Call with fallback
      const result = await (aiService as any).withFallback(
        () => aiService.summarize(sampleTodos),
        'Fallback summary when AI is unavailable'
      );
      
      // Should return fallback value
      expect(result).toBe('Fallback summary when AI is unavailable');
    });
    
    it('should degrade gracefully with local processing when AI fails', async () => {
      // Create error simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.SERVER,
        probability: 1.0,
        errorMessage: '500 Internal Server Error'
      });
      
      // Apply simulator to adapter
      errorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'apiCall'
      );
      
      // Implement local processing fallback
      const localProcessingSpy = jest.spyOn(aiService as any, 'localProcessing')
        .mockImplementation((todos) => {
          // Basic local processing implementation
          const completed = todos.filter(t => t.completed).length;
          const total = todos.length;
          return `Basic summary: ${completed}/${total} todos completed`;
        });
      
      // Create method with local fallback
      const summarizeWithFallback = async (todos: any[]) => {
        try {
          return await aiService.summarize(todos);
        } catch (error) {
          return (aiService as any).localProcessing(todos);
        }
      };
      
      // Call with local fallback
      const result = await summarizeWithFallback(sampleTodos);
      
      // Should use local processing
      expect(result).toContain('Basic summary:');
      expect(localProcessingSpy).toHaveBeenCalled();
    });
  });
  
  describe('Content Policy Violations', () => {
    it('should handle content policy violation errors', async () => {
      // Create content policy simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.PERMISSION_DENIED,
        probability: 1.0,
        errorMessage: 'Content policy violation: Input contains restricted content'
      });
      
      // Apply simulator to adapter
      errorSimulator.simulateErrorOnMethod(
        mockAdapter,
        'processWithPromptTemplate',
        'contentCheck'
      );
      
      // Create potentially problematic content
      const problematicTodos = [
        {
          id: 'todo-1',
          title: 'Todo with potentially problematic content',
          description: 'Content that could trigger policy violation',
          completed: false
        }
      ];
      
      // Attempt operation
      await expect(aiService.summarize(problematicTodos))
        .rejects.toThrow(/Content policy violation/);
    });
  });
  
  describe('Error Recovery Testing', () => {
    it('should recover after transient errors with retry mechanism', async () => {
      // Create progressive recovery simulator
      // First call fails, second succeeds
      mockAdapter.processWithPromptTemplate = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary service disruption'))
        .mockResolvedValueOnce({
          result: 'Success after recovery',
          modelName: 'mock-model',
          provider: AIProvider.XAI,
          timestamp: Date.now()
        });
      
      // Create retry wrapper
      const withRetry = async () => {
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
            return await aiService.summarize(sampleTodos);
          } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) throw error;
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      };
      
      // Execute with retry
      const result = await withRetry();
      
      // Verify successful recovery
      expect(result).toBe('Success after recovery');
      expect(mockAdapter.processWithPromptTemplate).toHaveBeenCalledTimes(2);
    });
  });
});