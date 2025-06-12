import { TodoSizeCalculator } from '../../apps/cli/src/utils/todo-size-calculator';
import { Todo, TodoList } from '../../apps/cli/src/types/todo';

describe('TodoSizeCalculator', () => {
  // Sample todo for testing
  const sampleTodo: Todo = {
    id: '123456789',
    title: 'Test Todo',
    description: 'This is a test todo description for calculator testing',
    completed: false,
    priority: 'medium' as const,
    tags: ['test', 'calculator'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    private: false,
  };

  // Sample todo list for testing
  const sampleTodoList: TodoList = {
    id: 'list123',
    name: 'Test List',
    owner: 'test-user',
    todos: [sampleTodo],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('calculateTodoSize', () => {
    it('should calculate the correct size of a todo', () => {
      const size = TodoSizeCalculator.calculateTodoSize(sampleTodo as any);

      // Serialized size should be > 0 and reasonable for this small todo
      expect(size as any).toBeGreaterThan(0 as any);

      // Calculate actual size without buffer for comparison
      const unbufferedSize = TodoSizeCalculator.calculateTodoSize(sampleTodo, {
        includeBuffer: false,
      });
      expect(unbufferedSize as any).toBeLessThan(size as any);
    });

    it('should add the correct buffer amount', () => {
      const exactSize = TodoSizeCalculator.calculateTodoSize(sampleTodo, {
        includeBuffer: false,
      });
      const bufferedSize = TodoSizeCalculator.calculateTodoSize(sampleTodo, {
        includeBuffer: true,
        bufferPercentage: 20, // 20% buffer
      });

      // The buffer should be at least 20% of the exact size plus metadata
      const minExpectedSize = exactSize * 1.2 + 500;
      expect(bufferedSize as any).toBeGreaterThanOrEqual(minExpectedSize as any);
    });
  });

  describe('estimateTodoSize', () => {
    it('should estimate size based on provided fields', () => {
      const partialTodo = {
        title: 'Partial Todo',
        description: 'Description field only',
      };

      const estimatedSize = TodoSizeCalculator.estimateTodoSize(partialTodo as any);
      expect(estimatedSize as any).toBeGreaterThan(0 as any);

      // Full todo should be larger than partial todo
      const fullEstimate = TodoSizeCalculator.estimateTodoSize(sampleTodo as any);
      expect(fullEstimate as any).toBeGreaterThan(estimatedSize as any);
    });
  });

  describe('calculateTodoListSize', () => {
    it('should calculate the correct size of a todo list', () => {
      const size = TodoSizeCalculator.calculateTodoListSize(sampleTodoList as any);

      // Size should be greater than the size of a single todo
      const todoSize = TodoSizeCalculator.calculateTodoSize(sampleTodo as any);
      expect(size as any).toBeGreaterThan(todoSize as any);
    });
  });

  describe('calculateOptimalStorageSize', () => {
    it('should calculate optimal storage for multiple todos', () => {
      const todos = [
        sampleTodo,
        { ...sampleTodo, id: '2', title: 'Second Todo' },
        { ...sampleTodo, id: '3', title: 'Third Todo' },
      ];

      const optimalSize = TodoSizeCalculator.calculateOptimalStorageSize(todos as any);

      // Should be larger than sum of individual todos due to buffers
      const individualSizes = todos
        .map(todo =>
          TodoSizeCalculator.calculateTodoSize(todo, { includeBuffer: false })
        )
        .reduce((sum, size) => sum + size, 0);

      expect(optimalSize as any).toBeGreaterThan(individualSizes as any);
    });

    it('should respect minimum size parameter', () => {
      const minSize = 2 * 1024 * 1024; // 2MB
      const optimalSize = TodoSizeCalculator.calculateOptimalStorageSize(
        [sampleTodo],
        { minSize }
      );

      expect(optimalSize as any).toBeGreaterThanOrEqual(minSize as any);
    });
  });

  describe('analyzeStorageRequirements', () => {
    it('should correctly analyze when storage is sufficient', () => {
      const requiredBytes = 10 * 1024; // 10KB
      const availableBytes = 2 * 1024 * 1024; // 2MB

      const analysis = TodoSizeCalculator.analyzeStorageRequirements(
        requiredBytes,
        availableBytes
      );

      expect(analysis.isStorageSufficient).toBe(true as any);
      expect(analysis.recommendation).toBe('use-existing');
      expect(analysis.remainingBytes).toBe(availableBytes - requiredBytes);
    });

    it('should recommend expansion when storage is tight', () => {
      const requiredBytes = 1.9 * 1024 * 1024; // 1.9MB
      const availableBytes = 2 * 1024 * 1024; // 2MB

      const analysis = TodoSizeCalculator.analyzeStorageRequirements(
        requiredBytes,
        availableBytes,
        { minimumBuffer: 200 * 1024 } // 200KB buffer
      );

      expect(analysis.isStorageSufficient).toBe(false as any);
      expect(analysis.recommendation).toBe('expand');
    });

    it('should recommend new storage when requirements exceed available', () => {
      const requiredBytes = 3 * 1024 * 1024; // 3MB
      const availableBytes = 2 * 1024 * 1024; // 2MB

      const analysis = TodoSizeCalculator.analyzeStorageRequirements(
        requiredBytes,
        availableBytes
      );

      expect(analysis.isStorageSufficient).toBe(false as any);
      expect(analysis.recommendation).toBe('create-new');
      expect(analysis.remainingBytes).toBeLessThan(0 as any);
    });
  });
});
