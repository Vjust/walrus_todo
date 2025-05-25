import fs from 'fs';
import * as fsPromises from 'fs/promises';
import path from 'path';
import {
  TodoService,
  todoService,
} from '../../src/services/todoService.consolidated';
import { STORAGE_CONFIG } from '../../src/constants';

// Mock the filesystem operations
jest.mock('fs');
jest.mock('fs/promises');

describe('Consolidated TodoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fs.existsSync to return true for the Todos directory
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
      if (path.endsWith(STORAGE_CONFIG.TODOS_DIR)) {
        return true;
      }
      return false;
    });
  });

  it('should be a singleton', () => {
    const instance1 = TodoService.getInstance();
    const instance2 = TodoService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should export a todoService instance', () => {
    expect(todoService).toBeDefined();
    expect(todoService).toBeInstanceOf(TodoService);
  });

  describe('getAllLists', () => {
    it('should return an array of list names', async () => {
      const mockReaddir = fsPromises.readdir as jest.Mock;
      mockReaddir.mockResolvedValue([
        'list1.json',
        'list2.json',
        'not-a-list.txt',
      ]);

      const lists = await todoService.getAllLists();

      expect(lists).toEqual(['list1', 'list2']);
      expect(mockReaddir).toHaveBeenCalled();
    });

    it('should return an empty array if readdir fails', async () => {
      const mockReaddir = fsPromises.readdir as jest.Mock;
      mockReaddir.mockRejectedValue(new Error('Directory not found'));

      const lists = await todoService.getAllLists();

      expect(lists).toEqual([]);
      expect(mockReaddir).toHaveBeenCalled();
    });
  });

  describe('createList', () => {
    it('should create a new list if it does not exist', async () => {
      // Mock getList to return null, indicating list doesn't exist
      jest.spyOn(todoService, 'getList').mockResolvedValue(null);
      // Mock saveList to do nothing
      jest.spyOn(todoService, 'saveList').mockResolvedValue(undefined);

      const list = await todoService.createList('newList', 'testOwner');

      expect(list).toBeDefined();
      expect(list.name).toBe('newList');
      expect(list.owner).toBe('testOwner');
      expect(list.todos).toEqual([]);
      expect(todoService.saveList).toHaveBeenCalled();
    });

    it('should throw an error if the list already exists', async () => {
      // Mock getList to return a list, indicating it already exists
      jest.spyOn(todoService, 'getList').mockResolvedValue({
        id: '123',
        name: 'existingList',
        owner: 'existingOwner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await expect(
        todoService.createList('existingList', 'newOwner')
      ).rejects.toThrow('List "existingList" already exists');
    });
  });

  describe('addTodo', () => {
    it('should add a todo to an existing list', async () => {
      // Mock getList to return a list
      const mockList = {
        id: '123',
        name: 'testList',
        owner: 'testOwner',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      jest.spyOn(todoService, 'getList').mockResolvedValue(mockList);
      // Mock saveList to do nothing
      jest.spyOn(todoService, 'saveList').mockResolvedValue(undefined);

      const todo = await todoService.addTodo('testList', {
        title: 'Test Todo',
        description: 'Test Description',
        priority: 'high',
      });

      expect(todo).toBeDefined();
      expect(todo.title).toBe('Test Todo');
      expect(todo.description).toBe('Test Description');
      expect(todo.priority).toBe('high');
      expect(todo.completed).toBe(false);
      expect(todoService.saveList).toHaveBeenCalled();
      expect(mockList.todos.length).toBe(1);
      expect(mockList.todos[0]).toBe(todo);
    });

    it('should create a list if it does not exist', async () => {
      // Mock getList to return null first call, then the created list on second call
      const mockList = {
        id: '123',
        name: 'testList',
        owner: 'local',
        todos: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const getListMock = jest
        .spyOn(todoService, 'getList')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockList);

      // Mock createList to return the mock list
      jest.spyOn(todoService, 'createList').mockResolvedValue(mockList);

      // Mock saveList to do nothing
      jest.spyOn(todoService, 'saveList').mockResolvedValue(undefined);

      const todo = await todoService.addTodo('newList', {
        title: 'Test Todo',
      });

      expect(todo).toBeDefined();
      expect(todo.title).toBe('Test Todo');
      expect(todoService.createList).toHaveBeenCalledWith('newList', 'local');
      expect(todoService.saveList).toHaveBeenCalled();
    });
  });

  describe('toggleItemStatus', () => {
    it('should toggle a todo item status', async () => {
      // Mock updateTodo to return the updated todo
      jest.spyOn(todoService, 'updateTodo').mockResolvedValue({
        id: '456',
        title: 'Test Todo',
        description: '',
        completed: true,
        completedAt: expect.any(String),
        priority: 'medium',
        tags: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        private: true,
        storageLocation: 'local',
      });

      await todoService.toggleItemStatus('testList', '456', true);

      expect(todoService.updateTodo).toHaveBeenCalledWith('testList', '456', {
        completed: true,
        completedAt: expect.any(String),
      });
    });
  });

  describe('findTodoById', () => {
    it('should find a todo by ID across all lists', async () => {
      // Mock getAllLists to return list names
      jest
        .spyOn(todoService, 'getAllLists')
        .mockResolvedValue(['list1', 'list2']);

      // Mock getList to return lists with todos
      jest
        .spyOn(todoService, 'getList')
        .mockResolvedValueOnce({
          id: '123',
          name: 'list1',
          owner: 'owner',
          todos: [
            {
              id: '111',
              title: 'Todo 1',
              completed: false,
              createdAt: '',
              updatedAt: '',
              private: true,
            },
            {
              id: '222',
              title: 'Todo 2',
              completed: false,
              createdAt: '',
              updatedAt: '',
              private: true,
            },
          ],
          version: 1,
          createdAt: '',
          updatedAt: '',
        })
        .mockResolvedValueOnce({
          id: '456',
          name: 'list2',
          owner: 'owner',
          todos: [
            {
              id: '333',
              title: 'Todo 3',
              completed: false,
              createdAt: '',
              updatedAt: '',
              private: true,
            },
            {
              id: '444',
              title: 'Todo 4',
              completed: false,
              createdAt: '',
              updatedAt: '',
              private: true,
            },
          ],
          version: 1,
          createdAt: '',
          updatedAt: '',
        });

      const result = await todoService.findTodoById('333');

      expect(result).toBeDefined();
      expect(result?.todo.id).toBe('333');
      expect(result?.todo.title).toBe('Todo 3');
      expect(result?.listName).toBe('list2');
    });

    it('should return null if todo is not found', async () => {
      // Mock getAllLists to return list names
      jest.spyOn(todoService, 'getAllLists').mockResolvedValue(['list1']);

      // Mock getList to return a list without the todo
      jest.spyOn(todoService, 'getList').mockResolvedValue({
        id: '123',
        name: 'list1',
        owner: 'owner',
        todos: [
          {
            id: '111',
            title: 'Todo 1',
            completed: false,
            createdAt: '',
            updatedAt: '',
            private: true,
          },
        ],
        version: 1,
        createdAt: '',
        updatedAt: '',
      });

      const result = await todoService.findTodoById('unknown');

      expect(result).toBeNull();
    });
  });
});
