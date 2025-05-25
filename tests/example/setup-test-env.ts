/**
import { Logger } from '../../src/utils/Logger';

const logger = new Logger('setup-test-env');
 * Test environment setup utilities for WalTodo CLI testing
 * 
 * This file provides utility functions for setting up a clean test environment
 * for testing the WalTodo CLI commands. It handles mocking dependencies,
 * creating test fixtures, and providing helper functions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock dependencies
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Define test fixtures directory
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const TEST_TODO_LIST = 'test-todo-list';

/**
 * Creates a test todo item with optional overrides
 *
 * @param overrides - Optional properties to override in the default todo
 * @returns A todo object for testing
 */
export function createTestTodo(overrides = {}) {
  return {
    id: `test-todo-${Date.now()}`,
    title: 'Test Todo',
    description: 'A todo item for testing',
    completed: false,
    priority: 'medium',
    tags: ['test', 'example'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: false,
    storageLocation: 'local',
    ...overrides,
  };
}

/**
 * Creates a test todo list with optional todos
 *
 * @param listName - Name of the todo list to create
 * @param todos - Optional array of todos to include in the list
 * @returns A todo list object for testing
 */
export function createTestTodoList(listName = TEST_TODO_LIST, todos = []) {
  // If no todos provided, create a default set
  if (todos.length === 0) {
    todos = [
      createTestTodo({ title: 'First test todo' }),
      createTestTodo({ title: 'Second test todo', priority: 'high' }),
      createTestTodo({
        title: 'Completed todo',
        completed: true,
        completedAt: new Date().toISOString(),
      }),
    ];
  }

  return {
    id: `${listName}-${Date.now()}`,
    name: listName,
    owner: 'test-owner',
    todos,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sets up the test environment before tests
 *
 * @param options - Optional configuration options
 */
export function setupTestEnvironment(options = {}) {
  // Ensure fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  // Mock environment variables
  process.env.XAI_API_KEY = 'test-api-key';
  process.env.TEST_MODE = 'true';

  // Reset all mocks
  jest.clearAllMocks();

  // Mock readFileSync for todo lists
  (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
    if (filePath.includes(`${TEST_TODO_LIST}.json`)) {
      return JSON.stringify(createTestTodoList());
    }

    // Default fallback for other files
    return '{}';
  });

  // Mock execSync for CLI commands
  (execSync as jest.Mock).mockImplementation((command: string) => {
    if (command.includes('waltodo list')) {
      return Buffer.from(JSON.stringify(createTestTodoList().todos));
    }
    if (command.includes('waltodo add')) {
      return Buffer.from('Todo added successfully');
    }
    if (command.includes('waltodo complete')) {
      return Buffer.from('Todo completed successfully');
    }

    return Buffer.from('Command executed successfully');
  });
}

/**
 * Cleans up the test environment after tests
 */
export function cleanupTestEnvironment() {
  // Restore environment variables
  delete process.env.XAI_API_KEY;
  delete process.env.TEST_MODE;

  // Restore all mocks
  jest.restoreAllMocks();
}

/**
 * Helper to run a CLI command for testing
 *
 * @param command - The command to run (without the waltodo prefix)
 * @returns The command output
 */
export function runCliCommand(command: string): string {
  try {
    const fullCommand = `node bin/run.js ${command}`;
    const output = execSync(fullCommand).toString();
    return output;
  } catch (_error) {
    logger.error('Error running CLI command:', error);
    throw error;
  }
}
