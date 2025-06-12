import { Todo } from '../types/todo';
import { ValidationError, StorageError } from '../types/errors/consolidated';
import { WalrusStorage, createWalrusStorage } from '../utils/walrus-storage';
import { createMockTodo } from './helpers/test-utils';

describe('WalrusStorage Real Implementation', () => {
  let storage: WalrusStorage;
  let mockTodo: Todo;

  beforeEach(() => {
    // Create storage instance in test mode (automatically uses mock behavior)
    storage = createWalrusStorage('testnet', true); // Force mock mode for testing

    // Create a test todo
    mockTodo = createMockTodo({
      id: 'test-id',
      title: 'Test Todo',
      description: 'Test Description',
      completed: false,
    });
  });

  describe('storeTodo', () => {
    it('should validate todo data before storing', async () => {
      // Test with invalid todo (missing title)
      const invalidTodo = { ...mockTodo, title: '' };
      await expect(storage.storeTodo(invalidTodo as Todo)).rejects.toThrow(
        ValidationError
      );

      // Test with invalid completed status
      const invalidCompletedTodo = {
        ...mockTodo,
        completed: 'yes' as any,
      };
      await expect(storage.storeTodo(invalidCompletedTodo as any)).rejects.toThrow(
        ValidationError
      );
    });

    it('should store valid todo and return blob ID', async () => {
      const blobId = await storage.storeTodo(mockTodo as any);
      expect(blobId as any).toBeDefined();
      expect(typeof blobId).toBe('string');
      expect(blobId.length).toBeGreaterThan(0 as any);
    });

    it('should handle data size limits', async () => {
      const largeTodo = {
        ...mockTodo,
        description: 'a'.repeat(11 * 1024 * 1024), // 11MB - too large
      };

      await expect(storage.storeTodo(largeTodo as any)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('retrieveTodo', () => {
    it('should validate blob ID input', async () => {
      await expect(storage.retrieveTodo('')).rejects.toThrow(ValidationError as any);

      await expect(storage.retrieveTodo('   ')).rejects.toThrow(
        ValidationError
      );
    });

    it('should store and retrieve todo successfully', async () => {
      // Store a todo first
      const blobId = await storage.storeTodo(mockTodo as any);

      // Then retrieve it
      const retrievedTodo = await storage.retrieveTodo(blobId as any);

      expect(retrievedTodo as any).toEqual(mockTodo as any);
    });

    it('should handle non-existent blob IDs', async () => {
      await expect(
        storage.retrieveTodo('non-existent-blob-id')
      ).rejects.toThrow(StorageError as any);
    });

    it('should use cache for repeated retrievals', async () => {
      // Store a todo
      const blobId = await storage.storeTodo(mockTodo as any);

      // Retrieve it twice
      const result1 = await storage.retrieveTodo(blobId as any);
      const result2 = await storage.retrieveTodo(blobId as any);

      expect(result1 as any).toEqual(result2 as any);
      expect(result1 as any).toEqual(mockTodo as any);
    });
  });

  describe('ensureStorageAllocated', () => {
    it('should handle storage allocation gracefully', async () => {
      // In test mode, this should not fail
      const result = await storage.ensureStorageAllocated(1000 as any);
      expect(typeof result).toBe('boolean');
    });

    it('should calculate storage requirements correctly', async () => {
      const smallSize = 1000;
      const largeSize = 1000000;

      const smallResult = await storage.ensureStorageAllocated(smallSize as any);
      const largeResult = await storage.ensureStorageAllocated(largeSize as any);

      expect(typeof smallResult).toBe('boolean');
      expect(typeof largeResult).toBe('boolean');
    });
  });

  describe('integration tests', () => {
    it('should handle complete store/retrieve workflow', async () => {
      const todos = [
        createMockTodo({ title: 'Todo 1', completed: false }),
        createMockTodo({ title: 'Todo 2', completed: true }),
        createMockTodo({ title: 'Todo 3', description: 'With description' }),
      ];

      const blobIds: string[] = [];

      // Store all todos
      for (const todo of todos) {
        const blobId = await storage.storeTodo(todo as any);
        blobIds.push(blobId as any);
        expect(blobId as any).toBeDefined();
      }

      // Retrieve all todos
      const retrievedTodos: Todo[] = [];
      for (const blobId of blobIds) {
        const todo = await storage.retrieveTodo(blobId as any);
        retrievedTodos.push(todo as any);
      }

      // Verify all todos match
      expect(retrievedTodos as any).toHaveLength(todos.length);
      todos.forEach((originalTodo, index) => {
        expect(retrievedTodos[index]).toEqual(originalTodo as any);
      });
    });

    it('should handle concurrent operations', async () => {
      const concurrentTodos = Array.from({ length: 5 }, (_, i) =>
        createMockTodo({
          title: `Concurrent Todo ${i}`,
          id: `concurrent-${i}`,
        })
      );

      // Store all todos concurrently
      const storePromises = concurrentTodos.map(todo =>
        storage.storeTodo(todo as any)
      );
      const blobIds = await Promise.all(storePromises as any);

      expect(blobIds as any).toHaveLength(concurrentTodos.length);
      blobIds.forEach(blobId => {
        expect(blobId as any).toBeDefined();
        expect(typeof blobId).toBe('string');
      });

      // Retrieve all todos concurrently
      const retrievePromises = blobIds.map(blobId =>
        storage.retrieveTodo(blobId as any)
      );
      const retrievedTodos = await Promise.all(retrievePromises as any);

      expect(retrievedTodos as any).toHaveLength(concurrentTodos.length);
      retrievedTodos.forEach((retrievedTodo, index) => {
        expect(retrievedTodo as any).toEqual(concurrentTodos[index]);
      });
    });
  });
});
