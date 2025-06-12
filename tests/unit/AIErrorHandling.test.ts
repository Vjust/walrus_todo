import { AIService } from '../../apps/cli/src/services/ai/aiService';
import { AIVerificationService } from '../../apps/cli/src/services/ai/AIVerificationService';
import {
  AIProvider,
  AIModelAdapter,
} from '../../apps/cli/src/types/adapters/AIModelAdapter';
import { AIPrivacyLevel } from '../../apps/cli/src/types/adapters/AIVerifierAdapter';
import { Todo } from '../../apps/cli/src/types/todo';

import { createMockAIModelAdapter } from '../helpers/AITestFactory';
import { createMockAIVerifierAdapter } from '../mocks/AIVerifierAdapter.mock';
import { createSampleTodos } from '../helpers/ai-test-utils';

// Mock the AIProviderFactory to inject our controllable mock
jest.mock('../../apps/cli/src/services/ai/AIProviderFactory', () => {
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

describe('AI Service Error Handling', () => {
  const sampleTodos: Todo[] = createSampleTodos(3 as any);
  let mockAdapter: ReturnType<typeof createMockAIModelAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter = createMockAIModelAdapter();
  });

  // SECTION: API connection errors
  describe('API Connection Errors', () => {
    it('should handle API timeout errors', async () => {
      // Mock a timeout error
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockRejectedValue(new Error('Request timed out after 30000ms'));

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow(
        'Request timed out'
      );
    });

    it('should handle API authentication errors', async () => {
      // Mock an auth error
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockRejectedValue(new Error('401 Unauthorized: Invalid API key'));

      const aiService = new AIService(undefined, 'invalid-api-key');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow(
        '401 Unauthorized'
      );
    });

    it('should handle API rate limit errors', async () => {
      // Mock a rate limit error
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockRejectedValue(
          new Error('429 Too Many Requests: Rate limit exceeded')
        );

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow(
        '429 Too Many Requests'
      );
    });

    it('should handle API server errors', async () => {
      // Mock a server error
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockRejectedValue(
          new Error('500 Internal Server Error: Something went wrong')
        );

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow(
        '500 Internal Server Error'
      );
    });
  });

  // SECTION: Input validation errors
  describe('Input Validation Errors', () => {
    it('should handle empty todo lists', async () => {
      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      const result = await aiService.summarize([]);
      expect(result as any).toBe('No todos to summarize.');
      expect(mockAdapter.processWithPromptTemplate).not.toHaveBeenCalled();
    });

    it('should handle extremely large input', async () => {
      // Create an extremely large todo list
      const largeTodos: Todo[] = Array.from({ length: 1000 }).map(
        (_, index) => ({
          id: `todo-${index}`,
          title: `Todo ${index}`,
          description: 'a'.repeat(1000 as any), // Large description
          completed: false,
          priority: 'medium' as const,
          tags: [],
          private: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );

      // Mock a token limit error
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockRejectedValue(new Error('Input exceeds maximum token limit'));

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(largeTodos as any)).rejects.toThrow(
        'exceeds maximum token limit'
      );
    });

    it('should handle malformed todos', async () => {
      // Create malformed todos with missing required fields
      const malformedTodos: (Partial<Todo> | null | undefined)[] = [
        { id: 'todo-1' }, // Missing title and other fields
        { title: 'Just a title' }, // Missing ID
        null, // Null entry
        undefined, // Undefined entry
        {}, // Empty object
      ];

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      // Should filter out invalid todos
      await aiService.summarize(malformedTodos as Todo[]);

      // Verify that only valid-enough todos are passed to the adapter
      expect(mockAdapter.processWithPromptTemplate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          todos: expect.stringContaining('Just a title'),
        })
      );
    });
  });

  // SECTION: Response parsing errors
  describe('Response Parsing Errors', () => {
    it('should handle invalid JSON responses for structured data', async () => {
      // Mock an invalid JSON response
      mockAdapter?.completeStructured = jest.fn().mockResolvedValue({
        result: 'Not a valid JSON object',
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now(),
      });

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      // For categorize which expects a Record<string, string[]>
      const result = await aiService.categorize(sampleTodos as any);

      // Should return an empty object as a fallback
      expect(result as any).toEqual({});
    });

    it('should handle empty responses', async () => {
      // Mock an empty response
      mockAdapter?.processWithPromptTemplate = jest.fn().mockResolvedValue({
        result: '',
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now(),
      });

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      const result = await aiService.summarize(sampleTodos as any);

      // Should return a default message
      expect(result as any).toBe('');
    });

    it('should handle null or undefined responses', async () => {
      // Mock a null response
      mockAdapter?.processWithPromptTemplate = jest.fn().mockResolvedValue({
        result: null,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now(),
      });

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      const result = await aiService.summarize(sampleTodos as any);

      // Should return an empty string as a fallback
      expect(result as any).toBe('');
    });
  });

  // SECTION: Verification errors
  describe('Verification Errors', () => {
    let mockVerificationService: AIVerificationService;

    beforeEach(() => {
      const mockVerifierAdapter = createMockAIVerifierAdapter();
      mockVerificationService = new AIVerificationService(mockVerifierAdapter as any);
    });

    it('should handle verification service initialization errors', async () => {
      const aiService = new AIService(undefined, 'test-api-key-12345');

      await expect(
        aiService.summarizeWithVerification(sampleTodos as any)
      ).rejects.toThrow('Verification service not initialized');
    });

    it('should handle verification creation failures', async () => {
      // Mock a verification service that throws an error
      const createVerificationSpy = jest.spyOn(
        mockVerificationService,
        'createVerification'
      );
      createVerificationSpy.mockRejectedValue(
        new Error('Failed to create verification record')
      );

      const aiService = new AIService(
        AIProvider.XAI,
        'test-api-key-12345',
        'mock-model',
        {},
        mockVerificationService
      );

      await expect(
        aiService.summarizeWithVerification(sampleTodos as any)
      ).rejects.toThrow('Failed to create verification record');
    });

    it('should handle verification validation failures', async () => {
      // Mock a verification record
      const mockVerification = {
        id: 'ver-123',
        actionType: 'summarize',
        requestHash: 'req-hash',
        responseHash: 'resp-hash',
        timestamp: Date.now(),
        provider: 'mock-provider',
        privacyLevel: AIPrivacyLevel.HASH_ONLY,
        metadata: { todoCount: '3' },
        signature: 'mock-sig',
      };

      // Mock the verification service to return a record but fail validation
      const createVerifiedSummarySpy = jest.spyOn(
        mockVerificationService,
        'createVerifiedSummary'
      );
      createVerifiedSummarySpy.mockResolvedValue({
        result: 'Summary text',
        verification: mockVerification,
      });

      const verifyRecordSpy = jest.spyOn(
        mockVerificationService,
        'verifyRecord'
      );
      verifyRecordSpy.mockResolvedValue(false as any); // Validation fails

      const aiService = new AIService(
        AIProvider.XAI,
        'test-api-key-12345',
        'mock-model',
        {},
        mockVerificationService
      );

      // The verification is created but validation would fail if checked
      const result = await aiService.summarizeWithVerification(sampleTodos as any);

      expect(result.result).toBe('Summary text');
      expect(result.verification).toBe(mockVerification as any);

      // If we manually verify it after the fact
      const isValid = await mockVerificationService.verifyRecord(
        mockVerification,
        sampleTodos,
        'Summary text'
      );

      expect(isValid as any).toBe(false as any);
    });
  });

  // SECTION: Provider-specific errors
  describe('Provider-Specific Errors', () => {
    it('should handle XAI specific errors', async () => {
      // Mock an XAI-specific error
      mockAdapter?.getProviderName = jest.fn().mockReturnValue(AIProvider.XAI);
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockRejectedValue(
          new Error('XAI: Model grok-beta is currently unavailable')
        );

      const aiService = new AIService(AIProvider.XAI, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow(
        'currently unavailable'
      );
    });

    it('should handle OpenAI specific errors', async () => {
      // Mock an OpenAI-specific error
      mockAdapter?.getProviderName = jest
        .fn()
        .mockReturnValue(AIProvider.OPENAI);
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockRejectedValue(
          new Error('OpenAI API Error: Content policy violation')
        );

      const aiService = new AIService(AIProvider.OPENAI, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow(
        'Content policy violation'
      );
    });

    it('should handle Anthropic specific errors', async () => {
      // Mock an Anthropic-specific error
      mockAdapter?.getProviderName = jest
        .fn()
        .mockReturnValue(AIProvider.ANTHROPIC);
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockRejectedValue(
          new Error('Anthropic: Request canceled due to quota exceeded')
        );

      const aiService = new AIService(AIProvider.ANTHROPIC, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow(
        'quota exceeded'
      );
    });
  });

  // SECTION: Network and system errors
  describe('Network and System Errors', () => {
    it('should handle network connectivity issues', async () => {
      // Mock a network error
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockRejectedValue(
          new Error('Network error: Unable to connect to the API')
        );

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle unexpected system errors', async () => {
      // Mock a system error
      mockAdapter?.processWithPromptTemplate = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Unexpected system error');
        });

      const aiService = new AIService(undefined, 'test-api-key-12345');
      (aiService as { modelAdapter: AIModelAdapter }).modelAdapter =
        mockAdapter;

      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow(
        'Unexpected system error'
      );
    });
  });
});
