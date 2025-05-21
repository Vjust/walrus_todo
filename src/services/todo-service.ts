import { Todo, TodoList } from '../types';
import { configService } from './config-service';
import { generateId } from '../utils/id-generator';
import { CLIError } from '../types/error';
import * as fs from 'fs';

export class TodoService {
  private todosPath: string;
  private initialized: boolean;
  private initializationPromise: Promise<void>;
  private fs: typeof fs.promises;
  
  /**
   * Constructor for TodoService
   * Initializes the service and verifies storage directory is accessible
   * 
   * @throws {CLIError} If initialization fails due to invalid configuration
   */
  constructor() {
    // Initialize fs.promises once for consistent usage
    this.fs = fs.promises;
    
    // Get storage path from config service using the proper getter method
    this.todosPath = configService.getTodosDirectory();
    
    // Validate that todosPath is properly set
    if (!this.todosPath) {
      throw new CLIError(
        'Failed to initialize TodoService: todosPath is not properly set',
        'INITIALIZATION_FAILED'
      );
    }
    
    // Verify the todos directory exists and is accessible
    // Initialize a property to track initialization status
    this.initialized = false;
    this.initializationPromise = this.verifyStorageDirectory()
      .then(() => {
        this.initialized = true;
      })
      .catch(error => {
        // Fail fast by logging and throwing error
        console.error(`Error initializing TodoService: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw new CLIError(
          `Failed to initialize TodoService: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INITIALIZATION_FAILED'
        );
      });
  }
  
  /**
   * Verifies that the todos storage directory exists and is accessible
   * Creates the directory if it doesn't exist
   * 
   * @private
   * @returns {Promise<void>}
   */
  private async verifyStorageDirectory(): Promise<void> {
    try {
      // Check if directory exists, create it if it doesn't
      try {
        await this.fs.access(this.todosPath);
      } catch (error) {
        // Directory doesn't exist or is not accessible, create it
        await this.fs.mkdir(this.todosPath, { recursive: true });
      }
      
      // Double-check that the directory is now accessible
      await this.fs.access(this.todosPath);
    } catch (error) {
      throw new CLIError(
        `Failed to access or create todos directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORAGE_ACCESS_FAILED'
      );
    }
  }
  
  /**
   * Ensures that the service is initialized before performing operations
   * 
   * @private
   * @throws {CLIError} If service initialization fails
   * @returns {Promise<void>}
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      await this.initializationPromise;
    } catch (error) {
      throw new CLIError(
        `TodoService not properly initialized: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SERVICE_NOT_INITIALIZED'
      );
    }
    
    if (!this.initialized) {
      throw new CLIError(
        'TodoService initialization did not complete successfully',
        'SERVICE_NOT_INITIALIZED'
      );
    }
  }
  
  async createList(name: string, owner: string): Promise<TodoList> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    const list: TodoList = {
      id: generateId(),
      name,
      owner,
      todos: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await configService.saveListData(name, list);
    return list;
  }

  async getList(name: string): Promise<TodoList | null> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    return configService.getLocalTodos(name);
  }

  async addTodo(listName: string, todo: Partial<Todo>): Promise<Todo> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const newTodo: Todo = {
      id: generateId(),
      title: todo.title || '',
      completed: todo.completed || false,
      description: todo.description,
      priority: todo.priority || 'medium',
      tags: todo.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: true
    };

    list.todos.push(newTodo);
    list.updatedAt = new Date().toISOString();
    await configService.saveListData(listName, list);
    return newTodo;
  }

  async toggleItemStatus(listName: string, todoId: string, completed: boolean): Promise<void> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todo = list.todos.find(t => t.id === todoId);
    if (!todo) {
      throw new CLIError(`Todo "${todoId}" not found in list "${listName}"`, 'TODO_NOT_FOUND');
    }

    todo.completed = completed;
    todo.updatedAt = new Date().toISOString();
    if (completed) {
      todo.completedAt = new Date().toISOString();
    } else {
      delete todo.completedAt;
    }

    await configService.saveListData(listName, list);
  }
}