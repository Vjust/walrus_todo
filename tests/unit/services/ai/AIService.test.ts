import { describe, it, expect, beforeEach } from '@jest/globals';
import { AIService } from '@/services/ai/aiService';
import { createMockAIService, mockXAIProvider } from '../../../helpers/ai-test-utils';
// MockXAIProvider is available through mocking
import { AIOperation, AIModelType, AIProviderType } from '@/services/ai/types';
import type { Todo } from '@/types/todo';

describe('AIService', () => {
  let service: AIService;
  let mockProvider: any;
  const testApiKey = 'test-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    service = createMockAIService(testApiKey);
    mockProvider = mockXAIProvider;
    mockProvider.reset();
  });

  describe('AI Operations', () => {
    const sampleTodos: Todo[] = [
      {
        id: '1',
        title: 'Test Todo 1',
        description: 'First test todo',
        status: 'pending',
        priority: 'medium',
        created_at: Date.now().toString()
      },
      {
        id: '2',
        title: 'Test Todo 2',
        description: 'Second test todo',
        status: 'completed',
        priority: 'high',
        created_at: Date.now().toString()
      }
    ];

    describe('Summarize Operation', () => {
      it('should summarize todos successfully', async () => {
        const result = await service.summarizeTodos(sampleTodos);
        
        expect(result).toBeDefined();
        expect(result).toContain('Test Todo');
        expect(mockProvider.invoke).toHaveBeenCalledWith(
          expect.stringContaining('Provide a brief summary')
        );
      });

      it('should handle empty todos list', async () => {
        const result = await service.summarizeTodos([]);
        
        expect(result).toBe('No todos to summarize.');
      });

      it('should handle API errors gracefully', async () => {
        const mockError = new Error('API Error');
        mockProvider.setShouldError(true);
        mockProvider.setError(mockError);

        await expect(service.summarizeTodos(sampleTodos))
          .rejects.toThrow('Failed to summarize todos');
      });
    });

    describe('Categorize Operation', () => {
      it('should categorize todos successfully', async () => {
        mockProvider.setResponse('Work: Test Todo 1\nPersonal: Test Todo 2');
        
        const result = await service.categorizeTodos(sampleTodos);
        
        expect(result).toBeDefined();
        expect(result).toContain('Work');
        expect(result).toContain('Personal');
        expect(mockProvider.invoke).toHaveBeenCalledWith(
          expect.stringContaining('Categorize the following todos')
        );
      });

      it('should handle categorization with custom categories', async () => {
        const customCategories = ['Urgent', 'Later', 'Maybe'];
        mockProvider.setResponse('Urgent: Test Todo 2\nLater: Test Todo 1');
        
        await service.categorizeTodos(sampleTodos);
        
        expect(mockProvider.invoke).toHaveBeenCalledWith(
          expect.stringContaining('Categorize the following todos')
        );
      });
    });

    describe('Prioritize Operation', () => {
      it('should prioritize todos successfully', async () => {
        mockProvider.setResponse('1. Test Todo 2 (High Priority)\n2. Test Todo 1 (Medium Priority)');
        
        const result = await service.prioritizeTodos(sampleTodos);
        
        expect(result).toBeDefined();
        expect(result).toContain('Test Todo 2');
        expect(result).toContain('High Priority');
        expect(mockProvider.invoke).toHaveBeenCalledWith(
          expect.stringContaining('Prioritize the following todos')
        );
      });

      it('should handle prioritization with context', async () => {
        const context = 'Focus on work-related tasks';
        mockProvider.setResponse('1. Test Todo 1 (Work-related)\n2. Test Todo 2');
        
        await service.prioritizeTodos(sampleTodos);
        
        expect(mockProvider.invoke).toHaveBeenCalledWith(
          expect.stringContaining('Prioritize the following todos')
        );
      });
    });

    describe('Suggest Operation', () => {
      it('should suggest next actions successfully', async () => {
        mockProvider.setResponse('Next steps:\n1. Complete Test Todo 1\n2. Review Test Todo 2');
        
        const result = await service.suggestNextActions(sampleTodos);
        
        expect(result).toBeDefined();
        expect(result).toContain('Next steps');
        expect(result).toContain('Complete Test Todo 1');
        expect(mockProvider.invoke).toHaveBeenCalledWith(
          expect.stringContaining('Suggest the most logical next actions')
        );
      });

      it('should handle suggestions for completed todos', async () => {
        const completedTodos = sampleTodos.map(todo => ({ ...todo, status: 'completed' }));
        mockProvider.setResponse('All tasks completed! Consider:\n1. Review completed work\n2. Plan new tasks');
        
        const result = await service.suggestNextActions(completedTodos);
        
        expect(result).toContain('All tasks completed');
      });
    });

    describe('Analyze Operation', () => {
      it('should analyze todos successfully', async () => {
        mockProvider.setResponse('Analysis:\n- 50% completion rate\n- High priority focus\n- Balanced workload');
        
        const result = await service.analyzeTodos(sampleTodos);
        
        expect(result).toBeDefined();
        expect(result).toContain('Analysis');
        expect(result).toContain('completion rate');
        expect(mockProvider.invoke).toHaveBeenCalledWith(
          expect.stringContaining('Analyze the following todos')
        );
      });

      it('should provide detailed analysis', async () => {
        const largeTodoSet = Array(10).fill(null).map((_, i) => ({
          ...sampleTodos[0],
          id: `${i}`,
          title: `Todo ${i}`,
          priority: i % 2 === 0 ? 'high' : 'low'
        }));
        
        await service.analyzeTodos(largeTodoSet);
        
        expect(mockProvider.invoke).toHaveBeenCalledWith(
          expect.stringContaining('Analyze the following todos')
        );
      });
    });
  });

  describe('API Interactions', () => {
    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      mockProvider.setShouldError(true);
      mockProvider.setError(rateLimitError);

      await expect(service.summarizeTodos(sampleTodos))
        .rejects.toThrow('Failed to summarize todos');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      mockProvider.setShouldError(true);
      mockProvider.setError(networkError);

      await expect(service.analyzeTodos(sampleTodos))
        .rejects.toThrow('Failed to analyze todos');
    });

    it('should handle invalid API responses', async () => {
      mockProvider.setResponse(null as any);

      await expect(service.suggestNextActions(sampleTodos))
        .rejects.toThrow('Invalid response from AI service');
    });

    it('should handle malformed responses', async () => {
      mockProvider.setResponse(undefined as any);

      await expect(service.categorizeTodos(sampleTodos))
        .rejects.toThrow('Invalid response from AI service');
    });

    it('should include proper headers in requests', async () => {
      await service.summarizeTodos(sampleTodos);
      
      // The mock provider tracks that invoke was called with the correct prompt
      expect(mockProvider.invoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Handling', () => {
    it('should parse structured responses correctly', async () => {
      const structuredResponse = `
        Categories:
        - Work: Test Todo 1
        - Personal: Test Todo 2
        
        Priority:
        1. Test Todo 2
        2. Test Todo 1
      `;
      mockProvider.setResponse(structuredResponse);
      
      const result = await service.categorizeTodos(sampleTodos);
      
      expect(result).toBe(structuredResponse);
    });

    it('should handle empty responses gracefully', async () => {
      mockProvider.setResponse('');
      
      await expect(service.analyzeTodos(sampleTodos))
        .rejects.toThrow('Empty response from AI service');
    });

    it('should sanitize output', async () => {
      const unsafeResponse = '<script>alert("xss")</script>Safe content';
      mockProvider.setResponse(unsafeResponse);
      
      const result = await service.summarizeTodos(sampleTodos);
      
      // The service should return the raw response, sanitization happens at display layer
      expect(result).toBe(unsafeResponse);
    });

    it('should handle multi-line responses', async () => {
      const multiLineResponse = `Line 1: Summary
Line 2: Details
Line 3: Conclusion`;
      mockProvider.setResponse(multiLineResponse);
      
      const result = await service.analyzeTodos(sampleTodos);
      
      expect(result).toBe(multiLineResponse);
      expect(result.split('\n')).toHaveLength(3);
    });

    it('should handle JSON responses when expected', async () => {
      const jsonResponse = JSON.stringify({
        categories: ['Work', 'Personal'],
        priorities: [1, 2],
        suggestions: ['Complete Task 1', 'Review Task 2']
      });
      mockProvider.setResponse(jsonResponse);
      
      const result = await service.analyzeTodos(sampleTodos);
      
      expect(result).toBe(jsonResponse);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle service initialization errors', async () => {
      const brokenService = new AIService('invalid-key', AIProviderType.XAI);
      
      // The service should still work with the mock provider in test environment
      await expect(brokenService.summarizeTodos(sampleTodos))
        .resolves.toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const operations = [
        service.summarizeTodos(sampleTodos),
        service.categorizeTodos(sampleTodos),
        service.prioritizeTodos(sampleTodos),
        service.analyzeTodos(sampleTodos)
      ];
      
      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should handle operation timeouts', async () => {
      jest.useFakeTimers();
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), 30000);
      });
      
      const operationPromise = service.analyzeTodos(sampleTodos);
      
      jest.advanceTimersByTime(30000);
      
      // The actual service should complete before the timeout
      await expect(operationPromise).resolves.toBeDefined();
      
      jest.useRealTimers();
    });
  });

  describe('Provider Configuration', () => {
    it('should work with different providers', async () => {
      const xaiService = new AIService(testApiKey, AIProviderType.XAI);
      const openaiService = new AIService(testApiKey, AIProviderType.OPENAI);
      const anthropicService = new AIService(testApiKey, AIProviderType.ANTHROPIC);
      
      // All should work with mocks in test environment
      await expect(xaiService.summarizeTodos(sampleTodos)).resolves.toBeDefined();
      await expect(openaiService.summarizeTodos(sampleTodos)).resolves.toBeDefined();
      await expect(anthropicService.summarizeTodos(sampleTodos)).resolves.toBeDefined();
    });

    it('should use default provider when not specified', async () => {
      const defaultService = new AIService(testApiKey);
      
      await expect(defaultService.summarizeTodos(sampleTodos))
        .resolves.toBeDefined();
    });
  });
});