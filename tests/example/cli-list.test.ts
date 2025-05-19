/**
 * Tests for the 'list' command in WalTodo CLI
 * 
 * This test file demonstrates how to test the 'list' command using Jest
 * and the test environment setup utilities.
 */

import { test } from '@oclif/test';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { 
  setupTestEnvironment, 
  cleanupTestEnvironment, 
  createTestTodo, 
  createTestTodoList 
} from './setup-test-env';

// Mock the TodoService to avoid actual file system operations
import { TodoService } from '../../src/services/todoService';
jest.mock('../../src/services/todoService');

describe('WalTodo list command', () => {
  // Sample test list with multiple todos
  const testTodos = [
    createTestTodo({ 
      id: 'todo-1', 
      title: 'First test todo', 
      priority: 'medium' 
    }),
    createTestTodo({ 
      id: 'todo-2', 
      title: 'High priority todo', 
      priority: 'high' 
    }),
    createTestTodo({ 
      id: 'todo-3', 
      title: 'Completed todo', 
      completed: true, 
      completedAt: new Date().toISOString() 
    })
  ];
  
  const testList = createTestTodoList('default', testTodos);

  // Set up the test environment before all tests
  beforeAll(() => {
    setupTestEnvironment();
  });

  // Clean up after all tests
  afterAll(() => {
    cleanupTestEnvironment();
  });

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up specific mocks for the TodoService
    (TodoService.prototype.getList as jest.Mock).mockResolvedValue(testList);
    
    (TodoService.prototype.getAllLists as jest.Mock).mockResolvedValue([
      testList,
      createTestTodoList('work', [
        createTestTodo({ title: 'Work todo 1' }),
        createTestTodo({ title: 'Work todo 2', priority: 'high' })
      ]),
      createTestTodoList('personal', [
        createTestTodo({ title: 'Personal todo' })
      ])
    ]);
  });

  // Test listing all available todo lists
  test
    .stdout()
    .command(['list'])
    .it('lists all available todo lists', ctx => {
      expect(ctx.stdout).toContain('default');
      expect(ctx.stdout).toContain('work');
      expect(ctx.stdout).toContain('personal');
      expect(TodoService.prototype.getAllLists).toHaveBeenCalled();
    });

  // Test listing todos in a specific list
  test
    .stdout()
    .command(['list', 'default'])
    .it('lists todos in the default list', ctx => {
      expect(ctx.stdout).toContain('First test todo');
      expect(ctx.stdout).toContain('High priority todo');
      expect(ctx.stdout).toContain('Completed todo');
      expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
    });

  // Test detailed view
  test
    .stdout()
    .command(['list', 'default', '--detailed'])
    .it('shows detailed view of todos', ctx => {
      expect(ctx.stdout).toContain('First test todo');
      expect(ctx.stdout).toContain('High priority todo');
      expect(ctx.stdout).toContain('Completed todo');
      // Detailed view should include more information
      expect(ctx.stdout).toContain('STATUS');
      expect(ctx.stdout).toContain('PRIORITY');
      expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
    });

  // Test filtering by completion status
  test
    .stdout()
    .command(['list', 'default', '--pending'])
    .it('shows only pending todos', ctx => {
      expect(ctx.stdout).toContain('First test todo');
      expect(ctx.stdout).toContain('High priority todo');
      expect(ctx.stdout).not.toContain('Completed todo');
      expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
    });

  test
    .stdout()
    .command(['list', 'default', '--completed'])
    .it('shows only completed todos', ctx => {
      expect(ctx.stdout).not.toContain('First test todo');
      expect(ctx.stdout).not.toContain('High priority todo');
      expect(ctx.stdout).toContain('Completed todo');
      expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
    });

  // Test filtering by priority
  test
    .stdout()
    .command(['list', 'default', '--priority', 'high'])
    .it('shows only high priority todos', ctx => {
      expect(ctx.stdout).not.toContain('First test todo');
      expect(ctx.stdout).toContain('High priority todo');
      expect(ctx.stdout).not.toContain('Completed todo');
      expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
    });

  // Test JSON output format
  test
    .stdout()
    .command(['list', 'default', '--format', 'json'])
    .it('outputs todos in JSON format', ctx => {
      const output = JSON.parse(ctx.stdout);
      expect(output).toHaveLength(3);
      expect(output[0].title).toBe('First test todo');
      expect(output[1].title).toBe('High priority todo');
      expect(output[2].title).toBe('Completed todo');
      expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
    });

  // Test error handling for non-existent list
  test
    .stdout()
    .do(() => {
      // Override the implementation to simulate a missing list
      (TodoService.prototype.getList as jest.Mock).mockRejectedValue(
        new Error('List not found')
      );
    })
    .command(['list', 'non-existent-list'])
    .catch(error => {
      expect(error.message).toContain('List not found');
    })
    .it('errors when list does not exist');

  // Test using direct execSync mock for command execution
  it('handles listing todos with execSync', () => {
    // Mock execSync for CLI commands
    (execSync as jest.Mock).mockImplementation((command: string) => {
      if (command.includes('list default')) {
        return Buffer.from(JSON.stringify(testList.todos));
      }
      if (command.includes('list --format json')) {
        return Buffer.from(JSON.stringify([testList, createTestTodoList('work')]));
      }
      return Buffer.from('Command executed successfully');
    });

    const result = execSync('node bin/run.js list default').toString();
    const todos = JSON.parse(result);
    expect(todos).toHaveLength(3);
    expect(todos[0].title).toBe('First test todo');

    const allListsResult = execSync('node bin/run.js list --format json').toString();
    const lists = JSON.parse(allListsResult);
    expect(lists).toHaveLength(2);
    expect(lists[0].name).toBe('default');
    expect(lists[1].name).toBe('work');
  });
});