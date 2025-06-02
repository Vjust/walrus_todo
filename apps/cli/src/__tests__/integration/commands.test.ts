import { TodoService } from '../../services/todoService';
import { createWalrusStorage } from '../../utils/walrus-storage';
import { createMockTodo } from '../helpers/test-utils';
import { Todo } from '../../types/todo';

describe('CLI Commands Integration Tests', () => {
  let todoService: TodoService;

  beforeAll(async () => {
    // Setup real service instances in test mode
    createWalrusStorage('testnet', true); // Force mock mode for tests
    todoService = new TodoService();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Todo Management Workflow', () => {
    it('should handle complete add-list-complete workflow', async () => {
      // Step 1: Add a new todo
      const newTodo = createMockTodo({
        title: 'Integration Test Todo',
        description: 'Testing complete workflow',
        completed: false,
        priority: 'high',
      });

      const addedTodo = await todoService.addTodo('default', newTodo);
      expect(addedTodo.id).toBeDefined();
      expect(addedTodo.title).toBe(newTodo.title);
      expect(addedTodo.completed).toBe(false);

      // Step 2: List todos and verify the new todo is there
      const todos = await todoService.listTodos();
      const foundTodo = todos.find(t => t.id === addedTodo.id);
      expect(foundTodo).toBeDefined();
      expect(foundTodo?.title).toBe(newTodo.title);

      // Step 3: Complete the todo
      const completedTodo = await todoService.completeTodo(addedTodo.id);
      expect(completedTodo.completed).toBe(true);
      expect(completedTodo.updatedAt).not.toBe(addedTodo.updatedAt);

      // Step 4: Verify completion in list
      const updatedTodos = await todoService.listTodos();
      const completedFoundTodo = updatedTodos.find(t => t.id === addedTodo.id);
      expect(completedFoundTodo?.completed).toBe(true);
    });

    it('should handle multiple todos in batch operations', async () => {
      const batchTodos = [
        createMockTodo({ title: 'Batch Todo 1', priority: 'high' }),
        createMockTodo({ title: 'Batch Todo 2', priority: 'medium' }),
        createMockTodo({ title: 'Batch Todo 3', priority: 'low' }),
      ];

      // Add all todos
      const addedTodos: Todo[] = [];
      for (const todo of batchTodos) {
        const added = await todoService.addTodo('default', todo);
        addedTodos.push(added);
      }

      expect(addedTodos).toHaveLength(3);

      // List and verify all are present
      const allTodos = await todoService.listTodos();
      const batchIds = addedTodos.map(t => t.id);
      const foundBatchTodos = allTodos.filter(t => batchIds.includes(t.id));

      expect(foundBatchTodos).toHaveLength(3);

      // Complete some todos
      await todoService.toggleItemStatus('default', addedTodos[0]!.id, true);
      await todoService.toggleItemStatus('default', addedTodos[2]!.id, true);

      // Verify mixed completion states
      const finalTodos = await todoService.listTodos();
      const finalBatchTodos = finalTodos.filter(t => batchIds.includes(t.id));

      const completedCount = finalBatchTodos.filter(t => t.completed).length;
      const pendingCount = finalBatchTodos.filter(t => !t.completed).length;

      expect(completedCount).toBe(2);
      expect(pendingCount).toBe(1);
    });
  });

  describe('Storage Integration', () => {
    it('should persist todos across service instances', async () => {
      // Create and add a todo with first service instance
      const persistentTodo = createMockTodo({
        title: 'Persistent Todo',
        description: 'Should survive service restart',
      });

      const addedTodo = await todoService.addTodo('default', persistentTodo);
      expect(addedTodo.id).toBeDefined();

      // Create new service instance (simulating restart)
      createWalrusStorage('testnet', true);
      const newTodoService = new TodoService();

      // Should be able to retrieve the todo
      const retrievedTodos = await newTodoService.listTodos();
      const foundTodo = retrievedTodos.find(t => t.id === addedTodo.id);

      expect(foundTodo).toBeDefined();
      expect(foundTodo?.title).toBe(persistentTodo.title);
      expect(foundTodo?.description).toBe(persistentTodo.description);
    });

    it('should handle concurrent operations safely', async () => {
      const concurrentTodos = Array.from({ length: 10 }, (_, i) =>
        createMockTodo({
          title: `Concurrent Todo ${i}`,
          description: `Description ${i}`,
          id: `concurrent-${i}`,
        })
      );

      // Add all todos concurrently
      const addPromises = concurrentTodos.map(todo =>
        todoService.addTodo('default', todo)
      );
      const addedTodos = await Promise.all(addPromises);

      expect(addedTodos).toHaveLength(10);
      addedTodos.forEach((todo, index) => {
        expect(todo.title).toBe(`Concurrent Todo ${index}`);
        expect(todo.id).toBeDefined();
      });

      // Complete half of them concurrently
      const completePromises = addedTodos
        .slice(0, 5)
        .map(todo => todoService.completeTodo(todo.id));

      const completedTodos = await Promise.all(completePromises);
      expect(completedTodos).toHaveLength(5);
      completedTodos.forEach(todo => {
        expect(todo.completed).toBe(true);
      });

      // Verify final state
      const finalTodos = await todoService.listTodos();
      const concurrentIds = addedTodos.map(t => t.id);
      const finalConcurrentTodos = finalTodos.filter(t =>
        concurrentIds.includes(t.id)
      );

      const completedCount = finalConcurrentTodos.filter(
        t => t.completed
      ).length;
      const pendingCount = finalConcurrentTodos.filter(
        t => !t.completed
      ).length;

      expect(completedCount).toBe(5);
      expect(pendingCount).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid todo data gracefully', async () => {
      // Test with empty title
      const invalidTodo = createMockTodo({ title: '' });
      await expect(
        todoService.addTodo('default', invalidTodo as Todo)
      ).rejects.toThrow();

      // Test with invalid priority
      const invalidPriorityTodo = {
        ...createMockTodo(),
        priority: 'invalid' as any,
      };
      await expect(
        todoService.addTodo('default', invalidPriorityTodo)
      ).rejects.toThrow();
    });

    it('should handle non-existent todo operations', async () => {
      // Try to complete non-existent todo
      await expect(
        todoService.completeTodo('non-existent-id')
      ).rejects.toThrow();

      // Try to update non-existent todo
      const updateData = { title: 'Updated Title' };
      await expect(
        todoService.updateTodo('default', 'non-existent-id', updateData)
      ).rejects.toThrow();
    });

    it('should validate todo updates', async () => {
      // Create a valid todo first
      const validTodo = createMockTodo({ title: 'Valid Todo' });
      const addedTodo = await todoService.addTodo('default', validTodo);

      // Try invalid updates
      await expect(
        todoService.updateTodo('default', addedTodo.id, { title: '' })
      ).rejects.toThrow();

      await expect(
        todoService.updateTodo('default', addedTodo.id, {
          priority: 'invalid' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('Search and Filter Operations', () => {
    beforeEach(async () => {
      // Setup test data with various attributes
      const testTodos = [
        createMockTodo({
          title: 'Work Task',
          tags: ['work'],
          priority: 'high',
          completed: false,
        }),
        createMockTodo({
          title: 'Personal Task',
          tags: ['personal'],
          priority: 'medium',
          completed: true,
        }),
        createMockTodo({
          title: 'Urgent Work',
          tags: ['work', 'urgent'],
          priority: 'high',
          completed: false,
        }),
        createMockTodo({
          title: 'Low Priority Task',
          tags: ['misc'],
          priority: 'low',
          completed: false,
        }),
      ];

      for (const todo of testTodos) {
        await todoService.addTodo('default', todo);
      }
    });

    it('should filter todos by completion status', async () => {
      const allTodos = await todoService.listTodos();

      const completedTodos = allTodos.filter(t => t.completed);
      const pendingTodos = allTodos.filter(t => !t.completed);

      expect(completedTodos.length).toBeGreaterThan(0);
      expect(pendingTodos.length).toBeGreaterThan(0);
      expect(completedTodos.length + pendingTodos.length).toBe(allTodos.length);
    });

    it('should filter todos by priority', async () => {
      const allTodos = await todoService.listTodos();

      const highPriorityTodos = allTodos.filter(t => t.priority === 'high');
      const mediumPriorityTodos = allTodos.filter(t => t.priority === 'medium');
      const lowPriorityTodos = allTodos.filter(t => t.priority === 'low');

      expect(highPriorityTodos.length).toBeGreaterThan(0);
      expect(mediumPriorityTodos.length).toBeGreaterThan(0);
      expect(lowPriorityTodos.length).toBeGreaterThan(0);
    });

    it('should search todos by title', async () => {
      const allTodos = await todoService.listTodos();

      const workTodos = allTodos.filter(t =>
        t.title.toLowerCase().includes('work')
      );
      const taskTodos = allTodos.filter(t =>
        t.title.toLowerCase().includes('task')
      );

      expect(workTodos.length).toBeGreaterThan(0);
      expect(taskTodos.length).toBeGreaterThan(0);
    });
  });
});
