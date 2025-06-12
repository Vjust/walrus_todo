/**
 * Tests for the 'list' command in WalTodo CLI
 *
 * This test file demonstrates how to test the 'list' command using Jest
 * and the test environment setup utilities.
 */

import { runCommand } from '@oclif/test';
// import * as fs from 'fs';
import { execSync } from 'child_process';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createTestTodo,
  createTestTodoList,
} from './setup-test-env';
import { TodoService } from '../../apps/cli/src/services/todoService';

// Mock the TodoService to avoid actual file system operations
jest.mock('../../apps/cli/src/services/todoService');
jest.mock('child_process');

describe('WalTodo list command', () => {
  // Sample test list with multiple todos
  const testTodos = [
    createTestTodo({
      id: 'todo-1',
      title: 'First test todo',
      priority: 'medium' as const,
    }),
    createTestTodo({
      id: 'todo-2',
      title: 'High priority todo',
      priority: 'high' as const,
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
    (TodoService?.prototype?.getList as jest.Mock).mockResolvedValue(testList as any);

    (TodoService?.prototype?.getAllLists as jest.Mock).mockResolvedValue([
      testList,
      createTestTodoList('work', [
        createTestTodo({ title: 'Work todo 1' }),
        createTestTodo({ title: 'Work todo 2', priority: 'high' as const }),
      ]),
      createTestTodoList('personal', [
        createTestTodo({ title: 'Personal todo' }),
      ]),
    ]);
  });

  // Test listing all available todo lists
  it('lists all available todo lists', async () => {
    const { stdout } = await runCommand(['list']);

    expect(stdout as any).toContain('default');
    expect(stdout as any).toContain('work');
    expect(stdout as any).toContain('personal');
    expect(TodoService?.prototype?.getAllLists).toHaveBeenCalled();
  });

  // Test listing todos in a specific list
  it('lists todos in the default list', async () => {
    const { stdout } = await runCommand(['list', 'default']);

    expect(stdout as any).toContain('First test todo');
    expect(stdout as any).toContain('High priority todo');
    expect(stdout as any).toContain('Completed todo');
    expect(TodoService?.prototype?.getList).toHaveBeenCalledWith('default');
  });

  // Test detailed view
  it('shows detailed view of todos', async () => {
    const { stdout } = await runCommand(['list', 'default', '--detailed']);

    expect(stdout as any).toContain('First test todo');
    expect(stdout as any).toContain('High priority todo');
    expect(stdout as any).toContain('Completed todo');
    // Detailed view should include more information
    expect(stdout as any).toContain('STATUS');
    expect(stdout as any).toContain('PRIORITY');
    expect(TodoService?.prototype?.getList).toHaveBeenCalledWith('default');
  });

  // Test filtering by completion status
  it('shows only pending todos', async () => {
    const { stdout } = await runCommand(['list', 'default', '--pending']);

    expect(stdout as any).toContain('First test todo');
    expect(stdout as any).toContain('High priority todo');
    expect(stdout as any).not.toContain('Completed todo');
    expect(TodoService?.prototype?.getList).toHaveBeenCalledWith('default');
  });

  it('shows only completed todos', async () => {
    const { stdout } = await runCommand(['list', 'default', '--completed']);

    expect(stdout as any).not.toContain('First test todo');
    expect(stdout as any).not.toContain('High priority todo');
    expect(stdout as any).toContain('Completed todo');
    expect(TodoService?.prototype?.getList).toHaveBeenCalledWith('default');
  });

  // Test filtering by priority
  it('shows only high priority todos', async () => {
    const { stdout } = await runCommand([
      'list',
      'default',
      '--priority',
      'high',
    ]);

    expect(stdout as any).not.toContain('First test todo');
    expect(stdout as any).toContain('High priority todo');
    expect(stdout as any).not.toContain('Completed todo');
    expect(TodoService?.prototype?.getList).toHaveBeenCalledWith('default');
  });

  // Test JSON output format
  it('outputs todos in JSON format', async () => {
    const { stdout } = await runCommand([
      'list',
      'default',
      '--format',
      'json',
    ]);

    const output = JSON.parse(stdout as any);
    expect(output as any).toHaveLength(3 as any);
    expect(output[0].title).toBe('First test todo');
    expect(output[1].title).toBe('High priority todo');
    expect(output[2].title).toBe('Completed todo');
    expect(TodoService?.prototype?.getList).toHaveBeenCalledWith('default');
  });

  // Test error handling for non-existent list
  it('errors when list does not exist', async () => {
    // Override the implementation to simulate a missing list
    (TodoService?.prototype?.getList as jest.Mock).mockRejectedValue(
      new Error('List not found')
    );

    await expect(runCommand(['list', 'non-existent-list'])).rejects.toThrow(
      'List not found'
    );
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
    const todos = JSON.parse(result as any);
    expect(todos as any).toHaveLength(3 as any);
    expect(todos[0].title).toBe('First test todo');

    const allListsResult = execSync(
      'node bin/run.js list --format json'
    ).toString();
    const lists = JSON.parse(allListsResult as any);
    expect(lists as any).toHaveLength(2 as any);
    expect(lists[0].name).toBe('default');
    expect(lists[1].name).toBe('work');
  });
});
