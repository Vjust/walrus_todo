import { FuzzGenerator } from '../helpers/fuzz-generator';
import { TodoSerializer } from '../../src/utils/todo-serializer';
import { Todo, TodoList } from '../../src/types/todo';

describe('Serialization Fuzzing Tests', () => {
  const fuzzer = new FuzzGenerator();

  describe('Todo Serialization', () => {
    it('should handle random valid todo data', () => {
      const validTodos = fuzzer.array(() => ({
        id: fuzzer.string({ minLength: 5, maxLength: 50 }),
        title: fuzzer.string({ minLength: 1, maxLength: 200, includeUnicode: true }),
        description: fuzzer.string({ minLength: 0, maxLength: 2000, includeSpecialChars: true }),
        completed: fuzzer.boolean(),
        priority: fuzzer.subset(['high', 'medium', 'low'])[0] as 'high' | 'medium' | 'low',
        dueDate: fuzzer.date(new Date(2020, 0, 1), new Date(2025, 11, 31)).toISOString().split('T')[0],
        tags: fuzzer.array(() => fuzzer.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
        createdAt: fuzzer.date().toISOString(),
        updatedAt: fuzzer.date().toISOString(),
        completedAt: fuzzer.boolean() ? fuzzer.date().toISOString() : undefined,
        private: fuzzer.boolean(),
        storageLocation: fuzzer.subset(['local', 'blockchain', 'both'])[0] as 'local' | 'blockchain' | 'both',
        walrusBlobId: fuzzer.boolean() ? fuzzer.string({ minLength: 20, maxLength: 50 }) : undefined,
        nftObjectId: fuzzer.boolean() ? fuzzer.blockchainData().hash() : undefined,
        imageUrl: fuzzer.boolean() ? `https://example.com/${fuzzer.string()}` : undefined,
      } as Todo), { minLength: 50, maxLength: 200 });

      for (const todo of validTodos) {
        const buffer = TodoSerializer.todoToBuffer(todo);
        const deserialized = TodoSerializer.bufferToTodo(buffer);
        
        expect(deserialized).toEqual(todo);
        expect(deserialized.id).toBe(todo.id);
        expect(deserialized.title).toBe(todo.title);
        expect(deserialized.completed).toBe(todo.completed);
      }
    });

    it('should handle corrupted Buffer data', () => {
      const corruptedBuffers = fuzzer.array(() => {
        const type = fuzzer.subset(['truncated', 'invalid_utf8', 'random_bytes', 'empty'])[0];
        
        switch (type) {
          case 'truncated':
            const validBuffer = TodoSerializer.todoToBuffer({
              id: '123',
              title: 'Test',
              completed: false,
              priority: 'medium',
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              private: false
            } as Todo);
            return validBuffer.subarray(0, Math.floor(validBuffer.length / 2));
          
          case 'invalid_utf8':
            return Buffer.from([0xff, 0xfe, 0xfd, 0xfc, 0xfb, 0xfa]);
          
          case 'random_bytes':
            return Buffer.from(Array.from({ length: fuzzer.number(10, 1000) }, () => fuzzer.number(0, 255)));
          
          case 'empty':
            return Buffer.from([]);
          
          default:
            return Buffer.from('invalid');
        }
      }, { minLength: 20, maxLength: 50 });

      for (const buffer of corruptedBuffers) {
        expect(() => {
          TodoSerializer.bufferToTodo(buffer);
        }).toThrow();
      }
    });

    it('should handle malformed JSON structures', () => {
      const malformedStructures = fuzzer.array(() => {
        const type = fuzzer.subset([
          'missing_required_fields',
          'wrong_types',
          'extra_fields',
          'null_values',
          'circular_reference'
        ])[0];

        switch (type) {
          case 'missing_required_fields':
            return Buffer.from(JSON.stringify({
              title: fuzzer.string(),
              // Missing id, completed, priority, etc.
            }));
          
          case 'wrong_types':
            return Buffer.from(JSON.stringify({
              id: fuzzer.number(),  // Should be string
              title: fuzzer.number(),  // Should be string
              completed: fuzzer.string(),  // Should be boolean
              priority: fuzzer.number(),  // Should be 'high' | 'medium' | 'low'
              tags: fuzzer.string(),  // Should be array
              createdAt: fuzzer.boolean(),  // Should be string
              updatedAt: fuzzer.boolean(),  // Should be string
              private: fuzzer.string(),  // Should be boolean
            }));
          
          case 'extra_fields':
            return Buffer.from(JSON.stringify({
              id: fuzzer.string(),
              title: fuzzer.string(),
              completed: fuzzer.boolean(),
              priority: 'medium',
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              private: false,
              // Extra fields that shouldn't be there
              randomField1: fuzzer.string(),
              randomField2: fuzzer.number(),
              randomField3: fuzzer.array(() => fuzzer.string()),
            }));
          
          case 'null_values':
            return Buffer.from(JSON.stringify({
              id: null,
              title: null,
              completed: null,
              priority: null,
              tags: null,
              createdAt: null,
              updatedAt: null,
              private: null,
            }));
          
          case 'circular_reference':
            const obj: any = {
              id: fuzzer.string(),
              title: fuzzer.string(),
              completed: fuzzer.boolean(),
              priority: 'medium',
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              private: false,
            };
            obj.self = obj; // Create circular reference
            
            // This should throw when trying to stringify
            try {
              return Buffer.from(JSON.stringify(obj));
            } catch {
              return Buffer.from('{}');
            }
          
          default:
            return Buffer.from('not even json');
        }
      }, { minLength: 30, maxLength: 100 });

      for (const buffer of malformedStructures) {
        expect(() => {
          const todo = TodoSerializer.bufferToTodo(buffer);
          // Validate the deserialized object has required fields
          if (!todo.id || typeof todo.id !== 'string') throw new Error('Invalid id');
          if (!todo.title || typeof todo.title !== 'string') throw new Error('Invalid title');
          if (typeof todo.completed !== 'boolean') throw new Error('Invalid completed');
          if (!['high', 'medium', 'low'].includes(todo.priority)) throw new Error('Invalid priority');
          if (!Array.isArray(todo.tags)) throw new Error('Invalid tags');
          if (!todo.createdAt || typeof todo.createdAt !== 'string') throw new Error('Invalid createdAt');
          if (!todo.updatedAt || typeof todo.updatedAt !== 'string') throw new Error('Invalid updatedAt');
          if (typeof todo.private !== 'boolean') throw new Error('Invalid private');
        }).toThrow();
      }
    });

    it('should handle extreme data sizes', () => {
      const extremeSizes = fuzzer.array(() => {
        const size = fuzzer.subset(['huge_string', 'many_tags', 'deep_nesting', 'max_unicode'])[0];
        
        switch (size) {
          case 'huge_string':
            return {
              id: fuzzer.string({ minLength: 10000, maxLength: 100000 }),
              title: fuzzer.string({ minLength: 10000, maxLength: 50000, includeUnicode: true }),
              description: fuzzer.string({ minLength: 50000, maxLength: 200000, includeSpecialChars: true }),
              completed: false,
              priority: 'medium',
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              private: false
            } as Todo;
          
          case 'many_tags':
            return {
              id: fuzzer.string(),
              title: fuzzer.string(),
              completed: false,
              priority: 'medium',
              tags: fuzzer.array(() => fuzzer.string({ minLength: 100, maxLength: 500 }), { minLength: 1000, maxLength: 5000 }),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              private: false
            } as Todo;
          
          case 'deep_nesting':
            const todo: any = {
              id: fuzzer.string(),
              title: fuzzer.string(),
              completed: false,
              priority: 'medium',
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              private: false,
              customData: {}
            };
            
            // Create deep nesting
            let current = todo.customData;
            for (let i = 0; i < 1000; i++) {
              current.nested = { level: i };
              current = current.nested;
            }
            return todo as Todo;
          
          case 'max_unicode':
            return {
              id: fuzzer.string(),
              title: '🔥'.repeat(1000) + '💫'.repeat(1000) + '⚡'.repeat(1000),
              description: fuzzer.string({ minLength: 10000, maxLength: 20000, includeUnicode: true }),
              completed: false,
              priority: 'medium',
              tags: fuzzer.array(() => '✨'.repeat(fuzzer.number(10, 100)), { minLength: 100, maxLength: 500 }),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              private: false
            } as Todo;
          
          default:
            return {
              id: fuzzer.string(),
              title: fuzzer.string(),
              completed: false,
              priority: 'medium',
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              private: false
            } as Todo;
        }
      }, { minLength: 10, maxLength: 20 });

      for (const todo of extremeSizes) {
        // Test serialization with extreme sizes
        // Note: May throw due to memory constraints
        try {
          const buffer = TodoSerializer.todoToBuffer(todo);
          const deserialized = TodoSerializer.bufferToTodo(buffer);
          
          // Basic validation - checking structure is maintained
          expect(deserialized).toHaveProperty('id');
          expect(deserialized).toHaveProperty('title');
          expect(deserialized).toHaveProperty('completed');
        } catch (_error) {
          // Memory errors are expected for extreme sizes
          if (error instanceof RangeError || error instanceof Error) {
            expect(error.message).toMatch(/memory|size|Maximum|exceeded/i);
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe('TodoList Serialization', () => {
    it('should handle random valid todo list data', () => {
      const validTodoLists = fuzzer.array(() => ({
        id: fuzzer.string({ minLength: 5, maxLength: 50 }),
        name: fuzzer.string({ minLength: 1, maxLength: 200, includeUnicode: true }),
        owner: fuzzer.blockchainData().address(),
        todos: fuzzer.array(() => ({
          id: fuzzer.string(),
          title: fuzzer.string({ includeSpecialChars: true }),
          completed: fuzzer.boolean(),
          priority: fuzzer.subset(['high', 'medium', 'low'])[0] as 'high' | 'medium' | 'low',
          tags: fuzzer.array(() => fuzzer.string(), { maxLength: 5 }),
          createdAt: fuzzer.date().toISOString(),
          updatedAt: fuzzer.date().toISOString(),
          private: fuzzer.boolean()
        } as Todo), { maxLength: 20 }),
        version: fuzzer.number(1, 1000),
        collaborators: fuzzer.array(() => fuzzer.blockchainData().address(), { maxLength: 10 }),
        createdAt: fuzzer.date().toISOString(),
        updatedAt: fuzzer.date().toISOString(),
        walrusBlobId: fuzzer.boolean() ? fuzzer.string() : undefined,
        suiObjectId: fuzzer.boolean() ? fuzzer.blockchainData().hash() : undefined,
      } as TodoList), { minLength: 10, maxLength: 50 });

      for (const todoList of validTodoLists) {
        const buffer = TodoSerializer.todoListToBuffer(todoList);
        const deserialized = TodoSerializer.bufferToTodoList(buffer);
        
        expect(deserialized).toEqual(todoList);
        expect(deserialized.id).toBe(todoList.id);
        expect(deserialized.name).toBe(todoList.name);
        expect(deserialized.owner).toBe(todoList.owner);
        expect(deserialized.todos.length).toBe(todoList.todos.length);
      }
    });

    it('should handle corrupted TodoList buffer data', () => {
      const corruptedListBuffers = fuzzer.array(() => {
        const type = fuzzer.subset(['truncated', 'nested_corruption', 'partial_json'])[0];
        
        switch (type) {
          case 'truncated':
            const validBuffer = TodoSerializer.todoListToBuffer({
              id: '123',
              name: 'Test List',
              owner: fuzzer.blockchainData().address(),
              todos: [],
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as TodoList);
            return validBuffer.subarray(0, Math.floor(validBuffer.length * 0.3));
          
          case 'nested_corruption':
            const list = {
              id: '123',
              name: 'Test List',
              owner: fuzzer.blockchainData().address(),
              todos: [
                // Invalid todo structure
                { invalid: 'todo' },
                null,
                undefined,
                123,
                'string instead of object'
              ],
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            return Buffer.from(JSON.stringify(list));
          
          case 'partial_json':
            return Buffer.from('{"id": "123", "name": "Test", "owner": "0x');
          
          default:
            return Buffer.from('invalid buffer data');
        }
      }, { minLength: 20, maxLength: 50 });

      for (const buffer of corruptedListBuffers) {
        expect(() => {
          TodoSerializer.bufferToTodoList(buffer);
        }).toThrow();
      }
    });

    it('should handle TodoList with extreme nested data', () => {
      const extremeLists = fuzzer.array(() => {
        const type = fuzzer.subset(['many_todos', 'huge_todos', 'deep_nesting'])[0];
        
        switch (type) {
          case 'many_todos':
            return {
              id: fuzzer.string(),
              name: fuzzer.string(),
              owner: fuzzer.blockchainData().address(),
              todos: fuzzer.array(() => ({
                id: fuzzer.string(),
                title: fuzzer.string(),
                completed: fuzzer.boolean(),
                priority: 'medium',
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                private: false
              } as Todo), { minLength: 1000, maxLength: 5000 }),
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as TodoList;
          
          case 'huge_todos':
            return {
              id: fuzzer.string(),
              name: fuzzer.string(),
              owner: fuzzer.blockchainData().address(),
              todos: fuzzer.array(() => ({
                id: fuzzer.string({ minLength: 1000, maxLength: 5000 }),
                title: fuzzer.string({ minLength: 5000, maxLength: 10000 }),
                description: fuzzer.string({ minLength: 10000, maxLength: 50000 }),
                completed: fuzzer.boolean(),
                priority: 'medium',
                tags: fuzzer.array(() => fuzzer.string({ minLength: 100, maxLength: 500 }), { minLength: 100, maxLength: 500 }),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                private: false
              } as Todo), { minLength: 10, maxLength: 50 }),
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as TodoList;
          
          case 'deep_nesting':
            const list: any = {
              id: fuzzer.string(),
              name: fuzzer.string(),
              owner: fuzzer.blockchainData().address(),
              todos: [],
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              metadata: {}
            };
            
            // Create deep nesting in metadata
            let current = list.metadata;
            for (let i = 0; i < 500; i++) {
              current.level = { depth: i, data: fuzzer.string() };
              current = current.level;
            }
            return list as TodoList;
          
          default:
            return {
              id: fuzzer.string(),
              name: fuzzer.string(),
              owner: fuzzer.blockchainData().address(),
              todos: [],
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as TodoList;
        }
      }, { minLength: 5, maxLength: 10 });

      for (const todoList of extremeLists) {
        try {
          const buffer = TodoSerializer.todoListToBuffer(todoList);
          const deserialized = TodoSerializer.bufferToTodoList(buffer);
          
          // Basic validation
          expect(deserialized).toHaveProperty('id');
          expect(deserialized).toHaveProperty('name');
          expect(deserialized).toHaveProperty('owner');
          expect(Array.isArray(deserialized.todos)).toBe(true);
        } catch (_error) {
          // Memory errors are expected for extreme sizes
          if (error instanceof RangeError || error instanceof Error) {
            expect(error.message).toMatch(/memory|size|Maximum|exceeded/i);
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle special JSON characters in strings', () => {
      const specialCases = [
        { char: '\\', name: 'backslash' },
        { char: '"', name: 'quote' },
        { char: '\n', name: 'newline' },
        { char: '\r', name: 'carriage return' },
        { char: '\t', name: 'tab' },
        { char: '\b', name: 'backspace' },
        { char: '\f', name: 'form feed' },
        { char: '\u0000', name: 'null character' },
        { char: '\u001f', name: 'control character' },
      ];

      for (const { char, name } of specialCases) {
        const todo: Todo = {
          id: fuzzer.string(),
          title: `Test ${char} in ${name}`,
          description: `${char}${char}${char}`,
          completed: false,
          priority: 'medium',
          tags: [`tag${char}1`, `tag${char}2`],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          private: false
        };

        const buffer = TodoSerializer.todoToBuffer(todo);
        const deserialized = TodoSerializer.bufferToTodo(buffer);
        
        expect(deserialized.title).toContain(char);
        expect(deserialized.description).toContain(char);
        expect(deserialized.tags[0]).toContain(char);
      }
    });

    it('should handle buffer encoding edge cases', () => {
      const encodingCases = fuzzer.array(() => {
        const type = fuzzer.subset(['empty_string', 'null_byte', 'utf16_surrogate', 'invalid_unicode'])[0];
        
        switch (type) {
          case 'empty_string':
            return Buffer.from('');
          
          case 'null_byte':
            return Buffer.from('\0');
          
          case 'utf16_surrogate':
            // Invalid UTF-16 surrogate pair
            return Buffer.from([0xDC, 0x00, 0xD8, 0x00]);
          
          case 'invalid_unicode':
            // Invalid unicode sequence
            return Buffer.from([0xC0, 0x80, 0xE0, 0x80, 0x80]);
          
          default:
            return Buffer.from([]);
        }
      }, { minLength: 10, maxLength: 30 });

      for (const buffer of encodingCases) {
        expect(() => {
          TodoSerializer.bufferToTodo(buffer);
        }).toThrow();
      }
    });

    it('should handle concurrent serialization operations', async () => {
      const concurrentOperations = 100;
      const todos = fuzzer.array(() => ({
        id: fuzzer.string(),
        title: fuzzer.string({ includeUnicode: true, includeSpecialChars: true }),
        completed: fuzzer.boolean(),
        priority: fuzzer.subset(['high', 'medium', 'low'])[0] as 'high' | 'medium' | 'low',
        tags: fuzzer.array(() => fuzzer.string()),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: fuzzer.boolean()
      } as Todo), { minLength: concurrentOperations, maxLength: concurrentOperations });

      const operations = todos.map(todo => 
        new Promise((resolve, reject) => {
          try {
            const buffer = TodoSerializer.todoToBuffer(todo);
            const deserialized = TodoSerializer.bufferToTodo(buffer);
            resolve(deserialized);
          } catch (_error) {
            reject(error);
          }
        })
      );

      const results = await Promise.allSettled(operations);
      
      // All operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(concurrentOperations);
    });
  });
});