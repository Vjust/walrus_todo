import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AIServiceFactory } from '../../src/services/ai';
import { TaskSuggestionService } from '../../src/services/ai/TaskSuggestionService';
import { AIService } from '../../src/services/ai/aiService';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { createMockAIModelAdapter } from '../mocks/AIModelAdapter.mock';
import { createSampleTodos } from '../helpers/ai-test-utils';
import { Todo } from '../../src/types/todo';

// Mock the AIService
jest.mock('../../src/services/ai/aiService', () => {
  return {
    AIService: jest.fn().mockImplementation(() => ({
      suggest: jest.fn().mockResolvedValue(['Suggested task 1', 'Suggested task 2']),
      prioritize: jest.fn().mockResolvedValue({
        'todo-1': 9,
        'todo-2': 7,
        'todo-3': 5
      }),
      analyze: jest.fn().mockResolvedValue({
        'themes': ['work', 'planning'],
        'bottlenecks': ['dependency on external teams'],
        'workflow': ['start with todo-3', 'then todo-1', 'finally todo-2']
      })
    }))
  };
});

// Mock the AIServiceFactory
jest.mock('../../src/services/ai', () => {
  return {
    AIServiceFactory: {
      createAIService: jest.fn().mockImplementation(() => {
        return new (jest.requireMock('../../src/services/ai/aiService').AIService)();
      })
    }
  };
});

describe('Task Suggestion Service', () => {
  const sampleTodos = createSampleTodos(3);
  let taskSuggestionService: TaskSuggestionService;
  let aiService: AIService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create an instance of AIService with mocked implementation
    aiService = new AIService();
    (AIServiceFactory.createAIService as jest.Mock).mockReturnValue(aiService);
    
    // Create the TaskSuggestionService
    taskSuggestionService = new TaskSuggestionService('mock-api-key');
  });

  // SECTION: Basic suggestion functionality
  describe('Basic Suggestion Functionality', () => {
    it('should initialize with the AIService', () => {
      expect(taskSuggestionService).toBeDefined();
      expect(AIServiceFactory.createAIService).toHaveBeenCalledTimes(1);
    });

    it('should generate task suggestions based on existing todos', async () => {
      const suggestions = await taskSuggestionService.suggestTasks(sampleTodos, 3);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions).toEqual(['Suggested task 1', 'Suggested task 2']);
      expect(aiService.suggest).toHaveBeenCalledTimes(1);
      expect(aiService.suggest).toHaveBeenCalledWith(sampleTodos);
    });

    it('should generate prioritized task suggestions', async () => {
      const suggestions = await taskSuggestionService.suggestPrioritizedTasks(sampleTodos, 3);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Each suggestion should have priority and title
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('title');
        expect(suggestion).toHaveProperty('priority');
      });
      
      expect(aiService.suggest).toHaveBeenCalledTimes(1);
      expect(aiService.prioritize).toHaveBeenCalledTimes(1);
    });
  });

  // SECTION: Advanced suggestion features
  describe('Advanced Suggestion Features', () => {
    it('should generate task workflow suggestions', async () => {
      const workflow = await taskSuggestionService.suggestTaskWorkflow(sampleTodos);
      
      expect(workflow).toBeDefined();
      expect(workflow).toHaveProperty('steps');
      expect(Array.isArray(workflow.steps)).toBe(true);
      expect(workflow.steps.length).toBeGreaterThan(0);
      
      expect(aiService.analyze).toHaveBeenCalledTimes(1);
    });

    it('should identify task bottlenecks', async () => {
      const bottlenecks = await taskSuggestionService.identifyBottlenecks(sampleTodos);
      
      expect(bottlenecks).toBeDefined();
      expect(Array.isArray(bottlenecks)).toBe(true);
      expect(bottlenecks).toEqual(['dependency on external teams']);
      
      expect(aiService.analyze).toHaveBeenCalledTimes(1);
    });

    it('should generate contextual task suggestions', async () => {
      // Mock additional contextual data
      const contextualData = {
        upcomingDeadlines: ['2023-12-25', '2024-01-01'],
        teamAvailability: ['Alice', 'Bob'],
        projectPriorities: ['Launch website', 'Fix critical bugs']
      };
      
      // Mock the analyze method to return contextual suggestions
      (aiService.analyze as jest.Mock).mockResolvedValueOnce({
        'contextualSuggestions': [
          'Schedule a team meeting before Christmas',
          'Assign critical bugs to available team members',
          'Prepare for website launch'
        ]
      });
      
      const suggestions = await taskSuggestionService.suggestContextualTasks(
        sampleTodos,
        contextualData
      );
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions).toEqual([
        'Schedule a team meeting before Christmas',
        'Assign critical bugs to available team members',
        'Prepare for website launch'
      ]);
      
      expect(aiService.analyze).toHaveBeenCalledTimes(1);
      expect(aiService.analyze).toHaveBeenCalledWith(expect.arrayContaining(sampleTodos));
    });
  });

  // SECTION: Custom suggestion types
  describe('Custom Suggestion Types', () => {
    it('should generate time-based task suggestions', async () => {
      // Mock the suggest method to return time-based suggestions
      (aiService.suggest as jest.Mock).mockResolvedValueOnce([
        'Morning: Review emails',
        'Afternoon: Team meeting',
        'Evening: Prepare report'
      ]);
      
      const suggestions = await taskSuggestionService.suggestTimeBasedTasks(
        sampleTodos,
        'workday'
      );
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions).toEqual([
        'Morning: Review emails',
        'Afternoon: Team meeting',
        'Evening: Prepare report'
      ]);
      
      expect(aiService.suggest).toHaveBeenCalledTimes(1);
    });

    it('should generate dependency-aware task suggestions', async () => {
      // Create sample todos with dependencies
      const todosWithDependencies: Todo[] = sampleTodos.map((todo, index) => ({
        ...todo,
        metadata: {
          ...(todo.metadata || {}),
          dependencies: index > 0 ? [`todo-${index}`] : []
        }
      }));
      
      // Mock the analyze method to return dependency analysis
      (aiService.analyze as jest.Mock).mockResolvedValueOnce({
        'dependencyChain': [
          { id: 'todo-1', dependsOn: [] },
          { id: 'todo-2', dependsOn: ['todo-1'] },
          { id: 'todo-3', dependsOn: ['todo-2'] }
        ],
        'dependencySuggestions': [
          'Complete task 1 first',
          'Then work on task 2',
          'Finally complete task 3'
        ]
      });
      
      const suggestions = await taskSuggestionService.suggestDependencyAwareTasks(
        todosWithDependencies
      );
      
      expect(suggestions).toBeDefined();
      expect(suggestions).toHaveProperty('chain');
      expect(suggestions).toHaveProperty('suggestions');
      expect(Array.isArray(suggestions.chain)).toBe(true);
      expect(Array.isArray(suggestions.suggestions)).toBe(true);
      
      expect(aiService.analyze).toHaveBeenCalledTimes(1);
    });
  });

  // SECTION: Error handling and validation
  describe('Error Handling and Validation', () => {
    it('should handle empty todo lists', async () => {
      const suggestions = await taskSuggestionService.suggestTasks([], 3);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
      
      // AIService should not be called with empty todos
      expect(aiService.suggest).not.toHaveBeenCalled();
    });

    it('should handle AIService errors gracefully', async () => {
      // Mock an error in the AIService
      (aiService.suggest as jest.Mock).mockRejectedValueOnce(
        new Error('AI service error')
      );
      
      await expect(
        taskSuggestionService.suggestTasks(sampleTodos, 3)
      ).rejects.toThrow('Failed to generate task suggestions');
    });

    it('should validate suggestion count parameter', async () => {
      await expect(
        taskSuggestionService.suggestTasks(sampleTodos, -1)
      ).rejects.toThrow('Suggestion count must be a positive number');
      
      await expect(
        taskSuggestionService.suggestTasks(sampleTodos, 0)
      ).rejects.toThrow('Suggestion count must be a positive number');
      
      await expect(
        taskSuggestionService.suggestTasks(sampleTodos, 100)
      ).rejects.toThrow('Suggestion count must be less than');
    });
  });
});