import * as fs from 'fs';
import { AIService } from '../../src/services/ai/aiService';
import { TaskSuggestionService } from '../../src/services/ai/TaskSuggestionService';
import { createSampleTodos } from '../helpers/ai-test-utils';
import { TodoService } from '../../src/services/todoService';
import AICommand from '../../src/commands/ai';
// Helper function to create a mock config object for testing
interface TestConfig {
  [key: string]: unknown;
}

function createValidConfig(): TestConfig {
  return {};
}

// Mock the AIService
jest.mock('../../src/services/ai/aiService', () => {
  return {
    AIService: jest.fn().mockImplementation(() => ({
      summarize: jest.fn().mockResolvedValue('Mock summary of your todos'),
      categorize: jest.fn().mockResolvedValue({
        work: ['todo-1'],
        personal: ['todo-2', 'todo-3'],
      }),
      prioritize: jest.fn().mockResolvedValue({
        'todo-1': 9,
        'todo-2': 7,
        'todo-3': 4,
      }),
      suggest: jest
        .fn()
        .mockResolvedValue([
          'Create project documentation',
          'Schedule weekly team meeting',
          'Review pull requests',
        ]),
      analyze: jest.fn().mockResolvedValue({
        themes: ['productivity', 'project management'],
        bottlenecks: ['waiting for approvals'],
        timeEstimates: {
          total: '5 days',
          breakdown: {
            'todo-1': '2 days',
            'todo-2': '2 days',
            'todo-3': '1 day',
          },
        },
      }),
    })),
  };
});

// Mock the TaskSuggestionService
jest.mock('../../src/services/ai/TaskSuggestionService', () => {
  return {
    TaskSuggestionService: jest.fn().mockImplementation(() => ({
      suggestTasks: jest
        .fn()
        .mockResolvedValue([
          'Create project documentation',
          'Schedule weekly team meeting',
          'Review pull requests',
        ]),
      suggestPrioritizedTasks: jest.fn().mockResolvedValue([
        { title: 'Create project documentation', priority: 'high' },
        { title: 'Schedule weekly team meeting', priority: 'medium' },
        { title: 'Review pull requests', priority: 'medium' },
      ]),
      suggestTaskWorkflow: jest.fn().mockResolvedValue({
        steps: [
          'First, review pull requests',
          'Then, create project documentation',
          'Finally, schedule weekly team meeting',
        ],
      }),
      identifyBottlenecks: jest
        .fn()
        .mockResolvedValue([
          'waiting for approvals',
          'dependency on external teams',
        ]),
    })),
  };
});

// Mock the TodoService
jest.mock('../../src/services/todoService', () => {
  const sampleTodos = createSampleTodos(3);

  return {
    TodoService: jest.fn().mockImplementation(() => ({
      getAllTodos: jest.fn().mockResolvedValue(sampleTodos),
      createTodo: jest.fn().mockImplementation(todo => {
        return Promise.resolve({
          id: 'new-todo-' + Date.now(),
          ...todo,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }),
      getActiveTodos: jest
        .fn()
        .mockResolvedValue(sampleTodos.filter(todo => !todo.completed)),
    })),
  };
});

// Mock fs for configuration and output
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockImplementation(path => {
      if (path.includes('config.json')) {
        return JSON.stringify({
          aiProvider: 'xai',
          apiKey: 'mock-api-key',
        });
      }
      return '{}';
    }),
    writeFileSync: jest.fn(),
  };
});

describe('AI Command Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to prevent output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // SECTION: Summarize command tests
  describe('ai summarize command', () => {
    it('should summarize todos', async () => {
      const command = new AICommand(['summarize'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Mock summary of your todos'));
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should handle API key from flag', async () => {
      const command = new AICommand(['summarize', '--apiKey=test-api-key'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Mock summary of your todos'));
      expect(AIService).toHaveBeenCalled();
    });

    it('should handle specific provider option', async () => {
      const command = new AICommand(['summarize', '--provider=openai'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Mock summary of your todos'));
      expect(AIService).toHaveBeenCalled();
    });
  });

  // SECTION: Categorize command tests
  describe('ai categorize command', () => {
    it('should categorize todos', async () => {
      const command = new AICommand(['categorize'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('work'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('personal'));
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should output in JSON format when specified', async () => {
      const command = new AICommand(['categorize', '--format=json'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"work":'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"personal":'));
    });
  });

  // SECTION: Prioritize command tests
  describe('ai prioritize command', () => {
    it('should prioritize todos', async () => {
      const command = new AICommand(['prioritize'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Priority'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('todo-1'));
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should output only high priority todos when specified', async () => {
      const command = new AICommand(['prioritize', '--threshold=8'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('todo-1'));
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('todo-3'));
    });
  });

  // SECTION: Suggest command tests
  describe('ai suggest command', () => {
    it('should suggest new todos', async () => {
      const command = new AICommand(['suggest'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Create project documentation'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Schedule weekly team meeting'));
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should create suggested todos when requested', async () => {
      const command = new AICommand(['suggest', '--create'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Created new todo'));
      const mockTodoService = TodoService.mock.results[0].value;
      expect(mockTodoService.createTodo).toHaveBeenCalled();
    });

    it('should limit suggestions when count is specified', async () => {
      const command = new AICommand(['suggest', '--count=2'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalled();
      expect(AIService).toHaveBeenCalled();
    });
  });

  // SECTION: Analyze command tests
  describe('ai analyze command', () => {
    it('should analyze todos', async () => {
      const command = new AICommand(['analyze'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Themes'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Bottlenecks'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Time Estimates'));
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should focus on specific analysis when specified', async () => {
      const command = new AICommand(['analyze', '--focus=timeEstimates'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Time Estimates'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('5 days'));
    });
  });

  // SECTION: Workflow suggestion tests
  describe('ai workflow command', () => {
    it('should suggest a workflow for todos', async () => {
      const command = new AICommand(['workflow'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Suggested Workflow'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('First'));
      expect(TaskSuggestionService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });
  });

  // SECTION: Bottleneck identification tests
  describe('ai bottlenecks command', () => {
    it('should identify bottlenecks in todos', async () => {
      const command = new AICommand(['bottlenecks'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Identified Bottlenecks'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('waiting for approvals'));
      expect(TaskSuggestionService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });
  });

  // SECTION: Configuration tests
  describe('ai configure command', () => {
    it('should set AI configuration options', async () => {
      const command = new AICommand(
        ['configure', '--provider=openai', '--apiKey=new-api-key'],
        createValidConfig()
      );
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('AI configuration updated'));
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should display current configuration', async () => {
      const command = new AICommand(['configure', '--show'], createValidConfig());
      await command.run();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Current AI Configuration'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('xai'));
      expect(fs.readFileSync).toHaveBeenCalled();
    });
  });

  // SECTION: Error handling tests
  describe('Error handling in commands', () => {
    it('should handle missing API key gracefully', async () => {
      // Mock readFileSync to return config without API key
      (fs.readFileSync as jest.Mock) = jest.fn().mockImplementation(() => {
        return JSON.stringify({ aiProvider: 'xai' });
      });

      // Mock AIService to throw an error
      (AIService as jest.Mock).mockImplementationOnce(() => {
        throw new Error('API key is required');
      });

      const command = new AICommand(['summarize'], createValidConfig());
      await expect(command.run()).rejects.toThrow('API key is required');
    });

    it('should handle AI service errors gracefully', async () => {
      // Mock AIService to throw after initialization
      const mockSummarize = jest
        .fn()
        .mockRejectedValue(new Error('AI service error'));
      (AIService as jest.Mock).mockImplementationOnce(() => ({
        summarize: mockSummarize,
        categorize: jest.fn(),
        prioritize: jest.fn(),
        suggest: jest.fn(),
        analyze: jest.fn(),
      }));

      const command = new AICommand(['summarize'], createValidConfig());
      await expect(command.run()).rejects.toThrow('AI service error');
    });
  });
});
