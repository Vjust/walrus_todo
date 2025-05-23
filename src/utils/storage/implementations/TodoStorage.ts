/**
import { Logger } from '../../Logger';

const logger = new Logger('TodoStorage');
 * @fileoverview Todo Storage - Specialized storage implementation for Todos
 *
 * This class extends the BlobStorage implementation to provide specialized
 * functionality for storing, retrieving, and managing Todo items. It adds
 * todo-specific validation, serialization, and type safety.
 */

import { Todo, TodoList } from '../../../types/todo';
import { BlobStorage } from './BlobStorage';
import { StorageConfig } from '../core/StorageTypes';
import { ValidationError, StorageError } from '../../../types/errors/consolidated';
import { TodoSerializer } from '../../todo-serializer';
import { TodoSizeCalculator } from '../../todo-size-calculator';
import { StorageOperationHandler } from '../utils/StorageOperationHandler';

/**
 * Default configuration for todo storage
 */
const DEFAULT_TODO_STORAGE_CONFIG: Partial<StorageConfig> = {
  // Override defaults from BlobStorage if needed
};

/**
 * Specialized storage implementation for Todo items.
 * Extends BlobStorage with todo-specific functionality.
 */
export class TodoStorage extends BlobStorage {
  /**
   * Creates a new TodoStorage instance.
   * 
   * @param address - User's wallet address
   * @param configOverrides - Optional configuration overrides
   */
  constructor(address: string, configOverrides: Partial<StorageConfig> = {}) {
    // Merge todo defaults with provided overrides
    super(address, {
      ...DEFAULT_TODO_STORAGE_CONFIG,
      ...configOverrides
    });
  }
  
  /**
   * Stores a todo item in the storage system.
   * 
   * @param todo - The todo item to store
   * @returns Promise resolving to the blob ID for the stored todo
   * @throws {ValidationError} if todo validation fails
   * @throws {StorageError} if storage operation fails
   */
  public async storeTodo(todo: Todo): Promise<string> {
    try {
      // Validate todo data
      this.validateTodoData(todo);
      
      // Serialize todo to binary format
      const buffer = TodoSerializer.todoToBuffer(todo);
      
      // Calculate size with accurate calculator
      const exactSize = buffer.length;
      const calculatedSize = TodoSizeCalculator.calculateTodoSize(todo);
      
      logger.info(`Todo size: ${exactSize} bytes (raw), ${calculatedSize} bytes (with buffer)`);
      
      // Check size limit
      if (exactSize > this.getConfig().maxContentSize) {
        throw new ValidationError('Todo data is too large', {
          operation: 'size validation',
          field: 'size',
          value: exactSize.toString()
        });
      }
      
      // Prepare metadata
      const metadata = {
        contentType: 'application/json',
        contentCategory: 'todo',
        filename: `todo-${todo.id}.json`,
        title: todo.title,
        completed: todo.completed.toString(),
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        size: exactSize.toString(),
        todoId: todo.id,
        schemaVersion: '1',
        encoding: 'utf-8'
      };
      
      // Store the todo
      const blobId = await this.store(buffer, metadata);
      
      logger.info(`Todo successfully stored with blob ID: ${blobId}`);
      return blobId;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to store todo: ${error instanceof Error ? error.message : String(error)}`,
        'store todo'
      );
    }
  }
  
  /**
   * Retrieves a todo item from storage.
   * 
   * @param blobId - The blob ID for the todo to retrieve
   * @returns Promise resolving to the retrieved Todo
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if retrieval operation fails
   */
  public async retrieveTodo(blobId: string): Promise<Todo> {
    try {
      // Retrieve the blob
      const { content, metadata } = await this.retrieve(blobId);
      
      // Parse and validate the todo data
      const todo = this.parseTodoData(content);
      
      // Add the blob ID to the todo for reference
      todo.walrusBlobId = blobId;
      
      return todo;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to retrieve todo from blob ${blobId}: ${error instanceof Error ? error.message : String(error)}`,
        'retrieve todo'
      );
    }
  }
  
  /**
   * Updates a todo item in storage.
   * 
   * @param todo - The updated todo
   * @param originalBlobId - The original blob ID
   * @returns Promise resolving to the new blob ID
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if update operation fails
   */
  public async updateTodo(todo: Todo, originalBlobId: string): Promise<string> {
    try {
      // Validate todo data
      this.validateTodoData(todo);
      
      // Store updated todo (creates new blob since Walrus blobs are immutable)
      const metadata = {
        contentType: 'application/json',
        contentCategory: 'todo',
        filename: `todo-${todo.id}.json`,
        title: todo.title,
        completed: todo.completed.toString(),
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        todoId: todo.id,
        schemaVersion: '1',
        encoding: 'utf-8',
        originalBlobId // Reference to original for tracking updates
      };
      
      // Serialize and store
      const buffer = TodoSerializer.todoToBuffer(todo);
      const blobId = await this.store(buffer, metadata);
      
      logger.info(`Todo updated with new blob ID: ${blobId}`);
      logger.info(`Previous blob ID ${originalBlobId} will remain but can be ignored`);
      
      return blobId;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to update todo: ${error instanceof Error ? error.message : String(error)}`,
        'update todo'
      );
    }
  }
  
  /**
   * Stores a todo list in storage.
   * 
   * @param todoList - The todo list to store
   * @returns Promise resolving to the blob ID
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if storage operation fails
   */
  public async storeTodoList(todoList: TodoList): Promise<string> {
    try {
      // Validate todo list data
      this.validateTodoListData(todoList);
      
      // Serialize the list
      const buffer = TodoSerializer.todoListToBuffer(todoList);
      
      // Calculate size
      const exactSize = buffer.length;
      const calculatedSize = TodoSizeCalculator.calculateTodoListSize(todoList);
      
      logger.info(`Todo list size: ${exactSize} bytes (raw), ${calculatedSize} bytes (with buffer)`);
      logger.info(`Contains ${todoList.todos.length} todos`);
      
      // Prepare metadata
      const metadata = {
        contentType: 'application/json',
        contentCategory: 'todolist',
        filename: `todolist-${todoList.id}.json`,
        name: todoList.name,
        owner: todoList.owner || '',
        createdAt: todoList.createdAt,
        updatedAt: todoList.updatedAt,
        todoCount: todoList.todos.length.toString(),
        listId: todoList.id,
        schemaVersion: '1',
        encoding: 'utf-8'
      };
      
      // Store the list
      const blobId = await this.store(buffer, metadata);
      
      logger.info(`Todo list successfully stored with blob ID: ${blobId}`);
      return blobId;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to store todo list: ${error instanceof Error ? error.message : String(error)}`,
        'store todo list'
      );
    }
  }
  
  /**
   * Retrieves a todo list from storage.
   * 
   * @param blobId - The blob ID for the list
   * @returns Promise resolving to the retrieved TodoList
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if retrieval fails
   */
  public async retrieveTodoList(blobId: string): Promise<TodoList> {
    try {
      // Retrieve the blob
      const { content, metadata } = await this.retrieve(blobId);
      
      // Parse and validate the todo list data
      const todoList = this.parseTodoListData(content);
      
      // Add the blob ID to the list for reference
      todoList.walrusBlobId = blobId;
      
      return todoList;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to retrieve todo list from blob ${blobId}: ${error instanceof Error ? error.message : String(error)}`,
        'retrieve todo list'
      );
    }
  }
  
  /**
   * Validates todo data structure and fields.
   * 
   * @param todo - The todo to validate
   * @throws {ValidationError} if validation fails
   */
  private validateTodoData(todo: Todo): void {
    // Validate required fields
    if (!todo.id || typeof todo.id !== 'string') {
      throw new ValidationError('Invalid todo: missing or invalid id', {
        field: 'id',
        recoverable: false,
        operation: 'todo validation'
      });
    }
    
    if (!todo.title || typeof todo.title !== 'string') {
      throw new ValidationError('Invalid todo: missing or invalid title', {
        field: 'title',
        recoverable: false,
        operation: 'todo validation'
      });
    }
    
    if (typeof todo.completed !== 'boolean') {
      throw new ValidationError('Invalid todo: completed must be a boolean', {
        field: 'completed',
        recoverable: false,
        operation: 'todo validation'
      });
    }
    
    // Validate date fields
    if (!todo.createdAt || isNaN(Date.parse(todo.createdAt))) {
      throw new ValidationError('Invalid todo: invalid createdAt date', {
        field: 'createdAt',
        recoverable: false,
        operation: 'todo validation'
      });
    }
    
    if (!todo.updatedAt || isNaN(Date.parse(todo.updatedAt))) {
      throw new ValidationError('Invalid todo: invalid updatedAt date', {
        field: 'updatedAt',
        recoverable: false,
        operation: 'todo validation'
      });
    }
    
    // Validate optional date fields if present
    if (todo.completedAt && isNaN(Date.parse(todo.completedAt))) {
      throw new ValidationError('Invalid todo: invalid completedAt date', {
        field: 'completedAt',
        recoverable: false,
        operation: 'todo validation'
      });
    }
    
    if (todo.dueDate && isNaN(Date.parse(todo.dueDate))) {
      throw new ValidationError('Invalid todo: invalid dueDate', {
        field: 'dueDate',
        recoverable: false,
        operation: 'todo validation'
      });
    }
  }
  
  /**
   * Validates todo list data structure and fields.
   * 
   * @param todoList - The todo list to validate
   * @throws {ValidationError} if validation fails
   */
  private validateTodoListData(todoList: TodoList): void {
    // Validate required fields
    if (!todoList.id || typeof todoList.id !== 'string') {
      throw new ValidationError('Invalid todo list: missing or invalid id', {
        field: 'id',
        recoverable: false,
        operation: 'list validation'
      });
    }
    
    if (!todoList.name || typeof todoList.name !== 'string') {
      throw new ValidationError('Invalid todo list: missing or invalid name', {
        field: 'name',
        recoverable: false,
        operation: 'list validation'
      });
    }
    
    if (!Array.isArray(todoList.todos)) {
      throw new ValidationError('Invalid todo list: todos must be an array', {
        field: 'todos',
        recoverable: false,
        operation: 'list validation'
      });
    }
    
    // Validate date fields
    if (!todoList.createdAt || isNaN(Date.parse(todoList.createdAt))) {
      throw new ValidationError('Invalid todo list: invalid createdAt date', {
        field: 'createdAt',
        recoverable: false,
        operation: 'list validation'
      });
    }
    
    if (!todoList.updatedAt || isNaN(Date.parse(todoList.updatedAt))) {
      throw new ValidationError('Invalid todo list: invalid updatedAt date', {
        field: 'updatedAt',
        recoverable: false,
        operation: 'list validation'
      });
    }
    
    // Validate each todo in the list
    try {
      todoList.todos.forEach(todo => this.validateTodoData(todo));
    } catch (error) {
      // Wrap the error with list context
      if (error instanceof ValidationError) {
        throw new ValidationError(`Invalid todo in list: ${error.message}`, {
          field: error.details?.field,
          recoverable: false,
          operation: 'list validation',
          cause: error
        });
      }
      throw error;
    }
  }
  
  /**
   * Parses binary data into a Todo object.
   * 
   * @param data - The binary data to parse
   * @returns The parsed Todo object
   * @throws {ValidationError} if parsing fails
   */
  private parseTodoData(data: Uint8Array): Todo {
    try {
      // Convert binary to text
      const todoData = new TextDecoder().decode(data);
      
      // Parse JSON
      let todo: Todo;
      try {
        todo = JSON.parse(todoData) as Todo;
      } catch (parseError) {
        throw new ValidationError(`Failed to parse todo JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`, {
          operation: 'todo parsing',
          recoverable: false,
          cause: parseError instanceof Error ? parseError : undefined
        });
      }
      
      // Validate parsed data
      this.validateTodoData(todo);
      
      return todo;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ValidationError(
        `Failed to parse todo data: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'todo parsing',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Parses binary data into a TodoList object.
   * 
   * @param data - The binary data to parse
   * @returns The parsed TodoList object
   * @throws {ValidationError} if parsing fails
   */
  private parseTodoListData(data: Uint8Array): TodoList {
    try {
      // Convert binary to text
      const listData = new TextDecoder().decode(data);
      
      // Parse JSON
      let todoList: TodoList;
      try {
        todoList = JSON.parse(listData) as TodoList;
      } catch (parseError) {
        throw new ValidationError(`Failed to parse todo list JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`, {
          operation: 'list parsing',
          recoverable: false,
          cause: parseError instanceof Error ? parseError : undefined
        });
      }
      
      // Validate parsed data
      this.validateTodoListData(todoList);
      
      return todoList;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ValidationError(
        `Failed to parse todo list data: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'list parsing',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
}