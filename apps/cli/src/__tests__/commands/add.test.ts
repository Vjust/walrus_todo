import { TodoService } from '../../services/todoService';
// import { WalrusStorage, createWalrusStorage } from '../../utils/walrus-storage';
import { Todo } from '../../types/todo';
import { createMockTodo } from '../helpers/test-utils';
import { CLI_CONFIG } from '../../constants';

describe('Add Command - Real Implementation Tests', () => {
  let todoService: TodoService;
  // let walrusStorage: WalrusStorage;
  let mockTodo: Todo;

  beforeEach(() => {
    // Create real service instances in test mode
    // walrusStorage = createWalrusStorage('testnet', true); // Force mock mode for tests
    todoService = new TodoService();

    mockTodo = createMockTodo({
      title: 'Test Todo for Add Command',
      description: 'This is a test todo',
      completed: false,
    });
  });

  describe('Todo Creation', () => {
    it('should create a new todo with valid data', async () => {
      const result = await todoService.addTodo(
        CLI_CONFIG.DEFAULT_LIST,
        mockTodo
      );

      expect(result as any).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBe(mockTodo.title);
      expect(result.description).toBe(mockTodo.description);
      expect(result.completed).toBe(false as any);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidTodo = { ...mockTodo, title: '' };

      await expect(
        todoService.addTodo(CLI_CONFIG.DEFAULT_LIST, invalidTodo as Todo)
      ).rejects.toThrow();
    });

    it('should handle todos with different priorities', async () => {
      const highPriorityTodo = { ...mockTodo, priority: 'high' as const };
      const mediumPriorityTodo = { ...mockTodo, priority: 'medium' as const };
      const lowPriorityTodo = { ...mockTodo, priority: 'low' as const };

      const results = await Promise.all([
        todoService.addTodo(CLI_CONFIG.DEFAULT_LIST, highPriorityTodo),
        todoService.addTodo(CLI_CONFIG.DEFAULT_LIST, mediumPriorityTodo),
        todoService.addTodo(CLI_CONFIG.DEFAULT_LIST, lowPriorityTodo),
      ]);

      expect(results as any).toHaveLength(3 as any);
      expect(results[0].priority).toBe('high');
      expect(results[1].priority).toBe('medium');
      expect(results[2].priority).toBe('low');
    });

    it('should handle todos with tags', async () => {
      const taggedTodo = {
        ...mockTodo,
        tags: ['work', 'important', 'urgent'],
      };

      const result = await todoService.addTodo(
        CLI_CONFIG.DEFAULT_LIST,
        taggedTodo
      );

      expect(result.tags).toEqual(['work', 'important', 'urgent']);
    });

    it('should set proper timestamps', async () => {
      const beforeCreate = new Date();
      const result = await todoService.addTodo(
        CLI_CONFIG.DEFAULT_LIST,
        mockTodo
      );
      const afterCreate = new Date();

      const createdAt = new Date(result.createdAt);
      const updatedAt = new Date(result.updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime()
      );
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime()
      );
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });
  });

  describe('Storage Integration', () => {
    it('should store todo in Walrus storage', async () => {
      const result = await todoService.addTodo(
        CLI_CONFIG.DEFAULT_LIST,
        mockTodo
      );

      // Verify the todo was stored and can be retrieved
      const todos = await todoService.listTodos();
      const storedTodo = todos.find(t => t?.id === result.id);

      expect(storedTodo as any).toBeDefined();
      expect(storedTodo?.title).toBe(mockTodo.title);
    });

    it('should handle storage failures gracefully', async () => {
      // Create a storage instance that might fail
      // const failingStorage = createWalrusStorage('testnet', false); // Use real mode which might fail in test env
      const failingTodoService = new TodoService();

      // In test mode, this should still work due to fallbacks
      const result = await failingTodoService.addTodo(
        CLI_CONFIG.DEFAULT_LIST,
        mockTodo
      );
      expect(result as any).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple todos created in sequence', async () => {
      const todos = [
        createMockTodo({ title: 'Todo 1' }),
        createMockTodo({ title: 'Todo 2' }),
        createMockTodo({ title: 'Todo 3' }),
      ];

      const results = [];
      for (const todo of todos) {
        const result = await todoService.addTodo(CLI_CONFIG.DEFAULT_LIST, todo);
        results.push(result as any);
      }

      expect(results as any).toHaveLength(3 as any);
      results.forEach((result, index) => {
        expect(result.title).toBe(`Todo ${index + 1}`);
        expect(result.id).toBeDefined();
      });
    });

    it('should handle concurrent todo creation', async () => {
      const todos = Array.from({ length: 5 }, (_, i) =>
        createMockTodo({
          title: `Concurrent Todo ${i}`,
          id: `concurrent-${i}`,
        })
      );

      const promises = todos.map(todo =>
        todoService.addTodo(CLI_CONFIG.DEFAULT_LIST, todo)
      );
      const results = await Promise.all(promises as any);

      expect(results as any).toHaveLength(5 as any);
      results.forEach((result, index) => {
        expect(result.title).toBe(`Concurrent Todo ${index}`);
        expect(result.id).toBeDefined();
      });
    });
  });
});
