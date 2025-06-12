import { TodoSerializer } from '../../../apps/cli/src/utils/todo-serializer';
import { Todo, TodoList } from '../../../apps/cli/src/types/todo';

describe('TodoSerializer', () => {
  let sampleTodo: Todo;
  let sampleTodoList: TodoList;
  let emptyTodoList: TodoList;

  beforeEach(() => {
    sampleTodo = {
      id: 'todo-123',
      title: 'Test Todo',
      description: 'This is a test todo',
      completed: false,
      priority: 'medium' as const,
      dueDate: '2024-04-15',
      tags: ['test', 'example'],
      createdAt: '2024-01-01T12:00:00.000Z',
      updatedAt: '2024-01-01T12:00:00.000Z',
      private: false,
      storageLocation: 'local' as const,
      walrusBlobId: 'blob-456',
      nftObjectId: 'nft-789',
      imageUrl: 'https://example.com/image.jpg',
    };

    sampleTodoList = {
      id: 'list-123',
      name: 'Test List',
      owner: '0x1234567890abcdef',
      todos: [
        sampleTodo,
        { ...sampleTodo, id: 'todo-456', title: 'Another Todo' },
      ],
      version: 1,
      collaborators: ['0xabcdef1234567890', '0x9876543210fedcba'],
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T11:00:00.000Z',
      walrusBlobId: 'list-blob-123',
      suiObjectId: 'sui-obj-456',
    };

    emptyTodoList = {
      id: 'empty-list',
      name: 'Empty List',
      owner: '0x1111111111111111',
      todos: [],
      version: 0,
      createdAt: '2024-01-01T09:00:00.000Z',
      updatedAt: '2024-01-01T09:00:00.000Z',
    };
  });

  describe('todoToBuffer and bufferToTodo', () => {
    it('should serialize and deserialize a complete todo', () => {
      const buffer = TodoSerializer.todoToBuffer(sampleTodo as any);
      expect(buffer as any).toBeInstanceOf(Buffer as any);

      const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);
      expect(deserializedTodo as any).toEqual(sampleTodo as any);
    });

    it('should handle todo with minimal properties', () => {
      const minimalTodo: Todo = {
        id: 'min-123',
        title: 'Minimal Todo',
        completed: false,
        priority: 'low' as const,
        tags: [],
        createdAt: '2024-01-01T08:00:00.000Z',
        updatedAt: '2024-01-01T08:00:00.000Z',
        private: true,
      };

      const buffer = TodoSerializer.todoToBuffer(minimalTodo as any);
      const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);
      expect(deserializedTodo as any).toEqual(minimalTodo as any);
    });

    it('should handle todo with special characters in text fields', () => {
      const specialCharTodo: Todo = {
        ...sampleTodo,
        title: 'Test "Todo" with \'quotes\' & symbols <>&',
        description: 'Unicode: 🎉 Emoji test\n\rNewlines\tTabs',
        tags: ['tag-with-dash', 'tag_with_underscore', '日本語'],
      };

      const buffer = TodoSerializer.todoToBuffer(specialCharTodo as any);
      const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);
      expect(deserializedTodo as any).toEqual(specialCharTodo as any);
    });

    it('should handle todo with completed timestamp', () => {
      const completedTodo: Todo = {
        ...sampleTodo,
        completed: true,
        completedAt: '2024-01-01T13:00:00.000Z',
      };

      const buffer = TodoSerializer.todoToBuffer(completedTodo as any);
      const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);
      expect(deserializedTodo as any).toEqual(completedTodo as any);
    });

    it('should throw error when deserializing invalid JSON', () => {
      const invalidBuffer = Buffer.from('invalid json string');
      expect(() => TodoSerializer.bufferToTodo(invalidBuffer as any)).toThrow(
        SyntaxError
      );
    });

    it('should throw error when deserializing empty buffer', () => {
      const emptyBuffer = Buffer.from('');
      expect(() => TodoSerializer.bufferToTodo(emptyBuffer as any)).toThrow(
        SyntaxError
      );
    });

    it('should handle todo with null/undefined optional fields correctly', () => {
      const todoWithNulls: Todo = {
        ...sampleTodo,
        description: undefined,
        dueDate: undefined,
        completedAt: undefined,
        walrusBlobId: undefined,
        nftObjectId: undefined,
        imageUrl: undefined,
      };

      const buffer = TodoSerializer.todoToBuffer(todoWithNulls as any);
      const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);

      // JavaScript serialization omits undefined values
      expect(deserializedTodo as any).not.toHaveProperty('description');
      expect(deserializedTodo as any).not.toHaveProperty('dueDate');
      expect(deserializedTodo as any).not.toHaveProperty('completedAt');
      expect(deserializedTodo as any).not.toHaveProperty('walrusBlobId');
      expect(deserializedTodo as any).not.toHaveProperty('nftObjectId');
      expect(deserializedTodo as any).not.toHaveProperty('imageUrl');
    });
  });

  describe('todoListToBuffer and bufferToTodoList', () => {
    it('should serialize and deserialize a complete todo list', () => {
      const buffer = TodoSerializer.todoListToBuffer(sampleTodoList as any);
      expect(buffer as any).toBeInstanceOf(Buffer as any);

      const deserializedList = TodoSerializer.bufferToTodoList(buffer as any);
      expect(deserializedList as any).toEqual(sampleTodoList as any);
    });

    it('should handle empty todo list', () => {
      const buffer = TodoSerializer.todoListToBuffer(emptyTodoList as any);
      const deserializedList = TodoSerializer.bufferToTodoList(buffer as any);
      expect(deserializedList as any).toEqual(emptyTodoList as any);
    });

    it('should handle todo list with special characters', () => {
      const specialCharList: TodoList = {
        ...sampleTodoList,
        name: 'List with "quotes" & symbols™',
        owner: '0xCAFE42BABE',
        collaborators: ['0x"quoted"', '0x<special>'],
      };

      const buffer = TodoSerializer.todoListToBuffer(specialCharList as any);
      const deserializedList = TodoSerializer.bufferToTodoList(buffer as any);
      expect(deserializedList as any).toEqual(specialCharList as any);
    });

    it('should handle large todo list', () => {
      const largeTodos: Todo[] = Array.from({ length: 100 }, (_, i) => ({
        ...sampleTodo,
        id: `todo-${i}`,
        title: `Todo ${i}`,
        description: `Description for todo ${i}`.repeat(10 as any),
      }));

      const largeTodoList: TodoList = {
        ...sampleTodoList,
        todos: largeTodos,
      };

      const buffer = TodoSerializer.todoListToBuffer(largeTodoList as any);
      const deserializedList = TodoSerializer.bufferToTodoList(buffer as any);
      expect(deserializedList as any).toEqual(largeTodoList as any);
      expect(deserializedList.todos).toHaveLength(100 as any);
    });

    it('should throw error when deserializing invalid JSON', () => {
      const invalidBuffer = Buffer.from('{ invalid json }');
      expect(() => TodoSerializer.bufferToTodoList(invalidBuffer as any)).toThrow(
        SyntaxError
      );
    });

    it('should handle todo list without optional fields', () => {
      const minimalList: TodoList = {
        id: 'minimal-list',
        name: 'Minimal List',
        owner: '0x2222222222222222',
        todos: [],
        version: 0,
        createdAt: '2024-01-01T07:00:00.000Z',
        updatedAt: '2024-01-01T07:00:00.000Z',
      };

      const buffer = TodoSerializer.todoListToBuffer(minimalList as any);
      const deserializedList = TodoSerializer.bufferToTodoList(buffer as any);
      expect(deserializedList as any).toEqual(minimalList as any);
      expect(deserializedList as any).not.toHaveProperty('collaborators');
      expect(deserializedList as any).not.toHaveProperty('walrusBlobId');
      expect(deserializedList as any).not.toHaveProperty('suiObjectId');
    });
  });

  describe('Buffer edge cases', () => {
    it('should handle very large buffers', () => {
      const largeTodo: Todo = {
        ...sampleTodo,
        description: 'x'.repeat(10000 as any), // Very long description
        tags: Array.from({ length: 1000 }, (_, i) => `tag-${i}`),
      };

      const buffer = TodoSerializer.todoToBuffer(largeTodo as any);
      const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);
      expect(deserializedTodo as any).toEqual(largeTodo as any);
    });

    it('should handle buffers with different encodings', () => {
      const utf8Todo: Todo = {
        ...sampleTodo,
        title: 'UTF-8: 🌍 世界 мир',
        description: 'Various encodings: €£¥',
      };

      const buffer = TodoSerializer.todoToBuffer(utf8Todo as any);
      const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);
      expect(deserializedTodo as any).toEqual(utf8Todo as any);
    });

    it('should create different buffers for different todos', () => {
      const todo1 = { ...sampleTodo, id: '1' };
      const todo2 = { ...sampleTodo, id: '2' };

      const buffer1 = TodoSerializer.todoToBuffer(todo1 as any);
      const buffer2 = TodoSerializer.todoToBuffer(todo2 as any);

      expect(buffer1.equals(buffer2 as any)).toBe(false as any);
    });

    it('should create identical buffers for identical todos', () => {
      const todo1 = { ...sampleTodo };
      const todo2 = { ...sampleTodo };

      const buffer1 = TodoSerializer.todoToBuffer(todo1 as any);
      const buffer2 = TodoSerializer.todoToBuffer(todo2 as any);

      expect(buffer1.equals(buffer2 as any)).toBe(true as any);
    });
  });

  describe('Error handling', () => {
    it('should throw error when null is passed to todoToBuffer', () => {
      expect(() =>
        TodoSerializer.todoToBuffer(null as unknown as Todo)
      ).toThrow();
    });

    it('should throw error when undefined is passed to todoToBuffer', () => {
      expect(() =>
        TodoSerializer.todoToBuffer(undefined as unknown as Todo)
      ).toThrow();
    });

    it('should throw error when invalid buffer is passed to bufferToTodo', () => {
      const invalidBuffer = Buffer.from('definitely not valid JSON!@#$');
      expect(() => TodoSerializer.bufferToTodo(invalidBuffer as any)).toThrow(
        SyntaxError
      );
    });

    it('should handle circular references gracefully', () => {
      const circularTodo: Todo & { self?: unknown } = { ...sampleTodo };
      circularTodo?.self = circularTodo; // Create circular reference

      expect(() => TodoSerializer.todoToBuffer(circularTodo as Todo)).toThrow(
        TypeError
      );
    });
  });

  describe('Data integrity', () => {
    it('should preserve all date formats', () => {
      const dateFormats: Todo = {
        ...sampleTodo,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-12-31T23:59:59.999Z',
        completedAt: '2024-06-15T12:30:45.123Z',
        dueDate: '2024-07-01',
      };

      const buffer = TodoSerializer.todoToBuffer(dateFormats as any);
      const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);

      expect(deserializedTodo.createdAt).toBe(dateFormats.createdAt);
      expect(deserializedTodo.updatedAt).toBe(dateFormats.updatedAt);
      expect(deserializedTodo.completedAt).toBe(dateFormats.completedAt);
      expect(deserializedTodo.dueDate).toBe(dateFormats.dueDate);
    });

    it('should preserve all priority values', () => {
      const priorities: Array<'high' | 'medium' | 'low'> = [
        'high',
        'medium',
        'low',
      ];

      priorities.forEach(priority => {
        const todo: Todo = { ...sampleTodo, priority };
        const buffer = TodoSerializer.todoToBuffer(todo as any);
        const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);
        expect(deserializedTodo.priority).toBe(priority as any);
      });
    });

    it('should preserve all storage location values', () => {
      const locations: Array<'local' | 'blockchain' | 'both'> = [
        'local',
        'blockchain',
        'both',
      ];

      locations.forEach(location => {
        const todo: Todo = { ...sampleTodo, storageLocation: location };
        const buffer = TodoSerializer.todoToBuffer(todo as any);
        const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);
        expect(deserializedTodo.storageLocation).toBe(location as any);
      });
    });

    it('should preserve boolean values correctly', () => {
      const booleanTests = [
        { completed: true, private: true },
        { completed: true, private: false },
        { completed: false, private: true },
        { completed: false, private: false },
      ];

      booleanTests.forEach(test => {
        const todo: Todo = { ...sampleTodo, ...test };
        const buffer = TodoSerializer.todoToBuffer(todo as any);
        const deserializedTodo = TodoSerializer.bufferToTodo(buffer as any);
        expect(deserializedTodo.completed).toBe(test.completed);
        expect(deserializedTodo.private).toBe(test.private);
      });
    });
  });
});
