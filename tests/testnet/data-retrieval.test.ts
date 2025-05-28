/**
 * @fileoverview Tests for Walrus testnet data retrieval operations
 *
 * This test suite verifies the data fetch operations from Walrus testnet storage,
 * including retrieving todos and todo lists using blob IDs.
 */

import {
  WalrusStorage,
  createRealWalrusStorage,
} from '../../apps/cli/src/utils/walrus-storage';
import { Todo, TodoList } from '../../apps/cli/src/types/todo';
import { CLIError } from '../../apps/cli/src/types/errors/consolidated';

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'fs';
// import path from 'path';
import os from 'os';

// Mock the child_process module for testing CLI interactions
jest.mock('child_process');
jest.mock('fs');
jest.mock('os');

const execAsync = promisify(exec) as jest.MockedFunction<typeof execAsync>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('Walrus Testnet Data Retrieval', () => {
  let walrusStorage: WalrusStorage;
  const mockTempDir = '/tmp/walrus-storage';
  const mockWalrusPath = '/home/.local/bin/walrus';

  // Sample blob IDs for testing
  const sampleTodoBlobId = 'KJfca4n-HWfDIY76KfunSTL2QY36WC0eq4CJmPgBYpQ';
  const sampleListBlobId = 'XYfca4n-HWfDIY76KfunSTL2QY36WC0eq4CJmPgBYpQ';

  // Sample data that would be retrieved from Walrus
  const sampleTodo: Todo = {
    id: 'todo-123',
    title: 'Test Todo from Walrus',
    description: 'This todo was retrieved from Walrus testnet',
    completed: false,
    priority: 'high',
    tags: ['test', 'walrus'],
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    private: false,
    storageLocation: 'blockchain',
    walrusBlobId: sampleTodoBlobId,
  };

  const sampleTodoList: TodoList = {
    id: 'list-456',
    name: 'Test List from Walrus',
    owner: '0x123...abc',
    todos: [sampleTodo],
    version: 1,
    createdAt: '2024-01-15T09:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    walrusBlobId: sampleListBlobId,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock OS methods
    mockOs.tmpdir.mockReturnValue('/tmp');
    mockOs.homedir.mockReturnValue('/home');

    // Mock file system operations
    mockFs.existsSync.mockImplementation(path => {
      if (path === mockTempDir) return true;
      if (path.startsWith(mockTempDir)) return false; // Temp files don't exist initially
      return false;
    });

    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.readFileSync.mockImplementation(() => '');
    mockFs.unlinkSync.mockImplementation(() => undefined);

    // Create storage instance (without mock mode)
    walrusStorage = createRealWalrusStorage('testnet');
  });

  describe('Initialization and Connection', () => {
    test('should check for Walrus CLI availability', async () => {
      execAsync.mockResolvedValueOnce({
        stdout: 'walrus version 0.1.0',
        stderr: '',
      });

      await walrusStorage.init();

      expect(execAsync).toHaveBeenCalledWith(`${mockWalrusPath} --version`);
    });

    test('should throw error if Walrus CLI is not found', async () => {
      execAsync.mockRejectedValueOnce(new Error('Command not found'));

      await expect(walrusStorage.init()).rejects.toThrow(CLIError);
      await expect(walrusStorage.init()).rejects.toMatchObject({
        code: 'WALRUS_CLI_NOT_FOUND',
      });
    });

    test('should maintain connection state', async () => {
      execAsync.mockResolvedValueOnce({
        stdout: 'walrus version 0.1.0',
        stderr: '',
      });

      await walrusStorage.connect();
      const isConnected = await walrusStorage.checkConnection();

      expect(isConnected).toBe(true);
    });
  });

  describe('Todo Retrieval', () => {
    beforeEach(async () => {
      // Mock successful CLI connection
      execAsync.mockResolvedValueOnce({
        stdout: 'walrus version 0.1.0',
        stderr: '',
      });
      await walrusStorage.init();
    });

    test('should retrieve a todo by blob ID', async () => {
      // Mock the walrus get command
      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      // Mock reading the retrieved file
      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(sampleTodo));

      const retrievedTodo = await walrusStorage.retrieveTodo(sampleTodoBlobId);

      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining(
          `walrus --context testnet get ${sampleTodoBlobId} --output`
        )
      );
      expect(retrievedTodo).toEqual(sampleTodo);
    });

    test('should handle retrieval errors gracefully', async () => {
      execAsync.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        walrusStorage.retrieveTodo(sampleTodoBlobId)
      ).rejects.toThrow('Network error');
    });

    test('should clean up temporary files after retrieval', async () => {
      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(sampleTodo));

      let tempFilePath: string = '';
      mockFs.existsSync.mockImplementation(path => {
        if (typeof path === 'string' && path.includes('retrieved-')) {
          tempFilePath = path;
          return true;
        }
        return false;
      });

      await walrusStorage.retrieveTodo(sampleTodoBlobId);

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('retrieved-')
      );
    });

    test('should handle invalid JSON data', async () => {
      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      mockFs.readFileSync.mockReturnValueOnce('invalid json');

      await expect(
        walrusStorage.retrieveTodo(sampleTodoBlobId)
      ).rejects.toThrow(SyntaxError);
    });
  });

  describe('TodoList Retrieval', () => {
    beforeEach(async () => {
      execAsync.mockResolvedValueOnce({
        stdout: 'walrus version 0.1.0',
        stderr: '',
      });
      await walrusStorage.init();
    });

    test('should retrieve a todo list by blob ID', async () => {
      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(sampleTodoList));

      const retrievedList = await walrusStorage.retrieveList(sampleListBlobId);

      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining(
          `walrus --context testnet get ${sampleListBlobId} --output`
        )
      );
      expect(retrievedList).toEqual(sampleTodoList);
    });

    test('should handle missing blob IDs', async () => {
      execAsync.mockRejectedValueOnce(new Error('Blob not found'));

      await expect(
        walrusStorage.retrieveList('non-existent-blob-id')
      ).rejects.toThrow('Blob not found');
    });

    test('should retrieve lists with multiple todos', async () => {
      const listWithMultipleTodos: TodoList = {
        ...sampleTodoList,
        todos: [
          sampleTodo,
          { ...sampleTodo, id: 'todo-456', title: 'Second Todo' },
          { ...sampleTodo, id: 'todo-789', title: 'Third Todo' },
        ],
      };

      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      mockFs.readFileSync.mockReturnValueOnce(
        JSON.stringify(listWithMultipleTodos)
      );

      const retrievedList = await walrusStorage.retrieveList(sampleListBlobId);

      expect(retrievedList.todos).toHaveLength(3);
      expect(retrievedList.todos[1].title).toBe('Second Todo');
    });
  });

  describe('Blob Deletion', () => {
    beforeEach(async () => {
      execAsync.mockResolvedValueOnce({
        stdout: 'walrus version 0.1.0',
        stderr: '',
      });
      await walrusStorage.init();
    });

    test('should delete a blob by ID', async () => {
      execAsync.mockResolvedValueOnce({
        stdout: 'Blob deleted successfully',
        stderr: '',
      });

      await walrusStorage.deleteBlob(sampleTodoBlobId);

      expect(execAsync).toHaveBeenCalledWith(
        `${mockWalrusPath} --context testnet delete ${sampleTodoBlobId}`
      );
    });

    test('should handle deletion of non-existent blobs', async () => {
      execAsync.mockRejectedValueOnce(new Error('Blob not found'));

      await expect(
        walrusStorage.deleteBlob('non-existent-blob')
      ).rejects.toThrow('Blob not found');
    });
  });

  describe('Network-Specific Operations', () => {
    test('should use correct network context', async () => {
      const mainnetStorage = createRealWalrusStorage('mainnet');
      execAsync.mockResolvedValueOnce({
        stdout: 'walrus version 0.1.0',
        stderr: '',
      });
      await mainnetStorage.init();

      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(sampleTodo));

      await mainnetStorage.retrieveTodo(sampleTodoBlobId);

      expect(execAsync).toHaveBeenCalledWith(
        expect.stringContaining('walrus --context mainnet get')
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      execAsync.mockResolvedValueOnce({
        stdout: 'walrus version 0.1.0',
        stderr: '',
      });
      await walrusStorage.init();
    });

    test('should handle network timeouts', async () => {
      execAsync.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
      );

      await expect(
        walrusStorage.retrieveTodo(sampleTodoBlobId)
      ).rejects.toThrow('Timeout');
    });

    test('should handle partial data corruption', async () => {
      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      // Mock corrupted JSON with missing closing brace
      mockFs.readFileSync.mockReturnValueOnce(
        '{"id":"test","title":"Corrupted"'
      );

      await expect(
        walrusStorage.retrieveTodo(sampleTodoBlobId)
      ).rejects.toThrow(SyntaxError);
    });

    test('should handle large data retrieval', async () => {
      const largeTodoList: TodoList = {
        ...sampleTodoList,
        todos: Array(1000)
          .fill(null)
          .map((_, index) => ({
            ...sampleTodo,
            id: `todo-${index}`,
            title: `Todo ${index}`,
          })),
      };

      execAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });
      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(largeTodoList));

      const retrievedList = await walrusStorage.retrieveList(sampleListBlobId);

      expect(retrievedList.todos).toHaveLength(1000);
      expect(retrievedList.todos[999].title).toBe('Todo 999');
    });
  });
});
