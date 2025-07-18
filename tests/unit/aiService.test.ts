import { jest } from '@jest/globals';
import { AiService } from '../../apps/cli/src/services/ai';
import { ChatXAI } from '@langchain/xai';
import { Todo, TodoList } from '../../apps/cli/src/types/todo';

// Mock the ChatXAI class
jest.mock('@langchain/xai', () => {
  return {
    ChatXAI: jest.fn().mockImplementation(() => {
      return {
        invoke: jest.fn().mockImplementation(async input => {
          // Based on the input content, return different mock responses
          const content = input.content || '';
          if (content.includes('Summarize the following todo list')) {
            return { content: 'Mock summary of the todo list' };
          } else if (content.includes('Suggest 2-4 relevant tags')) {
            return { content: '["work", "urgent", "meeting"]' };
          } else if (content.includes('suggest a priority level')) {
            return { content: 'high' };
          } else if (content.includes('suggest')) {
            return { content: '["Task 1", "Task 2", "Task 3"]' };
          } else if (content.includes('Analyze the productivity')) {
            return { content: 'Mock productivity analysis' };
          }
          return { content: 'Default mock response' };
        }),
      };
    }),
  };
});

describe('AiService', () => {
  // Mock environment setup
  const originalEnv = process.env;

  beforeEach(() => {
    // Create minimal env object to avoid deep copying
    process.env = { XAI_API_KEY: 'mock-api-key' };
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    // Restore original env and cleanup
    process.env = originalEnv;
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // Sample todo and todo list for testing - create fresh instances in each test
  function createSampleTodo(): Todo {
    return {
      id: 'todo-123',
      title: 'Complete project',
      description: 'Finish the quarterly project report',
      completed: false,
      priority: 'medium' as const,
      tags: ['work'],
      createdAt: '2023-01-01T12:00:00Z',
      updatedAt: '2023-01-01T12:00:00Z',
      private: true,
      storageLocation: 'local' as const,
    };
  }

  function createSampleTodoList(): TodoList {
    return {
      id: 'list-123',
      name: 'Work',
      owner: 'user-1',
      todos: [createSampleTodo()],
      version: 1,
      createdAt: '2023-01-01T12:00:00Z',
      updatedAt: '2023-01-01T12:00:00Z',
    };
  }

  it('should initialize with API key from constructor', () => {
    new AiService('test-api-key');
    expect(ChatXAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      model: 'grok-beta',
      temperature: 0.7,
    });
  });

  it('should initialize with API key from environment variable', () => {
    new AiService();
    expect(ChatXAI).toHaveBeenCalledWith({
      apiKey: 'mock-api-key',
      model: 'grok-beta',
      temperature: 0.7,
    });
  });

  it('should throw error when API key is missing', () => {
    delete process.env.XAI_API_KEY;
    expect(() => new AiService()).toThrow('XAI API key is required');
  });

  it('should summarize a todo list', async () => {
    const aiService = new AiService();
    const todoList = createSampleTodoList();
    const summary = await aiService.summarizeTodoList(todoList);

    expect(summary).toBe('Mock summary of the todo list');
    expect(ChatXAI.mock.results[0].value.invoke).toHaveBeenCalled();
  });

  it('should suggest tags for a todo', async () => {
    const aiService = new AiService();
    const todo = createSampleTodo();
    const tags = await aiService.suggestTags(todo);

    expect(tags).toEqual(['work', 'urgent', 'meeting']);
    expect(ChatXAI.mock.results[0].value.invoke).toHaveBeenCalled();
  });

  it('should handle parsing error when suggesting tags', async () => {
    // Override the mock to return invalid JSON
    ChatXAI.mock.results[0].value.invoke.mockResolvedValueOnce({
      content: 'Not valid JSON',
    });

    const aiService = new AiService();
    const todo = createSampleTodo();
    await expect(aiService.suggestTags(todo)).rejects.toThrow(
      'Failed to parse tags'
    );
  });

  it('should suggest priority for a todo', async () => {
    const aiService = new AiService();
    const todo = createSampleTodo();
    const priority = await aiService.suggestPriority(todo);

    expect(priority).toBe('high');
    expect(ChatXAI.mock.results[0].value.invoke).toHaveBeenCalled();
  });

  it('should default to medium priority if response is invalid', async () => {
    // Override the mock to return invalid priority
    ChatXAI.mock.results[0].value.invoke.mockResolvedValueOnce({
      content: 'critical',
    });

    const aiService = new AiService();
    const todo = createSampleTodo();
    const priority = await aiService.suggestPriority(todo);

    expect(priority).toBe('medium');
  });

  it('should suggest related tasks', async () => {
    const aiService = new AiService();
    const todoList = createSampleTodoList();
    const tasks = await aiService.suggestRelatedTasks(todoList, 3);

    expect(tasks).toEqual(['Task 1', 'Task 2', 'Task 3']);
    expect(ChatXAI.mock.results[0].value.invoke).toHaveBeenCalled();
  });

  it('should handle parsing error when suggesting tasks', async () => {
    // Override the mock to return invalid JSON
    ChatXAI.mock.results[0].value.invoke.mockResolvedValueOnce({
      content: 'Not valid JSON',
    });

    const aiService = new AiService();
    const todoList = createSampleTodoList();
    await expect(aiService.suggestRelatedTasks(todoList)).rejects.toThrow(
      'Failed to parse task suggestions'
    );
  });

  it('should analyze productivity patterns', async () => {
    const aiService = new AiService();
    const todoList = createSampleTodoList();
    const analysis = await aiService.analyzeProductivity(todoList);

    expect(analysis).toBe('Mock productivity analysis');
    expect(ChatXAI.mock.results[0].value.invoke).toHaveBeenCalled();
  });
});
