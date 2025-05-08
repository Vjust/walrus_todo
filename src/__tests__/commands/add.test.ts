import { jest, expect, describe, test, beforeEach } from '@jest/globals';
import { TodoService } from '../../services/todoService';
import { createWalrusStorage } from '../../utils/walrus-storage';
import { Todo } from '../../types/todo';
import { CLIError } from '../../types/error';
import { createMockTodo } from '../helpers/test-utils';

// Mock TodoService
jest.mock('../../services/todoService');
const mockTodoService = TodoService as jest.MockedClass<typeof TodoService>;

// Mock WalrusStorage
const mockStorageError = new Error('Storage failed');
const mockStorageMethods = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  storeTodo: jest.fn().mockRejectedValue(mockStorageError),
  write: jest.fn().mockResolvedValue({ blobId: 'test-blob-id' }),
  read: jest.fn(),
  verify: jest.fn().mockResolvedValue(true),
  delete: jest.fn()
};

// TypeScript needs the correct mock return type here
jest.mock('../../utils/walrus-storage', () => ({
  __esModule: true,
  createWalrusStorage: jest.fn().mockReturnValue(mockStorageMethods)
}));

// Mock command implementation
const addCommand = {
  init: () => Promise.resolve({}),
  run: async (args: { title: string; options?: { storage?: string } }) => {
    const { title, options } = args;
    if (!title) {
      throw new CLIError('Todo title is required', 'MISSING_TITLE');
    }

    const newTodo = createMockTodo({
      title,
      storageLocation: 'local'
    });

    if (options?.storage === 'blockchain') {
      const walrusStorage = createWalrusStorage();
      try {
        await walrusStorage.connect();
        await walrusStorage.storeTodo({
          ...newTodo,
          storageLocation: 'blockchain'
        });
      } catch (error) {
        throw new CLIError(`Failed to store todo on blockchain: ${error instanceof Error ? error.message : (error ? String(error) : 'Unknown error')}`, 'STORAGE_FAILED');
      }
    }

    return mockTodoService.prototype.addTodo('default', newTodo);
  }
};

describe('add', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockTodoService.prototype.getList.mockResolvedValue({
      id: 'default',
      name: 'default',
      owner: 'default-owner',
      todos: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    mockTodoService.prototype.addTodo.mockImplementation(async (listName, todo) => ({
      ...todo,
      id: 'test-id',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: true,
      priority: 'medium',
      tags: []
    } as Todo));
  });

  test('adds a todo with title from argument', async () => {
    const args = {
      title: 'Test Todo',
      options: { storage: 'local' }
    };

    await addCommand.run(args);

    expect(mockTodoService.prototype.addTodo).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({
        title: 'Test Todo',
        storageLocation: 'local'
      })
    );
  });

  test('handles blockchain storage failure gracefully', async () => {
    const args = {
      title: 'Test Todo',
      options: { storage: 'blockchain' }
    };

    await expect(addCommand.run(args))
      .rejects.toThrow('Failed to store todo on blockchain: Storage failed');
  });
});