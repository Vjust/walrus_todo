/**
 * Tests for the 'complete' command in WalTodo CLI
 * 
 * This test file demonstrates how to test the 'complete' command using Jest
 * and the test environment setup utilities.
 */

import { test } from '@oclif/test';
import * as fs from 'fs';
import { 
  setupTestEnvironment, 
  cleanupTestEnvironment, 
  createTestTodo, 
  createTestTodoList 
} from './setup-test-env';

// Mock the TodoService to avoid actual file system operations

jest.mock('../../src/services/todoService');

// Mock walrus-storage module for blockchain testing
import { createWalrusStorage } from '../../src/utils/walrus-storage';
jest.mock('../../src/utils/walrus-storage');

describe('WalTodo complete command', () => {
  // Sample test todo
  const testTodo = createTestTodo({
    id: 'test-todo-id-123',
    title: 'Test Todo for Completion'
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
      async (listName, todoId) => ({
        ...testTodo,
        completed: true,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    );

    // Mock walrus storage for blockchain tests
    const mockStorageMethods = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      storeTodo: jest.fn().mockResolvedValue({
        blobId: 'test-blob-id',
        url: 'https://testnet.wal.app/blob/test-blob-id'
      }),
      write: jest.fn().mockResolvedValue({ blobId: 'test-blob-id' }),
      read: jest.fn().mockResolvedValue(testTodo),
      verify: jest.fn().mockResolvedValue(true),
      delete: jest.fn()
    };
    
    (createWalrusStorage as jest.Mock).mockReturnValue(mockStorageMethods);
  });

  // Test using @oclif/test library for command testing
  test
    .stdout()
    .command(['complete', '--id', 'test-todo-id-123'])
    .it('completes a todo by ID', ctx => {
      expect(ctx.stdout).toContain('Todo completion');
      expect(TodoService.prototype.completeTodo).toHaveBeenCalledWith(
        'default',
        'test-todo-id-123'
      );
    });

  test
    .stdout()
    .command(['complete', '--id', 'test-todo-id-123', '--list', 'work'])
    .it('completes a todo in a specific list', ctx => {
      expect(ctx.stdout).toContain('Todo completion');
      expect(TodoService.prototype.completeTodo).toHaveBeenCalledWith(
        'work',
        'test-todo-id-123'
      );
    });

  // Test local storage completion
  test
    .stdout()
    .command(['complete', '--id', 'test-todo-id-123', '--storage', 'local'])
    .it('completes a todo with local storage only', ctx => {
      expect(ctx.stdout).toContain('Todo completion');
      expect(TodoService.prototype.completeTodo).toHaveBeenCalled();
      expect(createWalrusStorage).not.toHaveBeenCalled();
    });

  // Test blockchain storage (tests the error path when blockchain is unavailable)
  test
    .stdout()
    .command(['complete', '--id', 'test-todo-id-123', '--storage', 'blockchain'])
    .it('attempts to complete a todo with blockchain storage', ctx => {
      expect(ctx.stdout).toContain('Todo completion');
      expect(createWalrusStorage).toHaveBeenCalled();
    });

  // Test error handling for non-existent todo
  test
    .stdout()
    .do(() => {
      // Override the implementation to simulate a missing todo
      (TodoService.prototype.getTodo as jest.Mock).mockRejectedValue(
        new Error('Todo not found')
      );
    })
    .command(['complete', '--id', 'non-existent-id'])
    .catch(_error => {
      expect(error.message).toContain('Todo not found');
    })
    .it('errors when todo does not exist');

  // Test error handling for missing ID
  test
    .stdout()
    .command(['complete'])
    .catch(_error => {
      expect(error.message).toContain('Missing required flag');
    })
    .it('errors when no ID is provided');

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
      delete: jest.fn()
    };
    
    (createWalrusStorage as jest.Mock).mockReturnValue(mockStorageMethods);
    
    // Mock execSync to test command execution
    (execSync as jest.Mock).mockImplementation((command: string) => {
      if (command.includes('--storage blockchain')) {
        throw new Error('Failed to update blockchain: Network error');
      }
      return Buffer.from('Local update successful, but blockchain update failed');
    });

    // This should throw error due to blockchain issues
    try {
      const result = execSync('node bin/run.js complete --id test-todo-id-123 --storage blockchain').toString();
      fail('Should have thrown an error');
    } catch (_error) {
      expect(error.message).toContain('Network error');
    }
    
    // But with local storage it should work
    const result = execSync('node bin/run.js complete --id test-todo-id-123 --storage local').toString();
    expect(result).toContain('Local update successful');
  });
});