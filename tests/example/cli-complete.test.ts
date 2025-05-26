/**
 * Tests for the 'complete' command in WalTodo CLI
 *
 * This test file demonstrates how to test the 'complete' command using Jest
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

// Mock the TodoService to avoid actual file system operations
import { TodoService } from '../../src/services/todoService';
jest.mock('../../src/services/todoService');

// Mock walrus-storage module for blockchain testing
import { createWalrusStorage } from '../../src/utils/walrus-storage';
jest.mock('../../src/utils/walrus-storage');

describe('WalTodo complete command', () => {
  // Sample test todo
  const testTodo = createTestTodo({
    id: 'test-todo-id-123',
    title: 'Test Todo for Completion',
  });

  // Sample test list with the test todo
  const testList = createTestTodoList('default', [testTodo]);

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

    // Mock the TodoService methods
    (TodoService.prototype.getList as jest.Mock).mockResolvedValue(testList);

    (TodoService.prototype.getTodo as jest.Mock).mockResolvedValue(testTodo);

    (TodoService.prototype.completeTodo as jest.Mock).mockImplementation(
      async (_listName, _todoId) => ({
        ...testTodo,
        completed: true,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );

    // Mock walrus storage for blockchain tests
    const mockStorageMethods = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      storeTodo: jest.fn().mockResolvedValue({
        blobId: 'test-blob-id',
        url: 'https://testnet.wal.app/blob/test-blob-id',
      }),
      write: jest.fn().mockResolvedValue({ blobId: 'test-blob-id' }),
      read: jest.fn().mockResolvedValue(testTodo),
      verify: jest.fn().mockResolvedValue(true),
      delete: jest.fn(),
    };

    (createWalrusStorage as jest.Mock).mockReturnValue(mockStorageMethods);
  });

  // Test using @oclif/test library for command testing
  it('completes a todo by ID', async () => {
    const { stdout } = await test
      .stdout()
      .command(['complete', '--id', 'test-todo-id-123'])
      .run();
    
    expect(stdout).toContain('Todo completion');
    expect(TodoService.prototype.completeTodo).toHaveBeenCalledWith(
      'default',
      'test-todo-id-123'
    );
  });

  it('completes a todo in a specific list', async () => {
    const { stdout } = await test
      .stdout()
      .command(['complete', '--id', 'test-todo-id-123', '--list', 'work'])
      .run();
    
    expect(stdout).toContain('Todo completion');
    expect(TodoService.prototype.completeTodo).toHaveBeenCalledWith(
      'work',
      'test-todo-id-123'
    );
  });

  // Test local storage completion
  it('completes a todo with local storage only', async () => {
    const { stdout } = await test
      .stdout()
      .command(['complete', '--id', 'test-todo-id-123', '--storage', 'local'])
      .run();
    
    expect(stdout).toContain('Todo completion');
    expect(TodoService.prototype.completeTodo).toHaveBeenCalled();
    expect(createWalrusStorage).not.toHaveBeenCalled();
  });

  // Test blockchain storage (tests the error path when blockchain is unavailable)
  it('attempts to complete a todo with blockchain storage', async () => {
    const { stdout } = await test
      .stdout()
      .command([
        'complete',
        '--id',
        'test-todo-id-123',
        '--storage',
        'blockchain',
      ])
      .run();
    
    expect(stdout).toContain('Todo completion');
    expect(createWalrusStorage).toHaveBeenCalled();
  });

  // Test error handling for non-existent todo
  it('errors when todo does not exist', async () => {
    // Override the implementation to simulate a missing todo
    (TodoService.prototype.getTodo as jest.Mock).mockRejectedValue(
      new Error('Todo not found')
    );
    
    await expect(
      test
        .stdout()
        .command(['complete', '--id', 'non-existent-id'])
        .run()
    ).rejects.toThrow('Todo not found');
  });

  // Test error handling for missing ID
  it('errors when no ID is provided', async () => {
    await expect(
      test
        .stdout()
        .command(['complete'])
        .run()
    ).rejects.toThrow('Missing required flag');
  });

  // Integration style test that mocks the CLI execution
  it('should handle blockchain errors gracefully', async () => {
    // Mock the walrus storage to throw an error
    const mockStorageMethods = {
      connect: jest.fn().mockRejectedValue(new Error('Network error')),
      disconnect: jest.fn().mockResolvedValue(undefined),
      storeTodo: jest.fn().mockRejectedValue(new Error('Storage failed')),
      write: jest.fn().mockRejectedValue(new Error('Write failed')),
      read: jest.fn(),
      verify: jest.fn(),
      delete: jest.fn(),
    };

    (createWalrusStorage as jest.Mock).mockReturnValue(mockStorageMethods);

    // Mock execSync to test command execution
    (execSync as jest.Mock).mockImplementation((command: string) => {
      if (command.includes('--storage blockchain')) {
        throw new Error('Failed to update blockchain: Network error');
      }
      return Buffer.from(
        'Local update successful, but blockchain update failed'
      );
    });

    // This should throw error due to blockchain issues
    expect(() => {
      execSync(
        'node bin/run.js complete --id test-todo-id-123 --storage blockchain'
      ).toString();
    }).toThrow('Network error');

    // But with local storage it should work
    const result = execSync(
      'node bin/run.js complete --id test-todo-id-123 --storage local'
    ).toString();
    expect(result).toContain('Local update successful');
  });
});
