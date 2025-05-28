import { expect, describe, test, beforeEach, jest } from '@jest/globals';
import CompleteCommand from '../../src/commands/complete';
import { TodoService } from '../../src/services/todoService';
import { configService } from '../../src/services/config-service';
import { TodoList, Todo } from '../../src/types/todo';
import { CLIError } from '../../src/types/errors/consolidated';

// Mock services
jest.mock('../../src/services/todoService');
jest.mock('../../src/services/config-service');
jest.mock('../../src/utils/walrus-storage', () => ({
  createWalrusStorage: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    updateTodo: jest.fn(),
  })),
}));

const mockTodoService = TodoService as jest.MockedClass<typeof TodoService>;

describe('complete command - positional arguments', () => {
  const mockList: TodoList = {
    id: 'mylist',
    name: 'mylist',
    owner: 'test-owner',
    todos: [],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTodo: Todo = {
    id: 'todo-123',
    title: 'Buy groceries',
    completed: false,
    listName: 'mylist',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    jest.spyOn(configService, 'getConfig').mockResolvedValue({
      network: 'testnet',
    } as any);
    
    mockTodoService.prototype.getList = jest.fn().mockResolvedValue(mockList);
    mockTodoService.prototype.getLists = jest.fn().mockResolvedValue([mockList]);
    mockTodoService.prototype.getTodoByTitleOrId = jest.fn().mockResolvedValue(mockTodo);
    mockTodoService.prototype.getListItems = jest.fn().mockResolvedValue([mockTodo]);
    mockTodoService.prototype.toggleItemStatus = jest.fn().mockResolvedValue(undefined);
  });

  describe('new positional argument patterns', () => {
    test('completes todo from default list with single argument', async () => {
      const cmd = new CompleteCommand(['todo-123'], {} as any);
      
      await cmd.run();
      
      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith('todo-123', 'default');
      expect(mockTodoService.prototype.toggleItemStatus).toHaveBeenCalledWith('default', 'todo-123', true);
    });

    test('completes todo from specific list with two arguments', async () => {
      const cmd = new CompleteCommand(['mylist', 'todo-456'], {} as any);
      
      await cmd.run();
      
      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith('todo-456', 'mylist');
      expect(mockTodoService.prototype.toggleItemStatus).toHaveBeenCalledWith('mylist', 'todo-123', true);
    });

    test('completes todo by title from default list', async () => {
      const cmd = new CompleteCommand(['Buy groceries'], {} as any);
      
      await cmd.run();
      
      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith('Buy groceries', 'default');
    });

    test('completes todo by title from specific list', async () => {
      const cmd = new CompleteCommand(['work', 'Finish report'], {} as any);
      mockTodoService.prototype.getList = jest.fn().mockResolvedValue({
        ...mockList,
        name: 'work',
      });
      
      await cmd.run();
      
      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith('Finish report', 'work');
    });
  });

  describe('legacy flag patterns (backward compatibility)', () => {
    test('completes todo using -i flag', async () => {
      const cmd = new CompleteCommand([], { id: 'todo-789' } as any);
      
      await cmd.run();
      
      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith('todo-789', 'default');
    });

    test('completes todo using --id and --list flags', async () => {
      const cmd = new CompleteCommand([], { id: 'todo-999', list: 'personal' } as any);
      mockTodoService.prototype.getList = jest.fn().mockResolvedValue({
        ...mockList,
        name: 'personal',
      });
      
      await cmd.run();
      
      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith('todo-999', 'personal');
    });

    test('supports mixed format with positional list and -i flag', async () => {
      const cmd = new CompleteCommand(['mylist'], { id: 'Old task' } as any);
      
      await cmd.run();
      
      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith('Old task', 'mylist');
    });
  });

  describe('error handling with helpful messages', () => {
    test('shows available todos when no arguments provided', async () => {
      const cmd = new CompleteCommand([], {} as any);
      
      await expect(cmd.run()).rejects.toThrow(CLIError);
      
      try {
        await cmd.run();
      } catch (error: any) {
        expect(error.message).toContain('Please specify a todo to complete');
        expect(error.message).toContain('Usage:');
        expect(error.message).toContain('waltodo complete <todo-id>');
        expect(error.message).toContain('waltodo complete <list> <todo-id>');
      }
    });

    test('shows available lists when list not found', async () => {
      const cmd = new CompleteCommand(['nonexistent', 'todo-123'], {} as any);
      mockTodoService.prototype.getList = jest.fn().mockResolvedValue(null);
      mockTodoService.prototype.getLists = jest.fn().mockResolvedValue([
        { name: 'default' },
        { name: 'work' },
        { name: 'personal' },
      ]);
      
      await expect(cmd.run()).rejects.toThrow(CLIError);
      
      try {
        await cmd.run();
      } catch (error: any) {
        expect(error.message).toContain('List "nonexistent" not found');
        expect(error.message).toContain('Available lists: default, work, personal');
      }
    });

    test('shows available todos when todo not found', async () => {
      const cmd = new CompleteCommand(['mylist', 'nonexistent-todo'], {} as any);
      mockTodoService.prototype.getTodoByTitleOrId = jest.fn().mockResolvedValue(null);
      mockTodoService.prototype.getListItems = jest.fn().mockResolvedValue([
        { id: 'todo-111', title: 'Task 1', completed: false },
        { id: 'todo-222', title: 'Task 2', completed: false },
        { id: 'todo-333', title: 'Task 3', completed: true },
      ]);
      
      await expect(cmd.run()).rejects.toThrow(CLIError);
      
      try {
        await cmd.run();
      } catch (error: any) {
        expect(error.message).toContain('Todo "nonexistent-todo" not found in list "mylist"');
        expect(error.message).toContain('Available todos in this list:');
        expect(error.message).toContain('todo-111');
        expect(error.message).toContain('Task 1');
        expect(error.message).toContain('Task 2');
        expect(error.message).not.toContain('Task 3'); // Completed todos should not be shown
        expect(error.message).toContain('Tip: You can use either the todo ID or title');
      }
    });

    test('indicates when todo is already completed', async () => {
      const completedTodo = { ...mockTodo, completed: true };
      mockTodoService.prototype.getTodoByTitleOrId = jest.fn().mockResolvedValue(completedTodo);
      
      const cmd = new CompleteCommand(['todo-123'], {} as any);
      
      // Should not throw, just log a message
      await expect(cmd.run()).resolves.toBeUndefined();
    });
  });
});