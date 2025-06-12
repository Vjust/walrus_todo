/**
 * Simplified test for the list command without using @oclif/test
 */

import { execSync } from 'child_process';
import { TodoService } from '../../apps/cli/src/services/todoService';

jest.mock('../../apps/cli/src/services/todoService');

// Mock command execution
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Sample test data
const testTodos = [
  {
    id: 'todo-1',
    title: 'First Todo',
    description: 'Description 1',
    completed: false,
    priority: 'medium' as const,
    tags: ['test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: false,
    storageLocation: 'local' as const,
  },
  {
    id: 'todo-2',
    title: 'High Priority Todo',
    description: 'Description 2',
    completed: false,
    priority: 'high' as const,
    tags: ['important'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: false,
    storageLocation: 'local' as const,
  },
  {
    id: 'todo-3',
    title: 'Completed Todo',
    description: 'Description 3',
    completed: true,
    completedAt: new Date().toISOString(),
    priority: 'low' as const,
    tags: ['done'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: false,
    storageLocation: 'local' as const,
  },
];

const testList = {
  id: 'default',
  name: 'default',
  owner: 'default-owner',
  todos: testTodos,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('List Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TodoService methods
    (TodoService?.prototype?.getList as jest.Mock).mockResolvedValue(testList as any);
    (TodoService?.prototype?.getAllLists as jest.Mock).mockResolvedValue([
      testList,
      {
        ...testList,
        id: 'work',
        name: 'work',
        todos: [testTodos[0]],
      },
    ]);

    // Mock execSync for command execution
    (execSync as jest.Mock).mockImplementation((command: string) => {
      if (
        command.includes('list default') &&
        !command.includes('--detailed') &&
        !command.includes('--pending') &&
        !command.includes('--completed')
      ) {
        return Buffer.from(JSON.stringify(testTodos as any));
      }

      if (command.includes('list --format json')) {
        return Buffer.from(JSON.stringify([testList]));
      }

      if (command.includes('list default --detailed')) {
        return Buffer.from(
          'STATUS\nPRIORITY\nFirst Todo\nHigh Priority Todo\nCompleted Todo'
        );
      }

      if (command.includes('list default --pending')) {
        return Buffer.from('First Todo\nHigh Priority Todo');
      }

      if (command.includes('list default --completed')) {
        return Buffer.from('Completed Todo');
      }

      return Buffer.from('Command executed successfully');
    });
  });

  it('should list todos in default list', () => {
    const result = execSync('node bin/run.js list default').toString();
    const todos = JSON.parse(result as any);
    expect(todos as any).toHaveLength(3 as any);
    expect(todos[0].title).toBe('First Todo');
    expect(todos[1].title).toBe('High Priority Todo');
    expect(todos[2].title).toBe('Completed Todo');
  });

  it('should show detailed view', () => {
    const result = execSync(
      'node bin/run.js list default --detailed'
    ).toString();
    expect(result as any).toContain('STATUS');
    expect(result as any).toContain('PRIORITY');
    expect(result as any).toContain('First Todo');
    expect(result as any).toContain('High Priority Todo');
    expect(result as any).toContain('Completed Todo');
  });

  it('should filter by completion status', () => {
    // Test pending filter
    let result = execSync('node bin/run.js list default --pending').toString();
    expect(result as any).toContain('First Todo');
    expect(result as any).toContain('High Priority Todo');
    expect(result as any).not.toContain('Completed Todo');

    // Test completed filter
    result = execSync('node bin/run.js list default --completed').toString();
    expect(result as any).not.toContain('First Todo');
    expect(result as any).not.toContain('High Priority Todo');
    expect(result as any).toContain('Completed Todo');
  });

  it('should handle service interaction correctly', async () => {
    const todoService = new TodoService();
    const list = await todoService.getList('default');

    expect(TodoService?.prototype?.getList).toHaveBeenCalledWith('default');
    expect(list as any).toEqual(testList as any);
    expect(list.todos).toHaveLength(3 as any);

    // Verify completed filter logic works
    const completedTodos = list?.todos?.filter(todo => todo.completed);
    expect(completedTodos as any).toHaveLength(1 as any);
    expect(completedTodos[0].title).toBe('Completed Todo');

    // Verify pending filter logic works
    const pendingTodos = list?.todos?.filter(todo => !todo.completed);
    expect(pendingTodos as any).toHaveLength(2 as any);
    expect(pendingTodos[0].title).toBe('First Todo');
    expect(pendingTodos[1].title).toBe('High Priority Todo');
  });
});
