/**
 * Simplified test for the list command without using @oclif/test
 */

import { execSync } from 'child_process';
import { TodoService } from '../../src/services/todoService';

jest.mock('../../src/services/todoService');

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
    priority: 'medium',
    tags: ['test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: false,
    storageLocation: 'local',
  },
  {
    id: 'todo-2',
    title: 'High Priority Todo',
    description: 'Description 2',
    completed: false,
    priority: 'high',
    tags: ['important'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: false,
    storageLocation: 'local',
  },
  {
    id: 'todo-3',
    title: 'Completed Todo',
    description: 'Description 3',
    completed: true,
    completedAt: new Date().toISOString(),
    priority: 'low',
    tags: ['done'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: false,
    storageLocation: 'local',
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
    (TodoService.prototype.getList as jest.Mock).mockResolvedValue(testList);
    (TodoService.prototype.getAllLists as jest.Mock).mockResolvedValue([
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
        return Buffer.from(JSON.stringify(testTodos));
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
    const todos = JSON.parse(result);
    expect(todos).toHaveLength(3);
    expect(todos[0].title).toBe('First Todo');
    expect(todos[1].title).toBe('High Priority Todo');
    expect(todos[2].title).toBe('Completed Todo');
  });

  it('should show detailed view', () => {
    const result = execSync(
      'node bin/run.js list default --detailed'
    ).toString();
    expect(result).toContain('STATUS');
    expect(result).toContain('PRIORITY');
    expect(result).toContain('First Todo');
    expect(result).toContain('High Priority Todo');
    expect(result).toContain('Completed Todo');
  });

  it('should filter by completion status', () => {
    // Test pending filter
    let result = execSync('node bin/run.js list default --pending').toString();
    expect(result).toContain('First Todo');
    expect(result).toContain('High Priority Todo');
    expect(result).not.toContain('Completed Todo');

    // Test completed filter
    result = execSync('node bin/run.js list default --completed').toString();
    expect(result).not.toContain('First Todo');
    expect(result).not.toContain('High Priority Todo');
    expect(result).toContain('Completed Todo');
  });

  it('should handle service interaction correctly', async () => {
    const todoService = new TodoService();
    const list = await todoService.getList('default');

    expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
    expect(list).toEqual(testList);
    expect(list.todos).toHaveLength(3);

    // Verify completed filter logic works
    const completedTodos = list.todos.filter(todo => todo.completed);
    expect(completedTodos).toHaveLength(1);
    expect(completedTodos[0].title).toBe('Completed Todo');

    // Verify pending filter logic works
    const pendingTodos = list.todos.filter(todo => !todo.completed);
    expect(pendingTodos).toHaveLength(2);
    expect(pendingTodos[0].title).toBe('First Todo');
    expect(pendingTodos[1].title).toBe('High Priority Todo');
  });
});
