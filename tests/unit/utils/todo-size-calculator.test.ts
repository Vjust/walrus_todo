import { TodoSizeCalculator } from '../../../apps/cli/src/utils/todo-size-calculator';
import { Todo } from '../../../apps/cli/src/types/todo';
import { createMockTodo } from '../../../apps/cli/src/__tests__/helpers/test-utils';

describe('TodoSizeCalculator', () => {
  let calculator: TodoSizeCalculator;

  beforeEach(() => {
    calculator = new TodoSizeCalculator();
  });

  describe('calculateBytes', () => {
    it('should calculate size for basic todo', () => {
      const todo: Todo = createMockTodo({
        id: '12345',
        title: 'Simple task',
        completed: false,
        user: 'test-user',
      });

      const expectedSize = JSON.stringify(todo, null, 2).length;
      const actualSize = calculator.calculateBytes(todo);

      expect(actualSize).toBe(expectedSize);
    });

    it('should calculate size for todo with description', () => {
      const todo: Todo = createMockTodo({
        id: '12345',
        title: 'Task with description',
        description:
          'This is a longer description that adds to the overall size',
        completed: false,
        user: 'test-user',
      });

      const expectedSize = JSON.stringify(todo, null, 2).length;
      const actualSize = calculator.calculateBytes(todo);

      expect(actualSize).toBe(expectedSize);
    });

    it('should calculate size for todo with all optional fields', () => {
      const todo: Todo = {
        id: '12345',
        title: 'Complex task',
        description: 'A complex task with many fields',
        completed: true,
        user: 'test-user',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        category: 'work',
        priority: 'high' as const,
        tags: ['urgent', 'important', 'project-x'],
        reminders: [
          {
            id: 'reminder-1',
            date: '2024-01-03T00:00:00.000Z',
            message: 'Review this task',
          },
        ],
        metadata: {
          project: 'alpha',
          client: 'acme',
          additionalInfo: {
            notes: 'Some additional notes here',
            customFields: {
              field1: 'value1',
              field2: 'value2',
            },
          },
        },
      };

      const expectedSize = JSON.stringify(todo, null, 2).length;
      const actualSize = calculator.calculateBytes(todo);

      expect(actualSize).toBe(expectedSize);
    });

    it('should handle empty todo', () => {
      const todo: Todo = createMockTodo({
        id: '',
        title: '',
        completed: false,
        user: '',
      });

      const expectedSize = JSON.stringify(todo, null, 2).length;
      const actualSize = calculator.calculateBytes(todo);

      expect(actualSize).toBe(expectedSize);
    });

    it('should handle todo with unicode characters', () => {
      const todo: Todo = createMockTodo({
        id: '12345',
        title: '测试任务 🔥 ñoño',
        description: 'Test with emojis 😊🎉 and special chars: €¥£',
        completed: false,
        user: 'test-user',
      });

      const expectedSize = JSON.stringify(todo, null, 2).length;
      const actualSize = calculator.calculateBytes(todo);

      expect(actualSize).toBe(expectedSize);
    });

    it('should handle todo with nested arrays and objects', () => {
      const todo: Todo = createMockTodo({
        id: '12345',
        title: 'Nested structures',
        completed: false,
        user: 'test-user',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
        metadata: {
          level1: {
            level2: {
              level3: {
                deepData: 'nested value',
                array: [1, 2, 3, 4, 5],
              },
            },
          },
        },
      });

      const expectedSize = JSON.stringify(todo, null, 2).length;
      const actualSize = calculator.calculateBytes(todo);

      expect(actualSize).toBe(expectedSize);
    });
  });

  describe('calculateFormattedSize', () => {
    it('should format bytes correctly', () => {
      expect(
        calculator.calculateFormattedSize(createMockTodo({
          id: '1',
          title: 'a',
          completed: false,
          user: 'u',
        }))
      ).toMatch(/^\d+\s*B$/);
    });

    it('should format kilobytes correctly', () => {
      const largeTodo: Todo = createMockTodo({
        id: '12345',
        title: 'Large todo',
        description: 'A'.repeat(500),
        completed: false,
        user: 'test-user',
        tags: Array(50).fill('tag'),
        metadata: {
          data: 'B'.repeat(500),
        },
      });

      const size = calculator.calculateFormattedSize(largeTodo);
      expect(size).toMatch(/^\d+\.\d+\s*KB$/);
    });

    it('should format megabytes correctly', () => {
      const veryLargeTodo: Todo = createMockTodo({
        id: '12345',
        title: 'Very large todo',
        description: 'A'.repeat(500000),
        completed: false,
        user: 'test-user',
        metadata: {
          data: 'B'.repeat(500000),
        },
      });

      const size = calculator.calculateFormattedSize(veryLargeTodo);
      expect(size).toMatch(/^\d+\.\d+\s*MB$/);
    });
  });

  describe('edge cases', () => {
    it('should handle circular references gracefully', () => {
      const todo: Todo & { self?: unknown } = createMockTodo({
        id: '12345',
        title: 'Circular todo',
        completed: false,
        user: 'test-user',
      });
      // Create circular reference
      todo.self = todo;

      expect(() => calculator.calculateBytes(todo as Todo)).toThrow();
    });

    it('should handle very large strings', () => {
      const todo: Todo = createMockTodo({
        id: '12345',
        title: 'X'.repeat(10000),
        description: 'Y'.repeat(50000),
        completed: false,
        user: 'test-user',
      });

      const size = calculator.calculateBytes(todo);
      expect(size).toBeGreaterThan(60000);
    });

    it('should handle special number values', () => {
      const todo: Todo & { metadata?: Record<string, unknown> } = createMockTodo({
        id: '12345',
        title: 'Special numbers',
        completed: false,
        user: 'test-user',
        metadata: {
          infinity: Infinity,
          negInfinity: -Infinity,
          notANumber: NaN,
          maxInt: Number.MAX_SAFE_INTEGER,
          minInt: Number.MIN_SAFE_INTEGER,
        },
      });

      // JSON.stringify converts these to null or string representations
      const expectedSize = JSON.stringify(todo, null, 2).length;
      const actualSize = calculator.calculateBytes(todo as Todo);

      expect(actualSize).toBe(expectedSize);
    });
  });

  describe('accuracy tests', () => {
    it('should match actual serialized size for various todo structures', () => {
      const testCases: Todo[] = [
        createMockTodo({
          id: '1',
          title: 'Simple',
          completed: false,
          user: 'user1',
        }),
        createMockTodo({
          id: '2',
          title: 'With description',
          description: 'A description here',
          completed: true,
          user: 'user2',
        }),
        createMockTodo({
          id: '3',
          title: 'With tags',
          completed: false,
          user: 'user3',
          tags: ['urgent', 'work', 'deadline'],
        }),
        createMockTodo({
          id: '4',
          title: 'Full featured',
          description: 'Complete todo with all features',
          completed: false,
          user: 'user4',
          category: 'personal',
          priority: 'medium' as const,
          tags: ['health', 'exercise'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ];

      testCases.forEach((todo, _index) => {
        const calculatedSize = calculator.calculateBytes(todo);
        const actualSize = JSON.stringify(todo, null, 2).length;

        expect(calculatedSize).toBe(actualSize);
      });
    });

    it('should handle dynamic content sizes accurately', () => {
      for (let i = 0; i < 10; i++) {
        const todo: Todo = createMockTodo({
          id: `id-${i}`,
          title: 'T'.repeat(i * 10),
          description: i % 2 === 0 ? 'D'.repeat(i * 20) : undefined,
          completed: i % 3 === 0,
          user: `user-${i}`,
          tags: i > 5 ? Array(i).fill(`tag-${i}`) : undefined,
        });

        const calculatedSize = calculator.calculateBytes(todo);
        const actualSize = JSON.stringify(todo, null, 2).length;

        expect(calculatedSize).toBe(actualSize);
      }
    });
  });
});
