import { BatchUploader } from '../../utils/batch-uploader';
import { WalrusStorage } from '../../utils/walrus-storage';
import { Todo, TodoList } from '../../types/todo';
import { jest } from '@jest/globals';

// Mock the WalrusStorage class
jest.mock('../../utils/walrus-storage');

describe('BatchUploader', () => {
  // Sample test data
  const sampleTodos: Todo[] = [
    {
      id: '1',
      title: 'First Todo',
      description: 'This is the first test todo',
      completed: false,
      priority: 'high',
      tags: ['test', 'important'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: false,
    },
    {
      id: '2',
      title: 'Second Todo',
      description: 'This is the second test todo',
      completed: true,
      priority: 'medium',
      tags: ['test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: false,
    },
    {
      id: '3',
      title: 'Third Todo',
      description:
        'This is the third test todo with a longer description to test variable sizes',
      completed: false,
      priority: 'low',
      tags: ['test', 'optional', 'later'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: true,
    },
  ];

  const sampleTodoList: TodoList = {
    id: 'list-1',
    name: 'Test List',
    owner: 'test-user',
    todos: sampleTodos,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Mock implementation of WalrusStorage
  let mockWalrusStorage: jest.Mocked<WalrusStorage>;
  let batchUploader: BatchUploader;

  beforeEach(() => {
    // Setup mock implementations
    mockWalrusStorage = {
      ensureStorageAllocated: jest.fn().mockResolvedValue({
        id: { id: 'mock-storage-id' },
        storage_size: '1000000',
        used_size: '0',
        start_epoch: '100',
        end_epoch: '200',
      }),
      
      storeTodo: jest.fn().mockImplementation((todo: Todo) => 
        Promise.resolve(`blob-${todo.id}`)
      ),
      
      storeTodoList: jest.fn().mockResolvedValue('list-blob-123'),
      
      // Add other required methods as no-ops for testing
      init: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn().mockResolvedValue(undefined),
      getConnectionStatus: jest.fn().mockReturnValue(true),
      retrieveTodo: jest.fn(),
      retrieveList: jest.fn(),
      deleteBlob: jest.fn(),
      checkExistingStorage: jest.fn(),
      store: jest.fn(),
      storeList: jest.fn(),
      get: jest.fn(),
      getList: jest.fn(),
      getAllocation: jest.fn(),
    } as unknown as jest.Mocked<WalrusStorage>;

    batchUploader = new BatchUploader(mockWalrusStorage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadTodos', () => {
    it('should upload a batch of todos successfully', async () => {
      const results = await batchUploader.uploadTodos(sampleTodos);

      expect(mockWalrusStorage.storeTodo).toHaveBeenCalledTimes(3);
      expect(results.successful).toHaveLength(3);
      expect(results.failed).toHaveLength(0);

      // Check each result
      results.successful.forEach((result, index) => {
        expect(result.id).toBe(sampleTodos[index]?.id);
        expect(result.blobId).toBe(`blob-${sampleTodos[index]?.id}`);
      });
    });

    it('should handle partial failures in batch upload', async () => {
      // Make the second todo fail
      mockWalrusStorage.storeTodo = jest
        .fn()
        .mockImplementation((todo: Todo) => {
          if (todo.id === '2') {
            return Promise.reject(new Error('Upload failed'));
          }
          return Promise.resolve(`blob-${todo.id}`);
        });

      const results = await batchUploader.uploadTodos(sampleTodos);

      expect(results.successful).toHaveLength(2);
      expect(results.failed).toHaveLength(1);
      expect(results.failed[0]?.id).toBe('2');
      expect(results.failed[0]?.error).toBe('Upload failed');
    });

    it('should handle empty batch', async () => {
      await expect(batchUploader.uploadTodos([])).rejects.toThrow(
        'No todos provided for batch upload'
      );
      expect(mockWalrusStorage.storeTodo).not.toHaveBeenCalled();
    });

    it('should handle progress callback', async () => {
      const progressCallback = jest.fn();
      await batchUploader.uploadTodos(sampleTodos, { progressCallback });

      expect(progressCallback).toHaveBeenCalledTimes(sampleTodos.length);
      sampleTodos.forEach((todo, index) => {
        expect(progressCallback).toHaveBeenCalledWith(
          index + 1,
          sampleTodos.length,
          todo.id
        );
      });
    });
  });

  // Remove uploadBatchWithRetries tests as the method doesn't exist

  describe('uploadTodoList', () => {
    it('should upload a complete todo list', async () => {
      const result = await batchUploader.uploadTodoList(sampleTodoList);

      expect(mockWalrusStorage.storeTodo).toHaveBeenCalledTimes(
        sampleTodoList.todos.length
      );
      expect(mockWalrusStorage.storeTodoList).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sampleTodoList.id,
          name: sampleTodoList.name,
        })
      );
      expect(result.listBlobId).toBe('list-blob-123');
      expect(result.todoResults.successful).toHaveLength(
        sampleTodoList.todos.length
      );
    });

    it('should handle list upload failure', async () => {
      mockWalrusStorage.storeTodoList = jest
        .fn()
        .mockRejectedValue(new Error('List upload failed'));

      await expect(
        batchUploader.uploadTodoList(sampleTodoList)
      ).rejects.toThrow('List upload failed');
    });
  });

  // These methods are not exposed by BatchUploader class
  // They are internal implementations used within uploadTodos
});
