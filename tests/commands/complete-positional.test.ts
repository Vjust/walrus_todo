import { expect, describe, test, beforeEach, jest } from '@jest/globals';
import CompleteCommand from '../../apps/cli/src/commands/complete';
import { TodoService } from '../../apps/cli/src/services/todoService';
import { configService } from '../../apps/cli/src/services/config-service';
import { TodoList, Todo } from '../../apps/cli/src/types/todo';
import { CLIError } from '../../apps/cli/src/types/errors/consolidated';

// Mock services
jest.mock('../../apps/cli/src/services/todoService');
jest.mock('../../apps/cli/src/services/config-service');
jest.mock('../../apps/cli/src/utils/walrus-storage', () => ({
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
    mockTodoService.prototype.getAllLists = jest
      .fn()
      .mockResolvedValue(['mylist']);
    mockTodoService.prototype.getTodoByTitleOrId = jest
      .fn()
      .mockResolvedValue(mockTodo);
    // Remove getListItems mock since the method doesn't exist in TodoService
    mockTodoService.prototype.toggleItemStatus = jest
      .fn()
      .mockResolvedValue(undefined);
  });

  describe('new positional argument patterns', () => {
    test('completes todo from default list with single argument', async () => {
      const cmd = new CompleteCommand(['todo-123'], {} as any);

      await cmd.run();

      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith(
        'todo-123',
        'default'
      );
      expect(mockTodoService.prototype.toggleItemStatus).toHaveBeenCalledWith(
        'default',
        'todo-123',
        true
      );
    });

    test('completes todo from specific list with two arguments', async () => {
      const cmd = new CompleteCommand(['mylist', 'todo-456'], {} as any);

      await cmd.run();

      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith(
        'todo-456',
        'mylist'
      );
      expect(mockTodoService.prototype.toggleItemStatus).toHaveBeenCalledWith(
        'mylist',
        'todo-123',
        true
      );
    });

    test('completes todo by title from default list', async () => {
      const cmd = new CompleteCommand(['Buy groceries'], {} as any);

      await cmd.run();

      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith(
        'Buy groceries',
        'default'
      );
    });

    test('completes todo by title from specific list', async () => {
      const cmd = new CompleteCommand(['work', 'Finish report'], {} as any);
      mockTodoService.prototype.getList = jest.fn().mockResolvedValue({
        ...mockList,
        name: 'work',
      });

      await cmd.run();

      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith(
        'Finish report',
        'work'
      );
    });
  });

  describe('legacy flag patterns (backward compatibility)', () => {
    test('completes todo using -i flag', async () => {
      const cmd = new CompleteCommand([], { id: 'todo-789' } as any);

      await cmd.run();

      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith(
        'todo-789',
        'default'
      );
    });

    test('completes todo using --id and --list flags', async () => {
      const cmd = new CompleteCommand([], {
        id: 'todo-999',
        list: 'personal',
      } as any);
      mockTodoService.prototype.getList = jest.fn().mockResolvedValue({
        ...mockList,
        name: 'personal',
      });

      await cmd.run();

      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith(
        'todo-999',
        'personal'
      );
    });

    test('supports mixed format with positional list and -i flag', async () => {
      const cmd = new CompleteCommand(['mylist'], { id: 'Old task' } as any);

      await cmd.run();

      expect(mockTodoService.prototype.getTodoByTitleOrId).toHaveBeenCalledWith(
        'Old task',
        'mylist'
      );
    });
  });

  describe('error handling with helpful messages', () => {
    test('shows available todos when no arguments provided', async () => {
      const cmd = new CompleteCommand([], {} as any);

      await expect(cmd.run()).rejects.toThrow(CLIError);

      await expect(cmd.run()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringMatching(
            /Please specify a todo to complete.*Usage:.*waltodo complete <todo-id>.*waltodo complete <list> <todo-id>/s
          )
        })
      );
    });

    test('shows available lists when list not found', async () => {
      const cmd = new CompleteCommand(['nonexistent', 'todo-123'], {} as any);
      mockTodoService.prototype.getList = jest.fn().mockResolvedValue(null);
      mockTodoService.prototype.getAllLists = jest
        .fn()
        .mockResolvedValue(['default', 'work', 'personal']);

      await expect(cmd.run()).rejects.toThrow(CLIError);

      await expect(cmd.run()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringMatching(
            /List "nonexistent" not found.*Available lists: default, work, personal/s
          )
        })
      );
    });

    test('shows available todos when todo not found', async () => {
      const cmd = new CompleteCommand(
        ['mylist', 'nonexistent-todo'],
        {} as any
      );
      mockTodoService.prototype.getTodoByTitleOrId = jest
        .fn()
        .mockResolvedValue(null);
      // Update getList to return a list with todos instead of using getListItems
      mockTodoService.prototype.getList = jest.fn().mockResolvedValue({
        ...mockList,
        todos: [
          { id: 'todo-111', title: 'Task 1', completed: false },
          { id: 'todo-222', title: 'Task 2', completed: false },
          { id: 'todo-333', title: 'Task 3', completed: true },
        ]
      });

      await expect(cmd.run()).rejects.toThrow(CLIError);

      await expect(cmd.run()).rejects.toThrow(
        expect.objectContaining({
          message: expect.allOf([
            expect.stringMatching(
              /Todo "nonexistent-todo" not found in list "mylist".*Available todos in this list:.*todo-111.*Task 1.*Task 2.*Tip: You can use either the todo ID or title/s
            ),
            expect.not.stringContaining('Task 3') // Completed todos should not be shown
          ])
        })
      );
    });

    test('indicates when todo is already completed', async () => {
      const completedTodo = { ...mockTodo, completed: true };
      mockTodoService.prototype.getTodoByTitleOrId = jest
        .fn()
        .mockResolvedValue(completedTodo);

      const cmd = new CompleteCommand(['todo-123'], {} as any);

      // Should not throw, just log a message
      await expect(cmd.run()).resolves.toBeUndefined();
    });
  });
});
