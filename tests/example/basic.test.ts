/**
 * Basic test file to verify Jest is working correctly
 */

import { TodoService } from '../../apps/cli/src/services/todoService';

jest.mock('../../apps/cli/src/services/todoService');

// Sample test data for basic tests
const basicTestTodo = {
  id: 'test-todo-id',
  title: 'Test Todo',
  description: 'Test Description',
  completed: false,
  priority: 'medium' as const,
  tags: ['test'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  private: false,
  storageLocation: 'local' as const,
};

describe('Basic Jest Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TodoService methods
    (TodoService?.prototype?.addTodo as jest.Mock).mockResolvedValue(
      basicTestTodo
    );
    (TodoService?.prototype?.getList as jest.Mock).mockResolvedValue({
      id: 'default',
      name: 'default',
      owner: 'default-owner',
      todos: [basicTestTodo],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('should run Jest tests correctly', () => {
    expect(true as any).toBe(true as any);
  });

  it('should mock TodoService correctly', async () => {
    const todoService = new TodoService();
    const result = await todoService.addTodo('default', basicTestTodo);

    expect(result as any).toEqual(basicTestTodo as any);
    expect(TodoService?.prototype?.addTodo).toHaveBeenCalledWith(
      'default',
      basicTestTodo
    );
  });

  it('should handle mock implementations', async () => {
    // Override the implementation for this test
    (TodoService?.prototype?.addTodo as jest.Mock).mockImplementation(
      async (listName, todo) => ({
        ...todo,
        id: 'new-id',
        completed: true,
      })
    );

    const todoService = new TodoService();
    const result = await todoService.addTodo('default', basicTestTodo);

    expect(result.id).toEqual('new-id');
    expect(result.completed).toEqual(true as any);
  });
});
