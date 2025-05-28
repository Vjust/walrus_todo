import * as fs from 'fs';
import { Config } from '@oclif/core';

// Mock WASM and Walrus modules early to prevent loading errors
jest.mock('@mysten/walrus-wasm', () => ({
  WalrusClient: class MockWalrusClient {},
  init: jest.fn().mockResolvedValue(true),
  default: jest.fn(),
}));

jest.mock('@mysten/walrus', () => ({
  WalrusClient: class MockWalrusClient {},
  default: jest.fn(),
}));

// Mock vault and credential services
jest.mock('../../apps/cli/src/utils/EnhancedVaultManager', () => ({
  EnhancedVaultManager: jest.fn().mockImplementation(() => ({
    initializeVault: jest.fn().mockResolvedValue(true),
    isVaultLocked: jest.fn().mockReturnValue(false),
    unlockVault: jest.fn().mockResolvedValue(true),
    getCredential: jest.fn().mockResolvedValue({ apiKey: 'mock-api-key' }),
    storeCredential: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../apps/cli/src/services/ai/SecureCredentialService', () => ({
  SecureCredentialService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-api-key' }),
    storeCredentials: jest.fn().mockResolvedValue(true),
  })),
  secureCredentialService: {
    initialize: jest.fn().mockResolvedValue(true),
    getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-api-key' }),
    storeCredentials: jest.fn().mockResolvedValue(true),
  },
}));

// Now import the modules after mocking
import { AIService } from '../../apps/cli/src/services/ai/aiService';
import { TaskSuggestionService } from '../../apps/cli/src/services/ai/TaskSuggestionService';
import { TodoService } from '../../apps/cli/src/services/todoService';
import AICommand from '../../apps/cli/src/commands/ai';
import { runCommandInTest } from '../../apps/cli/src/__tests__/helpers/command-test-utils';

function createValidConfig(): Partial<Config> {
  return {
    root: '/test',
    name: 'test',
    version: '1.0.0',
    userAgent: 'test-cli',
    channel: 'stable',
    pjson: {
      name: 'test',
      version: '1.0.0',
      oclif: {},
      dependencies: {},
    } as any,
    arch: 'x64',
    platform: 'linux',
    shell: 'bash',
    home: '/home/test',
    debug: 0,
    npmRegistry: 'https://registry.npmjs.org',
  };
}

// Mock the AI services module
jest.mock('../../apps/cli/src/services/ai', () => {
  const mockAIService = {
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
    setProvider: jest.fn().mockResolvedValue(true),
    getProvider: jest.fn().mockReturnValue('xai'),
    isAvailable: jest.fn().mockReturnValue(true),
    suggestTags: jest.fn().mockResolvedValue(['work', 'project']),
    suggestPriority: jest.fn().mockResolvedValue('medium'),
    cancelAllOperations: jest.fn(),
  };

  return {
    aiService: mockAIService,
    secureCredentialService: {
      initialize: jest.fn().mockResolvedValue(true),
      getCredentials: jest.fn().mockResolvedValue({ apiKey: 'mock-api-key' }),
      storeCredentials: jest.fn().mockResolvedValue(true),
    },
    AIService: jest.fn().mockImplementation(() => mockAIService),
  };
});

// Mock the AIService class separately for compatibility
jest.mock('../../apps/cli/src/services/ai/aiService', () => {
  return {
    AIService: jest.fn().mockImplementation(() => ({
      summarize: jest.fn().mockResolvedValue('Mock summary of your todos'),
      setProvider: jest.fn().mockResolvedValue(true),
      getProvider: jest.fn().mockReturnValue('xai'),
      isAvailable: jest.fn().mockReturnValue(true),
      cancelAllOperations: jest.fn(),
    })),
  };
});

// Mock the TaskSuggestionService
jest.mock('../../apps/cli/src/services/ai/TaskSuggestionService', () => {
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
        { title: 'Create project documentation', priority: 'high' as const },
        { title: 'Schedule weekly team meeting', priority: 'medium' as const },
        { title: 'Review pull requests', priority: 'medium' as const },
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
jest.mock('../../apps/cli/src/services/todoService', () => {
  const mockSampleTodos = [
    {
      id: 'mock-todo-1',
      title: 'Sample Todo 1',
      description: 'First mock todo',
      completed: false,
      priority: 'high',
      tags: ['work'],
      private: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mock-todo-2',
      title: 'Sample Todo 2',
      description: 'Second mock todo',
      completed: false,
      priority: 'medium',
      tags: ['personal'],
      private: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mock-todo-3',
      title: 'Sample Todo 3',
      description: 'Third mock todo',
      completed: true,
      priority: 'low',
      tags: ['task'],
      private: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return {
    TodoService: jest.fn().mockImplementation(() => ({
      getAllTodos: jest.fn().mockResolvedValue(mockSampleTodos),
      listTodos: jest.fn().mockResolvedValue(mockSampleTodos),
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
        .mockResolvedValue(mockSampleTodos.filter(todo => !todo.completed)),
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
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  // SECTION: Summarize command tests
  describe('ai summarize command', () => {
    it('should summarize todos', async () => {
      const { output } = await runCommandInTest(
        AICommand,
        ['summarize'],
        {},
        { operation: 'summarize' }
      );

      expect(output.join(' ')).toContain('Mock summary of your todos');
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should handle API key from flag', async () => {
      const { output } = await runCommandInTest(
        AICommand,
        ['summarize'],
        { apiKey: 'test-api-key' },
        { operation: 'summarize' }
      );

      expect(output.join(' ')).toContain('Mock summary of your todos');
      expect(AIService).toHaveBeenCalled();
    });

    it('should handle specific provider option', async () => {
      const { output } = await runCommandInTest(
        AICommand,
        ['summarize'],
        { provider: 'openai' },
        { operation: 'summarize' }
      );

      expect(output.join(' ')).toContain('Mock summary of your todos');
      expect(AIService).toHaveBeenCalled();
    });
  });

  // SECTION: Categorize command tests
  describe('ai categorize command', () => {
    it('should categorize todos', async () => {
      const { output } = await runCommandInTest(
        AICommand,
        ['categorize'],
        {},
        { operation: 'categorize' }
      );

      expect(output.join(' ')).toContain('work');
      expect(output.join(' ')).toContain('personal');
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should output in JSON format when specified', async () => {
      const { output } = await runCommandInTest(
        AICommand,
        ['categorize'],
        { format: 'json' },
        { operation: 'categorize' }
      );

      expect(output.join(' ')).toContain('"work":');
      expect(output.join(' ')).toContain('"personal":');
    });
  });

  // SECTION: Prioritize command tests
  describe('ai prioritize command', () => {
    it('should prioritize todos', async () => {
      const { output } = await runCommandInTest(
        AICommand,
        ['prioritize'],
        {},
        { operation: 'prioritize' }
      );

      expect(output.join(' ')).toContain('Priority');
      expect(output.join(' ')).toContain('todo-1');
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should output only high priority todos when specified', async () => {
      const { output } = await runCommandInTest(
        AICommand,
        ['prioritize'],
        { threshold: '8' },
        { operation: 'prioritize' }
      );

      expect(output.join(' ')).toContain('todo-1');
      expect(output.join(' ')).not.toContain('todo-3');
    });
  });

  // SECTION: Suggest command tests
  describe('ai suggest command', () => {
    it('should suggest new todos', async () => {
      const command = new AICommand(['suggest'], createValidConfig() as Config);
      await command.run();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Create project documentation')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Schedule weekly team meeting')
      );
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should create suggested todos when requested', async () => {
      const command = new AICommand(
        ['suggest', '--create'],
        createValidConfig() as Config
      );
      await command.run();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Created new todo')
      );
      const mockTodoService = (
        TodoService as jest.MockedClass<typeof TodoService>
      ).mock.results[0]?.value;
      expect(mockTodoService?.createTodo).toHaveBeenCalled();
    });

    it('should limit suggestions when count is specified', async () => {
      const command = new AICommand(
        ['suggest', '--count=2'],
        createValidConfig() as Config
      );
      await command.run();

      expect(console.log).toHaveBeenCalled();
      expect(AIService).toHaveBeenCalled();
    });
  });

  // SECTION: Analyze command tests
  describe('ai analyze command', () => {
    it('should analyze todos', async () => {
      const command = new AICommand(['analyze'], createValidConfig() as Config);
      await command.run();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Themes')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Bottlenecks')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Time Estimates')
      );
      expect(AIService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });

    it('should focus on specific analysis when specified', async () => {
      const command = new AICommand(
        ['analyze', '--focus=timeEstimates'],
        createValidConfig() as Config
      );
      await command.run();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Time Estimates')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('5 days')
      );
    });
  });

  // SECTION: Workflow suggestion tests
  describe('ai workflow command', () => {
    it('should suggest a workflow for todos', async () => {
      const command = new AICommand(
        ['workflow'],
        createValidConfig() as Config
      );
      await command.run();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Suggested Workflow')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('First')
      );
      expect(TaskSuggestionService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });
  });

  // SECTION: Bottleneck identification tests
  describe('ai bottlenecks command', () => {
    it('should identify bottlenecks in todos', async () => {
      const command = new AICommand(
        ['bottlenecks'],
        createValidConfig() as Config
      );
      await command.run();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Identified Bottlenecks')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('waiting for approvals')
      );
      expect(TaskSuggestionService).toHaveBeenCalled();
      expect(TodoService).toHaveBeenCalled();
    });
  });

  // SECTION: Configuration tests
  describe('ai configure command', () => {
    it('should set AI configuration options', async () => {
      const command = new AICommand(
        ['configure', '--provider=openai', '--apiKey=new-api-key'],
        createValidConfig() as Config
      );
      await command.run();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('AI configuration updated')
      );
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should display current configuration', async () => {
      const command = new AICommand(
        ['configure', '--show'],
        createValidConfig() as Config
      );
      await command.run();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Current AI Configuration')
      );
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

      await expect(
        runCommandInTest(
          AICommand,
          ['summarize'],
          {},
          { operation: 'summarize' }
        )
      ).rejects.toThrow('API key is required');
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

      await expect(
        runCommandInTest(
          AICommand,
          ['summarize'],
          {},
          { operation: 'summarize' }
        )
      ).rejects.toThrow('AI service error');
    });
  });
});
