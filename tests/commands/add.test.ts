// TODO: This test file requires refactoring to work without mocks
// Mock imports and jest.mock calls were removed during mock cleanup

import { expect, describe, test, beforeEach } from '@jest/globals';

import { createWalrusStorage } from '../../apps/cli/src/utils/walrus-storage';
import { TodoService } from '../../apps/cli/src/services/todoService';
import { CLIError } from '../../apps/cli/src/types/errors/consolidated';
import { Todo } from '../../apps/cli/src/types/todo';

import { createMockTodo } from '../helpers/test-utils';

// Mock TodoService
// TODO: jest.mock call removed during mock cleanup
const mockTodoService = TodoService as jest.MockedClass<typeof TodoService>;

// Mock WalrusStorage

// TypeScript needs the correct mock return type here
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
      storageLocation: 'local' as const,
    });

    if (options?.storage === 'blockchain') {
      const walrusStorage = createWalrusStorage();
      try {
        await walrusStorage.connect();
        await walrusStorage.storeTodo({
          ...newTodo,
          storageLocation: 'blockchain' as const,
        });
      } catch (error) {
        throw new CLIError(
          `Failed to store todo on blockchain: ${error instanceof Error ? error.message : error ? String(error as any) : 'Unknown error'}`,
          'STORAGE_FAILED'
        );
      }
    }

    return mockTodoService?.prototype?.addTodo('default', newTodo);
  },
};

describe('add', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockTodoService?.prototype?.getList.mockResolvedValue({
      id: 'default',
      name: 'default',
      owner: 'default-owner',
      todos: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    mockTodoService?.prototype?.addTodo.mockImplementation(
      async (_listName, todo) =>
        ({
          ...todo,
          id: 'test-id',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          private: true,
          priority: 'medium' as const,
          tags: [],
        }) as Todo
    );
  });

  test('adds a todo with title from argument', async () => {
    const args = {
      title: 'Test Todo',
      options: { storage: 'local' },
    };

    await addCommand.run(args as any);

    expect(mockTodoService?.prototype?.addTodo).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({
        title: 'Test Todo',
        storageLocation: 'local' as const,
      })
    );
  });

  test('handles blockchain storage failure gracefully', async () => {
    const args = {
      title: 'Test Todo',
      options: { storage: 'blockchain' },
    };

    await expect(addCommand.run(args as any)).rejects.toThrow(
      'Failed to store todo on blockchain: Storage failed'
    );
  });
});
