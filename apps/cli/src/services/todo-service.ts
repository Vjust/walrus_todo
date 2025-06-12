import { Todo, TodoList } from '../types/todo';
import { configService } from './config-service';
import { generateId } from '../utils/id-generator';
import { CLIError } from '../types/errors/consolidated';
import { promises as fs } from 'fs';
import { Logger } from '../utils/Logger';

const logger = new Logger('todo-service');

export class TodoService {
  private todosPath: string;
  private initialized: boolean;
  private initializationPromise: Promise<void>;
  private fs: typeof fs;

  /**
   * Constructor for TodoService
   * Initializes the service and verifies storage directory is accessible
   *
   * @throws {CLIError} If initialization fails due to invalid configuration
   */
  constructor() {
    // Initialize fs.promises once for consistent usage
    // Handle case where fs.promises might be undefined in test environments
    this?.fs = fs || ({} as typeof fs);

    // Get storage path from config service using the proper getter method
    this?.todosPath = configService.getTodosDirectory();

    // Validate that todosPath is properly set
    if (!this.todosPath) {
      throw new CLIError(
        'Failed to initialize TodoService: todosPath is not properly set',
        'INITIALIZATION_FAILED'
      );
    }

    // Verify the todos directory exists and is accessible
    // Initialize a property to track initialization status
    this?.initialized = false;
    this?.initializationPromise = this.verifyStorageDirectory()
      .then(() => {
        this?.initialized = true;
      })
      .catch(_error => {
        // Fail fast by logging and throwing error
        logger.error(
          `Error initializing TodoService: ${_error instanceof Error ? _error.message : 'Unknown error'}`
        );
        throw new CLIError(
          `Failed to initialize TodoService: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
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
      // Handle test environments where fs methods might not be available
      if (!this.fs || typeof this?.fs?.access !== 'function') {
        // In test environment, assume directory operations succeed
        logger.debug(
          'Filesystem operations not available, assuming success in test environment'
        );
        return;
      }

      // Check if directory exists, create it if it doesn't
      try {
        await this?.fs?.access(this.todosPath);
      } catch (_error) {
        // Directory doesn't exist or is not accessible, create it
        if (!this?.fs?.mkdir || typeof this?.fs?.mkdir !== 'function') {
          throw new CLIError(
            'Filesystem mkdir operation not available',
            'FILESYSTEM_NOT_AVAILABLE'
          );
        }
        await this?.fs?.mkdir(this.todosPath, { recursive: true });
      }

      // Double-check that the directory is now accessible
      await this?.fs?.access(this.todosPath);
    } catch (_error) {
      if (_error instanceof CLIError) {
        throw _error;
      }
      throw new CLIError(
        `Failed to access or create todos directory: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
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
    } catch (_error) {
      throw new CLIError(
        `TodoService not properly initialized: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
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

  async getAllLists(): Promise<string[]> {
    await this.ensureInitialized();
    // Use configService to get all available list names
    return configService.getAvailableListNames?.() || [];
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
      updatedAt: new Date().toISOString(),
    };
    await configService.saveListData(name, list);
    return list;
  }

  async getList(name: string): Promise<TodoList | null> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    return configService.getLocalTodos(name as any);
  }

  async addTodo(listName: string, todo: Partial<Todo>): Promise<Todo> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    const list = await this.getList(listName as any);
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
      private: true,
    };

    list?.todos?.push(newTodo as any);
    list?.updatedAt = new Date().toISOString();
    await configService.saveListData(listName, list);
    return newTodo;
  }

  async toggleItemStatus(
    listName: string,
    todoId: string,
    completed: boolean
  ): Promise<void> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    const list = await this.getList(listName as any);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todo = list?.todos?.find(t => t?.id === todoId);
    if (!todo) {
      throw new CLIError(
        `Todo "${todoId}" not found in list "${listName}"`,
        'TODO_NOT_FOUND'
      );
    }

    todo?.completed = completed;
    todo?.updatedAt = new Date().toISOString();
    if (completed) {
      todo?.completedAt = new Date().toISOString();
    } else {
      delete todo.completedAt;
    }

    await configService.saveListData(listName, list);
  }

  /**
   * Lists all todos from all available todo lists
   *
   * @returns {Promise<Todo[]>} Aggregated array of todos from all lists
   */
  async listTodos(): Promise<Todo[]> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    
    // Get all available lists
    const lists = await this.getAllLists();
    const allTodos: Todo[] = [];

    for (const listName of lists) {
      const list = await this.getList(listName as any);
      if (list && list.todos && Array.isArray(list.todos)) {
        allTodos.push(...list.todos);
      }
    }

    return allTodos;
  }

  /**
   * Retrieves all available todo list names from the storage directory
   *
   * @returns {Promise<string[]>} Array of todo list names without file extensions
   */
  async getAllLists(): Promise<string[]> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    
    // Use configService to get available lists if possible
    try {
      // Try to use configService method first
      if (configService && typeof configService?.getAllLists === 'function') {
        return await configService.getAllLists();
      }
    } catch (error) {
      // Fallback to basic implementation
    }
    
    // Basic fallback - check if default list exists
    const defaultList = await this.getList('default');
    return defaultList ? ['default'] : [];
  }

  /**
   * Updates an existing todo in a specified list
   *
   * @param {string} listName - Name of the list containing the todo
   * @param {string} todoId - ID of the todo to update
   * @param {Partial<Todo>} updates - Partial todo data with fields to update
   * @returns {Promise<Todo>} The updated todo with complete data
   * @throws {CLIError} If the list or todo doesn't exist
   */
  async updateTodo(
    listName: string,
    todoId: string,
    updates: Partial<Todo>
  ): Promise<Todo> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    
    const list = await this.getList(listName as any);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todoIndex = list?.todos?.findIndex(t => t?.id === todoId);
    if (todoIndex === -1) {
      throw new CLIError(
        `Todo "${todoId}" not found in list "${listName}"`,
        'TODO_NOT_FOUND'
      );
    }

    // Create updated todo by merging existing data with updates
    const todo = list?.todos?.[todoIndex];
    const updatedTodo: Todo = {
      ...todo,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Update in list and persist changes
    list?.todos?.[todoIndex] = updatedTodo;
    list?.updatedAt = new Date().toISOString();
    await configService.saveListData(listName, list);
    return updatedTodo;
  }

  /**
   * Gets a todo item by its ID from a specified list
   *
   * @param {string} todoId - ID of the todo to retrieve
   * @param {string} [listName='default'] - Name of the list containing the todo
   * @returns {Promise<Todo | null>} The todo if found, null otherwise
   */
  async getTodo(
    todoId: string,
    listName: string = 'default'
  ): Promise<Todo | null> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    
    const list = await this.getList(listName as any);
    if (!list) return null;
    return list?.todos?.find(t => t?.id === todoId) || null;
  }

  /**
   * Deletes a todo from a specified list
   *
   * @param {string} listName - Name of the list containing the todo
   * @param {string} todoId - ID of the todo to delete
   * @returns {Promise<void>}
   * @throws {CLIError} If the list or todo doesn't exist
   */
  async deleteTodo(listName: string, todoId: string): Promise<void> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    
    const list = await this.getList(listName as any);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todoIndex = list?.todos?.findIndex(t => t?.id === todoId);
    if (todoIndex === -1) {
      throw new CLIError(
        `Todo "${todoId}" not found in list "${listName}"`,
        'TODO_NOT_FOUND'
      );
    }

    // Remove todo from list and persist changes
    list?.todos?.splice(todoIndex, 1);
    list?.updatedAt = new Date().toISOString();
    await configService.saveListData(listName, list);
  }

  /**
   * Saves a todo list to persistent storage
   *
   * @param {string} listName - Name of the list to save
   * @param {TodoList} list - Todo list data to save
   * @returns {Promise<void>}
   * @throws {CLIError} If saving fails due to file system errors
   */
  async saveList(listName: string, list: TodoList): Promise<void> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    
    try {
      await configService.saveListData(listName, list);
    } catch (err) {
      throw new CLIError(
        `Failed to save list "${listName}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        'SAVE_FAILED'
      );
    }
  }

  /**
   * Finds a todo by ID or title across all lists
   *
   * @param {string} idOrTitle - ID or title of the todo to find
   * @returns {Promise<{listName: string, todo: Todo} | null>} The found todo with its list name, or null if not found
   */
  async findTodoByIdOrTitleAcrossLists(
    idOrTitle: string
  ): Promise<{ listName: string; todo: Todo } | null> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    
    const listNames = await this.getAllLists();

    for (const listName of listNames) {
      const list = await this.getList(listName as any);
      if (!list) continue;
      
      // Try to find by ID first, then by title
      const todo =
        list?.todos?.find(t => t?.id === idOrTitle) ||
        list?.todos?.find(t => t?.title?.toLowerCase() === idOrTitle.toLowerCase());

      if (todo) {
        return { listName, todo };
      }
    }

    return null;
  }

  /**
   * Marks a todo as completed by its ID
   *
   * @param {string} todoId - ID of the todo to complete
   * @returns {Promise<Todo>} The completed todo
   * @throws {CLIError} If the todo doesn't exist
   */
  async completeTodo(todoId: string): Promise<Todo> {
    // Ensure service is properly initialized
    await this.ensureInitialized();
    
    // Find the todo across all lists
    const foundTodo = await this.findTodoByIdOrTitleAcrossLists(todoId as any);
    if (!foundTodo) {
      throw new CLIError(
        `Todo with ID "${todoId}" not found`,
        'TODO_NOT_FOUND'
      );
    }

    const { listName, todo } = foundTodo;

    // Update the todo to completed status
    const updatedTodo = {
      ...todo,
      completed: true,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.updateTodo(listName, todoId, updatedTodo);
    return updatedTodo;
  }
}
