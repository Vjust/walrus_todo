/**
 * Unit tests for TaskSuggestionService
 *
 * These tests verify the task generation and suggestion logic of the TaskSuggestionService.
 * They use mocked dependencies and focus on testing the service's behavior in isolation.
 */

import {
  TaskSuggestionService,
  SuggestedTask,
  SuggestionType,
  SuggestionContext,
} from '../../../../apps/cli/src/services/ai/TaskSuggestionService';
import { EnhancedAIService } from '../../../../apps/cli/src/services/ai/EnhancedAIService';
import {
  AIVerificationService,
} from '../../../../apps/cli/src/services/ai/AIVerificationService';
import { Todo } from '../../../../apps/cli/src/types/todo';
import {
  AIPrivacyLevel,
  AIActionType,
} from '../../../../apps/cli/src/types/adapters/AIVerifierAdapter';
import { Logger } from '../../../../apps/cli/src/utils/Logger';

// Mock the dependencies
jest.mock('../../../../apps/cli/src/services/ai/EnhancedAIService');
jest.mock('../../../../apps/cli/src/services/ai/AIVerificationService');
jest.mock('../../../../apps/cli/src/utils/Logger');

describe('TaskSuggestionService', () => {
  let taskSuggestionService: TaskSuggestionService;
  let mockAiService: jest.Mocked<EnhancedAIService>;
  let mockVerificationService: jest.Mocked<AIVerificationService>;
  let mockLogger: jest.Mocked<Logger>;

  // Sample todos for testing
  const sampleTodos: Todo[] = [
    {
      id: '1',
      title: 'Build user authentication',
      description: 'Implement JWT-based authentication system',
      priority: 'high',
      tags: ['backend', 'security'],
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: false,
    },
    {
      id: '2',
      title: 'Design login page',
      description: 'Create responsive login page UI',
      priority: 'medium',
      tags: ['frontend', 'design'],
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: false,
    },
    {
      id: '3',
      title: 'Write API documentation',
      description: 'Document all API endpoints',
      priority: 'medium',
      tags: ['documentation'],
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: false,
    },
  ];

  // Sample suggested tasks for mocking
  const mockRelatedSuggestions: SuggestedTask[] = [
    {
      title: 'Implement password reset functionality',
      description: 'Add password reset flow with email verification',
      priority: 'high',
      score: 85,
      reasoning: 'Related to authentication system',
      tags: ['backend', 'security'],
      type: SuggestionType.RELATED,
      relatedTodoIds: ['1'],
    },
    {
      title: 'Add OAuth integration',
      description: 'Integrate with Google and GitHub OAuth',
      priority: 'medium',
      score: 75,
      reasoning: 'Complements existing authentication',
      tags: ['backend', 'security'],
      type: SuggestionType.RELATED,
      relatedTodoIds: ['1'],
    },
  ];

  const mockNextStepSuggestions: SuggestedTask[] = [
    {
      title: 'Implement session management',
      description: 'Create session handling for authenticated users',
      priority: 'high',
      score: 90,
      reasoning: 'Natural next step after authentication',
      tags: ['backend'],
      type: SuggestionType.NEXT_STEP,
      relatedTodoIds: ['1'],
    },
    {
      title: 'Create user dashboard',
      description: 'Build dashboard for authenticated users',
      priority: 'medium',
      score: 80,
      reasoning: 'Next logical UI component after login',
      tags: ['frontend'],
      type: SuggestionType.NEXT_STEP,
      relatedTodoIds: ['2'],
    },
  ];

  const mockDependencySuggestions: SuggestedTask[] = [
    {
      title: 'Set up testing framework',
      description: 'Configure Jest and testing environment',
      priority: 'high',
      score: 95,
      reasoning: 'Required before writing tests for authentication',
      tags: ['testing', 'infrastructure'],
      type: SuggestionType.DEPENDENCY,
      relatedTodoIds: ['1', '3'],
    },
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    const mockProvider = {
      completeStructured: jest.fn(),
    };

    mockAiService = {
      getProvider: jest.fn().mockReturnValue(mockProvider),
      detectDependencies: jest.fn(),
      analyze: jest.fn(),
    } as unknown as jest.Mocked<EnhancedAIService>;

    mockVerificationService = {
      createVerification: jest.fn(),
    } as unknown as jest.Mocked<AIVerificationService>;

    // Create service instance with mocked logger for Jest isolation
    taskSuggestionService = new TaskSuggestionService(
      mockAiService,
      mockVerificationService,
      mockLogger
    );
  });

  describe('Basic Functionality', () => {
    it('should create a TaskSuggestionService instance', () => {
      expect(taskSuggestionService).toBeDefined();
      expect(taskSuggestionService).toBeInstanceOf(TaskSuggestionService);
    });

    it('should initialize without verification service', () => {
      const serviceWithoutVerification = new TaskSuggestionService(
        mockAiService,
        undefined,
        mockLogger
      );
      expect(serviceWithoutVerification).toBeDefined();
    });
  });

  describe('suggestTasks', () => {
    beforeEach(() => {
      // Mock AI provider responses
      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: mockRelatedSuggestions })
        .mockResolvedValueOnce({ result: mockNextStepSuggestions })
        .mockResolvedValueOnce({ result: mockDependencySuggestions });

      // Mock dependency detection
      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {
          '1': [],
          '2': ['1'],
          '3': ['1', '2'],
        },
        errors: [],
      });

      // Mock AI analysis
      mockAiService.analyze.mockResolvedValue({
        summary: 'Development tasks',
        categorization: ['backend', 'frontend', 'documentation'],
        priorities: { high: 1, medium: 2, low: 0 },
        insights: [],
        keyThemes: ['authentication', 'UI', 'documentation'],
        completionAnalysis: {
          completedCount: 1,
          totalCount: 3,
          completionPercentage: 33.33,
        },
      });
    });

    it('should generate task suggestions with all types', async () => {
      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      expect(result).toBeDefined();
      expect(result.suggestions).toHaveLength(5); // 2 related + 2 next step + 1 dependency
      expect(result.contextInfo).toBeDefined();
      expect(result.metrics).toBeDefined();

      // Verify all suggestion types are present
      const types = new Set(result.suggestions.map(s => s.type));
      expect(types.has(SuggestionType.RELATED)).toBe(true);
      expect(types.has(SuggestionType.NEXT_STEP)).toBe(true);
      expect(types.has(SuggestionType.DEPENDENCY)).toBe(true);
    });

    it('should sort suggestions by score in descending order', async () => {
      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      const scores = result.suggestions.map(s => s.score);
      const sortedScores = [...scores].sort((a, b) => b - a);
      expect(scores).toEqual(sortedScores);
    });

    it('should calculate correct context information', async () => {
      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      expect(result.contextInfo.analyzedTodoCount).toBe(3);
      expect(result.contextInfo.completionPercentage).toBeCloseTo(33.33, 2);
      expect(result.contextInfo.topContextualTags).toContain('backend');
      expect(result.contextInfo.detectedThemes).toEqual([
        'authentication',
        'UI',
        'documentation',
      ]);
    });

    it('should calculate correct metrics', async () => {
      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      expect(result.metrics.averageScore).toBeCloseTo(85, 1);
      expect(result.metrics.suggestionsByType[SuggestionType.RELATED]).toBe(2);
      expect(result.metrics.suggestionsByType[SuggestionType.NEXT_STEP]).toBe(
        2
      );
      expect(result.metrics.suggestionsByType[SuggestionType.DEPENDENCY]).toBe(
        1
      );
    });

    it('should handle empty todo list', async () => {
      // Reset mocks for this specific test
      jest.clearAllMocks();

      // Set up mocks for empty todo list (should return empty results)
      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>).mockResolvedValue({
        result: [],
      });

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {},
        errors: [],
      });

      mockAiService.analyze.mockResolvedValue({
        summary: 'No tasks',
        categorization: [],
        priorities: {},
        insights: [],
        keyThemes: [],
      });

      const result = await taskSuggestionService.suggestTasks([]);

      expect(result.suggestions).toHaveLength(0);
      expect(result.contextInfo.analyzedTodoCount).toBe(0);
      expect(result.contextInfo.completionPercentage).toBe(0);
    });

    it('should handle AI service errors gracefully', async () => {
      // Create a new service instance with a failing AI service for this test
      const failingAiService = {
        getProvider: () => ({
          completeStructured: jest
            .fn()
            .mockRejectedValue(new Error('AI service error')),
        }),
      };

      const failingTaskSuggestionService = new TaskSuggestionService(
        failingAiService as jest.Mocked<EnhancedAIService>,
        undefined,
        mockLogger
      );

      await expect(
        failingTaskSuggestionService.suggestTasks(sampleTodos)
      ).rejects.toThrow('Failed to generate task suggestions');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('suggestTasks with context filters', () => {
    beforeEach(() => {
      // Mock AI provider responses with diverse suggestions

      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: mockRelatedSuggestions })
        .mockResolvedValueOnce({ result: mockNextStepSuggestions })
        .mockResolvedValueOnce({ result: mockDependencySuggestions });

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {},
        errors: [],
      });

      mockAiService.analyze.mockResolvedValue({
        summary: 'Tasks',
        categorization: ['backend', 'frontend'],
        priorities: {},
        insights: [],
        keyThemes: ['development'],
      });
    });

    it('should filter by include types', async () => {
      const context: SuggestionContext = {
        includeTypes: [SuggestionType.RELATED],
      };

      const result = await taskSuggestionService.suggestTasks(
        sampleTodos,
        context
      );

      expect(result.suggestions).toHaveLength(2);
      expect(
        result.suggestions.every(s => s.type === SuggestionType.RELATED)
      ).toBe(true);
    });

    it('should filter by exclude types', async () => {
      const context: SuggestionContext = {
        excludeTypes: [SuggestionType.DEPENDENCY],
      };

      const result = await taskSuggestionService.suggestTasks(
        sampleTodos,
        context
      );

      expect(
        result.suggestions.every(s => s.type !== SuggestionType.DEPENDENCY)
      ).toBe(true);
    });

    it('should filter by minimum score', async () => {
      const context: SuggestionContext = {
        minScore: 80,
      };

      const result = await taskSuggestionService.suggestTasks(
        sampleTodos,
        context
      );

      expect(result.suggestions.every(s => s.score >= 80)).toBe(true);
    });

    it('should filter by priority', async () => {
      const context: SuggestionContext = {
        priorityFilter: ['high'],
      };

      const result = await taskSuggestionService.suggestTasks(
        sampleTodos,
        context
      );

      expect(result.suggestions.every(s => s.priority === 'high')).toBe(true);
    });

    it('should filter by tags', async () => {
      const context: SuggestionContext = {
        tags: ['backend'],
      };

      const result = await taskSuggestionService.suggestTasks(
        sampleTodos,
        context
      );

      expect(result.suggestions.every(s => s.tags?.includes('backend'))).toBe(
        true
      );
    });

    it('should limit results by maxResults', async () => {
      const context: SuggestionContext = {
        maxResults: 3,
      };

      const result = await taskSuggestionService.suggestTasks(
        sampleTodos,
        context
      );

      expect(result.suggestions).toHaveLength(3);
    });

    it('should apply multiple filters together', async () => {
      const context: SuggestionContext = {
        includeTypes: [SuggestionType.RELATED, SuggestionType.NEXT_STEP],
        minScore: 80,
        priorityFilter: ['high'],
        maxResults: 2,
      };

      const result = await taskSuggestionService.suggestTasks(
        sampleTodos,
        context
      );

      expect(result.suggestions).toHaveLength(2);
      expect(
        result.suggestions.every(
          s =>
            (s.type === SuggestionType.RELATED ||
              s.type === SuggestionType.NEXT_STEP) &&
            s.score >= 80 &&
            s.priority === 'high'
        )
      ).toBe(true);
    });
  });

  describe('suggestTasksWithVerification', () => {
    beforeEach(() => {
      // Mock basic AI responses
      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: mockRelatedSuggestions })
        .mockResolvedValueOnce({ result: mockNextStepSuggestions })
        .mockResolvedValueOnce({ result: mockDependencySuggestions });

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {},
        errors: [],
      });

      mockAiService.analyze.mockResolvedValue({
        summary: 'Tasks',
        categorization: [],
        priorities: {},
        insights: [],
        keyThemes: [],
      });
    });

    it('should generate suggestions with blockchain verification', async () => {
      const mockVerificationResult = {
        blockchainRecordId: 'verification-123',
        timestamp: Date.now(),
        status: 'verified',
      };

      mockVerificationService.createVerification.mockResolvedValue(
        mockVerificationResult
      );

      const result = await taskSuggestionService.suggestTasksWithVerification(
        sampleTodos,
        {},
        AIPrivacyLevel.HASH_ONLY
      );

      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.verification).toEqual(mockVerificationResult);

      // Verify createVerification was called with correct parameters
      expect(mockVerificationService.createVerification).toHaveBeenCalledWith(
        AIActionType.SUGGEST,
        { todos: sampleTodos, context: {} },
        expect.objectContaining({
          suggestions: expect.any(Array),
          contextInfo: expect.any(Object),
          metrics: expect.any(Object),
        }),
        expect.objectContaining({
          todoCount: '3',
          suggestionCount: '5',
          averageScore: expect.any(String),
          timestamp: expect.any(String),
          contextFilters: '{}',
        }),
        AIPrivacyLevel.HASH_ONLY
      );
    });

    it('should throw error if verification service is not initialized', async () => {
      const serviceWithoutVerification = new TaskSuggestionService(
        mockAiService,
        undefined,
        mockLogger
      );

      await expect(
        serviceWithoutVerification.suggestTasksWithVerification(sampleTodos)
      ).rejects.toThrow('Verification service not initialized');
    });

    it('should pass context filters to verification metadata', async () => {
      const context: SuggestionContext = {
        includeTypes: [SuggestionType.RELATED],
        minScore: 80,
      };

      mockVerificationService.createVerification.mockResolvedValue({
        blockchainRecordId: 'verification-123',
        timestamp: Date.now(),
        status: 'verified',
      });

      await taskSuggestionService.suggestTasksWithVerification(
        sampleTodos,
        context,
        AIPrivacyLevel.HASH_ONLY
      );

      expect(mockVerificationService.createVerification).toHaveBeenCalledWith(
        AIActionType.SUGGEST,
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          contextFilters: JSON.stringify(context),
        }),
        AIPrivacyLevel.HASH_ONLY
      );
    });
  });

  describe('Private methods behavior', () => {
    it('should handle AI analysis errors in context analysis', async () => {
      mockAiService.analyze.mockRejectedValue(new Error('Analysis failed'));

      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] });

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {},
        errors: [],
      });

      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      expect(result.contextInfo.detectedThemes).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error analyzing context')
      );
    });

    it('should handle dependency detection for next step suggestions', async () => {
      const todosWithCompleted = [
        ...sampleTodos,
        {
          id: '4',
          title: 'Setup database',
          description: 'Initialize PostgreSQL',
          priority: 'high' as const,
          tags: ['backend', 'database'],
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          private: false,
        },
      ];

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {
          '1': ['4'], // Authentication depends on database
          '2': [],
          '3': ['1', '2'],
          '4': [],
        },
        errors: [],
      });

      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: mockNextStepSuggestions })
        .mockResolvedValueOnce({ result: [] });

      mockAiService.analyze.mockResolvedValue({
        summary: 'Tasks',
        categorization: [],
        priorities: {},
        insights: [],
        keyThemes: [],
      });

      const result =
        await taskSuggestionService.suggestTasks(todosWithCompleted);

      // Should include next step suggestions since we have completed todos
      expect(
        result.suggestions.some(s => s.type === SuggestionType.NEXT_STEP)
      ).toBe(true);
    });

    it('should handle todos without dependencies for dependency suggestions', async () => {
      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {
          '1': [],
          '2': [],
          '3': [],
        },
        errors: [],
      });

      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: mockDependencySuggestions });

      mockAiService.analyze.mockResolvedValue({
        summary: 'Tasks',
        categorization: [],
        priorities: {},
        insights: [],
        keyThemes: [],
      });

      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      // Should include dependency suggestions for todos without dependencies
      expect(
        result.suggestions.some(s => s.type === SuggestionType.DEPENDENCY)
      ).toBe(true);
    });

    it('should handle AI provider returning null result', async () => {
      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: null })
        .mockResolvedValueOnce({ result: undefined })
        .mockResolvedValueOnce({ result: null });

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {},
        errors: [],
      });

      mockAiService.analyze.mockResolvedValue({
        summary: 'Tasks',
        categorization: [],
        priorities: {},
        insights: [],
        keyThemes: [],
      });

      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      expect(result.suggestions).toEqual([]);
      expect(result.metrics.averageScore).toBe(0);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle todos with no tags gracefully', async () => {
      const todosWithoutTags: Todo[] = [
        {
          id: '1',
          title: 'Task without tags',
          description: 'A task with no tags',
          priority: 'medium',
          tags: [],
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          private: false,
        },
      ];

      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] });

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {},
        errors: [],
      });

      mockAiService.analyze.mockResolvedValue({
        summary: 'Tasks',
        categorization: [],
        priorities: {},
        insights: [],
        keyThemes: [],
      });

      const result = await taskSuggestionService.suggestTasks(todosWithoutTags);

      expect(result.contextInfo.topContextualTags).toEqual([]);
    });

    it('should handle suggestions with missing optional fields', async () => {
      const incompleteSuggestions: SuggestedTask[] = [
        {
          title: 'Minimal suggestion',
          score: 70,
          reasoning: 'A minimal suggestion',
          type: SuggestionType.RELATED,
        },
      ];

      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: incompleteSuggestions })
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] });

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {},
        errors: [],
      });

      mockAiService.analyze.mockResolvedValue({
        summary: 'Tasks',
        categorization: [],
        priorities: {},
        insights: [],
        keyThemes: [],
      });

      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].description).toBeUndefined();
      expect(result.suggestions[0].priority).toBeUndefined();
      expect(result.suggestions[0].tags).toBeUndefined();
    });

    it('should handle non-array themes from AI analysis', async () => {
      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] });

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {},
        errors: [],
      });

      mockAiService.analyze.mockResolvedValue({
        summary: 'Tasks',
        categorization: [],
        priorities: {},
        insights: [],
        keyThemes: [] as string[],
        categories: undefined,
      });

      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      expect(result.contextInfo.detectedThemes).toEqual([]);
    });

    it('should calculate zero average score for empty suggestions', async () => {
      const provider = mockAiService.getProvider();
      (provider.completeStructured as jest.MockedFunction<typeof provider.completeStructured>)
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: [] });

      mockAiService.detectDependencies.mockResolvedValue({
        dependencies: {},
        errors: [],
      });

      mockAiService.analyze.mockResolvedValue({
        summary: 'Tasks',
        categorization: [],
        priorities: {},
        insights: [],
        keyThemes: [],
      });

      const result = await taskSuggestionService.suggestTasks(sampleTodos);

      expect(result.metrics.averageScore).toBe(0);
      expect(
        Object.values(result.metrics.suggestionsByType).every(
          count => count === 0
        )
      ).toBe(true);
    });
  });
});
