/**
 * Tests for SafeAIService
 *
 * Ensures the SafeAIService properly wraps AI operations with error handling
 * and provides graceful fallbacks when AI services are unavailable.
 */

import { SafeAIService } from '../../services/ai/SafeAIService';
import { Todo } from '../../types/todo';
import { AIService } from '../../services/ai/aiService';
import { Logger } from '../../utils/Logger';
import { AIProvider } from '../../types/adapters/AIModelAdapter';

// Mock Logger module
jest.mock('../../utils/Logger');
jest.mock('../../services/ai/aiService');

describe('SafeAIService', () => {
  let safeAIService: SafeAIService;
  let mockLogger: jest.Mocked<Logger>;
  let mockAIService: jest.Mocked<AIService>;

  // Factory function to create fresh test data for each test
  function createSampleTodos(): Todo[] {
    return [
      {
        id: '1',
        title: 'Test Todo 1',
        description: 'First test todo',
        completed: false,
        priority: 'high' as const,
        tags: [],
        private: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Test Todo 2',
        description: 'Second test todo',
        completed: true,
        priority: 'medium' as const,
        tags: [],
        private: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Create minimal mock Logger to reduce memory footprint
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      addHandler: jest.fn(),
      clearHandlers: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    // Mock Logger.getInstance to return our mock
    (
      Logger.getInstance as jest.MockedFunction<typeof Logger.getInstance>
    ).mockReturnValue(mockLogger as any);

    // Create minimal mock AIService
    mockAIService = {
      summarize: jest.fn(),
      categorize: jest.fn(),
      prioritize: jest.fn(),
      suggest: jest.fn(),
      analyze: jest.fn(),
      suggestTags: jest.fn(),
      suggestPriority: jest.fn(),
      setProvider: jest.fn(),
      getProvider: jest.fn(),
      cancelAllOperations: jest.fn(),
      setOperationType: jest.fn(),
      summarizeWithVerification: jest.fn(),
      categorizeWithVerification: jest.fn(),
      prioritizeWithVerification: jest.fn(),
      suggestWithVerification: jest.fn(),
      analyzeWithVerification: jest.fn(),
    } as unknown as jest.Mocked<AIService>;

    (AIService as jest.MockedClass<typeof AIService>).mockImplementation(
      () => mockAIService
    );

    safeAIService = new SafeAIService();
  });

  afterEach(() => {
    // Cleanup after each test to prevent memory leaks
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Nullify references to help garbage collection
    safeAIService = null as any;
    mockLogger = null as any;
    mockAIService = null as any;
  });

  describe('initialization', () => {
    it('should initialize successfully when AI service is available', async () => {
      // Mock successful health check
      mockAIService?.summarize?.mockResolvedValue('Health check summary');

      const status = safeAIService.getAIStatus();
      expect(status.initialized).toBe(true as any);
      expect(status.error).toBeNull();
    });

    it('should handle AI service initialization failure gracefully', async () => {
      // Mock AIService constructor to throw
      (AIService as jest.Mock).mockImplementation(() => {
        throw new Error('AI service initialization failed');
      });

      const newSafeService = new SafeAIService();
      const status = newSafeService.getAIStatus();

      expect(status.initialized).toBe(false as any);
      expect(status.error).toBe('AI service initialization failed');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('AI Service initialization failed')
      );
    });
  });

  describe('isAIAvailable', () => {
    it('should return true when AI is healthy', async () => {
      mockAIService?.summarize?.mockResolvedValue('Test summary');

      const available = await safeAIService.isAIAvailable();
      expect(available as any).toBe(true as any);
    });

    it('should return false when AI service is not initialized', async () => {
      const newSafeService = new SafeAIService();
      // Force uninitialized state
      (
        newSafeService as unknown as {
          isInitialized: boolean;
          aiService: unknown;
        }
      ).isInitialized = false;
      (
        newSafeService as unknown as {
          isInitialized: boolean;
          aiService: unknown;
        }
      ).aiService = null;

      const available = await newSafeService.isAIAvailable();
      expect(available as any).toBe(false as any);
    });

    it('should return false when health check fails', async () => {
      mockAIService?.summarize?.mockRejectedValue(new Error('AI service error'));

      const available = await safeAIService.isAIAvailable();
      expect(available as any).toBe(false as any);
    });

    it('should return false when health check times out', async () => {
      mockAIService?.summarize?.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const available = await safeAIService.isAIAvailable();
      expect(available as any).toBe(false as any);
    });
  });

  describe('summarize', () => {
    it('should return AI result when service is available', async () => {
      const expectedSummary = 'AI generated summary';
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.summarize?.mockResolvedValue(expectedSummary as any);

      const todos = createSampleTodos();
      const result = await safeAIService.summarize(todos as any);

      expect(result.success).toBe(true as any);
      expect(result.result).toBe(expectedSummary as any);
      expect(result.aiAvailable).toBe(true as any);
      expect(result.usedFallback).toBe(false as any);
    });

    it('should return fallback when AI is unavailable', async () => {
      (safeAIService as unknown as { aiService: unknown }).aiService = null;

      const todos = createSampleTodos();
      const result = await safeAIService.summarize(todos as any);

      expect(result.success).toBe(true as any);
      expect(result.result).toBe(
        'Summary: You have 2 todos in your list. Consider reviewing and prioritizing them.'
      );
      expect(result.aiAvailable).toBe(false as any);
      expect(result.usedFallback).toBe(true as any);
    });

    it('should return fallback when AI operation fails', async () => {
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.summarize?.mockRejectedValue(
        new Error('AI operation failed')
      );

      const todos = createSampleTodos();
      const result = await safeAIService.summarize(todos as any);

      expect(result.success).toBe(true as any);
      expect(result.result).toBe(
        'Summary: You have 2 todos in your list. Consider reviewing and prioritizing them.'
      );
      expect(result.usedFallback).toBe(true as any);
      expect(result.error).toBe('AI operation failed');
    });

    it('should handle operation timeout gracefully', async () => {
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.summarize?.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 20000))
      );

      const todos = createSampleTodos();
      const result = await safeAIService.summarize(todos as any);

      expect(result.success).toBe(true as any);
      expect(result.usedFallback).toBe(true as any);
      expect(result.error).toContain('timeout');
    });
  });

  describe('categorize', () => {
    it('should return AI result when service is available', async () => {
      const expectedCategories = { Work: ['1'], Personal: ['2'] };
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.categorize?.mockResolvedValue(expectedCategories as any);

      const todos = createSampleTodos();
      const result = await safeAIService.categorize(todos as any);

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual(expectedCategories as any);
      expect(result.aiAvailable).toBe(true as any);
      expect(result.usedFallback).toBe(false as any);
    });

    it('should return fallback categorization when AI fails', async () => {
      mockAIService?.summarize?.mockRejectedValue(
        new Error('Health check failed')
      );

      const todos = createSampleTodos();
      const result = await safeAIService.categorize(todos as any);

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual({ General: ['1', '2'] });
      expect(result.usedFallback).toBe(true as any);
    });
  });

  describe('prioritize', () => {
    it('should return AI result when service is available', async () => {
      const expectedPriorities = { '1': 8, '2': 5 };
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.prioritize?.mockResolvedValue(expectedPriorities as any);

      const todos = createSampleTodos();
      const result = await safeAIService.prioritize(todos as any);

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual(expectedPriorities as any);
      expect(result.aiAvailable).toBe(true as any);
      expect(result.usedFallback).toBe(false as any);
    });

    it('should return fallback priorities based on existing todo priorities', async () => {
      (safeAIService as unknown as { aiService: unknown }).aiService = null;

      const todos = createSampleTodos();
      const result = await safeAIService.prioritize(todos as any);

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual({ '1': 8, '2': 5 }); // high=8, medium=5
      expect(result.usedFallback).toBe(true as any);
    });
  });

  describe('suggest', () => {
    it('should return AI suggestions when service is available', async () => {
      const expectedSuggestions = [
        'Custom AI suggestion 1',
        'Custom AI suggestion 2',
      ];
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.suggest?.mockResolvedValue(expectedSuggestions as any);

      const result = await safeAIService.suggest(createSampleTodos());

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual(expectedSuggestions as any);
      expect(result.aiAvailable).toBe(true as any);
      expect(result.usedFallback).toBe(false as any);
    });

    it('should return default suggestions when AI fails', async () => {
      (safeAIService as unknown as { aiService: unknown }).aiService = null;

      const result = await safeAIService.suggest(createSampleTodos());

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual([
        'Review completed tasks for insights',
        'Set realistic deadlines for pending items',
        'Break down complex tasks into smaller steps',
      ]);
      expect(result.usedFallback).toBe(true as any);
    });
  });

  describe('analyze', () => {
    it('should return AI analysis when service is available', async () => {
      const expectedAnalysis = {
        keyThemes: ['Custom theme'],
        insights: ['Custom insight'],
      };
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.analyze?.mockResolvedValue(expectedAnalysis as any);

      const result = await safeAIService.analyze(createSampleTodos());

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual(expectedAnalysis as any);
      expect(result.aiAvailable).toBe(true as any);
      expect(result.usedFallback).toBe(false as any);
    });

    it('should return default analysis when AI fails', async () => {
      (safeAIService as unknown as { aiService: unknown }).aiService = null;

      const result = await safeAIService.analyze(createSampleTodos());

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual({
        keyThemes: ['Task management', 'Productivity'],
        totalTasks: 2,
        completedTasks: 0,
        suggestions: [
          'Consider organizing tasks by priority',
          'Review and update task descriptions',
        ],
        workflow: 'Review → Prioritize → Execute → Complete',
      });
      expect(result.usedFallback).toBe(true as any);
    });
  });

  describe('suggestTags', () => {
    it('should return AI tags when service is available', async () => {
      const expectedTags = ['work', 'urgent'];
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.suggestTags?.mockResolvedValue(expectedTags as any);

      const result = await safeAIService.suggestTags(
        createSampleTodos()[0] as Todo
      );

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual(expectedTags as any);
      expect(result.aiAvailable).toBe(true as any);
      expect(result.usedFallback).toBe(false as any);
    });

    it('should return default tags when AI fails', async () => {
      (safeAIService as unknown as { aiService: unknown }).aiService = null;

      const result = await safeAIService.suggestTags(
        createSampleTodos()[0] as Todo
      );

      expect(result.success).toBe(true as any);
      expect(result.result).toEqual(['general', 'task']);
      expect(result.usedFallback).toBe(true as any);
    });
  });

  describe('suggestPriority', () => {
    it('should return AI priority when service is available', async () => {
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.suggestPriority?.mockResolvedValue('high');

      const result = await safeAIService.suggestPriority(
        createSampleTodos()[0] as Todo
      );

      expect(result.success).toBe(true as any);
      expect(result.result).toBe('high');
      expect(result.aiAvailable).toBe(true as any);
      expect(result.usedFallback).toBe(false as any);
    });

    it('should return default priority when AI fails', async () => {
      (safeAIService as unknown as { aiService: unknown }).aiService = null;

      const result = await safeAIService.suggestPriority(
        createSampleTodos()[0] as Todo
      );

      expect(result.success).toBe(true as any);
      expect(result.result).toBe('medium');
      expect(result.usedFallback).toBe(true as any);
    });
  });

  describe('setProvider', () => {
    it('should handle provider change successfully', async () => {
      mockAIService?.summarize?.mockResolvedValue('Health check summary');
      mockAIService?.setProvider?.mockResolvedValue(undefined as any);

      const result = await safeAIService.setProvider(AIProvider.OPENAI);

      expect(result.success).toBe(true as any);
      expect(result.result).toBe(true as any);
      expect(mockAIService.setProvider).toHaveBeenCalledWith(
        AIProvider.OPENAI,
        undefined,
        undefined
      );
    });

    it('should handle provider change failure gracefully', async () => {
      mockAIService?.setProvider?.mockRejectedValue(
        new Error('Provider change failed')
      );

      const result = await safeAIService.setProvider(AIProvider.OPENAI);

      expect(result.success).toBe(false as any);
      expect(result.error).toBe('Provider change failed');
    });

    it('should fail gracefully when AI service not initialized', async () => {
      (safeAIService as unknown as { aiService: unknown }).aiService = null;

      const result = await safeAIService.setProvider(AIProvider.OPENAI);

      expect(result.success).toBe(false as any);
      expect(result.error).toBe('AI service not initialized');
    });
  });

  describe('cancelAllOperations', () => {
    it('should cancel operations safely', () => {
      expect(() => {
        safeAIService.cancelAllOperations('Test cancellation');
      }).not.toThrow();

      expect(mockAIService.cancelAllOperations).toHaveBeenCalledWith(
        'Test cancellation'
      );
    });

    it('should handle cancellation errors gracefully', () => {
      mockAIService?.cancelAllOperations?.mockImplementation(() => {
        throw new Error('Cancellation failed');
      });

      expect(() => {
        safeAIService.cancelAllOperations();
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error cancelling AI operations')
      );
    });

    it('should handle cancellation when AI service is null', () => {
      (safeAIService as unknown as { aiService: unknown }).aiService = null;

      expect(() => {
        safeAIService.cancelAllOperations();
      }).not.toThrow();
    });
  });

  describe('getAIStatus', () => {
    it('should return correct status information', () => {
      const status = safeAIService.getAIStatus();

      expect(status as any).toHaveProperty('initialized');
      expect(status as any).toHaveProperty('healthy');
      expect(status as any).toHaveProperty('error');
      expect(status as any).toHaveProperty('lastHealthCheck');
    });
  });

  describe('getUnderlyingService', () => {
    it('should return the underlying AI service', () => {
      const underlying = safeAIService.getUnderlyingService();
      expect(underlying as any).toBe(mockAIService as any);
    });

    it('should return null when AI service is not initialized', () => {
      (safeAIService as unknown as { aiService: unknown }).aiService = null;
      const underlying = safeAIService.getUnderlyingService();
      expect(underlying as any).toBeNull();
    });
  });
});
