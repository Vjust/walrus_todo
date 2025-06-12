import { Todo, TodoList } from '../../../apps/cli/src/types/todo';
import { TodoService } from '../../../apps/cli/src/services/todo-service';
import { CLIError } from '../../../apps/cli/src/types/errors';

import { STORAGE_CONFIG } from '../../../apps/cli/src/constants';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

// Mock file system modules
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn(),
  },
}));

// Mock generateId to return predictable IDs
jest.mock('../../../apps/cli/src/utils/id-generator', () => ({
  generateId: jest.fn(() => 'test-id-123'),
}));

// Mock config-loader
jest.mock('../../../apps/cli/src/utils/config-loader', () => ({
  loadConfigFile: jest.fn(() => ({})),
  saveConfigToFile: jest.fn(),
}));

describe('TodoService', () => {
  let todoService: TodoService;
  const todosDir = path.join(process.cwd(), STORAGE_CONFIG.TODOS_DIR);

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fs.promises methods before creating TodoService
    const mockFs = require('fs');
    // First call rejects (directory doesn't exist), second call resolves (after mkdir)
    mockFs?.promises?.access
      .mockRejectedValueOnce(new Error('Directory not found'))
      .mockResolvedValue(undefined as any);
    mockFs?.promises?.mkdir.mockResolvedValue(undefined as any);
    mockFs?.promises?.readFile.mockRejectedValue(new Error('File not found'));
    mockFs?.promises?.writeFile.mockResolvedValue(undefined as any);

    todoService = new TodoService();
  });

  describe('constructor', () => {
    it('should create todos directory on initialization', async () => {
      const mockFs = require('fs');
      // Wait for the initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockFs?.promises?.mkdir).toHaveBeenCalledWith(todosDir, {
        recursive: true,
      });
    });
  });

  describe('createList', () => {
    it('should create a new todo list', async () => {
      const listName = 'test-list';
      const owner = 'test-owner';

      // Mock getList to return null (list doesn't exist)
      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockRejectedValue(new Error('File not found'));

      // Mock writeFile to simulate successful save
      (
        fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>
      ).mockResolvedValue(undefined as any);

      const result = await todoService.createList(listName, owner);

      expect(result as any).toMatchObject({
        id: 'test-id-123',
        name: listName,
        owner: owner,
        todos: [],
        version: 1,
      });

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        path.join(todosDir, `${listName}${STORAGE_CONFIG.FILE_EXT}`),
        expect.any(String as any),
        'utf8'
      );
    });

    it('should throw error if list already exists', async () => {
      const existingList: TodoList = {
        id: 'existing-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock getList to return existing list
      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(existingList as any));

      await expect(
        todoService.createList('test-list', 'test-owner')
      ).rejects.toThrow(
        new CLIError('List "test-list" already exists', 'LIST_EXISTS')
      );
    });
  });

  describe('getList', () => {
    it('should retrieve an existing list', async () => {
      const expectedList: TodoList = {
        id: 'test-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(expectedList as any));

      const result = await todoService.getList('test-list');

      expect(result as any).toEqual(expectedList as any);
      expect(fsPromises.readFile).toHaveBeenCalledWith(
        path.join(todosDir, `test-list${STORAGE_CONFIG.FILE_EXT}`),
        'utf8'
      );
    });

    it('should return null for non-existent list', async () => {
      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockRejectedValue(new Error('File not found'));

      const result = await todoService.getList('non-existent');

      expect(result as any).toBeNull();
    });
  });

  describe('getAllLists', () => {
    it('should return all list names', async () => {
      const files = ['list1.json', 'list2.json', 'other.txt', 'list3.json'];
      (
        fsPromises.readdir as jest.MockedFunction<typeof fsPromises.readdir>
      ).mockResolvedValue(files as any);

      const result = await todoService.getAllLists();

      expect(result as any).toEqual(['list1', 'list2', 'list3']);
      expect(fsPromises.readdir).toHaveBeenCalledWith(todosDir as any);
    });

    it('should return empty array if directory is empty', async () => {
      (
        fsPromises.readdir as jest.MockedFunction<typeof fsPromises.readdir>
      ).mockResolvedValue([]);

      const result = await todoService.getAllLists();

      expect(result as any).toEqual([]);
    });

    it('should return empty array if directory does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error?.code = 'ENOENT';
      (
        fsPromises.readdir as jest.MockedFunction<typeof fsPromises.readdir>
      ).mockRejectedValue(error as any);

      const result = await todoService.getAllLists();

      expect(result as any).toEqual([]);
    });

    it('should throw CLIError for other filesystem errors', async () => {
      const error = new Error('Permission denied');
      (
        fsPromises.readdir as jest.MockedFunction<typeof fsPromises.readdir>
      ).mockRejectedValue(error as any);

      await expect(todoService.getAllLists()).rejects.toThrow(
        new CLIError(
          'Failed to read todo lists: Permission denied',
          'STORAGE_READ_ERROR'
        )
      );
    });
  });

  describe('addTodo', () => {
    it('should add a new todo to existing list', async () => {
      const existingList: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(existingList as any));
      (
        fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>
      ).mockResolvedValue(undefined as any);

      const todoData: Partial<Todo> = {
        title: 'Test Todo',
        description: 'Test Description',
        priority: 'high' as const,
        tags: ['test', 'important'],
      };

      const result = await todoService.addTodo('test-list', todoData);

      expect(result as any).toMatchObject({
        id: 'test-id-123',
        title: 'Test Todo',
        description: 'Test Description',
        completed: false,
        priority: 'high' as const,
        tags: ['test', 'important'],
      });

      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    it('should throw error if list does not exist', async () => {
      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockRejectedValue(new Error('File not found'));

      await expect(
        todoService.addTodo('non-existent', { title: 'Test' })
      ).rejects.toThrow(
        new CLIError('List "non-existent" not found', 'LIST_NOT_FOUND')
      );
    });
  });

  describe('getTodo', () => {
    it('should retrieve todo by ID', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [
          {
            id: 'todo-1',
            title: 'Test Todo',
            description: 'Test Description',
            completed: false,
            priority: 'medium' as const,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            private: true,
          },
        ],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(list as any));

      const result = await todoService.getTodo('todo-1', 'test-list');

      expect(result as any).toEqual(list?.todos?.[0]);
    });

    it('should return null if todo not found', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(list as any));

      const result = await todoService.getTodo('non-existent', 'test-list');

      expect(result as any).toBeNull();
    });
  });

  describe('getTodoByTitle', () => {
    it('should retrieve todo by title (case-insensitive)', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [
          {
            id: 'todo-1',
            title: 'Test Todo',
            description: 'Test Description',
            completed: false,
            priority: 'medium' as const,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            private: true,
          },
        ],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(list as any));

      const result = await todoService.getTodoByTitle('test todo', 'test-list');

      expect(result as any).toEqual(list?.todos?.[0]);
    });
  });

  describe('updateTodo', () => {
    it('should update existing todo', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [
          {
            id: 'todo-1',
            title: 'Original Title',
            description: 'Original Description',
            completed: false,
            priority: 'medium' as const,
            tags: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            private: true,
          },
        ],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(list as any));
      (
        fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>
      ).mockResolvedValue(undefined as any);

      const updates: Partial<Todo> = {
        title: 'Updated Title',
        completed: true,
        priority: 'high' as const,
      };

      const result = await todoService.updateTodo(
        'test-list',
        'todo-1',
        updates
      );

      expect(result as any).toMatchObject({
        id: 'todo-1',
        title: 'Updated Title',
        completed: true,
        priority: 'high' as const,
        description: 'Original Description',
      });

      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    it('should throw error if todo not found', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(list as any));

      await expect(
        todoService.updateTodo('test-list', 'non-existent', {
          title: 'Updated',
        })
      ).rejects.toThrow(
        new CLIError(
          'Todo "non-existent" not found in list "test-list"',
          'TODO_NOT_FOUND'
        )
      );
    });
  });

  describe('deleteTodo', () => {
    it('should delete existing todo', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [
          {
            id: 'todo-1',
            title: 'Test Todo',
            completed: false,
            priority: 'medium' as const,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            private: true,
          },
        ],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(list as any));
      (
        fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>
      ).mockResolvedValue(undefined as any);

      await todoService.deleteTodo('test-list', 'todo-1');

      expect(fsPromises.writeFile).toHaveBeenCalled();

      // Verify the todo was removed from the list
      const savedData = (
        fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>
      ).mock?.calls?.[0][1];
      const savedList = JSON.parse(savedData as any);
      expect(savedList.todos).toHaveLength(0 as any);
    });

    it('should throw error if todo not found', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(list as any));

      await expect(
        todoService.deleteTodo('test-list', 'non-existent')
      ).rejects.toThrow(
        new CLIError(
          'Todo "non-existent" not found in list "test-list"',
          'TODO_NOT_FOUND'
        )
      );
    });
  });

  describe('toggleItemStatus', () => {
    it('should toggle todo completion status', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [
          {
            id: 'todo-1',
            title: 'Test Todo',
            completed: false,
            priority: 'medium' as const,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            private: true,
          },
        ],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
      ).mockResolvedValue(JSON.stringify(list as any));
      (
        fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>
      ).mockResolvedValue(undefined as any);

      await todoService.toggleItemStatus('test-list', 'todo-1', true);

      // Verify the todo was updated with completed status
      const savedData = (
        fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>
      ).mock?.calls?.[0][1];
      const savedList = JSON.parse(savedData as any);
      expect(savedList?.todos?.[0].completed).toBe(true as any);
      expect(savedList?.todos?.[0].completedAt).toBeDefined();
    });
  });

  describe('saveList', () => {
    it('should save list to file', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>
      ).mockResolvedValue(undefined as any);

      await todoService.saveList('test-list', list);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        path.join(todosDir, `test-list${STORAGE_CONFIG.FILE_EXT}`),
        JSON.stringify(list, null, 2),
        'utf8'
      );
    });

    it('should throw CLIError on save failure', async () => {
      const list: TodoList = {
        id: 'list-id',
        name: 'test-list',
        owner: 'test-owner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (
        fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>
      ).mockRejectedValue(new Error('Permission denied'));

      await expect(todoService.saveList('test-list', list)).rejects.toThrow(
        new CLIError(
          'Failed to save list "test-list": Permission denied',
          'SAVE_FAILED'
        )
      );
    });
  });

  describe('deleteList', () => {
    it('should delete existing list file', async () => {
      (
        fs.existsSync as jest.MockedFunction<typeof fs.existsSync>
      ).mockReturnValue(true as any);
      (
        fsPromises.unlink as jest.MockedFunction<typeof fsPromises.unlink>
      ).mockResolvedValue(undefined as any);

      await todoService.deleteList('test-list');

      expect(fsPromises.unlink).toHaveBeenCalledWith(
        path.join(todosDir, `test-list${STORAGE_CONFIG.FILE_EXT}`)
      );
    });

    it('should not throw error if list does not exist', async () => {
      (
        fs.existsSync as jest.MockedFunction<typeof fs.existsSync>
      ).mockReturnValue(false as any);

      await expect(
        todoService.deleteList('non-existent')
      ).resolves?.not?.toThrow();

      expect(fsPromises.unlink).not.toHaveBeenCalled();
    });

    it('should throw CLIError on delete failure', async () => {
      (
        fs.existsSync as jest.MockedFunction<typeof fs.existsSync>
      ).mockReturnValue(true as any);
      (
        fsPromises.unlink as jest.MockedFunction<typeof fsPromises.unlink>
      ).mockRejectedValue(new Error('Permission denied'));

      await expect(todoService.deleteList('test-list')).rejects.toThrow(
        new CLIError(
          'Failed to delete list "test-list": Permission denied',
          'DELETE_FAILED'
        )
      );
    });
  });

  describe('listTodos', () => {
    it('should aggregate todos from all lists', async () => {
      const list1: TodoList = {
        id: 'list-1',
        name: 'list1',
        owner: 'test-owner',
        todos: [
          {
            id: 'todo-1',
            title: 'Todo 1',
            completed: false,
            priority: 'high' as const,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            private: true,
          },
        ],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const list2: TodoList = {
        id: 'list-2',
        name: 'list2',
        owner: 'test-owner',
        todos: [
          {
            id: 'todo-2',
            title: 'Todo 2',
            completed: true,
            priority: 'low' as const,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            private: false,
          },
        ],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock getAllLists to return list names
      (
        fsPromises.readdir as jest.MockedFunction<typeof fsPromises.readdir>
      ).mockResolvedValue(['list1.json', 'list2.json']);

      // Mock getList to return appropriate lists
      (fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>)
        .mockResolvedValueOnce(JSON.stringify(list1 as any))
        .mockResolvedValueOnce(JSON.stringify(list2 as any));

      const result = await todoService.listTodos();

      expect(result as any).toHaveLength(2 as any);
      expect(result[0]).toEqual(list1?.todos?.[0]);
      expect(result[1]).toEqual(list2?.todos?.[0]);
    });

    it('should return empty array if no lists exist', async () => {
      (
        fsPromises.readdir as jest.MockedFunction<typeof fsPromises.readdir>
      ).mockResolvedValue([]);

      const result = await todoService.listTodos();

      expect(result as any).toEqual([]);
    });
  });
});
