import { TestService } from '../helpers/test-utils';
import { AiService } from '../../src/services/ai';
import { TodoService } from '../../src/services/todoService';

import { TodoList } from '../../src/types/todo';

// Mock AiService
jest.mock('../../src/services/ai', () => {
  return {
    AiService: jest.fn().mockImplementation(() => {
      return {
        summarizeTodoList: jest
          .fn()
          .mockResolvedValue('Mock summary of the todo list'),
        suggestTags: jest.fn().mockResolvedValue(['work', 'urgent', 'meeting']),
        suggestPriority: jest.fn().mockResolvedValue('high'),
        suggestRelatedTasks: jest
          .fn()
          .mockResolvedValue(['Task 1', 'Task 2', 'Task 3']),
        analyzeProductivity: jest
          .fn()
          .mockResolvedValue('Mock productivity analysis'),
      };
    }),
  };
});

// Mock TodoService
jest.mock('../../src/services/todoService', () => {
  const mockTodo: Todo = {
    id: 'todo-123',
    title: 'Complete project',
    description: 'Finish the quarterly project report',
    completed: false,
    priority: 'medium',
    tags: ['work'],
    createdAt: '2023-01-01T12:00:00Z',
    updatedAt: '2023-01-01T12:00:00Z',
    private: true,
    storageLocation: 'local',
  };

  const mockTodoList: TodoList = {
    id: 'list-123',
    name: 'default',
    owner: 'user-1',
    todos: [mockTodo],
    version: 1,
    createdAt: '2023-01-01T12:00:00Z',
    updatedAt: '2023-01-01T12:00:00Z',
  };

  return {
    TodoService: jest.fn().mockImplementation(() => {
      return {
        getList: jest.fn().mockResolvedValue(mockTodoList),
        getTodoByTitleOrId: jest.fn().mockResolvedValue(mockTodo),
        updateTodo: jest.fn().mockResolvedValue({
          ...mockTodo,
          tags: ['work', 'urgent', 'meeting'],
        }),
        addTodo: jest.fn().mockImplementation((listName, todoData) => {
          return Promise.resolve({
            ...mockTodo,
            id: 'new-todo-' + Math.random().toString(36).substring(7),
            title: todoData.title || 'New Task',
            tags: todoData.tags || [],
            priority: todoData.priority || 'medium',
          });
        }),
      };
    }),
  };
});

describe('AI Command', () => {
  // Save environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, XAI_API_KEY: 'mock-api-key' };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('summarize operation', async () => {
    const result = await TestService.runCommand(['ai', 'summarize']);

    expect(result.stdout).toContain('Todo List Summary');
    expect(result.stdout).toContain('Mock summary of the todo list');
    expect(AiService).toHaveBeenCalled();
    expect(
      AiService.mock.results[0].value.summarizeTodoList
    ).toHaveBeenCalled();
  });

  test('categorize operation', async () => {
    const result = await TestService.runCommand([
      'ai',
      'categorize',
      '-i',
      'todo-123',
    ]);

    expect(result.stdout).toContain('Suggested Tags');
    expect(result.stdout).toContain('work');
    expect(result.stdout).toContain('urgent');
    expect(result.stdout).toContain('meeting');
    expect(AiService).toHaveBeenCalled();
    expect(AiService.mock.results[0].value.suggestTags).toHaveBeenCalled();
    expect(
      TodoService.mock.results[0].value.getTodoByTitleOrId
    ).toHaveBeenCalledWith('todo-123', 'default');
  });

  test('categorize operation with apply flag', async () => {
    const result = await TestService.runCommand([
      'ai',
      'categorize',
      '-i',
      'todo-123',
      '--apply',
    ]);

    expect(result.stdout).toContain('Suggested Tags');
    expect(result.stdout).toContain('Tags applied to todo');
    expect(AiService).toHaveBeenCalled();
    expect(AiService.mock.results[0].value.suggestTags).toHaveBeenCalled();
    expect(TodoService.mock.results[0].value.updateTodo).toHaveBeenCalled();
  });

  test('prioritize operation', async () => {
    const result = await TestService.runCommand([
      'ai',
      'prioritize',
      '-i',
      'todo-123',
    ]);

    expect(result.stdout).toContain('Suggested Priority');
    expect(result.stdout).toContain('high');
    expect(AiService).toHaveBeenCalled();
    expect(AiService.mock.results[0].value.suggestPriority).toHaveBeenCalled();
    expect(
      TodoService.mock.results[0].value.getTodoByTitleOrId
    ).toHaveBeenCalledWith('todo-123', 'default');
  });

  test('prioritize operation with apply flag', async () => {
    const result = await TestService.runCommand([
      'ai',
      'prioritize',
      '-i',
      'todo-123',
      '--apply',
    ]);

    expect(result.stdout).toContain('Suggested Priority');
    expect(result.stdout).toContain('Priority applied to todo');
    expect(AiService).toHaveBeenCalled();
    expect(AiService.mock.results[0].value.suggestPriority).toHaveBeenCalled();
    expect(TodoService.mock.results[0].value.updateTodo).toHaveBeenCalled();
  });

  test('suggest operation', async () => {
    const result = await TestService.runCommand(['ai', 'suggest']);

    expect(result.stdout).toContain('Suggested Tasks');
    expect(result.stdout).toContain('Task 1');
    expect(result.stdout).toContain('Task 2');
    expect(result.stdout).toContain('Task 3');
    expect(AiService).toHaveBeenCalled();
    expect(
      AiService.mock.results[0].value.suggestRelatedTasks
    ).toHaveBeenCalled();
  });

  test('suggest operation with apply flag', async () => {
    const result = await TestService.runCommand(['ai', 'suggest', '--apply']);

    expect(result.stdout).toContain('Suggested Tasks');
    expect(result.stdout).toContain('Added');
    expect(AiService).toHaveBeenCalled();
    expect(
      AiService.mock.results[0].value.suggestRelatedTasks
    ).toHaveBeenCalled();
    expect(TodoService.mock.results[0].value.addTodo).toHaveBeenCalledTimes(3);
  });

  test('analyze operation', async () => {
    const result = await TestService.runCommand(['ai', 'analyze']);

    expect(result.stdout).toContain('Productivity Analysis');
    expect(result.stdout).toContain('Mock productivity analysis');
    expect(AiService).toHaveBeenCalled();
    expect(
      AiService.mock.results[0].value.analyzeProductivity
    ).toHaveBeenCalled();
  });

  test('missing API key error', async () => {
    delete process.env.XAI_API_KEY;

    // Override AiService mock to throw error for missing API key
    AiService.mockImplementationOnce(() => {
      throw new Error('XAI API key is required');
    });

    await expect(TestService.runCommand(['ai', 'summarize'])).rejects.toThrow();
  });
});
