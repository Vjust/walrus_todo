import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { Todo, TodoList } from '../types/todo';
import { STORAGE_CONFIG } from '../constants';
import { generateId } from '../utils/id-generator';
import { CLIError } from '../types/errors/consolidated';
import { configService } from './config-service';
import { Logger } from '../utils/Logger';

const logger = new Logger('todoService.consolidated');

/**
 * TodoService - A consolidated service class for managing Todo lists and items.
 *
 * This class provides a comprehensive set of methods to handle Todo data, including creating and
 * managing Todo lists, adding, updating, and deleting individual Todo items. It supports both
 * local file system storage and integration with blockchain storage through metadata tracking.
 *
 * Implemented as a singleton for consistent state management across the application.
 *
 * Key features:
 * - Complete CRUD operations for todo lists and items
 * - Advanced search capabilities across lists and by various criteria
 * - Support for local and blockchain storage metadata
 * - Robust error handling and type safety
 * - Backward compatibility with previous implementations
 *
 * @class TodoService
 */
export class TodoService {
  /**
   * Singleton instance of the TodoService
   * @private
   * @static
   */
  private static _instance: TodoService;

  /**
   * Directory path where todo list files are stored
   * @private
   */
  private readonly todosDir: string;

  /**
   * Private constructor to enforce singleton pattern
   * Initializes a new instance of TodoService and ensures the todos directory exists
   */
  private constructor() {
    this.todosDir = path.join(process.cwd(), STORAGE_CONFIG.TODOS_DIR);
    this.ensureTodosDirectory();
  }

  /**
   * Gets the singleton instance of TodoService
   * @returns {TodoService} The singleton instance
   */
  public static getInstance(): TodoService {
    if (!TodoService._instance) {
      TodoService._instance = new TodoService();
    }
    return TodoService._instance;
  }

  /**
   * Ensures the todos directory exists
   * @private
   */
  private ensureTodosDirectory(): void {
    try {
      if (!fs.existsSync(this.todosDir)) {
        fs.mkdirSync(this.todosDir, { recursive: true });
      }
    } catch (_error) {
      // Silently catch but log the error for debugging
      logger.error(`Failed to create todos directory: ${_error}`);
    }
  }

  /**
   * Retrieves all available todo list names from the storage directory
   *
   * @returns {Promise<string[]>} Array of todo list names without file extensions
   */
  async getAllLists(): Promise<string[]> {
    const files = await fsPromises.readdir(this.todosDir).catch(() => []);
    return files
      .filter(f => f.endsWith(STORAGE_CONFIG.FILE_EXT))
      .map(f => f.replace(STORAGE_CONFIG.FILE_EXT, ''));
  }

  /**
   * Lists all todos from all available todo lists
   *
   * @returns {Promise<Todo[]>} Aggregated array of todos from all lists
   */
  async listTodos(): Promise<Todo[]> {
    const lists = await this.getAllLists();
    const allTodos: Todo[] = [];

    for (const listName of lists) {
      const list = await this.getList(listName);
      if (list && list.todos && Array.isArray(list.todos)) {
        allTodos.push(...list.todos);
      }
    }

    return allTodos;
  }

  /**
   * Gets filtered todos based on criteria
   *
   * @param {object} options - Filter options
   * @param {string} [options.listName] - Optional list name to filter by
   * @param {boolean} [options.completed] - Filter by completion status
   * @param {string} [options.priority] - Filter by priority level
   * @param {string[]} [options.tags] - Filter by tags (todos must have ALL specified tags)
   * @returns {Promise<Todo[]>} Filtered array of todos
   */
  async getFilteredTodos(
    options: {
      listName?: string;
      completed?: boolean;
      priority?: string;
      tags?: string[];
    } = {}
  ): Promise<Todo[]> {
    let todos: Todo[];

    // Get todos from specific list or all lists
    if (options.listName) {
      const list = await this.getList(options.listName);
      todos = list?.todos || [];
    } else {
      todos = await this.listTodos();
    }

    // Apply filters
    return todos.filter(todo => {
      // Filter by completion status if specified
      if (
        options.completed !== undefined &&
        todo.completed !== options.completed
      ) {
        return false;
      }

      // Filter by priority if specified
      if (options.priority && todo.priority !== options.priority) {
        return false;
      }

      // Filter by tags if specified (todo must have ALL specified tags)
      if (options.tags && options.tags.length > 0) {
        if (!todo.tags) return false;
        return options.tags.every(tag => todo.tags.includes(tag));
      }

      return true;
    });
  }

  /**
   * Creates a new todo list with the specified name and owner
   *
   * @param {string} name - Name of the new todo list
   * @param {string} owner - Owner identifier for the list
   * @returns {Promise<TodoList>} The newly created todo list
   * @throws {CLIError} If a list with the given name already exists
   */
  async createList(name: string, owner: string): Promise<TodoList> {
    const existingList = await this.getList(name);
    if (existingList) {
      throw new CLIError(`List "${name}" already exists`, 'LIST_EXISTS');
    }

    // Initialize new list with metadata
    const newList: TodoList = {
      id: generateId(),
      name,
      owner,
      todos: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveList(name, newList);
    return newList;
  }

  /**
   * Retrieves a todo list by name
   *
   * @param {string} listName - Name of the todo list to retrieve
   * @returns {Promise<TodoList | null>} The todo list if found, null otherwise
   */
  async getList(listName: string): Promise<TodoList | null> {
    try {
      // Support both methods for backward compatibility
      try {
        // First try using configService for backward compatibility
        const list = await configService.getLocalTodos(listName);
        if (list) return list;
      } catch (err) {
        // Fallback to direct file access if configService method fails
      }

      const data = await fsPromises.readFile(
        path.join(this.todosDir, `${listName}${STORAGE_CONFIG.FILE_EXT}`),
        'utf8'
      );
      return JSON.parse(data) as TodoList;
    } catch (err) {
      // Return null instead of throwing if list doesn't exist
      return null;
    }
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
    const list = await this.getList(listName);
    if (!list) return null;
    return list.todos.find(t => t.id === todoId) || null;
  }

  /**
   * Finds a todo by ID across all lists
   *
   * @param {string} todoId - ID of the todo to find
   * @returns {Promise<{todo: Todo, listName: string} | null>} The todo and list name if found, null otherwise
   */
  async findTodoById(
    todoId: string
  ): Promise<{ todo: Todo; listName: string } | null> {
    const lists = await this.getAllLists();

    for (const listName of lists) {
      const list = await this.getList(listName);
      if (!list) continue;

      const todo = list.todos.find(t => t.id === todoId);
      if (todo) {
        return { todo, listName };
      }
    }

    return null;
  }

  /**
   * Gets a todo item by its title from a specified list (case-insensitive match)
   *
   * @param {string} title - Title of the todo to retrieve
   * @param {string} [listName='default'] - Name of the list containing the todo
   * @returns {Promise<Todo | null>} The todo if found, null otherwise
   */
  async getTodoByTitle(
    title: string,
    listName: string = 'default'
  ): Promise<Todo | null> {
    const list = await this.getList(listName);
    if (!list) return null;
    // Find todo with exact title match (case-insensitive)
    return (
      list.todos.find(t => t.title.toLowerCase() === title.toLowerCase()) ||
      null
    );
  }

  /**
   * Gets a todo item by either its ID or title from a specified list
   * Attempts to find by ID first, then falls back to finding by title
   *
   * @param {string} titleOrId - ID or title of the todo to retrieve
   * @param {string} [listName='default'] - Name of the list containing the todo
   * @returns {Promise<Todo | null>} The todo if found, null otherwise
   */
  async getTodoByTitleOrId(
    titleOrId: string,
    listName: string = 'default'
  ): Promise<Todo | null> {
    // First try to find by ID (for backward compatibility)
    const todoById = await this.getTodo(titleOrId, listName);
    if (todoById) return todoById;

    // If not found by ID, try to find by title
    return this.getTodoByTitle(titleOrId, listName);
  }

  /**
   * Adds a new todo to a specified list
   *
   * @param {string} listName - Name of the list to add the todo to
   * @param {Partial<Todo>} todo - Todo data (partial, missing fields will be set to defaults)
   * @returns {Promise<Todo>} The newly created todo with complete data
   * @throws {CLIError} If the specified list doesn't exist
   */
  async addTodo(listName: string, todo: Partial<Todo>): Promise<Todo> {
    let list = await this.getList(listName);

    // Create the list if it doesn't exist
    if (!list) {
      list = await this.createList(listName, 'local');
    }

    // Create a complete todo from the partial input
    const newTodo: Todo = {
      id: generateId(),
      title: todo.title || '',
      description: todo.description || '',
      completed: todo.completed || false,
      priority: todo.priority || 'medium',
      tags: todo.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: todo.private !== undefined ? todo.private : true,
      storageLocation: todo.storageLocation || 'local',
    };

    // Add to list and persist changes
    list.todos.push(newTodo);
    list.updatedAt = new Date().toISOString();
    await this.saveList(listName, list);
    return newTodo;
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
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todoIndex = list.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) {
      throw new CLIError(
        `Todo "${todoId}" not found in list "${listName}"`,
        'TODO_NOT_FOUND'
      );
    }

    // Create updated todo by merging existing data with updates
    const todo = list.todos[todoIndex];
    const updatedTodo: Todo = {
      ...todo,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Update in list and persist changes
    list.todos[todoIndex] = updatedTodo;
    list.updatedAt = new Date().toISOString();
    await this.saveList(listName, list);
    return updatedTodo;
  }

  /**
   * Updates the storage location of a todo
   *
   * @param {string} listName - Name of the list containing the todo
   * @param {string} todoId - ID of the todo to update
   * @param {string} storageLocation - New storage location ('local', 'blockchain', 'walrus')
   * @returns {Promise<Todo>} The updated todo with new storage location
   */
  async updateStorageLocation(
    listName: string,
    todoId: string,
    storageLocation: string
  ): Promise<Todo> {
    // Ensure storageLocation is a valid enum value
    const validLocations = ['local', 'blockchain', 'both'] as const;
    type LocalStorageLocation = (typeof validLocations)[number];

    // Map 'walrus' to 'blockchain' for compatibility
    const mappedLocation =
      storageLocation === 'walrus' ? 'blockchain' : storageLocation;

    const location = validLocations.includes(
      mappedLocation as LocalStorageLocation
    )
      ? (mappedLocation as LocalStorageLocation)
      : 'local';

    return this.updateTodo(listName, todoId, { storageLocation: location });
  }

  /**
   * Saves blockchain-related metadata to a todo
   *
   * @param {string} listName - Name of the list containing the todo
   * @param {string} todoId - ID of the todo to update
   * @param {object} metadata - Blockchain metadata
   * @param {string} metadata.objectId - Blockchain object ID
   * @param {string} metadata.transactionDigest - Transaction digest
   * @returns {Promise<Todo>} The updated todo with blockchain metadata
   */
  async saveBlockchainMetadata(
    listName: string,
    todoId: string,
    metadata: { objectId: string; transactionDigest: string }
  ): Promise<Todo> {
    // Create a properly typed update object
    const updateData: Partial<Todo> = {
      // Use the nftObjectId which is part of the Todo interface
      nftObjectId: metadata.objectId,
      // Store transaction info as tags for now
      tags: [`tx:${metadata.transactionDigest}`],
      storageLocation: 'blockchain',
    };

    return this.updateTodo(listName, todoId, updateData);
  }

  /**
   * Toggles the completion status of a todo item
   *
   * @param {string} listName - Name of the list containing the todo
   * @param {string} itemId - ID of the todo to toggle status
   * @param {boolean} checked - New completion status (true = completed, false = not completed)
   * @returns {Promise<void>}
   */
  async toggleItemStatus(
    listName: string,
    itemId: string,
    checked: boolean
  ): Promise<void> {
    await this.updateTodo(listName, itemId, {
      completed: checked,
      completedAt: checked ? new Date().toISOString() : undefined,
    });
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
    const list = await this.getList(listName);
    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    const todoIndex = list.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) {
      throw new CLIError(
        `Todo "${todoId}" not found in list "${listName}"`,
        'TODO_NOT_FOUND'
      );
    }

    // Remove todo from list and persist changes
    list.todos.splice(todoIndex, 1);
    list.updatedAt = new Date().toISOString();
    await this.saveList(listName, list);
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
    const file = path.join(
      this.todosDir,
      `${listName}${STORAGE_CONFIG.FILE_EXT}`
    );
    try {
      // Support both methods for backward compatibility
      try {
        // First try using configService
        await configService.saveListData(listName, list);
        return;
      } catch (err) {
        // Fallback to direct file access if configService method fails
      }

      await fsPromises.writeFile(file, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      throw new CLIError(
        `Failed to save list "${listName}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        'SAVE_FAILED'
      );
    }
  }

  /**
   * Deletes a todo list from persistent storage
   *
   * @param {string} listName - Name of the list to delete
   * @returns {Promise<void>}
   * @throws {CLIError} If deletion fails due to file system errors
   */
  async deleteList(listName: string): Promise<void> {
    const file = path.join(
      this.todosDir,
      `${listName}${STORAGE_CONFIG.FILE_EXT}`
    );
    try {
      if (fs.existsSync(file)) {
        await fsPromises.unlink(file);
      }
    } catch (err) {
      throw new CLIError(
        `Failed to delete list "${listName}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        'DELETE_FAILED'
      );
    }
  }
}

// Export the singleton instance
export const todoService = TodoService.getInstance();
