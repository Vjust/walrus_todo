import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TodoService } from '../todoService';
import { Todo, CreateTodoRequest, UpdateTodoRequest } from '../../types';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error';

// Mock fs module completely
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock other dependencies
jest.mock('path');
jest.mock('uuid');
jest.mock('../../config');
jest.mock('../../utils/logger');
jest.mock('../../middleware/error');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;
const mockLogger = logger as jest.Mocked<typeof logger>;

const mockConfig = {
  todo: {
    dataPath: '/test/data/path',
    maxTodosPerWallet: 1000,
  },
};

describe('TodoService', () => {
  let todoService: TodoService;
  const testWallet = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const testDataPath = '/resolved/test/path';

  beforeEach(() => {
    jest.clearAllMocks();
    (config as any) = mockConfig;
    mockPath.resolve.mockReturnValue(testDataPath);
    mockPath.join.mockImplementation((...args) => args.join('/'));
    todoService = new TodoService();
  });

  describe('Constructor and Initialization', () => {
    it('should resolve data path correctly', () => {
      expect(mockPath.resolve).toHaveBeenCalledWith(
        expect.any(String),
        mockConfig.todo.dataPath
      );
    });

    it('should create data directory if it does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      
      await new Promise(resolve => setTimeout(resolve, 0)); // Allow async operation
      
      expect(mockFs.mkdir).toHaveBeenCalledWith(testDataPath, { recursive: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created todo data directory',
        { path: testDataPath }
      );
    });

    it('should not create data directory if it already exists', async () => {
      mockFs.access.mockResolvedValue();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('File Operations', () => {
    const mockTodos: Todo[] = [
      {
        id: 'todo-1',
        title: 'Test Todo 1',
        content: 'Test Todo 1',
        completed: false,
        priority: 'high',
        category: 'work',
        tags: ['urgent'],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
      {
        id: 'todo-2',
        title: 'Test Todo 2',
        content: 'Test Todo 2',
        completed: true,
        priority: 'low',
        category: 'personal',
        tags: ['completed'],
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        wallet: testWallet,
      },
    ];

    describe('readWalletTodos', () => {
      it('should read todos from array format', async () => {
        mockFs.readFile.mockResolvedValue(JSON.stringify(mockTodos));
        
        const result = await todoService.getTodos(testWallet);
        
        expect(result.todos).toEqual(mockTodos);
        expect(mockFs.readFile).toHaveBeenCalledWith(
          `${testDataPath}/${testWallet}.json`,
          'utf-8'
        );
      });

      it('should read todos from object format with todos property', async () => {
        const objectFormat = { todos: mockTodos, metadata: {} };
        mockFs.readFile.mockResolvedValue(JSON.stringify(objectFormat));
        
        const result = await todoService.getTodos(testWallet);
        
        expect(result.todos).toEqual(mockTodos);
      });

      it('should read todos from object format with items property', async () => {
        const objectFormat = { items: mockTodos, metadata: {} };
        mockFs.readFile.mockResolvedValue(JSON.stringify(objectFormat));
        
        const result = await todoService.getTodos(testWallet);
        
        expect(result.todos).toEqual(mockTodos);
      });

      it('should return empty array when file does not exist', async () => {
        const error = new Error('File not found') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        mockFs.readFile.mockRejectedValue(error);
        
        const result = await todoService.getTodos(testWallet);
        
        expect(result.todos).toEqual([]);
        expect(result.total).toBe(0);
      });

      it('should throw ApiError for other read errors', async () => {
        const error = new Error('Permission denied');
        mockFs.readFile.mockRejectedValue(error);
        
        await expect(todoService.getTodos(testWallet)).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error reading wallet todos',
          { wallet: testWallet, error }
        );
      });
    });

    describe('writeWalletTodos', () => {
      it('should write todos in correct format', async () => {
        mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: [] }));
        mockUuidv4.mockReturnValue('new-todo-id');
        
        const createRequest: CreateTodoRequest = {
          content: 'New todo content',
          priority: 'high',
          category: 'work',
          tags: ['new'],
        };
        
        await todoService.createTodo(createRequest, testWallet);
        
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          `${testDataPath}/${testWallet}.json`,
          expect.stringContaining('"todos"')
        );
        
        const writeCall = mockFs.writeFile.mock.calls[0];
        const writtenData = JSON.parse(writeCall[1] as string);
        
        expect(writtenData).toHaveProperty('todos');
        expect(writtenData).toHaveProperty('metadata');
        expect(writtenData.metadata).toMatchObject({
          version: '1.0.0',
          wallet: testWallet,
          count: 1,
        });
      });

      it('should log debug message on successful write', async () => {
        mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: [] }));
        mockUuidv4.mockReturnValue('new-todo-id');
        
        const createRequest: CreateTodoRequest = {
          content: 'New todo content',
        };
        
        await todoService.createTodo(createRequest, testWallet);
        
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Wrote wallet todos',
          { wallet: testWallet, count: 1 }
        );
      });

      it('should throw ApiError on write failure', async () => {
        mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: [] }));
        mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
        mockUuidv4.mockReturnValue('new-todo-id');
        
        const createRequest: CreateTodoRequest = {
          content: 'New todo content',
        };
        
        await expect(todoService.createTodo(createRequest, testWallet)).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error writing wallet todos',
          { wallet: testWallet, error: expect.any(Error) }
        );
      });
    });
  });

  describe('getTodos', () => {
    const mockTodos: Todo[] = [
      {
        id: 'todo-1',
        title: 'Work Todo',
        content: 'Work Todo',
        completed: false,
        priority: 'high',
        category: 'work',
        tags: ['urgent'],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
      {
        id: 'todo-2',
        title: 'Personal Todo',
        content: 'Personal Todo',
        completed: true,
        priority: 'low',
        category: 'personal',
        tags: ['completed'],
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        wallet: testWallet,
      },
    ];

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: mockTodos }));
    });

    it('should return all todos without filters', async () => {
      const result = await todoService.getTodos(testWallet);
      
      expect(result.todos).toEqual(mockTodos);
      expect(result.total).toBe(2);
    });

    it('should filter by category', async () => {
      const result = await todoService.getTodos(testWallet, { category: 'work' });
      
      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].category).toBe('work');
      expect(result.total).toBe(1);
    });

    it('should filter by completed status', async () => {
      const result = await todoService.getTodos(testWallet, { completed: true });
      
      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].completed).toBe(true);
      expect(result.total).toBe(1);
    });

    it('should apply pagination', async () => {
      const result = await todoService.getTodos(testWallet, { page: 1, limit: 1 });
      
      expect(result.todos).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('should filter by wallet address', async () => {
      const otherWallet = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const mixedTodos = [
        ...mockTodos,
        { ...mockTodos[0], id: 'todo-3', wallet: otherWallet },
      ];
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: mixedTodos }));
      
      const result = await todoService.getTodos(testWallet);
      
      expect(result.todos).toHaveLength(2);
      expect(result.todos.every(todo => todo.wallet === testWallet)).toBe(true);
    });
  });

  describe('getTodoById', () => {
    const mockTodos: Todo[] = [
      {
        id: 'todo-1',
        title: 'Test Todo',
        content: 'Test Todo',
        completed: false,
        priority: 'medium',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
    ];

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: mockTodos }));
    });

    it('should return todo by id', async () => {
      const result = await todoService.getTodoById('todo-1', testWallet);
      
      expect(result).toEqual(mockTodos[0]);
    });

    it('should return null for non-existent todo', async () => {
      const result = await todoService.getTodoById('non-existent', testWallet);
      
      expect(result).toBeNull();
    });

    it('should return null for todo with different wallet', async () => {
      const otherWallet = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = await todoService.getTodoById('todo-1', otherWallet);
      
      expect(result).toBeNull();
    });
  });

  describe('createTodo', () => {
    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: [] }));
      mockUuidv4.mockReturnValue('new-todo-id');
    });

    it('should create todo with all fields', async () => {
      const createRequest: CreateTodoRequest = {
        content: 'New todo content',
        priority: 'high',
        category: 'work',
        tags: ['urgent', 'important'],
      };
      
      const result = await todoService.createTodo(createRequest, testWallet);
      
      expect(result).toMatchObject({
        id: 'new-todo-id',
        title: 'New todo content',
        content: 'New todo content',
        completed: false,
        priority: 'high',
        category: 'work',
        tags: ['urgent', 'important'],
        wallet: testWallet,
      });
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create todo with default values', async () => {
      const createRequest: CreateTodoRequest = {
        content: 'Simple todo',
      };
      
      const result = await todoService.createTodo(createRequest, testWallet);
      
      expect(result).toMatchObject({
        content: 'Simple todo',
        priority: 'medium',
        tags: [],
      });
    });

    it('should throw error when max todos exceeded', async () => {
      const existingTodos = Array.from({ length: 1000 }, (_, i) => ({
        id: `todo-${i}`,
        title: `Todo ${i}`,
        content: `Todo ${i}`,
        completed: false,
        priority: 'medium' as const,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      }));
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: existingTodos }));
      
      const createRequest: CreateTodoRequest = {
        content: 'One too many',
      };
      
      await expect(todoService.createTodo(createRequest, testWallet)).rejects.toThrow();
    });

    it('should log todo creation', async () => {
      const createRequest: CreateTodoRequest = {
        content: 'New todo',
      };
      
      await todoService.createTodo(createRequest, testWallet);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Todo created',
        { id: 'new-todo-id', wallet: testWallet }
      );
    });
  });

  describe('updateTodo', () => {
    const existingTodo: Todo = {
      id: 'todo-1',
      title: 'Original Todo',
      content: 'Original Todo',
      completed: false,
      priority: 'medium',
      category: 'work',
      tags: ['original'],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      wallet: testWallet,
    };

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: [existingTodo] }));
    });

    it('should update todo fields', async () => {
      const updateRequest: UpdateTodoRequest = {
        content: 'Updated content',
        priority: 'high',
        completed: true,
      };
      
      const result = await todoService.updateTodo('todo-1', updateRequest, testWallet);
      
      expect(result).toMatchObject({
        id: 'todo-1',
        title: 'Updated content',
        content: 'Updated content',
        priority: 'high',
        completed: true,
        wallet: testWallet,
        createdAt: existingTodo.createdAt,
      });
      expect(result.updatedAt).not.toBe(existingTodo.updatedAt);
    });

    it('should preserve unchanged fields', async () => {
      const updateRequest: UpdateTodoRequest = {
        priority: 'high',
      };
      
      const result = await todoService.updateTodo('todo-1', updateRequest, testWallet);
      
      expect(result).toMatchObject({
        content: existingTodo.content,
        category: existingTodo.category,
        tags: existingTodo.tags,
        completed: existingTodo.completed,
      });
    });

    it('should throw error for non-existent todo', async () => {
      await expect(
        todoService.updateTodo('non-existent', { content: 'Updated' }, testWallet)
      ).rejects.toThrow();
    });

    it('should throw error for todo with different wallet', async () => {
      const otherWallet = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      await expect(
        todoService.updateTodo('todo-1', { content: 'Updated' }, otherWallet)
      ).rejects.toThrow();
    });

    it('should log todo update', async () => {
      const updateRequest: UpdateTodoRequest = {
        content: 'Updated content',
      };
      
      await todoService.updateTodo('todo-1', updateRequest, testWallet);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Todo updated',
        { id: 'todo-1', wallet: testWallet }
      );
    });
  });

  describe('deleteTodo', () => {
    const existingTodo: Todo = {
      id: 'todo-1',
      title: 'Todo to delete',
      content: 'Todo to delete',
      completed: false,
      priority: 'medium',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      wallet: testWallet,
    };

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: [existingTodo] }));
    });

    it('should delete existing todo', async () => {
      const result = await todoService.deleteTodo('todo-1', testWallet);
      
      expect(result).toEqual(existingTodo);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Todo deleted',
        { id: 'todo-1', wallet: testWallet }
      );
    });

    it('should throw error for non-existent todo', async () => {
      await expect(
        todoService.deleteTodo('non-existent', testWallet)
      ).rejects.toThrow();
    });

    it('should throw error for todo with different wallet', async () => {
      const otherWallet = '0xabcdef1234567890abcdef1234567890abcdef1234567890';
      
      await expect(
        todoService.deleteTodo('todo-1', otherWallet)
      ).rejects.toThrow();
    });
  });

  describe('completeTodo', () => {
    const existingTodo: Todo = {
      id: 'todo-1',
      title: 'Todo to complete',
      content: 'Todo to complete',
      completed: false,
      priority: 'medium',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      wallet: testWallet,
    };

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: [existingTodo] }));
    });

    it('should complete todo', async () => {
      const result = await todoService.completeTodo('todo-1', testWallet);
      
      expect(result.completed).toBe(true);
      expect(result.id).toBe('todo-1');
    });
  });

  describe('getCategories', () => {
    const mockTodos: Todo[] = [
      {
        id: 'todo-1',
        title: 'Work Todo',
        content: 'Work Todo',
        completed: false,
        priority: 'medium',
        category: 'work',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
      {
        id: 'todo-2',
        title: 'Personal Todo',
        content: 'Personal Todo',
        completed: false,
        priority: 'medium',
        category: 'personal',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
      {
        id: 'todo-3',
        title: 'Work Todo 2',
        content: 'Work Todo 2',
        completed: false,
        priority: 'medium',
        category: 'work',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
    ];

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: mockTodos }));
    });

    it('should return unique categories sorted', async () => {
      const result = await todoService.getCategories(testWallet);
      
      expect(result).toEqual(['personal', 'work']);
    });

    it('should exclude todos without categories', async () => {
      const todosWithoutCategory = [
        ...mockTodos,
        {
          id: 'todo-4',
          title: 'No Category',
          content: 'No Category',
          completed: false,
          priority: 'medium' as const,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          wallet: testWallet,
        },
      ];
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: todosWithoutCategory }));
      
      const result = await todoService.getCategories(testWallet);
      
      expect(result).toEqual(['personal', 'work']);
    });
  });

  describe('getTags', () => {
    const mockTodos: Todo[] = [
      {
        id: 'todo-1',
        title: 'Todo 1',
        content: 'Todo 1',
        completed: false,
        priority: 'medium',
        tags: ['urgent', 'important'],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
      {
        id: 'todo-2',
        title: 'Todo 2',
        content: 'Todo 2',
        completed: false,
        priority: 'medium',
        tags: ['personal', 'urgent'],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
    ];

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: mockTodos }));
    });

    it('should return unique tags sorted', async () => {
      const result = await todoService.getTags(testWallet);
      
      expect(result).toEqual(['important', 'personal', 'urgent']);
    });
  });

  describe('getStats', () => {
    const mockTodos: Todo[] = [
      {
        id: 'todo-1',
        title: 'Completed High Priority',
        content: 'Completed High Priority',
        completed: true,
        priority: 'high',
        category: 'work',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
      {
        id: 'todo-2',
        title: 'Pending Medium Priority',
        content: 'Pending Medium Priority',
        completed: false,
        priority: 'medium',
        category: 'personal',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
      {
        id: 'todo-3',
        title: 'Pending High Priority',
        content: 'Pending High Priority',
        completed: false,
        priority: 'high',
        category: 'work',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        wallet: testWallet,
      },
    ];

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: mockTodos }));
    });

    it('should return correct statistics', async () => {
      const result = await todoService.getStats(testWallet);
      
      expect(result).toEqual({
        total: 3,
        completed: 1,
        pending: 2,
        byPriority: {
          high: 2,
          medium: 1,
        },
        byCategory: {
          work: 2,
          personal: 1,
        },
      });
    });

    it('should handle todos without priority or category', async () => {
      const todosWithDefaults = [
        {
          id: 'todo-1',
          title: 'Default Todo',
          content: 'Default Todo',
          completed: false,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          wallet: testWallet,
        } as Todo,
      ];
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({ todos: todosWithDefaults }));
      
      const result = await todoService.getStats(testWallet);
      
      expect(result.byPriority.medium).toBe(1);
      expect(result.byCategory.uncategorized).toBe(1);
    });
  });
});