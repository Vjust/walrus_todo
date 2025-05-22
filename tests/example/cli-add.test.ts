/**
 * Tests for the 'add' command in WalTodo CLI
 * 
 * This test file demonstrates how to test the 'add' command using Jest
 * and the test environment setup utilities.
 */

import { test } from '@oclif/test';
import * as fs from 'fs';
import * as path from 'path';
import { setupTestEnvironment, cleanupTestEnvironment, createTestTodo } from './setup-test-env';

// Mock the TodoService to avoid actual file system operations

jest.mock('../../src/services/todoService');

describe('WalTodo add command', () => {
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
    (TodoService.prototype.getList as jest.Mock).mockResolvedValue({
      id: 'default',
      name: 'default',
      owner: 'default-owner',
      todos: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    (TodoService.prototype.addTodo as jest.Mock).mockImplementation(async (listName, todo) => ({
      ...todo,
      id: `test-id-${Date.now()}`,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: false,
      priority: todo.priority || 'medium',
      tags: todo.tags || []
    }));
  });

  // Test using @oclif/test library which provides tools specifically for testing CLI commands
  test
    .stdout()
    .command(['add', 'Test todo from command'])
    .it('adds a todo with title from argument', ctx => {
      expect(ctx.stdout).toContain('New');
      expect(TodoService.prototype.addTodo).toHaveBeenCalled();
    });

  test
    .stdout()
    .command(['add', 'High priority task', '-p', 'high'])
    .it('adds a todo with high priority', ctx => {
      expect(ctx.stdout).toContain('New');
      expect(ctx.stdout).toContain('HOT');
      expect(TodoService.prototype.addTodo).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({
          title: 'High priority task',
          priority: 'high'
        })
      );
    });

  test
    .stdout()
    .command(['add', 'Todo with tags', '-g', 'work,important'])
    .it('adds a todo with tags', ctx => {
      expect(ctx.stdout).toContain('New');
      expect(TodoService.prototype.addTodo).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({
          title: 'Todo with tags',
          tags: ['work', 'important']
        })
      );
    });

  test
    .stdout()
    .command(['add', 'Todo for specific list', '-l', 'work'])
    .it('adds a todo to a specific list', ctx => {
      expect(ctx.stdout).toContain('New');
      expect(TodoService.prototype.addTodo).toHaveBeenCalledWith(
        'work',
        expect.objectContaining({
          title: 'Todo for specific list'
        })
      );
    });

  // Test error handling
  test
    .stdout()
    .command(['add'])
    .catch(_error => {
      expect(error.message).toContain('Missing required argument');
    })
    .it('errors when no title is provided');

  // Alternative approach using direct method calls
  it('should add a todo through direct service call', async () => {
    const todoService = new TodoService();
    const todo = createTestTodo({ title: 'Direct service todo' });
    
    await todoService.addTodo('default', todo);
    
    expect(TodoService.prototype.addTodo).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({
        title: 'Direct service todo'
      })
    );
  });
});