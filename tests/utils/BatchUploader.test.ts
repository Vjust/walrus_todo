import { BatchUploader } from '../../apps/cli/src/utils/batch-uploader';
import { TodoSizeCalculator } from '../../apps/cli/src/utils/todo-size-calculator';
import { WalrusStorage } from '../../apps/cli/src/utils/walrus-storage';
import type { WalrusStorage as WalrusStorageType } from '../../apps/cli/src/utils/walrus-storage';
import { Todo, TodoList } from '../../apps/cli/src/types/todo';

// Mock the WalrusStorage class
jest.mock('../../apps/cli/src/utils/walrus-storage');

describe('BatchUploader', () => {
  // Sample test data
  const sampleTodos: Todo[] = [
    {
      id: '1',
      title: 'First Todo',
      description: 'This is the first test todo',
      completed: false,
      priority: 'high' as const,
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
      priority: 'medium' as const,
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
      priority: 'low' as const,
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
  let mockWalrusStorage: jest.Mocked<WalrusStorageType>;
  let batchUploader: BatchUploader;

  beforeEach(() => {
    // Setup mock implementations
    mockWalrusStorage = new WalrusStorage(
      'testnet',
      true
    ) as jest.Mocked<WalrusStorageType>;

    // Mock the storage methods
    mockWalrusStorage.ensureStorageAllocated = jest.fn().mockResolvedValue(true);

    mockWalrusStorage.storeTodo = jest.fn().mockImplementation(todo => {
      return Promise.resolve(`mock-blob-${todo.id}`);
    });

    mockWalrusStorage.storeTodoList = jest
      .fn()
      .mockResolvedValue('mock-list-blob-id');

    // Create BatchUploader with the mock
    batchUploader = new BatchUploader(mockWalrusStorage as WalrusStorageType);

    // Spy on TodoSizeCalculator methods
    jest.spyOn(TodoSizeCalculator, 'calculateOptimalStorageSize');
    jest.spyOn(TodoSizeCalculator, 'calculateTodoSize');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('uploadTodos', () => {
    it('should throw error for empty batch', async () => {
      const { CLIError } = await import(
        '../../apps/cli/src/types/errors/consolidated'
      );
      await expect(batchUploader.uploadTodos([])).rejects.toThrow(CLIError);
    });

    it('should allocate storage with optimal size calculation', async () => {
      await batchUploader.uploadTodos(sampleTodos);

      // Verify optimal size was calculated
      expect(
        TodoSizeCalculator.calculateOptimalStorageSize
      ).toHaveBeenCalledWith(
        sampleTodos,
        expect.objectContaining({
          extraAllocation: expect.any(Number) as number,
        })
      );

      // Verify storage was allocated with the calculated size
      expect(mockWalrusStorage.ensureStorageAllocated).toHaveBeenCalledWith(
        expect.any(Number) as number
      );
    });

    it('should calculate size for each todo', async () => {
      await batchUploader.uploadTodos(sampleTodos);

      // Verify each todo had its size calculated
      expect(TodoSizeCalculator.calculateTodoSize).toHaveBeenCalledTimes(
        sampleTodos.length
      );
    });

    it('should upload each todo in the batch', async () => {
      await batchUploader.uploadTodos(sampleTodos);

      // Verify each todo was uploaded
      expect(mockWalrusStorage.storeTodo).toHaveBeenCalledTimes(
        sampleTodos.length
      );

      // Check each todo was passed to storage
      sampleTodos.forEach(todo => {
        expect(mockWalrusStorage.storeTodo).toHaveBeenCalledWith(todo);
      });
    });

    it('should track successful and failed uploads', async () => {
      // Make the second todo fail
      mockWalrusStorage.storeTodo.mockImplementation(todo => {
        if (todo.id === '2') {
          return Promise.reject(new Error('Mock upload failure'));
        }
        return Promise.resolve(`mock-blob-${todo.id}`);
      });

      const result = await batchUploader.uploadTodos(sampleTodos);

      // Two should succeed and one fail
      expect(result.successful.length).toBe(2);
      expect(result.failed.length).toBe(1);

      // Check the failed one is the correct ID
      expect(result.failed[0].id).toBe('2');
      expect(result.failed[0].error).toContain('Mock upload failure');

      // Check successful ones have blob IDs
      expect(result.successful).toContainEqual({
        id: '1',
        blobId: 'mock-blob-1',
      });
      expect(result.successful).toContainEqual({
        id: '3',
        blobId: 'mock-blob-3',
      });
    });

    it('should call progress callback if provided', async () => {
      const progressCallback = jest.fn();

      await batchUploader.uploadTodos(sampleTodos, { progressCallback });

      // Callback should be called once per todo
      expect(progressCallback).toHaveBeenCalledTimes(sampleTodos.length);

      // First call should be (1, 3, '1')
      expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 3, '1');
      // Second call should be (2, 3, '2')
      expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 3, '2');
      // Third call should be (3, 3, '3')
      expect(progressCallback).toHaveBeenNthCalledWith(3, 3, 3, '3');
    });
  });

  describe('uploadTodoList', () => {
    it('should upload all todos in the list and then the list itself', async () => {
      await batchUploader.uploadTodoList(sampleTodoList);

      // Verify each todo was uploaded
      expect(mockWalrusStorage.storeTodo).toHaveBeenCalledTimes(
        sampleTodos.length
      );

      // Verify the list was uploaded
      expect(mockWalrusStorage.storeTodoList).toHaveBeenCalledTimes(1);

      // Verify the list being uploaded has the updated blob IDs
      const uploadedList = mockWalrusStorage.storeTodoList.mock.calls[0]?.[0];
      expect(uploadedList).toBeDefined();
      expect(uploadedList?.todos[0]!.walrusBlobId).toBe('mock-blob-1');
      expect(uploadedList?.todos[1]!.walrusBlobId).toBe('mock-blob-2');
      expect(uploadedList?.todos[2]!.walrusBlobId).toBe('mock-blob-3');
    });

    it('should update the list with successful blob IDs even if some todos fail', async () => {
      // Make the second todo fail
      mockWalrusStorage.storeTodo.mockImplementation(todo => {
        if (todo.id === '2') {
          return Promise.reject(new Error('Mock upload failure'));
        }
        return Promise.resolve(`mock-blob-${todo.id}`);
      });

      const result = await batchUploader.uploadTodoList(sampleTodoList);

      // Verify the success and failure counts
      expect(result.todoResults.successful.length).toBe(2);
      expect(result.todoResults.failed.length).toBe(1);

      // Verify the list being uploaded has the updated blob IDs for successful uploads only
      const uploadedList = mockWalrusStorage.storeTodoList.mock.calls[0]?.[0];
      expect(uploadedList).toBeDefined();
      expect(uploadedList?.todos[0]!.walrusBlobId).toBe('mock-blob-1');
      expect(uploadedList?.todos[1]!.walrusBlobId).toBeUndefined(); // Failed
      expect(uploadedList?.todos[2]!.walrusBlobId).toBe('mock-blob-3');
    });
  });
});
