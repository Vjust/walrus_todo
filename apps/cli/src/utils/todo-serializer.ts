import { Todo, TodoList } from '../types/todo';
import { validateTodo, validateTodoList } from './validation/schemas';
import { CLIError } from '../types/errors/consolidated';

/**
 * Serializer utility for converting todos to/from various formats
 * Now includes robust validation using Zod schemas to prevent data corruption
 */
export class TodoSerializer {
  static todoToBuffer(todo: Todo): Buffer {
    // Validate before serialization
    const validatedTodo = validateTodo(todo);
    return Buffer.from(JSON.stringify(validatedTodo));
  }

  static bufferToTodo(buffer: Buffer): Todo {
    try {
      const parsed = JSON.parse(buffer.toString());

      // Apply backwards compatibility defaults before validation
      const normalized = this.normalizeTodoForCompatibility(parsed);

      // Validate the normalized data using Zod schema
      return validateTodo(normalized);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new CLIError(
          `Invalid JSON format in todo buffer: ${error.message}`,
          'INVALID_JSON_FORMAT'
        );
      }
      throw error; // Re-throw validation errors with detailed messages
    }
  }

  static todoListToBuffer(todoList: TodoList): Buffer {
    // Validate before serialization
    const validatedTodoList = validateTodoList(todoList);
    return Buffer.from(JSON.stringify(validatedTodoList));
  }

  static bufferToTodoList(buffer: Buffer): TodoList {
    try {
      const parsed = JSON.parse(buffer.toString());

      // Apply backwards compatibility defaults before validation
      const normalized = this.normalizeTodoListForCompatibility(parsed);

      // Validate the normalized data using Zod schema
      return validateTodoList(normalized);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new CLIError(
          `Invalid JSON format in todo list buffer: ${error.message}`,
          'INVALID_JSON_FORMAT'
        );
      }
      throw error; // Re-throw validation errors with detailed messages
    }
  }

  /**
   * Safe deserialization that returns result object instead of throwing
   */
  static safeBufferToTodo(
    buffer: Buffer
  ): { success: true; data: Todo } | { success: false; error: string } {
    try {
      const todo = this.bufferToTodo(buffer);
      return { success: true, data: todo };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown deserialization error',
      };
    }
  }

  /**
   * Safe deserialization for todo lists
   */
  static safeBufferToTodoList(
    buffer: Buffer
  ): { success: true; data: TodoList } | { success: false; error: string } {
    try {
      const todoList = this.bufferToTodoList(buffer);
      return { success: true, data: todoList };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown deserialization error',
      };
    }
  }

  /**
   * Validate and normalize a plain object to a Todo
   */
  static normalizeTodo(obj: unknown): Todo {
    const normalized = this.normalizeTodoForCompatibility(obj);
    return validateTodo(normalized);
  }

  /**
   * Validate and normalize a plain object to a TodoList
   */
  static normalizeTodoList(obj: unknown): TodoList {
    const normalized = this.normalizeTodoListForCompatibility(obj);
    return validateTodoList(normalized);
  }

  /**
   * Apply backwards compatibility defaults for Todo objects
   */
  private static normalizeTodoForCompatibility(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    // Ensure required fields have default values
    return {
      ...obj,
      // Set defaults for missing required fields
      private: obj.private ?? false,
      priority: obj.priority ?? 'medium',
      tags: obj.tags ?? [],
    };
  }

  /**
   * Apply backwards compatibility defaults for TodoList objects
   */
  private static normalizeTodoListForCompatibility(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    // Normalize nested todos first
    const normalizedTodos = Array.isArray(obj.todos)
      ? obj?.todos?.map((todo: any) => this.normalizeTodoForCompatibility(todo))
      : [];

    // Ensure required fields have default values
    return {
      ...obj,
      todos: normalizedTodos,
      version: obj.version ?? 1,
    };
  }
}
