import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { test } from '@oclif/test';
import * as fs from 'fs';
import * as path from 'path';
import { AIService } from '../../src/services/ai/aiService';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { TaskSuggestionService } from '../../src/services/ai/TaskSuggestionService';
import { createSampleTodos } from '../helpers/ai-test-utils';
import { Todo } from '../../src/types/todo';
import { TodoService } from '../../src/services/todoService';

// Mock the AIService
jest.mock('../../src/services/ai/aiService', () => {
  return {
    AIService: jest.fn().mockImplementation(() => ({
      summarize: jest.fn().mockResolvedValue('Mock summary of your todos'),
      categorize: jest.fn().mockResolvedValue({
        'work': ['todo-1'],
        'personal': ['todo-2', 'todo-3']
      }),
      prioritize: jest.fn().mockResolvedValue({
        'todo-1': 9,
        'todo-2': 7,
        'todo-3': 4
      }),
      suggest: jest.fn().mockResolvedValue([
        'Create project documentation',
        'Schedule weekly team meeting',
        'Review pull requests'
      ]),
      analyze: jest.fn().mockResolvedValue({
        'themes': ['productivity', 'project management'],
        'bottlenecks': ['waiting for approvals'],
        'timeEstimates': {
          'total': '5 days',
          'breakdown': {
            'todo-1': '2 days',
            'todo-2': '2 days',
            'todo-3': '1 day'
          }
        }
      })
    }))
  };
});

// Mock the TaskSuggestionService
jest.mock('../../src/services/ai/TaskSuggestionService', () => {
  return {
    TaskSuggestionService: jest.fn().mockImplementation(() => ({
      suggestTasks: jest.fn().mockResolvedValue([
        'Create project documentation',
        'Schedule weekly team meeting',
        'Review pull requests'
      ]),
      suggestPrioritizedTasks: jest.fn().mockResolvedValue([
        { title: 'Create project documentation', priority: 'high' },
        { title: 'Schedule weekly team meeting', priority: 'medium' },
        { title: 'Review pull requests', priority: 'medium' }
      ]),
      suggestTaskWorkflow: jest.fn().mockResolvedValue({
        steps: [
          'First, review pull requests',
          'Then, create project documentation',
          'Finally, schedule weekly team meeting'
        ]
      }),
      identifyBottlenecks: jest.fn().mockResolvedValue([
        'waiting for approvals',
        'dependency on external teams'
      ])
    }))
  };
});

// Mock the TodoService
jest.mock('../../src/services/todoService', () => {
  const sampleTodos = createSampleTodos(3);
  
  return {
    TodoService: jest.fn().mockImplementation(() => ({
      getAllTodos: jest.fn().mockResolvedValue(sampleTodos),
      createTodo: jest.fn().mockImplementation((todo) => {
        return Promise.resolve({
          id: 'new-todo-' + Date.now(),
          ...todo,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }),
      getActiveTodos: jest.fn().mockResolvedValue(
        sampleTodos.filter(todo => !todo.completed)
      )
    }))
  };
});

// Mock fs for configuration and output
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockImplementation((path) => {
      if (path.includes('config.json')) {
        return JSON.stringify({
          aiProvider: 'xai',
          apiKey: 'mock-api-key'
        });
      }
      return '{}';
    }),
    writeFileSync: jest.fn()
  };
});

describe('AI Command Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // SECTION: Summarize command tests
  describe('ai:summarize command', () => {
    it('should summarize todos', () => {
      return test
        .stdout()
        .command(['ai:summarize'])
        .it('runs ai:summarize', (ctx) => {
          expect(ctx.stdout).to.contain('Mock summary of your todos');
          expect(AIService).toHaveBeenCalled();
          expect(TodoService).toHaveBeenCalled();
        });
    });

    it('should handle API key from flag', () => {
      return test
        .stdout()
        .command(['ai:summarize', '--apiKey=test-api-key'])
        .it('runs ai:summarize with API key flag', (ctx) => {
          expect(ctx.stdout).to.contain('Mock summary of your todos');
          expect(AIService).toHaveBeenCalledWith(
            'test-api-key',
            expect.anything(),
            expect.anything(),
            expect.anything()
          );
        });
    });

    it('should handle specific provider option', () => {
      return test
        .stdout()
        .command(['ai:summarize', '--provider=openai'])
        .it('runs ai:summarize with provider flag', (ctx) => {
          expect(ctx.stdout).to.contain('Mock summary of your todos');
          expect(AIService).toHaveBeenCalledWith(
            expect.anything(),
            AIProvider.OPENAI,
            expect.anything(),
            expect.anything()
          );
        });
    });
  });

  // SECTION: Categorize command tests
  describe('ai:categorize command', () => {
    it('should categorize todos', () => {
      return test
        .stdout()
        .command(['ai:categorize'])
        .it('runs ai:categorize', (ctx) => {
          expect(ctx.stdout).to.contain('work');
          expect(ctx.stdout).to.contain('personal');
          expect(AIService).toHaveBeenCalled();
          expect(TodoService).toHaveBeenCalled();
        });
    });

    it('should output in JSON format when specified', () => {
      return test
        .stdout()
        .command(['ai:categorize', '--format=json'])
        .it('runs ai:categorize with JSON format', (ctx) => {
          expect(ctx.stdout).to.contain('"work":');
          expect(ctx.stdout).to.contain('"personal":');
          expect(JSON.parse(ctx.stdout)).to.have.property('work');
        });
    });
  });

  // SECTION: Prioritize command tests
  describe('ai:prioritize command', () => {
    it('should prioritize todos', () => {
      return test
        .stdout()
        .command(['ai:prioritize'])
        .it('runs ai:prioritize', (ctx) => {
          expect(ctx.stdout).to.contain('Priority');
          expect(ctx.stdout).to.contain('todo-1');
          expect(AIService).toHaveBeenCalled();
          expect(TodoService).toHaveBeenCalled();
        });
    });

    it('should output only high priority todos when specified', () => {
      return test
        .stdout()
        .command(['ai:prioritize', '--threshold=8'])
        .it('runs ai:prioritize with threshold', (ctx) => {
          expect(ctx.stdout).to.contain('todo-1');
          expect(ctx.stdout).not.to.contain('todo-3');
        });
    });
  });

  // SECTION: Suggest command tests
  describe('ai:suggest command', () => {
    it('should suggest new todos', () => {
      return test
        .stdout()
        .command(['ai:suggest'])
        .it('runs ai:suggest', (ctx) => {
          expect(ctx.stdout).to.contain('Create project documentation');
          expect(ctx.stdout).to.contain('Schedule weekly team meeting');
          expect(AIService).toHaveBeenCalled();
          expect(TodoService).toHaveBeenCalled();
        });
    });

    it('should create suggested todos when requested', () => {
      return test
        .stdout()
        .command(['ai:suggest', '--create'])
        .it('runs ai:suggest with create flag', (ctx) => {
          expect(ctx.stdout).to.contain('Created new todo');
          expect(TodoService.mock.results[0].value.createTodo).toHaveBeenCalled();
        });
    });

    it('should limit suggestions when count is specified', () => {
      return test
        .stdout()
        .command(['ai:suggest', '--count=2'])
        .it('runs ai:suggest with count', (ctx) => {
          expect(ctx.stdout.split('\n').filter(line => line.trim().startsWith('-'))).to.have.lengthOf(2);
        });
    });
  });

  // SECTION: Analyze command tests
  describe('ai:analyze command', () => {
    it('should analyze todos', () => {
      return test
        .stdout()
        .command(['ai:analyze'])
        .it('runs ai:analyze', (ctx) => {
          expect(ctx.stdout).to.contain('Themes');
          expect(ctx.stdout).to.contain('Bottlenecks');
          expect(ctx.stdout).to.contain('Time Estimates');
          expect(AIService).toHaveBeenCalled();
          expect(TodoService).toHaveBeenCalled();
        });
    });

    it('should focus on specific analysis when specified', () => {
      return test
        .stdout()
        .command(['ai:analyze', '--focus=timeEstimates'])
        .it('runs ai:analyze with focus', (ctx) => {
          expect(ctx.stdout).to.contain('Time Estimates');
          expect(ctx.stdout).to.contain('5 days');
        });
    });
  });

  // SECTION: Workflow suggestion tests
  describe('ai:workflow command', () => {
    it('should suggest a workflow for todos', () => {
      return test
        .stdout()
        .command(['ai:workflow'])
        .it('runs ai:workflow', (ctx) => {
          expect(ctx.stdout).to.contain('Suggested Workflow');
          expect(ctx.stdout).to.contain('First');
          expect(TaskSuggestionService).toHaveBeenCalled();
          expect(TodoService).toHaveBeenCalled();
        });
    });
  });

  // SECTION: Bottleneck identification tests
  describe('ai:bottlenecks command', () => {
    it('should identify bottlenecks in todos', () => {
      return test
        .stdout()
        .command(['ai:bottlenecks'])
        .it('runs ai:bottlenecks', (ctx) => {
          expect(ctx.stdout).to.contain('Identified Bottlenecks');
          expect(ctx.stdout).to.contain('waiting for approvals');
          expect(TaskSuggestionService).toHaveBeenCalled();
          expect(TodoService).toHaveBeenCalled();
        });
    });
  });

  // SECTION: Configuration tests
  describe('ai:configure command', () => {
    it('should set AI configuration options', () => {
      return test
        .stdout()
        .command(['ai:configure', '--provider=openai', '--apiKey=new-api-key'])
        .it('runs ai:configure', (ctx) => {
          expect(ctx.stdout).to.contain('AI configuration updated');
          expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    it('should display current configuration', () => {
      return test
        .stdout()
        .command(['ai:configure', '--show'])
        .it('runs ai:configure --show', (ctx) => {
          expect(ctx.stdout).to.contain('Current AI Configuration');
          expect(ctx.stdout).to.contain('xai');
          expect(fs.readFileSync).toHaveBeenCalled();
        });
    });
  });

  // SECTION: Error handling tests
  describe('Error handling in commands', () => {
    it('should handle missing API key gracefully', () => {
      // Mock readFileSync to return config without API key
      fs.readFileSync = jest.fn().mockImplementation(() => {
        return JSON.stringify({ aiProvider: 'xai' });
      });
      
      // Mock AIService to throw an error
      AIService.mockImplementationOnce(() => {
        throw new Error('API key is required');
      });
      
      return test
        .stderr()
        .command(['ai:summarize'])
        .exit(1)
        .it('shows API key error message', (ctx) => {
          expect(ctx.stderr).to.contain('API key is required');
        });
    });

    it('should handle AI service errors gracefully', () => {
      // Mock AIService to throw after initialization
      const mockSummarize = jest.fn().mockRejectedValue(new Error('AI service error'));
      AIService.mockImplementationOnce(() => ({
        summarize: mockSummarize,
        categorize: jest.fn(),
        prioritize: jest.fn(),
        suggest: jest.fn(),
        analyze: jest.fn()
      }));
      
      return test
        .stderr()
        .command(['ai:summarize'])
        .exit(1)
        .it('shows AI service error message', (ctx) => {
          expect(ctx.stderr).to.contain('AI service error');
        });
    });
  });
});