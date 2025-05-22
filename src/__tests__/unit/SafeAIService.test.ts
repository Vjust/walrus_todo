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

// Mock dependencies
jest.mock('../../services/ai/aiService');
jest.mock('../../utils/Logger');

describe('SafeAIService', () => {
  let safeAIService: SafeAIService;
  let mockAIService: jest.Mocked<AIService>;
  let mockLogger: jest.Mocked<Logger>;

  const sampleTodos: Todo[] = [
    {
      id: '1',
      title: 'Test Todo 1',
      description: 'First test todo',
      completed: false,
      priority: 'high',
      tags: [],
      private: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Test Todo 2',
      description: 'Second test todo',
      completed: true,
      priority: 'medium',
      tags: [],
      private: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getInstance: jest.fn(() => mockLogger)
    } as any;
    
    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
    
    // Mock AIService
    mockAIService = {
      summarize: jest.fn(),
      categorize: jest.fn(),
      prioritize: jest.fn(),
      suggest: jest.fn(),
      analyze: jest.fn(),
      suggestTags: jest.fn(),
      suggestPriority: jest.fn(),
      setProvider: jest.fn(),
      cancelAllOperations: jest.fn(),
      summarizeWithVerification: jest.fn(),
      categorizeWithVerification: jest.fn(),
      prioritizeWithVerification: jest.fn(),
      suggestWithVerification: jest.fn(),
      analyzeWithVerification: jest.fn()
    } as any;
    
    (AIService as jest.Mock).mockImplementation(() => mockAIService);
    
    safeAIService = new SafeAIService();
  });

  describe('initialization', () => {
    it('should initialize successfully when AI service is available', async () => {
      // Mock successful health check
      mockAIService.summarize.mockResolvedValue('Health check summary');
      
      const status = safeAIService.getAIStatus();
      expect(status.initialized).toBe(true);
      expect(status.error).toBeNull();
    });

    it('should handle AI service initialization failure gracefully', async () => {
      // Mock AIService constructor to throw
      (AIService as jest.Mock).mockImplementation(() => {
        throw new Error('AI service initialization failed');
      });
      
      const newSafeService = new SafeAIService();
      const status = newSafeService.getAIStatus();
      
      expect(status.initialized).toBe(false);
      expect(status.error).toBe('AI service initialization failed');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('AI Service initialization failed')
      );
    });
  });

  describe('isAIAvailable', () => {
    it('should return true when AI is healthy', async () => {
      mockAIService.summarize.mockResolvedValue('Test summary');
      
      const available = await safeAIService.isAIAvailable();
      expect(available).toBe(true);
    });

    it('should return false when AI service is not initialized', async () => {
      const newSafeService = new SafeAIService();
      // Force uninitialized state
      (newSafeService as any).isInitialized = false;
      (newSafeService as any).aiService = null;
      
      const available = await newSafeService.isAIAvailable();
      expect(available).toBe(false);
    });

    it('should return false when health check fails', async () => {
      mockAIService.summarize.mockRejectedValue(new Error('AI service error'));
      
      const available = await safeAIService.isAIAvailable();
      expect(available).toBe(false);
    });

    it('should return false when health check times out', async () => {
      mockAIService.summarize.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );
      
      const available = await safeAIService.isAIAvailable();
      expect(available).toBe(false);
    });
  });

  describe('summarize', () => {
    it('should return AI result when service is available', async () => {
      const expectedSummary = 'AI generated summary';
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.summarize.mockResolvedValue(expectedSummary);
      
      const result = await safeAIService.summarize(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(expectedSummary);
      expect(result.aiAvailable).toBe(true);
      expect(result.usedFallback).toBe(false);
    });

    it('should return fallback when AI is unavailable', async () => {
      (safeAIService as any).aiService = null;
      
      const result = await safeAIService.summarize(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('Summary: You have 2 todos in your list. Consider reviewing and prioritizing them.');
      expect(result.aiAvailable).toBe(false);
      expect(result.usedFallback).toBe(true);
    });

    it('should return fallback when AI operation fails', async () => {
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.summarize.mockRejectedValue(new Error('AI operation failed'));
      
      const result = await safeAIService.summarize(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('Summary: You have 2 todos in your list. Consider reviewing and prioritizing them.');
      expect(result.usedFallback).toBe(true);
      expect(result.error).toBe('AI operation failed');
    });

    it('should handle operation timeout gracefully', async () => {
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.summarize.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 20000))
      );
      
      const result = await safeAIService.summarize(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
      expect(result.error).toContain('timeout');
    });
  });

  describe('categorize', () => {
    it('should return AI result when service is available', async () => {
      const expectedCategories = { 'Work': ['1'], 'Personal': ['2'] };
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.categorize.mockResolvedValue(expectedCategories);
      
      const result = await safeAIService.categorize(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(expectedCategories);
      expect(result.aiAvailable).toBe(true);
      expect(result.usedFallback).toBe(false);
    });

    it('should return fallback categorization when AI fails', async () => {
      mockAIService.summarize.mockRejectedValue(new Error('Health check failed'));
      
      const result = await safeAIService.categorize(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ 'General': ['1', '2'] });
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('prioritize', () => {
    it('should return AI result when service is available', async () => {
      const expectedPriorities = { '1': 8, '2': 5 };
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.prioritize.mockResolvedValue(expectedPriorities);
      
      const result = await safeAIService.prioritize(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(expectedPriorities);
      expect(result.aiAvailable).toBe(true);
      expect(result.usedFallback).toBe(false);
    });

    it('should return fallback priorities based on existing todo priorities', async () => {
      (safeAIService as any).aiService = null;
      
      const result = await safeAIService.prioritize(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ '1': 8, '2': 5 }); // high=8, medium=5
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('suggest', () => {
    it('should return AI suggestions when service is available', async () => {
      const expectedSuggestions = ['Custom AI suggestion 1', 'Custom AI suggestion 2'];
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.suggest.mockResolvedValue(expectedSuggestions);
      
      const result = await safeAIService.suggest(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(expectedSuggestions);
      expect(result.aiAvailable).toBe(true);
      expect(result.usedFallback).toBe(false);
    });

    it('should return default suggestions when AI fails', async () => {
      (safeAIService as any).aiService = null;
      
      const result = await safeAIService.suggest(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual([
        "Review completed tasks for insights",
        "Set realistic deadlines for pending items",
        "Break down complex tasks into smaller steps"
      ]);
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('analyze', () => {
    it('should return AI analysis when service is available', async () => {
      const expectedAnalysis = { 
        keyThemes: ['Custom theme'], 
        insights: ['Custom insight'] 
      };
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.analyze.mockResolvedValue(expectedAnalysis);
      
      const result = await safeAIService.analyze(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(expectedAnalysis);
      expect(result.aiAvailable).toBe(true);
      expect(result.usedFallback).toBe(false);
    });

    it('should return default analysis when AI fails', async () => {
      (safeAIService as any).aiService = null;
      
      const result = await safeAIService.analyze(sampleTodos);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        keyThemes: ['Task management', 'Productivity'],
        totalTasks: 2,
        completedTasks: 0,
        suggestions: ['Consider organizing tasks by priority', 'Review and update task descriptions'],
        workflow: 'Review → Prioritize → Execute → Complete'
      });
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('suggestTags', () => {
    it('should return AI tags when service is available', async () => {
      const expectedTags = ['work', 'urgent'];
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.suggestTags.mockResolvedValue(expectedTags);
      
      const result = await safeAIService.suggestTags(sampleTodos[0]);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(expectedTags);
      expect(result.aiAvailable).toBe(true);
      expect(result.usedFallback).toBe(false);
    });

    it('should return default tags when AI fails', async () => {
      (safeAIService as any).aiService = null;
      
      const result = await safeAIService.suggestTags(sampleTodos[0]);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(['general', 'task']);
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('suggestPriority', () => {
    it('should return AI priority when service is available', async () => {
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.suggestPriority.mockResolvedValue('high');
      
      const result = await safeAIService.suggestPriority(sampleTodos[0]);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('high');
      expect(result.aiAvailable).toBe(true);
      expect(result.usedFallback).toBe(false);
    });

    it('should return default priority when AI fails', async () => {
      (safeAIService as any).aiService = null;
      
      const result = await safeAIService.suggestPriority(sampleTodos[0]);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('medium');
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('setProvider', () => {
    it('should handle provider change successfully', async () => {
      mockAIService.summarize.mockResolvedValue('Health check summary');
      mockAIService.setProvider.mockResolvedValue(undefined);
      
      const result = await safeAIService.setProvider('openai' as any);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(true);
      expect(mockAIService.setProvider).toHaveBeenCalledWith('openai', undefined, undefined);
    });

    it('should handle provider change failure gracefully', async () => {
      mockAIService.setProvider.mockRejectedValue(new Error('Provider change failed'));
      
      const result = await safeAIService.setProvider('openai' as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider change failed');
    });

    it('should fail gracefully when AI service not initialized', async () => {
      (safeAIService as any).aiService = null;
      
      const result = await safeAIService.setProvider('openai' as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('AI service not initialized');
    });
  });

  describe('cancelAllOperations', () => {
    it('should cancel operations safely', () => {
      expect(() => {
        safeAIService.cancelAllOperations('Test cancellation');
      }).not.toThrow();
      
      expect(mockAIService.cancelAllOperations).toHaveBeenCalledWith('Test cancellation');
    });

    it('should handle cancellation errors gracefully', () => {
      mockAIService.cancelAllOperations.mockImplementation(() => {
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
      (safeAIService as any).aiService = null;
      
      expect(() => {
        safeAIService.cancelAllOperations();
      }).not.toThrow();
    });
  });

  describe('getAIStatus', () => {
    it('should return correct status information', () => {
      const status = safeAIService.getAIStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('error');
      expect(status).toHaveProperty('lastHealthCheck');
    });
  });

  describe('getUnderlyingService', () => {
    it('should return the underlying AI service', () => {
      const underlying = safeAIService.getUnderlyingService();
      expect(underlying).toBe(mockAIService);
    });

    it('should return null when AI service is not initialized', () => {
      (safeAIService as any).aiService = null;
      const underlying = safeAIService.getUnderlyingService();
      expect(underlying).toBeNull();
    });
  });
});