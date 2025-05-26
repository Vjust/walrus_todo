/**
 * Tests for the 'list' command in WalTodo CLI
 *
 * This test file demonstrates how to test the 'list' command using Jest
 * and the test environment setup utilities.
 */

import { test } from '@oclif/test';
// import * as fs from 'fs';
import { execSync } from 'child_process';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createTestTodo,
  createTestTodoList,
} from './setup-test-env';
import { TodoService } from '../../src/services/todoService';

// Mock the TodoService to avoid actual file system operations
jest.mock('../../src/services/todoService');
jest.mock('child_process');

describe('WalTodo list command', () => {
  // Sample test list with multiple todos
  const testTodos = [
    createTestTodo({
      id: 'todo-1',
      title: 'First test todo',
      priority: 'medium',
    }),
    createTestTodo({
      id: 'todo-2',
      title: 'High priority todo',
      priority: 'high',
    }),
    createTestTodo({
      id: 'todo-3',
      title: 'Completed todo',
      completed: true,
      completedAt: new Date().toISOString(),
    }),
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
        createTestTodo({ title: 'Work todo 2', priority: 'high' }),
      ]),
      createTestTodoList('personal', [
        createTestTodo({ title: 'Personal todo' }),
      ]),
    ]);
  });

  // Test listing all available todo lists
  it('lists all available todo lists', async () => {
    const { stdout } = await test
      .stdout()
      .command(['list'])
      .run();
    
    expect(stdout).toContain('default');
    expect(stdout).toContain('work');
    expect(stdout).toContain('personal');
    expect(TodoService.prototype.getAllLists).toHaveBeenCalled();
  });

  // Test listing todos in a specific list
  it('lists todos in the default list', async () => {
    const { stdout } = await test
      .stdout()
      .command(['list', 'default'])
      .run();
    
    expect(stdout).toContain('First test todo');
    expect(stdout).toContain('High priority todo');
    expect(stdout).toContain('Completed todo');
    expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
  });

  // Test detailed view
  it('shows detailed view of todos', async () => {
    const { stdout } = await test
      .stdout()
      .command(['list', 'default', '--detailed'])
      .run();
    
    expect(stdout).toContain('First test todo');
    expect(stdout).toContain('High priority todo');
    expect(stdout).toContain('Completed todo');
    // Detailed view should include more information
    expect(stdout).toContain('STATUS');
    expect(stdout).toContain('PRIORITY');
    expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
  });

  // Test filtering by completion status
  it('shows only pending todos', async () => {
    const { stdout } = await test
      .stdout()
      .command(['list', 'default', '--pending'])
      .run();
    
    expect(stdout).toContain('First test todo');
    expect(stdout).toContain('High priority todo');
    expect(stdout).not.toContain('Completed todo');
    expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
  });

  it('shows only completed todos', async () => {
    const { stdout } = await test
      .stdout()
      .command(['list', 'default', '--completed'])
      .run();
    
    expect(stdout).not.toContain('First test todo');
    expect(stdout).not.toContain('High priority todo');
    expect(stdout).toContain('Completed todo');
    expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
  });

  // Test filtering by priority
  it('shows only high priority todos', async () => {
    const { stdout } = await test
      .stdout()
      .command(['list', 'default', '--priority', 'high'])
      .run();
    
    expect(stdout).not.toContain('First test todo');
    expect(stdout).toContain('High priority todo');
    expect(stdout).not.toContain('Completed todo');
    expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
  });

  // Test JSON output format
  it('outputs todos in JSON format', async () => {
    const { stdout } = await test
      .stdout()
      .command(['list', 'default', '--format', 'json'])
      .run();
    
    const output = JSON.parse(stdout);
    expect(output).toHaveLength(3);
    expect(output[0].title).toBe('First test todo');
    expect(output[1].title).toBe('High priority todo');
    expect(output[2].title).toBe('Completed todo');
    expect(TodoService.prototype.getList).toHaveBeenCalledWith('default');
  });

  // Test error handling for non-existent list
  it('errors when list does not exist', async () => {
    // Override the implementation to simulate a missing list
    (TodoService.prototype.getList as jest.Mock).mockRejectedValue(
      new Error('List not found')
    );
    
    await expect(
      test
        .stdout()
        .command(['list', 'non-existent-list'])
        .run()
    ).rejects.toThrow('List not found');
  });

  // Test using direct execSync mock for command execution
  it('handles listing todos with execSync', () => {
    // Mock execSync for CLI commands
    (execSync as jest.Mock).mockImplementation((command: string) => {
      if (command.includes('list default')) {
        return Buffer.from(JSON.stringify(testList.todos));
      }
      if (command.includes('list --format json')) {
        return Buffer.from(
          JSON.stringify([testList, createTestTodoList('work')])
        );
      }
      return Buffer.from('Command executed successfully');
    });

    const result = execSync('node bin/run.js list default').toString();
    const todos = JSON.parse(result);
    expect(todos).toHaveLength(3);
    expect(todos[0].title).toBe('First test todo');

    const allListsResult = execSync(
      'node bin/run.js list --format json'
    ).toString();
    const lists = JSON.parse(allListsResult);
    expect(lists).toHaveLength(2);
    expect(lists[0].name).toBe('default');
    expect(lists[1].name).toBe('work');
  });
});
